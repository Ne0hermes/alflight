// Script de correction ROBUSTE de la masse à vide de F-HSTR (1200 → 900 kg)
// Version 2 : Avec vérification et confirmation de la sauvegarde Supabase

// ⚠️ INSTRUCTIONS :
// 1. Ouvrez votre application dans le navigateur (http://localhost:4001)
// 2. Appuyez sur F12 pour ouvrir la console
// 3. Copiez-collez TOUT ce script dans la console et appuyez sur Entrée
// 4. Attendez le message de confirmation
// 5. Rechargez la page

(async function fixFHSTRv2() {
  console.log('🔧 Début de la correction de F-HSTR (Version 2)...');

  try {
    // 1. Importer le store avec le bon chemin Vite
    const { useAircraftStore } = await import('/src/core/stores/aircraftStore.js');
    const store = useAircraftStore.getState();

    // 2. Recharger depuis Supabase pour avoir les données les plus récentes
    console.log('🔄 Rechargement depuis Supabase...');
    await store.loadFromSupabase();

    // 3. Trouver F-HSTR
    const fhstr = store.aircraftList.find(a => a.registration === 'F-HSTR');

    if (!fhstr) {
      console.error('❌ F-HSTR non trouvé dans le store');
      return;
    }

    console.log('📋 Données AVANT correction:');
    console.log('  - ID:', fhstr.id);
    console.log('  - Registration:', fhstr.registration);
    console.log('  - weights.emptyWeight:', fhstr.weights?.emptyWeight);
    console.log('  - emptyWeight (legacy):', fhstr.emptyWeight);

    // 4. Vérifier si la correction est nécessaire
    const currentEmptyWeight = parseFloat(fhstr.weights?.emptyWeight || fhstr.emptyWeight);
    if (currentEmptyWeight === 900) {
      console.log('✅ La masse est déjà à 900 kg. Rien à faire !');
      return;
    }

    // 5. Créer l'avion corrigé
    const updatedFHSTR = {
      ...fhstr,
      weights: {
        ...fhstr.weights,
        emptyWeight: '900'  // Correction : 1200 → 900
      },
      emptyWeight: '900'  // Pour rétrocompatibilité
    };

    console.log('📤 Envoi de la mise à jour vers Supabase...');
    console.log('   Données envoyées:', {
      id: updatedFHSTR.id,
      registration: updatedFHSTR.registration,
      'weights.emptyWeight': updatedFHSTR.weights.emptyWeight
    });

    // 6. Appeler updateAircraft
    const result = await store.updateAircraft(updatedFHSTR);

    // 7. Vérifier le résultat
    if (!result) {
      console.error('❌ updateAircraft a retourné null/undefined');
      console.log('   Cela signifie probablement que la mise à jour a échoué');
      return;
    }

    console.log('✅ Mise à jour locale réussie !');
    console.log('📋 Résultat de updateAircraft:');
    console.log('  - weights.emptyWeight:', result.weights?.emptyWeight);
    console.log('  - emptyWeight (legacy):', result.emptyWeight);

    // 8. Attendre un peu pour que Supabase termine (c'est asynchrone en arrière-plan)
    console.log('⏳ Attente de 2 secondes pour la sauvegarde Supabase...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 9. Recharger depuis Supabase pour vérifier
    console.log('🔄 Rechargement depuis Supabase pour vérification...');
    await store.loadFromSupabase();

    const fhstrVerified = store.aircraftList.find(a => a.registration === 'F-HSTR');
    const verifiedEmptyWeight = parseFloat(fhstrVerified.weights?.emptyWeight || fhstrVerified.emptyWeight);

    console.log('📋 Données APRÈS correction (depuis Supabase):');
    console.log('  - weights.emptyWeight:', fhstrVerified.weights?.emptyWeight);
    console.log('  - emptyWeight (legacy):', fhstrVerified.emptyWeight);

    if (verifiedEmptyWeight === 900) {
      console.log('');
      console.log('✅✅✅ SUCCÈS CONFIRMÉ ! ✅✅✅');
      console.log('');
      console.log('La masse à vide de F-HSTR est maintenant 900 kg dans Supabase');
      console.log('Bras à vide:', fhstrVerified.arms?.empty || fhstrVerified.weightBalance?.emptyWeightArm, 'm');
      console.log('Moment à vide:', (900 * parseFloat(fhstrVerified.arms?.empty || fhstrVerified.weightBalance?.emptyWeightArm || 2.45)).toFixed(1), 'kg.m');
      console.log('');
      console.log('🔄 Rechargez la page (F5) pour voir les changements partout !');
    } else {
      console.error('');
      console.error('❌❌❌ ÉCHEC DE LA SAUVEGARDE ❌❌❌');
      console.error('');
      console.error('La masse dans Supabase est toujours:', verifiedEmptyWeight, 'kg');
      console.error('');
      console.error('SOLUTION : Utilisez la méthode manuelle');
      console.error('1. Allez dans le module "Avions"');
      console.error('2. Sélectionnez F-HSTR');
      console.error('3. Cliquez sur "Modifier"');
      console.error('4. Changez la masse de', verifiedEmptyWeight, 'à 900');
      console.error('5. Enregistrez');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    console.error('Stack:', error.stack);
  }
})();
