/**
 * Script pour nettoyer tous les console.log de l'application
 * Garde uniquement les console.error vraiment critiques
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

// Patterns à supprimer
const patterns = [
  // Console.log simples
  /console\.log\([^)]*\);?\n?/g,
  // Console.log avec template strings multiligne
  /console\.log\(`[^`]*`\);?\n?/g,
  // Console.warn
  /console\.warn\([^)]*\);?\n?/g,
  // Console.info
  /console\.info\([^)]*\);?\n?/g,
  // Console.debug
  /console\.debug\([^)]*\);?\n?/g,
];

// Exceptions: garder les console.error critiques mais supprimer les debug
const errorPatternToKeep = /console\.error\(['"`](?:Error|Failed|Critical|Fatal)[^)]*\)/;

let filesProcessed = 0;
let logsRemoved = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let fileLogsRemoved = 0;

  // Compter les logs avant suppression
  const beforeCount = (content.match(/console\.(log|warn|info|debug)/g) || []).length;

  // Supprimer tous les console.log, warn, info, debug
  patterns.forEach(pattern => {
    newContent = newContent.replace(pattern, '');
  });

  // Supprimer aussi les console.error de debug (pas critiques)
  newContent = newContent.replace(/console\.error\(['"`]🔍[^)]*\);?\n?/g, '');
  newContent = newContent.replace(/console\.error\(['"`]DEBUG[^)]*\);?\n?/g, '');
  newContent = newContent.replace(/console\.error\(['"`]Test[^)]*\);?\n?/g, '');
  newContent = newContent.replace(/console\.error\(['"`]\[DEBUG\][^)]*\);?\n?/g, '');

  // Nettoyer les lignes vides multiples (plus de 2 lignes vides consécutives)
  newContent = newContent.replace(/\n{4,}/g, '\n\n\n');

  fileLogsRemoved = beforeCount - (newContent.match(/console\.(log|warn|info|debug)/g) || []).length;

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    filesProcessed++;
    logsRemoved += fileLogsRemoved;
    if (fileLogsRemoved > 0) {
      console.log(`✅ ${path.relative(srcDir, filePath)}: ${fileLogsRemoved} logs supprimés`);
    }
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Ignorer node_modules et autres dossiers inutiles
      if (!['node_modules', 'dist', 'build', '.git'].includes(file)) {
        walkDirectory(filePath);
      }
    } else if (
      file.endsWith('.js') ||
      file.endsWith('.jsx') ||
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    ) {
      processFile(filePath);
    }
  });
}

console.log('🧹 Nettoyage des logs en cours...\n');
walkDirectory(srcDir);
console.log(`\n✨ Nettoyage terminé!`);
console.log(`📊 ${filesProcessed} fichiers traités`);
console.log(`🗑️  ${logsRemoved} logs supprimés`);
