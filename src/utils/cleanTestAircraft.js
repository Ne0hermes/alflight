// Nettoyeur automatique pour supprimer tous les avions de test
// Utilisé au démarrage pour garantir qu'aucune donnée test ne persiste

import { createModuleLogger } from '@utils/logger';

const logger = createModuleLogger('TestAircraftCleaner');

// Liste des immatriculations de test à supprimer
const TEST_REGISTRATIONS = [
  'F-GBYU',
  'F-HXYZ',
  'F-GJKL',
  'F-GMNO',
  'F-DEMO',
  'F-TEST'
];

/**
 * Nettoie tous les avions de test du localStorage
 */
export async function cleanLocalStorageTestAircraft() {
  logger.info('🧹 Nettoyage des avions de test dans localStorage...');

  let cleanedCount = 0;

  try {
    // Nettoyer toutes les clés localStorage liées aux avions
    const keysToClean = [
      'aircraft-storage',
      'aircraftStore',
      'aircraft-list',
      'selectedAircraft'
    ];

    for (const key of keysToClean) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          const data = JSON.parse(value);

          // Si c'est un objet avec aircraftList
          if (data.state?.aircraftList) {
            const originalLength = data.state.aircraftList.length;
            data.state.aircraftList = data.state.aircraftList.filter(
              aircraft => !TEST_REGISTRATIONS.includes(aircraft.registration?.toUpperCase());

  const removed = originalLength - data.state.aircraftList.length;
            if (removed > 0) {
              localStorage.setItem(key, JSON.stringify(data));
              cleanedCount += removed;
              logger.info(`✅ Supprimé ${removed} avion(s) de test de ${key}`);
            }
          }
          // Si c'est un tableau direct
          else if (Array.isArray(data)) {
            const originalLength = data.length;
            const cleaned = data.filter(
              aircraft => !TEST_REGISTRATIONS.includes(aircraft.registration?.toUpperCase());

  const removed = originalLength - cleaned.length;
            if (removed > 0) {
              localStorage.setItem(key, JSON.stringify(cleaned));
              cleanedCount += removed;
              logger.info(`✅ Supprimé ${removed} avion(s) de test de ${key}`);
            }
          }
        } catch (e) {
          // Pas un JSON, on passe
        }
      }
    }

    logger.success(`✅ Nettoyage localStorage terminé: ${cleanedCount} avion(s) de test supprimé(s)`);
    return cleanedCount;

  } catch (error) {
    logger.error('❌ Erreur lors du nettoyage localStorage:', error);
    return 0;
  }
}

/**
 * Nettoie tous les avions de test d'IndexedDB
 */
export async function cleanIndexedDBTestAircraft() {
  logger.info('🧹 Nettoyage des avions de test dans IndexedDB...');

  let cleanedCount = 0;

  try {
    // Ouvrir la base de données
    const dbName = 'FlightManagementDB';
    const request = indexedDB.open(dbName);

    return new Promise((resolve, reject) => {
      request.onerror = () => {
        logger.error('❌ Erreur ouverture IndexedDB');
        reject(request.error);
      };

      request.onsuccess = async (event) => {
        const db = event.target.result;

        try {
          // Vérifier si le store aircraftData existe
          if (!db.objectStoreNames.contains('aircraftData')) {
            logger.info('ℹ️ Store aircraftData non trouvé dans IndexedDB');
            db.close();
            resolve(0);
            return;
          }

          const transaction = db.transaction(['aircraftData'], 'readwrite');
          const store = transaction.objectStore('aircraftData');

          // Récupérer tous les avions
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const allAircraft = getAllRequest.result;

            // Supprimer les avions de test
            allAircraft.forEach(aircraft => {
              if (TEST_REGISTRATIONS.includes(aircraft.registration?.toUpperCase())) {
                store.delete(aircraft.id || aircraft.registration);
                cleanedCount++;
                logger.info(`✅ Supprimé ${aircraft.registration} d'IndexedDB`);
              }
            });

            transaction.oncomplete = () => {
              logger.success(`✅ Nettoyage IndexedDB terminé: ${cleanedCount} avion(s) de test supprimé(s)`);
              db.close();
              resolve(cleanedCount);
            };

            transaction.onerror = () => {
              logger.error('❌ Erreur transaction IndexedDB');
              db.close();
              reject(transaction.error);
            };
          };

          getAllRequest.onerror = () => {
            logger.error('❌ Erreur lecture IndexedDB');
            db.close();
            reject(getAllRequest.error);
          };

        } catch (error) {
          logger.error('❌ Erreur lors du nettoyage IndexedDB:', error);
          db.close();
          reject(error);
        }
      };
    });

  } catch (error) {
    logger.error('❌ Erreur lors du nettoyage IndexedDB:', error);
    return 0;
  }
}

/**
 * Nettoie tous les avions de test de tous les stockages
 * @returns {Promise<{localStorage: number, indexedDB: number, total: number}>}
 */
export async function cleanAllTestAircraft() {
  logger.info('🚀 Démarrage du nettoyage complet des avions de test...');

  const localStorageCount = await cleanLocalStorageTestAircraft();
  const indexedDBCount = await cleanIndexedDBTestAircraft();

  const total = localStorageCount + indexedDBCount;

  logger.success(`✅ Nettoyage complet terminé: ${total} avion(s) de test supprimé(s) au total`);

  return {
    localStorage: localStorageCount,
    indexedDB: indexedDBCount,
    total
  };
}

/**
 * Vérifie si des avions de test existent encore
 * @returns {Promise<boolean>}
 */
export async function hasTestAircraft() {
  // Vérifier localStorage
  try {
    const keysToCheck = ['aircraft-storage', 'aircraftStore', 'aircraft-list'];

    for (const key of keysToCheck) {
      const value = localStorage.getItem(key);
      if (value) {
        const data = JSON.parse(value);
        const aircraftList = data.state?.aircraftList || data;

        if (Array.isArray(aircraftList)) {
          const hasTest = aircraftList.some(
            aircraft => TEST_REGISTRATIONS.includes(aircraft.registration?.toUpperCase())

          if (hasTest) return true;
        }
      }
    }
  } catch (e) {
    // Ignorer les erreurs de parsing
  }

  return false;
}

export default {
  cleanLocalStorageTestAircraft,
  cleanIndexedDBTestAircraft,
  cleanAllTestAircraft,
  hasTestAircraft,
  TEST_REGISTRATIONS
};
