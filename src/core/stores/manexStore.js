// src/core/stores/manexStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import indexedDBStorage from '../../utils/indexedDBStorage';

/**
 * Store hybride pour les données MANEX
 * - Métadonnées légères dans localStorage via Zustand
 * - PDFs volumineux dans IndexedDB
 */
export const useManexStore = create(
  persist(
    (set, get) => ({
      // État - stockage des métadonnées MANEX par ID d'avion (sans PDF)
      manexData: {},
      
      // Actions
      setManexData: (aircraftId, data) => set((state) => ({
        manexData: {
          ...state.manexData,
          [aircraftId]: {
            ...data,
            lastUpdated: new Date().toISOString()
          }
        }
      })),
      
      getManexData: (aircraftId) => {
        const state = get();
        return state.manexData[aircraftId] || null;
      },
      
      removeManexData: (aircraftId) => set((state) => {
        const newData = { ...state.manexData };
        delete newData[aircraftId];
        return { manexData: newData };
      }),
      
      // Nettoyer toutes les données MANEX
      clearAllManexData: () => set({ manexData: {} }),
      
      // Obtenir la taille totale stockée
      getStorageSize: () => {
        const state = get();
        const dataStr = JSON.stringify(state.manexData);
        const sizeInBytes = new Blob([dataStr]).size;
        return {
          bytes: sizeInBytes,
          mb: (sizeInBytes / (1024 * 1024)).toFixed(2)
        };
      }
    }),
    {
      name: 'manex-storage',
      storage: createJSONStorage(() => localStorage),
      // On peut limiter ce qui est persisté si nécessaire
      partialize: (state) => ({
        manexData: state.manexData
      }),
      // Vérifier la taille lors du chargement
      onRehydrateStorage: () => (state) => {
        if (state) {
          const dataStr = JSON.stringify(state.manexData || {});
          const sizeMb = (new Blob([dataStr]).size / (1024 * 1024)).toFixed(2);
                    
          // Si la taille est trop grande (>10MB), on peut nettoyer les vieux PDF
          if (parseFloat(sizeMb) > 10) {
                      }
        }
      }
    }
  )
);
// Fonction utilitaire pour stocker les données MANEX de manière optimisée
export const storeManexOptimized = async (aircraftId, manexData) => {
  const { setManexData } = useManexStore.getState();
  
  try {
    // Séparer les données volumineuses (PDF) des métadonnées
    const { pdfData, ...metadata } = manexData;
    
    if (pdfData) {
      // Stocker le PDF dans IndexedDB
      await indexedDBStorage.saveManexPDF(aircraftId, manexData);
          }
    
    // Stocker uniquement les métadonnées dans le localStorage via Zustand
    setManexData(aircraftId, {
      ...metadata,
      hasIndexedDBData: !!pdfData,
      lastUpdated: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Erreur lors du stockage optimisé du MANEX:', error);
    
    // Fallback: essayer de stocker sans le PDF si IndexedDB échoue
    if (error.message.includes('quota')) {
      const { pdfData, ...metadataOnly } = manexData;
      setManexData(aircraftId, {
        ...metadataOnly,
        hasIndexedDBData: false,
        lastUpdated: new Date().toISOString(),
        error: 'PDF trop volumineux - seules les métadonnées sont stockées'
      });
      throw new Error('Le PDF est trop volumineux. Seules les données extraites ont été sauvegardées.');
    }
    
    throw error;
  }
};

// Fonction pour récupérer les données MANEX avec le PDF
export const getManexWithPdf = async (aircraftId) => {
  const { getManexData } = useManexStore.getState();
  const metadata = getManexData(aircraftId);
  
  if (!metadata) return null;
  
  // Si le PDF est dans IndexedDB, le récupérer
  if (metadata.hasIndexedDBData) {
    try {
      const pdfData = await indexedDBStorage.getManexPDF(aircraftId);
      if (pdfData) {
        return {
          ...metadata,
          pdfData: pdfData.pdfData
        };
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du PDF depuis IndexedDB:', error);
    }
  }
  
  // Sinon retourner juste les métadonnées
  return metadata;
};

export default useManexStore;