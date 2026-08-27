// Réparation F-GBTU (27/08) — --apply pour écrire.
//
// 1. MASSE À VIDE : la fiche est passée de 690 à 700 kg entre la v5 (26/08
//    12:01) et la v7 (27/08 09:34), très probablement en actant le point
//    F-GBTU-11 qui demandait « une seule borne basse, 700 kg » — mais qui
//    visait les miroirs de minTakeoffWeight, PAS la masse à vide.
//    Le rapport de pesée de l'appareil (Étampes, 01/03/2018, PDF joint à la
//    fiche, lu le 27/08) est formel : masse lue 243 + 247 + 200 = 690 kg,
//    ligne « Résultats » 690,000 kg / bras 2,198 m / moment 1516,340.
//    On restaure donc 690, ainsi que le moment recalculé par l'application
//    (1538,60 = 700 × 2,198 → 1516,62 = 690 × 2,198, valeur d'origine).
//    Les trois bornes basses gardent chacune son sens : masse à vide 690,
//    racine minTakeoffWeight 690 (= masse à vide, doctrine « coller au visuel
//    de la fiche de pesée »), cgEnvelope.aftMinWeight 700 (début de
//    l'enveloppe du manuel). Aucune n'est un miroir de l'autre.
//
// 2. CATÉGORIE UTILITAIRE : le pilote la déclare retirée (« la cat utilitaire
//    n'est plus utilisée, elle est même retirée il me semble »), mais le bloc
//    utilityCategory {mtow: 885, mlw: 885, enabled: false} subsiste en base,
//    avec 885 recopié du point de cassure de l'enveloppe avant. Le bloc est
//    inerte (tous les accès du code passent par utilityCategory?.enabled) :
//    on le supprime pour que la base dise ce que le pilote croit vrai.
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

const rows = await (await fetch(`${URL_}/rest/v1/community_presets?registration=eq.F-GBTU&select=id,registration,version,aircraft_data`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})).json();
if (!Array.isArray(rows) || rows.length !== 1) { console.error(`F-GBTU : ${rows?.length} ligne(s) — abandon`); process.exit(1); }
const row = rows[0];
const d = JSON.parse(JSON.stringify(row.aircraft_data));
const chg = [];

// — Garde-fous : on n'écrit que sur l'état exact constaté le 27/08 —
if (d.arms?.empty !== 2.198) { console.error(`Garde-fou : arms.empty = ${d.arms?.empty}, attendu 2.198 — abandon`); process.exit(1); }

if (d.emptyWeight === 700) { d.emptyWeight = 690; chg.push('emptyWeight 700 → 690 (rapport de pesée du 01/03/2018)'); }
else console.log(`  ⓘ emptyWeight = ${d.emptyWeight} (pas 700) — laissé tel quel`);

if (d.weights?.emptyWeight === 700) { d.weights.emptyWeight = 690; chg.push('weights.emptyWeight 700 → 690'); }
else console.log(`  ⓘ weights.emptyWeight = ${d.weights?.emptyWeight} (pas 700) — laissé tel quel`);

if (d.moments?.empty === 1538.6) { d.moments.empty = 1516.62; chg.push('moments.empty 1538,60 → 1516,62 (= 690 × 2,198)'); }
else console.log(`  ⓘ moments.empty = ${d.moments?.empty} (pas 1538.6) — laissé tel quel`);

if (d.utilityCategory) {
  if (d.utilityCategory.enabled === true) { console.error('Garde-fou : utilityCategory.enabled = true — catégorie ACTIVE, abandon'); process.exit(1); }
  chg.push(`utilityCategory ${JSON.stringify(d.utilityCategory)} supprimé (déclarée retirée par le pilote, bloc inerte)`);
  delete d.utilityCategory;
}

console.log(`\nF-GBTU (v${row.version}) — ${chg.length} changement(s) :`);
for (const c of chg) console.log('  •', c);
if (chg.length === 0) process.exit(0);

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `fix-gbtu-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, 'F-GBTU.json'), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`PATCH ${r.status} — ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  console.log(`✅ écrit (v${row.version + 1}) — sauvegarde : backups/fix-gbtu-${stamp}/F-GBTU.json`);
} else {
  console.log('(lecture seule — relancer avec --apply pour écrire)');
}
