// src/core/stores/aircraftStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { DEFAULT_AIRCRAFT_LIST } from '@utils/constants';
import { createModuleLogger } from '@utils/logger';
import { validateAndRepairAircraft } from '@utils/aircraftValidation';
import { storeManexOptimized, getManexWithPdf } from './manexStore';
import dataBackupManager from '@utils/dataBackupManager';

const logger = createModuleLogger('AircraftStore');

// Force reload - v2
console.log('🚀 AircraftStore module loaded - v2');

// Store pour la gestion des avions avec optimisations
export const useAircraftStore = create(
  persist(
    subscribeWithSelector(
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
        
        addAircraft: (aircraft) => {
          // console.log('🏪 AircraftStore - addAircraft called with:', aircraft);
          // console.log('🏪 AircraftStore - Surfaces avant validation:', aircraft.compatibleRunwaySurfaces);

          // Valider et réparer l'avion avant de l'ajouter
          const validatedAircraft = validateAndRepairAircraft({
            ...aircraft,
            id: aircraft.id || `aircraft-${Date.now()}`
          });

          // console.log('🏪 AircraftStore - Avion après validation:', validatedAircraft);
          // console.log('🏪 AircraftStore - Surfaces après validation:', validatedAircraft.compatibleRunwaySurfaces);

          // Sauvegarder dans la base de données permanente en arrière-plan (sans bloquer)
          dataBackupManager.saveAircraftData(validatedAircraft)
            .then(() => {
              logger.debug('Aircraft saved to permanent storage:', validatedAircraft.id);
            })
            .catch((error) => {
              // L'erreur n'est pas critique car les données sont dans localStorage
              logger.warn('Background save to permanent storage failed (non-critical):', error);
            });

          const currentState = get();
          // console.log('🏪 AircraftStore - Liste actuelle avant ajout:', currentState.aircraftList.length);
          // console.log('🏪 AircraftStore - IDs actuels:', currentState.aircraftList.map(a => a.id));

          // Vérifier si l'avion existe déjà (par ID ou par immatriculation)
          const existingAircraftById = currentState.aircraftList.find(a => a.id === validatedAircraft.id);
          const existingAircraftByReg = currentState.aircraftList.find(a => a.registration === validatedAircraft.registration);

          if (existingAircraftById) {
            console.log('🚨 AircraftStore - ATTENTION: Avion déjà existant avec ID:', validatedAircraft.id);
            return null; // Ne pas ajouter si déjà présent
          }

          if (existingAircraftByReg) {
            console.log('🚨 AircraftStore - ATTENTION: Avion déjà existant avec immatriculation:', validatedAircraft.registration);
            console.log('💡 Utiliser updateAircraft() pour mettre à jour cet avion');
            return null; // Ne pas ajouter si déjà présent
          }

          // Tenter d'utiliser une approche plus directe pour forcer la mise à jour
          const newList = [...currentState.aircraftList, validatedAircraft];
          console.log('🏪 AircraftStore - Nouvelle liste créée manuellement, longueur:', newList.length);

          set(() => {
            // console.log('🏪 AircraftStore - Dans set() - Retour du nouvel état');
            // console.log('🏪 AircraftStore - Dans set() - Nouvelle liste longueur:', newList.length);
            // console.log('🏪 AircraftStore - Dans set() - Nouvel avion ID:', validatedAircraft.id);
            // console.log('🏪 AircraftStore - Dans set() - Nouveaux IDs:', newList.map(a => a.id));
            return {
              aircraftList: newList,
              // Optionnel: forcer une mise à jour du selectedAircraftId si aucun n'est sélectionné
              selectedAircraftId: currentState.selectedAircraftId || validatedAircraft.id
            };
          });

          // Logs de vérification désactivés pour les performances
          // setTimeout(() => {
          //   const newState = get();
          //   console.log('🏪 AircraftStore - État final après set:');
          //   console.log('  - Liste longueur:', newState.aircraftList.length);
          //   console.log('  - IDs finaux:', newState.aircraftList.map(a => a.id));
          // }, 100);

          // Retourner l'avion validé pour confirmer l'ajout
          return validatedAircraft;
        },
        
        updateAircraft: (aircraft) => {
          // console.log('🔄 AircraftStore - updateAircraft called with:', aircraft);
          // console.log('🔄 AircraftStore - Surfaces avant update:', aircraft.compatibleRunwaySurfaces);
          
          const state = get();
          const index = state.aircraftList.findIndex(a => a.id === aircraft.id);
          if (index !== -1) {
            // Valider et réparer l'avion avant de le mettre à jour
            const validatedAircraft = validateAndRepairAircraft(aircraft);
            
            // console.log('🔄 AircraftStore - Surfaces après validation:', validatedAircraft.compatibleRunwaySurfaces);
            
            // Sauvegarder dans la base de données permanente en arrière-plan (sans bloquer)
            dataBackupManager.saveAircraftData(validatedAircraft)
              .then(() => {
                logger.debug('Aircraft updated in permanent storage:', validatedAircraft.id);
              })
              .catch((error) => {
                // L'erreur n'est pas critique car les données sont dans localStorage
                logger.warn('Background save to permanent storage failed (non-critical):', error);
              });
            
            const newList = [...state.aircraftList];
            newList[index] = validatedAircraft;
            
            // console.log('🔄 AircraftStore - Nouvelle liste après update, avion mis à jour:', validatedAircraft.registration);
            // console.log('🔄 AircraftStore - Surfaces finales:', validatedAircraft.compatibleRunwaySurfaces);

            set({ aircraftList: newList });
            return validatedAircraft;
          }
          return null;
        },
        
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
        
        deleteAircraft: async (id) => {
          // Note: Vérifier si la protection est activée avant de supprimer
          const isProtected = dataBackupManager.isProtected();
          if (isProtected) {
            const confirmDelete = window.confirm('La protection des données est activée. Êtes-vous sûr de vouloir supprimer cet avion ?');
            if (!confirmDelete) return;
          }
          
          set((state) => {
            const newList = state.aircraftList.filter(a => a.id !== id);
            // Si l'avion supprimé était sélectionné, sélectionner le premier
            if (state.selectedAircraftId === id) {
              return {
                aircraftList: newList,
                selectedAircraftId: newList[0]?.id || null
              };
            }
            return { aircraftList: newList };
          });
        },
        
        importAircraftList: (list) => set({
          aircraftList: list,
          selectedAircraftId: list[0]?.id || null
        }),
        
        resetToDefault: () => set({
          aircraftList: DEFAULT_AIRCRAFT_LIST,
          selectedAircraftId: DEFAULT_AIRCRAFT_LIST[0]?.id || null
        }),
        
        // Fonction de migration pour ajouter les surfaces compatibles aux avions existants
        migrateAircraftSurfaces: () => {
          const state = get();
          const updatedList = state.aircraftList.map(aircraft => {
            if (!aircraft.compatibleRunwaySurfaces || aircraft.compatibleRunwaySurfaces.length === 0) {
              logger.debug(`Migrating aircraft ${aircraft.registration} - adding default surfaces`);
              return {
                ...aircraft,
                compatibleRunwaySurfaces: ['ASPH', 'CONC'], // Surfaces par défaut
                approvedOperations: aircraft.approvedOperations || {
                  vfrDay: true,
                  vfrNight: false,
                  ifrDay: false,
                  ifrNight: false
                }
              };
            }
            return aircraft;
          });
          
          set({ aircraftList: updatedList });
          logger.debug('Aircraft migration completed');
        },
        
        // Getter calculé avec validation automatique
        get selectedAircraft() {
          const state = get();

          // Protection contre l'accès pendant l'initialisation
          if (!state || !state.aircraftList) {
            return null;
          }

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
      })
    ),
    {
      name: 'aircraft-storage',
      storage: createJSONStorage(() => {
        console.log('💾 Creating JSON storage, checking localStorage...');
        const stored = localStorage.getItem('aircraft-storage');
        console.log('💾 Current localStorage value:', stored ? 'Found' : 'Not found', stored?.length, 'chars');
        return localStorage;
      }),
      partialize: (state) => {
          console.log('💾 AircraftStore - partialize called with state:', {
            aircraftCount: state.aircraftList?.length,
            selectedId: state.selectedAircraftId
          });

          const result = {
            // Exclure les photos et autres données volumineuses de localStorage
            aircraftList: state.aircraftList.map(aircraft => {
              const { photo, manex, ...aircraftWithoutLargeData } = aircraft;
              const hasPhoto = !!photo;
              const hasManex = !!manex;

              if (hasPhoto) {
                console.log(`💾 Aircraft ${aircraft.registration} has photo (size: ${photo?.length || 0} chars)`);
              }

              return {
                ...aircraftWithoutLargeData,
                // Conserver seulement un flag pour savoir si une photo existe
                hasPhoto,
                hasManex
              };
            }),
            selectedAircraftId: state.selectedAircraftId
          };

          console.log('💾 AircraftStore - partialize result:', {
            aircraftCount: result.aircraftList.length,
            selectedId: result.selectedAircraftId,
            firstAircraftReg: result.aircraftList[0]?.registration
          });

          return result;
        },
        onRehydrateStorage: () => {
          return async (state, error) => {
            console.log('🔄 AircraftStore - Rehydrating from localStorage...');
            console.log('🔄 State received:', state);
            console.log('🔄 State type:', typeof state);
            console.log('🔄 State keys:', state ? Object.keys(state) : 'N/A');
            console.log('🔄 aircraftList:', state?.aircraftList);
            console.log('🔄 Error:', error);

            if (error) {
              console.error('❌ AircraftStore - Error during rehydration:', error);
              return;
            }

            // Valider et réparer tous les avions lors du chargement depuis localStorage
            if (state && state.aircraftList && state.aircraftList.length > 0) {
              console.log(`📥 AircraftStore - Found ${state.aircraftList.length} aircraft(s) in localStorage`);

              // D'abord, s'assurer que les données de base sont valides
              const validatedAircraftList = state.aircraftList.map(aircraft => {
                console.log(`✅ AircraftStore - Validating aircraft: ${aircraft.registration}`);
                return validateAndRepairAircraft(aircraft);
              });

              // Mettre à jour le state avec les données validées
              // Note: on ne peut pas modifier state directement, Zustand l'a déjà appliqué
              // On va utiliser setState après l'initialisation
              console.log('✅ AircraftStore - Aircraft list validated and loaded from localStorage');

              // Ensuite, charger les photos et MANEX depuis IndexedDB de manière asynchrone
              // On utilise setTimeout pour laisser le temps à Zustand de terminer l'initialisation
              setTimeout(async () => {
                try {
                  console.log('📸 AircraftStore - Loading photos and MANEX from IndexedDB...');

                  // Récupérer la liste actuelle depuis le store
                  const currentState = useAircraftStore.getState();
                  const currentAircraftList = currentState.aircraftList;

                  const enrichedAircraftList = await Promise.all(
                    currentAircraftList.map(async (aircraft) => {
                      let enrichedAircraft = { ...aircraft };

                      // Charger la photo depuis aircraftData
                      if (aircraft.hasPhoto) {
                        try {
                          const fullData = await dataBackupManager.getAircraftData(aircraft.id);
                          if (fullData && fullData.photo) {
                            console.log(`📸 Loaded photo for ${aircraft.registration}`);
                            enrichedAircraft.photo = fullData.photo;
                          }
                        } catch (error) {
                          console.warn(`⚠️ Failed to load photo for ${aircraft.registration}:`, error);
                        }
                      }

                      // Charger le MANEX depuis manexStore
                      if (aircraft.hasManex) {
                        try {
                          const manexData = await getManexWithPdf(aircraft.id);
                          if (manexData) {
                            console.log(`📚 Loaded MANEX for ${aircraft.registration}`);
                            enrichedAircraft.manex = manexData;
                          }
                        } catch (error) {
                          console.warn(`⚠️ Failed to load MANEX for ${aircraft.registration}:`, error);
                        }
                      }

                      return enrichedAircraft;
                    })
                  );

                  // Utiliser useAircraftStore.setState pour forcer la mise à jour
                  useAircraftStore.setState({ aircraftList: enrichedAircraftList });
                  console.log('✅ AircraftStore - Photos and MANEX loaded from IndexedDB');
                } catch (error) {
                  console.error('❌ AircraftStore - Error loading photos from IndexedDB:', error);
                }
              }, 100);
            } else {
              console.log('ℹ️ AircraftStore - No aircraft found in localStorage, using defaults');
            }
          };
        }
      }
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