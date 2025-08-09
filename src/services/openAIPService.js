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
    this.errorCache = new Map(); // Cache pour les erreurs
    this.retryCount = new Map(); // Compteur de tentatives
    this.maxRetries = 3;
    this.baseDelay = 1000; // Délai de base pour le backoff (1 seconde)
    
    // Logs réduits au démarrage
  }
  
  /**
   * Vérifie si une erreur est en cache et encore valide
   */
  hasRecentError(key) {
    const error = this.errorCache.get(key);
    if (error && Date.now() - error.timestamp < 60000) { // Cache d'erreur de 1 minute
      return true;
    }
    return false;
  }
  
  /**
   * Enregistre une erreur dans le cache
   */
  cacheError(key, error) {
    this.errorCache.set(key, {
      error: error,
      timestamp: Date.now()
    });
  }
  
  /**
   * Calcule le délai de retry avec backoff exponentiel
   */
  getRetryDelay(retryNumber) {
    return Math.min(this.baseDelay * Math.pow(2, retryNumber), 30000); // Max 30 secondes
  }

  /**
   * Teste la connexion à l'API
   */
  async testConnection() {
    const cacheKey = 'connection-test';
    
    // Vérifier le cache d'erreur
    if (this.hasRecentError(cacheKey)) {
      return { success: false, error: 'Connexion échouée récemment (cache)' };
    }
    
    try {
      // Essayer d'abord le proxy
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        const response = await fetch(`${OPENAIP_CONFIG.proxyUrl}/test`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          this.connectionError = null;
          this.errorCache.delete(cacheKey);
          return { success: true, mode: 'proxy' };
        }
      }
      
      // Essayer l'API directe
      const response = await fetch(`${OPENAIP_CONFIG.apiUrl}/airports?page=1&limit=1`, {
        headers: {
          'x-openaip-api-key': OPENAIP_CONFIG.apiKey,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        this.connectionError = null;
        this.errorCache.delete(cacheKey);
        return { success: true, mode: 'direct' };
      }
      
      throw new Error(`Erreur HTTP: ${response.status}`);
      
    } catch (error) {
      this.connectionError = error.message;
      this.cacheError(cacheKey, error.message);
      // Ne logger l'erreur qu'une fois
      if (!this.retryCount.has(cacheKey)) {
        console.error('❌ Erreur de connexion OpenAIP:', error.message);
        this.retryCount.set(cacheKey, 1);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Récupère tous les aérodromes d'un pays
   */
  async getAirports(countryCode = 'FR') {
    const cacheKey = `airports-${countryCode}`;
    const errorKey = `error-${cacheKey}`;
    
    // Vérifier le cache d'erreur
    if (this.hasRecentError(errorKey)) {
      return [];
    }
    
    // Vérifier le cache (5 minutes)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
    
    try {
      // Essayer le proxy d'abord
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        // Récupération via proxy
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
          
          // Succès proxy
          return airports;
        }
      }
      
      // Essayer l'API directe
      // Récupération via API directe
      const response = await fetch(
        `${OPENAIP_CONFIG.apiUrl}/airports?country=${countryCode}&page=1&limit=1500`,
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
      
      // Succès API directe
      return airports;
      
    } catch (error) {
      const errorKey = `error-${cacheKey}`;
      this.cacheError(errorKey, error.message);
      this.connectionError = error.message;
      
      // Ne logger qu'une fois par minute
      if (!this.retryCount.has(errorKey) || Date.now() - this.retryCount.get(errorKey) > 60000) {
        console.error('❌ Erreur lors de la récupération des aérodromes:', error.message);
        this.retryCount.set(errorKey, Date.now());
      }
      
      // Retourner un tableau vide avec un message d'erreur
      return [];
    }
  }

  /**
   * Récupère les espaces aériens d'un pays
   */
  async getAirspaces(countryCode = 'FR') {
    const cacheKey = `airspaces-${countryCode}`;
    const errorKey = `error-${cacheKey}`;
    
    // Vérifier le cache d'erreur
    if (this.hasRecentError(errorKey)) {
      return [];
    }
    
    // Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
    
    try {
      // Essayer le proxy
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        // Récupération via proxy
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
          
          // Succès proxy
          return airspaces;
        }
      }
      
      // API directe
      // Récupération via API directe
      const response = await fetch(
        `${OPENAIP_CONFIG.apiUrl}/airspaces?country=${countryCode}&type=0,1,2,3,4,5,6,7,8,9,10,11,12,13,14&page=1&limit=500`,
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
      
      // Debug supprimé pour réduire le spam
      
      const airspaces = this.transformAirspaces(data.items || []);
      
      this.cache.set(cacheKey, {
        data: airspaces,
        timestamp: Date.now()
      });
      
      // Succès API directe
      return airspaces;
      
    } catch (error) {
      const errorKey = `error-${cacheKey}`;
      this.cacheError(errorKey, error.message);
      this.connectionError = error.message;
      
      // Ne logger qu'une fois par minute
      if (!this.retryCount.has(errorKey) || Date.now() - this.retryCount.get(errorKey) > 60000) {
        console.error('❌ Erreur lors de la récupération des espaces aériens:', error.message);
        this.retryCount.set(errorKey, Date.now());
      }
      return [];
    }
  }

  /**
   * Récupère les balises de navigation d'un pays
   */
  async getNavaids(countryCode = 'FR') {
    const cacheKey = `navaids-${countryCode}`;
    const errorKey = `error-${cacheKey}`;
    
    // Vérifier le cache d'erreur
    if (this.hasRecentError(errorKey)) {
      return [];
    }
    
    // Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
    
    try {
      // Essayer le proxy
      if (OPENAIP_CONFIG.useProxy && OPENAIP_CONFIG.proxyUrl) {
        // Récupération via proxy
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
          
          // Succès proxy
          return navaids;
        }
      }
      
      // API directe
      // Récupération via API directe
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
      
      // Succès API directe
      return navaids;
      
    } catch (error) {
      const errorKey = `error-${cacheKey}`;
      this.cacheError(errorKey, error.message);
      this.connectionError = error.message;
      
      // Ne logger qu'une fois par minute
      if (!this.retryCount.has(errorKey) || Date.now() - this.retryCount.get(errorKey) > 60000) {
        console.error('❌ Erreur lors de la récupération des balises:', error.message);
        this.retryCount.set(errorKey, Date.now());
      }
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
    console.log('📊 Transformation des espaces aériens. Échantillon:', apiAirspaces.slice(0, 5).map(a => ({name: a.name, type: a.type, class: a.class})));
    
    // Mapping des types numériques OpenAIP vers nos catégories
    // Basé sur la documentation OpenAIP
    const typeMapping = {
      0: 'CTR',    // CTR - Control Zone
      1: 'TMA',    // TMA - Terminal Control Area  
      2: 'CLASS_A',  // Class A
      3: 'CLASS_B',  // Class B
      4: 'CLASS_C',  // Class C
      5: 'CLASS_D',  // Class D (espace contrôlé)
      6: 'CLASS_E',  // Class E
      7: 'CLASS_F',  // Class F
      8: 'CLASS_G',  // Class G (espace non contrôlé)
      9: 'ATZ',    // ATZ - Aerodrome Traffic Zone
      10: 'P',     // Prohibited (Zone interdite)
      11: 'R',     // Restricted (Zone réglementée)
      12: 'D',     // Danger Zone (Zone dangereuse)
      13: 'TSA',   // Temporary Segregated Area
      14: 'TRA',   // Temporary Reserved Area
      15: 'AWY',   // Airway (voie aérienne)
      16: 'RMZ',   // Radio Mandatory Zone
      17: 'TMZ',   // Transponder Mandatory Zone
      18: 'FIR',   // Flight Information Region
      19: 'UIR',   // Upper Information Region
      20: 'ADIZ',  // Air Defense Identification Zone
      21: 'PART',  // Part of airspace
      22: 'SECTOR', // Sector
      29: 'REP',   // Reporting Point
      33: 'SIV'    // Service d'Information de Vol
    };
    
    return apiAirspaces.map(airspace => {
      // Déterminer le type normalisé
      let normalizedType = airspace.type;
      
      // Log pour débugger les FIR
      if (airspace.name && airspace.name.includes('FIR')) {
        console.log(`🔍 FIR détecté: ${airspace.name}, type original: ${airspace.type}, typeof: ${typeof airspace.type}`);
      }
      
      // Si c'est un nombre ou une chaîne numérique, utiliser le mapping
      if (typeof airspace.type === 'number' || (typeof airspace.type === 'string' && !isNaN(parseInt(airspace.type)))) {
        const typeNum = parseInt(airspace.type);
        normalizedType = typeMapping[typeNum];
        
        // Si on n'a pas de mapping, garder le type original
        if (!normalizedType) {
          console.warn(`⚠️ Type d'espace inconnu: ${airspace.type} pour ${airspace.name}`);
          normalizedType = 'OTHER';
        }
      } else if (typeof airspace.type === 'string') {
        // Si c'est déjà une chaîne (P, D, R, etc.), la garder
        normalizedType = airspace.type.toUpperCase();
      }
      
      // Si le nom contient FIR, forcer le type FIR
      if (airspace.name && airspace.name.includes('FIR')) {
        normalizedType = 'FIR';
        console.log(`✅ FIR ${airspace.name} sera filtré (type normalisé: ${normalizedType})`);
      }
      
      // Si c'est un type AWY, FIR, UIR, PART, SECTOR, REP ou SIV, on le filtre
      if (['AWY', 'FIR', 'UIR', 'PART', 'SECTOR', 'REP', 'SIV', '15', '18', '19', '21', '22', '29', '33'].includes(normalizedType)) {
        return null; // Sera filtré après
      }
      
      // Log si c'est un espace qui pourrait être mal classé
      if (airspace.name && (airspace.name.includes('FIR') || airspace.name.includes('UIR')) && normalizedType !== 'FIR' && normalizedType !== 'UIR') {
        console.error(`❌ ${airspace.name} n'est pas filtré! Type: ${normalizedType}, Type original: ${airspace.type}`);
      }
      
      return {
        id: airspace._id || airspace.id,
        _id: airspace._id || airspace.id,
        name: airspace.name,
        class: airspace.class || normalizedType,
        type: normalizedType,
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
      };
    }).filter(airspace => airspace !== null); // Filtrer les nulls (AWY, etc.)
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
   * @param {string} layerType - Type de couche: 'vfr' (par défaut), 'ifr-low', 'ifr-high', 'visual-reporting-points'
   */
  getTileUrl(layerType = 'vfr') {
    // Mapper les types de couches aux endpoints OpenAIP
    const layerMap = {
      'vfr': '',  // Couche par défaut VFR
      'ifr-low': '/ifr-low',
      'ifr-high': '/ifr-high', 
      'vrp': '/visual-reporting-points',
      'obstacles': '/obstacles'
    };
    
    const layer = layerMap[layerType] || '';
    return `${OPENAIP_CONFIG.tileUrl}${layer}/{z}/{x}/{y}.png?apiKey=${OPENAIP_CONFIG.apiKey}`;
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