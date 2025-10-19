// Fonction pour forcer l'édition d'une entrée du carnet de vol

export const forceEdit = () => {
  

  // Récupérer le carnet
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (logbook.length === 0) {
    
    return;
  }

  // Trouver l'entrée du 2025-09-29
  const targetEntry = logbook.find(entry =>
    entry.date === '2025-09-29' ||
    (entry.departure === 'LFST' && entry.arrival === 'LFGA')

  if (!targetEntry) {
    
    logbook.forEach((entry, idx) => {
      
    });
     pour éditer la première entrée');
    return;
  }

  

  // Créer un événement personnalisé pour ouvrir le formulaire
  const editEvent = new CustomEvent('force-edit-entry', { detail: targetEntry });
  window.dispatchEvent(editEvent);

  
  
  
  

  return targetEntry;
};

export const editByIndex = (index = 0) => {
  

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (!logbook[index]) {
    
     dans le carnet (indices 0-${logbook.length - 1})`);
    return;
  }

  const entry = logbook[index];
  

  // Si pas de segments, en créer
  if (!entry.flightSegments || entry.flightSegments.length === 0) {
    

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
    
  }

  // Stocker temporairement l'entrée à éditer
  sessionStorage.setItem('editEntry', JSON.stringify(entry));
  return entry;
};

export const loadStoredEntry = () => {
  const entry = JSON.parse(sessionStorage.getItem('editEntry') || 'null');

  if (!entry) {
    return;
  }

  
  

  // Déclencher l'ouverture du formulaire avec les données
  window.pendingEditEntry = entry;

  return entry;
};

export const deleteEntry = (index = 0) => {
  

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (!logbook[index]) {
    
    return;
  }

  const entry = logbook[index];
  

  if (confirm(`Confirmer la suppression de: ${entry.date} ${entry.departure}-${entry.arrival}?`)) {
    logbook.splice(index, 1);
    localStorage.setItem('pilotLogbook', JSON.stringify(logbook));
    
    
    return true;
  }

  
  return false;
};

// Export par défaut
export default {
  forceEdit,
  editByIndex,
  loadStoredEntry,
  deleteEntry
};