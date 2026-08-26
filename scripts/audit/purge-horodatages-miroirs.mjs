// scripts/audit/purge-horodatages-miroirs.mjs
//
// PURGE DES HORODATAGES MIROIRS — issue de la passe finale d'audit du 26/08.
// Constat (vérifié en flotte : F-GOVE, F-GNAM, F-GOFP, F-GUKQ, F-HSTR…) :
// aircraft_data.lastModified et aircraft_data._metadata.savedAt sont des
// estampilles LOCALES (IndexedDB — dataBackupManager/aircraftStore les posent
// à chaque écriture locale). Embarquées dans le JSON serveur, elles n'étaient
// JAMAIS rafraîchies par les chemins de sauvegarde (F-GOVE ré-enregistré le
// 26/08 portait toujours lastModified 2026-06-18) et contredisaient :
//   - row.updated_at (la vérité serveur, posée par updateCommunityPreset) ;
//   - des createdAt / extractionMetadata.lastModified INTERNES postérieurs.
// Décision (option b, fail-closed) : AUCUN lecteur applicatif ne lit ces
// champs côté serveur → on les PURGE de la base ; les écritures futures les
// strippent désormais à la source (stripBannedLegacyFields, communityService).
// La row updated_at fait foi.
//
// NB : le PATCH ne touche QUE aircraft_data — pas de trigger sur updated_at
// (vérifié : les purges des 24-25/08 n'ont pas bougé les updated_at).
//
// Sauvegarde INTÉGRALE de chaque ligne avant écriture ; relecture après ;
// contrôle « rien d'autre n'a bougé ».
// Usage : node scripts/audit/purge-horodatages-miroirs.mjs [--apply]
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

console.log(`\n${APPLY ? '⚠  MODE ÉCRITURE' : '🔍 SIMULATION'} — purge des horodatages miroirs (26/08)\n`);
const rows = await api(`${TABLE}?select=*&order=registration.asc`);
const plan = [];
for (const row of rows) {
  const d = row.aircraft_data || {};
  const actions = []; // { chemin: [..], was, why }

  if (d.lastModified !== undefined) {
    actions.push({
      chemin: ['lastModified'], was: d.lastModified,
      why: `estampille locale jamais rafraîchie au save — row.updated_at (${row.updated_at}) fait foi`
    });
  }
  if (d._metadata && typeof d._metadata === 'object' && d._metadata.savedAt !== undefined) {
    actions.push({
      chemin: ['_metadata', 'savedAt'], was: d._metadata.savedAt,
      why: 'estampille IndexedDB locale, souvent héritée d\'un autre poste — miroir trompeur'
    });
  }

  if (actions.length) plan.push({ row, actions });
}

for (const { row, actions } of plan) {
  console.log(`${String(row.registration).padEnd(9)} ${actions.length} champ(s)`);
  for (const a of actions) console.log(`   − ${a.chemin.join('.')} = ${a.was}  (${a.why})`);
}
console.log(`\n${plan.reduce((s, p) => s + p.actions.length, 0)} champs sur ${plan.length} fiches (${rows.length} lignes examinées).`);
if (!APPLY) { console.log('Relancer avec --apply pour écrire.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(ROOT, 'backups', `purge-horodatages-miroirs-${stamp}`);
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
  const [relu] = await api(`${TABLE}?id=eq.${row.id}&select=registration,aircraft_data,updated_at`);
  if (JSON.stringify(relu?.aircraft_data) !== JSON.stringify(after)) console.error(`   ⚠ ${row.registration} : la fiche relue diffère`);
  else if (relu.updated_at !== row.updated_at) console.error(`   ⚠ ${row.registration} : updated_at a bougé (${row.updated_at} → ${relu.updated_at}) — trigger inattendu ?`);
  else { console.log(`   ✓ ${row.registration}`); ok++; }
}
console.log(`\n${ok}/${plan.length} fiches purgées. Sauvegarde : ${dir}\n`);
