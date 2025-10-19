// Test de l'intégration Google Sheets avec le carnet de vol
import { logToGoogleSheets } from './googleSheetsLogger';

export const testLogbookGoogleSheets = () => {
  

  // Test 1: Simuler un ajout de vol
  
  const testFlight = {
    date: new Date().toISOString().split('T')[0],
    departure: 'LFPO',
    arrival: 'LFPG',
    aircraft: 'F-TEST',
    totalTime: '1:30'
  };

  logToGoogleSheets('Test ajout vol', `${testFlight.date} - ${testFlight.departure} → ${testFlight.arrival} (${testFlight.aircraft})`);
  

  // Test 2: Simuler une modification
  
  logToGoogleSheets('Test modif vol', `Changement temps: 1:30 → 1:45 sur ${testFlight.aircraft}`);
  

  // Test 3: Simuler une suppression
  
  logToGoogleSheets('Test suppr vol', `Suppression: ${testFlight.departure} → ${testFlight.arrival}`);
  

  
  return true;
};

// Vérifier si les fonctions de logging sont bien importées dans PilotLogbook
export const checkLogbookIntegration = () => {
  

  // Chercher si logToGoogleSheets est utilisé
  const scripts = document.querySelectorAll('script');
  let found = false;

  for (const script of scripts) {
    if (script.src && script.src.includes('PilotLogbook')) {
      found = true;
      break;
    }
  }

  // Vérifier dans le localStorage si des vols récents ont été ajoutés
  const logbook = JSON.parse(localStorage.getItem('pilotLogbook') || '[]');
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = logbook.filter(e => e.date === today);

   aujourd'hui`);
  
  
  
  

  return { found, todayEntries: todayEntries.length };
};

// Fonction pour forcer un log manuel
export const forceManualLog = (action, details) => {
  
  return logToGoogleSheets(action, details);
};

// Export pour la console
if (typeof window !== 'undefined') {
  window.testLogbook = testLogbookGoogleSheets;
  window.checkIntegration = checkLogbookIntegration;
  window.manualLog = forceManualLog;
}

export default {
  testLogbookGoogleSheets,
  checkLogbookIntegration,
  forceManualLog
};