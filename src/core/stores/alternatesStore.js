// src/core/stores/alternatesStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAlternatesStore = create(
  persist(
    (set, get) => ({
      // État
      selectedAlternates: [],
      candidates: [],
      scoredAlternates: [],
      searchZone: null,
      lastRouteKey: null,

      // Configuration de recherche
      searchConfig: {
        method: 'triangle', // 'triangle' | 'buffer'
        bufferDistance: 20, // NM
      },

      // Filtres
      filters: {
        requireVAC: false,
        requireFuel: true,
        requireATC: false,
        weatherMinima: {
          vfr: { ceiling: 1500, visibility: 5000 },
          ifr: { ceiling: 400, visibility: 1500 }
        }
      },

      // Actions
      setSelectedAlternates: (alternates) => {
        if (!Array.isArray(alternates)) {
          return;
        }
        set({ selectedAlternates: alternates });
      },

      addAlternate: (alternate) => set((state) => {
        if (state.selectedAlternates.length >= 3) {
                return state;
        }
        if (state.selectedAlternates.some(alt => alt.icao === alternate.icao)) {
          return state; // Déjà ajouté
        }
        return { selectedAlternates: [...state.selectedAlternates, alternate] };
      }),

      removeAlternate: (icao) => set((state) => ({
        selectedAlternates: state.selectedAlternates.filter(alt => alt.icao !== icao)
      })),

      setCandidates: (candidates) => set({ candidates }),

      setScoredAlternates: (scored) => set({ scoredAlternates: scored }),

      setSearchZone: (zone) => set({ searchZone: zone }),

      setLastRouteKey: (key) => set({ lastRouteKey: key }),

      setSearchConfig: (config) => set((state) => ({
        searchConfig: { ...state.searchConfig, ...config }
      })),

      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),

      // Sélecteurs
      getAlternateByIcao: (icao) => {
        const state = get();
        return state.selectedAlternates.find(alt => alt.icao === icao) ||
               state.scoredAlternates.find(alt => alt.icao === icao);
      },

      hasMaxAlternates: () => get().selectedAlternates.length >= 3,

      clearAll: () => set({
        selectedAlternates: [],
        candidates: [],
        scoredAlternates: [],
        searchZone: null
      })
    }),
    {
      name: 'alternates-storage',
      version: 0,
      // Persister uniquement les données importantes, pas les temporaires
      partialize: (state) => ({
        selectedAlternates: state.selectedAlternates,
        searchConfig: state.searchConfig,
        filters: state.filters,
        lastRouteKey: state.lastRouteKey
      })
    }
  )
);