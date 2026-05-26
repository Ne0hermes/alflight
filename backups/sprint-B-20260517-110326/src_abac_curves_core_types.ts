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
    reversed?: boolean; // true pour ordre décroissant
  };
  yAxis: {
    min: number;
    max: number;
    unit: string;
    title: string;
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
  axes: AxesConfig;
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