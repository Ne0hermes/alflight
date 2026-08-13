#!/usr/bin/env node
/**
 * Installation des données AIRAC (SIA) pour ALFlight — mode semi-automatique.
 *
 * La boutique SIA impose un reCAPTCHA à la connexion : le téléchargement reste
 * donc MANUEL (https://www.sia.aviation-civile.gouv.fr, produit « Données
 * aéronautiques XML AIRAC NN/AA »). Tout le reste est automatisé :
 *
 *   npm run airac:check                     → état (cycle installé vs courant)
 *   npm run airac:install                   → trouve le ZIP le plus récent dans
 *                                             Téléchargements, extrait les deux XML
 *                                             dans public/data/, purge l'ancien cycle,
 *                                             met à jour aixm.config.js puis lance
 *                                             npm run sia:build
 *   npm run airac:install -- C:\chemin.zip  → idem depuis un ZIP précis
 *   ... -- --no-build                       → sans regénérer les GeoJSON
 *
 * Le script est idempotent : si le cycle courant est déjà installé, il ne fait rien.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const CONFIG_FILE = path.join(ROOT, 'src', 'data', 'aixm.config.js');
const TMP_DIR = path.join(ROOT, 'scripts', '.airac-tmp');
const DOWNLOADS = path.join(os.homedir(), 'Downloads');

// ---------------------------------------------------------------------------
// Calcul du cycle AIRAC
// ---------------------------------------------------------------------------
// Époque standard : le 2 janvier 2020 est une date effective de cycle AIRAC.
// Vérifié sur les cycles SIA réels : 2026-03-19 (03/26), 2026-05-14 (05/26),
// 2026-08-06 (08/26).
const AIRAC_EPOCH_UTC = Date.UTC(2020, 0, 2);
const CYCLE_MS = 28 * 24 * 3600 * 1000;

function cycleByIndex(k) {
  const eff = new Date(AIRAC_EPOCH_UTC + k * CYCLE_MS);
  const year = eff.getUTCFullYear();
  let first = k;
  while (new Date(AIRAC_EPOCH_UTC + (first - 1) * CYCLE_MS).getUTCFullYear() === year) first--;
  const ordinal = k - first + 1; // numéro du cycle dans l'année (01..13)
  const iso = eff.toISOString().slice(0, 10);
  const nn = String(ordinal).padStart(2, '0');
  const yy = String(year % 100).padStart(2, '0');
  return { index: k, effectiveISO: iso, label: `${nn}/${yy}` };
}

function currentCycle(now = new Date()) {
  return cycleByIndex(Math.floor((now.getTime() - AIRAC_EPOCH_UTC) / CYCLE_MS));
}

function installedCycleDate() {
  if (!fs.existsSync(DATA_DIR)) return null;
  const dates = fs.readdirSync(DATA_DIR)
    .map(f => /^AIXM4\.5_all_FR_OM_(\d{4}-\d{2}-\d{2})\.xml$/.exec(f)?.[1])
    .filter(Boolean)
    .sort();
  return dates.at(-1) ?? null;
}

// ---------------------------------------------------------------------------
// Recherche du ZIP SIA dans Téléchargements
// ---------------------------------------------------------------------------
function findZipInDownloads() {
  if (!fs.existsSync(DOWNLOADS)) return null;
  const candidates = fs.readdirSync(DOWNLOADS)
    .filter(f => /^export_xml.*\.zip$/i.test(f) || /^xml[_ -]?airac.*\.zip$/i.test(f))
    .map(f => {
      const p = path.join(DOWNLOADS, f);
      return { p, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.p ?? null;
}

// ---------------------------------------------------------------------------
// Extraction + installation
// ---------------------------------------------------------------------------
function extractZip(zipPath, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  let r = spawnSync('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'pipe' });
  if (r.status !== 0) {
    r = spawnSync('powershell', ['-NoProfile', '-Command',
      `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`], { stdio: 'pipe' });
    if (r.status !== 0) throw new Error(`Échec d'extraction du ZIP : ${r.stderr}`);
  }
}

function findFilesRecursive(dir, regex, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) findFilesRecursive(p, regex, out);
    else if (regex.test(entry.name)) out.push(p);
  }
  return out;
}

function assertLooksLikeXml(file) {
  const head = fs.readFileSync(file, { encoding: 'utf8', flag: 'r' }).slice(0, 200);
  if (!head.includes('<?xml')) throw new Error(`${path.basename(file)} ne ressemble pas à du XML.`);
  if (fs.statSync(file).size < 500_000) throw new Error(`${path.basename(file)} anormalement petit.`);
}

function rewriteConfig(newAixmName) {
  const src = fs.readFileSync(CONFIG_FILE, 'utf8');
  const re = /export const AIXM_FILE_CANDIDATES = \[[\s\S]*?\];/;
  if (!re.test(src)) throw new Error(`Bloc AIXM_FILE_CANDIDATES introuvable dans ${CONFIG_FILE}`);
  const block = `export const AIXM_FILE_CANDIDATES = [
  // ⚠️ Doit correspondre EXACTEMENT aux fichiers présents dans public/data/.
  // Le plus récent en tête. Anciens cycles retirés (fichiers supprimés du disque).
  // (Mis à jour automatiquement par scripts/update-airac.mjs)
  '${newAixmName}',
];`;
  fs.writeFileSync(CONFIG_FILE, src.replace(re, block));
}

function installFromZip(zipPath, cycle) {
  const extractDir = path.join(TMP_DIR, 'extract');
  extractZip(zipPath, extractDir);

  const aixm = findFilesRecursive(extractDir, /^AIXM4\.5_all_FR_OM_\d{4}-\d{2}-\d{2}\.xml$/)[0];
  const sia = findFilesRecursive(extractDir, /^XML_SIA_\d{4}-\d{2}-\d{2}\.xml$/)[0];
  if (!aixm || !sia) throw new Error('Le ZIP ne contient pas les deux fichiers attendus (AIXM4.5_all_FR_OM_*.xml et XML_SIA_*.xml).');
  assertLooksLikeXml(aixm);
  assertLooksLikeXml(sia);

  const aixmName = path.basename(aixm);
  const siaName = path.basename(sia);
  const fileDate = /(\d{4}-\d{2}-\d{2})/.exec(aixmName)[1];
  if (fileDate !== cycle.effectiveISO) {
    console.warn(`⚠ Date des fichiers (${fileDate}) ≠ cycle courant (${cycle.effectiveISO}) — installation quand même (ZIP d'un autre cycle ?).`);
  }

  // Copie des nouveaux fichiers puis purge des anciens cycles (l'ETL prend le
  // PREMIER fichier AIXM du dossier : il ne doit en rester qu'un).
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.copyFileSync(aixm, path.join(DATA_DIR, aixmName));
  fs.copyFileSync(sia, path.join(DATA_DIR, siaName));
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (/^(AIXM4\.5_all_FR_OM|XML_SIA)_\d{4}-\d{2}-\d{2}\.xml$/.test(f) && f !== aixmName && f !== siaName) {
      fs.rmSync(path.join(DATA_DIR, f));
      console.log(`  Ancien cycle supprimé : ${f}`);
    }
  }
  rewriteConfig(aixmName);
  fs.rmSync(extractDir, { recursive: true, force: true });
  console.log(`✔ Installé : ${aixmName} + ${siaName} → public/data/ ; aixm.config.js mis à jour.`);
  return fileDate;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const check = args.includes('--check');
const noBuild = args.includes('--no-build');
const zipArg = args.find(a => !a.startsWith('--'));

const cycle = currentCycle();
const installed = installedCycleDate();
const next = cycleByIndex(cycle.index + 1);

console.log(`Cycle AIRAC courant : ${cycle.label} (effectif ${cycle.effectiveISO})`);
console.log(`Cycle installé      : ${installed ?? 'aucun'}${installed === cycle.effectiveISO ? ' ✔ à jour' : ' ✖ OBSOLÈTE'}`);
console.log(`Prochain cycle      : ${next.label} (effectif ${next.effectiveISO})`);

if (check) process.exit(installed === cycle.effectiveISO ? 0 : 1);

if (!zipArg && installed === cycle.effectiveISO) {
  console.log('✔ Déjà à jour, rien à faire.');
  process.exit(0);
}

try {
  const zipPath = zipArg ? path.resolve(zipArg) : findZipInDownloads();
  if (!zipPath || !fs.existsSync(zipPath)) {
    throw new Error(`Aucun ZIP SIA trouvé${zipArg ? ` : ${zipArg}` : ` dans ${DOWNLOADS} (motif export_xml*.zip)`}.\n` +
      `→ Télécharger le produit « Données aéronautiques XML AIRAC ${cycle.label} » sur https://www.sia.aviation-civile.gouv.fr puis relancer.`);
  }
  console.log(`→ ZIP : ${zipPath}`);
  installFromZip(zipPath, cycle);

  if (noBuild) {
    console.log('ℹ GeoJSON non regénérés (--no-build) : npm run sia:build à lancer à la main.');
  } else {
    console.log('→ npm run sia:build…');
    const r = spawnSync(os.platform() === 'win32' ? 'npm.cmd' : 'npm', ['run', 'sia:build'], { cwd: ROOT, stdio: 'inherit', shell: true });
    if (r.status !== 0) throw new Error('sia:build a échoué (les XML sont installés ; relancer npm run sia:build à la main).');
  }
  console.log(`✔ Mise à jour AIRAC terminée. Prochain téléchargement : autour du ${next.effectiveISO}.`);
} catch (e) {
  console.error(`✖ ${e.message}`);
  process.exit(1);
}
