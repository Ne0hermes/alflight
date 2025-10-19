// src/services/airportDataService.js
import airportElevationParser from './airportElevationParser';

/**
 * Service pour récupérer les données d'aéroports depuis les fichiers de données
 * Utilise EXCLUSIVEMENT les données du dossier src/data
 */
class AirportDataService {
  constructor() {
    this.aerodromes = new Map();
    this.runways = new Map();
    this.loadData();
  }

  /**
   * Charge les données des aérodromes et pistes
   */
  async loadData() {
    try {
      // Charger les aérodromes depuis le fichier JSON
      this.aerodromes = new Map();
      try {
        const aeroResponse = await fetch('/data/derived/geojson/aerodromes.geojson');
        const aerodromesData = await aeroResponse.json();
        
        if (aerodromesData && aerodromesData.features) {
          aerodromesData.features.forEach(feature => {
            if (feature.properties && feature.properties.id) {
              // Extraire le code OACI depuis l'ID (format: AD_LFXX)
              const icaoCode = feature.properties.id.replace('AD_', '');
              this.aerodromes.set(icaoCode, feature.properties);
            }
          });
        }
      } catch (err) {
        
      }

      // Charger les données de pistes
      this.runways = new Map();
      try {
        const runwayResponse = await fetch('/data/derived/geojson/runways.geojson');
        const runwaysData = await runwayResponse.json();
        
        if (runwaysData && runwaysData.features) {
          runwaysData.features.forEach(feature => {
            if (feature.properties) {
              const icaoCode = feature.properties.aerodrome_icao || feature.properties.aerodrome;
              if (icaoCode) {
                if (!this.runways.has(icaoCode)) {
                  this.runways.set(icaoCode, []);
                }
                this.runways.get(icaoCode).push(feature.properties);
              }
            }
          });
        }
      } catch (err) {
        
      }

      
      
    } catch (error) {
      console.error('❌ Erreur lors du chargement des données aéroport:', error);
    }
  }

  /**
   * Récupère l'altitude d'un aérodrome
   * @param {string} icaoCode - Code OACI de l'aérodrome
   * @returns {number} Altitude en pieds, ou 0 si non trouvée
   */
  getAirportElevation(icaoCode) {
    if (!icaoCode) return 0;
    
    const code = icaoCode.toUpperCase();
    
    // Utiliser le parser XML pour obtenir l'altitude
    const elevation = airportElevationParser.getElevation(code);
    
    if (elevation > 0) {
      return elevation;
    }
    
    // Si pas trouvé dans le parser, chercher dans les données GeoJSON
    // Chercher dans les données de pistes
    const runwayData = this.runways.get(code);
    if (runwayData && runwayData.length > 0) {
      const firstRunway = runwayData[0];
      if (firstRunway.elevation !== undefined) {
        return Math.round(firstRunway.elevation);
      }
    }

    // Chercher dans les données d'aérodrome
    const aerodromeData = this.aerodromes.get(code);
    if (aerodromeData) {
      if (aerodromeData.elevation !== undefined) {
        return Math.round(aerodromeData.elevation);
      }
      if (aerodromeData.altitude !== undefined) {
        return Math.round(aerodromeData.altitude);
      }
    }

    
    return 0;
  }

  /**
   * Récupère les informations complètes d'un aérodrome
   * @param {string} icaoCode - Code OACI
   * @returns {Object|null} Informations de l'aérodrome
   */
  getAirportInfo(icaoCode) {
    if (!icaoCode) return null;
    
    const code = icaoCode.toUpperCase();
    const aerodromeData = this.aerodromes.get(code);
    const runwayData = this.runways.get(code);
    
    if (aerodromeData) {
      return {
        ...aerodromeData,
        icao: code,
        elevation: this.getAirportElevation(code),
        runways: runwayData || []
      };
    }
    
    return null;
  }

  /**
   * Recherche un aérodrome par nom ou code
   * @param {string} query - Terme de recherche
   * @returns {Array} Liste des aérodromes correspondants
   */
  searchAirports(query) {
    if (!query || query.length < 2) return [];
    
    const searchTerm = query.toUpperCase();
    const results = [];
    
    this.aerodromes.forEach((aerodrome, icaoCode) => {
      if (icaoCode.includes(searchTerm) || 
          (aerodrome.name && aerodrome.name.toUpperCase().includes(searchTerm))) {
        results.push({
          icao: icaoCode,
          ...aerodrome,
          elevation: this.getAirportElevation(icaoCode)
        });
      }
    });
    
    return results;
  }
);}

// Export singleton
export default new AirportDataService();