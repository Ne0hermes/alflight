// src/core/stores/aircraftStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_AIRCRAFT_LIST } from '@utils/constants';
import { createModuleLogger } from '@utils/logger';
import { validateAndRepairAircraft } from '@utils/aircraftValidation';
import { storeManexOptimized } from './manexStore';

const logger = createModuleLogger('AircraftStore');

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
          logger.debug('setSelectedAircraft called with:', aircraft);
          const currentId = get().selectedAircraftId;
          logger.debug('Previous selectedAircraftId:', currentId);
          
          set({ selectedAircraftId: aircraft?.id || null });
          
          // Vérifier immédiatement après le set
          setTimeout(() => {
            const newState = get();
            logger.debug('New state after set:', {
              selectedAircraftId: newState.selectedAircraftId,
              selectedAircraft: newState.selectedAircraft
            });
          }, 0);
        },
        
        addAircraft: (aircraft) => set((state) => {
          // Valider et réparer l'avion avant de l'ajouter
          const validatedAircraft = validateAndRepairAircraft({
            ...aircraft,
            id: aircraft.id || `aircraft-${Date.now()}`
          });
          
          return {
            aircraftList: [...state.aircraftList, validatedAircraft]
          };
        }),
        
        updateAircraft: (aircraft) => set((state) => {
          const index = state.aircraftList.findIndex(a => a.id === aircraft.id);
          if (index !== -1) {
            // Valider et réparer l'avion avant de le mettre à jour
            const validatedAircraft = validateAndRepairAircraft(aircraft);
            const newList = [...state.aircraftList];
            newList[index] = validatedAircraft;
            return { aircraftList: newList };
          }
          return state;
        }),
        
        // Ajouter ou mettre à jour le MANEX pour un avion
        updateAircraftManex: async (aircraftId, manexData) => {
          // Stocker les données MANEX dans le store séparé
          if (manexData) {
            await storeManexOptimized(aircraftId, manexData);
          }
          
          // Mettre à jour l'avion avec juste un flag et les métadonnées essentielles
          set((state) => {
            const index = state.aircraftList.findIndex(a => a.id === aircraftId);
            if (index !== -1) {
              const newList = [...state.aircraftList];
              newList[index] = {
                ...newList[index],
                manex: manexData ? {
                  fileName: manexData.fileName,
                  fileSize: manexData.fileSize,
                  pageCount: manexData.pageCount,
                  uploadDate: manexData.uploadDate || new Date().toISOString(),
                  hasData: true // Flag pour indiquer que les données complètes sont dans manexStore
                } : null
              };
              logger.debug('MANEX metadata updated for aircraft:', aircraftId);
              return { aircraftList: newList };
            }
            return state;
          });
        },
        
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
        
        // Getter calculé avec validation automatique
        get selectedAircraft() {
          const state = get();
          const id = state.selectedAircraftId;
          let aircraft = state.aircraftList.find(a => a.id === id) || null;
          
          // Valider et réparer l'avion si nécessaire
          if (aircraft) {
            aircraft = validateAndRepairAircraft(aircraft);
          }
          
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
        }),
        onRehydrateStorage: () => (state) => {
          // Valider et réparer tous les avions lors du chargement depuis localStorage
          if (state && state.aircraftList) {
            logger.debug('Validating aircraft list from localStorage...');
            state.aircraftList = state.aircraftList.map(aircraft => 
              validateAndRepairAircraft(aircraft)
            );
          }
        }
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