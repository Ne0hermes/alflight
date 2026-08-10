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
      // 🔧 REVUE LOT 7 — verrou de recherche : findAlternates le lisait déjà
      // mais il n'existait pas (garde inerte → jusqu'à 3 recherches complètes
      // concurrentes au montage). NE PAS persister (whitelist partialize).
      isSearching: false,

      // Configuration de recherche
      searchConfig: {
        method: 'triangle', // 'triangle' | 'buffer'
        bufferDistance: 20, // NM
      },

      // 🔧 LOT 7 — largeur du CORRIDOR de recherche autour de la trajectoire
      // (0 à 50 NM, réglable par pilule dans le module Déroutements)
      corridorNM: 25,

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

      setIsSearching: (v) => set({ isSearching: !!v }),

      setCorridorNM: (nm) => {
        const v = parseFloat(nm);
        if (Number.isFinite(v)) {
          set({ corridorNM: Math.min(50, Math.max(0, v)) });
        }
      },

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
        corridorNM: state.corridorNM,
        filters: state.filters,
        lastRouteKey: state.lastRouteKey
      })
    }
  )
);