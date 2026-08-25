// scripts/audit/purge-complements.mjs
//
// PURGE COMPLÉMENTAIRE issue du check-up du 25/08 — écriture en base.
// Quatre cibles, toutes démontrées sur pièces :
//   1. F-GGZO : maxBaggageWeight/maxAuxiliaryWeight REVENUS le 24/08 à 15h10
//      (réinjection par le cache local via deepMergeKeepExisting, AVANT les
//      correctifs du soir) — on repasse la purge du matin ;
//   2. F-GUVV : le champ legacy capacity=147,63 est devenu purgeable — le
//      pilote a saisi totalCapacity=113 / usableCapacity=106 le 24/08 15h08 ;
//   3. miroir weightBalance.cgLimits retiré des fiches à ENVELOPPE COMPLÈTE
//      (le calcul et tous les lecteurs préfèrent l'enveloppe depuis le 24/08 ;
//      3 fiches divergent : F-GOFP forward=0 fabriqué, F-HSTR aft 2,59 vs
//      2,53, F-HFGI point divergent) ;
//   4. minTakeoffWeight racine = 600 « sec » (ni saisi, ni égal à la masse à
//      vide) : F-GGZO et F-GIEA — le 600 est le défaut codé en dur, supprimé
//      du code le 24/08. Les racines « = masse à vide » (dérivation vraie) et
//      les valeurs saisies dans weights.* ne sont PAS touchées.
//
// Sauvegarde INTÉGRALE de chaque ligne avant écriture ; relecture après ;
// contrôle « rien d'autre n'a bougé ».
// Usage : node scripts/audit/purge-complements.mjs [--apply]
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

console.log(`\n${APPLY ? '⚠  MODE ÉCRITURE' : '🔍 SIMULATION'} — purge complémentaire du 25/08\n`);
const rows = await api(`${TABLE}?select=*&order=registration.asc`);
const plan = [];
for (const row of rows) {
  const d = row.aircraft_data || {};
  const reg = row.registration;
  const actions = []; // { chemin: [..], was, why }

  // 1. F-GGZO : champs revenus.
  if (reg === 'F-GGZO') {
    for (const k of ['maxBaggageWeight', 'maxAuxiliaryWeight']) {
      if (d[k] !== undefined) actions.push({ chemin: [k], was: d[k], why: 'réinjecté par le cache local le 24/08 15h10 — repasse de la purge' });
    }
  }

  // 2. F-GUVV : capacity legacy devenu doublon mort.
  if (reg === 'F-GUVV') {
    (d.additionalFuelTanks || []).forEach((t, i) => {
      if (t.capacity !== undefined && num(t.usableCapacity) !== null && num(t.totalCapacity) !== null) {
        actions.push({ chemin: ['additionalFuelTanks', i, 'capacity'], was: t.capacity, why: `les deux volumes sont désormais saisis (${t.totalCapacity}/${t.usableCapacity}) — legacy mort` });
      }
    });
  }

  // 3. Miroir weightBalance.cgLimits : retiré si l'enveloppe est complète.
  const envOk = Array.isArray(d.cgEnvelope?.forwardPoints) && d.cgEnvelope.forwardPoints.length > 0
    && (num(d.cgEnvelope?.aftCG) !== null || (Array.isArray(d.cgEnvelope?.aftPoints) && d.cgEnvelope.aftPoints.length > 0));
  if (d.weightBalance?.cgLimits !== undefined) {
    if (envOk) actions.push({ chemin: ['weightBalance', 'cgLimits'], was: JSON.stringify(d.weightBalance.cgLimits).slice(0, 60), why: 'miroir de 2e niveau — l\'enveloppe complète fait foi (lecteurs alignés le 24/08)' });
    else console.log(`  ⛔ GARDÉ  ${reg} weightBalance.cgLimits — pas d'enveloppe complète`);
  }

  // 4. minTakeoffWeight racine 600 « sec ».
  if (num(d.minTakeoffWeight) === 600 && num(d.emptyWeight) !== 600 && num(d.weights?.minTakeoffWeight) !== 600) {
    actions.push({ chemin: ['minTakeoffWeight'], was: 600, why: 'défaut 600 codé en dur (supprimé du code le 24/08), ni saisi ni dérivé' });
  }

  if (actions.length) plan.push({ row, actions });
}

for (const { row, actions } of plan) {
  console.log(`${String(row.registration).padEnd(9)} ${actions.length} champ(s)`);
  for (const a of actions) console.log(`   − ${a.chemin.join('.')} = ${a.was}  (${a.why})`);
}
console.log(`\n${plan.reduce((s, p) => s + p.actions.length, 0)} champs sur ${plan.length} fiches.`);
if (!APPLY) { console.log('Relancer avec --apply pour écrire.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(ROOT, 'backups', `purge-complements-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
for (const { row } of plan) fs.writeFileSync(path.join(dir, `${row.registration}.json`), JSON.stringify(row, null, 2));
console.log(`💾 Sauvegarde : ${dir}`);
const supprime = (obj, chemin) => {
  let cur = obj;
  for (let i = 0; i < chemin.length - 1; i++) cur = cur?.[chemin[i]];
  if (cur) delete cur[chemin[chemin.length - 1]];
};
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
console.log(`\n${ok}/${plan.length} fiches purgées. Sauvegarde : ${dir}\n`);
