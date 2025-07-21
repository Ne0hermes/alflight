// src/serviceWorker/vacCacheWorker.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Précache des assets statiques
precacheAndRoute(self.__WB_MANIFEST);

// Cache pour les PDFs VAC
registerRoute(
  ({ url }) => url.pathname.includes('/vac-charts/') && url.pathname.endsWith('.pdf'),
  new CacheFirst({
    cacheName: 'vac-charts-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours (cycle AIRAC)
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Cache pour les métadonnées VAC
registerRoute(
  ({ url }) => url.pathname.includes('/api/vac-metadata'),
  new NetworkFirst({
    cacheName: 'vac-metadata-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 24 heures
      }),
    ],
  })
);

// Message handler pour la synchronisation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATES') {
    // Vérifier les mises à jour AIRAC
    checkAIRACUpdates();
  }
});

async function checkAIRACUpdates() {
  // Logique de vérification des cycles AIRAC
  const cache = await caches.open('vac-charts-cache');
  const cachedRequests = await cache.keys();
  
  // Notifier l'app principale des mises à jour disponibles
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'AIRAC_UPDATE_AVAILABLE',
        chartsToUpdate: cachedRequests.length
      });
    });
  });
}