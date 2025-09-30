// src/utils/vacDataExtractorEnhanced.js

/**
 * Version améliorée de l'extraction automatique des données VAC
 * Utilise des patterns plus avancés et des méthodes d'extraction multiples
 */

export class VACDataExtractorEnhanced {
  constructor() {
    // Patterns améliorés pour extraire les données
    this.patterns = {
      // === DATES - Patterns étendus ===
      publicationDate: [
        // Patterns AIRAC standards
        /(?:AIRAC|Cycle)[\s:-]*(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/i,
        /(?:AIRAC|Cycle)[\s:-]*(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/i,
        /AMDT\s+(\d{1,2})\/(\d{2,4})\s+(\d{1,2}[\/\-]\w{3}[\/\-]\d{2,4})/i,
        
        // Patterns avec mois littéraux
        /(\d{1,2})[\s\/-](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JANVIER|FÉVRIER|MARS|AVRIL|MAI|JUIN|JUILLET|AOÛT|SEPTEMBRE|OCTOBRE|NOVEMBRE|DÉCEMBRE)[\s\/-](\d{4})/i,
        /(\w{3,})\s+(\d{1,2}),?\s+(\d{4})/i, // Format anglais
        
        // Patterns avec mots clés
        /(?:Date|MAJ|Mise à jour|Updated?|Effective|Validité|Valid from|WEF)[\s:]*(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/i,
        /(?:Publication|Publié|Published)[\s:]*(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/i,
        
        // Patterns généraux
        /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/i,
        /(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/i, // Format ISO
      ],
      
      // === ALTITUDE - Patterns améliorés ===
      elevation: [
        /(?:ALT|ALTITUDE|Altitude|Élévation|Elevation|ELEV)[\s:]*(\d{1,4})[\s']?(?:ft|FT|m|M)?/i,
        /(?:Terrain|Field)[\s:]?(?:elevation|élévation)?[\s:]*(\d{1,4})[\s']?(?:ft|FT|m)?/i,
        /(?:AD|Aerodrome|Aérodrome)[\s:]?(?:ELEV|elevation)[\s:]*(\d{1,4})/i,
        /(\d{3,4})[\s']?ft[\s\/]?\(?(\d{3,4})[\s']?m\)?/i, // Format dual ft/m
      ],
      
      // === TOUR DE PISTE - Patterns améliorés ===
      circuitAltitude: [
        /(?:TDP|TOUR DE PISTE|Circuit|Pattern|Traffic Pattern)[\s:]*(\d{3,4})[\s']?(?:ft|FT|AAL|AMSL)?/i,
        /(?:Circuit|Pattern)[\s:]?(?:altitude|height)[\s:]*(\d{3,4})/i,
        /(?:VFR Circuit|Circuit VFR)[\s:]*(\d{3,4})/i,
        /Altitude[\s:]?(?:circuit|tour)[\s:]*(\d{3,4})/i,
      ],
      
      // === PISTES - Patterns améliorés ===
      runway: [
        /(?:RWY|PISTE|Piste|Runway)?[\s]?(\d{2}[LRC]?\/\d{2}[LRC]?)[\s:]*(\d{3,4})[\s]?[xX×][\s]?(\d{2,3})/g,
        /(?:RWY|PISTE)[\s]?(\d{2}[LRC]?)[\s:]*(\d{3,4})[\s]?(?:m|M)[\s]?[xX×][\s]?(\d{2,3})[\s]?(?:m|M)?/g,
        /(\d{2}[LRC]?\/\d{2}[LRC]?)[\s:]*LDA[\s:]*(\d{3,4})[\s]?(?:m|M)?/g, // LDA (Landing Distance Available)
        /(\d{2}[LRC]?\/\d{2}[LRC]?)[\s:]*TORA[\s:]*(\d{3,4})[\s]?(?:m|M)?/g, // TORA (Take-Off Run Available)
      ],
      
      // === QFU/ORIENTATIONS - Patterns améliorés ===
      qfu: [
        /(?:QFU|THR|Threshold|Seuil)[\s]?(\d{2}[LRC]?)[\s:]*(\d{3})°?/gi,
        /(?:RWY|Piste)[\s]?(\d{2}[LRC]?)[\s:]*(?:heading|cap|orientation)[\s:]*(\d{3})°?/gi,
        /(?:Magnetic|Magnétique)[\s:]?(?:bearing|orientation)[\s:]?(\d{2}[LRC]?)[\s:]*(\d{3})°?/gi,
      ],
      
      // === FRÉQUENCES - Patterns étendus ===
      frequencies: {
        twr: [
          /(?:TWR|TOUR|Tower)[\s:]*(\d{3}[.,]\d{3})/i,
          /(?:Control|Contrôle)[\s:]*(\d{3}[.,]\d{3})/i,
        ],
        gnd: [
          /(?:GND|SOL|Ground)[\s:]*(\d{3}[.,]\d{3})/i,
          /(?:Taxi|Roulage)[\s:]*(\d{3}[.,]\d{3})/i,
        ],
        atis: /(?:ATIS)[\s:]*(\d{3}[.,]\d{3})/i,
        afis: /(?:AFIS|A\/A)[\s:]*(\d{3}[.,]\d{3})/i,
        app: [
          /(?:APP|Approche|Approach)[\s:]*(\d{3}[.,]\d{3})/i,
          /(?:Radar|RAD)[\s:]*(\d{3}[.,]\d{3})/i,
        ],
        info: /(?:INFO|Information)[\s:]*(\d{3}[.,]\d{3})/i,
        delivery: /(?:DEL|Delivery|Prévol)[\s:]*(\d{3}[.,]\d{3})/i,
        emergency: /(?:Emergency|Urgence|121\.5)/i,
      },
      
      // === COORDONNÉES - Patterns améliorés ===
      coordinates: {
        lat: [
          /(?:LAT|Latitude)[\s:]*(\d{2})°?[\s]?(\d{2})'?[\s]?(\d{2}(?:\.\d+)?)?\"?[\s]?([NS])/i,
          /(\d{2})[\s]?(\d{2})[\s]?(\d{2}(?:\.\d+)?)[\s]?([NS])/,
          /([NS])[\s:]?(\d{2})°?[\s]?(\d{2})'?[\s]?(\d{2}(?:\.\d+)?)?\"?/i,
        ],
        lon: [
          /(?:LON|LONG|Longitude)[\s:]*(\d{3})°?[\s]?(\d{2})'?[\s]?(\d{2}(?:\.\d+)?)?\"?[\s]?([EW])/i,
          /(\d{3})[\s]?(\d{2})[\s]?(\d{2}(?:\.\d+)?)[\s]?([EW])/,
          /([EW])[\s:]?(\d{3})°?[\s]?(\d{2})'?[\s]?(\d{2}(?:\.\d+)?)?\"?/i,
        ],
        arp: /ARP[\s:]*(\d{2}°?\d{2}'?\d{2}\"?[NS])[\s,]*(\d{3}°?\d{2}'?\d{2}\"?[EW])/i, // Aerodrome Reference Point
      },
      
      // === SURFACES - Patterns étendus ===
      surface: {
        asphalt: /(?:Asphalte|Asphalt|Bitume|ASPH|Enrobé)/i,
        concrete: /(?:Béton|Concrete|CONC)/i,
        grass: /(?:Herbe|Grass|Gazon|GRASS|Non revêtue)/i,
        gravel: /(?:Gravier|Gravel|GRVL)/i,
        composite: /(?:Composite|Mixed|Mixte)/i,
      },
      
      // === POINTS VFR - Patterns améliorés ===
      vfrPoints: [
        /([NSEW][EW]?)\s*:\s*([A-Z][a-z]+)[\s-]+(.+?)(?:\n|$)/g,
        /Point\s+([NSEW][EW]?)\s*[\s:-]+(.+?)(?:\n|$)/g,
        /(?:VFR|VRP)\s+([A-Z]+)\s*:\s*(.+?)(?:\n|$)/g,
        /(?:Entrée|Entry|Sortie|Exit)\s+([NSEW][EW]?)\s*:\s*(.+?)(?:\n|$)/g,
      ],
      
      // === OBSTACLES - Patterns améliorés ===
      obstacles: [
        /(?:Obstacle|Antenne|Pylône|Éolienne|Tour|Château d'eau|Mast|Tower|Wind turbine)[\s:]+(\d{2,4})\s*(?:ft|m)[\s\/]*(?:\((\d{2,4})\s*(?:ft|m)\))?/gi,
        /(?:Cheminée|Chimney|Stack)[\s:]+(\d{2,4})\s*(?:ft|m)/gi,
        /(?:Ligne|Line|Cable|Câble)[\s:]?(?:HT|électrique|power)?[\s:]+(\d{2,4})\s*(?:ft|m)/gi,
      ],
      
      // === SERVICES - Nouveaux patterns ===
      services: {
        fuel: /(?:Fuel|Carburant|AVGAS|JET[\s-]?A1?)[\s:]+(?:Available|Disponible|YES|OUI)/i,
        customs: /(?:Customs|Douane|CIQ)[\s:]+(?:Available|Disponible|H24|HX|HR|PPR)/i,
        handling: /(?:Handling|Assistance)[\s:]+(?:Available|Disponible)/i,
        parking: /(?:Parking|Stationnement)[\s:]+(\d+)\s*(?:positions?|places?)/i,
      },
      
      // === HORAIRES - Nouveaux patterns ===
      operatingHours: [
        /(?:Operating hours|Horaires?|Hours)[\s:]+(.+?)(?:\n|$)/i,
        /(?:H24|HJ|HN|SR[\s-]SS|PPR)/g,
        /(?:Lundi|Monday|Lun)[\s-]+(?:Vendredi|Friday|Ven)[\s:]+(\d{2}:\d{2})[\s-]+(\d{2}:\d{2})/i,
      ],
      
      // === PROCÉDURES - Nouveaux patterns ===
      procedures: {
        departure: /(?:Départ|Departure|DEP)[\s:]+(.+?)(?:\n|$)/gi,
        arrival: /(?:Arrivée|Arrival|ARR)[\s:]+(.+?)(?:\n|$)/gi,
        circuit: /(?:Circuit|Pattern|Tour de piste)[\s:]+(.+?)(?:\n|$)/gi,
      },
    };
  }

  /**
   * Méthode principale d'extraction améliorée
   * Utilise plusieurs passes et techniques d'extraction
   */
  extractFromText(text, icao, options = {}) {
    if (!text) return this.getDefaultData();
    
    // Options d'extraction
    const {
      deepAnalysis = true,      // Analyse approfondie
      contextual = true,        // Analyse contextuelle
      multiPass = true,         // Plusieurs passes d'extraction
      confidence = 0.7,         // Niveau de confiance minimum
    } = options;
    
    // Normaliser le texte
    const normalizedText = this.normalizeText(text);
    
    // Première passe : extraction standard
    let extractedData = this.standardExtraction(normalizedText, icao);
    
    // Deuxième passe : extraction contextuelle
    if (contextual) {
      extractedData = this.contextualExtraction(normalizedText, extractedData, icao);
    }
    
    // Troisième passe : analyse approfondie
    if (deepAnalysis) {
      extractedData = this.deepAnalysis(normalizedText, extractedData, icao);
    }
    
    // Quatrième passe : validation et correction
    if (multiPass) {
      extractedData = this.validateAndCorrect(extractedData, normalizedText);
    }
    
    // Calculer le score de confiance
    extractedData.confidenceScore = this.calculateConfidence(extractedData);
    extractedData.extractionMethod = 'enhanced';
    
    return extractedData;
  }

  /**
   * Normalise le texte pour une meilleure extraction
   */
  normalizeText(text) {
    let normalized = text
      .replace(/\r\n/g, '\n')           // Normaliser les retours à la ligne
      .replace(/\n{3,}/g, '\n\n')       // Limiter les sauts de ligne
      .replace(/\t/g, ' ')              // Remplacer les tabs par des espaces
      .replace(/\s{2,}/g, ' ')          // Réduire les espaces multiples
      .replace(/['']/g, "'")            // Normaliser les apostrophes
      .replace(/[""]/g, '"')            // Normaliser les guillemets
      .toUpperCase();                    // Mettre en majuscules pour certaines recherches
    
    // Garder aussi une version avec la casse originale
    this.originalText = text;
    
    return normalized;
  }

  /**
   * Extraction standard (première passe)
   */
  standardExtraction(text, icao) {
    return {
      // Date de publication
      publicationDate: this.extractPublicationDate(text),
      
      // Informations de base
      airportElevation: this.extractElevation(text),
      circuitAltitude: this.extractCircuitAltitude(text),
      magneticVariation: this.extractMagneticVariation(text),
      
      // Infrastructure
      runways: this.extractRunways(text),
      
      // Communications
      frequencies: this.extractFrequencies(text),
      
      // Navigation
      vfrPoints: this.extractVFRPoints(text, icao),
      coordinates: this.extractCoordinates(text),
      
      // Obstacles et dangers
      obstacles: this.extractObstacles(text),
      
      // Services
      services: this.extractServices(text),
      
      // Procédures
      procedures: this.extractProcedures(text),
      
      // Horaires
      operatingHours: this.extractOperatingHours(text),
      
      // Métadonnées
      autoExtracted: true,
      extractionDate: new Date().toISOString(),
      needsManualExtraction: true,
    };
  }

  /**
   * Extraction contextuelle (deuxième passe)
   * Utilise le contexte pour améliorer l'extraction
   */
  contextualExtraction(text, data, icao) {
    const enhanced = { ...data };
    
    // Améliorer l'extraction des pistes en utilisant le contexte
    if (enhanced.runways.length > 0) {
      enhanced.runways = enhanced.runways.map(runway => {
        const context = this.getContextAround(text, runway.identifier, 200);
        
        // Chercher des informations supplémentaires dans le contexte
        runway.surface = runway.surface || this.detectSurface(context, runway.identifier);
        runway.lighting = runway.lighting || this.detectLighting(context, runway.identifier);
        runway.ils = runway.ils !== undefined ? runway.ils : this.detectILS(context, runway.identifier);
        runway.slope = this.extractSlope(context) || runway.slope;
        
        // Extraire les distances déclarées
        runway.lda = this.extractDistance(context, 'LDA');
        runway.toda = this.extractDistance(context, 'TODA');
        runway.tora = this.extractDistance(context, 'TORA');
        runway.asda = this.extractDistance(context, 'ASDA');
        
        return runway;
      });
    }
    
    // Améliorer l'extraction des points VFR avec le contexte
    if (enhanced.vfrPoints.length > 0) {
      enhanced.vfrPoints = enhanced.vfrPoints.map(point => {
        const context = this.getContextAround(text, point.code, 150);
        
        // Extraire les coordonnées si présentes dans le contexte
        const coords = this.extractCoordinatesFromContext(context);
        if (coords) {
          point.coordinates = coords;
        }
        
        // Déterminer si le point est obligatoire
        point.mandatory = this.isVFRPointMandatory(point.code, context);
        
        // Extraire l'altitude si présente
        const altMatch = context.match(/(\d{3,4})\s*(?:ft|FT)/);
        if (altMatch) {
          point.altitude = parseInt(altMatch[1]);
        }
        
        return point;
      });
    }
    
    return enhanced;
  }

  /**
   * Analyse approfondie (troisième passe)
   * Utilise des techniques avancées pour extraire plus d'informations
   */
  deepAnalysis(text, data, icao) {
    const enhanced = { ...data };
    
    // Analyse des sections du document
    const sections = this.identifySections(text);
    
    // Extraire les informations par section
    if (sections.generalInfo) {
      const generalData = this.extractFromSection(sections.generalInfo, 'general');
      enhanced.airportName = generalData.name || enhanced.airportName;
      enhanced.airportType = generalData.type || enhanced.airportType;
    }
    
    if (sections.communications) {
      const commData = this.extractFromSection(sections.communications, 'communications');
      enhanced.frequencies = { ...enhanced.frequencies, ...commData.frequencies };
      enhanced.callsign = commData.callsign || enhanced.callsign;
    }
    
    if (sections.procedures) {
      const procData = this.extractFromSection(sections.procedures, 'procedures');
      enhanced.procedures = { ...enhanced.procedures, ...procData };
    }
    
    if (sections.remarks) {
      enhanced.remarks = this.extractRemarks(sections.remarks);
    }
    
    // Analyse des patterns récurrents
    enhanced.patterns = this.analyzePatterns(text);
    
    // Extraction des zones particulières
    enhanced.specialZones = this.extractSpecialZones(text);
    
    // Extraction des minima
    enhanced.minima = this.extractMinima(text);
    
    return enhanced;
  }

  /**
   * Validation et correction (quatrième passe)
   */
  validateAndCorrect(data, text) {
    const validated = { ...data };
    
    // Valider les coordonnées
    if (validated.coordinates) {
      validated.coordinates = this.validateCoordinates(validated.coordinates);
    }
    
    // Valider les fréquences
    if (validated.frequencies) {
      validated.frequencies = this.validateFrequencies(validated.frequencies);
    }
    
    // Corriger les altitudes incohérentes
    if (validated.circuitAltitude && validated.airportElevation) {
      if (validated.circuitAltitude < validated.airportElevation) {
        // Tour de piste probablement en AAL (Above Aerodrome Level)
        validated.circuitAltitude = validated.airportElevation + validated.circuitAltitude;
      }
    }
    
    // Valider les dates
    if (validated.publicationDate) {
      validated.publicationDate = this.validateDate(validated.publicationDate);
    }
    
    return validated;
  }

  /**
   * Identifie les sections du document
   */
  identifySections(text) {
    const sections = {};
    
    // Patterns pour identifier les sections
    const sectionPatterns = {
      generalInfo: /(?:INFORMATIONS? GÉNÉRALES?|GENERAL INFORMATION|CARACTÉRISTIQUES)/i,
      communications: /(?:COMMUNICATIONS?|FRÉQUENCES?|FREQUENCIES)/i,
      procedures: /(?:PROCÉDURES?|PROCEDURES?|CONSIGNES)/i,
      remarks: /(?:REMARQUES?|REMARKS?|NOTES?|OBSERVATIONS?)/i,
      runways: /(?:PISTES?|RUNWAYS?|CARACTÉRISTIQUES? DES? PISTES?)/i,
      navigation: /(?:NAVIGATION|AIDES? À LA NAVIGATION|NAV AIDS)/i,
    };
    
    const lines = text.split('\n');
    let currentSection = null;
    let sectionContent = {};
    
    lines.forEach((line, index) => {
      // Vérifier si c'est un titre de section
      for (const [section, pattern] of Object.entries(sectionPatterns)) {
        if (pattern.test(line)) {
          currentSection = section;
          sectionContent[section] = [];
          break;
        }
      }
      
      // Ajouter le contenu à la section courante
      if (currentSection && sectionContent[currentSection]) {
        sectionContent[currentSection].push(line);
      }
    });
    
    // Convertir les tableaux en texte
    for (const section in sectionContent) {
      sections[section] = sectionContent[section].join('\n');
    }
    
    return sections;
  }

  /**
   * Extrait les informations d'une section spécifique
   */
  extractFromSection(sectionText, sectionType) {
    const data = {};
    
    switch (sectionType) {
      case 'general':
        data.name = this.extractAirportName(sectionText);
        data.type = this.extractAirportType(sectionText);
        break;
        
      case 'communications':
        data.frequencies = this.extractFrequencies(sectionText);
        data.callsign = this.extractCallsign(sectionText);
        break;
        
      case 'procedures':
        data.departure = this.extractDepartureProcedures(sectionText);
        data.arrival = this.extractArrivalProcedures(sectionText);
        data.circuit = this.extractCircuitProcedures(sectionText);
        break;
    }
    
    return data;
  }

  /**
   * Calcule un score de confiance pour l'extraction
   */
  calculateConfidence(data) {
    let score = 0;
    let totalFields = 0;
    
    // Vérifier les champs essentiels
    const essentialFields = [
      'airportElevation',
      'runways',
      'frequencies',
      'publicationDate'
    ];
    
    essentialFields.forEach(field => {
      totalFields++;
      if (data[field]) {
        if (Array.isArray(data[field]) && data[field].length > 0) {
          score++;
        } else if (typeof data[field] === 'object' && Object.keys(data[field]).length > 0) {
          score++;
        } else if (data[field]) {
          score++;
        }
      }
    });
    
    // Vérifier les champs optionnels
    const optionalFields = [
      'circuitAltitude',
      'vfrPoints',
      'obstacles',
      'services',
      'procedures'
    ];
    
    optionalFields.forEach(field => {
      totalFields += 0.5; // Poids réduit pour les champs optionnels
      if (data[field]) {
        if (Array.isArray(data[field]) && data[field].length > 0) {
          score += 0.5;
        } else if (typeof data[field] === 'object' && Object.keys(data[field]).length > 0) {
          score += 0.5;
        } else if (data[field]) {
          score += 0.5;
        }
      }
    });
    
    return totalFields > 0 ? score / totalFields : 0;
  }

  // === MÉTHODES D'EXTRACTION SPÉCIFIQUES ===

  /**
   * Extrait les services disponibles
   */
  extractServices(text) {
    const services = {};
    
    for (const [service, pattern] of Object.entries(this.patterns.services)) {
      const match = text.match(pattern);
      if (match) {
        services[service] = match[1] || true;
      }
    }
    
    return services;
  }

  /**
   * Extrait les procédures
   */
  extractProcedures(text) {
    const procedures = {};
    
    for (const [type, pattern] of Object.entries(this.patterns.procedures)) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        procedures[type] = matches.map(m => m[1].trim());
      }
    }
    
    return procedures;
  }

  /**
   * Extrait les horaires d'ouverture
   */
  extractOperatingHours(text) {
    for (const pattern of this.patterns.operatingHours) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  }

  /**
   * Extrait les coordonnées
   */
  extractCoordinates(text) {
    const coords = {};
    
    // Essayer les différents patterns de latitude
    for (const pattern of this.patterns.coordinates.lat) {
      const match = text.match(pattern);
      if (match) {
        coords.lat = this.parseCoordinate(match, 'lat');
        break;
      }
    }
    
    // Essayer les différents patterns de longitude
    for (const pattern of this.patterns.coordinates.lon) {
      const match = text.match(pattern);
      if (match) {
        coords.lon = this.parseCoordinate(match, 'lon');
        break;
      }
    }
    
    // Essayer le pattern ARP (Aerodrome Reference Point)
    const arpMatch = text.match(this.patterns.coordinates.arp);
    if (arpMatch) {
      // Parser les coordonnées ARP
      coords.lat = this.parseARPCoordinate(arpMatch[1], 'lat');
      coords.lon = this.parseARPCoordinate(arpMatch[2], 'lon');
    }
    
    return coords.lat && coords.lon ? coords : null;
  }

  /**
   * Parse une coordonnée en degrés décimaux
   */
  parseCoordinate(match, type) {
    let deg, min, sec, dir;
    
    if (match[4]) {
      // Format standard avec direction à la fin
      deg = parseInt(match[1]);
      min = parseInt(match[2]);
      sec = parseFloat(match[3] || 0);
      dir = match[4];
    } else if (match[1] && /[NSEW]/.test(match[1])) {
      // Format avec direction au début
      dir = match[1];
      deg = parseInt(match[2]);
      min = parseInt(match[3]);
      sec = parseFloat(match[4] || 0);
    }
    
    if (!deg || !dir) return null;
    
    let decimal = deg + min / 60 + sec / 3600;
    
    // Appliquer le signe selon la direction
    if (dir === 'S' || dir === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }

  /**
   * Extrait la pente d'une piste
   */
  extractSlope(text) {
    const slopePattern = /(?:Slope|Pente)[\s:]*([+-]?\d+\.?\d*)%?/i;
    const match = text.match(slopePattern);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Extrait une distance déclarée
   */
  extractDistance(text, type) {
    const pattern = new RegExp(`${type}[\\s:]*?(\\d{3,4})[\\s]?(?:m|M)?`, 'i');
    const match = text.match(pattern);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Extrait les zones particulières
   */
  extractSpecialZones(text) {
    const zones = [];
    const patterns = [
      /(?:Zone|Area)[\s]+([PD])[\s:]+(.+?)(?:\n|$)/gi,
      /(?:CTR|TMA|ATZ)[\s:]+(.+?)(?:\n|$)/gi,
      /(?:Prohibited|Danger|Restricted)[\s]+(?:zone|area)[\s:]+(.+?)(?:\n|$)/gi,
    ];
    
    patterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        zones.push({
          type: match[1] || 'Special',
          description: match[2] || match[1],
        });
      });
    });
    
    return zones;
  }

  /**
   * Extrait les minima météorologiques
   */
  extractMinima(text) {
    const minima = {};
    
    const patterns = {
      visibility: /(?:Vis|Visibility)[\s:]?(?:min|minimum)?[\s:]*(\d{3,4})\s*m/i,
      ceiling: /(?:Ceiling|Plafond)[\s:]?(?:min|minimum)?[\s:]*(\d{3,4})\s*ft/i,
      rvr: /RVR[\s:]?(?:min|minimum)?[\s:]*(\d{3,4})\s*m/i,
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        minima[key] = parseInt(match[1]);
      }
    }
    
    return Object.keys(minima).length > 0 ? minima : null;
  }

  // ... Conserver toutes les méthodes existantes de la classe originale ...
  
  /**
   * Méthodes héritées de la version originale
   */
  
  extractPublicationDate(text) {
    // Utiliser la méthode améliorée avec plus de patterns
    const monthMap = {
      'JAN': '01', 'JANVIER': '01', 'JANUARY': '01', 'JAN.': '01',
      'FEB': '02', 'FÉVRIER': '02', 'FÉV': '02', 'FEBRUARY': '02', 'FEB.': '02', 'FEVR': '02',
      'MAR': '03', 'MARS': '03', 'MARCH': '03', 'MAR.': '03',
      'APR': '04', 'AVRIL': '04', 'AVR': '04', 'APRIL': '04', 'APR.': '04',
      'MAY': '05', 'MAI': '05', 'MAY.': '05',
      'JUN': '06', 'JUIN': '06', 'JUNE': '06', 'JUN.': '06',
      'JUL': '07', 'JUILLET': '07', 'JUIL': '07', 'JULY': '07', 'JUL.': '07',
      'AUG': '08', 'AOÛT': '08', 'AOU': '08', 'AUGUST': '08', 'AUG.': '08', 'AOUT': '08',
      'SEP': '09', 'SEPTEMBRE': '09', 'SEPT': '09', 'SEPTEMBER': '09', 'SEP.': '09', 'SEPT.': '09',
      'OCT': '10', 'OCTOBRE': '10', 'OCTOBER': '10', 'OCT.': '10',
      'NOV': '11', 'NOVEMBRE': '11', 'NOVEMBER': '11', 'NOV.': '11',
      'DEC': '12', 'DÉCEMBRE': '12', 'DÉC': '12', 'DECEMBER': '12', 'DEC.': '12'
    };
    
    // Essayer chaque pattern de date
    for (const pattern of this.patterns.publicationDate) {
      const match = text.match(pattern);
      if (match) {
        let year, month, day;
        
        // Analyser selon le pattern trouvé
        if (pattern.source.includes('AIRAC')) {
          if (match[1].length === 4) {
            year = match[1];
            month = match[2].padStart(2, '0');
            day = match[3].padStart(2, '0');
          } else {
            day = match[1].padStart(2, '0');
            month = match[2].padStart(2, '0');
            year = match[3];
          }
        } else if (match[2] && monthMap[match[2].toUpperCase()]) {
          day = match[1].padStart(2, '0');
          month = monthMap[match[2].toUpperCase()];
          year = match[3];
        } else if (match[1] && monthMap[match[1].toUpperCase()]) {
          month = monthMap[match[1].toUpperCase()];
          day = match[2].padStart(2, '0');
          year = match[3];
        } else if (match[1] && match[2] && match[3]) {
          if (match[1].length === 4) {
            year = match[1];
            month = match[2].padStart(2, '0');
            day = match[3].padStart(2, '0');
          } else {
            day = match[1].padStart(2, '0');
            month = match[2].padStart(2, '0');
            year = match[3];
          }
          
          // Vérifier si c'est MM/DD/YYYY (format US)
          if (parseInt(month) > 12 && parseInt(day) <= 12) {
            [day, month] = [month, day];
          }
        }
        
        // Ajuster l'année si nécessaire
        if (year && year.length === 2) {
          year = parseInt(year) > 50 ? '19' + year : '20' + year;
        }
        
        // Valider et retourner la date
        if (year && month && day) {
          const dateStr = `${year}-${month}-${day}`;
          const date = new Date(dateStr);
          
          // Vérifier que la date est valide et raisonnable
          if (date instanceof Date && !isNaN(date) && 
              date.getFullYear() >= 2000 && date.getFullYear() <= 2030) {
            return dateStr;
          }
        }
      }
    }
    
    return null;
  }

  extractElevation(text) {
    for (const pattern of this.patterns.elevation) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1]);
      }
    }
    return 0;
  }

  extractCircuitAltitude(text) {
    for (const pattern of this.patterns.circuitAltitude) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1]);
      }
    }
    // Si pas trouvé, essayer altitude terrain + 1000ft
    const elevation = this.extractElevation(text);
    return elevation > 0 ? elevation + 1000 : 0;
  }

  extractRunways(text) {
    const runways = [];
    const seenRunways = new Set();
    
    for (const pattern of this.patterns.runway) {
      const matches = [...text.matchAll(pattern)];
      
      matches.forEach(match => {
        if (match[1] && match[2]) {
          const identifier = match[1];
          
          // Éviter les doublons
          if (seenRunways.has(identifier)) return;
          seenRunways.add(identifier);
          
          const length = parseInt(match[2]);
          const width = parseInt(match[3]) || 0;
          
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
    }
    
    return runways;
  }

  extractFrequencies(text) {
    const frequencies = {};
    
    Object.entries(this.patterns.frequencies).forEach(([type, patterns]) => {
      const patternArray = Array.isArray(patterns) ? patterns : [patterns];
      
      for (const pattern of patternArray) {
        const match = text.match(pattern);
        if (match && match[1]) {
          // Normaliser le format (remplacer virgule par point)
          frequencies[type] = match[1].replace(',', '.');
          break;
        }
      }
    });
    
    return frequencies;
  }

  extractMagneticVariation(text) {
    const patterns = [
      /(?:VAR|Variation|Déclinaison)[\s:]*(\d{1,2})[°]?[\s]?([EW])/i,
      /Magnetic[\s:]?variation[\s:]*(\d{1,2})[°]?[\s]?([EW])/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = parseInt(match[1]);
        const direction = match[2];
        return direction === 'W' ? -value : value;
      }
    }
    
    return 2; // Valeur par défaut pour la France
  }

  extractVFRPoints(text, icao) {
    const points = [];
    const seenPoints = new Set();
    
    for (const pattern of this.patterns.vfrPoints) {
      const matches = [...text.matchAll(pattern)];
      
      matches.forEach(match => {
        let code, name, description;
        
        if (match.length === 4) {
          code = match[1];
          name = match[2];
          description = match[3];
        } else if (match.length === 3) {
          code = match[1];
          description = match[2];
          name = code;
        }
        
        if (code && !seenPoints.has(code)) {
          seenPoints.add(code);
          
          points.push({
            id: `${icao}-${code}`,
            code,
            name: name || code,
            description: description ? description.trim() : '',
            mandatory: this.isVFRPointMandatory(code),
            coordinates: { lat: 0, lon: 0 },
            altitude: 0,
            source: 'VAC'
          });
        }
      });
    }
    
    return points;
  }

  extractObstacles(text) {
    const obstacles = [];
    const seenObstacles = new Set();
    
    for (const pattern of this.patterns.obstacles) {
      const matches = [...text.matchAll(pattern)];
      
      matches.forEach((match, idx) => {
        if (match[0] && match[1]) {
          const description = match[0];
          
          // Éviter les doublons
          const key = `${match[1]}-${idx}`;
          if (seenObstacles.has(key)) return;
          seenObstacles.add(key);
          
          const type = this.detectObstacleType(description);
          const height = parseInt(match[1]);
          const elevation = match[2] ? parseInt(match[2]) : 0;
          
          obstacles.push({
            type,
            height,
            elevation,
            distance: 0,
            bearing: 0,
            lit: type === 'Antenne' || type === 'Pylône' || type === 'Éolienne',
            description
          });
        }
      });
    }
    
    return obstacles;
  }

  detectSurface(text, runway) {
    const context = this.getContextAround(text, runway, 100);
    
    for (const [surface, pattern] of Object.entries(this.patterns.surface)) {
      if (pattern.test(context)) {
        return surface.charAt(0).toUpperCase() + surface.slice(1);
      }
    }
    
    return 'Revêtue';
  }

  detectLighting(text, runway) {
    const context = this.getContextAround(text, runway, 150);
    
    const lightingPatterns = [
      { pattern: /PAPI/i, type: 'PAPI' },
      { pattern: /VASI/i, type: 'VASI' },
      { pattern: /APAPI/i, type: 'APAPI' },
      { pattern: /T-VASIS/i, type: 'T-VASIS' },
      { pattern: /(?:HI|HIRL|haute intensité)/i, type: 'Haute intensité' },
      { pattern: /(?:MI|MIRL|moyenne intensité)/i, type: 'Moyenne intensité' },
      { pattern: /(?:LI|LIRL|basse intensité|low)/i, type: 'Basse intensité' },
      { pattern: /(?:non éclairée|pas d'éclairage|no light|unlit)/i, type: 'Non éclairée' },
    ];
    
    for (const { pattern, type } of lightingPatterns) {
      if (pattern.test(context)) {
        return type;
      }
    }
    
    return 'Basse intensité';
  }

  detectILS(text, runway) {
    const context = this.getContextAround(text, runway, 150);
    return /(?:ILS|LOC|DME|VOR)/i.test(context);
  }

  detectObstacleType(text) {
    const types = {
      'antenne': 'Antenne',
      'pylône': 'Pylône',
      'éolienne|wind': 'Éolienne',
      'château d\'eau|water tower': 'Château d\'eau',
      'tour|tower': 'Tour',
      'cheminée|chimney': 'Cheminée',
      'grue|crane': 'Grue',
      'silo': 'Silo',
      'ligne|cable': 'Ligne électrique',
    };
    
    const lowerText = text.toLowerCase();
    for (const [pattern, type] of Object.entries(types)) {
      if (new RegExp(pattern).test(lowerText)) {
        return type;
      }
    }
    
    return 'Obstacle';
  }

  isVFRPointMandatory(code, context = '') {
    // Points cardinaux simples généralement obligatoires
    if (['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'].includes(code)) {
      return true;
    }
    
    // Vérifier dans le contexte si mentionné comme obligatoire
    if (context) {
      return /(?:obligatoire|mandatory|compulsory)/i.test(context);
    }
    
    return false;
  }

  getContextAround(text, word, chars = 100) {
    const index = text.indexOf(word);
    if (index === -1) return '';
    
    const start = Math.max(0, index - chars);
    const end = Math.min(text.length, index + word.length + chars);
    
    return text.substring(start, end);
  }

  extractCoordinatesFromContext(context) {
    // Essayer d'extraire des coordonnées du contexte
    const coords = this.extractCoordinates(context);
    return coords;
  }

  validateCoordinates(coords) {
    if (!coords || !coords.lat || !coords.lon) return null;
    
    // Vérifier que les coordonnées sont dans des limites raisonnables
    if (Math.abs(coords.lat) > 90 || Math.abs(coords.lon) > 180) {
      return null;
    }
    
    // Pour la France métropolitaine (approximatif)
    if (coords.lat < 41 || coords.lat > 52 || coords.lon < -6 || coords.lon > 10) {
      console.warn('Coordonnées en dehors de la France métropolitaine:', coords);
    }
    
    return coords;
  }

  validateFrequencies(frequencies) {
    const validated = {};
    
    for (const [type, freq] of Object.entries(frequencies)) {
      if (typeof freq === 'string' && freq.match(/\d{3}\.\d{3}/)) {
        const numFreq = parseFloat(freq);
        
        // Vérifier que la fréquence est dans la bande VHF aéronautique
        if (numFreq >= 118.0 && numFreq <= 137.0) {
          validated[type] = freq;
        } else {
          console.warn(`Fréquence invalide pour ${type}: ${freq}`);
        }
      }
    }
    
    return validated;
  }

  validateDate(dateStr) {
    const date = new Date(dateStr);
    
    if (isNaN(date)) return null;
    
    // Vérifier que la date est raisonnable
    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    const oneYearFuture = new Date();
    oneYearFuture.setFullYear(now.getFullYear() + 1);
    
    if (date < twoYearsAgo || date > oneYearFuture) {
      console.warn('Date suspecte:', dateStr);
    }
    
    return dateStr;
  }

  parseARPCoordinate(coordStr, type) {
    // Parser une coordonnée au format ARP
    const match = coordStr.match(/(\d{2})°?(\d{2})'?(\d{2}(?:\.\d+)?)"?([NSEW])/);
    if (match) {
      return this.parseCoordinate(match, type);
    }
    return null;
  }

  extractAirportName(text) {
    const patterns = [
      /(?:Aérodrome|Airport|Aerodrome)[\s:]+(.+?)(?:\n|$)/i,
      /^([A-Z][A-Z\s-]+)(?:\n|$)/m,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    
    return null;
  }

  extractAirportType(text) {
    const types = {
      'international': /international/i,
      'regional': /régional|regional/i,
      'national': /national/i,
      'privé': /privé|private/i,
      'militaire': /militaire|military/i,
      'ouvert': /ouvert|public|open/i,
    };
    
    for (const [type, pattern] of Object.entries(types)) {
      if (pattern.test(text)) return type;
    }
    
    return 'public';
  }

  extractCallsign(text) {
    const pattern = /(?:Callsign|Indicatif)[\s:]+(.+?)(?:\n|$)/i;
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  extractDepartureProcedures(text) {
    const procedures = [];
    const patterns = [
      /(?:Départ|Departure|DEP)[\s:]+(.+?)(?:\n|$)/gi,
      /(?:SID)[\s:]+(.+?)(?:\n|$)/gi,
    ];
    
    patterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        procedures.push(match[1].trim());
      });
    });
    
    return procedures;
  }

  extractArrivalProcedures(text) {
    const procedures = [];
    const patterns = [
      /(?:Arrivée|Arrival|ARR)[\s:]+(.+?)(?:\n|$)/gi,
      /(?:STAR)[\s:]+(.+?)(?:\n|$)/gi,
    ];
    
    patterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        procedures.push(match[1].trim());
      });
    });
    
    return procedures;
  }

  extractCircuitProcedures(text) {
    const procedures = [];
    const patterns = [
      /(?:Circuit|Pattern|Tour de piste)[\s:]+(.+?)(?:\n|$)/gi,
      /(?:Main|Piste préférentielle)[\s:]+(.+?)(?:\n|$)/gi,
    ];
    
    patterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        procedures.push(match[1].trim());
      });
    });
    
    return procedures;
  }

  extractRemarks(text) {
    const remarks = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.trim().length > 10 && !line.match(/^[A-Z\s]+$/)) {
        remarks.push(line.trim());
      }
    });
    
    return remarks.slice(0, 5); // Limiter à 5 remarques
  }

  analyzePatterns(text) {
    return {
      hasCoordinates: /\d{2}°?\d{2}'?\d{2}"?[NS]/.test(text),
      hasFrequencies: /\d{3}[.,]\d{3}/.test(text),
      hasRunways: /\d{2}[LRC]?\/\d{2}[LRC]?/.test(text),
      hasAltitudes: /\d{3,4}\s*(?:ft|FT)/.test(text),
      hasDistances: /\d{3,4}\s*(?:m|M|NM)/.test(text),
    };
  }

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
      services: {},
      procedures: {},
      operatingHours: null,
      coordinates: null,
      patterns: {},
      specialZones: [],
      minima: null,
      remarks: [],
      needsManualExtraction: true,
      confidenceScore: 0,
      extractionMethod: 'enhanced'
    };
  }
}

// Export des deux versions
export const vacDataExtractorEnhanced = new VACDataExtractorEnhanced();

// Export par défaut pour compatibilité
export default vacDataExtractorEnhanced;