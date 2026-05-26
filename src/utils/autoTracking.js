// src/utils/autoTracking.js

/**
 * Système de tracking automatique pour Google Sheets
 * Log automatiquement les modifications importantes de l'application
 */

const TRACKING_ENDPOINT = 'http://localhost:3001/api/log';
// 🔇 DÉSACTIVÉ PAR DÉFAUT : le sidecar localhost:3001 (Google Sheets logger) n'est pas
// démarré par défaut. Pour l'activer, lance `npm run dev:logger` ET pose dans la console :
//     localStorage.setItem('alflight:enableTracking', '1')
// puis reload la page. Sans ça, aucune requête réseau n'est tentée → zéro bruit console.
let TRACKING_ENABLED = (typeof window !== 'undefined')
  ? window.localStorage?.getItem('alflight:enableTracking') === '1'
  : false;

// File d'attente pour éviter les logs simultanés
let logQueue = [];
let isProcessing = false;

// Auto-désactivation : si le sidecar localhost:3001 n'est pas démarré, on cumule les échecs
// et on coupe complètement le tracking après quelques essais pour ne pas polluer la console.
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 2;
let trackingDisabledLogged = false;

/**
 * Log une action dans Google Sheets avec vérification
 */
async function logToTracking(action, details, category = 'Development') {
  if (!TRACKING_ENABLED) {
    
    return { success: false, reason: 'disabled' };
  }

  // Ajouter à la file d'attente
  return new Promise((resolve) => {
    logQueue.push({ action, details, category, resolve });
    processQueue();
  });
}

/**
 * Traite la file d'attente des logs
 */
async function processQueue() {
  if (isProcessing || logQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const { action, details, category, resolve } = logQueue.shift();

  try {
    const response = await fetch(TRACKING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, details, category })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    consecutiveFailures = 0; // reset après un succès
    resolve({ success: true, ...result });
  } catch (error) {
    // ⚠ Tracking non-bloquant — c'est juste un sidecar de dev (Google Sheets logger).
    // S'il n'est pas démarré, on log discrètement et on auto-désactive après N échecs
    // pour ne pas polluer la console à chaque sauvegarde utilisateur.
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      TRACKING_ENABLED = false;
      if (!trackingDisabledLogged) {
        trackingDisabledLogged = true;
        console.info(
          `ℹ️ [autoTracking] Sidecar localhost:3001 non joignable après ${MAX_CONSECUTIVE_FAILURES} essais — tracking auto-désactivé pour cette session (non bloquant).`
        );
      }
      // Vider la queue silencieusement
      const drained = logQueue.splice(0);
      drained.forEach(({ resolve: r }) => r({ success: false, reason: 'auto-disabled' }));
    } else {
      console.debug(`[autoTracking] échec ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} (${action}) — non bloquant`);
    }
    resolve({ success: false, error: error.message });
  } finally {
    isProcessing = false;
    // Traiter le prochain élément dans la file
    if (logQueue.length > 0) {
      setTimeout(processQueue, 100); // Petit délai entre les logs
    }
  }
}

/**
 * Logs prédéfinis pour les actions courantes
 */
const trackingActions = {
  // Gestion des avions
  aircraftAdded: (registration, model) =>
    logToTracking(
      'Aircraft added',
      `Added ${registration} (${model}) to fleet`
    ),

  aircraftUpdated: (registration, changes) =>
    logToTracking(
      'Aircraft updated',
      `Updated ${registration}: ${changes}`
    ),

  aircraftDeleted: (registration) =>
    logToTracking(
      'Aircraft deleted',
      `Removed ${registration} from fleet`
    ),

  aircraftImported: (count, source) =>
    logToTracking(
      'Aircraft imported',
      `Imported ${count} aircraft(s) from ${source}`
    ),

  aircraftExported: (count, format) =>
    logToTracking(
      'Aircraft exported',
      `Exported ${count} aircraft(s) to ${format}`
    ),

  // Photos et MANEX
  photoAdded: (registration, size) =>
    logToTracking(
      'Photo added',
      `Added photo for ${registration} (${Math.round(size / 1024)}KB)`
    ),

  manexAdded: (registration, size) =>
    logToTracking(
      'MANEX added',
      `Added MANEX PDF for ${registration} (${Math.round(size / 1024)}KB)`
    ),

  // Bugs et corrections
  bugFixed: (description, files) =>
    logToTracking(
      'Bug fix',
      `Fixed: ${description}. Files: ${files}`
    ),

  featureAdded: (name, description) =>
    logToTracking(
      'Feature added',
      `${name}: ${description}`
    ),

  // IndexedDB et stockage
  indexedDBIssue: (issue, resolution) =>
    logToTracking(
      'IndexedDB issue',
      `Issue: ${issue}. Resolution: ${resolution}`
    ),

  storageCleared: (reason) =>
    logToTracking(
      'Storage cleared',
      `Cleared storage: ${reason}`
    ),

  // Performances
  performanceIssue: (issue, fix) =>
    logToTracking(
      'Performance fix',
      `Issue: ${issue}. Fix: ${fix}`
    ),

  // Abaques de performance
  abaqueAdded: (registration, abaqueName, graphCount, curveCount, pointCount) =>
    logToTracking(
      'Abaque added',
      `Added performance chart "${abaqueName}" for ${registration}: ${graphCount} graph(s), ${curveCount} curve(s), ${pointCount} data points`
    ),

  abaqueUpdated: (registration, abaqueName, changes) =>
    logToTracking(
      'Abaque updated',
      `Updated performance chart "${abaqueName}" for ${registration}: ${changes}`
    ),

  abaqueDeleted: (registration, abaqueName) =>
    logToTracking(
      'Abaque deleted',
      `Removed performance chart "${abaqueName}" from ${registration}`
    ),

  performanceModelsConfigured: (registration, modelCount, totalGraphs, totalCurves, totalPoints) =>
    logToTracking(
      'Performance models configured',
      `Configured ${modelCount} performance chart(s) for ${registration}: ${totalGraphs} graphs, ${totalCurves} curves, ${totalPoints} data points total`
    ),

  // Custom log
  custom: (action, details) =>
    logToTracking(action, details)
};

/**
 * Intercepteur pour logger automatiquement certaines actions
 */
class AutoTracker {
  constructor() {
    this.enabled = TRACKING_ENABLED;
    this.lastLogs = [];
    this.maxHistory = 50;
  }

  /**
   * Vérifie si un log similaire a été envoyé récemment (évite les doublons)
   */
  isDuplicate(action, details) {
    const recent = this.lastLogs.slice(-5); // Vérifier les 5 derniers logs
    return recent.some(log =>
      log.action === action &&
      log.details === details &&
      Date.now() - log.timestamp < 5000 // Moins de 5 secondes
    );
  }

  /**
   * Log avec vérification de doublons
   */
  async log(action, details, category = 'Development') {
    if (this.isDuplicate(action, details)) {
      
      return { success: false, reason: 'duplicate' };
    }

    const result = await logToTracking(action, details, category);

    // Garder en historique
    this.lastLogs.push({
      action,
      details,
      timestamp: Date.now(),
      result
    });

    // Limiter l'historique
    if (this.lastLogs.length > this.maxHistory) {
      this.lastLogs.shift();
    }

    return result;
  }

  /**
   * Affiche l'historique des logs récents
   */
  showHistory() {
    console.table(this.lastLogs.map(log => ({
      action: log.action,
      details: log.details.substring(0, 50),
      time: new Date(log.timestamp).toLocaleTimeString(),
      success: log.result.success
    })));
  }

  /**
   * Active/désactive le tracking
   */
  toggle(enabled) {
    this.enabled = enabled;
    
  }
}

// Instance globale
const autoTracker = new AutoTracker();

// Exposer dans window pour debug
if (typeof window !== 'undefined') {
  window.autoTracker = autoTracker;
  window.trackingActions = trackingActions;
}

export { autoTracker, trackingActions, logToTracking };
export default autoTracker;
