// src/features/aircraft/utils/performanceCharts.js

/**
 * Système de gestion des abaques de performances
 * Gère l'extraction, le stockage et l'interpolation des données de performances
 * basées sur les conditions atmosphériques et l'altitude
 */

/**
 * Structure d'un abaque de performances
 * @typedef {Object} PerformanceChart
 * @property {string} type - Type d'abaque (takeoff_distance, landing_distance, climb_rate, etc.)
 * @property {Array} pressureAltitudes - Altitudes pression de référence (pieds)
 * @property {Array} temperatures - Températures de référence (°C)
 * @property {Array} weights - Masses de référence (kg)
 * @property {Object} data - Données tabulaires {altitude: {temp: {weight: value}}}
 * @property {string} unit - Unité de la valeur (m, ft, fpm, etc.)
 * @property {Object} corrections - Facteurs de correction additionnels
 */

/**
 * Extrait les tables de performances depuis le texte du MANEX
 * Recherche les patterns de tables avec altitude/température
 */
export const extractPerformanceCharts = (text) => {
  const charts = {
    takeoffDistance: null,
    takeoffRoll: null,
    landingDistance: null,
    landingRoll: null,
    climbRate: null,
    serviceCeiling: null
  };

  // Pattern pour détecter les tables de décollage
  const takeoffTablePattern = /(?:TAKEOFF|DÉCOLLAGE|Take-off)[\s\S]{0,500}?(?:ALTITUDE|ALT)[\s\S]{0,50}?(?:°C|TEMP|ISA)([\s\S]{0,3000}?)(?:LANDING|ATTERRISSAGE|NOTE|CAUTION)/gi;
  
  // Pattern pour détecter les tables d'atterrissage
  const landingTablePattern = /(?:LANDING|ATTERRISSAGE)[\s\S]{0,500}?(?:ALTITUDE|ALT)[\s\S]{0,50}?(?:°C|TEMP|ISA)([\s\S]{0,3000}?)(?:CLIMB|MONTÉE|NOTE|CAUTION)/gi;

  // Extraction des tables de décollage
  const takeoffMatch = text.match(takeoffTablePattern);
  if (takeoffMatch) {
    charts.takeoffDistance = parsePerformanceTable(takeoffMatch[0], 'takeoff_distance');
    charts.takeoffRoll = parsePerformanceTable(takeoffMatch[0], 'takeoff_roll');
  }

  // Extraction des tables d'atterrissage
  const landingMatch = text.match(landingTablePattern);
  if (landingMatch) {
    charts.landingDistance = parsePerformanceTable(landingMatch[0], 'landing_distance');
    charts.landingRoll = parsePerformanceTable(landingMatch[0], 'landing_roll');
  }

  // Extraction des taux de montée
  const climbPattern = /(?:RATE OF CLIMB|TAUX DE MONTÉE|Climb)[\s\S]{0,500}?(?:ALTITUDE|ALT)[\s\S]{0,50}?(?:°C|TEMP|ISA)([\s\S]{0,2000}?)(?:CRUISE|CROISIÈRE|NOTE)/gi;
  const climbMatch = text.match(climbPattern);
  if (climbMatch) {
    charts.climbRate = parsePerformanceTable(climbMatch[0], 'climb_rate');
  }

  return charts;
};

/**
 * Parse une table de performances extraite du MANEX
 */
const parsePerformanceTable = (tableText, type) => {
  const chart = {
    type,
    pressureAltitudes: [],
    temperatures: [],
    weights: [],
    data: {},
    unit: detectUnit(tableText, type),
    corrections: extractCorrections(tableText)
  };

  // Extraction des altitudes pression (généralement en lignes)
  const altitudePattern = /(?:^|\n)\s*(\d{1,5})\s*(?:ft|FT|')/gm;
  let match;
  while ((match = altitudePattern.exec(tableText)) !== null) {
    const alt = parseInt(match[1]);
    if (alt <= 20000 && !chart.pressureAltitudes.includes(alt)) {
      chart.pressureAltitudes.push(alt);
    }
  }
  chart.pressureAltitudes.sort((a, b) => a - b);

  // Extraction des températures (généralement en colonnes)
  const tempPattern = /(-?\d{1,2})\s*°C/g;
  while ((match = tempPattern.exec(tableText)) !== null) {
    const temp = parseInt(match[1]);
    if (temp >= -40 && temp <= 50 && !chart.temperatures.includes(temp)) {
      chart.temperatures.push(temp);
    }
  }
  chart.temperatures.sort((a, b) => a - b);

  // Extraction des masses si présentes
  const weightPattern = /(\d{3,4})\s*(?:kg|KG|lbs|LBS)/g;
  while ((match = weightPattern.exec(tableText)) !== null) {
    const weight = parseInt(match[1]);
    if (weight >= 500 && weight <= 10000 && !chart.weights.includes(weight)) {
      chart.weights.push(weight);
    }
  }
  chart.weights.sort((a, b) => a - b);

  // Extraction des valeurs de la table
  // Pattern pour trouver les valeurs numériques dans la table
  const valuePattern = /\b(\d{2,4})\b/g;
  const values = [];
  while ((match = valuePattern.exec(tableText)) !== null) {
    const value = parseInt(match[1]);
    // Filtrer les valeurs qui sont probablement des données de performance
    if (value >= 50 && value <= 9999 && 
        !chart.pressureAltitudes.includes(value) &&
        !chart.temperatures.includes(value) &&
        !chart.weights.includes(value)) {
      values.push(value);
    }
  }

  // Créer une structure de données simple si on a des valeurs
  if (values.length > 0 && chart.pressureAltitudes.length > 0 && chart.temperatures.length > 0) {
    let valueIndex = 0;
    
    chart.pressureAltitudes.forEach(alt => {
      chart.data[alt] = {};
      chart.temperatures.forEach(temp => {
        if (valueIndex < values.length) {
          chart.data[alt][temp] = values[valueIndex++];
        }
      });
    });
  }

  return chart;
};

/**
 * Détecte l'unité utilisée dans la table
 */
const detectUnit = (text, type) => {
  if (type.includes('distance') || type.includes('roll')) {
    if (text.match(/\bm\b|\bmètres?\b|\bmeters?\b/i)) return 'm';
    if (text.match(/\bft\b|\bfeet\b|\bpieds?\b/i)) return 'ft';
  }
  if (type.includes('climb')) {
    if (text.match(/\bfpm\b|\bft\/min\b/i)) return 'fpm';
    if (text.match(/\bm\/s\b/i)) return 'm/s';
  }
  return 'unknown';
};

/**
 * Extrait les facteurs de correction additionnels
 */
const extractCorrections = (text) => {
  const corrections = {};

  // Correction pour vent
  const headwindPattern = /(?:headwind|vent de face)[\s\S]{0,50}?(-?\d+)\s*%/i;
  const headwindMatch = text.match(headwindPattern);
  if (headwindMatch) {
    corrections.headwindFactor = parseFloat(headwindMatch[1]) / 100;
  }

  const tailwindPattern = /(?:tailwind|vent arrière)[\s\S]{0,50}?(\+?\d+)\s*%/i;
  const tailwindMatch = text.match(tailwindPattern);
  if (tailwindMatch) {
    corrections.tailwindFactor = parseFloat(tailwindMatch[1]) / 100;
  }

  // Correction pour pente de piste
  const slopePattern = /(?:slope|pente)[\s\S]{0,50}?(\d+)\s*%[\s\S]{0,30}?(\+?\d+)\s*%/i;
  const slopeMatch = text.match(slopePattern);
  if (slopeMatch) {
    corrections.slopeFactor = parseFloat(slopeMatch[2]) / 100;
  }

  // Correction pour état de piste
  if (text.match(/(?:grass|herbe|gazon)/i)) {
    corrections.grassFactor = 1.15; // +15% typique pour herbe
  }
  if (text.match(/(?:wet|mouillée?|humide)/i)) {
    corrections.wetFactor = 1.10; // +10% typique pour piste mouillée
  }
  if (text.match(/(?:contaminated|contaminée?|slush|neige)/i)) {
    corrections.contaminatedFactor = 1.25; // +25% typique pour piste contaminée
  }

  return corrections;
};

/**
 * Interpole une valeur dans un abaque de performances
 * @param {PerformanceChart} chart - L'abaque de performances
 * @param {number} altitude - Altitude pression en pieds
 * @param {number} temperature - Température en °C
 * @param {number} weight - Masse en kg (optionnel)
 * @returns {number} Valeur interpolée
 */
export const interpolatePerformance = (chart, altitude, temperature, weight = null) => {
  if (!chart || !chart.data || Object.keys(chart.data).length === 0) {
    return null;
  }

  // Trouver les altitudes encadrantes
  const altitudes = chart.pressureAltitudes;
  let lowerAlt = altitudes[0];
  let upperAlt = altitudes[altitudes.length - 1];
  
  for (let i = 0; i < altitudes.length - 1; i++) {
    if (altitude >= altitudes[i] && altitude <= altitudes[i + 1]) {
      lowerAlt = altitudes[i];
      upperAlt = altitudes[i + 1];
      break;
    }
  }

  // Trouver les températures encadrantes
  const temps = chart.temperatures;
  let lowerTemp = temps[0];
  let upperTemp = temps[temps.length - 1];
  
  for (let i = 0; i < temps.length - 1; i++) {
    if (temperature >= temps[i] && temperature <= temps[i + 1]) {
      lowerTemp = temps[i];
      upperTemp = temps[i + 1];
      break;
    }
  }

  // Interpolation bilinéaire
  const v11 = chart.data[lowerAlt]?.[lowerTemp] || 0;
  const v12 = chart.data[lowerAlt]?.[upperTemp] || 0;
  const v21 = chart.data[upperAlt]?.[lowerTemp] || 0;
  const v22 = chart.data[upperAlt]?.[upperTemp] || 0;

  if (lowerAlt === upperAlt && lowerTemp === upperTemp) {
    return v11;
  }

  let result;
  if (lowerAlt === upperAlt) {
    // Interpolation simple en température
    const tempRatio = (temperature - lowerTemp) / (upperTemp - lowerTemp || 1);
    result = v11 + (v12 - v11) * tempRatio;
  } else if (lowerTemp === upperTemp) {
    // Interpolation simple en altitude
    const altRatio = (altitude - lowerAlt) / (upperAlt - lowerAlt || 1);
    result = v11 + (v21 - v11) * altRatio;
  } else {
    // Interpolation bilinéaire complète
    const altRatio = (altitude - lowerAlt) / (upperAlt - lowerAlt);
    const tempRatio = (temperature - lowerTemp) / (upperTemp - lowerTemp);
    
    const v1 = v11 + (v12 - v11) * tempRatio;
    const v2 = v21 + (v22 - v21) * tempRatio;
    result = v1 + (v2 - v1) * altRatio;
  }

  // Si on a une masse, appliquer une correction proportionnelle
  if (weight && chart.weights.length > 0) {
    const refWeight = chart.weights[Math.floor(chart.weights.length / 2)]; // Poids de référence médian
    const weightRatio = weight / refWeight;
    result *= Math.pow(weightRatio, 0.5); // Correction approximative
  }

  return Math.round(result);
};

/**
 * Applique les corrections environnementales à une valeur de performance
 */
export const applyEnvironmentalCorrections = (baseValue, corrections, conditions) => {
  let correctedValue = baseValue;

  // Correction pour le vent
  if (conditions.headwind && corrections.headwindFactor) {
    // Vent de face réduit les distances
    correctedValue *= (1 - (corrections.headwindFactor * conditions.headwind / 10));
  }
  if (conditions.tailwind && corrections.tailwindFactor) {
    // Vent arrière augmente les distances
    correctedValue *= (1 + (corrections.tailwindFactor * conditions.tailwind / 10));
  }

  // Correction pour la pente
  if (conditions.slope && corrections.slopeFactor) {
    correctedValue *= (1 + (corrections.slopeFactor * conditions.slope));
  }

  // Correction pour l'état de piste
  if (conditions.surfaceCondition) {
    switch (conditions.surfaceCondition) {
      case 'grass':
        correctedValue *= corrections.grassFactor || 1.15;
        break;
      case 'wet':
        correctedValue *= corrections.wetFactor || 1.10;
        break;
      case 'contaminated':
        correctedValue *= corrections.contaminatedFactor || 1.25;
        break;
    }
  }

  return Math.round(correctedValue);
};

/**
 * Calcule l'altitude densité à partir des conditions atmosphériques
 */
export const calculateDensityAltitude = (pressureAltitude, temperature, qnh = 1013.25) => {
  // Correction pour QNH
  const qnhCorrection = (1013.25 - qnh) * 30;
  const correctedAltitude = pressureAltitude + qnhCorrection;
  
  // ISA température standard à cette altitude
  const isaTemp = 15 - (2 * correctedAltitude / 1000);
  
  // Écart de température par rapport à ISA
  const tempDeviation = temperature - isaTemp;
  
  // Altitude densité (approximation : 120ft par degré d'écart)
  const densityAltitude = correctedAltitude + (tempDeviation * 120);
  
  return Math.round(densityAltitude);
};

/**
 * Génère un abaque exemple si aucune donnée n'est extraite
 * Utilise des valeurs typiques pour un avion léger
 */
export const generateDefaultChart = (type, aircraftCategory = 'light') => {
  const chart = {
    type,
    pressureAltitudes: [0, 2000, 4000, 6000, 8000, 10000],
    temperatures: [-20, -10, 0, 10, 20, 30, 40],
    data: {},
    unit: type.includes('distance') ? 'm' : 'fpm',
    corrections: {
      headwindFactor: -0.10,  // -10% par 10kt de vent de face
      tailwindFactor: 0.15,   // +15% par 10kt de vent arrière
      slopeFactor: 0.10,      // +10% par 1% de pente montante
      grassFactor: 1.15,
      wetFactor: 1.10,
      contaminatedFactor: 1.25
    }
  };

  // Générer des données typiques basées sur le type et la catégorie d'avion
  const baseValues = getBaseValues(type, aircraftCategory);
  
  chart.pressureAltitudes.forEach(alt => {
    chart.data[alt] = {};
    chart.temperatures.forEach(temp => {
      // Formule empirique pour ajuster les performances
      const altFactor = 1 + (alt / 10000) * 0.3;  // +30% à 10000ft
      const tempFactor = 1 + ((temp - 15) / 30) * 0.15;  // +15% pour +30°C au-dessus d'ISA
      
      chart.data[alt][temp] = Math.round(baseValues.base * altFactor * tempFactor);
    });
  });

  return chart;
};

/**
 * Valeurs de base typiques selon le type de performance et la catégorie d'avion
 */
const getBaseValues = (type, category) => {
  const values = {
    light: {
      takeoff_distance: { base: 400 },
      takeoff_roll: { base: 250 },
      landing_distance: { base: 450 },
      landing_roll: { base: 200 },
      climb_rate: { base: 700 }
    },
    medium: {
      takeoff_distance: { base: 800 },
      takeoff_roll: { base: 500 },
      landing_distance: { base: 700 },
      landing_roll: { base: 400 },
      climb_rate: { base: 1000 }
    },
    heavy: {
      takeoff_distance: { base: 1800 },
      takeoff_roll: { base: 1200 },
      landing_distance: { base: 1500 },
      landing_roll: { base: 800 },
      climb_rate: { base: 1500 }
    }
  };

  return values[category]?.[type] || values.light[type] || { base: 500 };
};

export default {
  extractPerformanceCharts,
  interpolatePerformance,
  applyEnvironmentalCorrections,
  calculateDensityAltitude,
  generateDefaultChart
};