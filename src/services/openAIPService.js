// src/services/openAIPService.js

/**
 * Service pour OpenAIP - Version API uniquement
 * Connexion directe à l'API OpenAIP via proxy ou direct
 */

const OPENAIP_CONFIG = {
  apiKey: import.meta.env.VITE_OPENAIP_API_KEY || '2717b9196e8100ee2456e09b82b5b08e',
  apiUrl: 'https://api.core.openaip.net/api',
  proxyUrl: import.meta.env.VITE_OPENAIP_PROXY_URL || 'http://localhost:3001/api/openaip',
  tileUrl: 'https://api.tiles.openaip.net/api/data/openaip',
  useProxy: true // Toujours essayer le proxy d'abord
};

class OpenAIPService {
  constructor() {
    this.cache = new Map();
    this.connectionError = null;
    
    console.log('🔧 Service OpenAIP initialisé');
    console.log('📡 Mode: API uniquement (pas de données statiques)');
    console.log('🔑 Clé API:', OPENAIP_CONFIG.apiKey ? 'Configurée' : 'Non configurée');
  }

  /**
   * Teste la connexion à l'API
   */
  async testConnection() {
    try {
      // Essayer d'abord le proxy
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        console.log('🔄 Test de connexion au proxy OpenAIP...');
        const response = await fetch(`${OPENAIP_CONFIG.proxyUrl}/test`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          console.log('✅ Proxy OpenAIP accessible');
          this.connectionError = null;
          return { success: true, mode: 'proxy' };
        }
      }
      
      // Essayer l'API directe
      console.log('🔄 Test de connexion directe à l\'API OpenAIP...');
      const response = await fetch(`${OPENAIP_CONFIG.apiUrl}/airports?page=1&limit=1`, {
        headers: {
          'x-openaip-api-key': OPENAIP_CONFIG.apiKey,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        console.log('✅ API OpenAIP accessible directement');
        this.connectionError = null;
        return { success: true, mode: 'direct' };
      }
      
      throw new Error(`Erreur HTTP: ${response.status}`);
      
    } catch (error) {
      this.connectionError = error.message;
      console.error('❌ Erreur de connexion OpenAIP:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupère tous les aérodromes d'un pays
   */
  async getAirports(countryCode = 'FR') {
    const cacheKey = `airports-${countryCode}`;
    
    // Vérifier le cache (5 minutes)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log('📦 Utilisation du cache pour les aérodromes');
      return cached.data;
    }
    
    try {
      // Essayer le proxy d'abord
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        console.log('🌐 Récupération des aérodromes via proxy...');
        const response = await fetch(
          `${OPENAIP_CONFIG.proxyUrl}/airports?country=${countryCode}`,
          { signal: AbortSignal.timeout(10000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          const airports = this.transformAirports(data.items || []);
          
          // Mettre en cache
          this.cache.set(cacheKey, {
            data: airports,
            timestamp: Date.now()
          });
          
          console.log(`✅ ${airports.length} aérodromes récupérés via proxy`);
          return airports;
        }
      }
      
      // Essayer l'API directe
      console.log('🌐 Récupération des aérodromes via API directe...');
      const response = await fetch(
        `${OPENAIP_CONFIG.apiUrl}/airports?country=${countryCode}&page=1&limit=500`,
        {
          headers: {
            'x-openaip-api-key': OPENAIP_CONFIG.apiKey,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const airports = this.transformAirports(data.items || []);
      
      // Mettre en cache
      this.cache.set(cacheKey, {
        data: airports,
        timestamp: Date.now()
      });
      
      console.log(`✅ ${airports.length} aérodromes récupérés via API directe`);
      return airports;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des aérodromes:', error);
      this.connectionError = error.message;
      
      // Retourner un tableau vide avec un message d'erreur
      return [];
    }
  }

  /**
   * Récupère les espaces aériens d'un pays
   */
  async getAirspaces(countryCode = 'FR') {
    const cacheKey = `airspaces-${countryCode}`;
    
    // Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log('📦 Utilisation du cache pour les espaces aériens');
      return cached.data;
    }
    
    try {
      // Essayer le proxy
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        console.log('🌐 Récupération des espaces aériens via proxy...');
        const response = await fetch(
          `${OPENAIP_CONFIG.proxyUrl}/airspaces?country=${countryCode}`,
          { signal: AbortSignal.timeout(10000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          const airspaces = this.transformAirspaces(data.items || []);
          
          this.cache.set(cacheKey, {
            data: airspaces,
            timestamp: Date.now()
          });
          
          console.log(`✅ ${airspaces.length} espaces aériens récupérés via proxy`);
          return airspaces;
        }
      }
      
      // API directe
      console.log('🌐 Récupération des espaces aériens via API directe...');
      const response = await fetch(
        `${OPENAIP_CONFIG.apiUrl}/airspaces?country=${countryCode}&page=1&limit=500`,
        {
          headers: {
            'x-openaip-api-key': OPENAIP_CONFIG.apiKey,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      const data = await response.json();
      const airspaces = this.transformAirspaces(data.items || []);
      
      this.cache.set(cacheKey, {
        data: airspaces,
        timestamp: Date.now()
      });
      
      console.log(`✅ ${airspaces.length} espaces aériens récupérés via API directe`);
      return airspaces;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des espaces aériens:', error);
      this.connectionError = error.message;
      return [];
    }
  }

  /**
   * Récupère les balises de navigation d'un pays
   */
  async getNavaids(countryCode = 'FR') {
    const cacheKey = `navaids-${countryCode}`;
    
    // Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      console.log('📦 Utilisation du cache pour les balises');
      return cached.data;
    }
    
    try {
      // Essayer le proxy
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        console.log('🌐 Récupération des balises via proxy...');
        const response = await fetch(
          `${OPENAIP_CONFIG.proxyUrl}/navaids?country=${countryCode}`,
          { signal: AbortSignal.timeout(10000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          const navaids = this.transformNavaids(data.items || []);
          
          this.cache.set(cacheKey, {
            data: navaids,
            timestamp: Date.now()
          });
          
          console.log(`✅ ${navaids.length} balises récupérées via proxy`);
          return navaids;
        }
      }
      
      // API directe
      console.log('🌐 Récupération des balises via API directe...');
      const response = await fetch(
        `${OPENAIP_CONFIG.apiUrl}/navaids?country=${countryCode}&page=1&limit=500`,
        {
          headers: {
            'x-openaip-api-key': OPENAIP_CONFIG.apiKey,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      const data = await response.json();
      const navaids = this.transformNavaids(data.items || []);
      
      this.cache.set(cacheKey, {
        data: navaids,
        timestamp: Date.now()
      });
      
      console.log(`✅ ${navaids.length} balises récupérées via API directe`);
      return navaids;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des balises:', error);
      this.connectionError = error.message;
      return [];
    }
  }

  /**
   * Récupère les points de report VFR
   */
  async getReportingPoints(airportId) {
    try {
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        const response = await fetch(
          `${OPENAIP_CONFIG.proxyUrl}/reporting-points?airport=${airportId}`,
          { signal: AbortSignal.timeout(5000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.items || [];
        }
      }
      
      // Pas de points de report dans l'API directe pour l'instant
      return [];
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des points de report:', error);
      return [];
    }
  }

  /**
   * Récupère tous les points de report d'un pays
   */
  async getAllReportingPoints(countryCode = 'FR') {
    // L'API OpenAIP ne fournit pas directement tous les points de report
    // Cette fonctionnalité nécessiterait de parcourir tous les aérodromes
    return {};
  }

  /**
   * Transforme les données d'aéroports de l'API
   */
  transformAirports(apiAirports) {
    return apiAirports.map(airport => ({
      id: airport._id || airport.id,
      icao: airport.icaoCode || airport.icao || null,
      icaoCode: airport.icaoCode || airport.icao || null,
      name: airport.name,
      city: airport.city || null,
      type: this.mapAirportType(airport.type),
      coordinates: {
        lat: airport.geometry?.coordinates?.[1] || 0,
        lon: airport.geometry?.coordinates?.[0] || 0
      },
      elevation: airport.elevation?.value || airport.elevation || null,
      country: airport.country || 'FR',
      runways: airport.runways || [],
      frequencies: airport.frequencies || []
    }));
  }

  /**
   * Transforme les données d'espaces aériens de l'API
   */
  transformAirspaces(apiAirspaces) {
    return apiAirspaces.map(airspace => ({
      id: airspace._id || airspace.id,
      _id: airspace._id || airspace.id,
      name: airspace.name,
      class: airspace.class || airspace.type,
      type: airspace.type,
      icaoCode: airspace.icaoCode,
      // Conserver les limites verticales complètes
      lowerLimit: airspace.lowerLimit || airspace.lower_limit || null,
      upperLimit: airspace.upperLimit || airspace.upper_limit || null,
      // Anciens champs pour compatibilité
      floor: airspace.lowerLimit?.value || airspace.floor || 'SFC',
      ceiling: airspace.upperLimit?.value || airspace.ceiling || 'UNL',
      geometry: airspace.geometry || null,
      country: airspace.country || 'FR',
      frequencies: airspace.frequencies || [],
      remarks: airspace.remarks || null
    }));
  }

  /**
   * Transforme les données de balises de l'API
   */
  transformNavaids(apiNavaids) {
    return apiNavaids.map(navaid => ({
      id: navaid._id || navaid.id,
      ident: navaid.ident || navaid.identifier,
      name: navaid.name,
      type: navaid.type,
      frequency: navaid.frequency?.value || navaid.frequency,
      channel: navaid.channel || null,
      coordinates: {
        lat: navaid.geometry?.coordinates?.[1] || 0,
        lon: navaid.geometry?.coordinates?.[0] || 0
      },
      elevation: navaid.elevation?.value || navaid.elevation || null,
      country: navaid.country || 'FR'
    }));
  }

  /**
   * Mappe les types d'aéroports
   */
  mapAirportType(apiType) {
    const typeMap = {
      'INTL_APT': 'AIRPORT',
      'APT': 'AIRPORT',
      'AF': 'AIRFIELD',
      'HELI_PORT': 'HELIPORT',
      'GLIDER': 'GLIDER',
      'UL': 'ULM',
      'WATER': 'SEAPLANE'
    };
    
    return typeMap[apiType] || apiType || 'AIRPORT';
  }

  /**
   * Calcule la distance entre deux coordonnées (en km)
   */
  calculateDistance(coord1, coord2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Compare deux coordonnées avec une tolérance
   */
  compareCoordinates(coord1, coord2, tolerance = 0.001) {
    const latDiff = Math.abs(coord1.lat - coord2.lat);
    const lonDiff = Math.abs(coord1.lon - coord2.lon);
    const distance = this.calculateDistance(coord1, coord2);
    
    return {
      isMatch: latDiff <= tolerance && lonDiff <= tolerance,
      latDiff,
      lonDiff,
      distance
    };
  }

  /**
   * Retourne l'URL des tiles de carte OpenAIP
   */
  getTileUrl() {
    return `${OPENAIP_CONFIG.tileUrl}/{z}/{x}/{y}.png?apiKey=${OPENAIP_CONFIG.apiKey}`;
  }

  /**
   * Retourne l'erreur de connexion actuelle
   */
  getConnectionError() {
    return this.connectionError;
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Cache vidé');
  }
}

// Créer une instance unique du service
const openAIPService = new OpenAIPService();

export { openAIPService };
export default openAIPService;