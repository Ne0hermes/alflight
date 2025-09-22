import React, { useState, useCallback, useMemo } from 'react';
import { GraphConfig } from '../core/types';
import {
  performCascadeCalculation,
  performCascadeCalculationWithParameters,
  findGraphChain,
  validateGraphChain,
  CascadeResult,
  CascadeStep,
  GraphParameters
} from '../core/cascade';
import { Chart } from './Chart';

interface CascadeCalculatorProps {
  graphs: GraphConfig[];
  systems?: {
    graphs: GraphConfig[];
    metadata: any;
    name: string;
  }[];
  onClose?: () => void;
}

const styles = {
  container: {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    maxWidth: '800px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '20px',
    borderBottom: '2px solid #e0e0e0',
    paddingBottom: '10px'
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#333'
  },
  inputSection: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px'
  },
  inputGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#666',
    marginBottom: '5px'
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  chainDisplay: {
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderRadius: '4px',
    marginTop: '10px',
    fontSize: '13px'
  },
  calculateButton: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '10px'
  },
  resultsSection: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px'
  },
  stepCard: {
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '4px',
    marginBottom: '10px',
    border: '1px solid #e0e0e0'
  },
  stepNumber: {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#2196F3',
    color: 'white',
    textAlign: 'center' as const,
    lineHeight: '24px',
    fontSize: '12px',
    fontWeight: 'bold',
    marginRight: '10px'
  },
  stepName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
    marginBottom: '8px'
  },
  stepDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginTop: '8px',
    paddingLeft: '34px'
  },
  detailItem: {
    fontSize: '12px',
    color: '#666'
  },
  detailValue: {
    fontWeight: 500,
    color: '#333'
  },
  finalResult: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#4CAF50',
    color: 'white',
    borderRadius: '6px',
    textAlign: 'center' as const
  },
  finalValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginTop: '5px'
  },
  errorBox: {
    padding: '12px',
    backgroundColor: '#ffebee',
    border: '1px solid #ffcdd2',
    borderRadius: '4px',
    color: '#c62828',
    fontSize: '13px',
    marginTop: '10px'
  },
  validationWarning: {
    padding: '10px',
    backgroundColor: '#fff3e0',
    border: '1px solid #ffcc80',
    borderRadius: '4px',
    marginTop: '10px',
    fontSize: '12px',
    color: '#e65100'
  }
};

export const CascadeCalculator: React.FC<CascadeCalculatorProps> = ({
  graphs,
  systems,
  onClose
}) => {
  const [initialValue, setInitialValue] = useState<string>('');
  const [parameters, setParameters] = useState<{[graphId: string]: string}>({});
  const [windDirection, setWindDirection] = useState<'headwind' | 'tailwind' | 'all'>('all');
  const [selectedSystemId, setSelectedSystemId] = useState<string>('');
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parameterWarnings, setParameterWarnings] = useState<{[graphId: string]: string}>({});

  // Trouver tous les systèmes disponibles avec leurs métadonnées
  const availableSystems = useMemo(() => {
    // Si on a des systèmes avec métadonnées, les utiliser
    if (systems && systems.length > 0) {
      return systems.map(system => {
        const firstGraph = system.graphs[0];
        if (firstGraph) {
          return {
            ...firstGraph,
            systemName: system.name || system.metadata?.systemName || firstGraph.name,
            chainLength: system.graphs.length,
            metadata: system.metadata
          };
        }
        return null;
      }).filter(s => s !== null);
    }

    // Sinon, utiliser l'ancienne méthode
    const startGraphs = graphs.filter(g => !g.linkedFrom || g.linkedFrom.length === 0);
    return startGraphs.map(startGraph => {
      const chain = findGraphChain(graphs, startGraph.id);
      let systemName = '';

      if (chain.length > 1) {
        const lastGraph = chain[chain.length - 1];
        systemName = `Système ${startGraph.name} → ${lastGraph.name}`;
      } else {
        systemName = `Système ${startGraph.name}`;
      }

      return {
        ...startGraph,
        systemName: systemName,
        chainLength: chain.length
      };
    });
  }, [graphs, systems]);

  // Utiliser le système sélectionné ou le premier par défaut
  const startGraph = useMemo(() => {
    if (selectedSystemId) {
      return graphs.find(g => g.id === selectedSystemId) || null;
    }
    return availableSystems.length > 0 ? availableSystems[0] : null;
  }, [graphs, selectedSystemId, availableSystems]);

  // Construire automatiquement la chaîne complète de graphiques
  const graphChain = useMemo(() => {
    if (!startGraph) return [];
    return findGraphChain(graphs, startGraph.id);
  }, [graphs, startGraph]);

  // Valider la chaîne
  const chainValidation = useMemo(() => {
    if (graphChain.length === 0) return { valid: true, errors: [] };
    return validateGraphChain(graphChain);
  }, [graphChain]);

  // Fonction pour vérifier un paramètre et retourner un avertissement si nécessaire
  const checkParameterBounds = useCallback((graph: GraphConfig, value: number) => {
    if (!graph.axes) return null;

    const xMin = graph.axes.xAxis.min;
    const xMax = graph.axes.xAxis.max;
    const unit = graph.axes.xAxis.unit ? ` ${graph.axes.xAxis.unit}` : '';

    if (value < xMin) {
      return `⚠️ ${value}${unit} est en dessous de la plage [${xMin}${unit} - ${xMax}${unit}]`;
    } else if (value > xMax) {
      return `⚠️ ${value}${unit} est au-dessus de la plage [${xMin}${unit} - ${xMax}${unit}]`;
    }
    return null;
  }, []);

  // Gérer le changement de paramètre avec vérification en temps réel
  const handleParameterChange = useCallback((graphId: string, value: string) => {
    setParameters(prev => ({ ...prev, [graphId]: value }));

    // Vérifier les bornes en temps réel
    const graph = graphChain.find(g => g.id === graphId);
    if (graph && value !== '') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        const warning = checkParameterBounds(graph, numValue);
        setParameterWarnings(prev => ({
          ...prev,
          [graphId]: warning || ''
        }));
      } else {
        setParameterWarnings(prev => ({
          ...prev,
          [graphId]: ''
        }));
      }
    } else {
      setParameterWarnings(prev => ({
        ...prev,
        [graphId]: ''
      }));
    }
  }, [graphChain, checkParameterBounds]);

  const handleCalculate = useCallback(() => {
    setError('');
    setWarnings([]);
    setResult(null);

    const value = parseFloat(initialValue);
    if (isNaN(value)) {
      setError('Veuillez entrer une valeur numérique valide');
      return;
    }

    if (graphChain.length === 0) {
      setError('Veuillez sélectionner un graphique de départ');
      return;
    }

    if (!chainValidation.valid) {
      setError('La chaîne de graphiques contient des erreurs. Veuillez les corriger.');
      return;
    }

    // Préparer les paramètres pour TOUS les graphiques (y compris le premier pour l'altitude)
    const graphParameters: GraphParameters[] = [];
    const warningsList: string[] = [];

    for (let i = 0; i < graphChain.length; i++) {
      const graph = graphChain[i];
      const paramValue = parseFloat(parameters[graph.id] || '');

      // Le paramètre est obligatoire pour tous les graphiques
      if (i === 0) {
        // Premier graphique : altitude pression OBLIGATOIRE
        if (isNaN(paramValue)) {
          setError('L\'altitude pression est requise pour le calcul');
          return;
        }
        graphParameters.push({
          graphId: graph.id,
          parameter: paramValue,
          parameterName: 'Altitude pression'
        });
      } else {
        // Graphiques suivants : paramètre obligatoire
        if (isNaN(paramValue)) {
          setError(`Veuillez entrer un paramètre valide pour ${graph.name} (${graph.axes?.xAxis.title})`);
          return;
        }

        // Pour un graphique de vent, appliquer le signe selon la direction sélectionnée
        let adjustedParamValue = paramValue;
        if (graph.isWindRelated && windDirection !== 'all') {
          // Si vent arrière (tailwind), rendre la valeur négative
          // Si vent de face (headwind), garder positive
          adjustedParamValue = windDirection === 'tailwind' ? -Math.abs(paramValue) : Math.abs(paramValue);
          console.log(`📌 Ajustement du paramètre vent: ${paramValue} → ${adjustedParamValue} (${windDirection})`);
        }

        // Vérifier si le paramètre est dans les bornes définies du graphique
        if (graph.axes) {
          const xMin = graph.axes.xAxis.min;
          const xMax = graph.axes.xAxis.max;

          if (Math.abs(paramValue) < xMin || Math.abs(paramValue) > xMax) {
            const unit = graph.axes.xAxis.unit ? ` ${graph.axes.xAxis.unit}` : '';
            warningsList.push(
              `⚠️ ${graph.axes.xAxis.title}: ${Math.abs(paramValue)}${unit} est hors plage réglementaire [${xMin}${unit} - ${xMax}${unit}]. Résultat extrapolé.`
            );
          }
        }

        graphParameters.push({
          graphId: graph.id,
          parameter: adjustedParamValue,
          parameterName: graph.axes?.xAxis.title
        });
      }
    }

    // Stocker les avertissements sans bloquer le calcul
    if (warningsList.length > 0) {
      setWarnings(warningsList);
    }

    const calcResult = performCascadeCalculationWithParameters(graphChain, value, graphParameters);

    if (!calcResult.success) {
      setError(calcResult.error || 'Erreur lors du calcul');
      return;
    }

    setResult(calcResult);
  }, [initialValue, graphChain, chainValidation, parameters]);

  const renderStep = (step: CascadeStep, index: number) => {
    // Trouver le graphique correspondant
    const graph = graphChain[index];

    return (
    <div key={step.graphId} style={{...styles.stepCard, marginBottom: '20px'}}>
      <div style={styles.stepName}>
        <span style={styles.stepNumber}>{index + 1}</span>
        {step.graphName}
      </div>

      {/* Mini graphique avec visualisation */}
      {graph && graph.axes && (
        <div style={{
          marginTop: '15px',
          marginBottom: '15px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          position: 'relative'
        }}>
          <Chart
            axesConfig={graph.axes}
            curves={graph.curves.map(c => {
              // Mettre en évidence la courbe utilisée
              const isUsed = step.curveUsed &&
                (c.name === step.curveUsed ||
                 step.curveUsed.includes(c.name));
              return { ...c, color: isUsed ? '#ff4444' : '#ddd' };
            })}
            selectedCurveId={null}
            width={350}
            height={250}
            showLegend={false}
            showGrid={true}
          />

          {/* Points de tracé sur le graphique */}
          <svg
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              pointerEvents: 'none'
            }}
            width="350"
            height="250"
          >
            <g transform="translate(40, 30)">
              {/* Ligne horizontale d'entrée (pour graphiques 2+) */}
              {index > 0 && (
                <>
                  <line
                    x1="0"
                    y1={(190 * (graph.axes.yAxis.max - step.inputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                    x2="270"
                    y2={(190 * (graph.axes.yAxis.max - step.inputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                    stroke="#2196F3"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />
                  {/* Texte indicateur pour la ligne horizontale */}
                  <text
                    x="275"
                    y={(190 * (graph.axes.yAxis.max - step.inputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min)) + 3}
                    fontSize="10"
                    fill="#2196F3"
                  >
                    Y={step.inputValue.toFixed(0)}
                  </text>
                </>
              )}

              {/* Point de paramètre et ligne verticale */}
              {step.parameter !== undefined && (
                <>
                  {/* Ligne verticale du paramètre */}
                  <line
                    x1={(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min))}
                    y1="0"
                    x2={(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min))}
                    y2="190"
                    stroke="#ff9800"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                    opacity="0.7"
                  />

                  {/* Texte indicateur pour la ligne verticale */}
                  <text
                    x={(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min)) - 10}
                    y="200"
                    fontSize="10"
                    fill="#ff9800"
                  >
                    X={step.parameter.toFixed(0)}
                  </text>

                  {/* Point d'intersection final (sortie) */}
                  <circle
                    cx={(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min))}
                    cy={(190 * (graph.axes.yAxis.max - step.outputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                    r="6"
                    fill="#ff4444"
                    stroke="white"
                    strokeWidth="2"
                  />

                  {/* Flèche indiquant la sortie */}
                  <path
                    d={`M ${(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min)) + 10} ${(190 * (graph.axes.yAxis.max - step.outputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                        L ${(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min)) + 20} ${(190 * (graph.axes.yAxis.max - step.outputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min)) - 5}
                        L ${(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min)) + 20} ${(190 * (graph.axes.yAxis.max - step.outputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min)) + 5}
                        Z`}
                    fill="#ff4444"
                  />
                </>
              )}

              {/* Point d'intersection initiale avec la courbe de référence (pour graphiques 2+) */}
              {index > 0 && step.referenceIntersectionX !== undefined && (
                <>
                  <circle
                    cx={(270 * (step.referenceIntersectionX - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min))}
                    cy={(190 * (graph.axes.yAxis.max - step.inputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                    r="4"
                    fill="#00BCD4"
                    stroke="white"
                    strokeWidth="1.5"
                    title="Point d'intersection avec la courbe de référence"
                  />

                  {/* Trajectoire parallèle à la courbe (si paramètre et offset définis) */}
                  {step.parameter !== undefined && step.offset !== undefined && (
                    <line
                      x1={(270 * (step.referenceIntersectionX - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min))}
                      y1={(190 * (graph.axes.yAxis.max - step.inputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                      x2={(270 * (step.parameter - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min))}
                      y2={(190 * (graph.axes.yAxis.max - step.outputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                      stroke="#9C27B0"
                      strokeWidth="2"
                      strokeDasharray="2,2"
                      opacity="0.8"
                      markerEnd="url(#arrowhead)"
                    />
                  )}
                </>
              )}

              {/* Définition de la flèche pour la trajectoire */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#9C27B0"
                  />
                </marker>
              </defs>

              {/* Point de sortie (pour graphique 1 uniquement sans paramètre) */}
              {index === 0 && step.parameter === undefined && (
                <circle
                  cx={(270 * (step.inputValue - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min))}
                  cy={(190 * (graph.axes.yAxis.max - step.outputValue) / (graph.axes.yAxis.max - graph.axes.yAxis.min))}
                  r="6"
                  fill="#4CAF50"
                  stroke="white"
                  strokeWidth="2"
                />
              )}
            </g>
          </svg>
        </div>
      )}

      <div style={styles.stepDetails}>
        {index === 0 ? (
          // Premier graphique : entrée sur X avec altitude optionnelle
          <>
            <div style={styles.detailItem}>
              Entrée (X):
              <span style={styles.detailValue}> {step.inputValue.toFixed(2)}</span>
            </div>
            {step.parameter !== undefined && (
              <div style={styles.detailItem}>
                Altitude pression:
                <span style={styles.detailValue}> {step.parameter.toFixed(0)} ft</span>
              </div>
            )}
          </>
        ) : (
          // Graphiques suivants : entrée sur Y avec paramètre sur X
          <>
            <div style={styles.detailItem}>
              Entrée (Y):
              <span style={styles.detailValue}> {step.inputValue.toFixed(2)}</span>
              <span style={{ fontSize: '10px', color: '#2196F3', marginLeft: '4px' }}>
                (valeur précédente)
              </span>
              {step.referenceCurves && (
                <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', marginLeft: '10px' }}>
                  Position entre courbes:
                  <br />• {step.referenceCurves.lowerCurveName} (Y={step.referenceCurves.lowerYAtRef?.toFixed(2)})
                  <br />• {step.referenceCurves.upperCurveName} (Y={step.referenceCurves.upperYAtRef?.toFixed(2)})
                </div>
              )}
            </div>
            {step.parameter !== undefined && (
              <div style={styles.detailItem}>
                Paramètre ({step.parameterName || 'X'}):
                <span style={styles.detailValue}> {step.parameter.toFixed(2)}</span>
              </div>
            )}
          </>
        )}
        <div style={styles.detailItem}>
          Sortie (Y):
          <span style={styles.detailValue}> {step.outputValue.toFixed(2)}</span>
        </div>
        {step.curveUsed && (
          <div style={styles.detailItem}>
            Courbe: <span style={styles.detailValue}>{step.curveUsed}</span>
          </div>
        )}
        {step.offset !== undefined && step.offset !== 0 && (
          <div style={styles.detailItem}>
            Trajectoire:
            <span style={styles.detailValue}>
              {step.offset > 0 ? ' Au-dessus ' : ' En-dessous '}
              de {Math.abs(step.offset).toFixed(2)} unités
            </span>
          </div>
        )}
        {step.valuesAtCrossing && (
          <div style={styles.detailItem}>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              <strong>Croisements verticaux à X={step.parameter?.toFixed(2)}:</strong>
              <div style={{ marginLeft: '10px', marginTop: '2px' }}>
                • Courbe inférieure: Y={step.valuesAtCrossing.lowerValue?.toFixed(2) || 'N/A'}<br />
                • Courbe supérieure: Y={step.valuesAtCrossing.upperValue?.toFixed(2) || 'N/A'}
              </div>
            </div>
          </div>
        )}
        {step.interpolated && (
          <div style={styles.detailItem}>
            <span style={{ color: '#ff9800' }}>⚠ Valeur interpolée</span>
            {step.valuesAtCrossing && (
              <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                Calcul: {step.valuesAtCrossing.lowerValue?.toFixed(2)} +
                {' '}{step.offset?.toFixed(2)} ×
                ({step.valuesAtCrossing.upperValue?.toFixed(2)} - {step.valuesAtCrossing.lowerValue?.toFixed(2)})
                = {step.outputValue.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🔄 Calculateur en Cascade</h2>
        <p style={{ fontSize: '13px', color: '#666', margin: '5px 0 0 0' }}>
          Propagez une valeur à travers une chaîne de graphiques liés
        </p>
      </div>

      <div style={styles.inputSection}>
        {/* Sélecteur de système d'abaques */}
        {availableSystems.length > 0 ? (
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              📊 Sélectionnez le système d'abaques
            </label>
            <select
              style={styles.select}
              value={selectedSystemId || (startGraph?.id || '')}
              onChange={(e) => setSelectedSystemId(e.target.value)}
            >
              {availableSystems.map(system => (
                <option key={system.id} value={system.id}>
                  {system.systemName}
                  {system.chainLength > 1 && ` (${system.chainLength} étapes)`}
                </option>
              ))}
            </select>
            {startGraph && startGraph.axes && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Point de départ: {startGraph.axes.xAxis.title}
                {startGraph.axes.xAxis.unit && ` (${startGraph.axes.xAxis.unit})`}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            padding: '12px',
            backgroundColor: '#ffebee',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '1px solid #f44336'
          }}>
            <div style={{ fontSize: '14px', color: '#c62828' }}>
              ⚠ Aucun système d'abaques configuré
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Veuillez configurer vos graphiques dans l'étape 1
            </div>
          </div>
        )}

        {graphChain.length > 0 && (
          <div style={styles.chainDisplay}>
            <strong>Chaîne de calcul:</strong>
            <div style={{ marginTop: '5px' }}>
              {graphChain.map((g, i) => (
                <span key={g.id}>
                  {i > 0 && ' → '}
                  <strong>{g.name}</strong>
                  {g.axes && (
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      {' '}({g.axes.xAxis.title} → {g.axes.yAxis.title})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {chainValidation.errors.length > 0 && (
          <div style={styles.validationWarning}>
            <strong>⚠ Problèmes détectés:</strong>
            <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
              {chainValidation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {startGraph && chainValidation.valid && (
          <>
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                Valeur d'entrée initiale
                {graphChain.length > 0 && graphChain[0].axes && (
                  <span style={{ fontWeight: 'normal' }}>
                    {' '}({graphChain[0].axes.xAxis.title})
                  </span>
                )}
              </label>
              <input
                type="number"
                style={styles.input}
                value={initialValue}
                onChange={(e) => setInitialValue(e.target.value)}
                placeholder="Entrez une valeur numérique"
              />
            </div>

            {/* Champs pour les paramètres de chaque graphique */}
            {graphChain.map((graph, index) => (
              <div key={graph.id} style={styles.inputGroup}>
                <label style={styles.label}>
                  {index === 0 ? (
                    <>
                      Altitude pression pour {graph.name}
                      <span style={{ fontWeight: 'normal', color: '#d32f2f' }}>
                        {' '}(obligatoire)
                      </span>
                    </>
                  ) : (
                    <>
                      Paramètre pour {graph.name}
                      {graph.axes && (
                        <span style={{ fontWeight: 'normal' }}>
                          {' '}({graph.axes.xAxis.title})
                        </span>
                      )}
                    </>
                  )}
                </label>
                <input
                  type="number"
                  style={{
                    ...styles.input,
                    borderColor: parameterWarnings[graph.id] ? '#ff9800' : '#ddd'
                  }}
                  value={parameters[graph.id] || ''}
                  onChange={(e) => handleParameterChange(graph.id, e.target.value)}
                  placeholder={
                    index === 0
                      ? 'Altitude pression (ft ou m)'
                      : `Valeur de ${graph.axes?.xAxis.title || 'paramètre'}`
                  }
                />
                {parameterWarnings[graph.id] && (
                  <div style={{
                    fontSize: '11px',
                    color: '#ff6b00',
                    marginTop: '4px',
                    padding: '4px 8px',
                    backgroundColor: '#fff3e0',
                    borderRadius: '3px',
                    border: '1px solid #ffcc80'
                  }}>
                    {parameterWarnings[graph.id]}
                  </div>
                )}
                {graph.curves && graph.curves.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                    {index === 0 ? 'Courbes d\'altitude: ' : 'Courbes disponibles: '}
                    {graph.curves.map(c => c.name).join(', ')}
                  </div>
                )}
              </div>
            ))}

            {/* Sélecteur de direction du vent pour les graphiques liés au vent */}
            {graphChain.some(g => g.isWindRelated) && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>
                  💨 Direction du vent pour le calcul
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setWindDirection('headwind')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: windDirection === 'headwind' ? '#4CAF50' : '#f5f5f5',
                      color: windDirection === 'headwind' ? 'white' : '#333',
                      border: '1px solid ' + (windDirection === 'headwind' ? '#4CAF50' : '#ddd'),
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: windDirection === 'headwind' ? 'bold' : 'normal'
                    }}
                  >
                    ⬅️ Vent de face
                  </button>
                  <button
                    onClick={() => setWindDirection('tailwind')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: windDirection === 'tailwind' ? '#FF9800' : '#f5f5f5',
                      color: windDirection === 'tailwind' ? 'white' : '#333',
                      border: '1px solid ' + (windDirection === 'tailwind' ? '#FF9800' : '#ddd'),
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: windDirection === 'tailwind' ? 'bold' : 'normal'
                    }}
                  >
                    ➡️ Vent arrière
                  </button>
                </div>
                {windDirection !== 'all' && (
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                    Seules les courbes {windDirection === 'headwind' ? 'vent de face' : 'vent arrière'} seront utilisées
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {startGraph && initialValue && chainValidation.valid && (
          <button
            style={styles.calculateButton}
            onClick={handleCalculate}
          >
            Calculer
          </button>
        )}
      </div>

      {warnings.length > 0 && (
        <div style={styles.validationWarning}>
          {warnings.map((warning, index) => (
            <div key={index} style={{ marginBottom: index < warnings.length - 1 ? '8px' : 0 }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          ❌ {error}
        </div>
      )}

      {result && result.success && (
        <div style={styles.resultsSection}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#333' }}>
            📊 Résultats du calcul
          </h3>

          {result.steps.map((step, index) => renderStep(step, index))}

          <div style={styles.finalResult}>
            <div>Valeur finale</div>
            <div style={styles.finalValue}>
              {result.finalValue.toFixed(2)}
            </div>
            {graphChain.length > 0 &&
             graphChain[graphChain.length - 1].axes && (
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                {graphChain[graphChain.length - 1].axes.yAxis.title}
                {graphChain[graphChain.length - 1].axes.yAxis.unit &&
                 ` (${graphChain[graphChain.length - 1].axes.yAxis.unit})`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};