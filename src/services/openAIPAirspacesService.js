/**
 * Service OpenAIP pour les espaces aériens uniquement
 * Intégration spécialisée pour récupérer les vraies géométries
 */

const OPENAIP_PROXY_URL = import.meta.env.VITE_OPENAIP_PROXY_URL || 'http://localhost:3002';

class OpenAIPAirspacesService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Récupère les espaces aériens français avec approche hybride
   * Géométries depuis OpenAIP + Corrections depuis AIXM
   */
  async getFrenchAirspaces(bbox = null) {
    const cacheKey = 'airspaces_' + (bbox || 'france');

    // Verifier le cache
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey) > Date.now()) {
      
      return this.cache.get(cacheKey);
    }

    try {
      console.log('Loading airspaces...');

      // Utiliser le service hybride
      const { hybridAirspacesService } = await import('./hybridAirspacesService.js');
      
      // Charger les espaces aériens avec approche hybride
      const airspaces = await hybridAirspacesService.getFrenchAirspaces(bbox);
      
      // Mise en cache
      this.cache.set(cacheKey, airspaces);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
      
      
      return airspaces;

    } catch (error) {
      console.error('❌ Erreur chargement hybride, fallback vers AIXM seul:', error);
      
      // Fallback vers AIXM uniquement
      try {
        const { aixmAirspacesParser } = await import('./aixmAirspacesParser.js');
        const aixmData = await aixmAirspacesParser.loadAndParse();
        
        // Mise en cache
        this.cache.set(cacheKey, aixmData);
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);

        return aixmData;
        
      } catch (aixmError) {
        console.error('❌ Erreur fallback AIXM:', aixmError);
        
        // Dernier recours : données minimales
        const fallbackData = this.getMinimalAirspaces();
        this.cache.set(cacheKey, fallbackData);
        this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
        
        return fallbackData;
      }
    }
  }
  
  /**
   * Retourne des espaces aériens minimaux en cas d'erreur totale
   */
  getMinimalAirspaces() {
    
    return [
      {
        type: 'Feature',
        id: 'CTR_LFPG_MINIMAL',
        geometry: {
          type: 'Polygon',
          coordinates: [[[2.35, 48.95], [2.65, 48.95], [2.65, 49.15], [2.35, 49.15], [2.35, 48.95]]]
        },
        properties: {
          type: 'CTR',
          code: 'LFPG',
          name: 'PARIS CDG CTR (Minimal)',
          class: 'D',
          floor: 0,
          ceiling: 1500,
          floor_raw: 'SFC',
          ceiling_raw: '1500 ft',
          source: 'MINIMAL',
          editable: false
        }
      }
    ];
  }

  /**
   * Traite et normalise les données OpenAIP
   */
  processAirspaces(features) {
    return features
      .filter(feature => {
        // Filtrer les espaces aériens valides
        return feature.geometry && 
               feature.properties && 
               feature.properties.name &&
               this.isValidAirspaceType(feature.properties.type);
      })
      .map(feature => {
        const props = feature.properties;
        
        // Extraire les altitudes correctement
        const floorValue = this.extractAltitudeValue(props.lowerLimit || props.floor);
        const ceilingValue = this.extractAltitudeValue(props.upperLimit || props.ceiling);
        
        return {
          ...feature,
          properties: {
            ...props,
            // Normalisation des propriétés
            name: props.name || props.identifier,
            type: this.normalizeAirspaceType(props.type),
            class: props.class || this.getClassFromType(props.type),
            
            // Altitudes normalisées (valeurs numériques ou chaînes)
            floor: floorValue.value,
            ceiling: ceilingValue.value,
            floor_raw: floorValue.raw,
            ceiling_raw: ceilingValue.raw,
            
            // Objets complets pour l'analyse détaillée
            lowerLimit: floorValue.object,
            upperLimit: ceilingValue.object,
            
            activity: props.activity,
            schedule: props.timeOfUse || props.schedule,
            remarks: props.remarks,
            country: 'FR',
            source: 'OpenAIP',
            airac: new Date().toISOString().slice(0, 10)
          }
        };
      });
  }

  /**
   * Extrait la valeur d'altitude depuis différents formats
   */
  extractAltitudeValue(altitude) {
    // Si pas d'altitude
    if (!altitude) {
      return { value: 0, raw: 'SFC', object: { value: 0, unit: 'FT', referenceDatum: 'GND' } };
    }
    
    // Si c'est deja une valeur simple (nombre ou chaine)
    if (typeof altitude === 'number') {
      return {
        value: altitude,
        raw: altitude === 0 ? 'SFC' : altitude + ' ft',
        object: { value: altitude, unit: 'FT', referenceDatum: 'MSL' }
      };
    }
    
    if (typeof altitude === 'string') {
      // Parser les chaînes comme "FL100", "3000ft", etc.
      if (altitude.startsWith('FL')) {
        const fl = parseInt(altitude.substring(2));
        return { 
          value: fl * 100, 
          raw: altitude,
          object: { value: fl, unit: 'FL', referenceDatum: 'STD' }
        };
      }
      const numMatch = altitude.match(/(\d+)/);
      const value = numMatch ? parseInt(numMatch[1]) : 0;
      return { 
        value: value, 
        raw: altitude,
        object: { value: value, unit: 'FT', referenceDatum: 'MSL' }
      };
    }
    
    // Si c'est un objet (format OpenAIP structuré)
    if (typeof altitude === 'object' && altitude !== null) {
      const value = altitude.value || altitude.altitude || 0;
      const unit = altitude.unit || altitude.uom || 'FT';
      const ref = altitude.referenceDatum || altitude.reference || 'MSL';
      
      // Convertir en pieds si nécessaire
      let valueFeet = value;
      if (unit === 'M') {
        valueFeet = Math.round(value * 3.28084);
      } else if (unit === 'FL') {
        valueFeet = value * 100;
      }
      
      // Formater la chaine d'affichage
      let raw = '';
      if (value === 0 || ref === 'GND') {
        raw = 'SFC';
      } else if (value === 999999 || value === 'UNLIMITED') {
        raw = 'UNLIMITED';
      } else if (unit === 'FL' || ref === 'STD') {
        raw = 'FL' + String(value).padStart(3, '0');
      } else {
        raw = valueFeet + ' ft ' + ref;
      }
      
      return { 
        value: valueFeet, 
        raw: raw,
        object: altitude
      };
    }
    
    // Fallback
    return { value: 0, raw: 'SFC', object: { value: 0, unit: 'FT', referenceDatum: 'GND' } };
  }

  /**
   * Vérifie si le type d'espace aérien est valide
   */
  isValidAirspaceType(type) {
    // Si le type est numérique (nouvelle API OpenAIP)
    if (typeof type === 'number') {
      // Les types numériques valides de OpenAIP
      // 0-30 sont des types valides selon la documentation OpenAIP
      return type >= 0 && type <= 30;
    }
    
    // Si le type est une chaîne (ancien format)
    if (typeof type === 'string') {
      const validTypes = [
        'CTR', 'TMA', 'CTA',
        'RESTRICTED', 'PROHIBITED', 'DANGER',
        'A', 'B', 'C', 'D', 'E', 'F', 'G',
        'TMZ', 'RMZ', 'AWY'
      ];
      
      return validTypes.includes(type.toUpperCase());
    }
    
    return false;
  }

  /**
   * Normalise les types d'espaces aériens
   */
  normalizeAirspaceType(type) {
    // Si le type est numérique (nouvelle API OpenAIP)
    if (typeof type === 'number') {
      // Mapping des types numériques OpenAIP vers des types texte
      const numericTypeMap = {
        0: 'CTR',
        1: 'TMA',
        2: 'CTA',
        3: 'AIRSPACE_A',
        4: 'AIRSPACE_B',
        5: 'AIRSPACE_C',
        6: 'AIRSPACE_D',
        7: 'AIRSPACE_E',
        8: 'AIRSPACE_F',
        9: 'AIRSPACE_G',
        10: 'R', // Restricted
        11: 'P', // Prohibited
        12: 'D', // Danger
        13: 'TMZ',
        14: 'RMZ',
        15: 'AWY', // Airway
        16: 'TSA', // Temporary Segregated Area
        17: 'TRA', // Temporary Reserved Area
        18: 'FIR',
        19: 'UIR',
        20: 'ATZ',
        21: 'OTHER'
      };
      return numericTypeMap[type] || 'TYPE_' + type;
    }
    
    // Si le type est une chaîne (ancien format)
    if (typeof type === 'string') {
      const typeMap = {
        'CTR': 'CTR',
        'TMA': 'TMA', 
        'CTA': 'CTA',
        'RESTRICTED': 'R',
        'PROHIBITED': 'P',
        'DANGER': 'D',
        'A': 'AIRSPACE_A',
        'B': 'AIRSPACE_B',
        'C': 'AIRSPACE_C',
        'D': 'AIRSPACE_D',
        'E': 'AIRSPACE_E',
        'F': 'AIRSPACE_F',
        'G': 'AIRSPACE_G',
        'TMZ': 'TMZ',
        'RMZ': 'RMZ'
      };
      
      return typeMap[type.toUpperCase()] || type;
    }
    
    return type;
  }

  /**
   * Détermine la classe à partir du type
   */
  getClassFromType(type) {
    // Normaliser d'abord le type
    const normalizedType = this.normalizeAirspaceType(type);
    
    const classMap = {
      'CTR': 'D',
      'TMA': 'A',
      'CTA': 'A',
      'R': 'R',
      'P': 'P',
      'D': 'D',
      'AIRSPACE_A': 'A',
      'AIRSPACE_B': 'B',
      'AIRSPACE_C': 'C',
      'AIRSPACE_D': 'D',
      'AIRSPACE_E': 'E',
      'AIRSPACE_F': 'F',
      'AIRSPACE_G': 'G',
      'TMZ': 'TMZ',
      'RMZ': 'RMZ',
      'AWY': 'AWY'
    };
    
    return classMap[normalizedType] || normalizedType;
  }

  /**
   * Extrait les espaces aériens depuis les données AIXM
   */
  extractAirspacesFromAIXM(aixmData) {
    const airspaces = [];
    
    // Les aérodromes AIXM peuvent contenir des CTR/ATZ
    if (aixmData && Array.isArray(aixmData)) {
      aixmData.forEach(aerodrome => {
        // Créer une CTR basique pour chaque aérodrome majeur
        if (aerodrome.icao && aerodrome.coordinates) {
          const lat = aerodrome.coordinates.lat;
          const lon = aerodrome.coordinates.lon || aerodrome.coordinates.lng;
          
          // Créer un cercle approximatif de 10km de rayon pour la CTR
          const radius = 0.09; // Environ 10km en degrés
          
          airspaces.push({
            type: 'Feature',
            id: 'CTR_' + aerodrome.icao,
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [lon - radius, lat - radius],
                [lon + radius, lat - radius],
                [lon + radius, lat + radius],
                [lon - radius, lat + radius],
                [lon - radius, lat - radius]
              ]]
            },
            properties: {
              name: aerodrome.icao + ' CTR',
              type: 'CTR',
              class: aerodrome.type === 'AD' ? 'D' : 'G',
              floor: 0,
              ceiling: 1500,
              floor_raw: 'SFC',
              ceiling_raw: '1500 ft',
              lowerLimit: { value: 0, unit: 'FT', referenceDatum: 'GND' },
              upperLimit: { value: 1500, unit: 'FT', referenceDatum: 'MSL' },
              country: 'FR',
              source: 'AIXM',
              icao: aerodrome.icao,
              frequencies: aerodrome.frequencies || []
            }
          });
        }
      });
    }
    
    return airspaces;
  }

  /**
   * Données de secours en cas d'échec OpenAIP
   * Utilise les données AIXM locales pour les espaces aériens
   */
  async getFallbackAirspaces() {
    
    
    try {
      // Importer le parser AIXM pour obtenir les espaces aériens
      const { aixmParser } = await import('./aixmParser.js');
      
      // Charger les données AIXM si pas déjà chargées
      const aixmData = await aixmParser.loadAndParse();
      
      // Extraire les espaces aériens depuis les données AIXM
      const airspaces = this.extractAirspacesFromAIXM(aixmData);
      
      if (airspaces && airspaces.length > 0) {
        
        return airspaces;
      }
    } catch (err) {
      console.error('Erreur chargement AIXM:', err);
    }
    
    // Si le chargement AIXM échoue aussi, utiliser les données manuelles
    try {
      const { FRENCH_AIRSPACES_MANUAL } = await import('../data/frenchAirspacesManual.js');
      if (FRENCH_AIRSPACES_MANUAL && FRENCH_AIRSPACES_MANUAL.features) {
        
        return this.processAirspaces(FRENCH_AIRSPACES_MANUAL.features);
      }
    } catch (err) {
      console.error('Erreur chargement données manuelles:', err);
    }
    
    // Si tout échoue, retourner des données minimales
    return [
      {
        type: 'Feature',
        id: 'CTR_LFPG_MINIMAL',
        geometry: {
          type: 'Polygon',
          coordinates: [[[2.5, 49.05], [2.65, 49.05], [2.65, 48.95], [2.5, 48.95], [2.5, 49.05]]]
        },
        properties: {
          name: 'PARIS CDG CTR (Minimal)',
          type: 'CTR',
          class: 'D',
          ceiling: '1500 ft',
          floor: 'SFC',
          source: 'Minimal'
        }
      }
    ];
  }

  /**
   * Filtre les espaces aériens par type
   */
  async getAirspacesByType(type, bbox = null) {
    const airspaces = await this.getFrenchAirspaces(bbox);
    return airspaces.filter(airspace =>
      airspace.properties?.type === type
    );
  }

  /**
   * Recherche d'espaces aériens par nom
   */
  async searchAirspaces(query, bbox = null) {
    const airspaces = await this.getFrenchAirspaces(bbox);
    const searchTerm = query.toLowerCase();
    
    return airspaces.filter(airspace => {
      const name = airspace.properties?.name?.toLowerCase() || '';
      return name.includes(searchTerm);
    });
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Obtient les statistiques
   */
  async getStats(bbox = null) {
    const airspaces = await this.getFrenchAirspaces(bbox);
    
    const stats = {
      total: airspaces.length,
      byType: {},
      byClass: {}
    };

    airspaces.forEach(airspace => {
      const type = airspace.properties?.type || 'UNKNOWN';
      const airspaceClass = airspace.properties?.class || 'UNKNOWN';
      
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.byClass[airspaceClass] = (stats.byClass[airspaceClass] || 0) + 1;
    });

    return stats;
  }
}

// Instance singleton
export const openAIPAirspacesService = new OpenAIPAirspacesService();
export default openAIPAirspacesService;