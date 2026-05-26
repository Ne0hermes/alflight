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
import { analyzeChartImage } from '../../v2/aiChartAnalysisService';
import {
  AxesConfig,
  Curve,
  XYPoint,
  FitOptions,
  FitResult,
  AbacCurvesJSON,
  GraphConfig,
  WindDirection,
  InterpolationMethod
} from '../core/types';
import styles from './styles.module.css';

type Step = 'axes' | 'points' | 'final';

interface AbacBuilderProps {
  onSave?: (json: AbacCurvesJSON, modelName?: string) => void;
  initialData?: AbacCurvesJSON;
  modelName?: string;
  aircraftModel?: string;
  onBack?: () => void;
}

// Exposer les méthodes via un ref
export interface AbacBuilderRef {
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  getCurrentStep: () => Step;
}

// Define the component function separately
function AbacBuilderComponent(
  { onSave, initialData, modelName, aircraftModel, onBack }: AbacBuilderProps,
  ref: React.Ref<AbacBuilderRef>
) {
  const managerRef = useRef(new AbacCurveManager());
  const [currentStep, setCurrentStep] = useState<Step>('axes');

  React.useEffect(() => {
        return () => {
          };
  }, []);

  // Exposer les méthodes via useImperativeHandle
  React.useImperativeHandle(ref, () => ({
    goToNextStep: () => {
      const steps: Step[] = ['axes', 'points', 'final'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex < steps.length - 1) {
        const nextStep = steps[currentIndex + 1];
                setCurrentStep(nextStep);
      }
    },
    goToPreviousStep: () => {
      const steps: Step[] = ['axes', 'points', 'final'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex > 0) {
        const previousStep = steps[currentIndex - 1];
                setCurrentStep(previousStep);
      }
    },
    getCurrentStep: () => currentStep
  }));
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

  const [modelNameInput, setModelNameInput] = useState<string>(
    modelName || SYSTEM_TYPES.find(t => t.value === 'takeoff_distance')?.label || ''
  );
  const [aircraftModelDisplay, setAircraftModelDisplay] = useState<string>(aircraftModel || '');
  const [systemType, setSystemType] = useState<string>('takeoff_distance');
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(false); // Désactivé par défaut
  const axesMargin = 5; // Marge fixe de 5 unités
  const [interpolationMethod, setInterpolationMethod] = useState<InterpolationMethod>('naturalSpline');
  const [interpolationPoints, setInterpolationPoints] = useState(200);
  const [numIntermediateCurves, setNumIntermediateCurves] = useState(1);
  const [windFilter, setWindFilter] = useState<'all' | 'headwind' | 'tailwind'>('all');
  const [expandedGraphs, setExpandedGraphs] = useState<Record<string, boolean>>({});

  // Image en filigrane PDF par graphique (clé = graphId)
  // Stockée en pixels SVG inner — reste fixe en pixels CSS quand le Chart est resize.
  const [backgroundImages, setBackgroundImages] = useState<Record<string, { url: string; x: number; y: number; width: number; height: number }>>({});
  // Graph pour lequel le mode "ajuster image" est actif (un seul à la fois)
  const [imageAdjustGraphId, setImageAdjustGraphId] = useState<string | null>(null);
  // Détection IA en cours pour ce graphId (loader)
  const [aiDetectingGraphId, setAiDetectingGraphId] = useState<string | null>(null);
  // Notes IA dernière analyse (pour feedback utilisateur)
  const [aiNotes, setAiNotes] = useState<Record<string, string>>({});
  // Indices texte libre fournis par l'utilisateur pour guider l'IA (par graphId)
  const [aiHints, setAiHints] = useState<Record<string, string>>({});

  // Calibration multi-points par axe pour chaque graphique.
  // Permet de coller exactement aux graduations du filigrane même si l'image est déformée
  // ou si les graduations ne sont pas équidistantes.
  // Format : { [graphId]: { x?: [{value, pixel}, ...], y?: [...] } }
  const [customAxisTicks, setCustomAxisTicks] = useState<Record<string, {
    x?: { value: number; pixel: number }[];
    y?: { value: number; pixel: number }[];
  }>>({});

  // État du mode calibration interactive en cours (un seul à la fois pour toute l'app)
  const [calibrationState, setCalibrationState] = useState<null | {
    graphId: string;
    axis: 'x' | 'y';
    valuesToCalibrate: number[]; // valeurs à calibrer dans l'ordre
    currentIndex: number;        // index de la valeur courante
    collected: { value: number; pixel: number }[];
  }>(null);

  // Génère la liste des valeurs de graduations à partir de min/max/pas
  const buildAxisValuesFromConfig = useCallback((min: number, max: number, step: number): number[] => {
    if (!isFinite(min) || !isFinite(max) || !isFinite(step) || step <= 0) return [min, max];
    const values: number[] = [];
    // Tolérance pour éviter d'omettre max à cause d'erreurs flottantes
    const eps = step * 1e-6;
    for (let v = min; v <= max + eps; v += step) {
      values.push(parseFloat(v.toFixed(10))); // évite les artefacts type 0.30000000000000004
    }
    if (values[values.length - 1] < max - eps) values.push(max);
    return values;
  }, []);

  // Démarre une session de calibration interactive pour un axe d'un graphique.
  // L'utilisateur va cliquer sur chaque graduation visible de l'image filigrane.
  const startAxisCalibration = useCallback((graphId: string, axis: 'x' | 'y', step?: number) => {
    const graph = graphs.find(g => g.id === graphId);
    if (!graph?.axes) return;
    const cfg = axis === 'x' ? graph.axes.xAxis : graph.axes.yAxis;
    // Pas par défaut : tente de deviner (10 ticks dans la plage) si non fourni
    const defaultStep = step ?? ((cfg.max - cfg.min) / 10);
    const values = buildAxisValuesFromConfig(cfg.min, cfg.max, defaultStep);
    setCalibrationState({
      graphId, axis,
      valuesToCalibrate: values,
      currentIndex: 0,
      collected: []
    });
    // Sélectionner ce graphique dans la sous-étape
    const idx = graphs.findIndex(g => g.id === graphId);
    if (idx >= 0) setSubStepGraphIndex(idx);
  }, [graphs, buildAxisValuesFromConfig]);

  // Reçoit un clic en pixel inner depuis Chart pendant la calibration
  const handleCalibrationClick = useCallback((pixelInner: { x: number; y: number }) => {
    if (!calibrationState) return;
    const { axis, valuesToCalibrate, currentIndex, collected, graphId } = calibrationState;
    const value = valuesToCalibrate[currentIndex];
    const pixel = axis === 'x' ? pixelInner.x : pixelInner.y;
    const newCollected = [...collected, { value, pixel }];

    // Si fini : commit dans customAxisTicks et termine la calibration
    if (currentIndex + 1 >= valuesToCalibrate.length) {
      setCustomAxisTicks(prev => ({
        ...prev,
        [graphId]: { ...prev[graphId], [axis]: newCollected }
      }));
      setCalibrationState(null);
      return;
    }

    // Sinon, passe à la valeur suivante
    setCalibrationState({ ...calibrationState, currentIndex: currentIndex + 1, collected: newCollected });
  }, [calibrationState]);

  const cancelCalibration = useCallback(() => setCalibrationState(null), []);

  const resetCalibration = useCallback((graphId: string, axis?: 'x' | 'y') => {
    setCustomAxisTicks(prev => {
      const next = { ...prev };
      if (!next[graphId]) return prev;
      if (axis) {
        const { [axis]: _, ...rest } = next[graphId];
        if (Object.keys(rest).length === 0) delete next[graphId];
        else next[graphId] = rest;
      } else {
        delete next[graphId];
      }
      return next;
    });
  }, []);

  // Taille pixel du Chart par graphique (default 500x1000). L'utilisateur peut
  // l'étirer via les poignées sur les bords pour ajuster l'espacement entre
  // graduations sans toucher aux valeurs des bornes.
  const [chartSizes, setChartSizes] = useState<Record<string, { width: number; height: number }>>({});
  const getChartWidth = (id: string) => chartSizes[id]?.width ?? 500;
  const getChartHeight = (id: string) => chartSizes[id]?.height ?? 500;

  // État du drag de resize du Chart
  const [chartResize, setChartResize] = useState<null | {
    graphId: string;
    kind: 'right' | 'bottom' | 'corner';
    startClientX: number;
    startClientY: number;
    originW: number;
    originH: number;
  }>(null);

  React.useEffect(() => {
    if (!chartResize) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - chartResize.startClientX;
      const dy = e.clientY - chartResize.startClientY;
      setChartSizes(prev => ({
        ...prev,
        [chartResize.graphId]: {
          width: chartResize.kind === 'bottom'
            ? chartResize.originW
            : Math.max(300, Math.min(2000, chartResize.originW + dx)),
          height: chartResize.kind === 'right'
            ? chartResize.originH
            : Math.max(300, Math.min(2500, chartResize.originH + dy))
        }
      }));
    };
    const onUp = () => setChartResize(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [chartResize]);

  // Sous-étape par graphique dans l'étape "Construction et Interpolation"
  // Permet de traiter les graphiques un par un au lieu de les afficher tous ensemble.
  const [subStepGraphIndex, setSubStepGraphIndex] = useState<number>(0);

  // Synchronise selectedGraphId avec le graphique courant de la sous-étape
  // et clamp l'index si le nombre de graphiques change.
  React.useEffect(() => {
    if (graphs.length === 0) return;
    const clamped = Math.min(Math.max(0, subStepGraphIndex), graphs.length - 1);
    if (clamped !== subStepGraphIndex) {
      setSubStepGraphIndex(clamped);
      return;
    }
    const targetGraph = graphs[clamped];
    if (targetGraph && targetGraph.id !== selectedGraphId) {
      setSelectedGraphId(targetGraph.id);
      if (targetGraph.curves.length > 0 && !targetGraph.curves.find(c => c.id === selectedCurveId)) {
        setSelectedCurveId(targetGraph.curves[0].id);
      }
    }
  }, [subStepGraphIndex, graphs.length, graphs, selectedGraphId, selectedCurveId]);

  // Réinitialise l'index à 0 quand on (re)rentre dans l'étape "points"
  React.useEffect(() => {
    if (currentStep === 'points') {
      setSubStepGraphIndex(0);
    }
  }, [currentStep]);

  // Lance l'analyse IA de l'image en filigrane et ajoute les courbes détectées
  const handleAIDetect = useCallback(async (graphId: string) => {
    const bg = backgroundImages[graphId];
    const graph = graphs.find(g => g.id === graphId);
    if (!bg || !graph?.axes) {
      console.warn('[AI] Pas d\'image ou axes manquants pour graphId', graphId);
      return;
    }
    setAiDetectingGraphId(graphId);
    setAiNotes(prev => ({ ...prev, [graphId]: '' }));

    try {
      const result = await analyzeChartImage(bg.url, graph.axes, {
        extraContext: aiHints[graphId]
      });

      if (!result.curves || result.curves.length === 0) {
        setAiNotes(prev => ({ ...prev, [graphId]: '⚠️ Aucune courbe détectée. ' + (result.notes || '') }));
        return;
      }

      // Injecter les courbes détectées dans le graph
      setGraphs(prev => prev.map(g => {
        if (g.id !== graphId) return g;
        const ts = Date.now();
        const newCurves = result.curves.map((c, i) => ({
          id: `curve-ai-${ts}-${i}`,
          name: c.name,
          color: c.color,
          points: c.points.map((p, j) => ({
            ...p,
            id: `point-ai-${ts}-${i}-${j}`
          }))
        }));
        return { ...g, curves: [...g.curves, ...newCurves] };
      }));

      // Sélectionner la première courbe ajoutée
      const firstNewId = `curve-ai-${Date.now()}-0`;
      // (id exact dépend du ts au-dessus ; on prend juste la dernière courbe ajoutée du graph)
      setTimeout(() => {
        const updated = (graphs.find(g => g.id === graphId) || {}).curves || [];
        if (updated.length > 0) setSelectedCurveId(updated[updated.length - 1].id);
      }, 0);

      const summary = `✅ ${result.curves.length} courbe(s) détectée(s), ${result.curves.reduce((s, c) => s + c.points.length, 0)} point(s) au total.`;
      setAiNotes(prev => ({ ...prev, [graphId]: summary + (result.notes ? ' ' + result.notes : '') }));
    } catch (err: any) {
      console.error('[AI] Erreur analyse :', err);
      setAiNotes(prev => ({ ...prev, [graphId]: `❌ Erreur : ${err.message || err}` }));
    } finally {
      setAiDetectingGraphId(null);
    }
  }, [backgroundImages, graphs, aiHints]);

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
      // Rester à l'étape 'axes' pour permettre la modification de la configuration
      // L'utilisateur pourra ensuite avancer manuellement vers 'points'
      setCurrentStep('axes');
    }
  }, [initialData, aircraftModel]);

  // Synchroniser modelNameInput avec systemType
  React.useEffect(() => {
    const label = SYSTEM_TYPES.find(t => t.value === systemType)?.label;
    if (label && !modelName) {
      setModelNameInput(label);
    }
  }, [systemType, modelName]);

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

      }, [selectedGraphId, graphs, interpolationMethod, interpolationPoints]);

  // Gestionnaires pour les graphiques
  const handleAddGraph = useCallback((graph: GraphConfig) => {
    setGraphs(prev => [...prev, graph]);
    setSelectedGraphId(graph.id);
    // Fermer tous les graphiques existants et ouvrir uniquement le nouveau
    setExpandedGraphs(prev => {
      const newExpanded: Record<string, boolean> = {};
      // Fermer tous les graphiques existants
      Object.keys(prev).forEach(id => {
        newExpanded[id] = false;
      });
      // Ouvrir uniquement le nouveau graphique
      newExpanded[graph.id] = true;
      return newExpanded;
    });
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

  const handleWindRelatedChange = useCallback((isWindRelated: boolean) => {
    if (selectedGraphId) {
      handleUpdateGraph(selectedGraphId, { isWindRelated });
    }
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
                
    if (!selectedGraphId) {
            return;
    }

    // Trouver la courbe dans les graphiques
    const graph = graphs.find(g => g.id === selectedGraphId);
    
    const curve = graph?.curves.find(c => c.id === curveId);

    if (!curve || !curve.points || curve.points.length < 2) {
      console.log('Cannot fit curve: not enough points');
      return;
    }

    console.log('Points:', curve.points.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', '));

    try {
            const tempManager = new AbacCurveManager();

      const tempCurveData = {
        name: curve.name,
        color: curve.color,
        points: curve.points
      };

            const tempCurveId = tempManager.addCurve(tempCurveData);
      
            const result = tempManager.fitCurve(tempCurveId, {
        ...options,
        method: interpolationMethod,
        numPoints: interpolationPoints
      });

      
      setFitResults(prev => {
                return { ...prev, [curveId]: result };
      });

      if (result.warnings.length > 0) {
                setWarnings(prev => ({ ...prev, [curveId]: result.warnings }));
      } else {
        setWarnings(prev => {
          const newWarnings = { ...prev };
          delete newWarnings[curveId];
          return newWarnings;
        });
      }

      // Mettre à jour les graphiques
            setGraphs(prev => prev.map(g => {
        if (g.id === selectedGraphId) {
                    return {
            ...g,
            curves: g.curves.map(c => {
              if (c.id === curveId) {
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

          } catch (error) {
      console.error(`❌ Erreur lors de l'interpolation de la courbe ${curveId}:`, error);
      console.error('📦 Stack trace:', (error as Error).stack);
    }
  }, [selectedGraphId, graphs]);

  const handleGenerateIntermediateCurves = useCallback(() => {
    if (!selectedGraphId || !managerRef.current) return;

    
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

          }
  }, [selectedGraphId, numIntermediateCurves]);

  const handleFitAll = useCallback((options: FitOptions = {}) => {
    console.log('Starting fit all curves');
    const newWarnings: Record<string, string[]> = {};
    const allResults: Record<string, FitResult> = {};

    // Interpoler toutes les courbes de tous les graphiques
    setGraphs(prev => {
      console.log('Fitting all graphs');
      return prev.map((graph, graphIndex) => {
        console.log(`Processing graph ${graphIndex + 1}/${prev.length}: ${graph.name}`);

        const updatedCurves = graph.curves.map((curve, curveIndex) => {
          console.log(`  Curve ${curveIndex + 1}: ${curve.name}`);
          // Vérifier que la courbe a des points avant d'interpoler
          if (!curve.points || curve.points.length < 2) {
            console.log('    Skipped: not enough points');
            return curve;
          }

          console.log('    Points:', curve.points.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', '));

          try {
            const tempManager = new AbacCurveManager();

            // Ajouter la courbe et récupérer l'ID généré par le manager
            const tempCurveData = {
              name: curve.name,
              color: curve.color,
              points: curve.points
            };
            const tempCurveId = tempManager.addCurve(tempCurveData);

            // Utiliser l'ID temporaire pour l'interpolation
            const result = tempManager.fitCurve(tempCurveId, {
              ...options,
              method: interpolationMethod,
              numPoints: interpolationPoints
            });

            console.log(`    Interpolation result: ${result.fittedPoints.length} points`);

            if (result.fittedPoints.length > 0) {
              console.log('    Fitted points:', result.fittedPoints.slice(0, 3).map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(', '));
            }

            allResults[curve.id] = result;

            if (result.warnings.length > 0) {
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

                        return updatedCurve;

          } catch (error) {
            console.error(`  ❌ Erreur lors de l'interpolation de la courbe "${curve.name}":`, error);
            console.error('  📦 Stack trace:', (error as Error).stack);
            return curve;
          }
        });

        console.log(`  Graph ${graphIndex + 1}: ${updatedCurves.filter(c => c.fitted).length}/${updatedCurves.length} curves fitted`);

        return {
          ...graph,
          curves: updatedCurves
        };
      });
    });

    console.log('Total curves fitted:', Object.keys(allResults).length);
    console.log('Total warnings:', Object.keys(newWarnings).length);

    setFitResults(allResults);
    setWarnings(newWarnings);
  }, [graphs, interpolationMethod, interpolationPoints]);

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
            
    if (currentStep === 'fit' && !hasAutoInterpolated) {
      
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

      
      const hasUnfittedCurves = graphs.some(g =>
        g.curves.some(c => c.points.length >= 2 && !c.fitted)
      );

      console.log('Has unfitted curves:', hasUnfittedCurves);
      if (hasUnfittedCurves) {
        // Marquer comme interpolé avant de lancer l'interpolation
        setHasAutoInterpolated(true);
        // Interpoler toutes les courbes automatiquement
        handleFitAll({ method: 'pchip' });
      } else {
        console.log('All curves already fitted');
      }
    }

    // Réinitialiser le flag quand on quitte l'étape 3
    if (currentStep !== 'fit') {
            setHasAutoInterpolated(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

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

    // Sauvegarder sans télécharger le fichier JSON
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
            <h2>Étape 1: {SYSTEM_TYPES.find(t => t.value === systemType)?.label || 'Système d\'abaques'}</h2>
            {importSuccess && (
              <div style={{
                marginBottom: '16px',
                padding: '10px',
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
              padding: '10px',
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
              />
            </div>

            {/* Liste de graphiques avec accordéons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {graphs.map((graph, index) => {
                const isExpanded = expandedGraphs[graph.id] === true; // Par défaut fermé
                const xAxisTitle = graph.axes?.xAxis?.title || 'Personnalisé';
                const yAxisTitle = graph.axes?.yAxis?.title || 'Personnalisé';

                return (
                  <div key={graph.id} style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    {/* En-tête cliquable */}
                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: '#f5f5f5',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        userSelect: 'none'
                      }}
                      onClick={() => {
                        // Si on clique sur un graphique déjà ouvert, on le ferme
                        // Si on clique sur un graphique fermé, on ferme tous les autres et on ouvre celui-ci
                        setExpandedGraphs(prev => {
                          if (isExpanded) {
                            // Fermer le graphique actuel
                            return {
                              ...prev,
                              [graph.id]: false
                            };
                          } else {
                            // Fermer tous les autres et ouvrir celui-ci
                            const newExpanded: Record<string, boolean> = {};
                            Object.keys(prev).forEach(id => {
                              newExpanded[id] = false;
                            });
                            newExpanded[graph.id] = true;
                            return newExpanded;
                          }
                        });
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '18px' }}>{isExpanded ? '▼' : '▶'}</span>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                          {graph.name} - {xAxisTitle} / {yAxisTitle}
                        </h3>
                      </div>
                    </div>

                    {/* Contenu du graphique */}
                    {isExpanded && (
                      <div className={styles.workspace} style={{ padding: '10px' }}>
                        <AxesForm
                          key={graph.id}
                          onSubmit={(config: AxesConfig) => {
                            handleUpdateGraph(graph.id, { axes: config });
                          }}
                          initialConfig={graph.axes || undefined}
                          isWindRelated={graph.isWindRelated || false}
                          onWindRelatedChange={(isWindRelated: boolean) => {
                            handleUpdateGraph(graph.id, { isWindRelated });
                          }}
                          onDelete={() => handleRemoveGraph(graph.id)}
                          graphName={graph.name}
                          graphNumber={index + 1}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bouton Nouveau graphique après la liste */}
              <div style={{ marginTop: '16px', width: '100%' }}>
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    width: '100%'
                  }}
                  onClick={() => {
                    const name = `Graphique ${graphs.length + 1}`;
                    const newGraph: GraphConfig = {
                      id: uuidv4(),
                      name,
                      isWindRelated: false,
                      axes: {
                        xAxis: { min: 0, max: 100, unit: '', title: 'Axe X' },
                        yAxis: { min: 0, max: 100, unit: '', title: 'Axe Y' }
                      },
                      curves: []
                    };
                    handleAddGraph(newGraph);
                  }}
                >
                  Configurer un axe
                </button>
              </div>

              {/* Boutons de navigation */}
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Ligne 1: Précédent et Suivant */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  {/* Bouton Précédent pour retourner à la page d'accueil des performances */}
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#9E9E9E',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: 1
                    }}
                    onClick={onBack}
                    title="Retourner à la sélection du type de données de performance"
                  >
                    <span style={{ fontSize: '16px' }}>←</span>
                    Précédent
                  </button>

                  {/* Bouton Suivant pour aller à l'étape Construire et Interpoler */}
                  <button
                    style={{
                      padding: '10px 20px',
                      backgroundColor: canProceed() ? '#4CAF50' : '#cccccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: canProceed() ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      flex: 1
                    }}
                    onClick={() => {
                      if (canProceed()) {
                        setCurrentStep('points');
                      }
                    }}
                    disabled={!canProceed()}
                    title={canProceed() ? "Passer à l'étape suivante" : "Configurez au moins un graphique avec ses axes pour continuer"}
                  >
                    Suivant
                    <span style={{ fontSize: '16px' }}>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'points':
        return (
          <div className={styles.stepContent}>
            <h2>Étape 2: Construction et Interpolation - "{SYSTEM_TYPES.find(t => t.value === systemType)?.label || 'Abaques'}"</h2>
            {/* Boutons d'actions en ligne */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '12px',
              alignItems: 'center'
            }}>
              {axesConfig && (
                <button
                  onClick={() => handleAutoAdjustAxes(selectedGraphId)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500
                  }}
                  title="Ajuste automatiquement les axes en fonction des points saisis"
                >
                  Ajuster les axes
                </button>
              )}
              {/* Le bouton "Interpoler" classique reste accessible mais déplacé en bas (cf. nav sous-étapes).
                  Ici on garde uniquement les actions liées au graphique courant. */}
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
                    padding: '6px 10px',
                    fontSize: '11px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Suppr. ({currentGraph.curves.filter(c => c.name.includes('(interpolé)')).length})
                </button>
              )}
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

              {/* Main content area - courbes en haut, graphiques en dessous */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>

              {/* Contrôles de création de courbes en colonne */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {currentGraph && (
                  <>
                    <div style={{ width: '100%' }}>
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
                    </div>
                    {axesConfig && (
                      <div style={{ width: '100%' }}>
                        <PointsTable
                          curves={curves}
                          selectedCurveId={selectedCurveId}
                          axesConfig={axesConfig}
                          onUpdatePoint={handlePointDrag}
                          onDeletePoint={handlePointDelete}
                          onAddPoint={handlePointClick}
                          onSelectCurve={setSelectedCurveId}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sous-stepper : un graphique à la fois */}
              {graphs.length > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  marginBottom: 8, backgroundColor: '#eef2ff', border: '1px solid #c7d2fe',
                  borderRadius: 6, flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#3730a3' }}>
                    Sous-étape : Graphique {subStepGraphIndex + 1} / {graphs.length}
                  </span>
                  <span style={{ fontSize: 12, color: '#4338ca' }}>
                    « {graphs[subStepGraphIndex]?.name || ''} »
                  </span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                    {graphs.map((g, idx) => (
                      <button
                        key={g.id}
                        onClick={() => setSubStepGraphIndex(idx)}
                        style={{
                          width: 28, height: 28, fontSize: 12, cursor: 'pointer',
                          borderRadius: 14, border: '1px solid',
                          borderColor: idx === subStepGraphIndex ? '#4338ca' : '#c7d2fe',
                          backgroundColor: idx === subStepGraphIndex ? '#4338ca' : 'white',
                          color: idx === subStepGraphIndex ? 'white' : '#4338ca',
                          fontWeight: 600
                        }}
                        title={g.name}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Graphiques en colonne (filtrés sur le graphique courant de la sous-étape) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px'
              }}>
                {graphs.filter((_, idx) => idx === subStepGraphIndex).map(graph => (
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
                      padding: '10px',
                      border: selectedGraphId === graph.id ? '3px solid #4CAF50' : '1px solid #ddd',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
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
                      <div style={{ width: '100%', maxWidth: '100%', overflow: 'auto' }}>
                        {/* Barre d'actions pour l'image en filigrane (par graphique) */}
                        <div
                          style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                            backgroundColor: backgroundImages[graph.id] ? '#e0e7ff' : '#f3f4f6',
                            border: '1px solid #d1d5db', borderRadius: 4
                          }}>
                            📎 {backgroundImages[graph.id] ? 'Changer l\'image' : 'Image en filigrane'}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const url = ev.target?.result as string;
                                  // Initialiser l'image sur toute la zone INNER du Chart courant.
                                  // En pixels SVG (margin top:40 right:40 bottom:60 left:60).
                                  const w = getChartWidth(graph.id);
                                  const h = getChartHeight(graph.id);
                                  const innerW = Math.max(50, w - 60 - 40);
                                  const innerH = Math.max(50, h - 40 - 60);
                                  setBackgroundImages(prev => ({
                                    ...prev,
                                    [graph.id]: {
                                      url,
                                      x: 0, y: 0,
                                      width: innerW,
                                      height: innerH
                                    }
                                  }));
                                  setImageAdjustGraphId(graph.id);
                                };
                                reader.readAsDataURL(file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {backgroundImages[graph.id] && (
                            <>
                              <button
                                onClick={() => setImageAdjustGraphId(imageAdjustGraphId === graph.id ? null : graph.id)}
                                style={{
                                  padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                                  backgroundColor: imageAdjustGraphId === graph.id ? '#a78bfa' : '#f3f4f6',
                                  color: imageAdjustGraphId === graph.id ? 'white' : '#374151',
                                  border: '1px solid #d1d5db', borderRadius: 4
                                }}
                              >
                                {imageAdjustGraphId === graph.id ? '✓ Terminer ajustement' : '✥ Ajuster image'}
                              </button>
                              <button
                                onClick={() => handleAIDetect(graph.id)}
                                disabled={aiDetectingGraphId === graph.id || imageAdjustGraphId === graph.id}
                                style={{
                                  padding: '4px 8px', fontSize: 11,
                                  cursor: (aiDetectingGraphId === graph.id || imageAdjustGraphId === graph.id) ? 'wait' : 'pointer',
                                  backgroundColor: aiDetectingGraphId === graph.id ? '#fef3c7' : '#ecfeff',
                                  color: '#0e7490',
                                  border: '1px solid #67e8f9', borderRadius: 4,
                                  opacity: (aiDetectingGraphId === graph.id || imageAdjustGraphId === graph.id) ? 0.7 : 1
                                }}
                                title={imageAdjustGraphId === graph.id ? 'Termine d\'ajuster l\'image avant la détection' : 'Détecte automatiquement courbes et points avec l\'IA'}
                              >
                                {aiDetectingGraphId === graph.id ? '⏳ Analyse en cours…' : '🪄 Détecter avec IA'}
                              </button>
                              <button
                                onClick={() => {
                                  setBackgroundImages(prev => {
                                    const next = { ...prev };
                                    delete next[graph.id];
                                    return next;
                                  });
                                  if (imageAdjustGraphId === graph.id) setImageAdjustGraphId(null);
                                }}
                                style={{
                                  padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                                  backgroundColor: '#fee2e2', color: '#991b1b',
                                  border: '1px solid #fecaca', borderRadius: 4
                                }}
                              >
                                🗑️ Retirer
                              </button>
                            </>
                          )}
                        </div>
                        {/* Champ optionnel pour donner des indices à l'IA — n'apparaît que si une image est chargée */}
                        {backgroundImages[graph.id] && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8
                            }}
                          >
                            <span style={{ fontSize: 11, color: '#6b7280' }} title="Texte libre passé à l'IA pour l'aider à interpréter les courbes">💡 Indices IA :</span>
                            <input
                              type="text"
                              value={aiHints[graph.id] || ''}
                              onChange={(e) => setAiHints(prev => ({ ...prev, [graph.id]: e.target.value }))}
                              placeholder="Ex: Les courbes représentent des altitudes de pression en pieds"
                              style={{
                                flex: 1, padding: '4px 8px', fontSize: 11,
                                border: '1px solid #d1d5db', borderRadius: 4,
                                backgroundColor: 'white'
                              }}
                            />
                          </div>
                        )}
                        {aiNotes[graph.id] && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              marginBottom: 8, padding: '6px 10px', fontSize: 11,
                              backgroundColor: aiNotes[graph.id].startsWith('❌') ? '#fee2e2' :
                                aiNotes[graph.id].startsWith('⚠️') ? '#fef3c7' : '#ecfdf5',
                              color: aiNotes[graph.id].startsWith('❌') ? '#991b1b' :
                                aiNotes[graph.id].startsWith('⚠️') ? '#92400e' : '#065f46',
                              border: '1px solid', borderColor: aiNotes[graph.id].startsWith('❌') ? '#fecaca' :
                                aiNotes[graph.id].startsWith('⚠️') ? '#fde68a' : '#a7f3d0',
                              borderRadius: 4
                            }}
                          >
                            {aiNotes[graph.id]}
                          </div>
                        )}
                        {/* Calibration multi-points : aligner les ticks sur les graduations de l'image */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center',
                            flexWrap: 'wrap', padding: '6px 8px', backgroundColor: '#fffbeb',
                            border: '1px solid #fde68a', borderRadius: 4, fontSize: 11
                          }}
                        >
                          <span style={{ fontWeight: 500 }} title="Calibre les ticks de chaque axe en cliquant sur les graduations visibles de l'image filigrane. Corrige les déformations non-uniformes du scan.">
                            📐 Calibrer axes sur l'image :
                          </span>
                          <button
                            onClick={() => {
                              const cfg = graph.axes?.xAxis; if (!cfg) return;
                              const stepStr = window.prompt(
                                `Pas de graduation pour l'axe X (${cfg.title} ${cfg.unit ? `(${cfg.unit})` : ''}) :\n\nValeurs générées : ${cfg.min} → ${cfg.max} avec ce pas.\n\nEntre le pas (ex: 5 pour 0, 5, 10, 15...) :`,
                                String(Math.max(1, Math.round((cfg.max - cfg.min) / 10)))
                              );
                              if (stepStr === null) return;
                              const step = Number(stepStr);
                              if (!isFinite(step) || step <= 0) { alert('Pas invalide'); return; }
                              startAxisCalibration(graph.id, 'x', step);
                            }}
                            disabled={!graph.axes || !!calibrationState}
                            style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer', backgroundColor: customAxisTicks[graph.id]?.x ? '#fef3c7' : '#fef9c3', border: '1px solid #facc15', borderRadius: 3 }}
                          >
                            📐 X {customAxisTicks[graph.id]?.x ? `(${customAxisTicks[graph.id]?.x?.length} points ✓)` : ''}
                          </button>
                          <button
                            onClick={() => {
                              const cfg = graph.axes?.yAxis; if (!cfg) return;
                              const stepStr = window.prompt(
                                `Pas de graduation pour l'axe Y (${cfg.title} ${cfg.unit ? `(${cfg.unit})` : ''}) :\n\nValeurs générées : ${cfg.min} → ${cfg.max} avec ce pas.\n\nEntre le pas (ex: 200 pour 0, 200, 400, ...) :`,
                                String(Math.max(1, Math.round((cfg.max - cfg.min) / 10)))
                              );
                              if (stepStr === null) return;
                              const step = Number(stepStr);
                              if (!isFinite(step) || step <= 0) { alert('Pas invalide'); return; }
                              startAxisCalibration(graph.id, 'y', step);
                            }}
                            disabled={!graph.axes || !!calibrationState}
                            style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer', backgroundColor: customAxisTicks[graph.id]?.y ? '#fef3c7' : '#fef9c3', border: '1px solid #facc15', borderRadius: 3 }}
                          >
                            📐 Y {customAxisTicks[graph.id]?.y ? `(${customAxisTicks[graph.id]?.y?.length} points ✓)` : ''}
                          </button>
                          {(customAxisTicks[graph.id]?.x || customAxisTicks[graph.id]?.y) && (
                            <button
                              onClick={() => resetCalibration(graph.id)}
                              style={{ padding: '3px 8px', fontSize: 11, cursor: 'pointer', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 3 }}
                            >
                              ↺ Reset
                            </button>
                          )}
                        </div>

                        {/* Bandeau d'instruction pendant la calibration */}
                        {calibrationState?.graphId === graph.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              padding: '8px 12px', marginBottom: 8, fontSize: 12,
                              backgroundColor: '#fef3c7', color: '#92400e',
                              border: '2px solid #f59e0b', borderRadius: 4,
                              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
                            }}
                          >
                            <strong>📍 Calibration {calibrationState.axis.toUpperCase()} :</strong>
                            <span>
                              Clique sur la ligne <strong>{calibrationState.valuesToCalibrate[calibrationState.currentIndex]}</strong> de l'image filigrane.
                            </span>
                            <span style={{ marginLeft: 'auto', opacity: 0.8 }}>
                              {calibrationState.currentIndex + 1} / {calibrationState.valuesToCalibrate.length}
                            </span>
                            <button
                              onClick={cancelCalibration}
                              style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer', backgroundColor: 'white', border: '1px solid #f59e0b', borderRadius: 3 }}
                            >
                              ✕ Annuler
                            </button>
                          </div>
                        )}

                        {/* Indication discrète sur la taille du Chart (étirable via les poignées en bord) */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center',
                            fontSize: 10, color: '#9ca3af'
                          }}
                        >
                          <span>📐 Taille graphique : {Math.round(getChartWidth(graph.id))}×{Math.round(getChartHeight(graph.id))} px — étire via les bordures bleues pour caler sur l'image</span>
                          {(chartSizes[graph.id]) && (
                            <button
                              onClick={() => setChartSizes(prev => {
                                const next = { ...prev };
                                delete next[graph.id];
                                return next;
                              })}
                              style={{ padding: '2px 6px', fontSize: 10, cursor: 'pointer', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 3 }}
                            >
                              ↺ Reset
                            </button>
                          )}
                        </div>
                        {/* Wrapper qui porte les 3 poignées de redimensionnement du Chart */}
                        <div
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: getChartWidth(graph.id),
                            paddingRight: 6,
                            paddingBottom: 6
                          }}
                          onClick={(e) => {
                            // Empêche le clic sur les poignées de remonter au parent et de
                            // perturber la sélection du graph
                            if (e.target !== e.currentTarget) return;
                          }}
                        >
                          <Chart
                            axesConfig={graph.axes}
                            curves={graph.curves}
                            selectedCurveId={selectedGraphId === graph.id ? selectedCurveId : null}
                            onPointClick={selectedGraphId === graph.id ? handlePointClick : undefined}
                            onPointDrag={selectedGraphId === graph.id ? handlePointDrag : undefined}
                            onPointDelete={selectedGraphId === graph.id ? handlePointDelete : undefined}
                            responsive={false}
                            width={getChartWidth(graph.id)}
                            height={getChartHeight(graph.id)}
                            backgroundImage={backgroundImages[graph.id] || null}
                            imageAdjustMode={imageAdjustGraphId === graph.id}
                            onBackgroundImageChange={(next) => {
                              setBackgroundImages(prev => ({ ...prev, [graph.id]: next }));
                            }}
                            customXTicks={customAxisTicks[graph.id]?.x}
                            customYTicks={customAxisTicks[graph.id]?.y}
                            calibrationMode={calibrationState?.graphId === graph.id ? calibrationState.axis : null}
                            onCalibrationClick={calibrationState?.graphId === graph.id ? handleCalibrationClick : undefined}
                          />
                          {/* Poignée droite : étire horizontalement */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setChartResize({
                                graphId: graph.id, kind: 'right',
                                startClientX: e.clientX, startClientY: e.clientY,
                                originW: getChartWidth(graph.id),
                                originH: getChartHeight(graph.id)
                              });
                            }}
                            title="Étirer horizontalement (sans changer les valeurs)"
                            style={{
                              position: 'absolute', right: -2, top: 30, bottom: 60, width: 6,
                              cursor: 'ew-resize',
                              backgroundColor: chartResize?.graphId === graph.id && chartResize.kind === 'right' ? '#3b82f6' : '#dbeafe',
                              borderRadius: 2,
                              opacity: 0.7
                            }}
                          />
                          {/* Poignée bas : étire verticalement */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setChartResize({
                                graphId: graph.id, kind: 'bottom',
                                startClientX: e.clientX, startClientY: e.clientY,
                                originW: getChartWidth(graph.id),
                                originH: getChartHeight(graph.id)
                              });
                            }}
                            title="Étirer verticalement (sans changer les valeurs)"
                            style={{
                              position: 'absolute', bottom: -2, left: 60, right: 30, height: 6,
                              cursor: 'ns-resize',
                              backgroundColor: chartResize?.graphId === graph.id && chartResize.kind === 'bottom' ? '#3b82f6' : '#dbeafe',
                              borderRadius: 2,
                              opacity: 0.7
                            }}
                          />
                          {/* Poignée coin bas-droit : étire en 2D */}
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setChartResize({
                                graphId: graph.id, kind: 'corner',
                                startClientX: e.clientX, startClientY: e.clientY,
                                originW: getChartWidth(graph.id),
                                originH: getChartHeight(graph.id)
                              });
                            }}
                            title="Étirer dans les deux directions"
                            style={{
                              position: 'absolute', right: -6, bottom: -6, width: 14, height: 14,
                              cursor: 'nwse-resize',
                              backgroundColor: '#3b82f6',
                              border: '2px solid white',
                              borderRadius: 2,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                            }}
                          />
                        </div>
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

            {/* Boutons de navigation : intra-étape (sous-graphiques) + global (étape suivante) */}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              {/* Précédent : graphique précédent dans la sous-étape, ou retour à 'axes' si déjà au premier */}
              <button
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#9E9E9E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flex: 1,
                  minWidth: 180
                }}
                onClick={() => {
                  if (subStepGraphIndex > 0) setSubStepGraphIndex(subStepGraphIndex - 1);
                  else setCurrentStep('axes');
                }}
                title={subStepGraphIndex > 0 ? 'Revenir au graphique précédent' : 'Retourner à la configuration des axes'}
              >
                <span style={{ fontSize: '16px' }}>←</span>
                {subStepGraphIndex > 0 && graphs.length > 1
                  ? `Graphique précédent (${subStepGraphIndex}/${graphs.length})`
                  : 'Précédent (axes)'}
              </button>

              {/* Bouton "Interpoler tous les graphiques" : ne s'affiche qu'au DERNIER graphique
                  → l'utilisateur fait d'abord tous ses graphiques, puis lance l'interpolation une seule fois.
                  Chaque graphique reste interpolé indépendamment (handleFitAll itère par graph/curve) */}
              {subStepGraphIndex === graphs.length - 1 && graphs.length > 0 && (
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flex: 1.2,
                    minWidth: 220
                  }}
                  onClick={() => handleFitAll({ method: interpolationMethod, numPoints: interpolationPoints })}
                  disabled={graphs.every(g => g.curves.length === 0)}
                  title="Interpole chaque graphique indépendamment (les points d'un graphique ne sont jamais mélangés avec ceux d'un autre)"
                >
                  🪄 Interpoler les {graphs.length} graphiques
                </button>
              )}

              {/* Suivant : graphique suivant si pas le dernier ; sinon étape Validation */}
              {subStepGraphIndex < graphs.length - 1 ? (
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    flex: 1,
                    minWidth: 180
                  }}
                  onClick={() => setSubStepGraphIndex(subStepGraphIndex + 1)}
                  title="Valider ce graphique et passer au suivant"
                >
                  Graphique suivant ({subStepGraphIndex + 2}/{graphs.length})
                  <span style={{ fontSize: '16px' }}>→</span>
                </button>
              ) : (
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: canProceed() ? '#4CAF50' : '#cccccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: canProceed() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    flex: 1,
                    minWidth: 180
                  }}
                  onClick={() => {
                    if (canProceed()) setCurrentStep('final');
                  }}
                  disabled={!canProceed()}
                  title={canProceed() ? "Passer à l'étape de validation" : 'Ajoutez au moins 2 points à une courbe pour continuer'}
                >
                  Suivant (Validation)
                  <span style={{ fontSize: '16px' }}>→</span>
                </button>
              )}
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
              padding: '10px',
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
                  padding: '10px',
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
        graphs.forEach(graph => {
          console.log('Graph:', {
            name: graph.name,
            curves: graph.curves.length,
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
                padding: '10px',
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
              </div>

              {/* Filtre pour les courbes vent - visible uniquement si au moins un graphique est lié au vent */}
              {false && graphs.some(g => g.isWindRelated) && (
                <div style={{
                  marginBottom: '20px',
                  padding: '10px',
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


              {/* Affichage des graphiques en colonne */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
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
                    <div key={graph.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '8px', overflow: 'hidden' }}>
                      <h3 style={{ marginBottom: '8px', fontSize: '14px' }}>
                        {graph.name}
                        {graph.isWindRelated && (
                          <span style={{
                            fontSize: '10px',
                            color: '#1976d2',
                            marginLeft: '6px',
                            backgroundColor: '#e3f2fd',
                            padding: '2px 4px',
                            borderRadius: '3px'
                          }}>
                            💨 {windFilter === 'headwind' ? 'Face' : windFilter === 'tailwind' ? 'Arrière' : 'Tous'}
                          </span>
                        )}
                        {graph.linkedFrom && graph.linkedFrom.length > 0 && (
                          <span style={{ fontSize: '10px', color: '#2196F3', marginLeft: '6px' }}>
                            ←
                          </span>
                        )}
                        {graph.linkedTo && graph.linkedTo.length > 0 && (
                          <span style={{ fontSize: '10px', color: '#4CAF50', marginLeft: '6px' }}>
                            →
                          </span>
                        )}
                      </h3>
                      {graph.axes && (
                        <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                          <Chart
                            axesConfig={graph.axes}
                            curves={displayCurves}
                            selectedCurveId={null}
                            showLegend={true}
                            responsive={true}
                            width={300}
                            height={200}
                          />
                        </div>
                      )}
                      {graph.isWindRelated && displayCurves.length === 0 && (
                        <div style={{
                          padding: '10px',
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

              {/* Boutons de navigation */}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                {/* Bouton Précédent pour retourner à Construire et Interpoler */}
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#9E9E9E',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flex: 1
                  }}
                  onClick={() => setCurrentStep('points')}
                  title="Retourner à l'étape de construction et interpolation"
                >
                  <span style={{ fontSize: '16px' }}>←</span>
                  Précédent
                </button>

                {/* Bouton Suivant pour sauvegarder et passer à l'équipement */}
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: modelNameInput ? '#4CAF50' : '#cccccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: modelNameInput ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    flex: 1
                  }}
                  onClick={handleExportJSON}
                  disabled={!modelNameInput}
                  title="Sauvegarder et passer à l'étape suivante"
                >
                  Suivant
                  <span style={{ fontSize: '16px' }}>→</span>
                </button>
              </div>
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
      <div className={styles.builderContent}>
        {renderStepContent()}
      </div>
    </div>
  );
}

// Wrap with forwardRef and export
export const AbacBuilder = React.forwardRef<AbacBuilderRef, AbacBuilderProps>(AbacBuilderComponent);

// Définir le displayName pour le composant avec forwardRef
AbacBuilder.displayName = 'AbacBuilder';