// src/features/alternates/hooks/useAlternateScoring.js

/**
 * Module complet de scoring multi-critères pour les aérodromes de déroutement
 * Évalue chaque candidat selon 5 critères pondérés pour un score total sur 100
 *
 * 🔧 R1-R5 (AUDIT_SCORE_DEROUTEMENTS.md, 2026-08-13) — corrections du plafond
 * structurel ~66 % :
 *  R1 surfaces SIA (ASPH/CONC…) reconnues via normalizeSurface (familles) ;
 *  R2 services réels branchés (sidecar SIA via context.servicesByIcao) ;
 *  R3 besoin de piste = distance d'atterrissage POH réelle de l'avion (m) ;
 *  R4 sans METAR : 0,5 « non vérifié » (l'inconnu n'est plus avantageux) ;
 *  R5 départ/arrivée : position stratégique neutre-bonne (0,6) au lieu de 0 ;
 *  + critère « type d'aérodrome » (concept OurAirports jamais présent en SIA)
 *    remplacé par la CLASSE DE TAILLE déduite de la plus longue piste.
 */

import { normalizeSurface } from '@utils/runwaySurface';
import { getLandingDistanceM } from '@utils/aircraftPerf';

// ===== FONCTION PRINCIPALE DE SCORING =====

/**
 * Calcule un score détaillé pour chaque aérodrome candidat
 * @param {Array} candidates - Liste des aérodromes candidats
 * @param {Object} context - Contexte du vol (route, avion, météo, etc.)
 * @returns {Array} Liste des aérodromes avec scores, triée par pertinence
 */
export const scoreAlternates = async (candidates, context) => {
  const scored = await Promise.all(
    candidates.map(async (airport) => {
      // Calcul du score pour chaque critère
      const scores = {
        distance: calculateDistanceScore(airport, context),
        infrastructure: calculateInfrastructureScore(airport, context),
        services: calculateServicesScore(airport, context),
        weather: await calculateWeatherScore(airport, context),
        strategic: calculateStrategicPosition(airport, context)
      };

      // Calcul du score total pondéré
      const totalScore = calculateTotalScore(scores);

      // Détermination du rang
      const rank = determineRank(totalScore);

      return {
        ...airport,
        score: totalScore,
        scoreFactors: scores,
        scoreBreakdown: scores, // Alias pour compatibilité
        // 🔧 R4 : signale à l'UI que le critère météo repose sur une absence
        // de METAR (badge « météo non vérifiée »), pas sur une observation.
        weatherUnverified: !context.weather?.[airport.icao]?.metar?.decoded,
        rank,
        recommendation: generateRecommendation(airport, scores, rank)
      };
    })
  );

  // Trier par score décroissant
  return scored.sort((a, b) => b.score - a.score);
};

// ===== CRITÈRE 1 : DISTANCE (30%) =====

/**
 * Évalue la proximité de l'aérodrome par rapport à la route
 * Plus proche = meilleur score
 */
const calculateDistanceScore = (airport, context) => {
  const distanceToRoute = calculateDistanceFromRoute(
    airport.coordinates || airport.position,
    context.departure,
    context.arrival
  );

  // Scoring par paliers
  if (distanceToRoute <= 5) return 1.0;      // Excellent (≤ 5 NM)
  if (distanceToRoute <= 10) return 0.9;     // Très bon (5-10 NM)
  if (distanceToRoute <= 15) return 0.8;     // Bon (10-15 NM)
  if (distanceToRoute <= 20) return 0.7;     // Acceptable (15-20 NM)
  if (distanceToRoute <= 30) return 0.5;     // Moyen (20-30 NM)
  if (distanceToRoute <= 40) return 0.3;     // Limite (30-40 NM)
  return 0.1;                                 // Éloigné (> 40 NM)
};

// ===== CRITÈRE 2 : INFRASTRUCTURE (25%) =====

/**
 * Évalue l'adéquation des infrastructures avec les besoins de l'avion
 */
const calculateInfrastructureScore = (airport, context) => {
  let score = 0;
  const aircraft = context.aircraft;

  if (!aircraft || !airport.runways || airport.runways.length === 0) {
    return 0;
  }

  // 1. Longueur de piste (50% du score infrastructure)
  // 🔧 R3 : distance d'atterrissage POH réelle (m) × 1,43 (marge réglementaire).
  // L'ancien chemin aircraft.performances?.landingDistance n'existait dans aucun
  // avion → tout le monde était évalué contre le défaut. Repli 800 m SIGNALÉ.
  const ldgM = getLandingDistanceM(aircraft);
  if (ldgM == null) {
    console.warn('[AlternateScoring] Distance d\'atterrissage POH absente pour',
      aircraft.registration || '?', '— repli générique 800 m');
  }
  const requiredLength = ldgM != null ? ldgM * 1.43 : 800;

  // 🔧 FIX: Utiliser TORA si length = 0 (comme dans AlternateSelectorUnified)
  const longestRunway = Math.max(...airport.runways.map(r => {
    // Essayer runway.length d'abord
    if (r.length && r.length > 0) {
      return r.length;
    }

    // Si length = 0, chercher dans TORA (distances déclarées)
    if (r.tora && r.tora > 0) {
      return r.tora;
    }

    // Chercher aussi dans distancesByDirection
    if (r.distancesByDirection) {
      const maxTora = Math.max(
        ...Object.values(r.distancesByDirection)
          .map(dir => dir.tora || 0)
      );
      if (maxTora > 0) return maxTora;
    }

    return 0;
  }));

  const runwayRatio = longestRunway / requiredLength;
  let runwayScore = 0;
  
  if (runwayRatio >= 2.0) runwayScore = 1.0;      // Excellent (2x la distance requise)
  else if (runwayRatio >= 1.5) runwayScore = 0.8; // Très bon
  else if (runwayRatio >= 1.2) runwayScore = 0.6; // Bon
  else if (runwayRatio >= 1.0) runwayScore = 0.4; // Limite
  else runwayScore = 0;                           // Insuffisant
  
  score += runwayScore * 0.5;
  
  // 2. Classe de taille (20% du score)
  // 🔧 Le « type » small/medium/large_airport est un concept OurAirports jamais
  // renseigné par l'ETL SIA (type='AD' partout) → tout le monde recevait le
  // défaut 0,3. On déduit la classe de la PLUS LONGUE PISTE (donnée réelle) ;
  // les types fermé/héliport/hydrobase restent éliminatoires s'ils existent.
  if (['closed', 'heliport', 'seaplane_base'].includes(airport.type)) {
    return 0;
  }
  let sizeScore;
  if (longestRunway >= 2400) sizeScore = 1.0;      // classe internationale
  else if (longestRunway >= 1500) sizeScore = 0.8; // régional
  else if (longestRunway >= 1000) sizeScore = 0.6; // AG confortable
  else if (longestRunway >= 600) sizeScore = 0.4;  // AG court
  else sizeScore = 0.2;                            // altisurface/bande
  score += sizeScore * 0.2;

  // 3. Largeur de piste (15% du score)
  const widestRunway = Math.max(...airport.runways.map(r => r.width || 0));
  if (widestRunway >= 45) score += 0.15;      // Large (≥ 45m)
  else if (widestRunway >= 30) score += 0.10; // Standard (30-45m)
  else if (widestRunway >= 23) score += 0.05; // Étroite (23-30m)

  // 4. Surface de piste (15% du score)
  // 🔧 R1 : les codes SIA (ASPH, CONC, MACADAM, "CONC+ASPH"…) ne matchaient
  // JAMAIS l'ancienne liste ['asphalt','concrete','paved','revêtue'] → aucune
  // piste n'était « revêtue ». Normalisation par familles canoniques.
  const hasPavedRunway = airport.runways.some((r) => {
    const fam = normalizeSurface(typeof r.surface === 'string' ? r.surface : r.surface?.type);
    return fam === 'PAVED';
  });
  score += hasPavedRunway ? 0.15 : 0.05;

  return Math.min(score, 1.0);
};

// ===== CRITÈRE 3 : SERVICES (20%) =====

/**
 * Évalue les services disponibles sur l'aérodrome
 */
const calculateServicesScore = (airport, context) => {
  let score = 0;

  // 🔧 R2 : services réels SIA (sidecar aerodrome_services.json) transmis via
  // context.servicesByIcao = { ICAO: Set('FUEL','CUST','REPAIR','HAND',…) }.
  // Avant : airport.fuel n'était jamais alimenté → Services ≈ 0 pour tous.
  const sia = context.servicesByIcao?.[airport.icao];

  // 1. Carburant (40% du score services)
  if (airport.fuel || airport.services?.fuel || sia?.has('FUEL')) {
    score += 0.4;
  }

  // 2. ATC/AFIS (30% du score)
  if (hasATCService(airport)) {
    score += 0.3;
  }

  // 3. Balisage nocturne (20% du score)
  if (hasNightLighting(airport)) {
    score += 0.2;
  } else if (context.flightType?.period === 'nuit') {
    // Pénalité si vol de nuit sans balisage
    score -= 0.2;
  }

  // 4. Services additionnels (10% du score)
  let additionalServices = 0;

  // Maintenance
  if (airport.maintenance || airport.services?.maintenance || sia?.has('REPAIR')) {
    additionalServices += 0.05;
  }

  // Douane (pour vols internationaux)
  if (airport.customs || airport.services?.customs || sia?.has('CUST')) {
    additionalServices += 0.03;
  }

  // Handling
  if (airport.handling || airport.services?.handling || sia?.has('HAND')) {
    additionalServices += 0.02;
  }

  score += additionalServices;

  return Math.max(0, Math.min(score, 1.0));
};

// ===== CRITÈRE 4 : MÉTÉO (15%) =====

/**
 * Évalue les conditions météorologiques actuelles
 */
const calculateWeatherScore = async (airport, context) => {
  // Récupérer la météo depuis le contexte
  const weather = context.weather?.[airport.icao];
  
  if (!weather?.metar?.decoded) {
    // 🔧 R4 : météo inconnue = 0,5 « non vérifié » (était 0,7). Un terrain sans
    // METAR était mieux noté qu'un terrain au METAR moyen — l'inconnu ne doit
    // jamais être un avantage (fail-closed). Le flag weatherUnverified est posé
    // sur le résultat par scoreAlternates pour affichage d'un badge UI.
    return 0.5;
  }
  
  const metar = weather.metar.decoded;
  let score = 1.0;
  
  // 1. Visibilité (35% du score météo)
  if (metar.visibility === 'CAVOK') {
    // CAVOK = score parfait
  } else if (typeof metar.visibility === 'number') {
    if (metar.visibility < 1500) score -= 0.35;       // < 1.5km = très mauvais
    else if (metar.visibility < 3000) score -= 0.25;  // < 3km = mauvais
    else if (metar.visibility < 5000) score -= 0.15;  // < 5km = moyen
    else if (metar.visibility < 8000) score -= 0.05;  // < 8km = léger impact
  }
  
  // 2. Plafond nuageux (35% du score)
  if (metar.clouds && metar.clouds.length > 0) {
    const lowestCloud = metar.clouds
      .filter(c => ['BKN', 'OVC'].includes(c.type))
      .sort((a, b) => a.altitude - b.altitude)[0];
    
    if (lowestCloud) {
      if (lowestCloud.altitude < 200) score -= 0.35;      // < 200ft = très bas
      else if (lowestCloud.altitude < 500) score -= 0.25; // < 500ft = bas
      else if (lowestCloud.altitude < 1000) score -= 0.15; // < 1000ft = moyen
      else if (lowestCloud.altitude < 1500) score -= 0.05; // < 1500ft = acceptable
    }
  }
  
  // 3. Vent (20% du score)
  if (metar.wind) {
    const windSpeed = metar.wind.speed || 0;
    const gustSpeed = metar.wind.gust || windSpeed;
    
    if (gustSpeed > 35) score -= 0.20;      // Rafales > 35kt = dangereux
    else if (gustSpeed > 25) score -= 0.15; // Rafales > 25kt = difficile
    else if (windSpeed > 20) score -= 0.10; // Vent > 20kt = attention
    else if (windSpeed > 15) score -= 0.05; // Vent > 15kt = léger impact
    
    // Bonus si vent calme
    if (windSpeed === 0) score += 0.05;
  }
  
  // 4. Phénomènes significatifs (10% du score)
  if (metar.weather) {
    const severeWeather = ['TS', 'GR', 'GS', 'FC', 'DS', 'SS', 'VA'];
    const moderateWeather = ['SN', 'RA', 'DZ', 'SH', 'FZ'];
    
    if (metar.weather.some(w => severeWeather.includes(w))) {
      score -= 0.10; // Phénomènes dangereux
    } else if (metar.weather.some(w => moderateWeather.includes(w))) {
      score -= 0.05; // Phénomènes modérés
    }
  }
  
  // Ajustement selon le type de vol
  if (context.flightType?.rules === 'VFR' && score < 0.7) {
    // Pénalité supplémentaire pour VFR en mauvaises conditions
    score *= 0.8;
  }
  
  return Math.max(0, Math.min(score, 1.0));
};

// ===== CRITÈRE 5 : POSITION STRATÉGIQUE (10%) =====

/**
 * Évalue la position stratégique de l'aérodrome
 */
const calculateStrategicPosition = (airport, context) => {
  let score = 0;

  // 🔧 R5 : les terrains de DÉPART et d'ARRIVÉE perdaient la totalité du
  // critère par construction (ratio « milieu de route » = 1 → 0 pt), alors
  // qu'opérationnellement se dérouter vers son terrain de départ/arrivée est
  // souvent un très bon choix. Score neutre-bon forfaitaire.
  if (airport.icao &&
      (airport.icao === context.departureIcao || airport.icao === context.arrivalIcao)) {
    return 0.6;
  }

  // Vérifier que les coordonnées existent
  const airportPos = airport.coordinates || airport.position;
  if (!airportPos || !context.departure || !context.arrival) {
    return 0;
  }

  const totalRouteDistance = calculateDistance(context.departure, context.arrival);
  const distFromDeparture = calculateDistance(context.departure, airportPos);
  const distFromArrival = calculateDistance(context.arrival, airportPos);

  // 🔧 FIX: Protection contre division par zéro si départ = arrivée
  if (totalRouteDistance === 0 || isNaN(totalRouteDistance)) {
    return 0.5; // Score neutre
  }

  // 1. Position par rapport au milieu de route (60% du score)
  const midPointRatio = Math.abs(distFromDeparture - distFromArrival) / totalRouteDistance;
  const midPointScore = 1 - Math.min(midPointRatio * 2, 1);
  score += midPointScore * 0.6;
  
  // 2. Proximité aux points tournants (30% du score)
  if (context.waypoints && context.waypoints.length > 2) {
    const turnPoints = identifyTurnPoints(context.waypoints);
    
    if (turnPoints.length > 0) {
      const minDistToTurn = Math.min(...turnPoints.map(tp =>
        calculateDistance(airport.coordinates || airport.position, { lat: tp.lat, lon: tp.lon })
      ));
      const turnProximityScore = Math.max(0, 1 - (minDistToTurn / 30));
      score += turnProximityScore * 0.3;
    } else {
      // Pas de points tournants - score neutre
      score += 0.15;
    }
  }
  
  // 3. Éviter les extrémités (10% du score)
  const extremityPenalty = Math.min(distFromDeparture, distFromArrival) / totalRouteDistance;
  if (extremityPenalty < 0.1) {
    // Trop proche du départ ou de l'arrivée
    score += 0;
  } else if (extremityPenalty < 0.2) {
    score += 0.05;
  } else {
    score += 0.10;
  }

  return Math.min(score, 1.0);
};

// ===== CALCUL DU SCORE TOTAL =====

/**
 * Calcule le score total pondéré
 */
const calculateTotalScore = (scores) => {
  const weights = {
    distance: 0.30,      // 30%
    infrastructure: 0.25, // 25%
    services: 0.20,      // 20%
    weather: 0.15,       // 15%
    strategic: 0.10      // 10%
  };
  
  let totalScore = 0;
  
  for (const [criterion, score] of Object.entries(scores)) {
    totalScore += score * weights[criterion];
  }
  
  return Math.round(totalScore * 100) / 100;
};

// ===== DÉTERMINATION DU RANG =====

/**
 * Détermine le rang qualitatif basé sur le score
 */
const determineRank = (score) => {
  if (score >= 0.80) return 'EXCELLENT';
  if (score >= 0.60) return 'GOOD';
  if (score >= 0.40) return 'ACCEPTABLE';
  if (score >= 0.20) return 'MARGINAL';
  return 'POOR';
};

// ===== GÉNÉRATION DE RECOMMANDATION =====

/**
 * Génère une recommandation textuelle basée sur l'analyse
 */
const generateRecommendation = (airport, scores, rank) => {
  const recommendations = [];
  
  // Analyse des points forts
  const strengths = [];
  if (scores.distance >= 0.8) strengths.push('très proche de la route');
  if (scores.infrastructure >= 0.8) strengths.push('excellentes infrastructures');
  if (scores.services >= 0.8) strengths.push('services complets');
  if (scores.weather >= 0.8) strengths.push('météo favorable');
  if (scores.strategic >= 0.8) strengths.push('position stratégique');
  
  // Analyse des points faibles
  const weaknesses = [];
  if (scores.distance < 0.4) weaknesses.push('éloigné de la route');
  if (scores.infrastructure < 0.4) weaknesses.push('infrastructures limitées');
  if (scores.services < 0.4) weaknesses.push('services réduits');
  if (scores.weather < 0.4) weaknesses.push('météo défavorable');
  
  // Construction de la recommandation
  if (rank === 'EXCELLENT') {
    recommendations.push(`${airport.icao} est un excellent choix de déroutement`);
    if (strengths.length > 0) {
      recommendations.push(`Points forts : ${strengths.join(', ')}`);
    }
  } else if (rank === 'GOOD') {
    recommendations.push(`${airport.icao} est un bon choix de déroutement`);
    if (strengths.length > 0) {
      recommendations.push(`Avantages : ${strengths.join(', ')}`);
    }
    if (weaknesses.length > 0) {
      recommendations.push(`À considérer : ${weaknesses.join(', ')}`);
    }
  } else if (rank === 'ACCEPTABLE') {
    recommendations.push(`${airport.icao} est acceptable comme déroutement`);
    if (weaknesses.length > 0) {
      recommendations.push(`Limitations : ${weaknesses.join(', ')}`);
    }
  } else {
    recommendations.push(`${airport.icao} devrait être utilisé uniquement en dernier recours`);
    recommendations.push(`Problèmes majeurs : ${weaknesses.join(', ')}`);
  }
  
  return recommendations.join('. ');
};

// ===== FONCTIONS UTILITAIRES =====

/**
 * Détermine si un aérodrome a un service ATC/AFIS
 */
const hasATCService = (airport) => {
  // Vérifier les fréquences (tableau GeoJSON [{type,frequency,…}] — 🔧 R2 :
  // ajout FIS/ATIS, présents dans les données SIA des terrains contrôlés)
  if (Array.isArray(airport.frequencies) && airport.frequencies.length > 0) {
    return airport.frequencies.some(freq =>
      ['TWR', 'APP', 'AFIS', 'INFO', 'APRON', 'FIS', 'ATIS'].includes(freq.type)
    );
  }

  // Vérifier le type d'aérodrome
  return ['medium_airport', 'large_airport'].includes(airport.type);
};

/**
 * Détermine si un aérodrome a un balisage nocturne
 */
const hasNightLighting = (airport) => {
  // Vérifier l'attribut direct
  if (airport.lighting !== undefined) return airport.lighting;
  
  // Vérifier les pistes
  if (airport.runways) {
    return airport.runways.some(runway =>
      runway.lighting === true ||
      runway.lights === true ||
      runway.hasLighting === true ||
      runway.lightingType !== undefined
    );
  }

  // Par défaut selon le type
  return !['small_airport', 'closed'].includes(airport.type);
};

/**
 * Identifie les points tournants dans une route
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
        turnAngle
      });
    }
  }
  
  return turnPoints;
};

/**
 * Calcule la distance entre deux points (formule orthodromique)
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
 * Calcule le cap entre deux points
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
 * Calcule la distance d'un point à une route
 */
const calculateDistanceFromRoute = (point, departure, arrival) => {
  // Méthode simplifiée : utiliser la formule de la distance cross-track
  const R = 3440.065;
  
  const dXt = Math.asin(
    Math.sin(calculateDistance(departure, point) / R) *
    Math.sin(toRad(calculateBearing(departure, point) - calculateBearing(departure, arrival)))
  ) * R;
  
  return Math.abs(dXt);
};

/**
 * Conversions degrés/radians
 */
const toRad = (deg) => deg * Math.PI / 180;
const toDeg = (rad) => rad * 180 / Math.PI;

// ===== EXPORT DES FONCTIONS POUR TESTS =====

export const scoringUtils = {
  calculateDistanceScore,
  calculateInfrastructureScore,
  calculateServicesScore,
  calculateWeatherScore,
  calculateStrategicPosition,
  calculateTotalScore,
  determineRank,
  generateRecommendation,
  hasATCService,
  hasNightLighting,
  identifyTurnPoints
};