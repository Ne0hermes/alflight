import { createRoot } from 'react-dom/client';
import './index.css';  // tous les styles globaux (charte) sont importés via index.css
import MobileApp from './MobileApp.jsx';
import { AuthProvider } from './core/contexts/AuthContext';
import apiKeyManager from './utils/apiKeyManager';
import { useOpenAIPStore } from './core/stores/openAIPStore';

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