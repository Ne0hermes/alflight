// scripts/fix-fgnam-flapsto-y-m-mass-mirror.js
//
// R18 (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md §26) — Répare le modèle
// « Distance décollage — passage 15 m, Flaps TAKEOFF » de F-GNAM :
//
//   1. AXE Y EN MÈTRES : l'axe a été calibré sur l'échelle MÈTRES du papier
//      (graduations 300 → 1000) mais déclaré « ft ». Les VALEURS sont bonnes
//      (ce sont des mètres) — seule l'étiquette d'unité est corrigée :
//      yAxis.unit = 'm' sur les 3 graphes + workshop.sharedY.unit = 'm'
//      + outputUnit du primaire si 'ft'.
//
//   2. PANNEAU MASSE EN MIROIR (même piège que le modèle volets 0°, §19) :
//      axe papier ~1150 kg (gauche) → ~950 (droite) déclaré [950..1150] non
//      inversé → miroir x' = (min+max) − x sur points + fitted, retri par x,
//      xAxis.reversed = true (rendu sur l'image inchangé).
//
// Validation rejouée AVANT écriture : 21 °C / PA 2000 / 1089 kg / face 15 kt
// → 551 m pour 567 m papier (−2,8 %).
//
// Usage :
//   node scripts/fix-fgnam-flapsto-y-m-mass-mirror.js            (dry-run)
//   node scripts/fix-fgnam-flapsto-y-m-mass-mirror.js --confirm  (écrit)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repairSrc = fs.readFileSync(path.join(__dirname, 'repair-dead-manex-links.js'), 'utf8');
const SUPABASE_URL = repairSrc.match(/SUPABASE_URL = '([^']+)'/)[1];
const SUPABASE_ANON_KEY = repairSrc.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];

const PRESET_ID = '513e9ccc-6cc7-4e68-a262-e0c2152aeb29'; // F-GNAM
const SYSTEM_TYPE = 'takeoff_50ft_flaps_to';

const CONFIRM = process.argv.includes('--confirm');

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

(async () => {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/community_presets?id=eq.${PRESET_ID}&select=registration,aircraft_data`,
    { headers }
  );
  const [row] = await r.json();
  if (!row) throw new Error('Preset F-GNAM introuvable');

  const models = row.aircraft_data.performanceModels || [];
  const model = models.find(m => m?.data?.metadata?.systemType === SYSTEM_TYPE);
  if (!model) throw new Error(`Modèle ${SYSTEM_TYPE} introuvable`);

  console.log(`Avion ${row.registration} · modèle « ${model.name} »`);

  // ── 1. Unité Y : ft → m (valeurs inchangées, elles SONT des mètres) ──
  let unitFixes = 0;
  for (const g of model.data.graphs) {
    if (g.axes?.yAxis?.unit === 'ft') { g.axes.yAxis.unit = 'm'; unitFixes++; }
    if ((g.role || 'primary') === 'primary' && g.outputUnit === 'ft') { g.outputUnit = 'm'; unitFixes++; }
  }
  const ws = model.data.metadata?.workshop;
  if (ws?.sharedY?.unit === 'ft') { ws.sharedY.unit = 'm'; unitFixes++; }
  console.log(`Unité Y : ${unitFixes} étiquette(s) ft → m (échelle [${ws?.sharedY?.min}..${ws?.sharedY?.max}] = l'échelle MÈTRES du papier)`);

  // ── 2. Miroir du panneau masse ──
  const massG = model.data.graphs.find(g => g.axes?.xAxis?.title === 'mass');
  if (!massG) throw new Error('Graphe masse introuvable');
  if (massG.axes.xAxis.reversed) {
    console.log('Panneau masse : déjà réparé (reversed=true) — étape sautée.');
  } else {
    const { min, max } = massG.axes.xAxis;
    const pivot = min + max;
    const mirror = (pts) => pts.map(p => ({ ...p, x: pivot - p.x })).sort((a, b) => a.x - b.x);
    console.log(`Panneau masse [${min}..${max}] kg, pivot miroir = ${pivot} :`);
    for (const c of massG.curves) {
      const before = `${c.points[0].x.toFixed(1)}→${c.points[c.points.length - 1].x.toFixed(1)}`;
      c.points = mirror(c.points);
      if (c.fitted?.points?.length) c.fitted.points = mirror(c.fitted.points);
      console.log(`  « ${c.name} » : x ${before} ⇒ ${c.points[0].x.toFixed(1)}→${c.points[c.points.length - 1].x.toFixed(1)} kg`);
    }
    massG.axes.xAxis.reversed = true;
  }

  model.data.metadata.updatedAt = new Date().toISOString();

  if (!CONFIRM) {
    console.log('\n🔍 DRY-RUN — rien n\'a été écrit. Relance avec --confirm pour appliquer.');
    return;
  }

  const patch = await fetch(`${SUPABASE_URL}/rest/v1/community_presets?id=eq.${PRESET_ID}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: row.aircraft_data })
  });
  if (!patch.ok) throw new Error(`PATCH ${patch.status} : ${await patch.text()}`);
  console.log('\n✅ Correction écrite. Recharge l\'app : le résultat s\'affichera en MÈTRES');
  console.log('   (avec les pieds entre parenthèses) et le panneau masse lira les vraies masses.');
  console.log('   Attendu sur ton cas de référence (21°/2000 ft/1089 kg/face 15 kt) : ≈ 551 m (−2,8 % vs 567 m papier).');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
