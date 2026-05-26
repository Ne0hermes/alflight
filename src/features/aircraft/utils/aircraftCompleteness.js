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

// Helper : lit une valeur potentiellement imbriquée ("speeds.vne") sur l'avion
const getValue = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

// Considère présent : nombre > 0, chaîne non vide, tableau non vide, objet avec hasData=true ou non vide
const hasValue = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
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
export const FIELD_DEFINITIONS = [
  // === REQUIRED (création de base) ===
  { path: 'registration',         label: 'Immatriculation',           severity: 'REQUIRED', weight: 5 },
  { path: 'model',                label: 'Modèle',                    severity: 'REQUIRED', weight: 3 },
  { path: 'fuelType',             label: 'Type de carburant',         severity: 'REQUIRED', weight: 2 },
  { path: 'fuelCapacity',         label: 'Capacité carburant',        severity: 'REQUIRED', weight: 3 },
  { path: 'cruiseSpeedKt',        label: 'Vitesse de croisière',      severity: 'REQUIRED', weight: 3 },
  { path: 'fuelConsumption',      label: 'Consommation carburant',    severity: 'REQUIRED', weight: 3 },
  { path: 'horsepower',           label: 'Puissance moteur (CV)',     severity: 'REQUIRED', weight: 2 },

  // === CRITICAL — masse et centrage ===
  { path: 'weights.emptyWeight',  label: 'Masse à vide',              severity: 'CRITICAL', weight: 6 },
  { path: 'weights.mtow',         label: 'Masse maximale (MTOW)',     severity: 'CRITICAL', weight: 6 },
  { path: 'weights.mlw',          label: 'Masse max atterrissage',    severity: 'REQUIRED', weight: 2 },
  { path: 'arms.empty',           label: 'Bras de levier à vide',     severity: 'CRITICAL', weight: 5 },
  { path: 'arms.frontSeats',      label: 'Bras sièges avant',         severity: 'CRITICAL', weight: 4 },
  { path: 'arms.fuelMain',        label: 'Bras réservoir principal',  severity: 'CRITICAL', weight: 4 },
  { path: 'cgLimits.forward',     label: 'Limite CG avant',           severity: 'CRITICAL', weight: 5 },
  { path: 'cgLimits.aft',         label: 'Limite CG arrière',         severity: 'CRITICAL', weight: 5 },
  { path: 'weighingReport',       label: 'Rapport de pesée (PDF)',    severity: 'CRITICAL', weight: 4 },

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
  { path: 'performanceTables',    label: 'Tables de performance',     severity: 'CRITICAL', weight: 6 },

  // === OPTIONAL ===
  { path: 'manex',                label: 'MANEX (PDF)',               severity: 'OPTIONAL', weight: 2 },
  { path: 'photo',                label: 'Photo',                     severity: 'OPTIONAL', weight: 1 },
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

  let filledWeight = 0;
  let totalWeight = 0;
  const missing = [];

  for (const def of FIELD_DEFINITIONS) {
    totalWeight += def.weight;
    if (hasValue(getValue(aircraft, def.path))) {
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
    bypassedFields: Array.isArray(aircraft.bypassedFields) ? aircraft.bypassedFields : []
  };
}

/**
 * Couleur d'affichage selon le %.
 *  - ≥ 90 : vert
 *  - ≥ 70 : jaune
 *  - ≥ 50 : orange
 *  - < 50 : rouge
 */
export function getCompletionColor(percentage) {
  if (percentage >= 90) return '#16a34a'; // green-600
  if (percentage >= 70) return '#ca8a04'; // yellow-600
  if (percentage >= 50) return '#ea580c'; // orange-600
  return '#dc2626';                        // red-600
}

/**
 * Couleur pour un niveau de criticité.
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case 'CRITICAL': return '#dc2626'; // rouge
    case 'REQUIRED': return '#ea580c'; // orange
    case 'OPTIONAL': return '#6b7280'; // gris
    default:         return '#6b7280';
  }
}
