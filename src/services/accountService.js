// src/services/accountService.js
// 🔐 Phase 1 (Lot 1.4) — Suppression de compte (exigence App Store/Google Play).
// Appelle l'Edge Function delete-account (qui authentifie l'appelant par son
// JWT, efface ses données serveur puis son compte), puis purge les données
// LOCALES de l'appareil et déconnecte.

import { supabase } from '../lib/supabaseClient';
import { purgeLocalDataForDeletedAccount } from '../core/auth/accountDataIsolation';

export async function deleteMyAccount() {
  // Identifier le compte AVANT la suppression (après, la session n'existe plus)
  let uid = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id || null;
  } catch { /* purge quand même les clés actives */ }

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

  // Purge locale CHIRURGICALE (fix 16/08) : uniquement les données du compte
  // supprimé. ⚠️ JAMAIS localStorage.clear() — cela détruisait les coffres
  // d'isolation des AUTRES comptes de l'appareil (bug constaté par César :
  // l'espace pilote des autres profils disparaissait).
  purgeLocalDataForDeletedAccount(uid);
  // IndexedDB (avions, photos, MANEX) : NON partitionnée par compte (limite
  // connue, sync Phase 2) — on la conserve pour ne pas détruire les données
  // des autres comptes de l'appareil. Rien de personnel au compte supprimé
  // n'y reste : ses données personnelles étaient dans les clés purgées et
  // côté serveur (effacées par l'Edge Function).
  try { await supabase.auth.signOut(); } catch { /* la session est déjà invalide */ }

  return true;
}
