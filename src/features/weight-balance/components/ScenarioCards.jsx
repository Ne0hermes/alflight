// src/features/weight-balance/components/ScenarioCards.jsx
// ========================================
import React, { memo, useMemo } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const ScenarioCards = memo(({ scenarios, fobFuel, fuelData }) => {
  const cards = useMemo(() => {
    if (!scenarios) return [];
    
    return [
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
    ];
  }, [scenarios, fobFuel]);
  
  if (!scenarios) {
    return null;
  }
  
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
        <p style={sx.spacing.mb(1)}>Masse: <strong>{!isNaN(data.w) ? data.w.toFixed(0) : '0'} kg</strong></p>
        <p style={sx.spacing.mb(1)}>CG: <strong>{!isNaN(data.cg) ? data.cg.toFixed(2) : '0.00'} m</strong></p>
        <p>Carburant: <strong>{!isNaN(data.fuel) ? data.fuel.toFixed(0) : '0'} kg</strong> {description}</p>
      </div>
    </div>
  );
});

// Info CRM
const CRMInfo = memo(({ fobFuel }) => {
  const fobLiter = fobFuel?.ltr || 0;
  
  if (fobLiter > 0) {
    const crmKg = fobLiter * 0.84;
    
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.success, sx.spacing.mb(4))}>
        <div style={sx.text['2xl']}>✅</div>
        <div>
          <p style={sx.combine(sx.text.base, sx.text.bold)}>
            CRM défini : {crmKg.toFixed(0)} kg
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
            ({fobLiter.toFixed(1)} L)
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

// ========================================
// src/features/weight-balance/components/WeightBalanceChart.jsx
// ========================================
import React, { memo, useMemo } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const WeightBalanceChart = memo(({ aircraft, scenarios, calculations }) => {
  if (!aircraft || !scenarios || !calculations) {
    return (
      <div style={sx.combine(sx.flex.center, sx.spacing.p(8), sx.bg.gray)}>
        <p style={sx.text.secondary}>Sélectionnez un avion pour afficher le graphique</p>
      </div>
    );
  }

  const wb = aircraft.weightBalance;
  
  // Calcul des échelles
  const scales = useMemo(() => {
    let cgMin = wb.cgLimits.forward;
    let cgMax = wb.cgLimits.aft;
    
    wb.cgLimits.forwardVariable?.forEach(p => {
      cgMin = Math.min(cgMin, p.cg);
      cgMax = Math.max(cgMax, p.cg);
    });
    
    const cgRange = cgMax - cgMin;
    
    return {
      cgMin: (cgMin - cgRange * 0.1) * 1000,
      cgMax: (cgMax + cgRange * 0.1) * 1000,
      weightMin: aircraft.minTakeoffWeight - 50,
      weightMax: aircraft.maxTakeoffWeight + 50
    };
  }, [aircraft, wb]);

  const toSvgX = (cg) => {
    const cgValue = isNaN(cg) ? 0 : cg;
    return 50 + (cgValue * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500;
  };
  const toSvgY = (w) => {
    const weightValue = isNaN(w) ? 0 : w;
    return 350 - (weightValue - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300;
  };

  // Fonction pour vérifier si un point est dans l'enveloppe
  const isPointWithinEnvelope = (weight, cg) => {
    // Vérifier les limites de poids
    if (weight < aircraft.minTakeoffWeight || weight > aircraft.maxTakeoffWeight) {
      return false;
    }
    
    // Vérifier les limites arrière
    if (cg > wb.cgLimits.aft) {
      return false;
    }
    
    // Vérifier les limites avant
    const hasVariableLimits = wb.cgLimits.forwardVariable?.length > 0;
    
    if (!hasVariableLimits) {
      // Limite avant fixe
      return cg >= wb.cgLimits.forward;
    } else {
      // Limite avant variable selon le poids
      const sortedLimits = [...wb.cgLimits.forwardVariable].sort((a, b) => a.weight - b.weight);
      
      // Si le poids est inférieur au premier point, utiliser la limite forward standard
      if (weight <= sortedLimits[0].weight) {
        return cg >= wb.cgLimits.forward;
      }
      
      // Si le poids est supérieur au dernier point, utiliser la limite du dernier point
      if (weight >= sortedLimits[sortedLimits.length - 1].weight) {
        return cg >= sortedLimits[sortedLimits.length - 1].cg;
      }
      
      // Interpolation linéaire entre deux points
      for (let i = 0; i < sortedLimits.length - 1; i++) {
        if (weight >= sortedLimits[i].weight && weight <= sortedLimits[i + 1].weight) {
          const ratio = (weight - sortedLimits[i].weight) / (sortedLimits[i + 1].weight - sortedLimits[i].weight);
          const interpolatedCg = sortedLimits[i].cg + ratio * (sortedLimits[i + 1].cg - sortedLimits[i].cg);
          return cg >= interpolatedCg;
        }
      }
    }
    
    return true;
  };

  // Vérifier que TOUS les scénarios sont dans les limites
  const allScenariosWithinLimits = useMemo(() => {
    if (!scenarios) return false;
    
    const scenariosToCheck = ['fulltank', 'toCrm', 'landing', 'zfw'];
    return scenariosToCheck.every(key => {
      const scenario = scenarios[key];
      if (!scenario || isNaN(scenario.w) || isNaN(scenario.cg)) return false;
      return isPointWithinEnvelope(scenario.w, scenario.cg);
    });
  }, [scenarios]);

  // Création des points de l'enveloppe avec leurs valeurs
  const envelopeData = useMemo(() => {
    const hasVar = wb.cgLimits.forwardVariable?.length > 0;
    
    if (!hasVar) {
      return [
        { w: aircraft.minTakeoffWeight, cg: wb.cgLimits.forward, label: 'Min T/O - Avant' },
        { w: aircraft.maxTakeoffWeight, cg: wb.cgLimits.forward, label: 'Max T/O - Avant' },
        { w: aircraft.maxTakeoffWeight, cg: wb.cgLimits.aft, label: 'Max T/O - Arrière' },
        { w: aircraft.minTakeoffWeight, cg: wb.cgLimits.aft, label: 'Min T/O - Arrière' }
      ];
    }
    
    const fwdPts = [...wb.cgLimits.forwardVariable].sort((a, b) => a.weight - b.weight);
    
    return [
      ...fwdPts.map((p, i) => ({ 
        w: p.weight, 
        cg: p.cg, 
        label: `Limite avant ${i + 1}` 
      })),
      { w: aircraft.maxTakeoffWeight, cg: wb.cgLimits.aft, label: 'Max T/O - Arrière' },
      { w: aircraft.minTakeoffWeight, cg: wb.cgLimits.aft, label: 'Min T/O - Arrière' }
    ];
  }, [aircraft, wb]);

  const createEnvelopePoints = () => {
    return envelopeData.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ');
  };

  // Configuration des scénarios avec les nouveaux libellés
  const scenarioConfig = [
    { key: 'fulltank', label: 'Réservoirs pleins', color: '#3b82f6' },
    { key: 'toCrm', label: 'Masse au décollage (CRM)', color: '#10b981' },
    { key: 'landing', label: 'Masse à l\'atterrissage', color: '#f59e0b' },
    { key: 'zfw', label: 'Masse sans carburant (ZFW)', color: '#ef4444' }
  ];

  // Créer le chemin reliant les points
  const createScenarioPath = () => {
    const points = ['fulltank', 'toCrm', 'landing', 'zfw']
      .map(key => scenarios[key])
      .filter(s => s && !isNaN(s.cg) && !isNaN(s.w))
      .map(s => `${toSvgX(s.cg)},${toSvgY(s.w)}`);
    return points.length > 1 ? `M ${points.join(' L ')}` : '';
  };

  return (
    <div style={sx.spacing.mt(8)}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        📈 Enveloppe de centrage
      </h3>
      
      <div style={sx.combine(
        sx.components.alert.base,
        allScenariosWithinLimits ? sx.components.alert.success : sx.components.alert.danger,
        sx.spacing.mb(4)
      )}>
        <p style={sx.combine(sx.text.lg, sx.text.bold)}>
          {allScenariosWithinLimits ? '✅ Tous les scénarios dans les limites' : '❌ Un ou plusieurs scénarios hors limites'}
        </p>
        {!allScenariosWithinLimits && (
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
            Vérifiez les points signalés en rouge sur le graphique
          </p>
        )}
      </div>
      
      <div style={sx.combine(sx.components.card.base)}>
        <svg viewBox="0 0 600 480" style={{ width: '100%', maxWidth: '800px', height: 'auto', margin: '0 auto', display: 'block' }}>
          {/* Grille */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="600" height="480" fill="url(#grid)" />
          
          {/* Lignes de grille secondaires correspondant aux graduations */}
          {(() => {
            const gridLines = [];
            // Lignes verticales
            for (let i = 1; i < 6; i++) {
              const x = 50 + (500 * i) / 6;
              gridLines.push(
                <line key={`vgrid-${i}`} x1={x} y1="50" x2={x} y2="350" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" />
              );
            }
            // Lignes horizontales
            for (let i = 1; i < 6; i++) {
              const y = 350 - (300 * i) / 6;
              gridLines.push(
                <line key={`hgrid-${i}`} x1="50" y1={y} x2="550" y2={y} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" />
              );
            }
            return gridLines;
          })()}
          
          {/* Axes */}
          <line x1="50" y1="350" x2="550" y2="350" stroke="#374151" strokeWidth="2" />
          <line x1="50" y1="50" x2="50" y2="350" stroke="#374151" strokeWidth="2" />
          
          {/* Graduations et valeurs axe X (Centre de gravité) */}
          {(() => {
            const numTicksX = 6;
            const ticksX = [];
            for (let i = 0; i <= numTicksX; i++) {
              const cgValue = scales.cgMin + (scales.cgMax - scales.cgMin) * (i / numTicksX);
              const x = 50 + (500 * i) / numTicksX;
              ticksX.push(
                <g key={`x-tick-${i}`}>
                  <line x1={x} y1="350" x2={x} y2="355" stroke="#374151" strokeWidth="1" />
                  <text x={x} y="365" textAnchor="middle" fontSize="8" fill="#374151">
                    {Math.round(cgValue)}
                  </text>
                </g>
              );
            }
            return ticksX;
          })()}
          
          {/* Unité axe X */}
          <text x="520" y="365" textAnchor="middle" fontSize="8" fill="#6b7280" fontStyle="italic">(mm)</text>
          
          {/* Graduations et valeurs axe Y (Masse) */}
          {(() => {
            const numTicksY = 6;
            const ticksY = [];
            for (let i = 0; i <= numTicksY; i++) {
              const weightValue = scales.weightMin + (scales.weightMax - scales.weightMin) * (i / numTicksY);
              const y = 350 - (300 * i) / numTicksY;
              ticksY.push(
                <g key={`y-tick-${i}`}>
                  <line x1="45" y1={y} x2="50" y2={y} stroke="#374151" strokeWidth="1" />
                  <text x="40" y={y + 3} textAnchor="end" fontSize="8" fill="#374151">
                    {Math.round(weightValue)}
                  </text>
                </g>
              );
            }
            return ticksY;
          })()}
          
          {/* Unité axe Y */}
          <text x="40" y="60" textAnchor="end" fontSize="8" fill="#6b7280" fontStyle="italic">(kg)</text>
          
          {/* Labels axes (taille réduite) */}
          <text x="300" y="385" textAnchor="middle" fontSize="10" fill="#374151">Centre de Gravité (mm)</text>
          <text x="15" y="200" textAnchor="middle" fontSize="10" fill="#374151" transform="rotate(-90 15 200)">Masse (kg)</text>
          
          {/* Enveloppe */}
          <polygon points={createEnvelopePoints()} fill="#dbeafe" fillOpacity="0.5" stroke="#3b82f6" strokeWidth="2" />
          
          {/* Labels des limites de l'enveloppe */}
          {envelopeData.map((point, index) => {
            const x = toSvgX(point.cg);
            const y = toSvgY(point.w);
            
            // Ajuster la position pour éviter les débordements
            let xAdjust = x;
            let yAdjust = y - 5;
            
            // Si proche du bord gauche ou droit
            if (x < 100) xAdjust = x + 30;
            else if (x > 500) xAdjust = x - 30;
            
            // Si proche du bord haut ou bas
            if (y < 80) yAdjust = y + 15;
            else if (y > 320) yAdjust = y - 10;
            
            return (
              <g key={`env-${index}`}>
                <text 
                  x={xAdjust} 
                  y={yAdjust} 
                  fontSize="8" 
                  fill="#6b7280" 
                  textAnchor="middle"
                  fontStyle="italic"
                >
                  {point.w.toFixed(0)}kg / {(point.cg * 1000).toFixed(0)}mm
                </text>
              </g>
            );
          })}
          
          {/* Ligne reliant les scénarios */}
          {createScenarioPath() && (
            <path 
              d={createScenarioPath()} 
              fill="none" 
              stroke="#9ca3af" 
              strokeWidth="1.5" 
              strokeDasharray="5,5"
            />
          )}
          
          {/* Points des scénarios avec traits de déport */}
          {scenarioConfig.map(({ key, label, color }) => {
            const scenario = scenarios[key];
            if (!scenario || isNaN(scenario.cg) || isNaN(scenario.w)) {
              return null;
            }
            
            const x = toSvgX(scenario.cg);
            const y = toSvgY(scenario.w);
            
            // Vérifier si ce point est dans les limites
            const isInLimits = isPointWithinEnvelope(scenario.w, scenario.cg);
            
            // Position du label avec déport
            const labelOffset = 80;
            const labelX = x + (x > 300 ? labelOffset : -labelOffset);
            const labelY = y + (key === 'fulltank' || key === 'toCrm' ? -30 : 30);
            
            return (
              <g key={key}>
                {/* Trait de déport */}
                <line 
                  x1={x} 
                  y1={y} 
                  x2={labelX} 
                  y2={labelY} 
                  stroke={isInLimits ? color : '#ef4444'} 
                  strokeWidth="1" 
                  opacity="0.5"
                />
                
                {/* Cercle d'alerte si hors limites */}
                {!isInLimits && (
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="9" 
                    fill="none"
                    stroke="#ef4444" 
                    strokeWidth="2"
                    strokeDasharray="3,2"
                  >
                    <animate attributeName="r" values="9;12;9" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                
                {/* Point avec fond transparent */}
                <circle 
                  cx={x} 
                  cy={y} 
                  r="5" 
                  fill={isInLimits ? color : '#ef4444'} 
                  fillOpacity="0.8"
                  stroke={isInLimits ? color : '#ef4444'} 
                  strokeWidth="2" 
                />
                
                {/* Label avec valeurs */}
                <g transform={`translate(${labelX}, ${labelY})`}>
                  <rect 
                    x="-5" 
                    y="-10" 
                    width="110" 
                    height={isInLimits ? "25" : "35"} 
                    fill="white" 
                    fillOpacity="0.9" 
                    stroke={isInLimits ? color : '#ef4444'} 
                    strokeWidth={isInLimits ? "1" : "2"} 
                    rx="2"
                  />
                  <text fontSize="9" fill={isInLimits ? color : '#ef4444'} fontWeight="600">
                    <tspan x="0" y="0">{label}</tspan>
                    <tspan x="0" y="10" fontSize="8" fontWeight="400">
                      {scenario.w.toFixed(0)}kg / {(scenario.cg * 1000).toFixed(0)}mm
                    </tspan>
                  </text>
                  {!isInLimits && (
                    <text x="0" y="20" fontSize="7" fill="#ef4444" fontWeight="600">
                      ⚠️ HORS LIMITES
                    </text>
                  )}
                </g>
              </g>
            );
          })}
          
          {/* Titre (taille réduite) */}
          <text x="300" y="25" textAnchor="middle" fontSize="12" fontWeight="600" fill="#1f2937">
            Diagramme de Masse et Centrage
          </text>
          <text x="300" y="40" textAnchor="middle" fontSize="10" fill="#6b7280">
            {aircraft.registration} - {aircraft.model}
          </text>
          
          {/* Légende des scénarios */}
          <g transform="translate(60, 440)">
            <text fontSize="9" fill="#6b7280" fontWeight="600">Légende:</text>
            {scenarioConfig.map((config, index) => {
              const scenario = scenarios[config.key];
              const isInLimits = scenario && !isNaN(scenario.w) && !isNaN(scenario.cg) && isPointWithinEnvelope(scenario.w, scenario.cg);
              
              return (
                <g key={`legend-${config.key}`} transform={`translate(${80 + index * 120}, 0)`}>
                  <circle cx="0" cy="-3" r="3" fill={isInLimits ? config.color : '#ef4444'} />
                  <text x="8" y="0" fontSize="8" fill="#6b7280">{config.label}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
});

WeightBalanceChart.displayName = 'WeightBalanceChart';