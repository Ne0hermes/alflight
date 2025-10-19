/**
 * Fonction de test pour le logging automatique
 * Ce fichier envoie automatiquement un log de test vers Google Sheets
 */

// Fonction qui sera appelée automatiquement
export function sendTestLog() {
  if (typeof window !== 'undefined' && window.autoLogger) {
    // Envoyer un log de test
    window.autoLogger.logAction(
      'Test de connexion automatique',
      'Vérification que le système de logging automatique fonctionne',
      {
        component: 'autoLogTest.js',
        details: 'Test effectué automatiquement au chargement',
        files: ['src/utils/autoLogTest.js'],
        timestamp: new Date().toISOString()
      }

        return true;
  }
  return false;
}

// Enregistrer automatiquement la correction du zoom
export function logZoomFix() {
  if (typeof window !== 'undefined' && window.autoLogger) {
    window.autoLogger.logAction(
      'Correction du zoom ImageEditor',
      'Le problème de zoom dans l\'éditeur d\'images a été corrigé. Les photos ne sont plus tronquées.',
      {
        component: 'ImageEditor.jsx',
        details: 'Ajustement de objectFit et des dimensions pour les formes circulaires',
        files: ['src/components/ImageEditor.jsx'],
        status: 'completed'
      }

      }
}

// Appeler automatiquement au chargement
if (typeof window !== 'undefined') {
  // Attendre un peu que le logger soit initialisé
  setTimeout(() => {
    sendTestLog();
    logZoomFix();
  }, 2000);
}