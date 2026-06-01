// src/features/weight-balance/components/WeightBalanceModule.jsx
import React, { memo, useMemo, useCallback } from 'react';
import { useAircraft, useFuel, useWeightBalance, useNavigation } from '@core/contexts';
import { useUnits } from '@hooks/useUnits';
import { LoadInput } from './LoadInput';
import { WeightBalanceChart } from './WeightBalanceChart';
import { ScenarioCards } from './ScenarioCards';
import { calculateScenarios } from '../utils/calculations';
import { sx } from '@shared/styles/styleSystem';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

// Composant principal optimisé
export const WeightBalanceModule = memo(() => {
  const { selectedAircraft } = useAircraft();
  const { fobFuel, fuelData } = useFuel();
  const { loads, updateLoad, calculations } = useWeightBalance();
  const { navigationResults } = useNavigation();
  const { getUnit } = useUnits();

  // Log pour déboguer
  console.log('Current loads state:', loads);
  console.log('Current calculations:', calculations);

  // Calcul des scénarios mémorisé
  const scenarios = useMemo(() => {
    if (!selectedAircraft || !calculations || typeof calculations.totalWeight !== 'number' || typeof calculations.totalMoment !== 'number') {
      return null;
    }
    const fuelUnit = getUnit('fuel');
    return calculateScenarios(selectedAircraft, calculations, loads, fobFuel, fuelData, fuelUnit);
  }, [selectedAircraft, calculations, loads, fobFuel, fuelData, getUnit]);

  // Handler mémorisé pour updateLoad
  const handleLoadChange = useCallback((type, value) => {
    console.log(`WeightBalanceModule - Changing ${type} to:`, value);
    updateLoad(type, value);
  }, [updateLoad]);

  if (!selectedAircraft) {
    return <EmptyState />;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié */}
      <ModuleHero
        image="/assets/photos/hero-weight-balance.jpg"
        eyebrow="M&C · MASSE ET CENTRAGE"
        title="Masse et centrage"
      />

      {/* Section Chargement */}
      <LoadingSection
        loads={loads}
        aircraft={selectedAircraft}
        onLoadChange={handleLoadChange}
      />

      {/* Scénarios */}
      {scenarios && (
        <ScenarioCards
          scenarios={scenarios}
          fobFuel={fobFuel}
          fuelData={fuelData}
          aircraft={selectedAircraft}
        />
      )}

      {/* Graphique */}
      <WeightBalanceChart
        aircraft={selectedAircraft}
        scenarios={scenarios}
        calculations={calculations}
      />
    </div>
  );
});

// Composant pour la section de chargement
const LoadingSection = memo(({ loads, aircraft, onLoadChange }) => {
  // Gérer le cas où weightBalance n'existe pas ou est incomplet
  // Utiliser armLengths comme fallback si weightBalance n'est pas défini
  const wb = aircraft.weightBalance || {
    emptyWeightArm: aircraft.armLengths?.emptyMassArm || 2.00,
    frontLeftSeatArm: aircraft.armLengths?.frontSeat1Arm || 2.00,
    frontRightSeatArm: aircraft.armLengths?.frontSeat2Arm || 2.00,
    rearLeftSeatArm: aircraft.armLengths?.rearSeat1Arm || 2.90,
    rearRightSeatArm: aircraft.armLengths?.rearSeat2Arm || 2.90,
    baggageArm: aircraft.armLengths?.standardBaggageArm || 3.50,
    auxiliaryArm: aircraft.armLengths?.aftBaggageExtensionArm || aircraft.armLengths?.baggageTubeArm || 3.70,
    fuelArm: aircraft.armLengths?.fuelArm || 2.18,
    cgLimits: {
      forward: 2.00,
      aft: 2.45
    }
  };
  
  // S'assurer que toutes les valeurs sont numériques, incluant les compartiments dynamiques
  const safeLoads = {
    frontLeft: loads.frontLeft || 0,
    frontRight: loads.frontRight || 0,
    rearLeft: loads.rearLeft || 0,
    rearRight: loads.rearRight || 0,
    baggage: loads.baggage || 0,
    auxiliary: loads.auxiliary || 0,
    // Ajouter les compartiments bagages dynamiques
    ...(aircraft.baggageCompartments && aircraft.baggageCompartments.reduce((acc, compartment, index) => {
      const key = `baggage_${compartment.id || index}`;
      acc[key] = loads[key] || 0;
      return acc;
    }, {}))
  };
  
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
            value={safeLoads.frontLeft}
            onChange={(v) => onLoadChange('frontLeft', v)}
            arm={wb.frontLeftSeatArm}
            loadKey="frontLeft"
          />
          <LoadInputWithInfo
            label="🧑‍🤝‍🧑 Siège avant droit"
            value={safeLoads.frontRight}
            onChange={(v) => onLoadChange('frontRight', v)}
            arm={wb.frontRightSeatArm}
            loadKey="frontRight"
          />
        </div>

        {/* Sièges arrière */}
        <div style={styles.grid2}>
          <LoadInputWithInfo
            label="👥 Siège arrière gauche"
            value={safeLoads.rearLeft}
            onChange={(v) => onLoadChange('rearLeft', v)}
            arm={wb.rearLeftSeatArm}
            loadKey="rearLeft"
          />
          <LoadInputWithInfo
            label="👥 Siège arrière droit"
            value={safeLoads.rearRight}
            onChange={(v) => onLoadChange('rearRight', v)}
            arm={wb.rearRightSeatArm}
            loadKey="rearRight"
          />
        </div>

        {/* Compartiments bagages dynamiques */}
        {aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: aircraft.baggageCompartments.length === 1 ? '1fr' : '1fr 1fr', gap: '16px' }}>
            {aircraft.baggageCompartments.map((compartment, index) => (
              <LoadInputWithInfo
                key={compartment.id || `baggage-${index}`}
                label={`🎒 ${compartment.name} (max ${compartment.maxWeight || '50'} kg)`}
                value={safeLoads[`baggage_${compartment.id || index}`] || 0}
                onChange={(v) => onLoadChange(`baggage_${compartment.id || index}`, v)}
                arm={parseFloat(compartment.arm) || 3.50}
                max={parseFloat(compartment.maxWeight) || 50}
                loadKey={`baggage_${compartment.id || index}`}
              />
            ))}
          </div>
        ) : (
          // Fallback vers les compartiments par défaut si aucun n'est défini
          <div style={styles.grid2}>
            <LoadInputWithInfo
              label={`🎒 Bagages (max ${aircraft.maxBaggageWeight || 50} kg)`}
              value={safeLoads.baggage}
              onChange={(v) => onLoadChange('baggage', v)}
              arm={wb.baggageArm}
              max={aircraft.maxBaggageWeight || 50}
              loadKey="baggage"
            />
            <LoadInputWithInfo
              label={`📦 Rangement annexe (max ${aircraft.maxAuxiliaryWeight || 20} kg)`}
              value={safeLoads.auxiliary}
              onChange={(v) => onLoadChange('auxiliary', v)}
              arm={wb.auxiliaryArm}
              max={aircraft.maxAuxiliaryWeight || 20}
              loadKey="auxiliary"
            />
          </div>
        )}
      </div>
    </section>
  );
});

// Composant optimisé pour chaque input de charge
const LoadInputWithInfo = memo(({ label, value, onChange, arm, max, loadKey }) => {
  // Mémorisation du moment avec vérification
  const displayValue = value || 0;
  const moment = useMemo(() => (displayValue * arm).toFixed(1), [displayValue, arm]);
  
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
    <div style={sx.text.left}>
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
