// src/abac/curves/core/axisVariables.ts
//
// Catalogue des **variables canoniques** utilisables comme titre d'axe X ou Y
// dans un abaque. Chaque entrée fournit un identifiant stable (`id`) qui est
// stocké dans `AxesConfig.xAxis.title` / `yAxis.title` et qui sera référencé
// ailleurs dans l'application (calculs de performance, mapping de chaînes
// d'abaques, exports, etc.).
//
// IMPORTANT : ne renomme jamais un `id` existant — c'est une clé persistée en
// base. Ajoute une nouvelle entrée et déprécie l'ancienne si besoin.

export type AxisVariableCategory =
  | 'environment'
  | 'altitude'
  | 'weight'
  | 'wind'
  | 'distance'
  | 'speed'
  | 'engine'
  | 'fuel'
  | 'time'
  | 'intermediate'
  | 'other';

/**
 * Rôle d'une variable dans l'abaque :
 *   - 'input'  : valeur d'entrée — apparaît sur l'axe X (température, masse, vent, pression…)
 *   - 'output' : valeur produite — apparaît sur l'axe Y (distance, vitesse, taux montée, intermédiaire…)
 *   - 'both'   : peut servir des deux côtés (rare ; ex. altitude pression utilisée comme entrée
 *                pour la perf de croisière mais comme sortie pour le plafond).
 */
export type AxisRole = 'input' | 'output' | 'both';

export interface AxisVariable {
  /** Identifiant stable utilisé partout dans le code (clé persistée). */
  id: string;
  /** Libellé affiché dans la liste déroulante et sur les axes. */
  label: string;
  /** Court symbole optionnel (ex. "OAT", "PA"). */
  symbol?: string;
  /** Catégorie pour le groupement dans le dropdown. */
  category: AxisVariableCategory;
  /**
   * 🔒 Indique si cette variable peut apparaître sur l'axe X (input), Y (output) ou les deux.
   * Filtre les dropdowns de la sous-étape 3 « Axes » du wizard :
   *   - Dropdown X : ne montre que les 'input' et 'both'
   *   - Dropdown Y : ne montre que les 'output' et 'both'
   */
  axisRole: AxisRole;
  /** Unité par défaut suggérée (pré-remplie si l'unité est vide). */
  defaultUnit: string;
  /** Liste optionnelle d'unités compatibles. */
  units?: string[];
  /** Description courte pour tooltip. */
  description?: string;
  /**
   * Lot 1-A (décision pilote 20/08) — cœur perf : seules les variables
   * marquées `perfCore` sont PROPOSÉES dans les listes déroulantes vivantes
   * de l'atelier. La préparation de vol ne sait router que 4 familles
   * d'entrée (température, altitude pression, masse, vent) ; toute autre
   * entrée rend le modèle incalculable en vol. Les entrées non marquées
   * RESTENT dans le catalogue (ids persistés, affichage des vieux modèles)
   * mais ne sont plus offertes à la création.
   */
  perfCore?: boolean;
}

export const AXIS_VARIABLES: AxisVariable[] = [
  // === Environnement (INPUT) ===
  { id: 'oat',                label: 'Température extérieure (OAT)', symbol: 'OAT', category: 'environment', axisRole: 'input', defaultUnit: '°C', units: ['°C', '°F'], perfCore: true },
  { id: 'qnh',                label: 'QNH',                          symbol: 'QNH', category: 'environment', axisRole: 'input', defaultUnit: 'hPa', units: ['hPa', 'inHg'] },
  { id: 'humidity',           label: 'Humidité relative',                            category: 'environment', axisRole: 'input', defaultUnit: '%' },
  { id: 'runway_slope',       label: 'Pente de piste',                               category: 'environment', axisRole: 'input', defaultUnit: '%' },
  { id: 'runway_condition',   label: 'État de piste',                                category: 'environment', axisRole: 'input', defaultUnit: '' },

  // === Altitude (INPUT, mais altitude peut être sortie d'un graphe de plafond → both) ===
  { id: 'pressure_altitude',  label: 'Altitude pression', symbol: 'PA', category: 'altitude', axisRole: 'input', defaultUnit: 'ft', units: ['ft', 'm'], perfCore: true },
  { id: 'density_altitude',   label: 'Altitude densité',  symbol: 'DA', category: 'altitude', axisRole: 'input', defaultUnit: 'ft', units: ['ft', 'm'] },
  { id: 'altitude',           label: 'Altitude',                        category: 'altitude', axisRole: 'both',  defaultUnit: 'ft', units: ['ft', 'm'] },

  // === Masse (INPUT) ===
  { id: 'mass',               label: 'Masse',                  category: 'weight', axisRole: 'input', defaultUnit: 'kg', units: ['kg', 'lb'], perfCore: true },
  { id: 'takeoff_weight',     label: 'Masse au décollage',     category: 'weight', axisRole: 'input', defaultUnit: 'kg', units: ['kg', 'lb'] },
  { id: 'landing_weight',     label: 'Masse à l\'atterrissage', category: 'weight', axisRole: 'input', defaultUnit: 'kg', units: ['kg', 'lb'] },

  // === Vent (INPUT) ===
  // Lot 1-A : perfCore sur la COMPOSANTE générique uniquement — le sens du
  // vent (face / arrière) se choisit sur chaque courbe, pas dans la variable.
  { id: 'wind_component',     label: 'Composante de vent', category: 'wind', axisRole: 'input', defaultUnit: 'kt', units: ['kt', 'km/h', 'm/s'], perfCore: true },
  { id: 'headwind',           label: 'Vent de face',       category: 'wind', axisRole: 'input', defaultUnit: 'kt', units: ['kt', 'km/h', 'm/s'] },
  { id: 'tailwind',           label: 'Vent arrière',       category: 'wind', axisRole: 'input', defaultUnit: 'kt', units: ['kt', 'km/h', 'm/s'] },
  { id: 'crosswind',          label: 'Vent travers',       category: 'wind', axisRole: 'input', defaultUnit: 'kt', units: ['kt', 'km/h', 'm/s'] },

  // === Distance (OUTPUT — résultat final d'un abaque primaire) ===
  { id: 'takeoff_distance_ground',  label: 'Distance de décollage (roulage)',                 category: 'distance', axisRole: 'output', defaultUnit: 'm', units: ['m', 'ft'], perfCore: true },
  { id: 'takeoff_distance_50ft',    label: 'Distance de décollage (franchissement 50ft)',     category: 'distance', axisRole: 'output', defaultUnit: 'm', units: ['m', 'ft'], perfCore: true },
  { id: 'landing_distance_ground',  label: 'Distance d\'atterrissage (roulage)',              category: 'distance', axisRole: 'output', defaultUnit: 'm', units: ['m', 'ft'], perfCore: true },
  { id: 'landing_distance_50ft',    label: 'Distance d\'atterrissage (franchissement 50ft)',  category: 'distance', axisRole: 'output', defaultUnit: 'm', units: ['m', 'ft'], perfCore: true },
  { id: 'accelerate_stop',          label: 'Distance accélération-arrêt',                     category: 'distance', axisRole: 'output', defaultUnit: 'm', units: ['m', 'ft'] },
  { id: 'range',                    label: 'Distance franchissable',                          category: 'distance', axisRole: 'output', defaultUnit: 'NM', units: ['NM', 'km'] },

  // === Vitesse (OUTPUT — résultat sauf vitesses pilote-contrôlées qui sont 'both') ===
  { id: 'ias',                label: 'Vitesse indiquée (IAS)', symbol: 'IAS', category: 'speed', axisRole: 'both',   defaultUnit: 'kt', units: ['kt', 'km/h', 'mph'] },
  { id: 'cas',                label: 'Vitesse calibrée (CAS)', symbol: 'CAS', category: 'speed', axisRole: 'both',   defaultUnit: 'kt', units: ['kt', 'km/h', 'mph'] },
  { id: 'tas',                label: 'Vitesse vraie (TAS)',    symbol: 'TAS', category: 'speed', axisRole: 'output', defaultUnit: 'kt', units: ['kt', 'km/h', 'mph'] },
  { id: 'gs',                 label: 'Vitesse sol (GS)',       symbol: 'GS',  category: 'speed', axisRole: 'output', defaultUnit: 'kt', units: ['kt', 'km/h', 'mph'] },
  { id: 'mach',               label: 'Nombre de Mach',         symbol: 'M',   category: 'speed', axisRole: 'output', defaultUnit: '' },
  { id: 'rate_of_climb',      label: 'Taux de montée',         symbol: 'VS',  category: 'speed', axisRole: 'output', defaultUnit: 'ft/min', units: ['ft/min', 'm/s'], perfCore: true },
  { id: 'climb_angle',        label: 'Angle de montée',                       category: 'speed', axisRole: 'output', defaultUnit: '°' },
  { id: 'glide_ratio',        label: 'Finesse',                               category: 'speed', axisRole: 'output', defaultUnit: '' },

  // === Moteur (INPUT côté pilote — réglages — sauf EGT qui est mesuré, donc 'both') ===
  { id: 'rpm',                label: 'Régime moteur',          symbol: 'RPM', category: 'engine', axisRole: 'input', defaultUnit: 'rpm' },
  { id: 'manifold_pressure',  label: 'Pression d\'admission',  symbol: 'MP',  category: 'engine', axisRole: 'input', defaultUnit: 'inHg', units: ['inHg', 'hPa'] },
  { id: 'power_percent',      label: 'Puissance moteur',                      category: 'engine', axisRole: 'input', defaultUnit: '%' },
  { id: 'torque',             label: 'Couple',                                category: 'engine', axisRole: 'both',  defaultUnit: '%' },
  { id: 'egt',                label: 'Température gaz d\'échappement (EGT)', symbol: 'EGT', category: 'engine', axisRole: 'output', defaultUnit: '°C' },

  // === Carburant (OUTPUT) ===
  { id: 'fuel_flow',          label: 'Débit carburant',     category: 'fuel', axisRole: 'output', defaultUnit: 'L/h', units: ['L/h', 'gph', 'kg/h'] },
  { id: 'fuel_quantity',      label: 'Quantité carburant',  category: 'fuel', axisRole: 'both',   defaultUnit: 'L',  units: ['L', 'gal', 'kg'] },
  { id: 'fuel_consumption',   label: 'Consommation totale', category: 'fuel', axisRole: 'output', defaultUnit: 'L', units: ['L', 'gal', 'kg'] },

  // === Temps (OUTPUT) ===
  { id: 'endurance',          label: 'Endurance',   category: 'time', axisRole: 'output', defaultUnit: 'h', units: ['h', 'min'] },
  { id: 'flight_time',        label: 'Temps de vol', category: 'time', axisRole: 'output', defaultUnit: 'h', units: ['h', 'min'] },

  // === Intermédiaires (BOTH — par essence : Y du graphe N = X du graphe N+1) ===
  { id: 'intermediate_distance',                  label: 'Distance intermédiaire (référence non corrigée)', symbol: 'D₀', category: 'intermediate', axisRole: 'both', defaultUnit: 'm', units: ['m', 'ft'], description: 'Valeur de référence ISA — sert d\'entrée X au graphe de correction suivant' },
  { id: 'intermediate_distance_mass_corrected',   label: 'Distance intermédiaire après correction masse',   symbol: 'D₁', category: 'intermediate', axisRole: 'both', defaultUnit: 'm', units: ['m', 'ft'], description: 'Distance après application du facteur de masse' },
  { id: 'intermediate_distance_wind_corrected',   label: 'Distance intermédiaire après correction vent',    symbol: 'D₂', category: 'intermediate', axisRole: 'both', defaultUnit: 'm', units: ['m', 'ft'], description: 'Distance après application du facteur de vent' },
  { id: 'intermediate_distance_slope_corrected',  label: 'Distance intermédiaire après correction pente',   symbol: 'D₃', category: 'intermediate', axisRole: 'both', defaultUnit: 'm', units: ['m', 'ft'] },
  { id: 'intermediate_distance_surface_corrected',label: 'Distance intermédiaire après correction piste',   symbol: 'D₄', category: 'intermediate', axisRole: 'both', defaultUnit: 'm', units: ['m', 'ft'], description: 'Distance après correction d\'état de piste' },
  { id: 'correction_factor',                      label: 'Facteur de correction (multiplicatif)',           symbol: 'k',  category: 'intermediate', axisRole: 'output', defaultUnit: '',  description: 'Coefficient sans dimension à appliquer à la distance précédente' },
  { id: 'correction_delta',                       label: 'Correction additive (Δ)',                         symbol: 'Δ',  category: 'intermediate', axisRole: 'output', defaultUnit: 'm', units: ['m', 'ft', '%'], description: 'Valeur à ajouter/soustraire à la distance précédente' },

  // === Autre — axe de transfert (both, unité libre) ===
  // Lot 1-A : renommé (ex-« Personnalisé (libre) ») — son seul usage réel est
  // l'axe Y commun des lectures descendantes (transfert entre cadres).
  { id: 'custom',             label: 'Axe de transfert (sans variable précise)', category: 'other', axisRole: 'both', defaultUnit: '', perfCore: true }
];

/** Libellés FR des catégories pour l'UI. */
export const AXIS_CATEGORY_LABELS: Record<AxisVariableCategory, string> = {
  environment: 'Environnement',
  altitude:    'Altitude',
  weight:      'Masse',
  wind:        'Vent',
  distance:    'Distance',
  speed:       'Vitesse',
  engine:      'Moteur',
  fuel:        'Carburant',
  time:        'Temps',
  intermediate:'Intermédiaires (chaînage)',
  other:       'Autre'
};

/** Récupère une variable par son id. Retourne `undefined` si inconnue. */
export function getAxisVariable(id: string | undefined | null): AxisVariable | undefined {
  if (!id) return undefined;
  return AXIS_VARIABLES.find(v => v.id === id);
}

/** Set d'ids des variables relevant de la famille "vent" (face / arrière / travers / composante). */
export const WIND_AXIS_VARIABLE_IDS = new Set<string>([
  'wind_component',
  'headwind',
  'tailwind',
  'crosswind'
]);

/** True si l'id correspond à une variable de la famille "vent". */
export function isWindAxisVariable(id: string | undefined | null): boolean {
  if (!id) return false;
  return WIND_AXIS_VARIABLE_IDS.has(id);
}

/** Libellé affiché pour un id de variable. Fallback : l'id lui-même. */
export function getAxisVariableLabel(id: string | undefined | null): string {
  return getAxisVariable(id)?.label ?? (id ?? '');
}

/** Retourne les variables groupées par catégorie, dans l'ordre du catalogue. */
export function getAxisVariablesGrouped(): Array<{ category: AxisVariableCategory; label: string; items: AxisVariable[] }> {
  const order: AxisVariableCategory[] = ['environment', 'altitude', 'weight', 'wind', 'distance', 'speed', 'engine', 'fuel', 'time', 'intermediate', 'other'];
  return order.map(cat => ({
    category: cat,
    label: AXIS_CATEGORY_LABELS[cat],
    items: AXIS_VARIABLES.filter(v => v.category === cat)
  })).filter(g => g.items.length > 0);
}

/**
 * Retourne les variables groupées filtrées selon le rôle d'axe.
 *   - 'x' : dropdown axe X → input + both
 *   - 'y' : dropdown axe Y → output + both
 */
export function getAxisVariablesGroupedFor(axis: 'x' | 'y'): Array<{ category: AxisVariableCategory; label: string; items: AxisVariable[] }> {
  const allowed: AxisRole[] = axis === 'x' ? ['input', 'both'] : ['output', 'both'];
  return getAxisVariablesGrouped()
    .map(g => ({ ...g, items: g.items.filter(v => allowed.includes(v.axisRole)) }))
    .filter(g => g.items.length > 0);
}

/**
 * Lot 1-A — variante CŒUR PERF de `getAxisVariablesGroupedFor` : même
 * filtrage par rôle d'axe, restreint aux variables `perfCore` (les seules que
 * la préparation de vol sait router). C'est la liste à brancher sur les
 * dropdowns VIVANTS de l'atelier ; le catalogue complet reste disponible pour
 * résoudre/afficher les ids persistés des vieux modèles.
 */
export function getAxisVariablesGroupedForCore(axis: 'x' | 'y'): Array<{ category: AxisVariableCategory; label: string; items: AxisVariable[] }> {
  return getAxisVariablesGroupedFor(axis)
    .map(g => ({ ...g, items: g.items.filter(v => v.perfCore === true) }))
    .filter(g => g.items.length > 0);
}

/**
 * Lot 1-A — ids proposables comme variable de FAMILLE de courbes (le
 * paramètre qui distingue les courbes d'un même graphe). Une famille n'est
 * PAS un axe : réutiliser la liste d'axe X entretenait la confusion (audit).
 * L'OAT n'y figure pas — c'est l'entrée du premier cadre, jamais la famille.
 */
export const FAMILY_VARIABLE_IDS: readonly string[] = ['pressure_altitude', 'mass', 'wind_component'];

/**
 * Lot 1-A — variables de FAMILLE de courbes, groupées par catégorie (même
 * forme que `getAxisVariablesGroupedFor` pour réutiliser le rendu optgroup).
 */
export function getFamilyVariablesGrouped(): Array<{ category: AxisVariableCategory; label: string; items: AxisVariable[] }> {
  return getAxisVariablesGrouped()
    .map(g => ({ ...g, items: g.items.filter(v => FAMILY_VARIABLE_IDS.includes(v.id)) }))
    .filter(g => g.items.length > 0);
}
