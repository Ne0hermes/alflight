/**
 * Service pour extraire les points VFR depuis le fichier AIXM
 */

class VFRPointsExtractor {
  constructor() {
    this.vfrPoints = [];
    this.loading = false;
    this.loaded = false;
  }

  /**
   * Charge et parse les points VFR depuis le fichier AIXM
   */
  async loadVFRPoints() {
    if (this.loaded) return this.vfrPoints;
    if (this.loading) {
      // Attendre si déjà en cours de chargement
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.loading) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      return this.vfrPoints;
    }

    this.loading = true;
    
    try {
      
      
      // Charger le fichier AIXM
      const response = await fetch('/src/data/AIXM4.5_all_FR_OM_2025-09-04.xml');
      if (!response.ok) {
        throw new Error(`Erreur chargement AIXM: ${response.status}`);
      }
      
      const xmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      
      // Extraire les points VFR
      this.vfrPoints = this.extractVFRPointsFromAIXM(doc);
      
      
      this.loaded = true;
      
      return this.vfrPoints;
      
    } catch (error) {
      console.error('❌ Erreur extraction points VFR:', error);
      return [];
    } finally {
      this.loading = false;
    }
  }

  /**
   * Extrait les points VFR du document AIXM
   */
  extractVFRPointsFromAIXM(doc) {
    const vfrPoints = [];
    const vfrPointsByAerodrome = new Map();
    
    // Rechercher tous les points désignés
    const dpns = doc.querySelectorAll('Dpn');
    
    
    
    for (const dpn of dpns) {
      const txtRmk = this.getTextContent(dpn, 'txtRmk');
      const txtName = this.getTextContent(dpn, 'txtName');
      const dpnUid = dpn.querySelector('DpnUid');
      const codeType = this.getTextContent(dpnUid, 'codeType');
      const codeId = this.getTextContent(dpnUid, 'codeId');
      
      // Extraire l'aérodrome associé s'il existe
      const ahpUidAssoc = dpn.querySelector('AhpUidAssoc');
      const associatedAirport = ahpUidAssoc ? this.getTextContent(ahpUidAssoc, 'codeId') : null;
      
      // Vérifier si c'est un point utilisable pour la navigation VFR
      // Être plus restrictif pour éviter d'inclure les points IFR
      const isVFR = (txtRmk && (
        txtRmk.includes('VRP') || 
        txtRmk.includes('VFR') || 
        txtRmk.includes('visual') ||
        txtRmk.includes('VISUAL') ||
        txtRmk.includes('report') ||
        txtRmk.includes('Visual')
      )) || 
      (codeType && (codeType === 'VFR-RP' || codeType === 'VRP')) ||
      // Exclure les points avec des codes simples comme S, N, E, W sauf s'ils ont une remarque VFR explicite
      (associatedAirport && codeId && codeId.length >= 2 && (
        codeId.match(/^[A-Z]{2,}$/) && // Au moins 2 lettres
        !codeId.match(/^[NSEW]$/) && // Exclure les points cardinaux simples
        (txtRmk?.includes('VFR') || txtRmk?.includes('VRP') || txtRmk?.includes('visual'))
      ));

      if (isVFR) {
        // Extraire les coordonnées
        const geoLat = this.getTextContent(dpn, 'geoLat');
        const geoLong = this.getTextContent(dpn, 'geoLong');
        
        if (geoLat && geoLong) {
          const coords = this.parseCoordinates(geoLat, geoLong);
          
          // Utiliser l'aérodrome associé directement depuis l'élément AhpUidAssoc
          let aerodromeId = associatedAirport;
          
          // Si pas trouvé, essayer d'extraire depuis la remarque
          if (!aerodromeId) {
            const aerodromeMatch = txtRmk?.match(/\b(LF[A-Z]{2})\b/);
            if (aerodromeMatch) {
              aerodromeId = aerodromeMatch[1];
            }
          }
          
          // Si pas trouvé, essayer depuis le code ID (ex: "LFST-S")
          if (!aerodromeId && codeId) {
            const codeMatch = codeId.match(/^(LF[A-Z]{2})/);
            if (codeMatch) {
              aerodromeId = codeMatch[1];
            }
          }
          
          const vfrPoint = {
            id: codeId || `VFR-${coords.lat}-${coords.lon}`,
            name: txtName || codeId,
            description: txtRmk,
            type: 'VRP',
            coordinates: coords,
            aerodrome: aerodromeId,
            reference: codeType
          };
          
          vfrPoints.push(vfrPoint);
          
          // Log pour debug
          if (aerodromeId === 'LFST') {
            console.log(`VFR Point found: ${codeId} at ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`);
          }
          
          // Grouper par aérodrome si possible
          if (aerodromeId) {
            if (!vfrPointsByAerodrome.has(aerodromeId)) {
              vfrPointsByAerodrome.set(aerodromeId, []);
            }
            vfrPointsByAerodrome.get(aerodromeId).push(vfrPoint);
          }
        }
      }
    }
    
    // Log des points VFR par aérodrome
    for (const [aerodrome, points] of vfrPointsByAerodrome) {
      
    }
    
    return vfrPoints;
  }

  /**
   * Parse les coordonnées depuis le format AIXM
   */
  parseCoordinates(latStr, lonStr) {
    // Format: DDMMSS.SSN ou DDDMMSS.SSE
    const parseCoord = (str, isLon) => {
      const match = str.match(/(\d+)(\d{2})(\d{2}(?:\.\d+)?)[NSEW]/);
      if (!match) return null;
      
      const degrees = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseFloat(match[3]);
      const direction = str.slice(-1);
      
      let decimal = degrees + minutes / 60 + seconds / 3600;
      
      if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
      }
      
      return decimal;
    };
    
    const lat = parseCoord(latStr, false);
    const lon = parseCoord(lonStr, true);
    
    return { lat, lon };
  }

  /**
   * Récupère le contenu texte d'un élément
   */
  getTextContent(element, tagName) {
    if (!element) return null;
    
    if (tagName) {
      const child = element.querySelector(tagName);
      return child ? child.textContent : null;
    }
    
    return element.textContent;
  }

  /**
   * Convertit les points VFR en features GeoJSON
   */
  toGeoJSON() {
    return this.vfrPoints.map(point => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.coordinates.lon, point.coordinates.lat]
      },
      properties: {
        name: point.name,
        description: point.description,
        type: 'VFR',
        vfrType: point.type,
        aerodrome: point.aerodrome,
        identification: point.id,
        reference: point.reference
      }
    }));
  }
}

// Export singleton
export const vfrPointsExtractor = new VFRPointsExtractor();