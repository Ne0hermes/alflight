// src/features/flight-wizard/steps/Step6WeightBalance.jsx
import React, { memo, useMemo, useCallback, useEffect } from 'react';
import { useAircraft, useFuel, useWeightBalance } from '@core/contexts';
import { LoadInput } from '@features/weight-balance/components/LoadInput';
import { WeightBalanceChart } from '@features/weight-balance/components/WeightBalanceChart';
import { WeightBalanceTable } from '@features/weight-balance/components/WeightBalanceTable';
import { ScenarioCards } from '@features/weight-balance/components/ScenarioCards';
import { WeightBalanceInfo } from '@features/weight-balance/components/WeightBalanceInfo';
import { calculateScenarios } from '@features/weight-balance/utils/calculations';
import { Scale } from 'lucide-react';
import { theme } from '../../../styles/theme';

// Styles communs
const commonStyles = {
  container: {
    padding: '24px',
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
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  }
};

// Composant principal de l'étape 6
export const Step6WeightBalance = memo(({ flightPlan, onUpdate }) => {
  const { setSelectedAircraft } = useAircraft();
  const { fobFuel, fuelData, setFobFuel } = useFuel();
  const { loads, updateLoad, calculations } = useWeightBalance();

  // Utiliser l'avion depuis flightPlan (défini en Step1) au lieu du contexte global
  // Cela garantit que les données de masse et centrage viennent de l'avion sélectionné en Step1
  const aircraft = flightPlan?.aircraft;

  // 🔧 FIX CRITIQUE : Synchroniser l'avion complet avec le contexte
  // Si l'avion du flightPlan manque weightBalance (brouillon ancien), récupérer depuis le store
  useEffect(() => {
    if (aircraft?.registration) {
      // Si weightBalance manque, récupérer l'avion complet depuis le store
      if (!aircraft.weightBalance) {
        console.warn('⚠️ [Step6] weightBalance manquant - Récupération avion complet depuis le store');

        import('@core/stores/aircraftStore').then(({ useAircraftStore }) => {
          const store = useAircraftStore.getState();
          const fullAircraft = store.aircraftList.find(
            ac => ac.registration === aircraft.registration
          );

          if (fullAircraft) {
            console.log('✅ [Step6] Avion complet récupéré:', fullAircraft.registration);

            // Mettre à jour flightPlan avec l'avion complet
            flightPlan.updateAircraft({ ...fullAircraft });

            // Synchroniser avec le contexte
            setSelectedAircraft(fullAircraft);
          } else {
            console.error('❌ [Step6] Avion non trouvé dans le store:', aircraft.registration);
          }
        });
      } else {
        // weightBalance existe déjà, juste synchroniser avec le contexte
        setSelectedAircraft(aircraft);
        console.log('✅ [Step6] Avion synchronisé avec contexte:', aircraft.registration);
      }
    }
  }, [aircraft?.registration, aircraft?.weightBalance, setSelectedAircraft, flightPlan]);

  // Synchroniser le carburant
  useEffect(() => {
    if (flightPlan?.fuel?.confirmed && fobFuel !== flightPlan.fuel.confirmed) {
      setFobFuel(flightPlan.fuel.confirmed);
    }
  }, [flightPlan, fobFuel, setFobFuel]);

  // Calcul des scénarios
  const scenarios = useMemo(() => {
    if (!aircraft || !calculations || typeof calculations.totalWeight !== 'number') {
      return null;
    }
    return calculateScenarios(aircraft, calculations, loads, fobFuel, fuelData);
  }, [aircraft, calculations, loads, fobFuel, fuelData]);

  // Handler pour la mise à jour des charges
  const handleLoadChange = useCallback((type, value) => {
    updateLoad(type, value);
    
    // Mettre à jour le plan de vol
    if (flightPlan) {
      const totalPassengerWeight = 
        (type === 'frontLeft' ? value : loads.frontLeft || 0) +
        (type === 'frontRight' ? value : loads.frontRight || 0) +
        (type === 'rearLeft' ? value : loads.rearLeft || 0) +
        (type === 'rearRight' ? value : loads.rearRight || 0);
      
      const totalBaggageWeight = 
        (type === 'baggage' ? value : loads.baggage || 0) +
        (type === 'auxiliary' ? value : loads.auxiliary || 0);
      
      flightPlan.updateWeightBalance({
        passengers: Math.round(totalPassengerWeight / 77),
        baggage: totalBaggageWeight,
        loads: { ...loads, [type]: value }
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

  return (
    <div style={commonStyles.container}>
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <Scale size={18} />
          Configuration détaillée de masse et centrage
        </label>
      </div>

      {/* Section Chargement */}
      <LoadingSection
        loads={loads}
        aircraft={aircraft}
        onLoadChange={handleLoadChange}
      />

      {/* Tableau récapitulatif */}
      <WeightBalanceTable
        aircraft={aircraft}
        loads={loads}
        calculations={calculations}
      />

      {/* Scénarios de vol */}
      {scenarios && (
        <ScenarioCards
          scenarios={scenarios}
          fobFuel={fobFuel}
          fuelData={fuelData}
        />
      )}

      {/* Graphique du domaine de vol */}
      <WeightBalanceChart
        aircraft={aircraft}
        scenarios={scenarios}
        calculations={calculations}
      />

      {/* Informations supplémentaires */}
      <WeightBalanceInfo
        aircraft={aircraft}
        fobFuel={fobFuel}
        fuelData={fuelData}
      />
    </div>
  );
});

// Composant pour la section de chargement
const LoadingSection = memo(({ loads, aircraft, onLoadChange }) => {
  // Gérer les bras de levier de l'avion
  // ⚠️ PAS DE VALEURS PAR DÉFAUT - Tout doit venir de Supabase via aircraft.weightBalance
  const wb = aircraft.weightBalance || {};
  const armLengths = aircraft.armLengths || {};

  // 🚫 VALEURS STATIQUES EXTERMINÉES - Extraction exclusive depuis Supabase
  const arms = {
    empty: wb.emptyWeightArm || armLengths.emptyMassArm || 0,
    frontLeft: wb.frontLeftSeatArm || armLengths.frontSeat1Arm || 0,
    frontRight: wb.frontRightSeatArm || armLengths.frontSeat2Arm || 0,
    rearLeft: wb.rearLeftSeatArm || armLengths.rearSeat1Arm || 0,
    rearRight: wb.rearRightSeatArm || armLengths.rearSeat2Arm || 0,
    baggage: wb.baggageArm || armLengths.standardBaggageArm || 0,
    auxiliary: wb.auxiliaryArm || armLengths.aftBaggageExtensionArm || armLengths.baggageTubeArm || 0,
    fuel: wb.fuelArm || armLengths.fuelArm || 0
  };

  // Debug: afficher les bras chargés depuis Supabase
  console.log('🔍 Bras de levier chargés depuis Supabase:', arms);

  // S'assurer que toutes les valeurs sont numériques
  const safeLoads = {
    frontLeft: loads.frontLeft || 0,
    frontRight: loads.frontRight || 0,
    rearLeft: loads.rearLeft || 0,
    rearRight: loads.rearRight || 0,
    baggage: loads.baggage || 0,
    auxiliary: loads.auxiliary || 0
  };

  return (
    <section style={{ ...commonStyles.card, marginBottom: '24px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
        ⚖️ Chargement et Moments
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        {/* Compartiments bagages dynamiques */}
        {aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: aircraft.baggageCompartments.length === 1 ? '1fr' : '1fr 1fr', 
            gap: '16px' 
          }}>
            {aircraft.baggageCompartments.map((compartment, index) => (
              <LoadInputWithInfo
                key={compartment.id || `baggage-${index}`}
                label={`🎒 ${compartment.name} (max ${compartment.maxWeight || '50'} kg)`}
                value={safeLoads[`baggage_${compartment.id || index}`] || 0}
                onChange={(v) => onLoadChange(`baggage_${compartment.id || index}`, v)}
                arm={parseFloat(compartment.arm) || 3.50}
                max={parseFloat(compartment.maxWeight) || 50}
              />
            ))}
          </div>
        ) : (
          // Compartiments par défaut
          <div style={commonStyles.grid2}>
            <LoadInputWithInfo
              label={`🎒 Bagages (max ${aircraft.maxBaggageWeight || 50} kg)`}
              value={safeLoads.baggage}
              onChange={(v) => onLoadChange('baggage', v)}
              arm={arms.baggage}
              max={aircraft.maxBaggageWeight || 50}
            />
            <LoadInputWithInfo
              label={`📦 Rangement annexe (max ${aircraft.maxAuxiliaryWeight || 20} kg)`}
              value={safeLoads.auxiliary}
              onChange={(v) => onLoadChange('auxiliary', v)}
              arm={arms.auxiliary}
              max={aircraft.maxAuxiliaryWeight || 20}
            />
          </div>
        )}
      </div>
    </section>
  );
});

// Composant pour chaque input avec infos
const LoadInputWithInfo = memo(({ label, value, onChange, arm, max }) => {
  const moment = useMemo(() => ((value || 0) * arm).toFixed(1), [value, arm]);
  
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
          <span style={{ color: theme.colors.textPrimary }}>{arm.toFixed(2)} m</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>⚖️ Moment:</span>
          <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
            {moment} kg.m
          </span>
        </div>
      </div>
    </div>
  );
});

// Display names pour le debug
Step6WeightBalance.displayName = 'Step6WeightBalance';
LoadingSection.displayName = 'LoadingSection';
LoadInputWithInfo.displayName = 'LoadInputWithInfo';

export default Step6WeightBalance;