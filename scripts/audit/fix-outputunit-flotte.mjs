// Correction FLOTTE outputUnit (26/08) — LECTURE SEULE par défaut, --apply pour écrire.
// Les graphes primaires de plusieurs abaques déclarent outputUnit = « m »
// alors que TOUS leurs axes Y sont en « ft » (métadonnée d'import, réglage
// non exposé par l'atelier — constaté sur F-GNAM, F-GBTU, F-GIEA).
// Règle STRICTE : outputUnit passé à « ft » UNIQUEMENT quand le graphe
// primaire porte axes.yAxis.unit === 'ft'. Rien d'autre n'est touché
// (les titres d'axe restent tels quels). Sauvegarde par fiche modifiée.
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

let modifies = 0;
for (const row of rows) {
  const d = JSON.parse(JSON.stringify(row.aircraft_data));
  const corrections = [];
  for (const m of d.performanceModels || []) {
    const g = m.data?.graphs?.[0];
    if (g && g.outputUnit === 'm' && g.axes?.yAxis?.unit === 'ft') {
      g.outputUnit = 'ft';
      corrections.push(m.name || m.id);
    }
  }
  if (corrections.length === 0) continue;

  console.log(`\n${row.registration} (v${row.version}) — ${corrections.length} modèle(s) :`);
  for (const c of corrections) console.log('  •', String(c).slice(0, 80));

  if (APPLY) {
    const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-outputunit-${stamp}`);
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
console.log(`\n${modifies} avion(s) concerné(s)${APPLY ? ' — sauvegardes : backups/fix-outputunit-' + stamp + '/' : ' (lecture seule — relancer avec --apply)'}`);
