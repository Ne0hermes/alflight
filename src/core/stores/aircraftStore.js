// src/core/stores/aircraftStore.js
// Store chargé UNIQUEMENT depuis Supabase - AUCUNE DONNÉE LOCALE
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import communityService from '@services/communityService';
import { createModuleLogger } from '@utils/logger';
import { validateAndRepairAircraft } from '@utils/aircraftValidation';
import { prepareAircraftExport } from '@utils/aircraftNormalizer';
import { useUnitsStore } from '@core/stores/unitsStore';

const logger = createModuleLogger('AircraftStore');


// 🧹 NETTOYAGE AU DÉMARRAGE - Supprimer les anciennes clés uniquement
if (typeof window !== 'undefined') {
  // Nettoyer les anciennes clés obsolètes (pas aircraft-store-v2!)
  localStorage.removeItem('aircraft-storage');
  localStorage.removeItem('aircraft_wizard_draft');
  localStorage.removeItem('wizard_performance_temp');
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

        // 🔧 Importer la fonction de conversion AVANT le .map()
        const { convertAircraftUnits } = await import('@utils/aircraftNormalizer');

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

          console.log('🔍 [AircraftStore] Preset:', {
            registration: preset.registration,
            'preset.hasManex': preset.hasManex,
            'aircraft.hasManex': aircraft.hasManex
          });

          // 🔧 FIX: Mapper weights.emptyWeight → emptyWeight pour les anciens avions
          // Les avions créés avant la correction ont weights.emptyWeight mais pas emptyWeight
          console.log(`🔍 [AircraftStore] Checking ${aircraft.registration}:`, {
            hasEmptyWeight: !!aircraft.emptyWeight,
            emptyWeight: aircraft.emptyWeight,
            hasWeights: !!aircraft.weights,
            weightsEmptyWeight: aircraft.weights?.emptyWeight,
            weightsKeys: aircraft.weights ? Object.keys(aircraft.weights) : 'NO WEIGHTS'
          });

          if (!aircraft.emptyWeight && aircraft.weights?.emptyWeight) {
            aircraft.emptyWeight = parseFloat(aircraft.weights.emptyWeight);
            console.log(`✅ [AircraftStore] Mapped weights.emptyWeight → emptyWeight for ${aircraft.registration}: ${aircraft.emptyWeight} kg`);
          }
          if (!aircraft.maxTakeoffWeight && aircraft.weights?.mtow) {
            aircraft.maxTakeoffWeight = parseFloat(aircraft.weights.mtow);
          }

          // 🔧 CONVERTIR DEPUIS UNITÉS DE STOCKAGE VERS PRÉFÉRENCES PILOTE
          // Supabase contient TOUJOURS unités de stockage (L, L/h, kg, kt)
          // On convertit vers les préférences du pilote local
          const currentPilotUnits = useUnitsStore.getState().units;
          const storageUnits = aircraft._metadata?.units || {
            fuel: 'ltr',
            fuelConsumption: 'lph',
            speed: 'kt',
            weight: 'kg',
            verticalSpeed: 'fpm',
            altitude: 'ft',
            distance: 'nm'
          };

          let processedAircraft = aircraft;

          // Vérifier si conversion nécessaire
          const needsConversion =
            storageUnits.fuel !== currentPilotUnits.fuel ||
            storageUnits.fuelConsumption !== currentPilotUnits.fuelConsumption ||
            storageUnits.weight !== currentPilotUnits.weight;

          if (needsConversion) {
            console.log('🔄 [AircraftStore] Converting from STORAGE units to PILOT preferences:', {
              registration: aircraft.registration,
              from: storageUnits,
              to: currentPilotUnits
            });

            // Convertir les valeurs depuis unités de stockage vers préférences pilote
            processedAircraft = convertAircraftUnits(aircraft, storageUnits, currentPilotUnits);

            console.log('✅ [AircraftStore] Converted values:', {
              fuelConsumption: processedAircraft.fuelConsumption,
              fuelCapacity: processedAircraft.fuelCapacity
            });
          } else {
            console.log('✓ [AircraftStore] Pilot uses STORAGE units - No conversion needed');
          }

          // Valider et réparer
          const validated = validateAndRepairAircraft(processedAircraft);

          console.log('✅ [AircraftStore] Validated:', {
            registration: validated.registration,
            'validated.hasManex': validated.hasManex
          });

          return validated;
        });


        // 🔧 FIX: Ne PAS télécharger automatiquement les MANEX au démarrage
        // Les MANEX seront téléchargés à la demande (quand l'utilisateur clique sur le bouton)
        // Cela améliore les performances au démarrage et évite de télécharger des fichiers inutiles
        const aircraftWithManex = aircraftList.filter(a => a.hasManex);
        if (aircraftWithManex.length > 0) {
          console.log('ℹ️ [AircraftStore] MANEX disponibles pour:', aircraftWithManex.map(a => a.registration).join(', '));
          console.log('💡 [AircraftStore] Les MANEX seront téléchargés à la demande (clic sur bouton MANEX)');
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
        // 🔧 DEBUG: Vérifier les performanceTables reçues
        console.log('🔍 [AircraftStore.addAircraft] Données reçues:', {
          registration: aircraftData.registration,
          hasPerformanceTables: !!aircraftData.performanceTables,
          performanceTablesCount: aircraftData.performanceTables?.length || 0,
          performanceTablesTypes: aircraftData.performanceTables?.map(t => t.type) || [],
          hasAdvancedPerformance: !!aircraftData.advancedPerformance,
          advancedPerformanceTablesCount: aircraftData.advancedPerformance?.tables?.length || 0,
          advancedPerformanceTypes: aircraftData.advancedPerformance?.tables?.map(t => t.type) || []
        });

        // Valider les données
        const validatedAircraft = validateAndRepairAircraft(aircraftData);

        // Récupérer les préférences d'unités de l'utilisateur
        const userUnits = useUnitsStore.getState().units;

        // 🔧 STRATÉGIE CORRECTE : Supabase = unités STANDARD (normalisées)
        // Chaque utilisateur fait la conversion LOCALEMENT selon ses préférences

        // 🔧 FIX CRITIQUE: Vérifier si les données sont DÉJÀ en STORAGE units
        const currentMetadata = validatedAircraft._metadata?.units;
        const isAlreadyStorageUnits = currentMetadata?.fuel === 'ltr' && currentMetadata?.fuelConsumption === 'lph';

        let normalizedAircraft;

        if (isAlreadyStorageUnits) {
          console.log('✅ [AircraftStore] Data already in STORAGE units - skipping normalization');
          normalizedAircraft = validatedAircraft;
        } else {
          console.log('📤 [AircraftStore] Normalizing aircraft to STORAGE units for Supabase');

          // Créer une copie avec métadonnées indiquant les unités SOURCE (utilisateur)
          const aircraftWithUserMetadata = {
            ...validatedAircraft,
            _metadata: {
              version: '1.0.0',
              units: userUnits,  // Unités SOURCE (avant normalisation)
              exportedAt: new Date().toISOString()
            }
          };

          // Normaliser vers unités de STOCKAGE pour Supabase
          const { normalizeAircraftImport } = await import('@utils/aircraftNormalizer');
          normalizedAircraft = normalizeAircraftImport(aircraftWithUserMetadata);
        }

        console.log('📤 [AircraftStore] Normalized aircraft for Supabase (STORAGE units):', {
          registration: normalizedAircraft.registration,
          fuelConsumption: normalizedAircraft.fuelConsumption,
          fuelCapacity: normalizedAircraft.fuelCapacity,
          sourceUnits: userUnits,
          storageUnits: 'lph/ltr/kg/kt'
        });

        // Préparer les données pour Supabase (avec unités NORMALISÉES)
        const presetData = {
          id: aircraftData.id || aircraftData.aircraftId,  // 🔧 FIX: Passer l'ID pour détecter les variants
          registration: normalizedAircraft.registration,
          model: normalizedAircraft.model,
          manufacturer: normalizedAircraft.manufacturer || 'Inconnu',
          aircraft_type: normalizedAircraft.aircraftType || 'Avion',
          category: normalizedAircraft.category || 'SEP',
          aircraft_data: normalizedAircraft,  // Données normalisées (L, L/h, kg, kt) + _metadata
          description: `Configuration ${normalizedAircraft.model} - ${normalizedAircraft.registration}`,
          submitted_by: 'current-user-id',
          isVariant: aircraftData.isVariant || false  // 🔧 FIX: Flag variant
        };

        // Soumettre à Supabase
        const result = await communityService.submitPreset(
          presetData,
          null, // manexFile
          'current-user-id'
        );

        console.log('✅ [AircraftStore] Preset créé dans Supabase:', result?.id);
        console.log('🔍 [AircraftStore] Result complet:', {
          hasResult: !!result,
          hasId: !!result?.id,
          id: result?.id,
          registration: result?.registration
        });

        // 🔧 FIX: Optimistic update - Ajouter l'avion à la liste locale IMMÉDIATEMENT
        // Cela permet à l'UI de se mettre à jour instantanément sans attendre le rechargement
        if (result && result.id) {
          const state = get();

          // Créer l'objet avion pour la liste locale (en STORAGE units)
          // La conversion vers USER units se fera automatiquement via format() lors de l'affichage
          // 🔧 IMPORTANT: Filtrer les données volumineuses (photo, manex) pour la liste légère
          const { photo, profilePhoto, manex, ...lightAircraft } = normalizedAircraft;

          const newAircraft = {
            ...lightAircraft,
            id: result.id,
            aircraftId: result.id,
            // 🔧 FIX: Ajouter les flags pour le chargement des données volumineuses depuis IndexedDB
            hasPhoto: !!(photo || profilePhoto),
            hasManex: !!manex,
            _metadata: {
              ...normalizedAircraft._metadata,
              supabaseId: result.id
            }
          };

          // 🔧 FIX: Vérifier si l'avion existe déjà dans la liste (éviter doublons)
          // Vérifier DEUX critères : ID ET registration
          const existingByIdIndex = state.aircraftList.findIndex(a => a.id === newAircraft.id);
          const existingByRegIndex = state.aircraftList.findIndex(a =>
            a.registration &&
            newAircraft.registration &&
            a.registration.trim().toUpperCase() === newAircraft.registration.trim().toUpperCase()
          );

          let newList;

          // Cas 1: Même ID → Mise à jour (modification d'un preset existant)
          if (existingByIdIndex >= 0) {
            newList = [...state.aircraftList];
            newList[existingByIdIndex] = newAircraft;
            console.log('🔄 [AircraftStore] Avion mis à jour dans la liste locale (même ID):', {
              id: newAircraft.id,
              registration: newAircraft.registration,
              listLength: newList.length
            });
          }
          // Cas 2: Même registration mais ID différent → DOUBLON détecté !
          else if (existingByRegIndex >= 0) {
            const existing = state.aircraftList[existingByRegIndex];
            console.warn('⚠️ [AircraftStore] DOUBLON détecté - Avion avec cette immatriculation existe déjà:', {
              newId: newAircraft.id,
              newRegistration: newAircraft.registration,
              existingId: existing.id,
              existingRegistration: existing.registration
            });

            // Demander à l'utilisateur : remplacer ou annuler ?
            const shouldReplace = confirm(
              `Un avion avec l'immatriculation "${newAircraft.registration}" existe déjà dans votre liste.\n\n` +
              `Voulez-vous le remplacer par cette nouvelle version ?\n\n` +
              `✓ OUI : Remplacer l'avion existant\n` +
              `✗ NON : Annuler l'ajout (garder l'ancien)`
            );

            if (shouldReplace) {
              // Remplacer l'ancien par le nouveau
              newList = [...state.aircraftList];
              newList[existingByRegIndex] = newAircraft;
              console.log('🔄 [AircraftStore] Avion remplacé (même registration, ID différent):', {
                oldId: existing.id,
                newId: newAircraft.id,
                registration: newAircraft.registration,
                listLength: newList.length
              });

              // Supprimer l'ancien de IndexedDB (ID différent)
              try {
                const dataBackupManager = await import('@utils/dataBackupManager').then(m => m.default);
                await dataBackupManager.deleteAircraftData(existing.id);
                console.log('🗑️ [AircraftStore] Ancien avion supprimé de IndexedDB:', existing.id);
              } catch (error) {
                console.error('❌ [AircraftStore] Erreur suppression ancien avion:', error);
              }
            } else {
              // Annuler l'ajout - garder la liste actuelle
              console.log('❌ [AircraftStore] Ajout annulé par l\'utilisateur (doublon)');
              return null; // Retourner null pour signaler l'annulation
            }
          }
          // Cas 3: Nouvel avion (pas de doublon)
          else {
            newList = [...state.aircraftList, newAircraft];
            console.log('✅ [AircraftStore] Avion ajouté à la liste locale (STORAGE units):', {
              id: newAircraft.id,
              registration: newAircraft.registration,
              listLength: newList.length
            });
          }

          // 🔧 Si l'utilisateur a annulé (doublon refusé), arrêter ici
          if (!newList) {
            set({ isLoading: false, error: null });
            return null;
          }

          set({
            aircraftList: newList,
            isLoading: false,
            error: null
          });

          // 🔧 FIX CRITIQUE: Sauvegarder dans IndexedDB en STORAGE units (ltr/lph/kg/kt)
          // IMPORTANT: Sauvegarder normalizedAircraft (avec photo/manex) PAS newAircraft (sans photo)
          try {
            const dataBackupManager = await import('@utils/dataBackupManager').then(m => m.default);
            const storageAircraft = {
              ...normalizedAircraft,  // ✅ normalizedAircraft contient photo + manex
              id: result.id,
              aircraftId: result.id,
              _metadata: {
                ...normalizedAircraft._metadata,
                supabaseId: result.id,
                savedAt: new Date().toISOString(),
                storageFormat: 'STORAGE_UNITS (ltr/lph/kg/kt)'
              }
            };
            await dataBackupManager.saveAircraftData(storageAircraft);
            console.log('✅ [AircraftStore] Avion sauvegardé dans IndexedDB (STORAGE units):', storageAircraft.registration);
          } catch (error) {
            console.error('❌ [AircraftStore] Erreur sauvegarde IndexedDB:', error);
          }

          // 🔧 FIX: Ne PAS recharger depuis Supabase pour éviter les doublons
          // L'optimistic update suffit. Si besoin de sync, l'utilisateur peut rafraîchir manuellement
          console.log('ℹ️ [AircraftStore] Optimistic update appliqué - Pas de rechargement auto pour éviter doublons');

          // 🔧 FIX: Retourner l'avion complet (newAircraft) au lieu de juste result
          // Pour que le wizard puisse sélectionner l'avion après ajout
          return newAircraft;
        } else {
          console.error('❌ [AircraftStore] Impossible d\'ajouter à la liste - result invalide:', {
            hasResult: !!result,
            hasId: !!result?.id,
            result: result
          });
          // Si pas de result.id, on recharge quand même pour récupérer l'avion
          console.warn('⚠️ [AircraftStore] Pas d\'ID retourné - Rechargement Supabase nécessaire');
          await get().loadFromSupabase();
          return null;
        }
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
        const state = get();
        const index = state.aircraftList.findIndex(a => a.id === aircraftData.id);

        if (index === -1) {
          set({ isLoading: false, error: 'Avion non trouvé' });
          return null;
        }

        // 1. Valider les données
        const validatedAircraft = validateAndRepairAircraft(aircraftData);

        // 2. Mettre à jour localement d'abord (optimistic update)
        const newList = [...state.aircraftList];
        newList[index] = validatedAircraft;
        set({ aircraftList: newList, isLoading: false });

        // 3. Sauvegarder dans Supabase en arrière-plan
        try {
          console.log('📤 Mise à jour de l\'avion dans Supabase:', validatedAircraft.registration);

          await communityService.updateCommunityPreset(
            validatedAircraft.id,
            validatedAircraft,
            null, // pas de MANEX pour l'instant
            null,
            null  // userId - TODO: ajouter l'authentification
          );

          console.log('✅ Avion mis à jour dans Supabase avec succès');
        } catch (supabaseError) {
          console.error('⚠️ Erreur lors de la sauvegarde dans Supabase:', supabaseError);
          // Ne pas bloquer l'utilisateur si Supabase échoue
          // Les données sont déjà mises à jour localement
        }

        return validatedAircraft;
      } catch (error) {
        const errorMessage = `❌ Erreur lors de la mise à jour: ${error.message}`;
        console.error(errorMessage, error);
        set({ isLoading: false, error: errorMessage });
        return null;
      }
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
      // 🔧 FIX: Protection contre rehydratation - state peut être undefined/incomplet
      if (!state || !state.aircraftList) {
        return null;
      }
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

// 🔧 LISTENER : Reconvertir les avions quand les préférences d'unités changent
// Cela garantit que les valeurs affichées sont TOUJOURS dans les unités préférées
let unitsSubscription = null;

if (typeof window !== 'undefined') {
  // Souscrire aux changements de préférences d'unités
  unitsSubscription = useUnitsStore.subscribe(
    (state) => state.units,
    async (newUnits, prevUnits) => {
      // Vérifier si les unités ont vraiment changé
      const unitsChanged =
        newUnits.fuel !== prevUnits.fuel ||
        newUnits.fuelConsumption !== prevUnits.fuelConsumption ||
        newUnits.weight !== prevUnits.weight ||
        newUnits.speed !== prevUnits.speed;

      if (unitsChanged) {
        console.log('🔄 [AircraftStore] Units preferences changed - Reconverting aircraft...', {
          from: prevUnits,
          to: newUnits
        });

        // Recharger tous les avions depuis Supabase avec les nouvelles unités
        const aircraftStore = useAircraftStore.getState();
        if (aircraftStore.isInitialized) {
          try {
            await aircraftStore.loadFromSupabase();
            console.log('✅ [AircraftStore] Aircraft reconverted to new units');
          } catch (error) {
            console.error('❌ [AircraftStore] Failed to reconvert aircraft:', error);
          }
        }
      }
    }
  );
}

// 🔧 HELPER: Corriger la masse à vide de F-HSTR
export const fixFHSTREmptyWeight = async () => {
  try {
    console.log('🔧 Correction de la masse à vide de F-HSTR...');

    const state = useAircraftStore.getState();
    const fhstr = state.aircraftList.find(a => a.registration === 'F-HSTR');

    if (!fhstr) {
      console.error('❌ F-HSTR non trouvé dans le store');
      return false;
    }

    console.log('📋 Masse à vide actuelle:', fhstr.weights?.emptyWeight || fhstr.emptyWeight);

    // Corriger la masse à vide
    const updatedFHSTR = {
      ...fhstr,
      weights: {
        ...fhstr.weights,
        emptyWeight: '900'
      },
      emptyWeight: '900' // pour rétrocompatibilité
    };

    // Utiliser updateAircraft pour sauvegarder dans Supabase
    const result = await useAircraftStore.getState().updateAircraft(updatedFHSTR);

    if (result) {
      console.log('✅ F-HSTR corrigé avec succès - Nouvelle masse à vide: 900 kg');
      return true;
    } else {
      console.error('❌ Échec de la correction');
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la correction de F-HSTR:', error);
    return false;
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
