// src/modules/vac/store/vacStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Store Zustand pour le module VAC
export const useVACStore = create(
  persist(
    (set, get) => ({
      // État initial - Utilisation d'objets au lieu de Maps
      charts: {},  // { chartId: chartData }
      airports: [],
      selectedAirport: null,
      downloadQueue: [],
      isOnline: navigator.onLine,
      lastSync: null,
      storageUsed: 0,
      storageQuota: 0,

      // Charger la liste des cartes disponibles
      loadChartsList: async () => {
        try {
          const mockCharts = [
            {
              id: 'LFPG-VAC-2024-01',
              airportIcao: 'LFPG',
              airportName: 'Paris Charles de Gaulle',
              type: 'VAC',
              version: '2024-01',
              effectiveDate: new Date('2024-01-25'),
              expiryDate: new Date('2024-02-22'),
              fileSize: 2.5 * 1024 * 1024,
              isDownloaded: false,
              isOutdated: false,
              extractionStatus: 'pending',
              extractedData: null
            },
            {
              id: 'LFPO-VAC-2024-01',
              airportIcao: 'LFPO',
              airportName: 'Paris Orly',
              type: 'VAC',
              version: '2024-01',
              effectiveDate: new Date('2024-01-25'),
              expiryDate: new Date('2024-02-22'),
              fileSize: 2.2 * 1024 * 1024,
              isDownloaded: false,
              isOutdated: false,
              extractionStatus: 'pending',
              extractedData: null
            },
            {
              id: 'LFPB-VAC-2024-01',
              airportIcao: 'LFPB',
              airportName: 'Paris Le Bourget',
              type: 'VAC',
              version: '2024-01',
              effectiveDate: new Date('2024-01-25'),
              expiryDate: new Date('2024-02-22'),
              fileSize: 1.8 * 1024 * 1024,
              isDownloaded: false,
              isOutdated: false,
              extractionStatus: 'pending',
              extractedData: null
            }
          ];

          const chartsObject = {};
          mockCharts.forEach(chart => {
            chartsObject[chart.id] = chart;
          });

          set({ charts: chartsObject });
        } catch (error) {
          console.error('Erreur chargement des cartes:', error);
        }
      },

      // Télécharger une carte
      downloadChart: async (chartId) => {
        const chart = get().charts[chartId];
        if (!chart) return;

        set(state => ({
          downloadQueue: [...state.downloadQueue, chartId]
        }));

        try {
          // Simuler le téléchargement
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Mettre à jour les métadonnées
          const updatedChart = {
            ...chart,
            isDownloaded: true,
            downloadDate: new Date(),
            lastAccessed: new Date(),
            extractionStatus: 'completed',
            extractedData: {
              runways: [
                { identifier: '09L', qfu: 90, length: 2700, width: 45, surface: 'ASPH' },
                { identifier: '27R', qfu: 270, length: 2700, width: 45, surface: 'ASPH' }
              ],
              frequencies: [
                { type: 'TWR', frequency: '118.750', hours: 'H24' },
                { type: 'GND', frequency: '121.900', hours: 'H24' },
                { type: 'ATIS', frequency: '127.375', hours: 'H24' }
              ],
              patternAltitude: 1000
            }
          };

          set(state => ({
            charts: {
              ...state.charts,
              [chartId]: updatedChart
            },
            downloadQueue: state.downloadQueue.filter(id => id !== chartId)
          }));

          console.log('Chart downloaded:', updatedChart);
        } catch (error) {
          console.error('Erreur téléchargement:', error);
          set(state => ({
            downloadQueue: state.downloadQueue.filter(id => id !== chartId)
          }));
        }
      },

      // Supprimer une carte
      deleteChart: async (chartId) => {
        set(state => {
          const newCharts = { ...state.charts };
          delete newCharts[chartId];
          return { charts: newCharts };
        });
      },

      // Récupérer le PDF d'une carte (simulé)
      getChartPDF: async (chartId) => {
        // Pour la démo, créer un blob factice
        const response = await fetch('data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSIAogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo1IDAgb2JqICAlIHBhZ2UgY29udGVudAo8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooSGVsbG8sIHdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDkyCiUlRU9G');
        const blob = await response.blob();
        return blob;
      },

      // Mettre à jour les données extraites
      updateExtractedData: (chartId, data) => {
        set(state => {
          const chart = state.charts[chartId];
          if (!chart) return state;

          const updatedChart = {
            ...chart,
            extractedData: {
              ...chart.extractedData,
              ...data
            },
            extractionStatus: 'completed'
          };

          return {
            charts: {
              ...state.charts,
              [chartId]: updatedChart
            }
          };
        });
      },

      // Valider une donnée extraite
      validateExtractedData: (chartId, field, value) => {
        const chart = get().charts[chartId];
        if (!chart || !chart.extractedData) return;

        console.log(`Validation: ${field} = ${value} pour ${chartId}`);
        
        get().updateExtractedData(chartId, {
          [field]: value
        });
      },

      // Rechercher des aéroports
      searchAirports: (query) => {
        const { charts } = get();
        const airports = {};
        
        Object.values(charts).forEach(chart => {
          if (!airports[chart.airportIcao]) {
            airports[chart.airportIcao] = {
              id: chart.airportIcao,
              icao: chart.airportIcao,
              name: chart.airportName,
              coordinates: { lat: 0, lon: 0 }
            };
          }
        });

        const searchLower = query.toLowerCase();
        return Object.values(airports).filter(airport =>
          airport.icao.toLowerCase().includes(searchLower) ||
          airport.name.toLowerCase().includes(searchLower)
        );
      },

      // Sélectionner un aéroport
      selectAirport: (icao) => {
        set({ selectedAirport: icao });
      },

      // Synchroniser les cartes
      syncCharts: async () => {
        const { charts } = get();
        const now = new Date();
        
        console.log('Synchronisation des cartes...');
        
        set({ lastSync: now });
      },

      // Vérifier le quota de stockage
      checkStorageQuota: async () => {
        if (navigator.storage && navigator.storage.estimate) {
          const { usage = 0, quota = 0 } = await navigator.storage.estimate();
          set({
            storageUsed: usage,
            storageQuota: quota
          });
        }
      },

      // Vider le cache
      clearCache: async () => {
        set({
          charts: {},
          lastSync: null,
          storageUsed: 0
        });
      }
    }),
    {
      name: 'vac-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedAirport: state.selectedAirport,
        lastSync: state.lastSync,
        // Sauvegarder uniquement les charts téléchargées
        charts: Object.fromEntries(
          Object.entries(state.charts)
            .filter(([_, chart]) => chart.isDownloaded)
            .map(([id, chart]) => [id, {
              ...chart,
              // Convertir les dates en strings pour la sérialisation
              effectiveDate: chart.effectiveDate?.toISOString(),
              expiryDate: chart.expiryDate?.toISOString(),
              downloadDate: chart.downloadDate?.toISOString(),
              lastAccessed: chart.lastAccessed?.toISOString()
            }])
        )
      })
    }
  )
);