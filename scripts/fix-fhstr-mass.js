// Script de correction de la masse à vide de F-HSTR
// À exécuter dans la console navigateur de l'application (F12)

// ⚠️ INSTRUCTIONS :
// 1. Ouvrez votre application dans le navigateur (http://localhost:4001)
// 2. Appuyez sur F12 pour ouvrir la console
// 3. Copiez-collez TOUT ce script dans la console et appuyez sur Entrée
// 4. Attendez le message de confirmation
// 5. Rechargez la page

(async function fixFHSTR() {
  console.log('🔧 Début de la correction de F-HSTR...');

  try {
    // Importer le store avec le bon chemin Vite
    const { useAircraftStore } = await import('/src/core/stores/aircraftStore.js');
    const store = useAircraftStore.getState();

    // Recharger depuis Supabase pour avoir les données les plus récentes
    console.log('🔄 Rechargement depuis Supabase...');
    await store.loadFromSupabase();

    // Trouver F-HSTR
    const fhstr = store.aircraftList.find(a => a.registration === 'F-HSTR');

    if (!fhstr) {
      console.error('❌ F-HSTR non trouvé dans le store');
      return;
    }

    console.log('📋 Données actuelles F-HSTR:');
    console.log('  - Masse à vide:', fhstr.weights?.emptyWeight || fhstr.emptyWeight);
    console.log('  - MZFW:', fhstr.weights?.mzfw || fhstr.weights?.zfm);
    console.log('  - Bras à vide:', fhstr.arms?.empty);

    // Créer l'avion corrigé
    const updatedFHSTR = {
      ...fhstr,
      weights: {
        ...fhstr.weights,
        emptyWeight: '900'  // Correction : 1200 → 900
      },
      emptyWeight: '900'  // Pour rétrocompatibilité
    };

    console.log('📤 Mise à jour de F-HSTR dans Supabase...');
    const result = await store.updateAircraft(updatedFHSTR);

    if (result) {
      console.log('✅ F-HSTR corrigé avec succès !');
      console.log('📋 Nouvelles données:');
      console.log('  - Masse à vide:', result.weights?.emptyWeight || result.emptyWeight, 'kg');
      console.log('  - Bras à vide:', result.arms?.empty, 'm');
      console.log('  - Moment à vide:', parseFloat(result.weights?.emptyWeight || result.emptyWeight) * parseFloat(result.arms?.empty), 'kg.m');
      console.log('');
      console.log('🔄 Rechargez la page pour voir les changements !');
    } else {
      console.error('❌ Échec de la mise à jour');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    console.error('Stack:', error.stack);
  }
})();
