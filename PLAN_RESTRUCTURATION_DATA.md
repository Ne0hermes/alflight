# 🗂️ Plan d'attaque — Restructuration intégrale du Data Management

**App :** AlFlight · **Créé :** 2026-06-03 · **Statut global :** 🟡 Planifié (aucune exécution)
**Fondé sur :** [AUDIT_DONNEES_CALCULS.md](AUDIT_DONNEES_CALCULS.md) + audit sécurité (cible Zero-Trust)

> **Légende statut :** ⬜ À faire · 🔄 En cours · ✅ Fait · ⛔ Bloqué
> **Règle de tenue à jour :** chaque phase exécutée est cochée ici ET dans la discussion. Tout fait découvert en cours de route est ajouté/amendé.

---

## 🎯 Principe directeur

Le data management cible et la sécurité Zero-Trust **convergent**. Le mouvement architectural à plus fort levier : **introduire tôt une couche d'accès aux données unique (repository par domaine)** qui sert de *seam* (couture). Aujourd'hui elle encapsule Supabase + cache ; demain on remplace son implémentation par les appels à l'API serveur (`POST /api/flight/compute`, `/api/aircraft`…) **sans toucher aux composants**. On restructure donc le data management **dans le sens** du Zero-Trust, pas à contre-courant.

**Architecture cible (data) :**
```
Supabase (Source de Vérité, lecture) ──► Repository (seam) ──► Stores Zustand (état mémoire) ──► Composants (affichent)
                                              │
                          IndexedDB (cache offline, clé = id+version) ◄── écritures via repository
                          localStorage = préférences UI uniquement
```
*(Plus tard, le Repository tapera l'API serveur au lieu de Supabase direct → bascule Zero-Trust.)*

---

## 📋 To-Do par ordre de priorité

| # | Phase | Statut | Dépend de | Levier |
|---|---|---|---|---|
| **CAL-1** | Consolidation des fonctions de calcul *pures* | ⬜ | — (∥ P0/P1) | 🔴 Sécurité + prérequis |
| **P0** | Cartographie exhaustive du data management | ⬜ | — | 🔑 Fondation |
| **P1** | Décision d'architecture cible (ADR) + contrats | ⬜ | P0 | 🔑 Fondation |
| **P2** | Couche d'accès unique (repository = *seam*) | ⬜ | P1, **CAL-1** | 🔑🔑 Pivot |
| **P3** | Avion → Supabase source unique (template) | ⬜ | P2 | 🔴 Critique |
| **P4** | Documents lourds : MANEX & VAC (dédup blobs) | ⬜ | P2 | 🟠 Élevé |
| **P5** | Plan de vol & navigation : persisté vs dérivé *(absorbe la propriété du calcul ②)* | ⬜ | P2, **CAL-1** | 🟠 Élevé |
| **P6** | État local & synchro + centralisation CG *(absorbe ②)* | ⬜ | P3, P5 | 🟡 Moyen |
| **P7** | Hygiène stockage local + migration données | ⬜ | P3, P4, P5 | 🟡 Moyen |
| **P8** | Garde-fous anti-régression (verrouiller la SoT) | ⬜ | P6, P7 | 🛡️ Pérennité |
| **P9** | *(Pont Zero-Trust — formules ③ + données → API serveur)* | ⬜ | P2…P8 | ➡️ Track sécurité |

---

## CAL-1 — Consolidation des fonctions de calcul *pures* ⬜  🔴 SÉCURITÉ + PRÉREQUIS
**Pourquoi ici :** la centralisation des calculs se scinde en deux. ① **fonctions pures** (cette phase) : ne dépendent PAS de la couche données → se font **en premier, en parallèle de P0/P1, et avant tout code data** (sinon on édite deux fois les mêmes fichiers partagés comme les hooks `alternates`). ② **propriété du calcul** (qui détient le résultat officiel) : absorbée par **P5/P6** (FlightPlanData → conteneur, centralisation CG). ③ formules au serveur : **P9** (Zero-Trust).
**Objectif :** une seule implémentation par formule. Corrige immédiatement les divergences critiques de sécurité (B1 facteur de sécurité, B5 distance de déroutement) sans attendre le chantier data.
**Périmètre :** Haversine `calculateDistance` (8 copies → `utils/navigationCalculations.js`), facteur de sécurité (3 valeurs → `utils/performanceSafetyFactor.js`), interpolation 1D (4 copies → `services/abacInterpolation.js`), moteur cascade (magic numbers `cascade.ts` → `abacInterpolation`), groundSpeed scalaire → `calculateWindEffect` vectoriel, formule TOD (×3 → 1 helper). **Ne touche PAS au stockage.** Réf : AUDIT_DONNEES_CALCULS.md Axe B (B1,B2,B4,B5,B6,B7,B8) + bugs (`useWindCalculations.js:44`).
**Livrable :** modules canoniques uniques + call sites importés, tests de non-régression numériques, app iso-fonctionnelle.

```
Agis comme dev senior. Sujet : centralisation des FONCTIONS DE CALCUL PURES (aucune modif du stockage). Réf : D:\Applicator\alflight\AUDIT_DONNEES_CALCULS.md (Axe B).
1) Haversine : supprime les 8 réimplémentations de calculateDistance (alternates/useNavigationResults, useAlternatesIntegration, useAlternateScoring, alternateFilters, navigation/useNavigationResults, navigationStore, FlightPlanData, RouteMapView en km!, WindAnalysis R=3440.07, VFRNavigationTable) → importe utils/navigationCalculations.js partout.
2) Distance à la route : remplace alternateFilters (min des extrémités) et la version maison de useAlternateScoring par calculateDistanceToSegment canonique (cross-track).
3) Facteur de sécurité : un seul via utils/performanceSafetyFactor.js (corrige le texte 1.25 de PerformanceCalculator, supprime les facteurs piste de performanceCharts.js).
4) Interpolation 1D : une seule (interpolateY de operationResolver) dans services/abacInterpolation.js ; supprime interpolate1D, findYForX. Supprime les magic numbers 1.914/Y=870 de abac/curves/core/cascade.ts.
5) groundSpeed : remplace les versions scalaires (tas - headwind) de WindAnalysis et VFRNavigationTable par calculateWindEffect vectoriel ; corrige la parenthèse Math.sqrt non fermée de shared/hooks/useWindCalculations.js:44.
6) Extrais la formule TOD (dupliquée ×3) dans un helper unique de navigationCalculations.js.
Ajoute des tests numériques de non-régression (mêmes entrées → mêmes sorties qu'avant pour les versions correctes). Ne touche à AUCUN stockage/store de données. À la fin, coche CAL-1 ✅ dans PLAN_RESTRUCTURATION_DATA.md et logue.
```

> ⚠️ **CAL-1 doit être terminée avant P2** (pour ne pas éditer deux fois les fichiers partagés). Elle peut tourner **en parallèle de P0/P1** (qui sont en lecture seule / docs).

---

## P0 — Cartographie exhaustive du data management ⬜
**Objectif :** avant toute restructuration, savoir *qui lit/écrit quoi, où*. Produire la matrice flux de données.
**Livrable :** `CARTO_DATA_MANAGEMENT.md` = (a) inventaire de chaque couche de stockage (tables/buckets Supabase, stores IndexedDB, clés localStorage, persists Zustand) ; (b) pour chaque domaine métier (avion, MANEX, VAC, plan de vol, navigation, masse&centrage, carburant, météo, checklist, units, auth) → tableau « donnée → SoT actuelle → copies → sites de lecture → sites d'écriture » ; (c) liste des doublons et désyncs confirmés.
**Pas de code.**

```
Agis comme architecte data. Lis D:\Applicator\alflight\AUDIT_DONNEES_CALCULS.md et la mémoire alflight-data-architecture-audit.
Cartographie EXHAUSTIVEMENT le data management de D:\Applicator\alflight\src (lecture seule, aucune modif).
Pour chaque couche de stockage, liste les clés/tables/stores : Supabase (grep createClient, .from(, .storage), IndexedDB (utils/indexedDBStorage.js, dataBackupManager.js), localStorage/sessionStorage (grep localStorage), persist Zustand (grep "persist(" dans core/stores).
Pour chaque domaine (avion, MANEX, VAC, plan de vol, navigation, masse&centrage, carburant, météo, checklist, units, auth) produis un tableau : donnée | source de vérité actuelle | toutes les copies | fichiers:lignes qui LISENT | fichiers:lignes qui ÉCRIVENT.
Termine par la liste des duplications et désynchronisations confirmées, classées par domaine.
Écris le résultat dans D:\Applicator\alflight\CARTO_DATA_MANAGEMENT.md. À la fin, coche P0 ✅ dans PLAN_RESTRUCTURATION_DATA.md et logue via scripts\claude-log-action.ps1.
```

## P1 — Décision d'architecture cible (ADR) + contrats ⬜
**Objectif :** figer l'architecture data cible et les contrats d'interface, alignés Zero-Trust. Décider : Supabase=SoT lecture, IndexedDB=cache offline (clé id+version), Zustand=état hydraté, localStorage=préférences UI uniquement. Définir invalidation de cache, file d'attente d'écritures offline, stratégie de migration/rollback.
**Livrable :** `ADR_DATA_ARCHITECTURE.md` + définitions TypeScript/JSDoc des interfaces `*Repository` (types seulement, zéro implémentation). Le contrat doit être tel que l'implémentation puisse passer de « Supabase direct » à « API serveur » sans changer la signature.
**Pas de changement de comportement.**

```
Agis comme architecte logiciel. Sur la base de CARTO_DATA_MANAGEMENT.md, AUDIT_DONNEES_CALCULS.md et la cible Zero-Trust (mémoire alflight-security-audit-2026-06), rédige un ADR (Architecture Decision Record) dans D:\Applicator\alflight\ADR_DATA_ARCHITECTURE.md.
Décide et justifie : Supabase = source de vérité (lecture) ; IndexedDB = cache offline clé id+version/checksum ; Zustand = état mémoire hydraté ; localStorage = préférences UI uniquement. Définis : politique d'invalidation/versioning du cache, file d'attente d'écritures offline, stratégie de migration des données existantes + rollback.
Définis les CONTRATS d'interface (JSDoc/TS, types seulement, AUCUNE implémentation) d'un repository par domaine : aircraftRepository, manexRepository, vacRepository, flightPlanRepository, etc. — interface { getAll, getById, save, delete, sync } conçue pour que l'implémentation puisse basculer de Supabase-direct vers API serveur sans changer la signature.
Ne modifie aucun code applicatif. À la fin, coche P1 ✅ dans PLAN_RESTRUCTURATION_DATA.md et logue.
```

## P2 — Couche d'accès unique (repository = *seam*) ⬜  🔑🔑 PIVOT
**Objectif :** implémenter les repositories conformes aux contrats P1 et faire passer TOUT accès données par eux. Au départ ils encapsulent la logique Supabase+cache existante (comportement identique), mais centralisent chaque lecture/écriture en un seul endroit → futur point de bascule Zero-Trust.
**Périmètre :** créer `src/core/data/repositories/*` ; refactorer les stores et composants pour appeler le repository au lieu de `communityService`/`supabase`/`localStorage`/IndexedDB en direct. Supprimer les appels dispersés (`getPresetById` ×5, accès localStorage directs).
**Livrable :** repositories + call sites migrés, app iso-fonctionnelle.

```
Agis comme dev senior. En respectant les contrats de ADR_DATA_ARCHITECTURE.md, implémente la couche repository dans D:\Applicator\alflight\src\core\data\repositories\ (un fichier par domaine).
Étape 1 : chaque repository encapsule la logique ACTUELLE (Supabase + cache IndexedDB) sans changer le comportement — c'est un refactor de centralisation, pas un changement fonctionnel.
Étape 2 : remplace TOUS les accès directs par des appels au repository : grep "supabase", "from('community_presets')", "getPresetById", "localStorage.", "indexedDB" dans src/features et src/core/stores, et redirige-les vers le repository.
Préserve strictement le comportement (vérifie via le serveur de dev / preview). Cible prioritaire : aircraftRepository (le domaine le plus utilisé).
Ne touche PAS encore à la logique Supabase-vs-cache (ce sera P3) — ici on ne fait que centraliser le point d'accès. À la fin, coche P2 ✅ dans PLAN_RESTRUCTURATION_DATA.md et logue.
```

## P3 — Avion → Supabase source unique (template) ⬜  🔴 CRITIQUE
**Objectif :** faire de Supabase la SoT réelle pour l'avion, IndexedDB un pur cache. Sert de gabarit pour les autres domaines.
**Périmètre :** réactiver `loadFromSupabase()` au boot via `aircraftRepository` (`core/contexts/index.jsx:65-255`) ; IndexedDB en cache lecture seule ; supprimer `supabaseAircraftStore.js` + `SupabaseInitializer.jsx` (morts) ; supprimer la double écriture `aircraftData`+`protectedData` (`dataBackupManager.js:384-413`) ; implémenter `ensureAircraftFull(id)` (tuer le merge squelette dispersé) ; retirer la réf morte `updateAircraftManex`.
**Livrable :** avion synchronisé Supabase↔cache, store unique.

```
Agis comme dev senior. Domaine AVION. Référence : AUDIT_DONNEES_CALCULS.md (A1, A2, A3) + ADR_DATA_ARCHITECTURE.md + aircraftRepository (P2).
1) Réactive le chargement Supabase au démarrage via aircraftRepository dans D:\Applicator\alflight\src\core\contexts\index.jsx (actuellement désactivé lignes ~65-255) ; fais d'IndexedDB un cache de secours offline UNIQUEMENT.
2) Supprime le store mort core/stores/supabaseAircraftStore.js et components/SupabaseInitializer.jsx (vérifie 0 import résiduel).
3) Supprime la double écriture aircraftData + protectedData dans utils/dataBackupManager.js (~384-413) : une seule copie cache, clé = supabaseId.
4) Implémente aircraftRepository.ensureAircraftFull(id) (mémoïsé) et remplace les ~5 appels dispersés getPresetById + merge {...current,...full} (AircraftModule.jsx, Step0CommunityCheck.jsx, SupabaseUpdater.jsx, duplicateAircraft.js).
5) Retire la prop morte updateAircraftManex (AircraftModule.jsx:259,2507).
Vérifie le CRUD avion + offline via preview. À la fin, coche P3 ✅ et logue.
```

## P4 — Documents lourds : MANEX & VAC (dédup blobs) ⬜  🟠 ÉLEVÉ
**Objectif :** une seule copie cache des PDF lourds ; Supabase Storage = SoT.
**Périmètre :** MANEX et VAC passent par leurs repositories ; cache PDF unique en IndexedDB (clé id+version/checksum) ; supprimer `manexStore`, le champ `manex` de `aircraftData`, la clé fantôme `customVACCharts` (`vacStore.js:96`) ; un seul flag `has_manex` ; corriger `openAIPStore.validateAllPoints` qui lit le cache VAC périmé.
**Livrable :** MANEX/VAC sans duplication, validation coordonnées fiable.

```
Agis comme dev senior. Domaines MANEX et VAC. Référence : AUDIT_DONNEES_CALCULS.md (A4, A5) + ADR + manexRepository/vacRepository (P2).
MANEX : Supabase Storage (manex-files) = SoT ; PDF caché UNIQUEMENT en IndexedDB manexPDFs clé supabaseId+version. Supprime core/stores/manexStore.js, le champ manex embarqué dans aircraftData (dataBackupManager.js), et unifie sur un seul flag has_manex (Supabase) propagé en lecture.
VAC : table vac_charts = SoT ; vacStore devient un miroir hydraté (pas un persist localStorage autonome) ; supprime l'écriture fantôme localStorage['customVACCharts'] (core/stores/vacStore.js:96-99) ; PDF VAC cachés uniquement en IndexedDB vacPDFs clé ICAO+checksum.
Corrige core/stores/openAIPStore.js (validateAllPoints ~225-266) pour valider sur la donnée VAC fraîche, pas le cache local.
Vérifie import/affichage MANEX+VAC et la validation des points via preview. À la fin, coche P4 ✅ et logue.
```

## P5 — Plan de vol & navigation : persisté vs dérivé ⬜  🟠 ÉLEVÉ
**Objectif :** distinguer la donnée *persistée* (plan archivé Supabase) de la donnée *dérivée à l'affichage* ; faire de `FlightPlanData` un conteneur pur. *(= moitié ② de la centralisation des calculs : FlightPlanData cesse de recalculer distance/carburant/TOD/CG et lit les fonctions canonisées en CAL-1 — prérequis CAL-1.)*
**Périmètre :** corriger le bug `useNavigationResults()` sans args (`FlightPlanWizard.jsx:41`) → restaurer la persistance navigation ; clarifier brouillon local (`navigationStore` persist) vs plan archivé (`flightPlanSupabaseService`) via `flightPlanRepository` ; retirer de `FlightPlanData` les totaux recalculés/stockés (distance/temps/carburant) → il ne stocke que des références + snapshot au save.
**Livrable :** donnée affichée = donnée sauvegardée, plus de couche de calcul stockée en double.

```
Agis comme dev senior. Domaine PLAN DE VOL / NAVIGATION. Référence : AUDIT_DONNEES_CALCULS.md (C1, C2) + ADR + flightPlanRepository (P2).
1) Corrige FlightPlanWizard.jsx:41 : useNavigationResults() est appelé sans arguments donc renvoie null et la navigation n'est jamais persistée. Calcule-le une seule fois avec (waypoints, flightType, selectedAircraft) et passe le MÊME objet à la sauvegarde et en prop à Step7Summary.
2) Via flightPlanRepository, sépare clairement le BROUILLON local (navigationStore persist localStorage) du PLAN ARCHIVÉ (Supabase) — pas de mélange, règles de chargement explicites.
3) Transforme features/flight-wizard/models/FlightPlanData.js en CONTENEUR pur : retire le stockage des totaux recalculés (route.distance/estimatedTime, fuel.*, todParameters) ; il ne contient que des références + un snapshot des résultats au moment de la sauvegarde. generateSummary() lit les mêmes valeurs que l'écran.
Ne refais PAS les calculs ici (centralisation calcul = autre chantier) ; concentre-toi sur la donnée persistée vs dérivée. Vérifie sauvegarde/rechargement d'un plan via preview. À la fin, coche P5 ✅ et logue.
```

## P6 — État local & synchro (éliminer les copies) ⬜  🟡 MOYEN
**Objectif :** une source de vérité par donnée en mémoire ; supprimer les copies `useEffect` bidirectionnelles. *(= moitié ② pour le CG : une seule dérivation masse/centrage via le store, on supprime la double dérivation `arms → weightBalance` faite dans Step6 et celle de FlightPlanData.)*
**Périmètre :** avion/fobFuel/loads ne sont plus recopiés dans chaque étape du wizard (`FlightPlanWizard` + Step3/4/5/6/7) ; synchro centralisée en un seul effet ; mapping `arms → weightBalance` fait une seule fois (dans le repository/store au chargement, pas à chaque render de Step6).
**Livrable :** plus de conditions de course au montage, état cohérent entre étapes.

```
Agis comme dev senior. Sujet : éliminer les copies d'état désynchronisées du wizard. Référence : AUDIT_DONNEES_CALCULS.md (C4) + ADR.
Supprime les useEffect de copie bidirectionnelle de l'avion, du fobFuel et des loads dispersés dans FlightPlanWizard.jsx et Step3Route/Step4Alternates/Step5Fuel/Step6WeightBalance/Step7Alternates.
Établis UNE source de vérité par donnée (le store Zustand / repository) ; flightPlan ne contient que des références (registration, fuel confirmé) hydratées au save. Centralise toute la synchro en UN seul effet au niveau FlightPlanWizard (~139-226).
Fais le mapping arms → weightBalance UNE seule fois (au chargement de l'avion via le repository/store), pas dans le render de Step6 (qui le fait à 2 endroits).
Vérifie qu'aucune valeur ne diverge entre étapes (avion, FOB, charges) via preview. À la fin, coche P6 ✅ et logue.
```

## P7 — Hygiène stockage local + migration données ⬜  🟡 MOYEN
**Objectif :** rationaliser le stockage local et migrer proprement les données utilisateurs existantes.
**Périmètre :** corriger `dataBackupManager` (arrête de cloner tout `localStorage` ×10 toutes les 5 min) ; supprimer les stores/clés morts (`communityAircraftDatabase`, restes de `customVACCharts`, `manex-storage`…) ; écrire une migration one-shot qui réconcilie les données IndexedDB/localStorage existantes vers le nouveau modèle (clé id+version) ; plan de rollback.
**Livrable :** stockage local maîtrisé, données existantes migrées sans perte.

```
Agis comme dev senior. Sujet : hygiène du stockage local + migration des données existantes. Référence : AUDIT_DONNEES_CALCULS.md (secondaires Axe A) + ADR.
1) Refactore utils/dataBackupManager.js : arrête de cloner {...localStorage} + tous les stores IDB ×10 toutes les 5 min (ne sauvegarde que les blobs lourds indexés par supabaseId, rétention raisonnable).
2) Supprime définitivement les référentiels/clés morts : communityAircraftDatabase.js, clés localStorage orphelines (customVACCharts, manex-storage si remplacé), etc. (vérifie 0 usage).
3) Écris une migration one-shot (idempotente) qui, au premier lancement post-refactor, réconcilie les données IndexedDB/localStorage existantes de l'utilisateur vers le nouveau modèle (clé id+version) sans perte, avec log + rollback si échec.
Teste la migration sur un jeu de données réel (backup d'abord). À la fin, coche P7 ✅ et logue.
```

## P8 — Garde-fous anti-régression (verrouiller la SoT) ⬜  🛡️
**Objectif :** empêcher la réapparition des anti-patterns.
**Périmètre :** règle de lint / test qui interdit l'accès direct à `supabase`/`localStorage`/`IndexedDB` hors des repositories ; tests d'intégration sync online/offline ; contrôles d'intégrité de données (1 avion = 1 source).
**Livrable :** la nouvelle architecture « tient » dans le temps.

```
Agis comme dev senior QA/outillage. Sujet : verrouiller la Single Source of Truth. Référence : ADR_DATA_ARCHITECTURE.md.
1) Ajoute une règle ESLint (ou un script lint dédié type scripts/lint-data-access.mjs) qui ÉCHOUE si un fichier hors src/core/data/repositories importe supabase directement ou utilise localStorage/indexedDB pour des données métier (autoriser localStorage uniquement pour les préférences UI déclarées).
2) Ajoute des tests d'intégration : hydratation depuis Supabase, comportement offline (cache), file d'écritures, réconciliation au retour online.
3) Ajoute un contrôle d'intégrité runtime (dev) qui alerte si une même entité (ex. avion par id) existe dans 2 sources divergentes.
Branche le lint dans le CI/pre-commit. À la fin, coche P8 ✅ et logue.
```

## P9 — Pont vers Zero-Trust (track sécurité) ⬜  ➡️
**Objectif (hors périmètre data pur, à anticiper) :** une fois les repositories en place (P2), basculer leur implémentation de « Supabase direct » vers les appels à l'API serveur (`POST /api/flight/compute`, `POST/PATCH/DELETE /api/aircraft` admin, proxies clés). Voir mémoire `alflight-security-audit-2026-06`. **Ne pas démarrer sans valider le track sécurité.**

---

## 🧭 Notes d'exécution
- **Ordre conseillé :** **CAL-1 ∥ (P0 → P1)** en parallèle, puis P2 (pivot, après CAL-1), puis P3 (template), puis P4/P5, puis P6, P7, enfin P8.
- **Ne pas coder P3+ avant que P2 (repositories) existe** — sinon on déplace les call sites deux fois.
- **Ne pas démarrer P2 avant CAL-1** — pour ne pas éditer deux fois les fichiers partagés (hooks `alternates`, `FlightPlanData`, composants navigation).
- **La centralisation des calculs se scinde en 3 :** ① fonctions pures = **CAL-1** (en premier) ; ② propriété du calcul (FlightPlanData → conteneur, CG) = **absorbée par P5/P6**, ce n'est pas un chantier séparé à ce stade ; ③ formules côté serveur = **P9** (Zero-Trust). CAL-1 corrige aussi les bugs sécurité B1/B5 immédiatement.
- À chaque phase terminée : cocher ici (⬜→✅), mettre à jour la discussion, logger Google Sheets.
