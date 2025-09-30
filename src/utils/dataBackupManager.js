// src/utils/dataBackupManager.js

/**
 * Gestionnaire de sauvegarde et de protection des données
 * Assure la persistance et la protection des données critiques
 */

const DB_NAME = 'FlightManagementDB';
const DB_VERSION = 2; // Incrémenté pour ajouter de nouveaux stores
const BACKUP_STORE = 'dataBackups';
const PROTECTED_DATA_STORE = 'protectedData';
const AIRCRAFT_DATA_STORE = 'aircraftData';
const VFR_POINTS_STORE = 'vfrPoints';
const NAVIGATION_STORE = 'navigationData';

class DataBackupManager {
  constructor() {
    this.db = null;
    this.initPromise = this.initDB();
    this.autoBackupInterval = null;
    this.isProtectionEnabled = true; // Protection activée par défaut
  }

  /**
   * Initialise la base de données avec les nouveaux stores
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB non supporté'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Erreur lors de l\'ouverture d\'IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('✅ DataBackupManager: Base de données initialisée');
        
        // Démarrer la sauvegarde automatique
        this.startAutoBackup();
        
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store pour les backups complets
        if (!db.objectStoreNames.contains(BACKUP_STORE)) {
          const backupStore = db.createObjectStore(BACKUP_STORE, { keyPath: 'id', autoIncrement: true });
          backupStore.createIndex('timestamp', 'timestamp', { unique: false });
          backupStore.createIndex('type', 'type', { unique: false });
        }
        
        // Store pour les données protégées
        if (!db.objectStoreNames.contains(PROTECTED_DATA_STORE)) {
          const protectedStore = db.createObjectStore(PROTECTED_DATA_STORE, { keyPath: 'key' });
          protectedStore.createIndex('type', 'type', { unique: false });
          protectedStore.createIndex('lastModified', 'lastModified', { unique: false });
        }
        
        // Store pour les données avion
        if (!db.objectStoreNames.contains(AIRCRAFT_DATA_STORE)) {
          const aircraftStore = db.createObjectStore(AIRCRAFT_DATA_STORE, { keyPath: 'id' });
          aircraftStore.createIndex('registration', 'registration', { unique: false });
          aircraftStore.createIndex('lastModified', 'lastModified', { unique: false });
        }
        
        // Store pour les points VFR
        if (!db.objectStoreNames.contains(VFR_POINTS_STORE)) {
          const vfrStore = db.createObjectStore(VFR_POINTS_STORE, { keyPath: 'id' });
          vfrStore.createIndex('name', 'name', { unique: false });
          vfrStore.createIndex('aerodrome', 'aerodrome', { unique: false });
          vfrStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Store pour les données de navigation
        if (!db.objectStoreNames.contains(NAVIGATION_STORE)) {
          const navStore = db.createObjectStore(NAVIGATION_STORE, { keyPath: 'id' });
          navStore.createIndex('name', 'name', { unique: false });
          navStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        console.log('✅ Stores de sauvegarde créés');
      };
    });
  }

  /**
   * Sauvegarde automatique toutes les 5 minutes
   */
  startAutoBackup() {
    // Sauvegarde initiale
    this.createAutoBackup();
    
    // Sauvegarde toutes les 5 minutes
    this.autoBackupInterval = setInterval(() => {
      this.createAutoBackup();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Arrête la sauvegarde automatique
   */
  stopAutoBackup() {
    if (this.autoBackupInterval) {
      clearInterval(this.autoBackupInterval);
      this.autoBackupInterval = null;
    }
  }

  /**
   * Crée une sauvegarde automatique
   */
  async createAutoBackup() {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        type: 'auto',
        data: {
          localStorage: { ...localStorage },
          stores: {
            aircraft: await this.getAllFromStore(AIRCRAFT_DATA_STORE),
            vfrPoints: await this.getAllFromStore(VFR_POINTS_STORE),
            navigation: await this.getAllFromStore(NAVIGATION_STORE),
            protected: await this.getAllFromStore(PROTECTED_DATA_STORE)
          }
        }
      };
      
      await this.saveBackup(backup);
      
      // Garder seulement les 10 dernières sauvegardes automatiques
      await this.cleanOldBackups('auto', 10);
      
      console.log('✅ Sauvegarde automatique créée:', backup.timestamp);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde automatique:', error);
    }
  }

  /**
   * Crée une sauvegarde manuelle
   */
  async createManualBackup(name = 'Sauvegarde manuelle') {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        type: 'manual',
        name: name,
        data: {
          localStorage: { ...localStorage },
          stores: {
            aircraft: await this.getAllFromStore(AIRCRAFT_DATA_STORE),
            vfrPoints: await this.getAllFromStore(VFR_POINTS_STORE),
            navigation: await this.getAllFromStore(NAVIGATION_STORE),
            protected: await this.getAllFromStore(PROTECTED_DATA_STORE)
          }
        }
      };
      
      await this.saveBackup(backup);
      console.log('✅ Sauvegarde manuelle créée:', name);
      return backup;
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde manuelle:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde un backup dans IndexedDB
   */
  async saveBackup(backup) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([BACKUP_STORE], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE);
      const request = store.add(backup);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère toutes les sauvegardes
   */
  async getAllBackups() {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([BACKUP_STORE], 'readonly');
      const store = transaction.objectStore(BACKUP_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Restaure une sauvegarde
   */
  async restoreBackup(backupId) {
    await this.initPromise;
    
    const backup = await this.getBackupById(backupId);
    if (!backup) {
      throw new Error('Sauvegarde non trouvée');
    }
    
    // Créer une sauvegarde de sécurité avant la restauration
    await this.createManualBackup('Avant restauration - ' + new Date().toLocaleString('fr-FR'));
    
    // Restaurer localStorage
    if (backup.data.localStorage) {
      localStorage.clear();
      Object.entries(backup.data.localStorage).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    }
    
    // Restaurer les stores IndexedDB
    if (backup.data.stores) {
      for (const [storeName, data] of Object.entries(backup.data.stores)) {
        if (data && Array.isArray(data)) {
          await this.clearStore(this.getStoreNameFromKey(storeName));
          for (const item of data) {
            await this.saveToStore(this.getStoreNameFromKey(storeName), item);
          }
        }
      }
    }
    
    console.log('✅ Sauvegarde restaurée:', backup.timestamp);
    
    // Recharger la page pour appliquer les changements
    window.location.reload();
  }

  /**
   * Sauvegarde des données protégées
   */
  async saveProtectedData(key, data, type = 'general') {
    if (!this.isProtectionEnabled) {
      console.warn('⚠️ Protection désactivée, les données ne sont pas protégées');
    }
    
    await this.initPromise;
    
    const protectedItem = {
      key: key,
      type: type,
      data: data,
      lastModified: new Date().toISOString(),
      protected: this.isProtectionEnabled
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([PROTECTED_DATA_STORE], 'readwrite');
      const store = transaction.objectStore(PROTECTED_DATA_STORE);
      const request = store.put(protectedItem);
      
      request.onsuccess = () => {
        // Sauvegarder aussi dans localStorage pour compatibilité
        localStorage.setItem(key, JSON.stringify(data));
        console.log('✅ Données protégées sauvegardées:', key);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupère des données protégées
   */
  async getProtectedData(key) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([PROTECTED_DATA_STORE], 'readonly');
      const store = transaction.objectStore(PROTECTED_DATA_STORE);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde les données d'un avion
   */
  async saveAircraftData(aircraft) {
    await this.initPromise;
    
    const aircraftData = {
      ...aircraft,
      id: aircraft.id || `aircraft_${Date.now()}`,
      lastModified: new Date().toISOString()
    };
    
    // Sauvegarder dans IndexedDB
    await this.saveToStore(AIRCRAFT_DATA_STORE, aircraftData);
    
    // Sauvegarder aussi dans les données protégées
    await this.saveProtectedData(`aircraft_${aircraftData.id}`, aircraftData, 'aircraft');
    
    return aircraftData;
  }

  /**
   * Récupère les données d'un avion par son ID
   */
  async getAircraftData(aircraftId) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([AIRCRAFT_DATA_STORE], 'readonly');
      const store = transaction.objectStore(AIRCRAFT_DATA_STORE);
      const request = store.get(aircraftId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sauvegarde un point VFR
   */
  async saveVFRPoint(vfrPoint) {
    await this.initPromise;
    
    const vfrData = {
      ...vfrPoint,
      id: vfrPoint.id || `vfr_${Date.now()}`,
      createdAt: vfrPoint.createdAt || new Date().toISOString()
    };
    
    // Sauvegarder dans IndexedDB
    await this.saveToStore(VFR_POINTS_STORE, vfrData);
    
    // Sauvegarder aussi dans les données protégées
    await this.saveProtectedData(`vfr_${vfrData.id}`, vfrData, 'vfr');
    
    return vfrData;
  }

  /**
   * Nettoie le localStorage en préservant les données essentielles
   * et en migrant les données volumineuses vers IndexedDB
   */
  async cleanupLocalStorage() {
    console.log('🧹 Nettoyage du localStorage...');
    
    try {
      // Sauvegarder d'abord les données importantes dans IndexedDB
      const aircraftData = localStorage.getItem('aircraft-storage');
      if (aircraftData) {
        const parsed = JSON.parse(aircraftData);
        if (parsed.state && parsed.state.aircraftList) {
          for (const aircraft of parsed.state.aircraftList) {
            await this.saveAircraftData(aircraft);
          }
          console.log('✅ Données avions sauvegardées dans IndexedDB');
        }
      }
      
      // Identifier les clés à préserver (sans les données volumineuses)
      const keysToPreserve = [
        'units-storage',
        'pilot-storage',
        'navigation-storage',
        'fuel-storage',
        'weather-storage'
      ];
      
      // Sauvegarder temporairement les données à préserver
      const preservedData = {};
      for (const key of keysToPreserve) {
        const value = localStorage.getItem(key);
        if (value) {
          preservedData[key] = value;
        }
      }
      
      // Nettoyer le localStorage
      localStorage.clear();
      console.log('✅ localStorage nettoyé');
      
      // Restaurer les données essentielles
      for (const [key, value] of Object.entries(preservedData)) {
        localStorage.setItem(key, value);
      }
      
      // Recréer aircraft-storage sans les photos/manex
      if (aircraftData) {
        const parsed = JSON.parse(aircraftData);
        if (parsed.state && parsed.state.aircraftList) {
          const cleanedAircraftList = parsed.state.aircraftList.map(aircraft => {
            const { photo, manex, ...cleanAircraft } = aircraft;
            return {
              ...cleanAircraft,
              hasPhoto: !!photo,
              hasManex: !!manex
            };
          });
          
          localStorage.setItem('aircraft-storage', JSON.stringify({
            ...parsed,
            state: {
              ...parsed.state,
              aircraftList: cleanedAircraftList
            }
          }));
        }
      }
      
      console.log('✅ Données essentielles restaurées');
      console.log(`📊 Espace utilisé: ${this.getLocalStorageSize()} KB / ~5000 KB`);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage:', error);
      throw error;
    }
  }

  /**
   * Calcule la taille utilisée par localStorage
   */
  getLocalStorageSize() {
    let totalSize = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    return Math.round(totalSize / 1024); // Retourner en KB
  }

  /**
   * Export toutes les données en JSON
   */
  async exportAllData() {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      localStorage: { ...localStorage },
      aircraft: await this.getAllFromStore(AIRCRAFT_DATA_STORE),
      vfrPoints: await this.getAllFromStore(VFR_POINTS_STORE),
      navigation: await this.getAllFromStore(NAVIGATION_STORE),
      protected: await this.getAllFromStore(PROTECTED_DATA_STORE),
      backups: await this.getAllBackups()
    };
    
    // Créer un blob et télécharger
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alflight_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Données exportées');
    return data;
  }

  /**
   * Import de données depuis JSON
   */
  async importData(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      // Créer une sauvegarde avant l'import
      await this.createManualBackup('Avant import - ' + new Date().toLocaleString('fr-FR'));
      
      // Importer localStorage
      if (data.localStorage) {
        Object.entries(data.localStorage).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      }
      
      // Importer les stores
      if (data.aircraft) {
        for (const item of data.aircraft) {
          await this.saveToStore(AIRCRAFT_DATA_STORE, item);
        }
      }
      
      if (data.vfrPoints) {
        for (const item of data.vfrPoints) {
          await this.saveToStore(VFR_POINTS_STORE, item);
        }
      }
      
      if (data.navigation) {
        for (const item of data.navigation) {
          await this.saveToStore(NAVIGATION_STORE, item);
        }
      }
      
      if (data.protected) {
        for (const item of data.protected) {
          await this.saveToStore(PROTECTED_DATA_STORE, item);
        }
      }
      
      console.log('✅ Données importées avec succès');
      
      // Recharger la page
      window.location.reload();
    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error);
      throw error;
    }
  }

  /**
   * Active/désactive la protection
   */
  setProtection(enabled) {
    this.isProtectionEnabled = enabled;
    localStorage.setItem('dataProtectionEnabled', enabled.toString());
    console.log(`🔒 Protection ${enabled ? 'activée' : 'désactivée'}`);
  }

  /**
   * Vérifie si la protection est activée
   */
  isProtected() {
    const stored = localStorage.getItem('dataProtectionEnabled');
    return stored !== 'false'; // Protection activée par défaut
  }

  // Méthodes utilitaires privées

  async saveToStore(storeName, data) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFromStore(storeName) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async clearStore(storeName) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBackupById(id) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([BACKUP_STORE], 'readonly');
      const store = transaction.objectStore(BACKUP_STORE);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async cleanOldBackups(type, keepCount) {
    const backups = await this.getAllBackups();
    const typeBackups = backups
      .filter(b => b.type === type)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (typeBackups.length > keepCount) {
      const toDelete = typeBackups.slice(keepCount);
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  }

  async deleteBackup(id) {
    await this.initPromise;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([BACKUP_STORE], 'readwrite');
      const store = transaction.objectStore(BACKUP_STORE);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  getStoreNameFromKey(key) {
    const storeMap = {
      aircraft: AIRCRAFT_DATA_STORE,
      vfrPoints: VFR_POINTS_STORE,
      navigation: NAVIGATION_STORE,
      protected: PROTECTED_DATA_STORE
    };
    return storeMap[key] || key;
  }
}

// Singleton
const dataBackupManager = new DataBackupManager();

// Exposer globalement pour le débogage et la maintenance
if (typeof window !== 'undefined') {
  window.dataBackupManager = dataBackupManager;
  
  // Vérifier automatiquement la taille du localStorage au démarrage
  setTimeout(() => {
    const size = dataBackupManager.getLocalStorageSize();
    console.log(`📊 localStorage: ${size} KB utilisés sur ~5000 KB`);
    
    // Si localStorage dépasse 4MB, proposer un nettoyage automatique
    if (size > 4000) {
      console.warn('⚠️ localStorage presque plein!');
      console.warn('💡 Utilisez window.dataBackupManager.cleanupLocalStorage() pour nettoyer.');
    }
  }, 1000);
}

// Export
export default dataBackupManager;
export { DataBackupManager };