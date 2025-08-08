// src/utils/aircraftValidation.js
// Utilitaires pour valider et réparer les données d'avion

/**
 * Valeurs par défaut pour les données de masse et centrage
 */
const DEFAULT_WEIGHT_BALANCE = {
  frontLeftSeatArm: 2.00,
  frontRightSeatArm: 2.00,
  rearLeftSeatArm: 2.90,
  rearRightSeatArm: 2.90,
  baggageArm: 3.50,
  auxiliaryArm: 3.70,
  fuelArm: 2.40,
  emptyWeightArm: 2.30,
  cgLimits: {
    forward: 2.00,
    aft: 2.45,
    forwardVariable: []
  }
};

/**
 * Valeurs par défaut pour les données de base d'un avion
 */
const DEFAULT_AIRCRAFT_VALUES = {
  emptyWeight: 870,
  minTakeoffWeight: 900,
  maxTakeoffWeight: 1200,
  maxLandingWeight: 1200,
  maxBaggageWeight: 50,
  maxAuxiliaryWeight: 20,
  fuelCapacity: 150,
  fuelConsumptionLph: 30,
  cruiseSpeedKt: 100,
  fuelType: 'AVGAS 100LL'
};

/**
 * Valide et répare les données d'un avion
 * @param {Object} aircraft - L'objet avion à valider
 * @returns {Object} L'avion avec les données corrigées si nécessaire
 */
export function validateAndRepairAircraft(aircraft) {
  if (!aircraft) return null;
  
  // Créer une copie pour ne pas modifier l'original
  const repairedAircraft = { ...aircraft };
  
  // Réparer les propriétés de base
  Object.keys(DEFAULT_AIRCRAFT_VALUES).forEach(key => {
    if (repairedAircraft[key] === undefined || repairedAircraft[key] === null) {
      console.warn(`Aircraft ${aircraft.registration}: Missing ${key}, using default value`);
      repairedAircraft[key] = DEFAULT_AIRCRAFT_VALUES[key];
    }
  });
  
  // Réparer les données de masse et centrage
  if (!repairedAircraft.weightBalance) {
    console.warn(`Aircraft ${aircraft.registration}: Missing weightBalance data, using defaults`);
    repairedAircraft.weightBalance = { ...DEFAULT_WEIGHT_BALANCE };
  } else {
    // Vérifier chaque propriété de weightBalance
    const wb = { ...repairedAircraft.weightBalance };
    
    Object.keys(DEFAULT_WEIGHT_BALANCE).forEach(key => {
      if (key === 'cgLimits') {
        // Traiter cgLimits séparément
        if (!wb.cgLimits) {
          wb.cgLimits = { ...DEFAULT_WEIGHT_BALANCE.cgLimits };
        } else {
          if (wb.cgLimits.forward === undefined) {
            wb.cgLimits.forward = DEFAULT_WEIGHT_BALANCE.cgLimits.forward;
          }
          if (wb.cgLimits.aft === undefined) {
            wb.cgLimits.aft = DEFAULT_WEIGHT_BALANCE.cgLimits.aft;
          }
          if (!Array.isArray(wb.cgLimits.forwardVariable)) {
            wb.cgLimits.forwardVariable = [];
          }
        }
      } else if (wb[key] === undefined || wb[key] === null) {
        console.warn(`Aircraft ${aircraft.registration}: Missing weightBalance.${key}, using default value`);
        wb[key] = DEFAULT_WEIGHT_BALANCE[key];
      }
    });
    
    repairedAircraft.weightBalance = wb;
  }
  
  return repairedAircraft;
}

/**
 * Vérifie si un avion a toutes les données requises
 * @param {Object} aircraft - L'objet avion à vérifier
 * @returns {boolean} true si toutes les données sont présentes
 */
export function isAircraftDataComplete(aircraft) {
  if (!aircraft) return false;
  
  // Vérifier les propriétés de base
  const requiredProps = [
    'emptyWeight', 'minTakeoffWeight', 'maxTakeoffWeight',
    'maxLandingWeight', 'maxBaggageWeight', 'maxAuxiliaryWeight'
  ];
  
  for (const prop of requiredProps) {
    if (aircraft[prop] === undefined || aircraft[prop] === null) {
      return false;
    }
  }
  
  // Vérifier weightBalance
  if (!aircraft.weightBalance) return false;
  
  const wb = aircraft.weightBalance;
  const requiredWbProps = [
    'emptyWeightArm', 'frontLeftSeatArm', 'frontRightSeatArm',
    'rearLeftSeatArm', 'rearRightSeatArm', 'baggageArm',
    'auxiliaryArm', 'fuelArm'
  ];
  
  for (const prop of requiredWbProps) {
    if (wb[prop] === undefined || wb[prop] === null) {
      return false;
    }
  }
  
  // Vérifier cgLimits
  if (!wb.cgLimits || 
      wb.cgLimits.forward === undefined || 
      wb.cgLimits.aft === undefined) {
    return false;
  }
  
  return true;
}