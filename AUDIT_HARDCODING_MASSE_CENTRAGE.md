# AUDIT & REFACTORING — ÉRADICATION DU HARD-CODING (Module Masse & Centrage)

> **Statut** : Plan d'exécution contraignant — Politique « Zéro Tolérance / Fail-Safe »
> **Périmètre** : tout chemin de code touchant masse, bras de levier, moment, CG, densité carburant, conversions d'unités.
> **Doctrine** : *Une donnée manquante ou invalide ne se devine pas. Elle bloque le calcul.* En aéronautique, un résultat faux d'apparence valide est plus dangereux que pas de résultat du tout.

---

## 0. Constat préalable (lire avant tout)

La remédiation précédente (anomalies **A1–A13**) a assaini le **noyau** du module :

| Fichier | État | Comportement correct déjà en place |
|---|---|---|
| `src/core/stores/weightBalanceStore.js` | ✅ Sain | Refuse le calcul (`return null`) si masse à vide / MTOW absente ; bras dérivés via `armOrNull` (jamais inventés) ; `cgReliable`, `isWithinCG = null`, **fail-closed** |
| `src/utils/cgEnvelope.js` | ✅ Sain | Source unique de l'enveloppe ; `source:'missing'` + `null` si absente |
| `src/utils/fuelDensity.js` | ✅ Sain | `getFuelDensity()` renvoie **`null`** si type inconnu (pas de fallback interne) |
| `src/utils/constants.js` | ✅ Sain | `DEFAULT_AIRCRAFT` supprimé ; `FUEL_DENSITIES` = table unique |
| `src/services/weatherAPI.js` | ✅ Sain | `getMockMETAR` supprimé (A5) |

**Le problème n'est plus le noyau. Le problème, c'est la périphérie qui contourne le noyau.**

Deux pathologies dominent et constituent la cible de cet audit :

1. **Le fallback `??` / `||` qui ré-invente ce que le noyau a refusé d'inventer.**
   `getFuelDensity()` renvoie volontairement `null` pour un type inconnu — puis **6 appelants** écrivent `?? 0.84` ou `?? 0.72`. Résultat : une donnée manquante produit **0.84 dans 3 chemins et 0.72 dans 3 autres**. La divergence de densité que l'anomalie A1 avait éradiquée a été **réintroduite par l'opérateur de fallback**.

2. **Deux moteurs de calcul, deux politiques d'erreur opposées.**
   `weightBalanceStore.js` est *fail-closed* (refuse, renvoie `null`). `weight-balance/utils/calculations.js` (les 4 cartes scénarios FULLTANK / T-O / LANDING / ZFW) est *fail-silent* : bras manquant ⇒ `|| 0` ⇒ moment 0 ⇒ **CG faux d'apparence valide**. Les deux affichent au pilote des chiffres issus de règles contradictoires.

Tout le reste découle de ces deux pathologies.

---

## 1. CHASSE AU HARD-CODING — Détection & Cartographie

### 1.1 Analyse statique (SCA) — la méthode

La détection se fait en trois passes complémentaires. **Aucune n'est optionnelle.**

#### Passe A — Grep ciblé (pack de commandes reproductible)

À exécuter depuis `alflight/`. Chaque motif vise une famille précise de hard-coding.

```bash
# 1. Fallbacks numériques masqués (LA priorité) : "?? <nombre>" et "|| <nombre>"
rg -n --glob 'src/**/*.{js,jsx}' '(\?\?|\|\|)\s*-?\d+(\.\d+)?'

# 2. Densités carburant écrites en dur (doivent venir UNIQUEMENT de constants.js)
rg -n --glob 'src/**/*.{js,jsx}' '0\.(72|74|80|84)\b'

# 3. Chaînes d'unités brutes hors modules d'unités autorisés
rg -n --glob 'src/**/*.{js,jsx}' "['\"](mm|cm|kg|lbs|ltr|gal|in|m)['\"]" \
  -g '!src/utils/unitConversions.js' -g '!src/features/aircraft/utils/mbUnits.js'

# 4. Verdicts / placeholders figés
rg -n --glob 'src/**/*.{js,jsx}' 'placeholder|InLimits:\s*true|return\s+true\s*;?\s*//'

# 5. Immatriculations en dur (résidus de test / correctifs ponctuels)
rg -n --glob 'src/**/*.{js,jsx}' '[FDGN]-[A-Z]{3,4}'

# 6. Constantes physiques dupliquées (facteurs de conversion répétés)
rg -n --glob 'src/**/*.{js,jsx}' '3\.78541|2\.20462|0\.453592|6\.01|25\.4|0\.0254'

# 7. Logs de debug oubliés dans les chemins de calcul
rg -n --glob 'src/**/*.{js,jsx}' 'console\.(log|debug)' -g 'src/utils/**' -g 'src/core/stores/**' -g 'src/features/weight-balance/**'
```

#### Passe B — Linter (détection structurelle, voir Phase 4)
Règles `no-restricted-syntax` (AST) qui rejettent `LogicalExpression` avec opérande droite littérale dans les fichiers de calcul. Le grep trouve le texte ; l'AST trouve la *structure* (insensible au formatage).

#### Passe C — Revue manuelle des « zones rouges »
Fichiers à relire ligne à ligne, sans exception :
`weight-balance/utils/calculations.js` · `utils/unitConversions.js` · `features/aircraft/utils/mbUnits.js` · `features/aircraft/utils/centrogramMath.js` · `models/PerformanceModels.js` · `utils/aircraftValidation.js` · `core/stores/aircraftStore.js`.

### 1.2 Nettoyage des résidus de test

Distinction fondamentale, à appliquer sans état d'âme :

- **Fixtures de test dans `__tests__/`** → **LÉGITIMES, on garde.** Ex. `weightBalanceStore.golden.test.js` (`F-GOLD`, `F-VARF`, `F-NOARM`, `F-NOEW`). Ce sont des cas d'or, ils doivent rester et même être **étendus** (Phase 4).
- **Données de test / correctifs ponctuels / stubs dans l'arbre de production (`src/**` hors `__tests__`)** → **À ÉRADIQUER.**

Résidus de production identifiés (détail en inventaire) :
- `aircraftStore.js:674-710` — correctif **`F-HSTR` ⇒ masse à vide 900 kg** codé en dur dans le store.
- `duplicateAircraft.js` — utilitaire dev (`F-XXXX`, `F-HSTR`→`F-ABCD`) vivant dans `src/`.
- `aircraftValidation.js:20-25` — `DEFAULT_AIRCRAFT_VALUES` injecté dans tout avion incomplet.
- `models/PerformanceModels.js:394-565` — moteur entier renvoyant des `return 500; // placeholder` et **`cgInLimits: true // placeholder`**.

> **Base de données** : exécuter en parallèle un audit SQL sur Supabase (staging **et** prod) : `SELECT registration FROM aircraft WHERE registration ~* 'TEST|DEMO|XXXX|ABCD|GOLD';` et toute ligne dont les bras/CG sont des ronds suspects (`empty_weight IN (600,900,1000,1150)`). La migration `dataBackupManager.js:115` nettoie déjà `F-DEMO/F-TEST` côté client — le faire aussi côté serveur.

### 1.3 Modèle d'inventaire (rempli avec l'état réel du code)

> Sévérité : **P0** = peut produire un centrage/masse faux d'apparence valide (bloquant App-Store) · **P1** = divergence/incohérence de source · **P2** = dette (magie/dup/debug).

#### Famille D — Fallbacks de densité (ré-violation de la source unique A1)

| ID | Emplacement | Valeur en dur | Impact calcul | Remplacement légitime | Sév. |
|---|---|---|---|---|---|
| HC-D1 | `weight-balance/utils/calculations.js:28` | `?? 0.84` | Type inconnu ⇒ Jet A-1 supposé ⇒ masse carburant fausse | `requireDensity(aircraft.fuelType)` → throw | **P0** |
| HC-D2 | `core/stores/weightBalanceStore.js:147` | `?? 0.84` | idem | idem | **P0** |
| HC-D3 | `weight-balance/components/ScenarioCards.jsx:22` | `?? 0.84` | idem (affichage 4 cartes) | idem | **P0** |
| HC-D4 | `core/contexts/index.jsx:439` | `?? 0.72` | **Divergent** : même entrée ⇒ 0.72 ici, 0.84 ailleurs | idem | **P0** |
| HC-D5 | `shared/hooks/useAircraftCalculations.js:49` | `?? 0.72` | **Divergent** | idem | **P0** |
| HC-D6 | `features/aircraft/utils/mbUnits.js:147` | `?? FUEL_DENSITIES.default` (0.72) | **Divergent** ; recrée une 2ᵉ table densité | Supprimer `getFuelDensity` local → ré-exporter le canonique sans `default` | **P0** |

> **Démonstration de la faille** : un avion dont `fuelType` est vide ou non normalisé donne une masse carburant **différente selon l'écran ouvert**. C'est exactement la SSOT violée que A1 prétendait clore.

#### Famille A — Bras & NaN masqués dans le moteur « scénarios »

| ID | Emplacement | Valeur en dur | Impact calcul | Remplacement légitime | Sév. |
|---|---|---|---|---|---|
| HC-A1 | `calculations.js:37` | `fuelArm = wb.fuelArm \|\| 0` (warn puis **utilise 0**) | Carburant placé au **datum** ⇒ CG faux mais affiché « valide » | Mirror du store : bras chargé absent ⇒ refus calcul | **P0** |
| HC-A2 | `calculations.js:86,96,104,112,120,145,153,164` | `(wb.*Arm \|\| 0)` (toutes stations) | Toute station chargée sans bras ⇒ moment 0 silencieux | `requireFinite(arm, label)` par station chargée | **P0** |
| HC-A3 | `calculations.js:31-34` | `\|\| 0` « pour éviter les NaN » | Masque l'absence d'entrée au lieu de la signaler | Propager `NaN`/`null` ⇒ blocage | **P1** |
| HC-A4 | `calculations.js:9` | `fobFuel?.ltr \|\| 0` | Carburant absent traité comme 0 sans alerte | Distinguer « 0 saisi » de « non renseigné » | **P1** |

> **Action structurante** : `calculations.js` et `weightBalanceStore.js` calculent **la même chose** avec deux politiques opposées. **Décision à acter** : `calculations.js` adopte intégralement la politique du store (refus + `cgReliable`), **ou** il est supprimé et les scénarios consomment le store. Deux moteurs divergents = défaut bloquant.

#### Famille C — Le collecteur central de conversion (`unitConversions.js`)

| ID | Emplacement | Valeur en dur | Impact calcul | Remplacement légitime | Sév. |
|---|---|---|---|---|---|
| HC-C1 | `unitConversions.js:167-169` | `if (!value \|\| isNaN(value)) return 0` | **Toute entrée invalide ⇒ 0** dans la fonction de conversion centrale ⇒ moment 0 | `throw new MissingInputError(...)` | **P0** |
| HC-C2 | `unitConversions.js:231-232, 249-250` | catégorie/fonction inconnue ⇒ `return numValue` (non converti) | Valeur rendue **dans la mauvaise unité** silencieusement (×100 / ×1000) | `throw` sur catégorie/clé inconnue | **P0** |
| HC-C3 | `unitConversions.js:21, 31` | `* 6.01` / `/ 6.01` (« poids moyen AVGAS ») | gal⇄lbs ignore le type carburant réel | Calculer via densité de l'avion | **P1** |
| HC-C4 | `unitConversions.js:15,16,24,25,30` | `density = DENSITIES.AVGAS` (défaut) | Densité omise ⇒ AVGAS supposé | Densité **obligatoire** (pas de défaut de paramètre) | **P1** |
| HC-C5 | `unitConversions.js:186-193, 240-245` | `console.log` à chaque conversion | Bruit + fuite de données en prod (chemin chaud) | Supprimer | **P2** |

#### Famille U — Passe-plat silencieux sur échec de conversion

| ID | Emplacement | Valeur en dur | Impact calcul | Remplacement légitime | Sév. |
|---|---|---|---|---|---|
| HC-U1 | `mbUnits.js:64-66` | `catch → return num` (non converti) | Échec conversion ⇒ valeur brute stockée en unité fausse | `throw` (laisser remonter) | **P1** |
| HC-U2 | `mbUnits.js:87-89` | `catch → return num` | idem à l'affichage | `throw` | **P1** |
| HC-U3 | `centrogramMath.js:150` | unité inconnue ⇒ `return slope` non converti | Bras lu au centrogramme rendu ×100/×1000 | `throw` sur unité inconnue | **P1** |

#### Famille P — Verdicts fantômes & placeholders (le plus dangereux)

| ID | Emplacement | Valeur en dur | Impact calcul | Remplacement légitime | Sév. |
|---|---|---|---|---|---|
| HC-P1 | `models/PerformanceModels.js:562-563` | `cgInLimits: true` / `weightInLimits: true` `// placeholder` | **Verdict de centrage figé à « OK »** | Brancher `isWithinEnvelope()` ou supprimer la classe | **P0** |
| HC-P2 | `PerformanceModels.js:396,401,406,443,448,453,458,494,498,502,506` | `return 500/10/5/120/25/…; // placeholder` | Perfs montée/croisière/carburant **inventées** | Interpolation réelle ou `throw 'non implémenté'` | **P0** |
| HC-P3 | `PerformanceModels.js:541,546,555` | `(item.weight\|\|0)` / `(item.arm\|\|0)` | Moment 0 silencieux | `requireFinite` | **P1** |

> **Règle absolue** : un placeholder qui renvoie `true` sur un verdict de sécurité est une **bombe**. Il doit `throw` (« non implémenté »), jamais retourner une valeur plausible. Mieux vaut un écran rouge qu'un faux feu vert.

#### Famille T — Résidus de test / correctifs / défauts injectés en production

| ID | Emplacement | Valeur en dur | Impact | Remplacement légitime | Sév. |
|---|---|---|---|---|---|
| HC-T1 | `core/stores/aircraftStore.js:674-710` | `F-HSTR` ⇒ `emptyWeight = 900` | Correctif data d'un avion réel **codé dans le store** | Migration DB ponctuelle, hors code applicatif | **P1** |
| HC-T2 | `utils/duplicateAircraft.js:137,151,153` | `F-XXXX` / `F-HSTR`→`F-ABCD` | Utilitaire dev dans l'arbre de prod | Déplacer en `scripts/` (hors bundle) ou supprimer | **P2** |
| HC-T3 | `utils/aircraftValidation.js:20-25, 69-73` | `DEFAULT_AIRCRAFT_VALUES` = `{maxBaggageWeight:50, maxAuxiliaryWeight:20, fuelType:'AVGAS 100LL'}` injecté | `fuelType` par défaut **pilote la densité** ⇒ création fantôme d'entrée de calcul ; limites bagages inventées | Supprimer `fuelType` du défaut ; bornes display-only **jamais** lues par le calcul | **P0** |
| HC-T4 | `utils/aircraftValidation.js:250-254` | `isAircraftDataComplete` exige encore `baggageArm`/`auxiliaryArm` | Contrat **périmé** (le store dit compartiments dynamiques) ⇒ incohérence | Aligner sur le contrat réel du store | **P1** |

#### Famille M — Constantes physiques magiques / dupliquées

| ID | Emplacement | Valeur en dur | Remplacement légitime | Sév. |
|---|---|---|---|---|
| HC-M1 | `calculations.js:12` | `GAL_TO_LTR = 3.78541` (aussi dans `unitConversions.js:19,37`) | `PHYSICAL_CONSTANTS.GAL_TO_LTR` (source unique) | **P2** |
| HC-M2 | `centrogramMath.js:147-149` | table `toMeters {m,cm,mm,in}` (duplique `armLengthConversions`) | Réutiliser `unitConversions` | **P2** |
| HC-M3 | `unitConversions.js` (épars) | `2.20462`, `0.453592`, `25.4`, `0.0254`… | Acceptables si **nommés et uniques** ; centraliser les facteurs liés au carburant | **P2** |

---

## 2. STRATÉGIE D'ÉLIMINATION & DE REDIRECTION

### 2.1 Cartographie « valeur en dur → source légitime »

| Donnée | Interdit (en dur) | Source légitime unique |
|---|---|---|
| Densité carburant | `0.84`, `0.72`, `?? 0.8x`, table locale | `constants.FUEL_DENSITIES` via `fuelDensity.getFuelDensity()` |
| Bras de levier | `\|\| 0`, `2.00`, `3.50` | `aircraft.weightBalance.*Arm` / `aircraft.armLengths.*` (certifiés) |
| Enveloppe CG | rectangle constant, `aftCG` figé | `cgEnvelope.cgLimitsAtMass()` |
| Masse à vide / MTOW / MZFW | `600`, `900`, `1150` | `aircraft.weights.*` (devis de masse certifié) |
| Unités | `'mm'`, `'kg'` codées | préférences `unitsStore` + `mbUnits` (canonique interne) |
| Facteurs physiques | `3.78541`, `6.01` épars | `PHYSICAL_CONSTANTS` (nouveau, source unique) |
| Limites bagages | `50`, `20` | `aircraft.maxBaggageWeight` réel ; sinon **non vérifié**, jamais inventé |

### 2.2 Interdiction des fallbacks masqués — la règle

> **Bannis dans tout fichier de calcul** : `X ?? <littéral>`, `X || <littéral>`, `parseFloat(X) || 0`, paramètres `= <défaut>` sur une grandeur physique, `catch → return <valeurUtilisable>`.

Le remplacement n'est PAS un autre défaut. C'est un **point de décision explicite** : soit la valeur est finie et on l'utilise, soit elle manque et on **bloque** (Phase 3).

```js
// ❌ AVANT (HC-D1) — invente une densité
const fuelDensity = getFuelDensity(aircraft.fuelType) ?? 0.84;

// ✅ APRÈS — exige la donnée ou bloque proprement
const fuelDensity = requireDensity(aircraft.fuelType, {
  aircraftId: aircraft.id, registration: aircraft.registration, equation: 'fuelMassKg = liters × density'
});
```

```js
// ❌ AVANT (HC-A1/A2) — bras manquant ⇒ moment 0 ⇒ CG faux
moment: fuelKg * (fuelArm || 0)

// ✅ APRÈS — bras d'une station CHARGÉE obligatoire
const arm = requireFinite(fuelArm, 'fuelArm', ctx); // throw si fuelKg>0 et arm absent
moment: fuelKg * arm
```

### 2.3 Centralisation des constantes physiques (nouveau module)

```js
// src/utils/physicalConstants.js — SOURCE UNIQUE des constantes physiques figées.
// Une constante physique (vraie loi) est autorisée ICI et NULLE PART AILLEURS.
export const PHYSICAL_CONSTANTS = Object.freeze({
  GAL_TO_LTR: 3.785411784,   // gallon US → litre (exact)
  LB_PER_KG: 2.2046226218,
  KG_PER_LB: 0.45359237,
  M_PER_IN: 0.0254,
  // ⚠️ AUCUNE densité carburant ici : elle dépend du carburant ⇒ constants.FUEL_DENSITIES
});
```
> Distinction clé : `3.78541` est une **vraie constante** (1 gallon = 3.785 L, toujours). `0.84` n'en est **pas** une (elle dépend du carburant) ⇒ jamais figée hors de la table densité indexée par type.

---

## 3. POLITIQUE « ZÉRO TOLÉRANCE » — Gestion des données manquantes (Fail-Safe)

### 3.1 Doctrine

> **Une donnée nécessaire et manquante BLOQUE le calcul. La machine ne suppose jamais.**

Trois interdits absolus :
1. **Interdit de deviner** : pas de défaut de substitution sur une grandeur physique.
2. **Interdit de créer un élément fantôme** : pas de bras, point de centrage, station ou avion générique fabriqué pour « sauver » un calcul.
3. **Interdit du faux vert** : un verdict indéterminé n'est **jamais** « dans les limites » (*fail-closed*, déjà appliqué dans le store — à généraliser).

### 3.2 Contrat technique — `requireFinite` / `MissingInputError`

```js
// src/utils/calcGuards.js
export class MissingInputError extends Error {
  constructor(variable, ctx = {}) {
    super(`[CALC_BLOCKED] Donnée requise manquante : « ${variable} »`);
    this.name = 'MissingInputError';
    this.variable = variable;
    this.context = ctx;     // { aircraftId, registration, module, equation, station }
  }
}

/** Renvoie un Number fini ou BLOQUE. Aucun défaut. */
export function requireFinite(value, variable, ctx = {}) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) {
    recordCalcBlocked(variable, ctx);     // traçabilité (§4.3)
    throw new MissingInputError(variable, ctx);
  }
  return n;
}

/** Densité obligatoire : source unique, sinon blocage. JAMAIS de ?? 0.8x. */
export function requireDensity(fuelType, ctx = {}) {
  const d = getFuelDensity(fuelType);   // null si inconnu (fuelDensity.js)
  if (d == null) {
    recordCalcBlocked('fuelDensity', { ...ctx, fuelType });
    throw new MissingInputError('fuelDensity', { ...ctx, fuelType });
  }
  return d;
}
```

### 3.3 Comportement attendu côté UI (capture du blocage)

Le calcul `throw` ⇒ la couche appelante **n'affiche aucun chiffre** pour la grandeur concernée. À la place :
- état explicite **« CENTRAGE NON CALCULABLE — donnée manquante : `<variable>` »** (bandeau rouge, non *dismissable* tant que la donnée manque) ;
- bouton « Compléter la fiche avion » pointant la station/variable fautive ;
- **aucun** bouton « continuer quand même » sur un calcul de sécurité.

### 3.4 Interdiction de création fantôme — cibles immédiates

| À supprimer | Pourquoi |
|---|---|
| HC-P1 `cgInLimits/weightInLimits: true` | Verdict de sécurité fabriqué |
| HC-T3 `DEFAULT_AIRCRAFT_VALUES.fuelType` | Crée l'entrée densité ⇒ masse fantôme |
| HC-A1/A2 `*Arm \|\| 0` | Crée un bras (datum) fantôme |
| HC-C1 `return 0` | Crée une valeur convertie fantôme |
| HC-D1…D6 `?? 0.8x` | Crée une densité fantôme |

> **Note de cohérence** : `aircraftValidation.js` *transpose* déjà `arms → weightBalance` via `parseOrNull` (projection des données réelles, **pas** un défaut) — **c'est conforme** et doit le rester. La transposition de données existantes est autorisée ; la fabrication de données absentes est interdite.

---

## 4. SANCTUARISATION & AUTOMATISATION (Garde-fous)

> Le projet possède **déjà** le patron idéal : le garde-fou « charte design-tokens » (`eslint.tokens.cjs` + `lint:tokens:staged` en pre-commit + CI `charte-tokens.yml`). **On clone ce patron pour le M&C / calcul.** Précédent interne = adoption immédiate, zéro friction.

### 4.1 Règles de linter (ESLint `no-restricted-syntax`)

Nouveau fichier `eslint.mbcalc.cjs`, appliqué **uniquement** aux globs de calcul :
`src/features/weight-balance/**`, `src/core/stores/weightBalanceStore.js`, `src/utils/{cgEnvelope,fuelDensity,unitConversions,calcGuards}.js`, `src/features/aircraft/utils/{mbUnits,centrogramMath}.js`, `src/models/PerformanceModels.js`.

```js
// eslint.mbcalc.cjs (extrait) — règles AST contraignantes
rules: {
  'no-restricted-syntax': ['error',
    { selector: "LogicalExpression[operator='??'][right.type='Literal']",
      message: "Fallback masqué interdit : '?? <littéral>'. Utiliser requireFinite/requireDensity (blocage explicite)." },
    { selector: "LogicalExpression[operator='||'][right.type='Literal'][right.value!=false][right.value!='']",
      message: "Fallback masqué interdit : '|| <littéral>' sur une grandeur. Bloquer la donnée manquante." },
    { selector: "ReturnStatement > Literal[value=0]",
      message: "Retour 0 suspect dans un module de calcul : ne masquez pas une entrée manquante." },
    { selector: "Property[key.name=/InLimits$/][value.type='Literal']",
      message: "Verdict de centrage figé interdit. Brancher isWithinEnvelope()." }
  ],
  'no-magic-numbers': ['error', {
    ignore: [0, 1, -1, 2, 100, 1000],   // indices, %, échelles ; à resserrer
    ignoreArrayIndexes: true, enforceConst: true, detectObjects: false
  }]
}
```
> `no-magic-numbers` ne supprime pas la magie, il la **force à être nommée et importée**. Toute densité/bras/limite devient une constante sourcée ou un champ avion.

### 4.2 Pipeline — pre-commit + CI (clones du garde-fou tokens existant)

```jsonc
// package.json
"scripts": {
  "lint:mb":        "eslint -c eslint.mbcalc.cjs \"src/**/*.{js,jsx}\"",
  "lint:mb:staged": "eslint -c eslint.mbcalc.cjs $(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(js|jsx)$')",
  "test:mb:golden": "vitest run src/core/stores/__tests__/weightBalanceStore.golden.test.js"
}
```

```bash
# .husky/pre-commit (ajout sous le garde-fou tokens existant)
npm run lint:mb:staged          # bloque tout NOUVEAU fallback/magie sur fichiers en cours de commit
```

```yaml
# .github/workflows/mb-calc.yml (clone de charte-tokens.yml)
name: Garde-fou Masse & Centrage
on: [pull_request]
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint:mb           # rejette la PR si fallback/magie hard-codée
      - run: npm run test:mb:golden    # rejette la PR si un cas d'or régresse
```

**Stratégie boy-scout** (identique au garde-fou tokens) : la version *staged* ne vérifie que les lignes touchées ⇒ le legacy n'explose pas le commit, mais **toute nouvelle ligne fautive est rejetée**. La CONVERGENCE du legacy se pilote par l'inventaire §1.3 (P0 d'abord).

**Tests d'or anti-fallback** (étendre `weightBalanceStore.golden.test.js`) :
- `fuelType` inconnu ⇒ `calculateScenarios` **throw** (et non un résultat à 0.84) ;
- station chargée sans bras ⇒ throw `MissingInputError('…Arm')` ;
- `convertValue(NaN, …)` ⇒ throw (et non `0`) ;
- enveloppe absente ⇒ verdict `null`, jamais `true`.

### 4.3 Modèle de log d'erreur (traçabilité totale)

Étendre l'infra existante `src/lib/persistentErrorLog.js` (même mécanique : `localStorage` + `CustomEvent` + `console.error`, **ne throw jamais depuis le logger**).

```js
// src/lib/persistentErrorLog.js (ajout)
export function recordCalcBlocked(variable, ctx = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    type: 'CALC_BLOCKED',
    severity: 'P0',
    aircraftId:   ctx.aircraftId   ?? null,
    registration: ctx.registration ?? null,   // identifiant avion
    module:       ctx.module       ?? 'mass_balance',
    equation:     ctx.equation     ?? null,    // ex. 'CG = ΣMoment / ΣMasse'
    variable,                                  // variable manquante : 'fuelDensity', 'rearLeftSeatArm'…
    station:      ctx.station      ?? null,     // ex. 'siège arrière gauche'
    inputs:       ctx.inputs       ?? null,     // snapshot des entrées (sans PII)
    url: typeof window !== 'undefined' ? window.location.href : null
  };
  try { localStorage.setItem('alflight:lastCalcBlocked', JSON.stringify(payload)); } catch {}
  console.error('🚨 [CALC_BLOCKED]', payload);
  return payload;
}
```

Format de ligne de log (exemple) :
```
🚨 [CALC_BLOCKED] {
  "timestamp": "2026-06-05T14:22:10.114Z", "type": "CALC_BLOCKED", "severity": "P0",
  "registration": "F-ABCD", "module": "mass_balance",
  "equation": "fuelMassKg = liters × density", "variable": "fuelDensity",
  "station": null, "inputs": { "fuelType": "", "liters": 120 }
}
```

Champs **obligatoires** dans toute alerte de blocage : `registration` (identifiant avion) · `equation` (équation concernée) · `variable` (donnée manquante). Sans ces trois champs, le log est non conforme.

---

## 5. Plan d'exécution (ordre imposé)

| Étape | Action | Critère de sortie |
|---|---|---|
| **S1** | Geler la régression : `eslint.mbcalc.cjs` + pre-commit + CI (Phase 4.1/4.2) | Toute **nouvelle** ligne fautive rejetée |
| **S2** | Créer `calcGuards.js` + `physicalConstants.js` + `recordCalcBlocked` | Outillage fail-safe disponible |
| **S3** | Éradiquer les **P0** densité (HC-D1…D6) + verdicts fantômes (HC-P1, HC-T3 `fuelType`) | `fuelType` inconnu ⇒ blocage partout, valeur unique |
| **S4** | Unifier les moteurs (HC-A1…A4) : `calculations.js` adopte la politique du store **ou** est supprimé | Un seul comportement d'erreur M&C |
| **S5** | Assainir `unitConversions` (HC-C1…C5) + passe-plats (HC-U1…U3) | Conversion invalide ⇒ throw, jamais 0/non converti |
| **S6** | Résidus de test (HC-T1,T2,T4) + DB (audit SQL §1.2) | `src/**` sans immatriculation/correctif en dur |
| **S7** | Dette (HC-M1…M3, HC-P2) | Constantes centralisées ; placeholders perf supprimés/branchés |

---

## 6. Règle d'or (à afficher en tête de toute revue M&C)

> **« Pas de donnée, pas de chiffre. »**
> Un calcul de masse & centrage doit être **mathématiquement étanche** : chaque grandeur provient d'une source certifiée et unique, ou le calcul s'arrête et le dit. Aucun `?? 0.84`, aucun `|| 0`, aucun `true // placeholder` ne franchit la CI. Le faux vert tue ; l'écran rouge fait reporter le vol.
