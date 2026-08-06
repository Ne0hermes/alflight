// src/core/stores/fuelStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';

// Identité avion pour la configuration réservoirs (id local sinon immatriculation).
// Partagée entre FuelModule (écriture) et weightBalanceStore/Step6 (lecture) pour
// garantir que la config n'est appliquée qu'à l'avion qui l'a saisie.
export const aircraftTankConfigId = (aircraft) =>
  aircraft == null ? null : String(aircraft.id ?? aircraft.registration ?? '');

// Ids (String(id ?? index)) des réservoirs COCHÉS pour cet avion, ou null si la
// config ne fait pas foi. Elle ne fait pas foi quand :
//   - elle n'est pas engagée, ou engagée pour un AUTRE avion ;
//   - elle est VIERGE (aucune case touchée) : après un reload de brouillon la
//     config repart vide (non persistée) — tant que le pilote n'a pas interagi,
//     on n'écrase NI le FOB restauré NI la répartition (revue adversariale
//     2026-07 : la version qui écrasait détruisait le brouillon au montage).
// null ⇒ comportement historique (tous les réservoirs déclarés comptent).
export const activeTankIdsFrom = (tankConfig, aircraft) => {
  if (!tankConfig || tankConfig.aircraftId == null) return null;
  if (aircraftTankConfigId(aircraft) !== tankConfig.aircraftId) return null;
  if (Object.keys(tankConfig.tanks).length === 0) return null; // vierge : pas encore vérifiée
  const tanks = Array.isArray(aircraft?.additionalFuelTanks) ? aircraft.additionalFuelTanks : [];
  return tanks
    .map((t, i) => String(t?.id ?? i))
    .filter((key) => tankConfig.tanks[key]?.active);
};

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
      extra: { gal: 0, ltr: 0 },
      discretionary: { gal: 0, ltr: 0 }
    },
    fobFuel: { gal: 0, ltr: 0 },

    // ─── Configuration réservoirs PAR VOL (avions multi-réservoirs) ─────────
    // Demande pilote (2026-07) : en préparation carburant, le CDB coche les
    // réservoirs réellement embarqués (standard vs long-range / auxiliaire)
    // et saisit les litres de chacun. VOLONTAIREMENT exclu de partialize :
    // remis à zéro à chaque nouvelle préparation de vol pour OBLIGER la
    // re-vérification de la configuration réelle de l'avion.
    // tanks : clé String(tank.id ?? index) → { active: bool, ltr: number }.
    tankConfig: {
      aircraftId: null,
      tanks: {}
    },

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
      // Tolère un nombre (interprété comme litres) ou un objet { ltr, gal }
      if (typeof fuel === 'number' && !isNaN(fuel)) {
        const ltr = fuel;
        state.fobFuel = {
          ltr: parseFloat(ltr.toFixed(2)),
          gal: parseFloat((ltr / 3.78541).toFixed(2))
        };
      } else if (fuel && typeof fuel === 'object') {
        const ltr = typeof fuel.ltr === 'number' ? fuel.ltr
                  : (typeof fuel.gal === 'number' ? fuel.gal * 3.78541 : 0);
        const gal = typeof fuel.gal === 'number' ? fuel.gal
                  : (typeof fuel.ltr === 'number' ? fuel.ltr / 3.78541 : 0);
        state.fobFuel = {
          ltr: parseFloat(ltr.toFixed(2)),
          gal: parseFloat(gal.toFixed(2))
        };
      } else {
        state.fobFuel = { ltr: 0, gal: 0 };
      }
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
        extra: { gal: 0, ltr: 0 },
        discretionary: { gal: 0, ltr: 0 }
      };
      state.fobFuel = { gal: 0, ltr: 0 };
      state.tankConfig = { aircraftId: null, tanks: {} };
    }),

    // ─── Actions configuration réservoirs ───────────────────────────────────
    // Engage la config pour un avion. Même avion → no-op (la saisie en cours
    // survit aux allers-retours entre étapes) ; avion différent → repart vierge.
    initTankConfig: (aircraftId) => set(state => {
      const id = aircraftId == null ? null : String(aircraftId);
      if (state.tankConfig.aircraftId === id) return;
      state.tankConfig = { aircraftId: id, tanks: {} };
    }),

    // Purge totale — appelée au démarrage d'une NOUVELLE préparation de vol
    // (décision pilote : le CDB doit re-vérifier la configuration à chaque vol).
    resetTankConfig: () => set(state => {
      state.tankConfig = { aircraftId: null, tanks: {} };
    }),

    setTankActive: (tankKey, active) => set(state => {
      const key = String(tankKey);
      const prev = state.tankConfig.tanks[key];
      // Décocher remet le volume à zéro (décision pilote : pas de mémoire).
      state.tankConfig.tanks[key] = active
        ? { active: true, ltr: prev?.ltr || 0 }
        : { active: false, ltr: 0 };
    }),

    setTankLiters: (tankKey, ltr) => set(state => {
      const key = String(tankKey);
      const liters = Math.max(0, parseFloat(ltr) || 0);
      const prev = state.tankConfig.tanks[key];
      state.tankConfig.tanks[key] = { active: prev?.active ?? true, ltr: liters };
    }),

    // Ids (String) des réservoirs cochés pour cet avion, ou null si la config
    // ne fait pas foi : non engagée, engagée pour un autre avion, ou VIERGE
    // (aucune case touchée — cf. activeTankIdsFrom). null → les calculs gardent
    // le comportement historique (tous les réservoirs déclarés comptent).
    getActiveTankIds: (aircraftId) => {
      const cfg = get().tankConfig;
      if (cfg.aircraftId == null) return null;
      if (aircraftId == null || String(aircraftId) !== cfg.aircraftId) return null;
      if (Object.keys(cfg.tanks).length === 0) return null; // vierge : pas encore vérifiée
      return Object.entries(cfg.tanks)
        .filter(([, t]) => t?.active)
        .map(([k]) => k);
    }
  })),
  {
    name: 'fuel-storage', // Nom unique pour localStorage
    storage: createJSONStorage(() => localStorage),
    // Persister toutes les données
    partialize: (state) => ({
      fuelData: state.fuelData,
      fobFuel: state.fobFuel
    }),
    // Normalise fobFuel au chargement : récupère les anciens states où c'était un nombre
    onRehydrateStorage: () => (state) => {
      if (!state) return;
      // Migration : les states persistés avant l'ajout du poste discrétionnaire
      // (schéma carburant EASA 2022) n'ont pas la clé
      if (state.fuelData && typeof state.fuelData === 'object' && !state.fuelData.discretionary) {
        state.fuelData.discretionary = { gal: 0, ltr: 0 };
      }
      const f = state.fobFuel;
      if (typeof f === 'number') {
        state.fobFuel = {
          ltr: parseFloat(f.toFixed(2)),
          gal: parseFloat((f / 3.78541).toFixed(2))
        };
      } else if (!f || typeof f !== 'object' || typeof f.ltr !== 'number') {
        state.fobFuel = { ltr: 0, gal: 0 };
      }
    }
  }
  )
);