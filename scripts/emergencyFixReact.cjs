/**
 * Script de réparation d'urgence pour les composants React cassés
 * Répare les patterns spécifiques causés par le nettoyage des logs
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function fixReactComponent(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern 1: Composant React manquant "return ("
  // Cherche: const Component = memo(({ props }) => {
  //          <JSX>...</JSX>
  // Devrait être: const Component = memo(({ props }) => {
  //                return (
  //                  <JSX>...</JSX>
  //                );
  //              });

  // Détecter les composants avec JSX direct sans return
  // Pattern: }) => {\n  <TagOuvrant
  content = content.replace(
    /((?:const|export const)\s+\w+\s*=\s*(?:memo\()?\s*\([^)]*\)\s*=>\s*\{)\s*\n\s*(<[A-Z])/g,
    '$1\n  return (\n    $2'
  );

  // Pattern 2: Fermeture de composant sans le ); avant }
  // Cherche: </Tag>\n}); ou </Tag>\n}
  // SEULEMENT si c'est un composant React (précédé de return ( quelque part avant)

  // Ajouter ); avant }); à la fin des composants
  content = content.replace(
    /(<\/[A-Z][a-zA-Z]*>)\s*\n\s*(\}\);?)/g,
    (match, closingTag, closingBrace) => {
      // Vérifier si le closing brace a déjà un ) avant
      if (closingBrace.startsWith(')')) {
        return match; // Déjà correct
      }
      return `${closingTag}\n  );\n${closingBrace}`;
    }
  );

  // Pattern 3: Nettoyer les retours multiples
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
    } else if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
      try {
        fixReactComponent(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🚨 Réparation d\'urgence React...\n');
walkDirectory(srcDir);
console.log(`\n✨ ${filesFixed} fichiers réparés`);
