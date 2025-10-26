/**
 * Script pour corriger les valeurs de F-HSTR dans Supabase
 * - Correction fuelConsumption: 26 → 98.42 L/h
 * - Correction emptyWeight: 870 → 1200 kg
 * - Correction maxTakeoffWeight: 1200 → 1310 kg
 * - Ajout des métadonnées avec unités
 *
 * Usage: node scripts/fix-fhstr-units-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ ERREUR: Variables SUPABASE non configurées dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixFHSTRUnits() {
  console.log('🔧 Correction des valeurs F-HSTR dans Supabase...\n');

  try {
    // 1. Récupérer les données actuelles
    console.log('📥 Récupération des données actuelles...');
    const { data: current, error: fetchError } = await supabase
      .from('community_presets')
      .select('aircraft_data')
      .eq('registration', 'F-HSTR')
      .single();

    if (fetchError) {
      console.error('❌ Erreur lors de la récupération:', fetchError);
      process.exit(1);
    }

    const aircraftData = current.aircraft_data;

    console.log('\n📊 VALEURS ACTUELLES:');
    console.log('   fuelCapacity:', aircraftData.fuelCapacity, '(correct ✅)');
    console.log('   fuelConsumption:', aircraftData.fuelConsumption, '❌ → devrait être 98.42 L/h');
    console.log('   emptyWeight:', aircraftData.emptyWeight, '❌ → devrait être 1200 kg');
    console.log('   maxTakeoffWeight:', aircraftData.maxTakeoffWeight, '❌ → devrait être 1310 kg');

    // 2. Créer l'objet mis à jour
    const updatedAircraftData = {
      ...aircraftData,
      fuelCapacity: 148,              // litres (déjà correct)
      fuelConsumption: 98.42,         // L/h (corrigé depuis 26)
      emptyWeight: 1200,              // kg (corrigé depuis 870)
      maxTakeoffWeight: 1310,         // kg (corrigé depuis 1200)
      _metadata: {
        units: {
          fuelConsumption: "lph",
          fuelCapacity: "ltr",
          cruiseSpeedKt: "kt",
          emptyWeight: "kg",
          maxTakeoffWeight: "kg"
        },
        conversions: {
          fuelConsumption: {
            original: "26 gph (US gallons/hour)",
            converted: "98.42 lph (litres/hour)",
            factor: 3.78541
          },
          fuelCapacity: {
            original: "39 gal (US gallons)",
            converted: "148 ltr (litres)",
            factor: 3.78541
          },
          weights: {
            note: "Poids corrects selon spécifications DA40NG"
          }
        },
        note: "Storage units - all values stored in L/h, L, kt, kg",
        source: "DA40NG official specifications",
        updatedAt: new Date().toISOString(),
        updatedBy: "fix-fhstr-units-supabase.js"
      }
    };

    console.log('\n📝 NOUVELLES VALEURS:');
    console.log('   fuelCapacity:', updatedAircraftData.fuelCapacity, 'L');
    console.log('   fuelConsumption:', updatedAircraftData.fuelConsumption, 'L/h');
    console.log('   emptyWeight:', updatedAircraftData.emptyWeight, 'kg');
    console.log('   maxTakeoffWeight:', updatedAircraftData.maxTakeoffWeight, 'kg');
    console.log('   _metadata: ✅ Ajouté avec unités et conversions');

    // 3. Confirmer avant mise à jour
    console.log('\n⚠️  ATTENTION: Cette opération va modifier les données dans Supabase.');
    console.log('Appuyez sur Ctrl+C pour annuler, ou attendez 3 secondes...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Mettre à jour Supabase
    console.log('🚀 Mise à jour dans Supabase...');
    const { data: updated, error: updateError } = await supabase
      .from('community_presets')
      .update({
        aircraft_data: updatedAircraftData,
        updated_at: new Date().toISOString()
      })
      .eq('registration', 'F-HSTR')
      .select();

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour:', updateError);
      throw updateError;
    }

    console.log('\n✅ MISE À JOUR RÉUSSIE!\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ DES CHANGEMENTS');
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ fuelConsumption: 26 → 98.42 L/h');
    console.log('✅ emptyWeight: 870 → 1200 kg');
    console.log('✅ maxTakeoffWeight: 1200 → 1310 kg');
    console.log('✅ fuelCapacity: 148 L (inchangé)');
    console.log('✅ _metadata ajouté avec unités et conversions');
    console.log('═══════════════════════════════════════════════════');

    console.log('\n🔗 Vérification dans Supabase:');
    console.log(`   ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}/editor`);
    console.log('\n📋 Registration: F-HSTR');
    console.log('📅 Updated:', updated[0].updated_at);

  } catch (error) {
    console.error('\n❌ Échec:', error);
    process.exit(1);
  }
}

fixFHSTRUnits();
