// Utilitaire pour envoyer des logs à Google Sheets
export const logToGoogleSheets = async (action, details = '', options = {}) => {
  try {
    // Détecter automatiquement le composant basé sur l'action
    let component = options.component || 'Carnet de vol';
    let summary = options.summary || action;
    let files = options.files || '';
    let status = options.status || 'completed';

    // Auto-détection du composant
    if (action.toLowerCase().includes('vol') || action.toLowerCase().includes('flight')) {
      component = 'Carnet de vol';
    } else if (action.toLowerCase().includes('export') || action.toLowerCase().includes('import')) {
      component = 'Export/Import';
    } else if (action.toLowerCase().includes('statistique') || action.toLowerCase().includes('stat')) {
      component = 'Statistiques';
    } else if (action.toLowerCase().includes('avion') || action.toLowerCase().includes('aircraft')) {
      component = 'Avions';
    }

    // Auto-détection des fichiers modifiés
    if (!files) {
      if (component === 'Carnet de vol') {
        files = 'PilotLogbook.jsx';
      } else if (component === 'Export/Import') {
        files = 'exportUtils.js';
      } else if (component === 'Statistiques') {
        files = 'PilotProfile.jsx, PilotDashboard.jsx';
      }
    }

    const response = await fetch('http://localhost:3001/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        component,
        summary,
        details,
        files,
        status
      })
    });

    if (!response.ok) {
      console.warn('Impossible de logger vers Google Sheets:', response.status);
    }
  } catch (error) {
    // Ne pas bloquer l'application si le logging échoue
    console.debug('Google Sheets logging indisponible:', error.message);
  }
};

// Export par défaut
export default logToGoogleSheets;