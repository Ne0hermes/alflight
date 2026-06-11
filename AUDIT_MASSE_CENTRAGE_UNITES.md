# AUDIT TECHNIQUE v2.0 — Unités de mesure & Équations du module Masse & Centrage (W&B)

> **Classe :** Système critique — calcul de centrage (sécurité du vol & certification)
> **Périmètre :** conversion, persistance et homogénéité dimensionnelle des unités de **longueur** (m / mm / cm / in) **et de masse (kg / lbs)**, et validité de toutes les équations W&B de l'application.
> **Auteur :** Audit d'architecture (revue principale systèmes critiques)
> **Date :** 2026-06-10 · **Version :** 2.0 (refonte intégrale de la v1.0 du 2026-06-05) · **Statut :** Audit instruit — constats vérifiés ligne à ligne
>
> **Nouveautés v2.0 :** ① ré-instruction complète de tous les constats v1 (confirmations, corrections — voir Annexe C) ; ② **analyse particulière dédiée au problème de conversion kg ↔ lbs dans le module avion** (chapitre A) ; ③ découverte de la couche corrective `armUnits.js` (heuristique de magnitude) et de la métadonnée d'unités, absentes de la v1, qui changent le diagnostic.

---

## 0. Synthèse exécutive

L'audit v2 confirme que l'anomalie m/mm n'est pas un incident isolé mais l'expression d'un **défaut systémique de gouvernance des unités**, qui se manifeste désormais sur **trois fronts** :

### D1 — Double pivot du bras de levier (m vs mm), « ponté » par une heuristique — P0
Le contrat de stockage déclare le bras en **mm** (`STORAGE_UNITS.armLength='mm'`, [mbUnits.js:25-34](alflight/src/features/aircraft/utils/mbUnits.js#L25)) tandis que le moteur de centrage calcule en **mètres** (prouvé par les tests dorés : `emptyWeightArm 2.10 → cg 2.132`, [weightBalanceStore.golden.test.js:48-58](alflight/src/core/stores/__tests__/weightBalanceStore.golden.test.js#L48)). **Le code lui-même l'avoue désormais** : l'en-tête de [armUnits.js:5-9](alflight/src/utils/armUnits.js#L5) écrit « *Cause racine : double pivot… des données mixtes en circulation (ex. F-HFGI : fuelMain 805.9 mm, autres bras en m) donnent un moment ×1000 → centrage faux* ». Le palliatif en place est une **devinette d'unité par magnitude** (`|x| > 10 ⇒ ÷1000`, [armUnits.js:39-43](alflight/src/utils/armUnits.js#L39)) appliquée à l'entrée du moteur ([weightBalanceStore.js:40](alflight/src/core/stores/weightBalanceStore.js#L40)). Cette heuristique **ne couvre que la paire m/mm** : elle **corrompt les cm (erreur ×10 : 210 cm → 0,21 m) et les pouces (erreur ×25,4 : 83 in → 0,083 m)** — deux unités pourtant offertes dans les préférences ([unitsStore.js:35](alflight/src/core/stores/unitsStore.js#L35), préréglage USA `armLength:'in'` l.89). Et elle **exclut explicitement l'enveloppe CG** (« *Ne touche PAS aux limites CG* », [armUnits.js:48](alflight/src/utils/armUnits.js#L48)) → bras normalisés en m, limites comparées dans l'unité de saisie : comparaison potentiellement hétérogène.

### D2 — Mutation de l'unité de référence des masses (kg ↔ lbs) — P0 — **objet de l'analyse particulière (chapitre A)**
Les masses de l'avion (masse à vide, MTOW, MLW, bagages max, points d'enveloppe) sont **stockées dans l'unité d'affichage courante** et **réécrites sur place** à chaque changement de préférence kg↔lbs ([Step3WeightBalance.jsx:305-322](alflight/src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx#L305)), tandis que le moteur les lit **en kg, sans conversion ni garde-fou** ([weightBalanceStore.js:46-51](alflight/src/core/stores/weightBalanceStore.js#L46)). Contrairement aux bras, **aucune heuristique de magnitude n'est possible** (750 kg et 750 lbs sont tous deux plausibles). Un avion créé sous préférence `lbs` est **faux de ×2,2046 dans tous ses champs de masse**, de façon **internement cohérente donc indétectable**, et le devient de façon **mixte** dès qu'on y additionne des charges de vol saisies en kg. Détail complet au chapitre A.

### D3 — Métadonnée d'unités mensongère & couches correctives qui masquent le défaut — P0
La persistance écrit bien une métadonnée d'unités ([aircraftStore.js:309-319](alflight/src/core/stores/aircraftStore.js#L309)) — **mais c'est une constante codée en dur** (`weight:'kg', armLength:'mm'`, …) apposée **quel que soit le contenu réel** de l'enregistrement. Elle déclare `armLength:'mm'` alors que la chaîne aval normalise en mètres, et `weight:'kg'` sur des masses potentiellement en lbs (D2). Conséquence aggravante : le chemin de migration legacy au chargement ne convertit **que si la métadonnée diffère du canonique** ([aircraftStore.js:190-202](alflight/src/core/stores/aircraftStore.js#L190)) — la métadonnée mensongère **court-circuite donc la seule machinerie de correction existante**. Une métadonnée fausse est pire qu'une métadonnée absente.

**Verdict global :** l'architecture corrige les symptômes par strates défensives (heuristique moteur, garde-fou d'import, réconciliations de `validateAndRepairAircraft`) au lieu de garantir l'invariant fondamental « *une grandeur = un pivot unique, conversion aux seules frontières, échec explicite sinon* ». Chaque strate ajoute sa propre classe d'erreurs (cm/in cassés, enveloppe exclue, métadonnée fausse). **Non conforme aux exigences d'un calcul de centrage certifiable.**

> **Échelle de sévérité** — **P0** : peut produire un verdict de centrage faux sans alerte ; correction avant toute production. **P1** : fausse un affichage/calcul intermédiaire ; trompeur mais détectable. **P2** : robustesse/dette exposant à régression. **P3** : qualité/observabilité.

---

# A. ANALYSE PARTICULIÈRE — Conversion kg ↔ lbs dans le module avion

*Chapitre dédié demandé en complément de l'audit. Tous les constats ci-dessous sont vérifiés dans le code, références exactes.*

## A.1 Les deux mécanismes de corruption

### Mécanisme M1 — Saisie brute dans l'unité d'affichage (pas de `toStorage`)
Les champs de masse de l'assistant de création écrivent la frappe clavier **telle quelle** dans les données de l'avion :

```jsx
// Step3WeightBalance.jsx — AUCUNE conversion vers le pivot kg
l.1570  updateData('weights.emptyWeight', e.target.value);   // masse à vide
l.1679  onChange={(e) => updateData('weights.mtow', e.target.value)}  // MTOW
l.1696  onChange={(e) => updateData('weights.mlw', e.target.value)}   // MLW
```

Le libellé d'unité, lui, est **dynamique** (`getUnitSymbol(units.weight)`). Donc : préférence `lbs` → l'utilisateur saisit « 2425 » sous un libellé « lbs » → **2425 est persisté nu**. Le moteur lira 2425 **kg**.

### Mécanisme M2 — Réécriture sur place au changement de préférence (l'unité de référence « suit » l'affichage)
Quand `units.weight` change **pendant que l'assistant est monté**, un effet convertit et **réécrit dans les données** tous les champs de masse :

```jsx
// Step3WeightBalance.jsx:294-322
const weightFields = ['weights.emptyWeight','weights.mtow','weights.mlw',
  'weights.minTakeoffWeight','weights.maxBaggageFwd','weights.maxBaggageAft'];
if (previousUnits.weight !== units.weight) {
  weightFields.forEach(field => {
    ...
    const convertedValue = convertValue(value, previousUnits.weight, units.weight, 'weight');
    if (convertedValue && convertedValue !== value) {
      updateData(field, Math.round(convertedValue * 10) / 10);   // l.317 — réécrit en lbs, arrondi 1 décimale
    }
  });
}
```

Idem pour `maxWeight` des compartiments bagages (l.378-384), les **masses des points d'enveloppe CG** `forwardPoints[].weight` (l.396-402), `aftCG.min/maxWeight` (l.417-419) et les points intermédiaires (l.439-452). **L'intégralité du référentiel de masse de l'avion bascule en lbs**, de manière cohérente — puis est persistée ainsi, sous une métadonnée qui affirme `weight:'kg'` ([aircraftStore.js:315](alflight/src/core/stores/aircraftStore.js#L315)).

### Lecture moteur — aucune défense
```js
// weightBalanceStore.js:46-51 — lecture directe, AUCUNE conversion, AUCUNE heuristique
const emptyWeight = parseFloat(aircraft.weights?.emptyWeight || aircraft.emptyWeight || aircraft.masses?.emptyMass);
const maxTakeoffWeight = parseFloat(aircraft.weights?.mtow || aircraft.maxTakeoffWeight);
```
Contrairement aux bras (D1), **il n'existe pas d'équivalent `normalizeAircraftWeightsToKg`** — et il ne peut pas en exister par magnitude : les plages kg et lbs de l'aviation légère se recouvrent totalement (600–1 200 kg ↔ 1 300–2 650 lbs, toutes valeurs plausibles dans les deux unités).

## A.2 Scénario chiffré de bout en bout (DA40 type)

| Étape | Préférence | Donnée | Valeur stockée | Réalité physique |
|---|---|---|---|---|
| 1. Création avion | `kg` (Europe) | masse à vide / MTOW | 780 / 1200 | 780 kg / 1200 kg ✔ |
| 2. L'utilisateur passe en préréglage USA (`lbs`) **assistant ouvert** | `lbs` | effet l.305-322 réécrit | **1719.6 / 2645.5** | toujours 780/1200 kg, mais **stockés en lbs** |
| 3. Sauvegarde | — | `aircraft_data` + `_metadata.units.weight:'kg'` | 1719.6 / 2645.5 « kg » | **métadonnée fausse** |
| 4. Préparation de vol : pilote + pax saisis | kg | charges de vol | 80 + 80 (kg) | mélange d'unités dans la même somme |
| 5. Moteur : `totalWeight = 1719.6 + 80 + 80 + carburant(kg)` | — | ≈ 1 940 « kg » | masse réelle ≈ 1 020 kg |
| 6. Verdict masse : `1940 ≤ MTOW 2645.5` → **OK** | — | — | **vrai par accident** (les deux bornes ont dérivé ensemble) |
| 7. Verdict CG : `cg = Σ(m·bras)/Σm` avec masses **mixtes** kg/lbs | — | CG **pondéré faux** | le CG glisse vers le bras de la masse à vide (surpondérée ×2,2) |

**Point clé :** comme MTOW et masse à vide dérivent **ensemble**, le contrôle de masse peut rester faussement vert pendant que la **marge réelle de chargement** est détruite : la capacité d'emport apparente (MTOW−vide−charges) est gonflée de ×2,2 sur les termes avion. À l'inverse, un avion créé en kg puis relu par un utilisateur lbs affiche des nombres faux d'un facteur 2,2 sous le mauvais libellé. **Et le CG, lui, est toujours faux en mélange** — c'est le danger silencieux.

## A.3 Mécanismes aggravants

| ID | Mécanisme | Preuve | Effet |
|----|---|---|---|
| M3 | **Conversion seulement si l'assistant est monté** : `previousUnits` est initialisé à la valeur courante au montage (`useState(units)`, [Step3:291](alflight/src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx#L291)). Préférence changée depuis l'écran Pilote (assistant fermé) → à la réouverture `previousUnits === units` → **aucune conversion**, mais les libellés ont changé | l.291 + dépendance `[units]` | valeurs kg affichées sous libellé lbs ; toute « correction » manuelle de l'utilisateur produit un avion **mixte** |
| M4 | **Dérive d'aller-retour** : `kgToLbs = ×2.20462`, `lbsToKg = ×0.453592` ([unitConversions.js:42-43](alflight/src/utils/unitConversions.js#L42)) ; produit = **0,999998 ≠ 1** ; combiné à l'arrondi **1 décimale** `Math.round(×10)/10` (l.317) réappliqué à chaque bascule | l.317, 380-384, 397-402 | chaque cycle kg→lbs→kg altère la valeur stockée (quantification ±0,05 + biais −2·10⁻⁶) ; jamais le même avion après N bascules |
| M5 | **`if (value)` saute les zéros et chaînes vides** — mais convertit les chaînes : les champs stockent des **strings** (`e.target.value`), `convertValue` les parseFloat ; un champ « 0 » légitime n'est jamais converti | l.309, 340 | incohérences de type + champs à 0 figés dans l'ancienne unité |
| M6 | **Les moments ne sont PAS convertis** : `moments.empty` (recalcul 2-sur-3, l.255-289) et `aftCG.min/maxMoment` (« gardés tels quels », l.429-430) ne figurent dans aucune liste de conversion | l.296-303, 325-334, 429-430 | après bascule kg↔lbs, le moment stocké est dans l'ancien produit d'unités ; si `lastEditedEmptyField==='moment'`, le 2-sur-3 **recalcule masse ou bras depuis un moment périmé** (l.277, 282) |
| M7 | **Affichages/PDF en kg figé** : la fiche avion et l'export PDF impriment la valeur stockée avec « kg » en dur (AircraftModule, ex. `addText(...kg)`) ; moments PDF libellés **kg·mm** en dur (l.853, 882) | AircraftModule.jsx | un avion-lbs est documenté « kg » sur le document de masse & centrage imprimé |

## A.4 Volet carburant du problème kg/lbs (masse de carburant)

Le carburant peut être préféré **en kg** (préréglage `aviation` : `fuel:'kg'`, [unitsStore.js:117](alflight/src/core/stores/unitsStore.js#L117)) ou en gal/lbs (USA). Trois défauts convergents :

1. **Densité ignorée par le helper canonique** : `mbUnits.toStorage()` appelle `convertValue` **sans `options.density`** ([mbUnits.js:62](alflight/src/features/aircraft/utils/mbUnits.js#L62)) → toute conversion kg↔ltr passe par la densité **par défaut AVGAS 0,72** ([unitConversions.js:15](alflight/src/utils/unitConversions.js#L15)), même pour un avion **JET A-1 (0,84)** → volume faux de **17 %**.
2. **Facteur figé 6.01 lbs/gal** : `galToLbs = ×6.01` et `lbsToGal = ÷6.01` ([unitConversions.js:21,31](alflight/src/utils/unitConversions.js#L21)) **ignorent le paramètre densité** (la signature ne l'accepte même pas) — exact pour l'AVGAS seulement ; pour JET A-1, 1 gal ≈ 7,0 lbs → erreur 14 %.
3. **Source de densité divergente côté vol** : Step6 choisit la densité par **string-match** `fuelType.includes('JET') ? JET_A1 : AVGAS` au lieu du helper canonique `getFuelDensity` ([Step6WeightBalance.jsx:309-327](alflight/src/features/flight-wizard/steps/Step6WeightBalance.jsx#L309)) — tolérable aujourd'hui (valeurs alignées depuis A1) mais contourne la source unique et re-divergera à la première évolution.

À noter, côté positif : le moteur lui-même est **fail-closed sur la densité** (type carburant inconnu ⇒ `fuelDensityMissing`, pas de 0,84 fabriqué, [weightBalanceStore.js:147-165](alflight/src/core/stores/weightBalanceStore.js#L147)).

## A.5 Pourquoi kg/lbs est PLUS dangereux que m/mm

| Critère | m/mm (D1) | kg/lbs (D2) |
|---|---|---|
| Facteur d'erreur | ×1000 — produit des CG **absurdes**, souvent visibles (graphe illisible, verdict toujours hors limites) | ×2,2046 — produit des valeurs **plausibles** |
| Désambiguïsation par magnitude | possible (plages disjointes 0,01-10 m vs 300-10000 mm) — c'est le pont actuel | **impossible** (plages totalement recouvrantes) |
| Cohérence interne après corruption | données souvent **mixtes** (un bras sur deux) → détectable | corruption **cohérente** (tous les champs basculent ensemble, M2) → indétectable de l'intérieur |
| Garde-fou existant | `normalizeAircraftArmsToMeters` à l'entrée moteur | **aucun** |
| Voie de détection | magnitude + enveloppe | **uniquement** comparaison à une référence externe (fiche constructeur, préréglage communautaire du même modèle) ou confirmation utilisateur |

**Conclusion A :** le bug kg/lbs relève des mêmes causes racines que m/mm (stockage en unité d'affichage, pivot non garanti, conversions silencieuses, métadonnée constante) mais sa remédiation **exige** la stratégie de migration assistée par référence externe décrite en §5.4 — la magnitude ne sauvera personne ici.

---

# Les 5 axes de l'audit

## AXE 1 — Cartographie de la donnée & gestion des préférences

### 1.1 Source unique de vérité (SSOT)
- [x] **CTRL-1.1 Unicité du pivot par grandeur — ÉCHEC.** Bras : mm (mbUnits) vs m (moteur, tests dorés) — admis par [armUnits.js:5-9](alflight/src/utils/armUnits.js#L5). Masse : kg (métadonnée/moteur) vs unité d'affichage (données réelles, chap. A).
- [x] **CTRL-1.2 Cohérence inter-catégories des longueurs — ÉCHEC.** Une même grandeur physique vit en 4 pivots : `armLength:'mm'`, `runway:'m'` ([mbUnits.js:33](alflight/src/features/aircraft/utils/mbUnits.js#L33)), `altitude:'ft'`, visibilité m/km. Toute formule croisant ces champs exige des conversions explicites — à inventorier (Axe 2).
- [x] **CTRL-1.3 Stockage en unité d'affichage — CONFIRMÉ** pour bras (Step3 brut : réservoirs l.1079-1097, sièges l.1282-1287, bagages l.1451-1466) **et masses** (l.1570/1679/1696) — alors que le champ **capacité carburant** du même écran convertit correctement (`convertValue(...,'ltr',...)`, l.1044-1074) : le bon patron existe à 30 lignes des champs défaillants.
- [x] **CTRL-1.4 Métadonnée d'unité — EXISTE MAIS MENSONGÈRE (correction v1).** Constante figée déclarant le canonique quel que soit le contenu ([aircraftStore.js:309-319](alflight/src/core/stores/aircraftStore.js#L309)) ; déclare `armLength:'mm'` quand la chaîne aval vit en m ; **désarme la migration legacy** (l.190-202 ne convertit que si métadonnée ≠ canonique).

**Registre des grandeurs (état réel vérifié) :**

| Grandeur | Pivot déclaré (métadonnée) | Pivot `mbUnits` | Pivot moteur | Données réelles en base | Verdict |
|---|---|---|---|---|---|
| Bras de levier | mm | mm | **m** (+ heuristique >10→÷1000) | **mixtes** (F-HFGI cité par armUnits.js:8) | ⛔ P0 |
| Masse | kg | kg | kg (lecture nue) | **unité de préférence du créateur** | ⛔ P0 |
| Moment | — (non déclaré) | kg·mm | kg·m | produit des unités de saisie | ⛔ P0 |
| Carburant (vol.) | ltr | ltr | ltr→kg via densité fail-closed | ltr ✔ | ✔ |
| Enveloppe CG (cg) | — | — | unité de saisie, **exclue de l'heuristique** ([armUnits.js:48](alflight/src/utils/armUnits.js#L48)) | unité de préférence | ⛔ P0/P1 |

### 1.2 Isolation des préférences
- [x] **CTRL-1.5 La préférence mute la donnée — CONFIRMÉ.** L'effet [Step3:294-466](alflight/src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx#L294) réécrit masses (×10/10), bras (×100/100), CG d'enveloppe (×10000/10000) dans la nouvelle unité d'affichage. Le « pivot » d'un avion est donc **l'historique des préférences de son créateur**. Violation du principe d'isolation (P0 via D2, P1 via bras).
- [x] **CTRL-1.6 Fenêtres de non-conversion — CONFIRMÉ** (M3, chap. A) : conversion seulement si le composant est monté au moment du changement. Vérifier en dynamique le double-déclenchement StrictMode (risque de double conversion ×2,2² ou ÷1000²) — **à tester** (T-DYN-1).
- [x] **CTRL-1.7 Convergence des écrans de préférences — OK.** Les 3 composants (`features/units`, `features/pilot` ×2) écrivent via `unitsSelectors.useUnitsActions().setUnit()` sur le même store Zustand persisté. Duplication de code à factoriser (P3).

### 1.3 IHM — liaison valeur ↔ unité
- [x] **CTRL-1.8/1.9 Inventaire des libellés.** Champs de saisie Step3 : symboles **dynamiques** ✔ (mais valeurs non converties — le libellé dit vrai sur l'intention, faux sur le contenu après bascule). Libellés **en dur** confirmés :

| Fichier:ligne | Libellé figé | Note |
|---|---|---|
| [WeightBalanceChart.jsx:397](alflight/src/features/weight-balance/components/WeightBalanceChart.jsx#L397) | `Centre de Gravité (mm)` | l'axe dit mm, le moteur sort des m, le code multiplie ×1000 (l.402, 58-59) |
| WeightBalanceChart.jsx:410 | `Moment (kg.m)` | |
| WeightBalanceChart.jsx:343-344 | tooltip `…m` / `(×1000) mm` | figé m/mm, ignore cm/in |
| [WeightBalanceTable.jsx:133-135](alflight/src/features/weight-balance/components/WeightBalanceTable.jsx#L133) | `Masse (kg)`, `Bras (m)`, `Moment (kg.m)` | + formule affichée l.197 |
| Step6WeightBalance.jsx:828+ | `… m`, `… kg.m` | bras/moments figés ; le carburant, lui, est converti dynamiquement (l.651-657) ✔ |
| AircraftModule.jsx:853, 882 | moments PDF `kg·mm` en dur | **mixte** (l.839 passe l'unité en paramètre) — correction v1 : pas « uniformément figé » |
| CgEnvelopeDualChart.jsx:269 | `Moment (${massUnit}·${armUnit})` — **dynamique** ✔ | **correction v1** : le libellé suit les props (`armUnit="mm"` passé par Step3:1773) ; le risque est dans la **valeur** de `p.cg` (l.193/202/212 `p.weight*p.cg`), pas le libellé |

---

## AXE 2 — Audit intégral des équations

### 2.1 Recensement & analyse dimensionnelle (grille vérifiée)

| ID | Fichier:ligne | Expression | Unités | Verdict |
|----|---|---|---|---|
| EQ-01 | [weightBalanceStore.js:189-194](alflight/src/core/stores/weightBalanceStore.js#L189) | `moment = poids × bras` (×6 stations) | kg × m → kg·m | ✔ homogène **après** l'heuristique l.40 ; ⛔ dépend d'elle (D1) |
| EQ-02 | l.196-203 | `totalMoment = Σ` | kg·m | ✔ |
| EQ-03 | l.206 | `cg = totalMoment/totalWeight` | → m ; garde `totalWeight>0` | ✔ si entrées saines |
| EQ-04 | l.233-236 | `cg ≥ forward && cg ≤ aft` | cg en **m** vs enveloppe en **unité de saisie** (exclue de l'heuristique) | ⛔ P0/P1 — homogénéité non garantie |
| EQ-05 | calculations.js:65-70 | `calculateFromItems` : même formule CG (scénarios) | idem moteur | ⚠️ P2 — doublon ; logique identique constatée, divergence possible à terme |
| EQ-06 | calculations.js:58-61, 75-76 | `kgCarburant = L × densité` | L × kg/L → kg ; densité via `getFuelDensity` fail-closed | ✔ |
| EQ-07 | [weightBalanceStore.js:161](alflight/src/core/stores/weightBalanceStore.js#L161) | `fuelWeight = ltr × densité` | idem | ✔ |
| EQ-08 | Step3:266-287 | 2-sur-3 : `M=e×a`, `a=M/e`, `m=M/a` | **unités d'affichage courantes** | ⚠️ P2 — moment en produit d'unités de saisie, non converti (M6) |
| EQ-09 | [mbUnits.js:159-172](alflight/src/features/aircraft/utils/mbUnits.js#L159) | `compute2of3` | canonique kg/mm/kg·mm déclaré | ✔ interne ; ⛔ contrat mm contredit D1 |
| EQ-10 | CgEnvelopeDualChart.jsx:193/202/212 | `x = weight × cg` | kg × unité(p.cg) | ⚠️ P1 — hérite de l'ambiguïté enveloppe |
| EQ-11 | cgEnvelope.js (interp.) | `cg_limite(masse)` interpolation linéaire | unité de saisie | ⚠️ garbage-in/garbage-out |

### 2.2 **%MAC — constat formel : LA FORMULE N'EXISTE PAS** (réponse au point « à localiser » de la v1)
Recherche exhaustive : l'application **stocke** `macLength` et `lemac` comme métadonnées d'enveloppe (centrogramAdapter.js:112-113, cgEnvelope.js) mais **ne calcule jamais** `%MAC = (CG − LEMAC)/MAC × 100`. Le centrage est exprimé et vérifié exclusivement en CG absolu vs enveloppe. **Décision requise** : implémenter le %MAC avec homogénéité stricte (3 longueurs dans le même pivot) **ou** retirer ces champs morts qui suggèrent une capacité inexistante (P2).

### 2.3 Cas limites — acquis à préserver et trous restants
**Acquis (vérifiés, à sanctuariser) :** masse à vide/MTOW absentes ⇒ calcul **refusé** (`return null`, l.57-62) ; bras manquant sur station chargée ⇒ `cgReliable=false`, `isWithinCG=null`, warning (l.208-220) ; densité inconnue ⇒ fail-closed (l.147-165) ; enveloppe absente ⇒ verdict null ; division par zéro gardée partout où vérifiée ; `compute2of3` refuse les dénominateurs nuls.

**Trous :**
- [ ] **CTRL-2.5** `convertValue` retourne **0** sur NaN/falsy ([unitConversions.js:166-169](alflight/src/utils/unitConversions.js#L166)) — un bras illisible devient moment nul silencieux (P1).
- [ ] **CTRL-2.6** Aucune borne de plausibilité physique (bras négatif au-delà du datum légitime vs erreur, masse > 10×MTOW, CG hors fuselage) (P2).
- [ ] **CTRL-2.7** Enveloppe à 0/1 point, points non triés, axe dégénéré 0-1 du graphe (P2).

---

## AXE 3 — Matrice de conversion & précision numérique

### 3.1 Le convertisseur central — défauts confirmés

| ID | Fichier:ligne | Défaut | Sévérité |
|----|---|---|---|
| CV-1 | [unitConversions.js:249-250](alflight/src/utils/unitConversions.js#L249) | clé introuvable ⇒ **retourne la valeur d'origine** (« returning original value ») — une conversion manquante = corruption silencieuse. Vecteur n°1 | **P0** |
| CV-2 | [mbUnits.js:63-66, 86-89](alflight/src/features/aircraft/utils/mbUnits.js#L63) | `catch ⇒ return num` (nombre brut non converti) | **P0** |
| CV-3 | unitConversions.js:166-169 | `return 0` sur falsy/NaN | P1 |
| CV-4 | l.184 | dispatch par **concaténation de chaîne** `${from}To${Cap(to)}` — `'km/h'`, `'m/s'` et toute casse inattendue ⇒ CV-1 | P1 |
| CV-5 | l.186, 240 | `console.log` en chemin chaud (chaque frappe) | P3 |
| CV-6 | l.21, 31 | `galToLbs=×6.01` / `lbsToGal=÷6.01` figés AVGAS, densité non paramétrable | P1 (chap. A.4) |
| CV-7 | l.42-43 | `2.20462` / `0.453592` : corrects isolément mais **non inverses exacts** (produit 0,999998) ; combinés à la réécriture in-place ⇒ dérive (M4). Référence exacte : 1 lb = 0,45359237 kg | P2 |
| CV-8 | [armUnits.js:39-43](alflight/src/utils/armUnits.js#L39) + [aircraftNormalizer.js:96-104](alflight/src/utils/aircraftNormalizer.js#L96) | **heuristique magnitude >10 ⇒ ÷1000** : casse **cm (×10)** et **in (×25,4)** ; le commentaire « zéro faux positif » n'est vrai que pour la paire m/mm | **P0** |

- [ ] **CTRL-3.1/3.2** Test exhaustif de la matrice : toutes paires × aller-retour × valeurs de référence ; détection des clés manquantes (qui aujourd'hui tombent dans CV-1 sans bruit).
- [ ] **CTRL-3.3** Remplacer CV-1/CV-2/CV-3 par erreur explicite (dev/test) + fail-closed (prod).

### 3.2 Précision numérique
Calculs en `number` IEEE-754 (double) : ~15-16 chiffres significatifs — **suffisant** ; `BigDecimal` non requis. Les vrais risques sont les **arrondis prématurés réinjectés** :
- [ ] **CTRL-3.4** Réécritures arrondies à chaque bascule de préférence : masses **1 décimale** (l.317), bras 2 (l.348), CG enveloppe 4 (l.409) — quantification cumulative à chaque cycle (M4). En lbs, 1 décimale ≈ ±0,05 lbs ; acceptable isolément, non-idempotent en boucle.
- [ ] **CTRL-3.5** `cg.toFixed(3)` tronque le **résultat de calcul** ([weightBalanceStore.js:244](alflight/src/core/stores/weightBalanceStore.js#L244)) — 3 décimales = précision mm si pivot m (OK) ; à re-décider avec le pivot.
- [ ] **CTRL-3.6** Comparaisons d'enveloppe sans tolérance ε (l.235) — borne flottante stricte.

**Règles cibles :** pivot unique ; conversion aux seules frontières ; aucun arrondi sur valeur intermédiaire ; arrondi d'affichage centralisé ; ε déclaré pour les comparaisons.

---

## AXE 4 — Persistance & hydratation

### 4.1 Chemins réels (vérifiés)
**Écriture** : `aircraftStore` sérialise l'avion entier dans Supabase `community_presets.aircraft_data` (l.340 ; mise à jour par fusion `deepMergeKeepExisting`, communityService.js:809-810) avec `_metadata.version '2.0.0'` + **unités constantes** (l.309-319 — D3).
**Lecture** : `loadFromSupabase` (l.131-209) ne convertit **que si** la métadonnée diffère du canonique (l.190-202) — jamais le cas puisque la métadonnée est constante — puis `validateAndRepairAircraft` (réconciliation des 3 emplacements de masse à vide, projection `arms→weightBalance`, dérivation `cgLimits` ; **aucune conversion d'unité**).
**Import/normalisation** : `normalizeAircraftImport` ([aircraftNormalizer.js:33-201](alflight/src/utils/aircraftNormalizer.js#L33)) convertit selon la métadonnée source + applique le garde-fou magnitude (l.96-104) — **chemin d'import uniquement**, pas le chemin assistant→sauvegarde.
**Entrée moteur** : `normalizeAircraftArmsToMeters` (heuristique, bras seulement, enveloppe exclue).

### 4.2 Réponse au scénario « l'utilisateur saisit 1500 mm »
> Écrit en base : **`"1500"`** (string), nu, sous métadonnée constante `armLength:'mm'`. À la relecture : aucune conversion (métadonnée = canonique) ; à l'entrée moteur : 1500 > 10 ⇒ **÷1000 ⇒ 1,5 m** ✔ *par heuristique*. **Mais** : saisi sous préférence **cm** (« 150 ») ⇒ 150 > 10 ⇒ 0,15 m (**×10 faux**) ; sous préférence **in** (« 59 ») ⇒ 0,059 m (**×25 faux**) ; et une **masse** « 1500 » saisie en lbs ⇒ lue 1500 kg (**×2,2 faux, aucun filet**). Le système ne *sait* pas ce qu'il a stocké — il le *devine*, et seulement pour une paire d'unités.

### 4.3 Points de contrôle
- [x] **CTRL-4.1/4.2** Chemins cités ci-dessus ; asymétrie write/read prouvée (conversion d'affichage jamais appliquée à l'écriture des bras/masses, heuristique appliquée seulement à la lecture moteur, seulement bras).
- [x] **CTRL-4.3 Devinette par magnitude — CONFIRMÉE (correction v1 : la v1 n'en avait pas trouvé).** Bras : armUnits.js:39-43 + aircraftNormalizer.js:96-104. **Motif systémique** ailleurs : capacité < 50 ⇒ gallons et conso < 15 ⇒ gph (useAlternateSelection.js), altitude > 5000 ⇒ pieds (elevationUtils.js:88-91), pression > 2000 ⇒ Pa (weatherAPI.js). Chaque heuristique est une dette de désambiguïsation non payée à la frontière (P0 pour bras cm/in, P2 ailleurs).
- [ ] **CTRL-4.4** Frontières d'import MANEX (`manexExtractionMapper`) : unité des masses/bras extraits d'un POH US (lbs/in) — **à instruire** (chantier T-IMP).
- [ ] **CTRL-4.5** Unicité du moteur : `calculateScenarios` (calculations.js) vs `calculateWeightBalance` — logique identique constatée ce jour ; consolider en un seul point de calcul (P2).
- [ ] **CTRL-4.6 (nouveau)** Synchronisation `aftCG` : la conversion de préférence fait `setAftCG` local **sans** `updateData('cgEnvelope…')` symétrique (l.432, contrairement aux forward l.412 et intermédiaires l.462) — vérifier qu'un autre effet persiste l'aft converti, sinon désynchronisation state/donnée (P2).

---

## AXE 5 — Stratégie de remédiation & livrables

### 5.1 Cible architecturale
1. **Pivot unique : mètre (longueurs), kg (masses), kg·m (moments), L (volumes)** — déclaré dans un seul module, consommé partout. Le moteur testé est déjà en m/kg ; le chantier « pivot = mètre » est d'ailleurs annoncé dans [armUnits.js:11](alflight/src/utils/armUnits.js#L11). Aligner `mbUnits.STORAGE_UNITS`, `CANONICAL_UNITS` (unitsDisplay) et la métadonnée.
2. **Conversion aux seules frontières** : `toStorage()` sur **chaque** `onChange` (bras ET masses — répliquer le patron du champ capacité carburant, Step3:1044-1074), `fromStorage()` sur chaque `value=`. **Supprimer l'effet de réécriture in-place** (l.294-466) : un changement de préférence ne touche plus que l'affichage.
3. **Fail-closed, jamais pass-through** : CV-1/CV-2/CV-3 lèvent en dev/test, marquent la valeur invalide en prod (le verdict suit le modèle `cgReliable`). La densité devient un paramètre obligatoire des conversions volume↔masse.
4. **Métadonnée VRAIE** : `schemaVersion` + unités **réelles** écrites à la sauvegarde ; les heuristiques de magnitude deviennent des **détecteurs d'alerte** (log + quarantaine), plus jamais des correcteurs silencieux.
5. **IHM** : symboles 100 % dynamiques (corriger les 6 sites figés) ; le %MAC : implémenter proprement ou retirer `macLength/lemac`.

### 5.2 Gabarit de rapport d'anomalie
```
ANO-<n> — <titre> | Axe | Sévérité P0-P3 | Statut
Fichier:ligne + extrait | Description | Cause racine (unité attendue vs réelle)
Reproduction (préréglage + valeurs) | Impact sécurité (effet CG/verdict + facteur)
Correctif proposé | Test de non-régression (id §5.3) | Impact migration (§5.4)
```

### 5.3 Plan de tests (Vitest — étendre les golden existants)
**A. Conversions** : matrice exhaustive paires×valeurs de référence ; propriété aller-retour `b→a∘a→b ≈ id` (ε déclaré) ; **clé manquante ⇒ throw** ; `fromStorage∘toStorage ≈ id` sous chaque préférence ; conversions carburant **avec densité obligatoire** (AVGAS/JET-A1/MOGAS).
**B. Invariance par unité (le test-clé)** : même avion physique saisi sous Europe(kg/mm), USA(lbs/in), Metric(kg/cm) ⇒ **même CG, même verdict** à ε près. *Doit échouer aujourd'hui sur USA et Metric (chap. A + CV-8) — c'est la preuve, puis le verrou.*
**C. Adversariaux** : masses lbs lues comme kg (détection) ; bras cm/in vs heuristique ; bascule de préférence répétée ×20 (dérive M4 bornée puis nulle après correctif) ; préférence changée assistant démonté (M3) ; moment périmé + 2-sur-3 (M6) ; StrictMode double-effet (T-DYN-1).
**D. E2E** : création (chaque préréglage) → sauvegarde → rechargement → calcul : CG identique ; changement de préférence post-création : affichage converti, **pivot intact**.
**Sortie** : 100 % des paires couvertes ; invariance verte sur ≥ 3 avions réels ; zéro pass-through restant.

### 5.4 Migration des données existantes — sans corruption
Deux populations distinctes :

**Bras (m/mm/cm/in)** — désambiguïsation **physique** par interprétations candidates : pour chaque unité candidate, recalculer le CG et le confronter à l'enveloppe propre de l'avion + plage plausible (bras GA ∈ ]0;10] m). Une seule interprétation plausible ⇒ migrer + journaliser. Sinon ⇒ **quarantaine**.

**Masses (kg/lbs) — la magnitude est inopérante (chap. A.5)** :
1. **Référence externe** : comparer masse à vide/MTOW aux préréglages communautaires du **même modèle** (`communityAircraftDatabase`) et aux fiches constructeur ; un ratio ≈ 2,20 ± arrondi sur les deux champs simultanément signe un avion-lbs.
2. **Indices internes** : cohérence interne ne suffit pas (corruption cohérente, M2) mais des invariants aident : masse à vide < MTOW dans les deux lectures ; densité de l'enveloppe (masses des points) cohérente avec MTOW.
3. **Ambiguïté résiduelle ⇒ quarantaine** : `units='UNVERIFIED'`, **verdict de centrage désactivé** (fail-closed, modèle `cgReliable`), bannière demandant au pilote une **re-confirmation explicite** des masses dans l'unité de son choix. **Jamais de coercition silencieuse.**

Procédure commune : backup → **dry-run** en lecture seule → rapport (migrés / quarantaine, avant/après, marges) → revue humaine → application → journal réversible. Toute nouvelle écriture porte `schemaVersion`+unités réelles dès la phase P1, ce qui borne la population à migrer.

### 5.5 Séquencement & RACI

| Phase | Contenu | Sortie | R/A |
|---|---|---|---|
| **P0 — Filet** | Tests d'invariance par unité (B) AVANT correction — rouges = preuve | suite rouge documentée | Dev / Audit |
| **P1 — Pivot & fail-closed** | Pivot m/kg unifié (mbUnits, unitsDisplay, métadonnée VRAIE) ; CV-1/2/3 ⇒ erreurs ; densité obligatoire | conversions sûres | Dev / Archi |
| **P2 — Frontières** | `toStorage/fromStorage` sur TOUS les champs bras+masses ; suppression réécriture in-place ; libellés dynamiques | IHM cohérente | Dev |
| **P3 — Équations** | Décision %MAC ; fusion des 2 moteurs CG ; bornes de plausibilité ; enveloppe dans le pivot | grille EQ verte | Dev / Audit |
| **P4 — Migration** | Schéma versionné ; dry-run bras (physique) + masses (référence externe) ; quarantaine | rapport de migration | Dev+Data / PO |
| **P5 — Recette** | Suite verte, E2E, validation empirique ≥ 3 avions réels, revue croisée | PV de recette | Audit |

---

## Annexe A — Checklist consolidée
```
AXE 1  [x]1.1 pivot non unique (ÉCHEC)  [x]1.2 longueurs multi-pivots (ÉCHEC)  [x]1.3 stockage en unité d'affichage (CONFIRMÉ)
       [x]1.4 métadonnée mensongère  [x]1.5 préférence mute la donnée  [~]1.6 StrictMode à tester  [x]1.7 écrans préfs convergents
       [x]1.8/1.9 inventaire libellés (6 sites figés)
AXE 2  [x]2.1 grille EQ-01..11  [x]2.2 %MAC ABSENT (décision requise)  [x]2.3 acquis fail-closed sanctuarisés
       [ ]2.5 NaN→0 à corriger  [ ]2.6 bornes plausibilité  [ ]2.7 enveloppes dégénérées
AXE 3  [x]CV-1..8 qualifiés  [ ]3.1/3.2 matrice testée  [ ]3.3 suppression pass-through  [ ]3.4-3.6 arrondis/ε
AXE 4  [x]4.1/4.2 chemins+asymétrie prouvés  [x]4.3 heuristiques magnitude CONFIRMÉES (bras + 3 autres domaines)
       [ ]4.4 import MANEX à instruire  [ ]4.5 fusion moteurs  [ ]4.6 sync aftCG
AXE 5  [x]5.1 cible  [x]5.2 gabarit  [x]5.3 plan de tests  [x]5.4 migration duale (physique / référence externe)  [x]5.5 RACI
CHAP A [x]M1-M7 qualifiés  [x]volet carburant  [x]stratégie de détection lbs
```

## Annexe B — Inventaire des anomalies (v2)

| ID | Axe | Sév. | Fichier:ligne | Synthèse |
|----|-----|------|---------------|----------|
| ANO-1 | 1/2 | **P0** | mbUnits.js:25-34 ↔ golden.test.js:48-58 ↔ armUnits.js:5-9 | Double pivot bras mm/m — admis par le code ; ponté par heuristique |
| ANO-2 | 4 | **P0** | Step3:1079-1097, 1282-1287, 1451-1466 (bras) ; **1570, 1679, 1696 (masses)** | Saisie stockée brute en unité d'affichage, sans `toStorage` (le champ carburant l.1044-1074 montre le bon patron) |
| ANO-3 | 3 | **P0** | unitConversions.js:249-250 | Pass-through silencieux sur clé manquante |
| ANO-4 | 3 | **P0** | mbUnits.js:63-66, 86-89 | `catch ⇒ return num` (brut) |
| ANO-9 | 4 | **P0** | aircraftStore.js:309-319 + 190-202 | **(corrigée v2)** Métadonnée d'unités = constante mensongère qui désarme la migration legacy |
| **ANO-11** | A | **P0** | Step3:305-322 + weightBalanceStore.js:46-51 | **kg/lbs : mutation de l'unité de référence des masses + lecture moteur nue, sans garde-fou possible par magnitude** |
| **ANO-12** | 3/4 | **P0** | armUnits.js:39-43 ; aircraftNormalizer.js:96-104 ; unitsStore.js:35,89 | Heuristique >10⇒÷1000 corrompt cm (×10) et in (×25,4), unités offertes par les préférences |
| **ANO-13** | 2 | **P0/P1** | armUnits.js:48 + weightBalanceStore.js:97-103, 233-236 | Normalisation asymétrique : bras → m, enveloppe CG exclue → comparaison potentiellement hétérogène |
| ANO-5 | 1 | P1 | Chart:397/410/343-344 ; Table:133-135/197 ; Step6:828+ ; PDF:853/882 | Libellés figés (PDF mixte ; CgEnvelopeDualChart:269 dynamique — v1 corrigée) |
| ANO-7 | 2/3 | P1 | unitConversions.js:166-169 | `return 0` sur NaN/falsy |
| ANO-8 | 1/3 | P1 | Step3:294-466 | Réécriture in-place au changement de préférence + arrondis (1 déc. masses) — vecteur de M2/M4 |
| **ANO-14** | A | P1 | mbUnits.js:62 ; unitConversions.js:21,31 ; Step6:309-327 | Densité absente de `toStorage` (kg→L toujours 0,72) ; 6.01 lbs/gal figé ; densité par string-match côté vol |
| ANO-6 | 2 | P2 | weightBalanceStore.js:206 ↔ calculations.js:65-70 | Doublon de moteur CG (logique identique constatée — fusionner) |
| **ANO-15** | A | P2 | Step3:291 | Conversion seulement si assistant monté (`useState(units)`) — fenêtre de non-conversion M3 |
| **ANO-16** | A/2 | P2 | Step3:255-289, 296-334, 429-430 | Moments exclus des conversions ; 2-sur-3 peut recalculer depuis un moment périmé |
| **ANO-17** | 4 | P2 | Step3:432 vs 412/462 | `aftCG` converti en state local sans écriture symétrique — sync à vérifier |
| ANO-10 | 3 | P3 | unitConversions.js:186, 240 | `console.log` en chemin chaud |

## Annexe C — Corrections apportées aux constats v1 (traçabilité d'audit)

| Constat v1 | Verdict v2 | Évidence |
|---|---|---|
| « Aucune métadonnée d'unité en base » (ANO-9) | **INEXACT** → métadonnée présente mais **constante mensongère** (pire : désarme la migration) | aircraftStore.js:309-319, 190-202 |
| « Pas de devinette d'unité par magnitude » (CTRL-4.3) | **RÉFUTÉ** → heuristiques confirmées sur bras (×2 implémentations) + carburant + altitude + pression | armUnits.js:39-43 ; aircraftNormalizer.js:96-104 ; useAlternateSelection ; elevationUtils.js:88-91 ; weatherAPI.js |
| « Le moteur lit les bras sans pont » | **ÉVOLUÉ** → pont heuristique à l'entrée moteur depuis Item L | weightBalanceStore.js:40 |
| « CgEnvelopeDualChart : axe moment figé kg·m » | **RÉFUTÉ** → libellé dynamique `${massUnit}·${armUnit}` ; le risque porte sur la valeur de `p.cg` | CgEnvelopeDualChart.jsx:269, 193/202/212 |
| « PDF uniformément figé mm/kg » | **NUANCÉ** → mixte : unité paramétrée (l.839) mais moments `kg·mm` en dur (l.853, 882) | AircraftModule.jsx |
| « %MAC à localiser » | **TRANCHÉ** → la formule **n'existe pas** ; seuls macLength/lemac sont stockés | centrogramAdapter.js:112-113 |
| Constats CV-1..5, ANO-1..8, libellés Chart/Table, asymétrie Step3 | **CONFIRMÉS** ligne à ligne | Annexe B |

---
*Fin de l'audit v2.0. Restent à instruire : import MANEX (CTRL-4.4), test dynamique StrictMode (CTRL-1.6/T-DYN-1), sync aftCG (CTRL-4.6).*
