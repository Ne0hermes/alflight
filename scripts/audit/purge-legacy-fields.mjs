// scripts/audit/purge-legacy-fields.mjs
//
// PURGE DES CHAMPS LEGACY DES FICHES AVION — écriture en base, irréversible.
// Autorisée par César le 24/08/2026 (« push et purge ce qu'il faut purger »),
// après vérification adverse qu'aucun lecteur ne subsiste dans le code.
//
// CE QUI EST PURGÉ
//   (A) aircraft_data.maxBaggageWeight   — 50 sur les 13 avions, valeur par
//       défaut jamais saisie ; remplacée par les compartiments à bagages.
//   (B) aircraft_data.maxAuxiliaryWeight — 20 sur les 13 avions, idem.
//   (C) additionalFuelTanks[].capacity   — champ legacy, UNIQUEMENT sur les
//       réservoirs qui portent DÉJÀ usableCapacity ET totalCapacity. Là, le
//       `capacity` est un doublon mort (parfois une vieille valeur fausse :
//       F-GNAM portait 91 face à 182 utilisables, et le module Carburant
//       plafonnait le vol à 91 L).
//
// CE QUI N'EST JAMAIS TOUCHÉ
//   • un réservoir dont le `capacity` est le SEUL volume, ou qui manque
//     usableCapacity ou totalCapacity : le champ y porte une information
//     réelle (tankUsableLtr/tankTotalLtr retombent dessus). Le purger
//     effacerait la contenance de l'avion. Ces réservoirs sont LISTÉS en fin
//     d'exécution : c'est au pilote de saisir les deux volumes.
//   • tout autre champ, quel qu'il soit. La purge est chirurgicale.
//
// SÛRETÉ
//   • lecture seule par défaut : il faut --apply pour écrire ;
//   • sauvegarde INTÉGRALE de chaque ligne (toutes colonnes) avant toute
//     écriture, dans backups/<horodatage>/ — l'écriture est refusée si la
//     sauvegarde échoue ;
//   • PATCH ciblé sur aircraft_data uniquement, ligne par ligne ;
//   • relecture après écriture : on vérifie que les clés ont disparu ET que
//     rien d'autre n'a bougé (comparaison du reste de la fiche).
//   • les clés Supabase restent dans .env : jamais affichées, jamais journalisées.
//
// Usage :
//   node scripts/audit/purge-legacy-fields.mjs            → simulation
//   node scripts/audit/purge-legacy-fields.mjs --apply    → écriture réelle

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Applicator/alflight';
const APPLY = process.argv.includes('--apply');
const TABLE = 'community_presets';

// ─── Connexion (les clés ne quittent jamais .env) ───────────────────────────
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('Config Supabase absente (.env) — une clé service_role est requise pour écrire.');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(qs, init = {}) {
  const r = await fetch(`${URL_}/rest/v1/${qs}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 400)}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

const has = (v) => v !== undefined && v !== null && v !== '';
const n = (v) => (typeof v === 'string' ? parseFloat(v) : v);

// ─── Décision, réservoir par réservoir ──────────────────────────────────────
// Un `capacity` n'est purgeable que si les DEUX volumes canoniques existent.
function tankDecision(t) {
  if (!has(t?.capacity)) return { purge: false, why: 'pas de capacity' };
  const u = has(t?.usableCapacity), tot = has(t?.totalCapacity);
  if (u && tot) {
    const c = n(t.capacity);
    const doublon = c === n(t.usableCapacity) || c === n(t.totalCapacity);
    return { purge: true, why: doublon ? 'doublon d’un volume déjà présent' : `valeur morte (${c} ≠ utilisable ${n(t.usableCapacity)} et ≠ total ${n(t.totalCapacity)})` };
  }
  if (u && !tot) return { purge: false, why: 'capacity porte le TOTAL (totalCapacity absent)' };
  if (!u && tot) return { purge: false, why: 'capacity porte l’UTILISABLE (usableCapacity absent)' };
  return { purge: false, why: 'seul volume de ce réservoir' };
}

// ─── Plan de purge ──────────────────────────────────────────────────────────
console.log(`\n${APPLY ? '⚠  MODE ÉCRITURE' : '🔍 SIMULATION (aucune écriture)'} — table ${TABLE}\n`);

const rows = await api(`${TABLE}?select=*&order=registration.asc`);
console.log(`${rows.length} fiches lues.\n`);

const plan = [];
const aLaisser = [];

for (const row of rows) {
  const d = row.aircraft_data || {};
  const actions = [];
  if (has(d.maxBaggageWeight)) actions.push({ kind: 'root', key: 'maxBaggageWeight', was: d.maxBaggageWeight });
  if (has(d.maxAuxiliaryWeight)) actions.push({ kind: 'root', key: 'maxAuxiliaryWeight', was: d.maxAuxiliaryWeight });

  (d.additionalFuelTanks || []).forEach((t, i) => {
    const dec = tankDecision(t);
    if (dec.purge) actions.push({ kind: 'tank', index: i, name: t.name, was: t.capacity, why: dec.why });
    else if (has(t?.capacity)) aLaisser.push({ reg: row.registration, name: t.name, capacity: t.capacity, why: dec.why });
  });

  if (actions.length) plan.push({ row, actions });
}

for (const { row, actions } of plan) {
  console.log(`${String(row.registration).padEnd(9)} ${actions.length} champ(s)`);
  for (const a of actions) {
    if (a.kind === 'root') console.log(`   − aircraft_data.${a.key} = ${a.was}`);
    else console.log(`   − additionalFuelTanks[${a.index}] « ${a.name} » .capacity = ${a.was}  (${a.why})`);
  }
}

const total = plan.reduce((s, p) => s + p.actions.length, 0);
console.log(`\nTOTAL : ${total} champs sur ${plan.length} fiches.`);

if (aLaisser.length) {
  console.log(`\n⛔ ${aLaisser.length} réservoirs GARDENT leur capacity — le purger effacerait leur contenance :`);
  for (const x of aLaisser) console.log(`   ${String(x.reg).padEnd(9)} « ${x.name} » capacity=${x.capacity} — ${x.why}`);
  console.log('   → à corriger par le pilote (saisir utilisable ET total dans la fiche), pas par un script.');
}

if (!APPLY) {
  console.log('\nSimulation terminée. Relancer avec --apply pour écrire.\n');
  process.exit(0);
}

// ─── Sauvegarde intégrale AVANT toute écriture ──────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(ROOT, 'backups', `purge-legacy-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'community_presets-integral.json'), JSON.stringify(rows, null, 2), 'utf8');
for (const row of rows) {
  fs.writeFileSync(path.join(dir, `${row.registration || row.id}.json`), JSON.stringify(row, null, 2), 'utf8');
}
const ko = Math.round(fs.statSync(path.join(dir, 'community_presets-integral.json')).size / 1024);
console.log(`\n💾 Sauvegarde intégrale des ${rows.length} lignes : ${dir} (${ko} ko)`);
if (!fs.existsSync(path.join(dir, 'community_presets-integral.json')) || ko < 10) {
  console.error('Sauvegarde suspecte — écriture ANNULÉE.');
  process.exit(1);
}

// ─── Écriture, ligne par ligne, avec relecture ──────────────────────────────
let ok = 0;
for (const { row, actions } of plan) {
  const before = row.aircraft_data || {};
  const after = JSON.parse(JSON.stringify(before));

  for (const a of actions) {
    if (a.kind === 'root') delete after[a.key];
    else delete after.additionalFuelTanks[a.index].capacity;
  }

  // Garde-fou : rien d'autre ne doit avoir bougé.
  const temoinAvant = JSON.parse(JSON.stringify(before));
  const temoinApres = JSON.parse(JSON.stringify(after));
  for (const a of actions) {
    if (a.kind === 'root') { delete temoinAvant[a.key]; }
    else { delete temoinAvant.additionalFuelTanks[a.index].capacity; }
  }
  if (JSON.stringify(temoinAvant) !== JSON.stringify(temoinApres)) {
    console.error(`   ✗ ${row.registration} : la fiche modifiée diffère au-delà des champs visés — IGNORÉE.`);
    continue;
  }

  await api(`${TABLE}?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: after }),
  });

  // Relecture : les clés ont-elles réellement disparu ?
  const [relu] = await api(`${TABLE}?id=eq.${row.id}&select=registration,aircraft_data`);
  const d2 = relu?.aircraft_data || {};
  const restes = actions.filter((a) =>
    a.kind === 'root' ? has(d2[a.key]) : has(d2.additionalFuelTanks?.[a.index]?.capacity)
  );
  if (restes.length) {
    console.error(`   ✗ ${row.registration} : ${restes.length} champ(s) toujours présents après écriture.`);
  } else if (JSON.stringify(d2) !== JSON.stringify(after)) {
    console.error(`   ⚠ ${row.registration} : purge faite, mais la fiche relue diffère de ce qui a été envoyé.`);
  } else {
    console.log(`   ✓ ${String(row.registration).padEnd(9)} ${actions.length} champ(s) purgés`);
    ok++;
  }
}

console.log(`\n${ok}/${plan.length} fiches purgées. Sauvegarde : ${dir}\n`);
