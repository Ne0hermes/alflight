// Test pour vérifier que les segments de vol sont correctement calculés

export const testFlightSegments = () => {
  console.log('🧪 === TEST DES SEGMENTS DE VOL ===');

  // Récupérer le carnet de vol
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  console.log(`📚 Nombre total d'entrées: ${logbook.length}`);

  // Analyser chaque entrée
  logbook.forEach((entry, index) => {
    console.log(`\n✈️ Entrée ${index + 1} - ${entry.date}:`);
    console.log(`  Départ: ${entry.departure} → Arrivée: ${entry.arrival}`);
    console.log(`  Temps total: ${entry.totalTime}`);

    if (entry.flightSegments && Array.isArray(entry.flightSegments)) {
      console.log(`  📊 Segments de vol (${entry.flightSegments.length}):`);

      let totalSegmentTime = 0;
      let cdbTime = 0;
      let oplTime = 0;
      let nightTime = 0;
      let ifrTime = 0;

      entry.flightSegments.forEach((segment, segIndex) => {
        const time = parseFloat(segment.time) || 0;
        totalSegmentTime += time;

        console.log(`    Segment ${segIndex + 1}:`);
        console.log(`      - Temps: ${time}h`);
        console.log(`      - Type: ${segment.flightType || 'Non défini'}`);
        console.log(`      - Fonction: ${segment.functionOnBoard || 'Non définie'}`);
        console.log(`      - CDB: ${segment.pilotInCommand || 'Non défini'}`);

        // Calculer les totaux par fonction
        if (segment.functionOnBoard === 'pic') cdbTime += time;
        if (segment.functionOnBoard === 'copilot') oplTime += time;

        // Calculer les heures de nuit et IFR
        if (segment.flightType === 'vfr-night' || segment.flightType === 'ifr-night') {
          nightTime += time;
        }
        if (segment.flightType === 'ifr-day' || segment.flightType === 'ifr-night') {
          ifrTime += time;
        }
      });

      console.log(`  ✅ Résumé des segments:`);
      console.log(`     - Total segments: ${totalSegmentTime.toFixed(1)}h`);
      console.log(`     - CDB (P1): ${cdbTime.toFixed(1)}h`);
      console.log(`     - Copilote (P2/OPL): ${oplTime.toFixed(1)}h`);
      console.log(`     - Nuit: ${nightTime.toFixed(1)}h`);
      console.log(`     - IFR: ${ifrTime.toFixed(1)}h`);
    } else {
      console.log(`  ⚠️ Pas de segments de vol (ancienne entrée)`);
    }
  });

  return logbook;
};

export const addTestFlightWithSegments = () => {
  console.log('➕ === AJOUT D\'UN VOL TEST AVEC SEGMENTS ===');

  const testFlight = {
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    departure: 'LFPG',
    arrival: 'LFBO',
    route: 'Direct',
    aircraft: 'F-TEST',
    aircraftType: 'C172',
    aircraftGroup: 'singleEngine',
    pilotInCommand: 'Jean DUPONT',
    copilot: 'Marie MARTIN',
    blockOff: '10:00',
    takeOff: '10:15',
    landing: '14:00',
    blockOn: '14:15',
    totalTime: '4:15',
    flightSegments: [
      {
        id: 1,
        time: '2.5', // 2h30 en décimal
        flightType: 'vfr-day',
        functionOnBoard: 'pic',
        pilotInCommand: 'Jean DUPONT'
      },
      {
        id: 2,
        time: '1', // 1h00
        flightType: 'vfr-night',
        functionOnBoard: 'copilot',
        pilotInCommand: 'Marie MARTIN'
      },
      {
        id: 3,
        time: '0.75', // 45min
        flightType: 'ifr-day',
        functionOnBoard: 'pic',
        pilotInCommand: 'Jean DUPONT'
      }
    ],
    dayTakeoffs: 1,
    nightTakeoffs: 0,
    dayLandings: 1,
    nightLandings: 0,
    remarks: 'Vol test avec segments multiples',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Récupérer le carnet existant
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  // Ajouter le nouveau vol
  logbook.push(testFlight);

  // Sauvegarder
  localStorage.setItem('pilotLogbook', JSON.stringify(logbook));

  console.log('✅ Vol test ajouté avec succès!');
  console.log('📊 Segments ajoutés:');
  console.log('  - 2h30 VFR Jour en CDB');
  console.log('  - 1h00 VFR Nuit en Copilote');
  console.log('  - 0h45 IFR Jour en CDB');
  console.log('\n💡 Rafraîchissez la page pour voir les statistiques mises à jour');

  return testFlight;
};

export const clearTestFlights = () => {
  console.log('🗑️ === SUPPRESSION DES VOLS TEST ===');

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  const filtered = logbook.filter(entry => !entry.aircraft?.includes('F-TEST'));

  localStorage.setItem('pilotLogbook', JSON.stringify(filtered));

  console.log(`✅ ${logbook.length - filtered.length} vol(s) test supprimé(s)`);
  console.log('💡 Rafraîchissez la page pour voir les changements');

  return filtered;
};

// Export par défaut
export default {
  testFlightSegments,
  addTestFlightWithSegments,
  clearTestFlights
};