/**
 * Script pour nettoyer les lignes orphelines laissées après suppression des console.log
 * Supprime les lignes contenant uniquement ); ou des blocs if vides
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

let filesProcessed = 0;
let linesFixed = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  // Supprimer les lignes qui ne contiennent que );
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Vérifier si c'est une ligne orpheline
    const isOrphaned = trimmed === ');' || trimmed === ')';

    // Vérifier si c'est un bloc if vide (if { })
    const isEmptyIf = trimmed.match(/^if\s*\([^)]*\)\s*\{\s*\}\s*$/);

    if (isOrphaned || isEmptyIf) {
      // Vérifier le contexte: si la ligne précédente est un if ou autre structure de contrôle
      const prevLine = i > 0 ? lines[i - 1].trim() : '';
      if (prevLine.match(/^(if|while|for|switch)\s*\([^)]*\)\s*\{$/)) {
        // C'est un artefact de suppression, on le supprime
        modified = true;
        linesFixed++;
        continue;
      }
      // Si c'est juste ); tout seul sur une ligne, le supprimer aussi
      if (isOrphaned) {
        modified = true;
        linesFixed++;
        continue;
      }
    }

    newLines.push(line);
  }

  if (modified) {
    // Aussi nettoyer les blocs if vides restants
    let newContent = newLines.join('\n');

    // Supprimer les blocs if vides multilignes
    newContent = newContent.replace(/if\s*\([^)]*\)\s*\{\s*\n\s*\}\s*\n/g, '');

    // Nettoyer les lignes vides excessives (plus de 3 lignes vides)
    newContent = newContent.replace(/\n{5,}/g, '\n\n\n');

    fs.writeFileSync(filePath, newContent, 'utf8');
    filesProcessed++;
    console.log(`✅ ${path.relative(srcDir, filePath)}`);
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
      processFile(filePath);
    }
  });
}

console.log('🧹 Nettoyage des lignes orphelines...\n');
walkDirectory(srcDir);
console.log(`\n✨ Terminé!`);
console.log(`📊 ${filesProcessed} fichiers corrigés`);
console.log(`🗑️  ${linesFixed} lignes orphelines supprimées`);
