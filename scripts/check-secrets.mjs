#!/usr/bin/env node
// ============================================================================
// Garde-fou ANTI-SECRETS (Lot 0.2) — bloque le commit si un fichier stagé
// contient une clé/clé privée, ou si un fichier d'env/clé est stagé par erreur.
// Léger, zéro dépendance. Échappatoire ponctuelle : mettre « secret-ok » sur
// la ligne concernée (à réserver aux faux positifs évidents, ex. doc).
// ============================================================================
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' });

// Fichiers stagés (ajoutés/copiés/modifiés)
const staged = run('git diff --cached --name-only --diff-filter=ACM')
  .split(/\r?\n/).filter(Boolean);

if (staged.length === 0) process.exit(0);

const problems = [];

// 1) NOMS DE FICHIERS interdits au commit
const FORBIDDEN_FILES = [
  { re: /(^|\/)\.env$/, why: 'fichier .env (clés réelles)' },
  { re: /(^|\/)\.env\.(?!example$)[^/]+$/, why: 'variante .env.* (seul .env.example est autorisé)' },
  { re: /\.pem$/i, why: 'clé privée PEM' },
  { re: /(^|\/)alfight-[a-f0-9]+\.json$/i, why: 'clé de compte de service Google' },
  { re: /credentials\.json$/i, why: 'fichier credentials' },
];
for (const f of staged) {
  for (const { re, why } of FORBIDDEN_FILES) {
    if (re.test(f)) problems.push(`✋ FICHIER INTERDIT stagé : ${f} — ${why}`);
  }
}

// 2) MOTIFS de secrets dans le CONTENU stagé
const PATTERNS = [
  { re: /-----BEGIN( RSA| EC| OPENSSH)? PRIVATE KEY-----/, name: 'clé privée (PEM)' },
  { re: /"private_key_id"\s*:/, name: 'clé de compte de service Google' },
  { re: /sk-ant-[A-Za-z0-9_-]{12,}/, name: 'clé API Anthropic' },
  { re: /sk-proj-[A-Za-z0-9_-]{12,}/, name: 'clé API OpenAI' },
  { re: /AIza[0-9A-Za-z_-]{35}/, name: 'clé API Google' },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/, name: 'jeton JWT' },
  { re: /^[^#\n]*(VITE_)?[A-Z_]*(API_KEY|TOKEN|SECRET)\s*=\s*['"]?[A-Za-z0-9_-]{20,}/m, name: 'affectation de clé en littéral' },
];

for (const f of staged) {
  let content;
  try { content = run(`git show ":${f}"`); } catch { continue; } // binaire/supprimé
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('secret-ok')) return; // échappatoire explicite
    for (const { re, name } of PATTERNS) {
      if (re.test(line)) problems.push(`🔑 ${f}:${i + 1} — motif « ${name} » détecté`);
    }
  });
}

if (problems.length) {
  console.error('\n❌ COMMIT BLOQUÉ — secrets potentiels détectés :\n');
  for (const p of problems) console.error('   ' + p);
  console.error('\n   Les clés vivent dans D:\\Applicator\\alflight\\.env (jamais committé)');
  console.error('   ou hors dépôt (SHEETS_CREDENTIALS_PATH). Faux positif évident ?');
  console.error('   → ajoutez « secret-ok » en commentaire sur la ligne concernée.\n');
  process.exit(1);
}
process.exit(0);
