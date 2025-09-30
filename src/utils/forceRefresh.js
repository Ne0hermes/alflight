// Script pour forcer le rafraîchissement et nettoyer le cache

export const forceCompleteRefresh = () => {
  console.log('🔄 Forçage du rafraîchissement complet...');

  // 1. Nettoyer le cache du service worker si présent
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
      });
      console.log('✅ Service workers désactivés');
    });
  }

  // 2. Nettoyer les caches
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
      console.log('✅ Caches nettoyés');
    });
  }

  // 3. Forcer le rechargement dur
  setTimeout(() => {
    console.log('🔄 Rechargement dur de la page...');
    window.location.reload(true);
  }, 1000);
};

// Pour utiliser dans la console :
// forceCompleteRefresh()

export default forceCompleteRefresh;