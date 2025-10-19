/**
 * Script de nettoyage final - tous les patterns résiduels
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function finalCleanup(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern 1: Orphaned '); on its own line
  content = content.replace(/^\s*['\"`]?\);?\s*$/gm, '');

  // Pattern 2: Orphaned }%`); patterns
  content = content.replace(/^\s*\}%[`'"]?\);?\s*$/gm, '');

  // Pattern 3: Missing return closing before }
  // if (...) {\n    return (\n      <JSX />\n  } → add );
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9-]*>)\s*\n(\s+)\}(\s*\n\s+(if|return|const|\/\/|export))/g,
    '$1\n$2  );\n$2}$3'
  );

  // Pattern 4: Missing semicolon after filter/map
  // .filter(...))  → .filter(...));
  content = content.replace(
    /(\.(?:filter|map)\([^)]+\))\)\s*\n\s*const /g,
    '$1);\n\n  const '
  );

  // Pattern 5: Fix missing ) before }});
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9-]*>)\s*\n(\s+)\}\}\);/g,
    '$1\n$2);\n$2}});'
  );

  // Pattern 6: Orphaned })) at end
  content = content.replace(/^\s*\}\)\)\s*$/gm, '');

  // Pattern 7: const styles outside component (missing );)
  content = content.replace(
    /(\}\s*\n\s*\/\/ Styles|\}\s*\n\s*\/\/ Export|\}\s*\n\s*const styles)/g,
    (match) => {
      // Check if there's already a ); before
      const lines = match.split('\n');
      if (lines[0].trim().endsWith(');')) {
        return match;
      }
      return ');' + match;
    }
  );

  // Pattern 8: Nettoyer lignes vides excessives
  content = content.replace(/\n{5,}/g, '\n\n\n');

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
        finalCleanup(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🧹 Nettoyage final de tous les patterns résiduels...\\n');
walkDirectory(srcDir);
console.log(`\\n✨ ${filesFixed} fichiers nettoyés`);
