/**
 * Script intelligent pour réparer les fichiers .js cassés
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function smartFixJSFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern 1: Supprimer les lignes orphelines comme ');
  content = content.replace(/^\s*['\"`]?\);?\s*$/gm, '');

  // Pattern 2: Supprimer les lignes orphelines avec juste }...)` ou variantes
  content = content.replace(/^\s*\}\.\.\..*?\`.*?\).*;?\s*$/gm, '');

  // Pattern 3: Réparer les lignes cassées après set(...)
  content = content.replace(/set\([^)]+\);?\s*\n\s*['\"`]?\);?/g, (match) => {
    return match.split('\n')[0]; // Garder seulement la première ligne
  });

  // Pattern 4: Nettoyer les multi-retours
  content = content.replace(/\n{4,}/g, '\n\n\n');

  // Pattern 5: Réparer les })) cassés
  content = content.replace(/(\}\s*\)\s*\n\s*)\}\)/g, '$1})');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesFixed++;
    console.log(`✅ ${path.relative(srcDir, filePath)}`);
    return true;
  }
  return false;
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git'].includes(file)) {
        walkDirectory(filePath);
      }
    } else if (file.endsWith('.js') && !file.endsWith('.cjs')) {
      try {
        smartFixJSFile(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🧠 Réparation intelligente JS...\n');
walkDirectory(srcDir);
console.log(`\n✨ ${filesFixed} fichiers réparés`);
