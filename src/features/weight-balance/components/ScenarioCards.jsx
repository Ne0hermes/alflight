// src/features/weight-balance/components/ScenarioCards.jsx
import React, { memo, useMemo } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { getFuelDensity } from '@utils/fuelDensity';
import { SCENARIO_COLORS } from '../scenarioColors';

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

    const fuelDensity = getFuelDensity(aircraft.fuelType) ?? 0.84;

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
          Scénarios de centrage
        </h3>

        {/* Informations avion */}
        {aircraft && (
          <div style={{
            display: 'flex',
            gap: '16px',
            fontSize: 'var(--fs-caption)',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-overlay)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}>
            {aircraft.equipment && <span>Équipements SAR: {aircraft.equipment}</span>}
            {aircraft.cruiseSpeed && <span>Vitesse de croisière: {aircraft.cruiseSpeed} kt</span>}
          </div>
        )}
      </div>

      <div style={scenarioStyles.grid}>
        {cards.map(card => (
          <ScenarioCard key={card.key} colorKey={card.key} {...card} />
        ))}
      </div>
    </section>
  );
});

// Carte de scénario individuelle. La couleur du scénario (SCENARIO_COLORS,
// source unique partagée avec le graphe) ne sert qu'à DIFFÉRENCIER : pastille
// + bordure + titre. Les données du tableau restent en ivoire/gris lisibles
// (contraste) — fini le tableau entièrement coloré rouge/vert.
const ScenarioCard = memo(({ colorKey, title, data, description }) => {
  const color = SCENARIO_COLORS[colorKey] || 'var(--accent-primary)';

  const cardStyle = {
    backgroundColor: 'var(--bg-overlay)',
    border: `2px solid ${color}`,
    borderRadius: 'var(--radius-sm)',
    padding: '1rem'
  };

  const dotStyle = {
    width: '12px',
    height: '12px',
    backgroundColor: color,
    borderRadius: '50%',
    flexShrink: 0
  };

  const titleStyle = {
    fontSize: 'var(--fs-caption)',
    fontWeight: 700,
    marginBottom: '0.5rem',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: '0.5rem',
    color
  };

  // Vérification des données avant affichage
  if (!data || typeof data.w !== 'number' || typeof data.cg !== 'number' || typeof data.fuel !== 'number') {
    return (
      <div style={cardStyle}>
        <h5 style={titleStyle}>
          <div style={dotStyle}></div>
          {title}
        </h5>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
          <p>Données en cours de calcul…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h5 style={titleStyle}>
        <div style={dotStyle}></div>
        {title}
      </h5>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
        {/* Tableau détaillé des masses avec bras et moments */}
        {data.items && data.items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '0' }}>
            <table style={{ width: '100%', fontSize: 'var(--fs-caption)', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 2px', fontWeight: '600', width: '40%', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>Élément</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '600', width: '20%', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>Masse</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '600', width: '20%', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>Bras</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px', fontWeight: '600', width: '20%', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>Moment</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: index === data.items.length - 1 ? `1px solid ${color}` : 'none' }}>
                    <td style={{ padding: '3px 2px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }} title={item.label}>{item.label}</td>
                    <td style={{ padding: '3px 2px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{parseFloat(item.value || 0).toFixed(1)} kg</td>
                    <td style={{ padding: '3px 2px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {item.arm !== null && item.arm !== undefined ? `${parseFloat(item.arm).toFixed(2)} m` : 'N/A'}
                    </td>
                    <td style={{ padding: '3px 2px', textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {item.moment !== null && item.moment !== undefined ? `${parseFloat(item.moment).toFixed(1)}` : 'N/A'}
                    </td>
                  </tr>
                ))}
                {/* Ligne de total */}
                <tr style={{ fontWeight: '700', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                  <td style={{ padding: '4px 2px', textAlign: 'left', whiteSpace: 'nowrap' }}>TOTAL</td>
                  <td style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>{parseFloat(data.w || 0).toFixed(1)} kg</td>
                  <td style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>-</td>
                  <td style={{ padding: '4px 2px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {data.items.reduce((sum, item) => sum + parseFloat(item.moment || 0), 0).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: '6px', fontSize: 'var(--fs-caption)', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
              CG = {data.items.reduce((sum, item) => sum + parseFloat(item.moment || 0), 0).toFixed(1)} ÷ {parseFloat(data.w || 0).toFixed(1)} = <strong style={{ color: 'var(--text-primary)' }}>{parseFloat(data.cg || 0).toFixed(3)} m</strong>
            </p>

            {/* FIX H : dérivation du carburant restant à l'atterrissage (carte « atterrissage » uniquement) */}
            {data.fuelDerivation && (
              <p style={{ marginTop: '4px', fontSize: 'var(--fs-caption)', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                Carburant restant = FOB {parseFloat(data.fuelDerivation.fobL || 0).toFixed(1)} L − brûlé (roulage+trip) {parseFloat(data.fuelDerivation.burnedL || 0).toFixed(1)} L = <strong style={{ color: 'var(--text-primary)' }}>{parseFloat(data.fuelDerivation.remainingL || 0).toFixed(1)} L</strong> × {parseFloat(data.fuelDerivation.density || 0).toFixed(2)} = <strong style={{ color: 'var(--text-primary)' }}>{parseFloat(data.fuelDerivation.remainingKg || 0).toFixed(1)} kg</strong>
                <br />
                <span style={{ color: 'var(--text-tertiary)' }}>réserve / dégagement / contingence restent à bord à l'atterrissage</span>
              </p>
            )}

            {/* Alerte MZFW dépassé */}
            {data.isExceeded && data.maxZfm && (
              <div style={{
                marginTop: '8px',
                padding: '6px 8px',
                backgroundColor: 'var(--bg-surface)',
                borderLeft: '3px solid var(--color-red-critical)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--fs-caption)',
                color: 'var(--color-red-critical)'
              }}>
                <strong>MZFW DÉPASSÉ</strong>
                <br />
                Masse sans carburant : {parseFloat(data.w || 0).toFixed(1)} kg
                <br />
                Limite MZFW : {parseFloat(data.maxZfm || 0).toFixed(1)} kg
                <br />
                <span style={{ fontSize: 'var(--fs-caption)', fontStyle: 'italic' }}>
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