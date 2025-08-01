// src/core/stores/aircraftStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_AIRCRAFT_LIST } from '@utils/constants';

// Store pour la gestion des avions avec optimisations
export const useAircraftStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // État
        aircraftList: DEFAULT_AIRCRAFT_LIST,
        selectedAircraftId: DEFAULT_AIRCRAFT_LIST[0]?.id || null,
        
        // Actions atomiques
        setSelectedAircraft: (aircraft) => {
          console.log('🏪 AircraftStore - setSelectedAircraft called with:', aircraft);
          const currentId = get().selectedAircraftId;
          console.log('🏪 AircraftStore - Previous selectedAircraftId:', currentId);
          
          set({ selectedAircraftId: aircraft?.id || null });
          
          // Vérifier immédiatement après le set
          setTimeout(() => {
            const newState = get();
            console.log('🏪 AircraftStore - New state after set:', {
              selectedAircraftId: newState.selectedAircraftId,
              selectedAircraft: newState.selectedAircraft
            });
          }, 0);
        },
        
        addAircraft: (aircraft) => set((state) => ({
          aircraftList: [...state.aircraftList, {
            ...aircraft,
            id: aircraft.id || `aircraft-${Date.now()}`
          }]
        })),
        
        updateAircraft: (aircraft) => set((state) => {
          const index = state.aircraftList.findIndex(a => a.id === aircraft.id);
          if (index !== -1) {
            const newList = [...state.aircraftList];
            newList[index] = aircraft;
            return { aircraftList: newList };
          }
          return state;
        }),
        
        deleteAircraft: (id) => set((state) => {
          const newList = state.aircraftList.filter(a => a.id !== id);
          // Si l'avion supprimé était sélectionné, sélectionner le premier
          if (state.selectedAircraftId === id) {
            return {
              aircraftList: newList,
              selectedAircraftId: newList[0]?.id || null
            };
          }
          return { aircraftList: newList };
        }),
        
        importAircraftList: (list) => set({
          aircraftList: list,
          selectedAircraftId: list[0]?.id || null
        }),
        
        resetToDefault: () => set({
          aircraftList: DEFAULT_AIRCRAFT_LIST,
          selectedAircraftId: DEFAULT_AIRCRAFT_LIST[0]?.id || null
        }),
        
        // Getter calculé
        get selectedAircraft() {
          const state = get();
          const id = state.selectedAircraftId;
          const aircraft = state.aircraftList.find(a => a.id === id) || null;
          console.log('🏪 AircraftStore - Getter selectedAircraft called:', {
            id,
            aircraft: aircraft?.registration
          });
          return aircraft;
        }
      }),
      {
        name: 'aircraft-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          aircraftList: state.aircraftList,
          selectedAircraftId: state.selectedAircraftId
        })
      }
    )
  )
);

// Sélecteurs optimisés pour éviter les re-renders
export const aircraftSelectors = {
  // Sélecteur pour la liste des avions
  useAircraftList: () => useAircraftStore(state => state.aircraftList),
  
  // Sélecteur pour l'avion sélectionné
  useSelectedAircraft: () => useAircraftStore(state => {
    const id = state.selectedAircraftId;
    return state.aircraftList.find(a => a.id === id) || null;
  }),
  
  // Sélecteur pour l'ID de l'avion sélectionné
  useSelectedAircraftId: () => useAircraftStore(state => state.selectedAircraftId),
  
  // Sélecteur pour un avion spécifique
  useAircraftById: (id) => useAircraftStore(
    state => state.aircraftList.find(a => a.id === id)
  ),
  
  // Sélecteur pour les actions uniquement (pas de re-render)
  useAircraftActions: () => useAircraftStore(
    state => ({
      setSelectedAircraft: state.setSelectedAircraft,
      addAircraft: state.addAircraft,
      updateAircraft: state.updateAircraft,
      deleteAircraft: state.deleteAircraft,
      importAircraftList: state.importAircraftList,
      resetToDefault: state.resetToDefault
    }),
    // Shallow compare pour éviter les re-renders
    (a, b) => Object.is(a, b)
  )
};