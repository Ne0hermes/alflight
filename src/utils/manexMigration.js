// src/utils/manexMigration.js
import { useAircraftStore } from '../core/stores/aircraftStore';
import { storeManexOptimized } from '../core/stores/manexStore';

/**
 * Migre les données MANEX du store des avions vers le store MANEX séparé
 * Cette fonction doit être appelée une fois lors de la mise à jour
 */
export const migrateManexData = () => {
  const { aircraftList } = useAircraftStore.getState();
  let migrated = 0;
  
    
  aircraftList.forEach(aircraft => {
    // Si l'avion a des données MANEX complètes (pas juste les métadonnées)
    if (aircraft.manex && aircraft.manex.pdfData) {
            
      // Stocker dans le store MANEX
      storeManexOptimized(aircraft.id, aircraft.manex);
      
      // Mettre à jour l'avion pour ne garder que les métadonnées
      const { updateAircraft } = useAircraftStore.getState();
      updateAircraft({
        ...aircraft,
        manex: {
          fileName: aircraft.manex.fileName,
          fileSize: aircraft.manex.fileSize,
          pageCount: aircraft.manex.pageCount,
          uploadDate: aircraft.manex.uploadDate,
          hasData: true
        }
      });
      
      migrated++;
    }
  });
  
  if (migrated > 0) {
        // Marquer la migration comme effectuée
    localStorage.setItem('manex-migration-v1', 'completed');
  } else {
      }
  
  return migrated;
};

/**
 * Vérifie si la migration a déjà été effectuée
 */
export const isMigrationNeeded = () => {
  return !localStorage.getItem('manex-migration-v1');
};

/**
 * Effectue la migration automatiquement si nécessaire
 */
export const autoMigrateIfNeeded = () => {
  if (isMigrationNeeded()) {
        migrateManexData();
  }
};

export default {
  migrateManexData,
  isMigrationNeeded,
  autoMigrateIfNeeded
};