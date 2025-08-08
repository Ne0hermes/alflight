// src/utils/geographicZones.js

/**
 * Base de données des zones géographiques pour la détection automatique
 * des zones dangereuses (maritime, montagne, hostile)
 */

// Aéroports côtiers français et européens
export const COASTAL_AIRPORTS = {
  // Corse
  'LFKJ': { name: 'Ajaccio', maritime: true, distance: 0 },
  'LFKC': { name: 'Calvi', maritime: true, distance: 0 },
  'LFKF': { name: 'Figari', maritime: true, distance: 0 },
  'LFKB': { name: 'Bastia', maritime: true, distance: 0 },
  
  // Méditerranée
  'LFML': { name: 'Marseille', maritime: true, distance: 15 },
  'LFMN': { name: 'Nice', maritime: true, distance: 5 },
  'LFMT': { name: 'Montpellier', maritime: true, distance: 10 },
  'LFMP': { name: 'Perpignan', maritime: true, distance: 15 },
  'LFTH': { name: 'Toulon', maritime: true, distance: 0 },
  'LFMC': { name: 'Le Luc', maritime: true, distance: 20 },
  'LFMD': { name: 'Cannes', maritime: true, distance: 0 },
  
  // Atlantique
  'LFRB': { name: 'Brest', maritime: true, distance: 5 },
  'LFRN': { name: 'Rennes', maritime: false, distance: 40 },
  'LFRD': { name: 'Dinard', maritime: true, distance: 2 },
  'LFRH': { name: 'Lorient', maritime: true, distance: 5 },
  'LFRC': { name: 'Cherbourg', maritime: true, distance: 2 },
  'LFRK': { name: 'Caen', maritime: true, distance: 15 },
  'LFOH': { name: 'Le Havre', maritime: true, distance: 5 },
  'LFBH': { name: 'La Rochelle', maritime: true, distance: 5 },
  'LFBZ': { name: 'Biarritz', maritime: true, distance: 3 },
  'LFBD': { name: 'Bordeaux', maritime: false, distance: 50 },
  
  // Manche/Mer du Nord
  'LFAC': { name: 'Calais', maritime: true, distance: 5 },
  'LFAT': { name: 'Le Touquet', maritime: true, distance: 2 },
  'LFQQ': { name: 'Lille', maritime: false, distance: 50 },
};

// Aéroports de montagne
export const MOUNTAIN_AIRPORTS = {
  // Alpes
  'LFLS': { name: 'Grenoble', altitude: 1500, zone: 'Alpes' },
  'LFLB': { name: 'Chambéry', altitude: 1500, zone: 'Alpes' },
  'LFHM': { name: 'Megève', altitude: 1500, zone: 'Alpes' },
  'LFHU': { name: 'Alpe d\'Huez', altitude: 1860, zone: 'Alpes' },
  'LFKE': { name: 'Saint-Étienne', altitude: 1000, zone: 'Massif Central' },
  'LFLP': { name: 'Annecy', altitude: 1500, zone: 'Alpes' },
  'LFKD': { name: 'Gap', altitude: 1500, zone: 'Alpes' },
  
  // Pyrénées
  'LFCG': { name: 'Saint-Girons', altitude: 1200, zone: 'Pyrénées' },
  'LFBT': { name: 'Tarbes', altitude: 800, zone: 'Pyrénées' },
  'LFBP': { name: 'Pau', altitude: 800, zone: 'Pyrénées' },
  
  // Massif Central
  'LFMV': { name: 'Aurillac', altitude: 1000, zone: 'Massif Central' },
  'LFLC': { name: 'Clermont-Ferrand', altitude: 1000, zone: 'Massif Central' },
  'LFHP': { name: 'Le Puy', altitude: 1000, zone: 'Massif Central' },
};

/**
 * Vérifie si un point est en zone maritime
 */
export function isInMaritimeZone(lat, lon) {
  // Méditerranée (large zone incluant le trajet vers la Corse)
  if (lon > 3 && lon < 10 && lat > 41 && lat < 44.5) return true;
  
  // Golfe du Lion
  if (lon > 2.5 && lon < 6 && lat > 42 && lat < 44) return true;
  
  // Côte d'Azur
  if (lon > 5 && lon < 8 && lat > 43 && lat < 44) return true;
  
  // Atlantique (large zone)
  if (lon < -0.5 && lat > 43 && lat < 49) return true;
  
  // Golfe de Gascogne
  if (lon < 0 && lon > -3 && lat > 43 && lat < 47) return true;
  
  // Manche
  if (lat > 48.5 && lat < 51 && lon > -2 && lon < 2) return true;
  
  // Corse (toute l'île nécessite un survol maritime pour y accéder)
  if (lon > 8.5 && lon < 9.6 && lat > 41.3 && lat < 43.1) return true;
  
  return false;
}

/**
 * Vérifie si un point est en zone montagneuse
 */
export function isInMountainZone(lat, lon) {
  // Alpes
  if (lon > 5 && lon < 8 && lat > 44 && lat < 47) {
    return { zone: true, name: 'Alpes', altitude: 3000 };
  }
  
  // Alpes du Sud
  if (lon > 5.5 && lon < 7.5 && lat > 43.5 && lat < 44.5) {
    return { zone: true, name: 'Alpes du Sud', altitude: 2500 };
  }
  
  // Pyrénées
  if (lon > -2 && lon < 3 && lat > 42 && lat < 43.5) {
    return { zone: true, name: 'Pyrénées', altitude: 2500 };
  }
  
  // Massif Central
  if (lon > 2 && lon < 4.5 && lat > 44 && lat < 46.5) {
    return { zone: true, name: 'Massif Central', altitude: 1500 };
  }
  
  // Vosges
  if (lon > 6.5 && lon < 7.5 && lat > 47.5 && lat < 48.5) {
    return { zone: true, name: 'Vosges', altitude: 1400 };
  }
  
  // Jura
  if (lon > 5 && lon < 6.5 && lat > 46 && lat < 47.5) {
    return { zone: true, name: 'Jura', altitude: 1700 };
  }
  
  // Corse (montagneuse)
  if (lon > 8.5 && lon < 9.6 && lat > 41.3 && lat < 43.1) {
    return { zone: true, name: 'Corse', altitude: 2000 };
  }
  
  return { zone: false, name: '', altitude: 0 };
}

/**
 * Vérifie si une route traverse une zone maritime
 * en analysant plusieurs points sur le segment
 */
export function routeCrossesWater(startLat, startLon, endLat, endLon) {
  const steps = 20; // Nombre de points à vérifier
  
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const lat = startLat + (endLat - startLat) * ratio;
    const lon = startLon + (endLon - startLon) * ratio;
    
    if (isInMaritimeZone(lat, lon)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Détermine si c'est un vol vers/depuis la Corse
 */
export function isCorsicaFlight(lat1, lon1, lat2, lon2) {
  const isCorsica = (lat, lon) => lon > 8.5 && lon < 9.6 && lat > 41.3 && lat < 43.1;
  const isMainland = (lat, lon) => lon > -5 && lon < 8.5 && lat > 41 && lat < 52;
  
  return (isCorsica(lat1, lon1) && isMainland(lat2, lon2)) ||
         (isMainland(lat1, lon1) && isCorsica(lat2, lon2));
}

/**
 * Analyse complète d'une route pour détecter les zones dangereuses
 */
export function analyzeRoute(waypoints) {
  const result = {
    maritime: false,
    maritimeDistance: 0,
    mountain: false,
    mountainAltitude: 0,
    mountainZones: [],
    corsicaFlight: false,
    coastalAirports: []
  };
  
  if (!waypoints || waypoints.length < 2) {
    return result;
  }
  
  // Vérifier chaque waypoint
  waypoints.forEach((wp, index) => {
    if (!wp.lat || !wp.lon) return;
    
    // Vérifier les aéroports côtiers
    if (wp.name && COASTAL_AIRPORTS[wp.name.toUpperCase()]) {
      const airport = COASTAL_AIRPORTS[wp.name.toUpperCase()];
      result.coastalAirports.push(airport.name);
      if (airport.maritime) {
        result.maritime = true;
        result.maritimeDistance = Math.max(result.maritimeDistance, airport.distance);
      }
    }
    
    // Vérifier les aéroports de montagne
    if (wp.name && MOUNTAIN_AIRPORTS[wp.name.toUpperCase()]) {
      const airport = MOUNTAIN_AIRPORTS[wp.name.toUpperCase()];
      result.mountain = true;
      result.mountainAltitude = Math.max(result.mountainAltitude, airport.altitude);
      if (!result.mountainZones.includes(airport.zone)) {
        result.mountainZones.push(airport.zone);
      }
    }
    
    // Vérifier si le waypoint est en zone maritime
    if (isInMaritimeZone(wp.lat, wp.lon)) {
      result.maritime = true;
      result.maritimeDistance = Math.max(result.maritimeDistance, 50);
    }
    
    // Vérifier si le waypoint est en zone montagneuse
    const mountain = isInMountainZone(wp.lat, wp.lon);
    if (mountain.zone) {
      result.mountain = true;
      result.mountainAltitude = Math.max(result.mountainAltitude, mountain.altitude);
      if (!result.mountainZones.includes(mountain.name)) {
        result.mountainZones.push(mountain.name);
      }
    }
    
    // Analyser le segment entre deux waypoints
    if (index > 0) {
      const prevWp = waypoints[index - 1];
      if (prevWp.lat && prevWp.lon) {
        // Vérifier si le segment traverse l'eau
        if (routeCrossesWater(prevWp.lat, prevWp.lon, wp.lat, wp.lon)) {
          result.maritime = true;
          result.maritimeDistance = Math.max(result.maritimeDistance, 30);
        }
      }
    }
  });
  
  // Vérifier si c'est un vol vers/depuis la Corse
  if (waypoints.length >= 2) {
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    if (first.lat && first.lon && last.lat && last.lon) {
      if (isCorsicaFlight(first.lat, first.lon, last.lat, last.lon)) {
        result.corsicaFlight = true;
        result.maritime = true;
        result.maritimeDistance = Math.max(result.maritimeDistance, 100);
      }
    }
  }
  
  return result;
}