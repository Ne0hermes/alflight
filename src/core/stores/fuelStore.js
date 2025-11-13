// src/core/stores/fuelStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useFuelStore = create(
  persist(
    immer((set, get) => ({
    // État
    fuelData: {
      roulage: { gal: 1.0, ltr: 3.79 },
      trip: { gal: 0, ltr: 0 },
      contingency: { gal: 0, ltr: 0 },
      alternate: { gal: 2.0, ltr: 7.57 },
      finalReserve: { gal: 0, ltr: 0 },
      additional: { gal: 0, ltr: 0 },
      extra: { gal: 0, ltr: 0 }
    },
    fobFuel: { gal: 0, ltr: 0 },
    
    // Actions
    setFuelData: (dataOrUpdater) => set(state => {
      // Support pour les fonctions updater comme (prev => ({...}))
      if (typeof dataOrUpdater === 'function') {
        state.fuelData = dataOrUpdater(state.fuelData);
      } else {
        state.fuelData = dataOrUpdater;
      }
    }),
    
    updateFuelItem: (type, values) => set(state => {
      state.fuelData[type] = values;
    }),
    
    updateTripFuel: (liters) => set(state => {
      const gallons = liters / 3.78541;
      state.fuelData.trip = {
        gal: parseFloat(gallons.toFixed(1)),
        ltr: parseFloat(liters.toFixed(1))
      };
      
      // Mise à jour automatique du contingency (5% du trip, min 1 gal)
      const contingencyGal = Math.max(1.0, gallons * 0.05);
      state.fuelData.contingency = {
        gal: parseFloat(contingencyGal.toFixed(1)),
        ltr: parseFloat((contingencyGal * 3.78541).toFixed(1))
      };
    }),
    
    updateFinalReserve: (liters) => set(state => {
      const gallons = liters / 3.78541;
      state.fuelData.finalReserve = {
        gal: parseFloat(gallons.toFixed(1)),
        ltr: parseFloat(liters.toFixed(1))
      };
    }),
    
    setFobFuel: (fuel) => set(state => {
      state.fobFuel = fuel;
    }),
    
    // Méthodes de calcul
    calculateTotal: (unit) => {
      const fuelData = get().fuelData;
      return Object.values(fuelData).reduce((total, fuel) => {
        if (fuel && typeof fuel === 'object' && fuel[unit] !== undefined) {
          return total + fuel[unit];
        }
        return total;
      }, 0);
    },
    
    isFobSufficient: () => {
      const totalRequired = get().calculateTotal('ltr');
      const fob = get().fobFuel.ltr;
      return fob >= totalRequired;
    },
    
    getFuelDifference: () => {
      const totalRequired = get().calculateTotal('ltr');
      const fob = get().fobFuel.ltr;
      return fob - totalRequired;
    },
    
    resetToDefault: () => set(state => {
      state.fuelData = {
        roulage: { gal: 1.0, ltr: 3.79 },
        trip: { gal: 0, ltr: 0 },
        contingency: { gal: 0, ltr: 0 },
        alternate: { gal: 2.0, ltr: 7.57 },
        finalReserve: { gal: 0, ltr: 0 },
        additional: { gal: 0, ltr: 0 },
        extra: { gal: 0, ltr: 0 }
      };
      state.fobFuel = { gal: 0, ltr: 0 };
    })
  })),
  {
    name: 'fuel-storage', // Nom unique pour localStorage
    storage: createJSONStorage(() => localStorage),
    // Persister toutes les données
    partialize: (state) => ({
      fuelData: state.fuelData,
      fobFuel: state.fobFuel
    })
  }
  )
);