// Analyser en détail une entrée de vol spécifique
export const analyzeFlightEntry = (date = '2025-09-29') => {
  
  

  // Récupérer le carnet
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  // Trouver l'entrée
  const entry = logbook.find(e => e.date === date);

  if (!entry) {
    
    return null;
  }

  
  
  
  
  

  // Analyser les segments
  
  if (entry.flightSegments && Array.isArray(entry.flightSegments)) {
    

    let totalCDB = 0;
    let totalOPL = 0;
    let totalDC = 0;
    let totalINST = 0;
    let totalSegmentTime = 0;

    entry.flightSegments.forEach((segment, index) => {
      
      
      
      
      

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

    
    }h`);
    : ${totalCDB.toFixed(2)}h`);
    : ${totalOPL.toFixed(2)}h`);
    : ${totalDC.toFixed(2)}h`);
    : ${totalINST.toFixed(2)}h`);

    // Vérifier la cohérence
    const totalTime = entry.totalTime.includes(':')
      ? parseFloat(entry.totalTime.split(':')[0]) + (parseFloat(entry.totalTime.split(':')[1]) / 60)
      : parseFloat(entry.totalTime);

    
    }h`);
    }h`);

    if (Math.abs(totalTime - totalSegmentTime) > 0.01) {
      
    } else {
      
    }

  } else {
    
    
  }

  // Analyser les autres champs temporels
  
  
  
  

  // Atterrissages
  
  
  

  return entry;
};

// Fonction pour corriger la répartition des heures
export const fixFlightSegments = (date = '2025-09-29') => {
  

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  const index = logbook.findIndex(e => e.date === date);

  if (index === -1) {
    
    return;
  }

  const entry = logbook[index];
  

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

  }h (${entry.totalTime})`);

  // Proposer une correction
  
  
  }h`);
  .toFixed(2)}h), moitié OPL (${(totalTime/2).toFixed(2)}h)`);
  

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
  // Stocker temporairement
  window.pendingFlightCorrection = { logbook, index, entry };

  return entry;
};

// Fonction pour sauvegarder la correction
export const saveFlightCorrection = () => {
  if (!window.pendingFlightCorrection) {
    
    return;
  }

  const { logbook } = window.pendingFlightCorrection;
  localStorage.setItem('pilotLogbook', JSON.stringify(logbook));

  
  

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