# AUDIT GLOBAL — HARD-CODING, BDD LOCALES & FALLBACKS (toute l'application)

> **Cible architecture** : récupération **UNIQUE et centralisée via Supabase** (BDD fonctionnelle). Toute donnée requise absente ⇒ **Exception stricte + blocage**, jamais de valeur par défaut silencieuse.
> **Méthode** : 6 agents d'audit en parallèle, un par cluster de dossiers (`data`, `services`, `stores`, `utils`, `features`, `tests/scripts`).
> **Volume** : **~286 occurrences** classées. Le présent document = inventaire exhaustif + plan de redirection + conversions fail-safe.
> **Limite** : MCP Supabase déconnecté au moment de l'audit ⇒ le « Statut BDD » est **inféré** depuis la couche service et le scan de schéma. À confirmer en base avant exécution.

---

## 0. Synthèse exécutive

| Domaine | Périmètre | Findings | Critiques (P0) |
|---|---|---|---|
| DATA | `src/data`, `features/*/data`, `config` | 20 | Stripe priceId, fallbackRunways actif |
| SERVICES | `src/services`, `core/data`, `lib` | 46 | Clé AVWX en clair, MODE DEV bypass, supabaseClient sans garde, getDefaultAirspaces |
| STORES | `core/stores`, `features/*/stores` | 42 | `fixFHSTREmptyWeight`, navigation `||100/||30`, vacStore lat/lon 0, defaults M&C |
| UTILS/MODELS/HOOKS | `src/utils`, `models`, `hooks`, `shared` | 97 | climb 700fpm fictif, facteurs perf inventés, bras→0, 9 fichiers test en prod |
| FEATURES | `features/{alternates,perf,fuel,nav,wizard,aircraft,weather}` | 43 | trilinéaire→0, ABAC→0, FlightPlanData double moteur, density 0.8 |
| TESTS/SCRIPTS | `__tests__`, `scripts`, `test*/debug*` | 38 | PII `window.testExportImport`, debugger monté en prod, snapshots F-HSTR |

**Verdict** : le **noyau Masse & Centrage** (`weightBalanceStore`, `cgEnvelope`, `fuelDensity`) est désormais sain (cf. `AUDIT_HARDCODING_MASSE_CENTRAGE.md`), mais **tout le reste de l'application** présente la pathologie inverse — **fallback silencieux systématique**. Le même défaut est répété par copier-coller à travers des dizaines de fichiers. **La remédiation se pilote par PATTERN (§1), pas finding par finding.**

---

## 1. PATTERNS TRANSVERSES — le vrai levier de remédiation

> Corriger une fois le pattern (helper partagé), puis appliquer mécaniquement à toutes ses occurrences. C'est l'unité de travail.

### PATTERN-1 — Vitesse de croisière / conso inventées (`|| 100`, `|| 120`, `|| 30`, `|| 40`)
Occurrences : `STORE-006/007`, `FEAT-01/02/08/17/21/22`, `UTIL-051`, `FlightPlanData.calculateRouteDistance`.
**Impact** : tous les temps de vol, carburants, rayons de déroutement faux pour un avion dont la fiche est incomplète — **sans aucune alerte**.
**Cible** : `requireAircraftField(aircraft, 'cruiseSpeedKt')` / `'fuelConsumption'` → throw `MissingDataError`. Helper unique, zéro `||`.

### PATTERN-2 — Densité carburant fantôme (`?? 0.72`, `?? 0.84`, `* 0.8`)
Occurrences : `FEAT-20` (0.8 dans FuelModule), `FEAT-42` (0.72 PilotLogbook), `UTIL-055` (0.72), + les 6 du doc M&C (`?? 0.84`/`?? 0.72`).
**Impact** : même `fuelType` inconnu ⇒ densité différente selon l'écran (0.72 / 0.8 / 0.84) ⇒ masse carburant divergente. SSOT violée.
**Cible** : `requireDensity(fuelType)` (déjà spécifié dans le doc M&C) partout, **interdiction du littéral densité hors `constants.FUEL_DENSITIES`**.

### PATTERN-3 — Erreur Supabase avalée (`catch { return [] }` / `return null`)
Occurrences : `SVC-011…024`, `SVC-032`, `SVC-045` (≈ 15 services : presets, plans de vol, PDFs validés, points VFR, cartes VAC, stats).
**Impact** : une panne réseau/Supabase est **indiscernable d'une absence de données**. L'UI affiche « rien » comme si la base était vide.
**Cible** : propager l'erreur (`throw`) + `recordSupabaseError(context, err, meta)`. Distinguer `null` métier (404 légitime) d'une erreur réseau.

### PATTERN-4 — Bras / masse → 0 (centrage faussé silencieusement)
Occurrences : `UTIL-001…007` (`aircraftNormalizer` `parseArm(...,0)`), `STORE-036`, `aircraftValidation cgLimits null`, + `calculations.js` (doc M&C).
**Impact** : station chargée sans bras ⇒ moment 0 ⇒ **CG faux d'apparence valide**. Le plus dangereux.
**Cible** : `requireFinite(arm, label)` pour toute station chargée ; enveloppe absente ⇒ verdict bloqué, jamais `cgLimits = null` silencieux.

### PATTERN-5 — Données aéronautiques FANTÔMES de secours
Occurrences : `SVC-025/026` (`getDefaultAirspaces` = faux CTR LFPG), `FEAT-10/11` (`getMinimalAirports` = 10 AD inventés), `FEAT-09` (pistes inventées asphalt/grass), `STORE-019` (carte VAC créée à `lat:0,lon:0`), `STORE-021` (checklists génériques d'un avion fictif), `FEAT-39/41` (zone floor 0 / ceiling 99999).
**Impact** : un pilote se voit présenter des **données aéronautiques fictives comme réelles** (espace, aérodrome, piste, position, checklist).
**Cible** : **interdiction absolue de fabriquer une entité aéronautique**. La source échoue ⇒ `throw` + écran d'erreur.

### PATTERN-6 — Calcul de performance FICTIF / non implémenté
Occurrences : `UTIL-045/046/048/049/050` (climb 700 fpm + facteurs 0.10/0.015 « fictifs »), `FEAT-32` (`findBounds3D` trilinéaire `// TODO` ⇒ retourne 0), `FEAT-33/34` (extrapolation/nearest ⇒ `|| 0`), `FEAT-31/35` (ISA 15°C, masse 1000 kg supposées), `PerformanceModels` placeholders (doc M&C : `cgInLimits:true`).
**Impact** : distances décollage/atterrissage, montée, **retournées à 0 ou inventées** sans alerte. Bombe sécurité.
**Cible** : `throw new Error('<calcul> non implémenté / données insuffisantes')`. Jamais une valeur plausible.

### PATTERN-7 — Variable d'env avec fallback localhost/littéral
Occurrences : `STORE-024` (`VITE_API_BASE_URL || 'http://localhost:3000/api'`), `DATA-20` (Stripe `|| 'price_monthly'`), `SVC-008/009/010` (localhost), `SVC-031` (supabaseClient créé sans garde), `FEAT-30` (endpoint IA), `UTIL-075` (tracking localhost).
**Impact** : en prod sans env var, l'app « marche » en apparence mais tape localhost / envoie un priceId fictif / crée un client Supabase `undefined` ⇒ échecs silencieux.
**Cible** : `requireEnv('VITE_...')` au **boot** (fail-fast). Aucun fallback de prod.

### PATTERN-8 — Secrets en dur / variables d'env mortes (CRA)
Occurrences : `SVC-001` (**clé AVWX en clair dans le bundle**), `SVC-002/003` (spreadsheetId Google dupliqué), `SVC-004/005/006` (`process.env.REACT_APP_*` — préfixe CRA **mort sous Vite**, toujours vide), `SVC-040/041/042` (credentials OAuth dans localStorage).
**Impact** : secret exposé à tous les clients ; variables jamais chargées (clé absente silencieusement) ; credentials falsifiables.
**Cible** : tout secret via `import.meta.env.VITE_*` + backend ; `throw` si absent ; rotation de la clé AVWX exposée.

### PATTERN-9 — Contournement de sécurité « MODE DEV »
Occurrences : `SVC-033/034` (vérif ownership `uploaded_by !== userId` **commentée** ⇒ tout user peut modifier/supprimer n'importe quel point VFR), `SVC-035/036/037` (`userId = 'anonymous'` par défaut ⇒ RLS impossible).
**Impact** : faille d'autorisation ouverte en production.
**Cible** : réactiver les contrôles ; `throw` si `userId` absent ; jamais d'`'anonymous'`.

### PATTERN-10 — Fichiers de test/debug dans le bundle de PRODUCTION
Occurrences : `TEST-10…26`, `UTIL-068…076` (≈ 15 fichiers) : `testCompleteExportImport.js` (**PII Jean Dupont via `window.testExportImport`, sans garde**), `PerformanceDataDebugger` (**monté en dur en prod**), `testAPIKey/testEnvVars` (exposent un aperçu de clé), `diagnoseIndexedDB` (suppression BDD sur `window`), `debugCertifications`/`testLicensesImportExport` (injectent dans localStorage réel).
**Impact** : surface d'attaque + corruption de données utilisateur en prod.
**Cible** : déplacer en `scripts/dev-tools/`, ou garde `import.meta.env.DEV` + exclusion bundle. Supprimer les hooks `window.*`.

### PATTERN-11 — BDD locales doublonnant Supabase / SIA
Occurrences : `DATA-04/05` (`frenchAirspaces*.js` orphelins, doublon `airspaces.geojson`), `DATA-18` (`communityAircraftDatabase.js` vide, migré), `DATA-01` (`fallbackRunways.js` actif), `DATA-15` (`aeroclubsFR.json` figé), `DATA-19` (`regulationsData.js` figé).
**Cible** : caches **SIA GeoJSON** = légitimes (à garder, servis statiquement). Le reste → Supabase (tables à créer) ou suppression.

### PATTERN-12 — Correctif `F-HSTR` codé en dur (avion réel)
Occurrences : `STORE-032`/`TEST-25` (`fixFHSTREmptyWeight()` force `emptyWeight:'900'`), `TEST-27/28/29/30/31/32` (snapshots + scripts d'injection directe), `TEST-26` (`pilotName="F-HSTR"` en prop par défaut), `duplicateAircraft.js`.
**Cible** : la donnée corrigée vit **uniquement dans Supabase** ; supprimer toute trace `F-HSTR` du code applicatif.

---

## 2. ÉTAPE 1 — IDENTIFICATION (inventaire exhaustif, dossier par dossier)

> Types : **A** hardcodé · **B** BDD locale/doublon · **C** fallback silencieux · **D** constante légitime (centraliser) · **E** résidu dev/test en prod · **SEC** faille sécurité · **F** fixture de test légitime.

### 2.1 — `src/data`, `features/*/data`, `config` (DATA)

| ID | Emplacement | Type | Problème | Statut BDD | Action |
|---|---|---|---|---|---|
| DATA-01 | `data/fallbackRunways.js:4-136` | A | 6 aérodromes + pistes hardcodés | doublon `runways.geojson` | Supprimer ; throw si AD introuvable |
| DATA-02/03 | `fallbackRunways.js:144,152` | C | `return FALLBACK[icao] ?? null` | — | throw si ICAO inconnu |
| DATA-04 | `data/frenchAirspaces.js:8-419` | A/B | ~40 espaces aériens approximatifs (orphelin) | doublon `airspaces.geojson` | **Supprimer** |
| DATA-05 | `data/frenchAirspacesManual.js:6-268` | A/B | 4 features GeoJSON approx, AIRAC périmé (orphelin) | doublon | **Supprimer** |
| DATA-06/07 | `data/airspaces/*.txt` | A | fichiers vides | — | Supprimer |
| DATA-08…14 | `data/derived/geojson/*` | D | caches SIA (20 573 features, AIRAC 2026-05-14) | hors Supabase (cache ETL) | **Conserver** (statique `/public`) ; CI régénère par cycle |
| DATA-15 | `data/aeroclubsFR.json` | B | 156 aéroclubs figés au build | absent Supabase | Créer table `aeroclubs` ; fetch + throw si vide |
| DATA-16 | `data/aixm.config.js:31` | D | nom fichier AIXM hardcodé | — | basse prio ; scanner `/public/data` |
| DATA-17 | `config/airacConfig.js:8-38` | D | calendrier AIRAC 2025-26 en dur | — | OK ; calculer (AIRAC0 + n×28j) |
| DATA-18 | `features/aircraft/data/communityAircraftDatabase.js:8` | B | tableau vide, import zombie | migré `community_presets` | Supprimer + nettoyer import `aircraftVersioningService` |
| DATA-19 | `features/regulations/data/regulationsData.js:2-500` | A/B | ~30 blocs EASA figés (541 l.) | absent Supabase | Créer table `regulations` ; fetch + throw |
| DATA-20 | `features/billing/config/products.js:18,27` | C | `priceId … || 'price_monthly'` | env Stripe | **Supprimer fallback** ; throw au load si env absent |

### 2.2 — `src/services`, `core/data`, `lib` (SERVICES)

| ID | Emplacement | Type | Problème | Statut BDD/env | Action |
|---|---|---|---|---|---|
| SVC-001 | `weatherAPI.js:10` | A/SEC | **clé AVWX en clair** dans le bundle | env dupliquée | Retirer littéral ; throw si `VITE_AVWX_API_KEY` absent ; **roter la clé** |
| SVC-002/003 | `googleSheetsService.js:9`, `taskTrackingService.js:5` | A | spreadsheetId Google en dur (×2) | pas d'env | `VITE_GOOGLE_SPREADSHEET_ID` ; throw |
| SVC-004/005/006 | `taskTrackingService.js:9,10,248` | A/SEC | `process.env.REACT_APP_*` (mort sous Vite) | env morte | `import.meta.env.VITE_*` ; throw |
| SVC-007 | `googleSheetsService.js:75` | A | `'YOUR_BACKEND_ENDPOINT/...'` littéral | jamais branché | `VITE_*` ; throw |
| SVC-008/009 | `vacDownloadService.js:177,294` | A | `http://localhost:3001/...` en dur | dev-only | `VITE_VAC_PROXY_URL` ; throw en prod |
| SVC-010 | `hybridAirspacesService.js:14` | C | `|| 'http://127.0.0.1:3002'` | env partielle | throw en prod ; fallback dev only |
| SVC-011…024 | `communityService:101`, `flightPlanSupabaseService:144/152/171/220`, `validatedPdfService:208/235/290/434`, `vfrPointsService:39/212`, `vacSupabaseService:118/172` | C | `catch { return [] / null }` (≈14) | Supabase actif | **throw + `recordSupabaseError`** |
| SVC-020 | `communityService.js:282` | C | `recordDownload` catch « ne pas bloquer » | Supabase | logger au moins |
| SVC-025/026 | `aixmAirspacesParser.js:73,116` | E | `getDefaultAirspaces()` = **faux CTR LFPG** | statique | Supprimer ; throw |
| SVC-027/028/029 | `hybridAirspacesService.js:47/61/488` | C | fallback silencieux AIXM puis `[]` | statique | logger ; throw si 2 sources KO |
| SVC-030 | `GeoJSONProvider.js:67` | C | structure vide assignée avant throw | statique | retirer l'assignation |
| SVC-031 | `supabaseClient.js:7` | SEC | client créé même si URL/clé `undefined` (console.error only) | env Supabase | **throw au boot** si absent |
| SVC-032 | `supabaseAuth.js:22` | C | `catch { return null }` (getCurrentUserId) | auth | distinguer pas-de-session / erreur |
| SVC-033/034 | `vfrPointsService.js:295,332` | **SEC** | ownership **commentée « MODE DEV »** | Supabase | réactiver ; throw si non-propriétaire |
| SVC-035/036/037 | `vfrPointsService.js:92,138`, `vacSupabaseService.js:67` | SEC | `userId/uploadedBy = 'anonymous'` | Supabase | throw si absent |
| SVC-038 | `communityService.js:719` | C | `manufacturer||'Inconnu'`, `category||'SEP'` **écrits en BDD** | Supabase | throw si champs obligatoires absents |
| SVC-039 | `vacSupabaseService.js:293` | C | faux checksum si `crypto.subtle` KO | client | logger ; pas de faux checksum |
| SVC-040/041/042 | `googleSheetsService:18`, `simpleTrackingService:9`, `updateLoggerService:13` | A/SEC | URLs/credentials en localStorage | pas d'env | `VITE_*` ; pas de localStorage |
| SVC-043 | `vacDownloadService.js:42` | A | `new Date('2024-01-25')` AIRAC figée | — | lire depuis `getDataInfo()` |
| SVC-044 | `hybridAirspacesService.js:393` | A | mapping ville→ICAO (50+) en dur | GeoJSON dispo | lookup `aeroDataProvider` |
| SVC-045 | `GeoJSONProvider.js:476` | C | `airac:null` masqué | statique | throw si dataInfo absent |
| SVC-046 | `communityService.js:56` | C | refresh JWT silencieux puis throw | auth | OK (vérifier throw final) |

### 2.3 — `core/stores`, `features/*/stores` (STORES)

| ID | Emplacement | Type | Problème | Statut BDD | Action |
|---|---|---|---|---|---|
| STORE-001/002/005 | `fuelStore.js:11,14,103` | C | roulage 1 gal / alternate 2 gal en dur | profil avion | lire profil ; init 0 ; pas de faux plancher |
| STORE-003 | `fuelStore.js:43` | C | `Math.max(1.0, gal*0.05)` plancher contingence | réglementation | % seul ; centraliser |
| STORE-004 | `fuelStore.js:68` | C | FOB `… : 0` si payload invalide | — | throw si ni ltr ni gal |
| STORE-006 | `navigationStore.js:50` | C | `cruiseSpeed || 100` | Supabase | **throw** (PATTERN-1) |
| STORE-007 | `navigationStore.js:52` | C | `fuelConsumption || 30` | Supabase | **throw** (PATTERN-1) |
| STORE-008 | `navigationStore.js:55-58` | A | réserves 30/45/20 min en dur | absent Supabase | table `regulation_profiles` |
| STORE-009/010 | `navigationStore.js:91,113` | C | altitude/speed UI 3000/100 | UI | OK / retourner null si non configuré |
| STORE-011 | `alternatesStore.js:27` | A | minima météo VFR/IFR en dur | absent Supabase | `regulation_profiles` |
| STORE-012 | `alternatesStore.js:19` | C | `bufferDistance:20 NM` arbitraire | — | calculer (autonomie×temps) |
| STORE-013 | `alternatesStore.js:41` | C | limite 3 déroutements | — | OK (documenter) |
| STORE-014 | `openAIPStore.js:53` | C | `countryCode='FR'` (×4) | profil user | lire profil ; pas de défaut |
| STORE-015/017 | `openAIPStore.js:63,243` | C/D | TTL 10 min / tol 0.001 | — | constantes nommées |
| STORE-016 | `openAIPStore.js:54` | C | provider KO ⇒ `airports=[]` + return | service | **throw** |
| STORE-018 | `openAIPStore.js:343` | C | import `data.airports || []` | — | valider ; throw si absent |
| STORE-019 | `vacStore.js:122` | C | **carte VAC créée à `{lat:0,lon:0}`** | local PDF | throw si coords absentes |
| STORE-020 | `vacStore.js:97` | C | `JSON.parse(... || '{}')` non gardé | localStorage | try/catch explicite |
| STORE-021/022 | `checklistStore.js:146,148` | A/E | **checklists génériques** d'un avion fictif + IDs fixes | absent Supabase | charger par type avion ; pas de défaut |
| STORE-024 | `authStore.js:5` | C/SEC | `VITE_API_BASE_URL || 'localhost:3000'` | env | **throw au boot** (PATTERN-7) |
| STORE-025 | `authStore.js:99…` | C | `entitlements || []` (perte de droits) | API auth | distinguer null/[] |
| STORE-026 | `authStore.js:117` | C | cache offline 1h ⇒ premium après révocation | cache | documenter risque |
| STORE-027 | `aircraftStore.js:56` | C | liste vide silencieuse | Supabase | forcer le caller à vérifier l'erreur |
| STORE-028/030 | `aircraftStore.js:77,273` | C | `hasManex||false`, `manufacturer||'Inconnu'` | Supabase | OK champs non critiques |
| STORE-029/031 | `aircraftStore.js:87,275` | C | `category||'SEP'`, type undefined | Supabase | throw si catégorie absente |
| STORE-032 | `aircraftStore.js:697-735` | **E** | **`fixFHSTREmptyWeight()` ⇒ `'900'`** | Supabase | **Supprimer** (PATTERN-12) |
| STORE-033/034 | `aircraftStore.js:174,609` | C | auto-sélection `list[0]` | UI | persister le choix |
| STORE-035 | `aircraftValidation.js:21` | A | `DEFAULT_AIRCRAFT_VALUES` (baggage 50, aux 20, fuelType) | Supabase | supprimer ; ne jamais inventer une limite |
| STORE-036 | `aircraftValidation.js:235` | C | `cgLimits = {forward:null,aft:null}` | Supabase | throw / verdict bloqué |
| STORE-037 | `manexStore.js:98` | C | quota ⇒ sans PDF | IndexedDB | OK (rethrow présent) + warn UI |
| STORE-038 | `weatherStore.js:31` | C | `fetchTAF().catch(()=>null)` | API | logger l'erreur séparément |
| STORE-039/042 | `weatherStore.js:14`, `unitsStore.js:11` | C/D | refresh 30 min / unités défaut | UI | OK (constantes) |
| STORE-040/041 | `customVFRStore.js:27,174` | C | sauvegarde durable KO silencieuse | IndexedDB | propager / flag erreur |

### 2.4 — `src/utils`, `models`, `hooks`, `shared` (UTILS)

| ID | Emplacement | Type | Problème | Statut BDD | Action |
|---|---|---|---|---|---|
| UTIL-001…007 | `aircraftNormalizer.js:77-155` | C | **`parseArm(...,0)`** : bras/maxWeight → 0 | Supabase `arms.*` | throw si station chargée sans bras (PATTERN-4) |
| UTIL-005 | `aircraftNormalizer.js:119` | C | `cgLimits = null` | Supabase `cgEnvelope` | throw si enveloppe absente |
| UTIL-008 | `aircraftNormalizer.js:238` | A | `exportedBy:'ALFlight-User'` | — | vrai user Supabase |
| UTIL-009 | `aircraftNormalizer.js:281` | C | conversion KO ⇒ valeur brute | — | throw `ConversionError` |
| UTIL-010/011 | `aircraftNormalizer.js:307,317` | C | unité → storage si pref absente | — | warn + log |
| UTIL-012/013/014 | `navigationCalculations.js:89,108,119` | C | dist/temps/fuel → 0 si input absent | — | throw si GS/conso requise |
| UTIL-015…023 | `dataBackupManager.js`, `indexedDBStorage.js` | A/D | versions, intervalles, seuils LS en dur | local | centraliser constantes nommées |
| UTIL-018/019 | `dataBackupManager.js:392,521` | A | `id || aircraft_${Date.now()}` | Supabase id | throw si id absent |
| UTIL-024 | `indexedDBStorage.js:336` | C | getStorageSize KO ⇒ 0 | local | throw/log |
| UTIL-025 | `aircraftPerf.js:16` | C | `>0 ? v : null` | Supabase | **OK — conforme cible** |
| UTIL-026/027/032 | `runwayWindUtils.js`, `windComponent.js` | C | composantes vent → 0 si invalide | — | OK (conservateur + flag) |
| UTIL-028 | `performanceSafetyFactor.js:93` | C | id inconnu ⇒ facteur brut ×1.0 | — | OK (brut = safe) |
| UTIL-029/030 | `elevationUtils.js:43,49` | C | élévation → 0 ft si absente | Supabase | throw si requise pour perf |
| UTIL-033/034/035 | `unitsDisplay.js:50,81,107` | C | catégorie inconnue/conv KO ⇒ null/brut | — | throw `ConversionError` |
| UTIL-037…043/096 | `storageUtils.js`, `performanceDataManager.js` | A | seuils Mo/compression en dur | local | constantes nommées |
| UTIL-044 | `usePerformanceCalculations.js:13` | D | gradient ISA 0.002/ft | — | constante `ISA_LAPSE_RATE` |
| UTIL-045/046 | `usePerformanceCalculations.js:21,22` | A | **facteurs alt 0.10 / temp 0.015 INVENTÉS** | inventé | **throw — utiliser MANEX** (PATTERN-6) |
| UTIL-047 | `usePerformanceCalculations.js:32` | C | masse absente ⇒ facteur 0 | — | throw si requise |
| UTIL-048/049/050 | `usePerformanceCalculations.js:46-52` | **E** | **climb 700 fpm fictif** (« devrait venir des données avion ») | inventé | **throw immédiat** |
| UTIL-051/052/054 | `useAircraftCalculations.js:14,21,33` | C | GS/avion absent ⇒ 0 | Supabase | throw si requis |
| UTIL-053 | `useAircraftCalculations.js:27` | C | fuel = capacité totale si non spécifié | Supabase | OK (voulu) |
| UTIL-055 | `useAircraftCalculations.js:49` | C | `getFuelDensity(...) ?? 0.72` | Supabase | **throw** (PATTERN-2) |
| UTIL-056 | `useAircraftCalculations.js:43` | A | conversions dupliquées | — | utiliser `convertValue` |
| UTIL-057/058 | `useWindCalculations.js:23,36` | C | TAS absent ⇒ 0 | — | throw si requis |
| UTIL-059/060/062 | `useAirportNames.js:66,89`, `useAirportCoordinates.js:33` | C | élévation `|| 0` / null | Supabase | distinguer null vs 0 |
| UTIL-063 | `useActiveRunwayWind.js:56` | A | QFU `|| 0` si parse KO | VAC | throw si QFU invalide |
| UTIL-066 | `geographicZones.js:45` | A | altitudes AD montagne en dur | — | OK si table documentée |
| UTIL-067 | `performanceDataManager.js` | E | données perf en localStorage (hors BDD) | local | migrer Supabase/IndexedDB |
| UTIL-068…076 | `testAPIKey/testEnvVars/testCompleteExportImport/testGoogleSheets/testLicensesImportExport/debugCertifications/diagnoseIndexedDB/cleanTestAircraft/duplicateAircraft.js` | **E** | **9 fichiers test/debug dans le bundle prod** | dev | déplacer/garde DEV (PATTERN-10) |
| UTIL-075 | `autoTracking.js:8` | A | `TRACKING_ENDPOINT = 'localhost:3001'` | dev | `VITE_TRACKING_URL` |
| UTIL-079…089 | `performanceExcelImport.js`, `runwayDirections.js`, `aixmDataValidator.js` | C | IDs/dates/distances fallback | local/SIA | log warn (acceptables) |
| UTIL-085/086/087 | `pdfExtractors.js:126,354,371` | A | URLs CDN (PDF.js/Tesseract) figées | externe | constante + version |
| UTIL-090…095 | `useLocalStorage.js`, `useUnits.js`, `useManexData.js` | C | fallbacks hooks génériques | local | OK (documenter) |

### 2.5 — `features/{alternates,performance,fuel,navigation,flight-wizard,aircraft,weather}` (FEATURES)

| ID | Emplacement | Type | Problème | Statut BDD | Action |
|---|---|---|---|---|---|
| FEAT-01/08 | `useAlternateSelection.js:419,765` | C | `cruiseSpeed || 120` (×2) | Supabase | **throw** (PATTERN-1) |
| FEAT-02 | `useAlternateSelection.js:492` | C | `fuelConsumption || 40` | Supabase | **throw** |
| FEAT-03 | `useAlternateSelection.js:425` | A | heuristique unité (<60 L / <20 L/h) | unité non stockée | stocker `fuelCapacityUnit` ; throw si absent |
| FEAT-04 | `useAlternateSelection.js:539` | C | rayon plafonné 100/50 NM si FOB absent | étape Fuel | avertir ; pas de recherche sans FOB |
| FEAT-05 | `useAlternateSelection.js:562` | D | `DIVERSION_TIME_H = 0.5` | réglementation | `operationalLimits.js` |
| FEAT-06/07 | `useAlternateSelection.js:600,758` | C | landingDistance `|| 200`, runway `|| 300` | Supabase perf | throw si LDA actif |
| FEAT-09/10/11 | `useAlternateSelection.js:283,306,335` | E | **pistes inventées / `getMinimalAirports` (10 AD fictifs)** | OpenAIP | throw `AlternatesUnavailableError` (PATTERN-5) |
| FEAT-12 | `useAlternateScoring.js:86` | C | `landingDistance*1.43 || 800` | Supabase | throw ; centraliser 1.43 |
| FEAT-13 | `useAlternateScoring.js:209` | C | METAR absent ⇒ score 0.7 favorable | météo | null + flag `weatherDataMissing` |
| FEAT-14 | `useAlternateScoring.js:296` | C | route 0/NaN ⇒ score 0.5 | coords | throw si dép=arr |
| FEAT-15/16 | `geometryCalculations.js:194,589` | C/D | rayons min 5/3/25 NM en dur | FOB | constantes ; pas de cône si FOB 0 |
| FEAT-17 | `shared-hooks useNavigationResults:32,51` | C | `cruiseSpeed||100`, `conso||30` (doublon) | Supabase | **supprimer le doublon** |
| FEAT-18 | `navigation/.../useNavigationResults.js:49` | D | réserves 30/45/+15/20 en dur | réglementation | `operationalLimits.js` |
| FEAT-19 | `FuelModule.jsx:146` | D | contingence min 1 gal / 5% | réglementation | centraliser |
| FEAT-20 | `FuelModule.jsx:451` | A | **densité 0.8 en dur** (kg/lbs) | Supabase fuelType | `getFuelDensity()` (PATTERN-2) |
| FEAT-21/22/23 | `useAlternatesIntegration.js:124,130,224` | C | conso/vitesse/LDA fallback (3ᵉ occurrence) | Supabase | helpers stricts |
| FEAT-24/25/26/27/28/29 | `FlightPlanData.js:67,79,95,189,195,199` | C | **2ᵉ moteur** : réserve 0.5/0.75 h, climb 10%, alt 3000, GS 120, taxi 5, pax 80 kg | — | **neutraliser `calculateFuel()`** (comme A4) ; déléguer au store |
| FEAT-30 | `unifiedPerformanceService.js:35` | C | endpoint IA `|| openai` | env | throw si non configuré |
| FEAT-31 | `unifiedPerformanceService.js:909` | C | alt 0 / OAT 15 / masse 1000 supposés | — | throw si conditions absentes |
| FEAT-32 | `abacValidationService.js:357` | **E** | **`findBounds3D` `// TODO` ⇒ trilinéaire = 0** | non implémenté | **throw** (PATTERN-6) |
| FEAT-33/34 | `abacValidationService.js:397,429` | C | extrapolation/nearest ⇒ `|| 0` | ABAC | throw si données insuffisantes |
| FEAT-35 | `abacProtocolHandler.js:320` | E | `oat_c:15` ISA supposée | extraction | throw si non inférable |
| FEAT-36/37 | `abacProtocolHandler.js:426,353` | D/A | tolérances 30/10% ; axe masse 600-1200 | interne | centraliser ; throw si axe non détecté |
| FEAT-38/40 | `zoneDetection.js:24`, `useAirspaceAnalysis.js:127` | C | altitude 3000 ft supposée | saisie | throw/avertir avant détection zones |
| FEAT-39/41 | `zoneDetection.js:42`, `GeoJSONDataService.js:259` | C | floor 0 / ceiling 99999 | SIA | rejeter zone sans floor/ceiling (PATTERN-5) |
| FEAT-42 | `PilotLogbook.jsx:681` | A | densité 0.72 en dur | Supabase | `getFuelDensity()` |
| FEAT-43 | `useAlternatesIntegration.js:147` | C | plancher 1 L carburant alternate | calcul | supprimer ; signaler anomalie |

### 2.6 — `__tests__`, `scripts`, `test*/debug*` (TESTS)

| ID | Emplacement | Type | Données | Doublon Supabase ? | Recommandation |
|---|---|---|---|---|---|
| TEST-01…09 | `**/__tests__/*.test.js` (golden, cgEnvelope, fuelDensity, perfInputs…) | **F** | fixtures synthétiques `F-GOLD/F-VARF/F-NOARM/F-NOEW` | NON | **Garder** (base saine à étendre) |
| TEST-10/11/12 | `debug-test.js`, `test-tracker-temp.js`, `test-tracking-claude.js` | E | fichiers morts/vides | NON | Supprimer |
| TEST-13 | `cleanTestAircraft.js:9` | E | immatriculations test en dur | présuppose avions test | déplacer `scripts/` |
| TEST-14 | `duplicateAircraft.js` | E | `window.openDuplicationConsole()`, ex. F-HSTR | partiel | composant admin / hors prod |
| TEST-15/20 | `debugCertifications.js`, `testLicensesImportExport.js` | E | injectent licences dans localStorage **réel** | NON | supprimer/hors prod |
| TEST-16/18 | `testAPIKey.js`, `testEnvVars.js` | E | exposent aperçu clé API | NON | garde DEV + exclusion bundle |
| TEST-17 | `testCompleteExportImport.js` | **E** | **PII fictive + `window.testExportImport` SANS garde** | NON | **Supprimer (P0)** |
| TEST-19 | `testGoogleSheets.js` | E | `window.testGoogleSheets`, F-DEMO | NON | Supprimer |
| TEST-21/22 | `APIKeyTest.jsx`, `PerformanceDataDebugger.jsx` | E | **debugger monté en prod** | NON | garde flag / hors prod |
| TEST-23/24 | `AbacEditorDemoPage.jsx`, `AbacDemo.tsx` | E | pages démo orphelines | NON | supprimer/`tools/` |
| TEST-25 | `aircraftStore.js:696` | E | `fixFHSTREmptyWeight` | OUI (prod) | **Supprimer** |
| TEST-26 | `PilotModule.jsx:106` | E | `pilotName="F-HSTR"` en dur | OUI | prop = pilote connecté |
| TEST-27…32 | `scripts/fhstr-*.json`, `migrate-to-supabase.js`, `fix-fhstr-direct-supabase.js` | B | snapshots/scripts F-HSTR | OUI | archiver/supprimer |
| TEST-33/34/35 | `scripts/test-lfst-*.js`, `test-distances-fix.js`, `test-google-sheets-log.js` | B | diagnostics ponctuels | non/partiel | `scripts/dev-tools/` |
| TEST-36/37/38 | `data/fallbackRunways.js`, `frenchAirspaces.js`, `frenchAirspacesManual.js` | E/B | cf. DATA-01/04/05 | OUI/SIA | supprimer/rattacher |

---

## 3. ÉTAPE 2 — REDIRECTION & UNIFICATION (source unique Supabase)

### 3.1 Cartographie données → source unique

| Donnée | Aujourd'hui (en dur/local) | Source unique cible | Statut |
|---|---|---|---|
| Avions (masses, bras, perf, fuelType) | snapshots, `DEFAULT_AIRCRAFT_VALUES`, F-HSTR | table `community_presets` (existe) | ✅ existe — supprimer les doublons |
| Espaces aériens / aérodromes / pistes / navaids | `frenchAirspaces*`, `fallbackRunways`, mapping ville→ICAO | **cache SIA GeoJSON** (`/public/data/geojson`) via `aeroDataProvider` | ✅ cache légitime — supprimer les fallbacks |
| Aéroclubs | `aeroclubsFR.json` (156) | **table `aeroclubs` à CRÉER** | ❌ à créer + migrer |
| Réglementation EASA | `regulationsData.js` (~30) | **table `regulations` à CRÉER** | ❌ à créer + migrer |
| Minima météo VFR/IFR, réserves (30/45/20), contingence %, temps déroutement | `alternatesStore`, `navigationStore`, `FlightPlanData`, hooks | **table `regulation_profiles` à CRÉER** (ou `src/config/operationalLimits.js` versionné si non éditable par l'utilisateur) | ❌ à créer |
| Unités de stockage avion (gal vs L) | heuristique `<60 L` (FEAT-03) | **champs explicites** `fuelCapacityUnit`, `fuelConsumptionUnit` sur l'avion | ❌ à ajouter au schéma |
| Secrets (AVWX, Google, Stripe, Supabase) | littéraux + localStorage + `REACT_APP_*` | `import.meta.env.VITE_*` (+ backend pour les secrets serveur) | ❌ à migrer + roter AVWX |

### 3.2 Tables Supabase à créer (DDL indicatif)

```sql
create table aeroclubs (id uuid primary key default gen_random_uuid(), name text not null,
  icao text, lat double precision, lon double precision, federation text, updated_at timestamptz default now());

create table regulations (id uuid primary key default gen_random_uuid(), ref text unique not null, -- 'FCL.025'
  title text not null, description text, requirements jsonb, module text, version text not null);

create table regulation_profiles (id uuid primary key default gen_random_uuid(), profile text not null, -- 'VFR_FR'
  reserve_day_min int not null, reserve_night_min int not null, reserve_ifr_extra_min int not null,
  contingency_pct numeric not null, diversion_time_h numeric not null,
  vfr_ceiling_ft int, vfr_visibility_m int, ifr_ceiling_ft int, ifr_visibility_m int);
```
> Aucune ligne ne contient de défaut applicatif : si la table est vide ou le profil absent, le code **lève une erreur** (cf. §4).

### 3.3 Fichiers locaux à supprimer (après redirection)
`frenchAirspaces.js` · `frenchAirspacesManual.js` · `communityAircraftDatabase.js` · `fallbackRunways.js` (après confirmation couverture SIA) · `data/airspaces/*.txt` · les 9 `test*/debug*.js` · `scripts/fhstr-*.json` · pages démo ABAC orphelines.

### 3.4 Rattachement des tests (fin des fixtures doublons)
- Tests unitaires actuels (`__tests__`, TYPE F) = **synthétiques et isolés** → à conserver.
- Migrer les fixtures statiques vers des **factory functions** (`src/test-utils/factories.js`, hors bundle) : `makeAircraft(overrides)`, immatriculation `F-TSXX` aléatoire, jamais une donnée prod.
- Tests d'intégration futurs → **base Supabase éphémère** (branching Pro ou projet `alflight-test` + `.env.test`), seed via factories en `beforeAll`, `truncate` en `afterAll`. Aucun JSON snapshot de prod.

---

## 4. ÉTAPE 3 — SUPPRESSION DES FALLBACKS & SÉCURISATION (code cible)

### 4.1 Boîte à outils commune (`src/utils/strictData.js`)

```js
export class MissingDataError extends Error {
  constructor(field, ctx = {}) {
    super(`[DATA_BLOCKED] Donnée requise absente : « ${field} »`);
    this.name = 'MissingDataError'; this.field = field; this.context = ctx;
    recordCalcBlocked(field, ctx);          // traçabilité (cf. doc M&C §4.3)
  }
}

/** Champ avion obligatoire (vient de Supabase). Aucun défaut. */
export function requireAircraftField(aircraft, field, ctx = {}) {
  const v = aircraft?.[field];
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v)))
    throw new MissingDataError(field, { registration: aircraft?.registration, ...ctx });
  return v;
}

/** Variable d'env obligatoire — appelée au BOOT (fail-fast). */
export function requireEnv(name) {
  const v = import.meta.env[name];
  if (!v) throw new Error(`[ENV_MISSING] Variable d'environnement requise : ${name}`);
  return v;
}

/** Nombre fini ou blocage (bras, masse, conso…). */
export function requireFinite(value, field, ctx = {}) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) throw new MissingDataError(field, ctx);
  return n;
}
```

### 4.2 Conversions avant → après (par pattern)

```js
// PATTERN-1 — navigationStore.js:50 / useAlternateSelection.js:419 …
- const cruiseSpeed = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100;
+ const cruiseSpeed = requireAircraftField(selectedAircraft, 'cruiseSpeedKt', { equation: 'temps = dist / vitesse' });

// PATTERN-2 — FuelModule.jsx:451 / useAircraftCalculations.js:49 …
- return `${(totalLtr * 0.8).toFixed(1)} kg`;
+ return `${(totalLtr * requireDensity(selectedAircraft.fuelType)).toFixed(1)} kg`;

// PATTERN-3 — communityService.js / flightPlanSupabaseService.js …
- try { const { data } = await supabase.from('community_presets').select('*'); return data; }
- catch (e) { return []; }
+ const { data, error } = await supabase.from('community_presets').select('*');
+ if (error) { recordSupabaseError('getAllPresets', error); throw error; }
+ return data;

// PATTERN-5 — aixmAirspacesParser.js:73 / useAlternateSelection.js:306
- catch (e) { return this.getDefaultAirspaces(); }     // faux CTR LFPG
+ catch (e) { throw new Error('[AIRSPACES] Données SIA indisponibles — affichage bloqué'); }

// PATTERN-6 — usePerformanceCalculations.js:49 / abacValidationService.js:357
- const baseClimbRate = 700; // ft/min (fictif)
+ throw new Error('[PERF] Taux de montée non disponible — requiert les données avion/MANEX');

// PATTERN-7 — authStore.js:5 / supabaseClient.js:7 (au boot)
- const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
+ const API_BASE_URL = requireEnv('VITE_API_BASE_URL');

// PATTERN-9 — vfrPointsService.js:295 (sécurité)
- // MODE DEV: Permettre modification de tous les points
+ if (point.uploaded_by !== userId) throw new Error('[AUTHZ] Modification interdite : non propriétaire');
```

### 4.3 Sécurité immédiate (P0, non négociable)
- **Roter la clé AVWX** (`SVC-001`) — elle est dans le bundle public ; la considérer compromise.
- Réactiver les contrôles d'ownership VFR (`SVC-033/034`) et supprimer `userId='anonymous'` (`SVC-035/036/037`).
- `supabaseClient` (`SVC-031`) et `authStore` (`STORE-024`) : `requireEnv` au boot.
- Retirer `testCompleteExportImport.js`/`window.testExportImport` (`TEST-17`) et `PerformanceDataDebugger` (`TEST-22`) du bundle prod.

---

## 5. PLAN DE REMÉDIATION PRIORISÉ

| Vague | Contenu | Patterns | Critère de sortie |
|---|---|---|---|
| **V0 — Geler** | étendre `eslint.mbcalc.cjs` (doc M&C) à toute l'app : interdire `?? <littéral>`, `|| <littéral>` dans calc/services, `process.env.REACT_APP_`, secrets littéraux ; pre-commit + CI | — | toute **nouvelle** régression rejetée |
| **V1 — Sécurité** | clé AVWX rotée, MODE DEV réactivé, `requireEnv` au boot, fichiers test/debug + debugger hors prod | P7,P8,P9,P10 | bundle prod sans secret/PII/bypass |
| **V2 — Faux résultats** | calc fictifs (climb, facteurs, trilinéaire, ABAC→0), verdicts placeholders, données fantômes (getDefault/getMinimal, VAC 0,0) | P5,P6 | aucun chiffre/verdict inventé |
| **V3 — Fallbacks de calcul** | `requireAircraftField`/`requireDensity`/`requireFinite` sur vitesse, conso, bras, densité ; neutraliser `FlightPlanData.calculateFuel()` | P1,P2,P4 | un seul moteur, throw si donnée absente |
| **V4 — Couche données** | services Supabase : `throw + recordSupabaseError` (fin des `catch→[]`) ; F-HSTR hors code | P3,P12 | erreurs réseau visibles |
| **V5 — Unification BDD** | créer `aeroclubs`/`regulations`/`regulation_profiles` + champs unités ; migrer ; supprimer fichiers locaux doublons | P11 | source unique Supabase/SIA |
| **V6 — Dette** | centraliser constantes (`operationalLimits.js`, `physicalConstants.js`, URLs CDN), dédupliquer conversions | D | plus de magie éparse |

---

## 5 bis. VÉRIFICATION (échantillon P0 relu contre le code réel)

> L'inventaire a été produit par 6 agents. Les findings **P0 ont été re-vérifiés manuellement** ligne à ligne. **Verdict : substance fiable, chemins/lignes à reconfirmer.**

**Confirmés au mot près (code relu) :**

| Finding | Fichier réel relu | Vérifié |
|---|---|---|
| SVC-001 clé AVWX | `services/weatherAPI.js:10` → `VITE_AVWX_API_KEY \|\| 'EZyW9WVdH-…'` | ✅ exact |
| SVC-031 supabaseClient sans garde | `lib/supabaseClient.js:7-13` → `console.error` puis `createClient(undefined…)` | ✅ exact |
| SVC-033/034 bypass « MODE DEV » | `services/vfrPointsService.js:295-301, 332-337` → ownership commentée | ✅ exact |
| SVC-025/026 faux espace aérien | `services/aixmAirspacesParser.js:73, 116-139` → `CTR_LFPG_DEFAULT`, `source:'DEFAULT'` | ✅ exact |
| FEAT-32/33/34 ABAC | `features/performance/services/abacValidationService.js:357-368, 397, 429` → `v:[[[0]]] // Placeholder`, `\|\| 0` | ✅ exact |
| UTIL-048/049 climb fictif | `shared/hooks/usePerformanceCalculations.js:48-49` → `// fictif` + `baseClimbRate = 700` | ✅ exact |
| UTIL-045/046 facteurs perf | `shared/hooks/usePerformanceCalculations.js:21-22` → `0.10` / `0.015` | ✅ exact |
| SVC-011 erreur Supabase avalée | `services/communityService.js:101-104` → `// au lieu de throw … return []` | ✅ exact |
| STORE-006/007 nav fallback | `core/stores/navigationStore.js:50, 52` → `\|\| 100`, `\|\| 30` | ✅ exact |
| STORE-019 carte VAC fantôme | `core/stores/vacStore.js:120-134` → `coordinates: data.coordinates \|\| { lat:0, lon:0 }` | ✅ exact |
| DATA-20 Stripe | `features/billing/config/products.js:18, 27` → `\|\| 'price_monthly'` / `'price_yearly'` | ✅ exact |
| FEAT-10/11 AD fictifs | `features/alternates/hooks/useAlternateSelection.js:24, 309, 336` → `getMinimalAirports()` | ✅ exact |

**Corrections d'inventaire (erreurs d'agent — chemin/ligne) :**
- `usePerformanceCalculations.js` → chemin réel **`src/shared/hooks/`** (et non `src/hooks/`).
- `aixmAirspacesParser.js` → chemin réel **`src/services/`** (et non `src/core/data/providers/`).
- `TEST-17` nuance : `window.testExportImport` (`features/pilot/components/PilotProfile.jsx:224-236`) est gardé par `if (typeof window !== 'undefined')` — **ce n'est PAS un garde DEV**, donc bien exposé en production (P0 maintenu, mécanisme précisé).
- Numéros de ligne fiables à **±2-3 lignes** ; **reconfirmer au moment du fix** (les agents ont parfois décalé de quelques lignes).

**À confirmer en base (nécessite reconnexion MCP Supabase) :** existence/absence réelle des tables `aeroclubs`, `regulations`, `regulation_profiles`, et présence des champs avion (`cruiseSpeedKt`, `fuelConsumption`, `cgEnvelope`, unités). Le « Statut BDD » de l'inventaire est **inféré** de la couche service, non vérifié en base.

---

## 6. Règle d'or (toute l'application)

> **« Pas de donnée en base, pas de résultat. »**
> Aucune valeur de calcul, aucune entité aéronautique, aucun verdict ne doit être **fabriqué** par le code. La donnée vient de Supabase (ou du cache SIA officiel) ou le processus s'arrête avec une erreur tracée. Un `|| 100`, un `?? 0.72`, un `return []` sur erreur, un `getDefault*` : autant de mensonges silencieux. **L'écran rouge fait reporter le vol ; le faux vert l'écrase.**
