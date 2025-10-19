// scripts/claude-code-tracker.cjs

/**
 * Système de tracking des modifications Claude Code
 * Surveille les modifications faites par Claude et les envoie automatiquement à Google Sheets
 */

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TRACKING_ENDPOINT = 'http://localhost:3001/api/log';
const PROJECT_ROOT = path.join(__dirname, '..');
const SESSION_LOG_FILE = path.join(PROJECT_ROOT, 'tracking', 'claude-session.json');

// Configuration
const CONFIG = {
  // Dossiers à surveiller - CHEMINS ABSOLUS pour Windows/chokidar
  watchPaths: [
    path.join(PROJECT_ROOT, 'src'),
    path.join(PROJECT_ROOT, 'server'),
    path.join(PROJECT_ROOT, 'scripts'),
    PROJECT_ROOT  // Pour les .bat, .ps1 à la racine
  ],
  // Fichiers à ignorer
  ignored: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.log$/,
    /tracking[\/\\]claude-session\.json$/ // Ne pas tracker notre propre fichier de session
  ],
  // Délai avant d'envoyer le rapport (pour grouper les changements)
  // Augmenté à 60 secondes pour mieux grouper les modifications
  debounceMs: 60000,
  // Délai maximum d'attente avant envoi forcé
  // Augmenté à 5 minutes pour créer des résumés plus complets
  maxWaitMs: 300000
};

// État de la session
let sessionState = {
  modifications: [],
  startTime: new Date().toISOString(),
  lastSaveTime: null,
  totalChanges: 0
};

let debounceTimer = null;
let maxWaitTimer = null;

/**
 * Créer un rapport formaté et lisible
 */
function createFormattedReport(fileGroups, totalOperations) {
  const report = [];

  report.push('📦 Modifications effectuées par Claude Code');
  report.push('');
  report.push(`🔹 ${Object.keys(fileGroups).length} fichier(s) modifié(s) (${totalOperations} opération(s) totale(s)):`);
  report.push('');

  // Trier les fichiers par nombre de modifications (décroissant)
  const sortedFiles = Object.entries(fileGroups).sort((a, b) => b[1].changes.length - a[1].changes.length);

  sortedFiles.forEach(([file, group], index) => {
    const operations = Array.from(group.operations);
    const status = operations.includes('Création') ? '✅ (nouveau)' :
                   operations.includes('Suppression') ? '❌ (supprimé)' :
                   '📝 (modifié)';

    const changeCount = group.changes.length > 1 ? ` (${group.changes.length} modifications)` : '';

    report.push(`${index + 1}. ${file} ${status}${changeCount}`);

    // Ajouter une description basée sur le composant
    const component = group.changes[0].component;
    if (component && component !== 'Application') {
      report.push(`   └─ Composant: ${component}`);
    }

    // Ajouter le type d'opération si multiple
    if (operations.length > 1) {
      report.push(`   └─ Opérations: ${operations.join(', ')}`);
    }
  });

  report.push('');
  report.push(`⏱️  Session démarrée: ${new Date(sessionState.startTime).toLocaleString('fr-FR')}`);
  report.push(`📅 Rapport généré: ${new Date().toLocaleString('fr-FR')}`);

  // Info git si disponible
  try {
    const branch = require('child_process').execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    }).trim();

    const author = require('child_process').execSync('git log -1 --pretty=format:"%an"', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    }).trim();

    report.push('');
    report.push(`📌 Branche: ${branch}`);
    report.push(`👤 Auteur: ${author}`);
  } catch (error) {
    // Git info non disponible, ignorer
  }

  return report.join('\n');
}

/**
 * Envoyer le rapport à Google Sheets
 */
async function sendReportToGoogleSheets() {
  if (sessionState.modifications.length === 0) {
    return;
  }

  console.log(`\n📊 Envoi de ${sessionState.modifications.length} modification(s) à Google Sheets...`);

  // Grouper les modifications par fichier
  const fileGroups = {};
  sessionState.modifications.forEach(mod => {
    if (!fileGroups[mod.file]) {
      fileGroups[mod.file] = {
        file: mod.file,
        changes: [],
        operations: new Set()
      };
    }
    fileGroups[mod.file].changes.push(mod);
    fileGroups[mod.file].operations.add(mod.operation);
  });

  // Préparer le résumé
  const filesModified = Object.keys(fileGroups);
  const totalOperations = sessionState.modifications.length;

  const summary = `${filesModified.length} fichier(s) modifié(s) • ${totalOperations} opération(s)`;

  // Créer le rapport formaté
  const formattedReport = createFormattedReport(fileGroups, totalOperations);

  const filesString = filesModified.join('\n');

  // Envoyer à Google Sheets
  try {
    const response = await fetch(TRACKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CLAUDE_CODE_MODIFICATIONS',
        component: 'Claude Code Assistant',
        summary: summary,
        details: formattedReport,  // Utiliser le rapport formaté au lieu du JSON
        files: filesString,
        status: 'completed'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Rapport envoyé avec succès → ${result.range}`);
    console.log(`   Lien: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k`);

    // Sauvegarder la session
    saveSessionState();

    // Réinitialiser les modifications après envoi réussi
    sessionState.modifications = [];
    sessionState.lastSaveTime = new Date().toISOString();

  } catch (error) {
    console.error(`❌ Erreur lors de l'envoi du rapport:`, error.message);
  }
}

/**
 * Sauvegarder l'état de la session
 */
function saveSessionState() {
  try {
    const trackingDir = path.dirname(SESSION_LOG_FILE);
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir, { recursive: true });
    }

    fs.writeFileSync(SESSION_LOG_FILE, JSON.stringify(sessionState, null, 2));
  } catch (error) {
    console.error('Erreur sauvegarde session:', error.message);
  }
}

/**
 * Charger l'état de la session précédente
 */
function loadSessionState() {
  try {
    if (fs.existsSync(SESSION_LOG_FILE)) {
      const data = fs.readFileSync(SESSION_LOG_FILE, 'utf8');
      const previousState = JSON.parse(data);

      // Si la session précédente a des modifications non envoyées
      if (previousState.modifications && previousState.modifications.length > 0) {
        console.log(`📋 Session précédente trouvée avec ${previousState.modifications.length} modification(s) non envoyée(s)`);
        sessionState.modifications = previousState.modifications;
        sessionState.totalChanges = previousState.totalChanges || 0;
      }
    }
  } catch (error) {
    console.log('Démarrage d\'une nouvelle session de tracking');
  }
}

/**
 * Analyser le type d'opération
 */
function getOperationType(eventType, filePath) {
  if (eventType === 'add') return 'Création';
  if (eventType === 'unlink') return 'Suppression';
  if (eventType === 'change') return 'Modification';
  return 'Changement';
}

/**
 * Extraire le composant du chemin de fichier
 */
function getComponentFromPath(relativePath) {
  if (relativePath.includes('features/aircraft')) return 'Aircraft Module';
  if (relativePath.includes('features/flight-wizard')) return 'Flight Wizard';
  if (relativePath.includes('features/logbook')) return 'Logbook';
  if (relativePath.includes('abac/curves')) return 'ABAC Curves Builder';
  if (relativePath.includes('core/stores')) return 'State Management';
  if (relativePath.includes('server/')) return 'Backend';
  if (relativePath.includes('scripts/')) return 'Scripts';
  if (relativePath.endsWith('.bat') || relativePath.endsWith('.ps1')) return 'Automation';
  return 'Application';
}

/**
 * Gérer un changement de fichier
 */
function handleFileChange(filePath, eventType) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const operation = getOperationType(eventType, filePath);
  const component = getComponentFromPath(relativePath);

  const modification = {
    file: relativePath,
    operation: operation,
    component: component,
    timestamp: new Date().toISOString(),
    eventType: eventType
  };

  sessionState.modifications.push(modification);
  sessionState.totalChanges++;

  console.log(`📝 [${operation}] ${relativePath} (${component})`);

  // Débounce: attendre que les changements se calment
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(sendReportToGoogleSheets, CONFIG.debounceMs);

  // Timer maximum: envoyer après maxWaitMs même si des changements continuent
  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(() => {
      clearTimeout(debounceTimer);
      sendReportToGoogleSheets();
      maxWaitTimer = null;
    }, CONFIG.maxWaitMs);
  }

  // Sauvegarder l'état après chaque changement
  saveSessionState();
}

/**
 * Démarrer le tracker
 */
function start() {
  console.log('🚀 Démarrage Claude Code Tracker...');
  console.log(`📁 Répertoire: ${PROJECT_ROOT}`);
  console.log(`🎯 Endpoint: ${TRACKING_ENDPOINT}`);
  console.log(`⏱️  Délai groupement: ${CONFIG.debounceMs}ms`);
  console.log(`⏰ Délai maximum: ${CONFIG.maxWaitMs}ms\n`);

  // Charger la session précédente
  loadSessionState();

  // Envoyer log de démarrage
  fetch(TRACKING_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'CLAUDE_TRACKER_STARTED',
      component: 'Claude Code Tracker',
      summary: 'Tracking des modifications Claude Code activé',
      details: `Surveillance automatique des fichiers modifiés par Claude Code. Session: ${sessionState.startTime}`,
      status: 'active'
    })
  }).catch(() => {});

  // Créer le watcher - SANS cwd (chemins absolus utilisés)
  const watcher = chokidar.watch(CONFIG.watchPaths, {
    ignored: CONFIG.ignored,
    persistent: true,
    ignoreInitial: true,
    // cwd: PROJECT_ROOT,  // RETIRÉ - incompatible avec Windows + patterns relatifs
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200
    }
  });

  // Événements
  watcher
    .on('add', filePath => handleFileChange(filePath, 'add'))
    .on('change', filePath => handleFileChange(filePath, 'change'))
    .on('unlink', filePath => handleFileChange(filePath, 'unlink'))
    .on('error', error => console.error('❌ Erreur watcher:', error));

  console.log('✅ Claude Code Tracker actif. Surveillance des modifications...\n');

  // Gérer l'arrêt propre
  process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du Claude Code Tracker...');

    // Envoyer les modifications en attente
    clearTimeout(debounceTimer);
    clearTimeout(maxWaitTimer);

    if (sessionState.modifications.length > 0) {
      console.log('📊 Envoi des modifications en attente...');
      await sendReportToGoogleSheets();
    }

    // Log d'arrêt
    await fetch(TRACKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CLAUDE_TRACKER_STOPPED',
        component: 'Claude Code Tracker',
        summary: `Session terminée - ${sessionState.totalChanges} modification(s) totale(s)`,
        details: `Session: ${sessionState.startTime} → ${new Date().toISOString()}`,
        status: 'stopped'
      })
    }).catch(() => {});

    watcher.close();
    process.exit(0);
  });
}

// Exporter
module.exports = { start };

// Si exécuté directement
if (require.main === module) {
  start();
}
