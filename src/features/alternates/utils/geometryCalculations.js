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
 * Calcule une zone en forme de cône autour de la route
 * Le cône est plus large au départ (radiusAtDep) et plus étroit à l'arrivée (radiusAtArr)
 * Basé sur le carburant restant théorique à chaque point de la route
 *
 * @param {Object} departure - Point de départ {lat, lon}
 * @param {Object} arrival - Point d'arrivée {lat, lon}
 * @param {number} radiusAtDep - Rayon au départ (NM) - basé sur endurance FOB
 * @param {number} radiusAtArr - Rayon à l'arrivée (NM) - basé sur endurance restante
 * @returns {Object} Zone cône avec vertices, aire, etc.
 */
const calculateConeZone = (departure, arrival, radiusAtDep, radiusAtArr) => {
  const distance = calculateDistance(departure, arrival);
  const bearing = calculateBearing(departure, arrival);

  // Protection contre les rayons invalides
  const R1 = Math.max(5, radiusAtDep || 30); // Minimum 5 NM au départ
  const R2 = Math.max(3, radiusAtArr || 10); // Minimum 3 NM à l'arrivée

  console.log('🔺 CONE ZONE CALCULATION:', {
    departure: `${departure.lat.toFixed(4)}, ${departure.lon.toFixed(4)}`,
    arrival: `${arrival.lat.toFixed(4)}, ${arrival.lon.toFixed(4)}`,
    distance: distance.toFixed(1) + ' NM',
    radiusAtDep: R1.toFixed(1) + ' NM',
    radiusAtArr: R2.toFixed(1) + ' NM',
    bearing: bearing.toFixed(1) + '°'
  });

  // Calculer les 4 points clés qui définissent les coins du cône
  // Au départ : rayon R1 (plus large)
  const departureRight = calculateDestination(departure, R1, (bearing - 90 + 360) % 360);
  const departureLeft = calculateDestination(departure, R1, (bearing + 90) % 360);
  // À l'arrivée : rayon R2 (plus étroit)
  const arrivalRight = calculateDestination(arrival, R2, (bearing - 90 + 360) % 360);
  const arrivalLeft = calculateDestination(arrival, R2, (bearing + 90) % 360);

  const vertices = [];
  const pointsPerArc = 20;

  // SEGMENT 1 : Ligne oblique du côté droit (départ vers arrivée, rétrécissant)
  vertices.push(departureRight);
  for (let i = 1; i <= 5; i++) {
    const ratio = i / 6;
    vertices.push({
      lat: departureRight.lat + ratio * (arrivalRight.lat - departureRight.lat),
      lon: departureRight.lon + ratio * (arrivalRight.lon - departureRight.lon)
    });
  }
  vertices.push(arrivalRight);

  // SEGMENT 2 : Demi-cercle à l'arrivée (plus petit, rayon R2)
  for (let i = 1; i < pointsPerArc; i++) {
    const angle = (bearing - 90) + (i / pointsPerArc) * 180;
    const point = calculateDestination(arrival, R2, angle % 360);
    vertices.push(point);
  }
  vertices.push(arrivalLeft);

  // SEGMENT 3 : Ligne oblique du côté gauche (arrivée vers départ, s'élargissant)
  for (let i = 1; i <= 5; i++) {
    const ratio = i / 6;
    vertices.push({
      lat: arrivalLeft.lat + ratio * (departureLeft.lat - arrivalLeft.lat),
      lon: arrivalLeft.lon + ratio * (departureLeft.lon - arrivalLeft.lon)
    });
  }
  vertices.push(departureLeft);

  // SEGMENT 4 : Demi-cercle au départ (plus grand, rayon R1)
  for (let i = 1; i < pointsPerArc; i++) {
    const angle = (bearing + 90) + (i / pointsPerArc) * 180;
    const point = calculateDestination(departure, R1, angle % 360);
    vertices.push(point);
  }

  // Calcul de l'aire approximative (trapèze + 2 demi-cercles)
  const trapezoidArea = distance * (R1 + R2); // Aire du trapèze
  const departureSemiCircle = Math.PI * R1 * R1 / 2; // Demi-cercle au départ
  const arrivalSemiCircle = Math.PI * R2 * R2 / 2; // Demi-cercle à l'arrivée
  const totalArea = trapezoidArea + departureSemiCircle + arrivalSemiCircle;

  // Informations de médiatrice
  const perpendicular = calculatePerpendicular(departure, arrival);

  return {
    type: 'cone',
    vertices: vertices,
    area: totalArea,
    center: calculateMidpoint(departure, arrival),
    radiusAtDep: R1,
    radiusAtArr: R2,
    length: distance,
    widthAtDep: R1 * 2,
    widthAtArr: R2 * 2,
    departure: departure,
    arrival: arrival,
    bearing: bearing,
    perpendicular: perpendicular
  };
};

/**
 * Vérifie si un aéroport est dans une zone cône
 * Le rayon varie linéairement le long de la route (R1 au départ → R2 à l'arrivée)
 *
 * @param {Object} airport - Aéroport avec coordonnées
 * @param {Object} coneZone - Zone cône calculée
 * @returns {Object} {isInZone, location, distanceToRoute, side, radiusAtPoint}
 */
export const isAirportInConeZone = (airport, coneZone) => {
  if (!airport || !coneZone) return { isInZone: false, reason: 'Données manquantes' };

  const point = airport.coordinates || airport.position || {
    lat: airport.lat,
    lon: airport.lon || airport.lng
  };

  if (!point.lat || !point.lon) return { isInZone: false, reason: 'Coordonnées invalides' };

  const { departure, arrival, radiusAtDep, radiusAtArr, length: routeLength } = coneZone;

  // Déterminer le côté par rapport à la médiatrice
  const side = getSideOfPerpendicular(point, departure, arrival);

  // Calculer la position du point le long de la route (t: 0 = départ, 1 = arrivée)
  const routeVector = {
    x: arrival.lon - departure.lon,
    y: arrival.lat - departure.lat
  };
  const pointVector = {
    x: point.lon - departure.lon,
    y: point.lat - departure.lat
  };

  const routeLengthSquared = routeVector.x * routeVector.x + routeVector.y * routeVector.y;
  const t = routeLengthSquared > 0 ?
    (pointVector.x * routeVector.x + pointVector.y * routeVector.y) / routeLengthSquared : 0;

  // Calculer le rayon interpolé à la position t le long de la route
  // R(t) = R1 + t × (R2 - R1) = R1 × (1-t) + R2 × t
  const radiusAtPoint = radiusAtDep * (1 - Math.max(0, Math.min(1, t))) + radiusAtArr * Math.max(0, Math.min(1, t));

  // Distances aux extrémités et à la route
  const distToDeparture = calculateDistance(point, departure);
  const distToArrival = calculateDistance(point, arrival);
  const distanceToRoute = calculateDistanceToSegment(point, departure, arrival);

  // Vérification dans les demi-cercles aux extrémités
  // Demi-cercle au départ (rayon R1)
  if (t < 0 && distToDeparture <= radiusAtDep) {
    return {
      isInZone: true,
      location: 'cone_departure',
      distanceToRoute: distToDeparture,
      side,
      radiusAtPoint: radiusAtDep,
      t: 0
    };
  }

  // Demi-cercle à l'arrivée (rayon R2)
  if (t > 1 && distToArrival <= radiusAtArr) {
    return {
      isInZone: true,
      location: 'cone_arrival',
      distanceToRoute: distToArrival,
      side,
      radiusAtPoint: radiusAtArr,
      t: 1
    };
  }

  // Vérification dans le corps du cône (entre départ et arrivée)
  if (t >= 0 && t <= 1) {
    // Le point doit être à une distance <= rayon interpolé
    if (distanceToRoute <= radiusAtPoint) {
      return {
        isInZone: true,
        location: 'cone_body',
        distanceToRoute,
        side,
        radiusAtPoint,
        t
      };
    }
  }

  return {
    isInZone: false,
    reason: 'Hors zone cône',
    distanceToRoute,
    radiusAtPoint,
    t
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

/**
 * Calcule la zone de recherche pour les alternates
 */
export const calculateSearchZone = (departure, arrival, waypoints = [], fuelData = null, options = {}) => {

  console.log('🎯 CALCUL SEARCH ZONE - PARAMÈTRES REÇUS:', {
    departure: departure,
    arrival: arrival,
    hasDeparture: !!departure,
    hasArrival: !!arrival,
    departureLat: departure?.lat,
    departureLon: departure?.lon,
    arrivalLat: arrival?.lat,
    arrivalLon: arrival?.lon,
    options: options
  });

  // Utiliser totalDistance si fourni (cas d'un circuit fermé)
  // Sinon calculer la distance directe départ→arrivée
  let distance;
  if (options.totalDistance !== undefined && options.totalDistance > 0) {
    distance = options.totalDistance;
    console.log('🔄 CIRCUIT FERMÉ DÉTECTÉ - Utilisation distance totale:', {
      distanceTotale: distance.toFixed(1) + ' NM',
      distanceDirecte: calculateDistance(departure, arrival).toFixed(1) + ' NM'
    });
  } else {
    distance = calculateDistance(departure, arrival);
    console.log('📏 DISTANCE DIRECTE CALCULÉE:', {
      distance: distance.toFixed(1) + ' NM',
      isZero: distance === 0,
      departure: `${departure?.lat?.toFixed(4)}, ${departure?.lon?.toFixed(4)}`,
      arrival: `${arrival?.lat?.toFixed(4)}, ${arrival?.lon?.toFixed(4)}`
    });
  }

  const config = {
    method: 'pill',
    ...options
  };

  // NOUVELLE LOGIQUE : Rayon basé sur un temps de déroutement acceptable
  // Pour un VFR, un déroutement de 20-30 minutes max est raisonnable
  // Rayon = vitesse croisière × temps de déroutement (en heures)
  //
  // On utilise aussi l'autonomie pour adapter :
  // - Si autonomie > 3h : rayon = 30 min de vol (généreux)
  // - Si autonomie 2-3h : rayon = 25 min de vol
  // - Si autonomie < 2h : rayon = 20 min de vol (conservateur)

  let radius;
  let radiusMethod = 'distance'; // Pour le log

  // Essayer de calculer avec les données avion
  if (fuelData?.aircraft?.fuelCapacity && fuelData?.aircraft?.fuelConsumption && fuelData?.aircraft?.cruiseSpeedKt) {
    const aircraft = fuelData.aircraft;
    const maxEnduranceHours = aircraft.fuelCapacity / aircraft.fuelConsumption;
    const cruiseSpeed = aircraft.cruiseSpeedKt;

    // Temps de déroutement en fonction de l'autonomie
    let diversionTimeMinutes;
    if (maxEnduranceHours >= 3) {
      diversionTimeMinutes = 30; // 30 min pour avions avec bonne autonomie
    } else if (maxEnduranceHours >= 2) {
      diversionTimeMinutes = 25; // 25 min pour autonomie moyenne
    } else {
      diversionTimeMinutes = 20; // 20 min pour faible autonomie
    }

    // Rayon = vitesse × temps (convertir minutes en heures)
    const fuelBasedRadius = cruiseSpeed * (diversionTimeMinutes / 60);

    radius = Math.max(10, fuelBasedRadius); // Minimum 10 NM
    radiusMethod = 'temps_deroutement';

    console.log('🛩️ CALCUL RAYON PAR TEMPS DE DÉROUTEMENT:', {
      fuelCapacity: aircraft.fuelCapacity.toFixed(1) + ' L',
      fuelConsumption: aircraft.fuelConsumption.toFixed(1) + ' L/h',
      cruiseSpeed: cruiseSpeed + ' kt',
      maxEndurance: maxEnduranceHours.toFixed(2) + ' h',
      tempsDetourement: diversionTimeMinutes + ' min',
      radiusFinal: radius.toFixed(1) + ' NM'
    });
  } else {
    // Fallback : 25 NM par défaut (raisonnable pour VFR)
    radius = Math.max(10, Math.min(25, distance / 4));
    radiusMethod = 'distance_fallback';

    console.log('⚠️ CALCUL RAYON FALLBACK (pas de données avion):', {
      distance: distance.toFixed(1) + ' NM',
      radiusFinal: radius.toFixed(1) + ' NM',
      formule: 'min(25 NM, distance / 4)'
    });
  }

  // CONTRAINTE 1: Le rayon ne peut pas dépasser la distance totale du vol
  // Pour un vol court, on réduit proportionnellement
  if (radius > distance) {
    console.log('⚠️ RAYON LIMITÉ À LA DISTANCE DU VOL:', {
      radiusCalcule: radius.toFixed(1) + ' NM',
      distanceVol: distance.toFixed(1) + ' NM'
    });
    radius = distance;
  }

  // CONTRAINTE 2: Maximum absolu pour éviter des zones trop grandes (80 NM max)
  // 80 NM = environ 40 min de vol à 120 kt, ce qui est déjà beaucoup pour un déroutement
  const maxRadius = 80;
  if (radius > maxRadius) {
    console.log('⚠️ RAYON LIMITÉ AU MAXIMUM ABSOLU:', {
      radiusCalcule: radius.toFixed(1) + ' NM',
      maximum: maxRadius + ' NM'
    });
    radius = maxRadius;
  }

  console.log('🔍 RAYON FINAL DÉROUTEMENT:', {
    methode: radiusMethod,
    rayon: radius.toFixed(1) + ' NM',
    distanceVol: distance.toFixed(1) + ' NM'
  });
  
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
        // Vérification avec une tolérance élargie
    // Un point est dans la pilule si la somme de ses distances aux extrémités
    // est inférieure à la longueur de la route + 2 * rayon
    // Tolérance de 100% pour inclure tous les aérodromes dans la zone
    const maxDistanceSum = routeLength + 2 * searchZone.radius * 1.0;
    
    if (distToDeparture + distToArrival > maxDistanceSum) {
      // Le point est définitivement hors de la zone pilule
            return { isInZone: false, reason: 'Hors zone pilule (somme distances)', distToDeparture, distToArrival };
    }
    
    // Calcul plus précis de la position dans la pilule
    const distanceToRoute = calculateDistanceToSegment(point, searchZone.departure, searchZone.arrival);

    // Vérifier que le point est dans la zone pilule (forme capsule)
    // 1. D'abord vérifier si le point est dans le rectangle central
    // Utiliser 100% du rayon pour inclure plus d'aérodromes
    const effectiveRadius = searchZone.radius * 1.0;
    
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
  calculateConeZone,
  calculateRectangleZone,
  calculateBoundingBoxZone,
  identifyTurnPoints
};

// Export nommé de calculateConeZone pour utilisation directe
export { calculateConeZone };