// src/shared/utils/getWaypointIcao.js
//
// Source UNIQUE d'extraction du code ICAO d'un waypoint/aérodrome.
//
// Pourquoi un util partagé :
// Avant ce module, 5+ implémentations parallèles existaient
// (PerformanceModule.getIcaoCode, AdvancedPerformanceCalculator.getDepartureIcao,
// NavigationModule, Step7Summary, WindAnalysis) avec des règles de fallback
// différentes (`icao || name`, `icao || code || name || id`, `name` seul…).
// Conséquence : un waypoint custom avec `code:"LFST"` sans `name` ni `icao`
// était vu par certains modules et ignoré par d'autres → météo manquante
// dans un module et présente dans l'autre.
//
// Convention de retour : code ICAO 4 lettres MAJUSCULES (ex: 'LFPG') ou null.

/**
 * Extrait le code ICAO d'un objet waypoint/aérodrome.
 *
 * Ordre de priorité des champs consultés :
 *   1. waypoint.icao
 *   2. waypoint.code
 *   3. waypoint.name (si format ICAO valide)
 *   4. waypoint.id  (si format ICAO valide)
 *   5. waypoint.value (si l'objet est wrappé)
 *
 * Validation : 4 lettres alphanumériques majuscules.
 * Si la valeur trouvée fait > 4 caractères mais commence par 2 lettres,
 * on prend les 4 premières (cas "LFPG-Charles de Gaulle" parfois rencontré).
 *
 * @param {object|null|undefined} waypoint
 * @returns {string|null} Code ICAO 4 lettres majuscules ou null
 */
export function getWaypointIcao(waypoint) {
  if (!waypoint || typeof waypoint !== 'object') return null;

  const candidates = [
    waypoint.icao,
    waypoint.code,
    waypoint.name,
    waypoint.id,
    waypoint.value // pour les objets wrappés { value: 'LFPG' }
  ];

  for (const raw of candidates) {
    const normalized = normalizeIcao(raw);
    if (normalized) return normalized;
  }

  return null;
}

/** Normalise une valeur quelconque en code ICAO ou null. */
function normalizeIcao(value) {
  if (value === null || value === undefined) return null;

  // Si c'est un objet { value: '...' } ou similaire, déréférencer
  if (typeof value === 'object') {
    if (typeof value.value === 'string') return normalizeIcao(value.value);
    return null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  // Format ICAO strict : 4 lettres alphanum
  if (/^[A-Z0-9]{4}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Format élargi : commence par 4 lettres alphanum + séparateur (ex: "LFPG - Paris CDG")
  const match = trimmed.match(/^([A-Z0-9]{4})(?:[\s\-_]|$)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return null;
}

/**
 * Helpers de commodité : extraire départ et arrivée d'une route (waypoints[]).
 * @param {Array} waypoints
 * @returns {{ departureIcao: string|null, arrivalIcao: string|null }}
 */
export function getRouteEndpointIcaos(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length === 0) {
    return { departureIcao: null, arrivalIcao: null };
  }
  return {
    departureIcao: getWaypointIcao(waypoints[0]),
    arrivalIcao: getWaypointIcao(waypoints[waypoints.length - 1])
  };
}
