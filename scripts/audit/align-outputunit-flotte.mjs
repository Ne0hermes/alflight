// Alignement de outputUnit sur l'axe de sortie (27/08) — --apply pour écrire.
//
// L'atelier estampille outputUnit sur le panneau primaire depuis le DÉFAUT du
// catalogue dès que l'opération n'accepte qu'une seule sortie (plancheSetup.ts,
// GraphIdentityPanel.tsx). Quand le pilote gradue ensuite l'axe de sortie dans
// l'autre unité — le cas des planches d'atterrissage, lues en « ft » alors que
// le défaut de la variable est « m » — la fiche se retrouve avec deux unités
// contradictoires pour une même distance.
//
// Le moteur n'a jamais été trompé : il prend l'unité de l'axe RÉELLEMENT lu
// (cascade.ts:1564-1568). Mais la contradiction déclenche désormais un
// avertissement (garde d'unité étendue le 27/08 dans operationResolver.js), et
// surtout elle est un piège : si la lecture repassait sur un axe sans unité, le
// repli sur l'estampille étiquetterait la valeur dans la mauvaise unité.
//
// Ce script réaligne l'estampille sur l'axe de sortie, partout où elles
// divergent. Il ne touche JAMAIS aux axes ni aux courbes.
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
if (!Array.isArray(rows)) { console.error('Lecture impossible — abandon'); process.exit(1); }

let total = 0;
for (const row of rows) {
  const d = JSON.parse(JSON.stringify(row.aircraft_data));
  const chg = [];
  for (const m of d.performanceModels || []) {
    const gs = m.data?.graphs || [];
    if (gs.length === 0) continue;
    const dernier = gs[gs.length - 1];
    const uniteAxe = dernier.readoutAxis === 'x'
      ? dernier.axes?.xAxis?.unit
      : dernier.axes?.yAxis?.unit;
    if (!uniteAxe) continue;                       // axe muet : rien à aligner
    const estampille = gs[0].outputUnit;
    if (!estampille || estampille === uniteAxe) continue;
    chg.push(`« ${m.name} » : outputUnit « ${estampille} » → « ${uniteAxe} » (axe de sortie, lecture sur ${dernier.readoutAxis === 'x' ? 'X' : 'Y'})`);
    gs[0].outputUnit = uniteAxe;
  }
  if (chg.length === 0) continue;
  total += chg.length;
  console.log(`${row.registration} (v${row.version}) — ${chg.length} modèle(s) :`);
  for (const c of chg) console.log('   •', c);
  if (!APPLY) continue;
  const bakDir = path.join(ROOT, 'scripts/audit/backups', `align-outputunit-${stamp}`);
  fs.mkdirSync(bakDir, { recursive: true });
  fs.writeFileSync(path.join(bakDir, `${row.registration}.json`), JSON.stringify(row, null, 1));
  const r = await fetch(`${URL_}/rest/v1/community_presets?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: d, version: row.version + 1 }),
  });
  if (!r.ok) { console.error(`   ❌ PATCH ${r.status} — ${(await r.text()).slice(0, 160)}`); continue; }
  console.log(`   ✅ écrit (v${row.version + 1})`);
}

console.log(total === 0
  ? 'Aucune divergence — rien à aligner.'
  : (APPLY ? `\n${total} modèle(s) alignés — sauvegardes : backups/align-outputunit-${stamp}/` : '\n(lecture seule — relancer avec --apply pour écrire)'));
