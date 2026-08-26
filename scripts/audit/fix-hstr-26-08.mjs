// Réparation F-HSTR (26/08) — LECTURE SEULE par défaut, écrit avec --apply.
// Deux MIROIRS CACHÉS qu'aucun écran ne permet de corriger :
// 1. minTakeoffWeight racine = 650 kg (< masse à vide 900 !) alors que
//    weights.minTakeoffWeight = 940 = cgEnvelope — la racine est SUPPRIMÉE :
//    l'app la dérive de weights au chargement (AircraftProvider), la borne
//    940 fait foi. (Réponse au point F-HSTR-03 du pilote.)
// 2. equipmentSurv.transponderMode « S » (singulier legacy) supprimé — le
//    pluriel transponderModes ["s","c"] écrit par l'écran Équipements fait foi.
// Sauvegarde complète de la fiche avant écriture (backups/).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Applicator/alflight';
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Config Supabase absente (.env)'); process.exit(1); }
const APPLY = process.argv.includes('--apply');

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.F-HSTR&select=id,registration,version,aircraft_data`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows) || rows.length !== 1) { console.error(`F-HSTR : ${rows?.length} ligne(s) — abandon`); process.exit(1); }
const row = rows[0];
const d = JSON.parse(JSON.stringify(row.aircraft_data));

const avant = { minTakeoffWeight: d.minTakeoffWeight, transponderMode: d.equipmentSurv?.transponderMode };
delete d.minTakeoffWeight;
if (d.equipmentSurv) delete d.equipmentSurv.transponderMode;
const apres = { minTakeoffWeight: d.minTakeoffWeight, transponderMode: d.equipmentSurv?.transponderMode };

console.log(`F-HSTR (v${row.version})`);
console.log('  avant :', JSON.stringify(avant));
console.log('  après :', JSON.stringify(apres), '(clés supprimées — weights.minTakeoffWeight=940 et transponderModes ["s","c"] font foi)');

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-hstr-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, 'F-HSTR.json'), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`  ✅ écrit (v${row.version + 1}) — sauvegarde : backups/fix-hstr-${stamp}/F-HSTR.json`);
} else {
  console.log('  (lecture seule — relancer avec --apply pour écrire)');
}
