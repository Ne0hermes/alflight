// src/features/aircraft/components/CGEnvelopeChart.jsx
import React, { memo } from 'react';

const CGEnvelopeChart = memo(({ cgEnvelope, massUnit = 'kg' }) => {
  // Points avant (format liste de points)
  const forwardPoints = (cgEnvelope?.forwardPoints || [])
    .map(p => ({
      weight: parseFloat(p.weight) || 0,
      cg: parseFloat(p.cg) || 0
    }))
    .filter(p => p.weight > 0 && p.cg > 0);

  // Points arrière
  const aftMinWeight = parseFloat(cgEnvelope?.aftMinWeight) || 0;
  const aftCG = parseFloat(cgEnvelope?.aftCG) || 0;
  const aftMaxWeight = parseFloat(cgEnvelope?.aftMaxWeight) || 0;

  // Calculer les échelles pour le graphique
  const forwardWeights = forwardPoints.map(p => p.weight);
  const forwardCGs = forwardPoints.map(p => p.cg);
  const aftWeights = [aftMinWeight, aftMaxWeight].filter(w => w > 0);
  const aftCGs = [aftCG].filter(cg => cg > 0);

  const allWeights = [...forwardWeights, ...aftWeights];
  const allCGs = [...forwardCGs, ...aftCGs];
  
  const minWeight = allWeights.length > 0 ? Math.min(...allWeights) - 50 : 900;
  const maxWeight = allWeights.length > 0 ? Math.max(...allWeights) + 50 : 1400;
  const minCG = allCGs.length > 0 ? Math.min(...allCGs) - 0.1 : 2.0;
  const maxCG = allCGs.length > 0 ? Math.max(...allCGs) + 0.1 : 2.8;

  const toSvgX = (cg) => 50 + (cg - minCG) / (maxCG - minCG) * 400;
  const toSvgY = (weight) => 250 - (weight - minWeight) / (maxWeight - minWeight) * 200;

  // Créer les points de l'enveloppe (sens horaire)
  const envelopePoints = [];

  // 1. Points Forward (triés par masse croissante pour former le côté gauche)
  const sortedForwardPoints = [...forwardPoints].sort((a, b) => a.weight - b.weight);
  sortedForwardPoints.forEach((point, index) => {
    envelopePoints.push({
      w: point.weight,
      cg: point.cg,
      label: `Fwd ${index + 1}`,
      isForward: true
    });
  });

  // 2. Point Aft Max (haut droit)
  if (aftMaxWeight > 0 && aftCG > 0) {
    envelopePoints.push({ w: aftMaxWeight, cg: aftCG, label: 'Aft Max' });
  }

  // 3. Point Aft Min (bas droit)
  if (aftMinWeight > 0 && aftCG > 0 && aftMinWeight !== aftMaxWeight) {
    envelopePoints.push({ w: aftMinWeight, cg: aftCG, label: 'Aft Min' });
  }

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      padding: '16px',
      borderRadius: '8px',
      marginTop: '16px',
      border: '1px solid #e2e8f0',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '16px',
        width: '100%',
        overflow: 'hidden'
      }}>
        <svg 
          viewBox="0 0 500 300" 
          style={{
          width: '100%',
          maxWidth: '500px',
          height: 'auto', 
          border: '1px solid #cbd5e1', 
          borderRadius: '4px', 
          backgroundColor: 'white',
          display: 'block',
          margin: '0 auto'
        }}>
          {/* Grille */}
          <defs>
            <pattern id="cgGrid" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="500" height="300" fill="url(#cgGrid)" />
          
          {/* Axes */}
          <line x1="50" y1="250" x2="450" y2="250" stroke="#374151" strokeWidth="2" />
          <line x1="50" y1="50" x2="50" y2="250" stroke="#374151" strokeWidth="2" />
          
          {/* Labels des axes */}
          <text x="250" y="280" textAnchor="middle" fontSize="12" fill="#374151">
            Centre de Gravité (m)
          </text>
          <text x="20" y="150" textAnchor="middle" fontSize="12" fill="#374151" transform="rotate(-90 20 150)">
            Masse ({massUnit})
          </text>
          
          {/* Graduations X (CG) */}
          {(() => {
            const ticks = [];
            for (let i = 0; i <= 4; i++) {
              const cgValue = minCG + (maxCG - minCG) * (i / 4);
              const x = 50 + (400 * i) / 4;
              ticks.push(
                <g key={`x-${i}`}>
                  <line x1={x} y1="250" x2={x} y2="255" stroke="#374151" strokeWidth="1" />
                  <text x={x} y="270" textAnchor="middle" fontSize="10" fill="#374151">
                    {cgValue.toFixed(2)}
                  </text>
                </g>
              );
            }
            return ticks;
          })()}
          
          {/* Graduations Y (Masse) */}
          {(() => {
            const ticks = [];
            for (let i = 0; i <= 4; i++) {
              const weightValue = minWeight + (maxWeight - minWeight) * (i / 4);
              const y = 250 - (200 * i) / 4;
              ticks.push(
                <g key={`y-${i}`}>
                  <line x1="45" y1={y} x2="50" y2={y} stroke="#374151" strokeWidth="1" />
                  <text x="40" y={y + 3} textAnchor="end" fontSize="10" fill="#374151">
                    {Math.round(weightValue)}
                  </text>
                </g>
              );
            }
            return ticks;
          })()}
          
          {/* Enveloppe */}
          {envelopePoints.length >= 3 && (
            <polygon 
              points={envelopePoints.map(p => `${toSvgX(p.cg)},${toSvgY(p.w)}`).join(' ')}
              fill="rgba(34, 197, 94, 0.2)" 
              stroke="#22c55e" 
              strokeWidth="2"
            />
          )}
          
          {/* Points de l'enveloppe */}
          {envelopePoints.map((point, index) => (
            <g key={index}>
              <circle
                cx={toSvgX(point.cg)}
                cy={toSvgY(point.w)}
                r="4"
                fill={point.isForward ? "#22c55e" : "#dc2626"}
                stroke="white"
                strokeWidth="2"
              />
              <text
                x={toSvgX(point.cg)}
                y={toSvgY(point.w) - 10}
                textAnchor="middle"
                fontSize="9"
                fill="#374151"
                fontWeight="bold"
              >
                {point.label}
              </text>
              <text
                x={toSvgX(point.cg)}
                y={toSvgY(point.w) + 20}
                textAnchor="middle"
                fontSize="8"
                fill="#6b7280"
              >
                {point.w}{massUnit} / {point.cg}m
              </text>
            </g>
          ))}
          
          {/* Message si pas assez de données */}
          {envelopePoints.length < 3 && (
            <text x="250" y="150" textAnchor="middle" fontSize="14" fill="#9ca3af">
              Saisissez au moins 3 points pour visualiser l'enveloppe
            </text>
          )}
        </svg>
      </div>
    </div>

});

CGEnvelopeChart.displayName = 'CGEnvelopeChart';

export default CGEnvelopeChart;