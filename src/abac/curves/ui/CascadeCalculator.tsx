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
);}

const styles = {
  container: {
    padding: '20px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    maxWidth: '800px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '20px',
    borderBottom: '2px solid var(--bg-overlay)',
    paddingBottom: '10px'
  },
  title: {
    fontSize: 'var(--fs-title)',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  inputSection: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '6px'
  },
  inputGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    fontSize: 'var(--fs-body)',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '5px'
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '4px',
    fontSize: 'var(--fs-body)',
    backgroundColor: 'var(--bg-overlay)'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-subtle)',
    borderRadius: '4px',
    fontSize: 'var(--fs-body)'
  },
  chainDisplay: {
    padding: '10px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '4px',
    marginTop: '10px',
    fontSize: 'var(--fs-body)'
  },
  calculateButton: {
    padding: '10px 20px',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: 'var(--fs-body)',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '10px'
  },
  resultsSection: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '6px'
  },
  stepCard: {
    padding: '12px',
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '4px',
    marginBottom: '10px',
    border: '1px solid var(--bg-overlay)'
  },
  stepNumber: {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    textAlign: 'center' as const,
    lineHeight: '24px',
    fontSize: 'var(--fs-body)',
    fontWeight: 'bold',
    marginRight: '10px'
  },
  stepName: {
    fontSize: 'var(--fs-body)',
    fontWeight: 500,
    color: 'var(--text-primary)',
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
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)'
  },
  detailValue: {
    fontWeight: 500,
    color: 'var(--text-primary)'
  },
  finalResult: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'var(--accent-primary)',
    color: 'white',
    borderRadius: '6px',
    textAlign: 'center' as const
  },
  finalValue: {
    fontSize: 'var(--fs-title)',
    fontWeight: 'bold',
    marginTop: '5px'
  },
  errorBox: {
    padding: '12px',
    backgroundColor: 'var(--status-error-bg)',
    border: '1px solid var(--status-error-bg)',
    borderRadius: '4px',
    color: 'var(--color-red-critical)',
    fontSize: 'var(--fs-body)',
    marginTop: '10px'
  },
  validationWarning: {
    padding: '10px',
    backgroundColor: 'var(--accent-soft)',
    border: '1px solid var(--accent-soft)',
    borderRadius: '4px',
    marginTop: '10px',
    fontSize: 'var(--fs-body)',
    color: 'var(--accent-primary)'
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
  const checkParameterBounds = useCallback((graph: GraphConfig, value: number, isWindGraph: boolean = false) => {
    if (!graph.axes) return null;

    // Pour les graphiques de vent, utiliser la valeur absolue pour la vérification
    const checkValue = isWindGraph ? Math.abs(value) : value;

    const xMin = graph.axes.xAxis.min;
    const xMax = graph.axes.xAxis.max;
    const unit = graph.axes.xAxis.unit ? ` ${graph.axes.xAxis.unit}` : '';

    if (checkValue < xMin) {
      return `⚠️ ${checkValue}${unit} est en dessous de la plage [${xMin}${unit} - ${xMax}${unit}]`;
    } else if (checkValue > xMax) {
      return `⚠️ ${checkValue}${unit} est au-dessus de la plage [${xMin}${unit} - ${xMax}${unit}]`;
    }
    return null;
  }, []);

  // Gérer le changement de paramètre avec vérification en temps réel
  const handleParameterChange = useCallback((graphId: string, value: string) => {
    setParameters(prev => ({ ...prev, [graphId]: value }));

    // Vérifier les bornes en temps réel
    const graph = graphChain.find(g => g.id === graphId);
    const graphIndex = graphChain.findIndex(g => g.id === graphId);

    if (graph && value !== '') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        // Ne pas vérifier les bornes pour le premier graphique (altitude)
        // car l'altitude est un paramètre d'interpolation, pas une entrée X
        if (graphIndex === 0) {
          setParameterWarnings(prev => ({
            ...prev,
            [graphId]: ''
          }));
        } else {
          // Pour les autres graphiques, vérifier les bornes
          // Passer isWindGraph=true si le graphique est lié au vent
          const warning = checkParameterBounds(graph, numValue, graph.isWindRelated);
          setParameterWarnings(prev => ({
            ...prev,
            [graphId]: warning || ''
          }));
        }
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

        // NE PAS vérifier les bornes pour l'altitude car c'est un paramètre, pas une entrée X
        // L'altitude sera interpolée entre les courbes disponibles (ex: entre 2000ft et 4000ft)

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

        // Pour un graphique de vent, stocker la direction du vent
        
        // Vérifier si le paramètre est dans les bornes définies du graphique
        if (graph.axes) {
          const xMin = graph.axes.xAxis.min;
          const xMax = graph.axes.xAxis.max;

          if (paramValue < xMin || paramValue > xMax) {
            const unit = graph.axes.xAxis.unit ? ` ${graph.axes.xAxis.unit}` : '';
            warningsList.push(
              `⚠️ ${graph.axes.xAxis.title}: ${paramValue}${unit} est hors plage réglementaire [${xMin}${unit} - ${xMax}${unit}]. Résultat extrapolé.`
          }
        }

        // Passer la direction du vent dans les paramètres si c'est un graphique de vent
        const graphWindDirection = graph.isWindRelated && windDirection !== 'all' ? windDirection : undefined;

                graphParameters.push({
          graphId: graph.id,
          parameter: paramValue,
          parameterName: graph.axes?.xAxis.title,
          windDirection: graphWindDirection
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
  }, [initialValue, graphChain, chainValidation, parameters, windDirection]);

  const renderStep = (step: CascadeStep, index: number) => {
    // Trouver le graphique correspondant
    const graph = graphChain[index];

    return (
    <div key={step.graphId} style={{...styles.stepCard, marginBottom: '20px'}}>
      <div style={styles.stepName}>
        <span style={styles.stepNumber}>{index + 1}</span>
        {step.graphName}
      </div>

      {/* Mini graphique avec visualisation CORRECTE des abaques */}
      {graph && graph.axes && (
        <div style={{
          marginTop: '15px',
          marginBottom: '15px',
          padding: '10px',
          backgroundColor: 'var(--bg-overlay)',
          borderRadius: '4px',
          position: 'relative'
        }}>
          <Chart
            axesConfig={graph.axes}
            curves={(() => {
              // Filtrer et colorer les courbes selon leur utilisation
              if (step.referenceCurves) {
                // Si on a des courbes de référence, les mettre en évidence
                return graph.curves.map(c => {
                  const isLower = c.name === step.referenceCurves.lowerCurveName;
                  const isUpper = c.name === step.referenceCurves.upperCurveName;
                  if (isLower) return { ...c, color: 'var(--accent-primary)' }; // Vert pour courbe inférieure
                  if (isUpper) return { ...c, color: 'var(--accent-primary)' }; // Bleu pour courbe supérieure
                  return { ...c, color: 'var(--border-subtle)' }; // Gris pour les autres
                });
              } else if (step.curveUsed) {
                // Sinon, utiliser l'ancienne méthode
                return graph.curves.map(c => {
                  const isUsed = c.name === step.curveUsed || step.curveUsed.includes(c.name);
                  return { ...c, color: isUsed ? 'var(--color-red-critical)' : 'var(--border-subtle)' };
                });
              }
              return graph.curves;
            })()}
            selectedCurveId={null}
            width={350}
            height={250}
            showLegend={false}
            showGrid={true}
          />

          {/* Overlay SVG pour les annotations du processus d'abaques */}
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
              {(() => {
                // Créer les mêmes fonctions de scaling que Chart.tsx
                const innerWidth = 270;
                const innerHeight = 190;

                // Debug: Vérifier les axes du graphique
                const isMassGraph = graph.name.toLowerCase().includes('masse');
                
                // Fonction de scaling X
                const xScale = (value: number) => {
                  const ratio = (value - graph.axes.xAxis.min) / (graph.axes.xAxis.max - graph.axes.xAxis.min);
                  const scaled = graph.axes.xAxis.reversed ? innerWidth * (1 - ratio) : innerWidth * ratio;

                  // Debug pour le graphique de masse
                  if (graph.name.toLowerCase().includes('masse') && step.parameter) {
                    : ratio=${ratio.toFixed(3)}, reversed=${graph.axes.xAxis.reversed}, result=${scaled.toFixed(1)}`);
                  }

                  return scaled;
                };

                // Fonction de scaling Y (inversé pour SVG)
                const yScale = (value: number) => {
                  const ratio = (value - graph.axes.yAxis.min) / (graph.axes.yAxis.max - graph.axes.yAxis.min);
                  const scaled = graph.axes.yAxis.reversed ? innerHeight * ratio : innerHeight * (1 - ratio);

                  // Debug pour le graphique de masse
                  if (graph.name.toLowerCase().includes('masse')) {
                    : ratio=${ratio.toFixed(3)}, reversed=${graph.axes.yAxis.reversed}, result=${scaled.toFixed(1)}`);
                  }

                  return scaled;
                };

                // Debug: afficher les positions calculées pour le graphique de masse
                if (graph.name.toLowerCase().includes('masse') && step.parameter) {
                  ,
                      ligneVerticaleX: xScale(step.parameter),
                      pointSortie: { x: xScale(step.parameter), y: yScale(step.outputValue) }
                    }
                  });

                  if (step.valuesAtCrossing) {
                    , y: yScale(step.valuesAtCrossing.lowerValue) } : null,
                        upperPoint: step.valuesAtCrossing.upperValue ?
                          { x: xScale(step.parameter), y: yScale(step.valuesAtCrossing.upperValue) } : null
                      }
                    });
                  }

                  // Vérifier si les points sont dans la zone visible
                  const checkVisible = (y: number) => {
                    if (y < 0) return "⚠️ Au-dessus du graphique";
                    if (y > innerHeight) return "⚠️ En dessous du graphique";
                    return "✓ Visible";
                  };

                  ),
                    pointSortie: checkVisible(yScale(step.outputValue)),
                    lowerPoint: step.valuesAtCrossing?.lowerValue ?
                      checkVisible(yScale(step.valuesAtCrossing.lowerValue)) : null,
                    upperPoint: step.valuesAtCrossing?.upperValue ?
                      checkVisible(yScale(step.valuesAtCrossing.upperValue)) : null
                  });
                }

                return (
                  <>
              {/* Pour le premier graphique (température) */}
              {index === 0 && (
                <>
                  {/* Ligne verticale d'entrée X */}
                  <line
                    x1={xScale(step.inputValue)}
                    y1="0"
                    x2={xScale(step.inputValue)}
                    y2={innerHeight}
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />
                  <text
                    x={xScale(step.inputValue) - 10}
                    y={innerHeight + 15}
                    fontSize="10"
                    fill="var(--accent-primary)"
                  >
                    X={step.inputValue.toFixed(0)}
                  </text>

                  {/* Si altitude fournie, montrer les courbes d'interpolation */}
                  {step.parameter !== undefined && step.referenceCurves && (
                    <>
                      {/* Indicateur d'altitude */}
                      <text
                        x="5"
                        y="-10"
                        fontSize="11"
                        fill="var(--accent-primary)"
                        fontWeight="bold"
                      >
                        Alt: {step.parameter.toFixed(0)} ft
                      </text>

                      {/* Point de sortie interpolé */}
                      <circle
                        cx={xScale(step.inputValue)}
                        cy={yScale(step.outputValue)}
                        r="6"
                        fill="var(--color-red-critical)"
                        stroke="white"
                        strokeWidth="2"
                      />

                      {/* Label de sortie */}
                      <text
                        x={xScale(step.inputValue) + 10}
                        y={yScale(step.outputValue) - 5}
                        fontSize="10"
                        fill="var(--color-red-critical)"
                        fontWeight="bold"
                      >
                        Y={step.outputValue.toFixed(0)}
                      </text>
                    </>
                  )}

                  {/* Sans altitude, point direct */}
                  {step.parameter === undefined && (
                    <circle
                      cx={xScale(step.inputValue)}
                      cy={yScale(step.outputValue)}
                      r="6"
                      fill="var(--accent-primary)"
                      stroke="white"
                      strokeWidth="2"
                    />
                  )}
                </>
              )}

              {/* Pour les graphiques suivants (avec méthode des abaques) */}
              {index > 0 && (
                <>
                  {/* ÉTAPE 1: Ligne horizontale à Y=entrée */}
                  <line
                    x1="0"
                    y1={yScale(step.inputValue)}
                    x2={innerWidth}
                    y2={yScale(step.inputValue)}
                    stroke="var(--accent-primary)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />
                  <text
                    x="-35"
                    y={yScale(step.inputValue) + 3}
                    fontSize="10"
                    fill="var(--accent-primary)"
                  >
                    Y={step.inputValue.toFixed(0)}
                  </text>

                  {/* ÉTAPE 2: Ligne verticale au paramètre X */}
                  {step.parameter !== undefined && (
                    <>
                      <line
                        x1={xScale(step.parameter)}
                        y1="0"
                        x2={xScale(step.parameter)}
                        y2={innerHeight}
                        stroke="var(--accent-primary)"
                        strokeWidth="1.5"
                        strokeDasharray="3,3"
                        opacity="0.7"
                      />
                      <text
                        x={xScale(step.parameter) - 10}
                        y={innerHeight + 15}
                        fontSize="10"
                        fill="var(--accent-primary)"
                      >
                        X={step.parameter.toFixed(0)}
                      </text>

                      {/* ÉTAPE 3: Points aux intersections des courbes de référence */}
                      {step.valuesAtCrossing && (
                        <>
                          {/* Point sur la courbe inférieure */}
                          {step.valuesAtCrossing.lowerValue !== undefined && (
                            <circle
                              cx={xScale(step.parameter)}
                              cy={yScale(step.valuesAtCrossing.lowerValue)}
                              r="4"
                              fill="var(--accent-primary)"
                              stroke="white"
                              strokeWidth="1.5"
                            />
                          )}

                          {/* Point sur la courbe supérieure */}
                          {step.valuesAtCrossing.upperValue !== undefined && (
                            <circle
                              cx={xScale(step.parameter)}
                              cy={yScale(step.valuesAtCrossing.upperValue)}
                              r="4"
                              fill="var(--accent-primary)"
                              stroke="white"
                              strokeWidth="1.5"
                            />
                          )}

                          {/* Ligne reliant les deux points (zone d'interpolation) */}
                          {step.valuesAtCrossing.lowerValue !== undefined && step.valuesAtCrossing.upperValue !== undefined && (
                            <line
                              x1={xScale(step.parameter)}
                              y1={yScale(step.valuesAtCrossing.lowerValue)}
                              x2={xScale(step.parameter)}
                              y2={yScale(step.valuesAtCrossing.upperValue)}
                              stroke="var(--accent-primary)"
                              strokeWidth="3"
                              opacity="0.3"
                            />
                          )}
                        </>
                      )}

                      {/* ÉTAPE 4: Point de sortie interpolé */}
                      <circle
                        cx={xScale(step.parameter)}
                        cy={yScale(step.outputValue)}
                        r="6"
                        fill="var(--color-red-critical)"
                        stroke="white"
                        strokeWidth="2"
                      />

                      {/* Flèche et label de sortie */}
                      <g transform={`translate(${xScale(step.parameter) + 15}, ${yScale(step.outputValue)})`}>
                        <path
                          d="M 0,0 L 10,-3 L 10,3 Z"
                          fill="var(--color-red-critical)"
                        />
                        <text
                          x="15"
                          y="3"
                          fontSize="10"
                          fill="var(--color-red-critical)"
                          fontWeight="bold"
                        >
                          Y={step.outputValue.toFixed(0)}
                        </text>
                      </g>
                    </>
                  )}
                </>
              )}
                  </>
              })()}
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
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)', marginLeft: '4px' }}>
                (valeur précédente)
              </span>
              {step.referenceCurves && (
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '2px', marginLeft: '10px' }}>
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
            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px' }}>
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
            <span style={{ color: 'var(--accent-primary)' }}>⚠ Valeur interpolée</span>
            {step.valuesAtCrossing && (
              <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '2px' }}>
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🔄 Calculateur en Cascade</h2>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: '5px 0 0 0' }}>
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
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Point de départ: {startGraph.axes.xAxis.title}
                {startGraph.axes.xAxis.unit && ` (${startGraph.axes.xAxis.unit})`}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--status-error-bg)',
            borderRadius: '6px',
            marginBottom: '16px',
            border: '1px solid var(--color-red-critical)'
          }}>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--color-red-critical)' }}>
              ⚠ Aucun système d'abaques configuré
            </div>
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginTop: '4px' }}>
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
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
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
                      <span style={{ fontWeight: 'normal', color: 'var(--color-red-critical)' }}>
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
                    borderColor: parameterWarnings[graph.id] ? 'var(--accent-primary)' : 'var(--border-subtle)'
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
                    fontSize: 'var(--fs-caption)',
                    color: 'var(--accent-primary)',
                    marginTop: '4px',
                    padding: '4px 8px',
                    backgroundColor: 'var(--accent-soft)',
                    borderRadius: '3px',
                    border: '1px solid var(--accent-soft)'
                  }}>
                    {parameterWarnings[graph.id]}
                  </div>
                )}
                {graph.curves && graph.curves.length > 0 && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px' }}>
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
                      backgroundColor: windDirection === 'headwind' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                      color: windDirection === 'headwind' ? 'white' : 'var(--text-primary)',
                      border: '1px solid ' + (windDirection === 'headwind' ? 'var(--accent-primary)' : 'var(--border-subtle)'),
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-body)',
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
                      backgroundColor: windDirection === 'tailwind' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                      color: windDirection === 'tailwind' ? 'white' : 'var(--text-primary)',
                      border: '1px solid ' + (windDirection === 'tailwind' ? 'var(--accent-primary)' : 'var(--border-subtle)'),
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-body)',
                      fontWeight: windDirection === 'tailwind' ? 'bold' : 'normal'
                    }}
                  >
                    ➡️ Vent arrière
                  </button>
                </div>
                {windDirection !== 'all' && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px' }}>
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
          <h3 style={{ fontSize: 'var(--fs-title)', marginBottom: '15px', color: 'var(--text-primary)' }}>
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
              <div style={{ fontSize: 'var(--fs-body)', marginTop: '5px' }}>
                {graphChain[graphChain.length - 1].axes.yAxis.title}
                {graphChain[graphChain.length - 1].axes.yAxis.unit &&
                 ` (${graphChain[graphChain.length - 1].axes.yAxis.unit})`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
};