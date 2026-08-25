// scripts/audit/purge-sieges-arriere.mjs
//
// PURGE DES SIÈGES ARRIÈRE FANTÔMES des biplaces — écriture en base.
// Le pilote a supprimé DEUX FOIS les sièges arrière de F-BXNG via l'assistant ;
// les gardes anti-perte (mergeNonEmpty côté wizard, deepMergeKeepExisting côté
// serveur) traitaient « vidé volontairement » comme « non rechargé » et
// RESTAURAIENT la valeur à chaque sauvegarde. Les gardes sont corrigées le
// 25/08 (null = suppression volontaire) ; ce script applique enfin la
// suppression demandée.
//
// CIBLE STRICTE : les biplaces Cessna 150/152 de la flotte (F-BXNG, F-BXQT)
// dont le bras « sièges arrière » est la COPIE du bras des sièges avant —
// la signature du bras fabriqué relevée par l'audit (D3). Champs retirés :
// arms.rearSeats, weightBalance.rearLeftSeatArm, weightBalance.rearRightSeatArm,
// seatLimits.rearSeats. Rien d'autre.
//
// Sauvegarde INTÉGRALE de chaque ligne avant écriture ; relecture après.
// Usage : node scripts/audit/purge-sieges-arriere.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Applicator/alflight';
const APPLY = process.argv.includes('--apply');
const TABLE = 'community_presets';
const CIBLES = ['F-BXNG', 'F-BXQT']; // biplaces confirmés par le pilote (F 150M)
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL_ = env.VITE_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Config Supabase absente'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const api = async (qs, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${qs}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${(await r.text()).slice(0, 300)}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; };

console.log(`\n${APPLY ? '⚠  MODE ÉCRITURE' : '🔍 SIMULATION'} — suppression des sièges arrière fantômes (biplaces)\n`);
const rows = await api(`${TABLE}?select=*&order=registration.asc`);
const plan = [];
for (const row of rows) {
  if (!CIBLES.includes(row.registration)) continue;
  const d = row.aircraft_data || {};
  const front = num(d.arms?.frontSeats), rear = num(d.arms?.rearSeats);
  const actions = [];
  // Garde-fou : on ne retire QUE la signature « copie du bras avant ».
  if (rear !== null && front !== null && rear === front) {
    actions.push({ chemin: ['arms', 'rearSeats'], was: rear });
    for (const k of ['rearLeftSeatArm', 'rearRightSeatArm']) {
      if (d.weightBalance?.[k] !== undefined) actions.push({ chemin: ['weightBalance', k], was: d.weightBalance[k] });
    }
    if (d.seatLimits?.rearSeats !== undefined) actions.push({ chemin: ['seatLimits', 'rearSeats'], was: '(limites)' });
  } else {
    console.log(`  ⛔ ${row.registration} : rearSeats (${rear}) ≠ frontSeats (${front}) — signature absente, RIEN touché`);
  }
  if (actions.length) plan.push({ row, actions });
}
for (const { row, actions } of plan) {
  console.log(`${row.registration} — ${actions.length} champ(s) :`);
  for (const a of actions) console.log(`   − ${a.chemin.join('.')} = ${a.was}`);
}
console.log(`\n${plan.reduce((s, p) => s + p.actions.length, 0)} champs sur ${plan.length} fiches (biplace : le siège arrière n'existe pas).`);
if (!APPLY) { console.log('Relancer avec --apply pour écrire.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(ROOT, 'backups', `purge-sieges-arriere-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
for (const { row } of plan) fs.writeFileSync(path.join(dir, `${row.registration}.json`), JSON.stringify(row, null, 2));
console.log(`💾 Sauvegarde : ${dir}`);
const supprime = (obj, chemin) => { let c = obj; for (let i = 0; i < chemin.length - 1; i++) c = c?.[chemin[i]]; if (c) delete c[chemin[chemin.length - 1]]; };
let ok = 0;
for (const { row, actions } of plan) {
  const after = JSON.parse(JSON.stringify(row.aircraft_data));
  for (const a of actions) supprime(after, a.chemin);
  const temoin = JSON.parse(JSON.stringify(row.aircraft_data));
  for (const a of actions) supprime(temoin, a.chemin);
  if (JSON.stringify(temoin) !== JSON.stringify(after)) { console.error(`   ✗ ${row.registration} : écart imprévu — IGNORÉE`); continue; }
  await api(`${TABLE}?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ aircraft_data: after }) });
  const [relu] = await api(`${TABLE}?id=eq.${row.id}&select=registration,aircraft_data`);
  if (JSON.stringify(relu?.aircraft_data) !== JSON.stringify(after)) console.error(`   ⚠ ${row.registration} : la fiche relue diffère`);
  else { console.log(`   ✓ ${row.registration}`); ok++; }
}
console.log(`\n${ok}/${plan.length} fiches corrigées. Sauvegarde : ${dir}\n`);
