// src/core/data/providers/SIACompleteProvider.js
/**
 * Provider complet de données SIA avec chargement AIXM
 * Charge toutes les données disponibles depuis les fichiers XML du SIA
 */

import { AeroDataProvider } from '../AeroDataProvider';
import { AIXMParser } from '../parsers/AIXMParser';

// Cache singleton pour éviter de recharger les données
let cachedData = null;
let loadingPromise = null;

export class SIACompleteProvider extends AeroDataProvider {
  constructor() {
    super();
    this.data = null;
    this.parser = new AIXMParser();
    this.isLoading = false;
  }

  /**
   * Charge les données AIXM (appelé une seule fois)
   */
  async loadData() {
    // Si les données sont déjà en cache, les retourner
    if (cachedData) {
      this.data = cachedData;
      return this.data;
    }

    // Si un chargement est déjà en cours, attendre qu'il se termine
    if (loadingPromise) {
      await loadingPromise;
      this.data = cachedData;
      return this.data;
    }

    // Sinon, commencer le chargement
    
    this.isLoading = true;

    loadingPromise = (async () => {
      try {
        // Charger le fichier AIXM depuis la configuration
        const { CURRENT_AIXM_FILE } = await import('../../../data/aixm.config.js');
        const response = await fetch(`/src/data/${CURRENT_AIXM_FILE}`);
        
        if (!response.ok) {
          throw new Error(`Erreur chargement AIXM: ${response.status}`);
        }

        const xmlText = await response.text();

        // Parser les données
        const parsedData = await this.parser.parseAIXM(xmlText);
        
        // Enrichir les données avec des informations supplémentaires
        this.enrichData(parsedData);

        // Mettre en cache
        cachedData = parsedData;
        this.data = parsedData;

        

        return parsedData;
      } catch (error) {
        console.error('❌ Erreur chargement données SIA:', error);
        // En cas d'erreur, retourner une structure vide
        cachedData = {
          airports: [],
          airspaces: [],
          navaids: [],
          runways: [],
          frequencies: [],
          obstacles: [],
          routes: [],
          waypoints: []
        };
        this.data = cachedData;
        throw error; // Propager l'erreur pour que l'utilisateur sache qu'il y a un problème
      } finally {
        this.isLoading = false;
        loadingPromise = null;
      }
    })();

    await loadingPromise;
    return this.data;
  }

  /**
   * Enrichit les données avec des informations supplémentaires
   */
  enrichData(data) {
    // Associer les pistes aux aéroports
    data.airports.forEach(airport => {
      airport.runways = data.runways.filter(rwy => rwy.airportId === airport.icao);
      airport.frequencies = data.frequencies.filter(freq => freq.airportId === airport.icao);

      // 🔧 FIX: Normaliser le format des pistes pour compatibilité RunwaySuggestionEnhanced
      airport.runways.forEach(rwy => {
        // Ajouter identifier (alias de designation)
        if (rwy.designation && !rwy.identifier) {
          rwy.identifier = rwy.designation;
        }

        // Extraire le_ident et he_ident depuis designation (ex: "05/23" → "05", "23")
        if (rwy.designation && rwy.designation.includes('/')) {
          const [le, he] = rwy.designation.split('/');
          rwy.le_ident = le.trim();
          rwy.he_ident = he.trim();

          // Calculer les QFU (caps magnétiques)
          const leQfu = parseInt(le.replace(/[LRC]/, '')) * 10;
          const heQfu = (leQfu + 180) % 360;

          rwy.le_heading = leQfu;
          rwy.he_heading = heQfu;
          rwy.qfu = leQfu; // QFU du premier seuil
        }

        // Normaliser dimensions (si pas déjà fait)
        if (!rwy.dimensions && (rwy.length || rwy.width)) {
          rwy.dimensions = {
            length: rwy.length || 0,
            width: rwy.width || 0
          };
        }
      });

      // Ajouter le type d'aérodrome basé sur les pistes
      if (airport.runways.length > 0) {
        const maxLength = Math.max(...airport.runways.map(r => r.dimensions?.length || r.length || 0));
        if (maxLength > 2000) {
          airport.category = 'large';
        } else if (maxLength > 1000) {
          airport.category = 'medium';
        } else {
          airport.category = 'small';
        }
      }
    });

    // Classifier les espaces aériens
    data.airspaces.forEach(airspace => {
      // Déterminer la priorité pour l'affichage
      const priorities = {
        'CTR': 1,
        'TMA': 2,
        'D': 3,
        'P': 3,
        'R': 3,
        'CTA': 4,
        'AWY': 5,
        'FIR': 10
      };
      airspace.priority = priorities[airspace.type] || 99;
    });

    // Enrichir les navaids
    data.navaids.forEach(navaid => {
      // Déterminer si c'est un VOR-DME
      if (navaid.type === 'VOR') {
        const dme = data.navaids.find(n =>
          n.type === 'DME' &&
          n.identifier === navaid.identifier &&
          Math.abs(n.coordinates.lat - navaid.coordinates.lat) < 0.001 &&
          Math.abs(n.coordinates.lon - navaid.coordinates.lon) < 0.001
        );
        if (dme) {
          navaid.type = 'VOR-DME';
          navaid.dmeChannel = dme.channel;
        }
      }
    });
  }


  /**
   * Assure que les données sont chargées avant de répondre aux requêtes
   */
  async ensureDataLoaded() {
    if (!this.data) {
      await this.loadData();
    }
  }

  /**
   * Récupère les espaces aériens
   */
  async getAirspaces(params = {}) {
    await this.ensureDataLoaded();
    
    let filtered = [...this.data.airspaces];
    
    if (params.types && params.types.length > 0) {
      filtered = filtered.filter(airspace => params.types.includes(airspace.type));
    }
    
    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(airspace => {
        if (!airspace.geometry?.coordinates?.[0]) return false;

        // Vérifier si au moins un point est dans les limites
        return airspace.geometry.coordinates[0].some(coord =>
          coord[1] >= minLat && coord[1] <= maxLat &&
          coord[0] >= minLon && coord[0] <= maxLon
        );
      });
    }
    
    // Trier par priorité
    filtered.sort((a, b) => (a.priority || 99) - (b.priority || 99));
    
    return filtered;
  }

  /**
   * Récupère les aérodromes
   */
  async getAirfields(params = {}) {
    await this.ensureDataLoaded();
    
    let filtered = [...this.data.airports];
    
    if (params.icao) {
      filtered = filtered.filter(af => af.icao === params.icao);
    }
    
    if (params.search) {
      const search = params.search.toLowerCase();
      filtered = filtered.filter(af =>
        af.icao?.toLowerCase().includes(search) ||
        af.name?.toLowerCase().includes(search)
      );
    }
    
    if (params.nearPoint) {
      const { lat, lon, radius } = params.nearPoint;
      filtered = filtered.filter(af => {
        const distance = this.calculateDistance(lat, lon, af.coordinates.lat, af.coordinates.lon);
        return distance <= radius;
      });
    }
    
    if (params.minRunwayLength) {
      filtered = filtered.filter(af => {
        if (!af.runways || af.runways.length === 0) return false;
        const maxLength = Math.max(...af.runways.map(r => r.dimensions?.length || 0));
        return maxLength >= params.minRunwayLength;
      });
    }
    
    return filtered;
  }

  /**
   * Récupère les balises de navigation
   */
  async getNavaids(params = {}) {
    await this.ensureDataLoaded();
    
    let filtered = [...this.data.navaids];
    
    if (params.types && params.types.length > 0) {
      filtered = filtered.filter(navaid =>
        params.types.some(type => navaid.type.includes(type))
      );
    }
    
    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(navaid =>
        navaid.coordinates.lat >= minLat && navaid.coordinates.lat <= maxLat &&
        navaid.coordinates.lon >= minLon && navaid.coordinates.lon <= maxLon
      );
    }

    return filtered;
  }

  /**
   * Récupère les waypoints
   */
  async getWaypoints(params = {}) {
    await this.ensureDataLoaded();
    
    let filtered = [...this.data.waypoints];
    
    if (params.id) {
      filtered = filtered.filter(wp => wp.id === params.id);
    }
    
    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(wp =>
        wp.coordinates.lat >= minLat && wp.coordinates.lat <= maxLat &&
        wp.coordinates.lon >= minLon && wp.coordinates.lon <= maxLon
      );
    }
    
    return filtered;
  }

  /**
   * Récupère les obstacles
   */
  async getObstacles(params = {}) {
    await this.ensureDataLoaded();
    
    let filtered = [...this.data.obstacles];
    
    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(obs =>
        obs.coordinates.lat >= minLat && obs.coordinates.lat <= maxLat &&
        obs.coordinates.lon >= minLon && obs.coordinates.lon <= maxLon
      );
    }

    if (params.minHeight) {
      filtered = filtered.filter(obs =>
        (obs.height || 0) >= params.minHeight
      );
    }

    return filtered;
  }

  /**
   * Récupère les routes ATS
   */
  async getRoutes(params = {}) {
    await this.ensureDataLoaded();
    
    let filtered = [...this.data.routes];
    
    if (params.id) {
      filtered = filtered.filter(route => route.id === params.id);
    }
    
    if (params.type) {
      filtered = filtered.filter(route => route.type === params.type);
    }
    
    return filtered;
  }

  /**
   * Récupère les points de report VFR pour un aérodrome
   */
  async getReportingPoints(icao) {
    await this.ensureDataLoaded();
    
    // Chercher les waypoints proches de l'aérodrome
    const airport = this.data.airports.find(a => a.icao === icao);
    if (!airport) return [];
    
    const nearbyWaypoints = this.data.waypoints.filter(wp => {
      const distance = this.calculateDistance(
        airport.coordinates.lat,
        airport.coordinates.lon,
        wp.coordinates.lat,
        wp.coordinates.lon
      );
      return distance <= 15; // 15 km de rayon
    });
    
    return nearbyWaypoints.map(wp => ({
      code: wp.id,
      name: wp.name,
      type: wp.type === 'VFR-RP' ? 'mandatory' : 'optional',
      mandatory: wp.type === 'VFR-RP',
      coordinates: wp.coordinates
    }));
  }

  /**
   * Calcule la distance entre deux points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  isAvailable() {
    return true;
  }

  getProviderName() {
    return 'SIA France Complet (AIXM)';
  }

  getStatus() {
    if (this.isLoading) {
      return {
        available: true,
        name: this.getProviderName(),
        message: 'Chargement des données AIXM en cours...'
      };
    }

    if (this.data) {
      return {
        available: true,
        name: this.getProviderName(),
        message: `Données AIXM chargées - ${this.data.airports.length} aérodromes, ${this.data.airspaces.length} espaces, ${this.data.navaids.length} navaids, ${this.data.runways.length} pistes`
      };
    }

    return {
      available: true,
      name: this.getProviderName(),
      message: 'Prêt à charger les données AIXM'
    };
  }
}