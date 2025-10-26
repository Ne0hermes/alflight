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

  //   //   //   // );

  // Sauvegarder les données volumineuses AVANT le JSON parse/stringify qui les détruirait
  const savedPhoto = aircraft.photo;
  const savedManex = aircraft.manex;
  const savedHasPhoto = aircraft.hasPhoto;
  const savedHasManex = aircraft.hasManex;
  const savedHasPerformance = aircraft.hasPerformance;

  // Créer une copie PROFONDE pour ne pas modifier l'original et préserver TOUS les champs
  const repairedAircraft = JSON.parse(JSON.stringify(aircraft));

  // Restaurer immédiatement les données volumineuses
  if (savedPhoto !== undefined) {
    repairedAircraft.photo = savedPhoto;
  }
  if (savedManex !== undefined) {
    repairedAircraft.manex = savedManex;
  }
  if (savedHasPhoto !== undefined) {
    repairedAircraft.hasPhoto = savedHasPhoto;
  }
  if (savedHasManex !== undefined) {
    repairedAircraft.hasManex = savedHasManex;
  }
  if (savedHasPerformance !== undefined) {
    repairedAircraft.hasPerformance = savedHasPerformance;
  }
  
  // Réparer les propriétés de base SANS écraser les autres
  Object.keys(DEFAULT_AIRCRAFT_VALUES).forEach(key => {
    if (repairedAircraft[key] === undefined || repairedAircraft[key] === null) {
            repairedAircraft[key] = DEFAULT_AIRCRAFT_VALUES[key];
    }
  });
  
  // Préserver explicitement les champs importants qui ne sont pas dans les valeurs par défaut
  if (aircraft.compatibleRunwaySurfaces !== undefined) {
    repairedAircraft.compatibleRunwaySurfaces = aircraft.compatibleRunwaySurfaces;
  }
  if (aircraft.approvedOperations !== undefined) {
    repairedAircraft.approvedOperations = aircraft.approvedOperations;
  }
  if (aircraft.equipmentCom !== undefined) {
    repairedAircraft.equipmentCom = aircraft.equipmentCom;
  }
  if (aircraft.equipmentNav !== undefined) {
    repairedAircraft.equipmentNav = aircraft.equipmentNav;
  }
  if (aircraft.equipmentSurv !== undefined) {
    repairedAircraft.equipmentSurv = aircraft.equipmentSurv;
  }
  if (aircraft.specialCapabilities !== undefined) {
    repairedAircraft.specialCapabilities = aircraft.specialCapabilities;
  }
  if (aircraft.speeds !== undefined) {
    repairedAircraft.speeds = aircraft.speeds;
  }
  if (aircraft.distances !== undefined) {
    repairedAircraft.distances = aircraft.distances;
  }
  if (aircraft.climb !== undefined) {
    repairedAircraft.climb = aircraft.climb;
  }
  if (aircraft.windLimits !== undefined) {
    repairedAircraft.windLimits = aircraft.windLimits;
  }
  if (aircraft.masses !== undefined) {
    repairedAircraft.masses = aircraft.masses;
  }
  if (aircraft.armLengths !== undefined) {
    repairedAircraft.armLengths = aircraft.armLengths;
  }
  if (aircraft.limitations !== undefined) {
    repairedAircraft.limitations = aircraft.limitations;
  }
  if (aircraft.cgEnvelope !== undefined) {
    repairedAircraft.cgEnvelope = aircraft.cgEnvelope;
  }
  if (aircraft.baggageCompartments !== undefined) {
    repairedAircraft.baggageCompartments = aircraft.baggageCompartments;
  }
  if (aircraft.manualRemarks !== undefined) {
    repairedAircraft.manualRemarks = aircraft.manualRemarks;
  }
  if (aircraft.emergencyNotes !== undefined) {
    repairedAircraft.emergencyNotes = aircraft.emergencyNotes;
  }
  if (aircraft.maintenanceNotes !== undefined) {
    repairedAircraft.maintenanceNotes = aircraft.maintenanceNotes;
  }

  // Préserver les données de performance
  if (aircraft.advancedPerformance !== undefined) {
    repairedAircraft.advancedPerformance = aircraft.advancedPerformance;
  }
  if (aircraft.performanceTables !== undefined) {
    repairedAircraft.performanceTables = aircraft.performanceTables;
  }
  if (aircraft.performanceModels !== undefined) {
    repairedAircraft.performanceModels = aircraft.performanceModels;
  }
  if (aircraft.flightManual !== undefined) {
    repairedAircraft.flightManual = aircraft.flightManual;
  }

  // Réparer les données de masse et centrage
  if (!repairedAircraft.weightBalance) {
    console.warn('⚠️ [Validation] weightBalance is missing - using DEFAULT values (should NOT happen if normalizer ran)');
    console.log('Aircraft has arms?', !!aircraft.arms);
    repairedAircraft.weightBalance = { ...DEFAULT_WEIGHT_BALANCE };
  } else {
    console.log('✓ [Validation] weightBalance exists:', repairedAircraft.weightBalance);
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
        console.log(`  Filling missing ${key}: ${DEFAULT_WEIGHT_BALANCE[key]}`);
        wb[key] = DEFAULT_WEIGHT_BALANCE[key];
      }
    });

    repairedAircraft.weightBalance = wb;
  }
  
  //   //   
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