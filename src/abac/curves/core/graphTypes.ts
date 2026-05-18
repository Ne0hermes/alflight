// src/abac/curves/core/graphTypes.ts
//
// Catalogue des **types de graphiques** (abaques) qu'on rencontre dans un
// MANEX d'avion léger. Chaque entrée fournit un identifiant stable (`id`)
// qui est stocké dans `GraphConfig.graphType` et qui sert ailleurs dans
// l'application pour identifier la nature du graphique (lookup, chaînage
// d'abaques, exports, libellé sur la barre du wizard, etc.).
//
// IMPORTANT : ne renomme jamais un `id` existant — c'est une clé persistée.
// Ajoute une nouvelle entrée et déprécie l'ancienne si besoin.

export type GraphTypeCategory =
  | 'takeoff'
  | 'landing'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'fuel'
  | 'weight_balance'
  | 'wind'
  | 'correction'
  | 'other';

export interface GraphType {
  /** Identifiant stable persisté en DB et utilisé dans le code. */
  id: string;
  /** Libellé FR affiché dans l'UI. */
  label: string;
  /** Libellé EN (affiché en complément). */
  labelEn: string;
  /** Catégorie pour le groupement dans le dropdown. */
  category: GraphTypeCategory;
  /** Description courte (tooltip). */
  description?: string;
}

export const GRAPH_TYPES: GraphType[] = [
  // === Décollage ===
  // ⚠ Étiquettes UI legacy uniquement. Pour le matching de calcul, utilise `operationId` (cf. operationCatalog.ts).
  { id: 'takeoff_ground_roll', label: 'Distance de décollage — roulage',              labelEn: 'Takeoff ground roll',         category: 'takeoff', description: 'Distance au sol jusqu\'à la rotation' },
  { id: 'takeoff_50ft',        label: 'Distance de décollage — passage 50 ft (15 m)', labelEn: 'Takeoff distance over 50 ft', category: 'takeoff', description: 'Distance totale jusqu\'au franchissement des 50 ft / 15 m' },
  { id: 'accelerate_stop',     label: 'Distance accélération-arrêt',                  labelEn: 'Accelerate-stop distance',    category: 'takeoff' },
  { id: 'takeoff_climb_speed', label: 'Vitesse de montée initiale au décollage',      labelEn: 'Initial climb speed',         category: 'takeoff' },

  // === Atterrissage ===
  // ⚠ Étiquettes UI legacy. Pour les nuances flap, utilise `operationId` (cf. operationCatalog.ts).
  { id: 'landing_ground_roll',    label: 'Distance d\'atterrissage — roulage',              labelEn: 'Landing ground roll',           category: 'landing', description: 'Distance au sol après le toucher' },
  { id: 'landing_50ft',           label: 'Distance d\'atterrissage — passage 50 ft (15 m)', labelEn: 'Landing distance over 50 ft',   category: 'landing', description: 'Distance totale depuis le passage des 50 ft / 15 m' },
  { id: 'landing_approach_speed', label: 'Vitesse d\'approche / d\'atterrissage',           labelEn: 'Approach / landing speed',      category: 'landing' },

  // === Montée ===
  { id: 'climb_rate',           label: 'Taux de montée',                                 labelEn: 'Rate of climb',                category: 'climb' },
  { id: 'climb_gradient',       label: 'Pente / gradient de montée',                     labelEn: 'Climb gradient',               category: 'climb' },
  { id: 'time_fuel_distance_to_climb', label: 'Temps / carburant / distance pour monter', labelEn: 'Time, fuel, distance to climb', category: 'climb' },
  { id: 'service_ceiling',      label: 'Plafond de service',                             labelEn: 'Service ceiling',              category: 'climb' },

  // === Croisière ===
  { id: 'cruise_performance',   label: 'Performance de croisière',                       labelEn: 'Cruise performance',           category: 'cruise' },
  { id: 'cruise_tas',           label: 'Vitesse vraie en croisière (TAS)',               labelEn: 'Cruise TAS',                   category: 'cruise' },
  { id: 'range',                label: 'Distance franchissable',                         labelEn: 'Range',                        category: 'cruise' },
  { id: 'endurance',            label: 'Endurance',                                      labelEn: 'Endurance',                    category: 'cruise' },

  // === Descente ===
  { id: 'descent_rate',         label: 'Taux de descente',                               labelEn: 'Rate of descent',              category: 'descent' },
  { id: 'glide_performance',    label: 'Performance de plané',                           labelEn: 'Glide performance',            category: 'descent' },

  // === Carburant ===
  { id: 'fuel_flow',            label: 'Débit carburant',                                labelEn: 'Fuel flow',                    category: 'fuel' },
  { id: 'fuel_consumption',     label: 'Consommation totale',                            labelEn: 'Total fuel consumption',       category: 'fuel' },

  // === Masse & centrage ===
  { id: 'weight_balance_envelope', label: 'Enveloppe de centrage',                       labelEn: 'CG envelope',                  category: 'weight_balance' },
  { id: 'cg_loading',           label: 'Diagramme de chargement',                        labelEn: 'Loading diagram',              category: 'weight_balance' },

  // === Vent ===
  { id: 'crosswind_limits',     label: 'Limites de vent travers',                        labelEn: 'Crosswind limits',             category: 'wind' },
  { id: 'wind_correction',      label: 'Correction vent',                                labelEn: 'Wind correction',              category: 'wind', description: 'Souvent enchaîné avec une distance de décollage/atterrissage' },

  // === Corrections (graphiques enchaînés) ===
  { id: 'mass_correction',      label: 'Correction de masse',                            labelEn: 'Mass correction',              category: 'correction' },
  { id: 'altitude_correction',  label: 'Correction d\'altitude pression',                labelEn: 'Pressure altitude correction', category: 'correction' },
  { id: 'temperature_correction', label: 'Correction de température',                    labelEn: 'Temperature correction',       category: 'correction' },
  { id: 'slope_correction',     label: 'Correction de pente piste',                      labelEn: 'Runway slope correction',      category: 'correction' },
  { id: 'surface_correction',   label: 'Correction d\'état de piste',                    labelEn: 'Runway surface correction',    category: 'correction' },

  // === Autre / Personnalisé ===
  { id: 'custom',               label: 'Personnalisé',                                   labelEn: 'Custom',                       category: 'other' }
];

export const GRAPH_TYPE_CATEGORY_LABELS: Record<GraphTypeCategory, string> = {
  takeoff:         'Décollage / Takeoff',
  landing:         'Atterrissage / Landing',
  climb:           'Montée / Climb',
  cruise:          'Croisière / Cruise',
  descent:         'Descente / Descent',
  fuel:            'Carburant / Fuel',
  weight_balance:  'Masse & centrage / Weight & balance',
  wind:            'Vent / Wind',
  correction:      'Corrections (graphiques enchaînés)',
  other:           'Autre / Other'
};

/** Récupère un type par son id. */
export function getGraphType(id: string | undefined | null): GraphType | undefined {
  if (!id) return undefined;
  return GRAPH_TYPES.find(g => g.id === id);
}

/** Libellé bilingue affiché : "FR / EN". Fallback : l'id, puis chaîne vide. */
export function getGraphTypeLabel(id: string | undefined | null): string {
  const t = getGraphType(id);
  if (!t) return id ?? '';
  return `${t.label} / ${t.labelEn}`;
}

/** Libellé court FR uniquement (pour la barre compacte du wizard). */
export function getGraphTypeShortLabel(id: string | undefined | null): string {
  const t = getGraphType(id);
  if (!t) return id ?? '';
  return t.label;
}

/** Retourne les types groupés par catégorie, dans l'ordre du catalogue. */
export function getGraphTypesGrouped(): Array<{ category: GraphTypeCategory; label: string; items: GraphType[] }> {
  const order: GraphTypeCategory[] = ['takeoff', 'landing', 'climb', 'cruise', 'descent', 'fuel', 'weight_balance', 'wind', 'correction', 'other'];
  return order.map(cat => ({
    category: cat,
    label: GRAPH_TYPE_CATEGORY_LABELS[cat],
    items: GRAPH_TYPES.filter(g => g.category === cat)
  })).filter(g => g.items.length > 0);
}
