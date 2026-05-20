// src/lib/persistentErrorLog.js
//
// Système d'enregistrement persistant des erreurs critiques (Supabase, save, etc.).
// Survit aux reloads de page, à la navigation, à HMR Vite.
//
// Utilisation :
//   recordSupabaseError('updateAircraft', error, { aircraftId, registration });
//
// Affichage : le composant <SupabaseErrorBanner /> monté à la racine de l'app
// lit ce store et affiche les erreurs jusqu'à dismiss explicite par l'utilisateur.

const LS_KEY = 'alflight:lastSupabaseError';
const EVT_NAME = 'alflight:supabase-error';

/**
 * Enregistre une erreur de manière persistante (localStorage + event).
 * @param {string} context  Étiquette courte ex. 'updateAircraft', 'addAircraft', 'votePreset'
 * @param {Error|unknown} error  L'erreur capturée
 * @param {object} [meta]  Données contextuelles supplémentaires (id, registration, etc.)
 */
export function recordSupabaseError(context, error, meta = {}) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      context,
      message: error?.message || String(error || 'erreur inconnue'),
      stack: error?.stack || null,
      code: error?.code || null,
      hint: error?.hint || null,
      details: error?.details || null,
      meta,
      url: typeof window !== 'undefined' ? window.location.href : null
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }
    // Dispatch un event pour que le bandeau se mette à jour immédiatement
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(EVT_NAME, { detail: payload }));
    }
    // Log console aussi (avec préfixe distinctif)
    console.error(`🚨 [persistentErrorLog/${context}]`, payload);
    return payload;
  } catch (e) {
    // En dernier recours, ne jamais throw depuis le logger lui-même
    console.error('[persistentErrorLog] Failed to record error:', e);
    return null;
  }
}

/** Lit la dernière erreur enregistrée (ou null). */
export function readLastSupabaseError() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Efface la dernière erreur enregistrée. */
export function clearLastSupabaseError() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LS_KEY);
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(EVT_NAME, { detail: null }));
    }
  } catch {
    /* noop */
  }
}

export const PERSISTENT_ERROR_EVENT = EVT_NAME;
