// src/utils/runwayWindUtils.js
//
// Utilitaires PURS pour calculer les composantes vent piste et sélectionner
// la meilleure piste face au vent.
//
// Convention :
//   - headwind > 0 → vent de face (favorable décollage/atterrissage)
//   - headwind < 0 → vent arrière (défavorable)
//   - crosswind toujours ≥ 0 (magnitude)

/** Différence d'angle entre deux directions (0 à 180°). */
export function calculateAngleDifference(heading1, heading2) {
  let diff = Math.abs(heading1 - heading2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/** Composante de vent de face SIGNÉE (positif = headwind, négatif = tailwind). */
export function calculateHeadwindComponent(windDirection, windSpeed, runwayHeading) {
  if (typeof windDirection !== 'number' || typeof windSpeed !== 'number' || typeof runwayHeading !== 'number') return 0;
  const angleDiff = calculateAngleDifference(windDirection, runwayHeading);
  const angleRad = (angleDiff * Math.PI) / 180;
  return windSpeed * Math.cos(angleRad);
}

/** Composante de vent traversier (magnitude, toujours ≥ 0). */
export function calculateCrosswindComponent(windDirection, windSpeed, runwayHeading) {
  if (typeof windDirection !== 'number' || typeof windSpeed !== 'number' || typeof runwayHeading !== 'number') return 0;
  const angleDiff = calculateAngleDifference(windDirection, runwayHeading);
  const angleRad = (angleDiff * Math.PI) / 180;
  return Math.abs(windSpeed * Math.sin(angleRad));
}

/**
 * Normalise un tableau de pistes en seuils individuels.
 * Accepte 2 formats :
 *   - VAC : { identifier: "05/23", qfu: 50, length, ... }
 *   - GeoJSON : { le_ident: "05", le_heading: 50, he_ident: "23", he_heading: 230 }
 *
 * @returns Array<{ ident, heading, runway }>
 */
export function expandRunwayThresholds(runways) {
  if (!Array.isArray(runways)) return [];
  const out = [];
  for (const rwy of runways) {
    // Format GeoJSON avec le_/he_
    if (rwy.le_ident && typeof rwy.le_heading === 'number') {
      out.push({ ident: rwy.le_ident, heading: rwy.le_heading, runway: rwy });
    }
    if (rwy.he_ident && typeof rwy.he_heading === 'number') {
      out.push({ ident: rwy.he_ident, heading: rwy.he_heading, runway: rwy });
    }
    // Format VAC avec identifier "05/23" + qfu
    else if (rwy.identifier && typeof rwy.qfu === 'number') {
      const parts = String(rwy.identifier).split('/');
      const baseQfu = rwy.qfu;
      const oppositeQfu = (baseQfu + 180) % 360;
      if (parts[0]) out.push({ ident: parts[0], heading: baseQfu, runway: rwy });
      if (parts[1]) out.push({ ident: parts[1], heading: oppositeQfu, runway: rwy });
    }
  }
  return out;
}

/**
 * Sélectionne la meilleure piste face au vent.
 *
 * Critère : score = headwind*2 − crosswind (maximiser headwind, pénaliser
 * traversier). Si aucune piste n'est exploitable, retourne null.
 *
 * @param {Array} runways  Pistes brutes (VAC ou GeoJSON)
 * @param {object} wind    { direction, speed } — direction en degrés magnétiques, speed en kt
 * @returns { ident, heading, headwind, crosswind, isTailwind, runway } | null
 */
export function selectBestRunwayForWind(runways, wind) {
  if (!wind || typeof wind.direction !== 'number' || typeof wind.speed !== 'number') return null;
  const thresholds = expandRunwayThresholds(runways);
  if (thresholds.length === 0) return null;

  const analyzed = thresholds.map(({ ident, heading, runway }) => {
    const headwind = calculateHeadwindComponent(wind.direction, wind.speed, heading);
    const crosswind = calculateCrosswindComponent(wind.direction, wind.speed, heading);
    const angleDiff = calculateAngleDifference(wind.direction, heading);
    return {
      ident,
      heading,
      headwind,
      crosswind,
      angleDiff,
      isTailwind: headwind < 0,
      score: headwind * 2 - crosswind,
      runway
    };
  });

  // Tri par score décroissant
  analyzed.sort((a, b) => b.score - a.score);
  return analyzed[0];
}
