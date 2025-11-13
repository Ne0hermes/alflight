// Script pour ajouter cgLimits à F-HSTR
// DA40 NG - Valeurs typiques selon le manuel de vol

(async function addFHSTRCgLimits() {
  console.log('🔧 [FIX] Ajout cgLimits pour F-HSTR...');

  try {
    // 1. Importer Supabase client
    console.log('📦 [FIX] Import Supabase client...');
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = 'https://fzutqgupawmnwrnuheqc.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dXRxZ3VwYXdtbndybnVoZXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk3ODEyMDksImV4cCI6MjA0NTM1NzIwOX0.0CyNz9s5wOV6uC6WL7-jvw_ZDxbSlj4YuZPhcwpQIhU';

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ [FIX] Supabase connecté');

    // 2. Chercher F-HSTR
    console.log('📦 [FIX] Recherche F-HSTR dans Supabase...');
    const { data: presets, error } = await supabase
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
