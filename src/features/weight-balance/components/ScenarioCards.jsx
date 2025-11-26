// src/features/weight-balance/components/ScenarioCards.jsx
import React, { memo, useMemo } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { FUEL_DENSITIES } from '@utils/constants';

// Helper pour extraire les litres de fobFuel (peut être un nombre ou un objet {gal, ltr})
const getFuelLiters = (fobFuel) => {
  if (typeof fobFuel === 'number') {
    return fobFuel;
  }
  return fobFuel?.ltr || 0;
};

export const ScenarioCards = memo(({ scenarios, fobFuel, fuelData, aircraft }) => {
  const fobLiter = getFuelLiters(fobFuel);

  // Calcul des infos carburant
  const fuelInfo = useMemo(() => {
    if (!aircraft) return null;

    const normalizedFuelType = aircraft.fuelType?.replace(/-/g, ' ');
    const fuelDensity = FUEL_DENSITIES[aircraft.fuelType] ||
                        FUEL_DENSITIES[normalizedFuelType] ||
                        FUEL_DENSITIES['JET A-1'] ||
                        0.84;

    const fuelCapacityKg = (aircraft.fuelCapacity || 0) * fuelDensity;
    const fuelArm = aircraft.weightBalance?.fuelArm || 0;

    return {
      fuelType: aircraft.fuelType || 'JET A-1',
      density: fuelDensity,
      capacity: aircraft.fuelCapacity || 0,
      capacityKg: fuelCapacityKg,
      arm: fuelArm
    };
  }, [aircraft]);

  const cards = useMemo(() => {
    if (!scenarios) return [];

    return [
      {
        key: 'zfw',
        color: 'danger',
        title: 'Masse sans carburant (ZFW)',
        data: scenarios.zfw,
        description: null
      },
      {
        key: 'toCrm',
        color: 'success',
        title: 'Masse au décollage (FOB)',
        data: scenarios.toCrm,
        description: null
      },
      {
        key: 'landing',
        color: 'warning',
        title: 'Masse à l\'atterrissage',
        data: scenarios.landing,
        description: fobLiter > 0 ? '(FOB - Bilan)' : '(ZFW)'
      },
      {
        key: 'fulltank',
        color: 'primary',
        title: 'Réservoirs pleins',
        data: scenarios.fulltank,
        description: null
      }
    ];
  }, [scenarios, fobLiter]);

  if (!scenarios) {
    return null;
  }

  return (
    <section style={sx.spacing.mb(6)}>
      <div style={sx.combine(sx.flex.between, sx.flex.alignCenter, sx.spacing.mb(3))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          🔄 Scénarios de centrage
        </h3>

        {/* Informations avion */}
        {aircraft && (
          <div style={{
            display: 'flex',
            gap: '16px',
            fontSize: '11px',
            color: '#6b7280',
            backgroundColor: '#f3f4f6',
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb'
          }}>
            {aircraft.equipment && <span>📦 Équipements SAR: {aircraft.equipment}</span>}
            {aircraft.cruiseSpeed && <span>⚡ Vitesse de croisière: {aircraft.cruiseSpeed} kt</span>}
          </div>
        )}
      </div>

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
  
  // Vérification des données avant affichage
  if (!data || typeof data.w !== 'number' || typeof data.cg !== 'number' || typeof data.fuel !== 'number') {
    return (
      <div style={cardStyle}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), sx.flex.start, sx.spacing.gap(2), textStyle)}>
          <div style={dotStyle}></div>
          {title}
        </h5>
        <div style={sx.combine(sx.text.xs, textStyle)}>
          <p>Données en cours de calcul...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={cardStyle}>
      <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), sx.flex.start, sx.spacing.gap(2), textStyle)}>
        <div style={dotStyle}></div>
        {title}
      </h5>
      <div style={sx.combine(sx.text.xs, textStyle)}>
        {/* Tableau détaillé des masses avec bras et moments */}
        {data.items && data.items.length > 0 && (
          <div style={{ borderTop: `1px solid ${colorTheme[200]}`, paddingTop: '8px', marginTop: '0' }}>
            <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colorTheme[300]}` }}>
                  <th style={{ textAlign: 'left', padding: '4px 2px', fontWeight: '600', width: '40%', whiteSpace: 'nowrap' }}>Élément</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '600', width: '20%', whiteSpace: 'nowrap' }}>Masse</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '600', width: '20%', whiteSpace: 'nowrap' }}>Bras</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '600', width: '20%', whiteSpace: 'nowrap' }}>Moment</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: index === data.items.length - 1 ? `1px solid ${colorTheme[400]}` : 'none' }}>
                    <td style={{ padding: '3px 2px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.label}>{item.label}</td>
                    <td style={{ padding: '3px 2px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>{parseFloat(item.value || 0).toFixed(1)} kg</td>
                    <td style={{ padding: '3px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {item.arm !== null && item.arm !== undefined ? `${parseFloat(item.arm).toFixed(2)} m` : 'N/A'}
                    </td>
                    <td style={{ padding: '3px 2px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {item.moment !== null && item.moment !== undefined ? `${parseFloat(item.moment).toFixed(1)}` : 'N/A'}
                    </td>
                  </tr>
                ))}
                {/* Ligne de total */}
                <tr style={{ fontWeight: '700', backgroundColor: colorTheme[100] }}>
                  <td style={{ padding: '4px 2px', textAlign: 'left', whiteSpace: 'nowrap' }}>TOTAL</td>
                  <td style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>{parseFloat(data.w || 0).toFixed(1)} kg</td>
                  <td style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>-</td>
                  <td style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {data.items.reduce((sum, item) => sum + parseFloat(item.moment || 0), 0).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: '6px', fontSize: '9px', fontStyle: 'italic' }}>
              CG = {data.items.reduce((sum, item) => sum + parseFloat(item.moment || 0), 0).toFixed(1)} ÷ {parseFloat(data.w || 0).toFixed(1)} = <strong>{parseFloat(data.cg || 0).toFixed(3)} m</strong>
            </p>

            {/* Alerte MZFW dépassé */}
            {data.isExceeded && data.maxZfm && (
              <div style={{
                marginTop: '8px',
                padding: '6px 8px',
                backgroundColor: '#fee2e2',
                borderLeft: '3px solid #dc2626',
                borderRadius: '4px',
                fontSize: '10px',
                color: '#991b1b'
              }}>
                <strong>⚠️ MZFW DÉPASSÉ</strong>
                <br />
                Masse sans carburant : {parseFloat(data.w || 0).toFixed(1)} kg
                <br />
                Limite MZFW : {parseFloat(data.maxZfm || 0).toFixed(1)} kg
                <br />
                <span style={{ fontSize: '9px', fontStyle: 'italic' }}>
                  Surcharge : +{(parseFloat(data.w || 0) - parseFloat(data.maxZfm || 0)).toFixed(1)} kg
                </span>
              </div>
            )}
          </div>
        )}
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