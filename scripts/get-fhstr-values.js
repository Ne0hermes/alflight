/**
 * Récupère les valeurs exactes de F-HSTR dans Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getFHSTRValues() {
  console.log('🔍 Récupération des valeurs F-HSTR dans Supabase...\n');

  try {
    const { data, error } = await supabase
      .from('community_presets')
      .select('aircraft_data')
      .eq('registration', 'F-HSTR')
      .single();

    if (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }

    const aircraft = data.aircraft_data;

    console.log('═══════════════════════════════════════════════════');
    console.log('📋 VALEURS ACTUELLES DE F-HSTR DANS SUPABASE');
    console.log('═══════════════════════════════════════════════════\n');

    // Informations de base
    console.log('✈️  INFORMATIONS DE BASE:');
    console.log('   Registration:', aircraft.registration || 'N/A');
    console.log('   Model:', aircraft.model || 'N/A');
    console.log('   Manufacturer:', aircraft.manufacturer || 'N/A');
    console.log('   Aircraft Type:', aircraft.aircraftType || 'N/A');
    console.log('   Category:', aircraft.category || 'N/A');
    console.log();

    // Carburant
    console.log('⛽ CARBURANT:');
    console.log('   fuelType:', aircraft.fuelType || 'N/A');
    console.log('   fuelCapacity:', aircraft.fuelCapacity || 'N/A');
    console.log('   fuelConsumption:', aircraft.fuelConsumption || 'N/A');
    console.log();

    // Poids
    console.log('⚖️  POIDS:');
    console.log('   emptyWeight:', aircraft.emptyWeight || 'N/A');
    console.log('   maxTakeoffWeight:', aircraft.maxTakeoffWeight || 'N/A');
    console.log();

    // Vitesses
    console.log('🚀 VITESSES:');
    console.log('   cruiseSpeedKt:', aircraft.cruiseSpeedKt || 'N/A');
    console.log('   maxSpeedKt:', aircraft.maxSpeedKt || 'N/A');
    console.log('   stallSpeedKt:', aircraft.stallSpeedKt || 'N/A');
    console.log();

    // Autres informations importantes
    console.log('📊 AUTRES DONNÉES:');
    console.log('   units:', aircraft.units || 'N/A');
    console.log('   Has photo:', !!aircraft.photo);
    console.log('   Has performances:', !!aircraft.performances);
    console.log('   Has performanceTables:', !!aircraft.performanceTables);
    console.log();

    // JSON complet du champ aircraft_data (limité à 2000 caractères)
    const jsonStr = JSON.stringify(aircraft, null, 2);
    console.log('═══════════════════════════════════════════════════');
    console.log('📄 JSON COMPLET (aircraft_data):');
    console.log('═══════════════════════════════════════════════════');
    if (jsonStr.length > 2000) {
      console.log(jsonStr.substring(0, 2000));
      console.log('\n... (JSON tronqué, total:', jsonStr.length, 'caractères)');
    } else {
      console.log(jsonStr);
    }

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

getFHSTRValues();
