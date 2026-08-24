// scripts/audit/purge-bras-fantomes.mjs
//
// PURGE DES BRAS DE LEVIER FANTÔMES — écriture en base.
// Règle pilote du 24/08 (« rien, aucun fallback ») ; le code qui les
// fabriquait a été corrigé le même jour (normaliseur, contexte, formulaire
// legacy, pick du wizard) : la base peut enfin être nettoyée sans re-salissure.
//
// CE QUI EST PURGÉ, champ par champ :
//   • tout BRAS égal à 0 dans weightBalance.* / arms.* — un bras nul place la
//     charge au point de référence : aucun avion réel n'a ça, c'est toujours
//     un zéro fabriqué (12 fiches sur 13 en portent) ;
//   • sur F-GUVV uniquement : les 3,50 / 3,70 de soute (weightBalance.baggageArm,
//     auxiliaryArm, arms.baggageFwd, arms.baggageAft) — valeurs codées en dur,
//     réfutées par la fiche de pesée (unique compartiment réel : 3,65 m, déjà
//     dans baggageCompartments).
//
// JAMAIS TOUCHÉ : un bras non nul ≠ 3,50/3,70-GUVV (donnée réelle possible),
// les compartiments (baggageCompartments — la vraie source), tout autre champ.
//
// Sauvegarde INTÉGRALE de chaque ligne avant écriture ; relecture après ;
// contrôle « rien d'autre n'a bougé ».
// Usage : node scripts/audit/purge-bras-fantomes.mjs [--apply]
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

// Les clés de bras candidates, par conteneur.
const WB_ARMS = ['emptyWeightArm', 'fuelArm', 'frontLeftSeatArm', 'frontRightSeatArm',
  'rearLeftSeatArm', 'rearRightSeatArm', 'baggageArm', 'auxiliaryArm'];
const ARMS_KEYS = ['empty', 'fuelMain', 'frontSeats', 'rearSeats', 'baggageFwd', 'baggageAft'];
// Les 3,50/3,70 fabriqués : uniquement les clés de SOUTE, uniquement F-GUVV.
const GUVV_FAKES = { baggageArm: 3.5, auxiliaryArm: 3.7, baggageFwd: 3.5, baggageAft: 3.7 };

console.log(`\n${APPLY ? '⚠  MODE ÉCRITURE' : '🔍 SIMULATION'} — purge des bras fantômes\n`);
const rows = await api(`${TABLE}?select=*&order=registration.asc`);
const plan = [];
for (const row of rows) {
  const d = row.aircraft_data || {};
  const actions = [];
  const scan = (conteneur, nomConteneur, cles) => {
    if (!d[conteneur]) return;
    for (const k of cles) {
      const v = num(d[conteneur][k]);
      if (v === null) continue;
      if (v === 0) actions.push({ conteneur, k, was: d[conteneur][k], why: 'zéro fabriqué' });
      else if (row.registration === 'F-GUVV' && GUVV_FAKES[k] !== undefined && v === GUVV_FAKES[k]) {
        actions.push({ conteneur, k, was: v, why: 'valeur codée en dur, réfutée par la fiche de pesée (compartiment réel : 3,65 m)' });
      }
    }
  };
  scan('weightBalance', 'weightBalance', WB_ARMS);
  scan('arms', 'arms', ARMS_KEYS);
  if (actions.length) plan.push({ row, actions });
}
for (const { row, actions } of plan) {
  console.log(`${String(row.registration).padEnd(9)} ${actions.length} bras`);
  for (const a of actions) console.log(`   − ${a.conteneur}.${a.k} = ${a.was}  (${a.why})`);
}
console.log(`\n${plan.reduce((s, p) => s + p.actions.length, 0)} champs sur ${plan.length} fiches.`);
if (!APPLY) { console.log('Relancer avec --apply pour écrire.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(ROOT, 'backups', `purge-bras-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
for (const { row } of plan) fs.writeFileSync(path.join(dir, `${row.registration}.json`), JSON.stringify(row, null, 2));
console.log(`💾 Sauvegarde : ${dir}`);
let ok = 0;
for (const { row, actions } of plan) {
  const after = JSON.parse(JSON.stringify(row.aircraft_data));
  for (const a of actions) delete after[a.conteneur][a.k];
  // Garde-fou : seules les clés visées diffèrent.
  const temoin = JSON.parse(JSON.stringify(row.aircraft_data));
  for (const a of actions) delete temoin[a.conteneur][a.k];
  if (JSON.stringify(temoin) !== JSON.stringify(after)) { console.error(`   ✗ ${row.registration} : écart imprévu — IGNORÉE`); continue; }
  await api(`${TABLE}?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ aircraft_data: after }) });
  const [relu] = await api(`${TABLE}?id=eq.${row.id}&select=registration,aircraft_data`);
  const restes = actions.filter((a) => relu?.aircraft_data?.[a.conteneur]?.[a.k] !== undefined);
  if (restes.length) console.error(`   ✗ ${row.registration} : ${restes.length} champ(s) encore présents`);
  else if (JSON.stringify(relu?.aircraft_data) !== JSON.stringify(after)) console.error(`   ⚠ ${row.registration} : la fiche relue diffère au-delà des champs visés`);
  else { console.log(`   ✓ ${row.registration}`); ok++; }
}
console.log(`\n${ok}/${plan.length} fiches purgées. Sauvegarde : ${dir}\n`);
