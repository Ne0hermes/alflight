// src/core/data/providers/GeoJSONProvider.js
/**
 * Provider de données aéronautiques basé sur les fichiers GeoJSON optimisés
 * Utilise les fichiers pré-traités dans /public/data/geojson/
 * Beaucoup plus rapide et léger que le parser AIXM XML (42 MB → 10 MB GeoJSON)
 */

import { AeroDataProvider } from '../AeroDataProvider';
import { geoJSONDataService } from '../../../features/navigation/services/GeoJSONDataService';

export class GeoJSONProvider extends AeroDataProvider {
  constructor() {
    super();
    this.data = null;
    this.isLoading = false;
  }

  /**
   * Charge les données GeoJSON (appelé une seule fois)
   */
  async loadData() {
    if (this.data) {
      return this.data;
    }

    this.isLoading = true;

    try {
      console.log('📦 Chargement données GeoJSON depuis /data/geojson/...');

      // Charger tous les fichiers GeoJSON en parallèle
      const [aerodromes, airspaces, navaids, runways, designatedPoints, obstacles] = await Promise.all([
        geoJSONDataService.getAerodromes(),
        geoJSONDataService.getAirspaces(),
        geoJSONDataService.getNavaids(),
        geoJSONDataService.getRunways(),
        geoJSONDataService.getDesignatedPoints(),
        geoJSONDataService.getObstacles()
      ]);

      // Convertir au format attendu par l'application
      this.data = {
        airports: this.convertAerodromes(aerodromes),
        airspaces: this.convertAirspaces(airspaces),
        navaids: this.convertNavaids(navaids),
        runways: this.convertRunways(runways),
        waypoints: this.convertDesignatedPoints(designatedPoints),
        obstacles: this.convertObstacles(obstacles),
        frequencies: [],
        routes: []
      };

      // Enrichir les données (associer pistes aux aérodromes, etc.)
      this.enrichData(this.data);

      console.log(`✅ Données GeoJSON chargées: ${this.data.airports.length} aérodromes, ${this.data.airspaces.length} espaces, ${this.data.navaids.length} navaids`);

      return this.data;
    } catch (error) {
      console.error('❌ Erreur chargement données GeoJSON:', error);
      // Retourner structure vide en cas d'erreur
      this.data = {
        airports: [],
        airspaces: [],
        navaids: [],
        runways: [],
        waypoints: [],
        obstacles: [],
        frequencies: [],
        routes: []
      };
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Convertit les aérodromes GeoJSON au format application
   */
  convertAerodromes(features) {
    return features.map(feature => ({
      icao: feature.properties.icao || feature.properties.id,
      name: feature.properties.name,
      city: feature.properties.city,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      },
      elevation: feature.properties.elevation_ft || feature.properties.elevation,
      type: feature.properties.type || 'AD',
      runways: [], // Sera rempli par enrichData
      frequencies: []
    }));
  }

  /**
   * Convertit les espaces aériens GeoJSON
   */
  convertAirspaces(features) {
    return features.map(feature => ({
      id: feature.properties.id || feature.properties.name,
      name: feature.properties.name,
      type: feature.properties.type,
      class: feature.properties.class,
      floor: feature.properties.floor || 0,
      ceiling: feature.properties.ceiling || 99999,
      geometry: feature.geometry
    }));
  }

  /**
   * Convertit les navaids GeoJSON
   */
  convertNavaids(features) {
    return features.map(feature => ({
      identifier: feature.properties.code || feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.type,
      frequency: feature.properties.frequency,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      }
    }));
  }

  /**
   * Convertit les pistes GeoJSON
   */
  convertRunways(features) {
    return features.map(feature => ({
      // Correspondance avec le format du fichier GeoJSON: aerodrome_icao est la propriété principale
      airportId: feature.properties.aerodrome_icao || feature.properties.airport_icao || feature.properties.icao,
      designation: feature.properties.designation,
      identifier: feature.properties.designation,
      length: feature.properties.length_m || feature.properties.length,
      width: feature.properties.width_m || feature.properties.width,
      dimensions: {
        length: feature.properties.length_m || feature.properties.length || 0,
        width: feature.properties.width_m || feature.properties.width || 0
      },
      surface: feature.properties.surface
    }));
  }

  /**
   * Convertit les points désignés (waypoints VFR/IFR)
   */
  convertDesignatedPoints(features) {
    return features.map(feature => ({
      id: feature.properties.code || feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.type,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      }
    }));
  }

  /**
   * Convertit les obstacles GeoJSON
   */
  convertObstacles(features) {
    return features.map(feature => ({
      id: feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.type,
      height: feature.properties.height_ft || feature.properties.height,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      }
    }));
  }

  /**
   * Enrichit les données (associer pistes aux aérodromes, etc.)
   */
  enrichData(data) {
    console.log(`🛬 [GeoJSONProvider.enrichData] Runways à associer: ${data.runways.length}`);
    console.log(`🛬 [GeoJSONProvider.enrichData] Sample runways:`, data.runways.slice(0, 3).map(r => ({
      airportId: r.airportId,
      designation: r.designation,
      length: r.length
    })));

    // Associer les pistes aux aéroports
    let totalAssociated = 0;
    data.airports.forEach(airport => {
      airport.runways = data.runways.filter(rwy => rwy.airportId === airport.icao);
      totalAssociated += airport.runways.length;

      // Normaliser le format des pistes
      airport.runways.forEach(rwy => {
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
          rwy.qfu = leQfu;
        }
      });

      // Catégorie d'aérodrome basée sur longueur piste
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

    console.log(`✅ [GeoJSONProvider.enrichData] Total pistes associées: ${totalAssociated} / ${data.runways.length}`);
    const airportsWithRunways = data.airports.filter(a => a.runways.length > 0).length;
    console.log(`✅ [GeoJSONProvider.enrichData] Aérodromes avec pistes: ${airportsWithRunways} / ${data.airports.length}`);

    // Classifier les espaces aériens par priorité
    data.airspaces.forEach(airspace => {
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
  }

  /**
   * Assure que les données sont chargées
   */
  async ensureDataLoaded() {
    if (!this.data) {
      await this.loadData();
    }
  }

  /**
   * Récupère les aérodromes avec filtres
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
        af.name?.toLowerCase().includes(search) ||
        af.city?.toLowerCase().includes(search)
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
        return airspace.geometry.coordinates[0].some(coord =>
          coord[1] >= minLat && coord[1] <= maxLat &&
          coord[0] >= minLon && coord[0] <= maxLon
        );
      });
    }

    filtered.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    return filtered;
  }

  /**
   * Récupère les navaids
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
   * Récupère les routes ATS (non implémenté dans GeoJSON)
   */
  async getRoutes(params = {}) {
    return [];
  }

  /**
   * Récupère les points de report VFR pour un aérodrome
   */
  async getReportingPoints(icao) {
    await this.ensureDataLoaded();

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
   * Calcule la distance entre deux points (Haversine)
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
    return 'SIA France GeoJSON (Optimisé)';
  }

  getStatus() {
    if (this.isLoading) {
      return {
        available: true,
        name: this.getProviderName(),
        message: 'Chargement des données GeoJSON en cours...'
      };
    }

    if (this.data) {
      return {
        available: true,
        name: this.getProviderName(),
        message: `Données GeoJSON chargées - ${this.data.airports.length} aérodromes, ${this.data.airspaces.length} espaces, ${this.data.navaids.length} navaids`
      };
    }

    return {
      available: true,
      name: this.getProviderName(),
      message: 'Prêt à charger les données GeoJSON'
    };
  }
}
