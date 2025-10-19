// Test pour vérifier que les segments de vol sont correctement calculés

export const testFlightSegments = () => {
  

  // Récupérer le carnet de vol
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');

  

  // Analyser chaque entrée
  logbook.forEach((entry, index) => {
    
    
    

    if (entry.flightSegments && Array.isArray(entry.flightSegments)) {
      :`);

      let totalSegmentTime = 0;
      let cdbTime = 0;
      let oplTime = 0;
      let nightTime = 0;
      let ifrTime = 0;

      entry.flightSegments.forEach((segment, segIndex) => {
        const time = parseFloat(segment.time) || 0;
        totalSegmentTime += time;

        
        
        
        
        

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

      
      }h`);
      : ${cdbTime.toFixed(1)}h`);
      : ${oplTime.toFixed(1)}h`);
      }h`);
      }h`);
    } else {
    }
  });

  return logbook;
};

export const addTestFlightWithSegments = () => {
  

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

  
  
  
  
  
  

  return testFlight;
};

export const clearTestFlights = () => {
  

  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  const filtered = logbook.filter(entry => !entry.aircraft?.includes('F-TEST'));

  localStorage.setItem('pilotLogbook', JSON.stringify(filtered));

   test supprimé(s)`);
  

  return filtered;
};

// Export par défaut
export default {
  testFlightSegments,
  addTestFlightWithSegments,
  clearTestFlights
};