// src/core/stores/vacStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Configuration des cartes VAC avec URLs réelles
export const VAC_CONFIG = {
  baseUrl: 'https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_28_NOV_2024/FRANCE/AIRAC-2024-11-28/pdf/FR-AD-2',
  charts: {
    'LFPN': { 
      url: 'AD-2.LFPN-fr-FR.pdf',
      name: 'Toussus-le-Noble',
      coordinates: { lat: 48.7519, lon: 2.1061 }
    },
    'LFPT': { 
      url: 'AD-2.LFPT-fr-FR.pdf',
      name: 'Pontoise-Cormeilles',
      coordinates: { lat: 49.0968, lon: 2.0413 }
    },
    'LFST': {
      url: 'AD-2.LFST-fr-FR.pdf',
      name: 'Strasbourg-Entzheim',
      coordinates: { lat: 48.5444, lon: 7.6283 }
    },
    'LFPG': { 
      url: 'AD-2.LFPG-fr-FR.pdf',
      name: 'Paris Charles de Gaulle',
      coordinates: { lat: 49.0097, lon: 2.5479 }
    },
    // ... autres aéroports
  }
};

export const useVACStore = create(
  persist(
    immer((set, get) => ({
      // État
      charts: {},
      downloading: {},
      errors: {},
      selectedChart: null,
      
      // Actions
      initializeChart: (icao) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (!state.charts[upperIcao] && VAC_CONFIG.charts[upperIcao]) {
          state.charts[upperIcao] = {
            icao: upperIcao,
            name: VAC_CONFIG.charts[upperIcao].name,
            url: `${VAC_CONFIG.baseUrl}/${VAC_CONFIG.charts[upperIcao].url}`,
            coordinates: VAC_CONFIG.charts[upperIcao].coordinates,
            isDownloaded: false,
            downloadDate: null,
            fileSize: null,
            extractedData: null
          };
        }
      }),
      
      downloadChart: async (icao) => {
        const upperIcao = icao.toUpperCase();
        const chartConfig = VAC_CONFIG.charts[upperIcao];
        
        if (!chartConfig) {
          set(state => {
            state.errors[upperIcao] = 'Aéroport non disponible';
          });
          return false;
        }
        
        set(state => {
          state.downloading[upperIcao] = true;
          delete state.errors[upperIcao];
        });
        
        try {
          console.log(`📥 Simulation téléchargement carte VAC ${upperIcao}...`);
          
          // Simulation du téléchargement (en production, télécharger le vrai PDF)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Données simulées d'extraction
          const simulatedData = {
            airportElevation: getSimulatedElevation(upperIcao),
            runways: getSimulatedRunways(upperIcao),
            frequencies: getSimulatedFrequencies(upperIcao),
            circuitAltitude: getSimulatedElevation(upperIcao) + 1000,
            magneticVariation: 2
          };
          
          set(state => {
            state.charts[upperIcao] = {
              ...state.charts[upperIcao],
              isDownloaded: true,
              downloadDate: Date.now(),
              fileSize: (Math.random() * 5 + 1).toFixed(2), // MB
              extractedData: simulatedData
            };
            delete state.downloading[upperIcao];
          });
          
          console.log(`✅ Carte VAC ${upperIcao} simulée téléchargée`);
          return true;
          
        } catch (error) {
          console.error(`❌ Erreur téléchargement ${upperIcao}:`, error);
          set(state => {
            state.errors[upperIcao] = error.message;
            delete state.downloading[upperIcao];
          });
          return false;
        }
      },
      
      deleteChart: (icao) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (state.charts[upperIcao]) {
          state.charts[upperIcao] = {
            ...state.charts[upperIcao],
            isDownloaded: false,
            downloadDate: null,
            fileSize: null,
            extractedData: null
          };
        }
      }),
      
      selectChart: (icao) => set(state => {
        state.selectedChart = icao;
      }),
      
      updateExtractedData: (icao, data) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (state.charts[upperIcao]) {
          state.charts[upperIcao].extractedData = data;
        }
      }),
      
      // Sélecteurs
      getChartByIcao: (icao) => {
        return get().charts[icao?.toUpperCase()];
      },
      
      getDownloadedCharts: () => {
        return Object.values(get().charts).filter(c => c.isDownloaded);
      },
      
      isDownloading: (icao) => {
        return !!get().downloading[icao?.toUpperCase()];
      },
      
      getError: (icao) => {
        return get().errors[icao?.toUpperCase()];
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

// Sélecteurs optimisés
export const vacSelectors = {
  useChartByIcao: (icao) => useVACStore(state => state.getChartByIcao(icao)),
  useDownloadedCharts: () => useVACStore(state => state.getDownloadedCharts()),
  useAvailableCharts: () => Object.keys(VAC_CONFIG.charts),
  useIsDownloading: (icao) => useVACStore(state => state.isDownloading(icao)),
  useError: (icao) => useVACStore(state => state.getError(icao)),
  useVACActions: () => useVACStore(
    state => ({
      initializeChart: state.initializeChart,
      downloadChart: state.downloadChart,
      deleteChart: state.deleteChart,
      selectChart: state.selectChart,
      updateExtractedData: state.updateExtractedData
    }),
    (a, b) => Object.is(a, b)
  )
};

// Fonctions helper pour simulation
function getSimulatedElevation(icao) {
  const elevations = {
    'LFPN': 538,
    'LFPT': 325,
    'LFST': 505,
    'LFPG': 392
  };
  return elevations[icao] || 300;
}

function getSimulatedRunways(icao) {
  const runways = {
    'LFPN': [
      { identifier: '07/25', qfu: 070, length: 1100, width: 30, surface: 'Revêtue' }
    ],
    'LFPT': [
      { identifier: '05/23', qfu: 050, length: 1650, width: 45, surface: 'Revêtue' },
      { identifier: '12/30', qfu: 120, length: 950, width: 100, surface: 'Herbe' }
    ],
    'LFST': [
      { identifier: '05/23', qfu: 046, length: 2400, width: 45, surface: 'Revêtue' }
    ],
    'LFPG': [
      { identifier: '09L/27R', qfu: 087, length: 2700, width: 45, surface: 'Revêtue' },
      { identifier: '09R/27L', qfu: 087, length: 4200, width: 60, surface: 'Revêtue' }
    ]
  };
  return runways[icao] || [];
}

function getSimulatedFrequencies(icao) {
  return {
    twr: '118.850',
    gnd: '121.950',
    atis: '128.450'
  };
}