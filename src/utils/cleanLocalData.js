// src/utils/cleanLocalData.js
// Utilitaire pour nettoyer toutes les données locales

/**
 * Supprime toutes les données locales (localStorage et IndexedDB)
 * @returns {Promise<void>}
 */
export async function cleanAllLocalData() {
  

  try {
    // 1. Nettoyer localStorage
    const keysToRemove = [
      'aircraft-storage',
      'aircraft_wizard_draft',
      'wizard_performance_temp',
      'manex-storage',
      'weight-balance-storage',
      'flight-storage',
      'customVFRPoints-storage',
      'alternates-storage'
    ];

    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        
      }
    });

    // 2. Supprimer IndexedDB
    const dbName = 'FlightManagementDB';
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);

      request.onsuccess = () => {
        
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Erreur lors de la suppression de IndexedDB "${dbName}"`);
        reject(request.error);
      };

      request.onblocked = () => {
        // Essayer quand même de continuer
        resolve();
      };
    });

    
    

    return true;
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  }
}

/**
 * Vérifie si des données locales existent
 * @returns {boolean}
 */
export function hasLocalData() {
  const hasLocalStorage = !!localStorage.getItem('aircraft-storage');
  
  return hasLocalStorage;
}

// Exposer globalement pour la console
if (typeof window !== 'undefined') {
  window.cleanAllLocalData = cleanAllLocalData;
  window.hasLocalData = hasLocalData;
}

export default {
  cleanAllLocalData,
  hasLocalData
};
