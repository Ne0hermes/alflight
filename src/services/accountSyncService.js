// src/services/accountSyncService.js
// ============================================================================
// 🔄 LOT 2.0 — SYNCHRONISATION DU COMPTE PILOTE
// ----------------------------------------------------------------------------
// Jusqu'ici, le profil pilote, le carnet de vol et la flotte n'existaient QUE
// dans le navigateur : un vidage de cache les effaçait définitivement (dont le
// carnet de vol, non reconstituable). Ce service en tient une copie serveur,
// rattachée au compte, restaurée à la reconnexion — y compris sur un appareil
// neuf.
//
// PRINCIPES
//  • Local d'abord : l'écriture locale reste la source immédiate ; l'envoi
//    serveur suit et n'est JAMAIS bloquant (échec réseau = travail conservé).
//  • Carnet de vol : mise à jour PAR CLÉ (client_id), jamais « effacer puis
//    réécrire » — c'est un document opposable.
//  • Flotte : seul le RATTACHEMENT est synchronisé (immatriculation + fiche
//    communautaire) ; les fiches techniques sont re-téléchargées du référentiel.
//  • Cloisonnement : la RLS ne laisse voir à chacun que ses propres lignes.
//
// Prérequis : supabase-lot20-profil-sync.sql
// ============================================================================

import { supabase } from '../lib/supabaseClient';

const LOG = '🔄 [AccountSync]';

async function currentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

// ─── PROFIL ────────────────────────────────────────────────────────────────
const profileToRow = (p, userId) => ({
  user_id: userId,
  first_name: p.firstName || null,
  last_name: p.lastName || null,
  date_of_birth: p.dateOfBirth || null,
  nationality: p.nationality || null,
  email: p.email || null,
  phone: p.phone || null,
  address: p.address || null,
  city: p.city || null,
  postal_code: p.postalCode || null,
  country: p.country || null,
  license_number: p.licenseNumber || null,
  license_type: p.licenseType || null,
  license_country: p.licenseCountry || null,
  license_issue_date: p.licenseIssueDate || null,
  license_expiry_date: p.licenseExpiryDate || null,
  total_flight_hours: Number(p.totalFlightHours) || 0,
  total_landings: Number(p.totalLandings) || 0,
  hours_as_p1: Number(p.hoursAsP1) || 0,
  hours_as_p2: Number(p.hoursAsP2) || 0,
  day_hours: Number(p.dayHours) || 0,
  night_hours: Number(p.nightHours) || 0,
  ifr_hours: Number(p.ifrHours) || 0,
  cross_country_hours: Number(p.crossCountryHours) || 0,
  instructor_hours: Number(p.instructorHours) || 0,
  home_base: p.homeBase || null,
  club_school: p.clubSchool || null,
  default_aircraft: p.defaultAircraft || null,
  preferred_units: p.preferredUnits || null,
  updated_at: new Date().toISOString(),
});

const rowToProfile = (r) => ({
  firstName: r.first_name || '', lastName: r.last_name || '',
  dateOfBirth: r.date_of_birth || '', nationality: r.nationality || '',
  email: r.email || '', phone: r.phone || '', address: r.address || '',
  city: r.city || '', postalCode: r.postal_code || '', country: r.country || '',
  licenseNumber: r.license_number || '', licenseType: r.license_type || 'PPL',
  licenseCountry: r.license_country || 'France',
  licenseIssueDate: r.license_issue_date || '', licenseExpiryDate: r.license_expiry_date || '',
  totalFlightHours: r.total_flight_hours || 0, totalLandings: r.total_landings || 0,
  hoursAsP1: r.hours_as_p1 || 0, hoursAsP2: r.hours_as_p2 || 0,
  dayHours: r.day_hours || 0, nightHours: r.night_hours || 0,
  ifrHours: r.ifr_hours || 0, crossCountryHours: r.cross_country_hours || 0,
  instructorHours: r.instructor_hours || 0,
  homeBase: r.home_base || '', clubSchool: r.club_school || '',
  defaultAircraft: r.default_aircraft || '', preferredUnits: r.preferred_units || 'metric',
});

/** Envoie le profil au serveur. Non bloquant : renvoie false en cas d'échec. */
export async function pushProfile(profile) {
  const userId = await currentUserId();
  if (!userId || !profile) return false;
  try {
    const { error } = await supabase
      .from('pilot_profiles')
      .upsert(profileToRow(profile, userId), { onConflict: 'user_id' });
    if (error) throw error;
    console.log(`${LOG} profil enregistré côté serveur`);
    return true;
  } catch (e) {
    console.warn(`${LOG} envoi du profil impossible (conservé en local) :`, e?.message);
    return false;
  }
}

export async function pullProfile() {
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('pilot_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data ? rowToProfile(data) : null;
  } catch (e) {
    console.warn(`${LOG} lecture du profil impossible :`, e?.message);
    return null;
  }
}

// ─── CARNET DE VOL ─────────────────────────────────────────────────────────
const entryToRow = (e, userId) => ({
  user_id: userId,
  client_id: String(e.id ?? `${e.date}-${e.departure}-${e.arrival}-${e.blockOff || ''}`),
  flight_date: e.date || null,
  departure: e.departure || null, arrival: e.arrival || null, route: e.route || null,
  aircraft_registration: e.aircraft || null, aircraft_type: e.aircraftType || null,
  aircraft_group: e.aircraftGroup || null,
  pilot_in_command: e.pilotInCommand || null, copilot: e.copilot || null,
  block_off: e.blockOff || null, take_off: e.takeOff || null,
  landing: e.landing || null, block_on: e.blockOn || null,
  total_time: e.totalTime || null,
  night_time: Number(e.nightTime) || 0, ifr_time: Number(e.ifrTime) || 0,
  flight_type: e.flightType || null, pilot_function: e.pilotFunction || null,
  landings_day: Number(e.landingsDay ?? e.landings) || 0,
  landings_night: Number(e.landingsNight) || 0,
  remarks: e.remarks || null,
  details: e,                       // conserve TOUS les champs (segments inclus)
  updated_at: new Date().toISOString(),
});

/** Envoie les vols au serveur (mise à jour par clé — aucun vol détruit). */
export async function pushLogbook(entries) {
  const userId = await currentUserId();
  if (!userId || !Array.isArray(entries) || entries.length === 0) return false;
  try {
    const rows = entries.map((e) => entryToRow(e, userId));
    const { error } = await supabase
      .from('logbook_entries')
      .upsert(rows, { onConflict: 'user_id,client_id' });
    if (error) throw error;
    console.log(`${LOG} carnet de vol enregistré (${rows.length} vol(s))`);
    return true;
  } catch (e) {
    console.warn(`${LOG} envoi du carnet impossible (conservé en local) :`, e?.message);
    return false;
  }
}

export async function pullLogbook() {
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('logbook_entries')
      .select('details, client_id, deleted_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('flight_date', { ascending: false });
    if (error) throw error;
    // `details` porte l'entrée complète telle que l'application la manipule
    return (data || []).map((r) => ({ ...(r.details || {}), id: r.details?.id ?? r.client_id }));
  } catch (e) {
    console.warn(`${LOG} lecture du carnet impossible :`, e?.message);
    return null;
  }
}

// ─── FLOTTE (rattachement seul) ────────────────────────────────────────────
export async function pushFleet(aircraftList) {
  const userId = await currentUserId();
  if (!userId || !Array.isArray(aircraftList)) return false;
  try {
    const rows = aircraftList
      .filter((a) => a?.registration)
      .map((a) => ({
        user_id: userId,
        registration: String(a.registration).trim().toUpperCase(),
        community_preset_id: a.communityPresetId || null,
        tank_variant_id: a.selectedTankVariantId || null,
        is_default: false,
      }));
    if (rows.length === 0) return false;
    const { error } = await supabase
      .from('user_aircraft')
      .upsert(rows, { onConflict: 'user_id,registration' });
    if (error) throw error;
    console.log(`${LOG} flotte enregistrée (${rows.length} avion(s))`);
    return true;
  } catch (e) {
    console.warn(`${LOG} envoi de la flotte impossible :`, e?.message);
    return false;
  }
}

/** Retire un avion du rattachement serveur (suppression volontaire côté pilote). */
export async function removeFromFleet(registration) {
  const userId = await currentUserId();
  if (!userId || !registration) return false;
  try {
    const { error } = await supabase
      .from('user_aircraft')
      .delete()
      .eq('user_id', userId)
      .eq('registration', String(registration).trim().toUpperCase());
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn(`${LOG} retrait de la flotte impossible :`, e?.message);
    return false;
  }
}

export async function pullFleet() {
  const userId = await currentUserId();
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_aircraft').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn(`${LOG} lecture de la flotte impossible :`, e?.message);
    return [];
  }
}

// ─── RESTAURATION À LA CONNEXION ───────────────────────────────────────────
/**
 * Appelé après authentification : réinstalle en local ce qui manque.
 * Ne SUPPRIME jamais de données locales — en cas de divergence, le local est
 * conservé et renvoyé au serveur (le pilote ne perd pas son travail hors ligne).
 * @returns {Promise<{profile:boolean, logbook:number, fleet:number}>}
 */
export async function restoreAccountFromServer() {
  const userId = await currentUserId();
  if (!userId) return { profile: false, logbook: 0, fleet: 0 };
  const result = { profile: false, logbook: 0, fleet: 0, vacCharts: 0 };

  // 1. Profil — restauré uniquement s'il manque en local (le local fait foi)
  try {
    const localProfile = localStorage.getItem('pilotProfile');
    const hasLocal = localProfile && JSON.parse(localProfile)?.firstName;
    if (!hasLocal) {
      const remote = await pullProfile();
      if (remote?.firstName) {
        localStorage.setItem('pilotProfile', JSON.stringify(remote));
        result.profile = true;
        window.dispatchEvent(new CustomEvent('profile-configured'));
      }
    } else {
      // Local présent : on s'assure que le serveur en a une copie à jour
      await pushProfile(JSON.parse(localProfile));
    }
  } catch (e) {
    console.warn(`${LOG} restauration du profil :`, e?.message);
  }

  // 2. Carnet de vol — fusion par identifiant, jamais d'écrasement
  try {
    const remote = await pullLogbook();
    if (Array.isArray(remote) && remote.length > 0) {
      let local = [];
      try { local = JSON.parse(localStorage.getItem('pilotLogbook') || '[]') || []; } catch { local = []; }
      const byId = new Map();
      for (const e of remote) byId.set(String(e.id), e);
      for (const e of local) byId.set(String(e.id), e); // le local, plus récent, gagne
      const merged = Array.from(byId.values());
      localStorage.setItem('pilotLogbook', JSON.stringify(merged));
      result.logbook = merged.length - local.length;
      if (local.length > 0) await pushLogbook(local); // renvoyer les vols hors ligne
    }
  } catch (e) {
    console.warn(`${LOG} restauration du carnet :`, e?.message);
  }

  // 3. Flotte — re-télécharge les avions absents en local depuis le référentiel
  try {
    const fleet = await pullFleet();
    if (fleet.length > 0) {
      const { default: dataBackupManager } = await import('@utils/dataBackupManager');
      const localRecords = await dataBackupManager.getAllFromStore('aircraftData');
      const localRegs = new Set(
        (localRecords || [])
          .filter((a) => !a.ownerAccountId || a.ownerAccountId === userId)
          .map((a) => String(a.registration || '').trim().toUpperCase())
      );
      const missing = fleet.filter((f) => !localRegs.has(f.registration));
      if (missing.length > 0) {
        const { default: communityService } = await import('./communityService');
        for (const item of missing) {
          try {
            if (!item.community_preset_id) continue;
            const full = await communityService.getPresetById(item.community_preset_id);
            if (!full) continue;
            const ts = Date.now() + Math.floor(Math.random() * 1000);
            await dataBackupManager.saveAircraftData({
              ...full,
              id: `aircraft-${ts}`,
              aircraftId: `aircraft-${ts}`,
              ownerAccountId: userId,
            });
            result.fleet += 1;
          } catch (err) {
            console.warn(`${LOG} re-téléchargement de ${item.registration} :`, err?.message);
          }
        }
        if (result.fleet > 0) {
          console.log(`${LOG} ${result.fleet} avion(s) restauré(s) depuis la base communautaire`);
        }
      }
    }
  } catch (e) {
    console.warn(`${LOG} restauration de la flotte :`, e?.message);
  }

  // 4. Cartes VAC du profil — le pilote retrouve ses cartes sur un appareil neuf
  try {
    const { restoreProfileCharts } = await import('./vacProfileService');
    result.vacCharts = await restoreProfileCharts();
  } catch (e) {
    console.warn(`${LOG} restauration des cartes VAC :`, e?.message);
  }

  return result;
}

export default {
  pushProfile, pullProfile,
  pushLogbook, pullLogbook,
  pushFleet, removeFromFleet, pullFleet,
  restoreAccountFromServer,
};
