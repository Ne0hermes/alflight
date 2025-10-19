// Debug pour l'édition des entrées du carnet de vol

export const debugEditLogbook = () => {
  

  // Récupérer le carnet
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (logbook.length === 0) {
    
    return;
  }

   trouvée(s)`);

  // Afficher chaque entrée avec ses segments
  logbook.forEach((entry, index) => {
    
    
    
    
    
    

    if (entry.flightSegments) {
      
      entry.flightSegments.forEach((seg, i) => {
        
      });
    } else {
    }
  });

  return logbook;
};

export const testEditEntry = (entryIndex = 0) => {
  

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  if (logbook.length === 0 || !logbook[entryIndex]) {
    
    return;
  }

  const entry = logbook[entryIndex];
  

  // Simuler l'édition
  
  
  
  

  // Vérifier si les segments seraient correctement chargés
  if (entry.flightSegments && entry.flightSegments.length > 0) {
    
    entry.flightSegments.forEach((seg, i) => {
      
      
      
      
      
    });
  } else {
    
    
    
    
    
  }

  return entry;
};

export const fixMissingSegments = () => {
  

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
      
    }
    return entry;
  });

  if (fixed > 0) {
    localStorage.setItem('pilotLogbook', JSON.stringify(updatedLogbook));
     corrigée(s)`);
    
  } else {
    
  }

  return updatedLogbook;
};

export default {
  debugEditLogbook,
  testEditEntry,
  fixMissingSegments
};