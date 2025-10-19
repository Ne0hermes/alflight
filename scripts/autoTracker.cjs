// scripts/autoTracker.js

/**
 * Système de tracking automatique des modifications de fichiers
 * Surveille les changements dans le projet et log dans Google Sheets
 */

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TRACKING_ENDPOINT = 'http://localhost:3001/api/log';
const PROJECT_ROOT = path.join(__dirname, '..');

// Configuration
const CONFIG = {
  // Dossiers à surveiller
  watchPaths: [
    'src/**/*.js',
    'src/**/*.jsx',
    'src/**/*.css',
    'src/**/*.json',
    'server/**/*.js',
    'public/**/*'
  ],
  // Fichiers à ignorer
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/*.log',
    '**/tracking/**'
  ],
  // Délai avant de logger (pour grouper les changements)
  debounceMs: 2000,
  // Activer les logs détaillés
  verbose: true
};

// État du tracker
let changesQueue = [];
let debounceTimer = null;
let isRunning = false;

/**
 * Log dans Google Sheets
 * @param {string} action - L'action effectuée (colonne B)
 * @param {string} summary - Résumé court (colonne D)
 * @param {string} details - Détails complets (colonne E)
 * @param {string} component - Composant concerné (colonne C)
 * @param {string} files - Fichiers modifiés (colonne F)
 * @param {string} status - Statut (colonne G)
 */
async function logToGoogleSheets(action, summary = '', details = '', component = 'Application', files = '', status = 'completed') {
  try {
    const response = await fetch(TRACKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, summary, details, component, files, status })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ Logged: ${action} → ${result.range}`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to log: ${action}`, error.message);
    return null;
  }
}

/**
 * Obtenir les informations git du dernier commit
 */
function getGitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: PROJECT_ROOT })
      .toString()
      .trim();

    const lastCommit = execSync('git log -1 --pretty=format:"%h - %s"', { cwd: PROJECT_ROOT })
      .toString()
      .trim();

    const author = execSync('git log -1 --pretty=format:"%an"', { cwd: PROJECT_ROOT })
      .toString()
      .trim();

    return { branch, lastCommit, author };
  } catch (error) {
    return { branch: 'unknown', lastCommit: 'N/A', author: 'unknown' };
  }
}

/**
 * Analyser le type de changement
 */
function analyzeChange(filePath, eventType) {
  const ext = path.extname(filePath);
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const fileName = path.basename(filePath);
  const dirName = path.dirname(relativePath);

  let category = 'File modification';
  let component = 'Unknown';

  // Déterminer le composant/module
  if (relativePath.includes('features/aircraft')) {
    component = 'Aircraft Module';
  } else if (relativePath.includes('features/flight-wizard')) {
    component = 'Flight Wizard';
  } else if (relativePath.includes('features/logbook')) {
    component = 'Logbook';
  } else if (relativePath.includes('features/pilot')) {
    component = 'Pilot Module';
  } else if (relativePath.includes('utils')) {
    component = 'Utilities';
  } else if (relativePath.includes('core/stores')) {
    component = 'State Management';
  } else if (relativePath.includes('core/contexts')) {
    component = 'Contexts';
  } else if (relativePath.includes('server')) {
    component = 'Backend';
  } else if (relativePath.includes('styles')) {
    component = 'Styles';
  }

  // Déterminer la catégorie
  if (eventType === 'add') {
    category = 'File added';
  } else if (eventType === 'unlink') {
    category = 'File deleted';
  } else if (fileName.toLowerCase().includes('test')) {
    category = 'Test update';
  } else if (ext === '.css' || relativePath.includes('styles')) {
    category = 'Style update';
  } else if (ext === '.json') {
    category = 'Configuration update';
  } else if (ext === '.jsx' || ext === '.js') {
    category = 'Code update';
  }

  return { category, component, relativePath };
}

/**
 * Créer un résumé formaté et lisible des changements
 */
function createFormattedSummary(changes, component) {
  const gitInfo = getGitInfo();

  // Grouper par fichier pour compter les opérations
  const fileOps = {};
  changes.forEach(change => {
    if (!fileOps[change.relativePath]) {
      fileOps[change.relativePath] = {
        path: change.relativePath,
        fileName: path.basename(change.relativePath),
        operations: [],
        eventTypes: new Set()
      };
    }
    fileOps[change.relativePath].operations.push(change);
    fileOps[change.relativePath].eventTypes.add(change.eventType);
  });

  // Créer la liste formatée
  const filesList = Object.values(fileOps);
  const summary = [];

  summary.push(`📦 Modifications dans ${component}`);
  summary.push(`\n🔹 ${filesList.length} fichier(s) modifié(s):`);
  summary.push('');

  filesList.forEach((file, index) => {
    const status = file.eventTypes.has('add') ? '✅ (nouveau)' :
                   file.eventTypes.has('unlink') ? '❌ (supprimé)' :
                   '📝 (modifié)';

    const changeCount = file.operations.length > 1 ? ` (${file.operations.length} modifications)` : '';

    summary.push(`${index + 1}. ${file.path} ${status}${changeCount}`);

    // Ajouter une description générique basée sur le type de fichier
    const ext = path.extname(file.path);
    let description = '';

    if (ext === '.jsx' || ext === '.js') {
      description = 'Code React/JavaScript';
    } else if (ext === '.css') {
      description = 'Styles CSS';
    } else if (ext === '.json') {
      description = 'Configuration';
    }

    if (description) {
      summary.push(`   └─ ${description}`);
    }
  });

  summary.push('');
  summary.push(`📌 Branche: ${gitInfo.branch}`);
  summary.push(`👤 Auteur: ${gitInfo.author}`);
  summary.push(`📝 Dernier commit: ${gitInfo.lastCommit}`);

  return summary.join('\n');
}

/**
 * Traiter la file d'attente des changements
 */
async function processChanges() {
  if (changesQueue.length === 0) return;

  console.log(`\n📊 Processing ${changesQueue.length} change(s)...`);

  // Grouper par composant
  const grouped = {};
  changesQueue.forEach(change => {
    if (!grouped[change.component]) {
      grouped[change.component] = [];
    }
    grouped[change.component].push(change);
  });

  // Logger chaque groupe avec un format lisible
  const gitInfo = getGitInfo();

  for (const [component, changes] of Object.entries(grouped)) {
    // Créer la liste des fichiers pour la colonne F
    const uniqueFiles = [...new Set(changes.map(c => c.relativePath))];
    const filesList = uniqueFiles.join('\n');

    // Créer le résumé formaté
    const formattedSummary = createFormattedSummary(changes, component);

    // Action simple
    const action = `Mise à jour - ${component}`;

    // Résumé court (colonne D)
    const shortSummary = `${uniqueFiles.length} fichier(s) modifié(s)`;

    // Détails complets (colonne E) - Le résumé formaté
    const details = formattedSummary;

    await logToGoogleSheets(action, shortSummary, details, component, filesList, 'completed');
  }

  // Vider la file
  changesQueue = [];
  console.log('✅ All changes logged\n');
}

/**
 * Gérer un changement de fichier
 */
function handleFileChange(filePath, eventType) {
  const analysis = analyzeChange(filePath, eventType);

  if (CONFIG.verbose) {
    console.log(`📝 ${eventType.toUpperCase()}: ${analysis.relativePath} (${analysis.component})`);
  }

  // Ajouter à la file
  changesQueue.push({
    filePath,
    eventType,
    timestamp: new Date().toISOString(),
    ...analysis
  });

  // Débounce: attendre que les changements se calment
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(processChanges, CONFIG.debounceMs);
}

/**
 * Démarrer le watcher
 */
function start() {
  if (isRunning) {
    console.log('⚠️  Tracker already running');
    return;
  }

  console.log('🚀 Starting Auto Tracker...');
  console.log(`📁 Watching: ${PROJECT_ROOT}`);
  console.log(`🎯 Endpoint: ${TRACKING_ENDPOINT}`);
  console.log(`⏱️  Debounce: ${CONFIG.debounceMs}ms\n`);

  const gitInfo = getGitInfo();
  console.log(`📌 Branch: ${gitInfo.branch}`);
  console.log(`👤 Author: ${gitInfo.author}`);
  console.log(`📝 Last commit: ${gitInfo.lastCommit}\n`);

  // Log le démarrage
  logToGoogleSheets(
    'Auto Tracker started',
    'Système de tracking automatique démarré',
    `Surveillance des fichiers activée. Branch: ${gitInfo.branch}, Auteur: ${gitInfo.author}`,
    'System',
    'scripts/autoTracker.cjs',
    'active'
  );

  // Créer le watcher
  const watcher = chokidar.watch(CONFIG.watchPaths, {
    ignored: CONFIG.ignored,
    persistent: true,
    ignoreInitial: true,
    cwd: PROJECT_ROOT,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  // Événements
  watcher
    .on('add', filePath => handleFileChange(filePath, 'add'))
    .on('change', filePath => handleFileChange(filePath, 'change'))
    .on('unlink', filePath => handleFileChange(filePath, 'unlink'))
    .on('error', error => console.error('❌ Watcher error:', error));

  isRunning = true;
  console.log('✅ Auto Tracker is running. Press Ctrl+C to stop.\n');

  // Gérer l'arrêt propre
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping Auto Tracker...');

    // Logger les changements en attente
    if (changesQueue.length > 0) {
      console.log('📊 Processing pending changes...');
      await processChanges();
    }

    // Log l'arrêt
    await logToGoogleSheets(
      'Auto Tracker stopped',
      'Système de tracking automatique arrêté',
      `Surveillance des fichiers désactivée. Branch: ${gitInfo.branch}`,
      'System',
      'scripts/autoTracker.cjs',
      'stopped'
    );

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
