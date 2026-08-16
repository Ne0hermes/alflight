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
  // 🔄 Complément 16/08 : ce qui ne revenait PAS après vidage du cache.
  // Conservés en JSON tels quels (formes libres) → restauration fidèle.
  units_preferences: readLocalJson('units-preferences'),
  certifications: readLocalJson('pilotCertifications'),
  medical_records: readLocalJson('pilotMedicalRecords'),
  // Petites préférences d'interface qui CONDITIONNENT l'affichage : sans les
  // favoris VAC, une carte pourtant restaurée reste invisible (le module
  // s'ouvre sur l'onglet Favoris) — retour César 16/08.
  app_preferences: {
    vacFavorites: readLocalJson('sia_favorite_aerodromes'),
    vacEditedData: readLocalJson('sia_edited_data'),
  },
  updated_at: new Date().toISOString(),
});

/** Lit une clé locale en JSON ; null si absente ou illisible. */
function readLocalJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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

/** Écrit une clé locale si le serveur a une valeur ET que le local est vide. */
function restoreLocalJson(key, value) {
  if (value === null || value === undefined) return false;
  try {
    const existing = localStorage.getItem(key);
    if (existing && existing !== '{}' && existing !== '[]' && existing !== 'null') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ─── PHOTO DU PROFIL (espace privé pilot-photos) ───────────────────────────
const PHOTO_BUCKET = 'pilot-photos';

/** Lit la photo dans la base locale (elle n'est jamais dans localStorage). */
async function readLocalProfilePhoto() {
  try {
    const { default: dataBackupManager } = await import('@utils/dataBackupManager');
    await dataBackupManager.initPromise;
    const stored = await dataBackupManager.getProtectedData('pilotProfilePhoto');
    return stored?.photo || null;
  } catch {
    return null;
  }
}

/** Réinstalle la photo dans la base locale (chemin de lecture du profil). */
async function writeLocalProfilePhoto(photo) {
  try {
    const { default: dataBackupManager } = await import('@utils/dataBackupManager');
    await dataBackupManager.initPromise;
    await dataBackupManager.saveProtectedData('pilotProfilePhoto', { photo }, 'pilotPhoto');
    return true;
  } catch {
    return false;
  }
}

/** Envoie la photo (data URL base64) dans l'espace privé du pilote. */
export async function pushProfilePhoto(photoDataUrl) {
  const userId = await currentUserId();
  if (!userId || typeof photoDataUrl !== 'string' || !photoDataUrl.startsWith('data:')) return null;
  try {
    const resp = await fetch(photoDataUrl);
    const blob = await resp.blob();
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const path = `${userId}/photo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (upErr) throw upErr;
    await supabase.from('pilot_profiles')
      .upsert({ user_id: userId, photo_path: path, updated_at: new Date().toISOString() },
              { onConflict: 'user_id' });
    console.log(`${LOG} photo du profil enregistrée`);
    return path;
  } catch (e) {
    console.warn(`${LOG} envoi de la photo impossible :`, e?.message);
    return null;
  }
}

/** Récupère la photo du profil en data URL (pour réinjection locale). */
export async function pullProfilePhoto(photoPath) {
  if (!photoPath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET).createSignedUrl(photoPath, 300);
    if (error) throw error;
    const resp = await fetch(data.signedUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn(`${LOG} lecture de la photo impossible :`, e?.message);
    return null;
  }
}

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

/** Ligne brute du profil (inclut les blocs JSON et le chemin de la photo). */
export async function pullProfileRow() {
  const userId = await currentUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('pilot_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.warn(`${LOG} lecture du profil impossible :`, e?.message);
    return null;
  }
}

export async function pullProfile() {
  const row = await pullProfileRow();
  return row ? rowToProfile(row) : null;
}

/**
 * Renvoie au serveur l'état LOCAL COURANT du profil et de ses annexes
 * (licences, médical, unités, favoris). À appeler après TOUTE modification de
 * ces données — y compris une SUPPRESSION : les annexes étant stockées en bloc,
 * réécrire le bloc supprime réellement l'élément retiré côté serveur
 * (retour César 16/08 : une donnée effacée doit l'être aussi dans la base).
 */
export async function syncProfileFromLocal() {
  try {
    const raw = localStorage.getItem('pilotProfile');
    if (!raw) return false;
    return await pushProfile(JSON.parse(raw));
  } catch (e) {
    console.warn(`${LOG} synchronisation du profil impossible :`, e?.message);
    return false;
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

/**
 * 🗑️ SUPPRESSION D'UN VOL — propagée au serveur (retour César 16/08).
 * Sans cela, un vol supprimé localement RESSUSCITAIT à la restauration : le
 * serveur en gardait la trace et la fusion le réinstallait.
 *
 * Suppression LOGIQUE (deleted_at) et jamais physique : un carnet de vol est
 * un document opposable — on trace, on n'efface pas.
 *
 * @param {Array} remainingEntries liste locale APRÈS suppression (fait foi)
 */
export async function syncLogbookDeletions(remainingEntries) {
  const userId = await currentUserId();
  if (!userId || !Array.isArray(remainingEntries)) return 0;
  try {
    const keep = new Set(remainingEntries.map((e) => entryToRow(e, userId).client_id));
    const { data: serverRows, error } = await supabase
      .from('logbook_entries')
      .select('client_id')
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw error;

    const toDelete = (serverRows || [])
      .map((r) => r.client_id)
      .filter((id) => !keep.has(id));
    if (toDelete.length === 0) return 0;

    const { error: delErr } = await supabase
      .from('logbook_entries')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('client_id', toDelete);
    if (delErr) throw delErr;
    console.log(`${LOG} ${toDelete.length} vol(s) supprimé(s) côté serveur`);
    return toDelete.length;
  } catch (e) {
    console.warn(`${LOG} propagation de la suppression impossible :`, e?.message);
    return 0;
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

  // 1. Profil + annexes (unités, licences, médical, photo)
  try {
    const row = await pullProfileRow();
    const localProfile = localStorage.getItem('pilotProfile');
    const hasLocal = localProfile && JSON.parse(localProfile)?.firstName;

    if (!hasLocal && row?.first_name) {
      const restored = rowToProfile(row);
      // 📷 Photo : remise dans la base locale (là où le profil la relit) —
      // jamais dans localStorage, qui saturerait.
      const photo = await pullProfilePhoto(row.photo_path);
      if (photo) {
        await writeLocalProfilePhoto(photo);
        restored.hasPhotoInDB = true;
      }
      localStorage.setItem('pilotProfile', JSON.stringify(restored));
      result.profile = true;
      window.dispatchEvent(new CustomEvent('profile-configured'));
    } else if (hasLocal) {
      // Local présent : le serveur reçoit la copie à jour (profil + photo)
      const p = JSON.parse(localProfile);
      await pushProfile(p);
      // 📷 La photo N'EST PAS dans localStorage : elle est extraite à la
      // sauvegarde et rangée en base locale (marqueur hasPhotoInDB) pour éviter
      // de saturer le quota. Sans cette lecture, rien n'était jamais envoyé —
      // c'est pourquoi la photo ne revenait pas (retour César 16/08).
      const photo = p.photo || (await readLocalProfilePhoto());
      if (photo) await pushProfilePhoto(photo);
    }

    // Annexes restaurées seulement si le local est vide (le local fait foi) :
    // préférences d'unités, licences/qualifications, suivi médical.
    if (row) {
      if (restoreLocalJson('units-preferences', row.units_preferences)) result.units = true;
      if (restoreLocalJson('pilotCertifications', row.certifications)) result.certifications = true;
      if (restoreLocalJson('pilotMedicalRecords', row.medical_records)) result.medical = true;
      // Favoris VAC : sans eux, une carte restaurée reste invisible.
      if (row.app_preferences) {
        restoreLocalJson('sia_favorite_aerodromes', row.app_preferences.vacFavorites);
        restoreLocalJson('sia_edited_data', row.app_preferences.vacEditedData);
      }
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

  // 3. Flotte — dans les DEUX sens
  try {
    const fleet = await pullFleet();
    const { default: dataBackupManager } = await import('@utils/dataBackupManager');
    const localRecords = await dataBackupManager.getAllFromStore('aircraftData');
    const mine = (localRecords || []).filter(
      (a) => !a.ownerAccountId || a.ownerAccountId === userId
    );

    // 3a. RATTRAPAGE (retour César 16/08) : les avions présents AVANT ce lot
    // n'avaient jamais été rattachés au compte — rien ne pouvait donc être
    // restauré après un vidage de cache. On envoie ici la flotte locale.
    const attached = new Set(fleet.map((f) => String(f.registration).toUpperCase()));
    const toAttach = mine.filter(
      (a) => a.registration && !attached.has(String(a.registration).toUpperCase())
    );
    if (toAttach.length > 0) {
      await pushFleet(toAttach.map((a) => ({
        registration: a.registration,
        communityPresetId: a.communityPresetId || a._metadata?.supabaseId || null,
      })));
      console.log(`${LOG} ${toAttach.length} avion(s) local(aux) rattaché(s) au compte`);
    }

    // 3b. Restauration : re-télécharge les avions du compte absents en local
    if (fleet.length > 0) {
      const localRegs = new Set(
        mine.map((a) => String(a.registration || '').trim().toUpperCase())
      );
      const missing = fleet.filter((f) => !localRegs.has(f.registration));
      if (missing.length > 0) {
        const { default: communityService } = await import('./communityService');
        for (const item of missing) {
          try {
            // Repli par IMMATRICULATION quand la fiche d'origine n'a pas été
            // mémorisée (avions rattachés par rattrapage) — sans cela, l'avion
            // était irrécupérable (retour César 16/08).
            let presetId = item.community_preset_id;
            if (!presetId) {
              const { data: found } = await supabase
                .from('community_presets')
                .select('id')
                .ilike('registration', item.registration)
                .eq('status', 'active')
                .limit(1);
              presetId = found?.[0]?.id || null;
              if (presetId) {
                await supabase.from('user_aircraft')
                  .update({ community_preset_id: presetId })
                  .eq('user_id', userId).eq('registration', item.registration);
              }
            }
            if (!presetId) {
              console.warn(`${LOG} ${item.registration} introuvable dans la base communautaire — non restauré`);
              continue;
            }
            const full = await communityService.getPresetById(presetId);
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
          // La liste d'avions est lue AU DÉMARRAGE : sans rafraîchissement,
          // les avions restaurés n'apparaissaient qu'au rechargement suivant.
          try {
            const { useAircraftStore } = await import('@core/stores/aircraftStore');
            const refreshed = await dataBackupManager.getAllFromStore('aircraftData');
            const visible = (refreshed || []).filter(
              (a) => !a.ownerAccountId || a.ownerAccountId === userId
            ).map(({ photo, profilePhoto, manex, ...light }) => ({
              ...light,
              hasPhoto: !!(photo || profilePhoto),
              hasManex: !!manex,
            }));
            useAircraftStore.setState({ aircraftList: visible, isInitialized: true });
            window.dispatchEvent(new CustomEvent('aircraft-list-restored'));
          } catch (refreshErr) {
            console.warn(`${LOG} rafraîchissement de la liste :`, refreshErr?.message);
          }
        }
      }
    }
  } catch (e) {
    console.warn(`${LOG} restauration de la flotte :`, e?.message);
  }

  // 4. Cartes VAC — dans les DEUX sens, comme la flotte : on rattache d'abord
  // les cartes déjà présentes en local (téléchargées avant ce lot ou via le
  // module « Cartes VAC »), puis on restaure celles qui manquent.
  try {
    const { restoreProfileCharts, backfillLocalCharts } = await import('./vacProfileService');
    await backfillLocalCharts();
    result.vacCharts = await restoreProfileCharts();
  } catch (e) {
    console.warn(`${LOG} synchronisation des cartes VAC :`, e?.message);
  }

  return result;
}

export default {
  pushProfile, pullProfile,
  pushLogbook, pullLogbook,
  pushFleet, removeFromFleet, pullFleet,
  restoreAccountFromServer,
};
