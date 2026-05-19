// src/features/aircraft/utils/manexExtractionMapper.js
//
// Transforme le JSON retourné par manexExtractionService (schéma snake_case,
// unités telles que lues dans le MANEX) vers le format `aircraftData` du wizard
// (schéma camelCase, unités STORAGE : kg, L, L/h, kt, ft, inches/cm).
//
// IMPORTANT : la conversion d'unité se fait ICI, à l'import. Les valeurs entrant
// dans le store sont déjà en unités storage — ne pas re-convertir plus tard.

import { convertValue } from '@utils/unitConversions';

// Normalise une unité textuelle ("LBS", "lbs.", "kgs") vers le code interne.
function normalizeUnit(rawUnit, category) {
  if (!rawUnit) return null;
  const u = String(rawUnit).toLowerCase().replace(/\.|\s/g, '');

  if (category === 'weight') {
    if (['lb', 'lbs', 'pound', 'pounds'].includes(u)) return 'lbs';
    if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  }
  if (category === 'speed') {
    if (['kt', 'kts', 'knot', 'knots', 'kias', 'ktas'].includes(u)) return 'kt';
    if (['mph', 'milesperhour'].includes(u)) return 'mph';
    if (['kmh', 'kph', 'km/h'].includes(u)) return 'kmh';
  }
  if (category === 'fuel') {
    if (['l', 'liter', 'liters', 'litre', 'litres', 'ltr'].includes(u)) return 'ltr';
    if (['gal', 'gallon', 'gallons', 'usgal'].includes(u)) return 'gal';
    if (['kg', 'kilogram'].includes(u)) return 'kg';
  }
  if (category === 'fuelConsumption') {
    if (['l/h', 'lph', 'lhour', 'literperhour'].includes(u)) return 'lph';
    if (['gal/h', 'gph', 'galperhour'].includes(u)) return 'gph';
  }
  if (category === 'armLength') {
    if (['in', 'inch', 'inches', '"'].includes(u)) return 'in';
    if (['cm', 'centimeter', 'centimeters'].includes(u)) return 'cm';
    if (['mm'].includes(u)) return 'mm';
    if (['m', 'meter', 'meters'].includes(u)) return 'm';
  }
  if (category === 'altitude') {
    if (['ft', 'feet', 'foot'].includes(u)) return 'ft';
    if (['m', 'meter', 'meters'].includes(u)) return 'm';
  }
  if (category === 'climbRate') {
    if (['ft/min', 'fpm', 'feet/min'].includes(u)) return 'ft/min';
    if (['m/s', 'mps'].includes(u)) return 'm/s';
  }

  return null;
}

// Convertit `value` vers `targetUnit` (unité STORAGE) depuis l'unité IA brute.
function convertToStorage(value, rawUnit, category, targetUnit) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!isFinite(num)) return null;

  const normalizedFrom = normalizeUnit(rawUnit, category);

  // Si l'unité source n'est pas reconnue, on suppose qu'elle est déjà en storage.
  // Cas typique : le MANEX français en kg pour un user en kg → pas de conversion.
  if (!normalizedFrom || normalizedFrom === targetUnit) {
    return num;
  }

  try {
    return convertValue(num, normalizedFrom, targetUnit, category);
  } catch (e) {
    console.warn('[manexExtractionMapper] Conversion échouée', { value, rawUnit, category, targetUnit, error: e.message });
    return num;
  }
}

// Mapping plat : { aircraftPath, sourceSection, sourceKey, category, targetUnit, label }
// Chaque entrée décrit comment un champ extrait par l'IA est routé dans le wizard.
const FIELD_MAPPINGS = [
  // Identification
  { aircraftPath: 'model',                 src: ['aircraft_identification', 'model'],        type: 'string', label: 'Modèle' },
  { aircraftPath: 'manufacturer',          src: ['aircraft_identification', 'manufacturer'], type: 'string', label: 'Constructeur' },

  // Poids (storage = kg)
  { aircraftPath: 'weights.emptyWeight',         src: ['weights', 'empty_weight'],        category: 'weight', targetUnit: 'kg', label: 'Masse à vide' },
  { aircraftPath: 'weights.mtow',                src: ['weights', 'mtow'],                category: 'weight', targetUnit: 'kg', label: 'MTOW' },
  { aircraftPath: 'weights.mlw',                 src: ['weights', 'mlw'],                 category: 'weight', targetUnit: 'kg', label: 'MLW (max landing weight)' },
  { aircraftPath: 'weights.minTakeoffWeight',    src: ['weights', 'min_takeoff_weight'],  category: 'weight', targetUnit: 'kg', label: 'Masse min décollage' },
  { aircraftPath: 'weights.maxPayload',          src: ['weights', 'max_payload'],         category: 'weight', targetUnit: 'kg', label: 'Charge utile max' },
  { aircraftPath: 'weights.maxBaggageFwd',       src: ['weights', 'max_baggage_fwd'],     category: 'weight', targetUnit: 'kg', label: 'Bagages avant max' },
  { aircraftPath: 'weights.maxBaggageAft',       src: ['weights', 'max_baggage_aft'],     category: 'weight', targetUnit: 'kg', label: 'Bagages arrière max' },

  // Bras de levier (storage = m, mais on accepte aussi inches selon l'avion)
  // Note : on convertit vers cm par défaut pour rester compatible avec le wizard FR
  { aircraftPath: 'arms.empty',          src: ['arms', 'empty_cg_arm'],     category: 'armLength', targetUnit: 'cm', label: 'Bras CG à vide' },
  { aircraftPath: 'arms.frontSeats',     src: ['arms', 'front_seats_arm'],  category: 'armLength', targetUnit: 'cm', label: 'Bras sièges avant' },
  { aircraftPath: 'arms.rearSeats',      src: ['arms', 'rear_seats_arm'],   category: 'armLength', targetUnit: 'cm', label: 'Bras sièges arrière' },
  { aircraftPath: 'arms.fuelMain',       src: ['arms', 'fuel_main_arm'],    category: 'armLength', targetUnit: 'cm', label: 'Bras carburant' },
  { aircraftPath: 'arms.baggageFwd',     src: ['arms', 'baggage_fwd_arm'],  category: 'armLength', targetUnit: 'cm', label: 'Bras bagages avant' },
  { aircraftPath: 'arms.baggageAft',     src: ['arms', 'baggage_aft_arm'],  category: 'armLength', targetUnit: 'cm', label: 'Bras bagages arrière' },
  { aircraftPath: 'cgLimits.forward',    src: ['arms', 'cg_forward_limit'], category: 'armLength', targetUnit: 'cm', label: 'CG limite avant' },
  { aircraftPath: 'cgLimits.aft',        src: ['arms', 'cg_aft_limit'],     category: 'armLength', targetUnit: 'cm', label: 'CG limite arrière' },

  // Vitesses (storage = kt)
  { aircraftPath: 'speeds.vso',          src: ['speeds', 'vso'],          category: 'speed', targetUnit: 'kt', label: 'VSO' },
  { aircraftPath: 'speeds.vs1',          src: ['speeds', 'vs1'],          category: 'speed', targetUnit: 'kt', label: 'VS1' },
  { aircraftPath: 'speeds.vfe',          src: ['speeds', 'vfe'],          category: 'speed', targetUnit: 'kt', label: 'VFE' },
  { aircraftPath: 'speeds.vfeTO',        src: ['speeds', 'vfe_takeoff'],  category: 'speed', targetUnit: 'kt', label: 'VFE T/O' },
  { aircraftPath: 'speeds.vfeLdg',       src: ['speeds', 'vfe_landing'],  category: 'speed', targetUnit: 'kt', label: 'VFE LDG' },
  { aircraftPath: 'speeds.vno',          src: ['speeds', 'vno'],          category: 'speed', targetUnit: 'kt', label: 'VNO' },
  { aircraftPath: 'speeds.vne',          src: ['speeds', 'vne'],          category: 'speed', targetUnit: 'kt', label: 'VNE' },
  { aircraftPath: 'speeds.vr',           src: ['speeds', 'vr'],           category: 'speed', targetUnit: 'kt', label: 'VR (rotation)' },
  { aircraftPath: 'speeds.vx',           src: ['speeds', 'vx'],           category: 'speed', targetUnit: 'kt', label: 'VX' },
  { aircraftPath: 'speeds.vy',           src: ['speeds', 'vy'],           category: 'speed', targetUnit: 'kt', label: 'VY' },
  { aircraftPath: 'speeds.vapp',         src: ['speeds', 'vapp'],         category: 'speed', targetUnit: 'kt', label: 'VAPP' },
  { aircraftPath: 'speeds.vglide',       src: ['speeds', 'vglide'],       category: 'speed', targetUnit: 'kt', label: 'V finesse' },
  { aircraftPath: 'speeds.vle',          src: ['speeds', 'vle'],          category: 'speed', targetUnit: 'kt', label: 'VLE' },
  { aircraftPath: 'speeds.vlo',          src: ['speeds', 'vlo'],          category: 'speed', targetUnit: 'kt', label: 'VLO' },
  { aircraftPath: 'speeds.va',           src: ['speeds', 'va'],           category: 'speed', targetUnit: 'kt', label: 'VA (manoeuvre)' },
  { aircraftPath: 'speeds.initialClimb', src: ['speeds', 'initial_climb_rate'], category: 'speed', targetUnit: 'kt', label: 'Vitesse montée initiale' },

  // Carburant (storage = ltr pour capacité, lph pour conso)
  { aircraftPath: 'fuelCapacity',        src: ['fuel', 'capacity_total'],  category: 'fuel',            targetUnit: 'ltr', label: 'Capacité totale carburant' },
  { aircraftPath: 'fuelConsumption',     src: ['fuel', 'consumption_cruise'], category: 'fuelConsumption', targetUnit: 'lph', label: 'Consommation croisière' },
  { aircraftPath: 'fuelType',            src: ['fuel', 'fuel_type'],       type: 'string',                                  label: 'Type carburant' },

  // Limites vent (kt)
  { aircraftPath: 'windLimits.maxCrosswind',    src: ['wind_limits', 'max_crosswind'],     category: 'speed', targetUnit: 'kt', label: 'Vent traversier max' },
  { aircraftPath: 'windLimits.maxTailwind',     src: ['wind_limits', 'max_tailwind'],      category: 'speed', targetUnit: 'kt', label: 'Vent arrière max' },
  { aircraftPath: 'windLimits.maxCrosswindWet', src: ['wind_limits', 'max_crosswind_wet'], category: 'speed', targetUnit: 'kt', label: 'Vent traversier max piste mouillée' },

  // Croisière (kt)
  { aircraftPath: 'cruiseSpeedKt',       src: ['performance_summary', 'cruise_speed_75percent'], category: 'speed', targetUnit: 'kt', label: 'Vitesse croisière 75%' }
];

/**
 * Transforme la sortie d'extraction MANEX en une liste plate de TOUS les champs
 * du schéma, prêts à valider. Les champs non extraits par l'IA sont présents
 * avec value=null, confidence=0, accepted=false — le pilote peut alors les
 * remplir manuellement avant l'import dans le wizard.
 *
 * @param {Object} extraction - Objet retourné par extractCompleteManexData
 * @returns {Array<{aircraftPath, label, value, originalValue, originalUnit, targetUnit, confidence, sourcePage, accepted, found}>}
 */
export function mapExtractionToReviewItems(extraction) {
  const items = [];
  const safeExtraction = extraction && typeof extraction === 'object' ? extraction : {};

  for (const mapping of FIELD_MAPPINGS) {
    const [section, key] = mapping.src;
    const raw = safeExtraction[section]?.[key];
    const found = !!(raw && raw.value !== undefined && raw.value !== null && raw.value !== '');

    let convertedValue = null;
    if (found) {
      if (mapping.type === 'string') {
        convertedValue = String(raw.value);
      } else if (mapping.category && mapping.targetUnit) {
        convertedValue = convertToStorage(raw.value, raw.unit, mapping.category, mapping.targetUnit);
      } else {
        convertedValue = raw.value;
      }
    }

    items.push({
      aircraftPath: mapping.aircraftPath,
      label: mapping.label,
      value: convertedValue,
      originalValue: found ? raw.value : null,
      originalUnit: found ? (raw.unit || null) : null,
      targetUnit: mapping.targetUnit || null,
      confidence: found ? (Number(raw.confidence) || 0) : 0,
      sourcePage: found ? (raw.sourcePage || null) : null,
      // Accepté par défaut si trouvé ET confiance ≥ 70. Les champs vides sont
      // exclus de l'acceptation par défaut (le pilote doit les remplir
      // manuellement et cocher accepted=true pour les importer).
      accepted: found && Number(raw.confidence) >= 70,
      found, // ← nouveau flag pour différencier "extrait" vs "manquant"
      // category + type conservés pour l'éditeur (forcer type number ou string)
      category: mapping.category || null,
      type: mapping.type || null
    });
  }

  return items;
}

/**
 * Transforme la liste validée par l'utilisateur en un objet à passer à `updateDataBulk`.
 * Reconstruit la structure imbriquée (speeds.vso, weights.emptyWeight, etc.).
 *
 * @param {Array} reviewItems - Items dont `accepted === true` seulement.
 * @returns {Object} - Objet plat avec clés top-level imbriquées prêtes pour updateDataBulk.
 */
export function buildBulkUpdatePayload(reviewItems) {
  const accepted = reviewItems.filter(it => it.accepted && it.value !== null && it.value !== undefined);
  const payload = {};

  for (const item of accepted) {
    const parts = item.aircraftPath.split('.');
    if (parts.length === 1) {
      payload[parts[0]] = item.value;
    } else {
      // ex: speeds.vso → payload.speeds = { ...payload.speeds, vso: value }
      const [top, ...rest] = parts;
      payload[top] = payload[top] || {};
      let cursor = payload[top];
      for (let i = 0; i < rest.length - 1; i++) {
        cursor[rest[i]] = cursor[rest[i]] || {};
        cursor = cursor[rest[i]];
      }
      cursor[rest[rest.length - 1]] = item.value;
    }
  }

  return payload;
}
