// src/features/weight-balance/components/ScenarioCards.jsx
import React, { memo, useMemo } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const ScenarioCards = memo(({ scenarios, fobFuel, fuelData }) => {
  const cards = useMemo(() => [
    {
      key: 'fulltank',
      color: 'primary',
      title: 'FULLTANK',
      data: scenarios.fulltank,
      description: null
    },
    {
      key: 'toCrm',
      color: 'success',
      title: 'T/O CRM',
      data: scenarios.toCrm,
      description: '(CRM)'
    },
    {
      key: 'landing',
      color: 'warning',
      title: 'LANDING',
      data: scenarios.landing,
      description: fobFuel?.ltr > 0 ? '(CRM - Bilan)' : '(ZFW)'
    },
    {
      key: 'zfw',
      color: 'danger',
      title: 'ZFW',
      data: scenarios.zfw,
      description: '(Sans carburant)'
    }
  ], [scenarios, fobFuel]);
  
  return (
    <section style={sx.spacing.mb(6)}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
        🔄 Scénarios de centrage
      </h3>
      
      <CRMInfo fobFuel={fobFuel} />
      
      <div style={scenarioStyles.grid}>
        {cards.map(card => (
          <ScenarioCard key={card.key} {...card} />
        ))}
      </div>
    </section>
  );
});

// Carte de scénario individuelle
const ScenarioCard = memo(({ color, title, data, description }) => {
  const colorTheme = sx.theme.colors[color];
  
  const cardStyle = useMemo(() => ({
    ...sx.components.card.base,
    backgroundColor: colorTheme[50],
    borderColor: colorTheme[500],
    borderWidth: '2px'
  }), [colorTheme]);
  
  const dotStyle = useMemo(() => ({
    width: '12px',
    height: '12px',
    backgroundColor: colorTheme[500],
    borderRadius: '50%'
  }), [colorTheme]);
  
  const textStyle = useMemo(() => ({
    color: colorTheme[900]
  }), [colorTheme]);
  
  return (
    <div style={cardStyle}>
      <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), sx.flex.start, sx.spacing.gap(2), textStyle)}>
        <div style={dotStyle}></div>
        {title}
      </h5>
      <div style={sx.combine(sx.text.xs, textStyle)}>
        <p style={sx.spacing.mb(1)}>Masse: <strong>{data.w.toFixed(0)} kg</strong></p>
        <p style={sx.spacing.mb(1)}>CG: <strong>{data.cg.toFixed(2)} m</strong></p>
        <p>Carburant: <strong>{data.fuel.toFixed(0)} kg</strong> {description}</p>
      </div>
    </div>
  );
});

// Info CRM
const CRMInfo = memo(({ fobFuel }) => {
  if (fobFuel?.ltr > 0) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.success, sx.spacing.mb(4))}>
        <div style={sx.text['2xl']}>✅</div>
        <div>
          <p style={sx.combine(sx.text.base, sx.text.bold)}>
            CRM défini : {(fobFuel.ltr * 0.84).toFixed(0)} kg
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
            ({fobFuel.ltr.toFixed(1)} L)
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(4))}>
      <div style={sx.text['2xl']}>⚠️</div>
      <div>
        <p style={sx.combine(sx.text.sm, sx.text.bold)}>CRM non défini</p>
        <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
          Veuillez saisir le carburant CRM dans l'onglet "Bilan Carburant"
        </p>
      </div>
    </div>
  );
});

const scenarioStyles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: sx.theme.spacing[3]
  }
};

// Export des display names
ScenarioCards.displayName = 'ScenarioCards';
ScenarioCard.displayName = 'ScenarioCard';
CRMInfo.displayName = 'CRMInfo';