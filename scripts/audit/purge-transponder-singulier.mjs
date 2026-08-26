// Migration FLOTTE du transpondeur (26/08) — LECTURE SEULE par défaut, --apply pour écrire.
// Le champ legacy equipmentSurv.transponderMode (singulier, chaîne « C »/« S »/« A,C »)
// n'est écrit par aucun écran moderne (l'étape Équipements écrit transponderModes,
// tableau minuscule) et a déjà produit deux corruptions (F-HDIM, F-GOVE).
// Pour CHAQUE avion : le singulier est MIGRÉ vers le pluriel (split(','),
// minuscules, dédup, fusion avec l'existant) puis SUPPRIMÉ. Aucune information
// perdue. Sauvegarde complète de chaque fiche modifiée avant écriture.
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
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?select=id,registration,version,aircraft_data&order=registration.asc`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();

const MODES_VALIDES = new Set(['a', 'c', 's']);
let modifies = 0;
for (const row of rows) {
  const d = JSON.parse(JSON.stringify(row.aircraft_data));
  const surv = d.equipmentSurv;
  if (!surv || surv.transponderMode == null) continue;

  const singulier = String(surv.transponderMode);
  const herites = singulier.split(',').map((m) => m.trim().toLowerCase()).filter((m) => MODES_VALIDES.has(m));
  const existants = Array.isArray(surv.transponderModes)
    ? surv.transponderModes.map((m) => String(m).trim().toLowerCase()).filter((m) => MODES_VALIDES.has(m))
    : (typeof surv.transponderModes === 'string'
      ? surv.transponderModes.split(',').map((m) => m.trim().toLowerCase()).filter((m) => MODES_VALIDES.has(m))
      : []);
  const fusion = [...new Set([...existants, ...herites])].sort();
  const avant = { transponderMode: surv.transponderMode, transponderModes: surv.transponderModes };
  surv.transponderModes = fusion;
  delete surv.transponderMode;

  console.log(`\n${row.registration} (v${row.version})`);
  console.log('  avant :', JSON.stringify(avant));
  console.log('  après :', JSON.stringify({ transponderModes: surv.transponderModes }));

  if (APPLY) {
    const bakDir = path.join(ROOT, 'scripts/audit/backups', `purge-transponder-${stamp}`);
    fs.mkdirSync(bakDir, { recursive: true });
    fs.writeFileSync(path.join(bakDir, `${row.registration}.json`), JSON.stringify(row, null, 1));
    const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
    });
    if (!r.ok) { console.error(`  ❌ PATCH ${r.status}`); continue; }
    console.log(`  ✅ écrit (v${row.version + 1})`);
  }
  modifies++;
}
console.log(`\n${modifies} avion(s) concerné(s)${APPLY ? ' — sauvegardes : backups/purge-transponder-' + stamp + '/' : ' (lecture seule — relancer avec --apply)'}`);
