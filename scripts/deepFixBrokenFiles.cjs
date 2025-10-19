/**
 * Script de réparation profonde - Nettoie TOUS les artefacts du nettoyage de logs
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function deepFixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // 1. Supprimer les lignes avec }...)` ou }...)` :
  content = content.replace(/^.*\}\.\.\..*?\).*?[';`"].*?\).*;?\s*$/gm, '');

  // 2. Supprimer les lignes orphelines après if/while/for
  content = content.replace(/^(\s*(?:if|while|for)\s*\([^)]*\)\s*\{\s*)\n\s*\);?\s*$/gm, '$1\n');

  // 3. Supprimer les ); orphelines après import
  content = content.replace(/^(import[^;]+;)\s*\n\s*\);?\s*$/gm, '$1\n');

  // 4. Supprimer les ); orphelines après from
  content = content.replace(/^(from\s+['"][^'"]+['"];?)\s*\n\s*\);?\s*$/gm, '$1\n');

  // 5. Nettoyer les lignes vides multiples (max 2)
  content = content.replace(/\n{4,}/g, '\n\n\n');

  // 6. Supprimer les lignes qui sont juste ); sans contexte
  const lines = content.split('\n');
  const cleaned = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Si c'est juste ); et que la ligne précédente ne se termine pas par {
    if (trimmed === ');' || trimmed === ')') {
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      // Garder seulement si la ligne précédente est du JSX ou se termine par >
      if (!prevLine.endsWith('>') && !prevLine.includes('</')) {
        continue; // Skip cette ligne
      }
    }

    cleaned.push(line);
  }
  content = cleaned.join('\n');

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
    } else if (
      file.endsWith('.js') ||
      file.endsWith('.jsx') ||
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    ) {
      try {
        deepFixFile(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🔧 Réparation profonde...\n');
walkDirectory(srcDir);
console.log(`\n✨ ${filesFixed} fichiers réparés`);
