// src/features/weight-balance/components/WeightBalanceModule.jsx
import React, { memo, useMemo, useCallback } from 'react';
import { useAircraft, useFuel, useWeightBalance, useNavigation } from '@core/contexts';
import { LoadInput } from './LoadInput';
import { WeightBalanceChart } from './WeightBalanceChart';
import { WeightBalanceTable } from './WeightBalanceTable';
import { ScenarioCards } from './ScenarioCards';
import { WeightBalanceInfo } from './WeightBalanceInfo';
import { calculateScenarios } from '../utils/calculations';
import { sx } from '@shared/styles/styleSystem';

// Composant principal optimisé
export const WeightBalanceModule = memo(() => {
  const { selectedAircraft } = useAircraft();
  const { fobFuel, fuelData } = useFuel();
  const { loads, setLoads, calculations } = useWeightBalance();
  const { navigationResults } = useNavigation();

  // Calcul des scénarios mémorisé
  const scenarios = useMemo(() => {
    if (!selectedAircraft || !calculations) return null;
    return calculateScenarios(selectedAircraft, calculations, loads, fobFuel, fuelData);
  }, [selectedAircraft, calculations, loads, fobFuel, fuelData]);

  // Handlers mémorisés
  const handleLoadChange = useCallback((type, value) => {
    setLoads(prev => ({ ...prev, [type]: value }));
  }, [setLoads]);

  if (!selectedAircraft) {
    return <EmptyState />;
  }

  return (
    <div style={sx.spacing.p(6)}>
      {/* Section Chargement */}
      <LoadingSection 
        loads={loads}
        aircraft={selectedAircraft}
        onLoadChange={handleLoadChange}
      />

      {/* Tableau récapitulatif */}
      <WeightBalanceTable
        aircraft={selectedAircraft}
        loads={loads}
        calculations={calculations}
      />

      {/* Scénarios */}
      {scenarios && (
        <ScenarioCards
          scenarios={scenarios}
          fobFuel={fobFuel}
          fuelData={fuelData}
        />
      )}

      {/* Graphique */}
      <WeightBalanceChart
        aircraft={selectedAircraft}
        scenarios={scenarios}
        calculations={calculations}
      />

      {/* Informations */}
      <WeightBalanceInfo
        aircraft={selectedAircraft}
        fobFuel={fobFuel}
        fuelData={fuelData}
      />
    </div>
  );
});

// Composant pour la section de chargement
const LoadingSection = memo(({ loads, aircraft, onLoadChange }) => {
  const wb = aircraft.weightBalance;
  
  return (
    <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
      <h3 style={sx.combine(sx.text['lg'], sx.text.bold, sx.spacing.mb(4))}>
        ⚖️ Chargement et Moments
      </h3>
      
      <div style={sx.combine(sx.flex.col, sx.spacing.gap(4))}>
        {/* Sièges avant */}
        <div style={styles.grid2}>
          <LoadInputWithInfo
            label="👨‍✈️ Siège avant gauche (Pilote)"
            value={loads.frontLeft}
            onChange={(v) => onLoadChange('frontLeft', v)}
            arm={wb.frontLeftSeatArm}
            loadKey="frontLeft"
          />
          <LoadInputWithInfo
            label="🧑‍🤝‍🧑 Siège avant droit"
            value={loads.frontRight}
            onChange={(v) => onLoadChange('frontRight', v)}
            arm={wb.frontRightSeatArm}
            loadKey="frontRight"
          />
        </div>

        {/* Sièges arrière */}
        <div style={styles.grid2}>
          <LoadInputWithInfo
            label="👥 Siège arrière gauche"
            value={loads.rearLeft}
            onChange={(v) => onLoadChange('rearLeft', v)}
            arm={wb.rearLeftSeatArm}
            loadKey="rearLeft"
          />
          <LoadInputWithInfo
            label="👥 Siège arrière droit"
            value={loads.rearRight}
            onChange={(v) => onLoadChange('rearRight', v)}
            arm={wb.rearRightSeatArm}
            loadKey="rearRight"
          />
        </div>

        {/* Bagages */}
        <div style={styles.grid2}>
          <LoadInputWithInfo
            label={`🎒 Bagages (max ${aircraft.maxBaggageWeight} kg)`}
            value={loads.baggage}
            onChange={(v) => onLoadChange('baggage', v)}
            arm={wb.baggageArm}
            max={aircraft.maxBaggageWeight}
            loadKey="baggage"
          />
          <LoadInputWithInfo
            label={`📦 Rangement annexe (max ${aircraft.maxAuxiliaryWeight} kg)`}
            value={loads.auxiliary}
            onChange={(v) => onLoadChange('auxiliary', v)}
            arm={wb.auxiliaryArm}
            max={aircraft.maxAuxiliaryWeight}
            loadKey="auxiliary"
          />
        </div>
      </div>
    </section>
  );
});

// Composant optimisé pour chaque input de charge
const LoadInputWithInfo = memo(({ label, value, onChange, arm, max, loadKey }) => {
  // Mémorisation du moment
  const moment = useMemo(() => (value * arm).toFixed(1), [value, arm]);
  
  return (
    <div style={sx.components.card.base}>
      <LoadInput 
        label={label} 
        value={value} 
        onChange={onChange} 
        max={max}
      />
      <div style={sx.combine(styles.grid2, sx.spacing.mt(2), sx.text.sm, sx.text.secondary)}>
        <div style={sx.flex.between}>
          <span>📏 Bras de levier:</span>
          <span style={sx.text.primary}>{arm.toFixed(2)} m</span>
        </div>
        <div style={sx.flex.between}>
          <span>⚖️ Moment:</span>
          <span style={sx.combine(sx.text.primary, sx.text.bold)}>{moment} kg.m</span>
        </div>
      </div>
    </div>
  );
});

// État vide
const EmptyState = memo(() => (
  <div style={sx.combine(sx.flex.center, sx.spacing.p(8))}>
    <div style={sx.text.center}>
      <p style={sx.combine(sx.text.lg, sx.text.secondary)}>
        Sélectionnez un avion pour afficher le module de masse et centrage
      </p>
    </div>
  </div>
));

// Styles statiques
const styles = {
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: sx.theme.spacing[3]
  }
};

// Export avec displayName pour le debug
WeightBalanceModule.displayName = 'WeightBalanceModule';
LoadingSection.displayName = 'LoadingSection';
LoadInputWithInfo.displayName = 'LoadInputWithInfo';
EmptyState.displayName = 'EmptyState';

export default WeightBalanceModule;