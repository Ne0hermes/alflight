// src/features/flight-wizard/steps/Step6WeightBalance.jsx
import React, { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useAircraft, useFuel, useWeightBalance, useNavigation } from '@core/contexts';
import { LoadInput } from '@features/weight-balance/components/LoadInput';
import { parseDecimalInput, DECIMAL_INPUT_RE, numbersClose } from '@utils/numericInput';
import { WeightBalanceChart } from '@features/weight-balance/components/WeightBalanceChart';
import { ScenarioCards } from '@features/weight-balance/components/ScenarioCards';
import { calculateScenarios } from '@features/weight-balance/utils/calculations';
import { activeTankIdsFrom, aircraftTankConfigId } from '@core/stores/fuelStore';
import { computeMaxFuel } from '@utils/maxFuel';
import { computeLegFuelPlans } from '@features/fuel/utils/legFuelPlan';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { theme } from '../../../styles/theme';
import { DENSITIES } from '@utils/unitConversions';
import { getFuelDensity } from '@utils/fuelDensity';
import { useUnits } from '@hooks/useUnits';
import { getWeighingReportAge, WEIGHING_REPORT_REMINDER } from '@utils/weighingReportAge';

// Styles communs
const commonStyles = {
  container: {
    padding: '0',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'none'
  },
  card: {
    padding: '16px',
    backgroundColor: 'var(--bg-overlay)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '16px'
  },
  field: {
    marginBottom: '16px'
  },
  label: {
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px'
  }
};

// Composant principal de l'étape 6
export const Step6WeightBalance = memo(({ flightPlan, onUpdate }) => {
  const { selectedAircraft, setSelectedAircraft } = useAircraft();
  const { fobFuel, fuelData, setFobFuel, tankConfig, setTankLiters } = useFuel();
  const { loads, updateLoad, updateFuelLoad, calculations } = useWeightBalance();
  const { getUnit, convert, getSymbol } = useUnits();

  // ─── Sélection de la catégorie d'opération (N / U) ──────────────────────
  // Seulement disponible si l'avion a une configuration utilitaire activée
  // (data.utilityCategory.enabled === true côté wizard avion). Par défaut N
  // (catégorie normale). Le changement N→U applique les limites utilitaires
  // (MTOW réduit + domaine CG plus restreint).
  const [operationCategory, setOperationCategory] = useState('N');

  // ─── Ancienneté du rapport de pesée (demande pilote) ────────────────────
  // La date de pesée (certificationDate) vit dans aircraft.weighingReport,
  // souvent STRIPPÉ de la liste en mémoire (seul le flag hasWeighingReport
  // survit) : on retombe alors sur le record complet IndexedDB, comme le
  // bouton « Voir rapport de pesée ». null = date inconnue.
  const [weighingCertDate, setWeighingCertDate] = useState(null);

  // 🔧 FIX: Utiliser selectedAircraft du contexte ET faire le mapping weights immédiatement
  const aircraft = useMemo(() => {
    const baseAircraft = selectedAircraft || flightPlan?.aircraft;
    if (!baseAircraft) return null;

    // 🔧 FIX IMMEDIAT: Mapper weights.emptyWeight → emptyWeight
    let mappedAircraft = { ...baseAircraft };

    if (!mappedAircraft.emptyWeight && mappedAircraft.weights?.emptyWeight) {
      mappedAircraft.emptyWeight = parseFloat(mappedAircraft.weights.emptyWeight);
      console.log(`✅ [Step6] IMMEDIATE mapping emptyWeight: ${mappedAircraft.emptyWeight} kg`);
    }
    if (!mappedAircraft.maxTakeoffWeight && mappedAircraft.weights?.mtow) {
      mappedAircraft.maxTakeoffWeight = parseFloat(mappedAircraft.weights.mtow);
    }

    // 🔧 FIX IMMEDIAT: Créer weightBalance depuis arms si disponible
    if (mappedAircraft.arms && !mappedAircraft.weightBalance?.emptyWeightArm) {
      const parseOrNull = (value) => {
        if (!value || value === '' || value === '0') return null;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
      };

      mappedAircraft.weightBalance = {
        frontLeftSeatArm: parseOrNull(mappedAircraft.arms.frontSeats) || parseOrNull(mappedAircraft.arms.frontSeat),
        frontRightSeatArm: parseOrNull(mappedAircraft.arms.frontSeats) || parseOrNull(mappedAircraft.arms.frontSeat),
        rearLeftSeatArm: parseOrNull(mappedAircraft.arms.rearSeats) || parseOrNull(mappedAircraft.arms.rearSeat),
        rearRightSeatArm: parseOrNull(mappedAircraft.arms.rearSeats) || parseOrNull(mappedAircraft.arms.rearSeat),
        fuelArm: parseOrNull(mappedAircraft.arms.fuelMain) || parseOrNull(mappedAircraft.arms.fuel),
        emptyWeightArm: parseOrNull(mappedAircraft.arms.empty),
        cgLimits: mappedAircraft.cgLimits || mappedAircraft.cgEnvelope ? {
          forward: mappedAircraft.cgLimits?.forward || parseOrNull(mappedAircraft.cgEnvelope?.forwardPoints?.[0]?.cg),
          aft: mappedAircraft.cgLimits?.aft || parseOrNull(mappedAircraft.cgEnvelope?.aftCG),
          forwardVariable: mappedAircraft.cgLimits?.forwardVariable || mappedAircraft.cgEnvelope?.forwardPoints || []
        } : { forward: null, aft: null, forwardVariable: [] }
      };
      console.log(`✅ [Step6] IMMEDIATE weightBalance created from arms`);
    }

    // ─── Override CATÉGORIE UTILITAIRE (U) si sélectionnée ────────────────
    // Si l'avion a une configuration utilitaire activée et que le pilote
    // a sélectionné « U » en haut de page, on substitue les limites :
    //   - maxTakeoffWeight → utilityCategory.mtow
    //   - cgLimits.forward → utilityCategory.forwardCG
    //   - cgLimits.aft     → utilityCategory.aftMaxCG (borne arrière la plus contraignante)
    if (operationCategory === 'U' && mappedAircraft.utilityCategory?.enabled) {
      const u = mappedAircraft.utilityCategory;
      const uMtow = parseFloat(u.mtow);
      const uMlw = parseFloat(u.mlw);
      const uForwardCG = parseFloat(u.forwardCG);
      const uAftMaxCG = parseFloat(u.aftMaxCG);
      if (Number.isFinite(uMtow) && uMtow > 0) {
        mappedAircraft = {
          ...mappedAircraft,
          maxTakeoffWeight: uMtow,
          weights: { ...(mappedAircraft.weights || {}), mtow: uMtow }
        };
      }
      if (Number.isFinite(uMlw) && uMlw > 0) {
        mappedAircraft = {
          ...mappedAircraft,
          weights: { ...(mappedAircraft.weights || {}), mlw: uMlw }
        };
      }
      if ((Number.isFinite(uForwardCG) || Number.isFinite(uAftMaxCG)) && mappedAircraft.weightBalance) {
        mappedAircraft.weightBalance = {
          ...mappedAircraft.weightBalance,
          cgLimits: {
            ...(mappedAircraft.weightBalance.cgLimits || {}),
            forward: Number.isFinite(uForwardCG) ? uForwardCG : mappedAircraft.weightBalance.cgLimits?.forward,
            aft: Number.isFinite(uAftMaxCG) ? uAftMaxCG : mappedAircraft.weightBalance.cgLimits?.aft
          }
        };
      }
      console.log('🟠 [Step6] Catégorie UTILITAIRE active — limites U appliquées', {
        mtow: uMtow,
        forwardCG: uForwardCG,
        aftMaxCG: uAftMaxCG
      });
    }

    return mappedAircraft;
  }, [selectedAircraft, flightPlan?.aircraft, operationCategory]);

  // Résolution de la date de pesée : mémoire d'abord, sinon IndexedDB.
  useEffect(() => {
    let cancelled = false;
    const direct = aircraft?.weighingReport?.certificationDate;
    if (direct) { setWeighingCertDate(direct); return undefined; }
    if (!aircraft?.id || !(aircraft?.hasWeighingReport || aircraft?.weighingReport)) {
      setWeighingCertDate(null);
      return undefined;
    }
    (async () => {
      try {
        const { default: dbm } = await import('@utils/dataBackupManager');
        await dbm.initPromise;
        const full = await dbm.getAircraftData(aircraft.id);
        if (!cancelled) setWeighingCertDate(full?.weighingReport?.certificationDate || null);
      } catch (err) {
        console.warn('[Step6] Lecture date de pesée IndexedDB échouée:', err?.message);
        if (!cancelled) setWeighingCertDate(null);
      }
    })();
    return () => { cancelled = true; };
  }, [aircraft?.id, aircraft?.weighingReport?.certificationDate, aircraft?.hasWeighingReport]);

  // 🔧 FIX CRITIQUE : Synchroniser l'avion complet avec le contexte
  // TOUJOURS récupérer depuis le store pour avoir les données à jour
  useEffect(() => {
    if (aircraft?.registration) {
      console.log('🔄 [Step6] Synchronisation avion depuis store:', aircraft.registration);

      // TOUJOURS récupérer l'avion complet depuis le store
      import('@core/stores/aircraftStore').then(async ({ useAircraftStore }) => {
        const store = useAircraftStore.getState();

        // 🔧 FIX: NE PAS recharger depuis Supabase car il écrase les données locales complètes
        // avec un objet minimal (Supabase ne contient pas emptyWeight, arms, etc.)
        // Les données locales sont la source de vérité
        console.log('🔍 [Step6] Utilisation des données locales (store)');

        let fullAircraft = store.aircraftList.find(
          ac => ac.registration === aircraft.registration
        );

        if (fullAircraft) {
          console.log('✅ [Step6] Avion trouvé dans le store:', fullAircraft.registration);
          console.log('🔍 [Step6] baggageCompartments:', fullAircraft.baggageCompartments);
          console.log('🔍 [Step6] Checking weights:', {
            hasEmptyWeight: !!fullAircraft.emptyWeight,
            hasWeights: !!fullAircraft.weights,
            weightsEmptyWeight: fullAircraft.weights?.emptyWeight,
            weightsKeys: fullAircraft.weights ? Object.keys(fullAircraft.weights) : 'NO WEIGHTS'
          });

          // 🔧 FIX: Mapper weights.emptyWeight → emptyWeight si manquant
          // Les données locales peuvent avoir weights.emptyWeight mais pas emptyWeight
          if (!fullAircraft.emptyWeight && fullAircraft.weights?.emptyWeight) {
            fullAircraft = {
              ...fullAircraft,
              emptyWeight: parseFloat(fullAircraft.weights.emptyWeight)
            };
            console.log(`✅ [Step6] Mapped weights.emptyWeight → emptyWeight: ${fullAircraft.emptyWeight} kg`);
          }
          if (!fullAircraft.maxTakeoffWeight && fullAircraft.weights?.mtow) {
            fullAircraft = {
              ...fullAircraft,
              maxTakeoffWeight: parseFloat(fullAircraft.weights.mtow)
            };
          }

          // Vérifier si on a arms - TOUJOURS re-créer weightBalance depuis arms si disponible
          let needsUpdate = false;

          if (fullAircraft.arms) {
            // TOUJOURS re-créer weightBalance depuis arms (source de vérité)
            console.log('🔧 [Step6] Re-création weightBalance depuis arms (source de vérité)');
            const parseOrNull = (value) => {
              if (!value || value === '' || value === '0') return null;
              const parsed = parseFloat(value);
              return isNaN(parsed) ? null : parsed;
            };

            fullAircraft.weightBalance = {
              frontLeftSeatArm: parseOrNull(fullAircraft.arms.frontSeats) || parseOrNull(fullAircraft.arms.frontSeat),
              frontRightSeatArm: parseOrNull(fullAircraft.arms.frontSeats) || parseOrNull(fullAircraft.arms.frontSeat),
              rearLeftSeatArm: parseOrNull(fullAircraft.arms.rearSeats) || parseOrNull(fullAircraft.arms.rearSeat),
              rearRightSeatArm: parseOrNull(fullAircraft.arms.rearSeats) || parseOrNull(fullAircraft.arms.rearSeat),
              fuelArm: parseOrNull(fullAircraft.arms.fuelMain) || parseOrNull(fullAircraft.arms.fuel),
              emptyWeightArm: parseOrNull(fullAircraft.arms.empty),
              // Copier cgLimits - vérifier si valides avant d'utiliser cgLimits
              cgLimits: (() => {
                const hasValidCgLimits = fullAircraft.cgLimits &&
                  fullAircraft.cgLimits.forward !== '' &&
                  fullAircraft.cgLimits.aft !== '';

                if (hasValidCgLimits) {
                  return fullAircraft.cgLimits;
                }

                // Utiliser cgEnvelope comme fallback
                if (fullAircraft.cgEnvelope) {
                  return {
                    forward: parseOrNull(fullAircraft.cgEnvelope.forwardPoints?.[0]?.cg),
                    aft: parseOrNull(fullAircraft.cgEnvelope.aftCG),
                    forwardVariable: fullAircraft.cgEnvelope.forwardPoints || []
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
            needsUpdate = true;
            console.log('✅ [Step6] weightBalance recréé:', fullAircraft.weightBalance);
          }

          // 🔧 IMPORTANT: Mettre à jour flightPlan ET contexte avec le fullAircraft mappé
          // qui contient maintenant emptyWeight
          // 🔧 LOT 5 : le record IndexedDB porte TOUS les réservoirs — ré-appliquer
          // la variante du vol avant d'écrire dans le brouillon, sinon la liste
          // filtrée de l'étape 1 serait écrasée par la liste complète.
          {
            const { applyTankVariant } = await import('@utils/tankVariants');
            const variantId = flightPlan?.aircraft?.tankVariantId
              ?? store.selectedTankVariantId
              ?? null;
            const effectiveFull = applyTankVariant(fullAircraft, variantId);
            if (flightPlan?.updateAircraft) {
              flightPlan.updateAircraft({ ...effectiveFull, tankVariantId: variantId });
            }
          }

          // Synchroniser avec le contexte (avion BRUT : l'overlay de variante
          // est dérivé dans AircraftProvider à partir de l'id)
          setSelectedAircraft(fullAircraft);

          // 🔍 DEBUG: Vérifier que weightBalance ET emptyWeight sont présents
          console.log('🔍 [Step6] fullAircraft depuis store local:', {
            registration: fullAircraft.registration,
            hasWeightBalance: !!fullAircraft.weightBalance,
            hasEmptyWeight: !!fullAircraft.emptyWeight,
            hasArms: !!fullAircraft.arms,
            emptyWeight: fullAircraft.emptyWeight,
            arms: fullAircraft.arms,
            weightBalance: fullAircraft.weightBalance
          });

          // Forcer onUpdate pour re-render
          if (needsUpdate && onUpdate) {
            console.log('🔄 [Step6] Forcer re-render après mise à jour');
            onUpdate();
          }
        } else {
          console.error('❌ [Step6] Avion non trouvé dans le store:', aircraft.registration);
        }
      });
    }
  }, [aircraft?.registration, setSelectedAircraft, flightPlan, onUpdate]);

  // 🔧 CRAN 3 — waypoints de la navigation (découpe par tronçon aux escales)
  const { waypoints } = useNavigation();

  // ─── Config réservoirs du vol (définie à l'étape Carburant) ──────────────
  // FAIT FOI pour CET avion (au moins une case touchée) → seuls les réservoirs
  // cochés comptent dans les scénarios et la répartition ; null → comportement
  // historique (tous les réservoirs déclarés). cf. fuelStore.activeTankIdsFrom.
  const activeTankIds = useMemo(
    () => activeTankIdsFrom(tankConfig, aircraft),
    [aircraft, tankConfig]
  );

  // Synchroniser le carburant (fobFuel doit être { ltr, gal }, pas un nombre)
  // ⚠️ Sens de la sync selon la source de vérité (revue adversariale 2026-07) :
  //   - Config réservoirs FAISANT FOI : fobFuel (somme des réservoirs cochés,
  //     recalculée par le FuelProvider) est LA référence → on aligne
  //     flightPlan.fuel.confirmed dessus. L'ancien sens écrasait toute
  //     correction de répartition saisie à cette étape (FOB fantôme).
  //   - Sinon (comportement historique) : le plan de vol restauré fait foi →
  //     on réaligne fobFuel sur flightPlan.fuel.confirmed.
  // La restauration de brouillon ne doit jouer qu'UNE fois : ensuite toute
  // valeur (y compris 0 — champ vidé) fait foi, sinon l'effet ré-injectait
  // l'ancien FOB à chaque frappe passant par 0 (revue lot 9).
  const fobTouchedRef = React.useRef(false);
  useEffect(() => {
    const confirmedLtr = parseFloat(flightPlan?.fuel?.confirmed) || 0;
    const fobLtr = fobFuel?.ltr || 0;
    // 🔧 LOT 9-C — le FOB se saisit désormais À CETTE ÉTAPE (réservoirs cochés
    // OU saisie directe pour un avion sans réservoirs déclarés) : dès qu'une
    // valeur existe ici, elle fait foi → on aligne flightPlan.fuel.confirmed.
    if (Array.isArray(activeTankIds) || fobLtr > 0 || fobTouchedRef.current) {
      fobTouchedRef.current = true;
      if (flightPlan?.fuel && Math.abs(fobLtr - confirmedLtr) > 0.01) {
        flightPlan.confirmFuel(fobLtr);
        if (onUpdate) onUpdate();
      }
      return;
    }
    // Restauration de brouillon : rien saisi encore → réaligner fobFuel (1 fois)
    if (confirmedLtr > 0) {
      fobTouchedRef.current = true;
      setFobFuel({
        ltr: confirmedLtr,
        gal: parseFloat((confirmedLtr / 3.78541).toFixed(2))
      });
    }
  }, [flightPlan, fobFuel, setFobFuel, activeTankIds, onUpdate]);

      // 🔧 FIX CRITIQUE: Restaurer les loads depuis flightPlan au montage
      // Utiliser un ref pour ne restaurer qu'une seule fois au montage
      const hasRestoredLoads = React.useRef(false);

      useEffect(() => {
        // Ne restaurer qu'une fois, au premier montage
        if (hasRestoredLoads.current) return;

        const hasLoadsInFlightPlan = flightPlan?.weightBalance?.loads && Object.keys(flightPlan.weightBalance.loads).length > 0;

        // 🔧 FIX: Vérifier si le contexte contient des valeurs non-nulles (pas juste la présence de clés)
        const sumLoads = Object.values(loads).reduce((sum, val) => sum + (val || 0), 0);
        const contextHasRealData = sumLoads > 0;

        if (hasLoadsInFlightPlan && !contextHasRealData) {
          // Restaurer depuis flightPlan
          console.log('🔄 [Step6WB] Restauration des loads depuis flightPlan:', flightPlan.weightBalance.loads);
          Object.entries(flightPlan.weightBalance.loads).forEach(([type, value]) => {
            // Config réservoirs faisant foi : le carburant vient EXCLUSIVEMENT
            // du fuelStore (somme des réservoirs cochés, sync FuelProvider) —
            // ne pas réinjecter les fuel_* d'un ancien brouillon par-dessus la
            // configuration vérifiée (revue adversariale 2026-07 : du carburant
            // fantôme entrait au bilan alors que le FOB affichait 0).
            if (Array.isArray(activeTankIds) && type.startsWith('fuel_')) return;
            if (value !== undefined && value !== null && value !== 0) {
              updateLoad(type, value);
            }
          });
          hasRestoredLoads.current = true;
        }
      }, [flightPlan?.weightBalance?.loads, loads, updateLoad, activeTankIds]);

      // 🔧 FIX: Mettre à jour loads.fuel quand fobFuel change
      useEffect(() => {
        if (aircraft && fobFuel) {
          // Calculer les litres de carburant
          let fuelLitres = 0;
          if (typeof fobFuel === 'number') {
            fuelLitres = fobFuel;
          } else if (fobFuel?.ltr) {
            fuelLitres = fobFuel.ltr;
          }

          // C3.6 (ANO-14) : densité via la source canonique (alias gérés),
          // plus de string-match 'JET'. Type inconnu ⇒ fail-closed : aucune
          // masse carburant fabriquée (le store signalera fuelDensityMissing).
          const fuelDensity = getFuelDensity(aircraft.fuelType);
          if (fuelDensity == null) {
            console.warn('[Step6] Type carburant inconnu — masse carburant non calculée (fail-closed):', aircraft.fuelType);
            return;
          }
          updateFuelLoad(fuelLitres, fuelDensity);
        }
      }, [aircraft, aircraft?.fuelType, fobFuel, updateFuelLoad]);

      // Calcul des scénarios
      // 🔧 CRAN 3 — avec escale avitaillement, l'« atterrissage » du graphique
      // est le PROCHAIN atterrissage réel (l'escale) : brûlé = roulage + trip
      // du tronçon 1 (le trip complet clampait le carburant restant à 0 L)
      const scenarios = useMemo(() => {
        if (!aircraft || !aircraft.weightBalance || !calculations || typeof calculations.totalWeight !== 'number') {
          return null;
        }
        const fuelUnit = getUnit('fuel');
        const plan = computeLegFuelPlans({
          waypoints,
          cruiseSpeedKt: getCruiseSpeedKt(aircraft),
          fuelConsumptionLph: getFuelConsumptionLph(aircraft),
          taxiLtr: fuelData?.roulage?.ltr || 0,
          finalReserveLtr: fuelData?.finalReserve?.ltr || 0,
          alternateLtr: fuelData?.alternate?.ltr || 0
        });
        const burnedOverride = plan?.isMultiLeg
          ? plan.legs[0].taxiLtr + plan.legs[0].tripLtr
          : null;
        return calculateScenarios(aircraft, calculations, loads, fobFuel, fuelData, fuelUnit, activeTankIds, burnedOverride);
      }, [aircraft, calculations, loads, fobFuel, fuelData, getUnit, activeTankIds, waypoints]);

      // 🔧 SÉCURITÉ CRITIQUE: Vérifier les limites opérationnelles de masse
      const weightLimitViolations = useMemo(() => {
        if (!aircraft || !scenarios) return null;

        const violations = [];
        const minTakeoffWeight = parseFloat(aircraft.weights?.minTakeoffWeight);
        const maxTakeoffWeight = parseFloat(aircraft.weights?.mtow || aircraft.maxTakeoffWeight);
        const maxLandingWeight = parseFloat(aircraft.weights?.mlw);

        const takeoffWeight = scenarios.toCrm?.w || calculations?.totalWeight || 0;
        const landingWeight = scenarios.landing?.w || 0;

        if (!isNaN(minTakeoffWeight) && takeoffWeight < minTakeoffWeight) {
          violations.push({
            type: 'critical',
            phase: 'Décollage',
            message: `⚠️ MASSE INSUFFISANTE AU DÉCOLLAGE : ${takeoffWeight.toFixed(3)} kg < ${minTakeoffWeight} kg minimum`,
            detail: `La masse au décollage est INFÉRIEURE à la masse minimale de vol. VOL INTERDIT.`,
            value: takeoffWeight,
            limit: minTakeoffWeight,
            icon: '🚫'
          });
        }

        if (!isNaN(minTakeoffWeight) && landingWeight > 0 && landingWeight < minTakeoffWeight) {
          violations.push({
            type: 'critical',
            phase: 'Atterrissage',
            message: `⚠️ MASSE INSUFFISANTE À L'ATTERRISSAGE : ${landingWeight.toFixed(3)} kg < ${minTakeoffWeight} kg minimum`,
            detail: `La masse à l'atterrissage est INFÉRIEURE à la masse minimale de vol. ATTERRISSAGE INTERDIT.`,
            value: landingWeight,
            limit: minTakeoffWeight,
            icon: '🚫'
          });
        }

        if (!isNaN(maxTakeoffWeight) && takeoffWeight > maxTakeoffWeight) {
          violations.push({
            type: 'critical',
            phase: 'Décollage',
            message: `⚠️ SURCHARGE : ${takeoffWeight.toFixed(3)} kg > ${maxTakeoffWeight} kg maximum`,
            detail: `La masse au décollage DÉPASSE la masse maximale autorisée (MTOW). VOL INTERDIT.`,
            value: takeoffWeight,
            limit: maxTakeoffWeight,
            icon: '🚫'
          });
        }

        if (!isNaN(maxLandingWeight) && landingWeight > maxLandingWeight) {
          violations.push({
            type: 'critical',
            phase: 'Atterrissage',
            message: `⚠️ SURCHARGE ATTERRISSAGE : ${landingWeight.toFixed(3)} kg > ${maxLandingWeight} kg maximum`,
            detail: `La masse à l'atterrissage DÉPASSE la masse maximale autorisée (MLW). Consommez plus de carburant avant d'atterrir.`,
            value: landingWeight,
            limit: maxLandingWeight,
            icon: '⚠️'
          });
        }

        return violations.length > 0 ? violations : null;
      }, [aircraft, scenarios, calculations]);

      // Synchroniser withinLimits du flightPlan avec calculations.isWithinLimits
      useEffect(() => {
        if (calculations && flightPlan && scenarios && calculations.isWithinLimits !== undefined) {
          const takeoffWeight = calculations.totalWeight || 0;
          const landingWeight = scenarios?.landing?.w || takeoffWeight;
          const landingCG = scenarios?.landing?.cg || calculations.cg || 0;

          const needsSave =
            flightPlan.weightBalance.withinLimits !== calculations.isWithinLimits ||
            flightPlan.weightBalance.takeoffWeight !== takeoffWeight ||
            flightPlan.weightBalance.landingWeight !== landingWeight ||
            flightPlan.weightBalance.cg?.takeoff !== calculations.cg;

          if (needsSave) {
            flightPlan.weightBalance = {
              ...flightPlan.weightBalance,
              takeoffWeight: takeoffWeight,
              landingWeight: landingWeight,
              cg: {
                takeoff: calculations.cg || 0,
                landing: landingCG,
              },
              withinLimits: calculations.isWithinLimits,
              isWithinWeight: calculations.isWithinWeight,
              isWithinCG: calculations.isWithinCG,
              calculations: {
                emptyWeight: calculations.emptyWeight,
                emptyMoment: calculations.emptyMoment,
                loadMoment: calculations.loadMoment,
                totalMoment: calculations.totalMoment,
                totalWeight: calculations.totalWeight,
                cg: calculations.cg
              },
              scenarios: scenarios
            };
            if (onUpdate) {
              onUpdate();
            }
          }
        }
      }, [calculations, flightPlan, onUpdate, fuelData, scenarios]);

      // Handler pour la mise à jour des charges
      const handleLoadChange = useCallback((type, value) => {
        updateLoad(type, value);

        if (flightPlan) {
          const totalPassengerWeight =
            (type === 'frontLeft' ? value : loads.frontLeft || 0) +
            (type === 'frontRight' ? value : loads.frontRight || 0) +
            (type === 'rearLeft' ? value : loads.rearLeft || 0) +
            (type === 'rearRight' ? value : loads.rearRight || 0);

          const updatedLoads = { ...loads, [type]: value };
          const totalBaggageWeight = Object.keys(updatedLoads)
            .filter(key => key.startsWith('baggage_'))
            .reduce((sum, key) => sum + (updatedLoads[key] || 0), 0);

          flightPlan.updateWeightBalance({
            passengers: Math.round(totalPassengerWeight / 77),
            baggage: totalBaggageWeight,
            loads: updatedLoads
          });
          onUpdate();
        }
      }, [updateLoad, loads, flightPlan, onUpdate]);

      if (!aircraft) {
        return (
          <div style={commonStyles.container}>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: 'var(--fs-body)', color: theme.colors.textSecondary }}>
                Aucun avion sélectionné. Veuillez sélectionner un avion à l'étape 1.
              </p>
            </div>
          </div>
        );
      }

      if (!aircraft.weightBalance) {
        // 🔧 REVUE LOT 9 — la saisie du FOB vit désormais UNIQUEMENT ici : même
        // sans données de centrage (bras manquants), le bloc carburant doit
        // rester accessible, sinon le wizard bloque à la validation FOB sans
        // aucun champ à l'écran.
        return (
          <div style={commonStyles.container}>
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <p style={{ fontSize: 'var(--fs-body)', color: theme.colors.textSecondary, marginBottom: '12px' }}>
                Données de masse et centrage indisponibles pour cet avion
                (bras de levier manquants) — le centrage ne sera pas calculé.
              </p>
            </div>
            <TankPlanningBlock
              aircraft={aircraft}
              loads={loads}
              fobFuel={fobFuel}
              activeTankIds={activeTankIds}
              onTankLiters={setTankLiters}
            />
          </div>
        );
      }

      return (
        <div style={commonStyles.container}>
          {/* Sélecteur catégorie d'opération N / U — visible uniquement si
              l'avion a une configuration utilitaire activée */}
          {aircraft.utilityCategory?.enabled && (
            <div style={{
              padding: '12px 16px',
              marginBottom: '16px',
              backgroundColor: operationCategory === 'U' ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
              border: `2px solid ${operationCategory === 'U' ? 'var(--accent-primary)' : 'var(--text-primary)'}`,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 700 }}>
                Catégorie d'opération :
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setOperationCategory('N')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: operationCategory === 'N' ? 'var(--text-primary)' : 'var(--border-subtle)',
                    color: operationCategory === 'N' ? 'var(--app-bg)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 'var(--fs-body)'
                  }}
                >
                  Normale (N)
                </button>
                <button
                  onClick={() => setOperationCategory('U')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: operationCategory === 'U' ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    color: operationCategory === 'U' ? 'var(--app-bg)' : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 'var(--fs-body)'
                  }}
                >
                  Utilitaire (U)
                </button>
              </div>
              <span style={{ fontSize: 'var(--fs-body)', color: theme.colors.textSecondary, flex: '1 1 100%' }}>
                {operationCategory === 'U'
                  ? `MTOW réduit (${aircraft.utilityCategory.mtow || '—'} kg) et domaine CG plus restreint. Facteurs de charge +4,4g/−1,76g.`
                  : `MTOW standard. Pas d'acrobatie. Facteurs +3,8g/−1,5g.`}
              </span>
            </div>
          )}

          {weightLimitViolations && weightLimitViolations.map((violation, index) => (
            <div
              key={index}
              style={{
                padding: '16px 20px',
                marginBottom: '16px',
                backgroundColor: violation.type === 'critical' ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
                border: `2px solid ${violation.type === 'critical' ? 'var(--color-red-critical)' : 'var(--accent-primary)'}`,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: 'var(--fs-title)' }}>{violation.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 'var(--fs-title)',
                    fontWeight: '700',
                    color: violation.type === 'critical' ? 'var(--color-red-critical)' : 'var(--accent-primary)',
                    marginBottom: '4px'
                  }}>
                    {violation.message}
                  </div>
                  <div style={{
                    fontSize: 'var(--fs-body)',
                    color: violation.type === 'critical' ? 'var(--color-red-critical)' : 'var(--accent-primary)',
                    lineHeight: '1.5'
                  }}>
                    {violation.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <LoadingSection
            loads={loads}
            aircraft={aircraft}
            onLoadChange={handleLoadChange}
            fobFuel={fobFuel}
            fuelData={fuelData}
            flightPlan={flightPlan}
            weighingCertDate={weighingCertDate}
            activeTankIds={activeTankIds}
            onTankLiters={setTankLiters}
          />

          {scenarios && (
            <ScenarioCards
              scenarios={scenarios}
              fobFuel={fobFuel}
              fuelData={fuelData}
            />
          )}

          <WeightBalanceChart
            aircraft={aircraft}
            scenarios={scenarios}
            calculations={calculations}
          />
        </div>
      );
    });

  // Composant pour la section de chargement
  // `activeTankIds` : réservoirs cochés à l'étape Carburant (null = pas de
  // config engagée → tous les réservoirs affichés, comportement historique).
  const LoadingSection = memo(({ loads, aircraft, onLoadChange, fobFuel, fuelData, flightPlan, weighingCertDate, activeTankIds = null, onTankLiters = null }) => {
    const { convert, getSymbol, getUnit } = useUnits();

    // ⚠️ SÉCURITÉ CRITIQUE : PAS DE VALEURS PAR DÉFAUT POUR LES BRAS
    const wb = aircraft.weightBalance || {};
    const armLengths = aircraft.armLengths || {};
    const armsData = aircraft.arms || {};

    const parseOrNull = (value) => {
      if (!value || value === '' || value === '0') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    const arms = {
      empty: wb.emptyWeightArm || parseOrNull(armsData.empty) || armLengths.emptyMassArm || null,
      frontLeft: wb.frontLeftSeatArm || parseOrNull(armsData.frontSeats) || parseOrNull(armsData.frontSeat) || armLengths.frontSeat1Arm || null,
      frontRight: wb.frontRightSeatArm || parseOrNull(armsData.frontSeats) || parseOrNull(armsData.frontSeat) || armLengths.frontSeat2Arm || null,
      rearLeft: wb.rearLeftSeatArm || parseOrNull(armsData.rearSeats) || parseOrNull(armsData.rearSeat) || armLengths.rearSeat1Arm || null,
      rearRight: wb.rearRightSeatArm || parseOrNull(armsData.rearSeats) || parseOrNull(armsData.rearSeat) || armLengths.rearSeat2Arm || null,
      fuel: wb.fuelArm || parseOrNull(armsData.fuelMain) || parseOrNull(armsData.fuel) || armLengths.fuelArm || null
    };

    // Calculer le poids du carburant depuis l'étape 4 (bilan carburant)
    // C3.6 (ANO-14) : source canonique. Repli AVGAS SIGNALÉ tant que ce flux
    // d'affichage ne gère pas null — le verdict du store, lui, est fail-closed.
    let fuelDensity = getFuelDensity(aircraft.fuelType);
    if (fuelDensity == null) {
      console.warn('[Step6] Densité inconnue — repli AVGAS (affichage uniquement):', aircraft.fuelType);
      fuelDensity = DENSITIES.AVGAS;
    }

    // fobFuel peut être soit un nombre (litres), soit un objet {gal, ltr}
    let fuelLitres = 0;
    if (typeof fobFuel === 'number') {
      fuelLitres = fobFuel;
    } else if (fobFuel?.ltr) {
      fuelLitres = fobFuel.ltr;
    }

    const fuelWeightKg = fuelLitres * fuelDensity;
    const fuelMoment = fuelWeightKg * (arms.fuel || 0);

    // Convertir le carburant dans l'unité préférée du pilote
    const userFuelUnit = getUnit('fuel');
    const fuelInUserUnit = convert(fuelLitres, 'fuel', 'ltr', userFuelUnit);
    const fuelUnitSymbol = getSymbol('fuel');

    const safeLoads = {
      frontLeft: loads.frontLeft || 0,
      frontRight: loads.frontRight || 0,
      rearLeft: loads.rearLeft || 0,
      rearRight: loads.rearRight || 0,
      ...loads
    };

    return (
      <section style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: 'var(--fs-title)', fontWeight: '600', marginBottom: '16px' }}>
          Chargement et moments
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Masse à vide (lecture seule) */}
          <div style={{ ...commonStyles.card, padding: '12px', backgroundColor: 'var(--bg-overlay)' }}>
            <LoadInput
              label="Masse à vide"
              value={aircraft.emptyWeight || 0}
              onChange={() => { }} // Lecture seule
              disabled={true}
              helperText="Masse de l'avion vide (depuis configuration avion)"
            />
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginTop: '8px',
              fontSize: 'var(--fs-body)',
              color: theme.colors.textSecondary
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bras:</span>
                {arms.empty !== null ? (
                  <span style={{ color: theme.colors.textPrimary }}>{arms.empty.toFixed(3)} m</span>
                ) : (
                  <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>MANQUANT</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Moment:</span>
                {arms.empty !== null ? (
                  <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                    {((aircraft.emptyWeight || 0) * arms.empty).toFixed(3)} kg.m
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>N/A</span>
                )}
              </div>
            </div>
            {/* Bouton « Voir rapport de pesée » — fiche de pesée (PDF) attachée
                à la carte avion. ⚠️ La liste avion ne porte souvent que le FLAG
                hasWeighingReport (le PDF base64 est strippé pour la mémoire) :
                le bouton s'affiche dès que le rapport EXISTE et va chercher le
                PDF dans IndexedDB à la demande s'il n'est pas en mémoire. */}
            {(aircraft.weighingReport?.hasData || aircraft.weighingReport?.pdfData || aircraft.hasWeighingReport) && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={async () => {
                    // R20/B — préfère l'URL Storage (pdfUrl, fiche externalisée) ;
                    // sinon base64 inline ; sinon relecture IndexedDB par id.
                    let pdfData = aircraft.weighingReport?.pdfUrl || aircraft.weighingReport?.pdfData;
                    let fileName = aircraft.weighingReport?.fileName;
                    if (!pdfData && aircraft.id) {
                      // PDF non chargé en mémoire → relecture du record complet IndexedDB
                      try {
                        const { default: dbm } = await import('@utils/dataBackupManager');
                        await dbm.initPromise;
                        const full = await dbm.getAircraftData(aircraft.id);
                        pdfData = full?.weighingReport?.pdfUrl || full?.weighingReport?.pdfData;
                        fileName = fileName || full?.weighingReport?.fileName;
                      } catch (err) {
                        console.warn('[Step6] Lecture fiche de pesée IndexedDB échouée:', err?.message);
                      }
                    }
                    if (!pdfData) {
                      alert('Fiche de pesée introuvable en local. Ouvrez la fiche de l\'avion (module Aéronefs) pour la recharger, ou ré-importez le PDF via le wizard.');
                      return;
                    }
                    const w = window.open();
                    if (w) {
                      w.document.write(
                        `<iframe src="${pdfData}" style="width:100%;height:100vh;border:none;" title="Rapport de pesée"></iframe>`
                      );
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid var(--text-primary)',
                    backgroundColor: 'var(--bg-overlay)',
                    color: 'var(--text-primary)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title={aircraft.weighingReport?.fileName || 'Fiche de pesée (PDF)'}
                >
                  Voir rapport de pesée
                </button>
                <span style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                  ({aircraft.weighingReport?.fileName || 'PDF attaché à la carte avion'})
                </span>
              </div>
            )}
            {/* ─── Ancienneté du rapport de pesée utilisé dans les calculs ───
                Demande pilote : indicateur simple de l'âge de la pesée au
                moment de la préparation de vol ; au-delà de 10 ans,
                avertissement LÉGER (ambre, non bloquant) rappelant au CdB de
                vérifier qu'une pesée plus récente n'existe pas et, le cas
                échéant, de l'importer dans la fiche avion. */}
            {(aircraft.weighingReport?.hasData || aircraft.weighingReport?.pdfData || aircraft.hasWeighingReport) && (() => {
              const age = getWeighingReportAge(weighingCertDate);
              if (!age) {
                return (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 11,
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                    color: theme.colors.textSecondary
                  }}>
                    Date de pesée non renseignée — ouvrez la fiche de l'avion (module Aéronefs)
                    pour la compléter et suivre l'ancienneté du rapport.
                  </div>
                );
              }
              const dateStr = age.date.toLocaleDateString('fr-FR');
              if (!age.isOld) {
                return (
                  <div style={{ marginTop: 8, fontSize: 11, color: theme.colors.textSecondary }}>
                    Pesée du <strong style={{ color: theme.colors.textPrimary }}>{dateStr}</strong>
                    {' '}· il y a {age.ageLabel} ✓
                  </div>
                );
              }
              return (
                <div style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: 6, fontSize: 11, lineHeight: 1.5,
                  border: '1px solid var(--status-warning)',
                  backgroundColor: 'var(--status-warning-bg)',
                  color: 'var(--status-warning)'
                }}>
                  <strong>⚠ Pesée du {dateStr} · il y a {age.ageLabel}.</strong>{' '}
                  {WEIGHING_REPORT_REMINDER}
                </div>
              );
            })()}
          </div>

          {/* Sièges avant */}
          <div style={commonStyles.grid2}>
            <LoadInputWithInfo
              label="Siège avant gauche (Pilote)"
              value={safeLoads.frontLeft}
              onChange={(v) => onLoadChange('frontLeft', v)}
              arm={arms.frontLeft}
              max={120}
            />
            <LoadInputWithInfo
              label="Siège avant droit"
              value={safeLoads.frontRight}
              onChange={(v) => onLoadChange('frontRight', v)}
              arm={arms.frontRight}
              max={120}
            />
          </div>

          {/* Sièges arrière */}
          <div style={commonStyles.grid2}>
            <LoadInputWithInfo
              label="Siège arrière gauche"
              value={safeLoads.rearLeft}
              onChange={(v) => onLoadChange('rearLeft', v)}
              arm={arms.rearLeft}
              max={120}
            />
            <LoadInputWithInfo
              label="Siège arrière droit"
              value={safeLoads.rearRight}
              onChange={(v) => onLoadChange('rearRight', v)}
              arm={arms.rearRight}
              max={120}
            />
          </div>

          {/* Section Carburant - Différents scénarios */}
          <div style={{ ...commonStyles.card, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: 'var(--fs-body)', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>
                Scénarios de carburant
              </h4>

              {/* Badge densité carburant */}
              <div style={{
                display: 'flex',
                gap: '12px',
                fontSize: 'var(--fs-caption)',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-overlay)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <span><strong>{aircraft.fuelType || 'JET-A1'}</strong>: {fuelDensity} kg/L</span>
              </div>
            </div>

            {/* Full Tank — config réservoirs faisant foi : « pleins » = réservoirs
                COCHÉS uniquement (capacités + bras propres), cohérent avec le
                scénario « Réservoirs pleins » (computeScenarioFuel). Sinon :
                capacité totale historique de l'avion. */}
            {(() => {
              const userFuelUnit = getUnit('fuel');
              const configEngaged = Array.isArray(activeTankIds);
              const declaredTanks = Array.isArray(aircraft.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
              const activeSet = configEngaged ? new Set(activeTankIds.map(String)) : null;
              const checkedTanks = configEngaged
                ? declaredTanks
                    .map((t, i) => ({ t, i }))
                    .filter(({ t, i }) => activeSet.has(String(t.id ?? i)))
                : [];

              // 🔧 FIX: aircraft.fuelCapacity est TOUJOURS en litres (storage unit)
              // Pas besoin de conversion, c'est déjà en litres !
              const fuelCapacityLtr = configEngaged
                ? checkedTanks.reduce((s, { t }) => s + (parseFloat(t.capacity) || 0), 0)
                : (aircraft.fuelCapacity || 0);

              const fullTankKg = fuelCapacityLtr * fuelDensity;
              // Moment : par réservoir quand la config fait foi (bras propre de
              // chaque réservoir coché), sinon bras unique historique.
              const fullTankMoment = configEngaged
                ? checkedTanks.reduce((s, { t }) => {
                    const a = parseFloat(t.arm);
                    return s + (parseFloat(t.capacity) || 0) * fuelDensity * (Number.isFinite(a) ? a : 0);
                  }, 0)
                : fullTankKg * (arms.fuel || 0);
              const fullTankInUserUnit = convert(fuelCapacityLtr, 'fuel', 'ltr', userFuelUnit);

              return (
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--bg-overlay)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: '600' }}>
                      Full Tank{configEngaged ? ` (${checkedTanks.length} réservoir${checkedTanks.length > 1 ? 's' : ''} coché${checkedTanks.length > 1 ? 's' : ''})` : ''}
                    </span>
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                      {fullTankInUserUnit.toFixed(3)} {fuelUnitSymbol} ({fullTankKg.toFixed(3)} kg)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bras:</span>
                      <span>{configEngaged ? 'par réservoir' : (arms.fuel !== null ? `${arms.fuel.toFixed(3)} m` : 'N/A')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Moment:</span>
                      <span>{configEngaged || arms.fuel !== null ? `${fullTankMoment.toFixed(3)} kg.m` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* FOB T/O (Take-Off) */}
            {fuelLitres > 0 && (
              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--bg-overlay)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: '600' }}>FOB T/O (Décollage)</span>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>
                    {fuelInUserUnit.toFixed(3)} {fuelUnitSymbol} ({fuelWeightKg.toFixed(3)} kg)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Bras:</span>
                    {arms.fuel !== null ? (
                      <span style={{ color: theme.colors.textPrimary }}>{arms.fuel.toFixed(3)} m</span>
                    ) : (
                      <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>MANQUANT</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Moment:</span>
                    {arms.fuel !== null ? (
                      <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                        {fuelMoment.toFixed(3)} kg.m
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>N/A</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* FOB Landing (Atterrissage) */}
            {(() => {
              const fuelBalance = fuelData ? Object.values(fuelData).reduce((sum, f) => sum + (f?.ltr || 0), 0) : 0;
              const remainingFuelL = Math.max(0, fuelLitres - fuelBalance);
              const landingFuelKg = remainingFuelL * fuelDensity;
              const landingMoment = landingFuelKg * (arms.fuel || 0);
              const landingFuelInUserUnit = convert(remainingFuelL, 'fuel', 'ltr', userFuelUnit);

              return landingFuelKg > 0 ? (
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--bg-overlay)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: '600' }}>FOB Landing (Atterrissage)</span>
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--accent-primary)' }}>
                      {landingFuelInUserUnit.toFixed(3)} {fuelUnitSymbol} ({landingFuelKg.toFixed(3)} kg)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bras:</span>
                      <span>{arms.fuel !== null ? `${arms.fuel.toFixed(3)} m` : 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Moment:</span>
                      <span>{arms.fuel !== null ? `${landingMoment.toFixed(3)} kg.m` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* FOB Alternate (Point de déroutement) — source unique fuelData.alternate.ltr */}
            {(() => {
              // ─── SOURCE UNIQUE DE VÉRITÉ : fuelData.alternate.ltr ───
              // Précédemment, ce bloc faisait un calcul géométrique parallèle
              // (perpendiculaire au segment route + demi-route ≈ point décision)
              // qui pouvait diverger jusqu'à 20-30% du `FuelModule` selon la
              // géométrie du déroutement.
              // Maintenant on lit directement `fuelData.alternate.ltr` qui est
              // calculé par `useAlternatesForFuel` (hook centralisé).
              const alternateFuelL = fuelData?.alternate?.ltr || 0;

              const alternateFuelKg = alternateFuelL * fuelDensity;
              const alternateMoment = alternateFuelKg * (arms.fuel || 0);
              const alternateFuelInUserUnit = convert(alternateFuelL, 'fuel', 'ltr', userFuelUnit);

              return alternateFuelKg > 0 ? (
                <div style={{ marginBottom: '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: '600' }}>FOB Alternate (Déroutement)</span>
                    <span style={{ fontSize: 'var(--fs-body)', color: theme.colors.textPrimary }}>
                      {alternateFuelInUserUnit.toFixed(3)} {fuelUnitSymbol} ({alternateFuelKg.toFixed(3)} kg)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bras:</span>
                      <span>{arms.fuel !== null ? `${arms.fuel.toFixed(3)} m` : 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Moment:</span>
                      <span>{arms.fuel !== null ? `${alternateMoment.toFixed(3)} kg.m` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          {/* Compartiments bagages dynamiques configurés par le pilote */}
          {aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {aircraft.baggageCompartments.map((compartment, index) => {
                // ⚠️ SÉCURITÉ : Pas de valeur par défaut pour arm
                const arm = compartment.arm !== undefined && compartment.arm !== null && compartment.arm !== ''
                  ? parseFloat(compartment.arm)
                  : null;

                return (
                  <LoadInputWithInfo
                    key={compartment.id || index}
                    label={compartment.name}
                    value={safeLoads[`baggage_${compartment.id}`] || 0}
                    onChange={(v) => onLoadChange(`baggage_${compartment.id}`, v)}
                    arm={arm}
                    max={compartment.maxWeight ? parseFloat(compartment.maxWeight) : undefined}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ ...commonStyles.card, padding: '16px', textAlign: 'center', color: theme.colors.textSecondary, fontSize: 'var(--fs-body)' }}>
              Aucun compartiment bagage configuré pour cet avion.
            </div>
          )}

          {/* ─── 🔧 LOT 9-C — CARBURANT EMBARQUÉ (FOB) + répartition ───
              Demande pilote : la config des réservoirs (cochage), le FOB et la
              répartition par réservoir vivent ICI, fusionnés avec les masses —
              remplis en DERNIER dans le déroulé (masses → bagages → carburant),
              ce qui rend le bouton « Volume Max (jusqu'à MTOW) » pertinent. */}
          <TankPlanningBlock
            aircraft={aircraft}
            loads={loads}
            fobFuel={fobFuel}
            activeTankIds={activeTankIds}
            onTankLiters={onTankLiters}
          />
        </div>
      </section>
    );
  });

  // Composant utilitaire pour les champs de chargement avec info bras/moment
  const LoadInputWithInfo = memo(({ label, value, onChange, arm, max }) => {
    const moment = arm !== null ? (value * arm) : null;

    return (
      <div style={{ ...commonStyles.card, padding: '12px' }}>
        <LoadInput
          label={label}
          value={value}
          onChange={onChange}
          max={max}
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginTop: '8px',
          fontSize: 'var(--fs-body)',
          color: theme.colors.textSecondary
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Bras:</span>
            {arm !== null ? (
              <span style={{ color: theme.colors.textPrimary }}>{arm.toFixed(3)} m</span>
            ) : (
              <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>MANQUANT</span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Moment:</span>
            {moment !== null ? (
              <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                {moment.toFixed(3)} kg.m
              </span>
            ) : (
              <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>N/A</span>
            )}
          </div>
        </div>
      </div>
    );
  });

  // Champ de saisie carburant PAR RÉSERVOIR (centrage). Saisie en LITRES,
  // plafonnée à la capacité du réservoir ; convertie en kg via la densité pour
  // le moment (chaque réservoir a son propre bras de levier).
  const FuelTankInput = memo(({ tank, liters, onChange, density }) => {
    const cap = parseFloat(tank.capacity);
    const arm = parseFloat(tank.arm);
    const L = parseFloat(liters) || 0;
    const weight = L * density;
    const moment = Number.isFinite(arm) ? weight * arm : null;
    const exceeds = Number.isFinite(cap) && cap > 0 && L > cap;

    // Saisie tolérante (virgule, suppression, états transitoires) — même correctif
    // que LoadInput : l'état local pilote l'affichage, on ne réinitialise jamais
    // sur une saisie incomplète. cf. utils/numericInput.
    const fmtL = (v) => { const n = Number(v); return (!Number.isFinite(n) || n === 0) ? '' : String(n); };
    const [rawL, setRawL] = useState(() => fmtL(liters));
    const fuelFocusedRef = useRef(false);
    useEffect(() => {
      if (fuelFocusedRef.current) return;
      if (!numbersClose(Number(liters) || 0, parseDecimalInput(rawL) ?? 0)) setRawL(fmtL(liters));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liters]);
    const handleLitersChange = (e) => {
      const v = e.target.value;
      if (!DECIMAL_INPUT_RE.test(v)) return;        // refuse l'invalide sans reset
      setRawL(v);
      if (v === '') { onChange(0); return; }        // vide = 0, affichage reste vide
      const n = parseDecimalInput(v);               // '40,5' → 40.5 ; '40,' → null
      if (n !== null) onChange(n);
    };

    return (
      <div style={{ ...commonStyles.card, padding: '12px' }}>
        <label style={{ ...commonStyles.label, marginBottom: '6px' }}>
          {tank.name || 'Réservoir'}{tank.type ? ` · ${tank.type}` : ''} (L)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={rawL}
          onChange={handleLitersChange}
          onFocus={() => { fuelFocusedRef.current = true; }}
          onBlur={() => { fuelFocusedRef.current = false; setRawL(fmtL(liters)); }}
          placeholder="0"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 'var(--fs-body)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--app-bg)',
            border: `1px solid ${exceeds ? 'var(--color-red-critical)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {exceeds && (
          <div style={{ marginTop: '4px', fontSize: 'var(--fs-caption)', color: 'var(--color-red-critical)', fontWeight: '600' }}>
            ⚠️ Dépasse la capacité : {L} L &gt; {cap} L
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px', fontSize: 'var(--fs-caption)', color: theme.colors.textSecondary }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Cap:</span><span style={{ color: theme.colors.textPrimary }}>{Number.isFinite(cap) ? `${cap} L` : '—'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bras:</span>{Number.isFinite(arm) ? <span style={{ color: theme.colors.textPrimary }}>{arm.toFixed(3)} m</span> : <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>MANQUANT</span>}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Moment:</span>{moment !== null ? <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>{moment.toFixed(3)}</span> : <span style={{ color: 'var(--color-red-critical)', fontWeight: '600' }}>N/A</span>}</div>
        </div>
        <div style={{ marginTop: '4px', fontSize: 'var(--fs-caption)', color: theme.colors.textSecondary }}>≈ {weight.toFixed(3)} kg (densité {density})</div>
      </div>
    );
  });

  // ─── 🔧 LOT 9-C — Carburant embarqué (FOB) + répartition par réservoir ────
  // Fusion demandée par le pilote : cochage des réservoirs embarqués (variante
  // standard / long-range), litres par réservoir (bras de levier, moment) et
  // verdict vs le carburant requis (bilan) — le tout ICI, en dernier dans le
  // déroulé de saisie, ce qui rend « Volume Max (jusqu'à MTOW) » pertinent
  // (masses et bagages déjà renseignés).
  const TankPlanningBlock = memo(({ aircraft, loads, fobFuel, activeTankIds, onTankLiters }) => {
    const { calculateTotal, tankConfig, initTankConfig, setTankActive, setFobFuel, fuelData } = useFuel();
    // 🔧 CRAN 3 — waypoints pour le bilan PAR TRONÇON (escale avitaillement)
    const { waypoints: routeWaypoints } = useNavigation();

    const aircraftTanks = Array.isArray(aircraft?.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
    const hasTanks = aircraftTanks.length > 0;
    const aircraftKey = aircraftTankConfigId(aircraft);

    // Engager la config réservoirs pour CET avion (vierge : tout décoché — le
    // CDB doit vérifier la configuration réelle à chaque vol). Déplacé depuis
    // l'étape Carburant (lot 9-C).
    useEffect(() => {
      if (hasTanks && aircraftKey != null) initTankConfig(aircraftKey);
    }, [hasTanks, aircraftKey, initTankConfig]);

    // C3.6 (ANO-14) : repli AVGAS SIGNALÉ — cette densité ne sert qu'à
    // l'affichage de la masse PAR RÉSERVOIR (FuelTankInput). Aligné sur le
    // flux ligne 767 ; le verdict de centrage du store reste fail-closed.
    let density = getFuelDensity(aircraft?.fuelType);
    if (density == null) {
      console.warn('[Step6/TankPlanning] Densité inconnue — repli AVGAS (affichage masse réservoir uniquement):', aircraft?.fuelType);
      density = DENSITIES.AVGAS;
    }
    const fobLtr = typeof fobFuel === 'number' ? fobFuel : (fobFuel?.ltr || 0);
    const configEngaged = Array.isArray(activeTankIds);
    const activeSet = configEngaged ? new Set(activeTankIds.map(String)) : new Set();
    const indexedTanks = aircraftTanks.map((tank, i) => ({ tank, i, key: String(tank.id ?? i) }));
    const shownTanks = indexedTanks.filter(({ key }) => activeSet.has(key));
    const checkedCapacityLtr = shownTanks.reduce((s, { tank }) => s + (parseFloat(tank.capacity) || 0), 0);
    // requiredRawLtr = même valeur que le garde-fou du wizard (comparaisons) ;
    // requiredLtr arrondi sup = AFFICHAGE uniquement (revue lot 9 : un ceil
    // dans la comparaison contredisait la validation pour 0,5 L)
    // 🔧 CRAN 3 — avec escale avitaillement : le FOB au décollage doit couvrir
    // le TRONÇON 1 (le plein est refait à l'escale), pas le vol entier.
    const legPlan = computeLegFuelPlans({
      waypoints: routeWaypoints,
      cruiseSpeedKt: getCruiseSpeedKt(aircraft),
      fuelConsumptionLph: getFuelConsumptionLph(aircraft),
      taxiLtr: fuelData?.roulage?.ltr || 0,
      finalReserveLtr: fuelData?.finalReserve?.ltr || 0,
      alternateLtr: fuelData?.alternate?.ltr || 0,
      // Revue cran 3 : supplément de déroutement PAR TRONÇON
      alternates: useAlternatesStore.getState().selectedAlternates,
      aircraft
    });
    const totalRawLtr = (typeof calculateTotal === 'function' ? calculateTotal('ltr') : 0) || 0;
    const requiredRawLtr = legPlan?.isMultiLeg ? legPlan.legs[0].totalLtr : totalRawLtr;
    const requiredLtr = Math.ceil(requiredRawLtr);
    const nextLegsMax = legPlan?.isMultiLeg
      ? Math.ceil(Math.max(...legPlan.legs.slice(1).map(l => l.totalLtr)))
      : null;

    const distributed = shownTanks.reduce(
      (s, { tank, i }) => s + (parseFloat(loads[`fuel_${tank.id ?? i}`]) || 0), 0
    );
    // Écart répartition/FOB : pertinent seulement quand la config fait foi —
    // sur un brouillon restauré (config vierge), distributed vaut 0 par
    // construction alors que le carburant restauré compte bien au centrage
    const mismatch = configEngaged && fobLtr > 0 && Math.abs(distributed - fobLtr) > 0.5;

    // Volume Max (jusqu'à MTOW) — réintégré ici (lot 9-C) : les masses et
    // bagages sont déjà saisis à ce stade, le calcul est donc définitif.
    const handleVolumeMax = () => {
      if (!hasTanks || !configEngaged) {
        alert('Volume Max : cochez d\'abord les réservoirs embarqués ci-dessus.');
        return;
      }
      const emptyWeight = parseFloat(aircraft?.weights?.emptyWeight ?? aircraft?.emptyWeight);
      if (!Number.isFinite(emptyWeight)) {
        alert('Volume Max impossible : masse à vide de l\'avion inconnue.');
        return;
      }
      const nonFuelKg = Object.entries(loads || {}).reduce((s, [k, v]) => {
        if (k === 'fuel' || k.startsWith('fuel_')) return s;
        return s + (parseFloat(v) || 0);
      }, 0);
      const result = computeMaxFuel({
        aircraft,
        zfwKg: emptyWeight + nonFuelKg,
        activeTankIds
      });
      if (!result.ok) {
        const msgs = {
          fuelDensity: 'type de carburant inconnu (densité indisponible)',
          weights: 'MTOW ou masse à vide manquante',
          noTanks: 'aucun réservoir coché'
        };
        alert(`Volume Max impossible : ${msgs[result.error] || result.error}.`);
        return;
      }
      result.perTank.forEach(({ key, ltr }) => onTankLiters && onTankLiters(key, ltr));
    };

    // FOB saisi directement (avion SANS réservoirs déclarés) — inputs déplacés
    // depuis l'étape Carburant
    const handleDirectFob = (ltrValue) => {
      const ltr = Math.max(0, parseFloat(ltrValue) || 0);
      setFobFuel({ ltr, gal: ltr / 3.78541 });
    };

    return (
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <h4 style={{ ...commonStyles.label, fontSize: 'var(--fs-title)', marginBottom: '6px' }}>
            ⛽ Carburant embarqué (FOB) et répartition
          </h4>
          {hasTanks && configEngaged && typeof onTankLiters === 'function' && (
            <button
              className="pdf-hidden"
              onClick={handleVolumeMax}
              style={{
                padding: '6px 14px', fontSize: 'var(--fs-caption)', fontWeight: 600,
                color: 'var(--accent-primary)', backgroundColor: 'var(--accent-soft)',
                border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
            >
              ⛽ Volume Max (jusqu'à MTOW)
            </button>
          )}
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', color: theme.colors.textSecondary }}>
          Cochez les réservoirs réellement embarqués puis saisissez les litres de
          chacun (chaque réservoir a son propre bras de levier). Besoin du bilan
          carburant : <strong>{requiredLtr} L</strong> minimum.
        </p>

        {hasTanks ? (
          <>
            {/* Cochage des réservoirs embarqués (déplacé du bilan carburant) */}
            <div style={{ ...commonStyles.card, padding: '10px 12px', marginBottom: '12px' }}>
              {indexedTanks.map(({ tank, i, key }) => {
                const active = !!tankConfig?.tanks?.[key]?.active;
                const isOptional = tank.optional ?? ['aux', 'optional', 'tip'].includes(tank.type);
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setTankActive(key, e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 'var(--fs-body)' }}>
                      <strong>{tank.name || `Réservoir ${i + 1}`}</strong>
                      <span style={{ color: theme.colors.textSecondary }}>
                        {' '}· {isOptional ? 'Optionnel (amovible)' : 'Fixe'} · Capacité {(parseFloat(tank.capacity) || 0).toFixed(1)} L
                      </span>
                    </span>
                  </label>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: 'var(--fs-body)' }}>
                <span>Capacité configuration</span>
                <span>{checkedCapacityLtr.toFixed(1)} L</span>
              </div>
            </div>

            {!configEngaged && (
              <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: 'rgba(217, 119, 6, 0.12)', borderLeft: '3px solid #d97706', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)', fontWeight: '600' }}>
                ⚠️ Configuration des réservoirs non vérifiée pour ce vol — elle est
                remise à zéro à chaque préparation. Cochez ci-dessus les réservoirs
                réellement embarqués{fobLtr > 0 ? ' (le FOB et la répartition restaurés du brouillon restent utilisés au centrage en attendant)' : ''}.
              </div>
            )}
            {configEngaged && shownTanks.length === 0 && (
              <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: 'rgba(217, 119, 6, 0.12)', borderLeft: '3px solid #d97706', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)', fontWeight: '600' }}>
                ⚠️ Aucun réservoir coché : cochez ci-dessus les réservoirs réellement
                embarqués pour ce vol (la configuration est remise à zéro à chaque
                préparation).
              </div>
            )}

            {/* Litres par réservoir (bras + moment) — réservoirs cochés */}
            <div style={commonStyles.grid2}>
              {shownTanks.map(({ tank, i, key }) => (
                <FuelTankInput
                  key={key}
                  tank={tank}
                  density={density}
                  liters={loads[`fuel_${tank.id ?? i}`] ?? ''}
                  onChange={(v) => { if (onTankLiters) onTankLiters(key, v); }}
                />
              ))}
            </div>

            {configEngaged ? (
              <div style={{ marginTop: '10px', fontSize: 'var(--fs-body)', fontWeight: '600', color: theme.colors.textPrimary }}>
                Total réparti : {distributed.toFixed(1)} L — FOB {fobLtr.toFixed(1)} L {fobLtr > 0 && !mismatch ? '✓' : ''}
              </div>
            ) : (fobLtr > 0 && (
              <div style={{ marginTop: '10px', fontSize: 'var(--fs-body)', fontWeight: '600', color: theme.colors.textPrimary }}>
                FOB restauré : {fobLtr.toFixed(1)} L — répartition à re-vérifier.
              </div>
            ))}
            {mismatch && (
              <div style={{ marginTop: '8px', padding: '10px 12px', backgroundColor: 'rgba(192, 69, 52, 0.12)', borderLeft: '3px solid var(--color-red-critical)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)', color: 'var(--color-red-critical)', fontWeight: '600' }}>
                ⚠️ Écart de {Math.abs(distributed - fobLtr).toFixed(1)} L entre la répartition et le FOB.
              </div>
            )}
          </>
        ) : (
          /* Avion sans réservoirs déclarés : saisie directe du FOB (litres) */
          <div style={{ ...commonStyles.card, padding: '12px', maxWidth: '320px' }}>
            <label style={{ ...commonStyles.label, marginBottom: '6px' }}>FOB — carburant au décollage (L)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={fobLtr > 0 ? fobLtr : ''}
              onChange={(e) => handleDirectFob(e.target.value)}
              placeholder="0"
              style={{
                width: '100%', padding: '8px 12px', fontSize: 'var(--fs-body)',
                color: 'var(--text-primary)', backgroundColor: 'var(--app-bg)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* Verdict vs bilan carburant (déplacé du bilan — lot 9-C).
            Comparaison sur le total BRUT, même tolérance que le garde-fou du
            wizard — l'arrondi sup ne sert qu'à l'affichage (revue lot 9). */}
        {requiredRawLtr > 0 && (
          fobLtr >= requiredRawLtr - 0.01 ? (
            <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: 'rgba(34, 197, 94, 0.10)', borderLeft: '3px solid #22c55e', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)', fontWeight: '600' }}>
              ✓ Carburant SUFFISANT — excédent {(fobLtr - requiredRawLtr).toFixed(1)} L
              par rapport au bilan{legPlan?.isMultiLeg ? ' du tronçon 1' : ''} ({requiredLtr} L requis).
            </div>
          ) : (
            <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: 'rgba(192, 69, 52, 0.12)', borderLeft: '3px solid var(--color-red-critical)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)', color: 'var(--color-red-critical)', fontWeight: '600' }}>
              ⚠️ Carburant INSUFFISANT — manque {(requiredRawLtr - fobLtr).toFixed(1)} L
              par rapport au bilan{legPlan?.isMultiLeg ? ' du tronçon 1' : ''} ({requiredLtr} L requis).
            </div>
          )
        )}
        {legPlan?.isMultiLeg && nextLegsMax != null && (
          <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-caption)', color: theme.colors.textSecondary }}>
            ⛽ Escale avitaillement prévue : refaites le plein à{' '}
            {legPlan.legs.length > 2 ? 'chaque escale' : 'l\'escale'} — au moins{' '}
            <strong>{nextLegsMax} L</strong> au départ{' '}
            {legPlan.legs.length > 2 ? 'de chaque tronçon suivant' : 'du tronçon suivant'}{' '}
            (détail au Bilan carburant, tableau par tronçon).
          </p>
        )}
      </div>
    );
  });

  export default Step6WeightBalance;