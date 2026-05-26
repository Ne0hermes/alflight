// src/utils/aircraftNormalizer.js
// Système de normalisation des unités pour les avions importés/exportés

import { convertValue as convertUnit } from './unitConversions';

/**
 * Unités de stockage interne (normalisées)
 * Toutes les données sont stockées dans ces unités pour garantir la cohérence
 */
const STORAGE_UNITS = {
  fuelConsumption: 'lph',  // Litres par heure
  fuelCapacity: 'ltr',     // Litres
  cruiseSpeed: 'kt',       // Nœuds (pas de conversion nécessaire)
  maxSpeed: 'kt',
  climbRate: 'fpm',        // Feet per minute
  serviceCeiling: 'ft',    // Feet
  range: 'nm',             // Nautical miles
  weight: 'kg',            // Kilogrammes
  emptyWeight: 'kg',
  maxTakeoffWeight: 'kg'
};

/**
 * Version du système de métadonnées
 */
const METADATA_VERSION = '1.0';

/**
 * Normaliser un avion importé vers les unités de stockage
 * @param {Object} aircraftData - Données de l'avion importé
 * @returns {Object} Avion normalisé avec unités de stockage
 */
export function normalizeAircraftImport(aircraftData) {
  if (!aircraftData) return null;

  // Extraire les métadonnées d'unités
  const metadata = aircraftData._metadata || {};
  const sourceUnits = metadata.units || {};

  console.log('🔄 [Normalizer] Import aircraft:', {
    registration: aircraftData.registration,
    sourceMetadata: metadata,
    hasMetadata: !!aircraftData._metadata
  });

  // Créer une copie de l'avion
  const normalized = { ...aircraftData };

  // Normaliser chaque propriété avec conversion si nécessaire
  Object.keys(STORAGE_UNITS).forEach(property => {
    if (aircraftData[property] !== undefined && aircraftData[property] !== null) {
      const value = aircraftData[property];

      // 🔧 FIX: Utiliser getUserUnit pour mapper property → catégorie → unité
      // property = 'fuelCapacity' → category = 'fuel' → sourceUnits['fuel'] = 'gal'
      const sourceUnit = getUserUnit(property, sourceUnits);
      const targetUnit = STORAGE_UNITS[property];

      // Si l'unité source est différente de l'unité de stockage, convertir
      if (sourceUnit !== targetUnit) {
        normalized[property] = convertValue(value, property, sourceUnit, targetUnit);

        console.log(`  ✓ ${property}: ${value} ${sourceUnit} → ${normalized[property].toFixed(2)} ${targetUnit}`);
      } else {
        normalized[property] = value;
        console.log(`  = ${property}: ${value} ${targetUnit} (pas de conversion)`);
      }
    }
  });

  // 🔧 MAPPING CRITIQUE : Mapper "arms" → "weightBalance" pour compatibilité
  // Les données Supabase utilisent "arms" mais le code attend "weightBalance"
  if (aircraftData.arms) {
    console.log('🔄 [Normalizer] Found arms data:', aircraftData.arms);

    // Helper pour parser et éviter NaN (parseFloat('') = NaN)
    const parseArm = (value, defaultValue = 0) => {
      if (!value || value === '') return defaultValue;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    // Helper pour parser null values (permettre null mais pas NaN)
    const parseOrNull = (value) => {
      if (!value || value === '' || value === '0') return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    const armsToWB = {
      emptyWeightArm: parseArm(aircraftData.arms.empty),
      fuelArm: parseArm(aircraftData.arms.fuelMain),
      frontLeftSeatArm: parseArm(aircraftData.arms.frontSeats),
      frontRightSeatArm: parseArm(aircraftData.arms.frontSeats),
      rearLeftSeatArm: parseArm(aircraftData.arms.rearSeats),
      rearRightSeatArm: parseArm(aircraftData.arms.rearSeats),
      baggageArm: parseArm(aircraftData.arms.baggageFwd),
      auxiliaryArm: parseArm(aircraftData.arms.baggageAft)
    };

    console.log('  - Mapped from arms:', armsToWB);
    console.log('  - Existing weightBalance:', aircraftData.weightBalance);

    // 🔧 FIX CRITIQUE: Créer cgLimits depuis cgEnvelope si manquant
    let cgLimits = aircraftData.weightBalance?.cgLimits || aircraftData.cgLimits;

    // Si cgLimits n'existe pas ou est invalide, mapper depuis cgEnvelope
    if (!cgLimits || (cgLimits.forward === undefined && cgLimits.aft === undefined)) {
      console.log('  ⚠️ cgLimits manquant, tentative de mapping depuis cgEnvelope...');

      if (aircraftData.cgEnvelope) {
        cgLimits = {
          forward: parseOrNull(aircraftData.cgEnvelope.forwardPoints?.[0]?.cg),
          aft: parseOrNull(aircraftData.cgEnvelope.aftCG),
          forwardVariable: aircraftData.cgEnvelope.forwardPoints || []
        };
        console.log('  ✅ cgLimits créé depuis cgEnvelope:', cgLimits);
      } else {
        // Dernier fallback: null (désactive la vérification CG)
        cgLimits = {
          forward: null,
          aft: null,
          forwardVariable: []
        };
        console.warn('  ⚠️ Aucune donnée cgEnvelope disponible, cgLimits = null');
      }
    } else {
      console.log('  ✅ cgLimits déjà présent:', cgLimits);
    }

    // ✅ FIX: Only preserve cgLimits from old weightBalance, arms data is source of truth
    normalized.weightBalance = {
      ...armsToWB,
      cgLimits: cgLimits
    };

    console.log('  - Final weightBalance after merge:', normalized.weightBalance);
    console.log('  ✅ [Normalizer] Arms data preserved as source of truth');

    console.log('✓ [Normalizer] Mapped arms → weightBalance:', normalized.weightBalance);
  } else {
    console.warn('⚠️ [Normalizer] No arms data found in aircraftData');
  }

  // 🔧 Conserver aussi armLengths si déjà présent (compatibilité)
  if (aircraftData.armLengths) {
    normalized.armLengths = aircraftData.armLengths;
  }

  // 🔧 Conserver baggageCompartments (données dynamiques)
  if (aircraftData.baggageCompartments) {
    normalized.baggageCompartments = aircraftData.baggageCompartments.map(comp => ({
      ...comp,
      arm: parseFloat(comp.arm) || 0,
      maxWeight: parseFloat(comp.maxWeight) || 0
    }));
    console.log('✓ Preserved baggageCompartments:', normalized.baggageCompartments.length);
  }

  // 🔧 AJOUTER métadonnées avec unités de STOCKAGE
  // Supabase stocke TOUJOURS en unités standard (L, L/h, kg, kt)
  // Les conversions se font LOCALEMENT selon les préférences de chaque utilisateur
  const storageUnitsMetadata = {
    fuel: 'ltr',           // fuelCapacity → ltr
    fuelConsumption: 'lph', // fuelConsumption → lph
    speed: 'kt',           // cruiseSpeed, maxSpeed → kt
    verticalSpeed: 'fpm',  // climbRate → fpm
    altitude: 'ft',        // serviceCeiling → ft
    distance: 'nm',        // range → nm
    weight: 'kg'           // emptyWeight, maxTakeoffWeight → kg
  };

  normalized._metadata = {
    version: '1.0.0',
    units: storageUnitsMetadata,  // Format préférences (fuel, fuelConsumption, etc.)
    normalizedAt: new Date().toISOString(),
    sourceUnits: sourceUnits  // Conserver trace des unités source (optionnel)
  };

  console.log('✅ [Normalizer] Aircraft normalized for storage with metadata:', {
    units: storageUnitsMetadata
  });

  return normalized;
}

/**
 * Préparer un avion pour l'export avec les métadonnées d'unités
 * @param {Object} aircraftData - Données de l'avion (en unités de stockage)
 * @param {Object} userUnits - Préférences d'unités de l'utilisateur
 * @returns {Object} Avion avec métadonnées pour l'export
 */
export function prepareAircraftExport(aircraftData, userUnits) {
  if (!aircraftData) return null;

  console.log('📤 [Normalizer] Preparing export:', {
    registration: aircraftData.registration,
    userUnits: userUnits
  });

  // Créer une copie de l'avion
  const exported = { ...aircraftData };

  // Convertir chaque propriété vers les unités de l'utilisateur
  Object.keys(STORAGE_UNITS).forEach(property => {
    if (aircraftData[property] !== undefined && aircraftData[property] !== null) {
      const value = aircraftData[property];
      const sourceUnit = STORAGE_UNITS[property];
      const targetUnit = getUserUnit(property, userUnits);

      // Convertir si nécessaire
      if (sourceUnit !== targetUnit) {
        let converted = convertValue(value, property, sourceUnit, targetUnit);

        // 🔧 FIX: Arrondir intelligemment pour éviter 38.99997 → 39.00
        // Si la valeur est très proche d'un entier (< 0.01), arrondir
        const rounded = Math.round(converted);
        if (Math.abs(converted - rounded) < 0.01) {
          converted = rounded;
        }

        exported[property] = converted;

        console.log(`  ✓ ${property}: ${value} ${sourceUnit} → ${exported[property].toFixed(2)} ${targetUnit}`);
      } else {
        exported[property] = value;
        console.log(`  = ${property}: ${value} ${targetUnit} (pas de conversion)`);
      }
    }
  });

  // Ajouter les métadonnées
  exported._metadata = {
    version: METADATA_VERSION,
    units: buildUnitsMetadata(userUnits),
    exportedAt: new Date().toISOString(),
    exportedBy: 'ALFlight-User' // TODO: Récupérer l'ID utilisateur réel
  };

  console.log('✅ [Normalizer] Aircraft prepared for export with metadata');

  return exported;
}

/**
 * Convertir une valeur d'une unité à une autre
 * @param {number} value - Valeur à convertir
 * @param {string} property - Nom de la propriété (ex: 'fuelConsumption')
 * @param {string} fromUnit - Unité source
 * @param {string} toUnit - Unité cible
 * @returns {number} Valeur convertie
 */
function convertValue(value, property, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;

  // Mapping des propriétés vers les catégories de conversion
  const categoryMap = {
    fuelConsumption: 'fuelConsumption',
    fuelCapacity: 'fuel',
    cruiseSpeed: 'speed',
    maxSpeed: 'speed',
    climbRate: 'verticalSpeed',
    serviceCeiling: 'altitude',
    range: 'distance',
    weight: 'weight',
    emptyWeight: 'weight',
    maxTakeoffWeight: 'weight'
  };

  const category = categoryMap[property];
  if (!category) {
    console.warn(`⚠️ Unknown property for conversion: ${property}`);
    return value;
  }

  try {
    // Utiliser le système de conversion existant (unitConversions.js)
    return convertUnit(value, fromUnit, toUnit, category);
  } catch (error) {
    console.error(`❌ Conversion error for ${property}:`, error);
    return value; // Retourner la valeur originale en cas d'erreur
  }
}

/**
 * Obtenir l'unité préférée de l'utilisateur pour une propriété
 * @param {string} property - Nom de la propriété
 * @param {Object} userUnits - Préférences d'unités
 * @returns {string} Unité préférée
 */
function getUserUnit(property, userUnits) {
  // Mapping des propriétés vers les catégories de préférences
  const preferenceMap = {
    fuelConsumption: 'fuelConsumption',
    fuelCapacity: 'fuel',
    cruiseSpeed: 'speed',
    maxSpeed: 'speed',
    climbRate: 'verticalSpeed',
    serviceCeiling: 'altitude',
    range: 'distance',
    weight: 'weight',
    emptyWeight: 'weight',
    maxTakeoffWeight: 'weight'
  };

  const preference = preferenceMap[property];
  return userUnits[preference] || STORAGE_UNITS[property];
}

/**
 * Construire les métadonnées d'unités pour l'export
 * @param {Object} userUnits - Préférences d'unités
 * @returns {Object} Métadonnées d'unités
 */
function buildUnitsMetadata(userUnits) {
  return {
    fuelConsumption: userUnits.fuelConsumption || 'lph',
    fuelCapacity: userUnits.fuel || 'ltr',
    cruiseSpeed: 'kt',
    maxSpeed: 'kt',
    climbRate: userUnits.verticalSpeed || 'fpm',
    serviceCeiling: userUnits.altitude || 'ft',
    range: userUnits.distance || 'nm',
    weight: userUnits.weight || 'kg',
    emptyWeight: userUnits.weight || 'kg',
    maxTakeoffWeight: userUnits.weight || 'kg'
  };
}

/**
 * Convertir un avion d'un système d'unités à un autre
 * @param {Object} aircraftData - Données de l'avion
 * @param {Object} sourceUnits - Unités source (format: { fuel: 'gal', fuelConsumption: 'gph', ... })
 * @param {Object} targetUnits - Unités cible (format: { fuel: 'ltr', fuelConsumption: 'lph', ... })
 * @returns {Object} Avion avec valeurs converties
 */
export function convertAircraftUnits(aircraftData, sourceUnits, targetUnits) {
  if (!aircraftData) return null;

  console.log('🔄 [convertAircraftUnits] Converting aircraft:', {
    registration: aircraftData.registration,
    from: sourceUnits,
    to: targetUnits
  });

  // Créer une copie de l'avion
  const converted = { ...aircraftData };

  // Mapping des préférences d'unités vers les propriétés aircraft
  const unitsToPropertiesMap = {
    fuel: ['fuelCapacity'],
    fuelConsumption: ['fuelConsumption'],
    speed: ['cruiseSpeed', 'maxSpeed'],
    verticalSpeed: ['climbRate'],
    altitude: ['serviceCeiling'],
    distance: ['range'],
    weight: ['weight', 'emptyWeight', 'maxTakeoffWeight']
  };

  // Convertir chaque catégorie d'unités
  Object.keys(unitsToPropertiesMap).forEach(category => {
    const sourceUnit = sourceUnits[category];
    const targetUnit = targetUnits[category];

    // Si les unités sont différentes, convertir toutes les propriétés de cette catégorie
    if (sourceUnit && targetUnit && sourceUnit !== targetUnit) {
      unitsToPropertiesMap[category].forEach(property => {
        if (aircraftData[property] !== undefined && aircraftData[property] !== null) {
          const value = parseFloat(aircraftData[property]);

          if (!isNaN(value)) {
            const convertedValue = convertValue(value, property, sourceUnit, targetUnit);
            converted[property] = convertedValue;

            console.log(`  ✓ ${property}: ${value} ${sourceUnit} → ${convertedValue.toFixed(2)} ${targetUnit}`);
          }
        }
      });
    }
  });

  // Mettre à jour les métadonnées avec les nouvelles unités
  converted._metadata = {
    ...converted._metadata,
    units: targetUnits,
    convertedAt: new Date().toISOString()
  };

  return converted;
}

/**
 * Vérifier si un avion a des métadonnées d'unités
 * @param {Object} aircraftData - Données de l'avion
 * @returns {boolean}
 */
export function hasUnitsMetadata(aircraftData) {
  return !!(aircraftData && aircraftData._metadata && aircraftData._metadata.units);
}

/**
 * Obtenir les métadonnées d'un avion
 * @param {Object} aircraftData - Données de l'avion
 * @returns {Object|null}
 */
export function getAircraftMetadata(aircraftData) {
  return aircraftData?._metadata || null;
}

export default {
  normalizeAircraftImport,
  prepareAircraftExport,
  convertAircraftUnits,
  hasUnitsMetadata,
  getAircraftMetadata,
  STORAGE_UNITS,
  METADATA_VERSION
};
