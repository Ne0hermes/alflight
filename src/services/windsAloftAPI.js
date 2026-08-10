// src/services/windsAloftAPI.js
// Vents en altitude via Open-Meteo (Lot 6-B) — gratuit, sans clé, modèles
// haute résolution (AROME Météo-France inclus via best_match en France).
// Service SÉPARÉ de weatherAPI (AVWX/ICAO) : ici on interroge par lat/lon.
// Règle A5 du projet : tout échec retourne null — jamais de vent fabriqué.
//
// Un SEUL appel réseau renvoie TOUS les niveaux × 48 h : fetchWindsAloftProfile
// ramène le profil complet, sampleWind (pur, synchrone) interpole ensuite à
// l'altitude/heure voulues — la mise en cache par point de grille est assurée
// par windsAloftStore.

// Niveaux de pression couvrant les altitudes VFR (~360 → ~10 000 ft ISA)
const PRESSURE_LEVELS_HPA = [1000, 950, 925, 900, 850, 800, 700];

// 🔧 LOT 6-C — paramètres « phénomènes significatifs » (contenu chiffré de la
// TEMSI) : isotherme 0 °C, couches nuageuses, visibilité, potentiel orageux.
// ⚠️ visibility n'est pas fournie par tous les modèles (AROME) → null-safe (A5).
const SIGNIFICANT_WX_PARAMS = [
  'freezing_level_height',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'visibility',
  'cape'
];

const buildHourlyParams = () =>
  PRESSURE_LEVELS_HPA.flatMap((hpa) => [
    `wind_speed_${hpa}hPa`,
    `wind_direction_${hpa}hPa`,
    `temperature_${hpa}hPa`,
    `geopotential_height_${hpa}hPa`
  ]).concat(SIGNIFICANT_WX_PARAMS).join(',');

/**
 * Récupère le profil de vents en altitude pour un point.
 * @returns {{ latitude, longitude, fetchedAt, source, hours: Array<{
 *   timeISO: string,
 *   levels: Array<{ hpa, heightFt, directionDeg, speedKt, temperatureC }>
 * }> } | null}
 */
export async function fetchWindsAloftProfile(lat, lon) {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  try {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${la.toFixed(3)}&longitude=${lo.toFixed(3)}`
      + `&hourly=${buildHourlyParams()}`
      + '&wind_speed_unit=kn'
      + '&forecast_days=2'
      + '&timezone=UTC';

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️ [windsAloft] Open-Meteo HTTP ${response.status} pour ${la},${lo}`);
      return null;
    }
    const data = await response.json();
    const times = data?.hourly?.time;
    if (!Array.isArray(times) || times.length === 0) return null;

    const hours = times.map((timeISO, i) => {
      const levels = [];
      for (const hpa of PRESSURE_LEVELS_HPA) {
        const speedKt = data.hourly[`wind_speed_${hpa}hPa`]?.[i];
        const directionDeg = data.hourly[`wind_direction_${hpa}hPa`]?.[i];
        const temperatureC = data.hourly[`temperature_${hpa}hPa`]?.[i];
        const heightM = data.hourly[`geopotential_height_${hpa}hPa`]?.[i];
        if (
          Number.isFinite(speedKt) && Number.isFinite(directionDeg) && Number.isFinite(heightM)
        ) {
          levels.push({
            hpa,
            heightFt: heightM * 3.28084,
            directionDeg,
            speedKt,
            temperatureC: Number.isFinite(temperatureC) ? temperatureC : null
          });
        }
      }
      // Niveaux triés par altitude croissante (le géopotentiel varie avec la météo)
      levels.sort((a, b) => a.heightFt - b.heightFt);

      // 🔧 LOT 6-C — phénomènes significatifs de l'heure (frère de levels[],
      // null par champ si le modèle ne le fournit pas — jamais de valeur inventée)
      const numOrNull = (v) => (Number.isFinite(v) ? v : null);
      const flm = data.hourly.freezing_level_height?.[i];
      const wx = {
        freezingLevelFt: Number.isFinite(flm) ? Math.round(flm * 3.28084) : null,
        cloudCoverLowPct: numOrNull(data.hourly.cloud_cover_low?.[i]),
        cloudCoverMidPct: numOrNull(data.hourly.cloud_cover_mid?.[i]),
        cloudCoverHighPct: numOrNull(data.hourly.cloud_cover_high?.[i]),
        visibilityM: numOrNull(data.hourly.visibility?.[i]),
        capeJkg: numOrNull(data.hourly.cape?.[i])
      };

      return { timeISO, levels, wx };
    });

    return {
      latitude: la,
      longitude: lo,
      fetchedAt: Date.now(),
      source: 'open-meteo',
      hours
    };
  } catch (e) {
    console.warn('⚠️ [windsAloft] Échec Open-Meteo:', e?.message);
    return null;
  }
}

/**
 * Interpole le vent à une altitude et une heure données dans un profil.
 * Direction interpolée en composantes u/v (jamais de moyenne naïve d'angles).
 * @returns {{ directionDeg, speedKt, temperatureC, levelHpa, source, timeISO } | null}
 */
export function sampleWind(profile, altitudeFt, when = new Date()) {
  if (!profile?.hours?.length) return null;
  const alt = parseFloat(altitudeFt);
  if (!Number.isFinite(alt)) return null;

  // Heure la plus proche (les heures Open-Meteo sont en UTC, pas de suffixe Z)
  const target = when instanceof Date && !Number.isNaN(when.getTime()) ? when.getTime() : Date.now();
  let hour = null;
  let bestDelta = Infinity;
  for (const h of profile.hours) {
    const t = Date.parse(`${h.timeISO}Z`);
    if (!Number.isFinite(t)) continue;
    const delta = Math.abs(t - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      hour = h;
    }
  }
  // ⚠️ Borne sur l'écart d'heure : au-delà de 3 h (vol planifié hors de
  // l'horizon de prévision de 48 h), pas de vent « le plus proche » présenté
  // comme valide — null, fail-closed (règle A5).
  const MAX_HOUR_DELTA_MS = 3 * 60 * 60 * 1000;
  if (!hour || hour.levels.length === 0 || bestDelta > MAX_HOUR_DELTA_MS) return null;

  const levels = hour.levels;
  // Hors enveloppe : niveau extrême (pas d'extrapolation fantaisiste)
  let lower = levels[0];
  let upper = levels[levels.length - 1];
  if (alt <= lower.heightFt) upper = lower;
  else if (alt >= upper.heightFt) lower = upper;
  else {
    for (let i = 0; i < levels.length - 1; i++) {
      if (levels[i].heightFt <= alt && levels[i + 1].heightFt >= alt) {
        lower = levels[i];
        upper = levels[i + 1];
        break;
      }
    }
  }

  const span = upper.heightFt - lower.heightFt;
  const f = span > 0 ? (alt - lower.heightFt) / span : 0;

  // Interpolation vectorielle u/v (convention météo : direction D'OÙ vient le vent)
  const toUV = (l) => {
    const rad = (l.directionDeg * Math.PI) / 180;
    return { u: -l.speedKt * Math.sin(rad), v: -l.speedKt * Math.cos(rad) };
  };
  const a = toUV(lower);
  const b = toUV(upper);
  const u = a.u + (b.u - a.u) * f;
  const v = a.v + (b.v - a.v) * f;
  const speedKt = Math.sqrt(u * u + v * v);
  const directionDeg = ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;

  const temperatureC = (Number.isFinite(lower.temperatureC) && Number.isFinite(upper.temperatureC))
    ? lower.temperatureC + (upper.temperatureC - lower.temperatureC) * f
    : null;

  return {
    directionDeg: Math.round(directionDeg),
    speedKt: Math.round(speedKt),
    temperatureC: temperatureC != null ? Math.round(temperatureC * 10) / 10 : null,
    levelHpa: f < 0.5 ? lower.hpa : upper.hpa,
    source: profile.source || 'open-meteo',
    timeISO: hour.timeISO
  };
}

/**
 * 🔧 LOT 6-C — Phénomènes significatifs à une heure donnée (contenu chiffré
 * de la TEMSI) : même sélection d'heure la plus proche et même borne 3 h que
 * sampleWind. null si profil absent, hors horizon, ou heure sans champ wx.
 */
export function sampleWx(profile, when = new Date()) {
  if (!profile?.hours?.length) return null;
  const target = when instanceof Date && !Number.isNaN(when.getTime()) ? when.getTime() : Date.now();
  let hour = null;
  let bestDelta = Infinity;
  for (const h of profile.hours) {
    const t = Date.parse(`${h.timeISO}Z`);
    if (!Number.isFinite(t)) continue;
    const delta = Math.abs(t - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      hour = h;
    }
  }
  const MAX_HOUR_DELTA_MS = 3 * 60 * 60 * 1000;
  if (!hour || !hour.wx || bestDelta > MAX_HOUR_DELTA_MS) return null;
  return { ...hour.wx, source: profile.source || 'open-meteo', timeISO: hour.timeISO };
}
