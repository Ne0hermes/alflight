// src/features/weight-balance/components/WeightBalanceModule.jsx
import React, { memo, useMemo, useCallback } from 'react';
import { getRouteEffectiveSpeedKt } from '@features/navigation/utils/effectiveSpeed';
import { useAircraft, useFuel, useWeightBalance, useNavigation } from '@core/contexts';
import { useUnits } from '@hooks/useUnits';
import { LoadInput } from './LoadInput';
import { WeightBalanceChart } from './WeightBalanceChart';
import { ScenarioCards } from './ScenarioCards';
import { calculateScenarios } from '../utils/calculations';
import { activeTankIdsFrom } from '@core/stores/fuelStore';
import { computeLegFuelPlans } from '@features/fuel/utils/legFuelPlan';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';
import { sx } from '@shared/styles/styleSystem';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

// Composant principal optimisé
export const WeightBalanceModule = memo(() => {
  const { selectedAircraft } = useAircraft();
  const { fobFuel, fuelData, tankConfig } = useFuel();
  const { loads, updateLoad, calculations } = useWeightBalance();
  const { navigationResults, waypoints } = useNavigation();
  const { getUnit } = useUnits();

  // Log pour déboguer
  console.log('Current loads state:', loads);
  console.log('Current calculations:', calculations);

  // ─── Config réservoirs du vol (module Carburant) ──────────────────────────
  // FAIT FOI pour CET avion (au moins une case touchée) → seuls les réservoirs
  // cochés comptent dans les scénarios ; null → comportement historique (tous
  // les réservoirs déclarés). cf. fuelStore.activeTankIdsFrom.
  const activeTankIds = useMemo(
    () => activeTankIdsFrom(tankConfig, selectedAircraft),
    [selectedAircraft, tankConfig]
  );

  // Calcul des scénarios mémorisé
  // 🔧 CRAN 3 — escale avitaillement : l'« atterrissage » = prochain
  // atterrissage réel (escale), brûlé = roulage + trip du tronçon 1
  const scenarios = useMemo(() => {
    if (!selectedAircraft || !calculations || typeof calculations.totalWeight !== 'number' || typeof calculations.totalMoment !== 'number') {
      return null;
    }
    const fuelUnit = getUnit('fuel');
    const plan = computeLegFuelPlans({
      waypoints,
      cruiseSpeedKt: getCruiseSpeedKt(selectedAircraft),
      // 🔧 C2 : vitesse sol corrigée du vent (null si vents non chargés → TAS)
      effectiveSpeedKt: getRouteEffectiveSpeedKt(waypoints, getCruiseSpeedKt(selectedAircraft)),
      fuelConsumptionLph: getFuelConsumptionLph(selectedAircraft),
      taxiLtr: fuelData?.roulage?.ltr || 0,
      finalReserveLtr: fuelData?.finalReserve?.ltr || 0,
      alternateLtr: fuelData?.alternate?.ltr || 0
    });
    const burnedOverride = plan?.isMultiLeg
      ? plan.legs[0].taxiLtr + plan.legs[0].tripLtr
      : null;
    return calculateScenarios(selectedAircraft, calculations, loads, fobFuel, fuelData, fuelUnit, activeTankIds, burnedOverride);
  }, [selectedAircraft, calculations, loads, fobFuel, fuelData, getUnit, activeTankIds, waypoints]);

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
  // ⚠️ CORRECTIF SÉCURITÉ (16/08) — ce bloc INVENTAIT les bras de levier d'un
  // DR400 générique (2,00 / 2,90 / 3,50 / 3,70 / 2,18 m et des limites de
  // centrage 2,00–2,45) quand l'avion n'avait pas de données de centrage, puis
  // affichait des moments calculés dessus SANS AUCUN AVERTISSEMENT. Un pilote
  // pouvait ainsi lire un centrage plausible… entièrement fabriqué.
  // Règle du projet (fail-closed, cf. moteur de centrage) : on ne fabrique
  // JAMAIS une donnée de sécurité — on refuse et on le dit.
  const armOrNull = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n !== 0 ? n : null;
  };
  const wb = aircraft.weightBalance || {
    emptyWeightArm: armOrNull(aircraft.armLengths?.emptyMassArm),
    frontLeftSeatArm: armOrNull(aircraft.armLengths?.frontSeat1Arm),
    frontRightSeatArm: armOrNull(aircraft.armLengths?.frontSeat2Arm),
    rearLeftSeatArm: armOrNull(aircraft.armLengths?.rearSeat1Arm),
    rearRightSeatArm: armOrNull(aircraft.armLengths?.rearSeat2Arm),
    baggageArm: armOrNull(aircraft.armLengths?.standardBaggageArm),
    auxiliaryArm: armOrNull(aircraft.armLengths?.aftBaggageExtensionArm)
      ?? armOrNull(aircraft.armLengths?.baggageTubeArm),
    fuelArm: armOrNull(aircraft.armLengths?.fuelArm),
    cgLimits: null
  };

  // Les bras réellement absents sont signalés au pilote (jamais comblés).
  const missingArms = Object.entries({
    'masse à vide': wb.emptyWeightArm,
    'sièges avant': wb.frontLeftSeatArm,
    'sièges arrière': wb.rearLeftSeatArm,
    'carburant': wb.fuelArm,
  }).filter(([, v]) => v == null).map(([k]) => k);
  
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

      {/* Bras manquants : signalés explicitement — les moments correspondants
          ne peuvent PAS être calculés, et aucune valeur n'est inventée. */}
      {missingArms.length > 0 && (
        <div style={{
          marginBottom: '16px', padding: '10px 12px',
          border: '1px solid var(--color-red-critical)',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          fontSize: 'var(--fs-body)'
        }}>
          <strong>⚠ Données de centrage incomplètes</strong> — bras de levier manquants :{' '}
          {missingArms.join(', ')}. Les moments correspondants ne sont pas calculés.
          Complétez la fiche de l'avion (rubrique masse et centrage) avant d'utiliser
          ce chargement pour un vol.
        </div>
      )}

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
                label={`🎒 ${compartment.name} (max ${Number.isFinite(parseFloat(compartment.maxWeight)) ? parseFloat(compartment.maxWeight) : '?'} kg)`}
                value={safeLoads[`baggage_${compartment.id || index}`] || 0}
                onChange={(v) => onLoadChange(`baggage_${compartment.id || index}`, v)}
                arm={Number.isFinite(parseFloat(compartment.arm)) ? parseFloat(compartment.arm) : null}
                max={Number.isFinite(parseFloat(compartment.maxWeight)) ? parseFloat(compartment.maxWeight) : undefined}
                loadKey={`baggage_${compartment.id || index}`}
              />
            ))}
          </div>
        ) : (
          // 23/08/2026 (décision pilote) — les limites 50 kg / 20 kg étaient des
          // valeurs FABRIQUÉES par l'application, jamais lues dans un manuel :
          // « le 50 et le 20 doivent être retirés, ce sont des merdes ». Les
          // vraies limites vivent dans baggageCompartments (masse ET bras par
          // compartiment, plus la limite cumulée). Sans compartiment déclaré,
          // on ne propose donc AUCUN curseur inventé : on le dit.
          <div style={{
            padding: 12, border: '1px dashed var(--border-subtle)', borderRadius: 6,
            fontSize: 13, color: 'var(--text-secondary)'
          }}>
            Aucun compartiment bagages n'est déclaré sur cet avion — renseignez-les
            dans la fiche (nom, bras, masse maximale, et la limite cumulée si le
            manuel en donne une) pour pouvoir charger des bagages.
          </div>
        )}
      </div>
    </section>
  );
});

// Composant optimisé pour chaque input de charge
const LoadInputWithInfo = memo(({ label, value, onChange, arm, max, loadKey }) => {
  // 🔧 24/08/2026 — bras inconnu (null) : PAS de moment calculé (le « ×0 »
  // d'avant rendait un moment nul d'apparence normale). On l'affiche.
  const displayValue = value || 0;
  const armOk = Number.isFinite(arm);
  const moment = useMemo(() => (armOk ? (displayValue * arm).toFixed(1) : null), [displayValue, arm, armOk]);
  
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
          <span style={armOk ? sx.text.primary : sx.combine(sx.text.primary, { color: sx.theme.colors.danger[600] })}>{armOk ? `${arm.toFixed(2)} m` : 'non renseigné'}</span>
        </div>
        <div style={sx.flex.between}>
          <span>⚖️ Moment:</span>
          <span style={sx.combine(sx.text.primary, sx.text.bold)}>{moment !== null ? `${moment} kg.m` : '—'}</span>
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
