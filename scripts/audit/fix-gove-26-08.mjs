// Réparation F-GOVE (26/08) — LECTURE SEULE par défaut, écrit avec --apply.
// 1. transponderModes ["S","s"] → ["s"] : l'écran Équipements a fusionné la
//    chaîne héritée « S » avec la nouvelle sélection (même bug que F-HDIM,
//    correctif du code en chip).
// 2. bypassedFields -= 'speeds.vsTO' : la valeur 48 kt est saisie ET confirmée
//    au manuel par le pilote (rapport 26/08) — le contournement hérité
//    contredit la saisie et aucun écran ne permet de le retirer.
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

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.F-GOVE&select=id,registration,version,aircraft_data`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows) || rows.length !== 1) { console.error(`F-GOVE : ${rows?.length} ligne(s) — abandon`); process.exit(1); }
const row = rows[0];
const d = JSON.parse(JSON.stringify(row.aircraft_data));

const avant = { transponderModes: d.equipmentSurv?.transponderModes, bypassedFields: d.bypassedFields };
if (d.equipmentSurv) d.equipmentSurv.transponderModes = ['s'];
d.bypassedFields = (d.bypassedFields || []).filter((b) => b !== 'speeds.vsTO');
const apres = { transponderModes: d.equipmentSurv?.transponderModes, bypassedFields: d.bypassedFields };

console.log(`F-GOVE (v${row.version})`);
console.log('  avant :', JSON.stringify(avant));
console.log('  après :', JSON.stringify(apres));

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-gove-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, 'F-GOVE.json'), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`  ✅ écrit (v${row.version + 1}) — sauvegarde : backups/fix-gove-${stamp}/F-GOVE.json`);
} else {
  console.log('  (lecture seule — relancer avec --apply pour écrire)');
}
