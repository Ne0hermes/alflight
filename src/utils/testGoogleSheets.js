// Test de l'intégration Google Sheets
import { logToGoogleSheets } from './googleSheetsLogger';

export const testGoogleSheetsIntegration = async () => {
  console.log('🚀 Test de l\'intégration Google Sheets...');

  try {
    // Test simple
    await logToGoogleSheets('Test intégration', 'Test depuis le carnet de vol');
    console.log('✅ Test 1: Log simple envoyé');

    // Test avec détails de vol
    const now = new Date().toISOString().split('T')[0];
    await logToGoogleSheets('Test vol', `${now} - LFST → LFGA (F-DEMO)`);
    console.log('✅ Test 2: Log avec détails de vol envoyé');

    // Test statistiques
    await logToGoogleSheets('Statistiques fusionnées', 'Ajout Double commande, suppression Formation');
    console.log('✅ Test 3: Log de modification interface envoyé');

    console.log('✨ Tests terminés avec succès!');
    console.log('💡 Vérifiez Google Sheets pour voir les nouveaux logs');

    return true;
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    return false;
  }
};

// Exporter pour la console
if (typeof window !== 'undefined') {
  window.testGoogleSheets = testGoogleSheetsIntegration;
}

export default testGoogleSheetsIntegration;