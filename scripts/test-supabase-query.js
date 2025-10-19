/**
 * Test de la requête Supabase pour voir la structure exacte des données
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testQuery() {
  console.log('🔍 Test de la requête Supabase...\n');

  try {
    // Test 1: Query sur presets_with_stats (ce que utilise getAllPresets)
    console.log('📊 Test 1: presets_with_stats (utilisé par getAllPresets)');
    const { data: statsData, error: statsError } = await supabase
      .from('presets_with_stats')
      .select('*')
      .eq('registration', 'F-HSTR')
      .single();

    if (statsError) {
      console.error('❌ Erreur:', statsError);
    } else {
      console.log('✅ Données reçues:');
      console.log('  - Keys:', Object.keys(statsData));
      console.log('  - registration:', statsData.registration);
      console.log('  - model:', statsData.model);
      console.log('  - aircraft_data:', typeof statsData.aircraft_data, statsData.aircraft_data ? 'EXISTS' : 'NULL/UNDEFINED');

      if (statsData.aircraft_data) {
        console.log('  - aircraft_data.manufacturer:', statsData.aircraft_data.manufacturer);
        console.log('  - aircraft_data.aircraftType:', statsData.aircraft_data.aircraftType);
        console.log('  - aircraft_data.fuelType:', statsData.aircraft_data.fuelType);
        console.log('  - aircraft_data keys:', Object.keys(statsData.aircraft_data).slice(0, 10));
      }
    }

    // Test 2: Query sur community_presets directement
    console.log('\n📊 Test 2: community_presets (table directe)');
    const { data: directData, error: directError } = await supabase
      .from('community_presets')
      .select('*')
      .eq('registration', 'F-HSTR')
      .single();

    if (directError) {
      console.error('❌ Erreur:', directError);
    } else {
      console.log('✅ Données reçues:');
      console.log('  - Keys:', Object.keys(directData));
      console.log('  - registration:', directData.registration);
      console.log('  - model:', directData.model);
      console.log('  - aircraft_data:', typeof directData.aircraft_data, directData.aircraft_data ? 'EXISTS' : 'NULL/UNDEFINED');

      if (directData.aircraft_data) {
        console.log('  - aircraft_data.manufacturer:', directData.aircraft_data.manufacturer);
        console.log('  - aircraft_data.aircraftType:', directData.aircraft_data.aircraftType);
        console.log('  - aircraft_data.fuelType:', directData.aircraft_data.fuelType);
      }
    }

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

testQuery();
