import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const MOCK_CHARTS = [
  { id: 'LFPG-VAC-2024-01', airportIcao: 'LFPG', airportName: 'Paris Charles de Gaulle', coordinates: { lat: 49.012779, lon: 2.550000 } },
  { id: 'LFPO-VAC-2024-01', airportIcao: 'LFPO', airportName: 'Paris Orly', coordinates: { lat: 48.723333, lon: 2.379444 } },
  { id: 'LFPB-VAC-2024-01', airportIcao: 'LFPB', airportName: 'Paris Le Bourget', coordinates: { lat: 48.969444, lon: 2.441667 } }
].map(c => ({
  ...c, type: 'VAC', version: '2024-01', effectiveDate: new Date('2024-01-25'), expiryDate: new Date('2024-02-22'),
  fileSize: 2.2e6, isDownloaded: false, isOutdated: false, extractionStatus: 'pending', extractedData: null
}));

export const useVACStore = create(persist((set, get) => ({
  charts: {}, airports: [], selectedAirport: null, downloadQueue: [], isOnline: navigator.onLine,
  lastSync: null, storageUsed: 0, storageQuota: 0,

  loadChartsList: async () => {
    try {
      const charts = {};
      MOCK_CHARTS.forEach(c => charts[c.id] = c);
      set({ charts });
    } catch (e) { console.error('Erreur:', e); }
  },

  downloadChart: async (id) => {
    const c = get().charts[id];
    if (!c) return;
    set(s => ({ downloadQueue: [...s.downloadQueue, id] }));
    try {
      await new Promise(r => setTimeout(r, 2000));
      const upd = {
        ...c, isDownloaded: true, downloadDate: new Date(), lastAccessed: new Date(),
        extractionStatus: 'completed',
        extractedData: {
          coordinates: c.coordinates || { lat: 49.012779, lon: 2.550000 },
          airportElevation: 392,
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
      set(s => ({ charts: { ...s.charts, [id]: upd }, downloadQueue: s.downloadQueue.filter(i => i !== id) }));
    } catch (e) {
      console.error('Erreur:', e);
      set(s => ({ downloadQueue: s.downloadQueue.filter(i => i !== id) }));
    }
  },

  deleteChart: async (id) => set(s => { const c = { ...s.charts }; delete c[id]; return { charts: c }; }),

  getChartPDF: async () => {
    const r = await fetch('data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSIAogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo1IDAgb2JqICAlIHBhZ2UgY29udGVudAo8PAogIC9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCjcwIDUwIFRECi9GMSAxMiBUZgooSGVsbG8sIHdvcmxkISkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDkyCiUlRU9G');
    return await r.blob();
  },

  updateExtractedData: (id, data) => set(s => {
    const c = s.charts[id];
    if (!c) return s;
    return { charts: { ...s.charts, [id]: { ...c, extractedData: { ...c.extractedData, ...data }, extractionStatus: 'completed' } } };
  }),

  validateExtractedData: (id, field, value) => {
    const c = get().charts[id];
    if (!c?.extractedData) return;
    console.log(`Val: ${field}=${value} pour ${id}`);
    get().updateExtractedData(id, { [field]: value });
  },

  searchAirports: q => {
    const { charts } = get();
    const ap = {};
    Object.values(charts).forEach(c => {
      if (!ap[c.airportIcao]) ap[c.airportIcao] = { id: c.airportIcao, icao: c.airportIcao, name: c.airportName, coordinates: { lat: 0, lon: 0 } };
    });
    const ql = q.toLowerCase();
    return Object.values(ap).filter(a => a.icao.toLowerCase().includes(ql) || a.name.toLowerCase().includes(ql));
  },

  selectAirport: icao => set({ selectedAirport: icao }),
  syncCharts: async () => { console.log('Sync...'); set({ lastSync: new Date() }); },
  checkStorageQuota: async () => {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      set({ storageUsed: usage, storageQuota: quota });
    }
  },
  clearCache: async () => set({ charts: {}, lastSync: null, storageUsed: 0 })
}), {
  name: 'vac-store',
  storage: createJSONStorage(() => localStorage),
  partialize: s => ({
    selectedAirport: s.selectedAirport,
    lastSync: s.lastSync,
    charts: Object.fromEntries(
      Object.entries(s.charts).filter(([_, c]) => c.isDownloaded).map(([id, c]) => [id, {
        ...c,
        effectiveDate: c.effectiveDate?.toISOString(),
        expiryDate: c.expiryDate?.toISOString(),
        downloadDate: c.downloadDate?.toISOString(),
        lastAccessed: c.lastAccessed?.toISOString()
      }])
    )
  }),
  onRehydrateStorage: () => s => {
    if (s?.charts) {
      Object.keys(s.charts).forEach(id => {
        const c = s.charts[id];
        ['effectiveDate', 'expiryDate', 'downloadDate', 'lastAccessed'].forEach(k => {
          if (c[k]) c[k] = new Date(c[k]);
        });
      });
    }
    if (s?.lastSync) s.lastSync = new Date(s.lastSync);
  }
}));