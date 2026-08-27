// Réparation F-GUKQ (26/08) — résidus non exposés par l'app. --apply pour écrire.
// 1. usableCapacity EXPLICITE sur les 2 réservoirs (109 et 50, valeurs des clés
//    legacy capacity, retirées ensuite) — la racine 160/159 est déjà cohérente.
// 2. cgEnvelope.categories supprimé : miroir « Normale » divergent (748 vs 750,
//    899,02 vs 900) d'une catégorie unique, utilityCategory.enabled = false —
//    les points racine font foi.
// 3. aircraft_data.version supprimé : miroir périmé (4 vs row 5) — la row fait foi.
// 4. Table takeoff_50ft_flaps_to renommée « Distance de décollage passage 15 m /
//    50 ft - Masse 900 kg » (elle disait « atterrissage » — le champ n'est pas
//    exposé à l'écran, même malentendu que F-BXQT-10).
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

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.F-GUKQ&select=id,registration,version,aircraft_data`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows) || rows.length !== 1) { console.error(`F-GUKQ : ${rows?.length} ligne(s) — abandon`); process.exit(1); }
const row = rows[0];
const d = JSON.parse(JSON.stringify(row.aircraft_data));
const chg = [];

const [t0, t1] = d.additionalFuelTanks || [];
if (t0 && t0.capacity == 109 && t0.usableCapacity == null) { t0.usableCapacity = 109; delete t0.capacity; chg.push('réservoir principal : usableCapacity=109 explicite, legacy retirée'); }
if (t1 && t1.capacity == 50 && t1.usableCapacity == null) { t1.usableCapacity = 50; delete t1.capacity; chg.push('réservoir optionnel : usableCapacity=50 explicite, legacy retirée'); }
if (d.cgEnvelope?.categories) { delete d.cgEnvelope.categories; chg.push('cgEnvelope.categories (miroir divergent) supprimé — points racine font foi'); }
if (d.version !== undefined) { chg.push(`aircraft_data.version=${d.version} (miroir périmé) supprimé`); delete d.version; }
for (const t of d.advancedPerformance?.tables || []) {
  if (t.operationId === 'takeoff_50ft_flaps_to' && /atterrissage/i.test(t.table_name || '')) {
    chg.push(`table renommée : « ${t.table_name} » → « Distance de décollage passage 15 m / 50 ft - Masse 900 kg »`);
    t.table_name = 'Distance de décollage passage 15 m / 50 ft - Masse 900 kg';
  }
}

console.log(`F-GUKQ (v${row.version}) — ${chg.length} changement(s) :`);
for (const c of chg) console.log('  •', c);
if (chg.length === 0) process.exit(0);

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-gukq-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, 'F-GUKQ.json'), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`✅ écrit (v${row.version + 1}) — sauvegarde : backups/fix-gukq-${stamp}/F-GUKQ.json`);
} else {
  console.log('(lecture seule — relancer avec --apply pour écrire)');
}
