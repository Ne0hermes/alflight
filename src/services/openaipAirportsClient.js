// Client spécialisé pour les aérodromes OpenAIP avec cache et optimisations
const OPENAIP_BASE_URL = 'https://api.core.openaip.net/api';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class OpenAIPAirportsClient {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    // Le proxy gère la clé API, pas besoin ici
    this.useProxy = true;
  }

  // Génère une clé de cache unique basée sur les paramètres
  getCacheKey(bbox, filters = {}) {
    const bboxKey = bbox ? `${bbox.west.toFixed(3)},${bbox.south.toFixed(3)},${bbox.east.toFixed(3)},${bbox.north.toFixed(3)}` : 'all';
    const filterKey = JSON.stringify(filters, Object.keys(filters).sort());
    return `${bboxKey}|${filterKey}`;
  }

  // Normalise les données d'aérodrome depuis l'API
  normalizeAirport(airport) {
    return {
      id: airport._id || airport.id,
      icao: airport.icaoCode || airport.icao || null,
      iata: airport.iataCode || airport.iata || null,
      name: airport.name || 'Unknown',
      type: airport.type || 'unknown',
      country: airport.country || null,
      city: airport.city || null,
      elevation: airport.elevation?.value || airport.elevation || null,
      elevationUnit: airport.elevation?.unit || 'ft',
      position: airport.geometry?.coordinates || [0, 0], // [lon, lat]
      runways: this.normalizeRunways(airport.runways || []),
      frequencies: this.normalizeFrequencies(airport.frequencies || []),
      hasICAO: !!(airport.icaoCode || airport.icao),
      isIFRCapable: this.checkIFRCapability(airport),
      isVFRNightCapable: this.checkVFRNightCapability(airport),
      raw: airport // Garder les données brutes pour la popup
    };
  }

  normalizeRunways(runways) {
    return runways.map(rwy => ({
      length: rwy.length?.value || rwy.length || 0,
      lengthUnit: rwy.length?.unit || 'm',
      width: rwy.width?.value || rwy.width || 0,
      widthUnit: rwy.width?.unit || 'm',
      surface: rwy.surface || 'unknown',
      direction: rwy.direction || rwy.name || '',
      lighted: rwy.lighted || false,
      closed: rwy.closed || false
    }));
  }

  normalizeFrequencies(frequencies) {
    return frequencies.map(freq => ({
      type: freq.type || 'unknown',
      frequency: freq.frequency?.value || freq.frequency || 0,
      frequencyUnit: freq.frequency?.unit || 'MHz',
      name: freq.name || freq.type || ''
    }));
  }

  checkIFRCapability(airport) {
    // Logique simplifiée : présence d'ILS ou approche aux instruments
    const hasILS = airport.runways?.some(r => r.ils || r.approach?.includes('ILS'));
    const hasInstrumentApproach = airport.procedures?.some(p => p.type === 'INSTRUMENT');
    return hasILS || hasInstrumentApproach || airport.ifr === true;
  }

  checkVFRNightCapability(airport) {
    // Vérifie si l'aérodrome a des pistes éclairées
    const hasLightedRunway = airport.runways?.some(r => r.lighted);
    return hasLightedRunway || airport.vfrNight === true;
  }

  // Récupère les aérodromes par bounding box
  async getAirportsByBbox(bbox, filters = {}) {
    const cacheKey = this.getCacheKey(bbox, filters);
    
    // Vérifier le cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📦 Utilisation du cache pour les aérodromes');
      return cached.data;
    }

    // Éviter les requêtes dupliquées
    if (this.pendingRequests.has(cacheKey)) {
      console.log('⏳ Requête en cours, attente...');
      return this.pendingRequests.get(cacheKey);
    }

    // Créer la requête
    const requestPromise = this.fetchAirports(bbox, filters)
      .then(data => {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        this.pendingRequests.delete(cacheKey);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async fetchAirports(bbox, filters = {}) {
    // Utiliser le proxy local au lieu de l'API directe
    let proxyUrl = 'http://localhost:3001/api/openaip';
    try {
      // Essayer d'utiliser la variable d'environnement Vite si disponible
      if (import.meta?.env?.VITE_OPENAIP_PROXY_URL) {
        proxyUrl = import.meta.env.VITE_OPENAIP_PROXY_URL;
      }
    } catch (e) {
      // Utiliser l'URL par défaut si import.meta n'est pas disponible
    }
    
    const url = new URL(`${proxyUrl}/airports`);
    
    // Ajouter les paramètres de bbox si disponibles
    if (bbox) {
      // Format: minLon,minLat,maxLon,maxLat
      url.searchParams.set('bbox', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
    }

    // Ajouter le pays par défaut (France)
    url.searchParams.set('country', 'FR');
    
    // Limiter le nombre de résultats pour les performances
    url.searchParams.set('limit', '500');

    // Ajouter les filtres si l'API les supporte
    if (filters.search) {
      url.searchParams.set('q', filters.search);
    }

    console.log('🛫 Chargement des aérodromes via proxy:', url.toString());

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur OpenAIP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Normaliser les données
      const airports = Array.isArray(data) ? data : (data.items || data.airports || []);
      const normalized = airports.map(a => this.normalizeAirport(a));
      
      console.log(`✅ ${normalized.length} aérodromes chargés`);
      return normalized;
    } catch (error) {
      console.error('❌ Erreur lors du chargement des aérodromes:', error);
      throw error;
    }
  }

  // Applique les filtres côté client
  filterAirports(airports, filters) {
    return airports.filter(airport => {
      // Filtre ICAO
      if (!filters.showWithoutICAO && !airport.hasICAO) {
        return false;
      }

      // Filtre type
      if (filters.types && filters.types.length > 0) {
        if (!filters.types.includes(airport.type)) {
          return false;
        }
      }

      // Filtre longueur de piste minimale
      if (filters.minRunwayLength) {
        const maxLength = Math.max(...airport.runways.map(r => r.length), 0);
        if (maxLength < filters.minRunwayLength) {
          return false;
        }
      }

      // Filtre surface de piste
      if (filters.runwaySurface) {
        const hasSurface = airport.runways.some(r => 
          r.surface.toLowerCase().includes(filters.runwaySurface.toLowerCase())
        );
        if (!hasSurface) {
          return false;
        }
      }

      // Filtre IFR
      if (filters.ifrOnly && !airport.isIFRCapable) {
        return false;
      }

      // Filtre VFR nuit
      if (filters.vfrNightOnly && !airport.isVFRNightCapable) {
        return false;
      }

      // Filtre recherche texte
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchName = airport.name.toLowerCase().includes(searchLower);
        const matchICAO = airport.icao?.toLowerCase().includes(searchLower);
        const matchIATA = airport.iata?.toLowerCase().includes(searchLower);
        const matchCity = airport.city?.toLowerCase().includes(searchLower);
        
        if (!matchName && !matchICAO && !matchIATA && !matchCity) {
          return false;
        }
      }

      return true;
    });
  }

  // Vide le cache
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Cache des aérodromes vidé');
  }
}

// Singleton
const airportsClient = new OpenAIPAirportsClient();

export default airportsClient;