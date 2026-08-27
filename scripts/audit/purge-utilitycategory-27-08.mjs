// Purge du résidu utilityCategory sur F-GBTU (27/08) — --apply pour écrire.
//
// Rappel du motif : le bloc {mtow: 885, mlw: 885, enabled: false} avait déjà
// été supprimé par fix-gbtu-27-08.mjs (v8, 09:43), et il est REVENU à
// l'identique dès la sauvegarde suivante du pilote (v9, 10:05) — le journal
// aircraft_data._updateHistory de la v9 liste bien « utilityCategory » parmi
// les champs écrits. La copie ouverte dans l'application datait d'avant la
// purge : elle a été réenregistrée telle quelle. Même motif que le
// transpondeur (F-HDIM, F-GOVE) : une purge en base seule ne tient pas.
//
// Le filet est donc posé D'ABORD dans le code — stripBannedLegacyFields()
// (src/services/communityService.js) retire utilityCategory à l'écriture dès
// que enabled !== true, sur les trois chemins qui écrivent aircraft_data.
// Ce script ne fait que nettoyer le résidu déjà en base, une fois le filet en
// place ; il n'a plus vocation à être rejoué.
//
// Garde-fou : une catégorie utilitaire ACTIVE (enabled === true) est une vraie
// limitation de masse et de centrage — le script s'arrête plutôt que d'y
// toucher (c'est le cas de F-BXQT, 726 kg, qui n'est pas concerné ici).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Applicator/alflight';
const IMMAT = 'F-GBTU';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Config Supabase absente (.env)'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.${IMMAT}&select=id,registration,version,aircraft_data`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows) || rows.length !== 1) { console.error(`${IMMAT} : ${rows?.length} ligne(s) — abandon`); process.exit(1); }
const row = rows[0];
const d = JSON.parse(JSON.stringify(row.aircraft_data));
const chg = [];

const uc = d.utilityCategory;
if (uc === undefined) {
  console.log(`${IMMAT} (v${row.version}) — utilityCategory absent : rien à purger.`);
  process.exit(0);
}
if (uc && typeof uc === 'object' && uc.enabled === true) {
  console.error(`Garde-fou : ${IMMAT}.utilityCategory.enabled = true — catégorie ACTIVE, abandon`);
  process.exit(1);
}
chg.push(`utilityCategory ${JSON.stringify(uc)} supprimé (inerte : enabled !== true)`);
delete d.utilityCategory;

console.log(`\n${IMMAT} (v${row.version}) — ${chg.length} changement(s) :`);
for (const c of chg) console.log('  •', c);

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `purge-utilitycategory-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, `${IMMAT}.json`), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`✅ écrit (v${row.version + 1}) — sauvegarde : backups/purge-utilitycategory-${stamp}/${IMMAT}.json`);
} else {
  console.log('(lecture seule — relancer avec --apply pour écrire)');
}
