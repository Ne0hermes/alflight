// src/core/stores/alternatesStore.js
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useAlternatesStore = create(
  devtools(
    persist(
      (set, get) => ({
        // État
        selectedAlternates: [], // Max 3 aérodromes
        searchZone: null, // Géométrie de la zone de recherche
        candidateAlternates: [], // Tous les candidats trouvés
        scoredAlternates: [], // Candidats avec scores
        searchConfig: {
          method: 'triangle', // 'triangle' | 'buffer'
          bufferDistance: 20, // NM
          maxAlternates: 3,
          minRunwayLength: null, // Calculé dynamiquement
          maxFuelRadius: null, // Calculé depuis le carburant
        },
        filters: {
          requireVAC: true,
          requireFuel: false,
          requireATC: false,
          weatherMinima: {
            vfr: { ceiling: 1500, visibility: 5000 },
            ifr: { ceiling: 500, visibility: 1500 }
          }
        },
        
        // Actions
        setSearchConfig: (config) => set(state => ({
          searchConfig: { ...state.searchConfig, ...config }
        })),
        
        setSelectedAlternates: (alternates) => set({ 
          selectedAlternates: alternates.slice(0, 3) 
        }),
        
        addAlternate: (alternate) => set(state => {
          if (state.selectedAlternates.length >= 3) return state;
          return {
            selectedAlternates: [...state.selectedAlternates, alternate]
          };
        }),
        
        removeAlternate: (icao) => set(state => ({
          selectedAlternates: state.selectedAlternates.filter(a => a.icao !== icao)
        })),
        
        setCandidates: (candidates) => set({ candidateAlternates: candidates }),
        
        setScoredAlternates: (scored) => set({ scoredAlternates: scored }),
        
        setSearchZone: (zone) => set({ searchZone: zone }),
        
        // Sélecteurs
        getTopAlternates: () => {
          const { scoredAlternates } = get();
          return scoredAlternates.slice(0, 3);
        },
        
        isAlternateSelected: (icao) => {
          const { selectedAlternates } = get();
          return selectedAlternates.some(a => a.icao === icao);
        }
      }),
      {
        name: 'alternates-storage',
        partialize: (state) => ({
          selectedAlternates: state.selectedAlternates,
          searchConfig: state.searchConfig,
          filters: state.filters
        })
      }
    )
  )
);

export { useAlternatesStore };