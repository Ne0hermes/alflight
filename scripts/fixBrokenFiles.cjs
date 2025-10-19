/**
 * Script pour réparer les fichiers cassés par le nettoyage des logs
 * Corrige les patterns problématiques courants
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

let filesFixed = 0;
let issuesFixed = 0;

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let fileIssues = 0;

  // Pattern 1: Ligne avec juste }...)` ou similaire (artefact de console.log)
  const pattern1 = /^\s*\}\.\.\..*?\`.*?\).*?;?\s*$/gm;
  if (pattern1.test(newContent)) {
    newContent = newContent.replace(pattern1, '');
    fileIssues++;
  }

  // Pattern 2: Parenthèse fermante orpheline après import
  const pattern2 = /^(\s*import[^;]+;)\s*\n\s*\);?\s*$/gm;
  if (pattern2.test(newContent)) {
    newContent = newContent.replace(pattern2, '$1');
    fileIssues++;
  }

  // Pattern 3: JSX return sans closing )
  // Chercher les patterns: </Tag>\n    }\n sans le );
  const pattern3 = /(<\/[A-Z][a-zA-Z]*>)\s*\n\s*(\}\s*\n\s*\})/g;
  if (pattern3.test(newContent)) {
    newContent = newContent.replace(pattern3, '$1\n  );\n$2');
    fileIssues++;
  }

  // Pattern 4: Ternaire incomplet (manque parenthèse)
  // ) : (\n      <Component />\n    }\n  DEVRAIT ÊTRE ) : (\n      <Component />\n    )\n  }
  const pattern4 = /(\)\s*:\s*\(\s*\n\s*<[A-Z][^>]+\/>\s*\n\s*)\}\s*\n/g;
  if (pattern4.test(newContent)) {
    newContent = newContent.replace(pattern4, '$1)\n  }\n');
    fileIssues++;
  }

  // Pattern 5: Fermeture de return JSX manquante
  // </Tag>\n  </Tag>\n}\n DEVRAIT avoir ); avant }
  const pattern5 = /(>\s*\n\s*<\/[A-Z][a-zA-Z]+>\s*\n\s*)(\};?\s*\n\s*(?:const|function|export|$))/g;
  const matches5 = newContent.match(pattern5);
  if (matches5) {
    // Vérifier qu'il n'y a pas déjà un ); avant le }
    newContent = newContent.replace(
      /(>\s*\n\s*<\/[A-Z][a-zA-Z]+>\s*\n\s*)(\};?\s*\n\s*(?:const|function|export))/g,
      (match, p1, p2) => {
        // Ne remplacer que si pas déjà ); présent
        if (!p1.includes(');')) {
          return p1 + ');\n' + p2;
        }
        return match;
      }
    );
    if (newContent !== content) fileIssues++;
  }

  // Pattern 6: Import de FlightSystemProviders suivi de code cassé
  const pattern6 = /from\s+['"]@core\/contexts['"];\s*\n\s*\);?/g;
  if (pattern6.test(newContent)) {
    newContent = newContent.replace(pattern6, 'from \'@core/contexts\';');
    fileIssues++;
  }

  if (fileIssues > 0) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    filesFixed++;
    issuesFixed += fileIssues;
    console.log(`✅ ${path.relative(srcDir, filePath)}: ${fileIssues} problèmes corrigés`);
  }
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
        fixFile(filePath);
      } catch (e) {
        console.error(`❌ Erreur dans ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🔧 Réparation des fichiers cassés...\n');
walkDirectory(srcDir);
console.log(`\n✨ Terminé!`);
console.log(`📊 ${filesFixed} fichiers réparés`);
console.log(`🛠️  ${issuesFixed} problèmes corrigés`);
