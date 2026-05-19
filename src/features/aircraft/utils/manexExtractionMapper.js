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
  // ═══ IDENTIFICATION ═══
  { aircraftPath: 'model',                 src: ['aircraft_identification', 'model'],         type: 'string', label: 'Modèle (type avion)' },
  { aircraftPath: 'registration',          src: ['aircraft_identification', 'registration'],  type: 'string', label: 'Immatriculation' },
  { aircraftPath: 'serialNumber',          src: ['aircraft_identification', 'serial_number'], type: 'string', label: 'Numéro de série (MSN)' },
  { aircraftPath: 'manufacturer',          src: ['aircraft_identification', 'manufacturer'],  type: 'string', label: 'Constructeur' },
  { aircraftPath: 'yearOfConstruction',    src: ['aircraft_identification', 'year_of_construction'], type: 'string', label: 'Année de fabrication' },
  { aircraftPath: 'manexEdition',          src: ['aircraft_identification', 'manex_edition'], type: 'string', label: 'Édition MANEX' },
  { aircraftPath: 'manexDate',             src: ['aircraft_identification', 'manex_date'],    type: 'string', label: 'Date MANEX' },

  // ═══ CERTIFICATION ═══
  { aircraftPath: 'certification.basis',         src: ['certification', 'certification_basis'],     type: 'string', label: 'Base de certification' },
  { aircraftPath: 'certification.category',      src: ['certification', 'aircraft_category'],       type: 'string', label: 'Catégorie (Normal/Utility/Aerobatic)' },
  { aircraftPath: 'certification.ifrCertified',  src: ['certification', 'ifr_certified'],           type: 'string', label: 'Certifié IFR' },
  { aircraftPath: 'certification.icingCertified',src: ['certification', 'icing_certified'],         type: 'string', label: 'Vol givrant autorisé' },
  { aircraftPath: 'maxSeats',                    src: ['certification', 'max_seats'],               type: 'number', label: 'Sièges max (pilote inclus)' },
  { aircraftPath: 'maxPersonsOnBoard',           src: ['certification', 'max_pob'],                 type: 'number', label: 'Personnes max à bord' },
  { aircraftPath: 'wakeTurbulenceCategory',      src: ['certification', 'wake_turbulence_category'], type: 'string', label: 'Catégorie turbulence ICAO (L/M/H)' },

  // ═══ MOTEUR ═══
  { aircraftPath: 'engineType',                  src: ['engine', 'type'],          type: 'string', label: 'Type moteur' },
  { aircraftPath: 'engine.manufacturer',         src: ['engine', 'manufacturer'],  type: 'string', label: 'Constructeur moteur' },
  { aircraftPath: 'engine.count',                src: ['engine', 'count'],         type: 'number', label: 'Nombre de moteurs' },
  { aircraftPath: 'engine.powerMax',             src: ['engine', 'power_max'],     type: 'string', label: 'Puissance max (avec unité)' },
  { aircraftPath: 'engine.powerCruise',          src: ['engine', 'power_cruise'],  type: 'string', label: 'Puissance croisière' },
  { aircraftPath: 'engine.rpmMax',               src: ['engine', 'rpm_max'],       type: 'number', label: 'RPM max' },
  { aircraftPath: 'engine.rpmIdle',              src: ['engine', 'rpm_idle'],      type: 'number', label: 'RPM ralenti' },
  { aircraftPath: 'engine.oilPressureMin',       src: ['engine', 'oil_pressure_min'], type: 'string', label: 'Pression huile min' },
  { aircraftPath: 'engine.oilPressureMax',       src: ['engine', 'oil_pressure_max'], type: 'string', label: 'Pression huile max' },
  { aircraftPath: 'engine.oilTempMax',           src: ['engine', 'oil_temp_max'],  type: 'string', label: 'Temp huile max' },
  { aircraftPath: 'engine.chtMax',               src: ['engine', 'cht_max'],       type: 'string', label: 'CHT max (têtes cylindres)' },

  // ═══ HÉLICE ═══
  { aircraftPath: 'propeller.type',              src: ['propeller', 'type'],         type: 'string', label: 'Hélice — type' },
  { aircraftPath: 'propeller.manufacturer',      src: ['propeller', 'manufacturer'], type: 'string', label: 'Hélice — constructeur' },
  { aircraftPath: 'propeller.diameter',          src: ['propeller', 'diameter'],     type: 'string', label: 'Hélice — diamètre' },
  { aircraftPath: 'propeller.bladeCount',        src: ['propeller', 'blade_count'],  type: 'number', label: 'Hélice — nombre de pales' },
  { aircraftPath: 'propeller.pitchType',         src: ['propeller', 'pitch_type'],   type: 'string', label: 'Hélice — type de pas' },

  // ═══ POIDS (storage = kg) ═══
  { aircraftPath: 'weights.emptyWeight',         src: ['weights', 'empty_weight'],        category: 'weight', targetUnit: 'kg', label: 'Masse à vide (BEW)' },
  { aircraftPath: 'weights.rampWeight',          src: ['weights', 'ramp_weight'],         category: 'weight', targetUnit: 'kg', label: 'Masse rampe max' },
  { aircraftPath: 'weights.mtow',                src: ['weights', 'mtow'],                category: 'weight', targetUnit: 'kg', label: 'MTOW (masse max décollage)' },
  { aircraftPath: 'weights.mlw',                 src: ['weights', 'mlw'],                 category: 'weight', targetUnit: 'kg', label: 'MLW (max landing weight)' },
  { aircraftPath: 'weights.mzfw',                src: ['weights', 'mzfw'],                category: 'weight', targetUnit: 'kg', label: 'MZFW (max zero fuel weight)' },
  { aircraftPath: 'weights.minTakeoffWeight',    src: ['weights', 'min_takeoff_weight'],  category: 'weight', targetUnit: 'kg', label: 'Masse min décollage' },
  { aircraftPath: 'weights.maxPayload',          src: ['weights', 'max_payload'],         category: 'weight', targetUnit: 'kg', label: 'Charge utile max' },
  { aircraftPath: 'weights.usefulLoad',          src: ['weights', 'useful_load'],         category: 'weight', targetUnit: 'kg', label: 'Useful load (MTOW − BEW)' },
  { aircraftPath: 'weights.maxBaggageFwd',       src: ['weights', 'max_baggage_fwd'],     category: 'weight', targetUnit: 'kg', label: 'Bagages avant max' },
  { aircraftPath: 'weights.maxBaggageAft',       src: ['weights', 'max_baggage_aft'],     category: 'weight', targetUnit: 'kg', label: 'Bagages arrière max' },

  // ═══ BRAS DE LEVIER (storage = cm pour FR) ═══
  { aircraftPath: 'arms.empty',          src: ['arms', 'empty_cg_arm'],     category: 'armLength', targetUnit: 'cm', label: 'Bras CG à vide' },
  { aircraftPath: 'arms.frontSeats',     src: ['arms', 'front_seats_arm'],  category: 'armLength', targetUnit: 'cm', label: 'Bras sièges avant' },
  { aircraftPath: 'arms.rearSeats',      src: ['arms', 'rear_seats_arm'],   category: 'armLength', targetUnit: 'cm', label: 'Bras sièges arrière' },
  { aircraftPath: 'arms.fuelMain',       src: ['arms', 'fuel_main_arm'],    category: 'armLength', targetUnit: 'cm', label: 'Bras carburant' },
  { aircraftPath: 'arms.baggageFwd',     src: ['arms', 'baggage_fwd_arm'],  category: 'armLength', targetUnit: 'cm', label: 'Bras bagages avant' },
  { aircraftPath: 'arms.baggageAft',     src: ['arms', 'baggage_aft_arm'],  category: 'armLength', targetUnit: 'cm', label: 'Bras bagages arrière' },
  { aircraftPath: 'cgLimits.forward',    src: ['arms', 'cg_forward_limit'], category: 'armLength', targetUnit: 'cm', label: 'CG limite avant' },
  { aircraftPath: 'cgLimits.aft',        src: ['arms', 'cg_aft_limit'],     category: 'armLength', targetUnit: 'cm', label: 'CG limite arrière' },
  { aircraftPath: 'arms.datumReference', src: ['arms', 'datum_reference'],  type: 'string',                          label: 'Référence du datum' },

  // ═══ LIMITES G ═══
  { aircraftPath: 'gLimits.maxPositiveNormal',     src: ['g_limits', 'max_positive_g_normal'],    type: 'number', label: 'G max + (Normal)' },
  { aircraftPath: 'gLimits.maxNegativeNormal',     src: ['g_limits', 'max_negative_g_normal'],    type: 'number', label: 'G max − (Normal)' },
  { aircraftPath: 'gLimits.maxPositiveUtility',    src: ['g_limits', 'max_positive_g_utility'],   type: 'number', label: 'G max + (Utility)' },
  { aircraftPath: 'gLimits.maxNegativeUtility',    src: ['g_limits', 'max_negative_g_utility'],   type: 'number', label: 'G max − (Utility)' },
  { aircraftPath: 'gLimits.maxPositiveAerobatic',  src: ['g_limits', 'max_positive_g_aerobatic'], type: 'number', label: 'G max + (Aerobatic)' },
  { aircraftPath: 'gLimits.maxNegativeAerobatic',  src: ['g_limits', 'max_negative_g_aerobatic'], type: 'number', label: 'G max − (Aerobatic)' },

  // ═══ VITESSES (storage = kt) ═══
  { aircraftPath: 'speeds.vso',          src: ['speeds', 'vso'],          category: 'speed', targetUnit: 'kt', label: 'VSO (stall flaps LDG)' },
  { aircraftPath: 'speeds.vs1',          src: ['speeds', 'vs1'],          category: 'speed', targetUnit: 'kt', label: 'VS1 (stall clean)' },
  { aircraftPath: 'speeds.vfe',          src: ['speeds', 'vfe'],          category: 'speed', targetUnit: 'kt', label: 'VFE' },
  { aircraftPath: 'speeds.vfeTO',        src: ['speeds', 'vfe_takeoff'],  category: 'speed', targetUnit: 'kt', label: 'VFE T/O' },
  { aircraftPath: 'speeds.vfeLdg',       src: ['speeds', 'vfe_landing'],  category: 'speed', targetUnit: 'kt', label: 'VFE LDG' },
  { aircraftPath: 'speeds.vfeApp',       src: ['speeds', 'vfe_approach'], category: 'speed', targetUnit: 'kt', label: 'VFE APP' },
  { aircraftPath: 'speeds.vno',          src: ['speeds', 'vno'],          category: 'speed', targetUnit: 'kt', label: 'VNO' },
  { aircraftPath: 'speeds.vne',          src: ['speeds', 'vne'],          category: 'speed', targetUnit: 'kt', label: 'VNE' },
  { aircraftPath: 'speeds.vr',           src: ['speeds', 'vr'],           category: 'speed', targetUnit: 'kt', label: 'VR (rotation)' },
  { aircraftPath: 'speeds.vx',           src: ['speeds', 'vx'],           category: 'speed', targetUnit: 'kt', label: 'VX (best angle climb)' },
  { aircraftPath: 'speeds.vy',           src: ['speeds', 'vy'],           category: 'speed', targetUnit: 'kt', label: 'VY (best rate climb)' },
  { aircraftPath: 'speeds.vxTO',         src: ['speeds', 'vx_takeoff'],   category: 'speed', targetUnit: 'kt', label: 'VX T/O' },
  { aircraftPath: 'speeds.vyTO',         src: ['speeds', 'vy_takeoff'],   category: 'speed', targetUnit: 'kt', label: 'VY T/O' },
  { aircraftPath: 'speeds.vapp',         src: ['speeds', 'vapp'],         category: 'speed', targetUnit: 'kt', label: 'VAPP (approche)' },
  { aircraftPath: 'speeds.vref',         src: ['speeds', 'vref'],         category: 'speed', targetUnit: 'kt', label: 'VREF (ref atterrissage)' },
  { aircraftPath: 'speeds.vglide',       src: ['speeds', 'vglide'],       category: 'speed', targetUnit: 'kt', label: 'V finesse (best glide)' },
  { aircraftPath: 'speeds.vle',          src: ['speeds', 'vle'],          category: 'speed', targetUnit: 'kt', label: 'VLE (gear extended)' },
  { aircraftPath: 'speeds.vlo',          src: ['speeds', 'vlo'],          category: 'speed', targetUnit: 'kt', label: 'VLO (gear operating)' },
  { aircraftPath: 'speeds.va',           src: ['speeds', 'va'],           category: 'speed', targetUnit: 'kt', label: 'VA (manoeuvre)' },
  { aircraftPath: 'speeds.initialClimb', src: ['speeds', 'initial_climb_rate'], category: 'climbRate', targetUnit: 'ft/min', label: 'Taux montée initial' },

  // ═══ CARBURANT (storage = ltr pour capa, lph pour conso) ═══
  { aircraftPath: 'fuelCapacity',           src: ['fuel', 'capacity_total'],   category: 'fuel',            targetUnit: 'ltr', label: 'Capacité totale carburant' },
  { aircraftPath: 'fuelCapacityUsable',     src: ['fuel', 'capacity_usable'],  category: 'fuel',            targetUnit: 'ltr', label: 'Capacité utilisable' },
  { aircraftPath: 'fuelCapacityUnusable',   src: ['fuel', 'capacity_unusable'],category: 'fuel',            targetUnit: 'ltr', label: 'Capacité non-utilisable' },
  { aircraftPath: 'fuelType',               src: ['fuel', 'fuel_type'],        type: 'string',                                  label: 'Type carburant (principal)' },
  { aircraftPath: 'fuelGradesAllowed',      src: ['fuel', 'fuel_grades_allowed'], type: 'string',                              label: 'Carburants alternatifs autorisés' },
  { aircraftPath: 'fuelConsumption',        src: ['fuel', 'consumption_cruise'], category: 'fuelConsumption', targetUnit: 'lph', label: 'Conso croisière' },
  { aircraftPath: 'fuelConsumptionTaxi',    src: ['fuel', 'consumption_taxi'],   category: 'fuelConsumption', targetUnit: 'lph', label: 'Conso roulage' },
  { aircraftPath: 'fuelConsumptionClimb',   src: ['fuel', 'consumption_takeoff_climb'], category: 'fuelConsumption', targetUnit: 'lph', label: 'Conso décollage/montée' },

  // ═══ LIMITES VENT ═══
  { aircraftPath: 'windLimits.maxCrosswind',    src: ['wind_limits', 'max_crosswind'],     category: 'speed', targetUnit: 'kt', label: 'Vent traversier max démontré' },
  { aircraftPath: 'windLimits.maxTailwind',     src: ['wind_limits', 'max_tailwind'],      category: 'speed', targetUnit: 'kt', label: 'Vent arrière max' },
  { aircraftPath: 'windLimits.maxCrosswindWet', src: ['wind_limits', 'max_crosswind_wet'], category: 'speed', targetUnit: 'kt', label: 'Travers max piste mouillée' },

  // ═══ PERFORMANCES SYNTHÉTIQUES ═══
  { aircraftPath: 'cruiseSpeedKt',          src: ['performance_summary', 'cruise_speed_75percent'], category: 'speed',  targetUnit: 'kt',  label: 'Vitesse croisière 75%' },
  { aircraftPath: 'cruiseSpeedMaxKt',       src: ['performance_summary', 'cruise_speed_max'],       category: 'speed',  targetUnit: 'kt',  label: 'Vitesse croisière max' },
  { aircraftPath: 'serviceCeiling',         src: ['performance_summary', 'service_ceiling'],        category: 'altitude', targetUnit: 'ft', label: 'Plafond pratique' },
  { aircraftPath: 'maxOperatingAltitude',   src: ['performance_summary', 'max_operating_altitude'], category: 'altitude', targetUnit: 'ft', label: 'Plafond opérationnel' },
  { aircraftPath: 'takeoffRun',             src: ['performance_summary', 'takeoff_run'],            type: 'string',                          label: 'Distance roulage décollage' },
  { aircraftPath: 'takeoffDistance50ft',    src: ['performance_summary', 'takeoff_distance_50ft'],  type: 'string',                          label: 'Distance décollage 50ft' },
  { aircraftPath: 'landingRun',             src: ['performance_summary', 'landing_run'],            type: 'string',                          label: 'Distance roulage atterrissage' },
  { aircraftPath: 'landingDistance50ft',    src: ['performance_summary', 'landing_distance_50ft'],  type: 'string',                          label: 'Distance atterrissage 50ft' },
  { aircraftPath: 'endurance',              src: ['performance_summary', 'endurance'],              type: 'string',                          label: 'Autonomie' },
  { aircraftPath: 'rangeCruise',            src: ['performance_summary', 'range_cruise'],           type: 'string',                          label: 'Distance franchissable' },

  // ═══ TRAIN ═══
  { aircraftPath: 'landingGear.type',                src: ['landing_gear', 'type'],                type: 'string', label: 'Type de train' },
  { aircraftPath: 'landingGear.tirePressureMain',    src: ['landing_gear', 'tire_pressure_main'],  type: 'string', label: 'Pression pneus principal' },
  { aircraftPath: 'landingGear.tirePressureNose',    src: ['landing_gear', 'tire_pressure_nose'],  type: 'string', label: 'Pression pneu avant' },

  // ═══ COMPATIBILITÉ PISTE ═══
  { aircraftPath: 'compatibleRunwaySurfaces',  src: ['compatibility', 'runway_surfaces'],   type: 'string', label: 'Revêtements compatibles' },
  { aircraftPath: 'minRunwayLength',           src: ['compatibility', 'min_runway_length'], type: 'string', label: 'Longueur piste min' }
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
