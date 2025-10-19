/**
 * Script pour supprimer les fragments orphelins de console.log
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function fixOrphanedFragments(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern 1: Lignes avec juste ":', error);" ou variantes
  content = content.replace(/^\s*['"]?:['"]?\s*,\s*\w+\s*\);?\s*$/gm, '');

  // Pattern 2: Lignes avec juste "`);" orphelines
  content = content.replace(/^\s*['"`]\);?\s*$/gm, '');

  // Pattern 3: Lignes avec "appelé avec succès" orphelines
  content = content.replace(/^\s*['"].*appelé.*['"].*\);?\s*$/gm, '');

  // Pattern 4: Nettoyer les lignes vides multiples
  content = content.replace(/\n{4,}/g, '\n\n\n');

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
        fixOrphanedFragments(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🔧 Suppression des fragments orphelins de console.log...\\n');
walkDirectory(srcDir);
console.log(`\\n✨ ${filesFixed} fichiers réparés`);
