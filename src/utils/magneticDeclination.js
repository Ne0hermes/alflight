// src/utils/magneticDeclination.js
// Déclinaison magnétique via le World Magnetic Model (WMM) de la NOAA —
// source officielle mondiale, coefficients EMBARQUÉS par le package
// `geomagnetism` (100 % hors-ligne, indispensable pour l'app Capacitor/PWA).
// Convention : déclinaison EST positive (même signe que magneticVariation des
// données SIA du projet). Cap magnétique = cap vrai − déclinaison.
// Fail-closed : null si position invalide ou échec du modèle — jamais de
// déclinaison inventée (règle A5 du projet).
import geomagnetism from 'geomagnetism';

const cache = new Map();
let cachedModel = null;
let cachedModelYear = null;

/**
 * Déclinaison magnétique (° , Est positif) à une position et une date.
 * Mémoïsée à 0,1° de grille (~6 NM) et à l'année — largement suffisant :
 * la déclinaison varie de ~0,1°/an et de quelques dixièmes par degré.
 */
export function getDeclination(lat, lon, date = new Date()) {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;

  const validDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = validDate.getFullYear();
  const key = `${la.toFixed(1)},${lo.toFixed(1)},${year}`;
  if (cache.has(key)) return cache.get(key);

  try {
    if (!cachedModel || cachedModelYear !== year) {
      try {
        cachedModel = geomagnetism.model(new Date(year, 6, 1));
      } catch {
        // Date hors de l'epoch embarquée → modèle par défaut du package
        // (écart < 0,3°/an, acceptable pour l'affichage VFR)
        cachedModel = geomagnetism.model();
      }
      cachedModelYear = year;
    }
    const decl = cachedModel.point([la, lo]).decl;
    if (!Number.isFinite(decl)) return null;
    const rounded = Math.round(decl * 10) / 10;
    cache.set(key, rounded);
    return rounded;
  } catch (e) {
    console.warn('⚠️ [magneticDeclination] Échec WMM:', e?.message);
    return null;
  }
}

/** Cap vrai → cap magnétique (déclinaison Est positive). null si invalide. */
export function trueToMagnetic(trueDeg, declination) {
  const t = parseFloat(trueDeg);
  const d = parseFloat(declination);
  if (!Number.isFinite(t) || !Number.isFinite(d)) return null;
  return (((t - d) % 360) + 360) % 360;
}
