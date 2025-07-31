// src/services/openAIPService.js

/**
 * Service pour l'API OpenAIP avec fallback sur données statiques
 * Documentation: https://www.openaip.net/api
 */

// Import des données statiques
import { FRENCH_AIRPORTS_COORDINATES, getAirportElevation } from '@data/airportElevations';

const OPENAIP_CONFIG = {
  baseUrl: 'https://api.openaip.net',
  // Clé API OpenAIP - À remplacer par votre propre clé
  // Obtenir une clé gratuite sur : https://www.openaip.net/users/sign_up
  apiKey: process.env.VITE_OPENAIP_API_KEY || 'demo',
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 heures
  useStaticData: true, // Utiliser les données statiques par défaut
  endpoints: {
    airports: '/airports',
    reportingPoints: '/reportingpoints',
    navaid: '/navaid'
  }
};

// Données statiques étendues des aérodromes français
const STATIC_AIRPORTS = [
  // Région parisienne
  { id: '1', icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris', type: 'AIRPORT' },
  { id: '2', icao: 'LFPO', name: 'Paris Orly', city: 'Paris', type: 'AIRPORT' },
  { id: '3', icao: 'LFPB', name: 'Paris Le Bourget', city: 'Paris', type: 'AIRPORT' },
  { id: '4', icao: 'LFPN', name: 'Toussus-le-Noble', city: 'Toussus-le-Noble', type: 'AIRPORT' },
  { id: '5', icao: 'LFPT', name: 'Pontoise-Cormeilles', city: 'Pontoise', type: 'AIRPORT' },
  { id: '6', icao: 'LFPX', name: 'Chavenay-Villepreux', city: 'Chavenay', type: 'AIRPORT' },
  { id: '7', icao: 'LFPH', name: 'Chelles-Le Pin', city: 'Chelles', type: 'AIRPORT' },
  { id: '8', icao: 'LFPI', name: 'Persan-Beaumont', city: 'Persan', type: 'AIRPORT' },
  
  // Grandes villes
  { id: '10', icao: 'LFML', name: 'Marseille Provence', city: 'Marseille', type: 'AIRPORT' },
  { id: '11', icao: 'LFMN', name: 'Nice Côte d\'Azur', city: 'Nice', type: 'AIRPORT' },
  { id: '12', icao: 'LFLL', name: 'Lyon Saint-Exupéry', city: 'Lyon', type: 'AIRPORT' },
  { id: '13', icao: 'LFBO', name: 'Toulouse Blagnac', city: 'Toulouse', type: 'AIRPORT' },
  { id: '14', icao: 'LFBD', name: 'Bordeaux Mérignac', city: 'Bordeaux', type: 'AIRPORT' },
  { id: '15', icao: 'LFRS', name: 'Nantes Atlantique', city: 'Nantes', type: 'AIRPORT' },
  { id: '16', icao: 'LFRN', name: 'Rennes Saint-Jacques', city: 'Rennes', type: 'AIRPORT' },
  { id: '17', icao: 'LFST', name: 'Strasbourg-Entzheim', city: 'Strasbourg', type: 'AIRPORT' },
  { id: '18', icao: 'LFLC', name: 'Clermont-Ferrand Auvergne', city: 'Clermont-Ferrand', type: 'AIRPORT' },
  { id: '19', icao: 'LFMP', name: 'Perpignan-Rivesaltes', city: 'Perpignan', type: 'AIRPORT' },
  { id: '20', icao: 'LFMT', name: 'Montpellier-Méditerranée', city: 'Montpellier', type: 'AIRPORT' },
  
  // Alpes
  { id: '30', icao: 'LFLB', name: 'Chambéry-Savoie', city: 'Chambéry', type: 'AIRPORT' },
  { id: '31', icao: 'LFLS', name: 'Grenoble-Isère', city: 'Grenoble', type: 'AIRPORT' },
  { id: '32', icao: 'LFHM', name: 'Megève', city: 'Megève', type: 'ALTIPORT' },
  { id: '33', icao: 'LFKE', name: 'Courchevel', city: 'Courchevel', type: 'ALTIPORT' },
  { id: '34', icao: 'LFKD', name: 'Gap-Tallard', city: 'Gap', type: 'AIRPORT' },
  
  // Corse
  { id: '40', icao: 'LFKJ', name: 'Ajaccio-Napoléon Bonaparte', city: 'Ajaccio', type: 'AIRPORT' },
  { id: '41', icao: 'LFKB', name: 'Bastia-Poretta', city: 'Bastia', type: 'AIRPORT' },
  { id: '42', icao: 'LFKC', name: 'Calvi-Sainte-Catherine', city: 'Calvi', type: 'AIRPORT' },
  { id: '43', icao: 'LFKF', name: 'Figari-Sud Corse', city: 'Figari', type: 'AIRPORT' },
  
  // Aérodromes d'aviation légère supplémentaires
  { id: '50', icao: 'LFAY', name: 'Amiens-Glisy', city: 'Amiens', type: 'AIRPORT' },
  { id: '51', icao: 'LFAC', name: 'Calais-Dunkerque', city: 'Calais', type: 'AIRPORT' },
  { id: '52', icao: 'LFAT', name: 'Le Touquet-Paris-Plage', city: 'Le Touquet', type: 'AIRPORT' },
  { id: '53', icao: 'LFSB', name: 'Bâle-Mulhouse', city: 'Bâle', type: 'AIRPORT' },
  { id: '54', icao: 'LFSD', name: 'Dijon-Bourgogne', city: 'Dijon', type: 'AIRPORT' },
  { id: '55', icao: 'LFSG', name: 'Épinal-Mirecourt', city: 'Épinal', type: 'AIRPORT' }
];

// Points de report VFR statiques (exemples)
const STATIC_REPORTING_POINTS = {
  'LFPN': [
    { id: 'LFPN-N', code: 'N', name: 'Nord Toussus', coordinates: { lat: 48.7800, lon: 2.1061 }, description: 'Point Nord' },
    { id: 'LFPN-S', code: 'S', name: 'Sud Toussus', coordinates: { lat: 48.7200, lon: 2.1061 }, description: 'Point Sud' },
    { id: 'LFPN-E', code: 'E', name: 'Est Toussus', coordinates: { lat: 48.7519, lon: 2.1500 }, description: 'Point Est' },
    { id: 'LFPN-W', code: 'W', name: 'Ouest Toussus', coordinates: { lat: 48.7519, lon: 2.0600 }, description: 'Point Ouest' }
  ],
  'LFPT': [
    { id: 'LFPT-N', code: 'N', name: 'November', coordinates: { lat: 49.1300, lon: 2.0413 }, description: 'Point November' },
    { id: 'LFPT-S', code: 'S', name: 'Sierra', coordinates: { lat: 49.0600, lon: 2.0413 }, description: 'Point Sierra' }
  ]
};

class OpenAIPService {
  constructor() {
    this.cache = new Map();
    this.headers = {
      'x-openaip-client-id': OPENAIP_CONFIG.apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    console.log('🔧 Service OpenAIP initialisé');
    console.log('📍 Mode:', OPENAIP_CONFIG.useStaticData ? 'Données statiques' : 'API');
  }

  /**
   * Récupère depuis le cache ou l'API
   */
  async fetchWithCache(endpoint, params = {}) {
    if (OPENAIP_CONFIG.useStaticData) {
      // En mode statique, retourner directement les données
      return { items: [] };
    }

    const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      console.log(`📦 Données depuis le cache pour ${endpoint}`);
      return cached;
    }

    try {
      const queryString = new URLSearchParams(params).toString();
      const url = `${OPENAIP_CONFIG.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
      
      console.log(`🌐 Appel API OpenAIP: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        mode: 'cors'
      });

      if (!response.ok) {
        console.warn(`⚠️ Réponse API non OK: ${response.status} ${response.statusText}`);
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`❌ Erreur OpenAIP pour ${endpoint}:`, error.message);
      return { items: [] };
    }
  }

  /**
   * Gestion du cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > OPENAIP_CONFIG.cacheExpiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Récupère tous les aérodromes français
   */
  async getAirports(countryCode = 'FR') {
    if (OPENAIP_CONFIG.useStaticData) {
      console.log('📚 Utilisation des données statiques');
      
      // Enrichir les données statiques avec les coordonnées et altitudes
      return STATIC_AIRPORTS.map(airport => {
        const coords = FRENCH_AIRPORTS_COORDINATES[airport.icao];
        const elevation = getAirportElevation(airport.icao);
        
        return {
          ...airport,
          country: 'FR',
          coordinates: coords ? {
            lat: coords.lat,
            lon: coords.lon
          } : {
            lat: 0,
            lon: 0
          },
          elevation: elevation,
          runways: [],
          frequencies: []
        };
      }).filter(a => a.coordinates.lat !== 0); // Filtrer ceux sans coordonnées
    }

    try {
      const data = await this.fetchWithCache(OPENAIP_CONFIG.endpoints.airports, {
        country: countryCode
      });

      const airports = data.items || [];
      
      return airports.map(airport => ({
        id: airport.id,
        icao: airport.icao || airport.code,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        coordinates: {
          lat: parseFloat(airport.latitude),
          lon: parseFloat(airport.longitude)
        },
        elevation: airport.elevation ? parseInt(airport.elevation) : null,
        type: airport.type,
        runways: airport.runways || [],
        frequencies: airport.frequencies || []
      })).filter(a => a.icao);
      
    } catch (error) {
      console.error('Erreur récupération aérodromes:', error);
      console.warn('⚠️ Basculement sur les données statiques');
      return this.getAirports(countryCode); // Récursion avec données statiques
    }
  }

  /**
   * Récupère les points de report VFR pour un aérodrome
   */
  async getReportingPoints(airportId) {
    if (OPENAIP_CONFIG.useStaticData) {
      const icao = typeof airportId === 'string' && airportId.match(/^LF[A-Z]{2}$/) ? airportId : null;
      return icao && STATIC_REPORTING_POINTS[icao] ? STATIC_REPORTING_POINTS[icao] : [];
    }

    try {
      const data = await this.fetchWithCache(OPENAIP_CONFIG.endpoints.reportingPoints, {
        airport: airportId
      });

      const points = data.items || [];
      
      return points.map(point => ({
        id: point.id,
        name: point.name,
        code: point.code,
        type: point.type,
        coordinates: {
          lat: parseFloat(point.latitude),
          lon: parseFloat(point.longitude)
        },
        elevation: point.elevation ? parseInt(point.elevation) : null,
        description: point.description,
        airportId: point.airportId
      }));
      
    } catch (error) {
      console.error('Erreur récupération points de report:', error);
      return [];
    }
  }

  /**
   * Récupère tous les points de report VFR d'un pays
   */
  async getAllReportingPoints(countryCode = 'FR') {
    if (OPENAIP_CONFIG.useStaticData) {
      console.log('📍 Utilisation des points de report statiques');
      return STATIC_REPORTING_POINTS;
    }

    try {
      const data = await this.fetchWithCache(OPENAIP_CONFIG.endpoints.reportingPoints, {
        country: countryCode
      });

      const points = data.items || [];
      const pointsByAirport = {};
      
      points.forEach(point => {
        const formatted = {
          id: point.id,
          name: point.name,
          code: point.code,
          type: point.type,
          coordinates: {
            lat: parseFloat(point.latitude),
            lon: parseFloat(point.longitude)
          },
          elevation: point.elevation ? parseInt(point.elevation) : null,
          description: point.description,
          airportIcao: point.airportIcao || point.airport_code
        };
        
        const icao = formatted.airportIcao;
        if (icao) {
          if (!pointsByAirport[icao]) {
            pointsByAirport[icao] = [];
          }
          pointsByAirport[icao].push(formatted);
        }
      });
      
      return pointsByAirport;
      
    } catch (error) {
      console.error('Erreur récupération points de report:', error);
      return STATIC_REPORTING_POINTS;
    }
  }

  /**
   * Recherche d'aérodromes par texte
   */
  async searchAirports(query, countryCode = 'FR') {
    const airports = await this.getAirports(countryCode);
    const searchTerm = query.toLowerCase();
    
    return airports.filter(airport => 
      airport.icao.toLowerCase().includes(searchTerm) ||
      airport.name.toLowerCase().includes(searchTerm) ||
      (airport.city && airport.city.toLowerCase().includes(searchTerm))
    );
  }

  /**
   * Compare les coordonnées avec une tolérance
   */
  compareCoordinates(coord1, coord2, tolerance = 0.001) {
    const latDiff = Math.abs(coord1.lat - coord2.lat);
    const lonDiff = Math.abs(coord1.lon - coord2.lon);
    
    return {
      isMatch: latDiff <= tolerance && lonDiff <= tolerance,
      latDiff,
      lonDiff,
      distance: this.calculateDistance(coord1, coord2)
    };
  }

  /**
   * Calcul de distance entre deux points
   */
  calculateDistance(coord1, coord2) {
    const R = 6371; // Rayon de la terre en km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Distance en mètres
  }

  /**
   * Basculer entre API et données statiques
   */
  toggleDataSource(useStatic = null) {
    OPENAIP_CONFIG.useStaticData = useStatic !== null ? useStatic : !OPENAIP_CONFIG.useStaticData;
    this.clearCache();
    console.log('📍 Mode de données:', OPENAIP_CONFIG.useStaticData ? 'Statiques' : 'API');
  }
}

// Export singleton
export const openAIPService = new OpenAIPService();

// Export des fonctions utilitaires
export const validateCoordinates = (coords1, coords2, toleranceDegrees = 0.001) => {
  return openAIPService.compareCoordinates(coords1, coords2, toleranceDegrees);
};

// Export de la classe pour les tests
export default OpenAIPService;