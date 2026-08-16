// src/services/vacProfileService.js
// ============================================================================
// 🗺️ LOT 2.0 — CARTES VAC RATTACHÉES AU PROFIL DU PILOTE
// ----------------------------------------------------------------------------
// Chaque pilote télécharge SES cartes depuis la source officielle (SIA) et les
// importe dans l'application. Elles sont alors conservées dans SON espace privé
// sur le serveur (bucket pilot-vac, un dossier par compte) et restaurées à la
// reconnexion, y compris sur un appareil neuf.
//
// Portée juridique voulue (décision César 16/08) : l'application ne redistribue
// aucune carte — elle conserve la copie personnelle du commandant de bord.
// C'est donc à LUI qu'il revient de disposer de cartes à jour ; l'application
// affiche la date d'import et signale une carte ancienne.
//
// Prérequis : supabase-lot20-profil-sync.sql (table user_vac_charts + bucket).
// ============================================================================

import { supabase } from '../lib/supabaseClient';

const BUCKET = 'pilot-vac';
const LOG = '🗺️ [VacProfile]';

async function currentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Cycle AIRAC courant — repère de fraîcheur affiché au pilote.
 * Les cycles durent 28 jours ; l'origine 2026-01-08 est un jeudi de cycle.
 */
export function currentAiracCycle(now = new Date()) {
  const origin = Date.UTC(2026, 0, 8);
  const days = Math.floor((now.getTime() - origin) / 86400000);
  const index = Math.floor(days / 28);
  const year = now.getUTCFullYear();
  const cycleInYear = ((index % 13) + 13) % 13 + 1;
  return `${String(year).slice(2)}${String(cycleInYear).padStart(2, '0')}`;
}

/**
 * Téléverse la carte dans l'espace privé du pilote et l'enregistre.
 * Non bloquant pour l'appelant : renvoie false en cas d'échec (la copie locale
 * reste utilisable en vol).
 */
export async function uploadChartToProfile(icao, file, meta = {}) {
  const userId = await currentUserId();
  if (!userId || !file) return false;
  const upperIcao = String(icao).toUpperCase();
  const cycle = meta.airacCycle || currentAiracCycle();
  const path = `${userId}/${upperIcao}-${cycle}.pdf`;

  try {
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;

    const { error: dbErr } = await supabase.from('user_vac_charts').upsert({
      user_id: userId,
      icao: upperIcao,
      airport_name: meta.airportName || null,
      airac_cycle: cycle,
      published_at: meta.publishedAt || null,
      file_path: path,
      file_size: file.size,
      source_url: meta.sourceUrl || null,
      downloaded_at: new Date().toISOString(),
    }, { onConflict: 'user_id,icao,airac_cycle' });
    if (dbErr) throw dbErr;

    console.log(`${LOG} carte ${upperIcao} (cycle ${cycle}) rattachée au profil`);
    return true;
  } catch (e) {
    console.warn(`${LOG} envoi de la carte ${upperIcao} impossible (copie locale conservée) :`, e?.message);
    return false;
  }
}

/** Liste les cartes du pilote (métadonnées seules). */
export async function listProfileCharts() {
  const userId = await currentUserId();
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_vac_charts')
      .select('*')
      .eq('user_id', userId)
      .order('downloaded_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn(`${LOG} lecture des cartes impossible :`, e?.message);
    return [];
  }
}

/** Récupère le PDF d'une carte du profil (URL signée courte). */
export async function getProfileChartUrl(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET).createSignedUrl(filePath, 300);
    if (error) throw error;
    return data?.signedUrl || null;
  } catch (e) {
    console.warn(`${LOG} lien de carte impossible :`, e?.message);
    return null;
  }
}

/**
 * 🔁 RATTRAPAGE (retour César 16/08) : les cartes déjà téléchargées AVANT ce
 * lot — ou importées par le module « Cartes VAC » — n'étaient rattachées à
 * aucun profil : rien ne pouvait donc être restauré après un vidage de cache.
 * À la connexion, on envoie au serveur les cartes locales encore absentes.
 * @returns {Promise<number>} nombre de cartes rattachées
 */
export async function backfillLocalCharts() {
  const userId = await currentUserId();
  if (!userId) return 0;
  try {
    const { useVACStore } = await import('@core/stores/vacStore');
    const { vacPdfStorage } = await import('./vacPdfStorage');
    const charts = useVACStore.getState().charts || {};
    const local = Object.values(charts).filter((c) => c?.isDownloaded && c?.icao);
    if (local.length === 0) return 0;

    const remote = await listProfileCharts();
    const known = new Set(remote.map((r) => r.icao));
    let sent = 0;

    for (const chart of local) {
      if (known.has(chart.icao)) continue;
      try {
        // Le PDF vit dans le stockage local des cartes : on le relit pour
        // l'envoyer tel quel (aucune re-conversion, aucune perte).
        // getPDF renvoie l'ENREGISTREMENT { icao, fileName, pdfBlob… }.
        const record = await vacPdfStorage.getPDF(chart.icao);
        const blob = record?.pdfBlob;
        if (!blob) continue;
        const file = blob instanceof File
          ? blob
          : new File([blob], record.fileName || `${chart.icao}.pdf`, { type: 'application/pdf' });
        const ok = await uploadChartToProfile(chart.icao, file, {
          airportName: chart.name || null,
        });
        if (ok) sent += 1;
      } catch (e) {
        console.warn(`${LOG} rattachement de ${chart.icao} :`, e?.message);
      }
    }
    if (sent > 0) console.log(`${LOG} ${sent} carte(s) locale(s) rattachée(s) au profil`);
    return sent;
  } catch (e) {
    console.warn(`${LOG} rattrapage des cartes impossible :`, e?.message);
    return 0;
  }
}

/**
 * Restaure en local les cartes du profil absentes du navigateur.
 * Appelée après connexion : le pilote retrouve ses cartes sur un appareil neuf.
 * @returns {Promise<number>} nombre de cartes restaurées
 */
export async function restoreProfileCharts() {
  const charts = await listProfileCharts();
  if (charts.length === 0) return 0;

  const { useVACStore } = await import('@core/stores/vacStore');
  const { vacPdfStorage } = await import('./vacPdfStorage');
  const store = useVACStore.getState();
  let restored = 0;

  for (const chart of charts) {
    try {
      if (store.charts?.[chart.icao]?.isDownloaded) continue; // déjà en local
      const url = await getProfileChartUrl(chart.file_path);
      if (!url) continue;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const file = new File([blob], `${chart.icao}.pdf`, { type: 'application/pdf' });
      await vacPdfStorage.storePDF(chart.icao, file);
      store.addCustomChart(chart.icao, {
        name: `${chart.icao}.pdf`,
        url: URL.createObjectURL(blob),
        fileName: `${chart.icao}.pdf`,
        fileSize: (blob.size / 1024).toFixed(1) + ' KB',
        fileType: 'application/pdf',
        hasPdf: true,
        isDownloaded: true,
        downloadDate: chart.downloaded_at,
        airacCycle: chart.airac_cycle,
        needsManualExtraction: true,
      });
      restored += 1;
    } catch (e) {
      console.warn(`${LOG} restauration de ${chart.icao} :`, e?.message);
    }
  }
  if (restored > 0) console.log(`${LOG} ${restored} carte(s) restaurée(s) depuis le profil`);
  return restored;
}

export default {
  uploadChartToProfile, listProfileCharts, getProfileChartUrl,
  restoreProfileCharts, backfillLocalCharts, currentAiracCycle,
};
