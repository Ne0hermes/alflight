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
  };
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(payload));
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({ requestId: req.id, registration }));
  } catch (e) {
    console.warn('[RequestWorkflow] sessionStorage indisponible :', e?.message);
  }
  // Onglet « Configurer un avion » (no-op si on y est déjà)…
  window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: { tabId: 'aircraft-wizard' } }));
  // …et signal direct pour un Step0 déjà monté (clic depuis la boîte du wizard).
  window.dispatchEvent(new CustomEvent('aircraft-request-prefill'));
}

/** Lit ET efface le témoin de pré-remplissage (consommation unique). */
export function consumeRequestPrefill() {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PREFILL_KEY);
    return JSON.parse(raw);
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
  const { error } = await supabase
    .from('aircraft_requests')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('id', ctx.requestId);
  if (error) {
    console.warn('[RequestWorkflow] Clôture de la demande échouée :', error.message);
    return false;
  }
  clearRequestContext();
  console.log(`✅ [RequestWorkflow] Demande clôturée — ${saved} disponible pour le demandeur`);
  return true;
}
