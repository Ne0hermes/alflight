# PLAN D'AUDIT TECHNIQUE — Unités de mesure & Équations du module Masse & Centrage (W&B)

> **Classe :** Système critique — calcul de centrage (sécurité du vol & certification)
> **Périmètre :** conversion, persistance et homogénéité dimensionnelle des unités (m / mm / cm / in), et validité de **toutes** les équations W&B de l'application.
> **Auteur :** Audit d'architecture (revue principale systèmes critiques)
> **Date :** 2026-06-05 · **Version :** 1.0 · **Statut :** Plan d'audit + constats préliminaires (pré-audit)

---

## 0. Synthèse exécutive & constat préliminaire (cause racine)

L'anomalie m/mm signalée n'est **pas un cas isolé** : elle est le symptôme d'un défaut structurel de gouvernance des unités. Le pré-audit a déjà établi, **preuve à l'appui**, le fait suivant :

> ### ⛔ Constat majeur (P0 — bloquant certification)
> **L'application possède DEUX « sources uniques de vérité » contradictoires pour le bras de levier, qui diffèrent d'un facteur 1000.**
>
> | Sous-système | Unité canonique du bras | Unité du moment | Preuve |
> |---|---|---|---|
> | `mbUnits.STORAGE_UNITS` (assistant de création) | **mm** | **kg·mm** | [mbUnits.js:25-34](src/features/aircraft/utils/mbUnits.js#L25) — `armLength: 'mm'`, commentaire l.8-9 « moment → kg·mm » |
> | `weightBalanceStore.calculateWeightBalance` (moteur de centrage réel) | **m** | **kg·m** | Test doré : `emptyWeightArm: 2.10`, `moment = 700×2.10+… = 2025`, `cg = 2025/950 = 2.132` — [weightBalanceStore.golden.test.js:48-58](src/core/stores/__tests__/weightBalanceStore.golden.test.js#L48) |
>
> Ces deux contrats sont câblés **sur les mêmes champs** (`weightBalance.emptyWeightArm`, `fuelArm`, …). Un avion dont les bras sont écrits en **mm** (2100) puis lus par le moteur en **m** produit un moment et un CG **1000× faux**, et un verdict d'enveloppe dénué de sens. Le défaut est **latent** parce que tous les garde-fous de conversion échouent en silence (voir Axe 3) : une conversion manquante n'émet pas d'erreur, elle laisse passer la valeur **non convertie**.

**Aggravant :** la valeur du bras est, en l'état, persistée **dans l'unité d'affichage courante de l'utilisateur** (l'assistant n'appelle pas `toStorage()` sur les champs de bras, contrairement aux champs de carburant) et **aucune métadonnée d'unité n'est stockée**. À la relecture, rien ne permet de savoir si un « 2100 » en base signifie 2100 mm, 2,1 m ou 2100 m.

**Conséquence sécurité :** un CG faux de 1000× (ou même de quelques %) sort silencieusement de l'enveloppe réelle → risque de centrage hors limites présenté comme « dans les limites », ou inversement. **Inacceptable pour un outil d'aide à la décision de vol.**

> **Échelle de sévérité utilisée dans ce rapport**
> - **P0 — Bloquant** : peut produire un verdict de centrage faux sans alerte. Correction avant toute mise en production.
> - **P1 — Critique** : fausse l'affichage ou un calcul intermédiaire ; détectable mais trompeur.
> - **P2 — Majeur** : robustesse / dette technique exposant à une régression future.
> - **P3 — Mineur** : qualité de code, lisibilité, observabilité.

---

## Méthodologie générale

L'audit procède en **4 passes** sur les 5 axes, puis livre l'Axe 5 (remédiation) :

1. **Statique** — lecture exhaustive + analyse dimensionnelle de chaque équation (grille fournie §2).
2. **Dynamique** — instrumentation : tracer la valeur d'un bras de la frappe clavier jusqu'au pixel et jusqu'à la base (Axe 4).
3. **Différentielle** — exécuter le même avion sous chaque préréglage d'unités (Europe mm / USA in / Metric cm) et comparer les CG ; tout écart ≠ erreur d'arrondi attendue = anomalie.
4. **Adversariale** — cas limites volontairement hostiles (0, négatif, NaN, unité absente, enveloppe vide, magnitude aberrante).

**Fichiers pivots identifiés** (cœur de l'audit) :

| Rôle | Fichier |
|---|---|
| Convertisseur central | [src/utils/unitConversions.js](src/utils/unitConversions.js) |
| Helper unités M&C (storage/display) | [src/features/aircraft/utils/mbUnits.js](src/features/aircraft/utils/mbUnits.js) |
| Affichage/édition génériques | [src/utils/unitsDisplay.js](src/utils/unitsDisplay.js), [src/shared/components/ValueWithUnit.jsx](src/shared/components/ValueWithUnit.jsx) |
| Préférences (store) | [src/core/stores/unitsStore.js](src/core/stores/unitsStore.js) |
| **Moteur de centrage** | [src/core/stores/weightBalanceStore.js](src/core/stores/weightBalanceStore.js) |
| Équations scénarios (doublon) | [src/features/weight-balance/utils/calculations.js](src/features/weight-balance/utils/calculations.js) |
| Saisie création avion | [src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx](src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx) |
| Hydratation / normalisation | [src/utils/aircraftNormalizer.js](src/utils/aircraftNormalizer.js), [src/utils/aircraftValidation.js](src/utils/aircraftValidation.js) |
| Restitution graphique / table | [WeightBalanceChart.jsx](src/features/weight-balance/components/WeightBalanceChart.jsx), [WeightBalanceTable.jsx](src/features/weight-balance/components/WeightBalanceTable.jsx), [CgEnvelopeDualChart.jsx](src/features/aircraft/components/CgEnvelopeDualChart.jsx) |

---

## AXE 1 — Cartographie de la donnée & gestion des préférences

### 1.1 Source unique de vérité (SSOT)

**Objectif :** prouver qu'il existe **une et une seule** unité-pivot par grandeur, stockée telle quelle, indépendamment du contexte et des préférences.

**Points de contrôle :**
- [ ] **CTRL-1.1** Lister toutes les unités-pivot déclarées et vérifier l'**unicité** par grandeur. → **ÉCHEC déjà constaté** : bras = mm côté `mbUnits` mais m côté moteur (§0).
- [ ] **CTRL-1.2** Vérifier la **cohérence inter-catégories** des longueurs : `STORAGE_UNITS.armLength = 'mm'` mais `STORAGE_UNITS.runway = 'm'` ([mbUnits.js:33](src/features/aircraft/utils/mbUnits.js#L33)) et `unitsStore.runway = 'm'`, `altitude = 'ft'`. Une même grandeur physique (longueur) vit dans 4 unités-pivot selon le champ → **toute formule mélangeant piste, altitude et bras est suspecte** (P1).
- [ ] **CTRL-1.3** Vérifier qu'aucune valeur n'est stockée « dans l'unité d'affichage ». → **ÉCHEC** : les bras le sont (Axe 4).
- [ ] **CTRL-1.4** Vérifier la présence d'une **métadonnée d'unité + version de schéma** sur chaque enregistrement avion persistant. → **Absente** (P0, voir Axe 4).

**Livrable Axe 1.1 :** un **registre des grandeurs** (tableau ci-dessous, à compléter et figer en `constants`) :

| Grandeur | Unité-pivot CIBLE (à décider) | Pivot actuel `mbUnits` | Pivot actuel moteur | Conflit |
|---|---|---|---|---|
| Masse | kg | kg | kg | — |
| **Bras de levier** | **à trancher (recommandé : m, voir Axe 5)** | **mm** | **m** | **OUI (P0)** |
| Moment | masse×bras cohérent | kg·mm | kg·m | **OUI (P0)** |
| Carburant (vol.) | L | ltr | — | — |
| Piste | m | m | — | cohérence à valider |

### 1.2 Isolation des préférences utilisateur

**Objectif :** une préférence d'affichage ne doit **jamais** muter la donnée brute. Changer mm→cm ne doit changer que la couche d'affichage (ou re-convertir proprement sans perte), jamais réinterpréter le nombre.

**Points de contrôle :**
- [ ] **CTRL-1.5** Tracer `useUnitsWatcher` / l'effet de re-conversion. **Constat préliminaire** : [Step3WeightBalance.jsx](src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx) contient un `useEffect` (≈ l.282-454) qui, au changement de préférence, **réécrit en base les bras re-convertis** via `convertValue(value, previousUnits.armLength||'mm', units.armLength||'mm', 'armLength')`. → La donnée « brute » suit donc la préférence : **violation du principe d'isolation** (P1). Le pivot effectif d'un avion dépend de l'historique des préférences de l'utilisateur qui l'a saisi.
- [ ] **CTRL-1.6** Vérifier que `previousUnits` est initialisé de façon fiable (sinon première conversion contre un défaut erroné) et qu'une double-exécution de l'effet (StrictMode) ne re-convertit pas deux fois (risque ×1000 ou ÷1000 accidentel) — **à confirmer en dynamique**.
- [ ] **CTRL-1.7** Confirmer la **convergence** des écrans de préférences. Il existe **≥ 3 composants** : [features/units/components/UnitsPreferences.jsx](src/features/units/components/UnitsPreferences.jsx), [features/pilot/components/UnitsPreferences.jsx](src/features/pilot/components/UnitsPreferences.jsx), [features/pilot/components/UnitsConfiguration.jsx](src/features/pilot/components/UnitsConfiguration.jsx). Tous écrivent via `unitsSelectors.useUnitsActions().setUnit()` sur le **même** store → pas de divergence d'état, mais **duplication de code** à factoriser (P3).

### 1.3 IHM — liaison explicite valeur ↔ unité

**Objectif :** aucun champ « aveugle ». Chaque saisie et chaque affichage porte dynamiquement son symbole d'unité, issu de la préférence courante.

**Points de contrôle :**
- [ ] **CTRL-1.8** Inventaire de tous les champs numériques de bras/masse/moment et vérification du symbole dynamique.
- [ ] **CTRL-1.9** Liste des **symboles codés en dur** (ne suivent pas la préférence → mensonge d'unité). **Constats préliminaires (échantillon déjà relevé)** :

| Fichier:ligne | Libellé en dur | Sévérité |
|---|---|---|
| [WeightBalanceChart.jsx:397](src/features/weight-balance/components/WeightBalanceChart.jsx#L397) | axe X `Centre de Gravité (mm)` | P1 |
| WeightBalanceChart.jsx:410 | axe `Moment (kg.m)` | P1 |
| WeightBalanceChart.jsx:343-344 | tooltip `…m` puis `(×1000) mm` codé en dur | P1 |
| [WeightBalanceTable.jsx:133-135](src/features/weight-balance/components/WeightBalanceTable.jsx#L133) | en-têtes `Masse (kg)`, `Bras (m)`, `Moment (kg.m)` | P1 |
| Step6WeightBalance.jsx:828, 832, 861, 894, 932 | `… m`, `… kg.m` | P1 |
| AircraftModule.jsx:782, 790, 794 | export PDF figé en `mm`/`kg` | P2 (acceptable si standard MANEX documenté) |

> ⚠️ **Incohérence critique d'IHM** : l'axe du graphe est titré **« (mm) »** alors que la valeur traitée par le moteur est en **m**, et le code multiplie en plus par 1000. La table affiche **« Bras (m) »** sur des données qui peuvent être en mm. **Le pilote lit une unité, le calcul en utilise une autre.**

**Livrable Axe 1 :** registre des grandeurs figé + matrice « champ → catégorie → source unité → liaison (dynamique/dur) » exhaustive.

---

## AXE 2 — Audit intégral des équations & formules

### 2.1 Recensement & analyse dimensionnelle

**Méthode :** pour **chaque** expression mathématique de l'app (CG, moment, %MAC, masses, densités, interpolation d'enveloppe, conversions de perf), remplir la **grille d'analyse dimensionnelle** :

| ID | Fichier:ligne | Expression | Calcule | Unité de chaque entrée | Unité résultat | Homogène ? | Edge cases | Verdict |
|----|---------------|------------|---------|------------------------|----------------|-----------|------------|---------|

**Recensement initial (cœur W&B) :**

| ID | Fichier:ligne | Expression | Unités entrées → résultat | Verdict |
|----|---|---|---|---|
| EQ-01 | [weightBalanceStore.js:189-194](src/core/stores/weightBalanceStore.js#L189) | `moment = poids * bras` (×6 stations) | kg × **m** → kg·m | ✔ homogène **en interne**, mais bras supposé **m** (cf. EQ-00) |
| EQ-02 | [weightBalanceStore.js:196-203](src/core/stores/weightBalanceStore.js#L196) | `totalMoment = Σ moments` | kg·m → kg·m | ✔ |
| EQ-03 | [weightBalanceStore.js:206](src/core/stores/weightBalanceStore.js#L206) | `cg = totalMoment / totalWeight` | kg·m / kg → **m** | ✔ **si** bras en m |
| EQ-00 | (transverse) | bras injecté dans EQ-01 | **mm côté création, m côté moteur** | ⛔ **P0** : non homogène entre sous-systèmes |
| EQ-04 | [weightBalanceStore.js:233-236](src/core/stores/weightBalanceStore.js#L233) | `isWithinCG = cg ≥ fwd && cg ≤ aft` | compare `cg` (m) à enveloppe (unité **saisie utilisateur**, non garantie) | ⚠️ **P0/P1** : comparaison non garantie homogène |
| EQ-05 | calculations.js:52-53 | `cg = totalMoment / totalWeight` (**doublon** d'EQ-03) | idem | ⚠️ **P1 DRY** : 2e moteur de CG, risque de divergence |
| EQ-06 | CgEnvelopeDualChart.jsx:193,202,212 | `x = useMoment ? weight*cg : cg` | kg × unité(cg) → moment d'axe | ⚠️ P1 : dépend de l'unité de `cg` |
| EQ-07 | cgEnvelope (interp) | `interpAt(points, masse)` interpolation linéaire des limites | points enveloppe (unité saisie) → limite | ⚠️ garbage-in si enveloppe ≠ unité du `cg` testé |
| EQ-08 | **%MAC** (à localiser) | `%MAC = (CG − BA) / MAC × 100` | **3 longueurs à homogénéiser** | ❓ **à recenser** — vérifier d'où viennent BA (bord d'attaque) et MAC et en quelle unité |
| EQ-09 | carburant | `masse = volume × densité` | L × kg/L → kg | ✔ (densité canonique 0.84 Jet, 0.72 AVGAS — voir [constants](src/utils/constants.js)) |

> **Action P0 Axe 2 :** localiser et auditer **toute** formule **%MAC** et la dérivation du **bord d'attaque / corde MAC** (non encore localisée dans le périmètre lu) : c'est l'équation la plus exposée car elle **soustrait** des longueurs avant de diviser — une seule en mauvaise unité fausse le pourcentage sans changer l'ordre de grandeur (donc indétectable à l'œil).

### 2.2 Vérification de l'homogénéité stricte

**Points de contrôle :**
- [ ] **CTRL-2.1** Aucune addition/soustraction de longueurs d'unités différentes (bras mm + bord d'attaque m).
- [ ] **CTRL-2.2** Toute multiplication masse×longueur produit un moment dont l'unité est **tracée et cohérente** avec l'unité attendue par le diviseur en aval.
- [ ] **CTRL-2.3** Les deux côtés de chaque comparaison (`cg` vs `forward/aft`, `totalWeight` vs `MTOW`) sont dans la **même** unité. → EQ-04 à prouver.
- [ ] **CTRL-2.4** Éliminer le **doublon** EQ-03 / EQ-05 ou prouver leur équivalence par test (sinon deux vérités du CG).

### 2.3 Analyse des cas limites (robustesse)

**Constats préliminaires (points positifs à conserver) :**
- ✔ Division par zéro CG gardée : `totalWeight > 0 ? … : 0` ([weightBalanceStore.js:206](src/core/stores/weightBalanceStore.js#L206)) et `compute2of3` retourne `null` si masse ou bras = 0 ([mbUnits.js:167-169](src/features/aircraft/utils/mbUnits.js#L167)).
- ✔ **Fail-closed** sur bras manquant : `cgReliable=false ⇒ isWithinCG=null` (jamais un faux « OK ») ([weightBalanceStore.js:208-239](src/core/stores/weightBalanceStore.js#L208)) — **excellent réflexe sécurité, à généraliser**.
- ✔ Masse à vide absente ⇒ calcul refusé (`null`), pas de 600 kg fabriqué (test doré l.138-146).

**Points de contrôle restants :**
- [ ] **CTRL-2.5** Retour `0` au lieu d'erreur : `convertValue` renvoie `0` si `!value || isNaN(value)` ([unitConversions.js:167](src/utils/unitConversions.js#L167)) → un bras NaN devient **0** silencieusement (moment 0, CG tiré vers l'avant). **P1** : préférer lever/propager une erreur explicite ou `null`.
- [ ] **CTRL-2.6** Valeurs aberrantes / négatives : aucune borne de plausibilité (bras négatif, masse > 10×MTOW, CG hors plage physique). Ajouter des **assertions de domaine** (P2).
- [ ] **CTRL-2.7** Enveloppe vide / 1 point / points non triés : vérifier `interpAt` (bornes, extrapolation) et le rendu (axe dégénéré 0-1 constaté possible dans le chart).

**Livrable Axe 2 :** grille dimensionnelle complète (1 ligne/équation, **toute** l'app, pas seulement W&B), liste des non-homogénéités classées P0-P3, et liste des edge cases non couverts.

---

## AXE 3 — Matrice de conversion & précision numérique

### 3.1 Audit du convertisseur central

**Cible :** `convertValue()` et les tables de [unitConversions.js](src/utils/unitConversions.js), `toStorage/fromStorage/convertMoment` de [mbUnits.js](src/features/aircraft/utils/mbUnits.js).

**Constats préliminaires (déjà relevés, à figer par tests) :**

| ID | Fichier:ligne | Risque | Sévérité |
|----|---|---|---|
| CV-1 | [unitConversions.js:249-250](src/utils/unitConversions.js#L249) | **Pass-through silencieux** : si aucune fonction ne correspond à la clé, retourne la valeur **non convertie** (simple `console.warn`). → une conversion manquante = corruption mm-vu-comme-m **indétectable**. **C'est le vecteur n°1 du bug.** | **P0** |
| CV-2 | mbUnits.js:63-66 & 86-89 | `toStorage/fromStorage` **renvoient le nombre brut** dans leur `catch` → même corruption silencieuse | **P0** |
| CV-3 | [unitConversions.js:167](src/utils/unitConversions.js#L167) | `return 0` sur `!value || isNaN` (cf. CTRL-2.5) | P1 |
| CV-4 | [unitConversions.js:184](src/utils/unitConversions.js#L184) | **Dispatch par concaténation de chaîne** : `` `${fromUnit}To${Cap(toUnit)}` ``. Fragile : une unité avec casse/typo (`'m/s'`, `'km/h'`) ne mappe pas → tombe sur CV-1 | P1 |
| CV-5 | unitConversions.js:186 & 240 | `console.log` en **chemin chaud** de conversion (exécuté à chaque frappe/refresh) → bruit + fuite de données + perf | P3 |
| CV-6 | [armLengthConversions](src/utils/unitConversions.js#L95) | **Vérifier l'absence d'inversion de facteur** : `mmToM = /1000`, `mToMm = ×1000`, `inToMm = ×25.4`, `mmToIn = /25.4`… (revue ligne à ligne + test exhaustif de la matrice) | à figer |

**Points de contrôle :**
- [ ] **CTRL-3.1** Pour **chaque** paire d'unités de longueur/masse, vérifier `a→b` puis `b→a` et l'**identité** `a→b→a ≈ a`. Tout aller-retour qui dérive de > ε = inversion ou perte.
- [ ] **CTRL-3.2** Vérifier qu'aucune clé attendue n'est **manquante** (sinon CV-1). Construire la matrice complète attendue et diffuser contre les tables réelles.
- [ ] **CTRL-3.3** Remplacer les fallbacks silencieux (CV-1, CV-2) par une **erreur explicite** en mode dev/test et un comportement fail-closed en prod (valeur marquée invalide, jamais « passée telle quelle »).

### 3.2 Précision numérique & arrondis (floating-point)

**Constats :** tous les calculs utilisent le `number` JS (IEEE-754 double). Pas de `BigDecimal`.

**Analyse :**
- Pour des bras au mm et des masses au kg, le double offre ~15-16 chiffres significatifs : **la précision brute n'est pas le risque principal**. Le risque réel est :
  - [ ] **CTRL-3.4** **Arrondis prématurés** puis ré-exploités : ex. l'effet de re-conversion écrit `Math.round(converted*100)/100` (Axe 1.2) → **perte cumulative** sur conversions successives mm↔cm↔in↔m répétées. Quantifier la dérive sur N aller-retours.
  - [ ] **CTRL-3.5** **Arrondi d'affichage vs arrondi de calcul** : `cg: parseFloat(cg.toFixed(3))` ([weightBalanceStore.js:244](src/core/stores/weightBalanceStore.js#L244)) **tronque le résultat de calcul à 3 décimales** (et non seulement l'affichage). En mm cela ferait perdre toute précision sub-mm ; en m, 3 décimales = précision mm (acceptable) — **mais le choix de précision dépend de l'unité-pivot retenue** (cf. Axe 5).
  - [ ] **CTRL-3.6** Comparaisons d'égalité/bornes d'enveloppe : utiliser une **tolérance** (`>= forward - ε`) plutôt qu'une égalité stricte sur flottants.

**Décision attendue (Axe 5) :** conserver `number` mais **(a)** fixer l'unité-pivot, **(b)** convertir **une seule fois** aux frontières (saisie/affichage), **(c)** ne jamais arrondir une valeur de calcul intermédiaire, **(d)** centraliser les arrondis d'affichage. `BigDecimal` non requis si ces règles sont tenues.

**Livrable Axe 3 :** matrice de conversion complète **prouvée par test** (toutes paires, aller-retour, contre constantes de référence), + liste des fallbacks silencieux remplacés par des erreurs.

---

## AXE 4 — Persistance & hydratation

### 4.1 Scénario de référence « l'utilisateur saisit 1500 »

**Trace cible (à instrumenter en dynamique), confrontée au constat préliminaire :**

| Étape | Comportement attendu (cible) | Constat préliminaire (réel) |
|---|---|---|
| **Saisie** champ « Bras de levier » | libellé = unité préférée ; valeur **convertie en pivot** via `toStorage()` | libellé **dynamique** ✔ ([Step3 …](src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx)) **mais** `onChange` stocke `arm: newArm` **brut, sans `toStorage()`** — contrairement au champ **capacité carburant** voisin qui, lui, appelle `convertValue(...,'ltr',...)` ✔. **Asymétrie P0.** |
| **Écriture base** | écrit la valeur **pivot** + `arms_unit` + `schemaVersion` | écrit l'avion normalisé **tel quel** ; **aucune métadonnée d'unité** (à confirmer dans aircraftStore/service Supabase) |
| **Relecture / hydratation** | relit pivot, applique `fromStorage()` pour l'affichage | `validateAndRepairAircraft` mappe `arms → weightBalance` **sans conversion** ; le moteur lit ensuite en **m** |
| **Verdict** | CG correct | si saisi en mm (préf. défaut) et lu en m ⇒ **CG ×1000 faux** |

**Réponse à la question posée — « si l'utilisateur saisit 1500 mm, qu'est-ce qui est écrit ? »**
> En l'état : **`1500`**, **dans l'unité de préférence du moment** (mm par défaut), **sans étiquette**. Au rechargement, le moteur de centrage l'interprète comme **1500 m**. Rien ne garantit l'invariant « stocké = pivot ». **C'est exactement le mécanisme du bug signalé.**

### 4.2 Points de contrôle persistance

- [ ] **CTRL-4.1** Localiser et lire le **chemin d'écriture** réel (aircraftStore / communityService / Supabase `.from('aircraft')` / localStorage) et **citer** la valeur sérialisée d'un bras.
- [ ] **CTRL-4.2** Prouver la **symétrie write/read** : `read(write(x)) === x` pour un bras, sous chaque préférence.
- [ ] **CTRL-4.3** Vérifier l'**absence de devinette d'unité par magnitude** (« si bras < 10 alors mètres »). *Non trouvée au pré-audit* — **à confirmer**. Si présente : **P0** (heuristique = corruption déterministe).
- [ ] **CTRL-4.4** Vérifier les imports MANEX / bases communautaires ([communityAircraftDatabase.js](src/features/aircraft/data/communityAircraftDatabase.js), manexExtraction*) : en quelle unité arrivent les bras importés ? Conversion à la frontière d'import ?
- [ ] **CTRL-4.5** Vérifier le **double centrage** (le module données signale un calcul dupliqué store vs FlightPlanData) : s'assurer qu'un seul moteur fait foi.

**Livrable Axe 4 :** schéma write/read annoté + preuve de l'asymétrie + inventaire des frontières d'entrée (saisie, import MANEX, communauté, duplication).

---

## AXE 5 — Stratégie de remédiation & livrables techniques

### 5.1 Cible architecturale (recommandation)

1. **Unité-pivot UNIQUE par grandeur, déclarée dans un seul module `constants`** et **référencée partout** (supprimer la divergence `mbUnits` mm vs moteur m).
   - **Recommandation : pivot longueur = mètre (m), masse = kg, moment = kg·m.**
   - *Justification :* le moteur de centrage **déjà couvert par test doré** opère en m ; l'enveloppe et le %MAC aéronautiques sont usuellement en m/in ; déplacer le pivot vers le moteur testé est **moins risqué** que l'inverse. Le « mm par défaut » n'est qu'une **préférence d'affichage** européenne, pas un pivot.
2. **Quantité typée** (a minima par convention de nommage `armM`, `momentKgM` ; idéalement un petit type `Quantity{value, unit}` ou des « branded types`) pour rendre une erreur d'unité **détectable à la compilation/au lint**.
3. **Conversion uniquement aux frontières** : `toStorage()` à la saisie/import, `fromStorage()` à l'affichage. **Le cœur ne voit que le pivot.**
4. **Fail-closed, jamais pass-through** : `convertValue` lève en l'absence de clé (dev/test) ; en prod, marque la valeur invalide et **bloque le verdict** (comme `cgReliable`). Supprimer les `return value`/`return num`/`return 0` silencieux (CV-1, CV-2, CV-3).
5. **IHM** : tout symbole d'unité dérivé de la préférence via `getMBUnitSymbol(units, category)` ; **zéro libellé en dur** (corriger les 6 sites de l'Axe 1.3).

### 5.2 Modèle de rapport d'anomalie

Chaque anomalie est consignée selon ce gabarit :

```
ANO-<n> — <titre court>
Axe / Catégorie : <1-5> / <SSOT|équation|conversion|persistance|IHM>
Sévérité        : P0 | P1 | P2 | P3
Statut          : Ouvert | En cours | Corrigé | Vérifié
Fichier:ligne   : src/...:NNN  (+ extrait de code)
Description     : symptôme observable
Cause racine    : mécanisme exact (unité attendue vs réelle)
Reproduction    : étapes + préréglage d'unités + valeurs
Impact sécurité : effet sur le CG/verdict + ordre de grandeur (ex. ×1000)
Correctif       : diff proposé
Test de non-régression : id du test ajouté (§5.3)
Migration       : impact données existantes (§5.4)
```

> **Anomalies déjà pré-qualifiées** : ANO-1 (double pivot m/mm, P0), ANO-2 (saisie bras sans `toStorage`, P0), ANO-3 (pass-through silencieux `convertValue`, P0), ANO-4 (`toStorage/fromStorage` catch renvoie brut, P0), ANO-5 (libellés d'unité en dur, P1), ANO-6 (doublon de moteur CG store/calculations, P1), ANO-7 (`return 0` sur NaN, P1), ANO-8 (re-conversion qui mute la donnée brute + arrondi cumulatif, P1), ANO-9 (absence de métadonnée d'unité/version en base, P0).

### 5.3 Plan de tests automatisés (sanctuarisation)

Cadre existant : **Vitest** + un test doré déjà en place ([weightBalanceStore.golden.test.js](src/core/stores/__tests__/weightBalanceStore.golden.test.js)) → **réutiliser et étendre**.

**A. Tests de conversion (unitaires)**
- [ ] Matrice exhaustive : pour chaque paire d'unités d'une grandeur, `convertValue(x, a, b)` == valeur de référence (table figée), à ε près.
- [ ] **Propriété aller-retour** : ∀ unité a,b et ∀ x d'un échantillon : `convert(convert(x,a,b),b,a) ≈ x` (tolérance déclarée).
- [ ] **Absence de clé** : une catégorie/unité sans table **lève** (et ne renvoie ni 0 ni la valeur brute).
- [ ] `toStorage(fromStorage(v)) ≈ v` et `fromStorage(toStorage(v)) ≈ v` pour bras/masse/carburant, sous chaque préférence.

**B. Tests d'équations (golden + propriétés)**
- [ ] Golden CG par avion de référence (étendre l'existant) sous **chaque** préréglage (Europe/USA/Metric) → **même CG physique** (invariance par unité). *Ce test échoue aujourd'hui = preuve du bug, puis garde-fou après correction.*
- [ ] Invariants dimensionnels : `moment/masse` a la dimension d'une longueur ; `%MAC ∈ [0,100]` (ou borne définie) ; `CG ∈ [bornes physiques avion]`.
- [ ] Équivalence des deux moteurs (EQ-03 vs EQ-05) ou suppression du doublon.

**C. Cas limites (adversariaux)**
- [ ] `totalWeight = 0` → CG défini, pas d'Infinity.
- [ ] Bras manquant sur station chargée → `isWithinCG = null` + warning (déjà couvert, **conserver**).
- [ ] NaN / négatif / magnitude aberrante → erreur explicite, **jamais** verdict « OK ».
- [ ] Enveloppe vide / 1 point / non triée → pas de crash, verdict fail-closed.

**D. Intégration / E2E**
- [ ] Création avion (bras saisis en mm) → persistance → rechargement → CG calculé == CG attendu (anti-régression du bug m/mm).
- [ ] Changement de préférence d'unité **n'altère pas** le CG calculé ni la donnée pivot.

**Critère de sortie (Definition of Done) :** 100 % des paires de conversion testées ; invariance par unité verte sur ≥ 3 avions réels ; zéro fallback silencieux ; couverture des chemins de saisie/persistance des bras.

### 5.4 Migration des données existantes (sans corruption)

**Problème :** des avions déjà créés ont des bras persistés **dans une unité inconnue** (mm, m, cm, in selon l'historique de préférence de l'auteur), **sans métadonnée**. Une migration naïve « tout en m » corromprait ceux déjà en m.

**Stratégie (non destructive, traçable) :**

1. **Geler le schéma** : introduire `schemaVersion` + `arms_unit` sur l'enregistrement avion. Toute **nouvelle** écriture est en pivot (m) et estampillée `arms_unit='m'`, `schemaVersion=N`.
2. **Migration one-shot des legacy (`schemaVersion` absent)**, par avion, **par désambiguïsation physique** (pas par magnitude seule) :
   - Pour chaque interprétation candidate (la valeur lue est-elle en m ? mm ? cm ? in ?), **recalculer le CG** et le confronter à **l'enveloppe propre de l'avion** et à la plage physique plausible (bras ∈ ~[0,15] m pour l'aviation légère).
   - **Si une seule interprétation** place le CG dans/à proximité de l'enveloppe **et** dans la plage physique → migrer vers le pivot, **journaliser** (avant/après, interprétation retenue, marge).
   - **Si ambiguïté ou aucune** interprétation plausible → **quarantaine** : marquer l'avion `arms_unit='UNVERIFIED'`, **désactiver le verdict de centrage** (fail-closed) et **demander une re-confirmation au pilote** (re-saisie ou validation explicite). **Jamais de coercition silencieuse.**
3. **Sauvegarde préalable** + **dry-run** : exécuter la migration en lecture seule, produire un **rapport** (n avions migrés sans ambiguïté / n en quarantaine), revue humaine, **puis** application. Réversibilité garantie (backup + journal).
4. **Bannière utilisateur** pour les avions en quarantaine, avec rappel sécurité : « centrage à re-vérifier suite à mise à niveau des unités ».

> ⚠️ **Règle d'or migration :** en cas de doute, **bloquer le verdict** (fail-closed) plutôt que deviner. Un CG faux présenté comme valide est pire qu'un CG indisponible.

### 5.5 Séquencement & RACI

| Phase | Contenu | Sortie | Responsable |
|---|---|---|---|
| **P0 — Filet** | Étendre les tests dorés (invariance par unité) **avant** toute correction | suite rouge = bug prouvé | Dev + Audit |
| **P1 — Pivot** | Trancher l'unité-pivot (m), unifier `mbUnits`/moteur, supprimer pass-through silencieux | conversions fail-closed | Dev (R) / Archi (A) |
| **P2 — Frontières** | `toStorage`/`fromStorage` sur **tous** les champs de bras (Step3), corriger libellés en dur | IHM cohérente | Dev |
| **P3 — Équations** | Recenser %MAC/bord d'attaque, dédoublonner CG, bornes de plausibilité | grille dimensionnelle complète | Dev + Audit |
| **P4 — Persistance** | Schéma `arms_unit`+version, migration dry-run, quarantaine | rapport migration | Dev + Data (R) / PO (A) |
| **P5 — Vérif** | Suite verte, tests E2E, revue croisée, validation empirique sur avions réels | PV de recette | Audit (A) |

---

## Annexe A — Checklist de contrôle consolidée

```
AXE 1  [ ]1.1 unicité pivot  [ ]1.2 cohérence longueurs  [ ]1.3 pas de stockage en unité d'affichage
       [ ]1.4 métadonnée+version  [ ]1.5 isolation préférences  [ ]1.6 double-exec effet
       [ ]1.7 convergence écrans préfs  [ ]1.8 inventaire champs  [ ]1.9 zéro libellé en dur
AXE 2  [ ]2.1 grille dimensionnelle exhaustive  [ ]2.2 pas d'addition hétérogène  [ ]2.3 comparaisons homogènes
       [ ]2.4 dédoublonner CG  [ ]2.5 NaN→erreur  [ ]2.6 bornes plausibilité  [ ]2.7 enveloppe dégénérée
       [ ]2.8 LOCALISER+auditer %MAC / bord d'attaque
AXE 3  [ ]3.1 aller-retour  [ ]3.2 clés manquantes  [ ]3.3 supprimer fallbacks silencieux
       [ ]3.4 arrondi cumulatif  [ ]3.5 arrondi calcul vs affichage  [ ]3.6 tolérance bornes
AXE 4  [ ]4.1 chemin d'écriture réel  [ ]4.2 symétrie write/read  [ ]4.3 pas de devinette magnitude
       [ ]4.4 frontières d'import MANEX/communauté  [ ]4.5 un seul moteur (double centrage)
AXE 5  [ ]5.1 pivot tranché  [ ]5.2 gabarit ANO  [ ]5.3 suite de tests  [ ]5.4 migration dry-run+quarantaine  [ ]5.5 RACI
```

## Annexe B — Inventaire des anomalies pré-qualifiées (à confirmer en audit formel)

| ID | Axe | Sévérité | Fichier:ligne | Synthèse |
|----|-----|----------|---------------|----------|
| ANO-1 | 1/2 | **P0** | mbUnits.js:25-34 ↔ weightBalanceStore.golden.test.js:48-58 | Double pivot bras : mm (création) vs m (moteur) |
| ANO-2 | 4 | **P0** | Step3WeightBalance.jsx (onChange bras) | Saisie bras sans `toStorage()` (≠ champ carburant) |
| ANO-3 | 3 | **P0** | unitConversions.js:249 | `convertValue` laisse passer la valeur non convertie si clé absente |
| ANO-4 | 3 | **P0** | mbUnits.js:63-66, 86-89 | `toStorage/fromStorage` renvoient le nombre brut sur erreur |
| ANO-9 | 4 | **P0** | persistance avion (à localiser) | Aucune métadonnée d'unité / version de schéma en base |
| ANO-5 | 1 | P1 | WeightBalanceChart.jsx:397,410 ; Table:133-135 ; Step6:828+ | Libellés d'unité codés en dur |
| ANO-6 | 2 | P1 | weightBalanceStore.js:206 ↔ calculations.js:53 | Deux moteurs de CG (doublon) |
| ANO-7 | 2/3 | P1 | unitConversions.js:167 | `return 0` sur NaN/falsy (perte silencieuse) |
| ANO-8 | 1/3 | P1 | Step3WeightBalance.jsx (useEffect ~282-454) | Re-conversion qui mute la donnée brute + arrondi cumulatif |
| ANO-10 | 3 | P3 | unitConversions.js:186,240 | `console.log` en chemin chaud |

---

*Fin du plan d'audit v1.0. Les constats marqués « préliminaires » proviennent d'une première lecture du code (échantillon) ; l'audit formel doit les confirmer ligne à ligne et compléter le recensement (notamment %MAC, chemin de persistance Supabase, imports MANEX).*
