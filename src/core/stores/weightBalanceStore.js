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
      console.log('WeightBalanceStore - setLoads called with:', loads);
      state.loads = loads;
    }),
    
    updateLoad: (type, value) => set(state => {
      console.log(`WeightBalanceStore - updateLoad: ${type} = ${value}`);
      state.loads[type] = value;
    }),
    
    updateFuelLoad: (fuelLiters, fuelDensity) => set(state => {
      const fuelWeight = parseFloat((fuelLiters * fuelDensity).toFixed(1));
      console.log(`WeightBalanceStore - updateFuelLoad: ${fuelLiters}L * ${fuelDensity} = ${fuelWeight}kg`);
      state.loads.fuel = fuelWeight;
    }),
    
    // Méthode de calcul principale (pure function - no side effects)
    calculateWeightBalance: (aircraft, fobFuel) => {
      if (!aircraft) return null;
      
      // Vérifier les propriétés requises de l'avion
      if (!aircraft.emptyWeight || !aircraft.minTakeoffWeight || !aircraft.maxTakeoffWeight) {
        console.error('WeightBalanceStore - Missing aircraft weight properties:', {
          emptyWeight: aircraft.emptyWeight,
          minTakeoffWeight: aircraft.minTakeoffWeight,
          maxTakeoffWeight: aircraft.maxTakeoffWeight
        });
        return null;
      }
      
      // Vérifier que les données de masse et centrage existent
      if (!aircraft.weightBalance) {
        console.warn('WeightBalanceStore - No weight balance data for aircraft:', aircraft.registration);
        return null;
      }
      
      const wb = aircraft.weightBalance;
      
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
      
      console.log('WeightBalanceStore - calculateWeightBalance with loads:', loads);

      // Si fobFuel est fourni, utiliser ce poids de carburant pour le calcul
      // (sans modifier le state - cela doit être fait séparément)
      if (fobFuel?.ltr) {
        const fuelDensity = aircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
        const fuelWeight = parseFloat((fobFuel.ltr * fuelDensity).toFixed(1));
        // Créer une copie des loads avec le nouveau poids de carburant pour ce calcul
        loads = { ...loads, fuel: fuelWeight };
      }
      
      // Calcul du poids total
      const totalWeight = 
        aircraft.emptyWeight +
        (loads.frontLeft || 0) +
        (loads.frontRight || 0) +
        (loads.rearLeft || 0) +
        (loads.rearRight || 0) +
        (loads.baggage || 0) +
        (loads.auxiliary || 0) +
        (loads.fuel || 0);
      
      // Calcul du moment total
      const totalMoment = 
        aircraft.emptyWeight * wb.emptyWeightArm +
        (loads.frontLeft || 0) * wb.frontLeftSeatArm +
        (loads.frontRight || 0) * wb.frontRightSeatArm +
        (loads.rearLeft || 0) * wb.rearLeftSeatArm +
        (loads.rearRight || 0) * wb.rearRightSeatArm +
        (loads.baggage || 0) * wb.baggageArm +
        (loads.auxiliary || 0) * wb.auxiliaryArm +
        (loads.fuel || 0) * wb.fuelArm;
      
      // Calcul du CG
      const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
      
      // Vérification des limites
      const isWithinWeight = 
        totalWeight >= aircraft.minTakeoffWeight &&
        totalWeight <= aircraft.maxTakeoffWeight;
      
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
      
      console.log('WeightBalanceStore - calculateWeightBalance result:', result);
      
      return result;
    }
  }))
);