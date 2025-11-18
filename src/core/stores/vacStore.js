// src/core/stores/vacStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { vacPdfStorage } from '../../services/vacPdfStorage';

// Créer le store simplifié pour l'import manuel uniquement
const vacStore = create(
  persist(
    immer((set, get) => ({
      // État
      charts: {},
      selectedChart: null,
      
      // Actions
      addCustomChart: (icao, chartData) => set(state => {
        // Vérifier que l'ICAO est valide
        if (!icao || typeof icao !== 'string') {
          console.error('ICAO invalide dans vacStore:', icao);
          return;
        }
        const upperIcao = icao.toUpperCase();
        // Remplacer directement la carte si elle existe
        state.charts[upperIcao] = {
          ...chartData,
          icao: upperIcao,
          isCustom: true,
          isDownloaded: true,
          // Initialiser les points VFR personnalisés si nécessaire
          customVfrPoints: chartData.customVfrPoints || []
        };
      }),
      
      // Gestion des points VFR personnalisés
      addCustomVfrPoint: (icao, vfrPoint) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (!state.charts[upperIcao]) {
          console.error('Aérodrome non trouvé:', upperIcao);
          return;
        }
        
        const newPoint = {
          id: `custom-vfr-${Date.now()}`,
          ...vfrPoint,
          isCustom: true,
          createdAt: new Date().toISOString()
        };
        
        if (!state.charts[upperIcao].customVfrPoints) {
          state.charts[upperIcao].customVfrPoints = [];
        }
        
        state.charts[upperIcao].customVfrPoints.push(newPoint);
              }),
      
      updateCustomVfrPoint: (icao, pointId, updates) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (!state.charts[upperIcao]?.customVfrPoints) return;
        
        const pointIndex = state.charts[upperIcao].customVfrPoints.findIndex(p => p.id === pointId);
        if (pointIndex !== -1) {
          state.charts[upperIcao].customVfrPoints[pointIndex] = {
            ...state.charts[upperIcao].customVfrPoints[pointIndex],
            ...updates,
            updatedAt: new Date().toISOString()
          };
        }
      }),
      
      deleteCustomVfrPoint: (icao, pointId) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (!state.charts[upperIcao]?.customVfrPoints) return;
        
        state.charts[upperIcao].customVfrPoints = state.charts[upperIcao].customVfrPoints.filter(
          p => p.id !== pointId
        );
      }),
      
      deleteChart: async (icao) => {
        const upperIcao = icao.toUpperCase();

        // Supprimer le PDF de IndexedDB
        try {
          await vacPdfStorage.deletePDF(upperIcao);
          console.log(`✅ PDF VAC ${upperIcao} supprimé de IndexedDB`);
        } catch (error) {
          console.error('⚠️ Erreur suppression PDF:', error);
        }

        // Supprimer du store
        set(state => {
          // Si c'est une carte custom, la supprimer
          if (state.charts[upperIcao]?.isCustom) {
            delete state.charts[upperIcao];

            // Supprimer du localStorage aussi
            const storedCharts = JSON.parse(localStorage.getItem('customVACCharts') || '{}');
            delete storedCharts[upperIcao];
            localStorage.setItem('customVACCharts', JSON.stringify(storedCharts));
          }
        });
      },
      
      selectChart: (icao) => set(state => {
        state.selectedChart = icao;
      }),
      
      updateExtractedData: (icao, data) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (state.charts[upperIcao]) {
          // Mettre à jour les données extraites si la carte existe
          state.charts[upperIcao].extractedData = data;
          // Mettre à jour aussi circuitAltitude au niveau racine pour compatibilité
          if (data.circuitAltitude !== undefined) {
            state.charts[upperIcao].circuitAltitude = data.circuitAltitude;
          }
          if (data.integrationAltitude !== undefined) {
            state.charts[upperIcao].integrationAltitude = data.integrationAltitude;
          }
        } else {
          // CRÉER la carte si elle n'existe pas (fallback)
          console.warn(`⚠️ updateExtractedData: Carte ${upperIcao} n'existe pas, création automatique`);
          state.charts[upperIcao] = {
            icao: upperIcao,
            name: data.airportName || upperIcao,
            isCustom: true,
            isDownloaded: true,
            downloadDate: new Date().toISOString(),
            extractedData: data,
            circuitAltitude: data.circuitAltitude,
            integrationAltitude: data.integrationAltitude,
            coordinates: data.coordinates || { lat: 0, lon: 0 },
            customVfrPoints: []
          };
        }
      }),
      
      updateChartData: (icao, updates) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (state.charts[upperIcao]) {
          state.charts[upperIcao] = {
            ...state.charts[upperIcao],
            ...updates
          };
        }
      }),
      
      // Sélecteurs
      getChartByIcao: (icao) => {
        return get().charts[icao?.toUpperCase()];
      },
      
      getDownloadedCharts: () => {
        return Object.values(get().charts).filter(c => c.isDownloaded);
      }
    })),
    {
      name: 'vac-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        charts: state.charts
      })
    }
  )
);

// Exposer le store globalement pour l'accès depuis d'autres services
if (typeof window !== 'undefined') {
  window.vacStore = vacStore;
}

// Export du hook
export const useVACStore = vacStore;

// Sélecteurs optimisés
export const vacSelectors = {
  useChartByIcao: (icao) => useVACStore(state => state.getChartByIcao(icao)),
  useDownloadedCharts: () => useVACStore(state => state.getDownloadedCharts()),
  useVACActions: () => useVACStore(
    state => ({
      deleteChart: state.deleteChart,
      selectChart: state.selectChart,
      updateExtractedData: state.updateExtractedData,
      updateChartData: state.updateChartData,
      addCustomChart: state.addCustomChart,
      addCustomVfrPoint: state.addCustomVfrPoint,
      updateCustomVfrPoint: state.updateCustomVfrPoint,
      deleteCustomVfrPoint: state.deleteCustomVfrPoint
    }),
    (a, b) => Object.is(a, b)
  )
};