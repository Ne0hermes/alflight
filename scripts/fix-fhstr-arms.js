// Script de correction F-HSTR - Mise à jour weightBalance depuis arms

(async function fixFHSTRArms() {
  console.log('🔧 [FIX] Correction weightBalance F-HSTR depuis arms...');

  try {
    // 1. Importer Supabase client
    console.log('📦 [FIX] Import Supabase client...');
    const { supabase } = await import('/src/services/supabaseClient.js');
    console.log('✅ [FIX] Supabase importé');

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

    // 3. Afficher les données actuelles
    console.log('');
    console.log('📊 [FIX] Données AVANT correction:');
    console.log('  - arms.empty:', fhstr.aircraft_data.arms.empty);
    console.log('  - arms.fuelMain:', fhstr.aircraft_data.arms.fuelMain);
    console.log('  - arms.frontSeats:', fhstr.aircraft_data.arms.frontSeats);
    console.log('  - arms.rearSeats:', fhstr.aircraft_data.arms.rearSeats);
    console.log('');
    console.log('  - weightBalance.emptyWeightArm:', fhstr.aircraft_data.weightBalance.emptyWeightArm);
    console.log('  - weightBalance.fuelArm:', fhstr.aircraft_data.weightBalance.fuelArm);
    console.log('  - weightBalance.frontLeftSeatArm:', fhstr.aircraft_data.weightBalance.frontLeftSeatArm);
    console.log('  - weightBalance.rearLeftSeatArm:', fhstr.aircraft_data.weightBalance.rearLeftSeatArm);
    console.log('');

    // 4. Créer le nouveau weightBalance depuis arms (source de vérité)
    const parseArm = (value, defaultValue = 0) => {
      if (!value || value === '') return defaultValue;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const newWeightBalance = {
      emptyWeightArm: parseArm(fhstr.aircraft_data.arms.empty),
      fuelArm: parseArm(fhstr.aircraft_data.arms.fuelMain),
      frontLeftSeatArm: parseArm(fhstr.aircraft_data.arms.frontSeats),
      frontRightSeatArm: parseArm(fhstr.aircraft_data.arms.frontSeats),
      rearLeftSeatArm: parseArm(fhstr.aircraft_data.arms.rearSeats),
      rearRightSeatArm: parseArm(fhstr.aircraft_data.arms.rearSeats),
      baggageArm: parseArm(fhstr.aircraft_data.arms.baggageFwd || 3.5),
      auxiliaryArm: parseArm(fhstr.aircraft_data.arms.baggageAft || 3.7),
      // Conserver cgLimits
      cgLimits: fhstr.aircraft_data.weightBalance.cgLimits
    };

    console.log('📊 [FIX] Nouveau weightBalance (depuis arms):');
    console.log('  - emptyWeightArm:', newWeightBalance.emptyWeightArm, '(was:', fhstr.aircraft_data.weightBalance.emptyWeightArm, ')');
    console.log('  - fuelArm:', newWeightBalance.fuelArm, '(was:', fhstr.aircraft_data.weightBalance.fuelArm, ')');
    console.log('  - frontLeftSeatArm:', newWeightBalance.frontLeftSeatArm, '(was:', fhstr.aircraft_data.weightBalance.frontLeftSeatArm, ')');
    console.log('  - rearLeftSeatArm:', newWeightBalance.rearLeftSeatArm, '(was:', fhstr.aircraft_data.weightBalance.rearLeftSeatArm, ')');
    console.log('');

    // 5. Mettre à jour dans Supabase
    console.log('📦 [FIX] Mise à jour dans Supabase...');
    const updatedAircraftData = {
      ...fhstr.aircraft_data,
      weightBalance: newWeightBalance
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
    console.log('  - emptyWeightArm:', updated.aircraft_data.weightBalance.emptyWeightArm);
    console.log('  - fuelArm:', updated.aircraft_data.weightBalance.fuelArm);
    console.log('  - frontLeftSeatArm:', updated.aircraft_data.weightBalance.frontLeftSeatArm);
    console.log('  - rearLeftSeatArm:', updated.aircraft_data.weightBalance.rearLeftSeatArm);
    console.log('');

    // 7. Calcul CG attendu
    const emptyWeight = 900;
    const frontLeft = 75;
    const fuel = 102;

    const oldMoment = emptyWeight * fhstr.aircraft_data.weightBalance.emptyWeightArm +
                      frontLeft * fhstr.aircraft_data.weightBalance.frontLeftSeatArm +
                      fuel * fhstr.aircraft_data.weightBalance.fuelArm;
    const oldCG = oldMoment / (emptyWeight + frontLeft + fuel);

    const newMoment = emptyWeight * newWeightBalance.emptyWeightArm +
                      frontLeft * newWeightBalance.frontLeftSeatArm +
                      fuel * newWeightBalance.fuelArm;
    const newCG = newMoment / (emptyWeight + frontLeft + fuel);

    console.log('📐 [FIX] Test calcul CG (900 kg + 75 kg + 102 kg fuel):');
    console.log('  - CG AVANT:', oldCG.toFixed(4), 'm =', (oldCG * 1000).toFixed(0), 'mm ❌');
    console.log('  - CG APRÈS:', newCG.toFixed(4), 'm =', (newCG * 1000).toFixed(0), 'mm ✅');
    console.log('  - Différence:', ((newCG - oldCG) * 1000).toFixed(0), 'mm');
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
