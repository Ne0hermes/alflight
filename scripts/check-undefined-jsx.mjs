#!/usr/bin/env node
// ============================================================================
// Garde-fou ANTI « composant JSX non importé » (2026-08-16)
// ----------------------------------------------------------------------------
// Leçon du crash production « ReferenceError: DeleteAccountSection is not
// defined » : un composant utilisé en JSX sans import passe le BUILD (esbuild/
// rollup le traitent comme une globale) et explose à l'EXÉCUTION.
// Détecte tout <Composant> majuscule sans import ni déclaration locale.
//   node scripts/check-undefined-jsx.mjs             → scanne tout src/
//   node scripts/check-undefined-jsx.mjs --staged    → fichiers stagés (hook)
// Précautions anti-faux-positifs : commentaires et template strings neutralisés,
// génériques TS ignorés (« < » précédé d'un identifiant), déstructurations de
// paramètres de fonction prises en compte ({ icon: Icon }) => …
// ============================================================================
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const STAGED = process.argv.includes('--staged');

const GLOBALS = new Set(['React', 'Fragment', 'Suspense', 'Infinity', 'Object', 'Array', 'Promise', 'Set', 'Map', 'Date', 'JSON', 'Math', 'Number', 'String', 'Boolean', 'Error']);

const files = STAGED
  ? execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
      .split(/\r?\n/).filter((f) => /\.(jsx|tsx)$/.test(f) && fs.existsSync(f))
  : walk('src').filter((f) => /\.(jsx|tsx)$/.test(f));

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const problems = [];

for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');

  // Neutraliser commentaires bloc, commentaires ligne et template strings
  // (les exemples JSDoc « <TechLabel> » et sélecteurs CSS n'y comptent pas).
  src = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');

  // 1. Composants utilisés en VRAI JSX : « < » non précédé d'un caractère
  //    d'identifiant (élimine les génériques TS : useRef<DragState>).
  const used = new Set();
  for (const m of src.matchAll(/(?<![A-Za-z0-9_$])<([A-Z][A-Za-z0-9_]*)[\s/>]/g)) used.add(m[1]);
  if (used.size === 0) continue;

  // 2. Identifiants DÉFINIS dans le fichier.
  const defined = new Set(GLOBALS);
  for (const m of src.matchAll(/import\s+([A-Za-z0-9_$]+)\s*(?:,|\bfrom\b)/g)) defined.add(m[1]);
  for (const m of src.matchAll(/import\s*(?:[A-Za-z0-9_$]+\s*,\s*)?\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(/\bas\b/).pop().trim();
      if (name) defined.add(name);
    }
  }
  for (const m of src.matchAll(/import\s*\*\s*as\s+([A-Za-z0-9_$]+)/g)) defined.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_$]*)/g)) defined.add(m[1]);
  // Déstructurations : const { X } = … ET paramètres ({ icon: Icon }) => …
  for (const m of src.matchAll(/\{([^{}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop().split('=')[0].trim();
      if (/^[A-Z][A-Za-z0-9_$]*$/.test(name)) defined.add(name);
    }
  }

  for (const name of used) {
    if (!defined.has(name)) {
      problems.push(`JSX ${f} — <${name}> utilisé mais JAMAIS importé/défini (ReferenceError garanti au rendu)`);
    }
  }
}

if (problems.length) {
  console.error('\nCOMMIT BLOQUÉ — composants JSX non définis :\n');
  for (const p of problems) console.error('   ' + p);
  console.error("\n   Ajoutez l'import manquant — le build NE détecte PAS ce bug, il explose en production.\n");
  process.exit(1);
}
console.log(`check-undefined-jsx : ${files.length} fichier(s), aucun composant orphelin`);
process.exit(0);
