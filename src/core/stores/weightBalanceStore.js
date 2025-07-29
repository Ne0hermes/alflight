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
      state.loads.fuel = parseFloat((fuelLiters * fuelDensity).toFixed(1));
    }),
    
    // Méthode de calcul principale
    calculateWeightBalance: (aircraft, fobFuel) => {
      if (!aircraft) return null;
      
      const loads = get().loads;
      const wb = aircraft.weightBalance;

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
        loads.frontLeft +
        loads.frontRight +
        loads.rearLeft +
        loads.rearRight +
        loads.baggage +
        loads.auxiliary +
        loads.fuel;
      
      // Calcul du moment total
      const totalMoment = 
        aircraft.emptyWeight * wb.emptyWeightArm +
        loads.frontLeft * wb.frontLeftSeatArm +
        loads.frontRight * wb.frontRightSeatArm +
        loads.rearLeft * wb.rearLeftSeatArm +
        loads.rearRight * wb.rearRightSeatArm +
        loads.baggage * wb.baggageArm +
        loads.auxiliary * wb.auxiliaryArm +
        loads.fuel * wb.fuelArm;
      
      // Calcul du CG
      const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
      
      // Vérification des limites
      const isWithinWeight = 
        totalWeight >= aircraft.minTakeoffWeight &&
        totalWeight <= aircraft.maxTakeoffWeight;
      
      const isWithinCG = 
        cg >= wb.cgLimits.forward &&
        cg <= wb.cgLimits.aft;
      
      return {
        totalWeight: parseFloat(totalWeight.toFixed(1)),
        totalMoment: parseFloat(totalMoment.toFixed(1)),
        cg: parseFloat(cg.toFixed(3)),
        isWithinLimits: isWithinWeight && isWithinCG,
        isWithinWeight,
        isWithinCG
      };
    }
  }))
);