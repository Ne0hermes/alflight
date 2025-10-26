// src/utils/aircraftNormalizer.js
// Système de normalisation des unités pour les avions importés/exportés

import { Conversions } from './conversions';

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
      const sourceUnit = sourceUnits[property] || STORAGE_UNITS[property];
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

    normalized.weightBalance = {
      emptyWeightArm: parseArm(aircraftData.arms.empty),
      fuelArm: parseArm(aircraftData.arms.fuelMain),
      frontLeftSeatArm: parseArm(aircraftData.arms.frontSeats),
      frontRightSeatArm: parseArm(aircraftData.arms.frontSeats),
      rearLeftSeatArm: parseArm(aircraftData.arms.rearSeats),
      rearRightSeatArm: parseArm(aircraftData.arms.rearSeats),
      baggageArm: parseArm(aircraftData.arms.baggageFwd),
      auxiliaryArm: parseArm(aircraftData.arms.baggageAft),
      // Conserver aussi les données CG limits si présentes
      ...(aircraftData.weightBalance || {})
    };
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

  // Supprimer _metadata de l'objet normalisé (déjà utilisé pour la conversion)
  delete normalized._metadata;

  console.log('✅ [Normalizer] Aircraft normalized for storage');

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
        exported[property] = convertValue(value, property, sourceUnit, targetUnit);

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
    // Utiliser le système de conversion existant
    return Conversions[category](value, fromUnit, toUnit);
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
  hasUnitsMetadata,
  getAircraftMetadata,
  STORAGE_UNITS,
  METADATA_VERSION
};
