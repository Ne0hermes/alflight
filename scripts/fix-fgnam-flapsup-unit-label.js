// scripts/fix-fgnam-flapsup-unit-label.js
//
// AUDIT_CONVERSION_PERF_VOL.md (2026-06-22) — Répare la MÉTADONNÉE d'unité du
// modèle « Distance sol décollage — Flaps UP (0°) » de F-GNAM
// (systemType = takeoff_ground_roll_flaps_up).
//
// Constat (lecture Supabase live) : le modèle est tracé EN PIEDS
//   - workshop.sharedY.unit = 'ft' [400..2400]
//   - yAxis.unit = 'ft' sur les 3 graphes
//   - valeurs Y plausibles en pieds (875..1272 pour un roulage PA-28)
// MAIS deux métadonnées MENTENT :
//   1. outputUnit du PRIMAIRE = 'm' (contredit yAxis.unit='ft') → l'ancien
//      moteur lit outputUnit ⇒ affiche « m » au lieu de « ft » (bug pilote).
//   2. yAxis.title = 'altitude' sur les 3 graphes (c'est une DISTANCE) →
//      affichage trompeur « Y = altitude » + titleToConditionDim('alt') route
//      par erreur vers 'pressure_altitude' (misroute latent).
//
// Correction (VALEURS INCHANGÉES — ce sont des pieds, on ne touche QU'aux
// étiquettes) :
//   - primaire.outputUnit 'm' → 'ft'
//   - yAxis.unit forcé 'ft' (idempotent) + workshop.sharedY.unit 'ft'
//   - yAxis.title 'altitude' → 'takeoff_ground_roll' (distance)
//
// NON traité ici (volontaire) : encodage hétérogène de la famille d'altitude
// (primaire « 0ft..5000ft » vs panneau masse « 0..5 ») — il casse l'ANCIEN
// moteur ; le nouveau moteur atelier interroge le panneau masse sur X=masse et
// y est immunisé. À normaliser à la création (cf. K4 de l'audit).
//
// Usage :
//   node scripts/fix-fgnam-flapsup-unit-label.js            (dry-run, n'écrit rien)
//   node scripts/fix-fgnam-flapsup-unit-label.js --confirm  (écrit)

import fs from 'fs';

const env =
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8') + '\n' +
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const getEnv = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1] || '').trim();
const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

const PRESET_ID = '513e9ccc-6cc7-4e68-a262-e0c2152aeb29'; // F-GNAM
const SYSTEM_TYPE = 'takeoff_ground_roll_flaps_up';
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
  if (!r.ok) throw new Error(`GET ${r.status} : ${await r.text()}`);
  const [row] = await r.json();
  if (!row) throw new Error('Preset F-GNAM introuvable');

  const models = row.aircraft_data.performanceModels || [];
  const model = models.find(m => m?.data?.metadata?.systemType === SYSTEM_TYPE);
  if (!model) throw new Error(`Modèle ${SYSTEM_TYPE} introuvable`);
  console.log(`Avion ${row.registration} · modèle « ${model.name} »\n`);

  let fixes = 0;
  for (const g of model.data.graphs) {
    const role = g.role || 'primary';
    // 1. outputUnit menteur sur le primaire
    if (role === 'primary' && g.outputUnit === 'm') {
      g.outputUnit = 'ft'; fixes++;
      console.log(`  [${role}] « ${g.name} » : outputUnit 'm' → 'ft'`);
    }
    // 2. yAxis.unit forcé 'ft' (idempotent)
    if (g.axes?.yAxis && g.axes.yAxis.unit !== 'ft') {
      console.log(`  [${role}] « ${g.name} » : yAxis.unit '${g.axes.yAxis.unit}' → 'ft'`);
      g.axes.yAxis.unit = 'ft'; fixes++;
    }
    // 3. yAxis.title 'altitude' → distance
    if (g.axes?.yAxis?.title === 'altitude') {
      g.axes.yAxis.title = 'takeoff_ground_roll'; fixes++;
      console.log(`  [${role}] « ${g.name} » : yAxis.title 'altitude' → 'takeoff_ground_roll'`);
    }
  }
  const ws = model.data.metadata?.workshop;
  if (ws?.sharedY && ws.sharedY.unit !== 'ft') {
    console.log(`  workshop.sharedY.unit '${ws.sharedY.unit}' → 'ft'`);
    ws.sharedY.unit = 'ft'; fixes++;
  }

  console.log(`\n${fixes} étiquette(s) corrigée(s). Valeurs Y INCHANGÉES (ce sont des pieds).`);
  if (fixes === 0) { console.log('Rien à faire — déjà cohérent.'); return; }

  if (!CONFIRM) {
    console.log('\n🔍 DRY-RUN — rien écrit. Relance avec --confirm pour appliquer.');
    return;
  }

  model.data.metadata.updatedAt = new Date().toISOString();
  const patch = await fetch(`${SUPABASE_URL}/rest/v1/community_presets?id=eq.${PRESET_ID}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ aircraft_data: row.aircraft_data })
  });
  if (!patch.ok) throw new Error(`PATCH ${patch.status} : ${await patch.text()}`);
  console.log('\n✅ Écrit. Recharge l\'app : la distance Flaps UP s\'affichera en « ft ».');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
