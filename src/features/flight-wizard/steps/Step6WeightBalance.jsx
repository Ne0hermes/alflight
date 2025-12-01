// src/features/flight-wizard/steps/Step6WeightBalance.jsx
import React, { memo, useMemo, useCallback, useEffect } from 'react';
import { useAircraft, useFuel, useWeightBalance } from '@core/contexts';
import { LoadInput } from '@features/weight-balance/components/LoadInput';
import { WeightBalanceChart } from '@features/weight-balance/components/WeightBalanceChart';
import { ScenarioCards } from '@features/weight-balance/components/ScenarioCards';
import { calculateScenarios } from '@features/weight-balance/utils/calculations';
import { Scale } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { DENSITIES } from '@utils/unitConversions';
import { useUnits } from '@hooks/useUnits';
import { calculateDistanceToSegment, calculateDistance, calculateMidpoint } from '@utils/navigationCalculations';

// Styles communs
const commonStyles = {
  container: {
    padding: '0',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  card: {
    padding: '16px',
    backgroundColor: 'rgba(245, 245, 245, 0.5)',
    borderRadius: '8px',
    marginBottom: '16px'
  },
  field: {
    marginBottom: '16px'
  },
  label: {
    fontSize: '16px',
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

    return mappedAircraft;
  }, [selectedAircraft, flightPlan?.aircraft]);

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

  // Synchroniser le carburant
  useEffect(() => {
    if (flightPlan?.fuel?.confirmed && fobFuel !== flightPlan.fuel.confirmed) {
      setFobFuel(flightPlan.fuel.confirmed);
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

          // Utiliser DENSITIES centralisées
          const isJet = aircraft.fuelType?.toUpperCase().includes('JET');
          const fuelDensity = isJet ? DENSITIES.JET_A1 : DENSITIES.AVGAS;

          console.log('🔧 [Step6] Updating loads.fuel:', { fuelLitres, fuelDensity });
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
            message: `⚠️ MASSE INSUFFISANTE AU DÉCOLLAGE : ${takeoffWeight.toFixed(1)} kg < ${minTakeoffWeight} kg minimum`,
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
            message: `⚠️ MASSE INSUFFISANTE À L'ATTERRISSAGE : ${landingWeight.toFixed(1)} kg < ${minTakeoffWeight} kg minimum`,
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
            message: `⚠️ SURCHARGE : ${takeoffWeight.toFixed(1)} kg > ${maxTakeoffWeight} kg maximum`,
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
            message: `⚠️ SURCHARGE ATTERRISSAGE : ${landingWeight.toFixed(1)} kg > ${maxLandingWeight} kg maximum`,
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
              <p style={{ fontSize: '16px', color: theme.colors.textSecondary }}>
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
              <p style={{ fontSize: '16px', color: theme.colors.textSecondary, marginBottom: '12px' }}>
                ⏳ Chargement des données de masse et centrage...
              </p>

            </div>
          </div>
        );
      }

      return (
        <div style={commonStyles.container}>
          {weightLimitViolations && weightLimitViolations.map((violation, index) => (
            <div
              key={index}
              style={{
                padding: '16px 20px',
                marginBottom: '16px',
                backgroundColor: violation.type === 'critical' ? '#fef2f2' : '#fff7ed',
                border: `2px solid ${violation.type === 'critical' ? '#dc2626' : '#f59e0b'}`,
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>{violation.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: violation.type === 'critical' ? '#991b1b' : '#c2410c',
                    marginBottom: '4px'
                  }}>
                    {violation.message}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: violation.type === 'critical' ? '#7f1d1d' : '#9a3412',
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
  const LoadingSection = memo(({ loads, aircraft, onLoadChange, fobFuel, fuelData, flightPlan }) => {
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
    const isJet = aircraft.fuelType?.toUpperCase().includes('JET');
    const fuelDensity = isJet ? DENSITIES.JET_A1 : DENSITIES.AVGAS;

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
      <section style={{ ...commonStyles.card, marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          ⚖️ Chargement et Moments
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Masse à vide (lecture seule) */}
          <div style={{ ...commonStyles.card, padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
            <LoadInput
              label="⚖️ Masse à vide"
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
              fontSize: '12px',
              color: theme.colors.textSecondary
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>📏 Bras:</span>
                {arms.empty !== null ? (
                  <span style={{ color: theme.colors.textPrimary }}>{arms.empty.toFixed(2)} m</span>
                ) : (
                  <span style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ MANQUANT</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>⚖️ Moment:</span>
                {arms.empty !== null ? (
                  <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                    {((aircraft.emptyWeight || 0) * arms.empty).toFixed(1)} kg.m
                  </span>
                ) : (
                  <span style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ N/A</span>
                )}
              </div>
            </div>
          </div>

          {/* Sièges avant */}
          <div style={commonStyles.grid2}>
            <LoadInputWithInfo
              label="👨‍✈️ Siège avant gauche (Pilote)"
              value={safeLoads.frontLeft}
              onChange={(v) => onLoadChange('frontLeft', v)}
              arm={arms.frontLeft}
              max={120}
            />
            <LoadInputWithInfo
              label="🧑‍🤝‍🧑 Siège avant droit"
              value={safeLoads.frontRight}
              onChange={(v) => onLoadChange('frontRight', v)}
              arm={arms.frontRight}
              max={120}
            />
          </div>

          {/* Sièges arrière */}
          <div style={commonStyles.grid2}>
            <LoadInputWithInfo
              label="👥 Siège arrière gauche"
              value={safeLoads.rearLeft}
              onChange={(v) => onLoadChange('rearLeft', v)}
              arm={arms.rearLeft}
              max={120}
            />
            <LoadInputWithInfo
              label="👥 Siège arrière droit"
              value={safeLoads.rearRight}
              onChange={(v) => onLoadChange('rearRight', v)}
              arm={arms.rearRight}
              max={120}
            />
          </div>

          {/* Section Carburant - Différents scénarios */}
          <div style={{ ...commonStyles.card, padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#10b981' }}>
                ⛽ Scénarios de carburant
              </h4>

              {/* Badge densité carburant */}
              <div style={{
                display: 'flex',
                gap: '12px',
                fontSize: '11px',
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <span>⛽ <strong>{aircraft.fuelType || 'JET-A1'}</strong>: {fuelDensity} kg/L</span>
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
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #d1fae5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Full Tank</span>
                    <span style={{ fontSize: '13px', color: '#3b82f6' }}>
                      {fullTankInUserUnit.toFixed(1)} {fuelUnitSymbol} ({fullTankKg.toFixed(1)} kg)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#6b7280' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>📏 Bras:</span>
                      <span>{arms.fuel !== null ? `${arms.fuel.toFixed(2)} m` : '⚠️ N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>⚖️ Moment:</span>
                      <span>{arms.fuel !== null ? `${fullTankMoment.toFixed(1)} kg.m` : '⚠️ N/A'}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* FOB T/O (Take-Off) */}
            {fuelLitres > 0 && (
              <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #d1fae5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>FOB T/O (Décollage)</span>
                  <span style={{ fontSize: '13px', color: '#059669' }}>
                    {fuelInUserUnit.toFixed(1)} {fuelUnitSymbol} ({fuelWeightKg.toFixed(1)} kg)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#6b7280' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>📏 Bras:</span>
                    {arms.fuel !== null ? (
                      <span style={{ color: theme.colors.textPrimary }}>{arms.fuel.toFixed(2)} m</span>
                    ) : (
                      <span style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ MANQUANT</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>⚖️ Moment:</span>
                    {arms.fuel !== null ? (
                      <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                        {fuelMoment.toFixed(1)} kg.m
                      </span>
                    ) : (
                      <span style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ N/A</span>
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
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #d1fae5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>FOB Landing (Atterrissage)</span>
                    <span style={{ fontSize: '13px', color: '#f59e0b' }}>
                      {landingFuelInUserUnit.toFixed(1)} {fuelUnitSymbol} ({landingFuelKg.toFixed(1)} kg)
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#6b7280' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>📏 Bras:</span>
                      <span>{arms.fuel !== null ? `${arms.fuel.toFixed(2)} m` : '⚠️ N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>⚖️ Moment:</span>
                      <span>{arms.fuel !== null ? `${landingMoment.toFixed(1)} kg.m` : '⚠️ N/A'}</span>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* FOB Alternate (Point de déroutement) - Calcul géométrique */}
            {(() => {
              // Utiliser le calcul géométrique avec perpendiculaire
              // Distance = distance le long de la route jusqu'à la perpendiculaire + distance perpendiculaire

              let alternateFuelL = 0;
              let calculationDetails = null;

              // Vérifier si on a les données nécessaires
              if (flightPlan?.route?.departure?.coordinates &&
                flightPlan?.route?.arrival?.coordinates &&
                flightPlan?.alternates &&
                flightPlan.alternates.length > 0 &&
                aircraft?.cruiseSpeedKt &&
                aircraft?.fuelConsumption) {

                // Prendre le premier alternate
                const alternate = flightPlan.alternates[0];

                if (alternate.coordinates || (alternate.lat && (alternate.lon || alternate.lng))) {
                  const departure = flightPlan.route.departure.coordinates;
                  const arrival = flightPlan.route.arrival.coordinates;
                  const altCoords = alternate.coordinates || {
                    lat: alternate.lat,
                    lon: alternate.lon || alternate.lng
                  };

                  // Calculer la distance perpendiculaire du point au segment de route
                  const perpDistance = calculateDistanceToSegment(altCoords, departure, arrival);

                  // Calculer la distance totale de la route
                  const routeDistance = calculateDistance(departure, arrival);

                  // Calculer le point médian de la route (approximation du point de décision)
                  const midpoint = calculateMidpoint(departure, arrival);

                  // Distance du départ au point médian (approximation)
                  const distanceToDecisionPoint = routeDistance / 2;

                  // Distance totale = distance jusqu'au point de décision + distance perpendiculaire
                  const totalDistance = distanceToDecisionPoint + perpDistance;

                  // Calculer le carburant nécessaire
                  const timeHours = totalDistance / aircraft.cruiseSpeedKt;
                  const currentUnit = getUnit('fuelConsumption');
                  const GAL_TO_LTR = 3.78541;

                  if (currentUnit === 'gph') {
                    const consumptionLph = aircraft.fuelConsumption * GAL_TO_LTR;
                    alternateFuelL = timeHours * consumptionLph;
                  } else {
                    alternateFuelL = timeHours * aircraft.fuelConsumption;
                  }

                  calculationDetails = {
                    routeDistance: routeDistance.toFixed(1),
                    distanceToDecisionPoint: distanceToDecisionPoint.toFixed(1),
                    perpDistance: perpDistance.toFixed(1),
                    totalDistance: totalDistance.toFixed(1)
                  };
                }
              }

              // Fallback sur fuelData.alternate si pas de calcul géométrique possible
              if (alternateFuelL === 0 && fuelData?.alternate?.ltr) {
                alternateFuelL = fuelData.alternate.ltr;
              }

              const alternateFuelKg = alternateFuelL * fuelDensity;
              const alternateMoment = alternateFuelKg * (arms.fuel || 0);
              const alternateFuelInUserUnit = convert(alternateFuelL, 'fuel', 'ltr', userFuelUnit);

              return alternateFuelKg > 0 ? (
                <div style={{ marginBottom: '0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>FOB Alternate (Déroutement)</span>
                    <span style={{ fontSize: '13px', color: theme.colors.textPrimary }}>
                      {alternateFuelInUserUnit.toFixed(1)} {fuelUnitSymbol} ({alternateFuelKg.toFixed(1)} kg)
                    </span>
                  </div>

                  {/* Détails du calcul géométrique */}
                  {calculationDetails && (
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px', paddingLeft: '4px' }}>
                      📐 Route: {calculationDetails.routeDistance} NM |
                      Point décision: {calculationDetails.distanceToDecisionPoint} NM |
                      Perpendiculaire: {calculationDetails.perpDistance} NM |
                      Total: {calculationDetails.totalDistance} NM
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#6b7280' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>📏 Bras:</span>
                      <span>{arms.fuel !== null ? `${arms.fuel.toFixed(2)} m` : '⚠️ N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>⚖️ Moment:</span>
                      <span>{arms.fuel !== null ? `${alternateMoment.toFixed(1)} kg.m` : '⚠️ N/A'}</span>
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
                    label={`🧳 ${compartment.name}`}
                    value={safeLoads[`baggage_${compartment.id}`] || 0}
                    onChange={(v) => onLoadChange(`baggage_${compartment.id}`, v)}
                    arm={arm}
                    max={compartment.maxWeight ? parseFloat(compartment.maxWeight) : undefined}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ ...commonStyles.card, padding: '16px', textAlign: 'center', color: theme.colors.textSecondary, fontSize: '13px' }}>
              Aucun compartiment bagage configuré pour cet avion.
            </div>
          )}
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
          fontSize: '12px',
          color: theme.colors.textSecondary
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>📏 Bras:</span>
            {arm !== null ? (
              <span style={{ color: theme.colors.textPrimary }}>{arm.toFixed(2)} m</span>
            ) : (
              <span style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ MANQUANT</span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>⚖️ Moment:</span>
            {moment !== null ? (
              <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
                {moment.toFixed(1)} kg.m
              </span>
            ) : (
              <span style={{ color: '#ef4444', fontWeight: '600' }}>⚠️ N/A</span>
            )}
          </div>
        </div>
      </div>
    );
  });

  export default Step6WeightBalance;