// Renommage des tables « 50 ft » mal étiquetées (26/08) — --apply pour écrire.
// F-BXQT tables[1] et F-BXNG tables[1] : table_name = « Take-off Ground Roll -
// Flaps UP », IDENTIQUE à la table de roulage voisine, alors que operationId =
// takeoff_50ft_flaps_up et que les valeurs sont bien celles du passage 15 m.
// (L'écran affiche l'opération — distincte — le champ table_name n'y est pas
// exposé.) Renommé « Take-off Distance over 50 ft - Flaps UP », calqué sur le
// libellé des tables d'atterrissage du même avion.
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

for (const reg of ['F-BXQT', 'F-BXNG']) {
  const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.${reg}&select=id,registration,version,aircraft_data`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })).json();
  if (!Array.isArray(rows) || rows.length !== 1) { console.error(`${reg} : ${rows?.length} ligne(s) — ignoré`); continue; }
  const row = rows[0];
  const d = JSON.parse(JSON.stringify(row.aircraft_data));
  let corrige = 0;
  for (const t of d.advancedPerformance?.tables || []) {
    if (t.operationId === 'takeoff_50ft_flaps_up' && /Ground Roll/i.test(t.table_name || '')) {
      console.log(`${reg} : « ${t.table_name} » → « Take-off Distance over 50 ft - Flaps UP »`);
      t.table_name = 'Take-off Distance over 50 ft - Flaps UP';
      corrige++;
    }
  }
  if (corrige === 0) { console.log(`${reg} (v${row.version}) — rien à renommer`); continue; }
  if (APPLY) {
    const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-noms-tables-${stamp}`);
    fs.mkdirSync(bakDir, { recursive: true });
    fs.writeFileSync(path.join(bakDir, `${reg}.json`), JSON.stringify(row, null, 1));
    const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
    });
    if (!r.ok) { console.error(`  ❌ PATCH ${r.status}`); continue; }
    console.log(`  ✅ ${reg} écrit (v${row.version + 1})`);
  }
}
console.log(APPLY ? `Sauvegardes : backups/fix-noms-tables-${stamp}/` : '(lecture seule — relancer avec --apply)');
