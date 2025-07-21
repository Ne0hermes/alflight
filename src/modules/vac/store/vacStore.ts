// src/modules/vac/store/vacStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Dexie, { Table } from 'dexie';
import { ChartData, VACModuleState } from '../types';

// Configuration Dexie pour IndexedDB
class VACDatabase extends Dexie {
  charts!: Table<ChartData>;
  pdfs!: Table<{ id: string; blob: Blob }>;

  constructor() {
    super('VACDatabase');
    this.version(1).stores({
      charts: 'id, airportIcao, type, version, isDownloaded, isOutdated',
      pdfs: 'id'
    });
  }
}

const db = new VACDatabase();

interface VACStore extends VACModuleState {
  // Actions
  loadChartsList: () => Promise<void>;
  downloadChart: (chartId: string) => Promise<void>;
  deleteChart: (chartId: string) => Promise<void>;
  getChartPDF: (chartId: string) => Promise<Blob | null>;
  updateExtractedData: (chartId: string, data: Partial<ChartData['extractedData']>) => void;
  validateExtractedData: (chartId: string, field: string, value: any) => void;
  searchAirports: (query: string) => Airport[];
  selectAirport: (icao: string | null) => void;
  syncCharts: () => Promise<void>;
  checkStorageQuota: () => Promise<void>;
  clearCache: () => Promise<void>;
}

export const useVACStore = create<VACStore>()(
  persist(
    (set, get) => ({
      // État initial
      charts: new Map(),
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
          // En production, remplacer par l'API réelle
          const mockCharts: ChartData[] = [
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
              extractionStatus: 'pending'
            }
          ];

          // Charger depuis IndexedDB
          const savedCharts = await db.charts.toArray();
          const chartsMap = new Map<string, ChartData>();
          
          // Fusionner les données
          mockCharts.forEach(chart => {
            const saved = savedCharts.find(s => s.id === chart.id);
            chartsMap.set(chart.id, saved || chart);
          });

          set({ charts: chartsMap });
        } catch (error) {
          console.error('Erreur chargement des cartes:', error);
        }
      },

      // Télécharger une carte
      downloadChart: async (chartId: string) => {
        const chart = get().charts.get(chartId);
        if (!chart) return;

        set(state => ({
          downloadQueue: [...state.downloadQueue, chartId]
        }));

        try {
          // Simuler le téléchargement - remplacer par l'API réelle
          const response = await fetch(`/api/vac-charts/${chartId}.pdf`);
          const blob = await response.blob();

          // Sauvegarder dans IndexedDB
          await db.pdfs.put({ id: chartId, blob });
          
          // Mettre à jour les métadonnées
          const updatedChart: ChartData = {
            ...chart,
            isDownloaded: true,
            downloadDate: new Date(),
            lastAccessed: new Date()
          };
          
          await db.charts.put(updatedChart);

          set(state => ({
            charts: new Map(state.charts).set(chartId, updatedChart),
            downloadQueue: state.downloadQueue.filter(id => id !== chartId)
          }));

          // Lancer l'extraction automatique
          await extractChartData(chartId, blob);
        } catch (error) {
          console.error('Erreur téléchargement:', error);
          set(state => ({
            downloadQueue: state.downloadQueue.filter(id => id !== chartId)
          }));
        }
      },

      // Supprimer une carte
      deleteChart: async (chartId: string) => {
        await db.charts.delete(chartId);
        await db.pdfs.delete(chartId);
        
        set(state => {
          const newCharts = new Map(state.charts);
          newCharts.delete(chartId);
          return { charts: newCharts };
        });
      },

      // Récupérer le PDF d'une carte
      getChartPDF: async (chartId: string) => {
        const pdfRecord = await db.pdfs.get(chartId);
        return pdfRecord?.blob || null;
      },

      // Mettre à jour les données extraites
      updateExtractedData: (chartId: string, data: Partial<ChartData['extractedData']>) => {
        set(state => {
          const chart = state.charts.get(chartId);
          if (!chart) return state;

          const updatedChart = {
            ...chart,
            extractedData: {
              ...chart.extractedData,
              ...data
            },
            extractionStatus: 'completed' as const
          };

          db.charts.put(updatedChart);
          
          return {
            charts: new Map(state.charts).set(chartId, updatedChart)
          };
        });
      },

      // Valider une donnée extraite
      validateExtractedData: (chartId: string, field: string, value: any) => {
        const chart = get().charts.get(chartId);
        if (!chart || !chart.extractedData) return;

        // Logique de validation spécifique selon le champ
        console.log(`Validation: ${field} = ${value} pour ${chartId}`);
        
        // Mettre à jour avec la valeur validée
        get().updateExtractedData(chartId, {
          [field]: value
        });
      },

      // Rechercher des aéroports
      searchAirports: (query: string) => {
        const { charts } = get();
        const airports = new Map<string, Airport>();
        
        charts.forEach(chart => {
          if (!airports.has(chart.airportIcao)) {
            airports.set(chart.airportIcao, {
              id: chart.airportIcao,
              icao: chart.airportIcao,
              name: chart.airportName,
              coordinates: { lat: 0, lon: 0 } // À compléter avec les vraies coordonnées
            });
          }
        });

        const searchLower = query.toLowerCase();
        return Array.from(airports.values()).filter(airport =>
          airport.icao.toLowerCase().includes(searchLower) ||
          airport.name.toLowerCase().includes(searchLower)
        );
      },

      // Sélectionner un aéroport
      selectAirport: (icao: string | null) => {
        set({ selectedAirport: icao });
      },

      // Synchroniser les cartes
      syncCharts: async () => {
        const { charts } = get();
        const now = new Date();
        
        for (const [id, chart] of charts) {
          // Vérifier si la carte est expirée
          if (chart.expiryDate < now) {
            chart.isOutdated = true;
            await db.charts.put(chart);
          }
        }
        
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
        await db.charts.clear();
        await db.pdfs.clear();
        set({
          charts: new Map(),
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
        lastSync: state.lastSync
      })
    }
  )
);

// Fonction d'extraction des données (placeholder)
async function extractChartData(chartId: string, blob: Blob) {
  // Cette fonction sera implémentée avec PDF.js
  console.log('Extraction des données pour:', chartId);
}