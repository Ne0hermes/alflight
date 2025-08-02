// src/features/alternates/utils/alternateFilters.js

import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';

/**
 * Filtre les aérodromes candidats selon les critères définis
 */
export const filterAlternates = async (candidates, criteria) => {
  const filtered = [];
  
  for (const airport of candidates) {
    const passesFilters = await checkAllCriteria(airport, criteria);
    if (passesFilters) {
      filtered.push(airport);
    }
  }
  
  return filtered;
};

/**
 * Vérifie tous les critères pour un aérodrome
 */
const checkAllCriteria = async (airport, criteria) => {
  // 1. Vérifier la distance maximale (rayon carburant)
  if (!checkDistanceCriteria(airport, criteria)) {
    return false;
  }
  
  // 2. Vérifier la longueur de piste
  if (!checkRunwayCriteria(airport, criteria)) {
    return false;
  }
  
  // 3. Vérifier la disponibilité VAC si requise
  if (criteria.requireVAC && !checkVACAvailability(airport)) {
    return false;
  }
  
  // 4. Vérifier les services requis
  if (!checkServicesCriteria(airport, criteria)) {
    return false;
  }
  
  // 5. Vérifier la météo
  const weatherOk = await checkWeatherCriteria(airport, criteria);
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
  
  // Calculer la distance depuis le point le plus proche sur la route
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
const checkVACAvailability = (airport) => {
  const { charts } = useVACStore.getState();
  
  // Vérifier si une VAC existe pour cet aérodrome
  return charts[airport.icao] !== undefined;
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
const checkWeatherCriteria = async (airport, criteria) => {
  const { fetchWeather, getWeatherByIcao } = useWeatherStore.getState();
  
  // Essayer de récupérer la météo
  let weather = getWeatherByIcao(airport.icao);
  
  if (!weather) {
    // Tenter de charger la météo
    try {
      await fetchWeather(airport.icao);
      weather = getWeatherByIcao(airport.icao);
    } catch (error) {
      // Si pas de météo disponible, on considère OK par défaut
      return true;
    }
  }
  
  if (!weather?.metar?.decoded) return true;
  
  const metar = weather.metar.decoded;
  const minima = criteria.weatherMinima[criteria.flightRules.toLowerCase()];
  
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
 * Calcule la distance d'un point à une route
 */
const calculateDistanceFromRoute = (point, departure, arrival) => {
  // Calcul simplifié : distance au point le plus proche sur la ligne droite
  // Pour une précision accrue, implémenter la distance point-segment
  
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