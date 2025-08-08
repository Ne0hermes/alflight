// src/utils/vacDataExtractor.js

/**
 * Extraction automatique des données d'une carte VAC
 * Utilise des patterns regex pour extraire les informations communes
 */

export class VACDataExtractor {
  constructor() {
    // Patterns pour extraire les données
    this.patterns = {
      // Dates de mise à jour - patterns comme "28 NOV 2024", "AIRAC 2024-11-28", "Mise à jour : 15/03/2024"
      publicationDate: [
        /(?:AIRAC|Cycle)[\s:-]*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/i, // AIRAC 2024-11-28
        /(\d{1,2})[\s\/\-](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANVIER|FÉVRIER|MARS|AVRIL|MAI|JUIN|JUILLET|AOÛT|SEPTEMBRE|OCTOBRE|NOVEMBRE|DÉCEMBRE)[\s\/\-](\d{4})/i, // 28 NOV 2024
        /(?:Date|MAJ|Mise à jour|Updated?|Effective|Validité)[:\s]*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i, // Mise à jour : 15/03/2024
        /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/i // Format général 15/03/2024
      ],
      
      // Altitude terrain - recherche de patterns comme "ALT 538 ft" ou "Altitude : 538'"
      elevation: /(?:ALT|ALTITUDE|Altitude|Élévation|Elevation|ELEV)[\s:]*(\d{1,4})[\s']?(?:ft|FT|m)?/i,
      
      // Tour de piste - patterns comme "TDP 1538 ft" ou "Circuit : 1500'"
      circuitAltitude: /(?:TDP|TOUR DE PISTE|Circuit|Pattern)[\s:]*(\d{3,4})[\s']?(?:ft|FT)?/i,
      
      // Pistes - patterns comme "07/25 1845x45" ou "RWY 07/25 1845m x 45m"
      runway: /(?:RWY|PISTE|Piste)?[\s]?(\d{2}[LRC]?\/\d{2}[LRC]?)[\s:]*(\d{3,4})[\s]?[xX×][\s]?(\d{2,3})/g,
      
      // QFU - patterns comme "QFU 070°" ou "THR 07 : 070°"
      qfu: /(?:QFU|THR|Threshold)[\s]?(\d{2}[LRC]?)[\s:]*(\d{3})°?/gi,
      
      // Fréquences - patterns pour TWR, GND, ATIS, etc.
      frequencies: {
        twr: /(?:TWR|TOUR|Tower)[\s:]*(\d{3}[.,]\d{3})/i,
        gnd: /(?:GND|SOL|Ground)[\s:]*(\d{3}[.,]\d{3})/i,
        atis: /(?:ATIS)[\s:]*(\d{3}[.,]\d{3})/i,
        afis: /(?:AFIS|A\/A)[\s:]*(\d{3}[.,]\d{3})/i,
        app: /(?:APP|Approche|Approach)[\s:]*(\d{3}[.,]\d{3})/i,
        info: /(?:INFO|Information)[\s:]*(\d{3}[.,]\d{3})/i
      },
      
      // Variation magnétique
      magneticVar: /(?:VAR|Variation|Déclinaison)[\s:]*(\d{1,2})[°]?[\s]?([EW])/i,
      
      // Coordonnées
      coordinates: {
        lat: /(?:LAT|Latitude)[\s:]*(\d{2})°?[\s]?(\d{2})'?[\s]?(\d{2}(?:\.\d+)?)?"?[\s]?([NS])/i,
        lon: /(?:LON|LONG|Longitude)[\s:]*(\d{3})°?[\s]?(\d{2})'?[\s]?(\d{2}(?:\.\d+)?)?"?[\s]?([EW])/i
      },
      
      // Surface de piste
      surface: {
        asphalt: /(?:Asphalte|Asphalt|Bitume|ASPH)/i,
        concrete: /(?:Béton|Concrete|CONC)/i,
        grass: /(?:Herbe|Grass|Gazon|GRASS)/i,
        gravel: /(?:Gravier|Gravel|GRVL)/i
      },
      
      // Points VFR - patterns comme "N : November - Château d'eau"
      vfrPoints: /([NSEW][EW]?)\s*:\s*([A-Z][a-z]+)[\s-]+(.+?)(?:\n|$)/g,
      
      // Obstacles
      obstacles: /(?:Obstacle|Antenne|Pylône|Éolienne|Tour|Château d'eau)[\s:]+(\d{2,4})\s*(?:ft|m)/gi
    };
  }

  /**
   * Extrait automatiquement les données d'un texte
   * @param {string} text - Le texte extrait de la carte VAC
   * @param {string} icao - Le code ICAO de l'aérodrome
   * @returns {object} Les données extraites
   */
  extractFromText(text, icao) {
    if (!text) return this.getDefaultData();
    
    // Normaliser le texte (remplacer les retours à la ligne multiples, etc.)
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    
    const extractedData = {
      // Date de publication/mise à jour
      publicationDate: this.extractPublicationDate(normalizedText),
      
      // Altitude terrain
      airportElevation: this.extractElevation(normalizedText),
      
      // Tour de piste
      circuitAltitude: this.extractCircuitAltitude(normalizedText),
      
      // Pistes
      runways: this.extractRunways(normalizedText),
      
      // Fréquences
      frequencies: this.extractFrequencies(normalizedText),
      
      // Variation magnétique
      magneticVariation: this.extractMagneticVariation(normalizedText),
      
      // Points VFR
      vfrPoints: this.extractVFRPoints(normalizedText, icao),
      
      // Obstacles
      obstacles: this.extractObstacles(normalizedText),
      
      // Marquer comme extraction automatique
      autoExtracted: true,
      extractionDate: new Date().toISOString(),
      needsManualExtraction: true // Toujours demander vérification manuelle
    };
    
    return extractedData;
  }

  /**
   * Extrait la date de publication/mise à jour
   */
  extractPublicationDate(text) {
    const monthMap = {
      'JAN': '01', 'JANVIER': '01', 'JANUARY': '01',
      'FEB': '02', 'FÉVRIER': '02', 'FÉV': '02', 'FEBRUARY': '02',
      'MAR': '03', 'MARS': '03', 'MARCH': '03',
      'APR': '04', 'AVRIL': '04', 'AVR': '04', 'APRIL': '04',
      'MAY': '05', 'MAI': '05',
      'JUN': '06', 'JUIN': '06', 'JUNE': '06',
      'JUL': '07', 'JUILLET': '07', 'JUIL': '07', 'JULY': '07',
      'AUG': '08', 'AOÛT': '08', 'AOU': '08', 'AUGUST': '08',
      'SEP': '09', 'SEPTEMBRE': '09', 'SEPT': '09', 'SEPTEMBER': '09',
      'OCT': '10', 'OCTOBRE': '10', 'OCTOBER': '10',
      'NOV': '11', 'NOVEMBRE': '11', 'NOVEMBER': '11',
      'DEC': '12', 'DÉCEMBRE': '12', 'DÉC': '12', 'DECEMBER': '12'
    };
    
    // Essayer chaque pattern de date
    for (const pattern of this.patterns.publicationDate) {
      const match = text.match(pattern);
      if (match) {
        let year, month, day;
        
        // Pattern AIRAC YYYY-MM-DD
        if (pattern.source.includes('AIRAC')) {
          year = match[1];
          month = match[2].padStart(2, '0');
          day = match[3].padStart(2, '0');
        }
        // Pattern DD MON YYYY
        else if (match[2] && monthMap[match[2].toUpperCase()]) {
          day = match[1].padStart(2, '0');
          month = monthMap[match[2].toUpperCase()];
          year = match[3];
        }
        // Pattern Date: DD/MM/YYYY
        else if (pattern.source.includes('Date|MAJ')) {
          day = match[1].padStart(2, '0');
          month = match[2].padStart(2, '0');
          year = match[3];
        }
        // Pattern général DD/MM/YYYY
        else if (match[1] && match[2] && match[3]) {
          day = match[1].padStart(2, '0');
          month = match[2].padStart(2, '0');
          year = match[3];
          
          // Vérifier si c'est MM/DD/YYYY (format US)
          if (parseInt(month) > 12 && parseInt(day) <= 12) {
            [day, month] = [month, day];
          }
        }
        
        // Valider et retourner la date
        if (year && month && day) {
          const dateStr = `${year}-${month}-${day}`;
          const date = new Date(dateStr);
          
          // Vérifier que la date est valide et raisonnable (entre 2000 et 2030)
          if (date instanceof Date && !isNaN(date) && 
              date.getFullYear() >= 2000 && date.getFullYear() <= 2030) {
            return dateStr;
          }
        }
      }
    }
    
    return null; // Aucune date trouvée
  }

  /**
   * Extrait l'altitude du terrain
   */
  extractElevation(text) {
    const match = text.match(this.patterns.elevation);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
    return 0;
  }

  /**
   * Extrait l'altitude de tour de piste
   */
  extractCircuitAltitude(text) {
    const match = text.match(this.patterns.circuitAltitude);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
    // Si pas trouvé, essayer altitude terrain + 1000ft
    const elevation = this.extractElevation(text);
    return elevation > 0 ? elevation + 1000 : 0;
  }

  /**
   * Extrait les informations des pistes
   */
  extractRunways(text) {
    const runways = [];
    const matches = [...text.matchAll(this.patterns.runway)];
    
    matches.forEach(match => {
      if (match[1] && match[2] && match[3]) {
        const identifier = match[1];
        const length = parseInt(match[2]);
        const width = parseInt(match[3]);
        
        // Extraire le QFU du premier chiffre de l'identifiant
        const qfuMatch = identifier.match(/(\d{2})/);
        const qfu = qfuMatch ? parseInt(qfuMatch[1]) * 10 : 0;
        
        // Déterminer la surface
        const surface = this.detectSurface(text, identifier);
        
        runways.push({
          identifier,
          qfu,
          length,
          width,
          surface,
          lighting: this.detectLighting(text, identifier),
          ils: this.detectILS(text, identifier),
          slope: 0
        });
      }
    });
    
    return runways;
  }

  /**
   * Extrait les fréquences radio
   */
  extractFrequencies(text) {
    const frequencies = {};
    
    Object.entries(this.patterns.frequencies).forEach(([type, pattern]) => {
      const match = text.match(pattern);
      if (match && match[1]) {
        // Normaliser le format (remplacer virgule par point)
        frequencies[type] = match[1].replace(',', '.');
      }
    });
    
    return frequencies;
  }

  /**
   * Extrait la variation magnétique
   */
  extractMagneticVariation(text) {
    const match = text.match(this.patterns.magneticVar);
    if (match && match[1]) {
      const value = parseInt(match[1]);
      const direction = match[2];
      return direction === 'W' ? -value : value;
    }
    return 2; // Valeur par défaut pour la France
  }

  /**
   * Extrait les points VFR
   */
  extractVFRPoints(text, icao) {
    const points = [];
    const matches = [...text.matchAll(this.patterns.vfrPoints)];
    
    matches.forEach(match => {
      if (match[1] && match[2] && match[3]) {
        points.push({
          id: `${icao}-${match[1]}`,
          code: match[1],
          name: match[2],
          description: match[3].trim(),
          mandatory: this.isVFRPointMandatory(match[1]),
          coordinates: { lat: 0, lon: 0 }, // À compléter manuellement
          altitude: 0,
          source: 'VAC'
        });
      }
    });
    
    return points;
  }

  /**
   * Extrait les obstacles
   */
  extractObstacles(text) {
    const obstacles = [];
    const matches = [...text.matchAll(this.patterns.obstacles)];
    
    matches.forEach((match, idx) => {
      if (match[0] && match[1]) {
        const type = this.detectObstacleType(match[0]);
        obstacles.push({
          type,
          height: parseInt(match[1]),
          elevation: 0,
          distance: 0,
          bearing: 0,
          lit: type === 'Antenne' || type === 'Pylône', // Généralement balisés
          description: match[0]
        });
      }
    });
    
    return obstacles;
  }

  /**
   * Détecte le type de surface d'une piste
   */
  detectSurface(text, runway) {
    // Chercher la surface près de la mention de la piste
    const context = this.getContextAround(text, runway, 50);
    
    if (this.patterns.surface.grass.test(context)) return 'Herbe';
    if (this.patterns.surface.concrete.test(context)) return 'Béton';
    if (this.patterns.surface.gravel.test(context)) return 'Gravier';
    if (this.patterns.surface.asphalt.test(context)) return 'Asphalte';
    
    return 'Revêtue'; // Par défaut
  }

  /**
   * Détecte l'éclairage d'une piste
   */
  detectLighting(text, runway) {
    const context = this.getContextAround(text, runway, 100);
    
    if (/PAPI/i.test(context)) return 'PAPI';
    if (/VASI/i.test(context)) return 'VASI';
    if (/(?:HI|haute intensité)/i.test(context)) return 'Haute intensité';
    if (/(?:MI|moyenne intensité)/i.test(context)) return 'Moyenne intensité';
    if (/(?:LI|basse intensité)/i.test(context)) return 'Basse intensité';
    if (/(?:non éclairée|pas d'éclairage)/i.test(context)) return 'Non éclairée';
    
    return 'Basse intensité'; // Par défaut
  }

  /**
   * Détecte la présence d'ILS
   */
  detectILS(text, runway) {
    const context = this.getContextAround(text, runway, 100);
    return /ILS/i.test(context);
  }

  /**
   * Détecte le type d'obstacle
   */
  detectObstacleType(text) {
    if (/antenne/i.test(text)) return 'Antenne';
    if (/pylône/i.test(text)) return 'Pylône';
    if (/éolienne|wind/i.test(text)) return 'Éolienne';
    if (/château d'eau/i.test(text)) return 'Château d\'eau';
    if (/tour/i.test(text)) return 'Tour';
    if (/cheminée/i.test(text)) return 'Cheminée';
    return 'Obstacle';
  }

  /**
   * Détermine si un point VFR est obligatoire
   */
  isVFRPointMandatory(code) {
    // Les points cardinaux simples sont généralement obligatoires
    return ['N', 'S', 'E', 'W'].includes(code);
  }

  /**
   * Obtient le contexte autour d'un mot
   */
  getContextAround(text, word, chars = 50) {
    const index = text.indexOf(word);
    if (index === -1) return '';
    
    const start = Math.max(0, index - chars);
    const end = Math.min(text.length, index + word.length + chars);
    
    return text.substring(start, end);
  }

  /**
   * Retourne les données par défaut
   */
  getDefaultData() {
    return {
      publicationDate: null,
      airportElevation: 0,
      runways: [],
      frequencies: {
        twr: '',
        gnd: '',
        atis: ''
      },
      circuitAltitude: 0,
      magneticVariation: 2,
      vfrPoints: [],
      obstacles: [],
      needsManualExtraction: true
    };
  }
}

export const vacDataExtractor = new VACDataExtractor();