// src/features/alternates/utils/geometryCalculations.js

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
 * Calcule la distance d'un point à un segment de grande cercle (orthodromie)
 * Utilise la méthode cross-track distance pour la navigation aérienne
 */
const calculateDistanceToSegment = (point, start, end) => {
  // Cas spécial : segment de longueur nulle
  if (start.lat === end.lat && start.lon === end.lon) {
    return calculateDistance(point, start);
  }
  
  const R = 3440.065; // Rayon terre en NM
  
  // Distance du point au départ
  const distanceToStart = calculateDistance(point, start);
  
  // Distance du point à l'arrivée
  const distanceToEnd = calculateDistance(point, end);
  
  // Distance entre départ et arrivée
  const segmentDistance = calculateDistance(start, end);
  
  // Si le segment est très court, utiliser la plus petite distance aux extrémités
  if (segmentDistance < 0.1) {
    return Math.min(distanceToStart, distanceToEnd);
  }
  
  // Bearing du départ vers l'arrivée
  const bearing13 = toRad(calculateBearing(start, end));
  
  // Bearing du départ vers le point
  const bearing12 = toRad(calculateBearing(start, point));
  
  // Distance angulaire du départ au point
  const angularDistance12 = distanceToStart / R;
  
  // Calcul de la cross-track distance (distance perpendiculaire à la route)
  const crossTrackDistance = Math.asin(Math.sin(angularDistance12) * Math.sin(bearing12 - bearing13)) * R;
  
  // Distance le long de la route (along-track distance)
  const alongTrackDistance = Math.acos(Math.cos(angularDistance12) / Math.cos(crossTrackDistance / R)) * R;
  
  // Si le point projeté est avant le départ ou après l'arrivée, 
  // utiliser la distance aux extrémités
  if (alongTrackDistance < 0) {
    return distanceToStart;
  } else if (alongTrackDistance > segmentDistance) {
    return distanceToEnd;
  }
  
  // Sinon, retourner la distance perpendiculaire (valeur absolue)
  return Math.abs(crossTrackDistance);
};

/**
 * Calcule la position relative d'un point par rapport à une route
 * Retourne 'left', 'right' ou 'on' la route
 */
const getPointSideOfRoute = (point, start, end) => {
  const d = (point.lon - start.lon) * (end.lat - start.lat) - 
            (point.lat - start.lat) * (end.lon - start.lon);
  
  if (Math.abs(d) < 0.0001) return 'on';
  return d > 0 ? 'left' : 'right';
};

/**
 * Calcule l'intersection de deux lignes (si elle existe)
 */
const calculateLineIntersection = (p1, p2, p3, p4) => {
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
 * Conversions degrés <-> radians
 */
const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;

/**
 * Calcule un triangle équilatéral autour de la route
 */
const calculateEquilateralTriangle = (departure, arrival) => {
  const midpoint = calculateMidpoint(departure, arrival);
  const distance = calculateDistance(departure, arrival);
  const height = (Math.sqrt(3) / 2) * distance;
  
  // Calcul du 3ème point du triangle équilatéral
  // Il est à une distance 'height' du milieu de la base, perpendiculairement
  const bearing = calculateBearing(departure, arrival);
  const perpendicularBearing = (bearing + 90) % 360;
  
  const vertex = calculateDestination(midpoint, height, perpendicularBearing);
  
  return {
    type: 'triangle',
    vertices: [departure, arrival, vertex],
    area: calculateTriangleArea(departure, arrival, vertex),
    center: calculateCentroid([departure, arrival, vertex])
  };
};

/**
 * Calcule une zone pilule (capsule) autour de la route
 * Zone définie comme l'ensemble des points à distance ≤ h du segment [P0, P1]
 * où h = (√3 / 2) * d (hauteur d'un triangle équilatéral de côté d)
 */
const calculatePillZone = (departure, arrival, numPoints = 40) => {
  const distance = calculateDistance(departure, arrival);
  const radius = (Math.sqrt(3) / 2) * distance; // Rayon de la capsule
  
  console.log(`Zone pilule: distance=${distance.toFixed(1)} NM, rayon=${radius.toFixed(1)} NM`);
  
  // Cap de la route (direction de navigation)
  const bearing = calculateBearing(departure, arrival);
  
  // Directions perpendiculaires à la route
  const leftBearing = (bearing + 90) % 360;   // Côté gauche (bâbord)
  const rightBearing = (bearing - 90 + 360) % 360; // Côté droit (tribord)
  
  const vertices = [];
  
  // === CONSTRUCTION DU CONTOUR DE LA PILULE ===
  
  // 1. CÔTÉ GAUCHE : Du départ vers l'arrivée
  // Point de départ côté gauche
  const startLeft = calculateDestination(departure, radius, leftBearing);
  vertices.push(startLeft);
  
  // 2. DEMI-CERCLE À L'ARRIVÉE : Du côté gauche au côté droit
  // Arc de 180° centré sur le point d'arrivée
  const pointsPerHalfCircle = Math.floor(numPoints / 2);
  for (let i = 0; i <= pointsPerHalfCircle; i++) {
    // Angle de leftBearing à rightBearing (180°)
    const t = i / pointsPerHalfCircle; // 0 à 1
    const angle = leftBearing + t * 180;
    const point = calculateDestination(arrival, radius, angle % 360);
    vertices.push(point);
  }
  
  // 3. CÔTÉ DROIT : De l'arrivée vers le départ (implicite)
  // Le dernier point du demi-cercle est déjà le point arrRight
  
  // 4. DEMI-CERCLE AU DÉPART : Du côté droit au côté gauche
  // Arc de 180° centré sur le point de départ
  for (let i = 0; i <= pointsPerHalfCircle; i++) {
    // Angle de rightBearing à leftBearing (180°)
    const t = i / pointsPerHalfCircle; // 0 à 1
    const angle = rightBearing + t * 180;
    const point = calculateDestination(departure, radius, angle % 360);
    vertices.push(point);
  }
  
  // Note: Le dernier point devrait être proche de startLeft, fermant le polygone
  
  // Calculer l'aire : rectangle + cercle complet
  const rectangleArea = distance * (2 * radius);
  const circleArea = Math.PI * radius * radius;
  const totalArea = rectangleArea + circleArea;
  
  console.log(`Zone créée: ${vertices.length} vertices`);
  
  return {
    type: 'pill',
    vertices: vertices,
    area: totalArea,
    center: calculateMidpoint(departure, arrival),
    radius: radius,
    length: distance,
    departure: departure,
    arrival: arrival,
    // Informations supplémentaires pour debug
    bearing: bearing,
    leftBearing: leftBearing,
    rightBearing: rightBearing
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
 * Identifie les points tournants dans une liste de waypoints
 */
const identifyTurnPoints = (waypoints) => {
  const turnPoints = [];
  
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const current = waypoints[i];
    const next = waypoints[i + 1];
    
    if (!prev.lat || !current.lat || !next.lat) continue;
    
    const bearing1 = calculateBearing(
      { lat: prev.lat, lon: prev.lon },
      { lat: current.lat, lon: current.lon }
    );
    const bearing2 = calculateBearing(
      { lat: current.lat, lon: current.lon },
      { lat: next.lat, lon: next.lon }
    );
    
    const turnAngle = Math.abs((bearing2 - bearing1 + 180) % 360 - 180);
    
    if (turnAngle > 30) { // Virage significatif > 30°
      turnPoints.push({
        ...current,
        turnAngle,
        bufferRadius: turnAngle > 60 ? 10 : 5 // 10 NM pour virages > 60°, 5 NM sinon
      });
    }
  }
  
  return turnPoints;
};

// Exporter individuellement les fonctions principales
export { 
  calculateDistance, 
  calculateBearing, 
  calculateDestination, 
  calculateMidpoint,
  calculateDistanceToSegment
};

/**
 * Calcule la zone de recherche pour les alternates
 */
export const calculateSearchZone = (departure, arrival, waypoints = [], fuelData = null) => {
  const distance = calculateDistance(departure, arrival);
  
  console.log(`Calcul zone de recherche - Distance vol: ${distance.toFixed(1)} NM`);
  
  // Utiliser la méthode pilule (capsule) au lieu du triangle équilatéral
  const zone = calculatePillZone(departure, arrival);
  
  console.log(`Zone créée - Type: ${zone.type}, Rayon: ${zone.radius?.toFixed(1)} NM, Aire: ${zone.area?.toFixed(0)} NM²`);
  
  // Ajouter le rayon dynamique basé sur le carburant
  if (fuelData && fuelData.aircraft && fuelData.fuelRemaining) {
    const usableFuel = fuelData.fuelRemaining - (fuelData.reserves?.final || 0) - (fuelData.reserves?.alternate || 0);
    if (usableFuel > 0) {
      const enduranceHours = usableFuel / fuelData.aircraft.fuelConsumption;
      const maxRadius = enduranceHours * fuelData.aircraft.cruiseSpeedKt * 0.8; // 80% de marge
      zone.dynamicRadius = Math.max(15, Math.min(50, maxRadius)); // Entre 15 et 50 NM
    } else {
      zone.dynamicRadius = 25; // Valeur par défaut
    }
  } else {
    zone.dynamicRadius = 25; // Valeur par défaut
  }
  
  // Identifier les points tournants si waypoints fournis
  if (waypoints && waypoints.length > 2) {
    zone.turnPoints = identifyTurnPoints(waypoints);
    console.log(`Points tournants identifiés: ${zone.turnPoints.length}`);
  }
  
  return zone;
};

/**
 * Vérifie si un aéroport est dans la zone de recherche
 */
export const isAirportInSearchZone = (airport, searchZone) => {
  if (!airport || !searchZone) return { isInZone: false, reason: 'Données manquantes' };
  
  const point = airport.coordinates || airport.position || { 
    lat: airport.lat, 
    lon: airport.lon || airport.lng 
  };
  
  if (!point.lat || !point.lon) return { isInZone: false, reason: 'Coordonnées invalides' };
  
  // Pour une zone pilule : vérifier si le point est à distance ≤ radius du segment
  if (searchZone.type === 'pill' && searchZone.radius && searchZone.departure && searchZone.arrival) {
    const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);
    
    if (distanceToRoute <= searchZone.radius) {
      return { isInZone: true, location: 'pill', distanceToRoute };
    }
    
    // Vérifier aussi les tampons des points tournants pour la zone pilule
    if (searchZone.turnPoints) {
      for (const turnPoint of searchZone.turnPoints) {
        const distance = calculateDistance(point, turnPoint);
        if (distance <= turnPoint.bufferRadius) {
          return { isInZone: true, location: 'turnBuffer', turnPoint: turnPoint.name, distanceToRoute };
        }
      }
    }
    
    return { isInZone: false, reason: 'Hors zone pilule', distanceToRoute };
  }
  
  // Ancien code pour compatibilité avec le triangle (si nécessaire)
  if (searchZone.type === 'triangle' && searchZone.vertices) {
    if (isPointInTriangle(point, searchZone.vertices)) {
      return { isInZone: true, location: 'triangle' };
    }
    
    // Vérifier si dans la marge de 5 NM (pour triangle uniquement)
    for (let i = 0; i < searchZone.vertices.length; i++) {
      const start = searchZone.vertices[i];
      const end = searchZone.vertices[(i + 1) % searchZone.vertices.length];
      const distToSegment = calculateDistanceToSegment(point, start, end);
      if (distToSegment <= 5) { // 5 NM de marge
        return { isInZone: true, location: 'margin' };
      }
    }
  }
  
  // Vérifier si dans les tampons des points tournants (pour triangle)
  if (searchZone.turnPoints && searchZone.type === 'triangle') {
    for (const turnPoint of searchZone.turnPoints) {
      const distance = calculateDistance(point, turnPoint);
      if (distance <= turnPoint.bufferRadius) {
        return { isInZone: true, location: 'turnBuffer', turnPoint: turnPoint.name };
      }
    }
  }
  
  return { isInZone: false, reason: 'Hors zone' };
};

/**
 * Calcule la distance d'un point à une route (entre deux points)
 */
export const calculateDistanceFromRoute = (point, departure, arrival) => {
  // Utiliser la fonction existante calculateDistanceToSegment
  return calculateDistanceToSegment(point, departure, arrival);
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