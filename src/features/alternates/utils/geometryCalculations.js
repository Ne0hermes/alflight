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
  const a = calculateDistance(p1, p2);
  const b = calculateDistance(p2, p3);
  const c = calculateDistance(p3, p1);
  
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  
  return area;
};

/**
 * Vérifie si un point est dans un triangle
 */
const isPointInTriangle = (point, vertices) => {
  const [v0, v1, v2] = vertices;
  
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
 */
const calculateDistanceToSegment = (point, start, end) => {
  if (start.lat === end.lat && start.lon === end.lon) {
    return calculateDistance(point, start);
  }
  
  const R = 3440.065;
  const distanceToStart = calculateDistance(point, start);
  const distanceToEnd = calculateDistance(point, end);
  const segmentDistance = calculateDistance(start, end);
  
  if (segmentDistance < 0.1) {
    return Math.min(distanceToStart, distanceToEnd);
  }
  
  const bearing13 = toRad(calculateBearing(start, end));
  const bearing12 = toRad(calculateBearing(start, point));
  const angularDistance12 = distanceToStart / R;
  
  const crossTrackDistance = Math.asin(Math.sin(angularDistance12) * Math.sin(bearing12 - bearing13)) * R;
  const alongTrackDistance = Math.acos(Math.cos(angularDistance12) / Math.cos(crossTrackDistance / R)) * R;
  
  if (alongTrackDistance < 0) {
    return distanceToStart;
  } else if (alongTrackDistance > segmentDistance) {
    return distanceToEnd;
  }
  
  return Math.abs(crossTrackDistance);
};

/**
 * Calcule la position relative d'un point par rapport à une route
 */
const getPointSideOfRoute = (point, start, end) => {
  const d = (point.lon - start.lon) * (end.lat - start.lat) - 
            (point.lat - start.lat) * (end.lon - start.lon);
  
  if (Math.abs(d) < 0.0001) return 'on';
  return d > 0 ? 'left' : 'right';
};

/**
 * Calcule l'intersection de deux lignes
 */
const calculateLineIntersection = (p1, p2, p3, p4) => {
  const x1 = p1.lon, y1 = p1.lat;
  const x2 = p2.lon, y2 = p2.lat;
  const x3 = p3.lon, y3 = p3.lat;
  const x4 = p4.lon, y4 = p4.lat;
  
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  if (Math.abs(denom) < 0.0001) {
    return null;
  }
  
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      lat: y1 + t * (y2 - y1),
      lon: x1 + t * (x2 - x1)
    };
  }
  
  return null;
};

/**
 * Conversions degrés <-> radians
 */
const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;

/**
 * Calcule une zone pilule (capsule) autour de la route
 */
const calculatePillZone = (departure, arrival, radiusOverride = null) => {
  const distance = calculateDistance(departure, arrival);
  const radius = radiusOverride || (Math.sqrt(3) / 2) * distance;
  
  console.log(`Zone pilule: distance=${distance.toFixed(1)} NM, rayon=${radius.toFixed(1)} NM`);
  
  const bearing = calculateBearing(departure, arrival);
  const leftBearing = (bearing + 90) % 360;
  const rightBearing = (bearing - 90 + 360) % 360;
  
  const vertices = [];
  const pointsPerArc = 15;
  
  // 1. DEMI-CERCLE AU DÉPART (de droite vers gauche, 180°)
  for (let i = 0; i <= pointsPerArc; i++) {
    const angle = rightBearing + (i / pointsPerArc) * 180;
    const point = calculateDestination(departure, radius, angle % 360);
    vertices.push(point);
  }
  
  // 2. LIGNE DROITE CÔTÉ GAUCHE
  const arrivalLeft = calculateDestination(arrival, radius, leftBearing);
  vertices.push(arrivalLeft);
  
  // 3. DEMI-CERCLE À L'ARRIVÉE
  for (let i = 1; i <= pointsPerArc; i++) {
    const angle = leftBearing + (i / pointsPerArc) * 180;
    const point = calculateDestination(arrival, radius, angle % 360);
    vertices.push(point);
  }
  
  // 4. LIGNE DROITE CÔTÉ DROIT (retour au départ)
  const departRight = calculateDestination(departure, radius, rightBearing);
  vertices.push(departRight);
  
  const rectangleArea = distance * (2 * radius);
  const circleArea = Math.PI * radius * radius;
  const totalArea = rectangleArea + circleArea;
  
  console.log(`Zone pilule créée: ${vertices.length} vertices, forme de capsule`);
  
  return {
    type: 'pill',
    vertices: vertices,
    area: totalArea,
    center: calculateMidpoint(departure, arrival),
    radius: radius,
    length: distance,
    width: radius * 2,
    departure: departure,
    arrival: arrival,
    bearing: bearing
  };
};

/**
 * Calcule une zone rectangulaire autour de la route
 */
const calculateRectangleZone = (departure, arrival, radius) => {
  const distance = calculateDistance(departure, arrival);
  
  console.log(`Zone rectangle: distance=${distance.toFixed(1)} NM, largeur=${(radius * 2).toFixed(1)} NM`);
  
  const routeBearing = calculateBearing(departure, arrival);
  const perpLeft = (routeBearing + 90) % 360;
  const perpRight = (routeBearing - 90 + 360) % 360;
  
  const vertices = [];
  
  vertices.push(calculateDestination(departure, radius, perpRight));
  vertices.push(calculateDestination(departure, radius, perpLeft));
  vertices.push(calculateDestination(arrival, radius, perpLeft));
  vertices.push(calculateDestination(arrival, radius, perpRight));
  
  const area = distance * (2 * radius);
  
  console.log(`Rectangle créé avec 4 vertices, aire=${area.toFixed(0)} NM²`);
  
  return {
    type: 'rectangle',
    vertices: vertices,
    area: area,
    center: calculateMidpoint(departure, arrival),
    radius: radius,
    width: radius * 2,
    length: distance,
    departure: departure,
    arrival: arrival,
    bearing: routeBearing
  };
};

/**
 * Calcule une zone de déroutement rectangulaire (boîte englobante)
 */
const calculateBoundingBoxZone = (departure, arrival, marginNM) => {
  console.log(`Calcul zone boîte englobante: marge=${marginNM} NM`);
  
  const marginLatDeg = marginNM / 60.0;
  
  const latMinRoute = Math.min(departure.lat, arrival.lat);
  const latMaxRoute = Math.max(departure.lat, arrival.lat);
  
  const latMin = latMinRoute - marginLatDeg;
  const latMax = latMaxRoute + marginLatDeg;
  
  const latMoyenne = (departure.lat + arrival.lat) / 2.0;
  let cosLatMoyenne = Math.cos(toRad(latMoyenne));
  
  if (Math.abs(cosLatMoyenne) < 0.001) {
    cosLatMoyenne = 0.001;
  }
  
  const marginLonDeg = marginNM / (60.0 * cosLatMoyenne);
  
  let lonMinRoute = Math.min(departure.lon, arrival.lon);
  let lonMaxRoute = Math.max(departure.lon, arrival.lon);
  
  let lonMin = lonMinRoute - marginLonDeg;
  let lonMax = lonMaxRoute + marginLonDeg;
  
  if (Math.abs(departure.lon - arrival.lon) > 180) {
    if (departure.lon > 0 && arrival.lon < 0) {
      lonMin = arrival.lon - marginLonDeg;
      lonMax = departure.lon + marginLonDeg;
    } else {
      lonMin = departure.lon - marginLonDeg;
      lonMax = arrival.lon + marginLonDeg;
    }
  }
  
  const center = {
    lat: (latMin + latMax) / 2,
    lon: (lonMin + lonMax) / 2
  };
  
  const width = (lonMax - lonMin) * 60 * cosLatMoyenne;
  const height = (latMax - latMin) * 60;
  const area = width * height;
  
  console.log(`Zone créée: ${latMin.toFixed(4)}°-${latMax.toFixed(4)}°N, ${lonMin.toFixed(4)}°-${lonMax.toFixed(4)}°E`);
  console.log(`Dimensions: ${width.toFixed(1)}×${height.toFixed(1)} NM, Aire: ${area.toFixed(0)} NM²`);
  
  return {
    type: 'boundingBox',
    latMin,
    latMax,
    lonMin,
    lonMax,
    center,
    width,
    height,
    area,
    marginNM
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
    
    if (turnAngle > 30) {
      turnPoints.push({
        ...current,
        turnAngle,
        bufferRadius: turnAngle > 60 ? 10 : 5
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
export const calculateSearchZone = (departure, arrival, waypoints = [], fuelData = null, options = {}) => {
  const distance = calculateDistance(departure, arrival);
  
  console.log(`Calcul zone de recherche - Distance vol: ${distance.toFixed(1)} NM`);
  
  const config = {
    method: 'pill',
    ...options
  };
  
  // Calculer le rayon proportionnel à la distance
  let radius;
  
  if (distance < 20) {
    radius = Math.max(10, distance * 0.8); // 80% de la distance, min 10 NM
  } else if (distance < 50) {
    radius = distance * 0.6; // 60% de la distance  
  } else if (distance < 100) {
    radius = distance * 0.4; // 40% de la distance
  } else {
    radius = Math.min(50, distance * 0.3); // 30% de la distance, max 50 NM
  }
  
  console.log(`Distance vol: ${distance.toFixed(1)} NM → Rayon calculé: ${radius.toFixed(1)} NM`);
  
  // Ajustement par carburant si disponible
  if (fuelData && fuelData.aircraft && fuelData.fuelRemaining) {
    const usableFuel = fuelData.fuelRemaining - (fuelData.reserves?.final || 0) - (fuelData.reserves?.alternate || 0);
    if (usableFuel > 0) {
      const enduranceHours = usableFuel / fuelData.aircraft.fuelConsumption;
      const fuelRadius = enduranceHours * fuelData.aircraft.cruiseSpeedKt * 0.3;
      const oldRadius = radius;
      radius = Math.min(radius, Math.max(10, fuelRadius));
      if (radius !== oldRadius) {
        console.log(`Rayon limité par carburant: ${oldRadius.toFixed(1)} → ${radius.toFixed(1)} NM`);
      }
    }
  }
  
  console.log(`Méthode utilisée: ${config.method}`);
  
  let zone;
  
  if (config.method === 'pill' || config.method === undefined) {
    zone = calculatePillZone(departure, arrival, radius);
  } else if (config.method === 'boundingBox') {
    const bbox = calculateBoundingBoxZone(departure, arrival, radius);
    zone = {
      ...bbox,
      vertices: [
        { lat: bbox.latMin, lon: bbox.lonMin },
        { lat: bbox.latMin, lon: bbox.lonMax },
        { lat: bbox.latMax, lon: bbox.lonMax },
        { lat: bbox.latMax, lon: bbox.lonMin }
      ],
      departure: departure,
      arrival: arrival,
      radius: radius
    };
  } else {
    zone = calculateRectangleZone(departure, arrival, radius);
  }
  
  console.log(`Zone créée - Type: ${zone.type}, Rayon: ${zone.radius?.toFixed(1)} NM, Aire: ${zone.area?.toFixed(0)} NM²`);
  
  zone.dynamicRadius = radius;
  
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
  
  // Pour une zone pilule
  if (searchZone.type === 'pill' && searchZone.radius && searchZone.departure && searchZone.arrival) {
    const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);
    
    if (distanceToRoute <= searchZone.radius) {
      return { isInZone: true, location: 'pill', distanceToRoute };
    }
    
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
  
  // Pour une zone boîte englobante
  if (searchZone.type === 'boundingBox') {
    const inLatRange = point.lat >= searchZone.latMin && point.lat <= searchZone.latMax;
    const inLonRange = point.lon >= searchZone.lonMin && point.lon <= searchZone.lonMax;
    
    if (inLatRange && inLonRange) {
      const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);
      return { isInZone: true, location: 'boundingBox', distanceToRoute };
    }
    
    if (searchZone.turnPoints) {
      for (const turnPoint of searchZone.turnPoints) {
        const distance = calculateDistance(point, turnPoint);
        if (distance <= turnPoint.bufferRadius) {
          const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);
          return { isInZone: true, location: 'turnBuffer', turnPoint: turnPoint.name, distanceToRoute };
        }
      }
    }
    
    return { isInZone: false, reason: 'Hors boîte englobante' };
  }
  
  // Pour une zone rectangle
  if (searchZone.type === 'rectangle' && searchZone.vertices) {
    const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);
    
    if (distanceToRoute <= searchZone.radius) {
      const distToDeparture = calculateDistance(point, searchZone.departure);
      const distToArrival = calculateDistance(point, searchZone.arrival);
      const routeLength = searchZone.length;
      
      if (distToDeparture + distToArrival <= routeLength + 2 * searchZone.radius + routeLength * 0.2) {
        return { isInZone: true, location: 'rectangle', distanceToRoute };
      }
    }
    
    if (searchZone.turnPoints) {
      for (const turnPoint of searchZone.turnPoints) {
        const distance = calculateDistance(point, turnPoint);
        if (distance <= turnPoint.bufferRadius) {
          return { isInZone: true, location: 'turnBuffer', turnPoint: turnPoint.name, distanceToRoute };
        }
      }
    }
    
    return { isInZone: false, reason: 'Hors zone rectangle', distanceToRoute };
  }
  
  return { isInZone: false, reason: 'Hors zone' };
};

/**
 * Calcule la distance d'un point à une route
 */
export const calculateDistanceFromRoute = (point, departure, arrival) => {
  return calculateDistanceToSegment(point, departure, arrival);
};

/**
 * Export de toutes les fonctions utilitaires
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