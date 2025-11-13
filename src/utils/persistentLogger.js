/**
 * Logger persistant qui sauvegarde dans localStorage
 * Permet de consulter les logs même après navigation
 */

const MAX_LOGS = 500;
const STORAGE_KEY = 'wizard_debug_logs';

class PersistentLogger {
  constructor() {
    this.logs = [];
    this.loadLogs();
  }

  loadLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      this.logs = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.logs = [];
    }
  }

  saveLogs() {
    try {
      // Garder seulement les MAX_LOGS derniers
      const toSave = this.logs.slice(-MAX_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Erreur sauvegarde logs:', e);
    }
  }

  log(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    this.logs.push({
      timestamp,
      level,
      message
    });

    this.saveLogs();

    // Aussi logger dans la console normale
    console[level](`[${timestamp}]`, ...args);
  }

  info(...args) {
    this.log('log', ...args);
  }

  error(...args) {
    this.log('error', ...args);
  }

  warn(...args) {
    this.log('warn', ...args);
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  export() {
    return this.logs.map(log =>
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
  }

  download() {
    const content = this.export();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wizard-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const persistentLogger = new PersistentLogger();

// Exposer globalement pour debug
if (typeof window !== 'undefined') {
  window.wizardLogger = persistentLogger;
}

export default persistentLogger;
