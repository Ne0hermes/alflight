import { createRoot } from 'react-dom/client';
import './index.css';  // tous les styles globaux (charte) sont importés via index.css
import MobileApp from './MobileApp.jsx';
import { AuthProvider } from './core/contexts/AuthContext';
import apiKeyManager from './utils/apiKeyManager';
import { useOpenAIPStore } from './core/stores/openAIPStore';

// 🔁 Auto-récupération après (re)déploiement : si un chunk lazy (import
// dynamique) n'existe plus côté serveur — typiquement après un nouveau déploiement
// alors que l'onglet tourne encore sur l'ancienne version (404 « Failed to fetch
// dynamically imported module ») — Vite émet `vite:preloadError`. On recharge la
// page UNE fois pour récupérer le build courant, au lieu de planter dans
// l'ErrorBoundary. Le garde sessionStorage évite toute boucle de rechargement.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    if (!sessionStorage.getItem('__vite_preload_reloaded')) {
      sessionStorage.setItem('__vite_preload_reloaded', '1');
      window.location.reload();
    }
  });
}

// Initialiser le gestionnaire de clés API au démarrage
apiKeyManager.initialize();

// Précharger les aérodromes (source unique GeoJSON/SIA via le provider) au démarrage :
// noms + liste disponibles pour toute l'app (remplace le hardcodé airportNames.js).
// Idempotent + caché 10 min côté store.
useOpenAIPStore.getState().loadAirports();

// Note: Le bucket Supabase 'manex-files' doit être créé manuellement via SQL
// Voir docs/SETUP_SUPABASE_STORAGE.md pour les instructions

// Test de la configuration API en développement
if (import.meta.env.DEV) {
  import('./utils/testAPIKey');
}

// Rendu sans StrictMode pour debug
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <AuthProvider>
      <MobileApp />
    </AuthProvider>
  );
} else {
  console.error('Element root non trouvé !');
}