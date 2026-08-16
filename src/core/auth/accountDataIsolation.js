// src/core/auth/accountDataIsolation.js
// ============================================================================
// 🔐 ISOLATION DES DONNÉES LOCALES PAR COMPTE (2026-08-16)
// ----------------------------------------------------------------------------
// Problème constaté par César : sur un même PC, se déconnecter du compte A et
// se connecter au compte B affichait le PROFIL PILOTE DE A (localStorage
// global, non partitionné par utilisateur).
//
// Principe « coffres par compte » (zéro modification des ~150 consommateurs) :
//   au premier login d'un utilisateur différent du « propriétaire » courant
//   des données locales :
//     1. les clés utilisateur sont ARCHIVÉES dans le coffre du sortant
//        (localStorage `alflight:vault:<userId>`) ;
//     2. le coffre de l'entrant est RESTAURÉ s'il existe, sinon les clés sont
//        purgées (compte vierge) ;
//     3. le propriétaire est mis à jour et l'app RECHARGÉE (les stores Zustand
//        se réhydratent depuis le stockage échangé).
//   Premier passage (aucun propriétaire enregistré) : les données existantes
//   sont ADOPTÉES par le compte connecté (comportement historique préservé).
//
// LIMITE ASSUMÉE (notée au plan serveur) : l'IndexedDB (avions, photos, PDFs)
// n'est pas encore partitionnée — la synchronisation par compte de la Phase 2
// la remplacera. Les données PERSONNELLES (profil, licences, médical, carnet)
// sont, elles, toutes dans les clés ci-dessous.
// ============================================================================

const OWNER_KEY = 'alflight:data-owner';
const VAULT_PREFIX = 'alflight:vault:';

// Clés localStorage LIÉES À L'UTILISATEUR (données personnelles + brouillons).
// Les caches du référentiel (GeoJSON, VAC…) et la session Supabase n'y sont pas.
const USER_SCOPED_KEYS = [
  'personalInfo',
  'pilotProfile',
  'pilotCertifications',
  'pilotMedicalRecords',
  'pilotLogbook',
  'units-preferences',
  'navigation-store-v2',
  'fuel-store-v2',
  'weight-balance-store-v2',
  'alternates-store-v2',
  'checklist-store-v2',
  'custom-vfr-store-v2',
  'aixm_airspaces_modifications',
  'aircraftRequestsSeen',
  'aircraftRequestsHidden',
  // 🗺️ Registre des cartes VAC (Lot 2.0) : il échappait à l'isolation — un
  // pilote voyait les cartes d'un autre profil du même appareil.
  'vac-storage',
  'sia_favorite_aerodromes',
  'sia_edited_data',
];

const collectCurrent = () => {
  const bundle = {};
  for (const k of USER_SCOPED_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) bundle[k] = v;
  }
  return bundle;
};

const clearCurrent = () => {
  for (const k of USER_SCOPED_KEYS) localStorage.removeItem(k);
};

const restoreVault = (userId) => {
  const raw = localStorage.getItem(VAULT_PREFIX + userId);
  if (!raw) return false;
  try {
    const bundle = JSON.parse(raw);
    for (const [k, v] of Object.entries(bundle)) localStorage.setItem(k, v);
    return true;
  } catch (e) {
    console.error('[Isolation] Coffre illisible pour', userId, e);
    return false;
  }
};

/**
 * 🗑️ SUPPRESSION DE COMPTE — purge locale CHIRURGICALE (fix bug César 16/08).
 * L'ancien code faisait `localStorage.clear()` : cela détruisait aussi les
 * COFFRES des AUTRES comptes de l'appareil (alflight:vault:<autres ids>) —
 * l'espace pilote des autres profils disparaissait après la suppression d'un
 * compte de test. On n'efface QUE : les clés actives (qui appartiennent au
 * compte supprimé, puisqu'il était connecté), SON coffre, et le marqueur de
 * propriétaire. Les coffres des autres comptes et les caches partagés du
 * référentiel (GeoJSON, VAC…) sont préservés.
 * @param {string} userId - id du compte qui vient d'être supprimé
 */
export function purgeLocalDataForDeletedAccount(userId) {
  try {
    clearCurrent();
    if (userId) localStorage.removeItem(VAULT_PREFIX + userId);
    localStorage.removeItem(OWNER_KEY);
    console.log('🗑️ [Isolation] Données locales du compte supprimé purgées (coffres des autres comptes préservés)');
  } catch (e) {
    console.warn('[Isolation] Purge post-suppression incomplète :', e?.message);
  }
}

/**
 * À appeler à CHAQUE session authentifiée (AuthContext).
 * @param {string} userId - id Supabase de l'utilisateur connecté
 * @returns {boolean} true si un échange a eu lieu (l'appelant doit recharger)
 */
export function ensureAccountDataIsolation(userId) {
  if (!userId) return false;
  let owner = null;
  try {
    owner = localStorage.getItem(OWNER_KEY);
  } catch {
    return false; // stockage indisponible : ne rien casser
  }

  if (owner === userId) return false; // même compte : rien à faire

  if (owner === null) {
    // Marqueur absent : premier passage… OU état post-suppression d'un compte
    // (purgeLocalDataForDeletedAccount retire le marqueur). Bug D4 (16/08) :
    // adopter les clés courantes (vides à ce stade) faisait écraser le coffre
    // du compte au prochain échange. Si CE compte possède un coffre → RESTAURER.
    let hasVault = false;
    try { hasVault = !!localStorage.getItem(VAULT_PREFIX + userId); } catch { /* ignore */ }
    if (hasVault) {
      clearCurrent();
      const restored = restoreVault(userId);
      localStorage.setItem(OWNER_KEY, userId);
      console.warn(`🔐 [Isolation] Marqueur propriétaire absent mais coffre présent — données ${restored ? 'restaurées depuis le coffre' : 'illisibles (repart de zéro)'} ; rechargement…`);
      return true;
    }
    // Vrai premier passage : les données locales existantes sont adoptées par
    // ce compte (cas historique : l'appareil n'avait qu'un utilisateur).
    localStorage.setItem(OWNER_KEY, userId);
    console.log('🔐 [Isolation] Données locales adoptées par le compte courant');
    return false;
  }

  // Changement de compte : archiver le sortant, restaurer/purger pour l'entrant.
  try {
    localStorage.setItem(VAULT_PREFIX + owner, JSON.stringify(collectCurrent()));
  } catch (e) {
    // Quota plein : on privilégie l'ISOLATION (pas de fuite entre comptes)
    // quitte à perdre l'archive du sortant. Signalé.
    console.error('[Isolation] Archivage du coffre impossible (quota ?) — purge quand même :', e?.message);
  }
  clearCurrent();
  const restored = restoreVault(userId);
  localStorage.setItem(OWNER_KEY, userId);
  console.warn(`🔐 [Isolation] Changement de compte détecté — données ${restored ? 'restaurées depuis le coffre' : 'repart de zéro'} ; rechargement…`);
  return true;
}
