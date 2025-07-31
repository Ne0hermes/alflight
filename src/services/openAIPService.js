// src/services/openAIPService.js

/**
 * Service pour l'API OpenAIP avec fallback sur données statiques
 * Documentation: https://www.openaip.net/api
 */

// Import des données statiques (assurez-vous que ce chemin est correct)
// import { FRENCH_AIRPORTS_COORDINATES, getAirportElevation } from '@data/airportElevations';

const OPENAIP_CONFIG = {
  baseUrl: 'https://api.openaip.net',
  apiKey: '2717b9196e8100ee2456e09b82b5b08e', // Votre clé API
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 heures
  useStaticData: true, // Utiliser les données statiques par défaut pour éviter les erreurs
  endpoints: {
    airports: '/airports',
    reportingPoints: '/reportingpoints',
    navaid: '/navaid'
  }
};

// Données statiques des aérodromes français principaux
const STATIC_AIRPORTS = [
  // Région parisienne
  { id: '1', icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris', type: 'AIRPORT', coordinates: { lat: 49.0097, lon: 2.5478 }, elevation: 119 },
  { id: '2', icao: 'LFPO', name: 'Paris Orly', city: 'Paris', type: 'AIRPORT', coordinates: { lat: 48.7233, lon: 2.3794 }, elevation: 89 },
  { id: '3', icao: 'LFPB', name: 'Paris Le Bourget', city: 'Paris', type: 'AIRPORT', coordinates: { lat: 48.9694, lon: 2.4414 }, elevation: 66 },
  { id: '4', icao: 'LFPN', name: 'Toussus-le-Noble', city: 'Toussus-le-Noble', type: 'AIRPORT', coordinates: { lat: 48.7519, lon: 2.1061 }, elevation: 163 },
  { id: '5', icao: 'LFPT', name: 'Pontoise-Cormeilles', city: 'Pontoise', type: 'AIRPORT', coordinates: { lat: 49.0967, lon: 2.0413 }, elevation: 98 },
  
  // Grandes villes
  { id: '10', icao: 'LFML', name: 'Marseille Provence', city: 'Marseille', type: 'AIRPORT', coordinates: { lat: 43.4367, lon: 5.2150 }, elevation: 21 },
  { id: '11', icao: 'LFMN', name: 'Nice Côte d\'Azur', city: 'Nice', type: 'AIRPORT', coordinates: { lat: 43.6584, lon: 7.2158 }, elevation: 4 },
  { id: '12', icao: 'LFLL', name: 'Lyon Saint-Exupéry', city: 'Lyon', type: 'AIRPORT', coordinates: { lat: 45.7256, lon: 5.0811 }, elevation: 248 },
  { id: '13', icao: 'LFBO', name: 'Toulouse Blagnac', city: 'Toulouse', type: 'AIRPORT', coordinates: { lat: 43.6293, lon: 1.3638 }, elevation: 152 },
  { id: '14', icao: 'LFBD', name: 'Bordeaux Mérignac', city: 'Bordeaux', type: 'AIRPORT', coordinates: { lat: 44.8283, lon: -0.7156 }, elevation: 49 },
  
  // Ajouter d'autres aéroports selon vos besoins...
];

// Points de report VFR statiques
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
    // Utiliser le bon header pour l'authentification
    this.headers = {
      'x-openaip-auth': OPENAIP_CONFIG.apiKey, // Header correct pour l'API
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    console.log('🔧 Service OpenAIP initialisé');
    console.log('📍 Mode:', OPENAIP_CONFIG.useStaticData ? 'Données statiques' : 'API');
  }

  /**
   * Récupère depuis le cache ou l'API
   */
  async fetchWithCache(endpoint, params = {}) {
    // Si on utilise les données statiques, ne pas faire d'appel API
    if (OPENAIP_CONFIG.useStaticData) {
      console.log('📚 Mode données statiques activé - pas d\'appel API');
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
        headers: this.headers
      });

      if (!response.ok) {
        console.warn(`⚠️ Erreur API: ${response.status} ${response.statusText}`);
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`❌ Erreur OpenAIP:`, error);
      console.warn('⚠️ Basculement automatique sur les données statiques');
      // Activer automatiquement le mode statique en cas d'erreur
      OPENAIP_CONFIG.useStaticData = true;
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
      console.log('📚 Retour des données statiques');
      
      return STATIC_AIRPORTS.map(airport => ({
        ...airport,
        country: 'FR',
        runways: [],
        frequencies: []
      }));
    }

    try {
      const data = await this.fetchWithCache(OPENAIP_CONFIG.endpoints.airports, {
        country: countryCode
      });

      const airports = data.items || [];
      
      // Si aucune donnée de l'API, utiliser les données statiques
      if (airports.length === 0) {
        console.warn('⚠️ Aucune donnée de l\'API, utilisation des données statiques');
        OPENAIP_CONFIG.useStaticData = true;
        return this.getAirports(countryCode);
      }
      
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
      // Retourner les données statiques en cas d'erreur
      return STATIC_AIRPORTS.map(airport => ({
        ...airport,
        country: 'FR',
        runways: [],
        frequencies: []
      }));
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
      
      if (points.length === 0) {
        return STATIC_REPORTING_POINTS;
      }
      
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

  /**
   * Vérifier si on utilise les données statiques
   */
  isUsingStaticData() {
    return OPENAIP_CONFIG.useStaticData;
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