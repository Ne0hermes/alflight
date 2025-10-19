// src/utils/indexedDBStorage.js

/**
 * Gestionnaire IndexedDB pour stocker les gros fichiers (PDFs, etc.)
 * IndexedDB peut stocker jusqu'à plusieurs GB de données contrairement au localStorage (5-10MB)
 */

const DB_NAME = 'FlightManagementDB';
const DB_VERSION = 5; // Synchronisé avec dataBackupManager.js
const MANEX_STORE = 'manexPDFs';
const VAC_STORE = 'vacPDFs';

class IndexedDBStorage {
  constructor() {
    this.db = null;
    this.initPromise = this.initDB();
  }

  /**
   * Initialise la base de données IndexedDB
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB non supporté par ce navigateur'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Erreur lors de l\'ouverture d\'IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
                resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Créer le store pour les MANEX PDFs
        if (!db.objectStoreNames.contains(MANEX_STORE)) {
          const manexStore = db.createObjectStore(MANEX_STORE, { keyPath: 'aircraftId' });
          manexStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                  }

        // Créer le store pour les VAC PDFs
        if (!db.objectStoreNames.contains(VAC_STORE)) {
          const vacStore = db.createObjectStore(VAC_STORE, { keyPath: 'icao' });
          vacStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                  }

        // Créer les stores de dataBackupManager (pour éviter les conflits de version)
        if (!db.objectStoreNames.contains('dataBackups')) {
          const backupStore = db.createObjectStore('dataBackups', { keyPath: 'id' });
          backupStore.createIndex('timestamp', 'timestamp', { unique: false });
          backupStore.createIndex('type', 'type', { unique: false });
                  }

        if (!db.objectStoreNames.contains('protectedData')) {
          const protectedStore = db.createObjectStore('protectedData', { keyPath: 'id' });
          protectedStore.createIndex('type', 'type', { unique: false });
          protectedStore.createIndex('lastModified', 'lastModified', { unique: false });
                  }

        if (!db.objectStoreNames.contains('aircraftData')) {
          const aircraftStore = db.createObjectStore('aircraftData', { keyPath: 'id' });
          aircraftStore.createIndex('registration', 'registration', { unique: false });
          aircraftStore.createIndex('lastModified', 'lastModified', { unique: false });
                  }

        if (!db.objectStoreNames.contains('vfrPoints')) {
          const vfrStore = db.createObjectStore('vfrPoints', { keyPath: 'id' });
          vfrStore.createIndex('name', 'name', { unique: false });
                  }

        if (!db.objectStoreNames.contains('navigationData')) {
          const navStore = db.createObjectStore('navigationData', { keyPath: 'id' });
          navStore.createIndex('timestamp', 'timestamp', { unique: false });
                  }
      };
    });
  }

  /**
   * Attend que la DB soit prête
   */
  async ensureReady() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  /**
   * Sauvegarde un MANEX PDF
   */
  async saveManexPDF(aircraftId, manexData) {
    try {
      await this.ensureReady();

      // Séparer les données volumineuses des métadonnées
      const { pdfData, ...metadata } = manexData;

      // Stocker le PDF dans IndexedDB
      const transaction = this.db.transaction([MANEX_STORE], 'readwrite');
      const store = transaction.objectStore(MANEX_STORE);

      const dataToStore = {
        aircraftId,
        pdfData: pdfData || null,
        uploadDate: new Date().toISOString(),
        fileName: metadata.fileName,
        fileSize: metadata.fileSize
      };

      const request = store.put(dataToStore);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
                    
          // Retourner les métadonnées pour le localStorage
          resolve({
            ...metadata,
            hasIndexedDBData: true,
            aircraftId
          });
        };

        request.onerror = () => {
          reject(new Error('Erreur lors du stockage du MANEX PDF'));
        };
      });
    } catch (error) {
      console.error('Erreur saveManexPDF:', error);
      throw error;
    }
  }

  /**
   * Récupère un MANEX PDF
   */
  async getManexPDF(aircraftId) {
    try {
      await this.ensureReady();

      const transaction = this.db.transaction([MANEX_STORE], 'readonly');
      const store = transaction.objectStore(MANEX_STORE);
      const request = store.get(aircraftId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(new Error('Erreur lors de la récupération du MANEX PDF'));
        };
      });
    } catch (error) {
      console.error('Erreur getManexPDF:', error);
      return null;
    }
  }

  /**
   * Supprime un MANEX PDF
   */
  async deleteManexPDF(aircraftId) {
    try {
      await this.ensureReady();

      const transaction = this.db.transaction([MANEX_STORE], 'readwrite');
      const store = transaction.objectStore(MANEX_STORE);
      const request = store.delete(aircraftId);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
                    resolve(true);
        };

        request.onerror = () => {
          reject(new Error('Erreur lors de la suppression du MANEX PDF'));
        };
      });
    } catch (error) {
      console.error('Erreur deleteManexPDF:', error);
      return false;
    }
  }

  /**
   * Sauvegarde une carte VAC PDF
   */
  async saveVACPDF(icao, vacData) {
    try {
      await this.ensureReady();

      const { pdfData, ...metadata } = vacData;

      const transaction = this.db.transaction([VAC_STORE], 'readwrite');
      const store = transaction.objectStore(VAC_STORE);

      const dataToStore = {
        icao: icao.toUpperCase(),
        pdfData: pdfData || null,
        uploadDate: new Date().toISOString(),
        fileName: metadata.fileName,
        fileSize: metadata.fileSize
      };

      const request = store.put(dataToStore);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
                    resolve({
            ...metadata,
            hasIndexedDBData: true,
            icao: icao.toUpperCase()
          });
        };

        request.onerror = () => {
          reject(new Error('Erreur lors du stockage du VAC PDF'));
        };
      });
    } catch (error) {
      console.error('Erreur saveVACPDF:', error);
      throw error;
    }
  }

  /**
   * Récupère une carte VAC PDF
   */
  async getVACPDF(icao) {
    try {
      await this.ensureReady();

      const transaction = this.db.transaction([VAC_STORE], 'readonly');
      const store = transaction.objectStore(VAC_STORE);
      const request = store.get(icao.toUpperCase());

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(new Error('Erreur lors de la récupération du VAC PDF'));
        };
      });
    } catch (error) {
      console.error('Erreur getVACPDF:', error);
      return null;
    }
  }

  /**
   * Supprime une carte VAC PDF
   */
  async deleteVACPDF(icao) {
    try {
      await this.ensureReady();

      const transaction = this.db.transaction([VAC_STORE], 'readwrite');
      const store = transaction.objectStore(VAC_STORE);
      const request = store.delete(icao.toUpperCase());

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
                    resolve(true);
        };

        request.onerror = () => {
          reject(new Error('Erreur lors de la suppression du VAC PDF'));
        };
      });
    } catch (error) {
      console.error('Erreur deleteVACPDF:', error);
      return false;
    }
  }

  /**
   * Calcule la taille totale stockée
   */
  async getStorageSize() {
    try {
      await this.ensureReady();

      let totalSize = 0;

      // Calculer la taille des MANEX
      const manexTransaction = this.db.transaction([MANEX_STORE], 'readonly');
      const manexStore = manexTransaction.objectStore(MANEX_STORE);
      const manexRequest = manexStore.getAll();

      const manexData = await new Promise((resolve) => {
        manexRequest.onsuccess = () => resolve(manexRequest.result);
      });

      manexData.forEach(item => {
        if (item.pdfData) {
          totalSize += item.pdfData.length * 0.75; // Base64 to bytes approximation
        }
      });

      // Calculer la taille des VAC
      const vacTransaction = this.db.transaction([VAC_STORE], 'readonly');
      const vacStore = vacTransaction.objectStore(VAC_STORE);
      const vacRequest = vacStore.getAll();

      const vacData = await new Promise((resolve) => {
        vacRequest.onsuccess = () => resolve(vacRequest.result);
      });

      vacData.forEach(item => {
        if (item.pdfData) {
          totalSize += item.pdfData.length * 0.75; // Base64 to bytes approximation
        }
      });

      return {
        bytes: totalSize,
        mb: (totalSize / (1024 * 1024)).toFixed(2),
        manexCount: manexData.length,
        vacCount: vacData.length
      };
    } catch (error) {
      console.error('Erreur getStorageSize:', error);
      return { bytes: 0, mb: '0', manexCount: 0, vacCount: 0 };
    }
  }

  /**
   * Nettoie les vieilles données (plus de 6 mois)
   */
  async cleanOldData(monthsToKeep = 6) {
    try {
      await this.ensureReady();

      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsToKeep);

      let deleted = 0;

      // Nettoyer les MANEX
      const manexTransaction = this.db.transaction([MANEX_STORE], 'readwrite');
      const manexStore = manexTransaction.objectStore(MANEX_STORE);
      const manexIndex = manexStore.index('uploadDate');
      const manexRange = IDBKeyRange.upperBound(cutoffDate.toISOString());
      
      const manexRequest = manexIndex.openCursor(manexRange);
      
      await new Promise((resolve) => {
        manexRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
      });

            return deleted;
    } catch (error) {
      console.error('Erreur cleanOldData:', error);
      return 0;
    }
  }
}

// Créer une instance unique
const indexedDBStorage = new IndexedDBStorage();

export default indexedDBStorage;