// src/lib/supabaseAuth.js
//
// Helpers d'auth Supabase — point unique de récupération de l'userId
// pour toutes les écritures qui doivent tagger un propriétaire.
//
// 🚨 REMPLACE le placeholder historique 'current-user-id' qui laissait
//    des chaînes littérales dans `submitted_by` et faisait échouer la RLS
//    de tout UPDATE ultérieur.

import { supabase } from './supabaseClient';

/**
 * Récupère l'UUID de l'utilisateur Supabase authentifié.
 * Retourne `null` si aucune session n'est active.
 *
 * Utilise ce helper plutôt que d'inliner `supabase.auth.getSession()` partout —
 * un seul point d'entrée à corriger si l'auth évolue.
 */
export async function getCurrentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (e) {
    console.warn('[supabaseAuth] getCurrentUserId failed:', e?.message);
    return null;
  }
}

/**
 * 🔐 Phase 1 RBAC : l'utilisateur courant est-il administrateur ?
 * Rôle lu depuis app_metadata du JWT (non modifiable côté client).
 * Fail-closed : false sans session ou en cas d'erreur.
 */
export async function isCurrentUserAdmin() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.app_metadata?.role === 'admin';
  } catch (e) {
    console.warn('[supabaseAuth] isCurrentUserAdmin failed:', e?.message);
    return false;
  }
}

/**
 * Variante stricte : throw si pas de session.
 * À utiliser dans les flux d'écriture critique où on veut un message clair
 * au lieu d'un refus RLS silencieux.
 */
export async function getCurrentUserIdOrThrow() {
  const id = await getCurrentUserId();
  if (!id) {
    throw new Error(
      'Aucune session Supabase active — connecte-toi avant cette action.'
    );
  }
  return id;
}
