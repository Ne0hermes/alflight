// src/utils/staleChunkReload.js
//
// Récupération centralisée après (re)déploiement.
//
// Problème : quand un nouvel build est mis en ligne alors qu'un onglet tourne
// encore sur l'ancienne version, l'ancien code tente de charger un chunk lazy
// (import dynamique) dont le NOM HASHÉ a changé → le serveur renvoie 404 et le
// navigateur lève « Failed to fetch dynamically imported module ». Le service
// worker PWA aggrave le tout en re-servant un shell PÉRIMÉ qui référence les
// anciens chunks → un simple reload retombe sur la même 404 (boucle).
//
// Solution : on PURGE le service worker + tous les caches AVANT de recharger,
// pour forcer le build courant. Garde anti-boucle FENÊTRÉE : on autorise une
// récupération toutes les ~10 s (donc plusieurs redéploiements successifs dans
// une même session restent récupérables) tout en empêchant une boucle serrée.

const RELOAD_TS_KEY = '__stale_chunk_reload_ts';
const MIN_INTERVAL_MS = 10_000;

/**
 * Vrai si l'erreur correspond à un chunk lazy périmé (déploiement pendant que
 * l'onglet tournait). Couvre les libellés Chrome/Firefox/Safari.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isStaleChunkError(error) {
  if (!error) return false;
  const name = (error.name || '').toString();
  const msg = (error.message || error.toString() || '').toString();
  return (
    /ChunkLoadError/i.test(name) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||   // Chrome
    /error loading dynamically imported module/i.test(msg) ||     // Firefox
    /Importing a module script failed/i.test(msg) ||              // Safari
    /Failed to fetch dynamically imported module/i.test(name)
  );
}

/**
 * Purge le service worker + les caches puis recharge la page pour récupérer le
 * build courant. Best-effort : si une étape échoue (mode privé strict, API
 * indispo), on recharge quand même.
 *
 * @param {{ force?: boolean }} [opts] force=true ignore la garde anti-boucle
 *   (utilisé par le bouton « Recharger » : c'est une action explicite).
 * @returns {Promise<boolean>} true si un rechargement a été déclenché.
 */
export async function recoverFromStaleChunks({ force = false } = {}) {
  if (typeof window === 'undefined') return false;

  try {
    const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
    const now = Date.now();
    if (!force && last && now - last < MIN_INTERVAL_MS) {
      // On vient déjà de tenter une récupération il y a moins de 10 s → ne pas
      // boucler. On laisse l'UI de secours (ErrorBoundary) proposer un bouton.
      return false;
    }
    sessionStorage.setItem(RELOAD_TS_KEY, String(now));
  } catch {
    /* sessionStorage indispo : on tente quand même la purge + reload */
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* best-effort : la purge a pu échouer, on recharge tout de même */
  }

  window.location.reload();
  return true;
}
