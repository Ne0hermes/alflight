// src/services/openAIPService.js

/**
 * Service pour l'API OpenAIP
 * Documentation: https://www.openaip.net/api
 */

const OPENAIP_CONFIG = {
  baseUrl: 'https://api.openaip.net',
  apiKey: '2717b9196e8100ee2456e09b82b5b08e',
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 heures
  endpoints: {
    airports: '/airports',
    reportingPoints: '/reportingpoints',
    navaid: '/navaid'
  }
};

class OpenAIPService {
  constructor() {
    this.cache = new Map();
    this.headers = {
      'x-openaip-auth': OPENAIP_CONFIG.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Récupère depuis le cache ou l'API
   */
  async fetchWithCache(endpoint, params = {}) {
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
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('❌ Erreur OpenAIP:', error);
      throw error;
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
    try {
      const data = await this.fetchWithCache(OPENAIP_CONFIG.endpoints.airports, {
        country: countryCode
      });

      // Filtrer et formater les aérodromes
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
        type: airport.type, // AIRPORT, HELIPORT, etc.
        runways: airport.runways || [],
        frequencies: airport.frequencies || []
      })).filter(a => a.icao); // Garder seulement ceux avec code ICAO
      
    } catch (error) {
      console.error('Erreur récupération aérodromes:', error);
      return [];
    }
  }

  /**
   * Récupère les points de report VFR pour un aérodrome
   */
  async getReportingPoints(airportId) {
    try {
      const data = await this.fetchWithCache(OPENAIP_CONFIG.endpoints.reportingPoints, {
        airport: airportId
      });

      const points = data.items || [];
      
      return points.map(point => ({
        id: point.id,
        name: point.name,
        code: point.code, // N, S, E, W, NE, SW, etc.
        type: point.type, // VFR_REPORTING_POINT, etc.
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
    try {
      const data = await this.fetchWithCache(OPENAIP_CONFIG.endpoints.reportingPoints, {
        country: countryCode
      });

      const points = data.items || [];
      
      // Grouper par aérodrome
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
      return {};
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
}

// Export singleton
export const openAIPService = new OpenAIPService();

// Export des fonctions utilitaires
export const validateCoordinates = (coords1, coords2, toleranceDegrees = 0.001) => {
  return openAIPService.compareCoordinates(coords1, coords2, toleranceDegrees);
};

// Export de la classe pour les tests
export default OpenAIPService;