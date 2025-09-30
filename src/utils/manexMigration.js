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
  
  console.log('🔄 Starting MANEX data migration...');
  
  aircraftList.forEach(aircraft => {
    // Si l'avion a des données MANEX complètes (pas juste les métadonnées)
    if (aircraft.manex && aircraft.manex.pdfData) {
      console.log(`📦 Migrating MANEX for ${aircraft.registration}...`);
      
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
    console.log(`✅ Migration complete: ${migrated} MANEX files migrated`);
    // Marquer la migration comme effectuée
    localStorage.setItem('manex-migration-v1', 'completed');
  } else {
    console.log('ℹ️ No MANEX data to migrate');
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
    console.log('🔍 MANEX migration needed, starting...');
    migrateManexData();
  }
};

export default {
  migrateManexData,
  isMigrationNeeded,
  autoMigrateIfNeeded
};