// src/core/stores/aircraftStore.js
// Store chargé UNIQUEMENT depuis Supabase - AUCUNE DONNÉE LOCALE
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import communityService from '@services/communityService';
import { createModuleLogger } from '@utils/logger';
import { validateAndRepairAircraft } from '@utils/aircraftValidation';

const logger = createModuleLogger('AircraftStore');


// 🧹 NETTOYAGE AU DÉMARRAGE
if (typeof window !== 'undefined') {
  const hasOldData = localStorage.getItem('aircraft-storage');
  if (hasOldData) {
        localStorage.removeItem('aircraft-storage');
    localStorage.removeItem('aircraft_wizard_draft');
    localStorage.removeItem('wizard_performance_temp');
      }
}

// Store pour la gestion des avions depuis Supabase UNIQUEMENT
export const useAircraftStore = create(
  subscribeWithSelector((set, get) => ({
    // État
    aircraftList: [],
    selectedAircraftId: null,
    isLoading: false,
    isInitialized: false,
    error: null,
    lastSync: null,

    // Charger les avions depuis Supabase
    loadFromSupabase: async () => {
            set({ isLoading: true, error: null });

      try {
        const presets = await communityService.getAllPresets();

        if (!presets || presets.length === 0) {
          const errorMsg = '⚠️ Aucun avion trouvé dans la base Supabase';
                    set({
            aircraftList: [],
            selectedAircraftId: null,
            isLoading: false,
            isInitialized: true,
            error: errorMsg,
            lastSync: new Date().toISOString()
          });
          return [];
        }

        // Transformer les presets en format avion
        const aircraftList = presets.map(preset => {
          // Utiliser aircraftData directement s'il existe
          const aircraft = preset.aircraftData ? {
            ...preset.aircraftData,
            id: preset.id,
            aircraftId: preset.id,
            // 🔧 FIX: Propager hasManex depuis le preset (n'est pas dans aircraftData)
            hasManex: preset.hasManex || false
          } : {
            id: preset.id,
            aircraftId: preset.id,
            registration: preset.registration,
            model: preset.model,
            manufacturer: preset.manufacturer,
            aircraftType: preset.type || preset.aircraftType,
            category: preset.category,
            hasManex: preset.hasManex || false
          };

          // Valider et réparer
          return validateAndRepairAircraft(aircraft);
        });

        
        // Télécharger automatiquement les MANEX pour tous les avions qui en ont
                let manexDownloaded = 0;

        for (const aircraft of aircraftList) {
          if (aircraft.hasManex) {
            try {
              
              // Récupérer les données complètes avec le MANEX depuis Supabase
              const fullAircraft = await communityService.getPresetById(aircraft.id);

              if (fullAircraft.manex && fullAircraft.manex.pdfData) {
                // Sauvegarder le MANEX dans IndexedDB
                const { default: indexedDBStorage } = await import('@utils/indexedDBStorage');
                await indexedDBStorage.saveManexPDF(aircraft.id, fullAircraft.manex);

                                manexDownloaded++;
              }
            } catch (error) {
                          }
          }
        }

                set({
          aircraftList,
          selectedAircraftId: aircraftList[0]?.id || null,
          isLoading: false,
          isInitialized: true,
          error: null,
          lastSync: new Date().toISOString()
        });

        return aircraftList;
      } catch (error) {
        const errorMessage = `❌ ERREUR CONNEXION SUPABASE: ${error.message}`;
        console.error(errorMessage, error);

        set({
          aircraftList: [],
          selectedAircraftId: null,
          isLoading: false,
          isInitialized: true,
          error: errorMessage,
          lastSync: null
        });

        throw error;
      }
    },

    // Recharger depuis Supabase
    refreshFromSupabase: async () => {
            return get().loadFromSupabase();
    },

    // Sélectionner un avion
    setSelectedAircraft: (aircraft) => {
      logger.debug('setSelectedAircraft called with:', aircraft);
      set({ selectedAircraftId: aircraft?.id || null });
    },

    // Ajouter un avion (soumettre à Supabase)
    addAircraft: async (aircraftData) => {
            set({ isLoading: true, error: null });

      try {
        // Valider les données
        const validatedAircraft = validateAndRepairAircraft(aircraftData);

        // Préparer les données pour Supabase
        const presetData = {
          registration: validatedAircraft.registration,
          model: validatedAircraft.model,
          manufacturer: validatedAircraft.manufacturer || 'Inconnu',
          aircraft_type: validatedAircraft.aircraftType || 'Avion',
          category: validatedAircraft.category || 'SEP',
          aircraft_data: validatedAircraft,
          description: `Configuration ${validatedAircraft.model} - ${validatedAircraft.registration}`,
          submitted_by: 'current-user-id'
        };

        // Soumettre à Supabase
        const result = await communityService.submitPreset(
          presetData,
          null, // manexFile
          'current-user-id'
        );

        // Recharger la liste depuis Supabase
        await get().loadFromSupabase();

        return result;
      } catch (error) {
        const errorMessage = `❌ Erreur lors de l'ajout: ${error.message}`;
        console.error(errorMessage, error);
        set({ isLoading: false, error: errorMessage });
        throw error;
      }
    },

    // Mettre à jour un avion (soumettre à Supabase)
    updateAircraft: async (aircraftData) => {
      
      // Pour l'instant, on met à jour localement seulement
      // TODO: Implémenter la vraie mise à jour sur Supabase
      const state = get();
      const index = state.aircraftList.findIndex(a => a.id === aircraftData.id);

      if (index !== -1) {
        const validatedAircraft = validateAndRepairAircraft(aircraftData);
        const newList = [...state.aircraftList];
        newList[index] = validatedAircraft;

        set({ aircraftList: newList });

        return validatedAircraft;
      }

      return null;
    },

    // Supprimer un avion
    deleteAircraft: async (id) => {
            set({ isLoading: true, error: null });

      try {
        const state = get();
        const aircraft = state.aircraftList.find(a => a.id === id);

        if (!aircraft) {
                    set({ isLoading: false });
          return false;
        }

        // 1. Supprimer de la liste locale immédiatement (optimistic update)
        const newList = state.aircraftList.filter(a => a.id !== id);
        const newSelectedId = state.selectedAircraftId === id
          ? (newList[0]?.id || null)
          : state.selectedAircraftId;

        set({
          aircraftList: newList,
          selectedAircraftId: newSelectedId,
          isLoading: false
        });

        
        // 2. Supprimer de Supabase en arrière-plan (si applicable)
        try {
          // TODO: Implémenter deletePreset dans communityService si nécessaire
          // await communityService.deletePreset(id);

        } catch (error) {

        }

        // 3. Supprimer les données volumineuses d'IndexedDB (photo, manex)
        try {
          const { default: dataBackupManager } = await import('@utils/dataBackupManager');
          await dataBackupManager.deleteAircraftData(id);
                  } catch (error) {

        }

        return true;
      } catch (error) {
        const errorMessage = `❌ Erreur lors de la suppression: ${error.message}`;
        console.error(errorMessage, error);
        set({ isLoading: false, error: errorMessage });
        return false;
      }
    },

    // Actions compatibles avec l'ancien système
    importAircraftList: (list) => {

      set({
        aircraftList: list,
        selectedAircraftId: list[0]?.id || null
      });
    },

    resetToDefault: async () => {
            return get().loadFromSupabase();
    },

    // Getter pour l'avion sélectionné
    get selectedAircraft() {
      const state = get();
      const id = state.selectedAircraftId;
      let aircraft = state.aircraftList.find(a => a.id === id) || null;

      if (aircraft) {
        aircraft = validateAndRepairAircraft(aircraft);
      }

      return aircraft;
    }
  }))
);
// Fonction d'initialisation automatique
let isInitializing = false;

export const initializeAircraftStore = async () => {
  if (isInitializing) {
        return;
  }

  isInitializing = true;
  
  try {
    await useAircraftStore.getState().loadFromSupabase();
      } catch (error) {
    console.error('❌ Échec de l\'initialisation:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

// Sélecteurs optimisés
export const aircraftSelectors = {
  useAircraftList: () => useAircraftStore(state => state.aircraftList),

  useSelectedAircraft: () => useAircraftStore(state => {
    const id = state.selectedAircraftId;
    return state.aircraftList.find(a => a.id === id) || null;
  }),

  useSelectedAircraftId: () => useAircraftStore(state => state.selectedAircraftId),

  useAircraftById: (id) => useAircraftStore(
    state => state.aircraftList.find(a => a.id === id)
  ),

  useIsLoading: () => useAircraftStore(state => state.isLoading),
  useError: () => useAircraftStore(state => state.error),
  useIsInitialized: () => useAircraftStore(state => state.isInitialized),

  useAircraftActions: () => useAircraftStore(
    state => ({
      setSelectedAircraft: state.setSelectedAircraft,
      addAircraft: state.addAircraft,
      updateAircraft: state.updateAircraft,
      deleteAircraft: state.deleteAircraft,
      loadFromSupabase: state.loadFromSupabase,
      refreshFromSupabase: state.refreshFromSupabase,
      resetToDefault: state.resetToDefault
    }),
    (a, b) => Object.is(a, b))
};
