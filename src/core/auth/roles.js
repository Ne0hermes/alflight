// src/core/auth/roles.js
// 🔐 Phase 1 (RBAC) — SOURCE UNIQUE du rôle utilisateur côté client.
//
// Le rôle vit dans app_metadata du JWT Supabase (posé par l'admin via le
// dashboard — un client ne peut PAS le modifier). Côté client il ne sert
// qu'à MASQUER l'interface : la vraie application des droits est la RLS
// Postgres (supabase-phase1-rbac.sql, fonction is_admin()).
//
// Modèle (décision 2026-08-12) :
//   admin : seul à écrire le RÉFÉRENTIEL (avions, MANEX, VAC, données) —
//           la zone « Configurer un avion » lui est réservée.
//   user  : référentiel en lecture seule ; conserve ses propres données
//           (préparations de vol, carnet, points VFR créés par lui).

/** @returns {'admin'|'user'} */
export const getUserRole = (user) =>
  user?.app_metadata?.role === 'admin' ? 'admin' : 'user';

export const isAdminUser = (user) => getUserRole(user) === 'admin';

// Onglets réservés à l'admin (masqués du menu ET bloqués au rendu).
export const ADMIN_ONLY_TABS = new Set(['aircraft-wizard']);
