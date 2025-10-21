import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useTechnicalLogStore = create(
  persist(
    (set, get) => ({
      entries: [],
      maintenanceItems: [
        {
          id: '1',
          name: '50 heures',
          type: 'hours',
          interval: 50,
          lastDone: 2450,
          nextDue: 2500
        },
        {
          id: '2',
          name: '100 heures',
          type: 'hours',
          interval: 100,
          lastDone: 2400,
          nextDue: 2500
        },
        {
          id: '3',
          name: 'Visite annuelle',
          type: 'calendar',
          interval: 365,
          lastDone: '2024-03-15',
          nextDue: '2025-03-15'
        },
        {
          id: '4',
          name: 'Changement huile',
          type: 'hours',
          interval: 25,
          lastDone: 2475,
          nextDue: 2500
        },
        {
          id: '5',
          name: 'Inspection 200h',
          type: 'hours',
          interval: 200,
          lastDone: 2300,
          nextDue: 2500
        }
      ],
      
      // Actions pour les entrées du log technique
      addEntry: (entry) => set(state => ({
        entries: [...state.entries, {
          ...entry,
          id: Date.now().toString(),
          createdAt: new Date().toISOString()
        }]
      })),

      updateEntry: (id, updates) => set(state => ({
        entries: state.entries.map(entry =>
          entry.id === id ? { ...entry, ...updates, updatedAt: new Date().toISOString() } : entry
        )
      })),

      deleteEntry: (id) => set(state => ({
        entries: state.entries.filter(entry => entry.id !== id)
      })),

      // Actions pour les éléments de maintenance
      addMaintenanceItem: (item) => set(state => ({
        maintenanceItems: [...state.maintenanceItems, {
          ...item,
          id: Date.now().toString()
        }]
      })),

      updateMaintenanceItem: (id, updates) => set(state => ({
        maintenanceItems: state.maintenanceItems.map(item =>
          item.id === id ? { ...item, ...updates } : item
        )
      })),

      deleteMaintenanceItem: (id) => set(state => ({
        maintenanceItems: state.maintenanceItems.filter(item => item.id !== id)
      })),

      // Récupérer les entrées filtrées
      getEntriesByType: (type) => {
        return get().entries.filter(entry => entry.type === type);
      },

      getDeferredEntries: () => {
        return get().entries.filter(entry => entry.deferred && !entry.resolved);
      },

      getOpenDefects: () => {
        return get().entries.filter(entry =>
          entry.type === 'defect' && !entry.resolved
        );
      },

      // Statistiques
      getStatistics: () => {
        const entries = get().entries;
        const stats = {
          total: entries.length,
          open: 0,
          deferred: 0,
          resolved: 0,
          byType: {}
        };

        entries.forEach(entry => {
          if (entry.resolved) stats.resolved++;
          else if (entry.deferred) stats.deferred++;
          else stats.open++;

          stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
        });

        return stats;
      },

      // Maintenance due
      getMaintenanceDue: (currentHours, currentCycles) => {
        const items = get().maintenanceItems;
        const due = [];
        const upcoming = [];

        items.forEach(item => {
          let remaining = 0;
          let percentage = 0;

          if (item.type === 'hours') {
            remaining = item.nextDue - currentHours;
            percentage = ((currentHours - item.lastDone) / item.interval) * 100;
          } else if (item.type === 'cycles') {
            remaining = item.nextDue - currentCycles;
            percentage = ((currentCycles - item.lastDone) / item.interval) * 100;
          } else if (item.type === 'calendar') {
            const today = new Date();
            const nextDue = new Date(item.nextDue);
            remaining = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
            const totalDays = Math.ceil((new Date(item.nextDue) - new Date(item.lastDone)) / (1000 * 60 * 60 * 24));
            const elapsedDays = Math.ceil((today - new Date(item.lastDone)) / (1000 * 60 * 60 * 24));
            percentage = (elapsedDays / totalDays) * 100;
          }

          if (percentage >= 100) {
            due.push({ ...item, remaining, percentage });
          } else if (percentage >= 90) {
            upcoming.push({ ...item, remaining, percentage });
          }
        });

        return { due, upcoming };
      },

      // Export des données
      exportData: () => {
        const data = {
          entries: get().entries,
          maintenanceItems: get().maintenanceItems,
          exportDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
      },

      // Import des données
      importData: (jsonData) => {
        try {
          const data = JSON.parse(jsonData);
          set({
            entries: data.entries || [],
            maintenanceItems: data.maintenanceItems || []
          });
          return true;
        } catch (error) {
          console.error('Error importing technical log data:', error);
          return false;
        }
      },

      // Clear all data
      clearAll: () => set({
        entries: [],
        maintenanceItems: []
      })
        }),
    {
      name: 'technical-log-storage',
      version: 1
    }
  )
);