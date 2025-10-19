// src/core/stores/supabaseAircraftStore.js
// Store exclusivement basé sur Supabase, sans persistance localStorage
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import communityService from '@services/communityService';
import { createModuleLogger } from '@utils/logger';

const logger = createModuleLogger('SupabaseAircraftStore');

// Store pour la gestion des avions depuis Supabase uniquement
export const useSupabaseAircraftStore = create(
  subscribeWithSelector((set, get) => ({
    // État
    aircraftList: [],
    selectedAircraftId: null,
    isLoading: false,
    error: null,
    lastSync: null,

    // Charger les avions depuis Supabase
    loadAircraft: async () => {
      
      set({ isLoading: true, error: null });

      try {
        const presets = await communityService.getAllPresets();

        if (!presets || presets.length === 0) {
          throw new Error('Aucun avion trouvé dans la base de données Supabase');
        }

        // Transformer les presets en format avion
        const aircraftList = presets.map(preset => {
          // Utiliser aircraftData si disponible, sinon construire depuis les champs de base
          const aircraft = preset.aircraftData || {
            id: preset.id,
            registration: preset.registration,
            model: preset.model,
            manufacturer: preset.manufacturer,
            aircraftType: preset.type || preset.aircraftType,
            category: preset.category
          };

          // S'assurer que l'ID est correct
          aircraft.id = preset.id;
          aircraft.aircraftId = preset.id;

          return aircraft;
        });

        

        set({
          aircraftList,
          selectedAircraftId: aircraftList[0]?.id || null,
          isLoading: false,
          error: null,
          lastSync: new Date().toISOString()
        });

        return aircraftList;
      } catch (error) {
        const errorMessage = `❌ ERREUR SUPABASE: ${error.message}`;
        console.error(errorMessage, error);

        set({
          aircraftList: [],
          isLoading: false,
          error: errorMessage,
          lastSync: null
        });

        // Afficher une notification d'erreur à l'utilisateur
        throw error;
      }
    },

    // Recharger depuis Supabase
    refreshFromSupabase: async () => {
      
      return get().loadAircraft();
    },

    // Sélectionner un avion
    setSelectedAircraft: (aircraft) => {
      set({ selectedAircraftId: aircraft?.id || null });
    },

    // Ajouter un avion (soumettre à Supabase)
    addAircraft: async (aircraftData) => {
      
      set({ isLoading: true, error: null });

      try {
        // Soumettre à Supabase
        const result = await communityService.submitPreset(
          aircraftData,
          null, // manexFile
          'current-user-id' // TODO: Récupérer l'ID utilisateur réel

        

        // Recharger la liste depuis Supabase
        await get().loadAircraft();

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
      
      set({ isLoading: true, error: null });

      try {
        // TODO: Implémenter la mise à jour sur Supabase
        // Pour l'instant, on soumet comme un nouveau preset
        const result = await communityService.submitPreset(
          aircraftData,
          null,
          'current-user-id'

        

        // Recharger la liste depuis Supabase
        await get().loadAircraft();

        return result;
      } catch (error) {
        const errorMessage = `❌ Erreur lors de la mise à jour: ${error.message}`;
        console.error(errorMessage, error);

        set({ isLoading: false, error: errorMessage });
        throw error;
      }
    },

    // Supprimer un avion (sur Supabase)
    deleteAircraft: async (id) => {
      
      // TODO: Implémenter la suppression sur Supabase
      
    },

    // Getter pour l'avion sélectionné
    get selectedAircraft() {
      const state = get();
      const id = state.selectedAircraftId;
      return state.aircraftList.find(a => a.id === id) || null;
    }
// Hook pour charger automatiquement au démarrage
export const useInitSupabaseAircraft = () => {
  const loadAircraft = useSupabaseAircraftStore(state => state.loadAircraft);
  const aircraftList = useSupabaseAircraftStore(state => state.aircraftList);
  const error = useSupabaseAircraftStore(state => state.error);

  // Charger au premier montage si la liste est vide
  React.useEffect(() => {
    if (aircraftList.length === 0 && !error) {
      loadAircraft().catch(err => {
        console.error('❌ Échec du chargement initial:', err);
      });
    }
  }, []);

  return { aircraftList, error };
};

// Sélecteurs
export const supabaseAircraftSelectors = {
  useAircraftList: () => useSupabaseAircraftStore(state => state.aircraftList),
  useSelectedAircraft: () => useSupabaseAircraftStore(state => state.selectedAircraft),
  useIsLoading: () => useSupabaseAircraftStore(state => state.isLoading),
  useError: () => useSupabaseAircraftStore(state => state.error),
  useLastSync: () => useSupabaseAircraftStore(state => state.lastSync),

  useActions: () => useSupabaseAircraftStore(state => ({
    loadAircraft: state.loadAircraft,
    refreshFromSupabase: state.refreshFromSupabase,
    setSelectedAircraft: state.setSelectedAircraft,
    addAircraft: state.addAircraft,
    updateAircraft: state.updateAircraft,
    deleteAircraft: state.deleteAircraft
};

export default useSupabaseAircraftStore;
