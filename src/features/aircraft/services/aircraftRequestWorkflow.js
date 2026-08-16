// src/features/aircraft/services/aircraftRequestWorkflow.js
// ============================================================================
// 📥 DEMANDE D'AJOUT → WIZARD (2026-08-16, demande César)
// ----------------------------------------------------------------------------
// L'admin clique « Créer la fiche » sur une demande reçue :
//   1. l'immatriculation + la base d'attache saisies par le demandeur sont
//      pré-remplies dans le wizard ;
//   2. le manuel de vol téléversé (bucket privé aircraft-requests) est
//      téléchargé et injecté dans l'extraction MANEX (même flux que le bouton
//      « Importer depuis un manuel de vol (PDF) ») ;
//   3. à la SAUVEGARDE réussie du wizard (publication community_presets via
//      addAircraft → submitPreset), la demande passe automatiquement à
//      « processed » → le demandeur voit la bannière « ajouté à la base ».
//
// Transport : sessionStorage (le changement d'onglet démonte/remonte le
// wizard) + CustomEvents pour le cas où Step0 est déjà monté.
// ============================================================================

import { supabase } from '../../../lib/supabaseClient';

const PREFILL_KEY = 'alflight:aircraft-request-prefill'; // consommé par Step0 (une fois)
const CONTEXT_KEY = 'alflight:aircraft-request-context'; // vit jusqu'à la sauvegarde

/** Premier code OACI (4 lettres) trouvé dans un texte libre, sinon ''. */
export function extractIcao(text) {
  const m = String(text || '').toUpperCase().match(/\b[A-Z]{4}\b/);
  return m ? m[0] : '';
}

/**
 * Dépose le témoin pour le wizard et déclenche la navigation.
 * @param {Object} req ligne aircraft_requests (id, registration, home_base, file_path, file_name)
 */
export function storeRequestHandoff(req) {
  const registration = String(req.registration || '').trim().toUpperCase();
  const payload = {
    requestId: req.id,
    registration,
    homeBase: extractIcao(req.home_base),
    homeBaseRaw: req.home_base || '',
    filePath: req.file_path,
    fileName: req.file_name,
    photoPath: req.photo_path || null,
    photoName: req.photo_name || null,
    createdAt: Date.now(), // péremption courte (revue 16/08) : un témoin non
    // consommé ne doit JAMAIS détourner une création ultérieure sans rapport
  };
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(payload));
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({
      requestId: req.id, registration,
      homeBase: payload.homeBase, homeBaseRaw: payload.homeBaseRaw
    }));
  } catch (e) {
    console.warn('[RequestWorkflow] sessionStorage indisponible :', e?.message);
  }
  // 🛡️ Revue 16/08 : un brouillon de wizard à une étape > 0 empêcherait Step0
  // (le consommateur du témoin) de monter — et mélangerait les données de
  // DEUX avions. Le handoff démarre TOUJOURS d'un wizard vierge à l'étape 0 :
  // brouillon purgé + remontage complet du wizard (clé React dans MobileApp).
  try { localStorage.removeItem('aircraft_wizard_draft'); } catch { /* best effort */ }
  // Onglet « Configurer un avion » (no-op si on y est déjà)…
  window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: { tabId: 'aircraft-wizard' } }));
  // …et remontage à neuf du wizard (MobileApp incrémente sa clé React) : l'état
  // en cours est jeté, Step0 remonte vierge et consomme le témoin à son montage.
  window.dispatchEvent(new CustomEvent('aircraft-request-prefill'));
}

const PREFILL_TTL_MS = 5 * 60 * 1000;

/** Lit ET efface le témoin de pré-remplissage (consommation unique, périmé après 5 min). */
export function consumeRequestPrefill() {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PREFILL_KEY);
    const payload = JSON.parse(raw);
    if (!payload?.createdAt || Date.now() - payload.createdAt > PREFILL_TTL_MS) {
      console.warn('[RequestWorkflow] Témoin de pré-remplissage périmé — ignoré');
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getRequestContext() {
  try {
    return JSON.parse(sessionStorage.getItem(CONTEXT_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearRequestContext() {
  try { sessionStorage.removeItem(CONTEXT_KEY); } catch { /* best effort */ }
}

/**
 * Télécharge le manuel d'une demande (bucket privé, URL signée 5 min) et le
 * retourne en File prêt pour l'extraction MANEX.
 */
export async function downloadRequestManual(filePath, fileName) {
  const { data, error } = await supabase.storage
    .from('aircraft-requests')
    .createSignedUrl(filePath, 300);
  if (error) throw error;
  const resp = await fetch(data.signedUrl);
  if (!resp.ok) throw new Error(`Téléchargement du manuel échoué (HTTP ${resp.status})`);
  const blob = await resp.blob();
  return new File([blob], fileName || 'manuel-de-vol.pdf', { type: 'application/pdf' });
}

/**
 * Télécharge la photo de l'avion jointe à la demande (bucket privé) et la
 * retourne en data URL — le format du champ `photo` du wizard.
 */
export async function downloadRequestPhotoDataUrl(filePath) {
  const { data, error } = await supabase.storage
    .from('aircraft-requests')
    .createSignedUrl(filePath, 300);
  if (error) throw error;
  const resp = await fetch(data.signedUrl);
  if (!resp.ok) throw new Error(`Téléchargement de la photo échoué (HTTP ${resp.status})`);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Lecture de la photo échouée'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Après une sauvegarde RÉUSSIE du wizard : si elle provient d'une demande
 * (contexte présent, immatriculation concordante), la demande passe à
 * « processed » → notification in-app du demandeur à sa prochaine visite.
 * L'avion vient d'être publié par submitPreset : la promesse « ajouté à la
 * base » est tenue par construction.
 * @param {string} registration immatriculation réellement sauvegardée
 * @returns {Promise<boolean>} true si une demande a été clôturée
 */
export async function markRequestProcessedAfterSave(registration) {
  const ctx = getRequestContext();
  if (!ctx?.requestId) return false;
  const saved = String(registration || '').trim().toUpperCase();
  if (!saved || saved !== ctx.registration) return false; // autre avion : ne rien clôturer
  // 🛡️ Revue 16/08 : garde .eq(status,'pending') — un contexte périmé ne doit
  // JAMAIS faire repasser une demande « Refusée » à « Traitée ». .select()
  // permet de détecter 0 ligne affectée (demande déjà traitée/refusée).
  const { data: updated, error } = await supabase
    .from('aircraft_requests')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', ctx.requestId)
    .eq('status', 'pending')
    .select();
  if (error) {
    console.warn('[RequestWorkflow] Clôture de la demande échouée :', error.message);
    return false;
  }
  clearRequestContext(); // contexte consommé dans tous les cas (succès ou déjà traité)
  if (!updated || updated.length === 0) {
    console.warn('[RequestWorkflow] Demande déjà traitée/refusée — statut inchangé');
    return false;
  }
  console.log(`✅ [RequestWorkflow] Demande clôturée — ${saved} disponible pour le demandeur`);
  return true;
}
