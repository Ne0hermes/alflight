// src/features/flight-wizard/steps/Step6WeightBalance.jsx
import React, { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useAircraft, useFuel, useWeightBalance } from '@core/contexts';
import { LoadInput } from '@features/weight-balance/components/LoadInput';
import { parseDecimalInput, DECIMAL_INPUT_RE, numbersClose } from '@utils/numericInput';
import { WeightBalanceChart } from '@features/weight-balance/components/WeightBalanceChart';
import { ScenarioCards } from '@features/weight-balance/components/ScenarioCards';
import { calculateScenarios } from '@features/weight-balance/utils/calculations';
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
  const { fobFuel, fuelData, setFobFuel } = useFuel();
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
          if (flightPlan?.updateAircraft) {
            flightPlan.updateAircraft(fullAircraft);
          }

          // Synchroniser avec le contexte
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

  // Synchroniser le carburant (fobFuel doit être { ltr, gal }, pas un nombre)
  useEffect(() => {
    const confirmedLtr = flightPlan?.fuel?.confirmed;
    if (confirmedLtr && confirmedLtr > 0 && fobFuel?.ltr !== confirmedLtr) {
      setFobFuel({
        ltr: confirmedLtr,
        gal: parseFloat((confirmedLtr / 3.78541).toFixed(2))
      });
    }
  }, [flightPlan, fobFuel, setFobFuel]);

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
            if (value !== undefined && value !== null && value !== 0) {
              updateLoad(type, value);
            }
          });
          hasRestoredLoads.current = true;
        }
      }, [flightPlan?.weightBalance?.loads, loads, updateLoad]);

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
      const scenarios = useMemo(() => {
        if (!aircraft || !aircraft.weightBalance || !calculations || typeof calculations.totalWeight !== 'number') {
          return null;
        }
        const fuelUnit = getUnit('fuel');
        return calculateScenarios(aircraft, calculations, loads, fobFuel, fuelData, fuelUnit);
      }, [aircraft, calculations, loads, fobFuel, fuelData, getUnit]);

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
        return (
          <div style={commonStyles.container}>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ fontSize: 'var(--fs-body)', color: theme.colors.textSecondary, marginBottom: '12px' }}>
                Chargement des données de masse et centrage…
              </p>

            </div>
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
  const LoadingSection = memo(({ loads, aircraft, onLoadChange, fobFuel, fuelData, flightPlan, weighingCertDate }) => {
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

            {/* Full Tank */}
            {(() => {
              const userFuelUnit = getUnit('fuel');
              // 🔧 FIX: aircraft.fuelCapacity est TOUJOURS en litres (storage unit)
              // Pas besoin de conversion, c'est déjà en litres !
              const fuelCapacityLtr = aircraft.fuelCapacity || 0;

              const fullTankKg = fuelCapacityLtr * fuelDensity;
              const fullTankMoment = fullTankKg * (arms.fuel || 0);
              const fullTankInUserUnit = convert(fuelCapacityLtr, 'fuel', 'ltr', userFuelUnit);

              return (
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--bg-overlay)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: 'var(--fs-body)', fontWeight: '600' }}>Full Tank</span>
                    <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                      {fullTankInUserUnit.toFixed(3)} {fuelUnitSymbol} ({fullTankKg.toFixed(3)} kg)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bras:</span>
                      <span>{arms.fuel !== null ? `${arms.fuel.toFixed(3)} m` : 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Moment:</span>
                      <span>{arms.fuel !== null ? `${fullTankMoment.toFixed(3)} kg.m` : 'N/A'}</span>
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

          {/* ─── Répartition du carburant PAR RÉSERVOIR (centrage) ───
              Demande pilote : quand l'avion a des réservoirs (bras différents),
              saisir les litres dans chaque réservoir pour un centrage exact,
              plafonné à la capacité de chaque réservoir. Le moment est calculé
              avec le bras de CHAQUE réservoir (cf. weightBalanceStore). */}
          {Array.isArray(aircraft.additionalFuelTanks) && aircraft.additionalFuelTanks.length > 0 && (() => {
            // C3.6 (ANO-14) : source canonique, repli AVGAS signalé (affichage).
            const density = getFuelDensity(aircraft.fuelType) ?? DENSITIES.AVGAS;
            const fobLtr = typeof fobFuel === 'number' ? fobFuel : (fobFuel?.ltr || 0);
            const distributed = aircraft.additionalFuelTanks.reduce(
              (s, t, i) => s + (parseFloat(loads[`fuel_${t.id ?? i}`]) || 0), 0
            );
            const mismatch = fobLtr > 0 && Math.abs(distributed - fobLtr) > 0.5;
            return (
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ ...commonStyles.label, fontSize: 'var(--fs-title)', marginBottom: '6px' }}>
                  Répartition du carburant par réservoir
                </h4>
                <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-body)', color: theme.colors.textSecondary }}>
                  Litres dans chaque réservoir (chacun a son propre bras de levier). FOB total : {fobLtr.toFixed(3)} L.
                </p>
                <div style={commonStyles.grid2}>
                  {aircraft.additionalFuelTanks.map((tank, i) => (
                    <FuelTankInput
                      key={tank.id ?? i}
                      tank={tank}
                      density={density}
                      liters={loads[`fuel_${tank.id ?? i}`] ?? ''}
                      onChange={(v) => onLoadChange(`fuel_${tank.id ?? i}`, v)}
                    />
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: 'var(--fs-body)', fontWeight: '600', color: theme.colors.textPrimary }}>
                  Total réparti : {distributed.toFixed(3)} L / FOB {fobLtr.toFixed(3)} L {fobLtr > 0 && !mismatch ? '✓' : ''}
                </div>
                {mismatch && (
                  <div style={{ marginTop: '8px', padding: '10px 12px', backgroundColor: 'rgba(192, 69, 52, 0.12)', borderLeft: '3px solid var(--color-red-critical)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-body)', color: 'var(--color-red-critical)', fontWeight: '600' }}>
                    ⚠️ Écart de {Math.abs(distributed - fobLtr).toFixed(3)} L entre la répartition ({distributed.toFixed(3)} L) et le FOB ({fobLtr.toFixed(3)} L). Ajustez la répartition pour qu'elle corresponde au carburant embarqué.
                  </div>
                )}
              </div>
            );
          })()}
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

  export default Step6WeightBalance;