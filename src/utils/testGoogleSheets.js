// Test de l'intégration Google Sheets
import { logToGoogleSheets } from './googleSheetsLogger';

export const testGoogleSheetsIntegration = async () => {
  

  try {
    // Test simple
    await logToGoogleSheets('Test intégration', 'Test depuis le carnet de vol');
    

    // Test avec détails de vol
    const now = new Date().toISOString().split('T')[0];
    await logToGoogleSheets('Test vol', `${now} - LFST → LFGA (F-DEMO)`);
    

    // Test statistiques
    await logToGoogleSheets('Statistiques fusionnées', 'Ajout Double commande, suppression Formation');
    

    
    

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