// src/utils/unitsConverter.js

/**
 * Utilitaire de conversion d'unités pour l'application ALFlight
 * Gère toutes les conversions entre différents systèmes d'unités
 */

// Facteurs de conversion
const conversionFactors = {
  // Distance
  distance: {
    nm_to_km: 1.852,
    nm_to_mi: 1.15078,
    km_to_nm: 0.539957,
    km_to_mi: 0.621371,
    mi_to_nm: 0.868976,
    mi_to_km: 1.60934
  },

  // Altitude
  altitude: {
    ft_to_m: 0.3048,
    m_to_ft: 3.28084
  },

  // Vitesse
  speed: {
    kt_to_kmh: 1.852,
    kt_to_mph: 1.15078,
    kt_to_ms: 0.514444,
    kmh_to_kt: 0.539957,
    kmh_to_mph: 0.621371,
    kmh_to_ms: 0.277778,
    mph_to_kt: 0.868976,
    mph_to_kmh: 1.60934,
    mph_to_ms: 0.44704,
    ms_to_kt: 1.94384,
    ms_to_kmh: 3.6,
    ms_to_mph: 2.23694
  },

  // Poids
  weight: {
    kg_to_lbs: 2.20462,
    lbs_to_kg: 0.453592
  },

  // Carburant (avec densité AVGAS standard 0.72 kg/L)
  fuel: {
    ltr_to_gal: 0.264172,
    ltr_to_kg: 0.72,
    ltr_to_lbs: 1.58757,
    gal_to_ltr: 3.78541,
    gal_to_kg: 2.72556,
    gal_to_lbs: 6.01,
    kg_to_ltr: 1.38889,
    kg_to_gal: 0.366972,
    kg_to_lbs: 2.20462,
    lbs_to_ltr: 0.630092,
    lbs_to_gal: 0.166535,
    lbs_to_kg: 0.453592
  },

  // Consommation de carburant
  fuelConsumption: {
    lph_to_gph: 0.264172,
    gph_to_lph: 3.78541
  },

  // Pression
  pressure: {
    hPa_to_inHg: 0.02953,
    hPa_to_mb: 1,
    inHg_to_hPa: 33.8639,
    inHg_to_mb: 33.8639,
    mb_to_hPa: 1,
    mb_to_inHg: 0.02953
  },

  // Température
  temperature: {
    C_to_F: (c) => (c * 9/5) + 32,
    F_to_C: (f) => (f - 32) * 5/9
  },

  // Longueur de piste
  runway: {
    m_to_ft: 3.28084,
    ft_to_m: 0.3048
  },

  // Bras de levier
  armLength: {
    mm_to_cm: 0.1,
    mm_to_m: 0.001,
    mm_to_in: 0.0393701,
    cm_to_mm: 10,
    cm_to_m: 0.01,
    cm_to_in: 0.393701,
    m_to_mm: 1000,
    m_to_cm: 100,
    m_to_in: 39.3701,
    in_to_mm: 25.4,
    in_to_cm: 2.54,
    in_to_m: 0.0254
  },

  // Visibilité
  visibility: {
    km_to_sm: 0.621371,
    km_to_m: 1000,
    sm_to_km: 1.60934,
    sm_to_m: 1609.34,
    m_to_km: 0.001,
    m_to_sm: 0.000621371
  }
};

/**
 * Convertit une valeur d'une unité à une autre
 * @param {number} value - La valeur à convertir
 * @param {string} fromUnit - L'unité de départ
 * @param {string} toUnit - L'unité d'arrivée
 * @param {string} category - La catégorie d'unité (speed, distance, etc.)
 * @returns {number} - La valeur convertie
 */
export function convertValue(value, fromUnit, toUnit, category) {
  // Si les unités sont identiques, retourner la valeur telle quelle
  if (fromUnit === toUnit) {
    return value;
  }

  // Si la valeur est invalide, retourner 0
  if (!value || isNaN(value)) {
    return 0;
  }

  const numValue = parseFloat(value);

  // Température (cas spécial car utilise des fonctions)
  if (category === 'temperature') {
    if (fromUnit === 'C' && toUnit === 'F') {
      return conversionFactors.temperature.C_to_F(numValue);
    } else if (fromUnit === 'F' && toUnit === 'C') {
      return conversionFactors.temperature.F_to_C(numValue);
    }
    return numValue;
  }

  // Chercher le facteur de conversion
  const factors = conversionFactors[category];
  if (!factors) {
    
    return numValue;
  }

  // Construire la clé de conversion
  const conversionKey = `${fromUnit}_to_${toUnit}`;
  const factor = factors[conversionKey];

  if (factor === undefined) {
    return numValue;
  }

  return numValue * factor;
}

/**
 * Formate une valeur avec l'unité appropriée
 * @param {number} value - La valeur à formater
 * @param {string} unit - L'unité à afficher
 * @param {number} decimals - Nombre de décimales (par défaut 1)
 * @returns {string} - La valeur formatée avec son unité
 */
export function formatWithUnit(value, unit, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return '---';
  }

  const unitSymbols = {
    // Distance
    nm: 'NM',
    km: 'km',
    mi: 'mi',

    // Altitude
    ft: 'ft',
    m: 'm',
    FL: 'FL',

    // Vitesse
    kt: 'kt',
    'km/h': 'km/h',
    kmh: 'km/h',
    mph: 'mph',
    'mi/h': 'mph',
    'm/s': 'm/s',
    ms: 'm/s',

    // Poids
    kg: 'kg',
    lbs: 'lbs',

    // Carburant
    ltr: 'L',
    gal: 'gal',

    // Consommation
    lph: 'L/h',
    gph: 'gal/h',

    // Pression
    hPa: 'hPa',
    inHg: 'inHg',
    mb: 'mb',

    // Température
    C: '°C',
    F: '°F',

    // Bras de levier
    mm: 'mm',
    cm: 'cm',
    in: 'in',

    // Visibilité
    sm: 'SM'
  };

  const symbol = unitSymbols[unit] || unit;
  return `${value.toFixed(decimals)} ${symbol}`;
}

/**
 * Convertit et formate une valeur selon les préférences d'unités
 * @param {number} value - La valeur à convertir
 * @param {string} category - La catégorie d'unité
 * @param {string} fromUnit - L'unité de départ
 * @param {string} toUnit - L'unité d'arrivée
 * @param {number} decimals - Nombre de décimales
 * @returns {string} - La valeur convertie et formatée
 */
export function convertAndFormat(value, category, fromUnit, toUnit, decimals = 1) {
  const convertedValue = convertValue(value, fromUnit, toUnit, category);
  return formatWithUnit(convertedValue, toUnit, decimals);
}

/**
 * Obtient l'unité par défaut pour une catégorie
 * @param {string} category - La catégorie d'unité
 * @param {Object} units - Les préférences d'unités
 * @returns {string} - L'unité par défaut
 */
export function getDefaultUnit(category, units) {
  return units[category] || 'SI';
}

/**
 * Convertit un objet de valeurs selon les préférences d'unités
 * @param {Object} values - L'objet contenant les valeurs à convertir
 * @param {Object} conversions - Les définitions de conversion {field: {category, fromUnit}}
 * @param {Object} units - Les préférences d'unités
 * @returns {Object} - L'objet avec les valeurs converties
 */
export function convertObject(values, conversions, units) {
  const converted = { ...values };

  Object.entries(conversions).forEach(([field, config]) => {
    if (values[field] !== undefined && values[field] !== null) {
      const toUnit = units[config.category];
      converted[field] = convertValue(
        values[field],
        config.fromUnit,
        toUnit,
        config.category
    }
  });

  return converted;
}

export default {
  convertValue,
  formatWithUnit,
  convertAndFormat,
  getDefaultUnit,
  convertObject
};