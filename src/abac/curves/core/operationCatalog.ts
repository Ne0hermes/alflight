// src/abac/curves/core/operationCatalog.ts
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║          CATALOGUE CANONIQUE DES OPÉRATIONS DE PERFORMANCE          ║
// ║                                                                      ║
// ║  Source de vérité unique pour identifier de manière non ambiguë      ║
// ║  chaque tableau / abaque exploité par l'app pour les calculs de      ║
// ║  performance de préparation de vol.                                  ║
// ║                                                                      ║
// ║  RÈGLES DE SÉCURITÉ :                                                ║
// ║                                                                      ║
// ║  1. Ne JAMAIS renommer un `id` existant — c'est une clé persistée    ║
// ║     en base et utilisée dans les calculs.                            ║
// ║                                                                      ║
// ║  2. Pour ajouter une opération, ajouter une entrée à OPERATION_CATALOG ║
// ║     et propager dans le wizard, l'IA d'extraction et l'engine.       ║
// ║                                                                      ║
// ║  3. Le moteur de génération d'état (`performanceStateEngine`) itère  ║
// ║     sur l'INTÉGRALITÉ de ce catalogue à chaque préparation de vol —  ║
// ║     chaque opération produit soit un résultat soit le statut         ║
// ║     `NOT_IMPLEMENTED`, garantissant l'exhaustivité.                  ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

/** Phase de vol concernée. */
export type OperationPhase = 'takeoff' | 'climb' | 'cruise' | 'descent' | 'landing';

/** Nature physique de la grandeur produite par l'abaque/tableau. */
export type OutputKind =
  | 'distance'         // distance horizontale (m, ft)
  | 'speed'            // vitesse (kt, km/h, mph)
  | 'rate_of_climb'    // taux de montée (ft/min, m/s)
  | 'climb_gradient'   // angle / pente de montée (°, %)
  | 'time'             // temps (s, min, h)
  | 'fuel'             // carburant (L, kg)
  | 'rate_of_descent'; // taux de descente (ft/min, m/s)

/** Configuration aéronef (orthogonale à la phase). */
export interface OperationConfiguration {
  /** Position des volets / flaps. */
  flaps?: 'LANDING' | 'APPROACH' | 'TAKEOFF' | 'UP';
  /** État de piste (optionnel — pas tous les MANEX le donnent). */
  runwayCondition?: 'dry_paved' | 'wet_paved' | 'grass' | 'snow' | 'contaminated';
  /** Train d'atterrissage (très rares cas où ça compte sur monomoteurs). */
  gear?: 'up' | 'down';
}

/** Spécification d'une grandeur de sortie acceptée par une opération. */
export interface OutputSpec {
  kind: OutputKind;
  labelFr: string;
  labelEn: string;
  /** Unité par défaut. */
  defaultUnit: string;
  /** Unités alternatives autorisées. */
  alternateUnits?: string[];
}

/** Définition canonique d'une opération de performance. */
export interface OperationDefinition {
  /** Identifiant stable persisté en DB et utilisé partout — NE JAMAIS RENOMMER. */
  id: string;
  labelFr: string;
  labelEn: string;
  phase: OperationPhase;
  /** Configuration aéronef figée pour cette opération (si applicable). */
  configuration?: OperationConfiguration;
  /**
   * Une ou plusieurs natures de sortie acceptées.
   * Si plusieurs : le créateur de l'abaque choisit laquelle à la création.
   * Exemple : `climb_takeoff` accepte rate_of_climb OU climb_gradient.
   */
  acceptedOutputs: OutputSpec[];
  /** Description courte (tooltip). */
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// SPÉCIFICATIONS DE SORTIE — réutilisables
// ─────────────────────────────────────────────────────────────────────────

const OUT_DISTANCE: OutputSpec = {
  kind: 'distance',
  labelFr: 'Distance',
  labelEn: 'Distance',
  defaultUnit: 'm',
  alternateUnits: ['ft']
};

const OUT_SPEED_TAS: OutputSpec = {
  kind: 'speed',
  labelFr: 'Vitesse vraie (TAS)',
  labelEn: 'True airspeed (TAS)',
  defaultUnit: 'kt',
  alternateUnits: ['km/h', 'mph']
};

const OUT_RATE_OF_CLIMB: OutputSpec = {
  kind: 'rate_of_climb',
  labelFr: 'Taux de montée',
  labelEn: 'Rate of climb',
  defaultUnit: 'ft/min',
  alternateUnits: ['m/s']
};

const OUT_CLIMB_GRADIENT: OutputSpec = {
  kind: 'climb_gradient',
  labelFr: 'Angle / gradient de montée',
  labelEn: 'Climb gradient',
  defaultUnit: '°',
  alternateUnits: ['%']
};

// ─────────────────────────────────────────────────────────────────────────
// CATALOGUE (liste FERMÉE — toute modification doit être délibérée)
// ─────────────────────────────────────────────────────────────────────────

export const OPERATION_CATALOG: OperationDefinition[] = [
  // ─── 1. Distance sol décollage (état volets NON PRÉCISÉ — hérité) ───
  // R17 — deux abaques d'un même avion peuvent différer UNIQUEMENT par les
  // volets (PA-28 : 0° et 25°). Sans variante, ils portent la même dénomination
  // et le calcul peut piocher le mauvais tableau (bug du 533 ft, §25 audit).
  // Préférer les variantes « Flaps UP / Flaps TAKEOFF » ci-dessous.
  {
    id: 'takeoff_ground_roll',
    labelFr: 'Distance sol décollage (volets non précisés — hérité)',
    labelEn: 'Takeoff ground roll (flaps unspecified — legacy)',
    phase: 'takeoff',
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance au sol entre le point de départ et la rotation. État des volets non précisé : à n\'utiliser que si le MANEX ne publie qu\'une seule configuration.'
  },

  // ─── 2. Distance décollage passage 15 m (état volets NON PRÉCISÉ — hérité) ───
  {
    id: 'takeoff_50ft',
    labelFr: 'Distance décollage — passage 15 m (volets non précisés — hérité)',
    labelEn: 'Takeoff distance over 50 ft (flaps unspecified — legacy)',
    phase: 'takeoff',
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance totale jusqu\'au franchissement des 15 m / 50 ft. État des volets non précisé : à n\'utiliser que si le MANEX ne publie qu\'une seule configuration.'
  },

  // ─── 2b. R17 : variantes VOLETS du décollage ───
  {
    id: 'takeoff_ground_roll_flaps_up',
    labelFr: 'Distance sol décollage — Flaps UP (0°)',
    labelEn: 'Takeoff ground roll — Flaps UP',
    phase: 'takeoff',
    configuration: { flaps: 'UP' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance au sol entre le point de départ et la rotation, volets rentrés (0°).'
  },
  {
    id: 'takeoff_50ft_flaps_up',
    labelFr: 'Distance décollage — passage 15 m, Flaps UP (0°)',
    labelEn: 'Takeoff distance over 50 ft — Flaps UP',
    phase: 'takeoff',
    configuration: { flaps: 'UP' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance totale jusqu\'au franchissement des 15 m / 50 ft, volets rentrés (0°).'
  },
  {
    id: 'takeoff_ground_roll_flaps_to',
    labelFr: 'Distance sol décollage — Flaps TAKEOFF (ex. 25°)',
    labelEn: 'Takeoff ground roll — Flaps TAKEOFF',
    phase: 'takeoff',
    configuration: { flaps: 'TAKEOFF' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance au sol entre le point de départ et la rotation, volets en position décollage (ex. 25° sur PA-28).'
  },
  {
    id: 'takeoff_50ft_flaps_to',
    labelFr: 'Distance décollage — passage 15 m, Flaps TAKEOFF (ex. 25°)',
    labelEn: 'Takeoff distance over 50 ft — Flaps TAKEOFF',
    phase: 'takeoff',
    configuration: { flaps: 'TAKEOFF' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance totale jusqu\'au franchissement des 15 m / 50 ft, volets en position décollage (ex. 25° sur PA-28).'
  },

  // ─── 3. Performance de montée au décollage ───
  {
    id: 'climb_takeoff',
    labelFr: 'Performance de montée au décollage',
    labelEn: 'Climb performance at takeoff',
    phase: 'climb',
    acceptedOutputs: [OUT_RATE_OF_CLIMB, OUT_CLIMB_GRADIENT],
    description: 'Performance de montée pendant la phase initiale après décollage. Peut être exprimé en taux (ft/min, m/s) ou en angle (°, %).'
  },

  // ─── 4. Performance de montée en croisière ───
  {
    id: 'climb_cruise',
    labelFr: 'Performance de montée en croisière',
    labelEn: 'Climb performance in cruise',
    phase: 'climb',
    acceptedOutputs: [OUT_RATE_OF_CLIMB, OUT_CLIMB_GRADIENT],
    description: 'Performance de montée à partir de la phase de croisière (changement de niveau). Taux ou angle au choix.'
  },

  // ─── 5. Vitesse de croisière ───
  {
    id: 'cruise_speed',
    labelFr: 'Vitesse de croisière (TAS)',
    labelEn: 'Cruise true airspeed',
    phase: 'cruise',
    acceptedOutputs: [OUT_SPEED_TAS],
    description: 'Vitesse vraie de croisière pour des conditions données (régime moteur, altitude, OAT).'
  },

  // ─── 6. Atterrissage passage 15 m — Flaps LANDING ───
  {
    id: 'landing_50ft_flaps_landing',
    labelFr: 'Distance atterrissage — passage 15 m, Flaps LANDING',
    labelEn: 'Landing distance over 50 ft (15 m), Flaps LANDING',
    phase: 'landing',
    configuration: { flaps: 'LANDING' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance totale depuis le franchissement des 15 m / 50 ft jusqu\'à l\'arrêt complet, volets en position atterrissage.'
  },

  // ─── 7. Atterrissage roulage — Flaps LANDING ───
  {
    id: 'landing_ground_roll_flaps_landing',
    labelFr: 'Distance atterrissage — roulage, Flaps LANDING',
    labelEn: 'Landing ground roll, Flaps LANDING',
    phase: 'landing',
    configuration: { flaps: 'LANDING' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance au sol entre le toucher des roues et l\'arrêt complet, volets en position atterrissage. Synonyme : « atterrissage seule ».'
  },

  // ─── 8. Atterrissage passage 15 m — Flaps UP ───
  {
    id: 'landing_50ft_flaps_up',
    labelFr: 'Distance atterrissage — passage 15 m, Flaps UP',
    labelEn: 'Landing distance over 50 ft (15 m), Flaps UP',
    phase: 'landing',
    configuration: { flaps: 'UP' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance totale depuis le franchissement des 15 m / 50 ft jusqu\'à l\'arrêt complet, volets rentrés.'
  },

  // ─── 9. Atterrissage roulage — Flaps UP ───
  {
    id: 'landing_ground_roll_flaps_up',
    labelFr: 'Distance atterrissage — roulage, Flaps UP',
    labelEn: 'Landing ground roll, Flaps UP',
    phase: 'landing',
    configuration: { flaps: 'UP' },
    acceptedOutputs: [OUT_DISTANCE],
    description: 'Distance au sol entre le toucher des roues et l\'arrêt complet, volets rentrés.'
  },

  // ─── 10. Performance de montée en remise de gaz (go-around) ───
  {
    id: 'go_around_climb',
    labelFr: 'Performance de montée en remise de gaz',
    labelEn: 'Go-around climb performance',
    phase: 'climb',
    acceptedOutputs: [OUT_RATE_OF_CLIMB, OUT_CLIMB_GRADIENT],
    description: 'Performance de montée lors d\'une remise de gaz (atterrissage interrompu). Taux (ft/min) ou angle (°/%).'
  }
];

// ─────────────────────────────────────────────────────────────────────────
// UNION TYPE STRICTE — détecte les fautes de frappe à la compilation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Union type stricte des ids d'opération autorisés.
 *
 * Usage :
 *   const id: OperationId = 'takeoff_ground_roll'; // ✅ ok
 *   const id: OperationId = 'takeof_groundroll';   // ❌ erreur TS
 */
export type OperationId =
  | 'takeoff_ground_roll'
  | 'takeoff_50ft'
  | 'takeoff_ground_roll_flaps_up'
  | 'takeoff_50ft_flaps_up'
  | 'takeoff_ground_roll_flaps_to'
  | 'takeoff_50ft_flaps_to'
  | 'climb_takeoff'
  | 'climb_cruise'
  | 'cruise_speed'
  | 'landing_50ft_flaps_landing'
  | 'landing_ground_roll_flaps_landing'
  | 'landing_50ft_flaps_up'
  | 'landing_ground_roll_flaps_up'
  | 'go_around_climb';

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

/** Récupère la définition d'une opération par son id (ou undefined si inconnue). */
export function getOperation(id: string | undefined | null): OperationDefinition | undefined {
  if (!id) return undefined;
  return OPERATION_CATALOG.find(op => op.id === id);
}

/** Vérifie qu'un id appartient au catalogue. Utile pour valider en runtime. */
export function isValidOperationId(id: string | undefined | null): boolean {
  return getOperation(id) !== undefined;
}

/** Libellé bilingue pour l'UI : "FR / EN". */
export function getOperationLabel(id: string | undefined | null): string {
  const op = getOperation(id);
  if (!op) return id ?? '';
  return `${op.labelFr} / ${op.labelEn}`;
}

/** Libellé court FR uniquement (pour zones compactes). */
export function getOperationShortLabel(id: string | undefined | null): string {
  return getOperation(id)?.labelFr ?? (id ?? '');
}

/** Retourne les opérations groupées par phase, dans l'ordre du catalogue. */
export function getOperationsGroupedByPhase(): Array<{
  phase: OperationPhase;
  labelFr: string;
  items: OperationDefinition[];
}> {
  const order: OperationPhase[] = ['takeoff', 'climb', 'cruise', 'descent', 'landing'];
  const phaseLabels: Record<OperationPhase, string> = {
    takeoff:  'Décollage / Takeoff',
    climb:    'Montée / Climb',
    cruise:   'Croisière / Cruise',
    descent:  'Descente / Descent',
    landing:  'Atterrissage / Landing'
  };
  return order
    .map(phase => ({
      phase,
      labelFr: phaseLabels[phase],
      items: OPERATION_CATALOG.filter(op => op.phase === phase)
    }))
    .filter(g => g.items.length > 0);
}

/** Vérifie qu'une OutputKind est admise par une opération. */
export function isOutputKindValidFor(opId: string, kind: OutputKind): boolean {
  const op = getOperation(opId);
  if (!op) return false;
  return op.acceptedOutputs.some(o => o.kind === kind);
}

/**
 * Erreur lancée lorsqu'on tente de persister un graphique/tableau avec
 * un operationId absent du catalogue. À attraper en haut du flux de save
 * pour afficher un message utilisateur clair.
 */
export class UnknownOperationIdError extends Error {
  constructor(public readonly badId: string) {
    super(`operationId inconnu : "${badId}". Ids valides : ${OPERATION_CATALOG.map(o => o.id).join(', ')}`);
    this.name = 'UnknownOperationIdError';
  }
}
