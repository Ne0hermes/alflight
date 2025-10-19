/**
 * Script pour mettre à jour F-HSTR dans Supabase avec les données enrichies
 * Usage: node scripts/update-supabase-fhstr.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERREUR: Variables SUPABASE non configurées dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateFHSTR() {
  console.log('🔄 Mise à jour de F-HSTR dans Supabase...\n');

  try {
    // Charger les données enrichies
    const enrichedData = JSON.parse(
      fs.readFileSync('D:\\log app\\aircraft_F-HSTR_ENRICHED.json', 'utf8')
    );
    const aircraftData = enrichedData.aircraftData;

    console.log('📋 Données à mettre à jour:');
    console.log('  - Registration:', aircraftData.registration);
    console.log('  - Model:', aircraftData.model);
    console.log('  - Manufacturer:', aircraftData.manufacturer);
    console.log('  - Type:', aircraftData.aircraftType);
    console.log('  - Category:', aircraftData.category);
    console.log('  - Fuel Type:', aircraftData.fuelType);
    console.log('  - Fuel Capacity:', aircraftData.fuelCapacity);
    console.log('  - Photo:', aircraftData.photo ? 'Oui' : 'Non');
    console.log('  - Surfaces:', aircraftData.compatibleRunwaySurfaces);
    console.log('  - Taille:', JSON.stringify(aircraftData).length, 'bytes\n');

    // Récupérer l'ID de F-HSTR
    const { data: existing, error: findError } = await supabase
      .from('community_presets')
      .select('id')
      .eq('registration', 'F-HSTR')
      .single();

    if (findError) {
      console.error('❌ Erreur: F-HSTR non trouvé dans Supabase');
      console.error(findError);
      process.exit(1);
    }

    console.log('✅ F-HSTR trouvé, ID:', existing.id);

    // Mettre à jour
    const { data, error } = await supabase
      .from('community_presets')
      .update({
        manufacturer: aircraftData.manufacturer,
        aircraft_type: aircraftData.aircraftType,
        category: aircraftData.category,
        aircraft_data: aircraftData, // Données complètes enrichies
        description: `${aircraftData.manufacturer} ${aircraftData.model} - ${aircraftData.registration} - Avion complet avec photo et performances`,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select();

    if (error) {
      console.error('❌ Erreur lors de la mise à jour:', error);
      throw error;
    }

    console.log('\n✅ F-HSTR mis à jour avec succès!');
    console.log('\n📊 Résumé:');
    console.log('  - ID:', data[0].id);
    console.log('  - Registration:', data[0].registration);
    console.log('  - Manufacturer:', data[0].manufacturer);
    console.log('  - Type:', data[0].aircraft_type);
    console.log('  - Category:', data[0].category);
    console.log('  - Updated:', data[0].updated_at);

    console.log('\n🔗 Voir dans Supabase:');
    console.log(`   ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}/editor`);

  } catch (error) {
    console.error('\n❌ Échec de la mise à jour:', error);
    process.exit(1);
  }
}

updateFHSTR();
