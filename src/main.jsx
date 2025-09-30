import { createRoot } from 'react-dom/client';
import './index.css';  // Contient maintenant uniquement l'import du fichier unifié
// Tous les styles sont maintenant dans unified-styles.css importé via index.css
// import './styles/global-overrides.css';  // DÉSACTIVÉ - dans unified-styles.css
// import './styles/button-rounded.css';    // DÉSACTIVÉ - dans unified-styles.css
// import './styles/aircraft-fixes.css';    // DÉSACTIVÉ - dans unified-styles.css
// import './styles/theme-loader.js';       // DÉSACTIVÉ - remplacé par unified-styles.css
import MobileApp from './MobileApp.jsx';
import apiKeyManager from './utils/apiKeyManager';

// Initialiser le gestionnaire de clés API au démarrage
apiKeyManager.initialize();

// Test de la configuration API en développement
if (import.meta.env.DEV) {
  import('./utils/testAPIKey');
}

// Rendu sans StrictMode pour debug
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<MobileApp />);
} else {
  console.error('Element root non trouvé !');
}