/**
 * Script de migration des avions locaux vers Supabase
 * Usage: node scripts/migrate-to-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERREUR: Variables SUPABASE non configurées dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Insérer un avion dans Supabase
 */
async function insertAircraft(aircraftData) {
  try {
    console.log(`\n📤 Insertion de ${aircraftData.registration} (${aircraftData.model})...`);

    // Préparer les données pour Supabase
    const presetData = {
      registration: aircraftData.registration,
      model: aircraftData.model,
      manufacturer: aircraftData.manufacturer || 'Unknown',
      aircraft_type: aircraftData.aircraftType || aircraftData.type || 'Unknown',
      category: aircraftData.category || 'SEP',
      aircraft_data: aircraftData, // Toutes les données complètes en JSON
      submitted_by: 'migration-script',
      description: `Avion ${aircraftData.model} - ${aircraftData.registration}`,
      has_manex: !!aircraftData.manex,
      status: 'active',
      verified: true,
      admin_verified: true
    };

    // Vérifier si l'avion existe déjà
    const { data: existing, error: checkError } = await supabase
      .from('community_presets')
      .select('id, registration')
      .eq('registration', aircraftData.registration)
      .single();

    if (existing) {
      console.log(`⚠️  ${aircraftData.registration} existe déjà dans Supabase (ID: ${existing.id})`);
      console.log(`   Voulez-vous mettre à jour? Ajoutez --update pour forcer la mise à jour`);
      return existing;
    }

    // Insérer le nouvel avion
    const { data, error } = await supabase
      .from('community_presets')
      .insert(presetData)
      .select()
      .single();

    if (error) {
      console.error(`❌ Erreur lors de l'insertion de ${aircraftData.registration}:`, error);
      throw error;
    }

    console.log(`✅ ${aircraftData.registration} inséré avec succès! (ID: ${data.id})`);
    return data;

  } catch (error) {
    console.error(`❌ Erreur fatale pour ${aircraftData.registration}:`, error.message);
    throw error;
  }
}

/**
 * Migration principale
 */
async function migrateAircraft() {
  console.log('🚀 Début de la migration vers Supabase...\n');

  try {
    // Charger F-HSTR depuis le fichier
    const fhstrPath = 'D:\\log app\\aircraft_F-HSTR_with_performance_FIXED.json';

    if (!fs.existsSync(fhstrPath)) {
      console.error(`❌ Fichier non trouvé: ${fhstrPath}`);
      process.exit(1);
    }

    const fhstrData = JSON.parse(fs.readFileSync(fhstrPath, 'utf8'));

    // Extraire les données de l'avion
    const aircraftData = fhstrData.aircraftData;

    if (!aircraftData || !aircraftData.registration) {
      console.error('❌ Données d\'avion invalides dans le fichier');
      process.exit(1);
    }

    console.log('📋 Avion trouvé:');
    console.log(`   - Registration: ${aircraftData.registration}`);
    console.log(`   - Model: ${aircraftData.model}`);
    console.log(`   - ID: ${aircraftData.id}`);
    console.log(`   - Taille: ${JSON.stringify(aircraftData).length} bytes`);

    // Insérer dans Supabase
    const result = await insertAircraft(aircraftData);

    console.log('\n✅ Migration terminée avec succès!');
    console.log(`\n🔗 Voir dans Supabase: ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}/editor`);

  } catch (error) {
    console.error('\n❌ Échec de la migration:', error);
    process.exit(1);
  }
}

// Lancer la migration
migrateAircraft();
