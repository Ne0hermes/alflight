// src/core/stores/aircraftStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_AIRCRAFT_LIST } from '@utils/constants';

// Store pour la gestion des avions avec optimisations
export const useAircraftStore = create(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // État
        aircraftList: DEFAULT_AIRCRAFT_LIST,
        selectedAircraftId: DEFAULT_AIRCRAFT_LIST[0]?.id || null,
        
        // Sélecteurs dérivés (calculés automatiquement)
        get selectedAircraft() {
          const id = get().selectedAircraftId;
          return get().aircraftList.find(a => a.id === id) || null;
        },
        
        // Actions atomiques
        setSelectedAircraft: (aircraft) => set(state => {
          state.selectedAircraftId = aircraft?.id || null;
        }),
        
        addAircraft: (aircraft) => set(state => {
          state.aircraftList.push({
            ...aircraft,
            id: aircraft.id || `aircraft-${Date.now()}`
          });
        }),
        
        updateAircraft: (aircraft) => set(state => {
          const index = state.aircraftList.findIndex(a => a.id === aircraft.id);
          if (index !== -1) {
            state.aircraftList[index] = aircraft;
          }
        }),
        
        deleteAircraft: (id) => set(state => {
          state.aircraftList = state.aircraftList.filter(a => a.id !== id);
          // Si l'avion supprimé était sélectionné, sélectionner le premier
          if (state.selectedAircraftId === id) {
            state.selectedAircraftId = state.aircraftList[0]?.id || null;
          }
        }),
        
        importAircraftList: (list) => set(state => {
          state.aircraftList = list;
          state.selectedAircraftId = list[0]?.id || null;
        }),
        
        resetToDefault: () => set(state => {
          state.aircraftList = DEFAULT_AIRCRAFT_LIST;
          state.selectedAircraftId = DEFAULT_AIRCRAFT_LIST[0]?.id || null;
        })
      })),
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
  useSelectedAircraft: () => useAircraftStore(state => state.selectedAircraft),
  
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