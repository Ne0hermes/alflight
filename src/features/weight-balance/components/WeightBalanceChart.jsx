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

  // Utiliser UNIQUEMENT les données de l'onglet "Gestion des avions" (cgEnvelope)
  const cgEnvelope = aircraft.cgEnvelope;
  
  // Debug: afficher ce que contient l'aircraft
  console.log('🛩️ Aircraft reçu dans WeightBalanceChart:', aircraft);
  console.log('📊 cgEnvelope disponible:', cgEnvelope);
  if (cgEnvelope) {
    console.log('   - forwardPoints:', cgEnvelope.forwardPoints);
    console.log('   - aftCG:', cgEnvelope.aftCG);
    console.log('   - aftMinWeight:', cgEnvelope.aftMinWeight);
    console.log('   - aftMaxWeight:', cgEnvelope.aftMaxWeight);
  }
  
  // Vérifier si les données cgEnvelope sont complètes
  const hasCgEnvelopeData = cgEnvelope && 
    cgEnvelope.forwardPoints && 
    cgEnvelope.forwardPoints.length > 0 &&
    cgEnvelope.aftCG;

  // Afficher une erreur si les données manquent
  if (!hasCgEnvelopeData) {
    return (
      <div style={sx.spacing.mt(8)}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
          📈 Enveloppe de centrage
        </h3>
        
        <div style={sx.combine(
          sx.components.alert.base,
          sx.components.alert.danger,
          sx.spacing.mb(4)
        )}>
          <p style={sx.combine(sx.text.lg, sx.text.bold)}>
            ❌ Données d'enveloppe de centrage manquantes
          </p>
          <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
            Veuillez configurer l'enveloppe de centrage dans l'onglet <strong>"Gestion des avions"</strong> → 
            Section <strong>"CENTER OF GRAVITY - Enveloppe de centrage"</strong>
          </p>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            <li>Ajoutez au moins un point CG avant (Most Forward CG)</li>
            <li>Définissez les limites CG arrière (Most Rearward CG)</li>
          </ul>
        </div>
      </div>
    );
  }
  
  // Calcul des échelles avec les données cgEnvelope
  const scales = useMemo(() => {
    const forwardCGs = cgEnvelope.forwardPoints.map(p => p.cg);
    const aftCG = cgEnvelope.aftCG;
    
    const cgMin = Math.min(...forwardCGs, aftCG);
    const cgMax = Math.max(...forwardCGs, aftCG);
    const cgRange = cgMax - cgMin;
    
    return {
      cgMin: (cgMin - cgRange * 0.1) * 1000,
      cgMax: (cgMax + cgRange * 0.1) * 1000,
      weightMin: aircraft.minTakeoffWeight - 50,
      weightMax: aircraft.maxTakeoffWeight + 50
    };
  }, [aircraft, cgEnvelope]);

  const toSvgX = (cg) => {
    const cgValue = isNaN(cg) ? 0 : cg;
    return 50 + (cgValue * 1000 - scales.cgMin) / (scales.cgMax - scales.cgMin) * 500;
  };
  const toSvgY = (w) => {
    const weightValue = isNaN(w) ? 0 : w;
    return 350 - (weightValue - scales.weightMin) / (scales.weightMax - scales.weightMin) * 300;
  };

  // Fonction pour vérifier si un point est dans l'enveloppe (utilise cgEnvelope uniquement)
  const isPointWithinEnvelope = (weight, cg) => {
    // Le CG est déjà en mètres, pas besoin de conversion
    const cgInMeters = cg;
    
    console.log(`🔍 Vérification point: ${weight}kg / ${(cg * 1000).toFixed(0)}mm (${cgInMeters.toFixed(4)}m)`);
    
    // Vérifier les limites de poids MTOW
    if (weight < aircraft.minTakeoffWeight || weight > aircraft.maxTakeoffWeight) {
      console.log(`❌ Poids hors MTOW: ${weight}kg (min: ${aircraft.minTakeoffWeight}kg, max: ${aircraft.maxTakeoffWeight}kg)`);
      return false;
    }
    
    // Vérifier la limite arrière (cgEnvelope.aftCG)
    const aftCG = parseFloat(cgEnvelope.aftCG);
    if (!isNaN(aftCG) && cgInMeters > aftCG) {
      console.log(`❌ CG trop arrière: ${cgInMeters.toFixed(4)}m > ${aftCG}m`);
      return false;
    }
    
    // Vérifier les limites avant avec les points dynamiques (convertir en nombres)
    const sortedForwardPoints = [...cgEnvelope.forwardPoints]
      .filter(p => p.weight && p.cg && !isNaN(parseFloat(p.weight)) && !isNaN(parseFloat(p.cg)))
      .map(p => ({ weight: parseFloat(p.weight), cg: parseFloat(p.cg) }))
      .sort((a, b) => a.weight - b.weight);
    
    console.log(`📊 Points avant disponibles:`, sortedForwardPoints);
    
    if (sortedForwardPoints.length === 0) {
      console.log(`❌ Aucun point avant valide`);
      return false;
    }
    
    // Vérifier les limites de poids de l'enveloppe CG
    const minEnvelopeWeight = sortedForwardPoints[0].weight;
    const maxEnvelopeWeight = Math.max(
      sortedForwardPoints[sortedForwardPoints.length - 1].weight,
      parseFloat(cgEnvelope.aftMaxWeight) || 0
    );
    
    if (weight < minEnvelopeWeight || weight > maxEnvelopeWeight) {
      console.log(`❌ Poids hors enveloppe CG: ${weight}kg (enveloppe: ${minEnvelopeWeight}kg - ${maxEnvelopeWeight}kg)`);
      return false;
    }
    
    // Si le poids est inférieur ou égal au premier point, utiliser le CG du premier point
    if (weight <= sortedForwardPoints[0].weight) {
      const result = cgInMeters >= sortedForwardPoints[0].cg;
      console.log(`✅ Poids <= premier point (${sortedForwardPoints[0].weight}kg): CG ${cgInMeters.toFixed(4)}m >= ${sortedForwardPoints[0].cg}m ? ${result}`);
      return result;
    }
    
    // Si le poids est supérieur ou égal au dernier point, utiliser le CG du dernier point
    if (weight >= sortedForwardPoints[sortedForwardPoints.length - 1].weight) {
      const result = cgInMeters >= sortedForwardPoints[sortedForwardPoints.length - 1].cg;
      console.log(`✅ Poids >= dernier point (${sortedForwardPoints[sortedForwardPoints.length - 1].weight}kg): CG ${cgInMeters.toFixed(4)}m >= ${sortedForwardPoints[sortedForwardPoints.length - 1].cg}m ? ${result}`);
      return result;
    }
    
    // Interpolation linéaire entre deux points
    for (let i = 0; i < sortedForwardPoints.length - 1; i++) {
      if (weight >= sortedForwardPoints[i].weight && weight <= sortedForwardPoints[i + 1].weight) {
        const ratio = (weight - sortedForwardPoints[i].weight) / (sortedForwardPoints[i + 1].weight - sortedForwardPoints[i].weight);
        const interpolatedCg = sortedForwardPoints[i].cg + ratio * (sortedForwardPoints[i + 1].cg - sortedForwardPoints[i].cg);
        const result = cgInMeters >= interpolatedCg;
        console.log(`✅ Interpolation entre ${sortedForwardPoints[i].weight}kg et ${sortedForwardPoints[i + 1].weight}kg: CG requis ${interpolatedCg.toFixed(4)}m, actuel ${cgInMeters.toFixed(4)}m ? ${result}`);
        return result;
      }
    }
    
    console.log(`⚠️ Cas non géré, retour true par défaut`);
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

  // Création des points de l'enveloppe avec cgEnvelope
  const envelopeData = useMemo(() => {
    const sortedForwardPoints = [...cgEnvelope.forwardPoints]
      .filter(p => p.weight && p.cg && !isNaN(parseFloat(p.weight)) && !isNaN(parseFloat(p.cg)))
      .map(p => ({ weight: parseFloat(p.weight), cg: parseFloat(p.cg) }))
      .sort((a, b) => a.weight - b.weight);
    
    const points = [];
    
    // Ajouter tous les points avant
    sortedForwardPoints.forEach((p, i) => {
      points.push({ 
        w: p.weight, 
        cg: p.cg, 
        label: `Forward ${i + 1}` 
      });
    });
    
    // Ajouter les points arrière
    const aftMaxWeight = parseFloat(cgEnvelope.aftMaxWeight);
    const aftMinWeight = parseFloat(cgEnvelope.aftMinWeight);
    const aftCG = parseFloat(cgEnvelope.aftCG);
    
    if (!isNaN(aftMaxWeight) && aftMaxWeight > 0 && !isNaN(aftCG)) {
      points.push({ w: aftMaxWeight, cg: aftCG, label: 'Aft Max' });
    };
    if (!isNaN(aftMinWeight) && aftMinWeight > 0 && !isNaN(aftCG) && aftMinWeight !== aftMaxWeight) {
      points.push({ w: aftMinWeight, cg: aftCG, label: 'Aft Min' });
    }
    
    return points;
  }, [aircraft, cgEnvelope]);

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
          {(() => {
            // Calculer toutes les positions d'abord pour détecter les chevauchements
            const labelPositions = {};
            
            scenarioConfig.forEach(({ key }) => {
              const scenario = scenarios[key];
              if (!scenario || isNaN(scenario.cg) || isNaN(scenario.w)) return;
              
              const x = toSvgX(scenario.cg);
              const y = toSvgY(scenario.w);
              labelPositions[key] = { x, y };
            });
            
            return scenarioConfig.map(({ key, label, color }, index) => {
              const scenario = scenarios[key];
              if (!scenario || isNaN(scenario.cg) || isNaN(scenario.w)) {
                return null;
              }
              
              const x = toSvgX(scenario.cg);
              const y = toSvgY(scenario.w);
              
              // Vérifier si ce point est dans les limites
              const isInLimits = isPointWithinEnvelope(scenario.w, scenario.cg);
              
              // Position du label avec déport intelligent pour éviter le chevauchement
              const labelOffset = 90;
              let labelX, labelY;
            
            // Positionnement spécifique pour chaque scénario
            switch(key) {
              case 'fulltank':
                // En haut à gauche ou droite selon position
                labelX = x > 300 ? x + labelOffset : x - labelOffset;
                labelY = y - 45;
                break;
              case 'toCrm':
                // En haut à l'opposé de fulltank
                labelX = x > 300 ? x + labelOffset + 10 : x - labelOffset - 10;
                labelY = y - 45;
                // Si proche de fulltank, décaler verticalement
                if (scenarios.fulltank && Math.abs(y - toSvgY(scenarios.fulltank.w)) < 40) {
                  labelY = y - 70;
                }
                break;
              case 'landing':
                // En bas, mais avec décalage horizontal pour éviter ZFW
                labelX = x - labelOffset - 20; // Toujours à gauche
                labelY = y + 45;
                // Si très proche verticalement de ZFW, décaler encore plus
                if (scenarios.zfw && Math.abs(x - toSvgX(scenarios.zfw.cg)) < 50) {
                  labelX = x - labelOffset - 40;
                }
                break;
              case 'zfw':
                // En bas, mais à droite pour éviter landing
                labelX = x + labelOffset + 20; // Toujours à droite
                labelY = y + 45;
                // Si très proche verticalement de landing, décaler encore plus
                if (scenarios.landing && Math.abs(x - toSvgX(scenarios.landing.cg)) < 50) {
                  labelX = x + labelOffset + 40;
                }
                break;
              default:
                labelX = x + (x > 300 ? labelOffset : -labelOffset);
                labelY = y + (index % 2 === 0 ? -45 : 45);
            }
            
            // Ajuster si proche des bords
            if (labelX < 60) labelX = 60;
            if (labelX > 540) labelX = 540;
            if (labelY < 30) labelY = 30;
            if (labelY > 340) labelY = 340;
            
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
                    x="-45" 
                    y="-12" 
                    width="90" 
                    height={isInLimits ? "24" : "32"} 
                    fill="white" 
                    fillOpacity="0.95" 
                    stroke={isInLimits ? color : '#ef4444'} 
                    strokeWidth={isInLimits ? "1" : "2"} 
                    rx="3"
                  />
                  <text textAnchor="middle" fontSize="8" fill={isInLimits ? color : '#ef4444'} fontWeight="600">
                    <tspan x="0" y="-2">{label}</tspan>
                    <tspan x="0" y="9" fontSize="7" fontWeight="400">
                      {scenario.w.toFixed(0)}kg / {(scenario.cg * 1000).toFixed(0)}mm
                    </tspan>
                  </text>
                  {!isInLimits && (
                    <text x="0" y="19" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="600">
                      ⚠️ HORS LIMITES
                    </text>
                  )}
                </g>
              </g>
            );
          });
        })()}
          
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