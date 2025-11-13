// Script de correction F-HSTR - Accès DIRECT Supabase (contourne le filtre status)

(async function fixFHSTRDirect() {
  console.log('🔧 [DIRECT] Correction F-HSTR via accès direct Supabase...');

  try {
    // 1. Importer Supabase client directement
    console.log('📦 [DIRECT] Import Supabase client...');
    const { supabase } = await import('/src/services/supabaseClient.js');
    console.log('✅ [DIRECT] Supabase importé');

    // 2. Chercher F-HSTR dans Supabase SANS filtre status
    console.log('📦 [DIRECT] Recherche F-HSTR dans Supabase (SANS filtre status)...');
    const { data: presets, error } = await supabase
      .from('community_presets')
      .select('*')
      .eq('registration', 'F-HSTR');

    if (error) {
      console.error('❌ [DIRECT] Erreur Supabase:', error);
      return;
    }

    if (!presets || presets.length === 0) {
      console.error('❌ [DIRECT] F-HSTR non trouvé dans Supabase');
      console.log('Essayez de chercher avec un autre critère (model, manufacturer, etc.)');
      return;
    }

    const fhstr = presets[0];
    console.log('✅ [DIRECT] F-HSTR trouvé dans Supabase');
    console.log('  - ID:', fhstr.id);
    console.log('  - Registration:', fhstr.registration);
    console.log('  - Status:', fhstr.status);
    console.log('  - aircraft_data:', fhstr.aircraft_data);

    // 3. Vérifier la masse actuelle
    const currentWeight = fhstr.aircraft_data?.weights?.emptyWeight || fhstr.aircraft_data?.emptyWeight;
    console.log('  - Masse actuelle:', currentWeight, 'kg');

    if (parseFloat(currentWeight) === 900) {
      console.log('✅ [DIRECT] Masse déjà à 900 kg dans Supabase !');
      console.log('Le problème est ailleurs (filtre status, cache, etc.)');
      return;
    }

    // 4. Créer les données mises à jour
    console.log('📦 [DIRECT] Création des données mises à jour...');
    const updatedAircraftData = {
      ...fhstr.aircraft_data,
      weights: {
        ...fhstr.aircraft_data.weights,
        emptyWeight: '900'
      },
      emptyWeight: '900'
    };

    console.log('  - Nouvelle masse:', updatedAircraftData.weights.emptyWeight);

    // 5. Mettre à jour dans Supabase DIRECTEMENT
    console.log('📦 [DIRECT] Mise à jour DIRECTE dans Supabase...');
    const { data: updated, error: updateError } = await supabase
      .from('community_presets')
      .update({
        aircraft_data: updatedAircraftData,
        updated_at: new Date().toISOString()
      })
      .eq('id', fhstr.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [DIRECT] Erreur lors de la mise à jour:', updateError);
      return;
    }

    console.log('✅ [DIRECT] Mise à jour réussie !');
    console.log('  - Masse dans Supabase:', updated.aircraft_data.weights?.emptyWeight);

    // 6. Vérification finale
    console.log('📦 [DIRECT] Vérification finale...');
    const { data: verified, error: verifyError } = await supabase
      .from('community_presets')
      .select('*')
      .eq('id', fhstr.id)
      .single();

    if (verifyError) {
      console.error('❌ [DIRECT] Erreur lors de la vérification:', verifyError);
      return;
    }

    const verifiedWeight = verified.aircraft_data?.weights?.emptyWeight || verified.aircraft_data?.emptyWeight;
    console.log('  - Masse vérifiée:', verifiedWeight, 'kg');

    if (parseFloat(verifiedWeight) === 900) {
      console.log('');
      console.log('✅✅✅ [DIRECT] SUCCÈS CONFIRMÉ ! ✅✅✅');
      console.log('');
      console.log('La masse à vide de F-HSTR est maintenant 900 kg dans Supabase !');
      console.log('');
      console.log('🔄 Rechargez la page (F5) pour voir les changements');
      console.log('');
      console.log('⚠️ NOTE : Si F-HSTR n\'apparaît toujours pas, vérifiez le champ "status"');
      console.log('   Status actuel:', verified.status);
      console.log('   Status requis: "active"');
    } else {
      console.error('❌ [DIRECT] Échec de la vérification');
      console.error('Masse toujours à', verifiedWeight, 'kg');
    }

  } catch (error) {
    console.error('❌ [DIRECT] ERREUR CRITIQUE:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
})();
