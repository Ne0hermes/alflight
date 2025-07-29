// src/modules/navigation/config/ign.config.js

/**
 * Configuration pour l'API IGN/Géoportail
 * Documentation : https://geoservices.ign.fr
 */

export const IGN_CONFIG = {
  // Clé API Géoportail
  // Pour obtenir une clé : https://geoservices.ign.fr/documentation/services/api-et-services-ogc/cles
  apiKey: 'essentiels', // Clé publique pour les tests - Remplacer par votre clé en production
  
  // Configuration des couches OACI
  layers: {
    // Carte SCAN OACI 2024 - Carte aéronautique OACI au 1:500 000
    SCAN_OACI: {
      name: 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI',
      format: 'image/jpeg',
      style: 'normal',
      minZoom: 6,
      maxZoom: 14,
      attribution: '© IGN-F/Geoportail - SCAN OACI',
      description: 'Carte aéronautique OACI France'
    },
    
    // Autres couches disponibles
    SCAN_25: {
      name: 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR',
      format: 'image/jpeg',
      style: 'normal',
      minZoom: 10,
      maxZoom: 16,
      attribution: '© IGN-F/Geoportail',
      description: 'Carte topographique au 1:25 000'
    },
    
    ORTHO: {
      name: 'ORTHOIMAGERY.ORTHOPHOTOS',
      format: 'image/jpeg',
      style: 'normal',
      minZoom: 6,
      maxZoom: 19,
      attribution: '© IGN-F/Geoportail',
      description: 'Photographies aériennes'
    }
  },
  
  // Configuration du service WMTS
  wmts: {
    url: 'https://wxs.ign.fr/{apiKey}/geoportail/wmts',
    service: 'WMTS',
    version: '1.0.0',
    request: 'GetTile',
    tilematrixSet: 'PM', // Projection Mercator
    // Alternative : 'EPSG:4326' pour WGS84
  },
  
  // Limites géographiques de la France métropolitaine
  bounds: {
    north: 51.1,
    south: 41.3,
    east: 9.6,
    west: -5.2
  },
  
  // Points d'intérêt aéronautiques
  aeronauticalFeatures: {
    // Classes d'espace aérien affichées sur la carte OACI
    airspaces: [
      'CTR', // Control Zone
      'TMA', // Terminal Control Area
      'SIV', // Secteur d'Information de Vol
      'R',   // Restricted
      'D',   // Danger
      'P'    // Prohibited
    ],
    
    // Types de navigation
    navaids: [
      'VOR',  // VHF Omnidirectional Range
      'DME',  // Distance Measuring Equipment
      'NDB',  // Non-Directional Beacon
      'TACAN' // Tactical Air Navigation
    ]
  }
};

/**
 * Obtenir l'URL des tuiles pour une couche donnée
 */
export const getTileUrl = (layerKey = 'SCAN_OACI', apiKey = IGN_CONFIG.apiKey) => {
  const layer = IGN_CONFIG.layers[layerKey];
  if (!layer) {
    throw new Error(`Couche ${layerKey} non trouvée`);
  }
  
  const baseUrl = IGN_CONFIG.wmts.url.replace('{apiKey}', apiKey);
  
  return `${baseUrl}?` +
    `SERVICE=${IGN_CONFIG.wmts.service}&` +
    `VERSION=${IGN_CONFIG.wmts.version}&` +
    `REQUEST=${IGN_CONFIG.wmts.request}&` +
    `LAYER=${layer.name}&` +
    `STYLE=${layer.style}&` +
    `FORMAT=${layer.format}&` +
    `TILEMATRIXSET=${IGN_CONFIG.wmts.tilematrixSet}&` +
    `TILEMATRIX={z}&` +
    `TILEROW={y}&` +
    `TILECOL={x}`;
};

/**
 * Configuration des styles pour les éléments de navigation
 */
export const NAVIGATION_STYLES = {
  route: {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.8,
    dashArray: '10, 5'
  },
  
  departure: {
    color: '#10b981',
    fillColor: '#10b981',
    radius: 8,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
  },
  
  arrival: {
    color: '#ef4444',
    fillColor: '#ef4444',
    radius: 8,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
  },
  
  waypoint: {
    color: '#3b82f6',
    fillColor: '#3b82f6',
    radius: 6,
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
  }
};

/**
 * Symboles OACI standards
 */
export const OACI_SYMBOLS = {
  // Aérodromes
  AD_CIVIL: '⊕',      // Aérodrome civil
  AD_MILITARY: '⊗',   // Aérodrome militaire
  AD_MIXED: '⊙',      // Aérodrome mixte
  HELIPORT: 'H',      // Héliport
  
  // Points de report
  VFR_POINT: '▲',     // Point de report VFR
  ENTRY_POINT: '►',   // Point d'entrée
  EXIT_POINT: '◄',    // Point de sortie
  
  // Obstacles
  OBSTACLE: '↑',      // Obstacle vertical
  WIND_TURBINE: '⚡', // Éolienne
  ANTENNA: '📡'       // Antenne
};