// Script pour forcer le rafraîchissement et nettoyer le cache

/**
 * Force un rafraîchissement complet de l'application
 * - Désenregistre tous les service workers
 * - Supprime tous les caches
 * - Nettoie localStorage et sessionStorage
 * - Recharge la page en dur
 */
export const forceCompleteRefresh = async () => {
  console.log('🔄 Début du nettoyage complet...');

  // 1. Nettoyer le cache du service worker si présent
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('🗑️ Service Worker désenregistré:', registration);
    }
  }

  // 2. Nettoyer tous les caches
  if ('caches' in window) {
    const names = await caches.keys();
    for (const name of names) {
      await caches.delete(name);
      console.log('🗑️ Cache supprimé:', name);
    }
  }

  // 3. Nettoyer localStorage (optionnel - décommentez si nécessaire)
  // localStorage.clear();
  // console.log('🗑️ localStorage nettoyé');

  // 4. Nettoyer sessionStorage (optionnel - décommentez si nécessaire)
  // sessionStorage.clear();
  // console.log('🗑️ sessionStorage nettoyé');

  console.log('✅ Nettoyage terminé. Rechargement...');

  // 5. Forcer le rechargement dur
  setTimeout(() => {
    window.location.reload(true);
  }, 500);
};

/**
 * Nettoie uniquement les caches sans recharger
 */
export const clearCachesOnly = async () => {
  console.log('🗑️ Nettoyage des caches...');

  if ('caches' in window) {
    const names = await caches.keys();
    for (const name of names) {
      await caches.delete(name);
      console.log('🗑️ Cache supprimé:', name);
    }
  }

  console.log('✅ Caches nettoyés');
};

/**
 * Désenregistre uniquement les service workers
 */
export const unregisterServiceWorkers = async () => {
  console.log('🗑️ Désenregistrement des service workers...');

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('🗑️ Service Worker désenregistré');
    }
  }

  console.log('✅ Service workers désenregistrés');
};

// Pour utiliser dans la console :
// import { forceCompleteRefresh } from './utils/forceRefresh.js'
// forceCompleteRefresh()

// Ou plus simple (si exposé globalement) :
// window.forceRefresh()

export default forceCompleteRefresh;