# AUDIT — Single Source of Truth & Centralisation des Calculs

**Application :** AlFlight (React/Vite/Zustand/Supabase/Capacitor)
**Périmètre :** `alflight/src` — gestion des données, cycle de vie de l'information, efficacité des calculs
**Date :** 2026-06-03
**Type :** Audit en lecture seule (aucune modification de code)

---

## 1. Diagnostic global

**Verdict : le principe de Single Source of Truth n'est PAS respecté.** L'application affiche l'intention (commentaires `// AUCUNE DONNÉE LOCALE`, `// Store chargé UNIQUEMENT depuis Supabase`) mais le code fait exactement l'inverse. On observe **deux pathologies systémiques** :

### Cause racine n°1 — Pas d'arbitrage clair entre Supabase et le stockage local
L'avion (objet métier central) vit simultanément dans **4 à 5 emplacements** : Supabase (`community_presets`), IndexedDB (`aircraftData` **et** `protectedData`), backups automatiques, et historiquement localStorage. **Au démarrage, le chargement Supabase est explicitement désactivé** (`core/contexts/index.jsx:65-255`) : c'est **IndexedDB qui est la source de vérité de facto**, alors que les écritures continuent de partir vers Supabase. Résultat : désynchronisation structurelle garantie. Le même schéma se répète pour le MANEX (4 copies), les cartes VAC (triple stockage) et les waypoints de navigation.

### Cause racine n°2 — Une couche de calcul parallèle qui double les stores/hooks
Le modèle `FlightPlanData` (`features/flight-wizard/models/FlightPlanData.js`) possède ses propres `calculateRouteDistance()`, `calculateFuel()`, `calculateTOD()`, `calculateWeightBalance()` — **en concurrence** avec les hooks/stores officiels (`useNavigationResults`, `fuelStore`, `weightBalanceStore`). Les deux mondes utilisent des formules **différentes** (ex. distance directe sans waypoints vs distance sommée par segments) et **divergent**. La fonction Haversine `calculateDistance` est re-codée dans **8 fichiers** dont 2 avec des constantes incompatibles. Le facteur de sécurité performance existe en **3 valeurs différentes** (1.43 / 1.25 / 1.10) — risque de sécurité aéronautique direct.

### Tableau de maturité

| Exigence | État | Note |
|---|---|---|
| Source de données unique (DB) | 🔴 Non respecté | Supabase désactivé au boot, IndexedDB source de facto, 4-5 copies de l'avion |
| Zéro duplication de données | 🔴 Non respecté | Avion, MANEX, VAC, waypoints dupliqués sans synchro |
| Zéro recalcul inutile | 🔴 Non respecté | Distance/temps/carburant/TOD/CG recalculés dans plusieurs modules |
| Calcul unique par module responsable | 🔴 Non respecté | Haversine ×8, groundSpeed ×3, interpolation ×4, CG ×4 |
| Cohérence des résultats | 🔴 À risque | Formules divergentes (rayon Terre, arrondis, facteur sécurité, distance route) |
| Donnée affichée = donnée sauvegardée | 🔴 Non respecté | `navigationResults=null` à la sauvegarde ; `generateSummary` lit des champs stale |

**Constat critique pour un outil aéronautique :** plusieurs divergences ne sont pas que de la dette technique — elles produisent des **résultats numériques différents** pour la même question (distance de déroutement, distance d'atterrissage avec facteur de sécurité, masse au décollage, conformité de centrage). C'est une menace directe sur la fiabilité.

---

## 2. Tableau de synthèse (par sévérité)

| # | Problème | Localisation principale | Sévérité |
|---|---|---|---|
| A2 | IndexedDB = source de vérité de facto, Supabase désactivé au boot | `core/contexts/index.jsx:65-255` | 🔴 CRITIQUE |
| B1 | Facteur de sécurité performance divergent (1.43 / 1.25 / 1.10) | `utils/performanceSafetyFactor.js` + 2 autres | 🔴 CRITIQUE |
| B2 | Moteur de cascade d'abaques dupliqué avec magic numbers MANEX (1.914, Y=870) | `abac/curves/core/cascade.ts:567-595` | 🔴 CRITIQUE |
| B3 | Calcul masse/CG divergent dans `FlightPlanData` (pas de CG, `maxWeight=0`) | `flight-wizard/models/FlightPlanData.js:230-258` | 🔴 CRITIQUE |
| C1 | `useNavigationResults()` appelé sans args → navigation jamais persistée | `flight-wizard/FlightPlanWizard.jsx:41` | 🔴 CRITIQUE |
| B4 | `calculateDistance` (Haversine) re-codé ×8 avec constantes divergentes | `utils/navigationCalculations.js` + 7 | 🟠 ÉLEVÉE |
| B5 | `calculateDistanceFromRoute` = `min(extrémités)` au lieu du cross-track | `alternates/utils/alternateFilters.js:282` | 🟠 ÉLEVÉE |
| A4 | MANEX stocké dans 4 emplacements non synchronisés | `manexStore` + `indexedDBStorage` + ... | 🟠 ÉLEVÉE |
| C2 | Distance/temps : modèle (sans WP) ≠ hook (avec WP) → sauvegardé ≠ affiché | `FlightPlanData.js:322` vs `useNavigationResults.js:19` | 🟠 ÉLEVÉE |
| A1 | Deux stores avion concurrents (un mort, crasherait) | `core/stores/supabaseAircraftStore.js` | 🟠 ÉLEVÉE |
| A5 | Cartes VAC : triple stockage + clé localStorage fantôme | `core/stores/vacStore.js:96` | 🟠 ÉLEVÉE |
| B6 | Interpolation linéaire 1D re-codée ×4 (clamp vs extrapolation) | `services/abacInterpolation.js` + 3 | 🟠 ÉLEVÉE |
| B7 | 4 moteurs d'interpolation de performance (√masse, IDW, stub) | `aircraft/utils/performanceCharts.js` + 3 | 🟠 ÉLEVÉE |
| C3 | Calcul TOD dupliqué ×3 avec hypothèses différentes | `Step3Route` / `Step7Summary` / `FlightPlanData` | 🟠 ÉLEVÉE |
| A3 | Avion « squelette » + ré-hydratation/merge Supabase dupliqués ×5 | `services/communityService.js:21` | 🟡 MOYENNE |
| B8 | groundSpeed vectoriel vs scalaire (`tas - headwind`) ×3 | `WindAnalysis` / `VFRNavigationTable` / `useWindCalculations` | 🟡 MOYENNE |
| C4 | Copies d'état local (avion/fobFuel/loads) → désync via useEffect | `FlightPlanWizard` + tous les steps | 🟡 MOYENNE |
| B9 | Carburant : réserves divergentes (30/45/20 min vs 0.5h/0.75h) | `FlightPlanData.js:179` vs hooks | 🟡 MOYENNE |
| C5 | Densité carburant L→kg recalculée ×4 (fallback 0.84 divergent) | Step6 / Step7 / FlightPlanData | 🟡 MOYENNE |
| C6 | `plannedAltitude = 3000` codé en dur ×4 | Step3Route / Step7Summary / FlightRecapTable / model | 🟡 MOYENNE |
| C7 | Rayon d'action recalculé ×2 avec FOB utilisable défini différemment | `Step7Summary:276` vs `Step7Alternates:218` | 🟡 MOYENNE |
| — | Bugs bloquants (syntaxe, fichiers morts) | voir §6 | 🟡 Divers |

---

## 3. AXE A — Source de données unique (Database)

### A2 — IndexedDB est la source de vérité de facto ; Supabase désactivé au démarrage 🔴

**1. Localisation**
- `core/contexts/index.jsx:65-73` (chargement Supabase **commenté/désactivé**), `:76-255` (chargement depuis IndexedDB), `:250` (commentaire `Chargement Supabase DÉSACTIVÉ`)
- `core/stores/aircraftStore.js:2` (en-tête mensonger `AUCUNE DONNÉE LOCALE`), `:408-427` (`addAircraft` écrit Supabase **ET** `dataBackupManager.saveAircraftData`)
- `utils/dataBackupManager.js:384-413` (`saveAircraftData` écrit dans `aircraftData` **ET** `protectedData`)

**2. Problème constaté**
Au démarrage, `AircraftProvider` charge la flotte depuis IndexedDB local (`getAllFromStore('aircraftData')`), pas depuis Supabase qui est explicitement coupé. Mais `addAircraft`/`updateAircraft` continuent d'écrire dans Supabase. Le même avion vit donc dans `community_presets` (Supabase), `aircraftData` (IndexedDB lourd), `protectedData` (IndexedDB light) et les backups.

**3. Impact**
Désynchronisation structurelle. Un avion modifié côté Supabase (autre appareil/pilote) n'apparaît jamais. Un avion supprimé dans Supabase persiste localement. Les copies `protectedData` (light) et `aircraftData` (lourde) divergent dès qu'une écriture échoue partiellement. C'est la **cause racine** des bugs « champs M&C perdus » que le code tente de masquer par des ré-hydratations (cf. A3).

**4. Solution concrète**
Architecture cible : **Supabase = source de vérité ; IndexedDB = cache offline en lecture seule** (jamais primaire quand le réseau est dispo).
- Réactiver `loadFromSupabase()` au boot dans `core/contexts/index.jsx`.
- Réduire `dataBackupManager` au stockage des blobs lourds (photo/MANEX/perf) indexés par `supabaseId`.
- Supprimer la double écriture `aircraftData` + `protectedData` — n'en garder qu'une.
```js
// core/contexts/index.jsx — au montage
useEffect(() => {
  const store = useAircraftStore.getState();
  store.loadFromSupabase().catch(() => store.loadFromCache()); // fallback offline only
}, []);
```

---

### A1 — Deux stores avion concurrents (`aircraftStore` vs `supabaseAircraftStore`) 🟠

**1. Localisation**
- `core/stores/aircraftStore.js` (store actif, ~747 lignes)
- `core/stores/supabaseAircraftStore.js` (store mort, 196 lignes ; `:166` appelle `React.useEffect` **sans importer React** → crash si monté)
- `core/stores/index.js:2` (n'exporte que `aircraftStore`)
- `components/SupabaseInitializer.jsx` (seul consommateur de `supabaseAircraftStore`, lui-même **jamais importé** nulle part)

**2. Problème constaté**
Deux stores Zustand exposent le même état (`aircraftList`, `selectedAircraftId`, `isLoading`, `lastSync`) et les mêmes actions. `useSupabaseAircraftStore` n'est référencé que par un composant orphelin. La logique d'écriture diverge (`supabaseAircraftStore.updateAircraft:117-141` ré-soumet un preset complet à chaque update).

**3. Impact**
Double définition de l'entité centrale = piège de maintenance. Un import du mauvais store renvoie une liste vide/désynchronisée et planterait (`React` non importé).

**4. Solution concrète**
Supprimer `supabaseAircraftStore.js` et `SupabaseInitializer.jsx` (code mort). Conserver `aircraftStore` comme unique store.

---

### A3 — Avion « squelette » + ré-hydratation/merge Supabase dupliqués dans 5 fichiers 🟡

**1. Localisation**
- `services/communityService.js:21-106` (`getAllPresets` ne charge PAS `arms`/`weightBalance`/`cgEnvelope`/`speeds`)
- `features/aircraft/AircraftModule.jsx:391-405` (`handleEdit` → `getPresetById`), `:471-483` (`handleOpenWizard` → `getPresetById`), `:412-453` (relit IndexedDB pour photo/manex)
- aussi `Step0CommunityCheck.jsx:415`, `SupabaseUpdater.jsx:53`, `duplicateAircraft.js:21`

**2. Problème constaté**
`getAllPresets` renvoie volontairement un avion **partiel** (optimisation mémoire). À chaque édition/wizard, le code re-fetch l'avion complet via `getPresetById`, fait `{ ...currentAircraft, ...fullFromSupabase }`, puis relit IndexedDB. Le même avion est reconstitué depuis 2-3 sources à chaque clic, avec des règles de merge dispersées dans 5 fichiers.

**3. Impact**
Trois représentations partielles coexistent → risque de perte de champ au merge (un champ présent dans la liste mais absent du fetch). Requêtes Supabase redondantes à chaque interaction.

**4. Solution concrète**
Centraliser dans le store une action mémoïsée `ensureAircraftFull(id)` : vérifie si l'avion complet est en mémoire, sinon fetch Supabase **une fois** et met à jour `aircraftList[i]` en place. Les composants n'appellent plus jamais `communityService.getPresetById` directement.

---

### A4 — MANEX stocké dans 4 emplacements distincts 🟠

**1. Localisation**
- Supabase Storage `manex-files` + table `manex_files` (`communityService.js:429-455, 527-564`)
- `core/stores/manexStore.js` → localStorage `manex-storage` (métadonnées)
- `utils/indexedDBStorage.js:102-142` (`MANEX_STORE = 'manexPDFs'`, PDF base64)
- `utils/dataBackupManager.js:384-413` (champ `manex` embarqué dans `aircraftData`)

**2. Problème constaté**
Le même PDF (10-50 MB) et ses métadonnées sont potentiellement dans Supabase Storage, `manexStore` (localStorage), `manexPDFs` (IndexedDB) ET `aircraftData.manex`. Aucune synchronisation. Le flag `hasManex` existe en 3 versions (`manexStore`, `aircraftData.hasManex`, `community_presets.has_manex`).

**3. Impact**
Surconsommation mémoire/disque massive — crashes OOM déjà documentés dans le code (`contexts/index.jsx:86-101`). Risque de servir un MANEX **périmé** depuis un cache local. Flags désynchronisés.

**4. Solution concrète**
Source unique = Supabase Storage + `manex_files`. Le PDF n'est mis en cache que dans IndexedDB `manexPDFs` (clé = `supabaseId` + date de version pour invalidation). Supprimer le champ `manex` de `aircraftData` et supprimer `manexStore`. Un seul flag `has_manex` (Supabase) propagé en lecture.

---

### A5 — Cartes VAC : triple stockage + clé localStorage fantôme 🟠

**1. Localisation**
- `services/vacSupabaseService.js:19-99` (table `vac_charts` + bucket `vac-charts`)
- `core/stores/vacStore.js:157-164` (persist localStorage `vac-storage`, tout l'objet `charts`)
- `core/stores/vacStore.js:96-99` (écriture **manuelle additionnelle** dans `localStorage['customVACCharts']`, uniquement à la suppression)
- `services/vacPdfStorage.js` + `utils/indexedDBStorage.js:199-235` (`VAC_STORE = 'vacPDFs'`)

**2. Problème constaté**
Métadonnées VAC dans Supabase `vac_charts`, dans le persist Zustand `vac-storage`, ET dupliquées à la main dans `customVACCharts` (écrite seulement au `deleteChart`, jamais à la création → structurellement incohérente). PDF VAC dans le bucket Supabase ET dans IndexedDB.

**3. Impact**
`customVACCharts` est un vestige jamais relu, peut contenir des entrées fantômes. Désync `vac_charts` ↔ `vac-storage` sans réconciliation. Surtout : `openAIPStore.validateAllPoints` (`openAIPStore.js:225-266`) valide des coordonnées en lisant le **cache local** `charts` — si périmé, la validation VAC↔OpenAIP est fausse.

**4. Solution concrète**
Source unique = `vac_charts` (Supabase). `vacStore` devient un miroir hydraté au démarrage (pas un persist autonome). Supprimer l'écriture `customVACCharts`. PDF VAC cachés uniquement en IndexedDB (clé ICAO + checksum).

---

### Secondaires Axe A
- **`navigationStore` persiste des waypoints aussi sauvés dans Supabase** (`navigationStore.js:193-196` vs `flightPlanSupabaseService.js:53-64`) — deux sources pour la même route sans lien. Clarifier : le local doit être un brouillon explicitement distinct du plan archivé.
- **Backups automatiques gonflés** (`dataBackupManager.js:164-191`) : toutes les 5 min, `{ ...localStorage }` + tous les stores IDB, gardés ×10. Comme `aircraftData` contient des base64, chaque snapshot duplique des dizaines de MB → 5e couche de duplication.
- **Référence morte `updateAircraftManex`** (`AircraftModule.jsx:259, 2507`) : action inexistante dans `aircraftStore` → `undefined`, callback inopérant.
- **`communityAircraftDatabase.js`** : ancien 3e référentiel neutralisé — à supprimer définitivement.

---

## 4. AXE B — Centralisation des calculs

> **Module canonique navigation :** `utils/navigationCalculations.js` (Haversine R=3440.065 NM avec cache, `calculateBearing`, `calculateWindEffect` vectoriel, `calculateDistanceToSegment` cross-track, `calculateFuelRequired`...). Bon modèle : `features/alternates/utils/geometryCalculations.js` **importe** correctement le canonique. Tous les fichiers ci-dessous le re-codent.

### B1 — Facteur de sécurité performance : 3 valeurs divergentes 🔴

**1. Localisation**
- `utils/performanceSafetyFactor.js:22-47` (canonique) : `1.0 / 1.15 / 1.43 / 1.67`
- `features/performance/components/PerformanceCalculator.jsx:650-653` (texte affiché) : `1.15` aviation générale, **`1.25`** transport public
- `features/aircraft/utils/performanceCharts.js:187-191, 300-307` : `wetFactor 1.10`, `grassFactor 1.15`, `contaminatedFactor 1.25` en dur

**2. Problème constaté**
Le facteur réglementaire de distance existe en 3 jeux de valeurs incohérents (EU-OPS Part-CAT 1.43/1.67 vs 1.25 affiché vs 1.10/1.25 piste re-codés), alors que `PerformanceModule.jsx:560-580` indique « corrections piste NON implémentées ».

**3. Impact (chiffré)**
LDA brute MANEX 600 m, piste mouillée transport public : canonique ×1.67 = **1002 m** ; texte `PerformanceCalculator` ×1.25 = **750 m** ; `performanceCharts` ×1.10 = **660 m**. Trois réponses pour la même question réglementaire → **risque sécurité direct** sur la décision d'atterrissage.

**4. Solution concrète**
`utils/performanceSafetyFactor.js` est canonique (`applySafetyFactor(rawValue, operationId, factor)` + `SAFETY_FACTOR_PRESETS`), point d'application unique `PerformanceStateMatrix.jsx:190-208`. Corriger le texte de `PerformanceCalculator.jsx:650` (ou retirer le composant, cf. B7). Supprimer les facteurs piste de `performanceCharts.js`.

---

### B2 — Deux moteurs de cascade d'abaques, l'un avec magic numbers MANEX 🔴

**1. Localisation**
- LIVE : `services/abacInterpolation.js` (`evaluateAbacCascade:780`, `bracketInterpolateGraph:370`)
- LEGACY : `abac/curves/core/cascade.ts` (`performCascadeCalculationWithParameters:962`), consommé par l'éditeur `abac/curves/ui/CascadeCalculator.tsx:388`
  - `cascade.ts:584` : `const correctionFactor = 1.914; adjustedRatio = Math.min(positionRatio * correctionFactor, 1.0);`
  - `cascade.ts:567-580` : `if (Math.abs(inputY - 1115) < 50 && Math.abs(parameterX - 1050) < 50) targetOutput = 870;`

**2. Problème constaté**
Deux implémentations indépendantes de la cascade. La version `cascade.ts` contient des constantes calibrées sur **un seul cas de test d'un MANEX précis** (facteur 1.914, forçage à 870).

**3. Impact**
Pour tout autre avion, `cascade.ts` produit des distances **fausses** (ratio multiplié arbitrairement par ~1.9). Incohérence entre l'éditeur d'abaques et la prep de vol réelle (qui passe par `abacInterpolation.js`). Risque majeur si `cascade.ts` est un jour rebranché.

**4. Solution concrète**
Désigner `services/abacInterpolation.js` comme moteur unique. Faire consommer à `CascadeCalculator.tsx` `evaluateAbacCascade`. Supprimer `1.914`/`870` de `cascade.ts:567-595` puis déprécier le fichier.

---

### B3 — Calcul masse/CG divergent dans `FlightPlanData` 🔴

**1. Localisation**
- CANONIQUE : `core/stores/weightBalanceStore.js:171-251` (`calculateWeightBalance` : par poste, bras individuels, moment total, CG, enveloppe)
- DIVERGENT : `features/flight-wizard/models/FlightPlanData.js:230-258` (`calculateWeightBalance`)

**2. Problème constaté**
`FlightPlanData.calculateWeightBalance()` fait `emptyWeight + passengers*passengersWeight + baggage + fuelWeight` (`:244-247`) — **un seul bras implicite, AUCUN moment, AUCUN CG** — et compare à `this.aircraft.maxWeight` (`:254`) qui vaut **0 par défaut** (`:27`, jamais peuplé : le wizard utilise `weights.mtow`).

**3. Impact (chiffré)**
3 occupants saisis individuellement (85+70+90 = 245 kg dans le store) vs `passengers(3) × 80 = 240 kg` (FlightPlanData) → masses différentes, et surtout **aucun CG produit donc aucune vérification d'enveloppe**. `withinLimits = takeoffWeight <= 0` → **toujours faux**. Deux vérités de masse au décollage. Conformité de centrage = sécurité directe.

**4. Solution concrète**
`weightBalanceStore` est le module canonique unique. Neutraliser `FlightPlanData.calculateWeightBalance()` (ne plus recalculer dans `updateWeightBalance:263-266`). `FlightPlanData` ne fait que **stocker** le résultat du store (comme le fait déjà `Step6WeightBalance.jsx:415-435`).

---

### B4 — `calculateDistance` (Haversine) re-codé dans 8 fichiers 🟠

**1. Localisation** (toutes des re-implémentations du canonique `navigationCalculations.js:29`)
- `features/alternates/hooks/useNavigationResults.js:74` (R=3440.065, sans cache)
- `features/alternates/hooks/useAlternatesIntegration.js:325` (**arrondi `Math.round(d*10)/10`** divergent ; fonction morte de surcroît)
- `features/alternates/hooks/useAlternateScoring.js:495` (fichier **sans aucun import**)
- `features/flight-wizard/components/RouteMapView.jsx:246` (`calculateDistanceKM`, **R=6371 km** — unité différente !)
- `features/navigation/components/WindAnalysis.jsx:172` (**R=3440.07** ≠ 3440.065)
- `features/navigation/components/VFRNavigationTable.jsx:74`
- `core/stores/navigationStore.js:25` (inline)
- `features/flight-wizard/models/FlightPlanData.js:322` (**ignore les waypoints intermédiaires** — distance directe départ→arrivée)

**2. Problème constaté**
Même fonction Haversine dupliquée 8×, dont plusieurs avec des constantes/comportements divergents (rayon Terre en km vs NM, 3e décimale différente, arrondi à 0.1 NM, omission des waypoints).

**3. Impact (chiffré)**
- `RouteMapView` en km : toute réutilisation naïve donne un résultat faux d'un facteur **1.852**.
- `useAlternatesIntegration` arrondi 0.1 : 12.47 NM → 12.5 NM, l'écart se propage dans le carburant de déroutement sur cumul de segments.
- `FlightPlanData` sans waypoints : sous-estime la distance d'une route multi-segments (cf. C2).

**4. Solution concrète**
Importer le canonique partout, supprimer les fonctions locales :
```js
import { calculateDistance } from '@utils/navigationCalculations';
```

---

### B5 — `calculateDistanceFromRoute` à formule INCORRECTE dans `alternateFilters` 🟠

**1. Localisation**
- `features/alternates/utils/alternateFilters.js:282-287` (`= Math.min(distToDeparture, distToArrival)`)
- vs cross-track canonique `navigationCalculations.js` `calculateDistanceToSegment` (utilisé correctement par `geometryCalculations.js:798`)
- 3e méthode maison dans `useAlternateScoring.js:527`

**2. Problème constaté**
`alternateFilters` calcule la « distance à la route » comme la distance au **point d'extrémité le plus proche**, pas la distance **perpendiculaire**. Trois méthodes incompatibles coexistent pour la même grandeur.

**3. Impact (chiffré)**
Route LFPG→LFPO (~14 NM), aérodrome à 3 NM perpendiculairement à mi-parcours : `alternateFilters` le voit à **7 NM** (min des extrémités), le scoring cross-track à **3 NM**. Avec `maxRadiusNM = 5`, le filtre **l'exclut à tort** alors que le scoring le classerait « excellent ». Résultats de déroutement incohérents selon le module.

**4. Solution concrète**
```js
import { calculateDistanceToSegment } from '@utils/navigationCalculations';
// dans checkDistanceCriteria :
const dist = calculateDistanceToSegment(point, departure, arrival);
```

---

### B6 — Interpolation linéaire 1D re-codée 4 fois 🟠

**1. Localisation**
- `services/operationResolver.js:175` (`interpolateY`, expose `extrapolated:'low'/'high'`)
- `services/abacInterpolation.js:337` (`interpolate1D`, clamp silencieux)
- `abac/curves/core/cascade.ts:50` (`findYForX`, **extrapole** dans 10% au-delà des bornes)
- `abac/curves/core/interpolation.ts:225-260` (branche linéaire)

**2. Problème constaté**
Quatre routines « interpoler Y pour X » au **comportement aux bornes divergent** : clamp vs clamp silencieux vs extrapolation.

**3. Impact**
Pour un X hors plage (altitude pression > plus haute courbe), `cascade.ts` extrapole (distance fausse) là où la chaîne live clampe. Comportement non déterministe selon le chemin de code.

**4. Solution concrète**
Extraire `interpolateY` (celle de `operationResolver.js:175`, la plus complète) dans `services/abacInterpolation.js` et l'importer partout. Supprimer `interpolate1D` et `findYForX`.

---

### B7 — 4 moteurs d'interpolation de performance en parallèle 🟠

**1. Localisation**
- CANONIQUE : `services/operationResolver.js` (`resolveOperation`) + `services/abacInterpolation.js` + `services/performanceTrilinearInterpolation.js`
- `features/aircraft/utils/performanceCharts.js:205-273` (bilinéaire + correction masse `Math.pow(weightRatio, 0.5)`)
- `features/performance/services/abacValidationService.js:207-313` (bilinéaire/trilinéaire ; `findBounds3D:357` est un **stub** `v:[[[0]]]`)
- `models/PerformanceModels.js:249-317` (IDW pondéré)

**2. Problème constaté**
La distance décollage/atterrissage est calculable par 4 moteurs aux formules incompatibles. La correction masse `pow(ratio, 0.5)` n'a aucune base MANEX.

**3. Impact**
Distances différentes pour conditions identiques. `PerformanceCalculator.jsx` reste atteignable hors wizard et contredit la matrice du `PerformanceModule`.

**4. Solution concrète**
Tout calcul de distance passe par `operationResolver.resolveOperation`. Déprécier `performanceCharts.js` + `PerformanceCalculator.jsx`, l'interpolation de `abacValidationService.js` (garder la validation/monotonie si utile) et de `PerformanceModels.js`. **Attention** : promouvoir d'abord `calculateDensityAltitude` (`performanceCharts.js:317`) vers un utilitaire partagé avant suppression (seule implémentation existante).

---

### B8 — groundSpeed vectoriel vs scalaire (`tas - headwind`) 🟡

**1. Localisation**
- CANONIQUE : `navigationCalculations.js` `calculateWindEffect` (vectoriel)
- `features/navigation/components/WindAnalysis.jsx:133` (`groundSpeed = tas - headwindComponent`)
- `features/navigation/components/VFRNavigationTable.jsx:119` (idem — tableau affiché au pilote)
- `shared/hooks/useWindCalculations.js:37-49` (vectoriel mais **bug : parenthèse `Math.sqrt(` non fermée :44-47**)

**2. Problème constaté**
La vitesse-sol est calculée par approximation scalaire (`tas − headwind`) au lieu du modèle vectoriel qui combine composante de face ET dérive.

**3. Impact (chiffré)**
TAS 100 kt, vent 30 kt à 60° : scalaire → GS = 100 − 15 = **85 kt** ; vectoriel → ≈ **85.6 kt**. À 90° (vent traversier pur), le scalaire ignore complètement l'effet → ETE et carburant supplémentaire faux, et **différents** entre `WindAnalysis` et `VFRNavigationTable` pour la même route.

**4. Solution concrète**
```js
import { calculateWindEffect } from '@utils/navigationCalculations';
// remplace le bloc headwind/WCA/groundSpeed
```
Corriger la parenthèse `useWindCalculations.js:44`.

---

### B9 — Pipeline carburant dupliqué avec réserves divergentes 🟡

**1. Localisation**
- `features/navigation/hooks/useNavigationResults.js:20-37` (câblé dans `Step7Summary`)
- `core/stores/navigationStore.js:18-48` (`calculateNavigationResults`)
- `features/flight-wizard/models/FlightPlanData.js:179-217` (`calculateFuel`)

**2. Problème constaté**
Trois implémentations de « distance + temps + trip fuel + réserve ». Réserve = 30/45/20 min (hooks) vs **0.5h/0.75h** (FlightPlanData) ; arrondis `ceil` vs `round`. La règle « local jour = 20 min » est absente de FlightPlanData.

**3. Impact**
Carburant réglementaire différent selon le module qui calcule. Le déroutement reçoit **+10 %** dans FlightPlanData (`:194`) mais pas dans `useAlternatesIntegration`.

**4. Solution concrète**
Factoriser via `calculateFuelRequired` canonique. `fuelStore.fuelData` = source unique du carburant ; supprimer `FlightPlanData.calculateFuel()` (cf. C4).

---

## 5. AXE C — Flux « Préparation de Vol » (wizard)

> **Constat structurel :** le wizard fait coexister **deux systèmes de calcul parallèles**. Système A = le modèle `FlightPlanData` (`calculateRouteDistance/Fuel/TOD/WeightBalance`). Système B = les stores/hooks (`useNavigationResults`, `fuelStore`, `weightBalanceStore`). Les étapes **affichent** le Système B mais la **sauvegarde** lit le Système A → donnée affichée ≠ donnée persistée.

### C1 — `useNavigationResults()` appelé SANS arguments → navigation jamais persistée 🔴

**1. Localisation**
- `features/flight-wizard/FlightPlanWizard.jsx:41` → `const navigationResults = useNavigationResults();` (aucun argument), utilisé `:399` dans `saveFlightPlan(...)`
- signature : `useNavigationResults(waypoints, flightType, selectedAircraft)` (`useNavigationResults.js:4`), qui `return null` si args manquants (`:7`)

**2. Problème constaté**
Appelé sans args, `navigationResults` vaut **toujours `null`** au niveau wizard.

**3. Impact**
`flightPlanSupabaseService.saveFlightPlan(..., navigationResults=null, ...)` → distance/temps/carburant de navigation **absents de la donnée persistée**, alors qu'ils sont correctement affichés (Step7 recalcule de son côté). **Le dossier de vol archivé est incomplet.**

**4. Solution concrète**
Calculer une seule fois au niveau wizard `useNavigationResults(waypoints, flightPlan.generalInfo.flightType, selectedAircraft)` et passer **ce même objet** à la sauvegarde ET en prop descendante à Step7Summary (supprime aussi le doublon C3/recalcul).

---

### C2 — Distance/temps : modèle (sans WP) ≠ hook (avec WP) 🟠

**1. Localisation**
- `models/FlightPlanData.js:322-343` (`calculateRouteDistance` : grand-cercle départ→arrivée **direct**)
- `hooks/useNavigationResults.js:19-41` (Haversine **sommée sur tous les waypoints**)
- Affichage : `Step7Summary.jsx:394-403` lit `navigationResults.totalDistance` (hook)
- Sauvegarde : `FlightPlanData.js:379-380` (`generateSummary` lit `route.distance` du modèle), appelée `FlightPlanWizard.jsx:388`

**2. Problème constaté**
`route.distance` (sans waypoints) ≠ `navigationResults.totalDistance` (avec waypoints). De plus, Step3Route mute `flightPlan.route` directement (`:231-265`) **sans appeler `updateRoute()`**, donc `calculateRouteDistance` ne tourne même pas.

**3. Impact**
Le PDF/écran affiche une distance ≠ de la distance archivée. Le `summary` sauvegardé est faux dès qu'il y a un point tournant.

**4. Solution concrète**
`useNavigationResults` = source unique. Écrire `navigationResults.totalDistance/totalTime` dans `flightPlan.route` via un seul `useEffect` dans Step3Route, ou supprimer `calculateRouteDistance` du modèle.

---

### C3 — Calcul TOD dupliqué ×3 avec hypothèses différentes 🟠

**1. Localisation**
- `steps/Step3Route.jsx:94-150` (alt cible `terrainElevation + 1000` **en dur**, `descentRate 500` en dur)
- `steps/Step7Summary.jsx:168-229` (alt cible et rate **éditables par state**)
- `models/FlightPlanData.js:271-309` (`calculateTOD`, **jamais appelé** → `todParameters` reste à 0)
- `steps/Step7TodParameters.jsx` (étape dédiée, **non branchée**, cassée)

**2. Problème constaté**
Même formule (`altitudeToDescent → descentTime → distanceToTod → Math.atan(.../6076.12)`) réécrite 3×, avec des hypothèses divergentes (altitude +1000 fixe vs éditable, rate 500 fixe vs éditable). groundSpeed `|| 120` ici vs `|| 100` dans `useNavigationResults.js:40`.

**3. Impact**
La carte (Step3) et la synthèse imprimée (Step7) affichent des TOD différents pour le même vol. `todParameters` sauvegardé reste à 0.

**4. Solution concrète**
Extraire `useTodCalculation({ waypoints, segmentAltitudes, plannedAltitude, descentRate, targetAltitude, aircraft })` dans `features/navigation/hooks/`. Step3Route et Step7Summary l'appellent ; persister le résultat dans `flightPlan.todParameters`. Supprimer `Step7TodParameters.jsx`.

---

### C4 — Copies d'état local depuis les stores (désync) 🟡

**1. Localisation**
- **Avion** re-synchronisé via `useEffect` + import dynamique du store dans : `FlightPlanWizard.jsx:107-137`, `Step3Route.jsx:152-178`, `Step4Alternates.jsx:63-97`, `Step6WeightBalance.jsx:147-270`, `Step7Alternates.jsx:189-215`
- **fobFuel** recopié dans : `FlightPlanWizard.jsx:194-203`, `Step5Fuel.jsx:90-127`, `Step6:272-281`, `Step7Alternates.jsx:109-122`
- **loads** recopiés `flightPlan.weightBalance.loads` ↔ `weightBalanceStore` : `FlightPlanWizard.jsx:206-217`, `Step6:283-307`

**2. Problème constaté**
La même donnée (avion, FOB, loads) est maintenue dans **3 contenants** (`flightPlan`, contexte React, store Zustand) avec des `useEffect` de copie bidirectionnelle dans presque chaque étape. Step6 recrée `weightBalance` depuis `arms` à deux endroits (`:61-143` ET `:193-238`).

**3. Impact**
Conditions de course au montage (l'ordre des `useEffect` détermine qui gagne). Les commentaires `FlightPlanWizard.jsx:112-120` (« fusionner sinon undefined écrase ») et `Step6:155` (« NE PAS recharger sinon écrase ») sont des symptômes de désync déjà rencontrées.

**4. Solution concrète**
Une source de vérité par donnée : le store Zustand pour avion/fuel/loads. `flightPlan` ne contient que des **références** (registration, confirmed L) hydratées à la sauvegarde. Centraliser la synchro dans **un seul** effet au niveau wizard (`FlightPlanWizard.jsx:139-226`) ; supprimer les re-synchros par étape. Mapper `arms → weightBalance` une seule fois (dans `aircraftStore` au chargement).

---

### C5 — Densité carburant L→kg recalculée ×4 🟡
**Localisation :** `FlightPlanData.js:236-240`, `Step6WeightBalance.jsx:321-322` et `:640-641`, `Step7Summary.jsx:572-577` (fallback `0.84` divergent).
**Problème/Impact :** densité rederivée partout (parfois `DENSITIES`, parfois `FUEL_DENSITIES`) → masse carburant légèrement différente entre centrage (Step6) et affichage (Step7).
**Solution :** un seul helper `getFuelDensity(aircraft.fuelType)`, supprimer les fallbacks ad hoc.

### C6 — `plannedAltitude = 3000` codé en dur ×4 🟡
**Localisation :** `Step3Route.jsx:91`, `Step7Summary.jsx:45`, `FlightRecapTable.jsx:458`, `FlightPlanData.js:97`.
**Problème/Impact :** fallback du TOD et du récap des espaces aériens divergent de l'altitude réelle (`segmentAltitudes` du NavigationContext).
**Solution :** constante unique `DEFAULT_PLANNED_ALTITUDE`, dériver depuis `segmentAltitudes`.

### C7 — Rayon d'action recalculé ×2 avec FOB utilisable différent 🟡
**Localisation :** `Step7Summary.jsx:276-310` (FOB − taxi − contingency) vs `Step7Alternates.jsx:218-249` (FOB − taxi − climb − cruise, + fallback lisant `fuel.cruise=0` stale).
**Problème/Impact :** le rayon d'action de la synthèse contredit la zone de recherche des déroutements de l'étape précédente.
**Solution :** centraliser endurance/rayon dans `useAlternateSelection`/`coneZoneParams` (déjà source des déroutements) ; Step7Summary lit ces mêmes valeurs.

---

## 6. Bugs bloquants découverts (bonus hors périmètre strict)

Ces éléments ne sont pas que de la duplication — ce sont des **défauts fonctionnels** :

| Fichier:ligne | Défaut |
|---|---|
| `core/stores/supabaseAircraftStore.js:166` | `React.useEffect` sans import de `React` → crash si monté |
| `shared/hooks/useWindCalculations.js:44-47` | Parenthèse `Math.sqrt(` non fermée → `return` avalé, GS invalide |
| `flight-wizard/FlightPlanWizard.jsx:41` | `useNavigationResults()` sans args → navigation toujours `null` (cf. C1) |
| `flight-wizard/models/FlightPlanData.js:254` | `withinLimits = takeoffWeight <= maxWeight(0)` → toujours faux (cf. B3) |
| `abac/curves/core/cascade.ts:567-595` | Magic numbers MANEX (1.914, Y=870) (cf. B2) |
| `models/PerformanceModels.js:572` | `);}` — parenthèse parasite, erreur de syntaxe probable |
| `features/aircraft/components/PerformanceModelVisualization.jsx:164,228,306` | Parenthèses/JSX non fermés ; `calculateDistance:207` = formule factice inventée |
| `flight-wizard/steps/Step4Alternates.jsx:1,6,182` | Fences Markdown ` ``` ` + import cassé → **ne compile pas**, pourtant exporté par `steps/index.js:4` |
| `flight-wizard/steps/Step7TodParameters.jsx:241-243` | JSX `return` non fermé avant `const styles` |
| `flight-wizard/steps/index.js` | Barrel incohérent : exporte `Step4Alternates` (cassé), omet `Step3VAC`/`Step7Alternates` réellement utilisés |

---

## 7. Feuille de route de refactoring (priorisée)

### Phase 1 — Sécurité & cohérence des calculs (URGENT)
1. **B1** Unifier le facteur de sécurité sur `performanceSafetyFactor.js` ; corriger le texte 1.25 ; supprimer les facteurs piste de `performanceCharts.js`.
2. **B3 + B2** Neutraliser `FlightPlanData.calculateWeightBalance` (déléguer au store) ; supprimer les magic numbers `cascade.ts`.
3. **C1** Corriger l'appel `useNavigationResults()` (passer les args) → restaurer la persistance de la navigation.

### Phase 2 — Source de données unique
4. **A2** Réactiver le chargement Supabase au boot ; faire d'IndexedDB un cache lecture seule.
5. **A1** Supprimer `supabaseAircraftStore.js` + `SupabaseInitializer.jsx`.
6. **A4 + A5** Une seule copie cache (IndexedDB par `supabaseId`/checksum) pour MANEX et VAC ; supprimer `manexStore`, `customVACCharts`, le champ `manex` de `aircraftData`.

### Phase 3 — Centralisation des calculs
7. **B4/B5/B8** Importer `navigationCalculations.js` partout (distance, cross-track, `calculateWindEffect`) ; supprimer les 8 Haversine locaux.
8. **B6/B7** Moteur d'abaque/interpolation unique (`abacInterpolation` + `operationResolver`) ; promouvoir `calculateDensityAltitude` avant de déprécier `performanceCharts.js`.
9. **C2/C3/C9** Hooks uniques `useNavigationResults` (distance/temps) et `useTodCalculation` (TOD) consommés par toutes les étapes.

### Phase 4 — `FlightPlanData` devient un conteneur pur
10. Retirer tous les `calculate*()` du modèle ; il ne stocke que des références + résultats recopiés au moment de la sauvegarde. `generateSummary()` lit les mêmes valeurs que l'écran.
11. **C4** Une source de vérité par donnée (store) ; supprimer les `useEffect` de copie bidirectionnelle par étape.
12. Supprimer les fichiers morts (`Step4Alternates`, `Step4Weather`, `Step7TodParameters`, `communityAircraftDatabase`) ; reconstruire `steps/index.js`.

### Cible architecturale
```
Supabase (source de vérité)
   │  hydrate au boot
   ▼
Stores Zustand (aircraft / fuel / weightBalance / navigation)  ← UNIQUE état métier
   │                          │
   │  cache lecture seule     │  calculs centralisés
   ▼                          ▼
IndexedDB (blobs lourds)   navigationCalculations.js / operationResolver.js / performanceSafetyFactor.js
                              │
                              ▼
                    Hooks (useNavigationResults, useTodCalculation, useAlternateSelection)
                              │
                              ▼
              Composants & Steps (AFFICHENT, ne recalculent pas)
                              │
                              ▼
              FlightPlanData = CONTENEUR (références + snapshot au save)
```

---
*Audit réalisé en lecture seule. Aucun fichier source modifié.*
