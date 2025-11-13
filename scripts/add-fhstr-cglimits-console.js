// À exécuter dans la console du navigateur (F12)
// Copier-coller tout ce fichier dans la console

(async function addFHSTRCgLimits() {
  console.log('🔧 [FIX] Ajout cgLimits pour F-HSTR...');

  try {
    // Utiliser le client Supabase déjà chargé dans l'app
    const { supabase } = window;

    if (!supabase) {
      console.error('❌ Supabase non disponible. Essayez depuis src/services/supabaseClient.js');

      // Alternative: utiliser le module
      const module = await import('/src/services/supabaseClient.js');
      const supabaseClient = module.supabase;

      if (!supabaseClient) {
        console.error('❌ Impossible d\'importer Supabase');
        return;
      }

      window.supabase = supabaseClient;
    }

    const supabaseClient = window.supabase || (await import('/src/services/supabaseClient.js')).supabase;
    console.log('✅ [FIX] Supabase client récupéré');

    // 2. Chercher F-HSTR
    console.log('📦 [FIX] Recherche F-HSTR dans Supabase...');
    const { data: presets, error } = await supabaseClient
      .from('community_presets')
      .select('*')
      .eq('registration', 'F-HSTR')
      .eq('status', 'active')
      .single();

    if (error) {
      console.error('❌ [FIX] Erreur Supabase:', error);
      return;
    }

    if (!presets) {
      console.error('❌ [FIX] F-HSTR non trouvé');
      return;
    }

    const fhstr = presets;
    console.log('✅ [FIX] F-HSTR trouvé, ID:', fhstr.id);

    // 3. Afficher les cgLimits actuels
    console.log('');
    console.log('📊 [FIX] cgLimits AVANT:');
    console.log('  - cgLimits:', fhstr.aircraft_data.weightBalance?.cgLimits);
    console.log('');

    // 4. Créer les nouveaux cgLimits (DA40 NG valeurs typiques)
    const newCgLimits = {
      forward: 2.05,  // 2.05 m (limite avant)
      aft: 2.31       // 2.31 m (limite arrière)
    };

    console.log('📊 [FIX] Nouveaux cgLimits (DA40 NG):');
    console.log('  - forward:', newCgLimits.forward, 'm');
    console.log('  - aft:', newCgLimits.aft, 'm');
    console.log('');

    // 5. Mettre à jour dans Supabase
    console.log('📦 [FIX] Mise à jour dans Supabase...');
    const updatedWeightBalance = {
      ...fhstr.aircraft_data.weightBalance,
      cgLimits: newCgLimits
    };

    const updatedAircraftData = {
      ...fhstr.aircraft_data,
      weightBalance: updatedWeightBalance
    };

    const { data: updated, error: updateError } = await supabaseClient
      .from('community_presets')
      .update({
        aircraft_data: updatedAircraftData,
        updated_at: new Date().toISOString()
      })
      .eq('id', fhstr.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [FIX] Erreur lors de la mise à jour:', updateError);
      return;
    }

    console.log('✅ [FIX] Mise à jour réussie !');
    console.log('');

    // 6. Vérification
    console.log('📊 [FIX] Vérification finale:');
    console.log('  - cgLimits.forward:', updated.aircraft_data.weightBalance.cgLimits.forward, 'm');
    console.log('  - cgLimits.aft:', updated.aircraft_data.weightBalance.cgLimits.aft, 'm');
    console.log('');
    console.log('✅✅✅ SUCCÈS ! ✅✅✅');
    console.log('');
    console.log('🔄 Rechargez la page (F5) pour voir les corrections');

  } catch (error) {
    console.error('❌ [FIX] ERREUR CRITIQUE:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
})();
