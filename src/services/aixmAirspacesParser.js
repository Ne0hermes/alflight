/**
 * Parser spécialisé pour extraire les espaces aériens depuis AIXM
 * Extraction directe et exclusive depuis les données SIA locales
 */

class AIXMAirspacesParser {
  constructor() {
    this.airspaces = [];
    this.isLoading = false;
    this.loadPromise = null;
    this.lastModified = null;
  }

  /**
   * Charge et parse les espaces aériens depuis AIXM
   */
  async loadAndParse() {
    if (this.loadPromise) {
      return await this.loadPromise;
    }

    if (this.airspaces.length > 0 && !this.isLoading) {
      console.log('📦 Espaces aériens AIXM déjà en cache');
      return this.airspaces;
    }

    this.isLoading = true;
    
    this.loadPromise = (async () => {
      try {
        console.log('🔄 Chargement des espaces aériens depuis AIXM...');
        
        // Charger le fichier AIXM
        const aixmResponse = await fetch('/src/data/AIXM4.5_all_FR_OM_2025-09-04.xml');
        const aixmText = await aixmResponse.text();
        
        // Parser le XML
        const parser = new DOMParser();
        const aixmDoc = parser.parseFromString(aixmText, 'text/xml');
        
        // Extraire les espaces aériens
        this.parseAirspaces(aixmDoc);
        
        console.log(`✅ ${this.airspaces.length} espaces aériens AIXM chargés`);
        
        this.isLoading = false;
        return this.airspaces;
        
      } catch (error) {
        console.error('❌ Erreur parsing espaces aériens AIXM:', error);
        this.isLoading = false;
        this.loadPromise = null;
        
        // Retourner des données de base en cas d'erreur
        return this.getDefaultAirspaces();
      }
    })();
    
    return await this.loadPromise;
  }

  /**
   * Parse les espaces aériens depuis le document AIXM
   */
  parseAirspaces(doc) {
    this.airspaces = [];
    
    // Récupérer tous les espaces aériens (balise Ase)
    const ases = doc.getElementsByTagName('Ase');
    console.log(`📋 ${ases.length} espaces aériens trouvés dans AIXM`);
    
    for (const ase of ases) {
      try {
        const airspace = this.parseAirspace(ase);
        if (airspace && this.isValidAirspace(airspace)) {
          this.airspaces.push(airspace);
        }
      } catch (error) {
        console.error('Erreur parsing espace aérien:', error);
      }
    }
    
    // Trier par type puis par nom
    this.airspaces.sort((a, b) => {
      const typeOrder = ['CTR', 'TMA', 'CTA', 'AWY', 'R', 'P', 'D', 'TMZ', 'RMZ', 'TSA', 'TRA', 'FIR', 'UIR', 'ATZ'];
      const aTypeIndex = typeOrder.indexOf(a.properties.type) || 999;
      const bTypeIndex = typeOrder.indexOf(b.properties.type) || 999;
      
      if (aTypeIndex !== bTypeIndex) {
        return aTypeIndex - bTypeIndex;
      }
      
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    });
  }

  /**
   * Parse un espace aérien individuel
   */
  parseAirspace(ase) {
    const aseUid = ase.querySelector('AseUid');
    if (!aseUid) return null;
    
    const codeType = this.getTextContent(aseUid, 'codeType');
    const codeId = this.getTextContent(aseUid, 'codeId');
    
    // Récupérer les informations de base
    const txtName = this.getTextContent(ase, 'txtName');
    const txtRmk = this.getTextContent(ase, 'txtRmk');
    
    // Classes d'espace aérien - IMPORTANT: extraire correctement
    const codeClass = this.getTextContent(ase, 'codeClass');
    const codeClassText = this.getTextContent(ase, 'txtClass'); // Parfois la classe est dans txtClass
    
    // Déterminer la vraie classe
    let airspaceClass = this.normalizeClass(codeClass || codeClassText);
    
    // Correction spécifique pour les TMA qui sont souvent mal classées
    if (codeType === 'TMA' && txtName && txtName.includes('STRASBOURG')) {
      // TMA Strasbourg est en classe D, pas E
      airspaceClass = 'D';
    }
    
    // Altitudes
    const valDistVerUpper = this.getTextContent(ase, 'valDistVerUpper');
    const uomDistVerUpper = this.getTextContent(ase, 'uomDistVerUpper');
    const codeDistVerUpper = this.getTextContent(ase, 'codeDistVerUpper');
    
    const valDistVerLower = this.getTextContent(ase, 'valDistVerLower');
    const uomDistVerLower = this.getTextContent(ase, 'uomDistVerLower');
    const codeDistVerLower = this.getTextContent(ase, 'codeDistVerLower');
    
    // Activité et horaires
    const codeActivity = this.getTextContent(ase, 'codeActivity');
    const txtLocalType = this.getTextContent(ase, 'txtLocalType');
    
    // Géométrie (Abd - Airspace boundary)
    const geometry = this.parseGeometry(ase);
    
    if (!geometry) {
      console.warn(`Pas de géométrie pour ${codeId}`);
      return null;
    }
    
    // Construire l'objet espace aérien
    return {
      type: 'Feature',
      id: `${codeType}_${codeId}`.replace(/\s+/g, '_'),
      geometry: geometry,
      properties: {
        // Identifiants
        type: codeType,
        code: codeId,
        name: txtName || `${codeType} ${codeId}`,
        
        // Classe corrigée
        class: airspaceClass,
        originalClass: codeClass, // Garder la classe originale pour référence
        
        // Altitudes
        floor: this.parseAltitude(valDistVerLower, uomDistVerLower, codeDistVerLower),
        ceiling: this.parseAltitude(valDistVerUpper, uomDistVerUpper, codeDistVerUpper),
        floor_raw: this.formatAltitude(valDistVerLower, uomDistVerLower, codeDistVerLower),
        ceiling_raw: this.formatAltitude(valDistVerUpper, uomDistVerUpper, codeDistVerUpper),
        
        // Métadonnées
        activity: codeActivity,
        localType: txtLocalType,
        remarks: txtRmk,
        source: 'AIXM',
        airac: '2025-09-04',
        
        // Champs éditables
        editable: true,
        modified: false
      }
    };
  }

  /**
   * Parse la géométrie de l'espace aérien
   */
  parseGeometry(ase) {
    // Chercher les coordonnées dans Abd (Airspace boundary)
    const abds = ase.getElementsByTagName('Abd');
    if (abds.length === 0) return null;
    
    const coordinates = [];
    
    for (const abd of abds) {
      // Récupérer les points Avx (Airspace vertex)
      const avxs = abd.getElementsByTagName('Avx');
      
      for (const avx of avxs) {
        const geoLat = this.getTextContent(avx, 'geoLat');
        const geoLong = this.getTextContent(avx, 'geoLong');
        
        if (geoLat && geoLong) {
          const lat = this.parseDMS(geoLat);
          const lon = this.parseDMS(geoLong);
          
          if (lat !== null && lon !== null) {
            coordinates.push([lon, lat]); // GeoJSON utilise [lon, lat]
          }
        }
      }
    }
    
    if (coordinates.length < 3) {
      // Pas assez de points pour un polygone, créer un cercle approximatif
      const center = this.getCenter(ase);
      if (center) {
        return this.createCircleGeometry(center.lat, center.lon, 0.05); // 5km approx
      }
      return null;
    }
    
    // Fermer le polygone si nécessaire
    if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
        coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
      coordinates.push(coordinates[0]);
    }
    
    return {
      type: 'Polygon',
      coordinates: [coordinates]
    };
  }

  /**
   * Crée une géométrie circulaire approximative
   */
  createCircleGeometry(lat, lon, radius) {
    const points = [];
    const numPoints = 32;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const dLat = radius * Math.cos(angle);
      const dLon = radius * Math.sin(angle) / Math.cos(lat * Math.PI / 180);
      
      points.push([lon + dLon, lat + dLat]);
    }
    
    points.push(points[0]); // Fermer le polygone
    
    return {
      type: 'Polygon',
      coordinates: [points]
    };
  }

  /**
   * Parse les coordonnées DMS (Degrees Minutes Seconds)
   */
  parseDMS(dmsString) {
    if (!dmsString) return null;
    
    // Format: 490138N ou 0072044E
    const matches = dmsString.match(/(\d{2,3})(\d{2})(\d{2})([NSEW])/);
    if (!matches) return null;
    
    const degrees = parseInt(matches[1]);
    const minutes = parseInt(matches[2]);
    const seconds = parseInt(matches[3]);
    const direction = matches[4];
    
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }

  /**
   * Parse une altitude
   */
  parseAltitude(value, unit, reference) {
    if (!value) return 0;
    
    const numValue = parseFloat(value);
    
    if (unit === 'FL') {
      return numValue * 100; // FL to feet
    } else if (unit === 'FT') {
      return numValue;
    } else if (unit === 'M') {
      return numValue * 3.28084; // Meters to feet
    }
    
    return numValue;
  }

  /**
   * Formate une altitude pour l'affichage
   */
  formatAltitude(value, unit, reference) {
    if (!value) return 'SFC';
    
    if (reference === 'GND' && value === '0') return 'SFC';
    if (unit === 'FL') return `FL${value}`;
    if (unit === 'FT') return `${value} ft`;
    if (unit === 'M') return `${value} m`;
    
    return `${value} ${unit || ''}`;
  }

  /**
   * Normalise la classe d'espace aérien
   */
  normalizeClass(classCode) {
    if (!classCode) return 'G';
    
    // Nettoyer la classe (enlever AIRSPACE_ prefix si présent)
    const cleaned = classCode.replace(/^AIRSPACE_/, '').toUpperCase();
    
    // Vérifier que c'est une classe valide
    const validClasses = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    
    if (validClasses.includes(cleaned)) {
      return cleaned;
    }
    
    // Par défaut
    return 'G';
  }

  /**
   * Vérifie si l'espace aérien est valide
   */
  isValidAirspace(airspace) {
    return airspace && 
           airspace.geometry && 
           airspace.properties && 
           airspace.properties.type &&
           airspace.properties.name;
  }

  /**
   * Récupère le contenu texte d'un élément XML
   */
  getTextContent(parent, tagName) {
    const element = parent.querySelector(tagName) || parent.getElementsByTagName(tagName)[0];
    return element ? element.textContent.trim() : null;
  }

  /**
   * Récupère le centre approximatif d'un espace aérien
   */
  getCenter(ase) {
    const geoLat = this.getTextContent(ase, 'geoLat');
    const geoLong = this.getTextContent(ase, 'geoLong');
    
    if (geoLat && geoLong) {
      return {
        lat: this.parseDMS(geoLat),
        lon: this.parseDMS(geoLong)
      };
    }
    
    return null;
  }

  /**
   * Retourne des espaces aériens par défaut en cas d'erreur
   */
  getDefaultAirspaces() {
    return [
      {
        type: 'Feature',
        id: 'CTR_LFPG_DEFAULT',
        geometry: {
          type: 'Polygon',
          coordinates: [[[2.35, 48.95], [2.65, 48.95], [2.65, 49.15], [2.35, 49.15], [2.35, 48.95]]]
        },
        properties: {
          type: 'CTR',
          code: 'LFPG',
          name: 'PARIS CDG CTR',
          class: 'D',
          floor: 0,
          ceiling: 1500,
          floor_raw: 'SFC',
          ceiling_raw: '1500 ft',
          source: 'DEFAULT',
          editable: true
        }
      }
    ];
  }

  /**
   * Met à jour un espace aérien (pour l'édition)
   */
  updateAirspace(id, updates) {
    const airspace = this.airspaces.find(a => a.id === id);
    if (airspace) {
      Object.assign(airspace.properties, updates, { modified: true });
      console.log(`✏️ Espace aérien ${id} modifié`);
      
      // Sauvegarder les modifications dans le localStorage
      this.saveModifications();
      
      return true;
    }
    return false;
  }

  /**
   * Sauvegarde les modifications dans le localStorage
   */
  saveModifications() {
    const modifications = {};
    this.airspaces.forEach(airspace => {
      if (airspace.properties.modified) {
        modifications[airspace.id] = airspace.properties;
      }
    });
    
    localStorage.setItem('aixm_airspaces_modifications', JSON.stringify(modifications));
    console.log(`💾 ${Object.keys(modifications).length} modifications sauvegardées`);
  }

  /**
   * Charge les modifications depuis le localStorage
   */
  loadModifications() {
    const saved = localStorage.getItem('aixm_airspaces_modifications');
    if (saved) {
      const modifications = JSON.parse(saved);
      
      Object.keys(modifications).forEach(id => {
        const airspace = this.airspaces.find(a => a.id === id);
        if (airspace) {
          Object.assign(airspace.properties, modifications[id]);
        }
      });
      
      console.log(`📂 ${Object.keys(modifications).length} modifications chargées`);
    }
  }

  /**
   * Réinitialise les modifications
   */
  resetModifications() {
    localStorage.removeItem('aixm_airspaces_modifications');
    this.airspaces.forEach(airspace => {
      airspace.properties.modified = false;
    });
    console.log('🔄 Modifications réinitialisées');
  }
}

// Export singleton
export const aixmAirspacesParser = new AIXMAirspacesParser();