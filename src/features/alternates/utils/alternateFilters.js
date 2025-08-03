// src/features/alternates/utils/alternateFilters.js

/**
 * Filtre les aérodromes candidats selon les critères définis
 * Version corrigée sans dépendances directes aux stores
 */
export const filterAlternates = async (candidates, criteria, stores = {}) => {
  const filtered = [];
  
  for (const airport of candidates) {
    const passesFilters = await checkAllCriteria(airport, criteria, stores);
    if (passesFilters) {
      filtered.push(airport);
    }
  }
  
  return filtered;
};

/**
 * Vérifie tous les critères pour un aérodrome
 */
const checkAllCriteria = async (airport, criteria, stores) => {
  // 1. Vérifier la distance maximale (rayon carburant)
  if (!checkDistanceCriteria(airport, criteria)) {
    return false;
  }
  
  // 2. Vérifier la longueur de piste
  if (!checkRunwayCriteria(airport, criteria)) {
    return false;
  }
  
  // 3. Vérifier la disponibilité VAC si requise
  if (criteria.requireVAC && !checkVACAvailability(airport, stores.vacStore)) {
    return false;
  }
  
  // 4. Vérifier les services requis
  if (!checkServicesCriteria(airport, criteria)) {
    return false;
  }
  
  // 5. Vérifier la météo
  const weatherOk = await checkWeatherCriteria(airport, criteria, stores.weatherStore);
  if (!weatherOk) {
    return false;
  }
  
  // 6. Vérifier les heures d'ouverture
  if (!checkOperatingHours(airport, criteria)) {
    return false;
  }
  
  return true;
};

/**
 * Vérifie le critère de distance
 */
const checkDistanceCriteria = (airport, criteria) => {
  if (!criteria.maxRadiusNM) return true;
  
  // La distance est déjà calculée dans le hook principal
  if (airport.distance !== undefined) {
    return airport.distance <= criteria.maxRadiusNM;
  }
  
  // Fallback : calculer la distance
  const distanceFromRoute = calculateDistanceFromRoute(
    airport.coordinates,
    criteria.departure,
    criteria.arrival
  );
  
  return distanceFromRoute <= criteria.maxRadiusNM;
};

/**
 * Vérifie les critères de piste
 */
const checkRunwayCriteria = (airport, criteria) => {
  if (!criteria.requiredRunwayLength) return true;
  
  // L'aérodrome doit avoir au moins une piste suffisamment longue
  const hasAdequateRunway = airport.runways?.some(runway => {
    const length = runway.length || runway.dimensions?.length || 0;
    return length >= criteria.requiredRunwayLength;
  });
  
  return hasAdequateRunway || false;
};

/**
 * Vérifie la disponibilité de la carte VAC
 */
const checkVACAvailability = (airport, vacStore) => {
  if (!vacStore) return true; // Si pas de store, on ne peut pas vérifier
  
  const charts = vacStore.getState ? vacStore.getState().charts : vacStore.charts;
  return charts && charts[airport.icao] !== undefined;
};

/**
 * Vérifie les services requis
 */
const checkServicesCriteria = (airport, criteria) => {
  // Vérifier le carburant si requis
  if (criteria.requireFuel && !airport.fuel) {
    return false;
  }
  
  // Vérifier l'ATC si requis
  if (criteria.requireATC && !hasATCService(airport)) {
    return false;
  }
  
  // Pour un vol de nuit, vérifier le balisage
  if (!criteria.isDayFlight && !hasNightLighting(airport)) {
    return false;
  }
  
  return true;
};

/**
 * Vérifie les critères météo
 */
const checkWeatherCriteria = async (airport, criteria, weatherStore) => {
  if (!weatherStore || !criteria.weatherMinima) return true;
  
  // Récupérer la météo depuis le store
  const getWeatherByIcao = weatherStore.getState ? 
    weatherStore.getState().getWeatherByIcao : 
    weatherStore.getWeatherByIcao;
  
  let weather = getWeatherByIcao ? getWeatherByIcao(airport.icao) : null;
  
  if (!weather) {
    // Si pas de météo et qu'on peut la charger
    if (weatherStore.fetchWeather) {
      try {
        await weatherStore.fetchWeather(airport.icao);
        weather = getWeatherByIcao ? getWeatherByIcao(airport.icao) : null;
      } catch (error) {
        // Si pas de météo disponible, on considère OK par défaut
        return true;
      }
    } else {
      return true; // Pas de météo disponible
    }
  }
  
  if (!weather?.metar?.decoded) return true;
  
  const metar = weather.metar.decoded;
  const minima = criteria.weatherMinima[criteria.flightRules.toLowerCase()];
  
  if (!minima) return true;
  
  // Vérifier le plafond
  if (metar.clouds?.length > 0) {
    const lowestCloud = metar.clouds
      .filter(cloud => cloud.cover === 'BKN' || cloud.cover === 'OVC')
      .sort((a, b) => a.altitude - b.altitude)[0];
    
    if (lowestCloud && lowestCloud.altitude < minima.ceiling) {
      return false;
    }
  }
  
  // Vérifier la visibilité
  if (metar.visibility && metar.visibility < minima.visibility) {
    return false;
  }
  
  return true;
};

/**
 * Vérifie les heures d'ouverture
 */
const checkOperatingHours = (airport, criteria) => {
  // Si pas d'info sur les heures, on considère ouvert
  if (!airport.operatingHours) return true;
  
  // TODO: Implémenter la vérification des heures d'ouverture
  // en fonction de l'heure estimée d'arrivée
  
  return true;
};

/**
 * Détermine si l'aérodrome a un service ATC
 */
const hasATCService = (airport) => {
  // Vérifier les fréquences TWR ou APP
  if (airport.frequencies) {
    return airport.frequencies.some(freq => 
      freq.type === 'TWR' || 
      freq.type === 'APP' || 
      freq.type === 'AFIS'
    );
  }
  
  // Ou vérifier le type d'aérodrome
  return airport.type === 'medium_airport' || 
         airport.type === 'large_airport';
};

/**
 * Détermine si l'aérodrome a un balisage nocturne
 */
const hasNightLighting = (airport) => {
  // Vérifier si des pistes ont un balisage
  if (airport.runways) {
    return airport.runways.some(runway => 
      runway.lighting === true || 
      runway.lights === true ||
      runway.hasLighting === true
    );
  }
  
  // Par défaut, les aérodromes moyens et grands ont un balisage
  return airport.type !== 'small_airport' && 
         airport.type !== 'closed';
};

/**
 * Calcule la distance d'un point à une route (version simplifiée)
 */
const calculateDistanceFromRoute = (point, departure, arrival) => {
  const distToDeparture = calculateDistance(point, departure);
  const distToArrival = calculateDistance(point, arrival);
  
  // Approximation : prendre la plus petite distance
  return Math.min(distToDeparture, distToArrival);
};

/**
 * Calcule la distance entre deux points
 */
const calculateDistance = (point1, point2) => {
  const R = 3440.065; // Rayon terre en NM
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lon - point1.lon) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Export des fonctions utilitaires pour tests
 */
export const filterUtils = {
  checkDistanceCriteria,
  checkRunwayCriteria,
  checkVACAvailability,
  checkServicesCriteria,
  checkWeatherCriteria,
  checkOperatingHours,
  hasATCService,
  hasNightLighting
};