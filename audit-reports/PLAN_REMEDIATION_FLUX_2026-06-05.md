# PLAN D'ACTION — Remédiation du flux « Mes avions » → « Je prépare mon vol »
## Masse & Centrage + Performances — correction de l'intégralité des anomalies A1–A13

**Date :** 2026-06-05
**Source :** `audit-reports/AUDIT_FLUX_MESAVIONS_PREPAVOL_2026-06-05.md` (13 anomalies, 14 tests T1–T14)
**Branche de travail :** `chore/data-consolidation-and-cleanup` (déjà ouverte) — créer si besoin une sous-branche `fix/wb-perf-remediation`.

### Principes directeurs (décisions déjà actées, à respecter partout)
- **P0 — Zéro fallback silencieux.** Une entrée manquante (masse, bras, densité, température, altitude, vent) → **statut `MISSING_INPUT` + alarme nommant le paramètre**, jamais une valeur inventée (600/1150/1000/2.00/30/40/100/120/15 °C/0).
- **Densité 0,84 partout** (Jet A-1), source unique `constants.js`.
- **Masse décollage ET atterrissage = module de centrage uniquement** (`weightBalanceStore`). Plus aucun recalcul ailleurs.
- **Supprimer tout code mort / inventé.**
- **L'enveloppe affichée dans « Mes avions » DOIT être celle utilisée par le calcul.**

### Articulation avec le plan performance existant
Le volet **performance pur** (ISA/météo mock A5, bornes, IDW, code mort moteur, `cascade.ts`, badges montée/croisière) est déjà spécifié dans **`PLAN_REFONTE_PERFORMANCE_2026-06-03.md` (Lots 1–6)**. Ce plan-ci est le **maître** : il séquence les deux volets et **délègue** explicitement au plan perf là où il le couvre déjà (annoté « → PLAN PERF Lot X »). Aucune action n'est dupliquée.

### Vue d'ensemble des phases

| Phase | Objet | Anomalies | Risque | Dépend de |
|---|---|---|---|---|
| 0 | Filet de sécurité (branche + tests golden) | — | — | — |
| 1 | Densité unique | A1 | Faible | 0 |
| 2 | Enveloppe de centrage réelle | A2, A3 | **Élevé** (calcul critique) | 0 |
| 3 | Moteur de masse unique (tuer FlightPlanData W&B) | A4 | Élevé | 1 |
| 4 | Zéro fallback fantôme (masses/bras/conso) | A6 + P0 | Moyen | 2, 3 |
| 5 | ISA & météo fabriquée | A5 | Moyen | → PLAN PERF Lot 1/1bis |
| 6 | Perf : sécurité persistée, pente/surface, code mort | A9, A10, A11 | Moyen | → PLAN PERF Lot 2-4 |
| 7 | V-vitesses affichées · K-factor non retenu | A7, A8 | Faible | — |
| 8 | MZFW / MLW (contrôles manquants) | A13 (W5/W6) | Faible | 2 |
| 9 | Hygiène (logs de calcul) | A12 | Faible | — |
| 10 | Validation finale (T1–T14 + golden) | toutes | — | 1-9 |

---

## PHASE 0 — Filet de sécurité (AVANT toute modification)

> But : pouvoir mesurer chaque changement. On ne touche pas à un calcul de centrage sans test golden préalable.

**0.1 — Isoler le chantier.**
- Action : `git switch -c fix/wb-perf-remediation` depuis `chore/data-consolidation-and-cleanup`. Commits atomiques par étape (1 anomalie = 1 commit).
- Validation : `npm run build` vert avant de commencer.

**0.2 — Tests golden de centrage (référence figée).**
- Fichiers : créer `src/core/stores/__tests__/weightBalanceStore.golden.test.js`.
- Action : 3 avions de référence (1 avec enveloppe avant variable, 1 avec aft 2-points divergents, 1 legacy `aftCG` seul). Charges connues → masse, moment, CG, `isWithinLimits` attendus calculés à la main. Snapshot.
- Validation : tests verts sur le code **actuel** (capture le comportement présent, y compris les bugs, pour mesurer le delta).

**0.3 — Tests golden de densité.**
- Action : pour `JET A-1`, `AVGAS 100LL`, `MOGAS`, `fuelType` absent → densité attendue (0,84 / 0,72 / 0,72 / décision P0). Vérifie l'unicité après Phase 1.

---

## PHASE 1 — Densité carburant unique (A1)

> Cible : une seule table (`constants.js`) + un seul helper. Supprimer `JET_A1:0.80`.

**1.1 — Créer le helper canonique unique.**
- Fichier : `src/utils/fuelDensity.js` (nouveau).
- Action :
  ```js
  import { FUEL_DENSITIES } from './constants';
  // P0 : pas de devinette silencieuse. Retourne null si type inconnu → l'appelant gère MISSING_INPUT.
  export function getFuelDensity(fuelType) {
    if (!fuelType) return null;
    const norm = String(fuelType).replace(/-/g, ' ').trim();
    return FUEL_DENSITIES[fuelType] ?? FUEL_DENSITIES[norm] ?? null;
  }
  ```
- Note : la nomenclature `fuelType` doit être normalisée (`JET-A1`, `JET A-1`, `JET-A` → une clé). Ajouter les alias dans `FUEL_DENSITIES` ou dans le helper.

**1.2 — Supprimer la table divergente `unitConversions.js`.**
- Fichier : `src/utils/unitConversions.js:5-8`.
- Action : supprimer `DENSITIES` ; faire de `fuelConversions` des fonctions qui **exigent** une densité en argument (plus de défaut AVGAS). Réexporter depuis `constants.js` si une constante est requise ailleurs.
- Dépendances à corriger (importeurs de `DENSITIES`) :
  - `src/features/flight-wizard/models/FlightPlanData.js:5,236-237` → via le store (Phase 3, le calcul disparaît).
  - `src/features/flight-wizard/steps/Step6WeightBalance.jsx:9,321,640` → `getFuelDensity(aircraft.fuelType)`.

**1.3 — Supprimer la 2ᵉ table divergente `mbUnits.js`.**
- Fichier : `src/features/aircraft/utils/mbUnits.js:35-39` (`'JET-A1':0.80`).
- Action : remplacer par un réexport de `getFuelDensity` / `FUEL_DENSITIES`. Vérifier les appelants de `mbUnits` (centrogramme, Step3).

**1.4 — Éliminer les ternaires en dur.**
- `src/core/contexts/index.jsx:438` (`JET A-1 ? 0.84 : 0.72`) → `getFuelDensity(...)`.
- `src/shared/hooks/useAircraftCalculations.js:48` → idem.
- `src/features/pilot/components/PilotLogbook.jsx:681-684` (0,72 constant, faux pour Jet) → `getFuelDensity(...)`.
- `src/features/performance/PerformanceModule.jsx:426` → `getFuelDensity(...)` (gérer `null` → MISSING_INPUT au lieu de fallback AVGAS).

**1.5 — Aligner les consommateurs déjà « presque canoniques ».**
- `weightBalanceStore.js:162-165`, `weight-balance/utils/calculations.js:29-32`, `ScenarioCards.jsx:22-25`, `Step7Summary.jsx:573-576` : remplacer la chaîne `|| 0.84` par `getFuelDensity()` (cohérence + politique `null`).

**Validation Phase 1 :** T5 (Jet A-1, 100 L → 84 kg partout : store, scénarios, masse atterrissage, logbook). Test 0.3 vert. `grep -rn "0.80\|JET_A1\|DENSITIES" src` → plus aucune densité carburant divergente.

---

## PHASE 2 — Enveloppe de centrage réelle (A2 + A3) 🔴

> Le cœur du problème. On remplace le **rectangle constant** par la **vraie enveloppe trapézoïdale**, et on branche le modèle aft 2-points + la courbe avant variable, aujourd'hui morts.

**2.1 — Créer l'util canonique d'enveloppe (source unique de vérité géométrique).**
- Fichier : `src/features/weight-balance/utils/cgEnvelope.js` (nouveau).
- Action — 3 fonctions pures :
  ```js
  // Construit les sommets du polygone (réutilise la logique de CgEnvelopeDualChart)
  export function buildEnvelopePolygon(cgEnvelope) { /* forwardPoints[] + intermediatePoints[]
     + aft 2-points (aftMinWeight/aftMinCG, aftMaxWeight/aftMaxCG) ; rétro-compat aftCG */ }

  // Limites CG interpolées À une masse donnée (le correctif clé)
  export function cgLimitsAtMass(cgEnvelope, mass) {
    // fwd = interp linéaire sur forwardPoints triés par masse (clamp + warning hors plage)
    // aft = interp entre (aftMinWeight,aftMinCG) et (aftMaxWeight,aftMaxCG) ; sinon aftCG constant
    return { forward, aft, source: 'envelope'|'legacy'|'missing', warnings: [] };
  }

  // Test d'appartenance au polygone (masse, cg)
  export function isWithinEnvelope(cgEnvelope, mass, cg) { /* in-range masse + cg∈[fwd,aft] */ }
  ```
- Réutilisation : extraire la construction du polygone déjà présente dans `CgEnvelopeDualChart.jsx:177-212` et `CgEnvelopeChart.jsx:13-60` pour que **les graphes de « Mes avions » et le calcul de « Je prépare mon vol » appellent le même code** (sinon ils re-divergeront).

**2.2 — Brancher le contrôle CG sur la vraie enveloppe.**
- Fichier : `src/core/stores/weightBalanceStore.js:99-122` (construction `cgLimits`) et `:237-239` (contrôle).
- Action : remplacer
  ```js
  const isWithinCG = cg >= wb.cgLimits.forward && cg <= wb.cgLimits.aft; // rectangle
  ```
  par
  ```js
  const limits = cgLimitsAtMass(aircraft.cgEnvelope, totalWeight);
  const isWithinCG = limits.source !== 'missing'
    ? (cg >= limits.forward && cg <= limits.aft)
    : null; // P0 : pas d'enveloppe → null (non « OK »), warning
  ```
- Conserver `forward/aft` scalaires dans le résultat pour l'UI, mais **calculés à la masse réelle** (pas `forwardPoints[0]` / `aftCG` figés).

**2.3 — Arrêter d'aplatir l'enveloppe dans les couches de mapping.**
- Fichiers : `src/core/contexts/index.jsx:198-203`, `src/utils/aircraftNormalizer.js:114`, `src/utils/aircraftValidation.js:201`, `src/features/flight-wizard/steps/Step6WeightBalance.jsx:92,222`, `Step1GeneralInfo.jsx:108`.
- Action : ces couches collapsent `cgEnvelope` → `{forward: forwardPoints[0].cg, aft: aftCG}`. Les faire **transporter l'objet `cgEnvelope` complet** (forwardPoints + aft 2-points) jusqu'au store, qui appellera `cgLimitsAtMass`. Le scalaire `cgLimits` devient un **dérivé d'affichage**, pas la source.

**2.4 — Cohérence du graphe de centrage opérationnel.**
- Fichier : `src/features/weight-balance/components/WeightBalanceChart.jsx:44-228`.
- Action : ce composant utilise `aftCG` constant pour les deux sommets arrière (l.220-228). Le faire consommer `buildEnvelopePolygon` (aftMinCG/aftMaxCG) pour afficher le **vrai** trapèze + le point (masse, CG) calculé.

**Validation Phase 2 :**
- T6 (aftMinCG 2,30 / aftMaxCG 2,60 divergents, masse mini → limite ≈ 2,30, pas 2,60).
- T7 (forwardPoints [{600;2,05},{1000;1,95}], à 1000 kg → limite avant ≈ 1,95, pas 2,05).
- Golden 0.2 : le delta attendu apparaît exactement sur les 2 avions à enveloppe variable.

---

## PHASE 3 — Moteur de masse unique : tuer le centrage parallèle (A4) 🔴

> Une seule autorité de masse : `weightBalanceStore`. `FlightPlanData` ne calcule plus ni masse ni centrage.

**3.1 — Exposer `landingWeight` depuis le store (autorité unique).**
- Fichier : `src/core/stores/weightBalanceStore.js` (fonction `calculateWeightBalance(aircraft, fobFuel, consumedFuel)`).
- Action : ajouter au résultat `landingWeight = totalWeight − (consumedFuel.ltr × getFuelDensity(aircraft.fuelType))`, avec `consumedFuel` provenant de `fuelStore` (trip + roulage). Densité canonique. Si type inconnu → warning P0, pas de devinette.
- → recoupe **PLAN PERF Lot 1.3 / 1bis.4**.

**3.2 — Vider la logique W&B de `FlightPlanData`.**
- Fichier : `src/features/flight-wizard/models/FlightPlanData.js:230-266`.
- Action : supprimer le calcul dans `calculateWeightBalance()` (masse, densité 0,80, landingWeight) ; `updateWeightBalance(data)` ne fait plus que **stocker** les valeurs reçues (déjà calculées par le store via Step6). Retirer l'import `DENSITIES` (l.5).
- Garde-fou : `Step6WeightBalance.jsx:408-416` écrit déjà `flightPlan.weightBalance.{takeoffWeight,landingWeight,cg,withinLimits}` depuis `calculations` (store) → c'est le pont. Vérifier qu'il pousse bien `calculations.landingWeight` (nouveau) et non un recalcul local (l.410).

**3.3 — PerformanceModule lit le store, pas FlightPlanData.**
- Fichier : `src/features/performance/PerformanceModule.jsx:420,425-428`.
- Action : `takeoffMass = calculations.totalWeight` ; `landingMass = calculations.landingWeight`. Supprimer `landingMassFromConsumption` et le fallback `flightPlan.weightBalance.landingWeight`. Si `calculations` absent → MISSING_INPUT (P0), plus de `|| 1000`.

**3.4 — Vérifier la persistance.**
- Fichier : `src/services/flightPlanSupabaseService.js:91` (`weight_balance: flightPlan.weightBalance`).
- Action : confirmer que l'objet persisté contient désormais les masses **du store** (via le pont Step6). Aucun champ issu de l'ancien calcul.

**Validation Phase 3 :** T11 (landingWeight = takeoff − conso×0,84, pas ×0,80 ; identique au store). T1 (BEW 1500 → masse +750 partout, y compris masse atterrissage perf).

---

## PHASE 4 — Zéro fallback fantôme : masses, bras, conso (A6 + P0)

> Une donnée manquante doit **se voir**, pas se substituer en silence par 3 valeurs différentes.

**4.1 — Masses & bras du store.**
- Fichier : `src/core/stores/weightBalanceStore.js:39-46, 72-86`.
- Action : remplacer `|| 600 / 1150 / 2.00 / 2.90 / 3.50 / 3.70 / 2.18 / 2.45` par : si la valeur avion est absente → ajouter `{field}` à `result.warnings` et marquer `isWithinLimits = null` (calcul affiché « incomplet », pas « OK »). Ne **jamais** produire un CG/limite à partir d'un bras inventé.
- Conséquence UI : le module W&B affiche « ⚠ Bras siège arrière non renseigné — centrage indisponible » au lieu d'un faux CG.

**4.2 — Fuel flow & vitesse : aligner ou bloquer.**
- Fichiers : `FuelModule.jsx:152,273,303,326` (`||30`), `Step4Alternates.jsx:133` (`||40`), `useNavigationResults.js:44` (`||30`), `Step1GeneralInfo.jsx:58` (`||0`), `Step3Route.jsx:129` (`||120`), nav/wind/fuel (`||100`).
- Action : supprimer les fallbacks divergents. `fuelConsumption`/`cruiseSpeedKt` absents → bandeau « ⚠ Consommation/vitesse non renseignée pour cet avion » + bilan carburant **non calculé** (déjà amorcé : `FuelModule.jsx:378` détecte l'absence). Une seule politique, plus de 30-vs-40 ni 100-vs-120.

**4.3 — Masse perf.**
- Fichier : `PerformanceModule.jsx:420` (`|| emptyWeight || 1000`).
- Action : `calculations.totalWeight` requis ; absent → MISSING_INPUT (cf. 3.3).

**Validation Phase 4 :** T1-T4 (injection masses/bras absurdes → réaction ou alarme, jamais figé), T10 (conso vidée → 30 et 40 ne coexistent plus ; bilan bloqué + alarme).

---

## PHASE 5 — ISA & météo fabriquée (A5) → PLAN PERF Lot 1 / 1bis

> Entièrement spécifié dans `PLAN_REFONTE_PERFORMANCE_2026-06-03.md`. Rappel des items, à exécuter ici dans la séquence.

- **5.1** Bannir `getMockMETAR` du chemin de production (`weatherAPI.js`) → erreur « météo indisponible ». (PLAN PERF 1bis.1)
- **5.2** Supprimer le fallback `: 15` ISA (`PerformanceModule.jsx:431-433`) → `MISSING_INPUT`. (PLAN PERF 1.1)
- **5.3** `elevation || 0` (`PerformanceModule.jsx:436-437`) → alarme altitude. (PLAN PERF 1.2)
- **5.4** Vent « Variable/Calme » non supposé favorable (`PerformanceModule.jsx:457-462`) → vent 0 conservateur + warning. (PLAN PERF 1bis.3)

**Validation Phase 5 :** T13 (météo coupée → calcul bloqué/signalé, jamais 15 °C en silence).

---

## PHASE 6 — Performance : facteur de sécurité, pente/surface, code mort (A9, A10, A11)

**6.1 — Facteur de sécurité PERSISTÉ (A9). ✅ DÉCISION ACTÉE 2026-06-05 : Option A.**
- Fichiers : `src/utils/performanceSafetyFactor.js:85`, `src/features/performance/components/PerformanceStateMatrix.jsx:194`, `src/features/performance/PerformanceModule.jsx:516-555` (note/info-bulle), `src/features/flight-wizard/steps/Step7Summary.jsx` (PDF/synthèse), `src/services/flightPlanSupabaseService.js`.
- Action — la marge choisie n'est plus cosmétique :
  1. **Appliquer une seule fois, à la construction du résultat persisté.** Au moment d'écrire `flightPlan.performance.{departure,arrival}`, stocker pour chaque distance : `{ raw, factorId, factorValue, factored: applySafetyFactor(raw, opId, factorValue) }`. La marge est appliquée **là**, pas une deuxième fois ailleurs.
  2. **L'affichage lit le stocké.** `PerformanceStateMatrix.jsx:194` doit afficher `raw` + `factored` à partir de l'objet stocké (ne **pas** re-multiplier → éviter la double marge).
  3. **PDF / synthèse** (`Step7Summary`) : la distance opérationnelle imprimée = `factored` ; le `raw` est montré en second + la marge appliquée est nommée (« × 1,43 — IFR/CAT EASA »).
  4. **Comparaison distance-vs-piste** (go/no-go automatique) : utiliser `factored`, jamais `raw`.
- **Info-bulle du sélecteur de marge** (`renderSafetyFactorSelector`, `PerformanceModule.jsx:516-555`) — réécrire la note explicative pour qu'elle indique clairement :
  - que la marge sélectionnée est **désormais appliquée au plan sauvegardé et au PDF** (plus seulement à l'écran) ;
  - **+ mention K-factor (cf. Phase 7)** : « ⚠ Ces distances n'intègrent **PAS** de facteur de dégradation propre à l'avion (*K-factor* : usure moteur/cellule, traînée réelle d'une immatriculation donnée). Elles supposent un avion conforme au MANEX. Appliquez votre propre marge si votre appareil est dégradé. »
- Garde-fou anti-double-marge : la fonction `applySafetyFactor` ne doit être appelée **qu'au point 1**. Tout autre appel (affichage, PDF) lit la valeur déjà majorée.

**6.2 — Pente & surface de piste (A10).**
- Fichiers : `PerformanceModule.jsx:475,485` (`runwaySlope:0`), `performanceCharts.js:185` (grass/contaminated, mort).
- Action : soit (a) injecter la pente réelle (VAC/piste) et des coefficients de surface validés dans le résolveur, soit (b) afficher « corrections piste non appliquées — vérifier MANEX » et retirer les constantes mortes. **Ne pas laisser `0` passer pour une pente mesurée.**

**6.3 — Supprimer le code mort moteur (A11). → PLAN PERF Lot 2.1.**
- `src/features/performance/components/PerformanceCalculator.jsx` (orphelin) et `src/features/aircraft/utils/performanceCharts.js` (seul consommateur = l'orphelin). Vérifier aucun import résiduel (attention `ManexViewer` éventuel). Supprimer le mapping `performance.takeoff/landing/cruise.*` legacy s'il n'a plus aucun lecteur.

**Validation Phase 6 :** T12 (piste herbe/pentue → distances augmentent ou mention explicite). `npm run build` sans import cassé après suppression.

---

## PHASE 7 — V-vitesses & K-factor (A7, A8) ✅ DÉCISIONS ACTÉES 2026-06-05

**7.1 — K-factor : NON RETENU (Option 7.B).**
- Décision : **ne pas ajouter** de champ `kFactor` ni d'application au calcul. L'app calcule la performance **brute MANEX** ; la seule marge est le facteur de sécurité réglementaire (Phase 6.1).
- Justification : en aviation légère, les propriétaires disposent rarement d'un K-factor mesuré par suivi de flotte ; promettre un modèle de dégradation non alimentable serait trompeur.
- **Action obligatoire anti-ambiguïté** : l'info-bulle du sélecteur de marge (Phase 6.1, `PerformanceModule.jsx:516-555`) **doit mentionner explicitement** que le K-factor n'est **pas** pris en compte, **en expliquant ce que c'est** (facteur de dégradation propre à une immatriculation : usure moteur, cellule, traînée réelle). Texte spécifié au point « Info-bulle » de la Phase 6.1.
- Rien à supprimer côté K-factor (jamais implémenté).

**7.2 — V-vitesses : AFFICHER en synthèse (A7).**
- Action : exposer `speeds.{vr,vx,vy,vapp,vref,vglide,vle,vlo}` (saisies dans Step2Speeds, aujourd'hui ignorées) dans la **synthèse de préparation / check performance** (affichage de référence type bug-speeds), sans entrer dans un calcul. Cela transforme une donnée morte en aide pilote à coût quasi nul.
- `voRanges` / `baseFactor` : restent non utilisés ; si non affichés, le signaler dans l'aide (« vitesses de manœuvre : consulter l'AFM ») plutôt que de les laisser saisis-puis-ignorés en silence.

**Validation Phase 7 :** T8 (vr=999 saisi → **visible** en synthèse, plus jamais saisi-puis-ignoré en silence). T9 (K-factor : champ **absent** + mention explicative présente dans l'info-bulle — aucune valeur de dégradation fantôme).

---

## PHASE 8 — Contrôles MZFW / MLW manquants (A13 ; W5/W6)

**8.1 — MZFW.**
- Fichiers : `Step3WeightBalance.jsx` (saisie, ajouter `weights.mzfw`), `weight-balance/utils/calculations.js:190` (déjà lu mais souvent `null`).
- Action : ajouter le champ MZFW au wizard ; activer l'alerte « masse sans carburant dépassée » dans le scénario ZFW et le store principal.

**8.2 — MLW.**
- Fichiers : `weightBalanceStore.js` (résultat), `Step6WeightBalance.jsx:344-395`, `WeightBalanceChart.jsx:62`.
- Action : intégrer `landingWeight ≤ MLW` au contrôle du **store** (pas seulement à l'affichage). `isWithinLimits` tient compte de l'atterrissage.

**Validation Phase 8 :** T14 (dépassement MZFW → alerte ; surcharge atterrissage > MLW → non « dans les limites »).

---

## PHASE 9 — Hygiène : logs dans le chemin de calcul (A12)

- Fichier : `weightBalanceStore.js:62-67,124-127,217-230` (et équivalents).
- Action : retirer/garder derrière un flag `DEBUG` les `console.log` du calcul CG/moment. Aucun bruit en production.

---

## PHASE 10 — Validation finale (empirique + automatisée)

**10.1 — Rejouer le plan de test d'audit T1–T14** (protocole : éditer « Mes avions » → recharger → sélectionner → charge de référence → relever). Chaque test doit basculer de « FIGÉ/MORT » à « réagit/alarme ».

**10.2 — Golden + propriété** (étend PLAN PERF Lot 6) :
- CG : monotonie du moment, enveloppe trapézoïdale respectée, jamais d'« OK » sur enveloppe absente.
- Densité : unicité 0,84/0,72.
- Masse : décollage et atterrissage issues du même module, même densité.

**10.3 — Revue croisée** : `grep` de non-régression — plus aucune occurrence de `0.80` densité, `|| 600/1150/1000`, `forwardPoints?.[0]?.cg` comme limite, `DENSITIES`, `getMockMETAR` en prod, `runwaySlope: 0` non justifié.

**Définition de « terminé » :**
> Toute masse, tout centrage et toute distance affichés en préparation de vol proviennent **des données réelles de l'avion** (« Mes avions ») via **un seul moteur** (centrage canonique + résolveur d'abaques), avec **densité 0,84 unique**, **enveloppe trapézoïdale réelle**, **aucun fallback silencieux** (alarme nommée à la place), et la suite golden/propriété/T1–T14 est verte.

---

## Séquencement recommandé & jalons

1. **Phase 0** (filet) — bloquant.
2. **Phase 1** (densité) — fondation, faible risque → commit/jalon.
3. **Phase 2** (enveloppe CG) — le correctif critique → jalon + démo T6/T7.
4. **Phase 3** (masse unique) — dépend de 1 → jalon T11.
5. **Phase 4** (anti-fantômes) — dépend de 2/3.
6. **Phases 5–6** (ISA/perf, via PLAN PERF) — en parallèle possible.
7. **Phase 7** (gate V-vitesses/K-factor) — après décision produit.
8. **Phases 8–9** (MZFW/MLW, hygiène).
9. **Phase 10** (validation) — continue, verrou final.

**Estimation d'effort relative :** Phase 2 ≈ 35 % (cœur), Phase 3 ≈ 20 %, Phase 1+4 ≈ 20 %, Phases 5-6 ≈ 15 % (déjà spécifiées), Phases 7-9 ≈ 10 %.

*Décisions produit ACTÉES (2026-06-05) : (6.1) facteur de sécurité **persisté** dans le plan/PDF + comparaison piste, appliqué une seule fois, brut+majoré affichés ; (7) K-factor **non retenu** (pas de champ, pas d'application) + mention explicative obligatoire dans l'info-bulle du sélecteur de marge ; V-vitesses **affichées** en synthèse.*
