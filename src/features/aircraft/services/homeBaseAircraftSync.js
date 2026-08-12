// src/features/aircraft/services/homeBaseAircraftSync.js
// 🔧 LOT 11 — Import automatique des avions communautaires rattachés à
// l'aérodrome d'attache du pilote (profil pilote, champ homeBase).
// Déclenché : (a) à l'enregistrement du profil, (b) au démarrage de l'app
// (une fois par session, si une base est renseignée).
//
// Garde-fous :
// - un preset déjà TRAITÉ n'est JAMAIS ré-importé (marqueur localStorage par
//   id de preset) : un avion importé puis SUPPRIMÉ par le pilote ne revient
//   pas à chaque démarrage ;
// - une immatriculation déjà présente localement n'est pas dupliquée ;
// - échec réseau/import : non marqué traité → nouvel essai à la session
//   suivante, jamais d'erreur bloquante (confort, pas fonctionnalité vitale).
import communityService from '@services/communityService';
import { useAircraftStore } from '@core/stores/aircraftStore';

const MARKER_KEY = 'homeBaseAutoImport';

const readMarker = () => {
  try { return JSON.parse(localStorage.getItem(MARKER_KEY)) || {}; } catch { return {}; }
};
const writeMarker = (m) => {
  try { localStorage.setItem(MARKER_KEY, JSON.stringify(m)); } catch { /* stockage plein : tant pis, on retentera */ }
};

/**
 * Importe les avions communautaires basés à `homeBaseIcao` qui ne sont ni déjà
 * présents localement, ni déjà traités par une synchronisation passée.
 * @returns {Promise<{ imported: string[], skipped: number }>} immatriculations
 * importées + nombre de presets ignorés (déjà connus/traités).
 */
export async function syncHomeBaseAircraft(homeBaseIcao) {
  const icao = String(homeBaseIcao || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) return { imported: [], skipped: 0 };

  const presets = await communityService.getPresetsByHomeBase(icao);
  if (presets.length === 0) return { imported: [], skipped: 0 };

  const marker = readMarker();
  // Marqueur PAR base ({ bases: { [icao]: processedIds } }) : un changement de
  // base A→B→A ne détruit pas les processedIds de A — sinon un avion importé
  // puis supprimé en A serait ré-importé au retour, en violation de la
  // garantie d'en-tête. Migration de l'ancien format mono-base {icao, processedIds}.
  const bases = marker.bases
    || (marker.icao ? { [marker.icao]: marker.processedIds || [] } : {});
  const processed = new Set(bases[icao] || []);
  const knownRegs = new Set(
    (useAircraftStore.getState().aircraftList || [])
      .map(a => (a.registration || '').trim().toUpperCase())
      .filter(Boolean)
  );

  const imported = [];
  let skipped = 0;
  for (const preset of presets) {
    const reg = (preset.registration || '').trim().toUpperCase();
    if (processed.has(preset.id) || knownRegs.has(reg)) {
      skipped++;
      processed.add(preset.id);
      continue;
    }
    try {
      const aircraftData = await communityService.getPresetById(preset.id);
      if (!aircraftData?.registration) { processed.add(preset.id); continue; }
      await useAircraftStore.getState().addAircraft(aircraftData);
      imported.push(reg);
      knownRegs.add(reg);
      processed.add(preset.id);
      console.log(`✈️ [HomeBaseSync] ${reg} (${icao}) importé depuis la communauté`);
    } catch (e) {
      // Pas marqué traité → sera retenté à la prochaine synchronisation
      console.warn(`⚠️ [HomeBaseSync] Import ${reg} impossible :`, e?.message);
    }
  }

  bases[icao] = [...processed];
  writeMarker({ bases, lastSync: Date.now() });
  return { imported, skipped };
}

/**
 * Synchronisation de DÉMARRAGE : lit la base d'attache du profil pilote
 * (localStorage) et lance l'import une seule fois par session.
 */
export async function syncHomeBaseAircraftAtBoot() {
  try {
    if (sessionStorage.getItem('homeBaseSyncDone')) return null;
    sessionStorage.setItem('homeBaseSyncDone', '1');
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || 'null');
    const homeBase = profile?.homeBase;
    if (!homeBase) return null;
    return await syncHomeBaseAircraft(homeBase);
  } catch (e) {
    console.warn('⚠️ [HomeBaseSync] Synchronisation au démarrage impossible :', e?.message);
    return null;
  }
}
