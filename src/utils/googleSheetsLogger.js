// Utilitaire pour envoyer des logs à Google Sheets
//
// 🔇 DÉVELOPPEMENT UNIQUEMENT (16/08) : ce journal passe par un serveur local
// (localhost:3001) qui n'existe évidemment pas pour un pilote en production.
// Chaque enregistrement de vol y déclenchait une erreur CORS bruyante dans la
// console — inquiétante pour l'utilisateur et gênante pour le diagnostic.
export const logToGoogleSheets = async (action, details = '', options = {}) => {
  if (!import.meta.env.DEV) return; // silencieux en production
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
      
    }
  } catch (error) {
    // Ne pas bloquer l'application si le logging échoue
    
  }
};

// Export par défaut
export default logToGoogleSheets;