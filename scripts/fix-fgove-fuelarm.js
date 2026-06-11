// Correctif ciblé post-migration C5 (2026-06-10) — F-GOVE weightBalance.fuelArm.
//
// Constat : la valeur d'origine « 10 » était une donnée aberrante (ni m ni mm
// plausibles) ; la migration l'a interprétée « pouces » → 0.254 m, plausible
// mais CONTREDITE par trois champs concordants du même avion :
//   arms.fuelMain = 1.1027 m, additionalFuelTanks[0].arm = 1.1027 m (110 L, principal).
// Correction : weightBalance.fuelArm = 1.1027 m (cohérence interne).
// Usage : node scripts/fix-fgove-fuelarm.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bgmscwckawgybymbimga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EXPECTED_CURRENT = 0.254; // valeur issue de la migration (garde anti-double-exécution)
const CORRECT_VALUE = 1.1027;   // = arms.fuelMain = tanks[0].arm

async function main() {
  const { data, error } = await supabase
    .from('community_presets')
    .select('id, registration, aircraft_data')
    .eq('registration', 'F-GOVE')
    .single();
  if (error) { console.error('❌ Lecture :', error.message); process.exit(1); }

  const a = data.aircraft_data;
  const current = a?.weightBalance?.fuelArm;
  console.log(`F-GOVE weightBalance.fuelArm actuel : ${current}`);
  console.log(`  (références : arms.fuelMain=${a?.arms?.fuelMain}, tanks[0].arm=${a?.additionalFuelTanks?.[0]?.arm})`);

  if (current === CORRECT_VALUE) { console.log('✅ Déjà corrigé — rien à faire.'); return; }
  if (Math.abs(parseFloat(current) - EXPECTED_CURRENT) > 1e-6) {
    console.error(`⚠ Valeur inattendue (${current} ≠ ${EXPECTED_CURRENT}) — abandon par sécurité, vérifier manuellement.`);
    process.exit(2);
  }

  a.weightBalance.fuelArm = CORRECT_VALUE;
  a._metadata = { ...(a._metadata || {}), fixFgoveFuelArm: { at: new Date().toISOString(), before: current, after: CORRECT_VALUE } };

  const { error: upErr } = await supabase
    .from('community_presets')
    .update({ aircraft_data: a })
    .eq('id', data.id);
  if (upErr) { console.error('❌ Écriture :', upErr.message); process.exit(1); }
  console.log(`✅ Corrigé : weightBalance.fuelArm ${current} → ${CORRECT_VALUE} m`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
