export interface XYPoint {
  x: number;
  y: number;
  id?: string;
}

export interface AxesConfig {
  xAxis: {
    min: number;
    max: number;
    unit: string;
    title: string;
    /** Pas entre 2 graduations principales. Si défini, les ticks sont générés à
     *  min, min+step, min+2*step, …, max. Sinon ticks D3 auto. */
    step?: number;
    reversed?: boolean; // true pour ordre décroissant
  };
  yAxis: {
    min: number;
    max: number;
    unit: string;
    title: string;
    step?: number;
    reversed?: boolean; // true pour ordre décroissant
  };
}

export type WindDirection = 'headwind' | 'tailwind' | 'none';

export interface Curve {
  id: string;
  name: string;
  color: string;
  points: XYPoint[];
  windDirection?: WindDirection; // Direction du vent pour cette courbe
  /**
   * 🔒 Valeur de la courbe sur le paramètre familial du graphe.
   * Ex: si `graph.familyAxisVariable === 'pressure_altitude'`, ce champ vaut
   * 0 / 2000 / 4000… pour chaque courbe parametrée par altitude.
   * Saisi manuellement → ne dépend pas du parsing du nom de courbe.
   */
  familyValue?: number;
  /**
   * 🔒 OVERRIDE OPTIONNEL — Valeur Y de la courbe au bord gauche pour le mode
   * `slope-follow`. Si laissé indéfini, la valeur est dérivée automatiquement
   * du Y du PREMIER POINT de la courbe (trié par X croissant).
   *
   * Pourquoi un override ?
   *   - Cas standard : on laisse vide et l'algorithme utilise points[0].y
   *     trié par X croissant — c'est suffisant dans la grande majorité des
   *     cas et la valeur se met à jour automatiquement quand on déplace le
   *     premier point dans le wizard.
   *   - Cas exceptionnel : on souhaite forcer une valeur d'entrée différente
   *     (par exemple si on a tracé la courbe sans atteindre le bord gauche
   *     du graphique mais qu'on veut la considérer comme se prolongeant à
   *     une valeur spécifique). Saisir alors la valeur manuellement.
   */
  entryY?: number;
  fitted?: {
    points: XYPoint[];
    rmse: number;
    method: InterpolationMethod;
  };
}

export type InterpolationMethod = 'pchip' | 'akima' | 'naturalSpline' | 'catmullRom';

export interface FitOptions {
  method?: InterpolationMethod;
  monotonic?: boolean;
  smoothing?: number;
  numPoints?: number;
}

export interface FitResult {
  curveId: string;
  originalPoints: XYPoint[];
  fittedPoints: XYPoint[];
  rmse: number;
  warnings: string[];
  method: InterpolationMethod;
}

export interface GraphConfig {
  id: string;
  name: string;
  /** ⚠ Champ legacy — étiquette UI uniquement, NON consommé par les calculs.
   *  Conservé pour rétro-compatibilité avec les abaques existants.
   *  Pour les nouvelles créations, utiliser `operationId` (catalogue canonique).
   */
  graphType?: string;
  /**
   * 🔒 Rôle de ce graphique dans le set d'abaques :
   *   - 'primary'      : graphique qui produit la valeur finale du set (doit porter un operationId)
   *   - 'intermediate' : étape de correction (température, masse, vent...) — pas d'operationId requis
   * Si non défini : traité comme 'primary' (rétro-compatibilité).
   */
  role?: 'primary' | 'intermediate';
  /**
   * Position du graphique dans la cascade de calcul du set.
   *   - Intermédiaires : 1, 2, 3, 4… selon l'ordre dans la chaîne
   *     (Tableau 1 produit la valeur qui sert d'entrée à Tableau 2, etc.)
   *   - Primaire : implicitement le dernier (max + 1) ; pas besoin de saisir.
   * Utilisé en Phase 4 pour évaluer le set en cascade.
   */
  cascadeOrder?: number;
  /**
   * 🔒 Identifiant canonique de l'opération de performance que cet abaque
   * fournit. Doit appartenir au catalogue `core/operationCatalog.ts`.
   * Requis UNIQUEMENT pour les graphiques `role: 'primary'`.
   * Clé persistée, utilisée par le moteur de calcul pour matcher cet abaque
   * lors de la génération de l'état de performance d'un vol.
   */
  operationId?: string;
  /**
   * Nature de sortie effectivement fournie par cet abaque, parmi celles
   * acceptées par `operationId` (cf. `OperationDefinition.acceptedOutputs`).
   * Exemple : pour `climb_takeoff`, peut valoir 'rate_of_climb' ou 'climb_gradient'.
   */
  outputKind?: string;
  /** Unité effective de la sortie (ex. 'ft/min', 'm', '°'). */
  outputUnit?: string;
  axes: AxesConfig;
  /**
   * 🔒 Variable canonique qui distingue les courbes du graphe (paramètre familial).
   * Ex: `pressure_altitude` si les courbes sont nommées « 0 ft », « 2000 ft »...
   * Si défini, chaque courbe doit fournir `Curve.familyValue`.
   * Utilisé par le résolveur pour le bracket 2D (lecture pilote).
   */
  familyAxisVariable?: string;
  /**
   * 🔒 Mode d'interpolation à appliquer sur ce graphe :
   *   - 'family'        : bracket entre 2 courbes par leur valeur familiale (graphe 1
   *                       d'une cascade typique avec courbes "0 ft / 2000 ft / 4000 ft").
   *                       Requiert `familyAxisVariable` + `Curve.familyValue` sur chaque courbe.
   *   - 'slope-follow'  : suivi de pente (graphe 2-3 d'une cascade avec courbes guides
   *                       sans valeur). Entre par Y_in (output précédent) au bord gauche
   *                       (X = X_min), trace parallèle aux 2 courbes encadrant Y_in,
   *                       lit Y_out à X = X_cible (input courant).
   *   - 'mono'          : graphe à 1 seule courbe → interpolation 1D directe sur X.
   *   - (undefined)     : auto-détection (mono si 1 courbe, family si familyValue présent, sinon fallback).
   */
  interpolationMode?: 'family' | 'slope-follow' | 'mono';
  curves: Curve[];
  isWindRelated?: boolean; // Indique si ce graphique concerne le vent
  linkedFrom?: string[]; // IDs des graphiques sources
  linkedTo?: string[]; // IDs des graphiques cibles
}

export interface AbacSystemConfig {
  graphs: GraphConfig[];
  relationships?: {
    from: string; // ID du graphique source
    to: string; // ID du graphique cible
    mapping?: string; // Comment mapper les valeurs (ex: "y_to_x")
  }[];
}

// ─── R1 (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md) — Atelier « image unique » ─────
// Un abaque papier = UNE image, UN axe Y commun, des cadres (un par graphe).
// Ce bloc décrit l'état de l'ATELIER, persisté dans metadata.workshop pour la
// ré-édition. Il ne REMPLACE PAS les axes par graphe : à l'export, le Y commun
// est DUPLIQUÉ dans chaque GraphConfig.axes.yAxis des graphes cadrés → le
// format de LECTURE (cascade, prépa vol, CascadeCalculator) reste inchangé.

/** Spécification d'un axe (réutilise la forme de AxesConfig.yAxis). */
export type AxisSpec = AxesConfig['yAxis'];

/** Calibration multi-points value↔pixel (équivalent core de AxisTickCalibration du Chart). */
export interface WorkshopTickCalibration {
  value: number;
  pixel: number; // coords INNER du canevas (post-marges)
}

export interface WorkshopImage {
  url: string;
  /** Position/taille en pixels INNER du canevas (post-marges) — même convention
   *  que BackgroundImage du Chart : posée/recadrée UNE fois pour tout le set. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkshopFrame {
  graphId: string;
  /** Bande horizontale du cadre sur le canevas (pixels inner) — l'ordre
   *  gauche→droite des cadres définit la chaîne de lecture G1→G2→G3. */
  xLeftPx: number;
  xRightPx: number;
  /** Calibration X propre au cadre (clics graduations) — optionnelle. */
  xTicks?: WorkshopTickCalibration[];
}

export interface WorkshopConfig {
  /** L'image MANEX du set — null tant que rien n'est importé. */
  image: WorkshopImage | null;
  /** Axe Y COMMUN — paramétré UNE fois (nature même d'un abaque). */
  sharedY: AxisSpec;
  /** Calibration Y commune — optionnelle. */
  yTicks?: WorkshopTickCalibration[];
  frames: WorkshopFrame[];
}

export interface AbacCurvesJSON {
  version: string;
  axes?: AxesConfig; // Pour compatibilité
  curves?: Curve[]; // Pour compatibilité
  graphs?: GraphConfig[]; // Nouveau: support multi-graphiques
  system?: AbacSystemConfig; // Configuration du système d'abaques
  metadata?: {
    createdAt: string;
    updatedAt: string;
    description?: string;
    systemType?: string; // Type du système d'abaques
    systemName?: string; // Nom affiché du système
    modelName?: string; // Nom du modèle d'avion
    aircraftModel?: string; // Modèle d'avion depuis le wizard
    /** R1 — état de l'atelier « image unique » (ré-édition). Absent sur les
     *  modèles construits avant la refonte → ouverture en mode compat (D4). */
    workshop?: WorkshopConfig;
  };
}

export interface ChartRef {
  addPoint: (curveId: string, point: XYPoint) => void;
  removePoint: (curveId: string, pointId: string) => void;
  updatePoint: (curveId: string, pointId: string, newPoint: XYPoint) => void;
  fitCurve: (curveId: string, options?: FitOptions) => FitResult;
  fitAll: () => Record<string, FitResult>;
  getCurves: () => Curve[];
  addCurve: (curve: Omit<Curve, 'id'>) => string;
  removeCurve: (curveId: string) => void;
  clear: () => void;
}