// src/services/accountService.js
// 🔐 Phase 1 (Lot 1.4) — Suppression de compte (exigence App Store/Google Play).
// Appelle l'Edge Function delete-account (qui authentifie l'appelant par son
// JWT, efface ses données serveur puis son compte), puis purge les données
// LOCALES de l'appareil et déconnecte.

import { supabase } from '../lib/supabaseClient';

export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    // FunctionsHttpError : le corps JSON contient le message utile
    let message = error.message || 'Erreur inconnue';
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) message = ctx.error;
    } catch { /* garder le message générique */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);

  // Purge locale : le compte n'existe plus, l'appareil ne doit rien garder.
  try { localStorage.clear(); } catch { /* best effort */ }
  try { indexedDB.deleteDatabase('FlightManagementDB'); } catch { /* best effort */ }
  try { await supabase.auth.signOut(); } catch { /* la session est déjà invalide */ }

  return true;
}
