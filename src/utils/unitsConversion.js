// src/utils/unitsConversion.js

/**
 * Fonctions de conversion d'unités pour l'aviation
 */

// ============= DISTANCE =============
export const distance = {
  // Conversions depuis les milles nautiques (nm)
  nmToKm: (nm) => nm * 1.852,
  nmToMi: (nm) => nm * 1.15078,
  nmToM: (nm) => nm * 1852,
  
  // Conversions vers les milles nautiques
  kmToNm: (km) => km / 1.852,
  miToNm: (mi) => mi / 1.15078,
  mToNm: (m) => m / 1852,
  
  // Conversions génériques
  convert: (value, from, to) => {
    if (from === to) return value;
    
    // Convertir d'abord en nm
    let nm = value;
    switch (from) {
      case 'km': nm = distance.kmToNm(value); break;
      case 'mi': nm = distance.miToNm(value); break;
      case 'm': nm = distance.mToNm(value); break;
      case 'nm': nm = value; break;
      default: return value;
    }
    
    // Puis convertir vers l'unité cible
    switch (to) {
      case 'nm': return nm;
      case 'km': return distance.nmToKm(nm);
      case 'mi': return distance.nmToMi(nm);
      case 'm': return distance.nmToM(nm);
      default: return value;
    }
  }
};

// ============= ALTITUDE =============
export const altitude = {
  ftToM: (ft) => ft * 0.3048,
  mToFt: (m) => m / 0.3048,
  ftToFL: (ft) => Math.round(ft / 100), // Flight Level
  FLToFt: (fl) => fl * 100,
  
  convert: (value, from, to) => {
    if (from === to) return value;
    
    // Convertir d'abord en pieds
    let ft = value;
    switch (from) {
      case 'm': ft = altitude.mToFt(value); break;
      case 'FL': ft = altitude.FLToFt(value); break;
      case 'ft': ft = value; break;
      default: return value;
    }
    
    // Puis convertir vers l'unité cible
    switch (to) {
      case 'ft': return ft;
      case 'm': return altitude.ftToM(ft);
      case 'FL': return altitude.ftToFL(ft);
      default: return value;
    }
  }
};

// ============= VITESSE =============
export const speed = {
  // Conversions depuis les nœuds (kt)
  ktToKmh: (kt) => kt * 1.852,
  ktToMph: (kt) => kt * 1.15078,
  ktToMs: (kt) => kt * 0.514444,
  
  // Conversions vers les nœuds
  kmhToKt: (kmh) => kmh / 1.852,
  mphToKt: (mph) => mph / 1.15078,
  msToKt: (ms) => ms / 0.514444,
  
  convert: (value, from, to) => {
    if (from === to) return value;
    
    // Convertir d'abord en nœuds
    let kt = value;
    switch (from) {
      case 'km/h': kt = speed.kmhToKt(value); break;
      case 'mph': kt = speed.mphToKt(value); break;
      case 'm/s': kt = speed.msToKt(value); break;
      case 'kt': kt = value; break;
      default: return value;
    }
    
    // Puis convertir vers l'unité cible
    switch (to) {
      case 'kt': return kt;
      case 'km/h': return speed.ktToKmh(kt);
      case 'mph': return speed.ktToMph(kt);
      case 'm/s': return speed.ktToMs(kt);
      default: return value;
    }
  }
};

// ============= POIDS/MASSE =============
export const weight = {
  kgToLbs: (kg) => kg * 2.20462,
  lbsToKg: (lbs) => lbs / 2.20462,
  
  convert: (value, from, to) => {
    if (from === to) return value;
    
    switch (`${from}-${to}`) {
      case 'kg-lbs': return weight.kgToLbs(value);
      case 'lbs-kg': return weight.lbsToKg(value);
      default: return value;
    }
  }
};

// ============= CARBURANT =============
export const fuel = {
  // Densités standard
  AVGAS_DENSITY: 0.72,  // kg/L
  JET_A1_DENSITY: 0.84, // kg/L
  
  // Conversions volume
  ltrToGal: (ltr) => ltr * 0.264172,
  galToLtr: (gal) => gal / 0.264172,
  
  // Conversions poids (nécessite la densité)
  ltrToKg: (ltr, density = 0.72) => ltr * density,
  kgToLtr: (kg, density = 0.72) => kg / density,
  ltrToLbs: (ltr, density = 0.72) => weight.kgToLbs(ltr * density),
  lbsToLtr: (lbs, density = 0.72) => weight.lbsToKg(lbs) / density,
  
  convert: (value, from, to, fuelType = 'AVGAS') => {
    if (from === to) return value;
    
    const density = fuelType === 'JET A-1' ? fuel.JET_A1_DENSITY : fuel.AVGAS_DENSITY;
    
    // Convertir d'abord en litres
    let ltr = value;
    switch (from) {
      case 'gal': ltr = fuel.galToLtr(value); break;
      case 'kg': ltr = fuel.kgToLtr(value, density); break;
      case 'lbs': ltr = fuel.lbsToLtr(value, density); break;
      case 'ltr': ltr = value; break;
      default: return value;
    }
    
    // Puis convertir vers l'unité cible
    switch (to) {
      case 'ltr': return ltr;
      case 'gal': return fuel.ltrToGal(ltr);
      case 'kg': return fuel.ltrToKg(ltr, density);
      case 'lbs': return fuel.ltrToLbs(ltr, density);
      default: return value;
    }
  }
};

// ============= PRESSION =============
export const pressure = {
  hPaToInHg: (hPa) => hPa * 0.02953,
  inHgToHPa: (inHg) => inHg / 0.02953,
  hPaToMb: (hPa) => hPa, // 1 hPa = 1 mb
  mbToHPa: (mb) => mb,
  
  convert: (value, from, to) => {
    if (from === to) return value;
    
    // Convertir d'abord en hPa
    let hPa = value;
    switch (from) {
      case 'inHg': hPa = pressure.inHgToHPa(value); break;
      case 'mb': hPa = pressure.mbToHPa(value); break;
      case 'hPa': hPa = value; break;
      default: return value;
    }
    
    // Puis convertir vers l'unité cible
    switch (to) {
      case 'hPa': return hPa;
      case 'inHg': return pressure.hPaToInHg(hPa);
      case 'mb': return pressure.hPaToMb(hPa);
      default: return value;
    }
  }
};

// ============= TEMPÉRATURE =============
export const temperature = {
  cToF: (c) => (c * 9/5) + 32,
  fToC: (f) => (f - 32) * 5/9,
  
  convert: (value, from, to) => {
    if (from === to) return value;
    
    switch (`${from}-${to}`) {
      case 'C-F': return temperature.cToF(value);
      case 'F-C': return temperature.fToC(value);
      default: return value;
    }
  }
};

// ============= CONSOMMATION =============
export const fuelConsumption = {
  lphToGph: (lph) => lph * 0.264172,
  gphToLph: (gph) => gph / 0.264172,
  
  convert: (value, from, to) => {
    if (from === to) return value;
    
    switch (`${from}-${to}`) {
      case 'lph-gph': return fuelConsumption.lphToGph(value);
      case 'gph-lph': return fuelConsumption.gphToLph(value);
      default: return value;
    }
  }
};

// ============= COORDONNÉES =============
export const coordinates = {
  // DMS vers DD
  dmsToDD: (degrees, minutes, seconds, direction) => {
    let dd = degrees + minutes/60 + seconds/3600;
    if (direction === 'S' || direction === 'W') dd = dd * -1;
    return dd;
  },
  
  // DD vers DMS
  ddToDMS: (dd) => {
    const absolute = Math.abs(dd);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = Math.round((minutesDecimal - minutes) * 60);
    
    return {
      degrees,
      minutes,
      seconds,
      direction: dd >= 0 ? (dd === Math.abs(dd) ? 'N' : 'E') : (dd === -Math.abs(dd) ? 'S' : 'W')
    };
  },
  
  // Formatage DMS
  formatDMS: (dd, isLatitude = true) => {
    const dms = coordinates.ddToDMS(dd);
    const dir = isLatitude ? (dd >= 0 ? 'N' : 'S') : (dd >= 0 ? 'E' : 'W');
    return `${dms.degrees}°${String(dms.minutes).padStart(2, '0')}'${String(dms.seconds).padStart(2, '0')}"${dir}`;
  },
  
  // Formatage DD
  formatDD: (dd, decimals = 6) => {
    return dd.toFixed(decimals);
  }
};

// ============= FONCTION GÉNÉRALE DE CONVERSION =============
export const convertValue = (value, category, fromUnit, toUnit, options = {}) => {
  if (!value || isNaN(value)) return value;
  
  switch (category) {
    case 'distance':
    case 'runway':
    case 'visibility':
      return distance.convert(value, fromUnit, toUnit);
    
    case 'altitude':
      return altitude.convert(value, fromUnit, toUnit);
    
    case 'speed':
    case 'windSpeed':
      return speed.convert(value, fromUnit, toUnit);
    
    case 'weight':
      return weight.convert(value, fromUnit, toUnit);
    
    case 'fuel':
      return fuel.convert(value, fromUnit, toUnit, options.fuelType);
    
    case 'pressure':
      return pressure.convert(value, fromUnit, toUnit);
    
    case 'temperature':
      return temperature.convert(value, fromUnit, toUnit);
    
    case 'fuelConsumption':
      return fuelConsumption.convert(value, fromUnit, toUnit);
    
    default:
      return value;
  }
};

// ============= FORMATAGE AVEC UNITÉS =============
export const formatWithUnit = (value, unit, decimals = 1) => {
  if (value === null || value === undefined) return '-';
  
  const formatted = typeof value === 'number' ? value.toFixed(decimals) : value;
  
  // Symboles d'unités
  const symbols = {
    // Distance
    'nm': 'NM',
    'km': 'km',
    'mi': 'mi',
    'm': 'm',
    
    // Altitude
    'ft': 'ft',
    'FL': 'FL',
    
    // Vitesse
    'kt': 'kt',
    'km/h': 'km/h',
    'mph': 'mph',
    'm/s': 'm/s',
    
    // Poids
    'kg': 'kg',
    'lbs': 'lbs',
    
    // Carburant
    'ltr': 'L',
    'gal': 'gal',
    
    // Pression
    'hPa': 'hPa',
    'inHg': 'inHg',
    'mb': 'mb',
    
    // Température
    'C': '°C',
    'F': '°F',
    
    // Consommation
    'lph': 'L/h',
    'gph': 'gal/h'
  };
  
  return `${formatted} ${symbols[unit] || unit}`;
};