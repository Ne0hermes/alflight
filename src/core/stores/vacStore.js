// src/core/stores/vacStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Configuration des cartes VAC
const VAC_CONFIG = {
  baseUrl: 'https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_20_SEP_2024/FRANCE/AIRAC-2024-09-20/pdf/FR-AD-2',
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
    'LFPG': { 
      url: 'AD-2.LFPG-fr-FR.pdf',
      name: 'Paris Charles de Gaulle',
      coordinates: { lat: 49.0097, lon: 2.5479 }
    },
    'LFPO': { 
      url: 'AD-2.LFPO-fr-FR.pdf',
      name: 'Paris Orly',
      coordinates: { lat: 48.7233, lon: 2.3794 }
    },
    'LFPB': { 
      url: 'AD-2.LFPB-fr-FR.pdf',
      name: 'Paris Le Bourget',
      coordinates: { lat: 48.9694, lon: 2.4414 }
    },
    'LFBO': { 
      url: 'AD-2.LFBO-fr-FR.pdf',
      name: 'Toulouse Blagnac',
      coordinates: { lat: 43.6291, lon: 1.3633 }
    },
    'LFML': { 
      url: 'AD-2.LFML-fr-FR.pdf',
      name: 'Marseille Provence',
      coordinates: { lat: 43.4365, lon: 5.2148 }
    },
    'LFMN': { 
      url: 'AD-2.LFMN-fr-FR.pdf',
      name: 'Nice Côte d\'Azur',
      coordinates: { lat: 43.6584, lon: 7.2158 }
    },
    'LFLL': { 
      url: 'AD-2.LFLL-fr-FR.pdf',
      name: 'Lyon Saint-Exupéry',
      coordinates: { lat: 45.7263, lon: 5.0908 }
    },
    'LFBD': { 
      url: 'AD-2.LFBD-fr-FR.pdf',
      name: 'Bordeaux Mérignac',
      coordinates: { lat: 44.8283, lon: -0.7156 }
    }
  }
};

// Store Zustand pour les cartes VAC
export const useVACStore = create(
  persist(
    immer((set, get) => ({
      // État
      charts: {}, // Object<icao, chartInfo>
      downloading: {}, // Object<icao, boolean>
      errors: {}, // Object<icao, error>
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
            pdfUrl: null,
            extractedData: null
          };
        }
      }),
      
      downloadChart: async (icao) => {
        const upperIcao = icao.toUpperCase();
        const chart = get().charts[upperIcao];
        
        if (!chart) {
          get().initializeChart(upperIcao);
          return false;
        }
        
        set(state => {
          state.downloading[upperIcao] = true;
          delete state.errors[upperIcao];
        });
        
        try {
          console.log(`📥 Téléchargement carte VAC ${upperIcao}...`);
          
          // Simulation du téléchargement (en production, utiliser un proxy ou CORS)
          // Pour l'instant, on simule avec des données extraites
          const mockExtractedData = get().getMockExtractedData(upperIcao);
          
          set(state => {
            state.charts[upperIcao] = {
              ...state.charts[upperIcao],
              isDownloaded: true,
              downloadDate: Date.now(),
              fileSize: 2.5, // MB
              extractedData: mockExtractedData
            };
            delete state.downloading[upperIcao];
          });
          
          console.log(`✅ Carte VAC ${upperIcao} téléchargée`);
          return true;
          
        } catch (error) {
          set(state => {
            state.errors[upperIcao] = error.message;
            delete state.downloading[upperIcao];
          });
          return false;
        }
      },
      
      deleteChart: (icao) => set(state => {
        const upperIcao = icao.toUpperCase();
        delete state.charts[upperIcao];
        delete state.downloading[upperIcao];
        delete state.errors[upperIcao];
        if (state.selectedChart === upperIcao) {
          state.selectedChart = null;
        }
      }),
      
      selectChart: (icao) => set(state => {
        state.selectedChart = icao ? icao.toUpperCase() : null;
      }),
      
      updateExtractedData: (icao, data) => set(state => {
        const upperIcao = icao.toUpperCase();
        if (state.charts[upperIcao]) {
          state.charts[upperIcao].extractedData = {
            ...state.charts[upperIcao].extractedData,
            ...data
          };
        }
      }),
      
      // Sélecteurs
      getChartByIcao: (icao) => {
        return get().charts[icao?.toUpperCase()];
      },
      
      isDownloading: (icao) => {
        return !!get().downloading[icao?.toUpperCase()];
      },
      
      getError: (icao) => {
        return get().errors[icao?.toUpperCase()];
      },
      
      getAvailableCharts: () => {
        return Object.keys(VAC_CONFIG.charts);
      },
      
      getDownloadedCharts: () => {
        return Object.values(get().charts).filter(c => c.isDownloaded);
      },
      
      // Données simulées extraites
      getMockExtractedData: (icao) => {
        const mockData = {
          'LFPN': {
            airportElevation: 538,
            runways: [
              { identifier: '07/25', qfu: 70, length: 1100, width: 30, surface: 'Asphalte' },
              { identifier: '07R/25L', qfu: 70, length: 1845, width: 45, surface: 'Asphalte' }
            ],
            frequencies: {
              twr: '118.850',
              gnd: '121.950',
              atis: '128.425'
            },
            circuitAltitude: 1538,
            magneticVariation: 1
          },
          'LFPT': {
            airportElevation: 325,
            runways: [
              { identifier: '05/23', qfu: 50, length: 1240, width: 30, surface: 'Asphalte' },
              { identifier: '12/30', qfu: 120, length: 2100, width: 45, surface: 'Asphalte' }
            ],
            frequencies: {
              twr: '120.900',
              gnd: '121.800',
              atis: '127.175'
            },
            circuitAltitude: 1325,
            magneticVariation: 1
          },
          'LFPG': {
            airportElevation: 392,
            runways: [
              { identifier: '08L/26R', qfu: 80, length: 2700, width: 60, surface: 'Béton' },
              { identifier: '08R/26L', qfu: 80, length: 4200, width: 60, surface: 'Béton' },
              { identifier: '09L/27R', qfu: 90, length: 4200, width: 60, surface: 'Béton' },
              { identifier: '09R/27L', qfu: 90, length: 2700, width: 45, surface: 'Béton' }
            ],
            frequencies: {
              twr: '119.250',
              gnd: '121.600',
              atis: '131.175'
            },
            circuitAltitude: null,
            magneticVariation: 1
          },
          'LFPO': {
            airportElevation: 291,
            runways: [
              { identifier: '06/24', qfu: 60, length: 3320, width: 45, surface: 'Béton' },
              { identifier: '07/25', qfu: 70, length: 3650, width: 45, surface: 'Béton' },
              { identifier: '08/26', qfu: 80, length: 2400, width: 60, surface: 'Béton' }
            ],
            frequencies: {
              twr: '118.700',
              gnd: '121.850',
              atis: '127.525'
            },
            circuitAltitude: null,
            magneticVariation: 1
          },
          'LFBO': {
            airportElevation: 499,
            runways: [
              { identifier: '14L/32R', qfu: 140, length: 3000, width: 45, surface: 'Béton' },
              { identifier: '14R/32L', qfu: 140, length: 3500, width: 60, surface: 'Béton' }
            ],
            frequencies: {
              twr: '118.100',
              gnd: '121.900',
              atis: '126.525'
            },
            circuitAltitude: null,
            magneticVariation: 0
          }
        };
        
        return mockData[icao] || {
          airportElevation: 0,
          runways: [],
          frequencies: {},
          circuitAltitude: null,
          magneticVariation: 0
        };
      }
    })),
    {
      name: 'vac-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        charts: Object.fromEntries(
          Object.entries(state.charts).map(([icao, chart]) => [
            icao,
            {
              ...chart,
              pdfUrl: null // Ne pas persister les URLs blob
            }
          ])
        )
      })
    }
  )
);

// Sélecteurs optimisés
export const vacSelectors = {
  useChartByIcao: (icao) => useVACStore(state => state.getChartByIcao(icao)),
  useIsDownloading: (icao) => useVACStore(state => state.isDownloading(icao)),
  useError: (icao) => useVACStore(state => state.getError(icao)),
  useSelectedChart: () => useVACStore(state => state.selectedChart),
  useAvailableCharts: () => useVACStore(state => state.getAvailableCharts()),
  useDownloadedCharts: () => useVACStore(state => state.getDownloadedCharts()),
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

// Export de la configuration pour d'autres modules
export { VAC_CONFIG };