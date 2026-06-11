import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TextField, Select, MenuItem, FormControl, InputLabel, FormHelperText } from '@mui/material';
// R0 : imports morts retirés (AxesForm/CurveManager/PointsTable n'étaient utilisés
// que par les cases supprimées ; PointEditor/GraphManager étaient orphelins).
// CurveManager et PointsTable restent VIVANTS via AbacGraphWizard qui les monte.
import { Chart } from './Chart';
// (import ChainCalculator retiré : jamais utilisé comme valeur → esbuild l'élidait,
//  ce qui a masqué pendant des mois la casse syntaxique de tout le graphe cascade.
//  Le composant, restauré et sain, reste disponible dans ./ChainCalculator.)
import { CascadeCalculator } from './CascadeCalculator';
import { AbacCurveManager } from '../core/manager';
import { calculateAutoAxesLimits, calculateGraphAutoLimits, updateAxesWithAutoLimits } from '../core/axesUtils';
import { analyzeChartImage } from '../../v2/aiChartAnalysisService';
import { AbacGraphWizard } from './AbacGraphWizard';
import { isValidOperationId, OPERATION_CATALOG, getOperation } from '../core/operationCatalog';
import {
  AxesConfig,
  Curve,
  XYPoint,
  FitOptions,
  FitResult,
  AbacCurvesJSON,
  GraphConfig,
  WindDirection,
  InterpolationMethod,
  WorkshopConfig
} from '../core/types';
import styles from './styles.module.css';

// R0 : l'étape 'axes' (morte depuis SPRINT B) est retirée du type — séquence réelle : points → final.
type Step = 'points' | 'final';

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
  // P1 (AUDIT_ABAC_CONSTRUCTION.md) : UN AbacCurveManager PAR GRAPHE.
  // L'ancien managerRef unique était vidé/rechargé à chaque bascule de graphe —
  // incompatible avec l'atelier multi-colonnes (P2) où plusieurs graphes
  // s'éditent sans bascule. Création paresseuse par id ; purge à la
  // suppression du graphe (handleRemoveGraph).
  const managersRef = useRef(new Map<string, AbacCurveManager>());
  const getManager = useCallback((graphId: string | null | undefined): AbacCurveManager | null => {
    if (!graphId) return null;
    let m = managersRef.current.get(graphId);
    if (!m) {
      m = new AbacCurveManager();
      managersRef.current.set(graphId, m);
    }
    return m;
  }, []);
  // ─── R1 — Atelier « image unique » (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md) ───
  // État du workshop : UNE image pour le SET, un axe Y COMMUN, des cadres (un
  // par graphe). Posé en R1 (persistance metadata.workshop + duplication du Y
  // à l'export) ; le canevas visuel arrive en R2/R3. Tant que l'atelier n'est
  // pas utilisé (image null + aucun cadre), les exports restent STRICTEMENT
  // identiques à avant — zéro changement de comportement.
  const [workshop, setWorkshop] = useState<WorkshopConfig>({
    image: null,
    sharedY: { min: 0, max: 100, unit: '', title: '' },
    frames: []
  });
  const workshopActive = workshop.image !== null || workshop.frames.length > 0;

  // SPRINT B : on entre directement dans le wizard (l'ancienne étape 'axes' est supprimée du flux).
  // Le choix du type de système et la config des axes sont assurés par le wizard (sous-étape 3).
  const [currentStep, setCurrentStep] = useState<Step>('points');

  React.useEffect(() => {
        return () => {
          };
  }, []);

  // Exposer les méthodes via useImperativeHandle
  React.useImperativeHandle(ref, () => ({
    goToNextStep: () => {
      // SPRINT B : étape 'axes' supprimée, séquence = points → final
      const steps: Step[] = ['points', 'final'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex >= 0 && currentIndex < steps.length - 1) {
        const nextStep = steps[currentIndex + 1];
        setCurrentStep(nextStep);
      }
    },
    goToPreviousStep: () => {
      // SPRINT B : étape 'axes' supprimée, séquence = points → final
      const steps: Step[] = ['points', 'final'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex > 0) {
        const previousStep = steps[currentIndex - 1];
        setCurrentStep(previousStep);
      } else if (currentIndex === 0 && onBack) {
        // Précédent depuis le wizard → retour à la page parent (choix tableau/graphique)
        onBack();
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
  // SPRINT B+ : systemType contient désormais un operationId du catalogue canonique
  // (au lieu d'une valeur SYSTEM_TYPES legacy). Vide par défaut → force l'utilisateur à choisir.
  const [systemType, setSystemType] = useState<string>('');
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
  // Taille par défaut d'un chart d'abaque (en pixels SVG inner).
  // L'utilisateur peut redimensionner via les poignées de bordure du Chart.
  const DEFAULT_CHART_SIZE = 800;
  const getChartWidth = (id: string) => chartSizes[id]?.width ?? DEFAULT_CHART_SIZE;
  const getChartHeight = (id: string) => chartSizes[id]?.height ?? DEFAULT_CHART_SIZE;

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

  // SPRINT B : auto-création d'un graphique par défaut si on entre dans le wizard
  // sans graphique configuré (cas du flux normal Performance avancée → Graphique).
  React.useEffect(() => {
    if (currentStep === 'points' && graphs.length === 0) {
      const defaultGraph: GraphConfig = {
        id: uuidv4(),
        name: 'Graphique 1',
        isWindRelated: false,
        axes: {
          // title vide → force l'utilisateur à choisir une variable canonique
          // dans la sous-étape 3 (dropdown AxisVariableSelect).
          xAxis: { min: 0, max: 100, unit: '', title: '' },
          yAxis: { min: 0, max: 100, unit: '', title: '' }
        },
        graphType: '',
        curves: []
      };
      setGraphs([defaultGraph]);
      setSelectedGraphId(defaultGraph.id);
    }
  }, [currentStep, graphs.length]);

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

      // R1 — Restaurer l'état de l'atelier « image unique » s'il a été persisté.
      // Modèles antérieurs à la refonte : pas de bloc workshop → état par défaut
      // (mode compat D4 : les cadres seront recréés à l'ouverture du canevas R2).
      if (initialData.metadata?.workshop) {
        setWorkshop(initialData.metadata.workshop);
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
      // SPRINT B : on entre directement dans le wizard (l'ancienne étape 'axes' est supprimée).
      // Les axes restent éditables via la sous-étape 3 du wizard.
      setCurrentStep('points');
    }
  }, [initialData, aircraftModel]);

  // Synchroniser modelNameInput avec systemType
  React.useEffect(() => {
    const label = SYSTEM_TYPES.find(t => t.value === systemType)?.label;
    if (label && !modelName) {
      setModelNameInput(label);
    }
  }, [systemType, modelName]);

  // Synchroniser le manager DU GRAPHE SÉLECTIONNÉ avec l'état React.
  // (P1 : même cadence qu'avant — la resynchronisation reste pilotée par la
  // sélection — mais chaque graphe possède désormais SON instance, donc une
  // future édition multi-graphes (P2) ne détruira plus le travail des autres.)
  React.useEffect(() => {
    const manager = getManager(selectedGraphId);
    if (!manager) return;

    const currentGraph = graphs.find(g => g.id === selectedGraphId);
    if (!currentGraph) return;

    // Réinitialiser le manager de CE graphe
    manager.clear();

    // Configurer les axes si disponibles
    if (currentGraph.axes) {
      manager.setAxesConfig(currentGraph.axes);
    }

    // Ajouter toutes les courbes non-interpolées au manager
    const nonInterpolatedCurves = currentGraph.curves.filter(c => !c.name.includes('(interpolé)'));
    nonInterpolatedCurves.forEach(curve => {
      const curveId = manager.addCurve(curve);
      // Si la courbe a déjà été ajustée, appliquer l'ajustement
      if (curve.fitted) {
        manager.fitCurve(curveId, {
          method: interpolationMethod,
          numPoints: interpolationPoints
        });
      }
    });

      }, [selectedGraphId, graphs, interpolationMethod, interpolationPoints, getManager]);

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
    // P1 : purger le manager du graphe supprimé (sinon fuite dans la map)
    managersRef.current.delete(graphId);
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

  const handleAddCurve = useCallback((name: string, color: string, windDirection?: WindDirection): string => {
    if (!selectedGraphId) return '';

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
    return newCurve.id;
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
    const manager = getManager(selectedGraphId);
    if (!manager) return;


    // Générer les courbes intermédiaires
    const newCurveIds = manager.generateIntermediateCurves(numIntermediateCurves);

    if (newCurveIds.length > 0) {
      // Mettre à jour l'état avec les nouvelles courbes
      const allCurves = manager.getAllCurves();

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
  }, [selectedGraphId, numIntermediateCurves, getManager]);

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
    const manager = getManager(selectedGraphId);
    if (!manager) return;

    const curve = manager.getCurve(curveId);
    if (curve) {
      curve.points.forEach(p => {
        if (p.id) manager.removePoint(curveId, p.id);
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
  }, [selectedGraphId, getManager]);

  // (Effet d'auto-interpolation de l'ancienne étape « fit » supprimé — R0 :
  //  currentStep ne vaut jamais 'fit' depuis SPRINT B, l'effet était mort.
  //  L'interpolation se déclenche via onFinish → handleFitAll.)

  const handleImportPoints = useCallback((curveId: string, points: XYPoint[]) => {
    const manager = getManager(selectedGraphId);
    if (!manager) return;

    points.forEach(p => {
      manager.addPoint(curveId, { ...p, id: uuidv4() });
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
  }, [selectedGraphId, getManager]);

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

          // Rester sur l'étape actuelle ou aller à l'étape sauvegardée.
          // Compat fichiers d'itération LEGACY : les anciennes étapes 'axes' et
          // 'fit' n'existent plus (R0) → remappées sur les étapes vivantes.
          if (iterationData.step) {
            const legacyMap: Record<string, Step> = { axes: 'points', points: 'points', fit: 'final', final: 'final' };
            const mapped = legacyMap[iterationData.step];
            if (mapped) setCurrentStep(mapped);
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
    // ─── 🔒 VERROU DE SÉCURITÉ — Validation des operationId (graphiques PRIMAIRES uniquement) ───
    // Les graphiques primaires DOIVENT porter un operationId valide.
    // Les graphiques intermédiaires (role: 'intermediate') sont des étapes de correction
    // et n'ont pas besoin d'operationId — ils sont chaînés en amont d'un primaire.
    // Le set doit contenir au moins un graphique primaire avec operationId valide.
    const issues: string[] = [];
    const primaries = graphs.filter(g => (g.role || 'primary') === 'primary');
    primaries.forEach((g) => {
      const globalIdx = graphs.indexOf(g) + 1;
      if (!g.operationId) {
        issues.push(`• Graphique ${globalIdx} (primaire) : aucune opération canonique sélectionnée (sous-étape 1).`);
      } else if (!isValidOperationId(g.operationId)) {
        issues.push(`• Graphique ${globalIdx} (primaire) : operationId "${g.operationId}" inconnu du catalogue.`);
      }
    });
    if (primaries.length === 0) {
      issues.push(`• Le set ne contient aucun graphique primaire — il ne produira aucune valeur exploitable. Marque au moins un graphique comme "Primaire" en sous-étape 1.`);
    }
    if (issues.length > 0) {
      const proceed = window.confirm(
        `⚠ Le set d'abaques a ${issues.length} problème(s) bloquant(s) :\n\n` +
        issues.join('\n') +
        `\n\nSans cela, ces abaques NE SERONT PAS consommés par la préparation de vol.\n\n` +
        `Veux-tu quand même sauvegarder ?`
      );
      if (!proceed) return;
    }

    // R1 — Atelier « image unique » : quand le workshop est UTILISÉ, l'axe Y
    // COMMUN est DUPLIQUÉ dans chaque graphe CADRÉ (c'est la définition d'un
    // abaque : même filigrane ⇒ même ordonnée). Les graphes hors cadre (cas
    // multi-feuilles) gardent leur Y propre. Le format de LECTURE (cascade,
    // prépa vol) ne change pas : chaque graphe reste autoporteur.
    const framedIds = new Set(workshop.frames.map(f => f.graphId));
    const exportedGraphs = workshopActive
      ? graphs.map(g => framedIds.has(g.id)
          ? { ...g, axes: { ...(g.axes || { xAxis: { min: 0, max: 100, unit: '', title: '' }, yAxis: { min: 0, max: 100, unit: '', title: '' } }), yAxis: { ...workshop.sharedY } } }
          : g)
      : graphs;

    // Préparer les données au nouveau format multi-graphiques
    const json: AbacCurvesJSON = {
      version: '2.0',
      graphs: exportedGraphs,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        systemType: systemType,  // contient désormais un operationId du catalogue canonique
        systemName: getOperation(systemType)?.labelFr || 'Système d\'abaques',
        modelName: aircraftModel || modelNameInput,
        aircraftModel: aircraftModel, // Sauvegarder explicitement le modèle d'avion
        description: `${getOperation(systemType)?.labelFr || 'Set'} pour ${aircraftModel || modelNameInput || 'modèle non spécifié'}`,
        // R1 — état de l'atelier pour la ré-édition (absent si non utilisé →
        // exports strictement identiques à avant la refonte).
        ...(workshopActive ? { workshop } : {})
      }
    };

    // Sauvegarder sans télécharger le fichier JSON
    if (onSave) {
      onSave(json, aircraftModel || modelNameInput);
    }
  }, [onSave, graphs, modelNameInput, aircraftModel, systemType, workshop, workshopActive]);

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
      // (case morte « axes » supprimée — R0 : retirée de la séquence depuis SPRINT B,
      //  la config des axes vit dans le wizard. AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md.)

      case 'points': {
        // ─── REFONTE SPRINT B : mini-wizard par graphique ───
        // ─── + ATELIER P2a (AUDIT_ABAC_CONSTRUCTION.md) : TOUS les graphes du set
        //     restent visibles côte à côte (bandeau d'aperçus LIVE) ; cliquer une
        //     carte met le graphe au focus — fini la navigation aveugle ◀ ▶.
        // L'ancien code de cette étape reste plus bas dans le fichier (inatteignable)
        // jusqu'à un cleanup ultérieur — backup dans backups/sprint-B-*.
        const currentGraphForWizard = graphs[Math.min(subStepGraphIndex, Math.max(0, graphs.length - 1))];

        // Ajout d'un graphe au set — partagé entre la carte « ＋ » du bandeau et
        // le bouton du wizard (création + focus immédiat sur le nouveau).
        const addGraphToWorkshop = () => {
          const newGraph: GraphConfig = {
            id: uuidv4(),
            name: `Graphique ${graphs.length + 1}`,
            isWindRelated: false,
            axes: {
              xAxis: { min: 0, max: 100, unit: '', title: '' },
              yAxis: { min: 0, max: 100, unit: '', title: '' }
            },
            curves: []
          };
          setGraphs(prev => [...prev, newGraph]);
          setSelectedGraphId(newGraph.id);
          setSelectedCurveId(null);
          // On positionne l'index sur le nouveau graphique (length AVANT l'ajout = nouvel index).
          setSubStepGraphIndex(graphs.length);
        };
        if (!currentGraphForWizard) {
          return (
            <div className={styles.stepContent}>
              <h2>Étape 2 : Construction & Interpolation</h2>
              <p style={{ padding: 16, color: 'var(--color-red-critical)' }}>
                ⚠ Aucun graphique configuré.
              </p>
              <button onClick={() => { if (onBack) onBack(); }} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                ← Retour
              </button>
            </div>
          );
        }
        return (
          <div className={styles.stepContent}>
            <h2>Étape 2 : Construction & Interpolation</h2>

            {/* L'identité du set est DÉDUITE du graphique primaire (cf. handleExportJSON).
                Pas de panneau séparé : identifier le primaire = identifier le set. */}
            <div style={{
              marginBottom: 12, padding: '6px 10px',
              backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-regular)', borderRadius: 4,
              fontSize: 12, color: 'var(--accent-primary)'
            }}>
              Avion : <strong>{aircraftModel || aircraftModelDisplay || '(non spécifié)'}</strong>
              {systemType && (
                <span style={{ marginLeft: 12 }}>
                  · Set : <strong>{getOperation(systemType)?.labelFr || systemType}</strong>
                </span>
              )}
            </div>

            {/* ─── BANDEAU ATELIER (P2a) : aperçus LIVE de tous les graphes ───
                Chaque carte rend le Chart réel du graphe (image filigrane, axes
                calibrés, courbes) en lecture seule, mis à jour à chaque saisie.
                Carte orange = graphe au FOCUS (édité par les outils ci-dessous) ;
                cliquer une autre carte déplace le focus. Sur écran étroit, la
                grille passe automatiquement sur plusieurs rangées. */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 10,
              marginBottom: 14
            }}>
              {graphs.map((g, gi) => {
                const isFocus = g.id === currentGraphForWizard.id;
                const role = g.role || 'primary';
                const refCurveCount = g.curves.filter(c => !c.name.includes('(interpolé)')).length;
                const isLinked = (g.linkedTo?.length || 0) + (g.linkedFrom?.length || 0) > 0;
                return (
                  <div
                    key={g.id}
                    onClick={() => { if (!isFocus) setSubStepGraphIndex(gi); }}
                    title={isFocus ? 'Graphique en cours d\'édition' : 'Cliquer pour éditer ce graphique'}
                    style={{
                      cursor: isFocus ? 'default' : 'pointer',
                      border: `2px solid ${isFocus ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      borderRadius: 6,
                      backgroundColor: isFocus ? 'rgba(242, 105, 33, 0.08)' : 'var(--bg-surface)',
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      minWidth: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, minWidth: 0 }}>
                      <strong style={{
                        color: isFocus ? 'var(--accent-primary)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {gi + 1} · {g.name || 'Graphique'}
                      </strong>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {role === 'primary' ? '⭐ primaire' : '🔗 intermédiaire'}
                        {isLinked ? ' · ⛓ lié' : ''}
                      </span>
                    </div>
                    <div style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                      {/* R0 (demande pilote) : PLUS de photo en filigrane dans les
                          aperçus — elle n'était pas à l'échelle de la vignette et
                          brouillait la lecture. L'aperçu = courbes + axes seuls. */}
                      <Chart
                        axesConfig={g.axes || {
                          xAxis: { min: 0, max: 100, unit: '', title: '' },
                          yAxis: { min: 0, max: 100, unit: '', title: '' }
                        }}
                        curves={g.curves}
                        selectedCurveId={null}
                        width={300}
                        height={170}
                        showGrid={true}
                        showLegend={false}
                        customXTicks={customAxisTicks[g.id]?.x}
                        customYTicks={customAxisTicks[g.id]?.y}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: isFocus ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                      {refCurveCount} courbe{refCurveCount > 1 ? 's' : ''} de référence
                      {isFocus ? ' — EN ÉDITION' : ''}
                    </div>

                    {/* ─── P3 : CONNECTEURS DE CASCADE — les liaisons entre graphes
                        s'éditent ICI, sur les cartes (chips ✕ pour délier, sélecteur
                        « + lier → » pour relier la SORTIE de ce graphe à l'entrée
                        d'un autre). Remplace les dropdowns abstraits du GraphManager. */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
                        borderTop: '1px solid var(--border-subtle)', paddingTop: 6, minHeight: 26
                      }}
                    >
                      {(g.linkedTo || []).map(toId => {
                        const target = graphs.find(x => x.id === toId);
                        const ti = graphs.findIndex(x => x.id === toId);
                        return (
                          <span key={`to-${toId}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, padding: '2px 6px', borderRadius: 10,
                            border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)'
                          }}>
                            sortie → {ti >= 0 ? `${ti + 1} · ` : ''}{target?.name || '?'}
                            <span
                              onClick={() => handleUnlinkGraphs(g.id, toId)}
                              title="Supprimer cette liaison de cascade"
                              style={{ cursor: 'pointer', fontWeight: 700 }}
                            >
                              ✕
                            </span>
                          </span>
                        );
                      })}
                      {(g.linkedFrom || []).map(fromId => {
                        const src = graphs.find(x => x.id === fromId);
                        const si = graphs.findIndex(x => x.id === fromId);
                        return (
                          <span key={`from-${fromId}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, padding: '2px 6px', borderRadius: 10,
                            border: '1px solid var(--border-regular)', color: 'var(--text-secondary)'
                          }}>
                            entrée ← {si >= 0 ? `${si + 1} · ` : ''}{src?.name || '?'}
                            <span
                              onClick={() => handleUnlinkGraphs(fromId, g.id)}
                              title="Supprimer cette liaison de cascade"
                              style={{ cursor: 'pointer', fontWeight: 700 }}
                            >
                              ✕
                            </span>
                          </span>
                        );
                      })}
                      {(() => {
                        const candidates = graphs.filter(x =>
                          x.id !== g.id && !(g.linkedTo || []).includes(x.id) && !(g.linkedFrom || []).includes(x.id)
                        );
                        if (candidates.length === 0) return null;
                        return (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) handleLinkGraphs(g.id, e.target.value); }}
                            title="Relier la SORTIE de ce graphe à l'entrée d'un autre (lecture en cascade)"
                            style={{
                              fontSize: 10, padding: '2px 4px', borderRadius: 10, cursor: 'pointer',
                              backgroundColor: 'var(--bg-overlay)', color: 'var(--text-secondary)',
                              border: '1px dashed var(--border-regular)', maxWidth: 130
                            }}
                          >
                            <option value="">＋ lier la sortie →</option>
                            {candidates.map(x => {
                              const xi = graphs.findIndex(y => y.id === x.id);
                              return <option key={x.id} value={x.id}>{xi + 1} · {x.name || 'Graphique'}</option>;
                            })}
                          </select>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
              {/* Carte « ＋ » : nouveau graphe dans le set, focus immédiat */}
              <button
                onClick={addGraphToWorkshop}
                title="Créer un nouveau graphique vide et l'ouvrir"
                style={{
                  cursor: 'pointer',
                  border: '2px dashed var(--border-regular)',
                  borderRadius: 6,
                  backgroundColor: 'var(--bg-overlay)',
                  color: 'var(--text-secondary)',
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 13
                }}
              >
                <span style={{ fontSize: 22, color: 'var(--accent-primary)' }}>＋</span>
                Ajouter un graphique
              </button>
            </div>

            {/* ─── P4 : TEST DE CASCADE EN ÉDITION — exécute le calcul complet
                (méthode des abaques, cascade.ts) sur les graphes EN L'ÉTAT, sans
                quitter la construction : un chaînage incohérent se voit ICI, pas
                en préparation de vol. Le CascadeCalculator est le même composant
                que côté lecture ; il signale lui-même les courbes non interpolées. */}
            <details style={{
              marginBottom: 14,
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              backgroundColor: 'var(--bg-overlay)'
            }}>
              <summary style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--accent-primary)'
              }}>
                🧪 Tester la cascade sur les graphes en l'état
              </summary>
              <div style={{ padding: 8 }}>
                <CascadeCalculator graphs={graphs} />
              </div>
            </details>

            <AbacGraphWizard
              hideGraphNav
              graph={currentGraphForWizard}
              graphIndex={subStepGraphIndex}
              totalGraphs={graphs.length}
              backgroundImage={backgroundImages[currentGraphForWizard.id] || null}
              customAxisTicks={customAxisTicks[currentGraphForWizard.id]}
              chartSize={{ width: getChartWidth(currentGraphForWizard.id), height: getChartHeight(currentGraphForWizard.id) }}
              selectedCurveId={selectedCurveId}
              onUpdateGraph={(partial) => {
                setGraphs(prev => prev.map(g => g.id === currentGraphForWizard.id ? { ...g, ...partial } : g));
                // Auto-sync : le systemType du set = operationId du graphique primaire courant
                // (si on est en train de modifier l'operationId d'un primaire).
                const isPrimary = (currentGraphForWizard.role || 'primary') === 'primary';
                if (isPrimary && partial.operationId !== undefined) {
                  setSystemType(partial.operationId);
                  const op = getOperation(partial.operationId);
                  if (op) setModelNameInput(op.labelFr);
                }
              }}
              onSetBackgroundImage={(img) => {
                setBackgroundImages(prev => {
                  if (img === null) { const { [currentGraphForWizard.id]: _, ...rest } = prev; return rest; }
                  return { ...prev, [currentGraphForWizard.id]: img };
                });
              }}
              onSetCustomAxisTicks={(axis, ticks) => {
                setCustomAxisTicks(prev => {
                  const cur = prev[currentGraphForWizard.id] || {};
                  if (ticks === null) {
                    const { [axis]: _, ...rest } = cur;
                    if (Object.keys(rest).length === 0) {
                      const { [currentGraphForWizard.id]: __, ...others } = prev;
                      return others;
                    }
                    return { ...prev, [currentGraphForWizard.id]: rest };
                  }
                  return { ...prev, [currentGraphForWizard.id]: { ...cur, [axis]: ticks } };
                });
              }}
              onSetChartSize={(size) => {
                setChartSizes(prev => {
                  if (size === null) { const { [currentGraphForWizard.id]: _, ...rest } = prev; return rest; }
                  return { ...prev, [currentGraphForWizard.id]: size };
                });
              }}
              onSelectCurve={setSelectedCurveId}
              onAddCurve={handleAddCurve}
              onRemoveCurve={handleRemoveCurve}
              onUpdateCurve={handleUpdateCurve}
              onReorderCurves={handleReorderCurves}
              onPointClick={handlePointClick}
              onPointDrag={handlePointDrag}
              onPointDelete={handlePointDelete}
              onPreviousGraph={() => {
                if (subStepGraphIndex > 0) setSubStepGraphIndex(subStepGraphIndex - 1);
                else if (onBack) onBack();
              }}
              onNextGraph={() => {
                if (subStepGraphIndex < graphs.length - 1) setSubStepGraphIndex(subStepGraphIndex + 1);
              }}
              onAddGraph={addGraphToWorkshop}
              onRemoveGraph={() => {
                const idToRemove = currentGraphForWizard.id;
                const newIndex = Math.max(0, subStepGraphIndex - (subStepGraphIndex >= graphs.length - 1 ? 1 : 0));
                setGraphs(prev => prev.filter(g => g.id !== idToRemove));
                setBackgroundImages(prev => { const { [idToRemove]: _, ...rest } = prev; return rest; });
                setCustomAxisTicks(prev => { const { [idToRemove]: _, ...rest } = prev; return rest; });
                setChartSizes(prev => { const { [idToRemove]: _, ...rest } = prev; return rest; });
                setSubStepGraphIndex(newIndex);
                setSelectedCurveId(null);
              }}
              onFinish={() => {
                handleFitAll({ method: interpolationMethod, numPoints: interpolationPoints });
                setCurrentStep('final');
              }}
            />
          </div>
        );
      }

      // (cases mortes « points_legacy_unused », « fit », « fit_old » supprimées — R0,
      //  AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md : jamais atteignables depuis SPRINT B.)

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
                backgroundColor: 'var(--bg-overlay)',
                borderRadius: '8px',
                border: '1px solid var(--accent-primary)'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: 'var(--accent-primary)' }}>
                  Configuration du système
                </h3>
                <div style={{ fontSize: 'var(--fs-body)', lineHeight: '1.6' }}>
                  <div><strong>Type de système :</strong> {SYSTEM_TYPES.find(t => t.value === systemType)?.label}</div>
                  <div><strong>Modèle d'avion :</strong> {aircraftModel || modelNameInput || 'Non spécifié'}</div>
                  <div><strong>Identifiant système :</strong> <code>{systemType}</code></div>
                  <div style={{ marginTop: '8px', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                    Cet identifiant sera utilisé pour référencer ce système dans l'application
                  </div>
                </div>
              </div>

              {/* Filtre pour les courbes vent - visible uniquement si au moins un graphique est lié au vent */}
              {false && graphs.some(g => g.isWindRelated) && (
                <div style={{
                  marginBottom: '20px',
                  padding: '10px',
                  backgroundColor: 'var(--bg-overlay)',
                  borderRadius: '8px',
                  border: '1px solid var(--accent-primary)'
                }}>
                  <h3 style={{ margin: '0 0 12px 0', color: 'var(--accent-primary)' }}>
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
                          fontSize: 'var(--fs-body)',
                          backgroundColor: windFilter === 'all' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                          color: windFilter === 'all' ? 'var(--bg-overlay)' : 'var(--accent-primary)',
                          border: '2px solid var(--accent-primary)',
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
                          fontSize: 'var(--fs-body)',
                          backgroundColor: windFilter === 'headwind' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                          color: windFilter === 'headwind' ? 'var(--bg-overlay)' : 'var(--accent-primary)',
                          border: '2px solid var(--accent-primary)',
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
                          fontSize: 'var(--fs-body)',
                          backgroundColor: windFilter === 'tailwind' ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                          color: windFilter === 'tailwind' ? 'var(--bg-overlay)' : 'var(--accent-primary)',
                          border: '2px solid var(--accent-primary)',
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
                    fontSize: 'var(--fs-body)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-overlay)',
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
                    <div key={graph.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px', overflow: 'hidden' }}>
                      <h3 style={{ marginBottom: '8px', fontSize: 'var(--fs-body)' }}>
                        {graph.name}
                        {graph.isWindRelated && (
                          <span style={{
                            fontSize: 'var(--fs-caption)',
                            color: 'var(--accent-primary)',
                            marginLeft: '6px',
                            backgroundColor: 'var(--bg-overlay)',
                            padding: '2px 4px',
                            borderRadius: '3px'
                          }}>
                            💨 {windFilter === 'headwind' ? 'Face' : windFilter === 'tailwind' ? 'Arrière' : 'Tous'}
                          </span>
                        )}
                        {graph.linkedFrom && graph.linkedFrom.length > 0 && (
                          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)', marginLeft: '6px' }}>
                            ←
                          </span>
                        )}
                        {graph.linkedTo && graph.linkedTo.length > 0 && (
                          <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)', marginLeft: '6px' }}>
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
                          color: 'var(--text-tertiary)',
                          backgroundColor: 'var(--bg-overlay)',
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
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-inverse)',
                  borderRadius: '4px',
                  fontSize: 'var(--fs-body)',
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
                    backgroundColor: 'var(--bg-overlay)',
                    color: 'var(--text-inverse)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: 'var(--fs-body)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flex: 1
                  }}
                  onClick={() => setCurrentStep('points')}
                  title="Retourner à l'étape de construction et interpolation"
                >
                  <span style={{ fontSize: 'var(--fs-title)' }}>←</span>
                  Précédent
                </button>

                {/* Bouton Suivant pour sauvegarder et passer à l'équipement */}
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: modelNameInput ? 'var(--accent-primary)' : 'var(--bg-overlay)',
                    color: 'var(--text-inverse)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: modelNameInput ? 'pointer' : 'not-allowed',
                    fontSize: 'var(--fs-body)',
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
                  <span style={{ fontSize: 'var(--fs-title)' }}>→</span>
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'points':
        // Au moins une courbe avec 2 points minimum
        return graphs.some(g => g.curves.some(c => c.points.length >= 2));
      case 'final':
        return true;
      default:
        return false;
    }
  };

  const steps: Step[] = ['points', 'final'];
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