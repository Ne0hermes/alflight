// src/utils/aircraftValidation.js
// Utilitaires pour valider et réparer les données d'avion

/**
 * ⚠️ SÉCURITÉ CRITIQUE : PAS DE VALEURS PAR DÉFAUT POUR MASSE & CENTRAGE
 *
 * Les bras de levier et limites CG sont spécifiques à chaque avion.
 * Utiliser des valeurs par défaut pourrait causer un décentrage critique
 * et rendre l'avion INCONTRÔLABLE en vol.
 *
 * Si les données manquent → AFFICHER UN AVERTISSEMENT CLAIR
 * Ne JAMAIS générer de valeurs fictives.
 */

/**
 * ⚠️ Valeurs par défaut NON CRITIQUES uniquement
 * Ces valeurs sont des estimations génériques pour l'affichage seulement
 * et ne doivent JAMAIS être utilisées pour des calculs de sécurité
 */
const DEFAULT_AIRCRAFT_VALUES = {
  // Ces valeurs sont indicatives uniquement
  maxBaggageWeight: 50,  // Indicatif - vérifier manuel avion
  maxAuxiliaryWeight: 20, // Indicatif - vérifier manuel avion
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

  // ⚠️ SÉCURITÉ : Préserver weightBalance tel quel, AUCUNE valeur par défaut
  if (!repairedAircraft.weightBalance) {
    console.warn('⚠️ [Validation] weightBalance is missing - NO DEFAULT VALUES (per safety requirements)');
    console.log('Aircraft has arms?', !!aircraft.arms);
    // Ne PAS créer de weightBalance - laisser undefined
    // L'interface affichera "⚠️ MANQUANT" pour les valeurs manquantes
  } else {
    console.log('✅ [Validation] weightBalance exists - preserving as-is');
    // Préserver weightBalance exactement tel quel
    // NE PAS remplir les propriétés manquantes avec des valeurs par défaut

    // 🔧 FIX CRITIQUE: Créer cgLimits depuis cgEnvelope si manquant
    // Cela garantit que tous les avions (Supabase, IndexedDB, etc.) ont cgLimits
    if (!repairedAircraft.weightBalance.cgLimits ||
        (repairedAircraft.weightBalance.cgLimits.forward === undefined &&
         repairedAircraft.weightBalance.cgLimits.aft === undefined)) {

      console.warn('⚠️ [Validation] cgLimits manquant, tentative de mapping depuis cgEnvelope...');

      // Helper pour parser null values
      const parseOrNull = (value) => {
        if (!value || value === '' || value === '0') return null;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
      };

      if (repairedAircraft.cgEnvelope) {
        repairedAircraft.weightBalance.cgLimits = {
          forward: parseOrNull(repairedAircraft.cgEnvelope.forwardPoints?.[0]?.cg),
          aft: parseOrNull(repairedAircraft.cgEnvelope.aftCG),
          forwardVariable: repairedAircraft.cgEnvelope.forwardPoints || []
        };
        console.log('✅ [Validation] cgLimits créé depuis cgEnvelope:', repairedAircraft.weightBalance.cgLimits);
      } else {
        // Dernier fallback: null (désactive la vérification CG)
        repairedAircraft.weightBalance.cgLimits = {
          forward: null,
          aft: null,
          forwardVariable: []
        };
        console.warn('⚠️ [Validation] Aucune donnée cgEnvelope disponible, cgLimits = null');
      }
    } else {
      // Juste s'assurer que forwardVariable est un tableau s'il existe
      if (!Array.isArray(repairedAircraft.weightBalance.cgLimits.forwardVariable)) {
        repairedAircraft.weightBalance.cgLimits.forwardVariable = [];
      }
    }
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