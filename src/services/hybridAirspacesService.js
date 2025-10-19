/**
 * Service hybride pour les espaces aériens
 * - Géométries depuis OpenAIP
 * - Métadonnées et corrections depuis AIXM local
 */

// Utiliser 127.0.0.1 au lieu de localhost pour éviter les problèmes CORS
const OPENAIP_PROXY_URL = import.meta.env.VITE_OPENAIP_PROXY_URL?.replace('localhost', '127.0.0.1') || 'http://127.0.0.1:3001';

class HybridAirspacesService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    this.aixmCorrections = new Map(); // Corrections depuis AIXM
  }

  /**
   * Récupère les espaces aériens avec approche hybride
   */
  async getFrenchAirspaces(bbox = null) {
    const cacheKey = `hybrid_airspaces_${bbox || 'france'}`;
    
    // Vérifier le cache
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey) > Date.now()) {
      
      return this.cache.get(cacheKey);
    }

    try {
      
      
      // 1. Charger les corrections depuis AIXM
      await this.loadAIXMCorrections();
      
      // 2. Récupérer les géométries depuis OpenAIP
      const openAIPData = await this.fetchOpenAIPAirspaces(bbox);
      
      // 3. Fusionner les données
      const hybridAirspaces = this.mergeAirspacesData(openAIPData);
      
      // Mise en cache
      this.cache.set(cacheKey, hybridAirspaces);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);
      
      
      return hybridAirspaces;

    } catch (error) {
      // Silencieux - fallback automatique vers AIXM
      
      // Fallback vers AIXM seul
      return this.getAIXMOnlyAirspaces();
    }
  }

  /**
   * Charge les corrections depuis AIXM
   */
  async loadAIXMCorrections() {
    if (this.aixmCorrections.size > 0) {
      return; // Déjà chargé
    }

    try {
      const { aixmAirspacesParser } = await import('./aixmAirspacesParser.js');
      const aixmData = await aixmAirspacesParser.loadAndParse();
      
      // Stocker les corrections par nom/type
      aixmData.forEach(airspace => {
        const props = airspace.properties;
        const key = this.makeKey(props.name, props.type);
        
        this.aixmCorrections.set(key, {
          class: props.class,
          originalClass: props.originalClass,
          floor_raw: props.floor_raw,
          ceiling_raw: props.ceiling_raw,
          remarks: props.remarks,
          frequencies: props.frequencies || []
        });
      });
      
      
    } catch (error) {
      console.error('Erreur chargement corrections AIXM:', error);
    }
  }

  /**
   * Récupère les données OpenAIP
   */
  async fetchOpenAIPAirspaces(bbox) {
    const franceBbox = bbox || {
      minLat: 41.0,
      maxLat: 51.5,
      minLon: -5.5,
      maxLon: 10.0
    };

    const url = `${OPENAIP_PROXY_URL}/api/airspaces`;
    const params = new URLSearchParams({
      bbox: `${franceBbox.minLon},${franceBbox.minLat},${franceBbox.maxLon},${franceBbox.maxLat}`,
      country: 'FR',
      format: 'geojson'
    });

    

    // Créer un contrôleur d'abandon avec timeout plus long
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes pour les grosses données
    
    try {
      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`OpenAIP Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.features || !Array.isArray(data.features)) {
        
        return [];
      }

      
      return data.features;
      
    } catch (error) {
      clearTimeout(timeoutId);
      // Silencieux - pas de log pour éviter le spam dans la console
      // Retourner un tableau vide au lieu de throw pour éviter les erreurs
      return [];
    }
  }

  /**
   * Fusionne les données OpenAIP avec les corrections AIXM
   */
  mergeAirspacesData(openAIPFeatures) {
    return openAIPFeatures.map(feature => {
      const props = feature.properties || {};
      
      // Convertir les codes OpenAIP en types lisibles
      const type = this.convertOpenAIPType(props.type);
      const name = props.name || `${type} ${props.id}`;
      
      // Chercher les corrections AIXM
      const key = this.makeKey(name, type);
      const corrections = this.aixmCorrections.get(key) || {};
      
      // Convertir la classe OpenAIP
      let airspaceClass = this.convertOpenAIPClass(props.icaoClass);
      
      // Appliquer les corrections spécifiques
      if (corrections.class) {
        airspaceClass = corrections.class;
      }
      
      // Corrections spéciales
      if (type === 'TMA' && name && name.includes('STRASBOURG')) {
        airspaceClass = 'D'; // TMA Strasbourg est en classe D
      }
      
      // Formater les altitudes
      const floor = this.parseOpenAIPAltitude(props.lowerLimit);
      const ceiling = this.parseOpenAIPAltitude(props.upperLimit);
      
      return {
        ...feature,
        id: `${type}_${props.id}`.replace(/\s+/g, '_'),
        properties: {
          // Données OpenAIP
          ...props,
          
          // Conversion et normalisation
          type: type,
          name: name,
          class: airspaceClass,
          
          // Altitudes
          floor: floor.value,
          ceiling: ceiling.value,
          floor_raw: corrections.floor_raw || floor.raw,
          ceiling_raw: corrections.ceiling_raw || ceiling.raw,
          
          // Corrections AIXM
          remarks: corrections.remarks || props.remarks,
          frequencies: corrections.frequencies || [],
          
          // Métadonnées
          source: 'HYBRID',
          openAIPId: props.id,
          editable: true,
          modified: false
        }
      };
    });
  }

  /**
   * Convertit le type OpenAIP (numérique) en type standard
   */
  convertOpenAIPType(typeCode) {
    const typeMap = {
      0: 'OTHER',
      1: 'RESTRICTED',
      2: 'DANGER',
      3: 'PROHIBITED',
      4: 'CTR',
      5: 'TMA',
      6: 'TRA',
      7: 'TIZ',
      8: 'TIA',
      9: 'MTA',
      10: 'ATZ',
      11: 'ADIZ',
      12: 'CTA',
      13: 'ACC',
      14: 'FIR',
      15: 'AWY',
      16: 'TMZ',
      17: 'RMZ',
      18: 'TSA',
      19: 'UIR',
      20: 'OCA',
      21: 'CBA',
      22: 'LTA',
      23: 'MATZ',
      24: 'SRZ',
      25: 'TFR',
      26: 'NOTAM'
    };
    
    const type = typeMap[typeCode] || 'OTHER';
    
    // Normaliser certains types
    if (type === 'RESTRICTED') return 'R';
    if (type === 'DANGER') return 'D';
    if (type === 'PROHIBITED') return 'P';
    
    return type;
  }

  /**
   * Convertit la classe OpenAIP (numérique) en classe OACI
   */
  convertOpenAIPClass(classCode) {
    const classMap = {
      0: 'G',    // Unclassified
      1: 'A',    // Class A
      2: 'B',    // Class B
      3: 'C',    // Class C
      4: 'D',    // Class D
      5: 'E',    // Class E
      6: 'F',    // Class F
      7: 'G',    // Class G
      8: 'G',    // Special use
      9: 'G',    // Other
      10: 'G',   // FIR
      11: 'G'    // UIR
    };
    
    return classMap[classCode] || 'G';
  }

  /**
   * Parse une altitude OpenAIP
   */
  parseOpenAIPAltitude(limit) {
    if (!limit) {
      return { value: 0, raw: 'SFC' };
    }
    
    const value = limit.value || 0;
    const unit = limit.unit;
    const ref = limit.referenceDatum;
    
    // Convertir selon l'unité
    // OpenAIP units: 0=FT, 1=M, 6=FL
    let altFeet = value;
    let raw = '';
    
    if (unit === 1) { // Mètres
      altFeet = value * 3.28084;
      raw = `${value}m`;
    } else if (unit === 6) { // Flight Level
      altFeet = value * 100;
      raw = `FL${value}`;
    } else { // Pieds
      raw = `${value}ft`;
    }
    
    // Reference datum: 0=GND, 1=STD, 2=MSL
    if (ref === 0 && value === 0) {
      raw = 'SFC';
    }
    
    return {
      value: Math.round(altFeet),
      raw: raw
    };
  }

  /**
   * Crée une clé unique pour la correspondance AIXM
   */
  makeKey(name, type) {
    return `${type}_${name}`.toUpperCase().replace(/\s+/g, '_');
  }

  /**
   * Fallback vers AIXM uniquement
   */
  async getAIXMOnlyAirspaces() {
    
    
    try {
      const { aixmAirspacesParser } = await import('./aixmAirspacesParser.js');
      const aixmData = await aixmAirspacesParser.loadAndParse();
      
      return aixmData;
    } catch (error) {
      console.error('Erreur fallback AIXM:', error);
      return [];
    }
  }

  /**
   * Met à jour un espace aérien
   */
  async updateAirspace(id, updates) {
    try {
      const { aixmAirspacesParser } = await import('./aixmAirspacesParser.js');
      return aixmAirspacesParser.updateAirspace(id, updates);
    } catch (error) {
      console.error('Erreur mise à jour espace aérien:', error);
      return false;
    }
  }
);}

// Export singleton
export const hybridAirspacesService = new HybridAirspacesService();