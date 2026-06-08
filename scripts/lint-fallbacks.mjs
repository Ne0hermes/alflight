#!/usr/bin/env node
/**
 * ============================================================================
 *  ALFlight — Garde-fou « Fallbacks silencieux & hard-coding »
 * ============================================================================
 *  Pendant de `lint-tokens.mjs`, mais pour la DONNÉE (pas le style). Détecte les
 *  patterns recensés dans AUDIT_HARDCODING_GLOBAL.md qui sont mécaniquement
 *  repérables, afin de :
 *    1) FIGER l'inventaire du jour (mode --all = baseline) ;
 *    2) BLOQUER toute NOUVELLE régression (mode défaut/--staged = pre-commit).
 *
 *  Cible : la valeur par défaut silencieuse est INTERDITE sur un outil de vol.
 *  Donnée requise absente ⇒ exception, jamais un nombre « plausible » inventé.
 *
 *  Usage :
 *    node scripts/lint-fallbacks.mjs            # fichiers modifiés (défaut)
 *    node scripts/lint-fallbacks.mjs --staged   # index seul (pre-commit)
 *    node scripts/lint-fallbacks.mjs --all      # tout src/ (baseline d'audit)
 *    node scripts/lint-fallbacks.mjs <fichier…> # fichiers explicites
 *
 *  Exception ponctuelle légitime : suffixer la ligne de  // fallback-ok
 *  (ex. valeur vraiment neutre, démo, constante UI non métier).
 * ============================================================================
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const explicitFiles = argv.filter((a) => !a.startsWith('--'));

// On ne scanne QUE le code applicatif (src/), jamais scripts/ ni les data SIA.
const isScannable = (f) =>
  /^src\//.test(f) && /\.(jsx?|tsx?|mjs|cjs)$/.test(f) && existsSync(path.join(ROOT, f));

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveTargets() {
  if (explicitFiles.length) return explicitFiles.filter(isScannable);
  if (flags.has('--all')) {
    return git(['ls-files', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx']).filter(isScannable);
  }
  if (flags.has('--staged')) {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).filter(isScannable);
  }
  const changed = git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...changed, ...untracked])].filter(isScannable);
}

// ── Règles (haute valeur de signal, faible bruit) ──────────────────────────
// sev : SEC (secret exposé) · P0 (sécurité de vol : donnée inventée) · DEV (debug en prod)
const RULES = [
  {
    id: 'SEC-secret-literal',
    sev: 'SEC',
    re: /\b(api[_-]?key|apikey|secret|password|access[_-]?token|anon[_-]?key)\b\s*[:=]\s*['"][A-Za-z0-9_\-./+]{20,}['"]/i,
    msg: "secret/clé en clair (≥20 chars) → import.meta.env + proxy backend, et roter la clé",
  },
  {
    id: 'SEC-env-literal-fallback',
    sev: 'SEC',
    re: /import\.meta\.env\.[A-Z0-9_]+\s*\|\|\s*['"][A-Za-z0-9_\-./+]{16,}['"]/,
    msg: "fallback littéral sur une variable d'env (clé compilée dans le bundle)",
  },
  {
    id: 'P0-num-fallback',
    sev: 'P0',
    re: /(\|\||\?\?)\s*(120|100|40|30|700|600|900|1000|1150|0\.72|0\.84|0\.8)\b/,
    msg: 'fallback numérique métier inventé (vitesse/conso/masse/densité)',
  },
  {
    id: 'P0-phantom-data',
    sev: 'P0',
    re: /\b(getDefaultAirspaces|getMinimalAirports|getMockMETAR|fallbackRunways|fixFHSTREmptyWeight)\s*\(/,
    msg: 'génération de données aéronautiques fictives (espace/AD/piste/météo/masse)',
  },
  {
    id: 'DEV-window-hook',
    sev: 'DEV',
    re: /window\.(testExportImport|testAPIKey|testEnvVars|diagnoseIndexedDB|PerformanceDataDebugger)\b/,
    msg: 'hook debug/PII exposé sur window → garder derrière import.meta.env.DEV',
  },
];

const isCommentLine = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

// ── Baseline-ratchet ───────────────────────────────────────────────────────
// On FIGE l'inventaire du jour dans scripts/fallbacks-baseline.json. Ensuite,
// seules les occurrences ABSENTES de la baseline (= nouvelles régressions)
// bloquent. La clé est indépendante du n° de ligne (file::id::code) pour
// survivre aux décalages de lignes. Pour purger un item : le corriger puis
// régénérer la baseline (npm run lint:fallbacks:baseline).
const BASELINE_PATH = path.join(ROOT, 'scripts', 'fallbacks-baseline.json');
const keyOf = (file, id, line) => `${file}::${id}::${line.trim()}`;

function loadBaseline() {
  try {
    if (!existsSync(BASELINE_PATH)) return new Set();
    const arr = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

const targets = resolveTargets();

if (!targets.length && !flags.has('--write-baseline')) {
  console.log('✓ [lint:fallbacks] Aucun fichier applicatif modifié à vérifier.');
  process.exit(0);
}

const hits = [];
for (const f of targets) {
  let content;
  try {
    content = readFileSync(path.join(ROOT, f), 'utf8');
  } catch {
    continue;
  }
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (isCommentLine(line)) return; // mention en commentaire = défang (ex. A5 getMockMETAR)
    if (/fallback-ok/.test(line)) return; // exception documentée
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        hits.push({ file: f, line: i + 1, sev: rule.sev, id: rule.id, msg: rule.msg, key: keyOf(f, rule.id, line) });
      }
    }
  });
}

// ── Mode écriture de baseline (à lancer avec --all) ─────────────────────────
if (flags.has('--write-baseline')) {
  const keys = [...new Set(hits.map((h) => h.key))].sort();
  writeFileSync(BASELINE_PATH, JSON.stringify(keys, null, 2) + '\n', 'utf8');
  console.log(`✓ [lint:fallbacks] Baseline écrite : ${keys.length} occurrence(s) gelée(s) → scripts/fallbacks-baseline.json`);
  process.exit(0);
}

const baseline = loadBaseline();
const newHits = hits.filter((h) => !baseline.has(h.key));
const knownCount = hits.length - newHits.length;

const order = { SEC: 0, P0: 1, DEV: 2 };
const bySev = (list) => {
  const c = { SEC: 0, P0: 0, DEV: 0 };
  list.forEach((h) => (c[h.sev] += 1));
  return c;
};

console.log(
  `🛡️  [lint:fallbacks] ${targets.length} fichier(s) · ${hits.length} occurrence(s) ` +
    `(${knownCount} connue(s) gelée(s), ${newHits.length} nouvelle(s))\n`
);

// --all = inventaire complet indicatif (connus + nouveaux), non bloquant.
if (flags.has('--all')) {
  const sorted = [...hits].sort(
    (a, b) => order[a.sev] - order[b.sev] || a.file.localeCompare(b.file) || a.line - b.line
  );
  for (const h of sorted) {
    const tag = baseline.has(h.key) ? ' ' : '+'; // '+' = hors baseline
    console.log(`  ${tag}[${h.sev}] ${h.file}:${h.line}  (${h.id}) ${h.msg}`);
  }
  const c = bySev(hits);
  console.log(`\n  Récap : ${c.SEC} SEC · ${c.P0} P0 · ${c.DEV} DEV  (baseline = ${baseline.size})`);
  console.log(`ℹ️  Mode --all (non bloquant). Geler l'état courant : npm run lint:fallbacks:baseline`);
  process.exit(0);
}

// Modes défaut/--staged : seules les NOUVELLES occurrences comptent.
if (!newHits.length) {
  console.log('✓ [lint:fallbacks] OK — aucune nouvelle régression (baseline respectée).');
  process.exit(0);
}

const sortedNew = newHits.sort(
  (a, b) => order[a.sev] - order[b.sev] || a.file.localeCompare(b.file) || a.line - b.line
);
console.log('Nouvelles occurrences (hors baseline) :');
for (const h of sortedNew) {
  console.log(`  [${h.sev}] ${h.file}:${h.line}  (${h.id}) ${h.msg}`);
}
const cNew = bySev(newHits);
console.log(`\n  Récap nouveau : ${cNew.SEC} SEC · ${cNew.P0} P0 · ${cNew.DEV} DEV`);
console.log('  → Corriger (helper fail-closed / import.meta.env / suppression),');
console.log('    ou marquer une exception légitime avec  // fallback-ok  en fin de ligne.\n');

const blocking = cNew.SEC + cNew.P0;
if (blocking > 0) {
  console.log(`✖ [lint:fallbacks] ${blocking} NOUVELLE(S) occurrence(s) bloquante(s) (SEC/P0).`);
  process.exit(1);
}

console.log('⚠️  [lint:fallbacks] Nouvelles occurrences DEV uniquement (non bloquantes).');
process.exit(0);
