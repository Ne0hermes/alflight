// src/features/alternates/utils/geometryCalculations.js

// Import des fonctions depuis le module centralisé
import {
  calculateDistance,
  calculateBearing,
  calculateDestination,
  calculateMidpoint,
  calculateDistanceToSegment,
  calculatePerpendicular,
  getSideOfPerpendicular,
  isPointInPolygon,
  toRad,
  toDeg
} from '@utils/navigationCalculations';

// Ces fonctions sont maintenant importées du module centralisé

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
 * Calcule une zone pilule (capsule) autour de la route
 */
const calculatePillZone = (departure, arrival, radiusOverride = null) => {
  const distance = calculateDistance(departure, arrival);
  const radius = radiusOverride || (Math.sqrt(3) / 2) * distance;
  
  const bearing = calculateBearing(departure, arrival);
  
  // Calculer les 4 points clés qui définissent les coins de la pilule
  const departureRight = calculateDestination(departure, radius, (bearing - 90 + 360) % 360);
  const departureLeft = calculateDestination(departure, radius, (bearing + 90) % 360);
  const arrivalRight = calculateDestination(arrival, radius, (bearing - 90 + 360) % 360);
  const arrivalLeft = calculateDestination(arrival, radius, (bearing + 90) % 360);
  
  const vertices = [];
  const pointsPerArc = 20;
  
  // SEGMENT 1 : Ligne droite du côté droit (départ vers arrivée)
  vertices.push(departureRight);
  for (let i = 1; i <= 5; i++) {
    const ratio = i / 6;
    vertices.push({
      lat: departureRight.lat + ratio * (arrivalRight.lat - departureRight.lat),
      lon: departureRight.lon + ratio * (arrivalRight.lon - departureRight.lon)
    });
  }
  vertices.push(arrivalRight);
  
  // SEGMENT 2 : Demi-cercle à l'arrivée (droite vers gauche)
  for (let i = 1; i < pointsPerArc; i++) {
    const angle = (bearing - 90) + (i / pointsPerArc) * 180;
    const point = calculateDestination(arrival, radius, angle % 360);
    vertices.push(point);
  }
  vertices.push(arrivalLeft);
  
  // SEGMENT 3 : Ligne droite du côté gauche (arrivée vers départ)
  for (let i = 1; i <= 5; i++) {
    const ratio = i / 6;
    vertices.push({
      lat: arrivalLeft.lat + ratio * (departureLeft.lat - arrivalLeft.lat),
      lon: arrivalLeft.lon + ratio * (departureLeft.lon - arrivalLeft.lon)
    });
  }
  vertices.push(departureLeft);
  
  // SEGMENT 4 : Demi-cercle au départ (gauche vers droite)
  for (let i = 1; i < pointsPerArc; i++) {
    const angle = (bearing + 90) + (i / pointsPerArc) * 180;
    const point = calculateDestination(departure, radius, angle % 360);
    vertices.push(point);
  }
  
  const rectangleArea = distance * (2 * radius);
  const circleArea = Math.PI * radius * radius;
  const totalArea = rectangleArea + circleArea;
  
  // Ajouter les informations de médiatrice
  const perpendicular = calculatePerpendicular(departure, arrival);
  
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
    bearing: bearing,
    perpendicular: perpendicular
  };
};

/**
 * Calcule une zone rectangulaire autour de la route
 */
const calculateRectangleZone = (departure, arrival, radius) => {
  const distance = calculateDistance(departure, arrival);
  
  const routeBearing = calculateBearing(departure, arrival);
  const perpLeft = (routeBearing + 90) % 360;
  const perpRight = (routeBearing - 90 + 360) % 360;
  
  const vertices = [];
  
  vertices.push(calculateDestination(departure, radius, perpRight));
  vertices.push(calculateDestination(departure, radius, perpLeft));
  vertices.push(calculateDestination(arrival, radius, perpLeft));
  vertices.push(calculateDestination(arrival, radius, perpRight));
  
  const area = distance * (2 * radius);
  
  // Ajouter les informations de médiatrice
  const perpendicular = calculatePerpendicular(departure, arrival);
  
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
    bearing: routeBearing,
    perpendicular: perpendicular
  };
};

/**
 * Calcule une zone de déroutement rectangulaire (boîte englobante)
 */
const calculateBoundingBoxZone = (departure, arrival, marginNM) => {
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
  
  // Ajouter les informations de médiatrice
  const perpendicular = calculatePerpendicular(departure, arrival);
  
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
    marginNM,
    perpendicular: perpendicular
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
    const bearing2 = calculateBearing(
      { lat: current.lat, lon: current.lon },
      { lat: next.lat, lon: next.lon }
    
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

/**
 * Calcule la zone de recherche pour les alternates
 */
export const calculateSearchZone = (departure, arrival, waypoints = [], fuelData = null, options = {}) => {
  const distance = calculateDistance(departure, arrival);
  
  const config = {
    method: 'pill',
    ...options
  };
  
  // Calculer le rayon selon la méthode
  let radius;
  
  if (config.method === 'pill') {
    // Pour la zone pilule, utiliser une formule adaptative avec des limites très strictes
    // Objectif : zone de recherche réaliste et pratique pour les déroutements
    
    if (distance <= 30) {
      // Distances très courtes : rayon de 30-35% de la distance
      radius = Math.max(10, distance * 0.35);
    } else if (distance <= 60) {
      // Distances courtes : rayon de 25-30% de la distance  
      radius = 10.5 + (distance - 30) * 0.25;
    } else if (distance <= 120) {
      // Distances moyennes : rayon de 18-22% de la distance
      radius = 18 + (distance - 60) * 0.18;
    } else if (distance <= 250) {
      // Distances longues : rayon de 12-15% de la distance
      radius = 28.8 + (distance - 120) * 0.12;
    } else if (distance <= 500) {
      // Distances très longues : rayon de 8-10% de la distance
      radius = 44.4 + (distance - 250) * 0.08;
    } else {
      // Distances extrêmes : plafond très strict
      // Maximum 80 NM de rayon (au lieu de 120)
      radius = Math.min(80, 64.4 + (distance - 500) * 0.03);
    }
    
    // Ajustement supplémentaire : ne jamais dépasser 20% de la distance totale (au lieu de 30%)
    radius = Math.min(radius, distance * 0.20);
    
    // Minimum absolu pour assurer une zone viable mais raisonnable
    radius = Math.max(8, radius);
  } else {
    // Pour les autres méthodes, calculer le rayon proportionnel à la distance
    if (distance < 20) {
      radius = Math.max(10, distance * 0.8);
    } else if (distance < 50) {
      radius = distance * 0.6;
    } else if (distance < 100) {
      radius = distance * 0.4;
    } else {
      radius = Math.min(50, distance * 0.3);
    }
  }
  
  // Ajustement par carburant si disponible (optionnel)
  if (fuelData && fuelData.aircraft && fuelData.fuelRemaining !== undefined && config.limitByFuel !== false) {
    const finalReserve = fuelData.reserves?.final || 0;
    const alternateReserve = fuelData.reserves?.alternate || 0;
    const usableFuel = fuelData.fuelRemaining - finalReserve - alternateReserve;
    
    if (usableFuel > 0 && fuelData.aircraft.fuelConsumption && fuelData.aircraft.cruiseSpeedKt) {
      const enduranceHours = usableFuel / fuelData.aircraft.fuelConsumption;
      const fuelRadius = enduranceHours * fuelData.aircraft.cruiseSpeedKt * 0.3;
      const oldRadius = radius;
      radius = Math.min(radius, Math.max(10, fuelRadius));
    }
  }
  
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
  
  zone.dynamicRadius = radius;
  
  if (waypoints && waypoints.length > 2) {
    zone.turnPoints = identifyTurnPoints(waypoints);
  }
  
  return zone;
};

/**
 * Vérifie si un aéroport est dans la zone de recherche
 * Retourne maintenant aussi le côté (departure/arrival)
 */
export const isAirportInSearchZone = (airport, searchZone) => {
  if (!airport || !searchZone) return { isInZone: false, reason: 'Données manquantes' };
  
  const point = airport.coordinates || airport.position || { 
    lat: airport.lat, 
    lon: airport.lon || airport.lng 
  };
  
  if (!point.lat || !point.lon) return { isInZone: false, reason: 'Coordonnées invalides' };
  
  // Déterminer le côté par rapport à la médiatrice
  const side = getSideOfPerpendicular(point, searchZone.departure, searchZone.arrival);
  
  // Pour une zone pilule
  if (searchZone.type === 'pill' && searchZone.radius && searchZone.departure && searchZone.arrival) {
    // Calculer les distances importantes
    const distToDeparture = calculateDistance(point, searchZone.departure);
    const distToArrival = calculateDistance(point, searchZone.arrival);
    const routeLength = calculateDistance(searchZone.departure, searchZone.arrival);
    
    // Debug pour LFAF
        // Vérification stricte avec une tolérance réduite
    // Un point est dans la pilule si la somme de ses distances aux extrémités
    // est inférieure à la longueur de la route + 2 * rayon
    // On applique une tolérance de 95% pour être plus strict
    const maxDistanceSum = routeLength + 2 * searchZone.radius * 0.95;
    
    if (distToDeparture + distToArrival > maxDistanceSum) {
      // Le point est définitivement hors de la zone pilule
            return { isInZone: false, reason: 'Hors zone pilule (somme distances)', distToDeparture, distToArrival };
    }
    
    // Calcul plus précis de la position dans la pilule
    const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);
    
    // Vérifier que le point est dans la zone pilule (forme capsule)
    // 1. D'abord vérifier si le point est dans le rectangle central
    // On applique une marge de sécurité de 90% sur le rayon pour être plus strict
    const effectiveRadius = searchZone.radius * 0.9;
    
    if (distanceToRoute <= effectiveRadius) {
      // 2. Calculer la projection du point sur la ligne de route
      const routeVector = {
        x: searchZone.arrival.lon - searchZone.departure.lon,
        y: searchZone.arrival.lat - searchZone.departure.lat
      };
      const pointVector = {
        x: point.lon - searchZone.departure.lon,
        y: point.lat - searchZone.departure.lat
      };
      
      // Produit scalaire pour trouver la position le long de la route (0 = départ, 1 = arrivée)
      const routeLengthSquared = routeVector.x * routeVector.x + routeVector.y * routeVector.y;
      const t = routeLengthSquared > 0 ? 
        (pointVector.x * routeVector.x + pointVector.y * routeVector.y) / routeLengthSquared : 0;
      
      // Si le point est entre départ et arrivée (dans le rectangle)
      if (t >= 0 && t <= 1) {
        return { isInZone: true, location: 'pill', distanceToRoute, side };
      }
      
      // 3. Si le point est avant le départ, vérifier le demi-cercle de départ
      if (t < 0) {
        if (distToDeparture <= effectiveRadius) {
          return { isInZone: true, location: 'pill', distanceToRoute: distToDeparture, side };
        }
      }
      
      // 4. Si le point est après l'arrivée, vérifier le demi-cercle d'arrivée
      if (t > 1) {
        if (distToArrival <= effectiveRadius) {
          return { isInZone: true, location: 'pill', distanceToRoute: distToArrival, side };
        }
      }
    }
    
    // Vérifier aussi les demi-cercles aux extrémités même si distanceToRoute > effectiveRadius
    // (déjà calculé au début) - avec le rayon effectif réduit
    if (distToDeparture <= effectiveRadius) {
      return { isInZone: true, location: 'pill', distanceToRoute: distToDeparture, side };
    }
    
    if (distToArrival <= effectiveRadius) {
      return { isInZone: true, location: 'pill', distanceToRoute: distToArrival, side };
    }
    
    if (searchZone.turnPoints) {
      for (const turnPoint of searchZone.turnPoints) {
        const distance = calculateDistance(point, turnPoint);
        if (distance <= turnPoint.bufferRadius) {
          return { isInZone: true, location: 'turnBuffer', turnPoint: turnPoint.name, distanceToRoute, side };
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
      return { isInZone: true, location: 'boundingBox', distanceToRoute, side };
    }
    
    if (searchZone.turnPoints) {
      for (const turnPoint of searchZone.turnPoints) {
        const distance = calculateDistance(point, turnPoint);
        if (distance <= turnPoint.bufferRadius) {
          const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);
          return { isInZone: true, location: 'turnBuffer', turnPoint: turnPoint.name, distanceToRoute, side };
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
        return { isInZone: true, location: 'rectangle', distanceToRoute, side };
      }
    }
    
    if (searchZone.turnPoints) {
      for (const turnPoint of searchZone.turnPoints) {
        const distance = calculateDistance(point, turnPoint);
        if (distance <= turnPoint.bufferRadius) {
          return { isInZone: true, location: 'turnBuffer', turnPoint: turnPoint.name, distanceToRoute, side };
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
  // Fonctions définies dans ce fichier
  calculateCentroid,
  calculateTriangleArea,
  isPointInTriangle,
  getPointSideOfRoute,
  calculateLineIntersection,
  calculatePillZone,
  calculateRectangleZone,
  calculateBoundingBoxZone,
  identifyTurnPoints
};