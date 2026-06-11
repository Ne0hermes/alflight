# Logs en attente — le serveur Google Sheets était injoignable le 2026-06-10
# (« ERREUR: Impossible de se connecter au serveur distant », 3 tentatives).
# Rejouer ce script tel quel quand la connexion est rétablie, puis le supprimer.
# Contient 6 entrées : (1) audit v2.0, (2) plan de correctifs, (3) livraison Phases 0+1,
# (4) livraison Phase 2 + C3.1, (5) livraison C3.2 + dry-run C5, (6) C5 appliquée en base.

& "D:\Applicator\alflight\scripts\claude-log-action.ps1" -Summary "Audit unites M&C refait integralement (v2.0) + analyse dediee au bug de conversion kg/lbs du module avion" -Details @'
Actions effectuees :
- Re-instruction complete de l audit v1 : 3 agents d exploration paralleles + lectures directes des fichiers pivots (Step3WeightBalance, weightBalanceStore, armUnits, aircraftStore, aircraftNormalizer)
- Chaque constat v1 confirme ou corrige ligne a ligne (table de tracabilite en Annexe C)
- NOUVEAU chapitre A : analyse particuliere du probleme kg/lbs dans le module avion

Constats majeurs v2 :
1. kg/lbs (P0) : les masses (masse a vide, MTOW, MLW, enveloppe) sont stockees dans l unite d affichage et REECRITES sur place a chaque changement de preference (Step3 lignes 305-322), pendant que le moteur les lit en kg sans conversion (weightBalanceStore 46-51). Aucune heuristique de magnitude possible (plages kg/lbs recouvrantes) : corruption x2.2046 interne-coherente donc indetectable, CG faux en melange kg/lbs.
2. La couche corrective armUnits.js avoue la cause racine du double pivot m/mm et la ponte par une devinette de magnitude (>10 => /1000) qui CASSE les cm (x10) et les pouces (x25.4). L enveloppe CG est exclue de cette normalisation.
3. La metadonnee d unites existe mais c est une constante codee en dur (kg/mm) qui desarme la migration legacy (correction du constat v1 qui la croyait absente).
4. %MAC : formule inexistante dans l app (seuls macLength/lemac stockes) - tranche.
5. Volet carburant : toStorage sans densite (kg vers litres toujours 0.72 meme JET-A1), facteur 6.01 lbs/gal fige.

Fichiers :
- alflight/AUDIT_MASSE_CENTRAGE_UNITES.md (REECRIT v2.0) : synthese D1-D3, chapitre A kg/lbs (mecanismes M1-M7, scenario chiffre, detection par reference externe), 5 axes re-instruits, plan de tests d invariance par unite, migration duale, 17 anomalies dont 7 P0, annexe de corrections v1
- Audites non modifies : Step3WeightBalance.jsx, weightBalanceStore.js, armUnits.js, aircraftStore.js, aircraftNormalizer.js, unitConversions.js, mbUnits.js, unitsStore.js

Resultat :
Audit v2.0 complet et verifie, cause racine kg/lbs identifiee (mutation de l unite de reference + lecture moteur nue), plan de remediation et de migration pret a executer.
'@ -Files "alflight/AUDIT_MASSE_CENTRAGE_UNITES.md, src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx, src/core/stores/weightBalanceStore.js, src/utils/armUnits.js, src/core/stores/aircraftStore.js" -Component "Masse & Centrage - Unites"

# ── Entrée 2 : plan de correctifs ───────────────────────────────────────────
& "D:\Applicator\alflight\scripts\claude-log-action.ps1" -Summary "Plan de correctifs unites M&C redige (28 correctifs en 6 phases ordonnees par dependances)" -Details @'
Actions effectuees :
- Compilation de la liste des correctifs a partir des 17 anomalies de l audit v2.0 (AUDIT_MASSE_CENTRAGE_UNITES.md)
- Ordonnancement par dependances : Phase 0 filet de tests, Phase 1 convertisseur fail-closed, Phase 2 frontieres de saisie (toStorage/fromStorage masses ET bras + suppression reecriture in-place), Phase 3 pivot unique m/kg + metadonnee vraie + enveloppe normalisee, Phase 4 IHM, Phase 5 migration des donnees
- Regles cles : heuristique armToMeters transformee en detecteur seulement APRES migration ; migration masses kg/lbs par reference externe (jamais par magnitude) ; quarantaine fail-closed si ambiguite

Fichiers :
- alflight/PLAN_CORRECTIFS_UNITES.md (CREE) : 28 correctifs C0.1-C5.4 avec ANO de reference, fichiers:lignes cibles, graphe de dependances, DoD

Resultat :
Plan de correctifs actionnable, chaque item trace vers son anomalie d audit et ses fichiers cibles.
'@ -Files "alflight/PLAN_CORRECTIFS_UNITES.md, alflight/AUDIT_MASSE_CENTRAGE_UNITES.md" -Component "Masse & Centrage - Unites"

# ── Entrée 3 : livraison Phases 0 + 1 du plan de correctifs ─────────────────
& "D:\Applicator\alflight\scripts\claude-log-action.ps1" -Summary "Phases 0 et 1 du plan correctifs unites livrees : filet de tests (preuve rouge) + convertisseur fail-closed, suite 135 tests verte, build OK" -Details @'
Actions effectuees :
- C0.1 : test d invariance du CG par prereglage d unites (canonique vert ; USA lbs/in, Metric cm, enveloppe Europe, marge x4 = rouges prouves puis figes en it.fails tripwires)
- C0.2 : matrice de conversion exhaustive - 7 rouges avant correction, tout vert apres
- C1.1 : convertValue cle manquante => throw en dev/test, NaN en prod (ANO-3)
- C1.2 : non-numerique => NaN au lieu de 0 ; bonus 0 degre C => 32 F
- C1.3 : toStorage/fromStorage catch => null/vide + garde isFinite (ANO-4)
- C1.4 : densite parametrable galToLbs/lbsToGal + opts transmis (ANO-14)
- C1.5/C1.6 : console.log retires ; alias km/h, m/s, mi/h normalises
- C3.6 anticipe : Step6 densite via getFuelDensity canonique aux 3 sites

Fichiers modifies :
- src/utils/unitConversions.js, src/features/aircraft/utils/mbUnits.js, src/features/flight-wizard/steps/Step6WeightBalance.jsx
- src/utils/__tests__/unitConversions.matrix.test.js (CREE), src/core/stores/__tests__/weightBalanceStore.invariance.test.js (CREE)
- PLAN_CORRECTIFS_UNITES.md : journal d execution

Resultat :
Suite complete 13 fichiers / 135 tests verts + 4 expected fail (tripwires), build de production OK, zero regression. Branche feat/owned-clone-manex, non committe. Prochaine etape : Phase 2.
'@ -Files "src/utils/unitConversions.js, src/features/aircraft/utils/mbUnits.js, src/features/flight-wizard/steps/Step6WeightBalance.jsx, src/utils/__tests__/unitConversions.matrix.test.js, src/core/stores/__tests__/weightBalanceStore.invariance.test.js, PLAN_CORRECTIFS_UNITES.md" -Component "Masse & Centrage - Unites"

# ── Entrée 4 : livraison Phase 2 + C3.1 (pivot mètre + frontières Step3) ────
& "D:\Applicator\alflight\scripts\claude-log-action.ps1" -Summary "Phase 2 + C3.1 livrees : pivot bras = metre, saisie Step3 canonique aux frontieres, suppression de la reecriture in-place (bug kg/lbs eteint a la source)" -Details @'
Actions effectuees :
- C3.1 : pivot bras = METRE (mbUnits.STORAGE_UNITS et unitsDisplay.CANONICAL_UNITS mm vers m, convertMoment derive du pivot kg.m)
- C2.1/C2.2 : tous les champs masses et bras de Step3 passent par fromStorage/toStorage (masse a vide/MTOW/MLW/min, trio a vide, sieges, compartiments, reservoirs, MAC/LEMAC, Forward, Aft)
- C2.3 : effet de reecriture in-place SUPPRIME - une preference d unites ne touche plus jamais la donnee (vecteur principal du bug kg/lbs)
- C2.4/C2.5 : stockage de nombres canoniques, recalculs 2-sur-3 en canonique
- Hydratation wizard : normalizeAircraftForWizard normalise bras (mm vers m) et moments (kg.mm vers kg.m) legacy a l ouverture ; masses jamais devinees
- Affichages : graphe double Step3, recap Step5Review, %MAC du PDF homogene en metres
- Filet vert : 3 tests d invariance via toStorage (Europe mm / USA lbs-in / Metric cm => meme CG 2.132 m, meme verdict)

Fichiers modifies :
- Step3WeightBalance.jsx, mbUnits.js, unitsDisplay.js, armUnits.js, AircraftCreationWizard.jsx, Step5Review.jsx, AircraftModule.jsx, weightBalanceStore.invariance.test.js, PLAN_CORRECTIFS_UNITES.md

Resultat :
Suite 138 tests verts + 4 tripwires attendus, build prod OK. Le wizard stocke desormais exclusivement du canonique (kg, m, kg.m). Restes : migration stock legacy (C5), metadonnee vraie (C3.2), verification navigateur.
'@ -Files "src/features/aircraft/components/wizard-steps/Step3WeightBalance.jsx, src/features/aircraft/utils/mbUnits.js, src/utils/unitsDisplay.js, src/utils/armUnits.js, src/features/aircraft/components/AircraftCreationWizard.jsx, src/features/aircraft/components/wizard-steps/Step5Review.jsx, src/features/aircraft/AircraftModule.jsx" -Component "Masse & Centrage - Unites"

# ── Entrée 5 : C3.2 métadonnée vraie + dry-run migration C5 ─────────────────
& "D:\Applicator\alflight\scripts\claude-log-action.ps1" -Summary "C3.2 metadonnee vraie + dry-run migration C5 executes : 4 avions migrables auto, 2 en quarantaine (F-HFGI, F-GOVE), masses 6/6 ambigues kg/lbs" -Details @'
Actions effectuees :
- C3.2 ecriture : addAircraft ecrit _metadata version 3.0.0 + unitsVerified true + armLength m ; updateAircraft estampille aussi v3 (la reedition wizard vaut re-confirmation)
- C3.2 lecture : unitsVerified true => aucune migration par metadonnee (sans ce garde, m different de mm aurait declenche convertAircraftUnits x1000 - piege ANO-9) ; comportement legacy inchange
- C5.4 dry-run : scripts/units-migration-dry-run.js (LECTURE SEULE) sur base reelle : 6 avions, 4 MIGRABLE_AUTO, 2 QUARANTAINE (F-HFGI, F-GOVE - bras ambigus mm/cm), masses 6/6 AMBIGU_KG_OU_LBS, unitsVerified 0/6
- Rapport JSON : scripts/units-dry-run-report.json

Fichiers :
- src/core/stores/aircraftStore.js, scripts/units-migration-dry-run.js (CREE), PLAN_CORRECTIFS_UNITES.md

Resultat :
Suite 138 tests verts + 4 tripwires, build prod OK. Nouveaux avions et avions reedites portent une metadonnee VRAIE et verifiee. Migration du stock instruite par rapport reel ; reste la revue humaine (2 avions + masses).
'@ -Files "src/core/stores/aircraftStore.js, scripts/units-migration-dry-run.js, scripts/units-dry-run-report.json, PLAN_CORRECTIFS_UNITES.md" -Component "Masse & Centrage - Unites"

# ── Entrée 6 : migration C5 appliquée en base ───────────────────────────────
& "D:\Applicator\alflight\scripts\claude-log-action.ps1" -Summary "Migration C5 APPLIQUEE en base : 6/6 avions migres en metres + metadonnee v3, F-GOVE fuelArm corrige sur decision pilote, verification finale 0 quarantaine" -Details @'
Actions effectuees :
- Decisions pilote : ambigus F-HFGI/F-GOVE = mm ; masses 6/6 = kg ; application autorisee
- units-migration-apply.js : sauvegarde integrale puis 6/6 avions reecrits (~70 conversions journalisees), metadonnee v3 + unitsVerified + marqueur migration
- Verification finale (dry-run re-execute) : bras 6/6 m, enveloppe 6/6 m, 0 quarantaine, metadonnee verifiee 6/6
- Correctif cible valide pilote : F-GOVE weightBalance.fuelArm aberrant (10) corrige a 1.1027 m (3 champs concordants)
- Plancher de plausibilite 0.20 vers 0.15 m (cas reel 0.19 m)

Fichiers :
- scripts/units-migration-apply.js, scripts/fix-fgove-fuelarm.js, sauvegarde backup-community-presets-2026-06-10*.json, journal units-migration-journal-2026-06-10*.json, PLAN_CORRECTIFS_UNITES.md

Resultat :
Base communautaire entierement migree et verifiee (metres partout, metadonnees vraies). Sauvegarde et journal disponibles. Restent : recette navigateur, bascule tripwires apres C3.3, C3.4 en dernier.
'@ -Files "scripts/units-migration-apply.js, scripts/fix-fgove-fuelarm.js, scripts/units-migration-journal-2026-06-10T16-00-35-915Z.json, PLAN_CORRECTIFS_UNITES.md" -Component "Masse & Centrage - Unites"
