// src/features/alternates/utils/alternateFilters.js

/**
 * Filtre les aérodromes candidats selon les critères définis
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
  
  // 7. Vérifier le côté (pour système dual)
  if (!checkSideCriteria(airport, criteria)) {
    return false;
  }
  
  return true;
};

/**
 * Vérifie le critère de distance
 */
const checkDistanceCriteria = (airport, criteria) => {
  if (!criteria.maxRadiusNM) return true;
  
  if (airport.distance !== undefined) {
    return airport.distance <= criteria.maxRadiusNM;
  }
  
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
  if (!vacStore) return true;
  
  const charts = vacStore.getState ? vacStore.getState().charts : vacStore.charts;
  return charts && charts[airport.icao] !== undefined;
};

/**
 * Vérifie les services requis
 */
const checkServicesCriteria = (airport, criteria) => {
  if (criteria.requireFuel && !airport.fuel) {
    return false;
  }
  
  if (criteria.requireATC && !hasATCService(airport)) {
    return false;
  }
  
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
  
  const getWeatherByIcao = weatherStore.getState ? 
    weatherStore.getState().getWeatherByIcao : 
    weatherStore.getWeatherByIcao;
  
  let weather = getWeatherByIcao ? getWeatherByIcao(airport.icao) : null;
  
  if (!weather) {
    if (weatherStore.fetchWeather) {
      try {
        await weatherStore.fetchWeather(airport.icao);
        weather = getWeatherByIcao ? getWeatherByIcao(airport.icao) : null;
      } catch (error) {
        return true;
      }
    } else {
      return true;
    }
  }
  
  if (!weather?.metar?.decoded) return true;
  
  const metar = weather.metar.decoded;
  const minima = criteria.weatherMinima[criteria.flightRules.toLowerCase()];
  
  if (!minima) return true;
  
  if (metar.clouds?.length > 0) {
    const lowestCloud = metar.clouds
      .filter(cloud => cloud.cover === 'BKN' || cloud.cover === 'OVC')
      .sort((a, b) => a.altitude - b.altitude)[0];
    
    if (lowestCloud && lowestCloud.altitude < minima.ceiling) {
      return false;
    }
  }
  
  if (metar.visibility && metar.visibility < minima.visibility) {
    return false;
  }
  
  return true;
};

/**
 * Vérifie les heures d'ouverture
 */
const checkOperatingHours = (airport, criteria) => {
  if (!airport.operatingHours) return true;
  
  // TODO: Implémenter la vérification des heures d'ouverture
  // en fonction de l'heure estimée d'arrivée
  
  return true;
};

/**
 * Vérifie le critère de côté (système dual)
 */
const checkSideCriteria = (airport, criteria) => {
  // Si pas de critère de côté, accepter tout
  if (!criteria.requiredSide) return true;
  
  // Vérifier que l'aérodrome a bien un côté défini
  if (!airport.side || !airport.zoneInfo?.side) return false;
  
  // Vérifier que le côté correspond
  const airportSide = airport.side || airport.zoneInfo?.side;
  return airportSide === criteria.requiredSide;
};

/**
 * Détermine si l'aérodrome a un service ATC
 */
const hasATCService = (airport) => {
  if (airport.frequencies) {
    return airport.frequencies.some(freq => 
      freq.type === 'TWR' || 
      freq.type === 'APP' || 
      freq.type === 'AFIS'
    );
  }
  
  return airport.type === 'medium_airport' || 
         airport.type === 'large_airport';
};

/**
 * Détermine si l'aérodrome a un balisage nocturne
 */
const hasNightLighting = (airport) => {
  if (airport.runways) {
    return airport.runways.some(runway => 
      runway.lighting === true || 
      runway.lights === true ||
      runway.hasLighting === true
    );
  }
  
  return airport.type !== 'small_airport' && 
         airport.type !== 'closed';
};

/**
 * Calcule la distance d'un point à une route (version simplifiée)
 */
const calculateDistanceFromRoute = (point, departure, arrival) => {
  const distToDeparture = calculateDistance(point, departure);
  const distToArrival = calculateDistance(point, arrival);
  
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
  checkSideCriteria,
  hasATCService,
  hasNightLighting
};