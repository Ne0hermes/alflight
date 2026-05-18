// src/core/data/parsers/AIXMParser.js
/**
 * Parser pour les données AIXM 4.5 du SIA France
 * Extrait toutes les données aéronautiques disponibles
 */

import { AIRPORT_NAMES, enrichAirportName } from '@data/airportNames';
import { normalizeElevationToFeet } from '@utils/elevationUtils';

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

        // Exclure les Landing Sites (LS) qui ne sont pas de vrais aérodromes
        // Exclure les Heliports purs (HP) - souvent des héliports d'hôpitaux
        // Garder AD (Aerodrome), AH (Airport/Heliport)
        if (codeType === 'LS' || codeType === 'HP') {
          return; // Ignorer les landing sites et héliports purs
        }

        // Récupérer le nom pour vérifier si c'est un héliport d'hôpital
        const rawName = ahp.querySelector('txtName')?.textContent || '';
        const rawCity = ahp.querySelector('txtNameCitySer')?.textContent || '';
        const rawRemarks = ahp.querySelector('txtRmk')?.textContent || '';
        const combinedText = `${rawName} ${rawCity} ${rawRemarks}`.toUpperCase();

        // Exclure les héliports d'hôpitaux et centres médicaux
        const hospitalKeywords = [
          'HOPITAL', 'HOSPITAL', 'CHU', 'CHR', 'CLINIQUE', 'SAMU',
          'HELISTATION', 'HELIPORT', 'HELISURFACE',
          'MEDICAL', 'URGENCE', 'SECOURS'
        ];

        if (hospitalKeywords.some(keyword => combinedText.includes(keyword))) {
          return; // Ignorer les héliports d'hôpitaux et centres médicaux
        }

        // Utiliser le nom et la ville déjà récupérés
        let aixmName = rawName;
        const city = rawCity;
        
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
        
        // Normaliser l'élévation en pieds via util partagé (gère toutes les
        // variantes orthographiques d'unité + cas absent).
        airport.elevation = Math.round(normalizeElevationToFeet(
          { value: airport.elevation, unit: airport.elevationUnit },
          { context: airport.icao || airport.name }
        ));
        
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
    console.log('🚨🚨🚨 AIXMParser.extractRunways() - VERSION 2025-10-22-16:12 - AVEC EXTRACTION RDN');

    // Extraire d'abord tous les Rdn (Runway Direction) car ils sont séparés des Rwy
    const rdnMap = new Map(); // Map<airportId_designation_direction, RdnData>

    const rdns = xmlDoc.querySelectorAll('Rdn');
    console.log(`🚨 Nombre d'éléments Rdn trouvés: ${rdns.length}`);
    rdns.forEach(rdn => {
      try {
        const rdnUid = rdn.querySelector('RdnUid');
        const rwyUid = rdnUid?.querySelector('RwyUid');
        const airportId = rwyUid?.querySelector('AhpUid > codeId')?.textContent?.trim();
        const rwyDesig = rwyUid?.querySelector(':scope > txtDesig')?.textContent?.trim(); // Enfant direct de RwyUid
        const rdnDesig = rdnUid?.querySelector(':scope > txtDesig')?.textContent?.trim(); // Enfant direct de RdnUid

        if (!airportId || !rwyDesig || !rdnDesig) return;

        const key = `${airportId}_${rwyDesig}_${rdnDesig}`;

        // Debug pour LFST
        if (airportId === 'LFST') {
          console.log(`🔑 CLÉ CRÉÉE POUR LFST:`, {
            key,
            airportId,
            rwyDesig,
            rdnDesig,
            valTrueBrg: rdn.querySelector('valTrueBrg')?.textContent,
            valMagBrg: rdn.querySelector('valMagBrg')?.textContent
          });
        }

        rdnMap.set(key, {
          valTrueBrg: rdn.querySelector('valTrueBrg')?.textContent,
          valMagBrg: rdn.querySelector('valMagBrg')?.textContent,
          geoLat: rdn.querySelector('geoLat')?.textContent,
          geoLong: rdn.querySelector('geoLong')?.textContent
        });
      } catch (error) {
        // Ignorer les erreurs silencieusement
      }
    });

    // Debug : afficher les clés LFST créées dans la Map
    const lfstKeysCreated = Array.from(rdnMap.keys()).filter(k => k.startsWith('LFST'));
    console.log('🔧 AIXM Parser - Clés LFST créées dans rdnMap:', lfstKeysCreated);

    // Extraire les distances déclarées (Rdd - Runway Declared Distances)
    const rddMap = new Map(); // Map<airportId_rwyDesig_direction_type, distance>

    const rdds = xmlDoc.querySelectorAll('Rdd');
    console.log(`🚨 Nombre d'éléments Rdd trouvés: ${rdds.length}`);

    rdds.forEach(rdd => {
      try {
        const rddUid = rdd.querySelector('RddUid');
        const rdnUid = rddUid?.querySelector('RdnUid');
        const rwyUid = rdnUid?.querySelector('RwyUid');
        const airportId = rwyUid?.querySelector('AhpUid > codeId')?.textContent?.trim();
        const rwyDesig = rwyUid?.querySelector(':scope > txtDesig')?.textContent?.trim();
        const rdnDesig = rdnUid?.querySelector(':scope > txtDesig')?.textContent?.trim();
        const distanceType = rddUid?.querySelector('codeType')?.textContent?.trim(); // TORA, TODA, ASDA, LDA
        const valDist = rdd.querySelector('valDist')?.textContent?.trim();

        if (!airportId || !rwyDesig || !rdnDesig || !distanceType || !valDist) return;

        const key = `${airportId}_${rwyDesig}_${rdnDesig}_${distanceType}`;
        rddMap.set(key, parseFloat(valDist));

        // Debug pour LFST
        if (airportId === 'LFST') {
          console.log(`📏 DISTANCE LFST: ${rwyDesig} direction ${rdnDesig} - ${distanceType}: ${valDist}m`);
        }
      } catch (error) {
        // Ignorer les erreurs silencieusement
      }
    });

    const runways = xmlDoc.querySelectorAll('Rwy');

    runways.forEach(rwy => {
      try {
        const uid = rwy.querySelector('RwyUid');
        const airportId = uid?.querySelector('AhpUid > codeId')?.textContent?.trim();
        const designation = uid?.querySelector('txtDesig')?.textContent?.trim();

        if (!airportId || !designation) return;

        // Récupérer le type de revêtement (composition)
        const composition = rwy.querySelector('codeComposition')?.textContent;

        // Récupérer la résistance PCN
        const pcnNote = rwy.querySelector('txtPcnNote')?.textContent;

        // Récupérer les dimensions de bande de piste si disponibles
        const stripLength = parseFloat(rwy.querySelector('valLenStrip')?.textContent);
        const stripWidth = parseFloat(rwy.querySelector('valWidStrip')?.textContent);
        const stripUnit = rwy.querySelector('uomDimStrip')?.textContent;

        // En AIXM 4.5, les orientations sont dans les éléments Rdn séparés
        // On récupère les données pour chaque direction
        const directions = designation.includes('/') ? designation.split('/') : [designation];
        const firstDir = directions[0]?.trim();
        const rdnKey = `${airportId}_${designation}_${firstDir}`;
        const rdnData = rdnMap.get(rdnKey);

        // Debug pour LFST
        if (airportId === 'LFST') {
          // Afficher toutes les clés LFST dans la Map
          const lfstKeys = Array.from(rdnMap.keys()).filter(k => k.startsWith('LFST'));
          console.log('🛬 AIXM Parser - LFST:', {
            designation,
            firstDir,
            rdnKey,
            rdnData,
            rdnMapSize: rdnMap.size,
            rdnMapHasKey: rdnMap.has(rdnKey),
            lfstKeysInMap: lfstKeys
          });
        }

        const valBrgTrue = rdnData?.valTrueBrg;
        const valBrgMag = rdnData?.valMagBrg;

        // Récupérer les distances déclarées pour TOUTES les directions
        const distancesByDirection = {};
        directions.forEach(dir => {
          const dirTrim = dir.trim();
          distancesByDirection[dirTrim] = {
            tora: rddMap.get(`${airportId}_${designation}_${dirTrim}_TORA`),
            toda: rddMap.get(`${airportId}_${designation}_${dirTrim}_TODA`),
            asda: rddMap.get(`${airportId}_${designation}_${dirTrim}_ASDA`),
            lda: rddMap.get(`${airportId}_${designation}_${dirTrim}_LDA`)
          };
        });

        // Utiliser firstDir déjà déclaré plus haut (ligne 387)
        const toraKey = `${airportId}_${designation}_${firstDir}_TORA`;
        const todaKey = `${airportId}_${designation}_${firstDir}_TODA`;
        const asdaKey = `${airportId}_${designation}_${firstDir}_ASDA`;
        const ldaKey = `${airportId}_${designation}_${firstDir}_LDA`;

        const runway = {
          airportId: airportId,
          designator: designation,
          designation: designation, // Alias pour compatibilité
          dimensions: {
            length: parseFloat(rwy.querySelector('valLen')?.textContent) || 0,
            width: parseFloat(rwy.querySelector('valWid')?.textContent) || 0,
            lengthUnit: rwy.querySelector('uomDimRwy')?.textContent || 'M',
            // LDA par défaut = longueur totale (sera précisé par distances déclarées)
            lda: rddMap.get(ldaKey) || parseFloat(rwy.querySelector('valLen')?.textContent) || 0
          },
          // Distances déclarées pour la première direction
          tora: rddMap.get(toraKey),
          toda: rddMap.get(todaKey),
          asda: rddMap.get(asdaKey),
          lda: rddMap.get(ldaKey),
          // Distances par direction (pour séparation ultérieure)
          distancesByDirection: distancesByDirection,
          surface: {
            type: composition || rwy.querySelector('codeSfc')?.textContent || 'Non spécifiée'
          },
          strength: rwy.querySelector('codeStrength')?.textContent,
          pcn: pcnNote,
          threshold: {
            lat: this.parseCoordinate(rwy.querySelector('geoLatThr')?.textContent),
            lon: this.parseCoordinate(rwy.querySelector('geoLongThr')?.textContent),
            elevation: parseFloat(rwy.querySelector('valElevThr')?.textContent)
          },
          magneticBearing: parseFloat(valBrgMag),
          trueBearing: parseFloat(valBrgTrue),
          bearing: parseFloat(valBrgTrue), // Alias pour orientation
          orientation: parseFloat(valBrgTrue), // Orientation géographique
          // Debug: valeurs brutes
          _debug_valBrgTrue: valBrgTrue,
          _debug_valBrgMag: valBrgMag,
          // Dimensions de la bande de piste
          stripDimensions: stripLength && stripWidth ? `${Math.round(stripLength)}x${Math.round(stripWidth)} ${stripUnit || 'M'}` : null,
          // Déterminer si c'est la piste principale (pistes > 1500m considérées principales)
          isPrimary: (parseFloat(rwy.querySelector('valLen')?.textContent) || 0) >= 1500
        };

        // Convertir les dimensions en mètres si nécessaire
        if (runway.dimensions.lengthUnit === 'FT') {
          runway.dimensions.length = Math.round(runway.dimensions.length * 0.3048);
          runway.dimensions.width = Math.round(runway.dimensions.width * 0.3048);
          runway.dimensions.lda = Math.round(runway.dimensions.lda * 0.3048);
        }

        // Ajouter la largeur au niveau racine pour compatibilité
        runway.width = runway.dimensions.width;
        runway.lda = runway.dimensions.lda;

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