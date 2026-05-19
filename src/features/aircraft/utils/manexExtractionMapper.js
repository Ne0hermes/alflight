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

// Mapping STRICT : chaque entrée correspond à un champ effectivement saisi
// dans le wizard de création d'avion (Step1/Step2/Step3). Tout champ qui
// n'est pas écrit via updateData(path, ...) dans un des steps a été retiré.
//
// Audit du wizard (à jour avec la refonte) :
//   - Step1 : registration, model, engineType, wakeTurbulenceCategory,
//             fuelType, fuelCapacity, fuelConsumption, cruiseSpeedKt,
//             compatibleRunwaySurfaces
//   - Step2 : speeds.{vso, vs1, vfeLdg, vfeTO, vno, vne, vr, vx, vy, vapp,
//             initialClimb, vglide, vle, vlo}, speeds.voRanges, windLimits.limits
//   - Step3 : weights.{emptyWeight, mtow, mlw, mzfw, minTakeoffWeight},
//             arms.{empty, frontSeats, rearSeats, fuelMain},
//             cgEnvelope.{forwardPoints, aftMinWeight, aftMaxWeight, aftCG}
//
// Pour les structures complexes (arrays type voRanges, windLimits.limits,
// cgEnvelope.forwardPoints) le mapping de base extrait des valeurs scalaires
// que buildBulkUpdatePayload assemblera ensuite.
const FIELD_MAPPINGS = [
  // ═══ IDENTIFICATION (Step1) ═══
  { aircraftPath: 'model',                 src: ['aircraft_identification', 'model'],         type: 'string', label: 'Modèle (type avion)' },
  { aircraftPath: 'registration',          src: ['aircraft_identification', 'registration'],  type: 'string', label: 'Immatriculation' },

  // ═══ MOTORISATION (Step1) ═══
  // engineType : ENUM strict du wizard
  {
    aircraftPath: 'engineType',
    src: ['engine', 'type_category'],
    type: 'enum',
    label: 'Type moteur',
    options: [
      { value: 'singleEngine', label: 'Monomoteur thermique (single)' },
      { value: 'twinEngine',   label: 'Bimoteur thermique (twin)' },
      { value: 'turboprop',    label: 'Turbopropulseur (turboprop)' },
      { value: 'jet',          label: 'Jet (turbofan/turbojet)' }
    ]
  },

  // ═══ CATÉGORIE TURBULENCE (Step1) ═══
  // L (Light < 7000 kg) | M (Medium 7-136 t) | H (Heavy > 136 t) | S (Super)
  {
    aircraftPath: 'wakeTurbulenceCategory',
    src: ['certification', 'wake_turbulence_category'],
    type: 'enum',
    label: 'Catégorie turbulence ICAO',
    options: [
      { value: 'L', label: 'L — Light (< 7 t)' },
      { value: 'M', label: 'M — Medium (7–136 t)' },
      { value: 'H', label: 'H — Heavy (> 136 t)' },
      { value: 'S', label: 'S — Super (A380)' }
    ]
  },

  // ═══ CARBURANT (Step1) ═══
  {
    aircraftPath: 'fuelType',
    src: ['fuel', 'fuel_type'],
    type: 'enum',
    label: 'Type carburant',
    options: [
      { value: 'AVGAS',  label: 'AVGAS 100LL' },
      { value: 'JET-A1', label: 'JET A-1 (kérosène)' },
      { value: 'MOGAS',  label: 'MOGAS (UL91, essence auto)' }
    ]
  },
  { aircraftPath: 'fuelCapacity',           src: ['fuel', 'capacity_total'],     category: 'fuel',            targetUnit: 'ltr',           label: 'Capacité totale carburant' },
  { aircraftPath: 'fuelConsumption',        src: ['fuel', 'consumption_cruise'], category: 'fuelConsumption', targetUnit: 'lph',           label: 'Conso croisière' },

  // ═══ COMPATIBILITÉ PISTE (Step1) ═══
  // Array d'ENUMs (multi-select)
  {
    aircraftPath: 'compatibleRunwaySurfaces',
    src: ['compatibility', 'runway_surfaces'],
    type: 'enum_multi',
    label: 'Revêtements compatibles (multi)',
    options: [
      { value: 'ASPH',    label: 'Asphalte (ASPH)' },
      { value: 'CONC',    label: 'Béton (CONC)' },
      { value: 'GRASS',   label: 'Herbe (GRASS)' },
      { value: 'GRVL',    label: 'Gravier (GRVL)' },
      { value: 'UNPAVED', label: 'Non revêtu / terre (UNPAVED)' },
      { value: 'SAND',    label: 'Sable (SAND)' },
      { value: 'SNOW',    label: 'Neige (SNOW)' },
      { value: 'WATER',   label: 'Eau (WATER)' }
    ]
  },

  // ═══ VITESSES (Step2 — storage = kt) ═══
  // Critiques (saisies obligatoirement dans Step2)
  { aircraftPath: 'speeds.vso',          src: ['speeds', 'vso'],          category: 'speed', targetUnit: 'kt', label: 'VSO (stall flaps LDG)' },
  { aircraftPath: 'speeds.vs1',          src: ['speeds', 'vs1'],          category: 'speed', targetUnit: 'kt', label: 'VS1 (stall clean)' },
  { aircraftPath: 'speeds.vfeTO',        src: ['speeds', 'vfe_takeoff'],  category: 'speed', targetUnit: 'kt', label: 'VFE T/O' },
  { aircraftPath: 'speeds.vfeLdg',       src: ['speeds', 'vfe_landing'],  category: 'speed', targetUnit: 'kt', label: 'VFE LDG' },
  { aircraftPath: 'speeds.vno',          src: ['speeds', 'vno'],          category: 'speed', targetUnit: 'kt', label: 'VNO' },
  { aircraftPath: 'speeds.vne',          src: ['speeds', 'vne'],          category: 'speed', targetUnit: 'kt', label: 'VNE' },
  // Optionnelles (panel "Vitesses optionnelles" du wizard)
  { aircraftPath: 'speeds.vr',           src: ['speeds', 'vr'],           category: 'speed', targetUnit: 'kt', label: 'VR (rotation)' },
  { aircraftPath: 'speeds.vx',           src: ['speeds', 'vx'],           category: 'speed', targetUnit: 'kt', label: 'VX (best angle climb)' },
  { aircraftPath: 'speeds.vy',           src: ['speeds', 'vy'],           category: 'speed', targetUnit: 'kt', label: 'VY (best rate climb)' },
  { aircraftPath: 'speeds.vapp',         src: ['speeds', 'vapp'],         category: 'speed', targetUnit: 'kt', label: 'VAPP (approche)' },
  { aircraftPath: 'speeds.initialClimb', src: ['speeds', 'initial_climb_rate'], category: 'climbRate', targetUnit: 'ft/min', label: 'Taux montée initial' },
  { aircraftPath: 'speeds.vglide',       src: ['speeds', 'vglide'],       category: 'speed', targetUnit: 'kt', label: 'V finesse (best glide)' },
  { aircraftPath: 'speeds.vle',          src: ['speeds', 'vle'],          category: 'speed', targetUnit: 'kt', label: 'VLE (gear extended)' },
  { aircraftPath: 'speeds.vlo',          src: ['speeds', 'vlo'],          category: 'speed', targetUnit: 'kt', label: 'VLO (gear operating)' },

  // ═══ LIMITES VENT (Step2 — array windLimits.limits) ═══
  // Stockage final : windLimits.limits = array d'objets {type, value, saved}.
  // Le mapping plat capture les valeurs scalaires ; buildBulkUpdatePayload
  // assemble l'array final.
  { aircraftPath: '_windLimit:maxCrosswind',    src: ['wind_limits', 'max_crosswind'],     category: 'speed', targetUnit: 'kt', label: 'Vent traversier max démontré' },
  { aircraftPath: '_windLimit:maxTailwind',     src: ['wind_limits', 'max_tailwind'],      category: 'speed', targetUnit: 'kt', label: 'Vent arrière max' },
  { aircraftPath: '_windLimit:maxCrosswindWet', src: ['wind_limits', 'max_crosswind_wet'], category: 'speed', targetUnit: 'kt', label: 'Travers max piste mouillée' },

  // ═══ POIDS (Step3 — storage = kg) ═══
  { aircraftPath: 'weights.emptyWeight',         src: ['weights', 'empty_weight'],        category: 'weight', targetUnit: 'kg', label: 'Masse à vide (BEW)' },
  { aircraftPath: 'weights.mtow',                src: ['weights', 'mtow'],                category: 'weight', targetUnit: 'kg', label: 'MTOW (masse max décollage)' },
  { aircraftPath: 'weights.mlw',                 src: ['weights', 'mlw'],                 category: 'weight', targetUnit: 'kg', label: 'MLW (max landing weight)' },
  { aircraftPath: 'weights.mzfw',                src: ['weights', 'mzfw'],                category: 'weight', targetUnit: 'kg', label: 'MZFW (max zero fuel weight)' },
  { aircraftPath: 'weights.minTakeoffWeight',    src: ['weights', 'min_takeoff_weight'],  category: 'weight', targetUnit: 'kg', label: 'Masse min décollage' },

  // ═══ BRAS DE LEVIER (Step3 — storage = cm pour FR) ═══
  { aircraftPath: 'arms.empty',          src: ['arms', 'empty_cg_arm'],     category: 'armLength', targetUnit: 'cm', label: 'Bras CG à vide' },
  { aircraftPath: 'arms.frontSeats',     src: ['arms', 'front_seats_arm'],  category: 'armLength', targetUnit: 'cm', label: 'Bras sièges avant' },
  { aircraftPath: 'arms.rearSeats',      src: ['arms', 'rear_seats_arm'],   category: 'armLength', targetUnit: 'cm', label: 'Bras sièges arrière' },
  { aircraftPath: 'arms.fuelMain',       src: ['arms', 'fuel_main_arm'],    category: 'armLength', targetUnit: 'cm', label: 'Bras carburant' },

  // ═══ ENVELOPPE CG (Step3 — partie arrière simple) ═══
  // L'enveloppe avant (forwardPoints) est un array de points difficile à
  // extraire automatiquement → laissé au pilote dans Step3. Pour l'arrière,
  // on accepte 3 valeurs scalaires : poids min, poids max, CG.
  { aircraftPath: 'cgEnvelope.aftMinWeight', src: ['arms', 'aft_cg_min_weight'], category: 'weight',    targetUnit: 'kg', label: 'Enveloppe CG arrière — masse min' },
  { aircraftPath: 'cgEnvelope.aftMaxWeight', src: ['arms', 'aft_cg_max_weight'], category: 'weight',    targetUnit: 'kg', label: 'Enveloppe CG arrière — masse max' },
  { aircraftPath: 'cgEnvelope.aftCG',        src: ['arms', 'cg_aft_limit'],      category: 'armLength', targetUnit: 'cm', label: 'Enveloppe CG arrière — CG' }
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
      if (mapping.type === 'enum') {
        // Normaliser vers une valeur autorisée du select (matching insensible à
        // la casse et tolérant aux espaces). Si pas de match, on garde la valeur
        // brute pour que le pilote puisse la corriger manuellement.
        convertedValue = matchEnumValue(raw.value, mapping.options);
      } else if (mapping.type === 'enum_multi') {
        // CSV → array de valeurs ENUM. Mapping FR/EN → codes via matchEnumValue.
        const parts = String(raw.value).split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
        convertedValue = parts
          .map(p => matchEnumValue(p, mapping.options))
          .filter(v => v !== null);
      } else if (mapping.type === 'string' || mapping.type === 'array_csv') {
        convertedValue = String(raw.value);
      } else if (mapping.type === 'number') {
        const n = Number(raw.value);
        convertedValue = Number.isFinite(n) ? n : null;
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
      type: mapping.type || null,
      // Options de liste déroulante (pour les enum / enum_multi) — propagées
      // jusqu'à l'UI pour rendre un <select> au lieu d'un <input texte>.
      options: mapping.options || null
    });
  }

  return items;
}

/**
 * Normalise une valeur ENUM extraite par l'IA vers une option autorisée.
 * Matching tolérant : casse, accents, espaces, et synonymes courants.
 * Retourne null si aucune correspondance (le pilote devra sélectionner manuellement).
 */
function matchEnumValue(raw, options) {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(options) || options.length === 0) return String(raw);

  const normalize = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // supprime les accents
    .replace(/[\s\-_\.]/g, '');       // supprime espaces, tirets, underscores, points

  const target = normalize(raw);
  if (!target) return null;

  // 1) Match exact sur la value
  for (const opt of options) {
    if (normalize(opt.value) === target) return opt.value;
  }
  // 2) Match exact sur le label
  for (const opt of options) {
    if (normalize(opt.label) === target) return opt.value;
  }
  // 3) Match partiel : la valeur extraite contient la value ou vice versa
  for (const opt of options) {
    const v = normalize(opt.value);
    if (target.includes(v) || v.includes(target)) return opt.value;
  }
  // 4) Synonymes courants pour les surfaces (FR ↔ codes)
  const surfaceSynonyms = {
    asphalte: 'ASPH', asphalt: 'ASPH', goudron: 'ASPH', bitume: 'ASPH', tar: 'ASPH',
    beton: 'CONC', concrete: 'CONC',
    herbe: 'GRASS', gazon: 'GRASS', pelouse: 'GRASS',
    gravier: 'GRVL', gravel: 'GRVL', cailloux: 'GRVL',
    terre: 'UNPAVED', dirt: 'UNPAVED', unpaved: 'UNPAVED', nonrevetu: 'UNPAVED',
    sable: 'SAND', sand: 'SAND',
    neige: 'SNOW', snow: 'SNOW',
    eau: 'WATER', water: 'WATER'
  };
  if (surfaceSynonyms[target]) {
    const code = surfaceSynonyms[target];
    if (options.some(opt => opt.value === code)) return code;
  }
  // 5) Synonymes engine type
  const engineSynonyms = {
    monomoteur: 'singleEngine', single: 'singleEngine', singleengine: 'singleEngine', piston: 'singleEngine',
    bimoteur: 'twinEngine', twin: 'twinEngine', twoengine: 'twinEngine',
    turboprop: 'turboprop', turbopropulseur: 'turboprop', turboprope: 'turboprop',
    jet: 'jet', turbofan: 'jet', turbojet: 'jet'
  };
  if (engineSynonyms[target]) {
    const code = engineSynonyms[target];
    if (options.some(opt => opt.value === code)) return code;
  }
  // 6) Synonymes fuel
  const fuelSynonyms = {
    avgas: 'AVGAS', avgas100ll: 'AVGAS', '100ll': 'AVGAS', '100LL': 'AVGAS',
    jeta1: 'JET-A1', jeta: 'JET-A1', kerosene: 'JET-A1', kérosène: 'JET-A1', kero: 'JET-A1',
    mogas: 'MOGAS', ul91: 'MOGAS', essence: 'MOGAS', petrol: 'MOGAS', autogas: 'MOGAS'
  };
  if (fuelSynonyms[target]) {
    const code = fuelSynonyms[target];
    if (options.some(opt => opt.value === code)) return code;
  }
  // Aucun match → null. Le pilote devra sélectionner manuellement.
  return null;
}

/**
 * Transforme la liste validée par l'utilisateur en un objet à passer à `updateDataBulk`.
 * Reconstruit la structure imbriquée (speeds.vso, weights.emptyWeight, etc.).
 *
 * GÈRE DES CAS SPÉCIAUX :
 *  - `_windLimit:<type>` (pseudo-paths) → assemble en `windLimits.limits` array
 *    d'objets { type, value, saved } (format wizard Step2)
 *  - `array_csv` (compatibleRunwaySurfaces) → split CSV → array de strings
 *
 * @param {Array} reviewItems - Items dont `accepted === true` seulement.
 * @returns {Object} - Objet plat avec clés top-level imbriquées prêtes pour updateDataBulk.
 */
export function buildBulkUpdatePayload(reviewItems) {
  const accepted = reviewItems.filter(it => it.accepted && it.value !== null && it.value !== undefined && it.value !== '');
  const payload = {};
  // Accumulateur pour windLimits.limits (assemblage en array final)
  const windLimitEntries = [];

  for (const item of accepted) {
    const path = item.aircraftPath;

    // ─── Cas spécial : pseudo-paths "_windLimit:<type>" ───
    if (path.startsWith('_windLimit:')) {
      const type = path.slice('_windLimit:'.length);
      const valueNum = typeof item.value === 'number' ? item.value : parseFloat(item.value);
      if (Number.isFinite(valueNum)) {
        windLimitEntries.push({ type, value: valueNum, saved: true });
      }
      continue;
    }

    // ─── Cas spécial : array_csv (split par , / ;) ───
    let valueToWrite = item.value;
    if (item.type === 'array_csv' && typeof item.value === 'string') {
      // Normaliser : "asphalte, herbe, gravier" → ["ASPH", "GRASS", "GRVL"]
      // ou conserver les valeurs telles quelles si le wizard accepte
      valueToWrite = String(item.value)
        .split(/[,;\/]/)
        .map(s => s.trim())
        .filter(Boolean);
      // Mapping textuel courant FR/EN → codes wizard
      const surfaceMap = {
        asphalte: 'ASPH', asphalt: 'ASPH', goudron: 'ASPH', bitume: 'ASPH',
        béton: 'CONC', beton: 'CONC', concrete: 'CONC',
        herbe: 'GRASS', grass: 'GRASS', gazon: 'GRASS',
        gravier: 'GRVL', gravel: 'GRVL',
        terre: 'UNPAVED', dirt: 'UNPAVED', unpaved: 'UNPAVED',
        sable: 'SAND', sand: 'SAND',
        neige: 'SNOW', snow: 'SNOW',
        eau: 'WATER', water: 'WATER'
      };
      valueToWrite = valueToWrite.map(s => surfaceMap[s.toLowerCase()] || s.toUpperCase());
    }

    // ─── Assemblage générique paths imbriqués ───
    const parts = path.split('.');
    if (parts.length === 1) {
      payload[parts[0]] = valueToWrite;
    } else {
      // ex: speeds.vso → payload.speeds = { ...payload.speeds, vso: value }
      const [top, ...rest] = parts;
      payload[top] = payload[top] || {};
      let cursor = payload[top];
      for (let i = 0; i < rest.length - 1; i++) {
        cursor[rest[i]] = cursor[rest[i]] || {};
        cursor = cursor[rest[i]];
      }
      cursor[rest[rest.length - 1]] = valueToWrite;
    }
  }

  // Assembler windLimits.limits si on a collecté des entrées
  if (windLimitEntries.length > 0) {
    payload.windLimits = payload.windLimits || {};
    payload.windLimits.limits = windLimitEntries;
  }

  return payload;
}
