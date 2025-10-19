/**
 * Script de réparation finale - Tous les patterns possibles
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function finalFixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern 1: }; orphelin à la fin d'un composant React (export const Component = () => { ... </div>\n};)
  // Doit devenir: </div>\n);
  content = content.replace(
    /(export\s+const\s+\w+\s*=\s*(?:memo\()?\s*\([^)]*\)\s*=>\s*\{[\s\S]*?<\/[a-z]+>)\s*\n\s*\};/g,
    '$1\n);'
  );

  // Pattern 2: }); orphelin pour les composants mémorisés sans return (
  // const Component = memo(() => { <JSX>... </JSX>\n});
  // Doit être: <JSX>... </JSX>\n);
  content = content.replace(
    /(const\s+\w+\s*=\s*memo\([^{]+\{\s*\n[\s\S]*?<\/[A-Za-z]+>)\s*\n\s*\}\);/g,
    (match, before) => {
      // Vérifier s'il y a un "return (" dans le match
      if (!match.includes('return (') && !match.includes('return(')) {
        return `${before}\n  );\n});`;
      }
      return match;
    }
  );

  // Pattern 3: Réparation des ); manquants après closing tags de fragments ou divs
  // </>\n}; → </>\n);
  content = content.replace(/(<\/>)\s*\n\s*\};/g, '$1\n);');

  // Pattern 4: Class components avec render() manquant return closing
  // } après </div> dans render() sans );
  content = content.replace(
    /(render\(\)\s*\{[\s\S]*?return\s*\([\s\S]*?<\/[A-Za-z]+>)\s*\n(\s+)\}/g,
    '$1\n$2);\n  }'
  );

  // Pattern 5: Fichiers .js avec des comments en début suivis d'export
  // Nettoyer les lignes orphelines après comments
  content = content.replace(/^\/\/[^\n]*\n\s*\);?\s*$/gm, (match) => {
    return match.split('\n')[0]; // Garder seulement le comment
  });

  // Pattern 6: Lignes avec juste `)); ou `); orphelines
  content = content.replace(/^\s*[`'"]?\)\);?\s*$/gm, '');

  // Pattern 7: Lignes avec patterns du type ":', error);" orphelines
  content = content.replace(/^\s*['"]:?\s*[',]\s*\w+\);?\s*$/gm, '');

  // Pattern 8: Supprimer les }... patterns restants
  content = content.replace(/^\s*\}\.{3}.*$/gm, '');

  // Pattern 9: Réparer les useState cassés
  // const [state, setState] = useState(\n  draft
  // → const [state, setState] = useState(draft
  content = content.replace(
    /(const\s*\[[^\]]+\]\s*=\s*useState\()\s*\n\s+/g,
    '$1'
  );

  // Pattern 10: Nettoyer lignes vides multiples
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
    } else if (
      file.endsWith('.js') ||
      file.endsWith('.jsx') ||
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    ) {
      try {
        finalFixFile(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🔧 Réparation finale de TOUS les fichiers...\n');
walkDirectory(srcDir);
console.log(`\n✨ ${filesFixed} fichiers réparés`);
