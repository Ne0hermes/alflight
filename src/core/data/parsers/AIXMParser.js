// src/core/data/parsers/AIXMParser.js
/**
 * Parser pour les données AIXM 4.5 du SIA France
 * Extrait toutes les données aéronautiques disponibles
 */

import { AIRPORT_NAMES, enrichAirportName } from '@data/airportNames';

export class AIXMParser {
  constructor() {
    this.data = {
      airports: [],
      airspaces: [],
      navaids: [],
      runways: [],
      frequencies: [],
      obstacles: [],
      routes: [],
      waypoints: []
    };
  }

  /**
   * Parse le fichier AIXM complet
   * @param {string} xmlContent - Contenu XML à parser
   * @returns {Object} Données structurées
   */
  async parseAIXM(xmlContent) {
    
    
    try {
      // Pour les gros fichiers, on utilise DOMParser natif du navigateur
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Vérifier les erreurs de parsing
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Erreur de parsing XML: ' + parserError.textContent);
      }
      
      // Extraire les différents types de données
      this.extractAirports(xmlDoc);
      this.extractAirspaces(xmlDoc);
      this.extractNavaids(xmlDoc);
      this.extractRunways(xmlDoc);
      this.extractFrequencies(xmlDoc);
      this.extractObstacles(xmlDoc);
      this.extractRoutes(xmlDoc);
      this.extractWaypoints(xmlDoc);
      
      
      
      return this.data;
    } catch (error) {
      console.error('❌ Erreur parsing AIXM:', error);
      throw error;
    }
  }

  /**
   * Extrait les aérodromes
   */
  extractAirports(xmlDoc) {
    const airports = xmlDoc.querySelectorAll('Ahp');
    
    
    airports.forEach(ahp => {
      try {
        const uid = ahp.querySelector('AhpUid');
        const icao = uid?.querySelector('codeId')?.textContent;
        const codeType = ahp.querySelector('codeType')?.textContent;
        
        if (!icao) return;
        
        // Exclure seulement les Landing Sites (LS) qui ne sont pas de vrais aérodromes
        // Garder AD (Aerodrome), AH (Airport/Heliport), HP (Heliport)
        if (codeType === 'LS') {
          return; // Ignorer les landing sites
        }
        
        // Récupérer le nom depuis l'AIXM
        let aixmName = ahp.querySelector('txtName')?.textContent || '';
        
        // Récupérer la ville
        const city = ahp.querySelector('txtNameCitySer')?.textContent || '';
        
        // Récupérer le code IATA si disponible
        const iata = ahp.querySelector('codeIata')?.textContent || '';
        
        // Utiliser la table de correspondance pour avoir le nom usuel
        let name = AIRPORT_NAMES[icao];
        
        if (!name) {
          // Si pas dans la table ET que le nom AIXM est générique
          if (aixmName === 'FRANCE' || aixmName === 'POLYNESIE FRANCAISE' || aixmName === 'NOUVELLE CALEDONIE' || !aixmName) {
            // Essayer d'autres champs
            const txtNameAlt = ahp.querySelector('txtNameAlt')?.textContent;
            const txtNameCitySer = ahp.querySelector('txtNameCitySer')?.textContent;
            name = txtNameAlt || txtNameCitySer || icao;
          } else {
            // Utiliser le nom AIXM s'il n'est pas générique
            name = aixmName;
            
            // Nettoyer le nom (enlever les doublons de code ICAO)
            if (name.startsWith(icao + ' ')) {
              name = name.substring(icao.length + 1);
            }
            
            // Enlever "FRANCE" ou d'autres pays du nom
            name = name.replace(/\s*(FRANCE|SUISSE|BELGIQUE|ALLEMAGNE|ESPAGNE|ITALIE)$/i, '');
          }
        }
        
        const airport = {
          id: icao,
          icao: icao,
          iata: iata,
          name: name,
          city: city,
          type: this.mapAirportType(ahp.querySelector('codeType')?.textContent),
          coordinates: {
            lat: this.parseCoordinate(ahp.querySelector('geoLat')?.textContent),
            lon: this.parseCoordinate(ahp.querySelector('geoLong')?.textContent)
          },
          elevation: parseFloat(ahp.querySelector('valElev')?.textContent) || 0,
          elevationUnit: ahp.querySelector('uomDistVer')?.textContent || 'FT',
          magneticVariation: parseFloat(ahp.querySelector('valMagVar')?.textContent) || 0,
          referenceTemp: parseFloat(ahp.querySelector('valRefTemp')?.textContent),
          transitionAlt: parseFloat(ahp.querySelector('valTransitionAlt')?.textContent),
          speedLimit: parseFloat(ahp.querySelector('valSpeedLimit')?.textContent),
          speedLimitAlt: parseFloat(ahp.querySelector('valSpeedLimitAlt')?.textContent),
          description: ahp.querySelector('txtDescrSite')?.textContent,
          remarks: ahp.querySelector('txtRmk')?.textContent
        };
        
        // Convertir l'élévation en pieds si nécessaire
        if (airport.elevationUnit === 'M') {
          airport.elevation = Math.round(airport.elevation * 3.28084);
        }
        
        this.data.airports.push(airport);
      } catch (error) {
        
      }
    });
  }

  /**
   * Extrait les espaces aériens
   */
  extractAirspaces(xmlDoc) {
    const airspaces = xmlDoc.querySelectorAll('Ase');
    
    
    airspaces.forEach(ase => {
      try {
        const uid = ase.querySelector('AseUid');
        const id = uid?.querySelector('codeId')?.textContent;
        const type = uid?.querySelector('codeType')?.textContent;
        
        if (!id) return;
        
        const airspace = {
          id: id,
          name: ase.querySelector('txtName')?.textContent || id,
          type: type,
          class: ase.querySelector('codeClass')?.textContent,
          lowerLimit: this.parseAltitude(
            ase.querySelector('valDistVerLower')?.textContent,
            ase.querySelector('uomDistVerLower')?.textContent,
            ase.querySelector('codeDistVerLower')?.textContent
          ),
          upperLimit: this.parseAltitude(
            ase.querySelector('valDistVerUpper')?.textContent,
            ase.querySelector('uomDistVerUpper')?.textContent,
            ase.querySelector('codeDistVerUpper')?.textContent
          ),
          geometry: this.extractAirspaceGeometry(ase),
          schedule: ase.querySelector('txtRmkWorkHr')?.textContent,
          remarks: ase.querySelector('txtRmk')?.textContent
        };
        
        this.data.airspaces.push(airspace);
      } catch (error) {
        
      }
    });
  }

  /**
   * Extrait les aides à la navigation
   */
  extractNavaids(xmlDoc) {
    // VOR
    const vors = xmlDoc.querySelectorAll('Vor');
    vors.forEach(vor => {
      try {
        const uid = vor.querySelector('VorUid');
        const id = uid?.querySelector('codeId')?.textContent;
        
        if (!id) return;
        
        this.data.navaids.push({
          id: id,
          identifier: id,
          name: vor.querySelector('txtName')?.textContent || id,
          type: 'VOR',
          frequency: parseFloat(vor.querySelector('valFreq')?.textContent),
          channel: vor.querySelector('codeChannel')?.textContent,
          coordinates: {
            lat: this.parseCoordinate(vor.querySelector('geoLat')?.textContent),
            lon: this.parseCoordinate(vor.querySelector('geoLong')?.textContent)
          },
          elevation: parseFloat(vor.querySelector('valElev')?.textContent) || 0,
          magneticVariation: parseFloat(vor.querySelector('valMagVar')?.textContent),
          range: parseFloat(vor.querySelector('valCoverageRadius')?.textContent)
        });
      } catch (error) {
        
      }
    });
    
    // NDB
    const ndbs = xmlDoc.querySelectorAll('Ndb');
    ndbs.forEach(ndb => {
      try {
        const uid = ndb.querySelector('NdbUid');
        const id = uid?.querySelector('codeId')?.textContent;
        
        if (!id) return;
        
        this.data.navaids.push({
          id: id,
          identifier: id,
          name: ndb.querySelector('txtName')?.textContent || id,
          type: 'NDB',
          frequency: parseFloat(ndb.querySelector('valFreq')?.textContent),
          coordinates: {
            lat: this.parseCoordinate(ndb.querySelector('geoLat')?.textContent),
            lon: this.parseCoordinate(ndb.querySelector('geoLong')?.textContent)
          },
          elevation: parseFloat(ndb.querySelector('valElev')?.textContent) || 0,
          range: parseFloat(ndb.querySelector('valCoverageRadius')?.textContent)
        });
      } catch (error) {
        
      }
    });
    
    // DME
    const dmes = xmlDoc.querySelectorAll('Dme');
    dmes.forEach(dme => {
      try {
        const uid = dme.querySelector('DmeUid');
        const id = uid?.querySelector('codeId')?.textContent;
        
        if (!id) return;
        
        this.data.navaids.push({
          id: id,
          identifier: id,
          name: dme.querySelector('txtName')?.textContent || id,
          type: 'DME',
          frequency: parseFloat(dme.querySelector('valFreq')?.textContent),
          channel: dme.querySelector('codeChannel')?.textContent,
          coordinates: {
            lat: this.parseCoordinate(dme.querySelector('geoLat')?.textContent),
            lon: this.parseCoordinate(dme.querySelector('geoLong')?.textContent)
          },
          elevation: parseFloat(dme.querySelector('valElev')?.textContent) || 0,
          range: parseFloat(dme.querySelector('valCoverageRadius')?.textContent)
        });
      } catch (error) {
        
      }
    });
    
    
  }

  /**
   * Extrait les pistes
   */
  extractRunways(xmlDoc) {
    const runways = xmlDoc.querySelectorAll('Rwy');
    
    
    runways.forEach(rwy => {
      try {
        const uid = rwy.querySelector('RwyUid');
        const airportId = uid?.querySelector('AhpUid > codeId')?.textContent;
        const designation = uid?.querySelector('txtDesig')?.textContent;
        
        if (!airportId || !designation) return;
        
        const runway = {
          airportId: airportId,
          designation: designation,
          dimensions: {
            length: parseFloat(rwy.querySelector('valLen')?.textContent),
            width: parseFloat(rwy.querySelector('valWid')?.textContent),
            lengthUnit: rwy.querySelector('uomDimRwy')?.textContent || 'M'
          },
          surface: rwy.querySelector('codeSfc')?.textContent,
          strength: rwy.querySelector('codeStrength')?.textContent,
          threshold: {
            lat: this.parseCoordinate(rwy.querySelector('geoLatThr')?.textContent),
            lon: this.parseCoordinate(rwy.querySelector('geoLongThr')?.textContent),
            elevation: parseFloat(rwy.querySelector('valElevThr')?.textContent)
          },
          magneticBearing: parseFloat(rwy.querySelector('valBrgMag')?.textContent),
          trueBearing: parseFloat(rwy.querySelector('valBrgTrue')?.textContent)
        };
        
        // Convertir les dimensions en mètres si nécessaire
        if (runway.dimensions.lengthUnit === 'FT') {
          runway.dimensions.length = Math.round(runway.dimensions.length * 0.3048);
          runway.dimensions.width = Math.round(runway.dimensions.width * 0.3048);
        }
        
        this.data.runways.push(runway);
      } catch (error) {
        
      }
    });
  }

  /**
   * Extrait les fréquences
   */
  extractFrequencies(xmlDoc) {
    const frequencies = xmlDoc.querySelectorAll('Fqy');
    
    
    frequencies.forEach(fqy => {
      try {
        const airportId = fqy.querySelector('AhpUid > codeId')?.textContent;
        const serv = fqy.querySelector('Ser');
        
        if (!airportId || !serv) return;
        
        this.data.frequencies.push({
          airportId: airportId,
          service: serv.querySelector('codeType')?.textContent,
          callsign: serv.querySelector('txtCallSign')?.textContent,
          frequency: parseFloat(fqy.querySelector('valFreqTrans')?.textContent),
          remarks: fqy.querySelector('txtRmk')?.textContent,
          hours: fqy.querySelector('txtRmkWorkHr')?.textContent
        });
      } catch (error) {
        
      }
    });
  }

  /**
   * Extrait les obstacles
   */
  extractObstacles(xmlDoc) {
    const obstacles = xmlDoc.querySelectorAll('Obs');
    
    
    obstacles.forEach(obs => {
      try {
        const uid = obs.querySelector('ObsUid');
        const id = uid?.querySelector('geoLat')?.textContent + '_' + uid?.querySelector('geoLong')?.textContent;
        
        this.data.obstacles.push({
          id: id,
          type: obs.querySelector('codeType')?.textContent,
          name: obs.querySelector('txtName')?.textContent,
          coordinates: {
            lat: this.parseCoordinate(uid?.querySelector('geoLat')?.textContent),
            lon: this.parseCoordinate(uid?.querySelector('geoLong')?.textContent)
          },
          height: parseFloat(obs.querySelector('valHgt')?.textContent),
          elevation: parseFloat(obs.querySelector('valElev')?.textContent),
          lighting: obs.querySelector('codeLgt')?.textContent,
          marking: obs.querySelector('codeMarking')?.textContent
        });
      } catch (error) {
        
      }
    });
  }

  /**
   * Extrait les routes ATS
   */
  extractRoutes(xmlDoc) {
    const routes = xmlDoc.querySelectorAll('Rte');
    
    
    routes.forEach(rte => {
      try {
        const uid = rte.querySelector('RteUid');
        const id = uid?.querySelector('txtDesig')?.textContent;
        
        if (!id) return;
        
        this.data.routes.push({
          id: id,
          name: rte.querySelector('txtLocDesig')?.textContent || id,
          type: rte.querySelector('codeType')?.textContent,
          rnp: parseFloat(rte.querySelector('valRnp')?.textContent),
          lowerLimit: parseFloat(rte.querySelector('valDistVerLower')?.textContent),
          upperLimit: parseFloat(rte.querySelector('valDistVerUpper')?.textContent),
          remarks: rte.querySelector('txtRmk')?.textContent
        });
      } catch (error) {
        
      }
    });
  }

  /**
   * Extrait les waypoints
   */
  extractWaypoints(xmlDoc) {
    const waypoints = xmlDoc.querySelectorAll('Dpn');
    
    
    waypoints.forEach(dpn => {
      try {
        const uid = dpn.querySelector('DpnUid');
        const id = uid?.querySelector('codeId')?.textContent;
        
        if (!id) return;
        
        this.data.waypoints.push({
          id: id,
          name: dpn.querySelector('txtName')?.textContent || id,
          type: dpn.querySelector('codeType')?.textContent,
          coordinates: {
            lat: this.parseCoordinate(dpn.querySelector('geoLat')?.textContent),
            lon: this.parseCoordinate(dpn.querySelector('geoLong')?.textContent)
          },
          formation: dpn.querySelector('codeFormation')?.textContent
        });
      } catch (error) {
        
      }
    });
  }

  /**
   * Extrait la géométrie d'un espace aérien
   */
  extractAirspaceGeometry(ase) {
    const geometry = {
      type: 'Polygon',
      coordinates: []
    };
    
    try {
      const abdElements = ase.querySelectorAll('Abd');
      const points = [];
      
      abdElements.forEach(abd => {
        const avxElements = abd.querySelectorAll('Avx');
        avxElements.forEach(avx => {
          const lat = this.parseCoordinate(avx.querySelector('geoLat')?.textContent);
          const lon = this.parseCoordinate(avx.querySelector('geoLong')?.textContent);
          if (lat && lon) {
            points.push([lon, lat]);
          }
        });
      });
      
      if (points.length > 0) {
        // Fermer le polygone si nécessaire
        if (points[0][0] !== points[points.length - 1][0] || 
            points[0][1] !== points[points.length - 1][1]) {
          points.push(points[0]);
        }
        geometry.coordinates = [points];
      }
    } catch (error) {
      
    }
    
    return geometry;
  }

  /**
   * Parse une coordonnée AIXM
   */
  parseCoordinate(coord) {
    if (!coord) return null;
    
    // Format: 482843.57N ou 0023419.71E
    const match = coord.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)(N|S|E|W)$/);
    if (!match) return null;
    
    const degrees = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseFloat(match[3]);
    const direction = match[4];
    
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return Math.round(decimal * 1000000) / 1000000;
  }

  /**
   * Parse une altitude AIXM
   */
  parseAltitude(value, unit, reference) {
    if (!value) return 0;
    
    let altitude = parseFloat(value);
    
    // Convertir en pieds si nécessaire
    if (unit === 'M') {
      altitude = Math.round(altitude * 3.28084);
    } else if (unit === 'FL') {
      altitude = altitude * 100;
    }
    
    // Gérer les références spéciales
    if (reference === 'SFC' || reference === 'GND') {
      return 0;
    } else if (reference === 'UNL' || reference === 'UNLIM') {
      return 99999;
    }
    
    return altitude;
  }

  /**
   * Map le type d'aérodrome AIXM vers notre format
   */
  mapAirportType(aixmType) {
    const typeMap = {
      'AD': 'AIRPORT',
      'HP': 'HELIPORT',
      'LS': 'LANDING_SITE',
      'AH': 'AIRPORT',
      'OTHER': 'AIRFIELD'
    };
    
    return typeMap[aixmType] || 'AIRFIELD';
  }
}