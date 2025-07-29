// src/features/weight-balance/components/WeightBalanceChart.jsx
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
      weightMin: aircraft.emptyWeight - 50,
      weightMax: aircraft.maxTakeoffWeight + 50
    };
  }, [aircraft, wb]);

  const toSvgX = (cg) => 50 + (cg * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500;
  const toSvgY = (w) => 350 - (w - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300;

  const createEnvelopePoints = () => {
    const hasVar = wb.cgLimits.forwardVariable?.length > 0;
    
    if (!hasVar) {
      const pts = [
        { w: aircraft.minTakeoffWeight, cg: wb.cgLimits.forward },
        { w: aircraft.maxTakeoffWeight, cg: wb.cgLimits.forward },
        { w: aircraft.maxTakeoffWeight, cg: wb.cgLimits.aft },
        { w: aircraft.minTakeoffWeight, cg: wb.cgLimits.aft }
      ];
      return pts.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ');
    }
    
    const fwdPts = [...wb.cgLimits.forwardVariable].sort((a, b) => a.weight - b.weight);
    
    const envPts = [
      ...fwdPts.map(p => ({ w: p.weight, cg: p.cg })),
      { w: aircraft.maxTakeoffWeight, cg: wb.cgLimits.aft },
      { w: aircraft.minTakeoffWeight, cg: wb.cgLimits.aft }
    ];
    
    return envPts.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ');
  };

  const isWithinLimits = calculations.isWithinLimits;

  return (
    <div style={sx.spacing.mt(8)}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        📈 Enveloppe de centrage
      </h3>
      
      <div style={sx.combine(
        sx.components.alert.base,
        isWithinLimits ? sx.components.alert.success : sx.components.alert.danger,
        sx.spacing.mb(4)
      )}>
        <p style={sx.combine(sx.text.lg, sx.text.bold)}>
          {isWithinLimits ? '✅ Dans les limites' : '❌ Hors limites'}
        </p>
      </div>
      
      <div style={sx.combine(sx.components.card.base)}>
        <svg viewBox="0 0 600 400" style={{ width: '100%', maxWidth: '800px', height: 'auto', margin: '0 auto', display: 'block' }}>
          {/* Grille */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="600" height="400" fill="url(#grid)" />
          
          {/* Axes */}
          <line x1="50" y1="350" x2="550" y2="350" stroke="#374151" strokeWidth="2" />
          <line x1="50" y1="50" x2="50" y2="350" stroke="#374151" strokeWidth="2" />
          
          {/* Labels axes */}
          <text x="300" y="390" textAnchor="middle" fontSize="12" fill="#374151">Centre de Gravité (mm)</text>
          <text x="25" y="200" textAnchor="middle" fontSize="12" fill="#374151" transform="rotate(-90 25 200)">Masse (kg)</text>
          
          {/* Enveloppe */}
          <polygon points={createEnvelopePoints()} fill="#dbeafe" fillOpacity="0.5" stroke="#3b82f6" strokeWidth="2" />
          
          {/* Points des scénarios */}
          {Object.entries(scenarios).map(([key, scenario]) => {
            const colors = {
              fulltank: '#3b82f6',
              toCrm: '#10b981',
              landing: '#f59e0b',
              zfw: '#ef4444'
            };
            const labels = {
              fulltank: 'FULLTANK',
              toCrm: 'T/O CRM',
              landing: 'LANDING',
              zfw: 'ZFW'
            };
            
            const x = toSvgX(scenario.cg);
            const y = toSvgY(scenario.w);
            const color = colors[key];
            
            return (
              <g key={key}>
                <circle cx={x} cy={y} r="6" fill={color} stroke="white" strokeWidth="2" />
                <text x={x + 10} y={y - 10} fontSize="10" fill={color} fontWeight="600">
                  {labels[key]}
                </text>
              </g>
            );
          })}
          
          <text x="300" y="25" textAnchor="middle" fontSize="14" fontWeight="600" fill="#1f2937">
            Diagramme de Masse et Centrage
          </text>
          <text x="300" y="45" textAnchor="middle" fontSize="11" fill="#6b7280">
            {aircraft.registration} - {aircraft.model}
          </text>
        </svg>
      </div>
    </div>
  );
});

WeightBalanceChart.displayName = 'WeightBalanceChart';