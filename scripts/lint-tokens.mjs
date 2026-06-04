#!/usr/bin/env node
/**
 * ============================================================================
 *  ALFlight — Runner du garde-fou Design Tokens
 * ============================================================================
 *  Lance ESLint avec la config AUTONOME `eslint.tokens.cjs`.
 *
 *  Par défaut : ne vérifie QUE les fichiers .js/.jsx modifiés (working tree +
 *  staged + non suivis) par rapport au dernier commit → « gèle l'entropie »
 *  sans noyer le legacy.
 *
 *  Usage :
 *    node scripts/lint-tokens.mjs                  # fichiers modifiés (défaut)
 *    node scripts/lint-tokens.mjs --staged         # uniquement l'index (pre-commit)
 *    node scripts/lint-tokens.mjs --all            # tout src/ (audit complet, indicatif)
 *    node scripts/lint-tokens.mjs <fichier...>     # fichiers explicites
 *
 *  Indépendant de eslint.config.js (qui cible ESLint 9). Compatible v8.57.x.
 * ============================================================================
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESLINT_BIN = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const CONFIG = path.join(ROOT, 'eslint.tokens.cjs');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const explicitFiles = argv.filter((a) => !a.startsWith('--'));

const isLintable = (f) => /\.(jsx?|tsx?|mjs|cjs)$/.test(f) && existsSync(path.join(ROOT, f));

/** Récupère une liste de fichiers via une commande git, tolérant aux erreurs. */
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'], // ignore stderr (avertissements CRLF git)
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveTargets() {
  if (explicitFiles.length) return explicitFiles.filter(isLintable);

  if (flags.has('--all')) {
    // Tout le code source (audit indicatif — révèle la dette existante).
    return git(['ls-files', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx']).filter(isLintable);
  }

  // Mode pre-commit : uniquement l'index.
  if (flags.has('--staged')) {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).filter(isLintable);
  }

  // Défaut : tout ce qui diffère du dernier commit + fichiers non suivis.
  const changed = git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...changed, ...untracked])].filter(isLintable);
}

const targets = resolveTargets();

if (!targets.length) {
  console.log('✓ [lint:tokens] Aucun fichier modifié à vérifier.');
  process.exit(0);
}

console.log(`🛡️  [lint:tokens] Vérification de ${targets.length} fichier(s) :`);
targets.forEach((f) => console.log(`   • ${f}`));
console.log('');

// ─── 1) ESLint AST (règles complètes) sur .js/.jsx/.mjs/.cjs ────────────────
const jsTargets = targets.filter((f) => /\.(jsx?|mjs|cjs)$/.test(f));
let eslintFailed = false;
if (jsTargets.length) {
  const result = spawnSync(
    process.execPath,
    [ESLINT_BIN, '--no-eslintrc', '-c', CONFIG, ...jsTargets],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'false' } }
  );
  eslintFailed = result.status !== 0;
}

// ─── 2) Scan regex dep-free sur .ts/.tsx ────────────────────────────────────
// eslint.tokens.cjs ne peut pas parser TypeScript sans @typescript-eslint/parser
// (non installé). Ce filet attrape au moins les couleurs hex et rgb/rgba en dur.
// Lignes/fichiers avec `eslint-disable` ignorés (exceptions documentées).
const tsTargets = targets.filter((f) => /\.tsx?$/.test(f));
let tsViolations = 0;
const TS_PATTERNS = [
  { re: /#[0-9a-fA-F]{3,8}\b/, msg: 'couleur hex en dur' },
  { re: /\brgba?\(/, msg: 'rgb()/rgba() en dur' },
];
for (const f of tsTargets) {
  let content;
  try {
    content = readFileSync(path.join(ROOT, f), 'utf8');
  } catch {
    continue;
  }
  if (/eslint-disable\s+no-restricted-syntax/.test(content)) continue; // disable fichier
  content.split('\n').forEach((line, i) => {
    if (/eslint-disable/.test(line) || /^\s*(\/\/|\*|\/\*)/.test(line)) return; // commentaire / disable
    const hit = TS_PATTERNS.find(({ re }) => re.test(line));
    if (hit) {
      console.log(`  ${f}:${i + 1}  ${hit.msg} → utiliser var(--…)`);
      tsViolations++;
    }
  });
}
if (tsViolations) {
  console.log(`\n  (${tsViolations} occurrence(s) hex/rgba dans des .ts/.tsx — scan regex, parser TS absent)`);
}

if (eslintFailed || tsViolations) {
  console.log('\n✖ [lint:tokens] Des valeurs de design en dur ont été détectées.');
  console.log('  → Remplace-les par des tokens (var(--…) ou tokens.* de designSystem.js).');
  console.log('  → Exception légitime ponctuelle : // eslint-disable-next-line no-restricted-syntax\n');
  process.exit(1);
}

console.log('✓ [lint:tokens] OK — aucune valeur de design en dur.');
process.exit(0);
