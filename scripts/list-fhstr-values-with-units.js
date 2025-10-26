/**
 * Liste toutes les valeurs de F-HSTR avec leurs unités depuis Supabase
 * Usage: node scripts/list-fhstr-values-with-units.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listFHSTRValues() {
  console.log('📋 Liste des valeurs F-HSTR depuis Supabase\n');

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
    const metadata = aircraft._metadata || {};
    const units = metadata.units || {};

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✈️  DIAMOND DA40NG - F-HSTR');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Section 1: Identification
    console.log('📝 IDENTIFICATION');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Registration      : ${aircraft.registration || 'N/A'}`);
    console.log(`   Model             : ${aircraft.model || 'N/A'}`);
    console.log(`   Manufacturer      : ${aircraft.manufacturer || 'N/A'}`);
    console.log(`   Aircraft Type     : ${aircraft.aircraftType || 'N/A'}`);
    console.log(`   Category          : ${aircraft.category || 'N/A'}`);
    console.log();

    // Section 2: Carburant
    console.log('⛽ CARBURANT');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Fuel Type         : ${aircraft.fuelType || 'N/A'}`);
    console.log(`   Fuel Capacity     : ${aircraft.fuelCapacity || 'N/A'} ${units.fuelCapacity || 'L'}`);
    console.log(`   Fuel Consumption  : ${aircraft.fuelConsumption || 'N/A'} ${units.fuelConsumption || 'L/h'}`);
    console.log();

    // Section 3: Poids et Masse
    console.log('⚖️  POIDS ET MASSE');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Empty Weight      : ${aircraft.emptyWeight || 'N/A'} ${units.emptyWeight || 'kg'}`);
    console.log(`   Max Takeoff Weight: ${aircraft.maxTakeoffWeight || 'N/A'} ${units.maxTakeoffWeight || 'kg'}`);
    console.log();

    // Section 4: Vitesses
    console.log('🚀 VITESSES');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Cruise Speed      : ${aircraft.cruiseSpeedKt || 'N/A'} ${units.cruiseSpeedKt || 'kt'}`);
    console.log(`   Max Speed         : ${aircraft.maxSpeedKt || 'N/A'} kt`);
    console.log(`   Stall Speed       : ${aircraft.stallSpeedKt || 'N/A'} kt`);
    console.log();

    // Section 5: Bras de levier (Arms)
    if (aircraft.arms) {
      console.log('📏 BRAS DE LEVIER (Arms)');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`   Empty             : ${aircraft.arms.empty || 'N/A'} m`);
      console.log(`   Front Seats       : ${aircraft.arms.frontSeats || 'N/A'} m`);
      console.log(`   Rear Seats        : ${aircraft.arms.rearSeats || 'N/A'} m`);
      console.log(`   Fuel Main         : ${aircraft.arms.fuelMain || 'N/A'} m`);
      console.log(`   Baggage Fwd       : ${aircraft.arms.baggageFwd || 'N/A'} m`);
      console.log(`   Baggage Aft       : ${aircraft.arms.baggageAft || 'N/A'} m`);
      console.log();
    }

    // Section 6: Limites CG
    if (aircraft.cgLimits) {
      console.log('⚙️  LIMITES CG (Centre de Gravité)');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`   Forward Limit     : ${aircraft.cgLimits.forwardLimit || 'N/A'} m`);
      console.log(`   Aft Limit         : ${aircraft.cgLimits.aftLimit || 'N/A'} m`);
      console.log();
    }

    // Section 7: Vitesses (speeds)
    if (aircraft.speeds) {
      console.log('📊 VITESSES DÉTAILLÉES');
      console.log('─────────────────────────────────────────────────────────────');
      if (aircraft.speeds.vs0) console.log(`   Vs0 (stall landing) : ${aircraft.speeds.vs0} kt`);
      if (aircraft.speeds.vs1) console.log(`   Vs1 (stall clean)   : ${aircraft.speeds.vs1} kt`);
      if (aircraft.speeds.vno) console.log(`   Vno (max structural): ${aircraft.speeds.vno} kt`);
      if (aircraft.speeds.vne) console.log(`   Vne (never exceed)  : ${aircraft.speeds.vne} kt`);
      if (aircraft.speeds.va) console.log(`   Va (maneuvering)    : ${aircraft.speeds.va} kt`);
      if (aircraft.speeds.vfe) console.log(`   Vfe (flaps extended): ${aircraft.speeds.vfe} kt`);
      console.log();
    }

    // Section 8: Performances
    if (aircraft.performances) {
      console.log('⚡ PERFORMANCES');
      console.log('─────────────────────────────────────────────────────────────');
      if (aircraft.performances.climbRate) console.log(`   Climb Rate        : ${aircraft.performances.climbRate} ft/min`);
      if (aircraft.performances.serviceCeiling) console.log(`   Service Ceiling   : ${aircraft.performances.serviceCeiling} ft`);
      if (aircraft.performances.range) console.log(`   Range             : ${aircraft.performances.range} NM`);
      if (aircraft.performances.endurance) console.log(`   Endurance         : ${aircraft.performances.endurance} h`);
      console.log();
    }

    // Section 9: Autres informations
    console.log('📌 AUTRES INFORMATIONS');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Wake Turbulence   : ${aircraft.wakeTurbulenceCategory || 'N/A'}`);
    console.log(`   Has Photo         : ${aircraft.photo ? 'Oui ✅' : 'Non ❌'}`);
    console.log(`   Has Performances  : ${aircraft.performances ? 'Oui ✅' : 'Non ❌'}`);
    console.log(`   Has Perf. Tables  : ${aircraft.performanceTables ? 'Oui ✅' : 'Non ❌'}`);
    console.log();

    // Section 10: Métadonnées
    if (metadata && Object.keys(metadata).length > 0) {
      console.log('🏷️  MÉTADONNÉES');
      console.log('─────────────────────────────────────────────────────────────');
      if (metadata.note) console.log(`   Note              : ${metadata.note}`);
      if (metadata.source) console.log(`   Source            : ${metadata.source}`);
      if (metadata.updatedAt) console.log(`   Updated At        : ${metadata.updatedAt}`);
      if (metadata.updatedBy) console.log(`   Updated By        : ${metadata.updatedBy}`);

      if (metadata.conversions) {
        console.log('\n   📐 Conversions:');
        if (metadata.conversions.fuelConsumption) {
          const fc = metadata.conversions.fuelConsumption;
          console.log(`      Fuel Consumption: ${fc.original} → ${fc.converted}`);
          console.log(`      Factor: ${fc.factor}`);
        }
        if (metadata.conversions.fuelCapacity) {
          const fcap = metadata.conversions.fuelCapacity;
          console.log(`      Fuel Capacity: ${fcap.original} → ${fcap.converted}`);
          console.log(`      Factor: ${fcap.factor}`);
        }
      }
      console.log();
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Liste complète affichée');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

listFHSTRValues();
