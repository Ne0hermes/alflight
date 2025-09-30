// Analyser en détail une entrée de vol spécifique
export const analyzeFlightEntry = (date = '2025-09-29') => {
  console.log('🔍 === ANALYSE DÉTAILLÉE ENTRÉE ===');
  console.log(`📅 Date recherchée: ${date}`);

  // Récupérer le carnet
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  // Trouver l'entrée
  const entry = logbook.find(e => e.date === date);

  if (!entry) {
    console.log('❌ Entrée non trouvée');
    return null;
  }

  console.log('\n📊 === DONNÉES DE L\'ENTRÉE ===');
  console.log('✈️ Vol:', `${entry.departure} → ${entry.arrival}`);
  console.log('🛩️ Avion:', entry.aircraft);
  console.log('⏱️ Temps total:', entry.totalTime);
  console.log('💬 Remarques:', entry.remarks || 'Aucune');

  // Analyser les segments
  console.log('\n📐 === SEGMENTS DE VOL ===');
  if (entry.flightSegments && Array.isArray(entry.flightSegments)) {
    console.log(`Nombre de segments: ${entry.flightSegments.length}`);

    let totalCDB = 0;
    let totalOPL = 0;
    let totalDC = 0;
    let totalINST = 0;
    let totalSegmentTime = 0;

    entry.flightSegments.forEach((segment, index) => {
      console.log(`\n  Segment ${index + 1}:`);
      console.log(`    - Temps: ${segment.time}h`);
      console.log(`    - Type de vol: ${segment.flightType || 'Non défini'}`);
      console.log(`    - Fonction: ${segment.functionOnBoard || 'Non définie'}`);
      console.log(`    - CDB: ${segment.pilotInCommand || 'Non défini'}`);

      const segmentTime = parseFloat(segment.time) || 0;
      totalSegmentTime += segmentTime;

      // Calculer les heures par fonction
      switch(segment.functionOnBoard) {
        case 'pic':
        case 'cdb':
          totalCDB += segmentTime;
          break;
        case 'copilot':
        case 'opl':
          totalOPL += segmentTime;
          break;
        case 'dualCommand':
        case 'dc':
          totalDC += segmentTime;
          break;
        case 'instructor':
        case 'inst':
          totalINST += segmentTime;
          break;
      }
    });

    console.log('\n📊 === RÉPARTITION DES HEURES ===');
    console.log(`⏱️ Total segments: ${totalSegmentTime.toFixed(2)}h`);
    console.log(`👨‍✈️ CDB (Commandant de bord): ${totalCDB.toFixed(2)}h`);
    console.log(`👨‍✈️ OPL (Copilote): ${totalOPL.toFixed(2)}h`);
    console.log(`👨‍✈️ DC (Double commande): ${totalDC.toFixed(2)}h`);
    console.log(`👨‍✈️ INST (Instructeur): ${totalINST.toFixed(2)}h`);

    // Vérifier la cohérence
    const totalTime = entry.totalTime.includes(':')
      ? parseFloat(entry.totalTime.split(':')[0]) + (parseFloat(entry.totalTime.split(':')[1]) / 60)
      : parseFloat(entry.totalTime);

    console.log('\n⚠️ === VÉRIFICATION COHÉRENCE ===');
    console.log(`Temps total déclaré: ${totalTime.toFixed(2)}h`);
    console.log(`Somme des segments: ${totalSegmentTime.toFixed(2)}h`);

    if (Math.abs(totalTime - totalSegmentTime) > 0.01) {
      console.log('❌ INCOHÉRENCE: La somme des segments ne correspond pas au temps total');
    } else {
      console.log('✅ Les temps sont cohérents');
    }

  } else {
    console.log('❌ Pas de segments définis');
    console.log('💡 Cette entrée n\'a pas de détail par segment');
  }

  // Analyser les autres champs temporels
  console.log('\n⏰ === AUTRES TEMPS ===');
  console.log('🌙 Temps de nuit:', entry.nightTime || '0');
  console.log('☁️ Temps IFR:', entry.ifrTime || '0');
  console.log('🗺️ Voyage:', entry.crossCountryTime || '0');

  // Atterrissages
  console.log('\n🛬 === ATTERRISSAGES ===');
  console.log('☀️ Jour:', entry.dayLandings || '0');
  console.log('🌙 Nuit:', entry.nightLandings || '0');

  return entry;
};

// Fonction pour corriger la répartition des heures
export const fixFlightSegments = (date = '2025-09-29') => {
  console.log('🔧 === CORRECTION SEGMENTS ===');

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  const index = logbook.findIndex(e => e.date === date);

  if (index === -1) {
    console.log('❌ Entrée non trouvée');
    return;
  }

  const entry = logbook[index];
  console.log('📝 Entrée trouvée:', entry);

  // Calculer le temps total
  let totalTime = 0;
  if (entry.totalTime) {
    if (entry.totalTime.includes(':')) {
      const [h, m] = entry.totalTime.split(':').map(Number);
      totalTime = h + (m / 60);
    } else {
      totalTime = parseFloat(entry.totalTime);
    }
  }

  console.log(`⏱️ Temps total: ${totalTime.toFixed(2)}h (${entry.totalTime})`);

  // Proposer une correction
  console.log('\n💡 Proposition de correction:');
  console.log('Voulez-vous répartir les heures comme suit ?');
  console.log(`1. Tout en CDB: ${totalTime.toFixed(2)}h`);
  console.log(`2. Moitié CDB (${(totalTime/2).toFixed(2)}h), moitié OPL (${(totalTime/2).toFixed(2)}h)`);
  console.log(`3. Personnalisé`);

  // Créer les nouveaux segments
  const newSegments = [
    {
      id: 1,
      time: totalTime.toString(),
      flightType: 'vfr-day',
      functionOnBoard: 'pic',
      pilotInCommand: 'CESAR LE MESSAGER'
    }
  ];

  entry.flightSegments = newSegments;
  logbook[index] = entry;

  console.log('\n✅ Segments créés:', newSegments);
  console.log('💾 Pour sauvegarder, exécutez: saveFlightCorrection()');

  // Stocker temporairement
  window.pendingFlightCorrection = { logbook, index, entry };

  return entry;
};

// Fonction pour sauvegarder la correction
export const saveFlightCorrection = () => {
  if (!window.pendingFlightCorrection) {
    console.log('❌ Aucune correction en attente');
    return;
  }

  const { logbook } = window.pendingFlightCorrection;
  localStorage.setItem('pilotLogbook', JSON.stringify(logbook));

  console.log('✅ Correction sauvegardée !');
  console.log('🔄 Rafraîchissez la page pour voir les changements');

  delete window.pendingFlightCorrection;
  return true;
};

// Export pour la console
if (typeof window !== 'undefined') {
  window.analyzeEntry = analyzeFlightEntry;
  window.fixSegments = fixFlightSegments;
  window.saveCorrection = saveFlightCorrection;
}

export default {
  analyzeFlightEntry,
  fixFlightSegments,
  saveFlightCorrection
};