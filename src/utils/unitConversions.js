// Utilitaire pour les conversions d'unités
// Gère toutes les conversions entre différents systèmes d'unités pour l'aviation

// Conversions de carburant
export const DENSITIES = {
  AVGAS: 0.72,
  JET_A1: 0.80
};

export const fuelConversions = {
  // Litres vers autres unités
  ltrToGal: (ltr) => ltr * 0.264172,
  ltrToKg: (ltr, density = DENSITIES.AVGAS) => ltr * density,
  ltrToLbs: (ltr, density = DENSITIES.AVGAS) => ltr * density * 2.20462,

  // Gallons vers autres unités
  galToLtr: (gal) => gal * 3.78541,
  galToKg: (gal, density = DENSITIES.AVGAS) => gal * 3.78541 * density,
  galToLbs: (gal) => gal * 6.01, // poids moyen AVGAS

  // Kilogrammes vers autres unités
  kgToLtr: (kg, density = DENSITIES.AVGAS) => kg / density,
  kgToGal: (kg, density = DENSITIES.AVGAS) => (kg / density) * 0.264172,
  kgToLbs: (kg) => kg * 2.20462,

  // Livres vers autres unités
  lbsToKg: (lbs) => lbs * 0.453592,
  lbsToLtr: (lbs, density = DENSITIES.AVGAS) => (lbs * 0.453592) / density,
  lbsToGal: (lbs) => lbs / 6.01
};

// Conversions de consommation de carburant
export const fuelConsumptionConversions = {
  lphToGph: (lph) => lph * 0.264172,
  gphToLph: (gph) => gph * 3.78541
};

// Conversions de masse
export const weightConversions = {
  kgToLbs: (kg) => kg * 2.20462,
  lbsToKg: (lbs) => lbs * 0.453592
};

// Conversions de distance
export const distanceConversions = {
  nmToKm: (nm) => nm * 1.852,
  nmToMi: (nm) => nm * 1.15078,
  kmToNm: (km) => km / 1.852,
  kmToMi: (km) => km * 0.621371,
  miToNm: (mi) => mi / 1.15078,
  miToKm: (mi) => mi * 1.60934
};

// Conversions d'altitude
export const altitudeConversions = {
  ftToM: (ft) => ft * 0.3048,
  mToFt: (m) => m / 0.3048
};

// Conversions de vitesse
export const speedConversions = {
  ktToKmh: (kt) => kt * 1.852,
  ktToMph: (kt) => kt * 1.15078,
  ktToMs: (kt) => kt * 0.514444,
  kmhToKt: (kmh) => kmh / 1.852,
  kmhToMph: (kmh) => kmh * 0.621371,
  kmhToMs: (kmh) => kmh / 3.6,
  mphToKt: (mph) => mph / 1.15078,
  mphToKmh: (mph) => mph * 1.60934,
  mphToMs: (mph) => mph * 0.44704,
  msToKt: (ms) => ms / 0.514444,
  msToKmh: (ms) => ms * 3.6,
  msToMph: (ms) => ms / 0.44704
};

// Conversions de température
export const temperatureConversions = {
  celsiusToFahrenheit: (c) => (c * 9 / 5) + 32,
  fahrenheitToCelsius: (f) => (f - 32) * 5 / 9
};

// Conversions de pression
export const pressureConversions = {
  hPaToInHg: (hPa) => hPa * 0.02953,
  hPaToMb: (hPa) => hPa, // identique
  inHgToHPa: (inHg) => inHg / 0.02953,
  inHgToMb: (inHg) => inHg / 0.02953,
  mbToHPa: (mb) => mb, // identique
  mbToInHg: (mb) => mb * 0.02953
};

// Conversions de bras de levier (longueur)
export const armLengthConversions = {
  mmToCm: (mm) => mm / 10,
  mmToM: (mm) => mm / 1000,
  mmToIn: (mm) => mm / 25.4,
  cmToMm: (cm) => cm * 10,
  cmToM: (cm) => cm / 100,
  cmToIn: (cm) => cm / 2.54,
  mToMm: (m) => m * 1000,
  mToCm: (m) => m * 100,
  mToIn: (m) => m * 39.3701,
  inToMm: (inch) => inch * 25.4,
  inToCm: (inch) => inch * 2.54,
  inToM: (inch) => inch / 39.3701
};

// Conversions de visibilité
export const visibilityConversions = {
  kmToSm: (km) => km * 0.621371,
  kmToM: (km) => km * 1000,
  smToKm: (sm) => sm * 1.60934,
  smToM: (sm) => sm * 1609.34,
  mToKm: (m) => m / 1000,
  mToSm: (m) => m / 1609.34
};

// Conversions de longueur de piste
export const runwayConversions = {
  mToFt: (m) => m * 3.28084,
  ftToM: (ft) => ft * 0.3048
};

// Conversions de coordonnées
export const coordinateConversions = {
  decimalToDMS: (decimal, isLat) => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

    const direction = decimal >= 0
      ? (isLat ? 'N' : 'E')
      : (isLat ? 'S' : 'W');

    return `${String(degrees).padStart(2, '0')}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(2, '0')}"${direction}`;
  },

  coordinatesToDMS: (lat, lon) => {
    return {
      lat: coordinateConversions.decimalToDMS(lat, true),
      lon: coordinateConversions.decimalToDMS(lon, false),
      formatted: `${coordinateConversions.decimalToDMS(lat, true)} - ${coordinateConversions.decimalToDMS(lon, false)}`
    };
  }
};

/**
 * Fonction générale de conversion de valeur
 * @param {number} value - La valeur à convertir
 * @param {string} fromUnit - L'unité de départ
 * @param {string} toUnit - L'unité d'arrivée
 * @param {string} category - La catégorie d'unité (speed, distance, etc.)
 * @param {Object} options - Options supplémentaires (ex: density)
 * @returns {number} - La valeur convertie
 */
export function convertValue(value, fromUnit, toUnit, category, options = {}) {
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
      return temperatureConversions.celsiusToFahrenheit(numValue);
    } else if (fromUnit === 'F' && toUnit === 'C') {
      return temperatureConversions.fahrenheitToCelsius(numValue);
    }
    return numValue;
  }

  // Construire la clé de conversion
  const conversionKey = `${fromUnit}To${toUnit.charAt(0).toUpperCase() + toUnit.slice(1)}`;

  console.log('🔍 [convertValue]', {
    value: numValue,
    fromUnit,
    toUnit,
    category,
    conversionKey,
    options
  });

  let conversionFunc = null;

  // Chercher la fonction de conversion selon la catégorie
  switch (category) {
    case 'distance':
      conversionFunc = distanceConversions[conversionKey];
      break;
    case 'altitude':
      conversionFunc = altitudeConversions[conversionKey];
      break;
    case 'speed':
    case 'windSpeed':
      conversionFunc = speedConversions[conversionKey];
      break;
    case 'weight':
      conversionFunc = weightConversions[conversionKey];
      break;
    case 'fuel':
      conversionFunc = fuelConversions[conversionKey];
      break;
    case 'fuelConsumption':
      conversionFunc = fuelConsumptionConversions[conversionKey];
      break;
    case 'pressure':
      conversionFunc = pressureConversions[conversionKey];
      break;
    case 'armLength':
      conversionFunc = armLengthConversions[conversionKey];
      break;
    case 'visibility':
      conversionFunc = visibilityConversions[conversionKey];
      break;
    case 'runway':
      conversionFunc = runwayConversions[conversionKey];
      break;
    default:
      console.warn(`⚠️ [convertValue] Unknown category: ${category}`);
      return numValue;
  }

  if (conversionFunc) {
    // Passer la densité si disponible (pour le carburant)
    const density = options.density;
    const result = conversionFunc(numValue, density);

    console.log('✅ [convertValue] Conversion result:', {
      input: numValue,
      output: result,
      densityUsed: density
    });

    return result;
  }

  console.warn(`⚠️ [convertValue] No conversion function found for ${conversionKey}, returning original value`);
  return numValue;
}

/**
 * Obtient le symbole d'unité pour l'affichage
 * @param {string} unit - L'unité
 * @returns {string} - Le symbole d'unité
 */
export function getUnitSymbol(unit) {
  const unitSymbols = {
    // Distance
    nm: 'NM',
    km: 'km',
    mi: 'mi',
    m: 'm',

    // Altitude
    ft: 'ft',
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

  return unitSymbols[unit] || unit;
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

  const symbol = getUnitSymbol(unit);
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

