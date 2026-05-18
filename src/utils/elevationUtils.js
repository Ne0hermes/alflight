// src/utils/elevationUtils.js
//
// Normalisation des élévations vers une unité unique : PIEDS (ft).
//
// Pourquoi un util partagé :
// L'audit a révélé que VACModule.jsx faisait `unit === 'FT'` (case sensitive,
// strict equality) pour décider de convertir ou non. Si `unit` est `'ft'`,
// `'feet'`, ou undefined sur une donnée déjà en pieds, le code multiplie
// par 3.28 et l'élévation devient × 3.28 trop grande → pression altitude
// fausse → distance de décollage sous-estimée d'environ 30 %.
//
// Cette fonction gère :
//   - Toutes les variantes orthographiques (FT/ft/feet/foot, M/m/meters/...)
//   - Le cas où `unit` est manquant : fallback FT (convention aéronautique
//     française dominante), AVEC sanity check (valeur > 30000 → warn).
//   - Le cas où elevation est un nombre brut (legacy) → assumer FT.
//   - Le cas où elevation est null/undefined → 0 avec warn explicite.

const M_TO_FT = 3.28084;

/** Liste des variantes acceptées pour "pieds". */
const FEET_TOKENS = new Set(['ft', 'feet', 'foot', 'pi', 'pied', 'pieds']);
/** Liste des variantes acceptées pour "mètres". */
const METER_TOKENS = new Set(['m', 'mt', 'metre', 'metres', 'meter', 'meters', 'mètre', 'mètres']);

/**
 * Normalise une élévation vers les pieds.
 *
 * @param {object|number|null|undefined} elevation
 *   - { value: number, unit: string } (format AIXM/SIA standard)
 *   - number brut (legacy : assumé en pieds)
 *   - null/undefined → 0
 * @param {object} [opts]
 * @param {string} [opts.context]  Nom de la donnée pour logging (ex: "LFLY")
 * @returns {number} Élévation en pieds (≥ 0 typique, mais peut être négatif pour aérodromes sous niveau mer)
 */
export function normalizeElevationToFeet(elevation, opts = {}) {
  const { context = 'élévation' } = opts;

  // Cas 1 : null ou undefined
  if (elevation === null || elevation === undefined) {
    console.warn(`[elevationUtils] ${context} manquante — utilisation de 0 ft`);
    return 0;
  }

  // Cas 2 : nombre brut (legacy) → assumer FT
  if (typeof elevation === 'number') {
    if (!Number.isFinite(elevation)) {
      console.warn(`[elevationUtils] ${context} non-finie (${elevation}) — utilisation de 0 ft`);
      return 0;
    }
    // Sanity check : aérodromes > 30000 ft inexistants
    if (Math.abs(elevation) > 30000) {
      console.warn(`[elevationUtils] ${context} = ${elevation} ft suspecte (>30000) — vérifier l'unité source`);
    }
    return elevation;
  }

  // Cas 3 : objet { value, unit, valueFt? }
  if (typeof elevation === 'object') {
    // PRIORITÉ : si l'objet a déjà un valueFt pré-calculé (par le parser),
    // on l'utilise directement (évite double conversion).
    if (typeof elevation.valueFt === 'number' && Number.isFinite(elevation.valueFt)) {
      return finalize(elevation.valueFt, context);
    }

    const rawValue = typeof elevation.value === 'number'
      ? elevation.value
      : parseFloat(elevation.value);

    if (!Number.isFinite(rawValue)) {
      console.warn(`[elevationUtils] ${context} value invalide (${elevation.value}) — utilisation de 0 ft`);
      return 0;
    }

    const unitToken = String(elevation.unit || '').trim().toLowerCase();

    // Détection unité explicite
    if (FEET_TOKENS.has(unitToken)) {
      return finalize(rawValue, context);
    }
    if (METER_TOKENS.has(unitToken)) {
      return finalize(rawValue * M_TO_FT, context);
    }

    // Unité manquante ou non reconnue : fallback FT avec sanity check
    if (unitToken === '') {
      // Heuristique : si valeur > 5000, c'est probablement déjà en pieds
      // (les aérodromes en mètres dépassent rarement 1500 m = ~5000 ft,
      // sauf cas extrêmes). On garde FT par défaut pour la France.
      return finalize(rawValue, context);
    }

    console.warn(`[elevationUtils] ${context}.unit="${elevation.unit}" non reconnue — assumé en pieds`);
    return finalize(rawValue, context);
  }

  // Cas par défaut : type inattendu
  console.warn(`[elevationUtils] ${context} type non géré (${typeof elevation}) — utilisation de 0 ft`);
  return 0;
}

/** Sanity check + retour de la valeur. */
function finalize(valueFt, context) {
  if (Math.abs(valueFt) > 30000) {
    console.warn(`[elevationUtils] ${context} = ${valueFt} ft suspecte (>30000) — vérifier l'unité source`);
  }
  return valueFt;
}
