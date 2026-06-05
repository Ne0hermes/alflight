# AUDIT CHIRURGICAL DU FLUX DE DONNÉES — « Mes avions » → « Je prépare mon vol »
## Domaines : MASSE & CENTRAGE + PERFORMANCES

**Date :** 2026-06-05
**Périmètre :** Flux fournisseur (`features/aircraft`) → consommateur (`features/flight-wizard`, `features/weight-balance`, `features/performance`)
**Méthode :** Traçage variable par variable, preuves `fichier:ligne` vérifiées par lecture directe du code.

---

## 0. SYNTHÈSE EXÉCUTIVE

L'application **ne tient pas pleinement la promesse d'un système dynamique**. Trois ruptures structurelles :

1. **DOUBLE MOTEUR DE MASSE & CENTRAGE.** Deux moteurs coexistent et **divergent** :
   - `core/stores/weightBalanceStore.js` (canonique) — calcule masse **ET** centrage (CG), densité **0,84**.
   - `features/flight-wizard/models/FlightPlanData.js` (parallèle) — calcule masse **SANS** centrage, densité **0,80**, et c'est **sa** masse atterrissage qui alimente la performance.

2. **ENVELOPPE DE CENTRAGE APLATIE.** « Mes avions » saisit une enveloppe riche (points avant variables + modèle arrière 2-points `aftMinCG`/`aftMaxCG`). Le contrôle opérationnel n'en lit qu'un **rectangle constant** : `forwardPoints[0].cg` et le legacy `aftCG`. Le reste est **donnée morte**.

3. **PERFORMANCE = SEULEMENT DISTANCES.** Le moteur d'abaques (`operationResolver` → `abacInterpolation`/`cascade`) lit dynamiquement les abaques de l'avion pour les **distances** décollage/atterrissage. **Tout le reste est mort ou absent** : V-vitesses, K-factor, corrections piste/surface, et le facteur de sécurité ne s'applique **qu'à l'affichage**.

| Indicateur | Valeur |
|---|---|
| Variables auditées | 41 |
| Dynamiques (réellement BDD→calcul) | 14 |
| Dynamiques **mais** avec fallback fantôme en dur | 13 |
| Hardcodées pures (consommateur) | 4 |
| Mortes (saisies dans « Mes avions », jamais lues) | 10 |

---

## 1. RAPPORT D'AUDIT DES FLUX — MASSE & CENTRAGE

Légende : **DYN** = lue depuis l'objet avion · **HC** = valeur en dur dans le consommateur · **MORTE** = saisie dans « Mes avions » mais jamais consommée · **DYN+fantôme** = lue dynamiquement mais avec une valeur de repli en dur qui s'active silencieusement.

| # | Variable | Provenance saisie (« Mes avions ») | Lecture consommateur (preuve) | Repli en dur | Statut |
|---|---|---|---|---|---|
| W1 | **Masse à vide (BEW)** | `weights.emptyWeight` / `emptyWeight` (Step3) | `weightBalanceStore.js:39-44` `emptyWeight \|\| 600` | **600 kg** | **DYN+fantôme** |
| W2 | **Bras de levier masse à vide** | `arms.empty` → `weightBalance.emptyWeightArm` | `weightBalanceStore.js:72` `armLengths.emptyMassArm \|\| 2.00` | **2,00 m** | **DYN+fantôme** |
| W3 | **MTOW** | `weights.mtow` (Step3) | `weightBalanceStore.js:46` `\|\| 1150` | **1150 kg** | **DYN+fantôme** |
| W4 | **Masse mini décollage** | `weights.minTakeoffWeight` | `weightBalanceStore.js:45` `\|\| 600` ; `contexts/index.jsx:152-165` | **600 kg** | **DYN+fantôme** |
| W5 | **MZFW (Max Zero Fuel W.)** | *non saisi au wizard* | `weight-balance/utils/calculations.js` (scénario ZFW) `\|\| null` | aucun | **MORTE** (∅ saisie + contrôle optionnel) |
| W6 | **MLW (Max Landing W.)** | `weights.mlw` (Step3, optionnel) | `WeightBalanceChart.jsx:62`, `Step6WeightBalance.jsx` (affichage/validation) | aucun | **DYN** (partiel, pas dans le store principal) |
| W7 | **Bras sièges avant** | `arms.frontSeats` | `weightBalanceStore.js:73-74` `\|\| 2.00` | **2,00 m** | **DYN+fantôme** |
| W8 | **Bras sièges arrière** | `arms.rearSeats` | `weightBalanceStore.js:75-76` `\|\| 2.90` | **2,90 m** | **DYN+fantôme** |
| W9 | **Bras bagages standard** | `arms.baggageFwd` / `armLengths.standardBaggageArm` | `weightBalanceStore.js:77` `\|\| 3.50` | **3,50 m** | **DYN+fantôme** |
| W10 | **Bras soute auxiliaire** | `arms.baggageAft` / `aftBaggageExtensionArm` | `weightBalanceStore.js:78` `\|\| 3.70` | **3,70 m** | **DYN+fantôme** |
| W11 | **Bras carburant** | `arms.fuelMain` / `armLengths.fuelArm` | `weightBalanceStore.js:79` `\|\| 2.18` | **2,18 m** | **DYN+fantôme** |
| W12 | **Compartiments bagages dynamiques** | `baggageCompartments[]{arm,maxWeight}` | `weightBalanceStore.js:176-183` `arm \|\| 3.50` | 3,50 m / 50 kg | **DYN** |
| W13 | **Densité carburant** | dérivée de `fuelType` | `weightBalanceStore.js:161-165` `FUEL_DENSITIES[...] \|\| 0.84` | **0,84** | **DYN+fantôme** ⚠️ voir A1 |
| W14 | **Limite CG avant** | `cgEnvelope.forwardPoints[]` (courbe) | `weightBalanceStore.js:102` **`forwardPoints[0].cg` seulement** | 2,00 m | **DYN partielle** ⚠️ A2 |
| W15 | **Courbe CG avant variable (par masse)** | `cgEnvelope.forwardPoints[1..n]` | stocké `wb.cgLimits.forwardVariable` (l.104) **jamais lu par le check** (l.237-239) | — | **MORTE** ⚠️ A2 |
| W16 | **Limite CG arrière (legacy)** | `cgEnvelope.aftCG` | `weightBalanceStore.js:103` `aftCG` | 2,45 m | **DYN+fantôme** |
| W17 | **Modèle CG arrière 2-points** | `cgEnvelope.aftMinCG` / `aftMaxCG` / `aftMinWeight` / `aftMaxWeight` (Step3:519-522) | **jamais lu** par `weightBalanceStore`/`contexts` (lisent `aftCG`) | — | **MORTE** ⚠️ A3 |
| W18 | **Limite max bagages** | `weights.maxBaggage*` / `aircraft.maxBaggageWeight` | `WeightBalanceModule.jsx:187` `\|\| 50` | **50 kg** | **DYN+fantôme** |
| W19 | **Limite max auxiliaire** | (optionnel) | `WeightBalanceModule.jsx:195` `\|\| 20` | **20 kg** | **DYN+fantôme** |
| W20 | **Poids passager standard** | *non saisi au wizard* | `FlightPlanData.js:82` `passengersWeight: 80` ; Step6 `/ 77` | **80 / 77 kg** | **HC** (norme OACI, mais divergente) |
| W21 | **Densité carburant (moteur parallèle)** | dérivée de `fuelType` | `FlightPlanData.js:236-237` `DENSITIES.JET_A1` | **0,80** ⚠️ | **DYN+fantôme divergent** ⚠️ A1 |
| W22 | **Masse atterrissage** | — | `FlightPlanData.js:250-251` (takeoff − climb+cruise×0,80) ; relu `PerformanceModule.jsx:428` | — | **DYN via moteur parallèle** ⚠️ A4 |
| W23 | **Contrôle CG (moteur parallèle)** | — | `FlightPlanData.js:254` ne teste **que** `≤ maxWeight`, **aucun CG** | — | **CG MORT dans ce moteur** ⚠️ A4 |

### Détail du calcul canonique (preuve)
`weightBalanceStore.js:190-239` — masse = `emptyWeight + Σ charges + carburant` ; moment = `Σ (charge × bras)` ; `cg = moment/poids`. Contrôle :
```js
// weightBalanceStore.js:237-239
const isWithinCG = cg >= wb.cgLimits.forward && cg <= wb.cgLimits.aft;
```
→ **rectangle constant** `[forward, aft]`. La variation de la limite avec la masse (la vraie enveloppe trapézoïdale) **n'est jamais évaluée** ici, bien que les points soient disponibles dans `forwardVariable`.

---

## 2. RAPPORT D'AUDIT DES FLUX — PERFORMANCES

| # | Variable | Provenance saisie (« Mes avions ») | Lecture consommateur (preuve) | Statut |
|---|---|---|---|---|
| P1 | **Distance décollage (roulement / 50 ft)** | `performanceModels[].data.graphs[]` (abaques Step4) | `operationResolver.js:127-157` lit `aircraft.performanceModels` → `abacInterpolation`/`cascade.ts` | **DYN** ✅ |
| P2 | **Distance atterrissage (roulement / 50 ft, volets up/landing)** | idem abaques Step4 | `operationResolver.js` + `operationCatalog` (4 opérations landing) | **DYN** ✅ |
| P3 | **Tables MANEX (fallback abaque absent)** | `advancedPerformance.tables[]` | `operationResolver.resolveOperationFromTables` → `performanceTrilinearInterpolation` | **DYN** ✅ |
| P4 | **Masse décollage (entrée perf)** | via store centrage | `PerformanceModule.jsx:420` `calculations.totalWeight \|\| emptyWeight \|\| 1000` | **DYN+fantôme** (1000) |
| P5 | **Masse atterrissage (entrée perf)** | via moteur parallèle | `PerformanceModule.jsx:428` `flightPlan.weightBalance.landingWeight \|\| ...` | **DYN via FlightPlanData** ⚠️ A4 |
| P6 | **OAT (température)** | API METAR AVWX | `PerformanceModule.jsx:431-433` `metar.temperature` sinon **15** | **DYN+fantôme ISA** ⚠️ A5 |
| P7 | **Altitude pression** | `waypoint.elevation` (SIA AIXM) | `PerformanceModule.jsx:436-437` `airport.elevation \|\| 0` | **DYN+fantôme** (0) |
| P8 | **Vent (composante piste)** | METAR + pistes VAC/SIA | `PerformanceModule.jsx:444-462` `useActiveRunwayWind` | **DYN** ✅ |
| P9 | **Consommation horaire (fuel flow)** | `fuelConsumption` (lph canonique) | `FuelModule.jsx:133`, `useNavigationResults.js:44`, `FlightPlanData.js:181`, `Step4Alternates.jsx:133` | **DYN+fantôme divergent** ⚠️ A6 |
| P10 | **Vitesse de croisière** | `cruiseSpeedKt` | `useNavigationResults.js:40`, `Step3Route.jsx:129`, `WindAnalysis.jsx:77` | **DYN+fantôme divergent** ⚠️ A6 |
| P11 | **baseFactor (60/Vc)** | calculé au wizard | **aucun consommateur** (0 hit dans flight-wizard/perf/nav) | **MORTE** |
| P12 | **V1 / Vr / V2 / Vref / Vapp** | `speeds.vr/vapp/...` (Step2) | **0 lecture** dans le moteur (`operationCatalog` sans opération vitesse) | **MORTE** ⚠️ A7 |
| P13 | **Vitesses Vso/Vs1/Vfe/Vno/Vne/Va (obligatoires)** | `speeds.*` (Step2) | non consommées par le moteur de calcul (affichage/limitation seulement) | **MORTE** (côté calcul) |
| P14 | **voRanges (manœuvre par masse)** | `speeds.voRanges[]` (Step2) | **0 consommateur** | **MORTE** |
| P15 | **K-factor / facteur de dégradation** | **non saisi** (∅ champ) | **jamais appliqué** (0 multiplication) | **MORTE/ABSENTE** ⚠️ A8 |
| P16 | **Facteur de sécurité (1,15 / 1,43 / 1,67)** | preset `performanceSafetyFactor.js` | `PerformanceStateMatrix.jsx:194` appliqué **à l'affichage uniquement** ; `operationResolver` retourne brut | **DYN affichage seul** ⚠️ A9 |
| P17 | **Pente de piste** | (état piste) | `PerformanceModule.jsx:475,485` `runwaySlope: 0` | **HC** ⚠️ A10 |
| P18 | **Corrections surface (herbe/contaminée)** | — | `performanceCharts.js:185` `grassFactor 1.15` etc. **jamais appelé** | **MORTE** ⚠️ A10 |
| P19 | **Distances perf legacy (`performance.takeoff/landing/cruise`)** | `performance.*` (mappées AircraftCreationWizard) | non lues par `operationResolver` (remplacées par abaques) | **MORTE** |
| P20 | **TAS croisière** | *non saisi* (seulement IAS `cruiseSpeedKt`) | `WindAnalysis.jsx:77` assimile `cruiseSpeedKt` à la TAS | **ABSENTE** (approximation) |

---

## 3. LISTE DES ANOMALIES & ÉLÉMENTS MORTS

### A1 — 🔴 CRITIQUE : densité carburant à DEUX valeurs divergentes
- Canonique : `constants.js:2` → `'JET A-1': 0.84`.
- Parallèle : `unitConversions.js:5-8` → `JET_A1: 0.80`, utilisé par `FlightPlanData.js:236-237`.
- **Conséquence** : pour Jet A-1, la masse carburant calculée par le moteur parallèle (et donc la **masse atterrissage** servie à la performance) est **sous-estimée de ~4,8 %**. Sur 200 L : 168 kg (store) vs 160 kg (FlightPlanData) → **8 kg d'écart fantôme**.

### A2 — 🔴 CRITIQUE : enveloppe CG avant aplatie à un seul point
- `weightBalanceStore.js:102` ne lit que `forwardPoints[0].cg` comme limite avant **constante**.
- La courbe complète est stockée dans `forwardVariable` (l.104) **mais jamais évaluée** par le contrôle `isWithinCG` (l.237-239).
- **Conséquence** : un avion dont la limite avant se resserre avec la masse passe/échoue le contrôle CG sur une limite **fausse** hors du point de référence n°0.

### A3 — 🔴 CRITIQUE : modèle CG arrière 2-points = donnée morte
- « Mes avions » écrit `aftMinCG` / `aftMaxCG` / `aftMinWeight` / `aftMaxWeight` (`Step3WeightBalance.jsx:519-522`) **et** un legacy `aftCG = maxCG || minCG` (l.526) « pour ne pas casser les consommateurs ».
- Les consommateurs opérationnels (`weightBalanceStore.js:103`, `contexts/index.jsx:201`, `aircraftNormalizer.js:114`, `Step6WeightBalance.jsx:92`) lisent **uniquement `aftCG`**.
- **Conséquence** : la limite arrière variable (qui change entre masse mini et maxi) est **collapsée en une constante** ; à basse masse, la limite arrière utilisée est fausse. Les graphes de « Mes avions » (`CgEnvelopeChart`, `CgEnvelopeDualChart`) honorent le modèle 2-points → **l'avion affiche une enveloppe que le calcul n'utilise pas**.

### A4 — 🔴 CRITIQUE : double moteur M&C, le moteur sans CG alimente la perf
- `FlightPlanData.calculateWeightBalance()` (l.230-258) : masse seulement, **aucun moment, aucun CG**, contrôle réduit à `takeoffWeight ≤ maxWeight` (l.254).
- C'est `FlightPlanData.weightBalance.landingWeight` qui est relu par `PerformanceModule.jsx:428` → la **masse atterrissage de la performance ne provient pas du module de centrage**.
- Le store canonique (avec CG) sert l'**affichage** Step6 + la masse **décollage** perf (l.420). → **deux vérités de masse** coexistent dans le même plan.

### A5 — 🟠 ISA déguisé : OAT par défaut 15 °C
- `PerformanceModule.jsx:431-433` : si METAR absent → **15 °C**. Couplé à `weatherAPI.getMockMETAR` qui **fabrique** un METAR 15 °C/calme/Q1013, la performance peut tourner sur une météo inventée sans signal visible.

### A6 — 🟠 Fuel flow & vitesse : valeurs fantômes divergentes
- `fuelConsumption` : fallback **30** (`FuelModule.jsx:152,273,303,326` ; `useNavigationResults.js:44`) **vs 40** (`Step4Alternates.jsx:133`) **vs 0** (`Step1GeneralInfo.jsx:58`).
- `cruiseSpeed` : fallback **100** (nav/wind/fuel) **vs 120** (`Step3Route.jsx:129`, TOD).
- **Conséquence** : un avion sans conso/vitesse renseignée produit des bilans carburant différents selon l'écran. La même donnée manquante prend 3 valeurs.

### A7 — 🟠 V-vitesses : saisies, jamais calculées
- `Step2Speeds` capture Vr, Vx, Vy, Vapp, Vglide, Vle, Vlo, voRanges + 6 vitesses obligatoires. **Aucune** n'est consommée par le moteur de performance/préparation (0 hit). Le pilote doit retourner à l'AFM.

### A8 — 🟠 K-factor : promesse non tenue
- Aucun champ de saisie, aucune multiplication de dégradation dans `operationResolver`/`abacInterpolation`/`cascade`. Le résultat sort **brut** de l'interpolation. Le « facteur de dégradation réelle » de la cartographie théorique **n'existe pas**.

### A9 — 🟠 Facteur de sécurité réglementaire : cosmétique
- `applySafetyFactor` (`performanceSafetyFactor.js:85-90`) n'est appelé que dans le rendu (`PerformanceStateMatrix.jsx:194`) et **uniquement sur les distances**. La valeur **persistée/réutilisée en aval reste brute** (× 1,0). Un export ou un calcul dérivé n'hérite pas de la marge affichée.

### A10 — 🟠 Piste toujours horizontale et sèche
- `runwaySlope: 0` en dur (`PerformanceModule.jsx:475,485`) ; corrections herbe/contaminée présentes en constantes dans `performanceCharts.js:185` mais ce fichier n'est appelé que par `PerformanceCalculator.jsx`, **composant orphelin non monté**.

### A11 — 🟡 Code mort (à supprimer)
- `features/performance/components/PerformanceCalculator.jsx` (~660 l.) — **importé nulle part**.
- `features/aircraft/utils/performanceCharts.js` (`interpolatePerformance`, `applyEnvironmentalCorrections`) — seul consommateur = le composant orphelin ci-dessus.
- `performance.takeoff/landing/cruise.*` (mapping legacy AircraftCreationWizard) — remplacé par les abaques, plus lu par le moteur.

### A12 — 🟡 Hygiène : logs de debug dans le chemin de calcul
- `weightBalanceStore.js:62-67, 124-127, 217-230` — `console.log` du calcul CG/moment en production.

### A13 — 🟡 MZFW jamais saisi, MLW hors store principal
- Aucun champ MZFW au wizard (W5) ; le contrôle ZFW est donc inopérant par défaut. MLW (W6) n'entre pas dans le contrôle du store canonique.

---

## 4. PLAN DE TEST DE VALIDATION (empirique)

Principe : **injecter dans « Mes avions » des valeurs absurdes mais identifiables**, puis observer si « Je prépare mon vol » réagit (→ dynamique) ou reste figé (→ fantôme/mort). Charge de référence fixe pour tous les tests : 2 PAX avant 80 kg + 100 L carburant.

| Test | Variable visée | Injection dans « Mes avions » | Attendu si DYNAMIQUE | Verdict si FIGÉ |
|---|---|---|---|---|
| **T1** | W1 BEW | `emptyWeight` 750 → **1500** kg | Masse totale +750 kg, MTOW dépassé | Lit un fantôme/cache (600 ?) |
| **T2** | W2 bras BEW | `arms.empty` 2,10 → **0,50** m | CG plonge vers l'avant | Fallback 2,00 actif → bras non lu |
| **T3** | W3 MTOW | `weights.mtow` → **99999** | « Dans les limites » même surchargé | Fallback 1150 si vidé |
| **T4** | W8 bras sièges AR | `arms.rearSeats` 2,90 → **5,00** m + charge AR 80 kg | CG recule nettement | Aucun déplacement → 2,90 en dur |
| **T5** | W13/W21/A1 densité | `fuelType` = JET A-1, 100 L | Poids carb. affiché = **84 kg** (store) | Plan sauvé/masse ldg = **80 kg** → double densité prouvée |
| **T6** | W17/A3 CG arrière 2-pts | `aftMinCG`=2,30 ; `aftMaxCG`=2,60 (divergents) ; charger à masse mini | Limite AR ≈ 2,30 à basse masse | Limite AR reste 2,60 (=`aftCG`) → modèle 2-pts mort |
| **T7** | W14-W15/A2 CG avant variable | `forwardPoints`=[{600;2,05},{1000;1,95}] ; charger à 1000 kg | Limite AV ≈ 1,95 | Limite AV reste 2,05 (point[0]) → courbe morte |
| **T8** | P12/A7 V-vitesses | `vr`=**999**, `vref`=**999** | Apparaît dans la prépa/perf | Invisible partout → mortes |
| **T9** | P15/A8 K-factor | (aucun champ) — documenter l'absence | Distance × K | Distance inchangée → K inexistant |
| **T10** | P9/A6 fuel flow | `fuelConsumption` = **50** lph puis **vidé** | Bilan carburant ×; à vide → 30 partout | À vide : réserve 30 mais déroutement 40 → fantômes divergents |
| **T11** | P5/A4 masse atterrissage | Comparer `landingWeight` du plan à (takeoff − conso×densité) | = store de centrage | = takeoff − climb+cruise×**0,80** → moteur parallèle prouvé |
| **T12** | P17-P18/A10 piste | Sélectionner piste **en herbe / pentue** | Distances ↑ | Distances identiques → slope=0 + surface morte |
| **T13** | P6/A5 ISA | Couper la météo (pas de METAR) | Calcul bloqué ou signalé « ISA » | Tourne en silence à 15 °C → ISA déguisé |
| **T14** | W5/A13 MZFW | Charger pour dépasser un MZFW théorique | Alerte ZFW | Aucune alerte → contrôle inopérant |

**Protocole pour chaque test :** (1) éditer l'avion dans « Mes avions », sauver ; (2) recharger l'app (le chargement se fait depuis IndexedDB, cf. `contexts/index.jsx:253`) ; (3) sélectionner l'avion dans « Je prépare mon vol » ; (4) appliquer la charge de référence ; (5) relever masse totale, CG, statut limites, distances, bilan carburant ; (6) comparer à l'attendu. **Vérifier la console** : `weightBalanceStore` logue `emptyWeight`, bras et `cgLimits` finaux — preuve directe de la source réellement lue.

---

## 5. RECOMMANDATIONS DE REMÉDIATION (par priorité)

1. **Unifier la densité** : supprimer `DENSITIES` de `unitConversions.js`, router tout vers `FUEL_DENSITIES` (`constants.js`). (A1)
2. **Brancher l'enveloppe réelle** : remplacer le contrôle rectangle de `weightBalanceStore.js:237-239` par une interpolation `cg_limit(masse)` à partir de `forwardPoints[]` + (`aftMinCG`,`aftMinWeight`)/(`aftMaxCG`,`aftMaxWeight`). (A2, A3)
3. **Tuer le moteur parallèle** : supprimer `FlightPlanData.calculateWeightBalance` ; faire dériver masse décollage **et** atterrissage du store canonique. (A4)
4. **Aligner les fallbacks** ou, mieux, **refuser le calcul** quand conso/vitesse/masse manquent plutôt qu'inventer 30/40/100/120/1000. (A6, fantômes)
5. **Décider du sort des V-vitesses / K-factor** : soit les brancher (limitation, marges), soit retirer leur saisie pour ne pas suggérer une fonction inexistante. (A7, A8)
6. **Propager le facteur de sécurité** au-delà de l'affichage si l'usage CAT/IFR l'exige. (A9)
7. **Implémenter pente/surface** ou retirer les constantes mortes. (A10)
8. **Supprimer le code mort** `PerformanceCalculator.jsx` + `performanceCharts.js`. (A11)

---

*Fin du rapport. Preuves vérifiées par lecture directe : `weightBalanceStore.js`, `FlightPlanData.js`, `unitConversions.js`, `constants.js`, `PerformanceModule.jsx`, `contexts/index.jsx`, `Step3WeightBalance.jsx`, + recensement d'usage (grep) sur `flight-wizard`/`performance`/`fuel`/`navigation`.*
