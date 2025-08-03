// src/features/alternates/utils/geometryCalculations.js

/**
 * Calcule la zone de recherche pour les alternates
 */
export const calculateSearchZone = (departure, arrival, method = 'triangle', bufferNM = 20) => {
  const distance = calculateDistance(departure, arrival);
  
  if (method === 'triangle') {
    return calculateEquilateralTriangle(departure, arrival);
  } else {
    return calculateBufferZone(departure, arrival, bufferNM);
  }
};

/**
 * Calcule un triangle équilatéral autour de la route
 */
const calculateEquilateralTriangle = (departure, arrival) => {
  const midpoint = calculateMidpoint(departure, arrival);
  const distance = calculateDistance(departure, arrival);
  const height = (Math.sqrt(3) / 2) * distance;
  
  // Calcul du 3ème point du triangle (perpendiculaire à la route)
  const bearing = calculateBearing(departure, arrival);
  const perpendicularBearing = (bearing + 90) % 360;
  
  const vertex = calculateDestination(midpoint, height / 2, perpendicularBearing);
  
  return {
    type: 'triangle',
    vertices: [departure, arrival, vertex],
    area: calculateTriangleArea(departure, arrival, vertex),
    center: calculateCentroid([departure, arrival, vertex])
  };
};

/**
 * Calcule une zone tampon autour de la route
 */
const calculateBufferZone = (departure, arrival, bufferNM) => {
  const bearing = calculateBearing(departure, arrival);
  const distance = calculateDistance(departure, arrival);
  
  // Créer un polygone rectangulaire avec coins arrondis
  const corners = [];
  
  // Coins au départ
  corners.push(calculateDestination(departure, bufferNM, bearing - 90));
  corners.push(calculateDestination(departure, bufferNM, bearing + 90));
  
  // Coins à l'arrivée
  corners.push(calculateDestination(arrival, bufferNM, bearing + 90));
  corners.push(calculateDestination(arrival, bufferNM, bearing - 90));
  
  return {
    type: 'buffer',
    vertices: corners,
    routeDistance: distance,
    bufferWidth: bufferNM * 2,
    center: calculateMidpoint(departure, arrival)
  };
};

/**
 * Vérifie si un point est dans la zone de recherche
 */
export const isPointInSearchZone = (point, zone) => {
  if (zone.type === 'triangle') {
    return isPointInTriangle(point, zone.vertices);
  } else {
    return isPointInPolygon(point, zone.vertices);
  }
};

/**
 * Calcule la distance entre deux points en NM
 */
const calculateDistance = (point1, point2) => {
  const R = 3440.065; // Rayon terre en NM
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lon - point1.lon);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Calcule le cap (bearing) entre deux points
 */
const calculateBearing = (point1, point2) => {
  const dLon = toRad(point2.lon - point1.lon);
  const lat1 = toRad(point1.lat);
  const lat2 = toRad(point2.lat);
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
};

/**
 * Calcule un point destination à partir d'un point d'origine, distance et cap
 */
const calculateDestination = (origin, distanceNM, bearingDeg) => {
  const R = 3440.065; // Rayon terre en NM
  const d = distanceNM / R;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lon1 = toRad(origin.lon);
  
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
 */
const calculateMidpoint = (point1, point2) => {
  const lat1 = toRad(point1.lat);
  const lon1 = toRad(point1.lon);
  const lat2 = toRad(point2.lat);
  const lon2 = toRad(point2.lon);
  
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
 * Calcule le centroïde d'un ensemble de points
 */
const calculateCentroid = (points) => {
  const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
  const sumLon = points.reduce((sum, p) => sum + p.lon, 0);
  return {
    lat: sumLat / points.length,
    lon: sumLon / points.length
  };
};

/**
 * Calcule l'aire d'un triangle en NM²
 */
const calculateTriangleArea = (p1, p2, p3) => {
  // Utiliser la formule de Heron pour calculer l'aire
  const a = calculateDistance(p1, p2);
  const b = calculateDistance(p2, p3);
  const c = calculateDistance(p3, p1);
  
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  
  return area; // en NM²
};

/**
 * Vérifie si un point est dans un triangle
 */
const isPointInTriangle = (point, vertices) => {
  const [v0, v1, v2] = vertices;
  
  // Utiliser les coordonnées barycentriques
  const sign = (p1, p2, p3) => {
    return (p1.lon - p3.lon) * (p2.lat - p3.lat) - (p2.lon - p3.lon) * (p1.lat - p3.lat);
  };
  
  const d1 = sign(point, v0, v1);
  const d2 = sign(point, v1, v2);
  const d3 = sign(point, v2, v0);
  
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  
  return !(hasNeg && hasPos);
};

/**
 * Vérifie si un point est dans un polygone
 */
const isPointInPolygon = (point, vertices) => {
  let inside = false;
  
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].lon, yi = vertices[i].lat;
    const xj = vertices[j].lon, yj = vertices[j].lat;
    
    const intersect = ((yi > point.lat) !== (yj > point.lat))
        && (point.lon < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
};

/**
 * Conversions degrés <-> radians
 */
const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;

/**
 * Calcule la distance d'un point à un segment de droite
 * Utile pour calculer la distance d'un aérodrome à la route
 */
export const calculateDistanceToSegment = (point, start, end) => {
  const A = point.lat - start.lat;
  const B = point.lon - start.lon;
  const C = end.lat - start.lat;
  const D = end.lon - start.lon;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = start.lat;
    yy = start.lon;
  } else if (param > 1) {
    xx = end.lat;
    yy = end.lon;
  } else {
    xx = start.lat + param * C;
    yy = start.lon + param * D;
  }
  
  return calculateDistance(point, { lat: xx, lon: yy });
};

/**
 * Calcule la position relative d'un point par rapport à une route
 * Retourne 'left', 'right' ou 'on' la route
 */
export const getPointSideOfRoute = (point, start, end) => {
  const d = (point.lon - start.lon) * (end.lat - start.lat) - 
            (point.lat - start.lat) * (end.lon - start.lon);
  
  if (Math.abs(d) < 0.0001) return 'on';
  return d > 0 ? 'left' : 'right';
};

/**
 * Calcule l'intersection de deux lignes (si elle existe)
 */
export const calculateLineIntersection = (p1, p2, p3, p4) => {
  const x1 = p1.lon, y1 = p1.lat;
  const x2 = p2.lon, y2 = p2.lat;
  const x3 = p3.lon, y3 = p3.lat;
  const x4 = p4.lon, y4 = p4.lat;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  if (Math.abs(denom) < 0.0001) {
    return null; // Lignes parallèles
  }
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      lat: y1 + t * (y2 - y1),
      lon: x1 + t * (x2 - x1)
    };
  }
  
  return null; // Pas d'intersection dans les segments
};

/**
 * Export de toutes les fonctions utilitaires pour tests
 */
export const geometryUtils = {
  calculateDistance,
  calculateBearing,
  calculateDestination,
  calculateMidpoint,
  calculateCentroid,
  calculateTriangleArea,
  isPointInTriangle,
  isPointInPolygon,
  calculateDistanceToSegment,
  getPointSideOfRoute,
  calculateLineIntersection
};