// Script de correction F-HSTR - Version 3 DEBUG (avec logs détaillés)

(async function fixFHSTRv3() {
  console.log('🔧 [V3] Début correction F-HSTR...');

  try {
    console.log('📦 [V3] Step 1: Import du store...');
    const { useAircraftStore } = await import('/src/core/stores/aircraftStore.js');
    console.log('✅ [V3] Store importé');

    console.log('📦 [V3] Step 2: Récupération du state...');
    const store = useAircraftStore.getState();
    console.log('✅ [V3] State récupéré');

    console.log('📦 [V3] Step 3: Rechargement depuis Supabase...');
    await store.loadFromSupabase();
    console.log('✅ [V3] Rechargement terminé');

    console.log('📦 [V3] Step 4: Recherche de F-HSTR...');
    const fhstr = store.aircraftList.find(a => a.registration === 'F-HSTR');

    if (!fhstr) {
      console.error('❌ [V3] F-HSTR non trouvé dans aircraftList');
      console.log('Liste des avions:', store.aircraftList.map(a => a.registration));
      return;
    }
    console.log('✅ [V3] F-HSTR trouvé, ID:', fhstr.id);

    console.log('📦 [V3] Step 5: Affichage données AVANT...');
    console.log('  - ID:', fhstr.id);
    console.log('  - Registration:', fhstr.registration);
    console.log('  - weights:', fhstr.weights);
    console.log('  - weights.emptyWeight:', fhstr.weights?.emptyWeight);
    console.log('  - emptyWeight (legacy):', fhstr.emptyWeight);

    const currentWeight = parseFloat(fhstr.weights?.emptyWeight || fhstr.emptyWeight);
    console.log('  - Masse actuelle (parsée):', currentWeight, 'kg');

    if (currentWeight === 900) {
      console.log('✅ [V3] Masse déjà à 900 kg. Rien à faire !');
      return;
    }

    console.log('📦 [V3] Step 6: Création de l\'avion mis à jour...');
    const updated = {
      ...fhstr,
      weights: {
        ...fhstr.weights,
        emptyWeight: '900'
      },
      emptyWeight: '900'
    };
    console.log('✅ [V3] Objet updated créé');
    console.log('  - updated.weights.emptyWeight:', updated.weights.emptyWeight);

    console.log('📦 [V3] Step 7: Appel updateAircraft...');
    const result = await store.updateAircraft(updated);
    console.log('✅ [V3] updateAircraft terminé');
    console.log('  - Résultat:', result);

    if (!result) {
      console.error('❌ [V3] updateAircraft a retourné null/undefined');
      return;
    }

    console.log('✅ [V3] Mise à jour locale réussie');
    console.log('  - result.weights.emptyWeight:', result.weights?.emptyWeight);

    console.log('📦 [V3] Step 8: Attente 2 secondes...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ [V3] Attente terminée');

    console.log('📦 [V3] Step 9: Rechargement depuis Supabase (vérification)...');
    await store.loadFromSupabase();
    console.log('✅ [V3] Rechargement terminé');

    console.log('📦 [V3] Step 10: Vérification finale...');
    const verified = store.aircraftList.find(a => a.registration === 'F-HSTR');
    const verifiedWeight = parseFloat(verified.weights?.emptyWeight || verified.emptyWeight);
    console.log('  - Masse après rechargement:', verifiedWeight, 'kg');

    if (verifiedWeight === 900) {
      console.log('');
      console.log('✅✅✅ [V3] SUCCÈS CONFIRMÉ ! ✅✅✅');
      console.log('');
      console.log('La masse est maintenant 900 kg dans Supabase !');
      console.log('🔄 Rechargez la page (F5)');
    } else {
      console.log('');
      console.error('❌❌❌ [V3] ÉCHEC ❌❌❌');
      console.log('');
      console.error('Masse toujours à', verifiedWeight, 'kg dans Supabase');
      console.log('');
      console.log('SOLUTION : Méthode manuelle');
      console.log('1. Module "Avions"');
      console.log('2. Sélectionner F-HSTR');
      console.log('3. Cliquer "Modifier"');
      console.log('4. Changer masse de', verifiedWeight, 'à 900');
      console.log('5. Enregistrer');
    }

  } catch (error) {
    console.error('❌ [V3] ERREUR CRITIQUE:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
})();
