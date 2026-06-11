/**
 * Test du fix getValue (aircraftCompleteness) sur les données RÉELLES :
 *  - F-HSTR : « Tables de performance » ne doit PLUS être manquant
 *  - F-GOFP : « Limite CG avant » ne doit PLUS être manquante
 * Usage: node scripts/test-completeness-fix.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { evaluateAircraft } from '../src/features/aircraft/utils/aircraftCompleteness.js';

const supabase = createClient(
  'https://bgmscwckawgybymbimga.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc'
);

let failures = 0;
for (const [reg, labelToCheck] of [
  ['F-HSTR', 'Tables de performance'],
  ['F-GOFP', 'Limite CG avant'],
]) {
  const { data, error } = await supabase
    .from('community_presets')
    .select('aircraft_data')
    .eq('registration', reg)
    .eq('status', 'active')
    .limit(1)
    .single();
  if (error) { console.error(`${reg}: ${error.message}`); failures++; continue; }

  const ev = evaluateAircraft(data.aircraft_data);
  const stillMissing = ev.missing.some((m) => m.label === labelToCheck);
  console.log(`${reg} — « ${labelToCheck} » manquant ? ${stillMissing ? '❌ OUI (fix KO)' : '✅ NON (fix OK)'}  | complétude ${ev.percentage}%`);
  console.log(`   manquants restants: ${ev.missing.map((m) => m.label).join(', ') || '(aucun)'}`);
  if (stillMissing) failures++;
}
process.exit(failures ? 1 : 0);
