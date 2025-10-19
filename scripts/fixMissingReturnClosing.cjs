/**
 * Script pour réparer les composants React avec fermeture de return manquante
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
let filesFixed = 0;

function fixComponent(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Pattern 1: </tag>\n}; → </tag>\n  );\n};
  // Pour les composants fonctionnels réguliers
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9-]*>)\s*\n(\s*)\};(\s*\n\s*const styles|\s*\n\s*\/\/|\s*\n\s*export)/g,
    '$1\n$2);\n$2};$3'
  );

  // Pattern 2: </tag>\n}); → </tag>\n  );\n});
  // Pour les composants avec memo()
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9-]*>)\s*\n(\s*)\}\);(\s*\n\s*const|\s*\n\s*\/\/|\s*\n\s*export|\s*\n\s*[A-Z])/g,
    '$1\n$2);\n$2});$3'
  );

  // Pattern 3: </>}\n}; → </>\n  );\n};
  // Pour les fragments
  content = content.replace(
    /(<\/>)\s*\n(\s*)\};(\s*\n\s*const|\s*\n\s*\/\/|\s*\n\s*export)/g,
    '$1\n$2);\n$2};$3'
  );

  // Pattern 4: </>}\n}); → </>\n  );\n});
  // Pour les fragments avec memo
  content = content.replace(
    /(<\/>)\s*\n(\s*)\}\);(\s*\n\s*const|\s*\n\s*\/\/|\s*\n\s*[A-Z])/g,
    '$1\n$2);\n$2});$3'
  );

  // Pattern 5: </tag>\n  } → </tag>\n    );\n  }
  // Pour les if/else blocks
  content = content.replace(
    /(<\/[A-Za-z][A-Za-z0-9-]*>)\s*\n(\s+)\}(\s*\n\s+(if|return|const|\w+\s*=))/g,
    '$1\n$2  );\n$2}$3'
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
    } else if (
      file.endsWith('.js') ||
      file.endsWith('.jsx') ||
      file.endsWith('.ts') ||
      file.endsWith('.tsx')
    ) {
      try {
        fixComponent(filePath);
      } catch (e) {
        console.error(`❌ ${filePath}:`, e.message);
      }
    }
  });
}

console.log('🔧 Réparation des fermetures de return manquantes...\\n');
walkDirectory(srcDir);
console.log(`\\n✨ ${filesFixed} fichiers réparés`);
