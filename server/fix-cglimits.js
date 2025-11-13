// server/fix-cglimits.js
// Script Node.js pour corriger les cgLimits de F-HSTR dans Supabase

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yawivlfiebsemtsxgmqz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhd2l2bGZpZWJzZW10c3hnbXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgxNTE5NjcsImV4cCI6MjA0MzcyNzk2N30.QX5c9P7WUTQg5rHTTMp0D57HWmRxQXlNqHIGksMO-hY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCgLimits() {
  console.log('\n🔍 Vérification des cgLimits pour F-HSTR...\n');

  try {
    const { data, error } = await supabase
      .from('aircraft')
      .select('registration, model, cgLimits')
      .eq('registration', 'F-HSTR')
      .single();

    if (error) {
      console.error('❌ Erreur lors de la requête:', error.message);
      return null;
    }

    console.log(`✅ Avion trouvé: ${data.registration} (${data.model})`);

    if (data.cgLimits) {
      console.log(`✅ cgLimits présents:`, data.cgLimits);
      return data;
    } else {
      console.log('❌ cgLimits MANQUANTS - Correction nécessaire');
      return data;
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    return null;
  }
}

async function fixCgLimits() {
  console.log('\n🔧 Correction des cgLimits pour F-HSTR...\n');

  const cgLimits = {
    forward: 2.05,  // DA40 NG typical forward CG limit (m)
    aft: 2.31       // DA40 NG typical aft CG limit (m)
  };

  try {
    const { data, error } = await supabase
      .from('aircraft')
      .update({ cgLimits })
      .eq('registration', 'F-HSTR')
      .select();

    if (error) {
      console.error('❌ Erreur lors de la mise à jour:', error.message);
      return false;
    }

    console.log(`✅ cgLimits ajoutés avec succès:`, cgLimits);
    console.log('✅ F-HSTR mis à jour dans Supabase');
    console.log('\n⚠️  IMPORTANT: Videz IndexedDB pour recharger les données fraîches');
    console.log('   Dans la console navigateur: indexedDB.deleteDatabase("alflight-aircraft-db")');
    console.log('   Puis rechargez la page\n');

    return true;
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    return false;
  }
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('  🔧 Fix cgLimits F-HSTR - Supabase');
  console.log('════════════════════════════════════════════════════════\n');

  // Étape 1 : Vérifier l'état actuel
  const currentData = await checkCgLimits();

  if (!currentData) {
    console.log('\n❌ Impossible de continuer - Avion non trouvé');
    process.exit(1);
  }

  // Étape 2 : Si cgLimits manquants, corriger
  if (!currentData.cgLimits) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Correction en cours...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const success = await fixCgLimits();

    if (success) {
      console.log('\n════════════════════════════════════════════════════════');
      console.log('  ✅ CORRECTION TERMINÉE AVEC SUCCÈS');
      console.log('════════════════════════════════════════════════════════\n');
      console.log('📋 Prochaines étapes:');
      console.log('   1. Ouvrir la console du navigateur (F12)');
      console.log('   2. Exécuter: indexedDB.deleteDatabase("alflight-aircraft-db")');
      console.log('   3. Recharger la page de l\'application');
      console.log('\n');
    } else {
      console.log('\n❌ La correction a échoué');
      process.exit(1);
    }
  } else {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('  ℹ️  AUCUNE ACTION NÉCESSAIRE');
    console.log('════════════════════════════════════════════════════════');
    console.log('  cgLimits déjà présents pour F-HSTR');
    console.log('  Aucune modification effectuée\n');
  }
}

// Exécuter le script
main().catch(console.error);
