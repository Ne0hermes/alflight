/**
 * aircraftCompleteness — calcul du % de complétion d'un avion et liste des champs manquants.
 *
 * Utilisé par :
 *  - AircraftModule (carte avion) : badge % + dropdown des champs manquants
 *  - AircraftCreationWizard       : confirmation modal avant bypass des validations
 *
 * Catégories de criticité :
 *  - CRITICAL : sans ces données, l'avion ne devrait pas être utilisé pour calculs réels
 *               (Performance, M&C). Affichées en rouge.
 *  - REQUIRED : champs habituellement obligatoires lors de la création (registration, MTOW...).
 *               Affichés en orange.
 *  - OPTIONAL : confort / complétude (photo, MANEX, équipement). Pondération faible.
 */

// Helper : lit une valeur potentiellement imbriquée ("speeds.vne") sur l'avion.
// Supporte également des chemins MULTIPLES séparés par « | » (logique OR) :
//   "cgLimits.forward | weightBalance.cgLimits.forward | cgEnvelope.forwardPoints"
// → retourne la première valeur non-vide trouvée dans la liste.
const getValue = (obj, path) => {
  if (!obj || !path) return undefined;
  const candidates = path.split('|').map((p) => p.trim()).filter(Boolean);
  for (const p of candidates) {
    const v = p.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

// Considère présent : nombre ≠ 0, chaîne non-vide ET non-placeholder, tableau non-vide,
// objet avec hasData=true OU non-vide. Rejette les placeholders « Inconnu », « N/A », « —ʼ ».
const PLACEHOLDER_STRINGS = new Set(['inconnu', 'unknown', 'n/a', 'na', '-', '—', '–', 'none', 'null', 'undefined']);

const hasValue = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.length === 0) return false;
    if (PLACEHOLDER_STRINGS.has(trimmed.toLowerCase())) return false;
    return true;
  }
  if (typeof v === 'boolean') return v === true;
  if (typeof v === 'number') return !isNaN(v) && v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') {
    if ('hasData' in v) return Boolean(v.hasData);
    return Object.keys(v).length > 0;
  }
  return Boolean(v);
};

/**
 * Définition complète des champs vérifiés.
 * weight = poids pour le calcul du %. severity = ordre d'affichage.
 */
/* Notes sur les chemins MULTIPLES :
   Les données d'un avion peuvent être stockées à plusieurs endroits selon le
   chemin d'import (manuel / MANEX / Supabase / IndexedDB). Pour chaque champ
   on liste toutes les sources possibles séparées par « | » (logique OR).
   La 1re source qui retourne une valeur valide gagne. */
export const FIELD_DEFINITIONS = [
  // === REQUIRED (création de base) ===
  { path: 'registration',                                          label: 'Immatriculation',           severity: 'REQUIRED', weight: 5 },
  { path: 'model',                                                 label: 'Modèle',                    severity: 'REQUIRED', weight: 3 },
  { path: 'fuelType',                                              label: 'Type de carburant',         severity: 'REQUIRED', weight: 2 },
  { path: 'fuelCapacity',                                          label: 'Capacité carburant',        severity: 'REQUIRED', weight: 3 },
  { path: 'cruiseSpeedKt | cruiseSpeed',                           label: 'Vitesse de croisière',      severity: 'REQUIRED', weight: 3 },
  { path: 'fuelConsumption',                                       label: 'Consommation carburant',    severity: 'REQUIRED', weight: 3 },
  { path: 'fuelUsableCapacity | fuelCapacity',                     label: 'Volume utilisable',         severity: 'REQUIRED', weight: 2 },
  { path: 'horsepower',                                            label: 'Puissance moteur (CV)',     severity: 'REQUIRED', weight: 2 },

  // === CRITICAL — masse et centrage ===
  { path: 'weights.emptyWeight | emptyWeight | masses.emptyMass',  label: 'Masse à vide',              severity: 'CRITICAL', weight: 6 },
  { path: 'weights.mtow | maxTakeoffWeight',                       label: 'Masse maximale (MTOW)',     severity: 'CRITICAL', weight: 6 },
  { path: 'weights.mlw | limitations.maxLandingMass',              label: 'Masse max atterrissage',    severity: 'REQUIRED', weight: 2 },
  { path: 'arms.empty | weightBalance.emptyWeightArm | armLengths.emptyMassArm', label: 'Bras de levier à vide', severity: 'CRITICAL', weight: 5 },
  { path: 'arms.frontSeats | weightBalance.frontLeftSeatArm | armLengths.frontSeatArm', label: 'Bras sièges avant', severity: 'CRITICAL', weight: 4 },
  { path: 'arms.fuelMain | weightBalance.fuelArm | armLengths.fuelArm', label: 'Bras réservoir principal', severity: 'CRITICAL', weight: 4 },
  { path: 'cgLimits.forward | weightBalance.cgLimits.forward | cgEnvelope.forwardPoints | cgEnvelope.forwardCG', label: 'Limite CG avant', severity: 'CRITICAL', weight: 5 },
  { path: 'cgLimits.aft | weightBalance.cgLimits.aft | cgEnvelope.aftCG | cgEnvelope.aftPoints', label: 'Limite CG arrière', severity: 'CRITICAL', weight: 5 },
  { path: 'weighingReport | hasWeighingReport | weighingReport.fileName | weighingReport.pdfData', label: 'Rapport de pesée (PDF)', severity: 'CRITICAL', weight: 4 },

  // === CRITICAL — vitesses ===
  { path: 'speeds.vso',           label: 'VSO',                       severity: 'CRITICAL', weight: 4 },
  { path: 'speeds.vs1',           label: 'VS1',                       severity: 'CRITICAL', weight: 4 },
  { path: 'speeds.vne',           label: 'VNE',                       severity: 'CRITICAL', weight: 4 },
  { path: 'speeds.vno',           label: 'VNO',                       severity: 'CRITICAL', weight: 3 },
  { path: 'speeds.vfeTO',         label: 'VFE T/O',                   severity: 'CRITICAL', weight: 3 },
  { path: 'speeds.vfeLdg',        label: 'VFE LDG',                   severity: 'CRITICAL', weight: 3 },
  { path: 'speeds.vr',            label: 'VR (rotation)',             severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vx',            label: 'VX',                        severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vy',            label: 'VY',                        severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vapp',          label: 'V approche',                severity: 'REQUIRED', weight: 2 },
  { path: 'speeds.vglide',        label: 'V plané',                   severity: 'REQUIRED', weight: 1 },

  // === CRITICAL — performance ===
  // Les tables/abaques de performance peuvent être stockées à plusieurs
  // emplacements selon l'origine (saisie manuelle / extraction MANEX /
  // CentrogramReader / Sprint B abaque v2). On les couvre toutes.
  {
    path: [
      'performanceTables',
      'performanceModels',
      'advancedPerformance.tables',
      'advancedPerformance.performanceModels',
      'advancedPerformance.performanceTables',
      'data.advancedPerformance.tables',
      'data.performanceTables',
      'data.performanceModels',
      'hasPerformance'
    ].join(' | '),
    label: 'Tables de performance',
    severity: 'CRITICAL',
    weight: 6
  },

  // === OPTIONAL ===
  // MANEX : on accepte le flag hasManex (avion light loaded) OU l'objet manex.
  { path: 'hasManex | manex',     label: 'MANEX (PDF)',               severity: 'OPTIONAL', weight: 2 },
  // Photo : flag hasPhoto suffit (la photo elle-même est dans IndexedDB hors aircraft).
  { path: 'hasPhoto | photo | profilePhoto', label: 'Photo',          severity: 'OPTIONAL', weight: 1 },
  { path: 'manufacturer',         label: 'Constructeur',              severity: 'OPTIONAL', weight: 1 },
  { path: 'engineType',           label: "Type d'engine",             severity: 'OPTIONAL', weight: 1 },
  { path: 'wakeTurbulenceCategory', label: 'Catégorie turbulence',    severity: 'OPTIONAL', weight: 1 },
  { path: 'compatibleRunwaySurfaces', label: 'Pistes compatibles',    severity: 'OPTIONAL', weight: 1 },
];

/**
 * Évalue un avion et retourne :
 *   - percentage      : 0 à 100 (entier)
 *   - filledWeight    : somme des poids des champs remplis
 *   - totalWeight     : somme totale des poids
 *   - missing         : [{ path, label, severity, weight }] — tous les champs vides
 *   - criticalMissing : sous-ensemble CRITICAL seulement
 *   - requiredMissing : sous-ensemble REQUIRED seulement
 *   - hasCriticalGaps : boolean — vrai s'il manque au moins un CRITICAL
 *   - bypassedFields  : reprise de aircraft.bypassedFields[] si présent
 */
export function evaluateAircraft(aircraft) {
  if (!aircraft) {
    return {
      percentage: 0,
      filledWeight: 0,
      totalWeight: 0,
      missing: FIELD_DEFINITIONS,
      criticalMissing: FIELD_DEFINITIONS.filter(f => f.severity === 'CRITICAL'),
      requiredMissing: FIELD_DEFINITIONS.filter(f => f.severity === 'REQUIRED'),
      hasCriticalGaps: true,
      bypassedFields: []
    };
  }

  const bypassedFields = Array.isArray(aircraft.bypassedFields) ? aircraft.bypassedFields : [];
  const bypassedSet = new Set(bypassedFields);

  let filledWeight = 0;
  let totalWeight = 0;
  const missing = [];

  for (const def of FIELD_DEFINITIONS) {
    totalWeight += def.weight;
    // Bypassed = traité comme rempli (le pilote a explicitement accepté de l'ignorer)
    if (bypassedSet.has(def.path) || hasValue(getValue(aircraft, def.path))) {
      filledWeight += def.weight;
    } else {
      missing.push(def);
    }
  }

  const criticalMissing = missing.filter(f => f.severity === 'CRITICAL');
  const requiredMissing = missing.filter(f => f.severity === 'REQUIRED');
  const percentage = totalWeight === 0 ? 0 : Math.round((filledWeight / totalWeight) * 100);

  return {
    percentage,
    filledWeight,
    totalWeight,
    missing,
    criticalMissing,
    requiredMissing,
    hasCriticalGaps: criticalMissing.length > 0,
    bypassedFields
  };
}

/**
 * Couleur d'affichage selon le %.
 * Charte ALFlight : vert sapin / orange officiel / rouge critical.
 */
export function getCompletionColor(percentage) {
  if (percentage >= 90) return '#4FAE7F'; // vert sapin (status-ok ALFlight)
  if (percentage >= 50) return '#f26921'; // orange ALFlight
  return '#C04534';                        // rouge critical
}

/**
 * Couleur pour un niveau de criticité — tout en charte ALFlight uniforme.
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case 'CRITICAL': return '#C04534';   // rouge critical ALFlight
    case 'REQUIRED': return '#f26921';   // orange officiel ALFlight
    case 'OPTIONAL': return '#8A867E';   // gris ALFlight (text-dim)
    default:         return '#8A867E';
  }
}
