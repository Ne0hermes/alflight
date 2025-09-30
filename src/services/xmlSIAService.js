/**
 * Service pour extraire les données depuis les fichiers XML AIXM et SIA
 * Lit directement les fichiers XML sources pour obtenir les informations VAC
 */

class XMLSIAService {
  constructor() {
    // Utiliser les fichiers GeoJSON dérivés des XML
    this.aerodromesPath = '/src/data/derived/geojson/aerodromes.geojson';
    this.runwaysPath = '/src/data/derived/geojson/runways.geojson';
    this.airspacesPath = '/src/data/derived/geojson/airspaces.geojson';
    this.cache = new Map();
    this.aerodromes = [];
    this.isLoaded = false;
  }

  /**
   * Charge les données depuis les fichiers GeoJSON dérivés
   */
  async loadXMLData() {
    if (this.isLoaded) {
      return this.aerodromes;
    }

    try {
      console.log('🔄 Chargement des données SIA depuis GeoJSON...');
      
      // Charger les aérodromes
      const aerodromesResponse = await fetch(this.aerodromesPath);
      const aerodromesGeoJSON = await aerodromesResponse.json();
      
      // Charger les pistes
      const runwaysResponse = await fetch(this.runwaysPath);
      const runwaysGeoJSON = await runwaysResponse.json();
      
      // Charger les espaces aériens
      const airspacesResponse = await fetch(this.airspacesPath);
      const airspacesGeoJSON = await airspacesResponse.json();
      
      // Traiter les données
      this.aerodromes = this.processGeoJSONData(aerodromesGeoJSON, runwaysGeoJSON, airspacesGeoJSON);
      this.isLoaded = true;
      
      console.log(`✅ ${this.aerodromes.length} aérodromes chargés depuis GeoJSON`);
      return this.aerodromes;
      
    } catch (error) {
      console.error('❌ Erreur chargement GeoJSON:', error);
      throw error;
    }
  }

  /**
   * Traite les données GeoJSON pour créer la structure attendue
   */
  processGeoJSONData(aerodromesData, runwaysData, airspacesData) {
    const aerodromes = [];
    
    // Créer un map des pistes par aérodrome avec toutes les données disponibles
    // Séparer les pistes bidirectionnelles en deux entrées distinctes
    const runwaysByAerodrome = {};
    runwaysData.features.forEach(runway => {
      const props = runway.properties || {};
      const coords = runway.geometry?.coordinates || [];
      const icao = props.aerodrome_icao || props.icao;
      
      if (icao) {
        if (!runwaysByAerodrome[icao]) {
          runwaysByAerodrome[icao] = [];
        }
        
        // Analyser la désignation pour séparer les deux sens
        const designation = props.designation || props.runway_designation || props.name || '';
        const qfuMatch = designation.match(/(\d{2})\/(\d{2})/);
        
        if (qfuMatch) {
          // Piste bidirectionnelle - créer deux entrées
          const rwy1 = qfuMatch[1];
          const rwy2 = qfuMatch[2];
          // Les QFU réels doivent venir des données SIA
          // NOTE: Les valeurs QFU précises sont dans les documents SIA (ex: QFU 047° au lieu de 050°)
          // Si pas de données précises, on utilise une approximation (numéro × 10)
          const qfu1 = props.qfu1 || props[`qfu_${rwy1}`] || props.magnetic_bearing_1 || (parseInt(rwy1) * 10);
          const qfu2 = props.qfu2 || props[`qfu_${rwy2}`] || props.magnetic_bearing_2 || (parseInt(rwy2) * 10);
          
          // Première direction (ex: 05)
          runwaysByAerodrome[icao].push({
            // Identification
            id: `${props.id || runway.id}_${rwy1}`,
            designation: rwy1,
            designation_full: designation,
            
            // Dimensions
            length_m: props.length_m || props.length || 0,
            width_m: props.width_m || props.width || 0,
            
            // Distances déclarées
            toda: props.toda || props.length_m || props.length || 0, // Take-Off Distance Available
            lda: props.lda || props.length_m || props.length || 0,   // Landing Distance Available
            asda: props.asda || props.length_m || props.length || 0, // Accelerate-Stop Distance Available
            tora: props.tora || props.length_m || props.length || 0, // Take-Off Run Available
            
            // Orientation
            qfu: qfu1,
            orientation: qfu1,
            opposite_qfu: qfu2,
            
            // Surface et caractéristiques
            surface: props.surface || props.surface_type || 'ASPH',
            strength: props.strength || props.pcn || '',
            
            // Altitudes et seuils
            elevation: props.elevation || props.threshold_elevation || 0,
            threshold_displaced: props.threshold_displaced || 0,
            
            // Équipements
            lighting: props.lighting || props.light_system || '',
            ils: props.ils || props.ils_category || '',
            papi: props.papi || props.vasi || '',
            approach_lighting: props.approach_lighting || '',
            
            // Géométrie
            coordinates: coords,
            
            // Métadonnées
            source: props.source || 'SIA',
            airac: props.airac || '',
            status: props.status || 'ACTIVE',
            remarks: props.remarks || ''
          });
          
          // Deuxième direction (ex: 23)
          runwaysByAerodrome[icao].push({
            // Identification
            id: `${props.id || runway.id}_${rwy2}`,
            designation: rwy2,
            designation_full: designation,
            
            // Dimensions
            length_m: props.length_m || props.length || 0,
            width_m: props.width_m || props.width || 0,
            
            // Distances déclarées (peuvent être différentes pour l'autre sens)
            toda: props.toda_opposite || props.toda || props.length_m || props.length || 0,
            lda: props.lda_opposite || props.lda || props.length_m || props.length || 0,
            asda: props.asda_opposite || props.asda || props.length_m || props.length || 0,
            tora: props.tora_opposite || props.tora || props.length_m || props.length || 0,
            
            // Orientation
            qfu: qfu2,
            orientation: qfu2,
            opposite_qfu: qfu1,
            
            // Surface et caractéristiques
            surface: props.surface || props.surface_type || 'ASPH',
            strength: props.strength || props.pcn || '',
            
            // Altitudes et seuils (potentiellement différents pour l'autre sens)
            elevation: props.elevation_opposite || props.elevation || props.threshold_elevation || 0,
            threshold_displaced: props.threshold_displaced_opposite || props.threshold_displaced || 0,
            
            // Équipements (peuvent être différents selon le sens)
            lighting: props.lighting || props.light_system || '',
            ils: props.ils_opposite || props.ils || props.ils_category || '',
            papi: props.papi_opposite || props.papi || props.vasi || '',
            approach_lighting: props.approach_lighting_opposite || props.approach_lighting || '',
            
            // Géométrie (inversée si disponible)
            coordinates: coords.length > 0 ? [...coords].reverse() : coords,
            
            // Métadonnées
            source: props.source || 'SIA',
            airac: props.airac || '',
            status: props.status || 'ACTIVE',
            remarks: props.remarks || ''
          });
        } else {
          // Piste unidirectionnelle ou format non reconnu
          const rwyMatch = designation.match(/(\d{2})/);
          const rwyNum = rwyMatch ? rwyMatch[1] : '';
          // Utiliser le QFU réel depuis les données, sinon approximation
          const qfu = props.qfu || props[`qfu_${rwyNum}`] || props.magnetic_bearing || props.orientation || (rwyNum ? parseInt(rwyNum) * 10 : 0);
          
          runwaysByAerodrome[icao].push({
            // Identification
            id: props.id || runway.id,
            designation: designation,
            designation_full: designation,
            
            // Dimensions
            length_m: props.length_m || props.length || 0,
            width_m: props.width_m || props.width || 0,
            
            // Distances déclarées
            toda: props.toda || props.length_m || props.length || 0,
            lda: props.lda || props.length_m || props.length || 0,
            asda: props.asda || props.length_m || props.length || 0,
            tora: props.tora || props.length_m || props.length || 0,
            
            // Orientation
            qfu: qfu,
            orientation: props.orientation || props.bearing || qfu || 0,
            
            // Surface et caractéristiques
            surface: props.surface || props.surface_type || 'ASPH',
            strength: props.strength || props.pcn || '',
            
            // Altitudes et seuils
            elevation: props.elevation || props.threshold_elevation || 0,
            threshold_displaced: props.threshold_displaced || 0,
            
            // Équipements
            lighting: props.lighting || props.light_system || '',
            ils: props.ils || props.ils_category || '',
            papi: props.papi || props.vasi || '',
            approach_lighting: props.approach_lighting || '',
            
            // Géométrie
            coordinates: coords,
            
            // Métadonnées
            source: props.source || 'SIA',
            airac: props.airac || '',
            status: props.status || 'ACTIVE',
            remarks: props.remarks || ''
          });
        }
      }
    });
    
    // Créer un map des espaces aériens par aérodrome
    const airspacesByAerodrome = {};
    airspacesData.features.forEach(airspace => {
      const props = airspace.properties || {};
      if (props.type === 'CTR' || props.type === 'ATZ') {
        // Essayer de trouver l'aérodrome associé par le nom
        const name = props.name || '';
        const icaoMatch = name.match(/\b(LF[A-Z]{2})\b/);
        if (icaoMatch) {
          const icao = icaoMatch[1];
          if (!airspacesByAerodrome[icao]) {
            airspacesByAerodrome[icao] = {};
          }
          airspacesByAerodrome[icao][props.type.toLowerCase()] = {
            class: props.class || '',
            altitude: props.upper_limit || '',
            lower: props.lower_limit || ''
          };
        }
      }
    });
    
    // Traiter les aérodromes
    aerodromesData.features.forEach(feature => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [];
      
      // Filtrer uniquement les aérodromes français avec code ICAO
      if (!props.icao || !props.icao.startsWith('LF')) {
        return;
      }
      
      aerodromes.push({
        icao: props.icao,
        name: props.name || props.icao,
        city: props.municipality || props.city || '',
        coordinates: {
          lat: coords[1] || props.latitude || 0,
          lon: coords[0] || props.longitude || 0
        },
        elevation: props.elevation_m || props.elevation || 0,
        type: props.type || 'UNKNOWN',
        runways: runwaysByAerodrome[props.icao] || [],
        frequencies: this.extractFrequencies(props),
        airspaces: airspacesByAerodrome[props.icao] || {},
        vacInfo: {
          circuitAltitude: 1000,
          magneticVariation: 2,
          operatingHours: props.operating_hours || '',
          fuel: props.fuel_available || false,
          customs: props.customs_available || false,
          handling: props.handling_available || false
        },
        source: props.source || 'SIA'
      });
    });
    
    return aerodromes;
  }


  /**
   * Extrait les fréquences depuis les propriétés
   */
  extractFrequencies(props) {
    const frequencies = {};
    
    // Chercher les fréquences dans différents formats possibles
    if (props.frequencies && Array.isArray(props.frequencies)) {
      props.frequencies.forEach(freq => {
        if (freq.type && freq.frequency) {
          const type = freq.type.toLowerCase();
          if (type.includes('twr') || type.includes('tower')) {
            frequencies.twr = freq.frequency;
          } else if (type.includes('gnd') || type.includes('ground')) {
            frequencies.gnd = freq.frequency;
          } else if (type.includes('atis')) {
            frequencies.atis = freq.frequency;
          } else if (type.includes('app') || type.includes('approach')) {
            frequencies.app = freq.frequency;
          } else if (type.includes('info')) {
            frequencies.info = freq.frequency;
          }
        }
      });
    }
    
    // Aussi vérifier les propriétés directes
    if (props.tower_frequency) frequencies.twr = props.tower_frequency;
    if (props.ground_frequency) frequencies.gnd = props.ground_frequency;
    if (props.atis_frequency) frequencies.atis = props.atis_frequency;
    if (props.approach_frequency) frequencies.app = props.approach_frequency;
    if (props.info_frequency) frequencies.info = props.info_frequency;
    
    return frequencies;
  }


  /**
   * Recherche des aérodromes
   */
  async searchAerodromes(searchTerm = '') {
    const aerodromes = await this.loadXMLData();
    
    if (!searchTerm) return aerodromes;
    
    const search = searchTerm.toLowerCase();
    return aerodromes.filter(ad => {
      return (
        ad.icao?.toLowerCase().includes(search) ||
        ad.name?.toLowerCase().includes(search) ||
        ad.city?.toLowerCase().includes(search)
      );
    });
  }

  /**
   * Obtient un aérodrome par son code ICAO
   */
  async getAerodromeByICAO(icao) {
    const aerodromes = await this.loadXMLData();
    return aerodromes.find(ad => ad.icao === icao);
  }

  /**
   * Réinitialise le cache
   */
  clearCache() {
    this.cache.clear();
    this.aerodromes = [];
    this.isLoaded = false;
    console.log('🧹 Cache XML SIA nettoyé');
  }
}

// Export singleton
export const xmlSIAService = new XMLSIAService();