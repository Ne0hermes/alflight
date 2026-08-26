// Réparation F-GGZO (26/08) — LECTURE SEULE par défaut, --apply pour écrire.
// Valeurs confirmées par le pilote (rapport 26/08) : configs 163/152 et 204/189.
// 1. Réservoir Standard : usableCapacity = 152 EXPLICITE (absent — l'accesseur
//    retombait sur la clé legacy capacity) et clé legacy capacity retirée
//    (même motif que F-GBTU-04/F-HDIM-17).
// 2. Réservoir Long Range : champ legacy type = "optional" SUPPRIMÉ — il est
//    FAUX (« il est en inamovible », rapport pilote) : le rôle fait foi
//    (role = "fixed" dans la Variante 204L, système de rôles du 24/08).
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

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.F-GGZO&select=id,registration,version,aircraft_data`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows) || rows.length !== 1) { console.error(`F-GGZO : ${rows?.length} ligne(s) — abandon`); process.exit(1); }
const row = rows[0];
const d = JSON.parse(JSON.stringify(row.aircraft_data));
const tanks = d.additionalFuelTanks || [];
const t0 = tanks.find((t) => /standard/i.test(t.name || ''));
const t1 = tanks.find((t) => /long\s*range/i.test(t.name || ''));
if (!t0 || !t1) { console.error('Réservoirs Standard/Long Range introuvables — abandon'); process.exit(1); }
if (t0.totalCapacity != 163) { console.error(`Garde-fou : tank Standard totalCapacity=${t0.totalCapacity} ≠ 163 — abandon`); process.exit(1); }

const avant = { t0: { capacity: t0.capacity, total: t0.totalCapacity, usable: t0.usableCapacity }, t1_type: t1.type };
t0.usableCapacity = 152;
delete t0.capacity;
delete t1.type;
const apres = { t0: { total: t0.totalCapacity, usable: t0.usableCapacity }, t1_type: t1.type };

console.log(`F-GGZO (v${row.version})`);
console.log('  avant :', JSON.stringify(avant));
console.log('  après :', JSON.stringify(apres), '(rôle du Long Range : "fixed" dans la Variante 204L, inchangé — il fait foi)');

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-ggzo-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, 'F-GGZO.json'), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`  ✅ écrit (v${row.version + 1}) — sauvegarde : backups/fix-ggzo-${stamp}/F-GGZO.json`);
} else {
  console.log('  (lecture seule — relancer avec --apply pour écrire)');
}
