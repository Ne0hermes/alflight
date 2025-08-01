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
    
    // Méthode de calcul principale
    calculateWeightBalance: (aircraft, fobFuel) => {
      if (!aircraft) return null;
      
      const loads = get().loads;
      const wb = aircraft.weightBalance;
      
      console.log('WeightBalanceStore - calculateWeightBalance with loads:', loads);

      // Mise à jour automatique du poids du carburant si fobFuel est fourni
      if (fobFuel?.ltr) {
        const fuelDensity = aircraft.fuelType === 'JET A-1' ? 0.84 : 0.72;
        const fuelWeight = parseFloat((fobFuel.ltr * fuelDensity).toFixed(1));
        if (loads.fuel !== fuelWeight) {
          set(state => {
            state.loads.fuel = fuelWeight;
          });
        }
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