/**
 * Store pour gérer les points VFR personnalisés
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import dataBackupManager from '@utils/dataBackupManager';

export const useCustomVFRStore = create(
  persist(
    (set, get) => ({
      // État
      customVFRPoints: [],
      isAddingPoint: false,
      editingPoint: null,

      // Actions
      addCustomVFRPoint: async (point) => {
        const newPoint = {
          id: `custom-vfr-${Date.now()}`,
          ...point,
          type: 'custom-vfr',
          createdAt: new Date().toISOString()
        };
        
        // Sauvegarder dans la base de données permanente
        try {
          await dataBackupManager.saveVFRPoint(newPoint);
          console.log('✅ Point VFR sauvegardé dans le stockage permanent:', newPoint.id);
        } catch (error) {
          console.error('❌ Erreur sauvegarde permanente point VFR:', error);
        }
        
        set(state => ({
          customVFRPoints: [...state.customVFRPoints, newPoint]
        }));
        
        console.log(`✅ Point VFR personnalisé ajouté: ${newPoint.name}`);
        return newPoint;
      },

      updateCustomVFRPoint: async (id, updates) => {
        const state = get();
        const existingPoint = state.customVFRPoints.find(p => p.id === id);
        
        if (existingPoint) {
          const updatedPoint = { 
            ...existingPoint, 
            ...updates, 
            updatedAt: new Date().toISOString() 
          };
          
          // Sauvegarder dans la base de données permanente
          try {
            await dataBackupManager.saveVFRPoint(updatedPoint);
            console.log('✅ Point VFR mis à jour dans le stockage permanent:', id);
          } catch (error) {
            console.error('❌ Erreur mise à jour permanente point VFR:', error);
          }
          
          set(state => ({
            customVFRPoints: state.customVFRPoints.map(point => 
              point.id === id ? updatedPoint : point
            )
          }));
        }
      },

      deleteCustomVFRPoint: async (id) => {
        // Vérifier si la protection est activée avant de supprimer
        const isProtected = dataBackupManager.isProtected();
        if (isProtected) {
          const confirmDelete = window.confirm('La protection des données est activée. Êtes-vous sûr de vouloir supprimer ce point VFR ?');
          if (!confirmDelete) return;
        }
        
        set(state => ({
          customVFRPoints: state.customVFRPoints.filter(point => point.id !== id)
        }));
      },

      setIsAddingPoint: (isAdding) => set({ isAddingPoint: isAdding }),
      
      setEditingPoint: (point) => set({ editingPoint: point }),

      // Getters
      getAllCustomVFRPoints: () => {
        return get().customVFRPoints;
      },

      getCustomVFRPointsByAerodrome: (aerodromeIcao) => {
        return get().customVFRPoints.filter(point => 
          point.aerodrome === aerodromeIcao
        );
      },

      // Convertir en GeoJSON
      toGeoJSON: () => {
        return get().customVFRPoints.map(point => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.lon, point.lat]
          },
          properties: {
            id: point.id,
            name: point.name,
            description: point.description || '',
            type: 'VFR',
            vfrType: 'CUSTOM',
            aerodrome: point.aerodrome,
            altitude: point.altitude,
            isCustom: true,
            createdAt: point.createdAt,
            updatedAt: point.updatedAt
          }
        }));
      },

      // Import/Export
      exportCustomVFRPoints: () => {
        const points = get().customVFRPoints;
        const dataStr = JSON.stringify(points, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `custom-vfr-points-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      importCustomVFRPoints: (jsonData) => {
        try {
          const points = JSON.parse(jsonData);
          if (Array.isArray(points)) {
            set({ customVFRPoints: points });
            console.log(`✅ ${points.length} points VFR personnalisés importés`);
            return true;
          }
        } catch (error) {
          console.error('❌ Erreur import points VFR:', error);
          return false;
        }
      },

      clearAllCustomVFRPoints: async () => {
        // Double vérification si la protection est activée
        const isProtected = dataBackupManager.isProtected();
        if (isProtected) {
          const firstConfirm = confirm('La protection des données est activée. Êtes-vous sûr de vouloir supprimer TOUS les points VFR personnalisés ?');
          if (!firstConfirm) return;
          
          const secondConfirm = confirm('Cette action est irréversible. Confirmer la suppression de TOUS les points VFR ?');
          if (!secondConfirm) return;
        } else if (!confirm('Êtes-vous sûr de vouloir supprimer tous les points VFR personnalisés ?')) {
          return;
        }
        
        set({ customVFRPoints: [] });
        console.log('🗑️ Tous les points VFR personnalisés supprimés');
      }
    }),
    {
      name: 'custom-vfr-storage',
      version: 1,
      onRehydrateStorage: () => async (state) => {
        // Synchroniser avec la base de données permanente au chargement
        if (state && state.customVFRPoints) {
          try {
            for (const point of state.customVFRPoints) {
              await dataBackupManager.saveVFRPoint(point);
            }
            console.log('✅ Points VFR synchronisés avec le stockage permanent');
          } catch (error) {
            console.error('❌ Erreur synchronisation points VFR:', error);
          }
        }
      }
    }
  )
);