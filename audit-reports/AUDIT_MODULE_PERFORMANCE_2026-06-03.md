# AUDIT — Module de Performance Avion (AlFlight)
**Date :** 2026-06-03 · **Périmètre :** cycle de vie des données Unités & Tableaux, de la création avion au calcul des distanciers en préparation de vol.

---

## 0. Résumé exécutif (TL;DR)

Le module repose sur **deux flux de données** unifiés par une clé canonique (`operationId`) et **un seul moteur de calcul vivant** (`src/services/`). Mais l'audit révèle :

- **3 moteurs de calcul parallèles**, dont **2 sont du code mort/legacy bourré de bugs** (`performanceCharts.js` via `PerformanceCalculator.jsx` ; `cascade.ts` avec valeurs MANEX hardcodées `870`/`1.914`) et **1 placeholder cassé** (`abacValidationService.findBounds3D`).
- Côté **chemin vivant**, des erreurs de calcul réelles : **altitude pression = élévation terrain (QNH ignoré)**, **fallback ISA 15 °C malgré une règle "JAMAIS ISA"**, **densités carburant incohérentes** (Jet A-1 = 0,84 vs 0,80 selon le fichier), **politique de bornes incohérente** (extrapolation non bornée sur la famille, clamp silencieux sur l'axe X).
- De nombreux **paramètres fantômes** : `qnh`, `density_altitude`, `runwaySlope`, `runwayCondition`, `rpm`, `power`… sont mappés mais **jamais alimentés**.

Gravité : plusieurs items sont **safety-relevant** (distances de décollage/atterrissage sous-estimées).

---

## 1. Architecture & Fichiers Clés

### 1.1 Le cycle de vie en un schéma

```
CRÉATION (feature: aircraft)                     PRÉPARATION DE VOL (feature: performance)
─────────────────────────────                   ──────────────────────────────────────────
Wizard Step4Performance.jsx                      flight-wizard/Step5Performance.jsx
   │  ├─ Flux A : AbacBuilder (abac/curves)         │
   │  │     → performanceModels[]                    ▼
   │  └─ Flux B : AdvancedPerformanceAnalyzer        PerformanceModule.jsx  (orchestrateur)
   │        (IA Vision: unifiedPerformanceService)      │ collecte inputs pilote
   │     → advancedPerformance.tables[]                 │ (mass, oat, "PA"=élévation, vent signé)
   ▼                                                    ▼
 Supabase community_presets.aircraft_data (JSONB)    PerformanceStateMatrix.jsx
 + Zustand aircraftStore + IndexedDB                    │
                                                        ▼
                                                  operationResolver.generatePerformanceState()
                                                     │  itère les 10 opérations du catalogue
                                                     ├─ Flux A → evaluateAbacCascade()  [abacInterpolation.js]
                                                     │     bracket 2D / slope-follow / IDW 4D
                                                     └─ Flux B → resolveOperationFromTables() [tableInterpolationAdapter.js]
                                                                 → trilinearInterpolate()    [performanceTrilinearInterpolation.js]
                                                     ▼
                                                  flightPlan.performance.{departure,arrival}
```

### 1.2 Fichiers impliqués

| Rôle | Fichier | État |
|---|---|---|
| **Catalogue canonique** (clé `operationId`, 10 opérations) | [operationCatalog.ts](alflight/src/abac/curves/core/operationCatalog.ts) | ✅ Vivant — pivot |
| **Saisie création** (Flux A + B) | [Step4Performance.jsx](alflight/src/features/aircraft/components/wizard-steps/Step4Performance.jsx) | ✅ Vivant |
| **Builder abaque** (points → courbes) | [abac/curves/ui/AbacBuilder.tsx](alflight/src/abac/curves/ui/AbacBuilder.tsx), [core/interpolation.ts](alflight/src/abac/curves/core/interpolation.ts) | ✅ Création |
| **Ingestion IA Vision** (MANEX → tables) | [unifiedPerformanceService.js](alflight/src/features/performance/services/unifiedPerformanceService.js), [AdvancedPerformanceAnalyzer.jsx](alflight/src/features/aircraft/components/AdvancedPerformanceAnalyzer.jsx) | ✅ Création |
| **Orchestrateur prep vol** | [PerformanceModule.jsx](alflight/src/features/performance/PerformanceModule.jsx) | ✅ Vivant |
| **Résolveur d'opérations** (dispatcher) | [operationResolver.js](alflight/src/services/operationResolver.js) | ✅ Vivant |
| **Moteur abaque (Flux A)** | [abacInterpolation.js](alflight/src/services/abacInterpolation.js) | ✅ Vivant |
| **Adaptateur tableaux (Flux B)** | [tableInterpolationAdapter.js](alflight/src/services/tableInterpolationAdapter.js) | ✅ Vivant |
| **Interpolation trilinéaire (Flux B)** | [performanceTrilinearInterpolation.js](alflight/src/services/performanceTrilinearInterpolation.js) | ✅ Vivant |
| **Affichage matrice** | [PerformanceStateMatrix.jsx](alflight/src/features/performance/components/PerformanceStateMatrix.jsx) | ✅ Vivant |
| **Calculateur legacy** | [PerformanceCalculator.jsx](alflight/src/features/performance/components/PerformanceCalculator.jsx) | ❌ **MORT** (jamais monté) |
| **Abaques legacy (math)** | [performanceCharts.js](alflight/src/features/aircraft/utils/performanceCharts.js) | ❌ **MORT** (utilisé seulement par le calculateur mort) |
| **Cascade builder** (preview) | [cascade.ts](alflight/src/abac/curves/core/cascade.ts) | ⚠️ Design-time + valeurs hardcodées |
| **Validation/interpolation ABAC** | [abacValidationService.js](alflight/src/features/performance/services/abacValidationService.js) | ⚠️ Latent + `findBounds3D` cassé |
| **Persistance** | [aircraftStore.js](alflight/src/core/stores/aircraftStore.js), `community_presets` (Supabase) | ✅ Vivant |

---

## 2. Stockage & structure des données

### 2.1 Flux A — Abaques (`performanceModels[]`)
Écrit par [Step4Performance.jsx](alflight/src/features/aircraft/components/wizard-steps/Step4Performance.jsx) (~l.300-317) :

```js
{
  id, name, type: 'abaque',
  classification: operationId,          // ex. 'takeoff_50ft'
  data: {                               // = AbacCurvesJSON
    graphs: [{
      id, name, role: 'primary'|'intermediate', operationId, cascadeOrder,
      axes: { xAxis:{title,unit,reversed,min,max}, yAxis:{...} },
      familyAxisVariable,               // ex. 'pressure_altitude'
      interpolationMode,                // 'family'|'mono'|'slope-follow' (optionnel)
      outputUnit, outputKind,
      curves: [{ name, familyValue, windDirection, entryY, points:[{x,y}] }]
    }]
  }
}
```

### 2.2 Flux B — Tableaux directs (`advancedPerformance.tables[]`)
Écrit par [AdvancedPerformanceAnalyzer.jsx](alflight/src/features/aircraft/components/AdvancedPerformanceAnalyzer.jsx) :

```js
{
  operationId, outputUnit, table_name,
  data: [ { Altitude, Temperature, Masse, value }, ... ],   // une grandeur par ligne
  analysisMetadata: { confidence, needsReview, ... }
}
```

### 2.3 Persistance
- **Supabase** : table `community_presets`, colonne unique **`aircraft_data` (JSONB)** contenant `performanceModels`, `advancedPerformance`, `performanceTables` (legacy), `_metadata.units`.
- **Zustand** [aircraftStore.js](alflight/src/core/stores/aircraftStore.js) + **IndexedDB** (`dataBackupManager`) pour le cache local et les données lourdes (les `fitted.points` et DataURLs base64 sont strippés avant `localStorage`).

### 2.4 Divergence de format
Les deux flux écrivent dans **des sous-arbres séparés** (`performanceModels` vs `advancedPerformance.tables`) — **pas de champ unifié**. Le **seul lien** entre les deux est la clé `operationId` du catalogue. C'est un bon choix d'architecture, mais cela signifie que toute opération doit être portée par **une seule** source (abaque **OU** tableau) — décision documentée dans [operationResolver.js:227-229](alflight/src/services/operationResolver.js).

---

## 3. Analyse comparative (Abaques vs Tableaux)

| Critère | Flux A — Abaques | Flux B — Tableaux |
|---|---|---|
| Entrée moteur | [evaluateAbacCascade()](alflight/src/services/abacInterpolation.js) | [resolveOperationFromTables()](alflight/src/services/tableInterpolationAdapter.js) |
| Méthode math | Bracket 2D (lecture pilote) → slope-follow → **IDW 4D** (fallback) | **Trilinéaire** masse × alt × temp |
| Dimensions | famille (alt/masse/temp via nom de courbe) + axe X + filtre vent | masse, altitude, température |
| Hors-plage **masse/famille** | **extrapolation linéaire NON bornée** (`familyT`<0 ou >1) + warning | extrapolation linéaire + warning |
| Hors-plage **axe X / alt / temp** | **clamp silencieux** (`interpolate1D` l.341-342, **sans warning**) | clamp + warning |
| Confiance affichée | 70 % (IDW) → 95 % (déclaré) | 95 % (plage) / 75 % (extrapolé) |
| Sortie | `OperationResult` typé | `OperationResult` typé (même format) |

**Convergence :** les deux produisent le **même `OperationResult`**, affiché dans la même `PerformanceStateMatrix`, avec le **même facteur de sécurité** (appliqué **à l'affichage seulement**, pas au stockage — [PerformanceModule.jsx:35-44](alflight/src/features/performance/PerformanceModule.jsx)). L'unification est réelle et propre **au niveau interface**.

**Divergence notable :** la **politique de bornes diffère** entre les deux flux ET à l'intérieur même du Flux A (famille extrapolée vs X clampé). Voir bug B6.

---

## 4. Rapport de vulnérabilités / bugs

### 4.1 🔴 CRITIQUES — chemin de calcul VIVANT

**B1 — Fallback ISA 15 °C malgré la règle "JAMAIS ISA".**
[PerformanceModule.jsx:173-209](alflight/src/features/performance/PerformanceModule.jsx) calcule soigneusement `departureTemp = null` si pas de METAR, avec un commentaire `🚨 SÉCURITÉ CRITIQUE : NE JAMAIS utiliser ISA comme fallback → DANGER`. Mais **3 lignes plus loin**, [l.431](alflight/src/features/performance/PerformanceModule.jsx) :
```js
const takeoffTemp = departureTemp !== null && departureTemp !== undefined ? departureTemp : 15;
```
→ Réintroduit **15 °C ISA** silencieusement (et l'UI l'étiquette même « ISA », l.742). Le moteur ne voit **jamais** une température absente. Sur une journée chaude sans METAR, les distances sont **sous-estimées**.

**B2 — « Altitude pression » = élévation terrain (QNH ignoré).**
[PerformanceModule.jsx:436-437](alflight/src/features/performance/PerformanceModule.jsx) :
```js
const takeoffPa = departureAirport?.elevation || 0;   // étiqueté "ALT. PRESSION"
```
C'est l'**élévation géométrique**, pas l'altitude pression. **Aucun QNH n'est collecté** dans le chemin vivant (`grep qnh` → seulement un mapping orphelin + extraction VAC sans lien). L'altitude densité n'est **jamais calculée** (la fonction `calculateDensityAltitude` existe… dans le code mort). Par QNH bas (990 hPa), l'erreur ≈ **+630 ft** non pris en compte → abaque lu trop bas → distances trop optimistes.

**B3 — Valeurs par défaut silencieuses masquant `MISSING_INPUT`.**
[abacInterpolation.js:35-42](alflight/src/services/abacInterpolation.js) `inputsToConditions` :
```js
temperature: …?? 15,  pressure_altitude: …?? 0,  mass: …?? 1000,  wind: …?? 0
```
Toute donnée manquante est **remplacée par un défaut fabriqué** (1000 kg, 15 °C…) au lieu de remonter `MISSING_INPUT`. Le statut `MISSING_INPUT` du résolveur devient **quasi-mort** côté abaque car les conditions sont toujours pré-remplies.

**B4 — Densités carburant fragmentées et incohérentes → masse atterrissage fausse.**
[PerformanceModule.jsx:426](alflight/src/features/performance/PerformanceModule.jsx) :
```js
const fuelDensity = FUEL_DENSITIES[selectedAircraft?.fuelType] || FUEL_DENSITIES['AVGAS 100LL'];
```
Il existe **3 tables `FUEL_DENSITIES` distinctes**, avec **clés ET valeurs divergentes** :
| Fichier | Clé Jet | Densité Jet | Clé Avgas |
|---|---|---|---|
| [constants.js](alflight/src/utils/constants.js) | `'JET A-1'` | **0,84** | `'AVGAS 100LL'` |
| `utils/unitConversions.js` | `JET_A1` | **0,80** | `AVGAS` |
| `aircraft/utils/mbUnits.js` | `'JET-A1'` | **0,80** | `AVGAS` |

Si `fuelType` est stocké avec une clé d'un autre fichier (`'JET_A1'`, `'AVGAS'`), le lookup **échoue silencieusement** et retombe sur AVGAS 0,72. Pour un avion Jet A-1, l'erreur de densité atteint **~14 %** → masse à l'atterrissage fausse → **distance d'atterrissage fausse**.

**B5 — IDW 4D : normalisations magiques, lecture d'abaque géométriquement douteuse.**
[abacInterpolation.js:164-167](alflight/src/services/abacInterpolation.js) :
```js
const tempDiff = (…)/30;  const altDiff = (…)/2000;  const massDiff = (…)/100;  const windDiff = (…)/10;
```
Ces diviseurs (30, 2000, 100, 10) sont des **constantes arbitraires** qui déterminent les « plus proches voisins ». L'IDW **aplatit toutes les courbes** en un nuage et moyenne les 4 plus proches — il ne respecte pas la structure de l'abaque et peut **mélanger des familles** physiquement distinctes. Utilisé en fallback quand aucun `familyAxisVariable` n'est déclaré.

**B6 — Politique de bornes incohérente (extrapolation non bornée).**
Sur la **dimension familiale**, `bracketInterpolateGraph` [l.500-536](alflight/src/services/abacInterpolation.js) **extrapole linéairement sans borne** (`familyT` peut être <0 ou >1) — masse au-delà du MTOW → distance extrapolée **sans plafond**. Sur l'**axe X**, `interpolate1D` [l.341-342](alflight/src/services/abacInterpolation.js) **clampe au bord SANS warning**. Donc une température hors-plage est silencieusement bornée, tandis qu'une masse hors-plage explose. Comportement non uniforme et partiellement silencieux.

**B7 — `runwaySlope` câblé à 0 ; état de piste/travers ignorés.**
[PerformanceModule.jsx:475,485](alflight/src/features/performance/PerformanceModule.jsx) : `runwaySlope: 0` en dur. Les corrections d'état de sol (humide/herbe/contaminée) et de pente ne sont **pas appliquées** — c'est **honnêtement signalé** par un encart UI ([l.559-579](alflight/src/features/performance/PerformanceModule.jsx)), mais `runwaySlope` reste un **paramètre fantôme** (mappé, jamais ≠ 0).

### 4.2 🟠 CODE MORT / LATENT (confirmé non monté, mais à risque)

**D1 — `PerformanceCalculator.jsx` + `performanceCharts.js` : tout le moteur legacy.**
`PerformanceCalculator` n'est **jamais importé ni monté** (`grep` négatif sur `<PerformanceCalculator` et `import…PerformanceCalculator`). Il lit `selectedAircraft.manex.performanceCharts` (champ non alimenté par le wizard actuel) et utilise `performanceCharts.js`, qui contient :
- [l.237-240](alflight/src/features/aircraft/utils/performanceCharts.js) : `chart.data[…]?.[…] || 0` → une cellule manquante vaut **0 m** (distance nulle !) et tire l'interpolation vers 0.
- [l.266-270](alflight/src/features/aircraft/utils/performanceCharts.js) : correction de masse `result *= Math.pow(weightRatio, 0.5)` — **approximation arbitraire** (commentée « Correction approximative »), poids de réf = médiane des masses.
- [l.112-137](alflight/src/features/aircraft/utils/performanceCharts.js) : extraction regex qui ramasse **tous les nombres 50-9999** et les répartit dans les cellules **dans l'ordre de la regex** → tableaux incohérents.
- [l.338-401](alflight/src/features/aircraft/utils/performanceCharts.js) `generateDefaultChart` : **fabrique** des perfs (400 m base « light », facteurs alt/temp inventés).
- [l.282-289](alflight/src/features/aircraft/utils/performanceCharts.js) : correction vent au signe douteux (avec `headwindFactor` négatif par défaut, un vent de face **augmente** la distance).
→ Aucun impact actuel, mais **danger si rebranché**. À supprimer.

**D2 — `cascade.ts` : valeurs MANEX hardcodées.**
[cascade.ts:572-577](alflight/src/abac/curves/core/cascade.ts) force la sortie à **870** quand `inputY≈1115` et `parameterX≈1050` (±50) ; [l.584](alflight/src/abac/curves/core/cascade.ts) applique un facteur de correction **`1.914`** aux graphes dont le **nom contient « masse »**. Ce sont des **calibrations spécifiques à un MANEX précis**, injectées dans le moteur. Importé **uniquement** par le builder/preview ([CascadeCalculator.tsx](alflight/src/abac/curves/ui/CascadeCalculator.tsx), [AbacGraphWizard.tsx](alflight/src/abac/curves/ui/AbacGraphWizard.tsx)) — **pas** par `operationResolver`. De plus, le fichier comporte de **nombreux fragments syntaxiquement cassés** (l.556-559, 579-580, 587-609 : `}:\`);`, `:\`);`… vestiges de `console.log` mal supprimés) → signal fort de code mort/non compilable en l'état.

**D3 — `abacValidationService.findBounds3D` : placeholder cassé.**
[abacValidationService.js:357-368](alflight/src/features/performance/services/abacValidationService.js) :
```js
findBounds3D(values, inputs) {
  const bounds = { x0:0,x1:2000, y0:0,y1:30, z0:900,z1:1200, v:[[[0]]] }; // Placeholder
  // TODO: Implémenter la recherche réelle des 8 points
  return bounds;
}
```
→ La trilinéaire de ce service renvoie **0** (cube `v:[[[0]]]`). Atteint seulement via `unifiedPerformanceService.interpolateABAC()`, **sans appelant** dans le code. Latent mais dangereux si activé.

**D4 — `checkMonotonicity` suppose distance croissante avec l'altitude** [l.78](alflight/src/features/performance/services/abacValidationService.js) — vrai en général, mais ce n'est qu'un *warning*, OK.

### 4.3 🟡 UNITÉS

- **U1** : densités carburant (cf. B4) — incohérence de clés **et** de valeurs.
- **U2** : **aucune normalisation de l'unité de sortie**. La valeur calculée porte l'`outputUnit` digitalisé (catalogue par défaut `'m'`, mais un abaque peut être en `'ft'`). [operationResolver.js:361](alflight/src/services/operationResolver.js) / [tableInterpolationAdapter.js:252-254](alflight/src/services/tableInterpolationAdapter.js) prennent l'unité stockée telle quelle → risque de comparaison hétérogène (longueur de piste en m vs distance perf en ft).
- **U3** : **4 systèmes d'unités parallèles** (`unitsDisplay.CANONICAL_UNITS`, `mbUnits.STORAGE_UNITS`, `aircraftNormalizer.STORAGE_UNITS`, `useUnits.storageUnits`) → dérive de maintenance. L'unité **n'est pas stockée à côté de la valeur** : tout repose sur l'hypothèse « canonique ».
- **U4** (illustratif, code mort) : [PerformanceCalculator.jsx:48](alflight/src/features/performance/components/PerformanceCalculator.jsx) applique `qnh * 33.8639` (inHg→hPa) **systématiquement** → double-conversion si la valeur est déjà en hPa.

### 4.4 🟡 PARAMÈTRES FANTÔMES

[operationResolver.js:54-86](alflight/src/services/operationResolver.js) mappe de nombreuses variables d'axe vers des champs d'inputs, mais **PerformanceModule n'en alimente qu'une poignée** (`mass`, `oat`, `pressureAltitude`, `headwind/windComponent/tailwind`, `runwaySlope=0`). Jamais fournis :
- `qnh`, `density_altitude` → un abaque dont l'axe est l'altitude densité ou le QNH ne sera **jamais** calculable correctement (P1).
- `runwayCondition`, `crosswind`, `humidity` → ignorés (P2/P3).
- `rpm`, `manifoldPressure`, `powerPercent`, `ias/cas/tas` → **donc les opérations `cruise_speed`, `climb_takeoff`, `climb_cruise`, `go_around_climb` du catalogue ne reçoivent aucun input moteur/vitesse** → systématiquement `NOT_IMPLEMENTED` ou résultat faussé par défauts (P4). La matrice annonce 10 opérations mais ~5 ne sont pas réellement pilotables.

> Note doc : le catalogue compte **10** opérations (commentaire dit « 9 ») et déclare une phase `descent` **sans aucune opération** associée.

---

## 5. Recommandations

### Priorité 1 — Sécurité calcul (chemin vivant)
1. **B2/B1** : calculer l'**altitude pression** depuis QNH (`PA = élévation + (1013,25 − QNH) × 27`) et collecter le QNH METAR ; supprimer le fallback ISA 15 °C ou le rendre **bloquant et visible** (statut explicite « température indisponible »), pas un défaut silencieux.
2. **B4** : **une seule** source `FUEL_DENSITIES`, normaliser les clés `fuelType` à la création, trancher Jet A-1 = 0,84 **ou** 0,80 (réf : Jet A-1 ≈ 0,80 kg/L à 15 °C).
3. **B3/B6** : remonter `MISSING_INPUT` au lieu de défauts ; **borner** l'extrapolation de masse (ou exiger confirmation), **émettre un warning** sur le clamp de l'axe X.
4. **B7** : implémenter les corrections pente/état de piste **ou** maintenir l'avertissement (déjà présent) et **retirer `runwaySlope` du jeu d'inputs** tant qu'il vaut 0.

### Priorité 2 — Code mort & dette
5. **Supprimer** [PerformanceCalculator.jsx](alflight/src/features/performance/components/PerformanceCalculator.jsx) et [performanceCharts.js](alflight/src/features/aircraft/utils/performanceCharts.js) (D1).
6. **Retirer** les valeurs hardcodées `870`/`1.914` de [cascade.ts](alflight/src/abac/curves/core/cascade.ts) (D2) ; corriger ou supprimer le fichier (fragments cassés).
7. **Implémenter ou supprimer** `findBounds3D` (D3) ; retirer `interpolateABAC` si sans usage.

### Priorité 3 — Cohérence & lisibilité
8. **Unités** : stocker l'unité **à côté** de chaque valeur de perf (ou imposer un canonique strict + conversion à la lecture) ; consolider les 4 systèmes d'unités (U2/U3).
9. **Paramètres fantômes** : soit câbler les inputs manquants (QNH, pente, rpm/puissance/vitesse pour montée/croisière), soit **retirer du catalogue/mapping** les variables non alimentées pour ne pas afficher une fausse couverture (P1-P4).
10. **Doc** : corriger « 9 → 10 opérations » et la phase `descent` orpheline du catalogue.

---

### Annexe — Méthode d'audit
Lecture directe des moteurs vivants ([operationResolver.js](alflight/src/services/operationResolver.js), [abacInterpolation.js](alflight/src/services/abacInterpolation.js), [performanceTrilinearInterpolation.js](alflight/src/services/performanceTrilinearInterpolation.js), [tableInterpolationAdapter.js](alflight/src/services/tableInterpolationAdapter.js), [PerformanceModule.jsx](alflight/src/features/performance/PerformanceModule.jsx)) + traçage des importeurs (`grep`) pour distinguer code vivant / mort, et vérification de mes propres yeux des valeurs hardcodées et placeholders.
