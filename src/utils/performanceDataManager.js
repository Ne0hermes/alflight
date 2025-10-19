// src/utils/performanceDataManager.js

/**
 * Gestionnaire optimisé pour les données de performance voluminouses
 * Évite le QuotaExceededError en compressant et gérant la taille des données
 */

class PerformanceDataManager {
  constructor() {
    this.maxStorageSize = 4 * 1024 * 1024; // 4MB limite sécurisée pour localStorage
    this.compressionThreshold = 50 * 1024; // 50KB - seuil pour déclencher la compression
  }

  /**
   * Stocke les données de performance avec optimisation automatique
   */
  async storePerformanceData(aircraftId, performanceData) {
    try {
      
      
      // Nettoyer les données pour réduire la taille
      const cleanedData = this.cleanPerformanceData(performanceData);
      
      // Calculer la taille des données
      const dataString = JSON.stringify(cleanedData);
      const dataSize = new Blob([dataString]).size;

      // Si les données sont trop volumineuses, les optimiser
      let optimizedData = cleanedData;
      if (dataSize > this.compressionThreshold) {
        
        optimizedData = this.optimizePerformanceData(cleanedData);
        
        const optimizedSize = new Blob([JSON.stringify(optimizedData)]).size;
      }
      
      // Stocker dans localStorage avec gestion d'erreur
      const storageKey = `aircraft_performance_${aircraftId}`;
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(optimizedData));
        
        return true;
      } catch (quotaError) {
        if (quotaError.name === 'QuotaExceededError') {
          
          await this.cleanupOldData();
          
          // Essayer encore avec des données ultra-compressées
          const ultraCompressed = this.ultraCompressData(optimizedData);
          localStorage.setItem(storageKey, JSON.stringify(ultraCompressed));
          
          return true;
        }
        throw quotaError;
      }
      
    } catch (error) {
      console.error('❌ Erreur lors du stockage des données de performance:', error);
      throw new Error(`Impossible de sauvegarder les données de performance: ${error.message}`);
    }
  }

  /**
   * Récupère les données de performance
   */
  getPerformanceData(aircraftId) {
    try {
      const storageKey = `aircraft_performance_${aircraftId}`;
      const data = localStorage.getItem(storageKey);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des données de performance:', error);
      return null;
    }
  }

  /**
   * Nettoie les données pour réduire la taille
   */
  cleanPerformanceData(data) {
    if (!data || !data.advancedPerformance) {
      return data;
    }

    const cleaned = { ...data };
    
    if (cleaned.advancedPerformance && cleaned.advancedPerformance.tables) {
      cleaned.advancedPerformance.tables = cleaned.advancedPerformance.tables.map(table => {
        const cleanedTable = { ...table };
        
        // Supprimer les images sources pour économiser l'espace
        if (cleanedTable.sourceImage && cleanedTable.sourceImage.preview) {
          cleanedTable.sourceImage = {
            id: cleanedTable.sourceImage.id,
            name: cleanedTable.sourceImage.name
            // preview supprimé pour économiser l'espace
          };
        }
        
        // Optimiser les métadonnées
        if (cleanedTable.analysisMetadata) {
          cleanedTable.analysisMetadata = {
            analyzedAt: cleanedTable.analysisMetadata.analyzedAt,
            confidence: cleanedTable.analysisMetadata.confidence
            // Autres métadonnées supprimées
          };
        }
        
        return cleanedTable;
      });
    }
    
    return cleaned;
  }

  /**
   * Optimise les données pour réduire encore la taille
   */
  optimizePerformanceData(data) {
    const optimized = { ...data };
    
    if (optimized.advancedPerformance && optimized.advancedPerformance.tables) {
      optimized.advancedPerformance.tables = optimized.advancedPerformance.tables.map(table => ({
        table_name: table.table_name,
        table_type: table.table_type,
        conditions: table.conditions,
        units: table.units,
        data: table.data,
        confidence: table.confidence
        // Tout le reste supprimé
      }));
      
      // Supprimer les métadonnées d'extraction pour économiser l'espace
      delete optimized.advancedPerformance.extractionMetadata;
    }
    
    return optimized;
  }

  /**
   * Compression ultra pour les cas extrêmes
   */
  ultraCompressData(data) {
    const ultra = { ...data };
    
    if (ultra.advancedPerformance && ultra.advancedPerformance.tables) {
      // Garder seulement les données essentielles
      ultra.advancedPerformance = {
        tables: ultra.advancedPerformance.tables.map(table => ({
          n: table.table_name.substring(0, 30), // nom tronqué
          t: table.table_type,
          d: table.data
          // Tout le reste supprimé
        })),
        compressed: true // Flag pour indiquer la compression
      };
    }
    
    return ultra;
  }

  /**
   * Nettoie les anciennes données pour libérer de l'espace
   */
  async cleanupOldData() {
    
    
    const keysToRemove = [];
    
    // Identifier les clés de performance anciennes
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('aircraft_performance_')) {
        // Supprimer les données plus anciennes que 30 jours si nécessaire
        keysToRemove.push(key);
      }
    }
    
    // Supprimer les plus anciennes si on en a trop
    if (keysToRemove.length > 10) {
      const toRemove = keysToRemove.slice(0, keysToRemove.length - 10);
      toRemove.forEach(key => {
        localStorage.removeItem(key);
        
      });
    }
  }

  /**
   * Vérifie l'espace disponible
   */
  checkAvailableSpace() {
    let usedSpace = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      usedSpace += new Blob([key + value]).size;
    }
    
    const remainingSpace = this.maxStorageSize - usedSpace;
    
    return remainingSpace;
  }
}

// Instance singleton
const performanceDataManager = new PerformanceDataManager();

export default performanceDataManager;