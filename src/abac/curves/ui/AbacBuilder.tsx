import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TextField, Select, MenuItem, FormControl, InputLabel, FormHelperText } from '@mui/material';
import { AxesForm } from './AxesForm';
import { CurveManager } from './CurveManager';
import { Chart } from './Chart';
import { PointEditor } from './PointEditor';
import { PointsTable } from './PointsTable';
import { GraphManager } from './GraphManager';
import { ChainCalculator } from './ChainCalculator';
import { CascadeCalculator } from './CascadeCalculator';
import { AbacCurveManager } from '../core/manager';
import { calculateAutoAxesLimits, calculateGraphAutoLimits, updateAxesWithAutoLimits } from '../core/axesUtils';
import {
  AxesConfig,
  Curve,
  XYPoint,
  FitOptions,
  FitResult,
  AbacCurvesJSON,
  GraphConfig,
  WindDirection
} from '../core/types';
import styles from './styles.module.css';

type Step = 'axes' | 'points' | 'final';

interface AbacBuilderProps {
  onSave?: (json: AbacCurvesJSON, modelName?: string) => void;
  initialData?: AbacCurvesJSON;
  modelName?: string;
  aircraftModel?: string;
}

export const AbacBuilder: React.FC<AbacBuilderProps> = ({ onSave, initialData, modelName, aircraftModel }) => {
  const managerRef = useRef(new AbacCurveManager());

  const [currentStep, setCurrentStep] = useState<Step>('axes');
  const [graphs, setGraphs] = useState<GraphConfig[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [selectedCurveId, setSelectedCurveId] = useState<string | null>(null);
  const [fitResults, setFitResults] = useState<Record<string, FitResult>>({});
  const [warnings, setWarnings] = useState<Record<string, string[]>>({});
  // Liste prédéfinie des types de systèmes d'abaques
  const SYSTEM_TYPES = [
    { value: 'takeoff_distance', label: 'Distance de décollage (roulage)' },
    { value: 'takeoff_distance_50ft', label: 'Distance de décollage (franchissement 50ft)' },
    { value: 'landing_distance', label: 'Distance d\'atterrissage (roulage)' },
    { value: 'landing_distance_50ft', label: 'Distance d\'atterrissage (franchissement 50ft)' },
    { value: 'accelerate_stop', label: 'Distance accélération-arrêt' },
    { value: 'climb_performance', label: 'Performance de montée' },
    { value: 'cruise_performance', label: 'Performance de croisière' },
    { value: 'fuel_consumption', label: 'Consommation de carburant' },
    { value: 'weight_balance', label: 'Masse et centrage' },
    { value: 'range_endurance', label: 'Autonomie et endurance' },
    { value: 'ceiling_service', label: 'Plafond de service' },
    { value: 'glide_performance', label: 'Performance de plané' },
    { value: 'crosswind_limits', label: 'Limites de vent travers' }
  ];

  const [modelNameInput, setModelNameInput] = useState<string>(modelName || '');
  const [aircraftModelDisplay, setAircraftModelDisplay] = useState<string>(aircraftModel || '');
  const [systemType, setSystemType] = useState<string>('takeoff_distance');
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(true); // Activé par défaut
  const axesMargin = 5; // Marge fixe de 5 unités
  const [interpolationMethod, setInterpolationMethod] = useState<InterpolationMethod>('naturalSpline');
  const [interpolationPoints, setInterpolationPoints] = useState(200);
  const [numIntermediateCurves, setNumIntermediateCurves] = useState(1);
  const [windFilter, setWindFilter] = useState<'all' | 'headwind' | 'tailwind'>('all');

  // Pour compatibilité avec l'ancien système
  const currentGraph = graphs.find(g => g.id === selectedGraphId);
  const axesConfig = currentGraph?.axes || null;

  // Filtrer les courbes selon le filtre vent si le graphique est lié au vent
  const curves = React.useMemo(() => {
    if (!currentGraph) return [];

    if (!currentGraph.isWindRelated || windFilter === 'all') {
      return currentGraph.curves;
    }

    return currentGraph.curves.filter(curve => {
      if (windFilter === 'headwind') {
        return curve.windDirection === 'headwind' || curve.name.toLowerCase().includes('headwind') || curve.name.toLowerCase().includes('vent de face');
      } else if (windFilter === 'tailwind') {
        return curve.windDirection === 'tailwind' || curve.name.toLowerCase().includes('tailwind') || curve.name.toLowerCase().includes('vent arrière');
      }
      return true;
    });
  }, [currentGraph, windFilter]);

  // Fonction pour détecter si un graphique est lié au vent
  const isWindRelatedGraph = (graph: GraphConfig): boolean => {
    const name = graph.name?.toLowerCase() || '';
    const xTitle = graph.axes?.xAxis?.title?.toLowerCase() || '';
    const yTitle = graph.axes?.yAxis?.title?.toLowerCase() || '';
    const xUnit = graph.axes?.xAxis?.unit?.toLowerCase() || '';
    const yUnit = graph.axes?.yAxis?.unit?.toLowerCase() || '';

    const windKeywords = ['vent', 'wind', 'headwind', 'tailwind', 'crosswind', 'vent de face', 'vent arrière'];

    return windKeywords.some(keyword =>
      name.includes(keyword) ||
      xTitle.includes(keyword) ||
      yTitle.includes(keyword) ||
      xUnit.includes(keyword) ||
      yUnit.includes(keyword)
    );
  };

  // Initialize with data if provided
  React.useEffect(() => {
    if (initialData) {
      // Restaurer le systemType depuis les métadonnées si disponible
      if (initialData.metadata?.systemType) {
        setSystemType(initialData.metadata.systemType);
      }

      // Restaurer le nom du modèle depuis les métadonnées
      if (initialData.metadata?.modelName && !aircraftModel) {
        setModelNameInput(initialData.metadata.modelName);
      }

      if (initialData.graphs) {
        // Nouveau format multi-graphiques
        // Vérifier et mettre à jour la propriété isWindRelated si nécessaire
        const updatedGraphs = initialData.graphs.map(graph => ({
          ...graph,
          isWindRelated: graph.isWindRelated !== undefined ? graph.isWindRelated : isWindRelatedGraph(graph)
        }));
        setGraphs(updatedGraphs);
        if (updatedGraphs.length > 0) {
          setSelectedGraphId(updatedGraphs[0].id);
        }
      } else if (initialData.axes && initialData.curves) {
        // Ancien format : créer un graphique unique
        const graph: GraphConfig = {
          id: uuidv4(),
          name: 'Graphique principal',
          axes: initialData.axes,
          curves: initialData.curves,
          isWindRelated: false // Par défaut pour l'ancien format
        };
        // Vérifier si c'est lié au vent
        graph.isWindRelated = isWindRelatedGraph(graph);
        setGraphs([graph]);
        setSelectedGraphId(graph.id);
      }
      setCurrentStep('points');
    }
  }, [initialData, aircraftModel]);

  // Synchroniser le manager avec le graphique sélectionné
  React.useEffect(() => {
    if (!selectedGraphId || !managerRef.current) return;

    const currentGraph = graphs.find(g => g.id === selectedGraphId);
    if (!currentGraph) return;

    // Réinitialiser le manager
    managerRef.current.clear();

    // Configurer les axes si disponibles
    if (currentGraph.axes) {
      managerRef.current.setAxesConfig(currentGraph.axes);
    }

    // Ajouter toutes les courbes non-interpolées au manager
    const nonInterpolatedCurves = currentGraph.curves.filter(c => !c.name.includes('(interpolé)'));
    nonInterpolatedCurves.forEach(curve => {
      const curveId = managerRef.current!.addCurve(curve);
      // Si la courbe a déjà été ajustée, appliquer l'ajustement
      if (curve.fitted) {
        managerRef.current!.fitCurve(curveId, {
          method: interpolationMethod,
          numPoints: interpolationPoints
        });
      }
    });

    console.log(`🔄 Manager synchronisé avec le graphique "${currentGraph.name}": ${nonInterpolatedCurves.length} courbes de base chargées`);
  }, [selectedGraphId, graphs, interpolationMethod, interpolationPoints]);

  // Gestionnaires pour les graphiques
  const handleAddGraph = useCallback((graph: GraphConfig) => {
    setGraphs(prev => [...prev, graph]);
    setSelectedGraphId(graph.id);
  }, []);

  const handleRemoveGraph = useCallback((graphId: string) => {
    setGraphs(prev => prev.filter(g => g.id !== graphId));
    if (selectedGraphId === graphId) {
      setSelectedGraphId(graphs[0]?.id || null);
    }
  }, [selectedGraphId, graphs]);

  const handleUpdateGraph = useCallback((graphId: string, updates: Partial<GraphConfig>) => {
    setGraphs(prev => prev.map(g => {
      if (g.id === graphId) {
        const updatedGraph = { ...g, ...updates };
        // Détecter automatiquement si c'est lié au vent
        if (updates.axes || updates.name) {
          updatedGraph.isWindRelated = isWindRelatedGraph(updatedGraph);
        }
        return updatedGraph;
      }
      return g;
    }));
  }, []);

  // Gestionnaire pour lier deux graphiques
  const handleLinkGraphs = useCallback((fromId: string, toId: string) => {
    setGraphs(prev => prev.map(graph => {
      if (graph.id === fromId) {
        // Ajouter le lien sortant
        return {
          ...graph,
          linkedTo: [...(graph.linkedTo || []), toId]
        };
      } else if (graph.id === toId) {
        // Ajouter le lien entrant
        return {
          ...graph,
          linkedFrom: [...(graph.linkedFrom || []), fromId]
        };
      }
      return graph;
    }));
  }, []);

  // Gestionnaire pour délier deux graphiques
  const handleUnlinkGraphs = useCallback((fromId: string, toId: string) => {
    setGraphs(prev => prev.map(graph => {
      if (graph.id === fromId) {
        // Retirer le lien sortant
        return {
          ...graph,
          linkedTo: (graph.linkedTo || []).filter(id => id !== toId)
        };
      } else if (graph.id === toId) {
        // Retirer le lien entrant
        return {
          ...graph,
          linkedFrom: (graph.linkedFrom || []).filter(id => id !== fromId)
        };
      }
      return graph;
    }));
  }, []);

  const handleAxesSubmit = useCallback((config: AxesConfig) => {
    if (selectedGraphId) {
      handleUpdateGraph(selectedGraphId, { axes: config });
    }
    // Ne pas changer d'étape automatiquement
  }, [selectedGraphId, handleUpdateGraph]);

  const handleAddCurve = useCallback((name: string, color: string, windDirection?: WindDirection) => {
    if (!selectedGraphId) return;

    const newCurve: Curve = {
      id: uuidv4(),
      name,
      color,
      points: [],
      windDirection
    };

    setGraphs(prev => prev.map(g =>
      g.id === selectedGraphId
        ? { ...g, curves: [...g.curves, newCurve] }
        : g
    ));
    setSelectedCurveId(newCurve.id);
  }, [selectedGraphId]);

  const handleRemoveCurve = useCallback((curveId: string) => {
    if (!selectedGraphId) return;

    setGraphs(prev => prev.map(g =>
      g.id === selectedGraphId
        ? { ...g, curves: g.curves.filter(c => c.id !== curveId) }
        : g
    ));

    if (selectedCurveId === curveId) {
      setSelectedCurveId(null);
    }
    const newWarnings = { ...warnings };
    delete newWarnings[curveId];
    setWarnings(newWarnings);
  }, [selectedGraphId, selectedCurveId, warnings]);

  const handleUpdateCurve = useCallback((curveId: string, updates: Partial<Curve>) => {
    if (!selectedGraphId) return;

    setGraphs(prev => prev.map(g =>
      g.id === selectedGraphId
        ? {
            ...g,
            curves: g.curves.map(c =>
              c.id === curveId ? { ...c, ...updates } : c
            )
          }
        : g
    ));
  }, [selectedGraphId]);

  const handleReorderCurves = useCallback((newCurves: Curve[]) => {
    if (!selectedGraphId) return;

    setGraphs(prev => prev.map(g =>
      g.id === selectedGraphId
        ? { ...g, curves: newCurves }
        : g
    ));
  }, [selectedGraphId]);

  const handleAutoAdjustAxes = useCallback((graphId?: string) => {
    const graphsToUpdate = graphId
      ? graphs.filter(g => g.id === graphId)
      : graphs;

    setGraphs(prev => prev.map(g => {
      // Ne traiter que les graphiques sélectionnés
      if (!graphsToUpdate.some(gu => gu.id === g.id)) return g;

      // Ne pas ajuster si pas de points
      if (!g.curves.some(c => c.points.length > 0)) return g;

      // Collecter tous les points
      const allPoints: XYPoint[] = [];
      for (const curve of g.curves) {
        if (curve.points && curve.points.length > 0) {
          allPoints.push(...curve.points);
        }
      }

      // Calculer les nouvelles limites avec la marge configurée
      const newLimits = calculateAutoAxesLimits(allPoints, axesMargin);

      // Mettre à jour les axes si ils existent
      if (g.axes) {
        return {
          ...g,
          axes: updateAxesWithAutoLimits(g.axes, newLimits)
        };
      }

      return g;
    }));
  }, [graphs, axesMargin]);

  const handlePointClick = useCallback((x: number, y: number) => {
    if (!selectedCurveId || !selectedGraphId) return;

    const point: XYPoint = { x, y, id: uuidv4() };

    setGraphs(prev => {
      const updated = prev.map(g =>
        g.id === selectedGraphId
          ? {
              ...g,
              curves: g.curves.map(c =>
                c.id === selectedCurveId
                  ? { ...c, points: [...c.points, point].sort((a, b) => a.x - b.x) }
                  : c
              )
            }
          : g
      );

      // Si l'ajustement automatique est activé, recalculer les limites
      if (autoAdjustEnabled) {
        return updated.map(g => {
          if (g.id === selectedGraphId && g.axes) {
            // Collecter tous les points
            const allPoints: XYPoint[] = [];
            for (const curve of g.curves) {
              if (curve.points && curve.points.length > 0) {
                allPoints.push(...curve.points);
              }
            }
            const newLimits = calculateAutoAxesLimits(allPoints, axesMargin);
            return {
              ...g,
              axes: updateAxesWithAutoLimits(g.axes, newLimits)
            };
          }
          return g;
        });
      }

      return updated;
    });
  }, [selectedCurveId, selectedGraphId, autoAdjustEnabled, axesMargin]);

  const handlePointDrag = useCallback((curveId: string, pointId: string, x: number, y: number) => {
    if (!selectedGraphId) return;

    setGraphs(prev => prev.map(g =>
      g.id === selectedGraphId
        ? {
            ...g,
            curves: g.curves.map(c =>
              c.id === curveId
                ? {
                    ...c,
                    points: c.points.map(p =>
                      p.id === pointId ? { ...p, x, y } : p
                    ).sort((a, b) => a.x - b.x)
                  }
                : c
            )
          }
        : g
    ));
  }, [selectedGraphId]);

  const handlePointDelete = useCallback((curveId: string, pointId: string) => {
    if (!selectedGraphId) return;

    setGraphs(prev => prev.map(g =>
      g.id === selectedGraphId
        ? {
            ...g,
            curves: g.curves.map(c =>
              c.id === curveId
                ? { ...c, points: c.points.filter(p => p.id !== pointId) }
                : c
            )
          }
        : g
    ));
  }, [selectedGraphId]);

  const handleFitCurve = useCallback((curveId: string, options: FitOptions) => {
    console.log('\n🌟 === handleFitCurve - Interpolation individuelle ===');
    console.log('🆔 Courbe ID:', curveId);
    console.log('📈 Options:', options);
    console.log('📉 Graphique sélectionné:', selectedGraphId);

    if (!selectedGraphId) {
      console.warn('⚠️ Aucun graphique sélectionné');
      return;
    }

    // Trouver la courbe dans les graphiques
    const graph = graphs.find(g => g.id === selectedGraphId);
    console.log('📈 Graphique trouvé:', graph ? graph.name : 'NON TROUVÉ');

    const curve = graph?.curves.find(c => c.id === curveId);
    console.log('📍 Courbe trouvée:', curve ? curve.name : 'NON TROUVÉE');

    if (!curve || !curve.points || curve.points.length < 2) {
      console.warn(`⚠️ Courbe ${curveId} non trouvée ou pas assez de points (${curve?.points?.length || 0} points)`);
      return;
    }

    console.log(`📊 Points de la courbe "${curve.name}":`, curve.points.length);
    console.log('📦 Points:', curve.points.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', '));

    try {
      console.log('🏭 Création d\'un manager temporaire pour cette courbe...');
      const tempManager = new AbacCurveManager();

      const tempCurveData = {
        name: curve.name,
        color: curve.color,
        points: curve.points
      };

      console.log('➕ Ajout de la courbe au manager...');
      const tempCurveId = tempManager.addCurve(tempCurveData);
      console.log('🆔 ID temporaire généré:', tempCurveId);

      console.log('🔧 Lancement de l\'interpolation...');
      const result = tempManager.fitCurve(tempCurveId, {
        ...options,
        method: interpolationMethod,
        numPoints: interpolationPoints
      });

      console.log('✅ Interpolation réussie!');
      console.log('📊 Points interpolés:', result.fittedPoints.length);
      console.log('📏 RMSE:', result.rmse.toFixed(4));
      console.log('🔗 Méthode:', result.method);

      setFitResults(prev => {
        console.log('💾 Sauvegarde du résultat pour la courbe', curveId);
        return { ...prev, [curveId]: result };
      });

      if (result.warnings.length > 0) {
        console.warn('⚠️ Avertissements:', result.warnings);
        setWarnings(prev => ({ ...prev, [curveId]: result.warnings }));
      } else {
        setWarnings(prev => {
          const newWarnings = { ...prev };
          delete newWarnings[curveId];
          return newWarnings;
        });
      }

      // Mettre à jour les graphiques
      console.log('🔄 Mise à jour du graphique avec les données interpolées...');
      setGraphs(prev => prev.map(g => {
        if (g.id === selectedGraphId) {
          console.log(`🏦 Mise à jour du graphique "${g.name}"`);
          return {
            ...g,
            curves: g.curves.map(c => {
              if (c.id === curveId) {
                console.log(`✔️ Courbe "${c.name}" mise à jour avec fitted data`);
                return {
                  ...c,
                  fitted: {
                    points: result.fittedPoints,
                    rmse: result.rmse,
                    method: result.method
                  }
                };
              }
              return c;
            })
          };
        }
        return g;
      }));

      console.log('🎉 === Fin de handleFitCurve ===\n');
    } catch (error) {
      console.error(`❌ Erreur lors de l'interpolation de la courbe ${curveId}:`, error);
      console.error('📦 Stack trace:', (error as Error).stack);
    }
  }, [selectedGraphId, graphs]);

  const handleGenerateIntermediateCurves = useCallback(() => {
    if (!selectedGraphId || !managerRef.current) return;

    console.log(`📊 Génération de ${numIntermediateCurves} courbes intermédiaires par paire...`);

    // Générer les courbes intermédiaires
    const newCurveIds = managerRef.current.generateIntermediateCurves(numIntermediateCurves);

    if (newCurveIds.length > 0) {
      // Mettre à jour l'état avec les nouvelles courbes
      const allCurves = managerRef.current.getAllCurves();

      setGraphs(prev => prev.map(graph => {
        if (graph.id === selectedGraphId) {
          return {
            ...graph,
            curves: allCurves
          };
        }
        return graph;
      }));

      console.log(`✅ ${newCurveIds.length} courbes intermédiaires créées`);
    }
  }, [selectedGraphId, numIntermediateCurves]);

  const handleFitAll = useCallback((options: FitOptions = {}) => {
    console.log('🌐 === Début de handleFitAll ===');
    console.log('📈 Options d\'interpolation:', options);
    console.log('📊 Nombre de graphiques à traiter:', graphs.length);

    const newWarnings: Record<string, string[]> = {};
    const allResults: Record<string, FitResult> = {};

    // Interpoler toutes les courbes de tous les graphiques
    setGraphs(prev => {
      console.log('🔄 Mise à jour des graphiques - Nombre:', prev.length);

      return prev.map((graph, graphIndex) => {
        console.log(`\n📉 === Traitement du graphique ${graphIndex + 1}/${prev.length}: "${graph.name}" (ID: ${graph.id}) ===`);
        console.log(`📈 Nombre de courbes dans ce graphique: ${graph.curves.length}`);

        const updatedCurves = graph.curves.map((curve, curveIndex) => {
          console.log(`\n  📍 Courbe ${curveIndex + 1}/${graph.curves.length}: "${curve.name}" (ID: ${curve.id})`);
          console.log(`  🔵 Couleur: ${curve.color}`);
          console.log(`  📊 Nombre de points: ${curve.points?.length || 0}`);

          // Vérifier que la courbe a des points avant d'interpoler
          if (!curve.points || curve.points.length < 2) {
            console.warn(`  ⚠️ Pas assez de points pour interpoler (${curve.points?.length || 0} points)`);
            return curve;
          }

          console.log(`  📦 Points de la courbe:`, curve.points.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', '));

          try {
            console.log('  🏭 Création d\'un manager temporaire...');
            const tempManager = new AbacCurveManager();

            // Ajouter la courbe et récupérer l'ID généré par le manager
            const tempCurveData = {
              name: curve.name,
              color: curve.color,
              points: curve.points
            };
            console.log('  ➕ Ajout de la courbe au manager temporaire...');
            const tempCurveId = tempManager.addCurve(tempCurveData);
            console.log(`  🆔 ID temporaire généré: ${tempCurveId}`);

            // Utiliser l'ID temporaire pour l'interpolation
            console.log(`  🔧 Lancement de l'interpolation avec méthode: ${interpolationMethod}`);
            const result = tempManager.fitCurve(tempCurveId, {
              ...options,
              method: interpolationMethod,
              numPoints: interpolationPoints
            });

            console.log(`  ✅ Interpolation réussie!`);
            console.log(`  📊 Points interpolés: ${result.fittedPoints.length}`);
            console.log(`  📏 RMSE: ${result.rmse.toFixed(4)}`);
            console.log(`  🔗 Méthode utilisée: ${result.method}`);

            if (result.fittedPoints.length > 0) {
              console.log(`  📦 Premiers points interpolés:`,
                result.fittedPoints.slice(0, 3).map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', '));
            }

            allResults[curve.id] = result;

            if (result.warnings.length > 0) {
              console.warn(`  ⚠️ Avertissements:`, result.warnings);
              newWarnings[curve.id] = result.warnings;
            }

            const updatedCurve = {
              ...curve,
              fitted: {
                points: result.fittedPoints,
                rmse: result.rmse,
                method: result.method
              }
            };

            console.log(`  ✔️ Courbe mise à jour avec les données interpolées`);
            return updatedCurve;

          } catch (error) {
            console.error(`  ❌ Erreur lors de l'interpolation de la courbe "${curve.name}":`, error);
            console.error('  📦 Stack trace:', (error as Error).stack);
            return curve;
          }
        });

        console.log(`🏁 === Fin du traitement du graphique "${graph.name}" ===`);
        console.log(`📊 Courbes interpolées: ${updatedCurves.filter(c => c.fitted).length}/${updatedCurves.length}`);

        return {
          ...graph,
          curves: updatedCurves
        };
      });
    });

    console.log('\n🎆 === Résumé de l\'interpolation ===');
    console.log('📊 Nombre total de résultats:', Object.keys(allResults).length);
    console.log('⚠️ Nombre d\'avertissements:', Object.keys(newWarnings).length);

    setFitResults(allResults);
    setWarnings(newWarnings);

    console.log('🎉 === Fin de handleFitAll ===\n');
  }, [graphs]);

  const handleClearPoints = useCallback((curveId: string) => {
    if (!selectedGraphId) return;

    const curve = managerRef.current.getCurve(curveId);
    if (curve) {
      curve.points.forEach(p => {
        if (p.id) managerRef.current.removePoint(curveId, p.id);
      });
    }

    setGraphs(prev => prev.map(graph => {
      if (graph.id === selectedGraphId) {
        return {
          ...graph,
          curves: graph.curves.map(c =>
            c.id === curveId ? { ...c, points: [], fitted: undefined } : c
          )
        };
      }
      return graph;
    }));

    setWarnings(prev => {
      const newWarnings = { ...prev };
      delete newWarnings[curveId];
      return newWarnings;
    });
  }, [selectedGraphId]);

  // Effect pour l'interpolation automatique à l'étape 3
  // Utiliser un flag pour éviter les boucles infinies
  const [hasAutoInterpolated, setHasAutoInterpolated] = React.useState(false);

  React.useEffect(() => {
    console.log('🔄 useEffect pour l\'interpolation automatique');
    console.log('📌 Étape actuelle:', currentStep);
    console.log('🏁 Déjà interpolé?:', hasAutoInterpolated);

    if (currentStep === 'fit' && !hasAutoInterpolated) {
      console.log('🎟️ Nous sommes à l\'étape "fit" et pas encore auto-interpolé');

      // Vérifier si des courbes n'ont pas encore été interpolées
      const unfittedInfo = graphs.map(g => ({
        graphName: g.name,
        curves: g.curves.map(c => ({
          name: c.name,
          points: c.points.length,
          fitted: !!c.fitted,
          needsFitting: c.points.length >= 2 && !c.fitted
        }))
      }));

      console.log('📈 État des courbes:', unfittedInfo);

      const hasUnfittedCurves = graphs.some(g =>
        g.curves.some(c => c.points.length >= 2 && !c.fitted)
      );

      console.log('🤔 Courbes non interpolées trouvées?:', hasUnfittedCurves);

      if (hasUnfittedCurves) {
        console.log('🚀 Lancement de l\'interpolation automatique...');
        // Marquer comme interpolé avant de lancer l'interpolation
        setHasAutoInterpolated(true);
        // Interpoler toutes les courbes automatiquement
        handleFitAll({ method: 'pchip' });
      } else {
        console.log('✅ Toutes les courbes sont déjà interpolées ou n\'ont pas assez de points');
      }
    }

    // Réinitialiser le flag quand on quitte l'étape 3
    if (currentStep !== 'fit') {
      console.log('🔄 Réinitialisation du flag hasAutoInterpolated');
      setHasAutoInterpolated(false);
    }
  }, [currentStep, graphs, handleFitAll]);

  const handleImportPoints = useCallback((curveId: string, points: XYPoint[]) => {
    if (!selectedGraphId) return;

    points.forEach(p => {
      managerRef.current.addPoint(curveId, { ...p, id: uuidv4() });
    });

    setGraphs(prev => prev.map(graph => {
      if (graph.id === selectedGraphId) {
        return {
          ...graph,
          curves: graph.curves.map(c =>
            c.id === curveId
              ? { ...c, points: [...c.points, ...points].sort((a, b) => a.x - b.x) }
              : c
          )
        };
      }
      return graph;
    }));
  }, [selectedGraphId]);

  // Fonction d'export d'itération (étape 2)
  // Fonction d'import d'itération (étape 2)
  const handleImportIteration = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const iterationData = JSON.parse(e.target?.result as string);

        if (iterationData.version?.includes('iteration')) {
          // Charger les données de l'itération
          setGraphs(iterationData.graphs || []);
          setSelectedGraphId(iterationData.selectedGraphId || null);
          setSelectedCurveId(iterationData.selectedCurveId || null);

          // Rester sur l'étape actuelle ou aller à l'étape sauvegardée
          if (iterationData.step && ['axes', 'points', 'fit', 'final'].includes(iterationData.step)) {
            setCurrentStep(iterationData.step);
          }

          // Message de succès
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3000);
        } else {
          alert('Ce fichier n\'est pas une itération valide');
        }
      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('Erreur lors de l\'import du fichier');
      }
    };
    reader.readAsText(file);

    // Import réussi
  }, []);

  const handleExportJSON = useCallback(() => {
    // Préparer les données au nouveau format multi-graphiques
    const json: AbacCurvesJSON = {
      version: '2.0',
      graphs: graphs,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        systemType: systemType,
        systemName: SYSTEM_TYPES.find(t => t.value === systemType)?.label || 'Système d\'abaques',
        modelName: aircraftModel || modelNameInput,
        aircraftModel: aircraftModel, // Sauvegarder explicitement le modèle d'avion
        description: `${SYSTEM_TYPES.find(t => t.value === systemType)?.label} pour ${aircraftModel || modelNameInput || 'modèle non spécifié'}`
      }
    };

    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Utiliser le systemName pour le nom du fichier pour éviter l'accumulation
    const systemName = SYSTEM_TYPES.find(t => t.value === systemType)?.label || 'Système d\'abaques';
    const modelNameForFile = aircraftModel || modelNameInput || 'modèle';
    a.download = `${systemName}-${modelNameForFile}-${systemType}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (onSave) {
      onSave(json, aircraftModel || modelNameInput);
    }
  }, [onSave, graphs, modelNameInput, aircraftModel, systemType]);

  const handleImportJSON = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);

        // Vérifier la version
        if (importedData.version && importedData.graphs) {
          // Importer les graphiques avec détection automatique du vent
          const updatedGraphs = importedData.graphs.map((graph: GraphConfig) => ({
            ...graph,
            isWindRelated: graph.isWindRelated !== undefined ? graph.isWindRelated : isWindRelatedGraph(graph)
          }));

          setGraphs(updatedGraphs);

          // Restaurer les métadonnées
          if (importedData.metadata) {
            if (importedData.metadata.systemType) {
              setSystemType(importedData.metadata.systemType);
            }
            // Utiliser aircraftModel en priorité, sinon utiliser le modelName importé
            // Vérifier que modelName n'est pas une description complète (ne contient pas "pour")
            if (importedData.metadata.modelName && !aircraftModel && !importedData.metadata.modelName.includes(' pour ')) {
              setModelNameInput(importedData.metadata.modelName);
            } else if (importedData.metadata.aircraftModel && !aircraftModel) {
              // Utiliser le champ aircraftModel s'il existe
              setModelNameInput(importedData.metadata.aircraftModel);
            }
            // Si un modèle d'avion est fourni par le wizard, l'utiliser en priorité
            if (importedData.metadata.aircraftModel) {
              setAircraftModelDisplay(importedData.metadata.aircraftModel);
            }
          }

          if (updatedGraphs.length > 0) {
            setSelectedGraphId(updatedGraphs[0].id);
          }

          setCurrentStep('points');
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3000);
        } else {
          alert('Format de fichier non reconnu');
        }
      } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('Erreur lors de l\'import du fichier');
      }
    };
    reader.readAsText(file);

    // Reset le champ fichier
    event.target.value = '';
  }, [aircraftModel]);

const renderStepContent = () => {
    switch (currentStep) {
      case 'axes':
        return (
          <div className={styles.stepContent}>
            <h2>Étape 1: Configuration du système - {SYSTEM_TYPES.find(t => t.value === systemType)?.label || 'Système d\'abaques'}</h2>
            {importSuccess && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#4CAF50',
                color: 'white',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                ✅ Configuration importée avec succès !
              </div>
            )}
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              <FormControl fullWidth variant="outlined" style={{ marginBottom: '16px' }}>
                <InputLabel>Type de système d'abaques</InputLabel>
                <Select
                  value={systemType}
                  onChange={(e) => setSystemType(e.target.value)}
                  label="Type de système d'abaques"
                >
                  {SYSTEM_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Ce type sera utilisé comme identifiant dans l'application pour référencer ce système
                </FormHelperText>
              </FormControl>

              <TextField
                label="Modèle d'avion"
                value={aircraftModel || ''}
                disabled={true}
                fullWidth
                variant="outlined"
                placeholder="Ex: Cessna 172"
                helperText={aircraftModel ? "Modèle récupéré automatiquement depuis les informations de l'appareil" : "Aucun modèle d'avion configuré"}
              />

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleExportJSON}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    flex: 1
                  }}
                  disabled={graphs.length === 0}
                >
                  📥 Exporter la configuration
                </button>
                <label
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  📤 Importer une configuration
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
            <div className={styles.workspace}>
              <div className={styles.sidebar}>
                <GraphManager
                  graphs={graphs}
                  selectedGraphId={selectedGraphId}
                  onAddGraph={handleAddGraph}
                  onRemoveGraph={handleRemoveGraph}
                  onSelectGraph={setSelectedGraphId}
                  onUpdateGraph={handleUpdateGraph}
                  onLinkGraphs={handleLinkGraphs}
                  onUnlinkGraphs={handleUnlinkGraphs}
                />
              </div>
              <div className={styles.mainArea}>
                {selectedGraphId ? (
                  <>
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '6px',
                      border: '1px solid #2196F3'
                    }}>
                      <h3 style={{ margin: 0, color: '#1976d2', fontSize: '16px', fontWeight: 600 }}>
                        Configuration des axes pour : {currentGraph?.name}
                      </h3>
                      {currentGraph?.axes && (
                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                          <strong>X:</strong> {currentGraph.axes.xAxis.title}
                          ({currentGraph.axes.xAxis.min} - {currentGraph.axes.xAxis.max} {currentGraph.axes.xAxis.unit})
                          {currentGraph.axes.xAxis.reversed && (
                            <span style={{ marginLeft: '8px', color: '#ff9800' }}>
                              [← Décroissant]
                            </span>
                          )}
                          <br />
                          <strong>Y:</strong> {currentGraph.axes.yAxis.title}
                          ({currentGraph.axes.yAxis.min} - {currentGraph.axes.yAxis.max} {currentGraph.axes.yAxis.unit})
                          {currentGraph.axes.yAxis.reversed && (
                            <span style={{ marginLeft: '8px', color: '#ff9800' }}>
                              [↓ Décroissant]
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <AxesForm
                      key={selectedGraphId} // Force le rechargement du formulaire
                      onSubmit={handleAxesSubmit}
                      initialConfig={currentGraph?.axes || undefined}
                    />
                  </>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#999'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <h3>Créez votre premier graphique</h3>
                    <p>Commencez par ajouter un graphique dans le panneau de gauche</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'points':
        return (
          <div className={styles.stepContent}>
            <h2>Étape 2: Construction et Interpolation - "{SYSTEM_TYPES.find(t => t.value === systemType)?.label || 'Abaques'}"</h2>
            {/* Ligne horizontale avec les 3 cartouches */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {/* Cartouche 1: Ajustement des axes */}
              <div style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#e3f2fd',
                borderRadius: '6px',
                border: '1px solid #2196F3'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  color: '#1976d2'
                }}>
                  🔧 Ajustement des axes
                </div>
                {axesConfig && (
                  <>
                    <button
                      onClick={() => handleAutoAdjustAxes(selectedGraphId)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        width: '100%',
                        marginBottom: '6px'
                      }}
                      title="Ajuste automatiquement les axes en fonction des points saisis"
                    >
                      Ajuster auto
                    </button>
                    <div style={{
                      fontSize: '10px',
                      color: '#4CAF50',
                      textAlign: 'center'
                    }}>
                      ✅ Marge: 5 unités
                    </div>
                  </>
                )}
              </div>

              {/* Cartouche 2: Courbes intermédiaires */}
              <div style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#f3e5f5',
                borderRadius: '6px',
                border: '1px solid #9C27B0'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  color: '#7B1FA2'
                }}>
                  ✨ Courbes intermédiaires
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                  <input
                    type="number"
                    value={numIntermediateCurves}
                    onChange={(e) => setNumIntermediateCurves(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '3px',
                      border: '1px solid #ccc',
                      fontSize: '11px',
                      width: '40px'
                    }}
                    min="1"
                    max="5"
                  />
                  <button
                    onClick={handleGenerateIntermediateCurves}
                    style={{
                      flex: 1,
                      padding: '4px 10px',
                      fontSize: '11px',
                      backgroundColor: '#9C27B0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                    disabled={!selectedGraphId || !currentGraph || currentGraph.curves.length < 2}
                  >
                    Générer
                  </button>
                </div>
                {currentGraph && currentGraph.curves.filter(c => c.name.includes('(interpolé)')).length > 0 && (
                  <button
                    onClick={() => {
                      const nonInterpolatedCurves = currentGraph.curves.filter(c => !c.name.includes('(interpolé)'));
                      setGraphs(prev => prev.map(g =>
                        g.id === selectedGraphId
                          ? { ...g, curves: nonInterpolatedCurves }
                          : g
                      ));
                    }}
                    style={{
                      width: '100%',
                      padding: '4px 10px',
                      fontSize: '10px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Supprimer ({currentGraph.curves.filter(c => c.name.includes('(interpolé)')).length})
                  </button>
                )}
                <div style={{
                  fontSize: '10px',
                  color: '#666',
                  textAlign: 'center',
                  marginTop: '4px'
                }}>
                  Entre les courbes existantes
                </div>
              </div>

              {/* Cartouche 3: Interpolation des courbes */}
              <div style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#e8f5e9',
                borderRadius: '6px',
                border: '1px solid #4CAF50'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  color: '#2e7d32'
                }}>
                  💡 Interpolation
                </div>
                <button
                  onClick={() => handleFitAll({ method: interpolationMethod, numPoints: interpolationPoints })}
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%',
                    marginBottom: '6px'
                  }}
                  disabled={!currentGraph || currentGraph.curves.length === 0}
                >
                  🎯 Interpoler tout
                </button>
                <div style={{
                  fontSize: '10px',
                  color: '#666',
                  textAlign: 'center'
                }}>
                  Lissage des courbes
                </div>
              </div>
            </div>

            {importSuccess && (
              <div style={{
                marginBottom: '16px',
                padding: '8px',
                backgroundColor: '#4CAF50',
                color: 'white',
                borderRadius: '4px',
                fontSize: '12px',
                textAlign: 'center'
              }}>
                ✅ Itération importée avec succès !
              </div>
            )}

              {/* Main content area with sidebar and chart */}
              <div style={{ display: 'flex', gap: '16px', height: 'calc(100% - 200px)', marginTop: '16px' }}>
              {/* Sidebar avec gestionnaire de courbes */}
              <div style={{
                width: '300px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                overflowY: 'auto'
              }}>
                {currentGraph && (
                  <>
                    <CurveManager
                      curves={curves}
                      selectedCurveId={selectedCurveId}
                      onAddCurve={handleAddCurve}
                      onRemoveCurve={handleRemoveCurve}
                      onSelectCurve={setSelectedCurveId}
                      onUpdateCurve={handleUpdateCurve}
                      onReorderCurves={handleReorderCurves}
                      isWindRelated={currentGraph?.isWindRelated || false}
                    />
                    {axesConfig && (
                      <PointsTable
                        curves={curves}
                        selectedCurveId={selectedCurveId}
                        axesConfig={axesConfig}
                        onUpdatePoint={handlePointDrag}
                        onDeletePoint={handlePointDelete}
                        onAddPoint={handlePointClick}
                        onSelectCurve={setSelectedCurveId}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Grille de graphiques */}
              <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: graphs.length === 1 ? '1fr' :
                                   graphs.length === 2 ? 'repeat(2, 1fr)' :
                                   graphs.length === 3 ? 'repeat(3, 1fr)' :
                                   'repeat(2, 1fr)',
                gridTemplateRows: graphs.length <= 3 ? '1fr' : 'repeat(2, 1fr)',
                gap: '16px',
                padding: '16px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                overflow: 'auto'
              }}>
                {graphs.map(graph => (
                  <div
                    key={graph.id}
                    onClick={() => {
                      setSelectedGraphId(graph.id);
                      // Sélectionner la première courbe du graphique si elle existe
                      if (graph.curves.length > 0 && !graph.curves.find(c => c.id === selectedCurveId)) {
                        setSelectedCurveId(graph.curves[0].id);
                      }
                    }}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      padding: '12px',
                      border: selectedGraphId === graph.id ? '3px solid #4CAF50' : '1px solid #ddd',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '300px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      marginBottom: '8px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #eee',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: selectedGraphId === graph.id ? '#4CAF50' : '#333'
                        }}>
                          {graph.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {graph.curves.length} courbe{graph.curves.length !== 1 ? 's' : ''}
                        </div>
                        {/* Affichage des liaisons */}
                        {(graph.linkedFrom?.length > 0 || graph.linkedTo?.length > 0) && (
                          <div style={{
                            marginTop: '4px',
                            fontSize: '10px'
                          }}>
                            {graph.linkedFrom?.map(fromId => {
                              const fromGraph = graphs.find(g => g.id === fromId);
                              return fromGraph && (
                                <div key={fromId} style={{ color: '#2196F3' }}>
                                  ← {fromGraph.name} (Y → X)
                                </div>
                              );
                            })}
                            {graph.linkedTo?.map(toId => {
                              const toGraph = graphs.find(g => g.id === toId);
                              return toGraph && (
                                <div key={toId} style={{ color: '#4CAF50' }}>
                                  → {toGraph.name} (Y → X)
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {graph.axes ? (
                      <div style={{ flex: 1, position: 'relative' }}>
                        <Chart
                          axesConfig={graph.axes}
                          curves={graph.curves}
                          selectedCurveId={selectedGraphId === graph.id ? selectedCurveId : null}
                          onPointClick={selectedGraphId === graph.id ? handlePointClick : undefined}
                          onPointDrag={selectedGraphId === graph.id ? handlePointDrag : undefined}
                          onPointDelete={selectedGraphId === graph.id ? handlePointDelete : undefined}
                          width={400}
                          height={300}
                        />
                      </div>
                    ) : (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                        fontSize: '13px'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                          Axes non configurés
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {graphs.length === 0 && (
                  <div style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '400px',
                    color: '#999'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                      <h3>Aucun graphique créé</h3>
                      <p>Retournez à l'étape 1 pour créer des graphiques</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'fit':
        // L'étape 3 est maintenant intégrée dans l'étape 2
        setCurrentStep('final');
        return null;

      case 'fit_old':
        return (
          <div className={styles.stepContent}>
            <h2>Étape 3: Interpolation des Courbes</h2>
            <div style={{
              backgroundColor: '#e3f2fd',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: '#1976d2' }}>
                    📊 L'interpolation a été appliquée automatiquement à toutes les courbes.
                    Les courbes interpolées sont affichées ci-dessous.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                      Méthode d'interpolation
                    </label>
                    <select
                      value={interpolationMethod}
                      onChange={(e) => {
                        setInterpolationMethod(e.target.value as InterpolationMethod);
                        // Réinterpoler toutes les courbes avec la nouvelle méthode
                        handleFitAll();
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontSize: '13px',
                        minWidth: '150px'
                      }}
                    >
                      <option value="naturalSpline">🎨 Spline cubique naturelle</option>
                      <option value="catmullRom">🎢 Catmull-Rom</option>
                      <option value="pchip">🌁 PCHIP</option>
                      <option value="akima">🌀 Akima</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                      Nombre de points
                    </label>
                    <input
                      type="number"
                      value={interpolationPoints}
                      onChange={(e) => {
                        const value = Math.max(50, Math.min(500, parseInt(e.target.value) || 200));
                        setInterpolationPoints(value);
                      }}
                      onBlur={() => handleFitAll()}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontSize: '13px',
                        width: '80px'
                      }}
                      min="50"
                      max="500"
                    />
                  </div>
                </div>

                {/* Contrôles pour les courbes intermédiaires */}
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>
                      🔄 Courbes intermédiaires
                    </h4>
                    <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                      Générez des courbes interpolées entre vos courbes de référence pour améliorer la précision
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                        Nombre de courbes intermédiaires
                      </label>
                      <input
                        type="number"
                        value={numIntermediateCurves}
                        onChange={(e) => setNumIntermediateCurves(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #ccc',
                          fontSize: '13px',
                          width: '60px'
                        }}
                        min="1"
                        max="5"
                      />
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>
                        (entre chaque paire)
                      </span>
                    </div>
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={handleGenerateIntermediateCurves}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#9C27B0',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      disabled={!selectedGraphId || !currentGraph || currentGraph.curves.length < 2}
                      title={!currentGraph || currentGraph.curves.length < 2 ?
                        'Il faut au moins 2 courbes de référence pour générer des courbes intermédiaires' :
                        'Génère des courbes interpolées entre les courbes existantes'}
                    >
                      ✨ Générer courbes intermédiaires
                    </button>
                    {currentGraph && currentGraph.curves.filter(c => c.name.includes('(interpolé)')).length > 0 && (
                      <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => {
                          // Supprimer les courbes interpolées
                          const nonInterpolatedCurves = currentGraph.curves.filter(c => !c.name.includes('(interpolé)'));
                          setGraphs(prev => prev.map(g =>
                            g.id === selectedGraphId
                              ? { ...g, curves: nonInterpolatedCurves }
                              : g
                          ));
                          // Reconstruire le manager
                          if (managerRef.current && currentGraph.axes) {
                            managerRef.current.clear();
                            managerRef.current.setAxesConfig(currentGraph.axes);
                            nonInterpolatedCurves.forEach(curve => {
                              const curveId = managerRef.current!.addCurve(curve);
                              if (curve.fitted) {
                                managerRef.current!.fitCurve(curveId, {
                                  method: interpolationMethod,
                                  numPoints: interpolationPoints
                                });
                              }
                            });
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Supprimer interpolées ({currentGraph.curves.filter(c => c.name.includes('(interpolé)')).length})
                      </button>
                    )}
                  </div>
                  {currentGraph && currentGraph.curves.length > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
                      <span>
                        {currentGraph.curves.filter(c => !c.name.includes('(interpolé)')).length} courbes de référence,
                        {' '}{currentGraph.curves.filter(c => c.name.includes('(interpolé)')).length} courbes interpolées
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Affichage en grille de tous les graphiques avec leurs courbes interpolées */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '20px'
            }}>
              {graphs.map(graph => (
                <div key={graph.id} style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: 'white'
                }}>
                  <h3 style={{ marginBottom: '12px' }}>{graph.name}</h3>
                  {graph.axes && (
                    <>
                      <Chart
                        axesConfig={graph.axes}
                        curves={graph.curves}
                        selectedCurveId={null}
                        showLegend={true}
                        width={400}
                        height={300}
                      />
                      <div style={{
                        marginTop: '12px',
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {graph.curves.map(curve => (
                          <div key={curve.id} style={{ marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', color: curve.color }}>
                              {curve.name}:
                            </span>
                            {curve.fitted ? (
                              <span style={{ color: '#4caf50', marginLeft: '8px' }}>
                                ✓ Interpolée (RMSE: {curve.fitted.rmse.toFixed(4)})
                              </span>
                            ) : (
                              <span style={{ color: '#ff9800', marginLeft: '8px' }}>
                                ⚠ Non interpolée
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Bouton pour ré-interpoler si nécessaire */}
            <div style={{
              marginTop: '20px',
              textAlign: 'center'
            }}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => handleFitAll({ method: 'pchip' })}
              >
                Ré-interpoler toutes les courbes
              </button>
            </div>
          </div>
        );

      case 'final':
        console.log('🎯 Étape finale - État des graphiques:');
        graphs.forEach(graph => {
          console.log(`📉 ${graph.name}:`, {
            axes: !!graph.axes,
            courbes: graph.curves.length,
            courbesInterpolées: graph.curves.filter(c => c.fitted).length,
            points: graph.curves.map(c => ({
              name: c.name,
              originalPoints: c.points?.length,
              fittedPoints: c.fitted?.points?.length || 0,
              rmse: c.fitted?.rmse
            }))
          });
        });

        return (
          <div className={styles.stepContent}>
            <h2>Étape 3: Validation finale</h2>
            <div className={styles.finalView}>
              {/* Affichage des informations du système */}
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#f0f7ff',
                borderRadius: '8px',
                border: '1px solid #2196F3'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#1976d2' }}>
                  Configuration du système
                </h3>
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                  <div><strong>Type de système :</strong> {SYSTEM_TYPES.find(t => t.value === systemType)?.label}</div>
                  <div><strong>Modèle d'avion :</strong> {aircraftModel || modelNameInput || 'Non spécifié'}</div>
                  <div><strong>Identifiant système :</strong> <code>{systemType}</code></div>
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                    Cet identifiant sera utilisé pour référencer ce système dans l'application
                  </div>
                </div>

                {/* Bouton Sauvegarder le modèle */}
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={handleExportJSON}
                    disabled={!modelNameInput}
                    title="Exporter le modèle complet"
                    style={{
                      padding: '10px 24px',
                      fontSize: '14px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: modelNameInput ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 'bold',
                      opacity: modelNameInput ? 1 : 0.6
                    }}
                  >
                    💾 Sauvegarder le modèle
                  </button>
                </div>
              </div>

              {/* Filtre pour les courbes vent - visible uniquement si au moins un graphique est lié au vent */}
              {false && graphs.some(g => g.isWindRelated) && (
                <div style={{
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '8px',
                  border: '1px solid #2196F3'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', color: '#1976d2' }}>
                    💨 Filtrer les courbes par direction du vent
                  </h3>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        onClick={() => setWindFilter('all')}
                        style={{
                          padding: '8px 16px',
                          fontSize: '14px',
                          backgroundColor: windFilter === 'all' ? '#2196F3' : '#fff',
                          color: windFilter === 'all' ? '#fff' : '#2196F3',
                          border: '2px solid #2196F3',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: windFilter === 'all' ? 'bold' : 'normal',
                          transition: 'all 0.2s'
                        }}
                      >
                        🌐 Toutes les courbes
                      </button>
                      <button
                        onClick={() => setWindFilter('headwind')}
                        style={{
                          padding: '8px 16px',
                          fontSize: '14px',
                          backgroundColor: windFilter === 'headwind' ? '#4CAF50' : '#fff',
                          color: windFilter === 'headwind' ? '#fff' : '#4CAF50',
                          border: '2px solid #4CAF50',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: windFilter === 'headwind' ? 'bold' : 'normal',
                          transition: 'all 0.2s'
                        }}
                      >
                        ⬅️ Vent de face (Headwind)
                      </button>
                      <button
                        onClick={() => setWindFilter('tailwind')}
                        style={{
                          padding: '8px 16px',
                          fontSize: '14px',
                          backgroundColor: windFilter === 'tailwind' ? '#FF9800' : '#fff',
                          color: windFilter === 'tailwind' ? '#fff' : '#FF9800',
                          border: '2px solid #FF9800',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: windFilter === 'tailwind' ? 'bold' : 'normal',
                          transition: 'all 0.2s'
                        }}
                      >
                        ➡️ Vent arrière (Tailwind)
                      </button>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#666',
                    backgroundColor: '#fff',
                    padding: '8px',
                    borderRadius: '4px'
                  }}>
                    {windFilter === 'all' && (
                      <>
                        <strong>Mode actuel :</strong> Affichage de toutes les courbes
                        <br />
                        Les graphiques ci-dessous montrent toutes les courbes, quel que soit le type de vent.
                      </>
                    )}
                    {windFilter === 'headwind' && (
                      <>
                        <strong>Mode actuel :</strong> Courbes avec vent de face uniquement
                        <br />
                        Les graphiques ci-dessous affichent uniquement les courbes correspondant à un vent de face.
                      </>
                    )}
                    {windFilter === 'tailwind' && (
                      <>
                        <strong>Mode actuel :</strong> Courbes avec vent arrière uniquement
                        <br />
                        Les graphiques ci-dessous affichent uniquement les courbes correspondant à un vent arrière.
                      </>
                    )}
                  </div>
                </div>
              )}


              {/* Affichage des graphiques */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '20px',
                marginBottom: '20px'
              }}>
                {graphs.map(graph => {
                  // Appliquer le filtre vent si le graphique est lié au vent
                  let displayCurves = graph.curves;
                  if (graph.isWindRelated && windFilter !== 'all') {
                    displayCurves = graph.curves.filter(curve => {
                      if (windFilter === 'headwind') {
                        return curve.windDirection === 'headwind' ||
                               curve.name.toLowerCase().includes('headwind') ||
                               curve.name.toLowerCase().includes('vent de face');
                      } else if (windFilter === 'tailwind') {
                        return curve.windDirection === 'tailwind' ||
                               curve.name.toLowerCase().includes('tailwind') ||
                               curve.name.toLowerCase().includes('vent arrière');
                      }
                      return true;
                    });
                  }

                  return (
                    <div key={graph.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px' }}>
                      <h3 style={{ marginBottom: '12px' }}>
                        {graph.name}
                        {graph.isWindRelated && (
                          <span style={{
                            fontSize: '11px',
                            color: '#1976d2',
                            marginLeft: '8px',
                            backgroundColor: '#e3f2fd',
                            padding: '2px 6px',
                            borderRadius: '3px'
                          }}>
                            💨 {windFilter === 'headwind' ? 'Vent de face' : windFilter === 'tailwind' ? 'Vent arrière' : 'Tous les vents'}
                          </span>
                        )}
                        {graph.linkedFrom && graph.linkedFrom.length > 0 && (
                          <span style={{ fontSize: '12px', color: '#2196F3', marginLeft: '8px' }}>
                            (← Reçoit)
                          </span>
                        )}
                        {graph.linkedTo && graph.linkedTo.length > 0 && (
                          <span style={{ fontSize: '12px', color: '#4CAF50', marginLeft: '8px' }}>
                            (→ Envoie)
                          </span>
                        )}
                      </h3>
                      {graph.axes && (
                        <Chart
                          axesConfig={graph.axes}
                          curves={displayCurves}
                          selectedCurveId={null}
                          showLegend={true}
                          width={400}
                          height={300}
                        />
                      )}
                      {graph.isWindRelated && displayCurves.length === 0 && (
                        <div style={{
                          padding: '20px',
                          textAlign: 'center',
                          color: '#999',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px'
                        }}>
                          Aucune courbe {windFilter === 'headwind' ? 'vent de face' : 'vent arrière'} dans ce graphique
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {importSuccess && (
                <div style={{
                  marginTop: '16px',
                  padding: '8px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '12px',
                  textAlign: 'center'
                }}>
                  ✅ Fichier importé avec succès !
                </div>
              )}
              {Object.keys(warnings).length > 0 && (
                <div className={styles.finalWarnings}>
                  <h3>Warnings</h3>
                  {Object.entries(warnings).map(([curveId, curveWarnings]) => {
                    const curve = curves.find(c => c.id === curveId);
                    return (
                      <div key={curveId}>
                        <strong>{curve?.name}:</strong>
                        <ul>
                          {curveWarnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'axes':
        // Au moins un graphique doit être configuré avec ses axes
        return graphs.length > 0 && graphs.some(g => g.axes !== null);
      case 'points':
        // Au moins une courbe avec 2 points minimum
        return graphs.some(g => g.curves.some(c => c.points.length >= 2));
      case 'final':
        return true;
      default:
        return false;
    }
  };

  const steps: Step[] = ['axes', 'points', 'final'];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className={styles.abacBuilder}>
      <div className={styles.stepper}>
        {steps.map((step, index) => (
          <div
            key={step}
            className={`${styles.step} ${currentStep === step ? styles.stepActive : ''} ${index < currentStepIndex ? styles.stepCompleted : ''}`}
            onClick={() => {
              if (index < currentStepIndex || (index === currentStepIndex + 1 && canProceed())) {
                setCurrentStep(step);
              }
            }}
          >
            <div className={styles.stepNumber}>{index + 1}</div>
            <div className={styles.stepLabel}>
              {step === 'axes' && 'Configurer les Axes'}
              {step === 'points' && 'Construire et Interpoler'}
              {step === 'final' && 'Validation'}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.builderContent}>
        {renderStepContent()}
      </div>

      <div className={styles.navigation}>
        {currentStepIndex > 0 && (
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setCurrentStep(steps[currentStepIndex - 1])}
          >
            Précédent
          </button>
        )}
        {currentStepIndex < steps.length - 1 && (
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setCurrentStep(steps[currentStepIndex + 1])}
            disabled={!canProceed()}
          >
            {currentStep === 'axes' ? 'Construire les courbes' : 'Finaliser'}
          </button>
        )}
      </div>
    </div>
  );
};