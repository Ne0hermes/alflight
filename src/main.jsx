import { createRoot } from 'react-dom/client';
import './index.css';  // tous les styles globaux (charte) sont importés via index.css
import MobileApp from './MobileApp.jsx';
import { AuthProvider } from './core/contexts/AuthContext';
import apiKeyManager from './utils/apiKeyManager';
import { useOpenAIPStore } from './core/stores/openAIPStore';
import { recoverFromStaleChunks } from './utils/staleChunkReload';

// 🔁 Auto-récupération après (re)déploiement : si un chunk lazy (import
// dynamique) n'existe plus côté serveur — typiquement après un nouveau déploiement
// alors que l'onglet tourne encore sur l'ancienne version (404 « Failed to fetch
// dynamically imported module ») — Vite émet `vite:preloadError`. On PURGE le
// service worker + les caches puis on recharge pour récupérer le build courant
// (cf. staleChunkReload : garde anti-boucle fenêtrée, partagée avec l'ErrorBoundary).
//
// `preventDefault()` empêche Vite de relancer l'erreur → elle n'atteint plus
// l'ErrorBoundary (qui reste néanmoins un filet de secours si ce handler manque).
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.();
    recoverFromStaleChunks();
  });
}

// 🔄 PRISE EN COMPTE AUTOMATIQUE D'UNE NOUVELLE VERSION (16/08)
// ---------------------------------------------------------------------------
// Le service worker était bien en « autoUpdate », mais RIEN ne rechargeait la
// page : l'onglet continuait d'exécuter l'ancien JavaScript tant que le pilote
// ne faisait pas un rechargement forcé. Conséquence observée trois fois : des
// correctifs déjà déployés (CORS météo, crash déroutements) semblaient encore
// présents — on diagnostiquait un bug fantôme.
//
// Ici : dès qu'un nouveau service worker prend la main, on recharge UNE fois.
// On vérifie aussi les mises à jour au retour au premier plan et toutes les
// 30 min, sinon un onglet resté ouvert toute la journée ne les voit jamais.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Une page NON encore contrôlée reçoit aussi « controllerchange » à la
  // première installation : ce n'est pas une mise à jour, on ne recharge pas.
  const hadControllerAtStartup = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerAtStartup || reloading) return;
    reloading = true;
    console.log('🔄 Nouvelle version d\'ALFlight disponible — rechargement…');
    window.location.reload();
  });

  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration()
      .then((reg) => reg?.update())
      .catch(() => { /* hors ligne : réessai au prochain déclencheur */ });
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdate();
  });
  setInterval(checkForUpdate, 30 * 60 * 1000);
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