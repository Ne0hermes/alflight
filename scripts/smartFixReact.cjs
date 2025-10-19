/**
 * Script intelligent pour réparer les return manquants dans les .map()
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function smartFixReactFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern 1: Réparer </JSXTag>\n  })} → </JSXTag>\n  );\n})}
  // Cherche une closing tag JSX suivie de })} sans ) entre les deux
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9]*>)\s*\n(\s+)\}\)\}/g,
    '$1\n$2);\n$2})}'
  );

  // Pattern 2: Réparer </JSXTag>\n}); pour les composants React
  // Cherche </Tag>\n}); qui devrait être </Tag>\n);
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9]*>)\s*\n(\s+)\}\);/g,
    (match, closingTag, indent) => {
      // Vérifier s'il y a un "return (" quelque part avant
      return `${closingTag}\n${indent});`;
    }
  );

  // Pattern 3: Réparer les }; orphelins après </JSXTag>
  // Cherche </Tag>\n}; qui devrait être </Tag>\n);
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9]*>)\s*\n(\s+)\};/g,
    '$1\n$2);'
  );

  // Pattern 4: Réparer les } orphelins après </JSXTag> (class components)
  // Plus délicat car doit distinguer entre component render et autres
  content = content.replace(
    /(render\(\)\s*\{[\s\S]*?<\/[A-Za-z][A-Za-z0-9]*>)\s*\n(\s+)\}/g,
    (match, before, indent) => {
      if (match.includes('return (') || match.includes('return(')) {
        return `${before}\n${indent});${indent}\n  }`;
      }
      return match;
    }
  );

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
        smartFixReactFile(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🧠 Réparation intelligente React...\n');
walkDirectory(srcDir);
console.log(`\n✨ ${filesFixed} fichiers réparés`);
