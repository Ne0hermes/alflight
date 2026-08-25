// src/core/contexts/index.jsx
import React, { createContext, useContext, useMemo, useCallback, memo } from 'react';
import { useAircraftStore } from '../stores/aircraftStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useFuelStore, activeTankIdsFrom } from '../stores/fuelStore';
import { applyTankVariant } from '@utils/tankVariants';
import { useWeightBalanceStore } from '../stores/weightBalanceStore';
import { useWeatherStore } from '../stores/weatherStore';
import { getFuelDensity } from '@utils/fuelDensity';

// Contexte pour les données d'avion uniquement
const AircraftContext = createContext();
export const useAircraft = () => {
  const context = useContext(AircraftContext);
  if (!context) throw new Error('useAircraft must be used within AircraftProvider');
  return context;
};

// Contexte pour la navigation uniquement
const NavigationContext = createContext();
export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used within NavigationProvider');
  return context;
};

// Contexte pour le carburant uniquement
const FuelContext = createContext();
export const useFuel = () => {
  const context = useContext(FuelContext);
  if (!context) throw new Error('useFuel must be used within FuelProvider');
  return context;
};

// Contexte pour masse et centrage uniquement
const WeightBalanceContext = createContext();
export const useWeightBalance = () => {
  const context = useContext(WeightBalanceContext);
  if (!context) throw new Error('useWeightBalance must be used within WeightBalanceProvider');
  return context;
};

// Contexte pour la météo
const WeatherContext = createContext();
export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within WeatherProvider');
  return context;
};

// Providers optimisés avec mémorisation
export const AircraftProvider = memo(({ children }) => {
  const aircraftList = useAircraftStore(state => state.aircraftList);
  const selectedAircraftId = useAircraftStore(state => state.selectedAircraftId);
  const rawSelectedAircraft = useAircraftStore(state => {
    const id = state.selectedAircraftId;
    return state.aircraftList.find(a => a.id === id) || null;
  });
  // 🔧 LOT 5 — AVION EFFECTIF : point de dérivation UNIQUE de la variante de
  // réservoirs. Tous les consommateurs (FOB dérivé, cochage par vol, devis de
  // masse, scénarios) reçoivent l'avion filtré par la variante choisie —
  // additionalFuelTanks/fuelCapacity recalculés — sans aucune modification de
  // leur côté. Avion sans variantes : identité STRICTE (même référence).
  const selectedTankVariantId = useAircraftStore(state => state.selectedTankVariantId);
  const setSelectedTankVariant = useAircraftStore(state => state.setSelectedTankVariant);
  const selectedAircraft = React.useMemo(
    () => applyTankVariant(rawSelectedAircraft, selectedTankVariantId),
    [rawSelectedAircraft, selectedTankVariantId]
  );
  const setSelectedAircraft = useAircraftStore(state => state.setSelectedAircraft);
  const updateAircraft = useAircraftStore(state => state.updateAircraft);
  const deleteAircraft = useAircraftStore(state => state.deleteAircraft);
  const addAircraft = useAircraftStore(state => state.addAircraft);
  const loadFromSupabase = useAircraftStore(state => state.loadFromSupabase);
  const isInitialized = useAircraftStore(state => state.isInitialized);
  const error = useAircraftStore(state => state.error);

  // 🔧 FIX: DÉSACTIVATION CHARGEMENT AUTOMATIQUE DEPUIS SUPABASE
  // L'utilisateur doit créer ses avions via le wizard uniquement
  // React.useEffect(() => {
  //   if (!isInitialized) {
  //     loadFromSupabase().catch(err => {
  //       console.error('❌ Échec du chargement initial Supabase:', err);
  //     });
  //   }
  // }, [isInitialized, loadFromSupabase]);

  // 📣 MISES À JOUR DES AVIONS IMPORTÉS (demande César, 25/08/2026).
  // Conséquence directe de la désactivation ci-dessus : les copies locales sont
  // FIGÉES — quand l'admin corrige une fiche communautaire, l'utilisateur ne le
  // voyait JAMAIS (il volait avec des données périmées). Ici : UNE requête
  // légère (id, registration, version — pas les fiches) sur les presets dont
  // une copie locale existe, et les copies en retard partent dans
  // aircraftUpdatesStore ; la bannière du module Avions les affiche. AUCUNE
  // écriture : le pilote choisit (mettre à jour / ignorer). Hors-ligne ou base
  // injoignable : silence — l'app fonctionne comme avant.
  const updatesCheckedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isInitialized || updatesCheckedRef.current) return;
    const copies = aircraftList.filter((a) => a.communityPresetId);
    if (copies.length === 0) return;
    updatesCheckedRef.current = true;
    (async () => {
      try {
        const [{ useAircraftUpdatesStore }, { default: communityService }] = await Promise.all([
          import('../stores/aircraftUpdatesStore'),
          import('@services/communityService'),
        ]);
        const ids = [...new Set(copies.map((a) => a.communityPresetId))];
        const distantes = await communityService.getPresetVersions(ids);
        const parId = new Map(distantes.map((r) => [r.id, r]));
        const enRetard = [];
        for (const a of copies) {
          const distante = parId.get(a.communityPresetId);
          const localVersion = a.version || 1;
          const remoteVersion = distante?.version || 1;
          if (distante && remoteVersion > localVersion) {
            enRetard.push({
              id: a.communityPresetId,
              localId: a.id,
              registration: a.registration || distante.registration,
              localVersion,
              remoteVersion,
            });
          }
        }
        useAircraftUpdatesStore.getState().setUpdates(enRetard);
      } catch (e) {
        console.warn('[AircraftProvider] Vérification des mises à jour impossible (hors-ligne ?) :', e?.message);
      }
    })();
  }, [isInitialized, aircraftList]);

  // 🔧 FIX: Charger les avions depuis IndexedDB au démarrage (pas localStorage - Out of Memory)
  React.useEffect(() => {
    if (!isInitialized) {
      const loadFromIndexedDB = async () => {
        console.log('📂 [AircraftProvider] Chargement depuis IndexedDB...');
        try {
          const { default: dataBackupManager } = await import('@utils/dataBackupManager');

          // 🔧 FIX: Charger TOUS les avions mais SANS les données volumineuses
          const allRecords = await dataBackupManager.getAllFromStore('aircraftData');

          // 🔐 CLOISONNEMENT PAR COMPTE (16/08) — bug constaté par César : un
          // avion ajouté sur un profil apparaissait sur TOUS les profils, et sa
          // suppression le retirait partout (IndexedDB partagée). On ne montre
          // que les avions du compte propriétaire courant (même marqueur que
          // les coffres de accountDataIsolation).
          // Avions HÉRITÉS (sans propriétaire, créés avant ce correctif) : ils
          // sont ADOPTÉS une fois par le compte courant — jamais supprimés.
          let ownerAccountId = null;
          try { ownerAccountId = localStorage.getItem('alflight:data-owner'); } catch { /* stockage indisponible */ }

          let allAircraft = allRecords;
          if (ownerAccountId) {
            const orphans = allRecords.filter((a) => !a.ownerAccountId);
            for (const orphan of orphans) {
              try {
                await dataBackupManager.saveAircraftData({ ...orphan, ownerAccountId });
                orphan.ownerAccountId = ownerAccountId;
              } catch (e) {
                console.warn('[AircraftProvider] Adoption de l\'avion hérité impossible :', orphan?.registration, e?.message);
              }
            }
            allAircraft = allRecords.filter((a) => a.ownerAccountId === ownerAccountId);
            if (allAircraft.length !== allRecords.length) {
              console.log(`🔐 [AircraftProvider] ${allRecords.length - allAircraft.length} avion(s) d'un autre compte masqué(s)`);
            }
          }

          // 🛡️ FIX OOM (Out of Memory) CRITIQUE :
          // L'ancien code faisait `const light = { ...aircraft }` qui CLONE
          // le champ `photo` (base64 jusqu'à 3 MB) ET `manex` (PDF base64
          // jusqu'à 12 MB par avion) AVANT de les supprimer. Pour 2 avions
          // équipés, ça doublait temporairement la mémoire (~50-60 MB d'un
          // coup, plus l'overhead du .map), suffisant pour faire crasher le
          // renderer Chrome avec "out of memory" sur navigation vers
          // n'importe quel onglet wrappé par FlightSystemProviders.
          //
          // Solution : on EXTRAIT les champs lourds via destructuring AU LIEU
          // de les cloner. `rest` ne contient que les pointeurs vers les
          // champs légers — la photo et le MANEX du blob IDB d'origine
          // ne sont jamais référencés ni copiés dans `light`. La string
          // base64 originale reste référencée par `aircraft` (le tableau
          // `allAircraft`) jusqu'à la fin du map, puis tout est ramassé en
          // une seule passe par le GC.
          const lightAircraft = allAircraft.map((aircraft) => {
            const {
              photo,
              profilePhoto,
              manex,
              ...rest
            } = aircraft;

            const light = rest;

            // Flags légers basés sur la présence (pas la valeur) — pas de
            // référence aux strings base64 retenue dans `light`.
            light.hasPhoto = !!(photo || profilePhoto);
            light.hasManex = !!manex;

            // Pour les performance tables : on remplace `sourceImage` (gros
            // base64) par `null` plutôt que de cloner et delete. On crée
            // de nouveaux objets pour ne pas muter `aircraft`.
            if (light.advancedPerformance?.tables) {
              light.advancedPerformance = {
                ...light.advancedPerformance,
                tables: light.advancedPerformance.tables.map(({ sourceImage, ...t }) => t)
              };
            }

            // 🛡️ FIX OOM (2026-06) — la liste « légère » ne strippait QUE
            // l'ancien champ `sourceImage` + photo/manex. Les NOUVEAUX gros
            // blobs accumulés depuis (R20) restaient en mémoire pour TOUS les
            // avions : `fitted` (200 pts/courbe × ~160 courbes), images
            // d'abaque base64 (`workshop.image.url`, ~2,7 Mo), PDF de pesée
            // base64 (~4,6 Mo). Mesuré : la liste pesait 31 Mo en state (F-GIEA
            // 13 Mo, F-GNAM 9 Mo) → le renderer Chrome mourait (« Render process
            // gone, out of memory ») quelques secondes après l'ouverture de
            // « Mes avions ». On les retire ici : la liste sert à l'AFFICHAGE
            // (les cartes n'ont besoin ni des courbes interpolées, ni de l'image
            // d'abaque, ni du PDF de pesée). L'ÉDITION recharge le record COMPLET
            // depuis IndexedDB (handleEdit → getAircraftData) et le moteur de
            // cascade RÉGÉNÈRE `fitted` à la volée (ensureFittedGraphs, R20).
            if (light.performanceModels) {
              light.performanceModels = light.performanceModels.map((model) => {
                if (!model.data?.graphs) return model;
                const meta = model.data.metadata;
                const strippedMeta = meta?.workshop?.image?.url
                  ? { ...meta, workshop: { ...meta.workshop, image: null } }
                  : meta;
                return {
                  ...model,
                  data: {
                    ...model.data,
                    metadata: strippedMeta,
                    graphs: model.data.graphs.map(({ sourceImage, ...g }) => ({
                      ...g,
                      curves: (g.curves || []).map((c) =>
                        c.fitted?.points?.length ? { ...c, fitted: { ...c.fitted, points: [] } } : c
                      )
                    }))
                  }
                };
              });
            }

            // PDF de pesée base64 (~4,6 Mo) : on garde les métadonnées (le badge
            // « fiche présente », la date), pas le blob. La visionneuse recharge
            // depuis l'URL Storage (R20/B) ou IndexedDB à la demande.
            if (light.weighingReport?.pdfData) {
              const { pdfData, ...wrRest } = light.weighingReport;
              light.weighingReport = { ...wrRest, hasData: true };
            }

            // 🔧 FIX CRITIQUE: Mapper weights.emptyWeight → emptyWeight pour les anciens avions
            // Les avions créés avant la correction ont weights.emptyWeight mais pas emptyWeight (propriété racine)
            // Le code WeightBalanceStore et WeightBalanceTable s'attendent à aircraft.emptyWeight
            if (!light.emptyWeight && light.weights?.emptyWeight) {
              light.emptyWeight = parseFloat(light.weights.emptyWeight);
              console.log(`✅ [AircraftProvider] Mapped weights.emptyWeight → emptyWeight for ${light.registration}: ${light.emptyWeight} kg`);
            }
            if (!light.maxTakeoffWeight && light.weights?.mtow) {
              light.maxTakeoffWeight = parseFloat(light.weights.mtow);
              console.log(`✅ [AircraftProvider] Mapped weights.mtow → maxTakeoffWeight for ${light.registration}: ${light.maxTakeoffWeight} kg`);
            }
            // 🔧 FIX: Mapper minTakeoffWeight depuis weights ou utiliser emptyWeight comme fallback
            if (!light.minTakeoffWeight) {
              // Si weights.minTakeoffWeight existe, l'utiliser
              if (light.weights?.minTakeoffWeight) {
                light.minTakeoffWeight = parseFloat(light.weights.minTakeoffWeight);
              }
              // Sinon, la masse à vide est le minimum PHYSIQUE (dérivation
              // d'une donnée réelle, pas une invention).
              else if (light.emptyWeight) {
                light.minTakeoffWeight = light.emptyWeight;
              }
              // 🔧 24/08/2026 — le « 600 » de dernier recours est SUPPRIMÉ
              // (règle pilote : rien, aucun fallback). Ni masse mini ni masse
              // à vide connues : le champ reste ABSENT et le devis refuse.
              console.log(`✅ [AircraftProvider] Set minTakeoffWeight for ${light.registration}: ${light.minTakeoffWeight} kg`);
            }

            // 🔧 FIX CRITIQUE: Créer weightBalance depuis arms si manquant
            // Les anciens avions ont arms mais pas weightBalance
            // Le code WeightBalanceStore vérifie weightBalance.emptyWeightArm et weightBalance.cgLimits
            if (light.arms && (!light.weightBalance || !light.weightBalance.emptyWeightArm)) {
              const parseOrNull = (value) => {
                if (!value || value === '' || value === '0') return null;
                const parsed = parseFloat(value);
                return isNaN(parsed) ? null : parsed;
              };

              light.weightBalance = {
                frontLeftSeatArm: parseOrNull(light.arms.frontSeats) || parseOrNull(light.arms.frontSeat),
                frontRightSeatArm: parseOrNull(light.arms.frontSeats) || parseOrNull(light.arms.frontSeat),
                rearLeftSeatArm: parseOrNull(light.arms.rearSeats) || parseOrNull(light.arms.rearSeat),
                rearRightSeatArm: parseOrNull(light.arms.rearSeats) || parseOrNull(light.arms.rearSeat),
                fuelArm: parseOrNull(light.arms.fuelMain) || parseOrNull(light.arms.fuel),
                emptyWeightArm: parseOrNull(light.arms.empty),
                // 🔧 24/08/2026 — BONNES clés (baggageFwd/baggageAft ; les
                // anciennes n'existent dans aucun schéma) et AUCUN défaut :
                // les 3,50/3,70 fabriqués ici ont contaminé F-GUVV en base.
                baggageArm: parseOrNull(light.arms.baggageFwd) ?? parseOrNull(light.arms.baggage),
                auxiliaryArm: parseOrNull(light.arms.baggageAft) ?? parseOrNull(light.arms.auxiliaryBaggage),
                cgLimits: (() => {
                  // Vérifier si cgLimits existe et est valide
                  const hasValidCgLimits = light.cgLimits &&
                    light.cgLimits.forward !== '' &&
                    light.cgLimits.aft !== '';

                  if (hasValidCgLimits) {
                    return light.cgLimits;
                  }

                  // Utiliser cgEnvelope comme fallback
                  if (light.cgEnvelope) {
                    return {
                      forward: parseOrNull(light.cgEnvelope.forwardPoints?.[0]?.cg),
                      aft: parseOrNull(light.cgEnvelope.aftCG),
                      forwardVariable: light.cgEnvelope.forwardPoints || []
                    };
                  }

                  // Dernier fallback
                  return {
                    forward: null,
                    aft: null,
                    forwardVariable: []
                  };
                })()
              };
              console.log(`✅ [AircraftProvider] Created weightBalance from arms for ${light.registration}`);
            }

            return light;
          });

          // 🛡️ FIX DOUBLON (2026-08) : un import communautaire pouvait laisser
          // DEUX records IndexedDB pour la même immatriculation (id local forgé
          // `aircraft-<ts>` + UUID Supabase) — l'avion apparaissait en double.
          // Auto-réparation CONSERVATRICE :
          // - on ne touche QUE la signature exacte du bug (1 record Supabase
          //   + ≥1 record à id forgé pour la même immatriculation) ;
          // - le CONTENU gagnant est le record le plus RÉCENT (les éditions
          //   post-import de l'utilisateur vivaient parfois sur la copie forgée) ;
          // - ce contenu est d'abord PRÉSERVÉ sous l'id Supabase canonique,
          //   PUIS seulement les records forgés sont supprimés ;
          // - tout autre cas de doublon (2 UUID, 2 forgés…) est laissé INTACT
          //   (visible mais aucune donnée détruite) et signalé en console.
          const isForgedId = (id) => /^aircraft[-_]\d+/i.test(String(id || ''));
          // ⚠️ lastModified EN PREMIER : c'est le seul horodatage rafraîchi par
          // dataBackupManager à CHAQUE écriture IndexedDB. _metadata.savedAt peut
          // être hérité d'un autre utilisateur (preset communautaire) ou figé par
          // les chemins d'écriture directe (ManexImporter…) — non fiable seul.
          const recordTime = (a) => {
            const t = a?.lastModified || a?._metadata?.savedAt || a?._metadata?.updatedAt || a?.updatedAt || a?.createdAt || null;
            const parsed = t ? Date.parse(t) : NaN;
            return Number.isNaN(parsed) ? 0 : parsed;
          };
          const contentScore = (a) => {
            let s = 0;
            if (a?.performanceModels?.length || a?.advancedPerformance?.tables?.length || a?.performanceTables?.length) s += 4;
            if (a?.hasManex) s += 2;
            if (a?.hasPhoto) s += 1;
            return s;
          };
          const fullRecordById = new Map(allAircraft.map(a => [a?.id, a]));
          const groupsByRegistration = new Map();
          for (const ac of lightAircraft) {
            const reg = (ac?.registration || '').toString().trim().toUpperCase() || `__noreg__${ac?.id}`;
            if (!groupsByRegistration.has(reg)) groupsByRegistration.set(reg, []);
            groupsByRegistration.get(reg).push(ac);
          }
          const dedupedAircraft = [];
          for (const [reg, group] of groupsByRegistration) {
            if (group.length === 1 || reg.startsWith('__noreg__')) {
              dedupedAircraft.push(...group);
              continue;
            }
            const forgedRecords = group.filter(a => isForgedId(a.id));
            const canonicalRecords = group.filter(a => !isForgedId(a.id));
            // Signature du bug : exactement 1 record Supabase + ≥1 record forgé.
            // Tout autre cas est ambigu → NE RIEN détruire.
            if (canonicalRecords.length !== 1 || forgedRecords.length === 0) {
              console.warn(`⚠️ [AircraftProvider] ${group.length} avions partagent l'immatriculation ${reg} hors signature de doublon d'import — aucune purge (sécurité).`);
              dedupedAircraft.push(...group);
              continue;
            }
            const canonical = canonicalRecords[0];
            // Contenu gagnant : le plus récent ; à date égale, le plus riche ;
            // sinon le record canonique.
            let contentSource = canonical;
            for (const forged of forgedRecords) {
              const newer = recordTime(forged) > recordTime(contentSource);
              const sameTimeButRicher = recordTime(forged) === recordTime(contentSource) && contentScore(forged) > contentScore(contentSource);
              if (newer || sameTimeButRicher) contentSource = forged;
            }
            let repaired = true;
            let mergedFull = null;
            try {
              const fullContentSource = fullRecordById.get(contentSource.id);
              if (!fullContentSource) throw new Error(`Record complet introuvable pour ${contentSource.id}`);

              // Fusion : contenu du record le plus récent + BLOBS rescapés de
              // TOUTES les copies du groupe (photo/manex/pesée peuvent ne vivre
              // que sur la copie forgée — ex. ancien flux AircraftForm — ou que
              // sur la canonique). Aucun blob n'est jamais perdu.
              mergedFull = { ...fullContentSource };
              let rescuedBlobs = false;
              for (const member of group) {
                const fullMember = fullRecordById.get(member.id);
                if (!fullMember || fullMember === fullContentSource) continue;
                for (const field of ['photo', 'profilePhoto', 'manex']) {
                  if (!mergedFull[field] && fullMember[field]) {
                    mergedFull[field] = fullMember[field];
                    rescuedBlobs = true;
                  }
                }
                // weighingReport : le gagnant peut porter un objet « métadonnées
                // seules » ({hasData, url} sans pdfData) — rapatrier le PDF local
                // complet du perdant dans ce cas.
                if (!mergedFull.weighingReport?.pdfData && fullMember.weighingReport?.pdfData) {
                  mergedFull.weighingReport = fullMember.weighingReport;
                  rescuedBlobs = true;
                }
              }
              // Données de performances STRUCTURÉES : si le gagnant n'en a AUCUNE
              // et qu'une copie perdante en porte, les rapatrier (d'un SEUL donneur,
              // pour rester cohérent). Sinon les abaques/tableaux saisis à la main
              // seraient supprimés avec le record forgé.
              const hasPerfData = (r) => !!(r?.performanceModels?.length || r?.advancedPerformance?.tables?.length || r?.performanceTables?.length);
              if (!hasPerfData(mergedFull)) {
                const perfDonor = group
                  .map(m => fullRecordById.get(m.id))
                  .find(fm => fm && fm !== fullContentSource && hasPerfData(fm));
                if (perfDonor) {
                  for (const field of ['performanceModels', 'advancedPerformance', 'performanceTables']) {
                    if (perfDonor[field]) mergedFull[field] = perfDonor[field];
                  }
                  rescuedBlobs = true;
                  console.log(`🔀 [AircraftProvider] Doublon ${reg} : données de performances rapatriées depuis ${perfDonor.id}`);
                }
              }

              // Écrire le record fusionné sous l'id canonique AVANT toute
              // suppression. submitted_by reste celui du record canonique
              // (identité de propriété — sinon la dédup Supabase et le modèle
              // « clone possédé » traitent l'avion comme celui d'un autre).
              if (contentSource !== canonical || rescuedBlobs) {
                await dataBackupManager.saveAircraftData({
                  ...mergedFull,
                  id: canonical.id,
                  aircraftId: canonical.id,
                  submitted_by: canonical.submitted_by ?? mergedFull.submitted_by,
                  _metadata: {
                    ...mergedFull._metadata,
                    supabaseId: canonical.id,
                    mergedFromDuplicate: contentSource !== canonical ? contentSource.id : undefined,
                    mergedAt: new Date().toISOString()
                  }
                });
                console.log(`🔀 [AircraftProvider] Doublon ${reg} : contenu fusionné (source: ${contentSource.id}${rescuedBlobs ? ', blobs rescapés' : ''}) préservé sous l'id canonique ${canonical.id}`);
              }
              for (const forged of forgedRecords) {
                // deleteAircraftData retourne false (sans throw) en cas d'échec —
                // dans ce cas le record survivra et la réparation reconvergera au
                // prochain démarrage (le contenu est déjà préservé sous l'id canonique).
                const deleted = await dataBackupManager.deleteAircraftData(forged.id);
                if (deleted === false) {
                  console.warn(`⚠️ [AircraftProvider] Doublon ${reg} : suppression du record forgé ${forged.id} échouée — retentée au prochain démarrage`);
                } else {
                  console.log(`🗑️ [AircraftProvider] Doublon ${reg} : record forgé supprimé d'IndexedDB:`, forged.id);
                }
              }
            } catch (repairError) {
              repaired = false;
              console.error(`❌ [AircraftProvider] Échec auto-réparation du doublon ${reg} — les deux copies sont conservées:`, repairError);
            }
            if (repaired) {
              const entryBase = contentSource === canonical
                ? canonical
                : { ...contentSource, id: canonical.id, aircraftId: canonical.id };
              dedupedAircraft.push({
                ...entryBase,
                submitted_by: canonical.submitted_by ?? entryBase.submitted_by,
                hasPhoto: !!(entryBase.hasPhoto || mergedFull?.photo || mergedFull?.profilePhoto),
                hasManex: !!(entryBase.hasManex || mergedFull?.manex),
                hasWeighingReport: !!(entryBase.hasWeighingReport || mergedFull?.weighingReport)
              });
            } else {
              dedupedAircraft.push(...group);
            }
          }

          console.log('✅ [AircraftProvider] Métadonnées légères chargées depuis IndexedDB:', {
            count: dedupedAircraft.length,
            registrations: dedupedAircraft.map(a => a.registration)
          });

          // 🔧 NE PAS CONVERTIR ICI : Les données restent en STORAGE units
          // La conversion vers USER units se fera automatiquement via useUnits().format()
          // lors de l'affichage dans les composants
          console.log('📦 [AircraftProvider] Avions chargés en STORAGE units (ltr/lph/kg/kt):', {
            count: dedupedAircraft.length,
            note: 'Conversion → USER units faite par format() lors de l\'affichage'
          });

          // Charger les avions dans le store (en STORAGE units, dédupliqués)
          useAircraftStore.setState({
            aircraftList: dedupedAircraft,
            isInitialized: true,
            selectedAircraftId: null
          });

        } catch (error) {
          console.error('❌ [AircraftProvider] Erreur chargement IndexedDB:', error);
          // Marquer comme initialisé même en cas d'erreur
          useAircraftStore.setState({
            isInitialized: true,
            aircraftList: [],
            selectedAircraftId: null
          });
        }

        console.log('ℹ️ [AircraftProvider] Chargement Supabase DÉSACTIVÉ - Utilisez le wizard pour créer des avions');
      };

      loadFromIndexedDB();
    }
  }, [isInitialized]);
  
  // Wrapper pour debugger les appels addAircraft
  const debugAddAircraft = useCallback(async (aircraft) => {
    console.log('🔧 [AircraftProvider.debugAddAircraft] Appel addAircraft');
    try {
      const result = await addAircraft(aircraft);
      console.log('✅ [AircraftProvider.debugAddAircraft] Résultat:', {
        id: result?.id,
        registration: result?.registration,
        hasResult: !!result
      });
      return result;
    } catch (error) {
      console.error('❌ AircraftProvider - addAircraft error:', error);
      throw error;
    }
  }, [addAircraft]);
  
  // Debug: vérifier que le store est bien initialisé
  // .toISOString(), 'with:', {
  //   aircraftListLength: aircraftList?.length,
  //   aircraftListIds: aircraftList?.map(a => a.id) || [],
  //   selectedAircraftId: selectedAircraftId,
  //   selectedAircraft: selectedAircraft?.registration,
  //   setSelectedAircraftType: typeof setSelectedAircraft
  // });
  
  // Effectuer une surveillance des changements de la liste d'avions
  React.useEffect(() => {
    //  || []
    // });
  }, [aircraftList]);
  
  // Surveillance spécifique pour les nouvelles entrées
  React.useEffect(() => {
    const currentLength = aircraftList?.length || 0;
    //     
    // Forcer un re-render si nécessaire
    if (currentLength !== (window.lastKnownAircraftCount || 2)) {
            window.lastKnownAircraftCount = currentLength;
    }
  }, [aircraftList?.length]);
  
  const value = useMemo(() => ({
    aircraftList,
    selectedAircraft,
    // 🔧 LOT 5 — variante de réservoirs : avion brut (sans overlay), id de la
    // variante active et setter (sélecteur de l'étape 1, restauration brouillon)
    rawSelectedAircraft,
    selectedTankVariantId,
    setSelectedTankVariant,
    setSelectedAircraft,
    updateAircraft,
    deleteAircraft,
    addAircraft: debugAddAircraft
  }), [
    aircraftList,
    selectedAircraft,
    rawSelectedAircraft,
    selectedTankVariantId,
    setSelectedTankVariant,
    setSelectedAircraft,
    updateAircraft,
    deleteAircraft,
    debugAddAircraft
  ]);

  return <AircraftContext.Provider value={value}>{children}</AircraftContext.Provider>;
});

export const NavigationProvider = memo(({ children }) => {
  // Extraire toutes les propriétés et méthodes du store correctement
  const waypoints = useNavigationStore(state => state.waypoints);
  const setWaypoints = useNavigationStore(state => state.setWaypoints);
  const flightParams = useNavigationStore(state => state.flightParams);
  const setFlightParams = useNavigationStore(state => state.setFlightParams);
  const flightType = useNavigationStore(state => state.flightType);
  const setFlightType = useNavigationStore(state => state.setFlightType);
  const getNavigationResults = useNavigationStore(state => state.getNavigationResults);
  const addWaypoint = useNavigationStore(state => state.addWaypoint);
  const removeWaypoint = useNavigationStore(state => state.removeWaypoint);
  const updateWaypoint = useNavigationStore(state => state.updateWaypoint);
  const clearRoute = useNavigationStore(state => state.clearRoute);
  const moveWaypointUp = useNavigationStore(state => state.moveWaypointUp);
  const moveWaypointDown = useNavigationStore(state => state.moveWaypointDown);
  const segmentAltitudes = useNavigationStore(state => state.segmentAltitudes);
  const setSegmentAltitude = useNavigationStore(state => state.setSegmentAltitude);
  const getSegmentAltitude = useNavigationStore(state => state.getSegmentAltitude);
  
  const { selectedAircraft } = useAircraft();
  
  // Calculs mémorisés
  const navigationResults = useMemo(() => {
    if (!selectedAircraft || !waypoints.length) return null;

    return getNavigationResults(selectedAircraft);
    // ⛔ Lot 1.0 (tranche 3, revue) : le calcul dépend désormais des ALTITUDES
    // (vent échantillonné par tronçon) — sans ces deps, éditer l'altitude d'un
    // tronçon recalculait le tableau de nav mais laissait le trip fuel du
    // contexte sur le vent des ANCIENNES altitudes.
  }, [selectedAircraft, waypoints, flightType, getNavigationResults, segmentAltitudes, flightParams?.altitude]);

  const value = useMemo(() => ({
    waypoints,
    setWaypoints,
    flightParams,
    setFlightParams,
    flightType,
    setFlightType,
    navigationResults,
    // Exposer les actions du store
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    clearRoute,
    moveWaypointUp,
    moveWaypointDown,
    getNavigationResults,
    // Altitudes par segment
    segmentAltitudes,
    setSegmentAltitude,
    getSegmentAltitude
  }), [waypoints, setWaypoints, flightParams, setFlightParams, flightType, setFlightType,
      navigationResults, addWaypoint, removeWaypoint, updateWaypoint, clearRoute, moveWaypointUp, moveWaypointDown, getNavigationResults,
      segmentAltitudes, setSegmentAltitude, getSegmentAltitude]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
});

export const FuelProvider = memo(({ children }) => {
  // Extraire correctement les propriétés et méthodes du store
  const fuelData = useFuelStore(state => state.fuelData);
  const setFuelData = useFuelStore(state => state.setFuelData);
  const fobFuel = useFuelStore(state => state.fobFuel);
  const setFobFuel = useFuelStore(state => state.setFobFuel);

  // 🔧 DEBUG: Log de la valeur FOB du store
  React.useEffect(() => {
    console.log('🔍 [FuelProvider] fobFuel du store Zustand:', {
      fobFuel,
      ltr: fobFuel?.ltr,
      gal: fobFuel?.gal
    });
  }, [fobFuel]);
  const calculateTotal = useFuelStore(state => state.calculateTotal);
  const isFobSufficient = useFuelStore(state => state.isFobSufficient);
  const updateTripFuel = useFuelStore(state => state.updateTripFuel);
  const updateFinalReserve = useFuelStore(state => state.updateFinalReserve);
  // Configuration réservoirs par vol (standard vs long-range/auxiliaire)
  const tankConfig = useFuelStore(state => state.tankConfig);
  const initTankConfig = useFuelStore(state => state.initTankConfig);
  const resetTankConfig = useFuelStore(state => state.resetTankConfig);
  const setTankActive = useFuelStore(state => state.setTankActive);
  const setTankLiters = useFuelStore(state => state.setTankLiters);

  const { navigationResults } = useNavigation();
  const { selectedAircraft } = useAircraft();

  // Auto-sync avec la navigation
  React.useEffect(() => {
    if (navigationResults?.fuelRequired) {
      updateTripFuel(navigationResults.fuelRequired);
    }
  }, [navigationResults?.fuelRequired, updateTripFuel]);

  // Auto-sync de la réserve finale
  React.useEffect(() => {
    if (navigationResults?.regulationReserveLiters) {
      updateFinalReserve(navigationResults.regulationReserveLiters);
    }
  }, [navigationResults?.regulationReserveLiters, updateFinalReserve]);

  // ─── Config réservoirs par vol → FOB + répartition centrage ─────────────
  // Quand la config FAIT FOI (engagée pour l'avion sélectionné ET au moins une
  // case touchée par le pilote — cf. activeTankIdsFrom) : le FOB devient la
  // SOMME des litres des réservoirs cochés (source unique — fin de la double
  // saisie FOB/répartition), et chaque réservoir alimente loads[`fuel_<id>`]
  // (0 si décoché) pour le centrage par réservoir (weightBalanceStore +
  // scénarios). Config vierge (reload de brouillon, étape pas encore vérifiée)
  // ou avion sans réservoirs : on n'écrase RIEN — le FOB/les loads restaurés
  // du brouillon survivent jusqu'à la première interaction du pilote.
  React.useEffect(() => {
    const tanks = Array.isArray(selectedAircraft?.additionalFuelTanks)
      ? selectedAircraft.additionalFuelTanks : [];
    if (tanks.length === 0) return;
    if (activeTankIdsFrom(tankConfig, selectedAircraft) == null) return;

    let sumLtr = 0;
    const { updateLoad } = useWeightBalanceStore.getState();
    tanks.forEach((t, i) => {
      const cfg = tankConfig.tanks[String(t?.id ?? i)];
      const ltr = cfg?.active ? (parseFloat(cfg.ltr) || 0) : 0;
      sumLtr += ltr;
      updateLoad(`fuel_${t?.id ?? i}`, ltr);
    });
    setFobFuel(sumLtr);
  }, [tankConfig, selectedAircraft, setFobFuel]);

  const value = useMemo(() => ({
    fuelData,
    setFuelData,
    fobFuel,
    setFobFuel,
    calculateTotal,
    isFobSufficient,
    updateTripFuel,
    updateFinalReserve,
    tankConfig,
    initTankConfig,
    resetTankConfig,
    setTankActive,
    setTankLiters
  }), [fuelData, setFuelData, fobFuel, setFobFuel, calculateTotal, isFobSufficient, updateTripFuel, updateFinalReserve,
      tankConfig, initTankConfig, resetTankConfig, setTankActive, setTankLiters]);

  return <FuelContext.Provider value={value}>{children}</FuelContext.Provider>;
});

export const WeightBalanceProvider = memo(({ children }) => {
  // Extraire correctement les propriétés et méthodes du store
  const loads = useWeightBalanceStore(state => state.loads);
  const setLoads = useWeightBalanceStore(state => state.setLoads);
  const updateLoad = useWeightBalanceStore(state => state.updateLoad);
  const updateFuelLoad = useWeightBalanceStore(state => state.updateFuelLoad);
  const calculateWeightBalance = useWeightBalanceStore(state => state.calculateWeightBalance);

  const { selectedAircraft } = useAircraft();
  const { fobFuel } = useFuel();

  // Mise à jour du poids du carburant
  React.useEffect(() => {
    if (selectedAircraft && fobFuel?.ltr) {
      // 🔒 P0 (densité) : null si type inconnu → on NE fabrique pas 0.72. Densité
      // absente ⇒ pas de masse carburant fabriquée (le bilan W&B et les scénarios
      // signalent « densité inconnue »).
      const fuelDensity = getFuelDensity(selectedAircraft.fuelType);
      if (fuelDensity != null) {
        updateFuelLoad(fobFuel.ltr, fuelDensity);
      }
    }
  }, [selectedAircraft, fobFuel?.ltr, updateFuelLoad]);

  // 🔧 FIX: Créer une chaîne de dépendance incluant TOUS les chargements (dynamiques inclus)
  // Cette approche garantit que les changements des compartiments bagages dynamiques
  // (baggage_0, baggage_1, etc.) déclenchent bien le recalcul
  const loadsSignature = useMemo(() => {
    return JSON.stringify(loads);
  }, [loads]);

  // Calculs mémorisés avec dépendances correctes incluant loadsSignature
  const calculations = useMemo(() => {
    if (!selectedAircraft) return null;

    console.log('🔄 [WeightBalanceProvider] Recalcul avec loads:', loads);
    return calculateWeightBalance(selectedAircraft, fobFuel);
  }, [selectedAircraft, loadsSignature, fobFuel, calculateWeightBalance]);

  const value = useMemo(() => ({
    loads,
    setLoads,
    updateLoad,
    updateFuelLoad,
    calculations,
    isWithinLimits: calculations?.isWithinLimits || false
  }), [loads, setLoads, updateLoad, updateFuelLoad, calculations]);

  return <WeightBalanceContext.Provider value={value}>{children}</WeightBalanceContext.Provider>;
});

export const WeatherProvider = memo(({ children }) => {
  // Extraire correctement les propriétés et méthodes du store
  const weatherData = useWeatherStore(state => state.weatherData);
  const loading = useWeatherStore(state => state.loading);
  const errors = useWeatherStore(state => state.errors);
  const fetchWeather = useWeatherStore(state => state.fetchWeather);
  const fetchMultiple = useWeatherStore(state => state.fetchMultiple);
  const clearWeather = useWeatherStore(state => state.clearWeather);
  const clearAll = useWeatherStore(state => state.clearAll);
  const getWeatherByIcao = useWeatherStore(state => state.getWeatherByIcao);
  const isLoading = useWeatherStore(state => state.isLoading);
  const getError = useWeatherStore(state => state.getError);
  const needsRefresh = useWeatherStore(state => state.needsRefresh);
  
  const value = useMemo(() => ({
    weatherData,
    loading,
    errors,
    fetchWeather,
    fetchMultiple,
    clearWeather,
    clearAll,
    getWeatherByIcao,
    isLoading,
    getError,
    needsRefresh
  }), [
    weatherData,
    loading,
    errors,
    fetchWeather,
    fetchMultiple,
    clearWeather,
    clearAll,
    getWeatherByIcao,
    isLoading,
    getError,
    needsRefresh
  ]);

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
});

// Provider racine qui combine tous les contextes
export const FlightSystemProviders = memo(({ children }) => {
  return (
    <AircraftProvider>
      <NavigationProvider>
        <FuelProvider>
          <WeightBalanceProvider>
            <WeatherProvider>
              {children}
            </WeatherProvider>
          </WeightBalanceProvider>
        </FuelProvider>
      </NavigationProvider>
    </AircraftProvider>
  );
});

// Hook personnalisé pour accéder à plusieurs contextes
export const useFlightSystem = () => {
  const aircraft = useAircraft();
  const navigation = useNavigation();
  const fuel = useFuel();
  const weightBalance = useWeightBalance();
  const weather = useWeather();
  
  return useMemo(() => ({
    ...aircraft,
    ...navigation,
    ...fuel,
    ...weightBalance,
    ...weather
  }), [aircraft, navigation, fuel, weightBalance, weather]);
};