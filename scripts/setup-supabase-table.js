/**
 * Script pour créer automatiquement la table flight_plans dans Supabase
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configuration ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  console.error('Vérifiez que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définis dans .env');
  process.exit(1);
}

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function createFlightPlansTable() {
  try {
    console.log('🔄 Lecture du script SQL...');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../supabase-flight-plans-setup.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');

    console.log('📊 Création de la table flight_plans...');
    console.log('⚠️  Note: Cette opération nécessite des permissions administrateur');

    // Tenter d'exécuter le SQL via l'API
    // Note: Cela peut échouer si la clé anon n'a pas les permissions nécessaires
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlScript });

    if (error) {
      console.error('❌ Erreur lors de la création de la table:', error.message);
      console.log('\n📋 Pour créer la table manuellement:');
      console.log('1. Ouvrez https://bgmscwckawgybymbimga.supabase.co');
      console.log('2. Allez dans SQL Editor');
      console.log('3. Copiez-collez le contenu de: supabase-flight-plans-setup.sql');
      console.log('4. Exécutez la requête\n');
      process.exit(1);
    }

    console.log('✅ Table flight_plans créée avec succès!');
    console.log('📊 Colonnes créées:');
    console.log('  - id, created_at, completed_at');
    console.log('  - callsign, flight_type, day_night, flight_nature, flight_date');
    console.log('  - aircraft_registration, aircraft_type, aircraft_model');
    console.log('  - departure_icao, arrival_icao, waypoints, alternates');
    console.log('  - fuel_total_required, fuel_confirmed');
    console.log('  - weight_balance, performance_data, tod_parameters');
    console.log('  - full_flight_plan (JSONB backup complet)');
    console.log('\n✅ Index créés pour recherche rapide');
    console.log('✅ Politiques RLS activées (lecture/écriture publique)');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.log('\n🔧 Solution alternative:');
    console.log('Copiez le contenu de supabase-flight-plans-setup.sql');
    console.log('et exécutez-le manuellement dans le SQL Editor de Supabase');
    process.exit(1);
  }
}

// Exécuter le script
console.log('🚀 Script de création de table flight_plans');
console.log('📍 URL Supabase:', supabaseUrl);
console.log('');

createFlightPlansTable();
