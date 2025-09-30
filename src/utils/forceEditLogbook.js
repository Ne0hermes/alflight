// Fonction pour forcer l'édition d'une entrée du carnet de vol

export const forceEdit = () => {
  console.log('🔧 === FORCER L\'ÉDITION D\'UNE ENTRÉE ===');

  // Récupérer le carnet
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (logbook.length === 0) {
    console.log('❌ Aucune entrée dans le carnet');
    return;
  }

  // Trouver l'entrée du 2025-09-29
  const targetEntry = logbook.find(entry =>
    entry.date === '2025-09-29' ||
    (entry.departure === 'LFST' && entry.arrival === 'LFGA')
  );

  if (!targetEntry) {
    console.log('❌ Entrée non trouvée. Voici les entrées disponibles:');
    logbook.forEach((entry, idx) => {
      console.log(`${idx}: ${entry.date} ${entry.departure}-${entry.arrival}`);
    });
    console.log('Utilisez: forceEdit.editByIndex(0) pour éditer la première entrée');
    return;
  }

  console.log('✅ Entrée trouvée:', targetEntry);

  // Créer un événement personnalisé pour ouvrir le formulaire
  const editEvent = new CustomEvent('force-edit-entry', { detail: targetEntry });
  window.dispatchEvent(editEvent);

  console.log('📝 Instructions:');
  console.log('1. Si le formulaire ne s\'ouvre pas automatiquement');
  console.log('2. Essayez de cliquer sur "Ajouter un vol"');
  console.log('3. Les données de l\'entrée seront pré-remplies');

  return targetEntry;
};

export const editByIndex = (index = 0) => {
  console.log(`🔧 === ÉDITER L'ENTRÉE ${index} ===`);

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (!logbook[index]) {
    console.log(`❌ Aucune entrée à l'index ${index}`);
    console.log(`Il y a ${logbook.length} entrée(s) dans le carnet (indices 0-${logbook.length - 1})`);
    return;
  }

  const entry = logbook[index];
  console.log('✅ Entrée à éditer:', entry);

  // Si pas de segments, en créer
  if (!entry.flightSegments || entry.flightSegments.length === 0) {
    console.log('⚠️ Ajout de segments manquants...');

    // Convertir le temps en décimal si nécessaire
    let timeDecimal = 0;
    if (entry.totalTime) {
      if (entry.totalTime.includes(':')) {
        const [h, m] = entry.totalTime.split(':').map(Number);
        timeDecimal = h + (m / 60);
      } else {
        timeDecimal = parseFloat(entry.totalTime) || 0;
      }
    }

    entry.flightSegments = [{
      id: 1,
      time: timeDecimal.toString(),
      flightType: entry.flightType || 'vfr-day',
      functionOnBoard: entry.functionOnBoard || 'pic',
      pilotInCommand: entry.pilotInCommand || ''
    }];

    // Sauvegarder l'entrée mise à jour
    logbook[index] = entry;
    localStorage.setItem('pilotLogbook', JSON.stringify(logbook));
    console.log('✅ Segments ajoutés et sauvegardés');
  }

  // Stocker temporairement l'entrée à éditer
  sessionStorage.setItem('editEntry', JSON.stringify(entry));

  console.log('📝 Instructions pour éditer:');
  console.log('1. Rafraîchissez la page (F5)');
  console.log('2. Dans la console, tapez: forceEditEntry.loadStoredEntry()');
  console.log('3. Cliquez sur "Ajouter un vol" - les données seront pré-chargées');

  return entry;
};

export const loadStoredEntry = () => {
  const entry = JSON.parse(sessionStorage.getItem('editEntry') || 'null');

  if (!entry) {
    console.log('❌ Aucune entrée stockée. Utilisez d\'abord editByIndex(0)');
    return;
  }

  console.log('✅ Entrée chargée:', entry);
  console.log('🎯 Cliquez maintenant sur "Ajouter un vol" pour ouvrir le formulaire');

  // Déclencher l'ouverture du formulaire avec les données
  window.pendingEditEntry = entry;

  return entry;
};

export const deleteEntry = (index = 0) => {
  console.log(`🗑️ === SUPPRIMER L'ENTRÉE ${index} ===`);

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (!logbook[index]) {
    console.log(`❌ Aucune entrée à l'index ${index}`);
    return;
  }

  const entry = logbook[index];
  console.log('⚠️ Suppression de:', entry);

  if (confirm(`Confirmer la suppression de: ${entry.date} ${entry.departure}-${entry.arrival}?`)) {
    logbook.splice(index, 1);
    localStorage.setItem('pilotLogbook', JSON.stringify(logbook));
    console.log('✅ Entrée supprimée');
    console.log('💡 Rafraîchissez la page pour voir les changements');
    return true;
  }

  console.log('❌ Suppression annulée');
  return false;
};

// Export par défaut
export default {
  forceEdit,
  editByIndex,
  loadStoredEntry,
  deleteEntry
};