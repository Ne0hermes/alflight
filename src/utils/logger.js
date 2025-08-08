/**
 * Système de logging conditionnel pour optimiser les performances
 * Active les logs uniquement en mode développement
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = localStorage.getItem('debug') === 'true';

// Niveaux de log
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Configuration du niveau de log actuel
const currentLogLevel = isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;

// Logger factory
const createLogger = (prefix = '') => {
  return {
    debug: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.DEBUG && isDebugEnabled) {
        console.log(`[DEBUG]${prefix}`, ...args);
      }
    },
    
    info: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.info(`[INFO]${prefix}`, ...args);
      }
    },
    
    warn: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.WARN) {
        console.warn(`[WARN]${prefix}`, ...args);
      }
    },
    
    error: (...args) => {
      if (currentLogLevel <= LOG_LEVELS.ERROR) {
        console.error(`[ERROR]${prefix}`, ...args);
      }
    },
    
    // Méthode pour les logs de performance
    perf: (label, fn) => {
      if (!isDevelopment || !isDebugEnabled) {
        return fn();
      }
      
      const start = performance.now();
      const result = fn();
      const end = performance.now();
      
      console.log(`[PERF]${prefix} ${label}: ${(end - start).toFixed(2)}ms`);
      return result;
    },
    
    // Méthode pour grouper les logs
    group: (label, fn) => {
      if (!isDevelopment || !isDebugEnabled) {
        return fn();
      }
      
      console.group(`${prefix} ${label}`);
      const result = fn();
      console.groupEnd();
      return result;
    }
  };
};

// Export du logger principal
export const logger = createLogger();

// Export de la fonction pour créer des loggers avec préfixe
export const createModuleLogger = (moduleName) => {
  return createLogger(` [${moduleName}]`);
};

// Fonction utilitaire pour activer/désactiver le debug
export const setDebugMode = (enabled) => {
  localStorage.setItem('debug', enabled ? 'true' : 'false');
  window.location.reload(); // Recharger pour appliquer
};

// Export par défaut
export default logger;