// src/core/stores/alternatesStore.js
import { create } from 'zustand';

export const useAlternatesStore = create((set, get) => ({
  // État
  selectedAlternates: [],
  candidates: [],
  scoredAlternates: [],
  searchZone: null,
  
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
  setSelectedAlternates: (alternates) => set({ selectedAlternates: alternates }),
  
  addAlternate: (alternate) => set((state) => {
    if (state.selectedAlternates.length >= 3) {
      console.warn('Maximum 3 alternates autorisés');
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
}));