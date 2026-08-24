// scripts/audit/purge-cglimits-plat.mjs
//
// PURGE DU MIROIR PLAT aircraft_data.cgLimits — écriture en base.
// Autorisée par la règle pilote du 24/08 (« rien, aucun fallback ») et, pour
// F-GUVV, PROUVÉE par la fiche de pesée : l'exemple de chargement officiel
// donne CG 2,555 m à 1150 kg, hors limites de 24 cm dans le plat {2,05–2,31}.
//
// RÈGLE : le champ plat n'est retiré QUE si la fiche porte une enveloppe
// complète (≥1 point avant ET une limite arrière) — sinon il est le seul
// recours et il RESTE (fail-closed). Les 3 lecteurs du code préfèrent
// désormais l'enveloppe (commit du 24/08) : le plat retiré ne manque à rien.
//
// Sauvegarde INTÉGRALE de chaque ligne avant écriture, relecture après.
// Usage : node scripts/audit/purge-cglimits-plat.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Applicator/alflight';
const APPLY = process.argv.includes('--apply');
const TABLE = 'community_presets';
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

console.log(`\n${APPLY ? '⚠  MODE ÉCRITURE' : '🔍 SIMULATION'} — purge du miroir plat cgLimits\n`);
const rows = await api(`${TABLE}?select=*&order=registration.asc`);
const plan = [];
for (const row of rows) {
  const d = row.aircraft_data || {};
  if (!d.cgLimits) continue;
  const envOk = Array.isArray(d.cgEnvelope?.forwardPoints) && d.cgEnvelope.forwardPoints.length > 0
    && (num(d.cgEnvelope?.aftCG) !== null || (Array.isArray(d.cgEnvelope?.aftPoints) && d.cgEnvelope.aftPoints.length > 0));
  const ligne = `${String(row.registration).padEnd(9)} plat=${JSON.stringify(d.cgLimits)}`;
  if (!envOk) { console.log(`  ⛔ GARDÉ  ${ligne} — pas d'enveloppe complète, le plat est le seul recours`); continue; }
  console.log(`  − PURGE  ${ligne} — enveloppe complète présente (avant ${num(d.cgEnvelope.forwardPoints[0]?.cg)}, arrière ${num(d.cgEnvelope?.aftCG) ?? num(d.cgEnvelope?.aftPoints?.[0]?.cg)})`);
  plan.push(row);
}
console.log(`\n${plan.length} fiche(s) à purger.`);
if (!APPLY) { console.log('Relancer avec --apply pour écrire.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(ROOT, 'backups', `purge-cglimits-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
for (const row of plan) fs.writeFileSync(path.join(dir, `${row.registration}.json`), JSON.stringify(row, null, 2));
console.log(`💾 Sauvegarde : ${dir}`);
let ok = 0;
for (const row of plan) {
  const after = JSON.parse(JSON.stringify(row.aircraft_data));
  delete after.cgLimits;
  await api(`${TABLE}?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ aircraft_data: after }) });
  const [relu] = await api(`${TABLE}?id=eq.${row.id}&select=registration,aircraft_data`);
  if (relu?.aircraft_data?.cgLimits !== undefined) console.error(`  ✗ ${row.registration} : toujours présent`);
  else if (JSON.stringify(relu?.aircraft_data) !== JSON.stringify(after)) console.error(`  ⚠ ${row.registration} : la fiche relue diffère au-delà du champ visé`);
  else { console.log(`  ✓ ${row.registration}`); ok++; }
}
console.log(`\n${ok}/${plan.length} purgées.\n`);
