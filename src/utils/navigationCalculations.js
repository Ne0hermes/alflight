/**
 * Module centralisé pour tous les calculs de navigation
 * Élimine les duplications et optimise les performances avec cache
 */

// Constantes
const EARTH_RADIUS_NM = 3440.065; // Rayon terre en nautiques
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// Cache pour les calculs répétitifs
const distanceCache = new Map();
const CACHE_SIZE = 1000;

/**
 * Conversions degrés <-> radians
 */
export const toRad = (deg) => deg * DEG_TO_RAD;
export const toDeg = (rad) => rad * RAD_TO_DEG;

/**
 * Calcule la distance entre deux points en NM (Haversine)
 * @param {number|Object} lat1 - Latitude du premier point ou objet {lat, lon}
 * @param {number|Object} lon1 - Longitude du premier point ou second point si lat1 est un objet
 * @param {number} lat2 - Latitude du second point (optionnel si objets)
 * @param {number} lon2 - Longitude du second point (optionnel si objets)
 * @returns {number} Distance en nautiques
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Support pour les objets {lat, lon}
  if (typeof lat1 === 'object' && typeof lon1 === 'object') {
    return calculateDistance(lat1.lat, lat1.lon || lat1.lng, lon1.lat, lon1.lon || lon1.lng);
  }
  
  // Vérifier le cache
  const cacheKey = `${lat1},${lon1},${lat2},${lon2}`;
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey);
  }
  
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
            
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = EARTH_RADIUS_NM * c;
  
  // Gérer le cache
  if (distanceCache.size >= CACHE_SIZE) {
    const firstKey = distanceCache.keys().next().value;
    distanceCache.delete(firstKey);
  }
  distanceCache.set(cacheKey, distance);
  
  return distance;
};

/**
 * Calcule le cap (bearing) entre deux points
 * @returns {number} Cap en degrés (0-360)
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  // Support pour les objets
  if (typeof lat1 === 'object' && typeof lon1 === 'object') {
    return calculateBearing(lat1.lat, lat1.lon || lat1.lng, lon1.lat, lon1.lon || lon1.lng);
  }
  
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
            
  const bearing = Math.atan2(y, x) * RAD_TO_DEG;
  return (bearing + 360) % 360;
};

/**
 * Calcule la distance totale le long d'une route
 * @param {Array} waypoints - Tableau de waypoints avec lat/lon
 * @returns {number} Distance totale en NM
 */
export const calculateTotalDistance = (waypoints) => {
  if (!waypoints || waypoints.length < 2) return 0;
  
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += calculateDistance(
      waypoints[i].lat, waypoints[i].lon,
      waypoints[i+1].lat, waypoints[i+1].lon
    );
  }
  return total;
};

/**
 * Calcule le temps de vol basé sur distance et vitesse sol
 * @param {number} distance - Distance en NM
 * @param {number} groundSpeed - Vitesse sol en knots
 * @returns {number} Temps de vol en heures
 */
export const calculateFlightTime = (distance, groundSpeed) => {
  if (!groundSpeed || groundSpeed <= 0) return 0;
  return distance / groundSpeed;
};

/**
 * Calcule le carburant requis
 * @param {number} time - Temps de vol en heures
 * @param {number} consumption - Consommation en unités/heure
 * @returns {number} Carburant requis
 */
export const calculateFuelRequired = (time, consumption) => {
  if (!consumption || consumption <= 0) return 0;
  return time * consumption;
};

/**
 * Calcule un point destination à partir d'origine, distance et cap
 * @param {Object} origin - Point d'origine {lat, lon}
 * @param {number} distanceNM - Distance en NM
 * @param {number} bearingDeg - Cap en degrés
 * @returns {Object} Point destination {lat, lon}
 */
export const calculateDestination = (origin, distanceNM, bearingDeg) => {
  const d = distanceNM / EARTH_RADIUS_NM;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lon1 = toRad(origin.lon || origin.lng);
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return {
    lat: toDeg(lat2),
    lon: toDeg(lon2)
  };
};

/**
 * Calcule le point médian entre deux points
 * @returns {Object} Point médian {lat, lon}
 */
export const calculateMidpoint = (point1, point2) => {
  const lat1 = toRad(point1.lat);
  const lon1 = toRad(point1.lon || point1.lng);
  const lat2 = toRad(point2.lat);
  const lon2 = toRad(point2.lon || point2.lng);
  
  const dLon = lon2 - lon1;
  
  const Bx = Math.cos(lat2) * Math.cos(dLon);
  const By = Math.cos(lat2) * Math.sin(dLon);
  
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By)
  );
  
  const lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);
  
  return {
    lat: toDeg(lat3),
    lon: toDeg(lon3)
  };
};

/**
 * Calcule l'effet du vent
 * @param {number} tas - True airspeed en knots
 * @param {number} heading - Cap en degrés
 * @param {number} windSpeed - Vitesse du vent en knots
 * @param {number} windDirection - Direction du vent en degrés (d'où il vient)
 * @returns {Object} {groundSpeed, windCorrectionAngle, headwind, crosswind}
 */
export const calculateWindEffect = (tas, heading, windSpeed, windDirection) => {
  const headingRad = heading * DEG_TO_RAD;
  const windDirRad = windDirection * DEG_TO_RAD;
  
  // Composantes du vent
  const headwind = windSpeed * Math.cos(windDirRad - headingRad);
  const crosswind = windSpeed * Math.sin(windDirRad - headingRad);
  
  // Angle de correction de dérive
  const windCorrectionAngle = Math.atan2(crosswind, tas) * RAD_TO_DEG;
  
  // Vitesse sol
  const groundSpeed = Math.sqrt(
    Math.pow(tas * Math.cos(windCorrectionAngle * DEG_TO_RAD) - headwind, 2) +
    Math.pow(tas * Math.sin(windCorrectionAngle * DEG_TO_RAD), 2)
  );
  
  return {
    groundSpeed,
    windCorrectionAngle,
    headwind,
    crosswind
  };
};

/**
 * Convertit des coordonnées de différents formats en degrés décimaux
 * @param {string|number} coordinate - Coordonnée en différents formats
 * @param {string} type - 'lat' ou 'lon'
 * @returns {number|null} Degrés décimaux ou null si invalide
 */
export const parseCoordinate = (coordinate, type) => {
  if (typeof coordinate === 'number') return coordinate;
  if (!coordinate || typeof coordinate !== 'string') return null;
  
  // Format degrés décimaux
  const decimal = parseFloat(coordinate);
  if (!isNaN(decimal)) return decimal;
  
  // Format DMS (ex: "48°51'29.9\"N" ou "2°17'40.3\"E")
  const dmsRegex = /(\d+)[°](\d+)['](\d+(?:\.\d+)?)["]([NSEW])/;
  const match = coordinate.match(dmsRegex);
  
  if (match) {
    const degrees = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseFloat(match[3]);
    const direction = match[4];
    
    let dd = degrees + minutes/60 + seconds/3600;
    
    if ((direction === 'S' && type === 'lat') || 
        (direction === 'W' && type === 'lon')) {
      dd = -dd;
    }
    
    return dd;
  }
  
  return null;
};

/**
 * Interpole une position entre deux waypoints
 * @param {Object} wp1 - Premier waypoint {lat, lon}
 * @param {Object} wp2 - Second waypoint {lat, lon}
 * @param {number} fraction - Fraction de distance (0-1)
 * @returns {Object} Position interpolée {lat, lon}
 */
export const interpolatePosition = (wp1, wp2, fraction) => {
  const lat1Rad = wp1.lat * DEG_TO_RAD;
  const lon1Rad = (wp1.lon || wp1.lng) * DEG_TO_RAD;
  const lat2Rad = wp2.lat * DEG_TO_RAD;
  const lon2Rad = (wp2.lon || wp2.lng) * DEG_TO_RAD;
  
  const d = calculateDistance(wp1, wp2) / EARTH_RADIUS_NM;
  const a = Math.sin((1 - fraction) * d) / Math.sin(d);
  const b = Math.sin(fraction * d) / Math.sin(d);
  
  const x = a * Math.cos(lat1Rad) * Math.cos(lon1Rad) + 
            b * Math.cos(lat2Rad) * Math.cos(lon2Rad);
  const y = a * Math.cos(lat1Rad) * Math.sin(lon1Rad) + 
            b * Math.cos(lat2Rad) * Math.sin(lon2Rad);
  const z = a * Math.sin(lat1Rad) + b * Math.sin(lat2Rad);
  
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG;
  const lon = Math.atan2(y, x) * RAD_TO_DEG;
  
  return { lat, lon };
};

/**
 * Calcule la distance d'un point à un segment (orthodromie)
 * @param {Object} point - Point {lat, lon}
 * @param {Object} start - Début du segment {lat, lon}
 * @param {Object} end - Fin du segment {lat, lon}
 * @returns {number} Distance en NM
 */
export const calculateDistanceToSegment = (point, start, end) => {
  if (start.lat === end.lat && (start.lon || start.lng) === (end.lon || end.lng)) {
    return calculateDistance(point, start);
  }
  
  const distanceToStart = calculateDistance(point, start);
  const distanceToEnd = calculateDistance(point, end);
  const segmentDistance = calculateDistance(start, end);
  
  if (segmentDistance < 0.1) {
    return Math.min(distanceToStart, distanceToEnd);
  }
  
  const bearing13 = toRad(calculateBearing(start, end));
  const bearing12 = toRad(calculateBearing(start, point));
  const angularDistance12 = distanceToStart / EARTH_RADIUS_NM;
  
  const crossTrackDistance = Math.asin(Math.sin(angularDistance12) * Math.sin(bearing12 - bearing13)) * EARTH_RADIUS_NM;
  const alongTrackDistance = Math.acos(Math.cos(angularDistance12) / Math.cos(crossTrackDistance / EARTH_RADIUS_NM)) * EARTH_RADIUS_NM;
  
  if (alongTrackDistance < 0) {
    return distanceToStart;
  } else if (alongTrackDistance > segmentDistance) {
    return distanceToEnd;
  }
  
  return Math.abs(crossTrackDistance);
};

/**
 * Calcule la médiatrice d'un segment
 * @param {Object} departure - Point de départ {lat, lon}
 * @param {Object} arrival - Point d'arrivée {lat, lon}
 * @returns {Object} Données de la médiatrice
 */
export const calculatePerpendicular = (departure, arrival) => {
  const midpoint = calculateMidpoint(departure, arrival);
  const routeBearing = calculateBearing(departure, arrival);
  
  // Caps perpendiculaires (90° à droite et à gauche)
  const perpBearing1 = (routeBearing + 90) % 360;
  const perpBearing2 = (routeBearing - 90 + 360) % 360;
  
  // Distance pour créer les points de la médiatrice
  const perpDistance = calculateDistance(departure, arrival) * 2;
  
  // Points définissant la médiatrice
  const perpPoint1 = calculateDestination(midpoint, perpDistance, perpBearing1);
  const perpPoint2 = calculateDestination(midpoint, perpDistance, perpBearing2);
  
  return {
    midpoint,
    point1: perpPoint1,
    point2: perpPoint2,
    bearing: perpBearing1
  };
};

/**
 * Détermine de quel côté de la médiatrice se trouve un point
 * @returns {string} 'departure' ou 'arrival'
 */
export const getSideOfPerpendicular = (point, departure, arrival) => {
  const distToDeparture = calculateDistance(point, departure);
  const distToArrival = calculateDistance(point, arrival);
  
  return distToDeparture < distToArrival ? 'departure' : 'arrival';
};

/**
 * Vérifie si un point est dans un polygone
 * @param {Object} point - Point {lat, lon}
 * @param {Array} vertices - Sommets du polygone
 * @returns {boolean} True si dans le polygone
 */
export const isPointInPolygon = (point, vertices) => {
  let inside = false;
  
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].lon || vertices[i].lng;
    const yi = vertices[i].lat;
    const xj = vertices[j].lon || vertices[j].lng;
    const yj = vertices[j].lat;
    
    const intersect = ((yi > point.lat) !== (yj > point.lat))
        && (point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
};

// Export pour compatibilité avec l'ancien code
export const NavigationCalculations = {
  calculateDistance,
  calculateBearing,
  calculateTotalDistance,
  calculateFlightTime,
  calculateFuelRequired,
  calculateDestination,
  calculateMidpoint,
  calculateWindEffect,
  parseCoordinate,
  interpolatePosition,
  calculateDistanceToSegment,
  calculatePerpendicular,
  getSideOfPerpendicular,
  isPointInPolygon,
  toRad,
  toDeg
};

// Export par défaut
export default NavigationCalculations;