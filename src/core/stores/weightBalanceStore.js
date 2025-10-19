// src/core/stores/weightBalanceStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useWeightBalanceStore = create(
  immer((set, get) => ({
    // État
    loads: {
      frontLeft: 75,
      frontRight: 0,
      rearLeft: 0,
      rearRight: 0,
      baggage: 0,
      auxiliary: 0,
      fuel: 0
    },
    
    // Actions
    setLoads: (loads) => set(state => {
            state.loads = loads;
    }),
    
    updateLoad: (type, value) => set(state => {
            state.loads[type] = value;
    }),
    
    updateFuelLoad: (fuelLiters, fuelDensity) => set(state => {
      const fuelWeight = parseFloat((fuelLiters * fuelDensity).toFixed(1));
            state.loads.fuel = fuelWeight;
    }),
    
    // Méthode de calcul principale (pure function - no side effects)
    calculateWeightBalance: (aircraft, fobFuel) => {
      if (!aircraft) return null;
      
      // Utiliser les masses directement depuis aircraft ou depuis masses
      const emptyWeight = aircraft.emptyWeight || aircraft.masses?.emptyMass || 600;
      const minTakeoffWeight = aircraft.minTakeoffWeight || aircraft.masses?.minTakeoffMass || 600;
      const maxTakeoffWeight = aircraft.maxTakeoffWeight || 1150;
      
      // Vérifier les propriétés requises de l'avion
      if (!emptyWeight || !minTakeoffWeight || !maxTakeoffWeight) {
        console.error('WeightBalanceStore - Missing aircraft weight properties:', {
          emptyWeight,
          minTakeoffWeight,
          maxTakeoffWeight
        });
        return null;
      }
      
      // Utiliser weightBalance s'il existe, sinon créer depuis armLengths
      let wb = aircraft.weightBalance;
      
      if (!wb || !wb.emptyWeightArm) {
        // Fallback vers armLengths si weightBalance n'existe pas
                wb = {
          emptyWeightArm: aircraft.armLengths?.emptyMassArm || 2.00,
          frontLeftSeatArm: aircraft.armLengths?.frontSeat1Arm || 2.00,
          frontRightSeatArm: aircraft.armLengths?.frontSeat2Arm || 2.00,
          rearLeftSeatArm: aircraft.armLengths?.rearSeat1Arm || 2.90,
          rearRightSeatArm: aircraft.armLengths?.rearSeat2Arm || 2.90,
          baggageArm: aircraft.armLengths?.standardBaggageArm || 3.50,
          auxiliaryArm: aircraft.armLengths?.aftBaggageExtensionArm || aircraft.armLengths?.baggageTubeArm || 3.70,
          fuelArm: aircraft.armLengths?.fuelArm || 2.18,
          cgLimits: aircraft.cgEnvelope ? {
            forward: parseFloat(aircraft.cgEnvelope.forwardPoints?.[0]?.cg) || 2.00,
            aft: parseFloat(aircraft.cgEnvelope.aftCG) || 2.45
          } : {
            forward: 2.00,
            aft: 2.45
          }
        };
      }
      
      // Vérifier que toutes les propriétés requises existent
      const requiredProps = [
        'emptyWeightArm', 'frontLeftSeatArm', 'frontRightSeatArm',
        'rearLeftSeatArm', 'rearRightSeatArm', 'baggageArm',
        'auxiliaryArm', 'fuelArm', 'cgLimits'
      ];
      
      for (const prop of requiredProps) {
        if (wb[prop] === undefined) {
          console.error(`WeightBalanceStore - Missing required property: ${prop} for aircraft:`, aircraft.registration);
          return null;
        }
      }
      
      if (!wb.cgLimits.forward || !wb.cgLimits.aft) {
        console.error('WeightBalanceStore - Missing CG limits for aircraft:', aircraft.registration);
        return null;
      }
      
      let loads = get().loads;
      
      
      // Si fobFuel est fourni, utiliser ce poids de carburant pour le calcul
      // (sans modifier le state - cela doit être fait séparément)
      if (fobFuel?.ltr) {
        const fuelDensity = aircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
        const fuelWeight = parseFloat((fobFuel.ltr * fuelDensity).toFixed(1));
        // Créer une copie des loads avec le nouveau poids de carburant pour ce calcul
        loads = { ...loads, fuel: fuelWeight };
      }
      
      // Calcul du poids total incluant les compartiments bagages dynamiques
      let baggageWeight = 0;
      let baggageMoment = 0;
      
      // Si l'avion a des compartiments bagages définis, les utiliser
      if (aircraft.baggageCompartments && aircraft.baggageCompartments.length > 0) {
        aircraft.baggageCompartments.forEach((compartment, index) => {
          const loadKey = `baggage_${compartment.id || index}`;
          const weight = loads[loadKey] || 0;
          const arm = parseFloat(compartment.arm) || 3.50;
          baggageWeight += weight;
          baggageMoment += weight * arm;
        });
      } else {
        // Sinon, utiliser les compartiments par défaut
        baggageWeight = (loads.baggage || 0) + (loads.auxiliary || 0);
        baggageMoment = (loads.baggage || 0) * wb.baggageArm + (loads.auxiliary || 0) * wb.auxiliaryArm;
      }
      
      const totalWeight = 
        emptyWeight +
        (loads.frontLeft || 0) +
        (loads.frontRight || 0) +
        (loads.rearLeft || 0) +
        (loads.rearRight || 0) +
        baggageWeight +
        (loads.fuel || 0);
      
      // Calcul du moment total
      const totalMoment = 
        emptyWeight * wb.emptyWeightArm +
        (loads.frontLeft || 0) * wb.frontLeftSeatArm +
        (loads.frontRight || 0) * wb.frontRightSeatArm +
        (loads.rearLeft || 0) * wb.rearLeftSeatArm +
        (loads.rearRight || 0) * wb.rearRightSeatArm +
        baggageMoment +
        (loads.fuel || 0) * wb.fuelArm;
      
      // Calcul du CG
      const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
      
      // Vérification des limites
      const isWithinWeight = 
        totalWeight >= minTakeoffWeight &&
        totalWeight <= maxTakeoffWeight;
      
      const isWithinCG = 
        cg >= wb.cgLimits.forward &&
        cg <= wb.cgLimits.aft;
      
      const result = {
        totalWeight: parseFloat(totalWeight.toFixed(1)),
        totalMoment: parseFloat(totalMoment.toFixed(1)),
        cg: parseFloat(cg.toFixed(3)),
        isWithinLimits: isWithinWeight && isWithinCG,
        isWithinWeight,
        isWithinCG
      };
      

      return result;
    }
  }))
);