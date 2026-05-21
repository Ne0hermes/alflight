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
//   - Step3 : weights.{emptyWeight, mtow, mlw, minTakeoffWeight}
//             ❌ Bras de levier (arms.*) ET enveloppe CG (cgEnvelope.*) NE SONT
//                PLUS extraits par l'IA — déterminés via le wizard CentrogramReader
//                (lecture par clic sur le centrogramme MANEX).
//
// Pour les structures complexes (arrays type voRanges, windLimits.limits,
// cgEnvelope.forwardPoints) le mapping de base extrait des valeurs scalaires
// que buildBulkUpdatePayload assemblera ensuite.
const FIELD_MAPPINGS = [
  // ═══ IDENTIFICATION (Step1) ═══
  { aircraftPath: 'manufacturer',          src: ['aircraft_identification', 'manufacturer'],  type: 'string', label: 'Marque / Constructeur' },
  { aircraftPath: 'model',                 src: ['aircraft_identification', 'model'],         type: 'string', label: 'Modèle (type avion)' },
  { aircraftPath: 'registration',          src: ['aircraft_identification', 'registration'],  type: 'string', label: 'Immatriculation' },
  { aircraftPath: 'homeAeroclub',          src: ['aircraft_identification', 'home_aeroclub'], type: 'aeroclub', label: 'Aéroclub d\'attache', description: 'Aéroclub propriétaire ou d\'attache de l\'avion. Liste déroulante intelligente avec ~150 clubs FFA + ajouts personnels.' },
  { aircraftPath: 'homeBase',              src: ['aircraft_identification', 'home_base_icao'],type: 'string', label: 'Terrain de base (OACI)', description: 'Code OACI à 4 lettres du terrain de base. Auto-rempli si l\'aéroclub sélectionné a un terrain connu.' },

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
  { aircraftPath: 'fuelCapacity',           src: ['fuel', 'capacity_total'],     category: 'fuel',            targetUnit: 'ltr',           label: 'Capacité totale carburant', description: 'Volume physique total de tous les réservoirs (capacity / total tank volume).' },
  { aircraftPath: 'fuelUsableCapacity',     src: ['fuel', 'usable_fuel_total'],  category: 'fuel',            targetUnit: 'ltr',           label: 'Volume utilisable total', description: 'Carburant réellement consommable (un peu inférieur à la capacité totale, sans la résiduelle non aspirable). C\'est cette valeur qui est utilisée pour les calculs de M&C et d\'autonomie.' },
  { aircraftPath: 'fuelConsumption',        src: ['fuel', 'consumption_cruise'], category: 'fuelConsumption', targetUnit: 'lph',           label: 'Conso croisière' },

  // ═══ VITESSE DE CROISIÈRE (Step2) ═══
  // Le prompt extrait performance_summary.cruise_speed_75percent (TAS à 75%).
  { aircraftPath: 'cruiseSpeedKt',          src: ['performance_summary', 'cruise_speed_75percent'], category: 'speed', targetUnit: 'kt', label: 'Vitesse de croisière (75% puissance)' },

  // ═══ MASSE MAX BAGAGES (Step3) ═══
  // - max_total_baggage_mass : masse cumulée tous compartiments confondus
  //   (utilisée comme garde-fou en préparation de vol)
  { aircraftPath: 'maxBaggageTotalMass',    src: ['baggage', 'max_total_mass'],  category: 'weight', targetUnit: 'kg', label: 'Masse max bagages (cumulée tous compartiments)' },

  // Réservoirs (tous types, agrégés en additionalFuelTanks array par
  // buildBulkUpdatePayload). Le réservoir « principal » est désormais traité
  // au même niveau que les autres (refonte : pas de catégorie spéciale).
  { aircraftPath: '_fuelTank:main',       src: ['fuel', 'capacity_main'],       category: 'fuel', targetUnit: 'ltr', label: 'Capacité réservoir principal' },
  { aircraftPath: '_fuelTank:wing_left',  src: ['fuel', 'capacity_wing_left'],  category: 'fuel', targetUnit: 'ltr', label: 'Capacité aile gauche' },
  { aircraftPath: '_fuelTank:wing_right', src: ['fuel', 'capacity_wing_right'], category: 'fuel', targetUnit: 'ltr', label: 'Capacité aile droite' },
  { aircraftPath: '_fuelTank:wing',       src: ['fuel', 'capacity_wing'],       category: 'fuel', targetUnit: 'ltr', label: 'Capacité aile (unique)' },
  { aircraftPath: '_fuelTank:tip',        src: ['fuel', 'capacity_tip'],        category: 'fuel', targetUnit: 'ltr', label: 'Capacité tip tank' },
  { aircraftPath: '_fuelTank:aux',        src: ['fuel', 'capacity_aux'],        category: 'fuel', targetUnit: 'ltr', label: 'Capacité auxiliaire' },
  { aircraftPath: '_fuelTank:optional',   src: ['fuel', 'capacity_optional'],   category: 'fuel', targetUnit: 'ltr', label: 'Capacité optionnel' },

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
  // Le champ `description` est affiché en italique dans le tableau de
  // validation MANEX pour aider le pilote (les aéroclubs n'utilisent pas
  // toujours les mêmes noms / formulations).
  { aircraftPath: 'speeds.vso',          src: ['speeds', 'vso'],          category: 'speed', targetUnit: 'kt', label: 'VSO',     description: 'Vitesse de décrochage en configuration d\'atterrissage (volets pleine sortie). Aussi : « stall LDG », « VS atterrissage », « VS dirty ».' },
  { aircraftPath: 'speeds.vsTO',         src: ['speeds', 'vs_takeoff'],   category: 'speed', targetUnit: 'kt', label: 'VS T/O',  description: 'Vitesse de décrochage en configuration de décollage (volets T/O sortis). Distinct de VSO si l\'avion a une position volets décollage. Aussi : « stall takeoff », « VS décollage ».' },
  { aircraftPath: 'speeds.vs1',          src: ['speeds', 'vs1'],          category: 'speed', targetUnit: 'kt', label: 'VS1',     description: 'Vitesse de décrochage en configuration lisse (sans volet, train rentré, configuration croisière). Aussi : « stall clean ».' },
  { aircraftPath: 'speeds.vfeTO',        src: ['speeds', 'vfe_takeoff'],  category: 'speed', targetUnit: 'kt', label: 'VFE T/O', description: 'Vitesse maximale volets sortis en configuration décollage. À ne pas dépasser avec volets T/O.' },
  { aircraftPath: 'speeds.vfeLdg',       src: ['speeds', 'vfe_landing'],  category: 'speed', targetUnit: 'kt', label: 'VFE LDG', description: 'Vitesse maximale volets sortis en configuration atterrissage. À ne pas dépasser avec volets pleine sortie.' },
  { aircraftPath: 'speeds.vno',          src: ['speeds', 'vno'],          category: 'speed', targetUnit: 'kt', label: 'VNO',     description: 'Vitesse maximale en croisière normale. Au-delà : arc jaune (interdit en turbulences).' },
  { aircraftPath: 'speeds.vne',          src: ['speeds', 'vne'],          category: 'speed', targetUnit: 'kt', label: 'VNE',     description: 'Vitesse à ne jamais dépasser (Never Exceed). Au-delà : risque de rupture structurelle.' },
  // Optionnelles (panel "Vitesses optionnelles" du wizard)
  { aircraftPath: 'speeds.vr',           src: ['speeds', 'vr'],           category: 'speed', targetUnit: 'kt', label: 'VR',      description: 'Vitesse de rotation au décollage (tirage manche pour décoller).' },
  { aircraftPath: 'speeds.vx',           src: ['speeds', 'vx'],           category: 'speed', targetUnit: 'kt', label: 'VX',      description: 'Vitesse de meilleur angle de montée (gain altitude maximal par unité de distance horizontale parcourue). Utile pour franchir un obstacle.' },
  { aircraftPath: 'speeds.vy',           src: ['speeds', 'vy'],           category: 'speed', targetUnit: 'kt', label: 'VY',      description: 'Vitesse de meilleur taux de montée (gain altitude maximal par unité de temps). Utilisée en montée standard.' },
  { aircraftPath: 'speeds.vapp',         src: ['speeds', 'vapp'],         category: 'speed', targetUnit: 'kt', label: 'VAPP',    description: 'Vitesse d\'approche finale recommandée (souvent 1,3 × VSO). Aussi : « approach speed ».' },
  { aircraftPath: 'speeds.initialClimb', src: ['speeds', 'initial_climb_rate'], category: 'climbRate', targetUnit: 'ft/min', label: 'Taux montée initial', description: 'Vitesse verticale (ft/min) au décollage à MTOW, conditions ISA.' },
  { aircraftPath: 'speeds.vglide',       src: ['speeds', 'vglide'],       category: 'speed', targetUnit: 'kt', label: 'V finesse', description: 'Vitesse de plané optimale (meilleure finesse) en cas de panne moteur. Aussi : « best glide speed ».' },
  { aircraftPath: 'speeds.vle',          src: ['speeds', 'vle'],          category: 'speed', targetUnit: 'kt', label: 'VLE',     description: 'Vitesse maximale train sorti (Landing gear Extended). Si l\'avion a un train rentrant.' },
  { aircraftPath: 'speeds.vlo',          src: ['speeds', 'vlo'],          category: 'speed', targetUnit: 'kt', label: 'VLO',     description: 'Vitesse maximale d\'opération du train (manœuvre sortie/rentrée). Si l\'avion a un train rentrant.' },

  // ═══ LIMITES VENT (Step2 — array windLimits.limits) ═══
  // Stockage final : windLimits.limits = array d'objets {type, value, saved}.
  // Le mapping plat capture les valeurs scalaires ; buildBulkUpdatePayload
  // assemble l'array final.
  { aircraftPath: '_windLimit:maxCrosswind',    src: ['wind_limits', 'max_crosswind'],     category: 'speed', targetUnit: 'kt', label: 'Vent traversier max démontré' },
  { aircraftPath: '_windLimit:maxTailwind',     src: ['wind_limits', 'max_tailwind'],      category: 'speed', targetUnit: 'kt', label: 'Vent arrière max' },
  { aircraftPath: '_windLimit:maxCrosswindWet', src: ['wind_limits', 'max_crosswind_wet'], category: 'speed', targetUnit: 'kt', label: 'Travers max piste mouillée' },

  // ═══ POIDS (Step3 — storage = kg) ═══
  { aircraftPath: 'weights.emptyWeight',         src: ['weights', 'empty_weight'],        category: 'weight', targetUnit: 'kg', label: 'Masse à vide (BEW)' },
  { aircraftPath: 'weights.mtow',                src: ['weights', 'mtow'],                category: 'weight', targetUnit: 'kg', label: 'MTOW (cat. Normale)', description: 'Masse maximale au décollage en catégorie Normale (N). Limite standard d\'opération.' },
  { aircraftPath: 'weights.mlw',                 src: ['weights', 'mlw'],                 category: 'weight', targetUnit: 'kg', label: 'MLW (cat. Normale)', description: 'Masse maximale à l\'atterrissage en catégorie Normale. Souvent égale au MTOW en aviation générale.' },
  { aircraftPath: 'utilityCategory.mtow',        src: ['weights', 'mtow_utility'],        category: 'weight', targetUnit: 'kg', label: 'MTOW (cat. Utilitaire)', description: 'Masse maximale au décollage en catégorie Utilitaire (U). Souvent inférieure à la MTOW normale. Présente sur les avions certifiés CS-23 / FAR 23 catégorie U.' },
  { aircraftPath: 'utilityCategory.mlw',         src: ['weights', 'mlw_utility'],         category: 'weight', targetUnit: 'kg', label: 'MLW (cat. Utilitaire)', description: 'Masse maximale à l\'atterrissage en catégorie Utilitaire. Souvent égale au MTOW utilitaire.' },
  { aircraftPath: 'weights.minTakeoffWeight',    src: ['weights', 'min_takeoff_weight'],  category: 'weight', targetUnit: 'kg', label: 'Masse min décollage' },

  // ═══ BRAS DE LEVIER & ENVELOPPE CG ═══
  // RETIRÉS de l'extraction MANEX (refonte du wizard masse & centrage).
  // Ces données sont désormais déterminées par le pilote via :
  //   - Saisie manuelle dans Step3WeightBalance (voie A)
  //   - OU lecture graphique par clic sur le centrogramme (voie B, CentrogramReader)
  // L'IA Vision peinait à les extraire fiablement depuis les graphiques imprimés
  // du MANEX, et l'utilisateur préfère un système déterministe avec contrôle visuel.

  // ═══ ÉQUIPEMENTS COM (Step5Equipment — booléens) ═══
  { aircraftPath: 'equipmentCom.vhf1',   src: ['equipment_com', 'vhf1'],   type: 'boolean', label: 'VHF COM 1' },
  { aircraftPath: 'equipmentCom.vhf2',   src: ['equipment_com', 'vhf2'],   type: 'boolean', label: 'VHF COM 2' },
  { aircraftPath: 'equipmentCom.hf',     src: ['equipment_com', 'hf'],     type: 'boolean', label: 'HF (Haute fréquence)' },
  { aircraftPath: 'equipmentCom.satcom', src: ['equipment_com', 'satcom'], type: 'boolean', label: 'SATCOM' },
  { aircraftPath: 'equipmentCom.acars',  src: ['equipment_com', 'acars'],  type: 'boolean', label: 'ACARS' },
  { aircraftPath: 'equipmentCom.cpdlc',  src: ['equipment_com', 'cpdlc'],  type: 'boolean', label: 'CPDLC (Datalink)' },

  // ═══ ÉQUIPEMENTS NAV (Step5Equipment — booléens + 2 textes) ═══
  { aircraftPath: 'equipmentNav.vor',        src: ['equipment_nav', 'vor'],        type: 'boolean', label: 'VOR' },
  { aircraftPath: 'equipmentNav.dme',        src: ['equipment_nav', 'dme'],        type: 'boolean', label: 'DME' },
  { aircraftPath: 'equipmentNav.adf',        src: ['equipment_nav', 'adf'],        type: 'boolean', label: 'ADF/NDB' },
  { aircraftPath: 'equipmentNav.gnss',       src: ['equipment_nav', 'gnss'],       type: 'boolean', label: 'GNSS/GPS' },
  { aircraftPath: 'equipmentNav.ils',        src: ['equipment_nav', 'ils'],        type: 'boolean', label: 'ILS' },
  { aircraftPath: 'equipmentNav.mls',        src: ['equipment_nav', 'mls'],        type: 'boolean', label: 'MLS' },
  { aircraftPath: 'equipmentNav.gbas',       src: ['equipment_nav', 'gbas'],       type: 'boolean', label: 'GBAS' },
  { aircraftPath: 'equipmentNav.lpv',        src: ['equipment_nav', 'lpv'],        type: 'boolean', label: 'LPV (approche GPS)' },
  { aircraftPath: 'equipmentNav.ahrs',       src: ['equipment_nav', 'ahrs'],       type: 'boolean', label: 'AHRS' },
  { aircraftPath: 'equipmentNav.adc',        src: ['equipment_nav', 'adc'],        type: 'boolean', label: 'ADC' },
  { aircraftPath: 'equipmentNav.rnav',       src: ['equipment_nav', 'rnav'],       type: 'boolean', label: 'RNAV (capacité)' },
  { aircraftPath: 'equipmentNav.rnavTypes',  src: ['equipment_nav', 'rnav_types'], type: 'string',  label: 'Types RNAV approuvés' },
  { aircraftPath: 'equipmentNav.rnp',        src: ['equipment_nav', 'rnp'],        type: 'boolean', label: 'RNP (capacité)' },
  { aircraftPath: 'equipmentNav.rnpTypes',   src: ['equipment_nav', 'rnp_types'],  type: 'string',  label: 'Types RNP approuvés' },

  // ═══ ÉQUIPEMENTS SURVEILLANCE (Step5Equipment) ═══
  { aircraftPath: 'equipmentSurv.adsb',             src: ['equipment_surv', 'adsb'],              type: 'boolean', label: 'ADS-B' },
  { aircraftPath: 'equipmentSurv.adsc',             src: ['equipment_surv', 'adsc'],              type: 'boolean', label: 'ADS-C' },
  { aircraftPath: 'equipmentSurv.tcas',             src: ['equipment_surv', 'tcas'],              type: 'boolean', label: 'TCAS I' },
  { aircraftPath: 'equipmentSurv.acas',             src: ['equipment_surv', 'acas'],              type: 'boolean', label: 'ACAS II / TCAS II' },
  { aircraftPath: 'equipmentSurv.taws',             src: ['equipment_surv', 'taws'],              type: 'boolean', label: 'TAWS / EGPWS' },
  { aircraftPath: 'equipmentSurv.cvr',              src: ['equipment_surv', 'cvr'],               type: 'boolean', label: 'CVR (enregistreur voix)' },
  { aircraftPath: 'equipmentSurv.fdr',              src: ['equipment_surv', 'fdr'],               type: 'boolean', label: 'FDR (enregistreur paramètres)' },
  { aircraftPath: 'equipmentSurv.weather',          src: ['equipment_surv', 'weather'],           type: 'boolean', label: 'Radar météo' },
  { aircraftPath: 'equipmentSurv.adsbOut',          src: ['equipment_surv', 'adsb_out'],          type: 'boolean', label: 'ADS-B Out' },
  { aircraftPath: 'equipmentSurv.transponderModes', src: ['equipment_surv', 'transponder_modes'], type: 'string',  label: 'Modes transpondeur (A/C/S)' },

  // ═══ CAPACITÉS SPÉCIALES (Step5Equipment) ═══
  { aircraftPath: 'specialCapabilities.pbn',     src: ['special_capabilities', 'pbn'],     type: 'boolean', label: 'PBN approuvé' },
  { aircraftPath: 'specialCapabilities.lvto',    src: ['special_capabilities', 'lvto'],    type: 'boolean', label: 'LVTO (Low Vis Take-Off)' },
  { aircraftPath: 'specialCapabilities.catII',   src: ['special_capabilities', 'cat_ii'],  type: 'boolean', label: 'CAT II approche' },
  { aircraftPath: 'specialCapabilities.catIIIa', src: ['special_capabilities', 'cat_iiia'],type: 'boolean', label: 'CAT IIIa' },
  { aircraftPath: 'specialCapabilities.catIIIb', src: ['special_capabilities', 'cat_iiib'],type: 'boolean', label: 'CAT IIIb' },
  { aircraftPath: 'specialCapabilities.catIIIc', src: ['special_capabilities', 'cat_iiic'],type: 'boolean', label: 'CAT IIIc' },
  { aircraftPath: 'specialCapabilities.etops',   src: ['special_capabilities', 'etops'],   type: 'boolean', label: 'ETOPS' },
  { aircraftPath: 'specialCapabilities.rvsm',    src: ['special_capabilities', 'rvsm'],    type: 'boolean', label: 'RVSM' },
  { aircraftPath: 'specialCapabilities.mnps',    src: ['special_capabilities', 'mnps'],    type: 'boolean', label: 'MNPS' },
  { aircraftPath: 'specialCapabilities.icing',   src: ['special_capabilities', 'icing'],   type: 'boolean', label: 'Vol en conditions givrantes' },

  // ═══ OPÉRATIONS APPROUVÉES (Step5Equipment — approvedOperations.*) ═══
  // Règles de vol
  { aircraftPath: 'approvedOperations.vfrDay',       src: ['approved_operations', 'vfr_day'],     type: 'boolean', label: 'VFR jour' },
  { aircraftPath: 'approvedOperations.vfrNight',     src: ['approved_operations', 'vfr_night'],   type: 'boolean', label: 'VFR nuit' },
  { aircraftPath: 'approvedOperations.ifrDay',       src: ['approved_operations', 'ifr_day'],     type: 'boolean', label: 'IFR jour' },
  { aircraftPath: 'approvedOperations.ifrNight',     src: ['approved_operations', 'ifr_night'],   type: 'boolean', label: 'IFR nuit' },
  { aircraftPath: 'approvedOperations.svfr',         src: ['approved_operations', 'svfr'],        type: 'boolean', label: 'Special VFR' },
  // Opérations spéciales
  { aircraftPath: 'approvedOperations.formation',    src: ['approved_operations', 'formation'],   type: 'boolean', label: 'Vol en formation' },
  { aircraftPath: 'approvedOperations.aerobatics',   src: ['approved_operations', 'aerobatics'],  type: 'boolean', label: 'Voltige aérienne' },
  { aircraftPath: 'approvedOperations.banner',       src: ['approved_operations', 'banner'],      type: 'boolean', label: 'Remorquage banderoles' },
  { aircraftPath: 'approvedOperations.glider',       src: ['approved_operations', 'glider'],      type: 'boolean', label: 'Remorquage planeurs' },
  { aircraftPath: 'approvedOperations.parachute',    src: ['approved_operations', 'parachute'],   type: 'boolean', label: 'Largage parachutistes' },
  { aircraftPath: 'approvedOperations.agricultural', src: ['approved_operations', 'agricultural'],type: 'boolean', label: 'Épandage agricole' },
  { aircraftPath: 'approvedOperations.aerial',       src: ['approved_operations', 'aerial'],      type: 'boolean', label: 'Travail aérien' },
  // Environnement et usage
  { aircraftPath: 'approvedOperations.training',     src: ['approved_operations', 'training'],    type: 'boolean', label: 'Instruction / école' },
  { aircraftPath: 'approvedOperations.charter',      src: ['approved_operations', 'charter'],     type: 'boolean', label: 'Transport public à la demande' },
  { aircraftPath: 'approvedOperations.mountainous',  src: ['approved_operations', 'mountainous'], type: 'boolean', label: 'Zone montagneuse' },
  { aircraftPath: 'approvedOperations.seaplane',     src: ['approved_operations', 'seaplane'],    type: 'boolean', label: 'Configuration hydravion' },
  { aircraftPath: 'approvedOperations.skiPlane',     src: ['approved_operations', 'ski_plane'],   type: 'boolean', label: 'Configuration skis' },

  // ═══ ÉQUIPEMENTS DE SÉCURITÉ (Step5Equipment — approvedOperations.*) ═══
  // Ces items sont stockés dans approvedOperations bien que ce soient des équipements
  // physiques. Conservation du namespace existant pour rétro-compat.
  { aircraftPath: 'approvedOperations.elt',                     src: ['safety_equipment', 'elt'],                     type: 'boolean', label: 'ELT (balise détresse)' },
  { aircraftPath: 'approvedOperations.lifeVests',               src: ['safety_equipment', 'life_vests'],              type: 'boolean', label: 'Gilets de sauvetage' },
  { aircraftPath: 'approvedOperations.fireExtinguisherHalon',   src: ['safety_equipment', 'fire_extinguisher_halon'], type: 'boolean', label: 'Extincteur Halon' },
  { aircraftPath: 'approvedOperations.fireExtinguisherWater',   src: ['safety_equipment', 'fire_extinguisher_water'], type: 'boolean', label: 'Extincteur eau' },
  { aircraftPath: 'approvedOperations.fireExtinguisherPowder',  src: ['safety_equipment', 'fire_extinguisher_powder'],type: 'boolean', label: 'Extincteur poudre' },
  { aircraftPath: 'approvedOperations.oxygenBottles',           src: ['safety_equipment', 'oxygen_bottles'],          type: 'boolean', label: 'Bouteilles oxygène' },
  { aircraftPath: 'approvedOperations.lifeRaft',                src: ['safety_equipment', 'life_raft'],               type: 'boolean', label: 'Radeau de survie' },
  { aircraftPath: 'approvedOperations.survivalKit',             src: ['safety_equipment', 'survival_kit'],            type: 'boolean', label: 'Kit de survie' },
  { aircraftPath: 'approvedOperations.plb',                     src: ['safety_equipment', 'plb'],                     type: 'boolean', label: 'PLB (balise personnelle)' },
  { aircraftPath: 'approvedOperations.firstAidKit',             src: ['safety_equipment', 'first_aid_kit'],           type: 'boolean', label: 'Trousse premiers secours' }
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
      } else if (mapping.type === 'string' || mapping.type === 'array_csv' || mapping.type === 'aeroclub') {
        convertedValue = String(raw.value);
      } else if (mapping.type === 'number') {
        const n = Number(raw.value);
        convertedValue = Number.isFinite(n) ? n : null;
      } else if (mapping.type === 'boolean') {
        // Conversion tolérante : 'true'/'false', 'yes'/'no', '1'/'0', true/false, 1/0
        const v = raw.value;
        if (typeof v === 'boolean') convertedValue = v;
        else if (typeof v === 'number') convertedValue = v !== 0;
        else if (typeof v === 'string') {
          const lower = v.trim().toLowerCase();
          if (['true', 'yes', '1', 'oui', 'present', 'installed', 'installé', 'approved', 'approuvé'].includes(lower)) {
            convertedValue = true;
          } else if (['false', 'no', '0', 'non', 'absent', 'not installed', 'not approved'].includes(lower)) {
            convertedValue = false;
          } else {
            convertedValue = null; // Valeur ambiguë, pilote doit trancher
          }
        } else {
          convertedValue = null;
        }
      } else if (mapping.category && mapping.targetUnit) {
        convertedValue = convertToStorage(raw.value, raw.unit, mapping.category, mapping.targetUnit);
      } else {
        convertedValue = raw.value;
      }
    }

    items.push({
      aircraftPath: mapping.aircraftPath,
      label: mapping.label,
      // Description optionnelle : affichée en italique sous le libellé dans
      // le tableau de validation MANEX. Utile pour les vitesses car les
      // aéroclubs n'utilisent pas tous le même vocabulaire.
      description: mapping.description || null,
      value: convertedValue,
      originalValue: found ? raw.value : null,
      originalUnit: found ? (raw.unit || null) : null,
      targetUnit: mapping.targetUnit || null,
      confidence: found ? (Number(raw.confidence) || 0) : 0,
      sourcePage: found ? (raw.sourcePage || null) : null,
      // « Importer » TOUJOURS décoché par défaut : le pilote doit cocher
      // manuellement chaque champ qu'il veut importer. Sert d'élément de
      // vérification active — on n'importe pas aveuglément ce que l'IA
      // a extrait, même quand la confiance est élevée.
      accepted: false,
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
  // Accumulateur pour additionalFuelTanks (assemblage en array final).
  // Chaque entrée correspond à un sous-type de réservoir extrait du MANEX.
  const fuelTankEntries = [];

  // Mapping pseudo-type → type interne + nom par défaut
  const fuelTankTypeMap = {
    main:       { type: 'main',     name: 'Réservoir principal' },
    wing_left:  { type: 'wing',     name: 'Réservoir aile gauche' },
    wing_right: { type: 'wing',     name: 'Réservoir aile droite' },
    wing:       { type: 'wing',     name: 'Réservoir d\'aile' },
    tip:        { type: 'tip',      name: 'Tip tank' },
    aux:        { type: 'aux',      name: 'Réservoir auxiliaire' },
    optional:   { type: 'optional', name: 'Réservoir optionnel' }
  };

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

    // ─── Cas spécial : pseudo-paths "_fuelTank:<sub>" ───
    // Assemblés dans additionalFuelTanks: [{id, name, type, arm, capacity}, ...]
    if (path.startsWith('_fuelTank:')) {
      const sub = path.slice('_fuelTank:'.length);
      const valueNum = typeof item.value === 'number' ? item.value : parseFloat(item.value);
      if (!Number.isFinite(valueNum) || valueNum <= 0) continue;
      const info = fuelTankTypeMap[sub] || { type: 'optional', name: `Réservoir ${sub}` };
      fuelTankEntries.push({
        id: Date.now() + Math.random(),
        name: info.name,
        type: info.type,
        arm: '',        // à déterminer plus tard via centrogramme
        capacity: valueNum
      });
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

  // Assembler additionalFuelTanks si on a collecté des réservoirs additionnels
  // depuis l'extraction MANEX. Le pilote pourra ensuite ajuster les arms via
  // le CentrogramReader (les arms sont initialisés vides).
  if (fuelTankEntries.length > 0) {
    payload.additionalFuelTanks = fuelTankEntries;
  }

  // Auto-activation catégorie Utilitaire si l'IA a trouvé MTOW/MLW utility.
  // Sans cela, les valeurs U seraient stockées mais Step3 ne montrerait pas
  // le bloc utilitaire (qui dépend de utilityCategory.enabled = true).
  if (payload.utilityCategory && (
    payload.utilityCategory.mtow ||
    payload.utilityCategory.mlw ||
    payload.utilityCategory.forwardCG ||
    payload.utilityCategory.aftMinCG ||
    payload.utilityCategory.aftMaxCG
  )) {
    payload.utilityCategory.enabled = true;
  }

  return payload;
}
