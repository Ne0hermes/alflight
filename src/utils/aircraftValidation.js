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
export function validateAndRepairAircraft(aircraft, opts = {}) {
  if (!aircraft) return null;

  //   //   //   // );

  // Sauvegarder les données volumineuses AVANT le JSON parse/stringify qui les détruirait
  const savedPhoto = aircraft.photo;
  const savedManex = aircraft.manex;
  const savedWeighingReport = aircraft.weighingReport;
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
  if (savedWeighingReport !== undefined) {
    repairedAircraft.weighingReport = savedWeighingReport;
  }
  
  // 🔧 FIX (bug B) — MASSE À VIDE : CHAMP CANONIQUE UNIQUE.
  // La masse à vide vivait en 3 représentations divergentes, écrites par des formulaires différents :
  //   • AircraftModule (édition) écrit la RACINE emptyWeight (+ masses.emptyMass)
  //   • le wizard écrit weights.emptyWeight (mappé aussi vers la racine)
  // Les lecteurs M&C (weightBalanceStore, calculations) lisaient weights.emptyWeight EN PREMIER →
  // un weights.emptyWeight stale (ex. 620) masquait la racine fraîche (900) → valeur erronée affichée.
  // On réconcilie ICI, au chokepoint unique de validation (add/update/load), AVANT le remplissage
  // par défaut. Précédence : RACINE emptyWeight d'abord (les DEUX formulaires l'écrivent toujours),
  // puis weights.emptyWeight (anciens avions), puis masses.emptyMass. La valeur retenue est propagée
  // aux 3 emplacements → quel que soit l'ordre de lecture, tout concorde. Aucun form n'écrit
  // weights « frais » en laissant la racine stale, donc racine-d'abord est sûr.
  {
    const canonicalEmpty = [
      repairedAircraft.emptyWeight,
      repairedAircraft.weights?.emptyWeight,
      repairedAircraft.masses?.emptyMass
    ].map(v => parseFloat(v)).find(v => Number.isFinite(v) && v > 0);
    if (canonicalEmpty !== undefined) {
      repairedAircraft.emptyWeight = canonicalEmpty;
      if (repairedAircraft.weights && typeof repairedAircraft.weights === 'object') {
        repairedAircraft.weights.emptyWeight = canonicalEmpty;
      }
      if (repairedAircraft.masses && typeof repairedAircraft.masses === 'object') {
        repairedAircraft.masses.emptyMass = canonicalEmpty;
      }
    }
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

  // ⚠️ SÉCURITÉ : weightBalance n'est JAMAIS rempli avec des valeurs par défaut
  // fictives. En revanche, si l'avion possède des `arms` (forme historique
  // du modèle), on les TRANSPOSE dans weightBalance — ce n'est PAS un
  // remplissage par défaut, c'est une projection des données réelles
  // de l'avion dans une autre forme. Sans cela, le composant Step6 et les
  // calculs M&C ne fonctionnent pas alors que les données existent.
  if (!repairedAircraft.weightBalance) {
    if (aircraft.arms || repairedAircraft.arms) {
      const armsSrc = repairedAircraft.arms || aircraft.arms;
      const parseOrNull = (value) => {
        if (value === null || value === undefined || value === '' || value === '0') return null;
        const parsed = parseFloat(value);
        return Number.isNaN(parsed) ? null : parsed;
      };

      // Dérivation directe : pas de défaut, juste null si la valeur originelle est absente
      repairedAircraft.weightBalance = {
        emptyWeightArm:    parseOrNull(armsSrc.empty),
        frontLeftSeatArm:  parseOrNull(armsSrc.frontSeats) ?? parseOrNull(armsSrc.frontSeat),
        frontRightSeatArm: parseOrNull(armsSrc.frontSeats) ?? parseOrNull(armsSrc.frontSeat),
        rearLeftSeatArm:   parseOrNull(armsSrc.rearSeats) ?? parseOrNull(armsSrc.rearSeat),
        rearRightSeatArm:  parseOrNull(armsSrc.rearSeats) ?? parseOrNull(armsSrc.rearSeat),
        fuelArm:           parseOrNull(armsSrc.fuelMain) ?? parseOrNull(armsSrc.fuel),
        cgLimits: null  // sera reconstruit ci-dessous depuis cgEnvelope si dispo
      };
      if (!opts.quiet) console.log('🔄 [Validation] weightBalance dérivé depuis arms (transposition, pas de défaut)');
    } else if (!opts.quiet) {
      console.warn('⚠️ [Validation] weightBalance ET arms manquants — données M&C indisponibles. L\'avion devra être édité avant prep de vol.');
    }
    // Continue (peut être null ; le bloc cgLimits ci-dessous gère le cas)
  }

  // Bloc historique : amélioration de weightBalance existant (ou nouvellement dérivé)
  if (repairedAircraft.weightBalance) {
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