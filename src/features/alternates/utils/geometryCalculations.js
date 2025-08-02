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

// Fonctions utilitaires de base
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

const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;