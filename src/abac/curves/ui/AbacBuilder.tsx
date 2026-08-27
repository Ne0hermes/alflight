import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
// R0 : imports morts retirés (AxesForm/CurveManager/PointsTable n'étaient utilisés
// que par les cases supprimées ; PointEditor/GraphManager étaient orphelins).
// CurveManager et PointsTable restent VIVANTS via AbacGraphWizard qui les monte.
import { Chart } from './Chart';
import { WorkshopCanvas } from './WorkshopCanvas';
// (import ChainCalculator retiré : jamais utilisé comme valeur → esbuild l'élidait,
//  ce qui a masqué pendant des mois la casse syntaxique de tout le graphe cascade.
//  Le composant, restauré et sain, reste disponible dans ./ChainCalculator.)
// Lot 1-F — badge « Banc : x/y OK » du banc monté à l'écran Tracé.
// Lot 1-G — assemblage final : rail de checklist permanent (ChecklistRail +
// modelReadiness), KitPanel sur les grands blocs, KitButton sur les actions.
import { KitBadge, KitButton, KitPanel, SPACING } from './kit';
import {
  computeGraphReadiness,
  computeSetReadiness,
  READINESS_BENCH_ITEM_ID,
  ReadinessItem
} from '../core/modelReadiness';
import { AbacCurveManager } from '../core/manager';
import { AbacGraphWizard } from './AbacGraphWizard';
import { GraphIdentityPanel } from './GraphIdentityPanel';
import { ReferenceCasesPanel } from './ReferenceCasesPanel';
// 23/08 — guides numérotés : un panneau de correction ne réclame plus de
// valeur de famille (le moteur suit la pente entre les guides).
import { usesNumberedGuides, isFirstFramedGraph } from '../core/guideMode';
import { runAllReferenceCases } from '../core/referenceBench';
import { ensureFittedGraphs, stripFittedGraphs } from '../core/fittedRuntime';
import { isValidOperationId, getOperation } from '../core/operationCatalog';
// Lot 1-C — écran « Opération » (setup) : panneau UI + déduction pure du set
// (rôles, readoutAxis, familles, cadres pré-répartis) depuis les 3 réponses.
import { OperationSetupPanel } from './OperationSetupPanel';
import {
  PlancheType,
  buildSetupGraphs,
  applySetupRoles,
  appendPanels
} from '../core/plancheSetup';
import {
  makeAtelierContextKey,
  getAtelierDraft,
  putAtelierDraft,
  deleteAtelierDraft
} from '../core/atelierDraftStore';
import {
  Curve,
  XYPoint,
  FitOptions,
  FitResult,
  AbacCurvesJSON,
  GraphConfig,
  WindDirection,
  InterpolationMethod,
  WorkshopConfig,
  ReferenceCase
} from '../core/types';
import {
  BezierOverrides,
  BezierSegment,
  applyBezierOverrides,
  fitBezierThroughPoints,
  sampleBezierSegments
} from '../core/bezier';
import { isWindAxisVariable } from '../core/axisVariables';
import styles from './styles.module.css';

// R0 : l'étape 'axes' (morte depuis SPRINT B) est retirée du type.
// Lot 1-C : nouvelle étape 'setup' (écran « Opération ») posée UNE FOIS au
// départ d'un modèle VIERGE — opération canonique + type de planche + nombre
// de panneaux, tout le reste (rôles, readoutAxis, familles) est DÉDUIT.
// Un modèle EXISTANT en édition saute directement à 'points' (« Tracé »).
// Écrans sans numéros : Opération → Tracé → Validation.
type Step = 'setup' | 'points' | 'final';

// Lot 0 — réglages d'interpolation : leurs setters n'ont jamais été branchés à
// l'UI (états figés depuis toujours) → constantes assumées.
const INTERPOLATION_METHOD: InterpolationMethod = 'naturalSpline';
const INTERPOLATION_POINTS = 200;

interface AbacBuilderProps {
  onSave?: (json: AbacCurvesJSON, modelName?: string) => void;
  initialData?: AbacCurvesJSON;
  modelName?: string;
  aircraftModel?: string;
  onBack?: () => void;
  /** Session de travail détenue par le wizard avion (AircraftCreationWizard.abacSessionRef).
   *  Partie `atelier` : tout le tracé en cours (workshop, graphs, calibrations…)
   *  survit ainsi au démontage de l'atelier lors d'un changement d'étape. */
  sessionRef?: React.MutableRefObject<any>;
}

// Exposer les méthodes via un ref
export interface AbacBuilderRef {
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  getCurrentStep: () => Step;
}

// Define the component function separately
function AbacBuilderComponent(
  { onSave, initialData, modelName, aircraftModel, onBack, sessionRef }: AbacBuilderProps,
  ref: React.Ref<AbacBuilderRef>
) {
  // P1 (AUDIT_ABAC_CONSTRUCTION.md) : UN AbacCurveManager PAR GRAPHE.
  // L'ancien managerRef unique était vidé/rechargé à chaque bascule de graphe —
  // incompatible avec l'atelier multi-colonnes (P2) où plusieurs graphes
  // s'éditent sans bascule. Création paresseuse par id.
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

  // ─── Session d'atelier restaurée ──────────────────────────────────────────
  // L'atelier est démonté au moindre changement d'étape de l'assistant avion
  // (ou en repassant par le récapitulatif) : image MANEX, cadres, axes, points
  // cliqués, calibrations, cas de référence… tout le tracé disparaissait et il
  // fallait recommencer. La session est détenue par le wizard avion
  // (abacSessionRef) et survit donc jusqu'à l'enregistrement final. `S` est lu
  // au premier rendu : les initialiseurs paresseux ci-dessous ne s'exécutent
  // qu'au montage (même motif que CentrogramReader).
  //
  // INVALIDATION : la session est liée à UN abaque précis. Si l'atelier
  // s'ouvre sur un AUTRE initialData (édition d'un autre modèle, ou passage
  // édition ↔ création), le marqueur ne correspond plus : la session est
  // ignorée — l'effet de persistance la remplace dès ce montage. Les ids de
  // graphes (uuid) rendent le marqueur unique par modèle sans hacher tout le
  // JSON (les points peuvent peser des centaines de Ko).
  const sessionMarker = initialData
    ? `${initialData.metadata?.systemType || ''}|${initialData.metadata?.modelName || ''}|${(initialData.graphs || []).map(g => g.id).join(',')}`
    : 'nouveau';
  const storedAtelier = sessionRef?.current?.atelier;
  const S: any = storedAtelier && storedAtelier.marker === sessionMarker ? storedAtelier : null;
  // Session « fermée » après l'enregistrement final : on cesse de persister,
  // sinon le prochain « Nouvel abaque » restaurerait le set qu'on vient
  // d'enregistrer → double enregistrement du même travail.
  const sessionClosedRef = useRef(false);

  // ─── Lot 0 — SURVIE AU RECHARGEMENT DE PAGE (F5) ──────────────────────────
  // La session ci-dessus vit dans un useRef du wizard avion : elle survit aux
  // allers-retours d'étape mais PAS à un rechargement (F5 = image, cadres,
  // calibrations, courbes perdus — douleur pilote n°1). Le MÊME payload est
  // donc déposé, débouncé, dans IndexedDB (atelierDraftStore — l'image dataURL
  // pèse plusieurs Mo, localStorage interdit) et restauré au montage UNIQUEMENT
  // quand la session du wizard est VIDE (vrai rechargement, pas un simple
  // changement d'étape) ET que le contexte (avion|modèle) correspond.
  const draftContextKey = makeAtelierContextKey(aircraftModel, modelName);
  // Décision figée AVANT le premier effet : session vide ⇔ vrai rechargement.
  const shouldTryRestoreRef = useRef(!(sessionRef?.current?.atelier));
  // Tant que la décision de restauration n'est pas rendue, l'instantané
  // débouncé est SUSPENDU (sinon l'état initial du montage écraserait le
  // brouillon qu'on s'apprête à restaurer).
  const [restoring, setRestoring] = useState<boolean>(shouldTryRestoreRef.current);
  const [restoredBanner, setRestoredBanner] = useState(false);

  // ─── R1 — Atelier « image unique » (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md) ───
  // État du workshop : UNE image pour le SET, un axe Y COMMUN, des cadres (un
  // par graphe). Posé en R1 (persistance metadata.workshop + duplication du Y
  // à l'export) ; le canevas visuel arrive en R2/R3. Tant que l'atelier n'est
  // pas utilisé (image null + aucun cadre), les exports restent STRICTEMENT
  // identiques à avant — zéro changement de comportement.
  const [workshop, setWorkshop] = useState<WorkshopConfig>(S?.workshop ?? {
    image: null,
    sharedY: { min: 0, max: 100, unit: '', title: '' },
    frames: []
  });
  const workshopActive = workshop.image !== null || workshop.frames.length > 0;

  // R3 — mode d'édition du wizard, remonté pour le canevas : le clic-points
  // sur le canevas n'est armé qu'en mode « placement » (même verrou que le
  // Chart du wizard contre les clics fantômes).
  const [wizardEditorMode, setWizardEditorMode] = useState<string>('idle');

  // Capsule « Nouvelle courbe » du canevas : le wizard reste l'UNIQUE
  // propriétaire de editorMode — la capsule lui envoie des COMMANDES
  // (nonce incrémenté = appliquer une fois), il continue de refléter son
  // état via onEditorModeChange. Pas de second lieu de vérité.
  const [wizardModeCommand, setWizardModeCommand] = useState<{ mode: 'placing-points' | 'idle'; nonce: number } | null>(null);

  // R7 — session de façonnage Bézier SUR LE CANEVAS (le Chart séparé a disparu
  // du mode atelier : « tout doit se passer sur le graphique », retour pilote).
  // La session porte la courbe ciblée + les poignées tirées (coords DATA).
  const [bezierSession, setBezierSession] = useState<{ curveId: string; overrides: BezierOverrides } | null>(S?.bezierSession ?? null);

  // R13 — BANC DE TEST PERMANENT : cas de référence du manuel, persistés dans
  // metadata.referenceCases et rejoués à la validation (PASS/FAIL ± tolérance).
  const [referenceCases, setReferenceCases] = useState<ReferenceCase[]>(S?.referenceCases ?? []);
  // (Retour pilote 20/08 : le calculateur en cascade a été RETIRÉ de l'atelier
  // — « je ne m'en sers jamais ». Le banc de test est le seul outil de
  // vérification : entrées + attendu → PASS/FAIL immédiat.)
  // Lot 1-F — le banc au Tracé : <details> contrôlé, ouvert au clic « 📌 »
  // pour que le prefill atterrisse dans un panneau VISIBLE. Volatile (non
  // persisté, comme wizardEditorMode).

  // R2a — La CHAÎNE de cascade suit l'ordre des cadres sur l'image :
  // gauche→droite = G1→G2→G3 (le geste de lecture de l'abaque papier).
  // Ne réécrit linkedTo/linkedFrom QUE pour les graphes CADRÉS, et seulement
  // en cas de changement réel (sinon on rend la même référence → pas de boucle).
  React.useEffect(() => {
    if (workshop.frames.length === 0) return;
    const order = [...workshop.frames].sort((a, b) => a.xLeftPx - b.xLeftPx).map(f => f.graphId);
    setGraphs(prev => {
      let changed = false;
      const next = prev.map(g => {
        const idx = order.indexOf(g.id);
        if (idx === -1) return g;
        const to = idx < order.length - 1 ? [order[idx + 1]] : [];
        const from = idx > 0 ? [order[idx - 1]] : [];
        const sameTo = JSON.stringify(g.linkedTo || []) === JSON.stringify(to);
        const sameFrom = JSON.stringify(g.linkedFrom || []) === JSON.stringify(from);
        if (sameTo && sameFrom) return g;
        changed = true;
        return { ...g, linkedTo: to, linkedFrom: from };
      });
      return changed ? next : prev;
    });
  }, [workshop.frames]);

  // R2b — Le Y COMMUN se propage en continu aux graphes CADRÉS : cohérence
  // immédiate du wizard (champs Y en lecture seule), du test de cascade et de
  // l'export (qui le duplique déjà). Réécrit seulement si différent.
  React.useEffect(() => {
    if (workshop.frames.length === 0) return;
    const framed = new Set(workshop.frames.map(f => f.graphId));
    setGraphs(prev => {
      let changed = false;
      const next = prev.map(g => {
        if (!framed.has(g.id)) return g;
        const cur = g.axes?.yAxis;
        if (cur && JSON.stringify(cur) === JSON.stringify(workshop.sharedY)) return g;
        changed = true;
        return {
          ...g,
          axes: {
            ...(g.axes || { xAxis: { min: 0, max: 100, unit: '', title: '' }, yAxis: { ...workshop.sharedY } }),
            yAxis: { ...workshop.sharedY }
          }
        };
      });
      return changed ? next : prev;
    });
  }, [workshop.frames, workshop.sharedY]);

  // Lot 1-C : un montage VIERGE (pas d'initialData) démarre sur l'écran
  // « Opération » (setup) ; l'édition d'un modèle existant reste sur 'points'
  // (le saut est confirmé/affiné par hydrateFromInitialData, qui renvoie sur
  // 'setup' un initialData réellement vierge). La session restaurée fait foi.
  const [currentStep, setCurrentStep] = useState<Step>(
    (S?.currentStep as Step) ?? (initialData ? 'points' : 'setup')
  );

  // Exposer les méthodes via useImperativeHandle
  React.useImperativeHandle(ref, () => ({
    goToNextStep: () => {
      // Lot 1-C : 'setup' ne se quitte QUE par « Créer les cadres → » (gardes
      // de l'écran Opération) — pas de saut impératif possible depuis ici.
      const steps: Step[] = ['points', 'final'];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex >= 0 && currentIndex < steps.length - 1) {
        const nextStep = steps[currentIndex + 1];
        setCurrentStep(nextStep);
      }
    },
    goToPreviousStep: () => {
      // Lot 1-C : depuis l'écran Opération, « précédent » = sortie de l'atelier.
      if (currentStep === 'setup') {
        if (onBack) onBack();
        return;
      }
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
  const [graphs, setGraphs] = useState<GraphConfig[]>(S?.graphs ?? []);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);

  // Lot 1-F — compteur permanent « Banc : x/y OK » (résumé du banc au Tracé).
  // runAllReferenceCases est pur ; mémoïsé sur (graphs, referenceCases).
  const benchResults = React.useMemo(() => runAllReferenceCases(graphs, referenceCases), [graphs, referenceCases]);
  const benchPass = benchResults.filter(r => r.status === 'pass').length;
  const [selectedCurveId, setSelectedCurveId] = useState<string | null>(null);
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
    S?.modelNameInput ?? (modelName || SYSTEM_TYPES.find(t => t.value === 'takeoff_distance')?.label || '')
  );
  const [aircraftModelDisplay, setAircraftModelDisplay] = useState<string>(S?.aircraftModelDisplay ?? (aircraftModel || ''));
  // SPRINT B+ : systemType contient désormais un operationId du catalogue canonique
  // (au lieu d'une valeur SYSTEM_TYPES legacy). Vide par défaut → force l'utilisateur à choisir.
  const [systemType, setSystemType] = useState<string>(S?.systemType ?? '');
  // Lot 1-C — TYPE DE PLANCHE du set, choisi UNE fois à l'écran « Opération » :
  // 'standard' (résultat lu sur Y) ou 'descendante' (dernier graphe en
  // readoutAxis 'x', résultat lu en bas). null = pas encore déterminé.
  // Persisté en session/brouillon, exporté dans metadata.plancheType ; pour
  // les modèles antérieurs il est INFÉRÉ à l'ouverture (hydrateFromInitialData).
  const [plancheType, setPlancheType] = useState<PlancheType | null>(S?.plancheType ?? null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);


  // Sous-étape par graphique dans l'étape "Construction et Interpolation"
  // Permet de traiter les graphiques un par un au lieu de les afficher tous ensemble.
  const [subStepGraphIndex, setSubStepGraphIndex] = useState<number>(S?.subStepGraphIndex ?? 0);

  // ─── Lot 1-G : LE RAIL DE CHECKLIST PERMANENT ─────────────────────────────
  // modelReadiness (Lot 1-D) alimente un ChecklistRail sticky sur les écrans
  // Tracé et Validation : items du SET en tête, puis un groupe par CADRE
  // (ordre des cadres). Recalcul mémoïsé — computeSetReadiness rejoue le banc,
  // c'est voulu (léger, même cadence que benchResults plus haut).
  const orderedFrames = React.useMemo(
    () => [...workshop.frames].sort((a, b) => a.xLeftPx - b.xLeftPx),
    [workshop.frames]
  );
  const setReadiness = React.useMemo(
    () => computeSetReadiness(graphs, workshop, referenceCases, modelNameInput),
    [graphs, workshop, referenceCases, modelNameInput]
  );
  const graphReadinessById = React.useMemo(() => {
    const y = workshop.sharedY;
    const sharedYCalibrated = (workshop.yTicks?.length ?? 0) >= 2
      || (isFinite(y.min) && isFinite(y.max) && y.min !== y.max
          && typeof y.step === 'number' && isFinite(y.step) && y.step > 0);
    const chain = orderedFrames
      .map(f => graphs.find(g => g.id === f.graphId))
      .filter((g): g is GraphConfig => !!g);
    const map = new Map<string, ReadinessItem[]>();
    chain.forEach((g, i) => {
      map.set(g.id, computeGraphReadiness(g, {
        isFirst: i === 0,
        isLast: i === chain.length - 1,
        frame: orderedFrames.find(f => f.graphId === g.id),
        sharedYCalibrated
      }));
    });
    return map;
  }, [graphs, orderedFrames, workshop.sharedY, workshop.yTicks]);

  // Champ « Nom du modèle » de l'écran Validation — ciblé par l'item de
  // checklist « Nom du modèle » (clic → focus du champ marqué).
  const modelNameFieldRef = useRef<HTMLInputElement>(null);

  // ─── Persistance de la session ────────────────────────────────────────────
  // Un seul effet : à chaque changement, l'intégralité du travail en cours est
  // déposée dans le ref du wizard avion. Le démontage ne détruit donc plus rien.
  // Volatiles exclus à dessein : wizardEditorMode / wizardModeCommand (gestes
  // de souris), warnings (recalculés à l'interpolation).
  React.useEffect(() => {
    if (!sessionRef || sessionClosedRef.current) return;
    sessionRef.current = {
      ...(sessionRef.current || {}),
      atelier: {
        marker: sessionMarker,
        workshop, graphs, referenceCases,
        bezierSession, systemType, plancheType, modelNameInput, aircraftModelDisplay,
        currentStep, subStepGraphIndex,
      },
    };
  }, [sessionRef, sessionMarker, workshop, graphs,
      referenceCases, bezierSession, systemType, plancheType, modelNameInput,
      aircraftModelDisplay, currentStep, subStepGraphIndex]);

  // ─── Instantané IndexedDB (survie F5) — effet JUMEAU débouncé du précédent.
  // Même payload que la session + contextKey/horodatage, clé unique
  // 'atelier-draft'. Débounce 1,5 s : l'image dataURL peut peser plusieurs Mo,
  // on n'écrit pas à chaque frappe. Le garde sessionClosedRef est revérifié
  // DANS le timer : un dépôt en attente au moment de l'enregistrement final ne
  // doit pas ressusciter le brouillon qu'on vient d'effacer.
  React.useEffect(() => {
    if (sessionClosedRef.current || restoring) return;
    const t = window.setTimeout(() => {
      if (sessionClosedRef.current) return;
      void putAtelierDraft({
        contextKey: draftContextKey,
        savedAt: Date.now(),
        marker: sessionMarker,
        workshop, graphs, referenceCases,
        bezierSession, systemType, plancheType, modelNameInput, aircraftModelDisplay,
        currentStep, subStepGraphIndex,
      });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [restoring, draftContextKey, sessionMarker, workshop, graphs,
      referenceCases, bezierSession, systemType, plancheType, modelNameInput,
      aircraftModelDisplay, currentStep, subStepGraphIndex]);

  // ─── Restauration au montage (vrai rechargement uniquement) ───────────────
  // IndexedDB est asynchrone : le montage affiche « Restauration du tracé… »
  // (voir le return) puis hydrate les états EN UN SEUL PASSAGE, dans le même
  // ordre que les initialiseurs paresseux S?. ci-dessus — le snapshot devient
  // la session au prochain run de l'effet de persistance. contextKey ≠
  // contexte courant : snapshot ignoré (il appartient à un autre tracé), on le
  // laisse en place. Pas de garde d'annulation : les setters d'un composant
  // démonté sont inoffensifs (React 18) et le flag interdit toute ré-entrée.
  React.useEffect(() => {
    if (!shouldTryRestoreRef.current) return;
    shouldTryRestoreRef.current = false;
    (async () => {
      const draft = await getAtelierDraft();
      if (draft && draft.contextKey === draftContextKey) {
        if (draft.workshop) setWorkshop(draft.workshop);
        setBezierSession(draft.bezierSession ?? null);
        setReferenceCases(draft.referenceCases ?? []);
        if (draft.currentStep) setCurrentStep(draft.currentStep as Step);
        setGraphs(draft.graphs ?? []);
        if (draft.modelNameInput !== undefined) setModelNameInput(draft.modelNameInput);
        if (draft.aircraftModelDisplay !== undefined) setAircraftModelDisplay(draft.aircraftModelDisplay);
        if (draft.systemType !== undefined) setSystemType(draft.systemType);
        // Lot 1-C — brouillons antérieurs sans plancheType : null (l'écran
        // Opération et le bandeau du Tracé savent vivre sans).
        setPlancheType(draft.plancheType ?? null);
        setSubStepGraphIndex(draft.subStepGraphIndex ?? 0);
        setRestoredBanner(true);
      }
      setRestoring(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Lot 1-E (piège « contamination croisée ») : en mode TRACÉ, changer de
      // cadre ne doit PAS auto-sélectionner la 1ʳᵉ courbe du nouveau graphe —
      // le clic vient de terminer la courbe en cours, un guide du nouveau
      // cadre serait silencieusement réarmé pour le tracé. Hors tracé,
      // comportement historique conservé.
      if (wizardEditorMode !== 'placing-points'
        && targetGraph.curves.length > 0
        && !targetGraph.curves.find(c => c.id === selectedCurveId)) {
        setSelectedCurveId(targetGraph.curves[0].id);
      }
    }
  }, [subStepGraphIndex, graphs.length, graphs, selectedGraphId, selectedCurveId, wizardEditorMode]);

  // Réinitialise l'index à 0 quand on (re)rentre dans l'étape "points".
  // 🔧 Session : au MONTAGE (prev === null), on respecte l'index restauré —
  // seule une VRAIE transition d'étape (final → points) remet à zéro. Sans
  // session, l'index initial vaut déjà 0 : sauter le premier passage est neutre.
  const prevStepRef = useRef<Step | null>(null);
  React.useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = currentStep;
    if (currentStep === 'points' && prev !== null && prev !== currentStep) {
      setSubStepGraphIndex(0);
    }
  }, [currentStep]);

  // Lot 1-C — l'auto-création SPRINT B du « Graphique 1 » sur set vide est
  // SUPPRIMÉE : elle faisait apparaître le bandeau compat « construit avant
  // l'atelier image unique » sur un projet NEUF (audit-7 §11). Les graphes
  // d'un nouveau set naissent désormais TOUS à l'écran « Opération » (setup),
  // cadres compris — le bandeau compat D4 du canevas (frames 0 + graphs > 0)
  // ne concerne plus que les VRAIS modèles legacy. selectedGraphId est posé
  // par le setup (et resynchronisé par l'effet subStepGraphIndex ci-dessus).


  // Pour compatibilité avec l'ancien système
  const currentGraph = graphs.find(g => g.id === selectedGraphId);
  const axesConfig = currentGraph?.axes || null;

  // Lot 0 — le filtre vent de l'étape 3 était figé sur 'all' (UI dans un bloc
  // {false && …} jamais rendu) : courbes du graphe courant, sans filtrage.
  const curves = currentGraph ? currentGraph.curves : [];

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
  // 🔧 Survie F5 : corps extrait en callback, rejoué tel quel par le bouton
  // « Abandonner ce tracé » de la bannière de restauration — un modèle en
  // édition revient ainsi à l'état d'un montage vierge (re-hydraté depuis
  // initialData) au lieu d'un atelier vide.
  const hydrateFromInitialData = useCallback(() => {
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

      // R13 — restaurer le banc de test du modèle
      if (initialData.metadata?.referenceCases?.length) {
        setReferenceCases(initialData.metadata.referenceCases);
      }

      // Lot 1-C — type de planche : métadonnée si présente, sinon INFÉRÉ de la
      // géométrie (un readoutAxis 'x' quelque part ⇒ descendante, sinon
      // standard). Un initialData sans aucun graphe/courbe reste null : le
      // choix appartient à l'écran « Opération ».
      const hydratedGraphs = initialData.graphs || [];
      if (initialData.metadata?.plancheType) {
        setPlancheType(initialData.metadata.plancheType);
      } else if (hydratedGraphs.length > 0 || (initialData.curves && initialData.curves.length > 0)) {
        setPlancheType(hydratedGraphs.some(g => g.readoutAxis === 'x') ? 'descendante' : 'standard');
      } else {
        setPlancheType(null);
      }

      if (initialData.graphs) {
        // Nouveau format multi-graphiques
        // Vérifier et mettre à jour la propriété isWindRelated si nécessaire
        // R20 — régénère fitted si le modèle a été persité sans (donnée dérivée
        // retirée pour la taille) : le Chart/canevas et le test in-builder en
        // ont besoin pour l'affichage.
        const updatedGraphs = ensureFittedGraphs(initialData.graphs.map(graph => ({
          ...graph,
          isWindRelated: graph.isWindRelated !== undefined ? graph.isWindRelated : isWindRelatedGraph(graph)
        })));
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
      // Lot 1-C — un modèle EXISTANT saute l'écran « Opération » (aucun
      // re-défaut appliqué) ; mais un initialData réellement VIERGE (aucune
      // courbe, aucun operationId/systemType) est traité comme une création :
      // écran « Opération » d'abord.
      const virgin = !initialData.metadata?.systemType
        && !hydratedGraphs.some(g => g.operationId || (g.curves || []).length > 0)
        && !(initialData.curves && initialData.curves.length > 0);
      setCurrentStep(virgin ? 'setup' : 'points');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, aircraftModel]);

  React.useEffect(() => {
    // Session reprise : le travail en cours fait foi — rejouer l'hydratation
    // depuis initialData écraserait les graphs/workshop/systemType qu'on vient
    // de restaurer par les initialiseurs paresseux. Quand initialData change
    // RÉELLEMENT (ouverture d'un AUTRE abaque), le marqueur de session ne
    // correspond plus : S est null et l'hydratation (hydrateFromInitialData)
    // reprend — l'ouverture normale d'un abaque existant reste donc intacte.
    if (S) return;
    hydrateFromInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, aircraftModel, hydrateFromInitialData]);

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
          method: INTERPOLATION_METHOD,
          numPoints: INTERPOLATION_POINTS
        });
      }
    });

      }, [selectedGraphId, graphs, getManager]);


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


  // R17 — `familyValue` posé À LA CRÉATION : quand la courbe est créée depuis
  // la liste déroulante de valeurs (capsule / gestionnaire), la valeur
  // structurée et le nom naissent ENSEMBLE — plus de divergence possible.
  const handleAddCurve = useCallback((name: string, color: string, windDirection?: WindDirection, familyValue?: number): string => {
    if (!selectedGraphId) return '';

    const newCurve: Curve = {
      id: uuidv4(),
      name,
      color,
      points: [],
      windDirection,
      ...(typeof familyValue === 'number' && isFinite(familyValue) ? { familyValue } : {})
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

  // ─── R7 : façonnage Bézier sur le canevas (moteur P2b recyclé du Chart) ───
  // Segments recalculés en continu : points de la courbe (qui restent
  // déplaçables pendant la session) + overrides des poignées tirées.
  // « Appliquer » échantillonne en points ordinaires → le pipeline
  // (interpolation, cascade, sauvegarde) reste strictement inchangé.
  const bezierSegments = React.useMemo<BezierSegment[] | null>(() => {
    if (!bezierSession || !selectedGraphId) return null;
    const g = graphs.find(x => x.id === selectedGraphId);
    const curve = g?.curves.find(c => c.id === bezierSession.curveId);
    if (!curve || curve.points.length < 2) return null;
    return applyBezierOverrides(fitBezierThroughPoints(curve.points), bezierSession.overrides);
  }, [bezierSession, selectedGraphId, graphs]);

  const startBezierSession = useCallback(() => {
    if (selectedCurveId) setBezierSession({ curveId: selectedCurveId, overrides: {} });
  }, [selectedCurveId]);

  const cancelBezierSession = useCallback(() => setBezierSession(null), []);

  const applyBezierSession = useCallback(() => {
    if (!bezierSession || !bezierSegments || bezierSegments.length === 0) return;
    // 6 échantillons par segment — même fidélité que l'ancien flux Chart.
    const sampled = sampleBezierSegments(bezierSegments, 6).map(p => ({ ...p, id: uuidv4() }));
    if (sampled.length >= 2) {
      handleUpdateCurve(bezierSession.curveId, { points: sampled, fitted: undefined });
    }
    setBezierSession(null);
  }, [bezierSession, bezierSegments, handleUpdateCurve]);

  const handleBezierHandleDrag = useCallback((segIdx: number, which: 'cp1' | 'cp2', x: number, y: number) => {
    setBezierSession(prev => prev
      ? { ...prev, overrides: { ...prev.overrides, [segIdx]: { ...(prev.overrides[segIdx] || {}), [which]: { x, y } } } }
      : prev);
  }, []);

  // Lot 1-E — clôture PROPRE de la session (Échap sur le bandeau de mode,
  // entrée en cadrage d'image) : le façonnage réellement effectué est APPLIQUÉ
  // (même geste que « ✓ Appliquer le tracé ») ; une session où aucune poignée
  // n'a été tirée se referme sans toucher aux points de la courbe.
  const finishBezierSession = useCallback(() => {
    if (!bezierSession) return;
    if (Object.keys(bezierSession.overrides).length > 0) applyBezierSession();
    else cancelBezierSession();
  }, [bezierSession, applyBezierSession, cancelBezierSession]);

  // Changer de courbe, de cadre (focus) ou d'étape ABANDONNE la session.
  React.useEffect(() => { setBezierSession(null); }, [selectedCurveId, selectedGraphId, currentStep]);


  const handlePointClick = useCallback((x: number, y: number) => {
    if (!selectedCurveId || !selectedGraphId) return;

    const point: XYPoint = { x, y, id: uuidv4() };

    setGraphs(prev => prev.map(g =>
      g.id === selectedGraphId
        ? {
            ...g,
            curves: g.curves.map(c =>
              c.id === selectedCurveId
                // R14 — toute retouche de points INVALIDE l'interpolation :
                // sinon le trait affiché (fitted, prioritaire au rendu) reste
                // figé sur l'ancienne courbe pendant que le point bouge.
                // La validation ré-interpole tout (onFinish → fitAll).
                ? { ...c, points: [...c.points, point].sort((a, b) => a.x - b.x), fitted: undefined }
                : c
            )
          }
        : g
    ));
  }, [selectedCurveId, selectedGraphId]);

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
                    ).sort((a, b) => a.x - b.x),
                    // R14 — le trait suit le point : interpolation invalidée
                    fitted: undefined
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
                // R14 — suppression de point : interpolation invalidée aussi
                ? { ...c, points: c.points.filter(p => p.id !== pointId), fitted: undefined }
                : c
            )
          }
        : g
    ));
  }, [selectedGraphId]);



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
              method: INTERPOLATION_METHOD,
              numPoints: INTERPOLATION_POINTS
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

    setWarnings(newWarnings);
  }, [graphs]);

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


  const handleExportJSON = useCallback(() => {
    // ─── Lot 1-G : FIN DU POPUP « problème(s) bloquant(s) » ───
    // Le verrou operationId/primaire vit désormais dans la checklist
    // (computeSetReadiness → canSave) : le bouton « Valider et enregistrer »
    // est DÉSACTIVÉ tant qu'un item bloquant subsiste, avec la raison
    // affichée — le window.confirm ne peut plus se produire. Garde de
    // défense (le KitButton neutralise déjà le clic désactivé) :
    if (!setReadiness.canSave) return;

    // ─── R13 : BANC DE TEST — rejouer les cas de référence avant d'enregistrer.
    // Un cas en échec n'est pas bloquant dur (le pilote juge), mais il doit
    // être IMPOSSIBLE d'enregistrer sans le voir.
    if (referenceCases.length > 0) {
      const results = runAllReferenceCases(graphs, referenceCases);
      const failures = results
        .map((r, i) => ({ r, rc: referenceCases[i] }))
        .filter(({ r }) => r.status !== 'pass');
      if (failures.length > 0) {
        const lines = failures.map(({ r, rc }) =>
          `• ${rc.label || `Cas ${rc.expected}`} : ` +
          (r.status === 'fail'
            ? `calculé ${r.computed!.toFixed(0)} pour ${rc.expected} attendu (écart ${r.deviationPct!.toFixed(1)} % > ±${rc.tolerancePct ?? 5} %)`
            : `erreur — ${r.message}`));
        const proceed = window.confirm(
          `🧪 Banc de test : ${failures.length} cas de référence en échec :\n\n` +
          lines.join('\n') +
          `\n\nEnregistrer quand même ?`
        );
        if (!proceed) return;
      }
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

    // Préparer les données au nouveau format multi-graphiques.
    // R20 — on N'EXPORTE PLUS `fitted.points` (donnée dérivée régénérée à la
    // lecture) : c'était la cause du gonflement de aircraft_data (9 Mo /
    // statement_timeout Postgres à l'écriture). Équivalence régen prouvée.
    const json: AbacCurvesJSON = {
      version: '2.0',
      graphs: stripFittedGraphs(exportedGraphs),
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
        ...(workshopActive ? { workshop } : {}),
        // Lot 1-C — type de planche (écran « Opération ») : mémorisé pour la
        // ré-édition. Absent tant qu'il n'a été ni choisi ni inféré.
        ...(plancheType ? { plancheType } : {}),
        // R13 — banc de test persisté avec le modèle.
        ...(referenceCases.length > 0 ? { referenceCases } : {})
      }
    };

    // Sauvegarder sans télécharger le fichier JSON
    if (onSave) {
      onSave(json, aircraftModel || modelNameInput);
    }

    // ─── Fin de session d'atelier ── l'enregistrement final clôt la session :
    // on la retire du wizard avion ET on cesse de persister (sessionClosedRef),
    // sinon le prochain « Nouvel abaque » restaurerait le set qu'on vient
    // d'enregistrer → doublon garanti au save suivant. Les annulations en
    // amont (confirm refusés → return) laissent la session vivante, comme il
    // se doit.
    if (sessionRef?.current) {
      sessionRef.current = { ...sessionRef.current, atelier: null };
    }
    sessionClosedRef.current = true;
    // Survie F5 : l'enregistrement réussi efface AUSSI l'instantané IndexedDB
    // — sinon le prochain montage « session vide » restaurerait le set qu'on
    // vient d'enregistrer (même doublon que pour la session). Le garde
    // sessionClosedRef (revérifié dans le timer du dépôt débouncé) empêche un
    // dépôt en attente de le ressusciter.
    void deleteAtelierDraft();
  }, [onSave, graphs, modelNameInput, aircraftModel, systemType, plancheType, workshop, workshopActive, referenceCases, sessionRef, setReadiness.canSave]);


  // ─── Lot 1-G : étapes du rail de checklist ────────────────────────────────
  // Clic sur un cadre replié (ou un item de cadre depuis la Validation) :
  // focus du cadre — et retour au Tracé si on était sur la Validation.
  const focusFrameGraph = useCallback((graphId: string) => {
    const gi = graphs.findIndex(g => g.id === graphId);
    if (gi >= 0) setSubStepGraphIndex(gi);
    setCurrentStep(prev => (prev === 'final' ? 'points' : prev));
  }, [graphs]);

  // (Retour pilote 20/08 : le rail latéral et ses groupes par cadre ont été
  // retirés — les badges « x/y ✓ » des panneaux de cadre suffisent au Tracé,
  // et la check-list du SET vit en tête de l'écran Validation.)

  // Bouton « Valider et enregistrer » : disabled/raison dérivés de canSave +
  // items bloquants (fin du window.confirm « problème(s) bloquant(s) »).
  const blockingItems = setReadiness.items.filter(
    it => it.state === 'blocked' && it.id !== READINESS_BENCH_ITEM_ID
  );
  const modelNameMissing = !(modelNameInput || '').trim();
  const saveDisabled = !setReadiness.canSave || modelNameMissing;
  const saveDisabledReason = !setReadiness.canSave
    ? `À corriger avant l'enregistrement (voir la checklist) : ${blockingItems.map(it => it.label).join(' · ')}`
    : modelNameMissing
      ? 'Saisis le nom du modèle (champ « Nom du modèle » ci-dessus).'
      : undefined;

const renderStepContent = () => {
    switch (currentStep) {
      // (case morte « axes » supprimée — R0 : retirée de la séquence depuis SPRINT B,
      //  la config des axes vit dans le wizard. AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md.)

      case 'setup': {
        // ─── Lot 1-C : écran « OPÉRATION » — LA question structurante, posée
        // UNE fois : opération canonique + type de planche + nombre de
        // panneaux. Rôles, readoutAxis, familles et chaîne sont DÉDUITS
        // (parcours idéal de l'audit-7 : 9 pièges → 0). En retour via
        // « Modifier » (graphes existants), le bouton devient « Appliquer ».
        const chainIds = workshop.frames.length > 0
          ? [...workshop.frames].sort((a, b) => a.xLeftPx - b.xLeftPx).map(f => f.graphId)
          : graphs.map(g => g.id);
        const applyMode = graphs.length > 0;
        const setupInitialOperationId = isValidOperationId(systemType)
          ? systemType
          : (graphs.find(g => (g.role || 'primary') === 'primary')?.operationId || '');

        const handleSetupSubmit = (choice: { operationId: string; plancheType: PlancheType; panelCount: number }) => {
          const op = getOperation(choice.operationId);
          if (!op) return; // garde du bouton — double sécurité

          if (!applyMode) {
            // CRÉATION : N graphes entièrement déduits + N cadres pré-répartis
            // régulièrement sur le canevas (successeur de l'ex-addGraphToWorkshop).
            const { graphs: newGraphs, frames } = buildSetupGraphs(choice, () => uuidv4());
            setGraphs(newGraphs);
            setWorkshop(prev => ({ ...prev, frames }));
            setSelectedGraphId(newGraphs[0]?.id ?? null);
          } else {
            // APPLIQUER : mise à jour operationId/readoutAxis/rôles SANS
            // recréer les cadres si le nombre n'a pas changé ; sinon
            // confirmation avant d'ajouter (à droite) / retirer (fin de
            // chaîne) des panneaux.
            let targetIds = [...chainIds];
            let nextGraphs = graphs;
            let nextFrames = workshop.frames;
            const delta = choice.panelCount - chainIds.length;
            if (delta > 0) {
              if (!window.confirm(`Ajouter ${delta} panneau(x) en fin de chaîne (à droite) ?`)) return;
              const added = appendPanels(nextFrames, delta, graphs.length, () => uuidv4());
              targetIds = [...targetIds, ...added.graphs.map(g => g.id)];
              nextGraphs = [...nextGraphs, ...added.graphs];
              nextFrames = [...nextFrames, ...added.frames];
            } else if (delta < 0) {
              const doomed = targetIds.slice(delta); // les -delta derniers de la chaîne
              const doomedCurves = graphs
                .filter(g => doomed.includes(g.id))
                .reduce((n, g) => n + g.curves.length, 0);
              if (!window.confirm(
                `Retirer ${-delta} panneau(x) en fin de chaîne ?` +
                (doomedCurves > 0 ? ` ${doomedCurves} courbe(s) seront supprimées.` : '') +
                ' Cette action est irréversible.'
              )) return;
              targetIds = targetIds.slice(0, choice.panelCount);
              const removed = new Set(doomed);
              nextGraphs = nextGraphs.filter(g => !removed.has(g.id));
              nextFrames = nextFrames.filter(f => !removed.has(f.graphId));
            }
            nextGraphs = applySetupRoles(nextGraphs, targetIds, choice);
            setGraphs(nextGraphs);
            setWorkshop(prev => ({ ...prev, frames: nextFrames }));
            setSelectedGraphId(targetIds[0] ?? null);
          }

          // Identité du set — même geste que updateCurrentGraph sur le primaire.
          setSystemType(choice.operationId);
          setModelNameInput(op.labelFr);
          setPlancheType(choice.plancheType);
          setSelectedCurveId(null);
          setSubStepGraphIndex(0);
          setCurrentStep('points');
        };

        return (
          <div className={styles.stepContent}>
            <h2>Opération</h2>
            <OperationSetupPanel
              initialOperationId={setupInitialOperationId}
              initialPlancheType={plancheType}
              initialPanelCount={applyMode ? chainIds.length : null}
              applyMode={applyMode}
              onSubmit={handleSetupSubmit}
              onCancel={applyMode ? () => setCurrentStep('points') : onBack}
            />
          </div>
        );
      }

      case 'points': {
        // ─── REFONTE SPRINT B : mini-wizard par graphique ───
        // ─── + ATELIER P2a (AUDIT_ABAC_CONSTRUCTION.md) : TOUS les graphes du set
        //     restent visibles côte à côte (bandeau d'aperçus LIVE) ; cliquer une
        //     carte met le graphe au focus — fini la navigation aveugle ◀ ▶.
        // L'ancien code de cette étape reste plus bas dans le fichier (inatteignable)
        // jusqu'à un cleanup ultérieur — backup dans backups/sprint-B-*.
        const currentGraphForWizard = graphs[Math.min(subStepGraphIndex, Math.max(0, graphs.length - 1))];

        // (Lot 1-C : l'ex-closure orpheline addGraphToWorkshop a trouvé son
        //  consommateur — sa logique vit désormais dans core/plancheSetup.ts
        //  (buildSetupGraphs/appendPanels), pilotée par l'écran « Opération ».)

        // R6 — mise à jour du graphe FOCALISÉ (cadre actif). Hissé du wizard
        // car le panneau d'identité vit désormais sous le canevas. Auto-sync :
        // le systemType du set = operationId du graphique primaire courant.
        const updateCurrentGraph = (partial: Partial<GraphConfig>) => {
          setGraphs(prev => prev.map(g => g.id === currentGraphForWizard.id ? { ...g, ...partial } : g));
          const isPrimary = (currentGraphForWizard.role || 'primary') === 'primary';
          if (isPrimary && partial.operationId !== undefined) {
            setSystemType(partial.operationId);
            const op = getOperation(partial.operationId);
            if (op) setModelNameInput(op.labelFr);
          }
        };

        // R6 — suppression du graphe focalisé ET de son cadre : le ✕ d'un cadre
        // ne fait que dé-cadrer, et la barre de pagination du wizard (qui
        // portait l'ancien bouton supprimer) n'existe plus en atelier.
        const removeCurrentGraphAndFrame = () => {
          if (!window.confirm(`Supprimer le graphique ${subStepGraphIndex + 1} (courbes comprises) et son cadre ? Cette action est irréversible.`)) return;
          const idToRemove = currentGraphForWizard.id;
          setWorkshop(prev => ({ ...prev, frames: prev.frames.filter(f => f.graphId !== idToRemove) }));
          setGraphs(prev => prev.filter(g => g.id !== idToRemove));
          setSubStepGraphIndex(i => Math.max(0, i - 1));
          setSelectedCurveId(null);
        };

        if (!currentGraphForWizard) {
          // Lot 1-C : plus d'auto-création sur set vide — l'issue naturelle
          // d'un Tracé sans graphe (ex. tout supprimé) est l'écran Opération.
          return (
            <div className={styles.stepContent}>
              <h2>Tracé</h2>
              <p style={{ padding: 16, color: 'var(--color-red-critical)' }}>
                ⚠ Aucun graphique configuré.
              </p>
              <KitButton level="secondary" icon="←" onClick={() => setCurrentStep('setup')}>
                Revenir à l'écran Opération
              </KitButton>
            </div>
          );
        }
        return (
          <div className={styles.stepContent}>
            <h2>Tracé</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>

            {/* L'identité du set est DÉDUITE du graphique primaire (cf. handleExportJSON).
                Lot 1-C — rappel compact des choix de l'écran « Opération »
                (opération + type de planche) + bouton tertiaire « Modifier »
                qui y retourne EN CONSERVANT graphes et cadres (le bouton de
                l'écran devient alors « Appliquer »). */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              padding: '6px 10px',
              backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-regular)', borderRadius: 4,
              fontSize: 12, color: 'var(--accent-primary)'
            }}>
              <span>
                Avion : <strong>{aircraftModel || aircraftModelDisplay || '(non spécifié)'}</strong>
              </span>
              {systemType && (
                <span>
                  · Opération : <strong>{getOperation(systemType)?.labelFr || systemType}</strong>
                </span>
              )}
              {plancheType && (
                <span>
                  · Planche : <strong>{plancheType === 'descendante'
                    ? '↓ Lecture descendante (lue en bas)'
                    : '↕ Standard (lue sur l\'axe vertical)'}</strong>
                </span>
              )}
              <span style={{ marginLeft: 'auto' }}>
                <KitButton
                  level="tertiary"
                  size="compact"
                  onClick={() => setCurrentStep('setup')}
                  title="Revenir à l'écran Opération — graphes et cadres conservés (le bouton devient « Appliquer »)"
                >
                  Modifier
                </KitButton>
              </span>
            </div>

            {/* ─── Lot 1-G : IDENTITÉ DU CADRE FOCUS — KitPanel TOUJOURS VISIBLE
                (fin du <details> replié « Identité du graphique N » : les
                réglages qui conditionnent d'autres panneaux ne se cachent
                plus). Nom, famille, lecture du résultat, rappel d'opération,
                badge x/y ✓ ; radios de rôle en « Réglages avancés » pour les
                seuls modèles legacy hors convention. */}
            {workshop.frames.length > 0 && (() => {
              const g = currentGraphForWizard;
              const chainIds = orderedFrames.map(f => f.graphId);
              const chainIdx = chainIds.indexOf(g.id);
              const expectedRole = chainIdx === 0 ? 'primary' : 'intermediate';
              const rolesOffConvention = chainIdx === -1 || (g.role || 'primary') !== expectedRole;
              return (
                <GraphIdentityPanel
                  key={`identity-${g.id}`}
                  graph={g}
                  onUpdateGraph={updateCurrentGraph}
                  frameNumber={chainIdx >= 0 ? chainIdx + 1 : subStepGraphIndex + 1}
                  isFirst={chainIdx === 0}
                  readiness={graphReadinessById.get(g.id) || []}
                  showAdvancedRoles={rolesOffConvention}
                  onRemoveGraph={removeCurrentGraphAndFrame}
                />
              );
            })()}

            {/* ─── R2a — CANEVAS DE L'ATELIER « IMAGE UNIQUE » ───
                Remplace le bandeau de cartes (P2a) : UNE image MANEX pour tout le
                set, des CADRES tirés dessus (un par graphe), focus au clic,
                chaîne G1→G2→G3 auto-synchronisée par l'ordre des cadres (effet
                dédié plus haut). Les vignettes Chart disparaissent : l'image et
                les cadres SONT la vue d'ensemble (R3 y ramènera les courbes). */}
            <WorkshopCanvas
              workshop={workshop}
              graphs={graphs}
              selectedGraphId={currentGraphForWizard.id}
              onWorkshopChange={setWorkshop}
              onFocusGraph={(graphId) => {
                const gi = graphs.findIndex(g => g.id === graphId);
                if (gi >= 0) setSubStepGraphIndex(gi);
              }}
              onRequestGraphForFrame={() => {
                // 1er graphe encore sans cadre, sinon création d'un nouveau graphe
                const framed = new Set(workshop.frames.map(f => f.graphId));
                const unframed = graphs.find(g => !framed.has(g.id));
                if (unframed) return unframed.id;
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
                setSubStepGraphIndex(graphs.length);
                return newGraph.id;
              }}
              onUpdateGraphXAxis={(graphId, xAxis) => {
                // R2b — l'axe X reste porté par le GRAPHE (pas de nouveau lieu
                // de vérité) : le panneau Axes du canevas écrit ici.
                // R8 — auto-détection « graphique vent » quand la variable
                // canonique choisie est de la famille vent (comme l'ancienne
                // sous-étape Axes ; jamais désactivé auto pour ne pas perdre
                // les windDirection déjà saisies sur les courbes).
                setGraphs(prev => prev.map(g => g.id === graphId
                  ? {
                      ...g,
                      ...(isWindAxisVariable(xAxis.title) && !g.isWindRelated ? { isWindRelated: true } : {}),
                      axes: {
                        ...(g.axes || { xAxis: { min: 0, max: 100, unit: '', title: '' }, yAxis: { min: 0, max: 100, unit: '', title: '' } }),
                        xAxis
                      }
                    }
                  : g));
              }}
              selectedCurveId={selectedCurveId}
              tracingMode={wizardEditorMode === 'placing-points'}
              onPointClick={handlePointClick}
              onPointDrag={handlePointDrag}
              onPointDelete={handlePointDelete}
              bezierSegments={bezierSegments}
              onBezierHandleDrag={handleBezierHandleDrag}
              onFinishBezier={finishBezierSession}
              onCreateCurve={(name, color, familyValue, windDirection) => {
                // Capsule du canevas — MÊME flux que « Nouvelle courbe » du
                // wizard : handleAddCurve sélectionne déjà la courbe créée.
                // R17 : la valeur de famille choisie dans la liste déroulante
                // arrive ici et naît AVEC la courbe (nom = valeur + unité).
                // Le SENS DU VENT choisi dans la capsule naît aussi avec la
                // courbe (il restait perdu : tag à re-saisir dans le
                // gestionnaire — indispensable en lecture descendante).
                // Une session Bézier en cours est abandonnée (elle façonnait
                // l'ancienne courbe, ses poignées n'ont plus de cible).
                if (bezierSession) cancelBezierSession();
                const id = handleAddCurve(name, color, windDirection, familyValue);
                if (!id) return;
                setWizardModeCommand(c => ({ mode: 'placing-points', nonce: (c?.nonce || 0) + 1 }));
              }}
              onFinishCurve={() => {
                setSelectedCurveId(null);
                setWizardModeCommand(c => ({ mode: 'idle', nonce: (c?.nonce || 0) + 1 }));
              }}
            />


            {/* (Retour pilote 20/08 : le CALCULATEUR de test n'a pas sa place
                sur l'écran Tracé — les tests se font après l'interpolation. Il
                vit désormais uniquement sur l'écran Validation, avec le MÊME
                formulaire persistant (testDraft). Le banc replié reste ici en
                sentinelle : son badge alerte si une retouche casse un cas.) */}

            {/* (Retour pilote 20/08 : le BANC quitte aussi l'écran Tracé —
                « faire un banc de test alors que les données ne sont pas
                rentrées, ça ne sert à rien ». Il ne vit qu'à l'écran
                Validation, après l'interpolation, avec le testeur.) */}

            {/* R6 — wizard RÉDUIT : uniquement l'outillage courbes (création,
                Chart pour le Bézier, table de points repliable) + le bouton
                Interpoler & Valider. Il n'apparaît qu'une fois au moins UN
                cadre posé — avant ça, le canevas guide (image puis cadres).
                Les anciens modèles sans atelier passent par le bandeau compat
                « Créer un cadre par graphe » (D4, non destructif). */}
            {workshop.frames.length > 0 && (
            <AbacGraphWizard
              numberedGuides={usesNumberedGuides(
                currentGraphForWizard,
                isFirstFramedGraph(workshop, currentGraphForWizard?.id)
              )}
              bezierActive={!!bezierSession}
              onStartBezier={startBezierSession}
              onApplyBezier={applyBezierSession}
              onCancelBezier={cancelBezierSession}
              onEditorModeChange={setWizardEditorMode}
              editorModeCommand={wizardModeCommand}
              graph={currentGraphForWizard}
              totalGraphs={graphs.length}
              selectedCurveId={selectedCurveId}
              onSelectCurve={setSelectedCurveId}
              onRemoveCurve={handleRemoveCurve}
              onUpdateCurve={handleUpdateCurve}
              onReorderCurves={handleReorderCurves}
              onPointClick={handlePointClick}
              onPointDrag={handlePointDrag}
              onPointDelete={handlePointDelete}
              onFinish={() => {
                handleFitAll({ method: INTERPOLATION_METHOD, numPoints: INTERPOLATION_POINTS });
                setCurrentStep('final');
              }}
            />
            )}

            </div>
          </div>
        );
      }

      // (cases mortes « points_legacy_unused », « fit », « fit_old » supprimées — R0,
      //  AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md : jamais atteignables depuis SPRINT B.)

      case 'final':
        return (
          <div className={styles.stepContent}>
            <h2>Validation</h2>
            <div className={styles.finalView}>
              {/* (Retour pilote 20/08 : plus de check-list affichée — « ça ne sert
                  à rien ». Son calcul (modelReadiness) ne sert plus qu'à une
                  chose : la raison affichée sur le bouton « Valider » quand il
                  refuse.) */}
              {/* Lot 1-G — Configuration du système en KitPanel + champ « Nom du
                  modèle » MARQUÉ quand vide (l'item de checklist du même nom
                  cible ce champ ; le bouton d'enregistrement dit la raison). */}
              <KitPanel title="Configuration du système">
                <div style={{ fontSize: 'var(--fs-body)', lineHeight: '1.6' }}>
                  {/* Lot 0 — systemType est un operationId depuis SPRINT B+ : lecture via le
                      catalogue canonique, repli SYSTEM_TYPES pour les vieux modèles. */}
                  <div><strong>Type de système :</strong> {getOperation(systemType)?.labelFr || SYSTEM_TYPES.find(t => t.value === systemType)?.label}</div>
                  <div><strong>Modèle d'avion :</strong> {aircraftModel || modelNameInput || 'Non spécifié'}</div>
                  <div><strong>Identifiant système :</strong> <code>{systemType}</code></div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap',
                    marginTop: SPACING.sm
                  }}>
                    <label htmlFor="abac-model-name" style={{ fontWeight: 600 }}>Nom du modèle</label>
                    <input
                      id="abac-model-name"
                      ref={modelNameFieldRef}
                      type="text"
                      value={modelNameInput}
                      onChange={(e) => setModelNameInput(e.target.value)}
                      placeholder="ex. Distance de décollage (50 ft)"
                      style={{
                        flex: 1, minWidth: 220, padding: '5px 10px', fontSize: 'var(--fs-body)',
                        borderRadius: 4, backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
                        border: `1px solid ${(modelNameInput || '').trim() ? 'var(--border-regular)' : 'var(--status-error)'}`
                      }}
                    />
                    {!(modelNameInput || '').trim() && (
                      <KitBadge tone="crit">requis pour enregistrer</KitBadge>
                    )}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                    Cet identifiant sera utilisé pour référencer ce système dans l'application
                  </div>
                </div>
              </KitPanel>



              {/* Affichage des graphiques en colonne */}
              {/* R10 — aperçus des graphes REPLIÉS par défaut (demande pilote :
                  l'écran de validation se concentre sur le test de cascade) ;
                  dépliés, ils se posent côte à côte pour suivre la chaîne. */}
              <KitPanel
                collapsible
                title="Graphiques du set — courbes interpolées"
                badge={<KitBadge tone="neutral">{graphs.length} graphique{graphs.length > 1 ? 's' : ''}</KitBadge>}
              >
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                {graphs.map(graph => {
                  const displayCurves = graph.curves;

                  return (
                    <div key={graph.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px', overflow: 'hidden', flex: '0 0 auto', maxWidth: 340 }}>
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
                            💨 Tous
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
                          Aucune courbe vent arrière dans ce graphique
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </KitPanel>

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

              {/* ─── R13 : BANC DE TEST PERMANENT — les cas de référence du
                  manuel sont rejoués sur les graphes EN L'ÉTAT à chaque venue
                  sur cet écran (PASS/FAIL ± tolérance). Un banc en échec reste
                  un AVERTISSEMENT au save (confirm conservé — le pilote juge). */}
              <KitPanel
                title="Banc de test — cas de référence du manuel"
                badge={
                  <KitBadge tone={benchResults.length === 0 ? 'neutral' : benchPass === benchResults.length ? 'ok' : 'crit'}>
                    Banc : {benchPass}/{benchResults.length} OK
                  </KitBadge>
                }
              >
                <ReferenceCasesPanel
                  graphs={graphs}
                  cases={referenceCases}
                  onChange={setReferenceCases}
                />
              </KitPanel>

              {/* Lot 1-G — navigation au kit : UNE action primaire par écran
                  (« Valider et enregistrer »), disabled/raison dérivés de
                  canSave + items bloquants de la checklist (fin du popup
                  « problème(s) bloquant(s) »). */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
                <KitButton
                  level="secondary"
                  icon="←"
                  onClick={() => setCurrentStep('points')}
                  title="Retourner à l'écran Tracé"
                >
                  Précédent
                </KitButton>
                <KitButton
                  level="primary"
                  icon="✓"
                  disabled={saveDisabled}
                  disabledReason={saveDisabledReason}
                  onClick={handleExportJSON}
                  title="Valider + enregistrer le modèle d'abaque en un geste"
                >
                  Valider et enregistrer le modèle
                </KitButton>
              </div>
            </div>
          </div>
        );
    }
  };

  // ─── Survie F5 : abandon du tracé restauré ────────────────────────────────
  // Efface l'instantané IndexedDB puis remet l'atelier à l'état d'un montage
  // vierge : valeurs par défaut (mêmes que les initialiseurs sans session),
  // puis re-hydratation depuis initialData si un modèle était en édition.
  // Lot 1-C : une création pure repart de l'écran « Opération » (setup) —
  // plus d'auto-création de « Graphique 1 » ; hydrateFromInitialData ramène
  // sur 'points' un modèle en édition. Le dépôt débouncé re-déposera ensuite
  // cet état propre.
  const handleDiscardRestoredDraft = () => {
    void deleteAtelierDraft();
    setRestoredBanner(false);
    setWorkshop({ image: null, sharedY: { min: 0, max: 100, unit: '', title: '' }, frames: [] });
    setBezierSession(null);
    setReferenceCases([]);
    setCurrentStep('setup');
    setGraphs([]);
    setSelectedGraphId(null);
    setSelectedCurveId(null);
    setModelNameInput(modelName || SYSTEM_TYPES.find(t => t.value === 'takeoff_distance')?.label || '');
    setAircraftModelDisplay(aircraftModel || '');
    setSystemType('');
    setPlancheType(null);
    setSubStepGraphIndex(0);
    hydrateFromInitialData();
  };

  return (
    <div className={styles.abacBuilder}>
      <div className={styles.builderContent}>
        {restoring ? (
          // IndexedDB est asynchrone : bref état d'attente avant l'hydratation
          // (évite un flash de l'atelier vide puis un saut vers le tracé).
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            ⤴ Restauration du tracé…
          </div>
        ) : (
          <>
            {restoredBanner && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                margin: '0 0 10px', padding: '6px 12px',
                backgroundColor: 'var(--bg-overlay)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)'
              }}>
                <span>⤴ Tracé restauré après rechargement de la page</span>
                <button
                  onClick={handleDiscardRestoredDraft}
                  title="Efface le tracé restauré et repart d'un atelier vierge"
                  style={{
                    padding: '3px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                    backgroundColor: 'transparent', color: 'var(--color-red-critical)',
                    border: '1px solid var(--color-red-critical)', borderRadius: 4
                  }}
                >
                  Abandonner ce tracé
                </button>
              </div>
            )}
            {/* (Retour pilote 20/08 : le rail latéral de checklist nuisait à
                la lisibilité du Tracé — retiré. La check-list du modèle vit
                désormais en tête de l'écran VALIDATION, pleine largeur, là où
                elle sert : le récapitulatif avant enregistrement. Le bouton
                « Valider » garde sa raison de refus via canSave.) */}
            {renderStepContent()}
          </>
        )}
      </div>
    </div>
  );
}

// Wrap with forwardRef and export
export const AbacBuilder = React.forwardRef<AbacBuilderRef, AbacBuilderProps>(AbacBuilderComponent);

// Définir le displayName pour le composant avec forwardRef
AbacBuilder.displayName = 'AbacBuilder';