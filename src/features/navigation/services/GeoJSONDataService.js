/**
 * Service pour charger et gérer les données GeoJSON générées par l'ETL SIA
 */

import { vfrPointsExtractor } from '../../../services/vfrPointsExtractor';

class GeoJSONDataService {
  constructor() {
    this.cache = new Map();
    this.basePath = '/data/geojson/';
  }

  /**
   * Charge un fichier GeoJSON
   * @param {string} layer - Nom de la couche (ex: 'aerodromes', 'airspaces')
   * @returns {Promise<Object>} FeatureCollection GeoJSON
   */
  async loadLayer(layer) {
    // Vérifier le cache
    if (this.cache.has(layer)) {
      return this.cache.get(layer);
    }

    try {
      const response = await fetch(`${this.basePath}${layer}.geojson`);
      if (!response.ok) {
        throw new Error(`Erreur chargement ${layer}: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Mettre en cache
      this.cache.set(layer, data);
      
      
      return data;
      
    } catch (error) {
      console.error(`❌ Erreur chargement couche ${layer}:`, error);
      return { type: 'FeatureCollection', features: [] };
    }
  }

  /**
   * Charge tous les aérodromes
   */
  async getAerodromes() {
    const data = await this.loadLayer('aerodromes');
    return data.features || [];
  }

  /**
   * Charge tous les espaces aériens
   */
  async getAirspaces() {
    const data = await this.loadLayer('airspaces');
    return data.features || [];
  }

  /**
   * Charge tous les navaids
   */
  async getNavaids() {
    const data = await this.loadLayer('navaids');
    return data.features || [];
  }

  /**
   * Charge tous les points désignés (VFR/IFR)
   */
  async getDesignatedPoints() {
    const data = await this.loadLayer('designated_points');
    return data.features || [];
  }

  /**
   * Charge toutes les pistes
   */
  async getRunways() {
    const data = await this.loadLayer('runways');
    return data.features || [];
  }

  /**
   * Charge tous les obstacles
   */
  async getObstacles() {
    const data = await this.loadLayer('obstacles');
    return data.features || [];
  }

  /**
   * Recherche d'aérodromes par texte
   * @param {string} query - Recherche (code ICAO, nom, ville)
   * @returns {Promise<Array>} Aérodromes correspondants
   */
  async searchAerodromes(query) {
    const aerodromes = await this.getAerodromes();
    
    if (!query) return aerodromes;
    
    const searchTerm = query.toLowerCase();
    
    return aerodromes.filter(feature => {
      const props = feature.properties || {};
      return (
        props.icao?.toLowerCase().includes(searchTerm) ||
        props.name?.toLowerCase().includes(searchTerm) ||
        props.city?.toLowerCase().includes(searchTerm)
      );
    });
  }

  /**
   * Obtient les points VFR proches d'une position
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} radiusKm - Rayon de recherche en km
   * @returns {Promise<Array>} Points VFR proches
   */
  async getNearbyVFRPoints(lat, lon, radiusKm = 50) {
    const points = await this.getDesignatedPoints();
    
    // Filtrer les points VFR
    const vfrPoints = points.filter(feature => {
      const type = feature.properties?.type;
      return type && type.startsWith('VFR');
    });
    
    // Calculer les distances et trier
    const pointsWithDistance = vfrPoints.map(feature => {
      const [pLon, pLat] = feature.geometry.coordinates;
      const distance = this.calculateDistance(lat, lon, pLat, pLon);
      return {
        ...feature,
        distance
      };
    });
    
    // Filtrer par rayon et trier par distance
    return pointsWithDistance
      .filter(p => p.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Obtient tous les points VFR depuis les aérodromes
   * @returns {Promise<Array>} Tous les points VFR au format GeoJSON
   */
  async getAllVFRPoints() {
    try {
      // Utiliser le service d'extraction des points VFR depuis AIXM
      await vfrPointsExtractor.loadVFRPoints();
      const vfrFeatures = vfrPointsExtractor.toGeoJSON();
      
      if (vfrFeatures.length > 0) {
        
        return vfrFeatures;
      }
      
      // Fallback: essayer depuis les points désignés
      
      const designatedPoints = await this.getDesignatedPoints();
      
      // Filtrer les points qui contiennent VFR, VRP, ou des patterns typiques
      const fallbackFeatures = designatedPoints.filter(point => {
        const props = point.properties || {};
        const name = (props.name || '').toUpperCase();
        const type = (props.type || '').toUpperCase();
        const desc = (props.description || '').toUpperCase();
        const id = (props.identification || '').toUpperCase();
        
        return (
          type.includes('VFR') || 
          type.includes('VRP') ||
          type.includes('OTHER') || // Points "OTHER" peuvent être des VFR
          name.includes('VRP') ||
          name.includes('VFR') ||
          desc.includes('VFR') ||
          desc.includes('VISUAL') ||
          desc.includes('REPORT') ||
          id.match(/^LF[A-Z]{2}-/) || // Points avec code aérodrome
          // Patterns typiques des points VFR
          /^[NSEW]\d?$/.test(name) || // N, S, E, W, NE, SE, etc.
          /^(NORD|SUD|EST|OUEST|CENTRE)/.test(name) || // Points cardinaux en français
          /^(NOVEMBER|SIERRA|ECHO|WHISKEY)/.test(name) // Alphabet phonétique
        )
      }).map(point => ({
        ...point,
        properties: {
          ...point.properties,
          type: 'VFR',
          vfrType: 'VRP'
        }
      }));
      return fallbackFeatures;
      
    } catch (error) {
      console.error('❌ Erreur chargement points VFR:', error);
      return [];
    }
  }

  /**
   * Trouve les espaces aériens intersectés par une route
   * @param {Array<Array<number>>} route - Coordonnées [[lon, lat], ...]
   * @param {number} altitude - Altitude en pieds
   * @returns {Promise<Array>} Espaces intersectés
   */
  async getIntersectedAirspaces(route, altitude) {
    const airspaces = await this.getAirspaces();
    const intersected = [];
    
    for (const airspace of airspaces) {
      const props = airspace.properties || {};
      
      // Vérifier l'altitude
      const floor = props.floor || 0;
      const ceiling = props.ceiling || 99999;
      
      if (altitude < floor || altitude > ceiling) {
        continue;
      }
      
      // Vérification simplifiée de l'intersection géométrique
      // (Pour une vraie intersection, utiliser turf.js)
      if (this.routeIntersectsPolygon(route, airspace.geometry)) {
        intersected.push({
          ...airspace,
          penetration: {
            floor,
            ceiling,
            altitude,
            withinLimits: true
          }
        });
      }
    }
    
    return intersected;
  }

  /**
   * Calcule la distance entre deux points (formule de Haversine)
   * @private
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convertit des degrés en radians
   * @private
   */
  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Vérifie si une route intersecte un polygone (simplifié)
   * @private
   */
  routeIntersectsPolygon(route, geometry) {
    // Implémentation simplifiée
    // Pour une vraie intersection, utiliser une bibliothèque de géométrie
    if (!geometry || !geometry.coordinates) return false;
    
    // Vérifier si au moins un point de la route est dans le polygone
    for (const point of route) {
      if (this.pointInPolygon(point, geometry)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Vérifie si un point est dans un polygone (algorithme ray-casting)
   * @private
   */
  pointInPolygon(point, geometry) {
    const [x, y] = point;
    let inside = false;
    
    const coords = geometry.type === 'Polygon' 
      ? geometry.coordinates[0]
      : geometry.coordinates[0][0]; // MultiPolygon
    
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0], yi = coords[i][1];
      const xj = coords[j][0], yj = coords[j][1];
      
      const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  /**
   * Efface le cache
   */
  clearCache() {
    this.cache.clear();
  }
 }

// Export singleton
export const geoJSONDataService = new GeoJSONDataService();