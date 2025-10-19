import React, { useState, useCallback, useMemo } from 'react';
import { GraphConfig, Curve, XYPoint } from '../core/types';

interface ChainCalculatorProps {
  graphs: GraphConfig[];
}

interface ChainStep {
  graphId: string;
  graphName: string;
  inputValue: number;
  outputValue: number | null;
  curveUsed?: string;
}

export const ChainCalculator: React.FC<ChainCalculatorProps> = ({ graphs }) => {
  const [selectedChain, setSelectedChain] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState<number>(0);
  const [chainResults, setChainResults] = useState<ChainStep[]>([]);

  // Trouver toutes les chaînes possibles
  const availableChains = useMemo(() => {
    const chains: string[][] = [];

    // Trouver les graphiques d'entrée (sans linkedFrom)
    const inputGraphs = graphs.filter(g => !g.linkedFrom || g.linkedFrom.length === 0);

    // Pour chaque graphique d'entrée, suivre la chaîne
    inputGraphs.forEach(inputGraph => {
      const buildChain = (currentId: string, currentChain: string[]): void => {
        const current = graphs.find(g => g.id === currentId);
        if (!current) return;

        const newChain = [...currentChain, currentId];

        if (!current.linkedTo || current.linkedTo.length === 0) {
          // Fin de la chaîne
          chains.push(newChain);
        } else {
          // Continuer la chaîne
          current.linkedTo.forEach(nextId => {
            buildChain(nextId, newChain);
          });
        }
      };

      buildChain(inputGraph.id, []);
    });

    return chains;
  }, [graphs]);

  // Interpoler une valeur sur une courbe
  const interpolateValue = (curve: Curve, xValue: number): number | null => {
    if (!curve.fitted?.points || curve.fitted.points.length < 2) {
      // Utiliser les points originaux si pas d'interpolation
      const points = curve.points;
      if (points.length < 2) return null;

      // Interpolation linéaire simple
      for (let i = 0; i < points.length - 1; i++) {
        if (xValue >= points[i].x && xValue <= points[i + 1].x) {
          const x1 = points[i].x;
          const y1 = points[i].y;
          const x2 = points[i + 1].x;
          const y2 = points[i + 1].y;

          const ratio = (xValue - x1) / (x2 - x1);
          return y1 + ratio * (y2 - y1);
        }
      }

      // Extrapolation si en dehors des limites
      if (xValue < points[0].x) return points[0].y;
      if (xValue > points[points.length - 1].x) return points[points.length - 1].y;
    }

    const points = curve.fitted.points;

    // Trouver les deux points encadrants
    for (let i = 0; i < points.length - 1; i++) {
      if (xValue >= points[i].x && xValue <= points[i + 1].x) {
        const x1 = points[i].x;
        const y1 = points[i].y;
        const x2 = points[i + 1].x;
        const y2 = points[i + 1].y;

        const ratio = (xValue - x1) / (x2 - x1);
        return y1 + ratio * (y2 - y1);
      }
    }

    // Extrapolation si en dehors des limites
    if (xValue < points[0].x) return points[0].y;
    if (xValue > points[points.length - 1].x) return points[points.length - 1].y;

    return null;
  };

  // Calculer les valeurs à travers la chaîne
  const calculateChain = useCallback(() => {
    if (selectedChain.length === 0) return;

    const results: ChainStep[] = [];
    let currentValue = inputValue;

    for (let i = 0; i < selectedChain.length; i++) {
      const graphId = selectedChain[i];
      const graph = graphs.find(g => g.id === graphId);

      if (!graph) continue;

      // Trouver la meilleure courbe pour cette valeur d'entrée
      let bestCurve: Curve | null = null;
      let bestOutput: number | null = null;

      for (const curve of graph.curves) {
        const output = interpolateValue(curve, currentValue);
        if (output !== null) {
          bestCurve = curve;
          bestOutput = output;
          break; // Utiliser la première courbe valide
        }
      }

      results.push({
        graphId,
        graphName: graph.name,
        inputValue: currentValue,
        outputValue: bestOutput,
        curveUsed: bestCurve?.name
      });

      if (bestOutput === null) break; // Arrêter si pas de valeur trouvée
      currentValue = bestOutput; // La sortie devient l'entrée du prochain
    }

    setChainResults(results);
  }, [selectedChain, inputValue, graphs]);

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ marginBottom: '16px' }}>Calculateur de chaîne d'abaques</h3>

      {availableChains.length === 0 ? (
        <div style={{
          padding: '20px',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#f57c00' }}>
            Aucune chaîne d'abaques configurée.
            <br />
            Liez des graphiques dans l'étape 1 pour créer des chaînes.
          </p>
        </div>
      ) : (
        <>
          {/* Sélection de la chaîne */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Sélectionner une chaîne d'abaques :
            </label>
            <select
              value={selectedChain.join(',')}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedChain(value ? value.split(',') : []);
                setChainResults([]);
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="">-- Sélectionnez une chaîne --</option>
              {availableChains.map((chain, index) => {
                const chainNames = chain.map(id => {
                  const graph = graphs.find(g => g.id === id);
                  return graph?.name || id;
                }).join(' → ');

                return (
                  <option key={index} value={chain.join(',')}>
                    {chainNames}
                  </option>

              })}
            </select>
          </div>

          {selectedChain.length > 0 && (
            <>
              {/* Valeur d'entrée */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Valeur d'entrée ({graphs.find(g => g.id === selectedChain[0])?.axes?.xAxis?.title}) :
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(parseFloat(e.target.value) || 0)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <button
                    onClick={calculateChain}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Calculer
                  </button>
                </div>
              </div>

              {/* Résultats */}
              {chainResults.length > 0 && (
                <div style={{
                  backgroundColor: '#f5f5f5',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <h4 style={{ marginTop: 0 }}>Résultats du calcul :</h4>

                  {chainResults.map((step, index) => {
                    const graph = graphs.find(g => g.id === step.graphId);
                    return (
                      <div
                        key={index}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: index < chainResults.length - 1 ? '12px' : 0,
                          border: '1px solid #ddd'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                          {step.graphName}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          <div>
                            Entrée ({graph?.axes?.xAxis?.title}):
                            <span style={{ fontWeight: 'bold', marginLeft: '8px' }}>
                              {step.inputValue.toFixed(2)} {graph?.axes?.xAxis?.unit}
                            </span>
                          </div>
                          <div>
                            Sortie ({graph?.axes?.yAxis?.title}):
                            <span style={{
                              fontWeight: 'bold',
                              marginLeft: '8px',
                              color: step.outputValue !== null ? '#4CAF50' : '#f44336'
                            }}>
                              {step.outputValue !== null
                                ? `${step.outputValue.toFixed(2)} ${graph?.axes?.yAxis?.unit}`
                                : 'Non calculable'}
                            </span>
                          </div>
                          {step.curveUsed && (
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                              Courbe utilisée : {step.curveUsed}
                            </div>
                          )}
                        </div>

                        {index < chainResults.length - 1 && (
                          <div style={{
                            textAlign: 'center',
                            marginTop: '12px',
                            color: '#2196F3'
                          }}>
                            ↓
                          </div>
                        )}
                      </div>

                  })}

                  {/* Résultat final */}
                  {chainResults.length > 0 && chainResults[chainResults.length - 1].outputValue !== null && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: '#e8f5e9',
                      borderRadius: '6px',
                      border: '2px solid #4CAF50'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                        Résultat final :
                      </div>
                      <div style={{ fontSize: '18px', marginTop: '8px' }}>
                        {chainResults[chainResults.length - 1].outputValue?.toFixed(2)}{' '}
                        {graphs.find(g => g.id === chainResults[chainResults.length - 1].graphId)?.axes?.yAxis?.unit}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
};