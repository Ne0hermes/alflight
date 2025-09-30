// Debug pour l'édition des entrées du carnet de vol

export const debugEditLogbook = () => {
  console.log('🔍 === DEBUG ÉDITION CARNET DE VOL ===');

  // Récupérer le carnet
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (logbook.length === 0) {
    console.log('❌ Aucune entrée dans le carnet');
    return;
  }

  console.log(`📚 ${logbook.length} entrée(s) trouvée(s)`);

  // Afficher chaque entrée avec ses segments
  logbook.forEach((entry, index) => {
    console.log(`\n📝 Entrée ${index + 1}:`);
    console.log(`  Date: ${entry.date}`);
    console.log(`  Trajet: ${entry.departure} → ${entry.arrival}`);
    console.log(`  Avion: ${entry.aircraft}`);
    console.log(`  Temps total: ${entry.totalTime}`);
    console.log(`  ID: ${entry.id}`);

    if (entry.flightSegments) {
      console.log(`  ✅ Segments présents: ${entry.flightSegments.length}`);
      entry.flightSegments.forEach((seg, i) => {
        console.log(`    - Segment ${i + 1}: ${seg.time}h ${seg.functionOnBoard} ${seg.flightType}`);
      });
    } else {
      console.log(`  ⚠️ Pas de segments (ancienne entrée)`);
    }
  });

  return logbook;
};

export const testEditEntry = (entryIndex = 0) => {
  console.log('🔧 === TEST ÉDITION D\'UNE ENTRÉE ===');

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (logbook.length === 0 || !logbook[entryIndex]) {
    console.log('❌ Entrée non trouvée');
    return;
  }

  const entry = logbook[entryIndex];
  console.log('📝 Entrée à éditer:', entry);

  // Simuler l'édition
  console.log('\n🎯 Pour éditer cette entrée dans l\'interface:');
  console.log('1. Cliquez sur le bouton crayon à côté de l\'entrée');
  console.log('2. Le formulaire devrait s\'ouvrir avec les données');
  console.log('3. Les segments devraient être chargés si présents');

  // Vérifier si les segments seraient correctement chargés
  if (entry.flightSegments && entry.flightSegments.length > 0) {
    console.log('\n✅ Segments qui seront chargés:');
    entry.flightSegments.forEach((seg, i) => {
      console.log(`  Segment ${i + 1}:`);
      console.log(`    Temps: ${seg.time}h`);
      console.log(`    Type: ${seg.flightType || 'Non défini'}`);
      console.log(`    Fonction: ${seg.functionOnBoard || 'Non définie'}`);
      console.log(`    CDB: ${seg.pilotInCommand || 'Non défini'}`);
    });
  } else {
    console.log('\n⚠️ Pas de segments - un segment par défaut sera créé:');
    console.log(`  Temps: ${entry.totalTime}`);
    console.log(`  Type: ${entry.flightType || 'Non défini'}`);
    console.log(`  Fonction: ${entry.functionOnBoard || 'Non définie'}`);
    console.log(`  CDB: ${entry.pilotInCommand || 'Non défini'}`);
  }

  return entry;
};

export const fixMissingSegments = () => {
  console.log('🔧 === CORRECTION DES ENTRÉES SANS SEGMENTS ===');

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  let fixed = 0;

  const updatedLogbook = logbook.map(entry => {
    if (!entry.flightSegments || entry.flightSegments.length === 0) {
      // Créer un segment par défaut avec les données existantes
      entry.flightSegments = [{
        id: 1,
        time: entry.totalTime ?
          (entry.totalTime.includes(':') ?
            ((parseInt(entry.totalTime.split(':')[0]) + parseInt(entry.totalTime.split(':')[1])/60).toString())
            : entry.totalTime.toString())
          : '0',
        flightType: entry.flightType || 'vfr-day',
        functionOnBoard: entry.functionOnBoard || 'pic',
        pilotInCommand: entry.pilotInCommand || ''
      }];
      fixed++;
      console.log(`✅ Segments ajoutés pour: ${entry.date} ${entry.departure}-${entry.arrival}`);
    }
    return entry;
  });

  if (fixed > 0) {
    localStorage.setItem('pilotLogbook', JSON.stringify(updatedLogbook));
    console.log(`\n✅ ${fixed} entrée(s) corrigée(s)`);
    console.log('💡 Rafraîchissez la page pour voir les changements');
  } else {
    console.log('✅ Toutes les entrées ont déjà des segments');
  }

  return updatedLogbook;
};

export default {
  debugEditLogbook,
  testEditEntry,
  fixMissingSegments
};