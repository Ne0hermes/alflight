// src/features/alternates/hooks/useAlternateScoring.js

/**
 * Calcule un score pour chaque aérodrome candidat
 */
export const scoreAlternates = async (candidates, context) => {
  const scored = await Promise.all(
    candidates.map(async (airport) => {
      let score = 0;
      const factors = {};
      
      // 1. Distance (30% du score)
      const distanceScore = calculateDistanceScore(airport, context);
      score += distanceScore * 0.3;
      factors.distance = distanceScore;
      
      // 2. Infrastructure (25% du score)
      const infrastructureScore = calculateInfrastructureScore(airport);
      score += infrastructureScore * 0.25;
      factors.infrastructure = infrastructureScore;
      
      // 3. Météo (20% du score)
      const weatherScore = await calculateWeatherScore(airport, context);
      score += weatherScore * 0.2;
      factors.weather = weatherScore;
      
      // 4. Services (15% du score)
      const servicesScore = calculateServicesScore(airport, context);
      score += servicesScore * 0.15;
      factors.services = servicesScore;
      
      // 5. Position stratégique (10% du score)
      const positionScore = calculateStrategicPosition(airport, context);
      score += positionScore * 0.1;
      factors.position = positionScore;
      
      return {
        ...airport,
        score: Math.round(score * 100) / 100,
        scoreFactors: factors
      };
    })
  );
  
  // Trier par score décroissant
  return scored.sort((a, b) => b.score - a.score);
};

/**
 * Score basé sur la distance
 */
const calculateDistanceScore = (airport, context) => {
  const routeDistance = calculateDistanceFromRoute(
    airport.coordinates,
    context.departure,
    context.arrival
  );
  
  // Plus c'est proche de la route, meilleur est le score
  if (routeDistance < 10) return 1.0;
  if (routeDistance < 20) return 0.9;
  if (routeDistance < 30) return 0.7;
  if (routeDistance < 40) return 0.5;
  return 0.3;
};

/**
 * Score basé sur l'infrastructure
 */
const calculateInfrastructureScore = (airport) => {
  let score = 0.5; // Score de base
  
  // Type d'aérodrome
  if (airport.type === 'large_airport') score += 0.3;
  else if (airport.type === 'medium_airport') score += 0.2;
  
  // Longueur de la plus grande piste
  const maxRunwayLength = Math.max(
    ...airport.runways.map(r => r.length || 0)
  );
  
  if (maxRunwayLength > 2000) score += 0.2;
  else if (maxRunwayLength > 1500) score += 0.1;
  
  return Math.min(score, 1.0);
};

/**
 * Score basé sur la météo
 */
const calculateWeatherScore = async (airport, context) => {
  // Récupérer la météo si disponible
  const { getWeatherByIcao } = await import('@core/stores/weatherStore');
  const weather = getWeatherByIcao(airport.icao);
  
  if (!weather?.metar?.decoded) return 0.7; // Score neutre si pas de météo
  
  const metar = weather.metar.decoded;
  let score = 1.0;
  
  // Pénaliser les mauvaises conditions
  if (metar.visibility < 5000) score -= 0.3;
  if (metar.clouds?.some(c => c.altitude < 1000)) score -= 0.2;
  if (metar.wind?.speed > 20) score -= 0.2;
  if (metar.wind?.gust > 30) score -= 0.3;
  
  return Math.max(score, 0);
};

/**
 * Score basé sur les services
 */
const calculateServicesScore = (airport, context) => {
  let score = 0.5;
  
  // Carburant
  if (airport.fuel) score += 0.2;
  
  // ATC/AFIS
  if (airport.frequencies?.some(f => f.type === 'TWR' || f.type === 'AFIS')) {
    score += 0.2;
  }
  
  // Approche aux instruments
  if (airport.procedures?.approaches?.length > 0) score += 0.1;
  
  return Math.min(score, 1.0);
};

/**
 * Score basé sur la position stratégique
 */
const calculateStrategicPosition = (airport, context) => {
  // Position par rapport à la route
  const totalRouteDistance = calculateDistance(context.departure, context.arrival);
  const distFromDeparture = calculateDistance(context.departure, airport.coordinates);
  const distFromArrival = calculateDistance(context.arrival, airport.coordinates);
  
  // Privilégier les alternates au milieu de la route
  const midPoint = totalRouteDistance / 2;
  const deviation = Math.abs(distFromDeparture - midPoint);
  
  if (deviation < totalRouteDistance * 0.1) return 1.0;
  if (deviation < totalRouteDistance * 0.2) return 0.8;
  if (deviation < totalRouteDistance * 0.3) return 0.6;
  return 0.4;
};

// Utilitaires
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

const calculateDistanceFromRoute = (point, departure, arrival) => {
  // Simplification : distance minimale aux extrémités
  const distToDeparture = calculateDistance(point, departure);
  const distToArrival = calculateDistance(point, arrival);
  
  return Math.min(distToDeparture, distToArrival);
};