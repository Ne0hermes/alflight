// Purge des scories du 26/08 — LECTURE SEULE par défaut, écrit avec --apply.
// 1. F-HDIM : bypassedFields -= 'registration' (conflit d'immatriculation réglé,
//    réponse à la question du pilote sur F-HDIM-16) ; transponderModes réparé
//    (la chaîne legacy « A,C » a été éclatée caractère par caractère puis
//    fusionnée avec la nouvelle sélection → ["A",",","C","a","c"]) → ["a","c"].
// 2. F-GUKQ : bypassedFields -= 'weighingReport', 'fuelTankArms' (bypass hérités
//    non-performance, sans objet depuis les corrections).
// Sauvegarde complète des deux fiches avant écriture (backups/).
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

const get = async (qs) => {
  const r = await fetch(`${URL_}/rest/v1/${qs}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`GET ${r.status}`);
  return r.json();
};
const patch = async (id, body) => {
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`);
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bakDir = path.join(ROOT, 'scripts/audit/backups', `purge-scories-${stamp}`);

const CIBLES = {
  'F-HDIM': (d) => {
    const avant = { bypassedFields: d.bypassedFields, transponderModes: d.equipmentSurv?.transponderModes };
    d.bypassedFields = (d.bypassedFields || []).filter((b) => b !== 'registration');
    if (d.equipmentSurv) d.equipmentSurv.transponderModes = ['a', 'c'];
    return { avant, apres: { bypassedFields: d.bypassedFields, transponderModes: d.equipmentSurv?.transponderModes } };
  },
  'F-GUKQ': (d) => {
    const avant = { bypassedFields: d.bypassedFields };
    d.bypassedFields = (d.bypassedFields || []).filter((b) => b !== 'weighingReport' && b !== 'fuelTankArms');
    return { avant, apres: { bypassedFields: d.bypassedFields } };
  },
};

for (const [reg, fix] of Object.entries(CIBLES)) {
  const rows = await get(`community_presets?registration=eq.${reg}&select=id,registration,version,aircraft_data`);
  if (rows.length !== 1) { console.error(`${reg} : ${rows.length} ligne(s) — abandon`); continue; }
  const row = rows[0];
  const d = JSON.parse(JSON.stringify(row.aircraft_data));
  const diff = fix(d);
  console.log(`\n${reg} (v${row.version})`);
  console.log('  avant :', JSON.stringify(diff.avant));
  console.log('  après :', JSON.stringify(diff.apres));
  if (APPLY) {
    fs.mkdirSync(bakDir, { recursive: true });
    fs.writeFileSync(path.join(bakDir, `${reg}.json`), JSON.stringify(row, null, 1));
    await patch(row.id, { aircraft_data: d, version: row.version + 1 });
    console.log(`  ✅ écrit (v${row.version + 1}) — sauvegarde : backups/purge-scories-${stamp}/${reg}.json`);
  } else {
    console.log('  (lecture seule — relancer avec --apply pour écrire)');
  }
}
