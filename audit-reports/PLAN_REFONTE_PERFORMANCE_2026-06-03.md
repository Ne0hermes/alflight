# PLAN D'ATTAQUE — Refonte du moteur de performance
**Date :** 2026-06-03 · **Statut : PRÉPARATION (rien n'est implémenté).**
Objectif : un système de performance qui (1) extrait correctement les tableaux/abaques des avions, (2) calcule via une **chaîne unique et fiable**, (3) ne contient **aucune donnée inventée ni ISA**, (4) est **prouvé** par des tests.

---

## A. RÉPONSES À TES QUESTIONS

### A.1 — Source unique de l'altitude aérodrome ✅ (confirmée)
Chaîne : **AIXM SIA** (`<valElev>`) → [`scripts/sia_etl.ts:217`](alflight/scripts/sia_etl.ts) → `aerodromes.geojson` → `aeroDataProvider` → `navigationStore` → **`waypoint.elevation`**.
- **Unité : pieds (ft).** Élévation **géométrique** du terrain (MSL), pas une altitude pression.
- **Pas de source concurrente.** Le VAC extrait aussi une élévation + un QNH ([`vacPdfExtractor.js:137`](alflight/src/services/vacPdfExtractor.js)) mais ne corrige pas le waypoint.
- ⚠️ Fiable à ~99 %, mais le fallback `|| 0` (élévation absente → niveau mer) est **dangereux**.

➡️ **Décision retenue :** on utilise **`waypoint.elevation` directement** comme altitude d'entrée des abaques/tableaux (pas de recalcul). On supprime le fallback `|| 0` (→ statut « altitude indisponible »).
> Note technique (non bloquante) : élévation terrain ≠ altitude pression. La correction QNH (`PA = elev + (1013,25 − QNH) × 27 ft`) est **optionnelle** (QNH dispo via METAR/VAC). À trancher en Lot 4, item optionnel.

### A.2 — Source unique masse / carburant ✅ (confirmée, mais fragmentée)
- **Volumes** : [`fuelStore.js`](alflight/src/core/stores/fuelStore.js) → `fuelData.{trip,roulage,...}.ltr` + `fobFuel.ltr`.
- **Masse avion** : [`weightBalanceStore.calculateWeightBalance(aircraft, fobFuel)`](alflight/src/core/stores/weightBalanceStore.js) → `{ totalWeight (décollage), cg, isWithinLimits }`. Utilise la densité pour ltr→kg.
- **Densité canonique** : [`constants.js`](alflight/src/utils/constants.js) → `{ 'JET A-1': 0.84, 'AVGAS 100LL': 0.72, 'MOGAS': 0.72 }`. ✅ **0,84 pour Jet A-1 = la bonne valeur à déployer partout.**
- ❌ **Masse à l'atterrissage** : pas exposée par le store ; recalculée ailleurs (FlightPlanData + PerformanceModule).
- ❌ **5 recalculs de densité en dur** à éliminer :
  | Fichier | Ligne | Problème |
  |---|---|---|
  | [`FuelModule.jsx`](alflight/src/features/fuel/FuelModule.jsx) | 445-447 | densité **`0.8` en dur** (faux pour AVGAS 0,72) |
  | [`PerformanceModule.jsx`](alflight/src/features/performance/PerformanceModule.jsx) | 425-428 | recalcule la masse atterrissage au lieu de la lire du store |
  | [`contexts/index.jsx`](alflight/src/core/contexts/index.jsx) | 438 | ternaire `JET?0.84:0.72` |
  | [`Step6WeightBalance.jsx`](alflight/src/features/flight-wizard/steps/Step6WeightBalance.jsx) | ~200/250 | double déclaration `DENSITIES` |
  | [`FlightPlanData.js`](alflight/src/features/flight-wizard/models/FlightPlanData.js) | 236-250 | recalcul masse + landingWeight hors stores |

➡️ **Décision retenue :** la **masse de performance (départ ET arrivée) provient exclusivement du `weightBalanceStore`**, qui devient la seule autorité ; toute densité vient de `constants.js`. PerformanceModule ne recalcule plus rien.

### A.3 — Les opérations « calculables » : correction du « 5 sur 10 »
Le catalogue ([operationCatalog.ts](alflight/src/abac/curves/core/operationCatalog.ts)) contient **10 opérations**. Le résolveur ne fournit JAMAIS que `{ mass, oat, pressureAltitude(=élévation), wind, runwaySlope=0 }`. Bilan exact :

| # | Opération | Sortie | Entrées requises | État réel |
|---|---|---|---|---|
| 1 | `takeoff_ground_roll` | distance | masse, PA, temp, vent | ✅ calculable |
| 2 | `takeoff_50ft` | distance | masse, PA, temp, vent | ✅ calculable |
| 3 | `landing_50ft_flaps_landing` | distance | masse, PA, temp, vent | ✅ calculable |
| 4 | `landing_ground_roll_flaps_landing` | distance | masse, PA, temp, vent | ✅ calculable |
| 5 | `landing_50ft_flaps_up` | distance | masse, PA, temp, vent | ✅ calculable |
| 6 | `landing_ground_roll_flaps_up` | distance | masse, PA, temp, vent | ✅ calculable |
| 7 | `climb_takeoff` | taux/gradient | PA, temp, masse | ⚠️ **mauvaise entrée** : reçoit l'altitude/vent **du décollage** (OK pour montée initiale) — acceptable |
| 8 | `climb_cruise` | taux/gradient | **alt. croisière**, temp, masse | ⚠️ **mauvaise entrée** : reçoit l'élévation **terrain de départ** au lieu de l'altitude de croisière |
| 9 | `go_around_climb` | taux/gradient | PA(arrivée), temp, masse | ⚠️ **mauvaise entrée** : la matrice montée réutilise les inputs **décollage**, pas l'arrivée |
| 10 | `cruise_speed` | TAS | **régime/puissance**, alt, temp | ❌ **impossible** : aucune entrée RPM/MP/%puissance n'est jamais fournie |

**Conclusion corrigée :**
- **6 opérations de distance** (les plus importantes) sont **pleinement calculables**.
- **1 impossible** : `cruise_speed` (manque l'entrée puissance/régime).
- **3 à entrées incorrectes** : `climb_cruise`, `go_around_climb` (et partiellement `climb_takeoff`) reçoivent les inputs du décollage (élévation terrain départ + vent départ) au lieu de l'altitude/contexte propre à la phase.
> Vérifié : [`PerformanceModule.jsx:497-505`](alflight/src/features/performance/PerformanceModule.jsx) — `renderClimbCruiseMatrix()` passe `takeoffInputsForMatrix`. Aucune entrée régime/vitesse dans toute la feature `performance` (grep négatif hors code mort).

---

## A.4 — VÉRIFICATION EXHAUSTIVE DE LA PROVENANCE DES 4 ENTRÉES

Trace complète de chaque entrée du calcul, depuis la source jusqu'à `PerformanceModule.jsx`, avec les incohérences trouvées.

### 🌡️ Température — vient bien du module météo (API) ✅ mais ⚠️
**Chaîne :** API **AVWX** (`avwx.rest`) → [`weatherAPI.fetchMETAR`](alflight/src/services/weatherAPI.js) `decoded.temperature = data.temperature?.value ?? null` (l.91, °C) → [`weatherStore.weatherData[icao].metar`](alflight/src/core/stores/weatherStore.js) (l.36-42) → `departureWeather.metar.decoded.temperature` ([PerformanceModule.jsx:183](alflight/src/features/performance/PerformanceModule.jsx)).
- ✅ Conforme à ta description : météo, extraite par API, en °C.
- 🔴 **INCOHÉRENCE CRITIQUE — météo FABRIQUÉE.** Si l'API échoue (404/400/réseau/réponse vide), `weatherAPI` retourne **`getMockMETAR()`** = un **METAR inventé** ([weatherAPI.js:27-45, 97, 103, 156-216](alflight/src/services/weatherAPI.js)) : températures/vents **codés en dur** (ex. LFPN 18 °C/270°/15 kt ; défaut **15 °C / calme / Q1013**). Cette fausse donnée a un `decoded.temperature` rempli → PerformanceModule l'affiche « ✅ METAR trouvé » et **calcule dessus**. La règle « jamais ISA / jamais inventé » est donc violée **à la racine météo**, pas seulement dans PerformanceModule.
- 🔴 Clé API AVWX **en dur** ([weatherAPI.js:10](alflight/src/services/weatherAPI.js)) en fallback si pas de `.env` (recoupe l'audit sécurité).

### 🏔️ Altitude terrain — vient de la NAVIGATION/SIA, PAS de la météo ❗
**Chaîne :** **AIXM SIA** `<valElev>` → [`sia_etl.ts:217`](alflight/scripts/sia_etl.ts) → `aerodromes.geojson` → `aeroDataProvider` → `navigationStore` → `waypoint.elevation` (ft) → `departureAirport.elevation || 0` ([PerformanceModule.jsx:436](alflight/src/features/performance/PerformanceModule.jsx)).
- 🔴 **INCOHÉRENCE avec ton hypothèse** : l'altitude **ne vient pas du module météo**. Elle vient du **module navigation / base officielle SIA** — ce qui est en réalité la **bonne** source. À corriger dans le modèle mental : **météo = QNH + température + vent** ; **navigation/SIA = élévation terrain**.
- ✅ Bonne nouvelle : le METAR AVWX ne renvoie **pas** d'élévation terrain (seulement le QNH/pression, [weatherAPI.js:54-73](alflight/src/services/weatherAPI.js)). Donc **pas de seconde source d'élévation** qui divergerait.
- 🔴 `|| 0` → **À remplacer par une ALERTE** (élévation absente → bloquer le calcul + avertir, jamais « niveau mer » par défaut). [Ta consigne.]

### 🌬️ Direction du vent — vient bien du module météo ✅ mais ⚠️
**Chaîne :** AVWX `decoded.wind = { direction (deg), speed (kt), gust }` ([weatherAPI.js:81-85](alflight/src/services/weatherAPI.js)) → weatherStore → [`useActiveRunwayWind(icao, weather)`](alflight/src/shared/hooks/useActiveRunwayWind.js) qui projette le vent sur la **meilleure piste** (pistes depuis **VAC store** prioritaire, sinon **aeroDataProvider/SIA**).
- ✅ Conforme : vent = météo ; projection piste = VAC/SIA.
- 🔴 **INCOHÉRENCE — vent « Variable »/« Calme » traité comme favorable.** Si la direction n'est pas numérique (string 'Calme'/'Variable', [weatherAPI.js:82](alflight/src/services/weatherAPI.js)), `useActiveRunwayWind` renvoie `wind=null` (exige des nombres, [hook l.38](alflight/src/shared/hooks/useActiveRunwayWind.js)) → pas de composante signée → PerformanceModule retombe sur `takeoffWindRaw` = **vitesse brute supposée VENT DE FACE** ([PerformanceModule.jsx:457-459](alflight/src/features/performance/PerformanceModule.jsx)). Un vent réellement variable/arrière non détecté est compté **favorable** → distances **sous-estimées** (dangereux).

### ⚖️ Masse décollage/atterrissage — décollage OK, atterrissage NON ❗
**Décollage :** `calculations.totalWeight` ← [`weightBalanceStore.calculateWeightBalance(aircraft, fobFuel)`](alflight/src/core/stores/weightBalanceStore.js) (retourne `{ totalWeight }`, l.241-248). ✅ **Vient bien du module centrage.**
- 🔴 **INCOHÉRENCE majeure — l'atterrissage NE vient PAS du centrage.** Le `weightBalanceStore` **ne calcule pas** de `landingWeight`. PerformanceModule prend `flightPlan.weightBalance.landingWeight || (takeoffMass − carburant×densité)` ([PerformanceModule.jsx:425-428](alflight/src/features/performance/PerformanceModule.jsx)). Or `landingWeight` est produit par **[`FlightPlanData.calculateWeightBalance`](alflight/src/features/flight-wizard/models/FlightPlanData.js) (l.250-251)** — une **classe séparée**, hors store centrage, avec sa **propre** densité.
- 🔴 **INCOHÉRENCE — DEUX modèles de centrage divergents** : `weightBalanceStore` (Zustand, basé sièges/bagages/fuelArm) **vs** `FlightPlanData.calculateWeightBalance` (classe, basé `passengers × passengersWeight`). Lequel fait foi pour la masse de perf ?
- 🔴 **INCOHÉRENCE — 3 densités « carburant inconnu » par défaut** pour le **même** avion :
  | Lieu | Défaut si fuelType inconnu | Réf |
  |---|---|---|
  | `weightBalanceStore` (décollage) | **Jet A-1 0,84** | [l.162-165](alflight/src/core/stores/weightBalanceStore.js) |
  | `PerformanceModule` (atterrissage) | **AVGAS 0,72** | [l.426](alflight/src/features/performance/PerformanceModule.jsx) |
  | `FlightPlanData` | `isJet?0,84:0,72` | [l.237](alflight/src/features/flight-wizard/models/FlightPlanData.js) |
  → masse décollage et atterrissage peuvent utiliser **des densités différentes**.
- 🟠 Fallbacks inventés : takeoffMass → `emptyWeight || 1000` ; store → `emptyWeight 600 / mtow 1150` ([l.39-46](alflight/src/core/stores/weightBalanceStore.js)) → masse fabriquée si W&B non fait.

### Synthèse provenance
| Entrée | Source réelle | Conforme à ton hypothèse ? | Incohérence |
|---|---|---|---|
| Température | météo AVWX (API) | ✅ oui | 🔴 mock météo inventée si API KO |
| Altitude terrain | **navigation/SIA** | ❌ non (tu pensais météo) | 🔴 c'est SIA (correct) ; `||0` à alerter |
| Vent | météo AVWX + pistes VAC/SIA | ✅ oui | 🔴 « Variable »→ supposé face |
| Masse décollage | **centrage** (weightBalanceStore) | ✅ oui | 🟠 fallbacks inventés |
| Masse atterrissage | **FlightPlanData** (hors centrage) | ❌ non | 🔴 pas le centrage + densité divergente |

### 🟥 LOT 1bis — Provenance & météo inventée (NOUVEAU, critique)
- [ ] **1bis.1 — Bannir la météo fabriquée.** Supprimer `getMockMETAR` du chemin de production ([weatherAPI.js](alflight/src/services/weatherAPI.js)) : API KO → erreur explicite « météo indisponible », **jamais** un METAR inventé. *Résultat :* aucune perf calculée sur une fausse météo.
- [ ] **1bis.2 — Alerte altitude manquante.** `elevation || 0` → si absente, **alerte + blocage** (cf. 1.2). *Résultat :* jamais d'aérodrome au niveau mer par défaut.
- [ ] **1bis.3 — Vent indéterminé.** Si direction non numérique (Calme/Variable) ou pas de piste : ne **pas** supposer vent de face ; traiter vent = 0 (conservateur) + warning. *Résultat :* plus de sous-estimation par vent supposé favorable.
- [ ] **1bis.4 — Masse atterrissage depuis le centrage.** `weightBalanceStore` doit exposer `landingWeight` (= décollage − carburant consommé, densité `constants.js`) ; PerformanceModule le consomme. Supprimer le calcul de masse de `FlightPlanData` (une seule autorité = le centrage). *Résultat :* masses décollage ET atterrissage issues du même module, même densité.
- [ ] **1bis.5 — Densité par défaut unique.** Aligner le fallback « fuelType inconnu » (une seule valeur, ex. exiger le type plutôt que deviner). *Résultat :* plus de divergence 0,84 vs 0,72 sur le même avion.

---

## B. ARCHITECTURE CIBLE & MODÈLES MATHÉMATIQUES

### B.1 — Chaîne de calcul cible (une seule, sans données inventées)
```
ENTRÉES (sources uniques)
  • altitude      ← waypoint.elevation (ft, SIA)            [jamais 0 ; absent → bloqué]
  • température   ← METAR decoded.temperature (°C)          [jamais ISA ; absent → bloqué]
  • masse dep/arr ← weightBalanceStore (kg)                 [densité = constants.js]
  • vent          ← composante signée piste active (kt)
        │
        ▼
operationResolver.resolveOperation(aircraft, opId, inputs)
        │  (1 source par opId : abaque OU tableau)
        ├── ABAQUE  → evaluateAbacCascade()  → Bracket 2D / Slope-follow  (PAS d'IDW)
        └── TABLEAU → resolveOperationFromTables() → Trilinéaire (masse×alt×temp)
        │
        ▼
OperationResult { value, unit, status, warnings[], cascadeSteps[] }
        │  + facteur de sécurité réglementaire (affichage uniquement)
        ▼
flightPlan.performance.{departure,arrival}
```

### B.2 — Modèle mathématique : ABAQUES (Flux A) — *lecture pilote*
Un « set » = graphes **intermédiaires** (triés par `cascadeOrder`) + 1 **primaire**. Sortie d'un graphe = X du suivant.

**Méthode 1 — Bracket 2D (la bonne, à généraliser)** [`abacInterpolation.js:370-564`](alflight/src/services/abacInterpolation.js)
1. Identifier l'axe X et la **dimension familiale** (altitude/masse/temp via `familyAxisVariable` + `familyValue`, ou nom de courbe).
2. Trier les courbes par valeur familiale ; trouver la **paire encadrante** de la cible.
3. Interpolation **linéaire 1D** sur chaque courbe à `X = queryX` → `Y_bas`, `Y_haut`.
4. Interpoler : `Y = Y_bas + t·(Y_haut − Y_bas)`, `t = (queryFamily − fam_bas)/(fam_haut − fam_bas)`.
5. Filtrage **direction du vent** (headwind/tailwind) avant bracket.

**Méthode 2 — Slope-follow** [`abacInterpolation.js:585-761`](alflight/src/services/abacInterpolation.js) : pour graphes intermédiaires sans valeur familiale ; `entryY` = sortie du graphe précédent, bracket sur les `entry_y` (bord gauche), conserve le ratio, évalue à `X_cible`.

**Méthode 3 — IDW 4D** [`abacInterpolation.js:158-200`](alflight/src/services/abacInterpolation.js) : ⚠️ **à retirer du chemin nominal** (normalisations magiques 30/2000/100/10, mélange les familles). Garder éventuellement comme diagnostic only, jamais comme résultat affiché.

**Bornes cibles** : extrapolation famille **bornée** + warning ; clamp axe X **avec** warning (aujourd'hui silencieux, [l.341-342](alflight/src/services/abacInterpolation.js)).

### B.3 — Modèle mathématique : TABLEAUX (Flux B) — *trilinéaire*
[`performanceTrilinearInterpolation.js`](alflight/src/services/performanceTrilinearInterpolation.js) — grille `masses × altitudes × températures → value`.
1. `findBracketingIndices` par dimension.
2. Interpolation linéaire successive : **température → altitude → masse** (8 coins → 4 → 2 → 1).
3. Hors plage : **masse** extrapolée linéairement (warning) ; **alt/temp** clampées (warning).
✅ Modèle correct. À garder. Vérifier la gestion des cellules `null` ([l.154-160](alflight/src/services/performanceTrilinearInterpolation.js)) pour qu'une valeur manquante **ne devienne jamais 0** (utiliser le voisin, sinon statut « trou de couverture »).

### B.4 — Entrées unifiées (une source par grandeur)
| Grandeur | Source unique cible | Règle |
|---|---|---|
| Altitude | `waypoint.elevation` (ft) | jamais 0 ; absent → MISSING_INPUT |
| Température | METAR `decoded.temperature` | jamais ISA ; absent → MISSING_INPUT |
| Masse dep/arr | `weightBalanceStore` | densité = `constants.js` |
| Densité carburant | `FUEL_DENSITIES` (constants.js) | Jet A-1 = 0,84 partout |
| Vent | composante signée piste active | + filtre headwind/tailwind |
| Régime/puissance (croisière) | **à décider** : saisie pilote ou retrait de `cruise_speed` | — |

---

## C. TODO PRIORISÉE (checklist)

> Convention : `[ ]` à faire · chaque item = **Action** + **Fichiers** + **Résultat attendu**.

> ### ⛔ P0 — PRINCIPE DIRECTEUR : ZÉRO FALLBACK SILENCIEUX (gouverne TOUS les lots)
> Dès qu'un paramètre nécessaire au calcul manque (température, altitude terrain, masse, vent, ou une donnée d'abaque/tableau), le système **n'invente JAMAIS** de valeur et **ne calcule pas « quand même »**. Il affiche une **alarme explicite nommant le paramètre manquant** (« ⚠ Température METAR manquante », « ⚠ Altitude terrain indisponible », « ⚠ Masse non renseignée », « ⚠ Vent indéterminé »…) **OU** indique clairement que **le calcul est impossible** pour cette opération.
> **Interdits absolus comme valeur de calcul :** ISA 15 °C, `elevation || 0`, masse `|| 1000`/600/1150, vent supposé de face, METAR mock (`getMockMETAR`), densité devinée.
> *Résultat attendu :* tout chiffre affiché est soit issu d'entrées réelles, soit remplacé par une alarme / `MISSING_INPUT` / « calcul impossible ». Vérifié par les tests du Lot 6.

### 🟥 LOT 1 — Sources uniques & suppression de l'ISA/des défauts (sécurité calcul)
- [ ] **1.1 — Bannir l'ISA.** Supprimer le fallback `: 15` ([PerformanceModule.jsx:431-433](alflight/src/features/performance/PerformanceModule.jsx)) et les défauts de [`inputsToConditions`](alflight/src/services/abacInterpolation.js) (`?? 15`, `?? 0`, `?? 1000`, `?? 0`). Propager `null` → statut `MISSING_INPUT`.
  *Résultat attendu :* sans METAR, aucune distance n'est calculée ; la matrice affiche « température indisponible », jamais un chiffre basé sur 15 °C.
- [ ] **1.2 — Altitude fiable.** Remplacer `elevation || 0` ([PerformanceModule.jsx:436-437](alflight/src/features/performance/PerformanceModule.jsx)) par une vérification : élévation absente → `MISSING_INPUT`.
  *Résultat attendu :* plus jamais d'aérodrome traité au niveau mer par défaut.
- [ ] **1.3 — Masse depuis le store.** Supprimer le recalcul masse atterrissage ([PerformanceModule.jsx:425-428](alflight/src/features/performance/PerformanceModule.jsx)) ; faire exposer `landingWeight` par [`weightBalanceStore`](alflight/src/core/stores/weightBalanceStore.js) (= `totalWeight − masse carburant consommé`, densité `constants.js`). PerformanceModule consomme `calculations.totalWeight` et `calculations.landingWeight`.
  *Résultat attendu :* masse perf = masse W&B, toujours cohérente, une seule formule.
- [ ] **1.4 — Densité unique 0,84/0,72.** Remplacer tous les recalculs en dur par `FUEL_DENSITIES[aircraft.fuelType]` : [FuelModule.jsx:445-447](alflight/src/features/fuel/FuelModule.jsx) (`0.8`), [contexts/index.jsx:438](alflight/src/core/contexts/index.jsx), [Step6WeightBalance.jsx](alflight/src/features/flight-wizard/steps/Step6WeightBalance.jsx), [FlightPlanData.js:236-250](alflight/src/features/flight-wizard/models/FlightPlanData.js). Normaliser les clés `fuelType` (une seule nomenclature).
  *Résultat attendu :* Jet A-1 = 0,84 partout ; aucune divergence d'affichage/calcul.

### 🟥 LOT 2 — Suppression du code mort & des données inventées
- [ ] **2.1 — Supprimer le moteur legacy.** Retirer [PerformanceCalculator.jsx](alflight/src/features/performance/components/PerformanceCalculator.jsx) (jamais monté) et [performanceCharts.js](alflight/src/features/aircraft/utils/performanceCharts.js) (`||0`→0 m, `Math.pow(ratio,0.5)`, `generateDefaultChart` fabrique des perfs, extraction regex chaotique). Vérifier qu'aucun import résiduel (hors `ManexViewer` qui lit `manex.performanceCharts` pour l'affichage — à statuer).
  *Résultat attendu :* une seule famille de fonctions de calcul dans `src/services/`.
- [ ] **2.2 — Purger `cascade.ts`.** Retirer la sortie forcée `870` ([cascade.ts:572-577](alflight/src/abac/curves/core/cascade.ts)) et le facteur `1.914` ([l.584](alflight/src/abac/curves/core/cascade.ts)) ; réparer les fragments syntaxiques cassés (l.556-609) ou supprimer le fichier s'il n'est utilisé que par un builder lui-même mort.
  *Résultat attendu :* aucune valeur MANEX spécifique codée en dur dans un moteur.
- [ ] **2.3 — `findBounds3D`.** Supprimer le placeholder `v:[[[0]]]` ([abacValidationService.js:357-368](alflight/src/features/performance/services/abacValidationService.js)) ; soit l'implémenter, soit retirer la branche trilinéaire/`interpolateABAC` si sans appelant.
  *Résultat attendu :* aucune interpolation ne peut retourner 0 par construction.
- [ ] **2.4 — Bannir l'IDW du résultat affiché.** Dans [`evaluateAbacCascade`](alflight/src/services/abacInterpolation.js:859-872), ne plus retomber sur IDW comme valeur finale ; si bracket/slope-follow échoue → `ERROR` explicite (l'IDW reste éventuellement en debug).
  *Résultat attendu :* tout résultat affiché provient d'une lecture pilote traçable.

### 🟧 LOT 3 — Chaîne de calcul : bornes & cohérence
- [ ] **3.1 — Politique de bornes unifiée.** Borner l'extrapolation famille des abaques ([abacInterpolation.js:500-536](alflight/src/services/abacInterpolation.js)) et **émettre un warning sur le clamp de l'axe X** ([l.341-342](alflight/src/services/abacInterpolation.js)). Aligner avec la politique des tableaux (extrapolation masse + clamp alt/temp, déjà *warned*).
  *Résultat attendu :* hors plage = toujours signalé, jamais d'extrapolation illimitée silencieuse.
- [ ] **3.2 — Trous de couverture tableau.** Garantir qu'une cellule `null` ne produit jamais 0 ([performanceTrilinearInterpolation.js:154-160](alflight/src/services/performanceTrilinearInterpolation.js)) → statut « couverture incomplète ».
- [ ] **3.3 — Unité de sortie.** Stocker et propager l'`outputUnit` de façon explicite ; documenter le canonique (distance = m). Bloquer/normaliser si un abaque est en ft et comparé à une longueur de piste en m.

### 🟦 LOT 4 — Montée / croisière / vitesse : FEATURE EN COURS DE DÉVELOPPEMENT (à venir)
**Décision :** `climb_takeoff`, `climb_cruise`, `go_around_climb` et `cruise_speed` sont **pris en compte** (présents au catalogue, architecture prête) **MAIS NON utilisés pour les calculs** de préparation de vol pour l'instant. Ce sont des **fonctionnalités à venir**, pas des bugs.
- [ ] **4.1 — Badge « en cours de développement ».** Afficher ces 4 opérations dans la matrice avec un statut explicite **« 🚧 Fonctionnalité en cours de développement — non utilisée pour le calcul »**, sans produire de valeur, et sans `NOT_IMPLEMENTED`/`ERROR` trompeur.
  *Résultat attendu :* le pilote voit que c'est prévu mais inactif ; aucune valeur potentiellement fausse n'est affichée pour ces 4 opérations.
- [ ] **4.2 — (plus tard) Activer le calcul.** Quand la feature sera développée : fournir les bonnes entrées par phase — altitude de **croisière** pour `climb_cruise`, altitude **d'arrivée** pour `go_around_climb`, **régime/% puissance + alt + temp** pour `cruise_speed` — puis retirer le badge WIP. Aujourd'hui : **différé**.
- [ ] **4.3 (optionnel) — QNH→altitude pression.** Si l'on veut la rigueur MANEX : corriger l'élévation via QNH METAR/VAC. **Par défaut : non retenu** (cf. A.1).
- [ ] **4.4 — Doc catalogue.** Corriger « 9 → 10 » et la phase `descent` orpheline ([operationCatalog.ts](alflight/src/abac/curves/core/operationCatalog.ts)).

### 🟨 LOT 5 — Unités (cohérence transverse)
- [ ] **5.1 — Une seule table de densités** (supprimer les copies de `unitConversions.js`/`mbUnits.js`, réexporter `constants.js`).
- [ ] **5.2 — Consolider les 4 systèmes d'unités** (`unitsDisplay`, `mbUnits`, `aircraftNormalizer`, `useUnits`) en une référence canonique.
- [ ] **5.3 — Unité stockée à côté des valeurs de perf** (ou canonique strict + conversion à la lecture).

### 🟩 LOT 6 — Tests & certitude (le « tout fonctionne »)
- [ ] **6.1 — Tests unitaires moteur** : `interpolate1D`, `bracketInterpolateGraph`, `slopeFollowInterpolateGraph`, `trilinearInterpolate` avec valeurs « golden » connues + cas limites (1 courbe, hors plage, cellule nulle).
- [ ] **6.2 — Cas MANEX de référence** : digitaliser 1 abaque + 1 tableau d'un avion réel (ex. DA40 NG) avec des points publiés connus → vérifier `|prédit − publié| ≤ tol` (réutiliser tol `abs 20 m / 5 %` de [abacValidationService.js:6-9](alflight/src/features/performance/services/abacValidationService.js)).
- [ ] **6.3 — Tests de propriété** : distance croissante avec PA/temp/masse ; jamais `NaN`/`0`/négatif ; extrapolation toujours bornée + warning.
- [ ] **6.4 — Auto-test de couverture** : par avion, chaque opération du catalogue → `COMPUTED` ou statut clair (jamais d'échec silencieux).
- [ ] **6.5 — Régression** : snapshot de la matrice complète d'un avion de référence (toutes phases) pour figer la non-régression.

---

## D. ORDRE D'EXÉCUTION RECOMMANDÉ
1. **Lot 6.1/6.2 d'abord (filet)** : poser les tests golden AVANT de toucher au moteur → on mesure chaque changement.
2. **Lot 1** (sources uniques, ISA, masse, densité) — plus fort impact sécurité.
3. **Lot 2** (suppression code mort/inventé) — réduit la surface.
4. **Lot 3** (bornes/cohérence).
5. **Lot 4** (montée/croisière).
6. **Lot 5** (unités transverses).
7. **Lot 6.3-6.5** (propriété, couverture, régression) en continu.

**Définition de « terminé » :** toutes les distances proviennent d'une lecture pilote traçable, sur des entrées issues de sources uniques (élévation SIA, METAR, masse W&B, densité 0,84/0,72), sans ISA ni valeur fabriquée, **avec une alarme explicite dès qu'un paramètre manque (jamais de fallback silencieux — P0)**, bornes signalées, et la suite de tests golden + propriété + couverture est verte.

---

## E. STATUT DES FONCTIONNALITÉS (préparation de vol)

**✅ Actives (calculées aujourd'hui) — les 6 opérations de distance :**
décollage (roulage + 15 m/50 ft) · atterrissage (roulage + 15 m/50 ft, volets LANDING & UP).

**🚧 En cours de développement — prises en compte mais NON utilisées pour les calculs (feature à venir) :**
- `climb_takeoff` — performance de montée au décollage
- `climb_cruise` — performance de montée en croisière
- `go_around_climb` — performance de montée en remise de gaz
- `cruise_speed` — vitesse de croisière (TAS)

Ces 4 fonctionnalités sont **présentes au catalogue et anticipées par l'architecture**, mais elles **ne participent à aucun calcul de distancier** tant que la feature n'est pas livrée. En préparation de vol, elles doivent s'afficher **« en cours de développement »** — jamais comme un résultat, jamais comme une erreur.

**Rappel P0 :** pour toute opération active, si une entrée manque → **alarme nommant le paramètre manquant** ou **« calcul impossible »**, jamais une valeur inventée.
