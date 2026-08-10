// src/core/stores/windsAloftStore.js
// Cache des profils de vents en altitude (Lot 6-B) — patron du weatherStore.
// Clé de cache : grille 0,1° (~6 NM) — sous la maille utile VFR, borne le
// nombre d'appels Open-Meteo (une nav de 100 NM ≈ 10-20 cellules).
// TTL 60 min (modèles horaires, AROME rafraîchi ~3 h chez Open-Meteo).
// Non persisté : la météo se re-vérifie à chaque session (même règle que le
// weatherStore). Vent MANUEL : prioritaire sur tout, saisi pour le vol en
// cours, non persisté.
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { fetchWindsAloftProfile, sampleWind } from '../../services/windsAloftAPI';

const TTL_MS = 60 * 60 * 1000;
// TTL court après un ÉCHEC : on retente au bout de 5 min (réseau revenu),
// mais jamais à chaque re-render (anti tempête de retries hors-ligne)
const ERROR_TTL_MS = 5 * 60 * 1000;

export const windsAloftKey = (lat, lon) => {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  return `${la.toFixed(1)},${lo.toFixed(1)}`;
};

export const useWindsAloftStore = create(immer((set, get) => ({
  profiles: {},   // Object<key, profile>
  loading: {},    // Object<key, boolean>
  errors: {},     // Object<key, string>
  lastFetch: {},  // Object<key, ms epoch>

  // Vent saisi MANUELLEMENT pour le vol en cours (priorité absolue).
  // { directionDeg, speedKt } | null
  manualWind: null,

  setManualWind: (directionDeg, speedKt) => set((state) => {
    const d = parseFloat(directionDeg);
    const s = parseFloat(speedKt);
    state.manualWind = (Number.isFinite(d) && Number.isFinite(s) && s >= 0)
      ? { directionDeg: ((d % 360) + 360) % 360, speedKt: s }
      : null;
  }),
  clearManualWind: () => set((state) => { state.manualWind = null; }),

  needsRefresh: (key) => {
    const state = get();
    const last = state.lastFetch[key];
    if (!last) return true;
    // Un échec récent (errors[key]) expire plus vite qu'un profil valide
    const ttl = state.errors[key] ? ERROR_TTL_MS : TTL_MS;
    return (Date.now() - last) > ttl;
  },

  fetchProfile: async (lat, lon) => {
    const key = windsAloftKey(lat, lon);
    if (!key) return null;
    const state = get();
    if (state.loading[key]) return state.profiles[key] ?? null;
    // ⚠️ Court-circuit sur le TTL SEUL : exiger aussi profiles[key] rendait le
    // garde inopérant après un échec (retry à chaque re-render hors-ligne)
    if (!state.needsRefresh(key)) return state.profiles[key] ?? null;

    set((s) => { s.loading[key] = true; });
    const profile = await fetchWindsAloftProfile(lat, lon);
    set((s) => {
      s.loading[key] = false;
      s.lastFetch[key] = Date.now();
      if (profile) {
        s.profiles[key] = profile;
        delete s.errors[key];
      } else {
        s.errors[key] = 'Vents en altitude non disponibles';
      }
    });
    return profile;
  },

  // Fire-and-forget pour une liste de points (segments d'une navigation) :
  // déduplique par cellule de grille, ne relance pas ce qui est frais.
  ensureProfiles: (points) => {
    const seen = new Set();
    (points || []).forEach((p) => {
      const key = windsAloftKey(p?.lat, p?.lon);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const state = get();
      if (state.loading[key]) return;
      if (!state.needsRefresh(key)) return;
      state.fetchProfile(p.lat, p.lon);
    });
  },

  /**
   * Vent au point/altitude/heure — SYNCHRONE (lecture du cache), utilisable
   * dans les useMemo. Priorité : manuel > profil Open-Meteo en cache > null.
   * @returns {{ directionDeg, speedKt, temperatureC?, source, timeISO? } | null}
   */
  getWindAt: (lat, lon, altitudeFt, when = new Date()) => {
    const state = get();
    if (state.manualWind) {
      return { ...state.manualWind, source: 'manual' };
    }
    const key = windsAloftKey(lat, lon);
    if (!key) return null;
    const profile = state.profiles[key];
    if (!profile) return null;
    return sampleWind(profile, altitudeFt, when);
  }
})));
