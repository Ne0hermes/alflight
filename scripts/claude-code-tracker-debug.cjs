// scripts/claude-code-tracker-debug.cjs
// Version DEBUG avec logs détaillés

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

console.log('🔍 === DEBUG MODE ===');
console.log('📁 PROJECT_ROOT:', PROJECT_ROOT);
console.log('🔍 Node version:', process.version);
console.log('🔍 Platform:', process.platform);
console.log('🔍 CWD:', process.cwd());

// Configuration simplifiée pour debug - TEST CHEMIN DIRECT
const CONFIG = {
  watchPaths: [
    path.join(PROJECT_ROOT, 'src')  // Surveiller tout le dossier src/ directement
  ],
  ignored: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/
  ]
};

console.log('\n📋 Configuration:');
console.log('   Watch paths:', CONFIG.watchPaths);
console.log('   Ignored:', CONFIG.ignored);

console.log('\n🚀 Création du watcher...');

// Créer le watcher avec logs détaillés - CONFIG SIMPLIFIÉE + CHEMIN ABSOLU
const watcher = chokidar.watch(CONFIG.watchPaths, {
  ignored: CONFIG.ignored,
  persistent: true,
  ignoreInitial: false, // Voir les fichiers existants au démarrage
  // cwd: PROJECT_ROOT,  // RETIRÉ car on utilise un chemin absolu
  usePolling: false,
  alwaysStat: true,
  depth: 99
});

let fileCount = 0;

// Événements de debug
watcher
  .on('ready', () => {
    console.log('\n✅ Watcher READY - Surveillance active');
    console.log(`📊 ${fileCount} fichier(s) détecté(s) au démarrage`);
    console.log('\n👀 En attente de modifications...\n');
  })
  .on('add', filePath => {
    fileCount++;
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    console.log(`✅ [ADD] ${relativePath}`);
  })
  .on('change', filePath => {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    console.log(`🔄 [CHANGE] ${relativePath}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Absolute: ${filePath}`);
  })
  .on('unlink', filePath => {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    console.log(`❌ [UNLINK] ${relativePath}`);
  })
  .on('error', error => {
    console.error('❌ [ERROR]', error);
  })
  .on('raw', (event, path, details) => {
    console.log(`🔍 [RAW EVENT] ${event}`, path, details);
  });

// Gérer l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du debug tracker...');
  watcher.close();
  process.exit(0);
});

console.log('⏳ Initialisation du watcher...');
