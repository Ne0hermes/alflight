// src/core/stores/weightBalanceStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
// 🧮 Phase 2 : le verdict de masse & centrage est calculé par le moteur
// autonome, plus par ce store. Les imports de densité, d'enveloppe et de bras
// ont disparu avec les 300 lignes de calcul qu'ils servaient.
import { computeWeightBalance } from '@alflight/calc-engine/wb/computeWeightBalance';
import { useFuelStore, aircraftTankConfigId } from './fuelStore';

export const useWeightBalanceStore = create(
  immer((set, get) => ({
    // État
    loads: {
      frontLeft: 0,  // 🔧 FIX: Pas de valeur par défaut (utilisateur doit saisir)
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
    // 🧮 Phase 2 — le calcul vit désormais dans @alflight/calc-engine.
    // Ce store ne fait plus que RASSEMBLER les entrées (charges du vol,
    // configuration réservoirs) et transmettre le verdict. Même moteur pour
    // l'écran et pour le serveur : plus de divergence possible entre les deux.
    calculateWeightBalance: (aircraft, fobFuel) => {
      if (!aircraft) return null;
      return computeWeightBalance({
        aircraft,
        loads: get().loads,
        fobFuel,
        // Configuration réservoirs du vol : null si non engagée pour cet avion
        // → comportement historique (tous les réservoirs déclarés comptent).
        activeTankIds: useFuelStore.getState().getActiveTankIds(aircraftTankConfigId(aircraft)),
      });
    }
  }))
);