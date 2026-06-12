// scripts/fix-fgnam-mass-mirror.js
//
// R11 (AUDIT_ABAC_ATELIER_IMAGE_UNIQUE.md §19) — Répare le panneau MASSE du
// modèle « Distance décollage — passage 15 m (50 ft) » de F-GNAM, tracé en
// MIROIR : sur le papier PA-28-181 l'axe masse va de ~1150 kg (gauche) à
// ~950 kg (droite), mais l'axe du graphe a été déclaré [950..1150] NON
// inversé et sans calibration X → toutes les masses stockées sont le reflet
// des vraies (x_data = 2100 − x_papier). Conséquence : 1089 kg demandés
// étaient lus à ~1011 kg sur les guides.
//
// Transformation appliquée au graphe 2 (id c7a73525…) :
//   • points et fitted.points : x' = (min + max) − x  (= 2100 − x), retriés par x
//   • xAxis.reversed = true  → le rendu sur le canevas reste IDENTIQUE
//     (mêmes pixels sur l'image), seules les VALEURS deviennent physiques.
//
// Usage :
//   node scripts/fix-fgnam-mass-mirror.js            (dry-run, rien n'est écrit)
//   node scripts/fix-fgnam-mass-mirror.js --confirm  (écrit la correction)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repairSrc = fs.readFileSync(path.join(__dirname, 'repair-dead-manex-links.js'), 'utf8');
const SUPABASE_URL = repairSrc.match(/SUPABASE_URL = '([^']+)'/)[1];
const SUPABASE_ANON_KEY = repairSrc.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];

const PRESET_ID = '513e9ccc-6cc7-4e68-a262-e0c2152aeb29'; // F-GNAM
const SYSTEM_TYPE = 'takeoff_50ft';
const MASS_GRAPH_ID = 'c7a73525-beeb-4203-9249-6304960a54bc';

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
  const modelIdx = models.findIndex(m => m?.data?.metadata?.systemType === SYSTEM_TYPE);
  if (modelIdx < 0) throw new Error(`Modèle ${SYSTEM_TYPE} introuvable`);
  const model = models[modelIdx];

  const graph = model.data.graphs.find(g => g.id === MASS_GRAPH_ID);
  if (!graph) throw new Error('Graphe masse introuvable');

  if (graph.axes.xAxis.reversed) {
    console.log('✅ Déjà réparé (xAxis.reversed = true) — rien à faire.');
    return;
  }

  const { min, max } = graph.axes.xAxis;
  const pivot = min + max; // 950 + 1150 = 2100
  const mirror = (pts) =>
    pts.map(p => ({ ...p, x: pivot - p.x })).sort((a, b) => a.x - b.x);

  console.log(`Avion ${row.registration} · modèle « ${model.name} » · graphe « ${graph.name} »`);
  console.log(`Axe X masse [${min}..${max}] kg, pivot miroir = ${pivot}`);
  for (const c of graph.curves) {
    const before = `${c.points[0].x.toFixed(1)}→${c.points[c.points.length - 1].x.toFixed(1)}`;
    c.points = mirror(c.points);
    if (c.fitted?.points?.length) c.fitted.points = mirror(c.fitted.points);
    const after = `${c.points[0].x.toFixed(1)}→${c.points[c.points.length - 1].x.toFixed(1)}`;
    console.log(`  « ${c.name} » : x ${before}  ⇒  ${after} kg (y inchangés)`);
  }
  graph.axes.xAxis.reversed = true;
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
  console.log('\n✅ Correction écrite. Recharge l\'app : le canevas affichera les mêmes courbes,');
  console.log('   mais les masses lues par le calcul seront désormais physiques (1089 kg = 1089 kg).');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
