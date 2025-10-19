// Fonction pour réparer et éditer l'entrée du 2025-09-29
export const fixAndEditEntry20250929 = () => {
  

  // Récupérer le carnet
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  // Trouver l'entrée spécifique
  const entryIndex = logbook.findIndex(entry =>
    entry.date === '2025-09-29' &&
    entry.departure === 'LFSA' &&
    entry.arrival === 'LFGA'

  if (entryIndex === -1) {
    

    // Afficher toutes les entrées du 2025-09-29
    const entries29 = logbook.filter(e => e.date === '2025-09-29');
    

    if (entries29.length === 0) {
      
      return null;
    }

    // Prendre la première entrée de cette date
    const targetEntry = entries29[0];
    const index = logbook.findIndex(e => e.id === targetEntry.id);

    if (index !== -1) {
      return repairAndPrepareEntry(logbook, index);
    }

    return null;
  }

  return repairAndPrepareEntry(logbook, entryIndex);
};

const repairAndPrepareEntry = (logbook, index) => {
  const entry = { ...logbook[index] };

  

  // Vérifier et réparer les segments
  if (!entry.flightSegments || entry.flightSegments.length === 0) {
    

    // Calculer le temps total
    let totalTime = 0;
    if (entry.totalTime) {
      if (typeof entry.totalTime === 'string' && entry.totalTime.includes(':')) {
        const [h, m] = entry.totalTime.split(':').map(Number);
        totalTime = h + (m / 60);
      } else {
        totalTime = parseFloat(entry.totalTime) || 0;
      }
    }

    // Si pas de temps total mais des temps partiels
    if (totalTime === 0) {
      const blockTime = calculateBlockTime(entry.blockOff, entry.blockOn);
      if (blockTime > 0) {
        totalTime = blockTime;
      }
    }

    // Créer les segments basés sur les informations disponibles
    const segments = [];

    // Si on a des informations sur le type de vol
    if (entry.functionOnBoard || entry.pic || entry.copilot) {
      let functionType = 'pic';
      if (entry.functionOnBoard) {
        functionType = entry.functionOnBoard;
      } else if (entry.copilot) {
        functionType = 'copilot';
      }

      // Déterminer le type de vol
      let flightType = 'vfr-day';
      if (entry.nightTime && parseFloat(entry.nightTime) > 0) {
        flightType = 'vfr-night';
      }
      if (entry.ifrTime && parseFloat(entry.ifrTime) > 0) {
        flightType = entry.nightTime ? 'ifr-night' : 'ifr-day';
      }

      segments.push({
        id: 1,
        time: totalTime.toString(),
        flightType: flightType,
        functionOnBoard: functionType,
        pilotInCommand: entry.pilotInCommand || ''
      });
    } else {
      // Segment par défaut
      segments.push({
        id: 1,
        time: totalTime.toString(),
        flightType: 'vfr-day',
        functionOnBoard: 'pic',
        pilotInCommand: ''
      });
    }

    entry.flightSegments = segments;

    // Sauvegarder l'entrée réparée
    logbook[index] = entry;
    localStorage.setItem('pilotLogbook', JSON.stringify(logbook));
    
  }

  // Stocker l'entrée pour édition
  window.pendingEditEntry = entry;
  sessionStorage.setItem('editEntry2029', JSON.stringify(entry));
  return entry;
};

const calculateBlockTime = (blockOff, blockOn) => {
  if (!blockOff || !blockOn) return 0;

  try {
    const off = new Date(`1970-01-01T${blockOff}`);
    const on = new Date(`1970-01-01T${blockOn}`);
    const diff = (on - off) / (1000 * 60 * 60);
    return diff > 0 ? diff : 0;
  } catch (e) {
    return 0;
  }
};

// Fonction pour ouvrir directement le formulaire
export const openEditForm = () => {
  const entry = window.pendingEditEntry || JSON.parse(sessionStorage.getItem('editEntry2029') || 'null');

  if (!entry) {
    return;
  }

  // Simuler un clic sur le bouton d'édition
  const editButtons = document.querySelectorAll('button');
  for (const btn of editButtons) {
    const parent = btn.closest('tr') || btn.closest('div');
    if (parent && parent.textContent.includes('2025-09-29') && parent.textContent.includes('LFGA')) {
      
      btn.click();
      return;
    }
  }

  
};

// Fonction pour forcer l'ouverture avec les données
export const forceOpenWithData = () => {
  const entry = window.pendingEditEntry || JSON.parse(sessionStorage.getItem('editEntry2029') || 'null');

  if (!entry) {
    
    return;
  }

  // Déclencher un événement personnalisé
  window.dispatchEvent(new CustomEvent('force-edit-entry', {
    detail: entry
  }));

  
};

// Exporter pour la console
if (typeof window !== 'undefined') {
  window.fixEntry2029 = fixAndEditEntry20250929;
  window.openEditForm = openEditForm;
  window.forceOpenWithData = forceOpenWithData;
}

export default {
  fixAndEditEntry20250929,
  openEditForm,
  forceOpenWithData
};