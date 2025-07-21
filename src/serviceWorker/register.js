// src/serviceWorker/register.js

export function registerVACServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/vacCacheWorker.js')
        .then(registration => {
          console.log('VAC Service Worker enregistré:', registration);

          // Écouter les mises à jour
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nouveau service worker disponible
                  console.log('Nouvelle version du service worker disponible');
                  
                  // Notifier l'utilisateur
                  if (window.confirm('Une nouvelle version des cartes est disponible. Recharger ?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch(error => {
          console.error('Erreur enregistrement Service Worker:', error);
        });

      // Écouter les messages du service worker
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'AIRAC_UPDATE_AVAILABLE') {
          console.log('Mise à jour AIRAC disponible:', event.data.chartsToUpdate);
          
          // Dispatcher un événement personnalisé
          window.dispatchEvent(new CustomEvent('airac-update', {
            detail: { chartsToUpdate: event.data.chartsToUpdate }
          }));
        }
      });
    });
  }
}

export function unregisterVACServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}