// Réparation F-GIEA + F-GBTU (26/08) — LECTURE SEULE par défaut, --apply pour écrire.
// 1. F-GIEA : réservoir principal — usableCapacity = 182 EXPLICITE et clé
//    legacy capacity retirée (motif F-GGZO-04/F-HDIM-17 ; total 189 inchangé).
// 2. F-GIEA + F-GBTU : titres d'axe Y « altitude » sur les modèles de DISTANCE
//    (réglage non exposé par l'atelier — même famille que outputUnit) :
//    « passage 15 m » → takeoff_distance_50ft ; « sol/roulage » →
//    takeoff_distance_ground (calqué sur le modèle 0 de chaque avion, déjà
//    correct). metadata.sharedY.title « altitude » aligné pareil.
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

const titreDepuisNom = (nom) => {
  if (/passage\s*15\s*m/i.test(nom)) return 'takeoff_distance_50ft';
  if (/sol|roulage|ground/i.test(nom)) return 'takeoff_distance_ground';
  return null;
};

for (const reg of ['F-GIEA', 'F-GBTU']) {
  const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.${reg}&select=id,registration,version,aircraft_data`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })).json();
  if (!Array.isArray(rows) || rows.length !== 1) { console.error(`${reg} : ${rows?.length} ligne(s) — ignoré`); continue; }
  const row = rows[0];
  const d = JSON.parse(JSON.stringify(row.aircraft_data));
  const changements = [];

  if (reg === 'F-GIEA') {
    const t0 = (d.additionalFuelTanks || [])[0];
    if (t0 && t0.totalCapacity == 189 && t0.usableCapacity == null) {
      t0.usableCapacity = 182;
      delete t0.capacity;
      changements.push('réservoir principal : usableCapacity=182 explicite, legacy capacity retirée');
    }
  }

  for (const m of d.performanceModels || []) {
    const titre = titreDepuisNom(m.name || '');
    if (!titre) continue;
    for (const g of m.data?.graphs || []) {
      if (g.axes?.yAxis?.title === 'altitude') {
        g.axes.yAxis.title = titre;
        changements.push(`« ${String(m.name).slice(0, 50)} » : titre Y altitude → ${titre}`);
      }
    }
    const sy = m.data?.metadata?.sharedY;
    if (sy && sy.title === 'altitude') {
      sy.title = titre;
      changements.push(`« ${String(m.name).slice(0, 50)} » : sharedY.title → ${titre}`);
    }
  }

  if (changements.length === 0) { console.log(`\n${reg} (v${row.version}) — rien à changer`); continue; }
  console.log(`\n${reg} (v${row.version}) — ${changements.length} changement(s) :`);
  for (const c of changements) console.log('  •', c);

  if (APPLY) {
    const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-titres-${stamp}`);
    fs.mkdirSync(bakDir, { recursive: true });
    fs.writeFileSync(path.join(bakDir, `${reg}.json`), JSON.stringify(row, null, 1));
    const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
    });
    if (!r.ok) { console.error(`  ❌ PATCH ${r.status}`); continue; }
    console.log(`  ✅ écrit (v${row.version + 1}) — sauvegarde : backups/fix-titres-${stamp}/${reg}.json`);
  } else {
    console.log('  (lecture seule — relancer avec --apply pour écrire)');
  }
}
