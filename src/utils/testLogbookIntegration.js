// Test de l'intégration Google Sheets avec le carnet de vol
import { logToGoogleSheets } from './googleSheetsLogger';

export const testLogbookGoogleSheets = () => {
  console.log('🧪 Test intégration Carnet de vol → Google Sheets');

  // Test 1: Simuler un ajout de vol
  console.log('\n📝 Test 1: Simulation ajout de vol...');
  const testFlight = {
    date: new Date().toISOString().split('T')[0],
    departure: 'LFPO',
    arrival: 'LFPG',
    aircraft: 'F-TEST',
    totalTime: '1:30'
  };

  logToGoogleSheets('Test ajout vol', `${testFlight.date} - ${testFlight.departure} → ${testFlight.arrival} (${testFlight.aircraft})`);
  console.log('✅ Log ajout envoyé');

  // Test 2: Simuler une modification
  console.log('\n✏️ Test 2: Simulation modification vol...');
  logToGoogleSheets('Test modif vol', `Changement temps: 1:30 → 1:45 sur ${testFlight.aircraft}`);
  console.log('✅ Log modification envoyé');

  // Test 3: Simuler une suppression
  console.log('\n🗑️ Test 3: Simulation suppression vol...');
  logToGoogleSheets('Test suppr vol', `Suppression: ${testFlight.departure} → ${testFlight.arrival}`);
  console.log('✅ Log suppression envoyé');

  console.log('\n✨ Tests terminés! Vérifiez Google Sheets.');
  return true;
};

// Vérifier si les fonctions de logging sont bien importées dans PilotLogbook
export const checkLogbookIntegration = () => {
  console.log('🔍 Vérification de l\'intégration dans PilotLogbook...');

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

  console.log(`📊 ${todayEntries.length} vol(s) aujourd'hui`);
  console.log('💡 Les logs devraient apparaître dans Google Sheets lors de:');
  console.log('   - Ajout d\'un nouveau vol');
  console.log('   - Modification d\'un vol existant');
  console.log('   - Suppression d\'un vol');

  return { found, todayEntries: todayEntries.length };
};

// Fonction pour forcer un log manuel
export const forceManualLog = (action, details) => {
  console.log(`📤 Envoi manuel: ${action} - ${details}`);
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