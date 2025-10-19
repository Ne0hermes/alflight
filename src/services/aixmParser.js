/**
 * Parser AIXM pour extraire toutes les données complètes des aérodromes
 * depuis les fichiers XML AIXM 4.5 et SIA
 */

class AIXMParser {
  constructor() {
    this.aixmPath = '/src/data/AIXM4.5_all_FR_OM_2025-09-04.xml';
    this.siaPath = '/src/data/XML_SIA_2025-09-04.xml';
    this.aerodromes = new Map();
    this.runways = new Map();
    this.frequencies = new Map();
    this.navaids = new Map();
    this.isLoading = false;
    this.loadPromise = null;
    // Extraire la date depuis le nom du fichier
    this.dataDate = this.extractDateFromPath();
  }
  
  /**
   * Extrait la date depuis le nom des fichiers
   */
  extractDateFromPath() {
    // Rechercher le pattern de date YYYY-MM-DD dans le nom du fichier
    const match = this.aixmPath.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      const [year, month, day] = match[1].split('-');
      // Formater en français : 04 septembre 2025
      const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                     'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      return `${day} ${months[parseInt(month) - 1]} ${year}`;
    }
    return 'Date inconnue';
  }

  /**
   * Charge et parse les fichiers XML
   */
  async loadAndParse() {
    try {
      // FORCER LE RECHARGEMENT POUR DEBUG
            
      // Si un chargement est déjà en cours, attendre qu'il se termine
      if (this.isLoading && this.loadPromise) {
        return await this.loadPromise;
      }
      
      // Vider les collections pour un rechargement propre
      this.aerodromes.clear();
      this.runways.clear();
      this.frequencies.clear();
      this.navaids.clear();
      
      // Marquer comme en cours de chargement
      this.isLoading = true;
      
            
      // Créer la promesse de chargement
      this.loadPromise = (async () => {
        // Charger les deux fichiers XML
        const [aixmResponse, siaResponse] = await Promise.all([
          fetch(this.aixmPath),
          fetch(this.siaPath)
        ]);
        
        const aixmText = await aixmResponse.text();
        const siaText = await siaResponse.text();
        
        // Parser les XML
        const aixmParser = new DOMParser();
        const aixmDoc = aixmParser.parseFromString(aixmText, 'text/xml');
        const siaDoc = aixmParser.parseFromString(siaText, 'text/xml');
        
        // Extraire les données (sans logs répétitifs)
        this.parseAerodromes(aixmDoc);
        this.parseRunways(aixmDoc);
        this.parseRunwayDistances(aixmDoc);
        this.parseFrequencies(siaDoc);
        this.parseAIXMFrequencies(aixmDoc); // Ajouter les fréquences AIXM
        this.parseNavaids(aixmDoc);
        this.parseVFRPoints(aixmDoc);
        this.parseSpecialInstructions(siaDoc);
        this.parseServices(aixmDoc);
        this.parseAdminInfo(siaDoc); // Ajouter les informations administratives
        this.parseProcedures(siaDoc);
        
                
        // Marquer comme chargé
        this.isLoading = false;
        
        return this.combineData();
      })();
      
      return await this.loadPromise;
    } catch (error) {
      console.error('❌ Erreur parsing AIXM:', error);
      this.isLoading = false;
      this.loadPromise = null;
      throw error;
    }
  }

  /**
   * Parse les aérodromes depuis AIXM
   */
  parseAerodromes(doc) {
    const ahps = doc.getElementsByTagName('Ahp');
    // Log désactivé pour éviter spam
    //     
    let count = 0;
    for (const ahp of ahps) {
      // Le codeId est dans AhpUid, pas directement dans Ahp
      const ahpUid = ahp.querySelector('AhpUid');
      if (!ahpUid) continue;
      
      const codeId = this.getTextContent(ahpUid, 'codeId');
      if (!codeId || typeof codeId !== 'string' || !codeId.startsWith('LF')) continue;
      
      count++;
      // Debug LFST activé temporairement
            const aerodrome = {
        icao: String(codeId || ''),
        iata: this.getTextContent(ahp, 'codeIata'),
        name: this.getTextContent(ahp, 'txtName'),
        type: this.getTextContent(ahp, 'codeType'),
        coordinates: {
          lat: this.convertDMSToDecimal(this.getTextContent(ahp, 'geoLat')),
          lon: this.convertDMSToDecimal(this.getTextContent(ahp, 'geoLong')),
          latDMS: this.formatDMSFromAIXM(this.getTextContent(ahp, 'geoLat'), false),  // Format standard aéronautique
          lonDMS: this.formatDMSFromAIXM(this.getTextContent(ahp, 'geoLong'), true)   // Format standard aéronautique
        },
        elevation: {
          value: parseFloat(this.getTextContent(ahp, 'valElev') || 0),
          unit: this.getTextContent(ahp, 'uomDistVer') || 'FT'
        },
        magneticVariation: {
          value: parseFloat(this.getTextContent(ahp, 'valMagVar') || 0),
          date: this.getTextContent(ahp, 'dateMagVar'),
          change: parseFloat(this.getTextContent(ahp, 'valMagVarChg') || 0)
        },
        referencePoint: this.getTextContent(ahp, 'txtDescrRefPt'),
        city: this.getTextContent(ahp, 'txtNameCitySer'),
        transitionAltitude: parseFloat(this.getTextContent(ahp, 'valTransitionAlt') || 0),
        admin: this.getTextContent(ahp, 'txtNameAdmin'),
        remarks: this.getTextContent(ahp, 'txtRmk'), // Consignes particulières AIXM
        runways: [],
        frequencies: {},
        navaids: [],
        vfrPoints: []
      };
      
      // Debug pour LFST (désactivé)
      // if (codeId === 'LFST') {
      //         // }
      
      this.aerodromes.set(codeId, aerodrome);
    }
    
    // Résumé final (conservé car utile)
      }

  /**
   * Parse les pistes depuis AIXM
   */
  parseRunways(doc) {
    const rwys = doc.getElementsByTagName('Rwy');
    
    for (const rwy of rwys) {
      const rwyUid = rwy.querySelector('RwyUid');
      if (!rwyUid) continue;
      
      const ahpUid = rwyUid.querySelector('AhpUid');
      if (!ahpUid) continue;
      
      const aerodromeId = this.getTextContent(ahpUid, 'codeId');
      if (!aerodromeId || !aerodromeId.startsWith('LF')) continue;
      
      // Le txtDesig est dans RwyUid, pas dans Rwy
      const designation = this.getTextContent(rwyUid, 'txtDesig');
      
      // Debug pour LFST
            const runway = {
        designation,
        length: parseFloat(this.getTextContent(rwy, 'valLen') || 0),
        width: parseFloat(this.getTextContent(rwy, 'valWid') || 0),
        surface: this.getTextContent(rwy, 'codeComposition') || 'UNKNOWN',
        pcn: this.getTextContent(rwy, 'txtPcnNote'),
        stripLength: parseFloat(this.getTextContent(rwy, 'valLenStrip') || 0),
        stripWidth: parseFloat(this.getTextContent(rwy, 'valWidStrip') || 0),
        directions: []
      };
      
      // Stocker la piste pour référence
      const rwyKey = `${aerodromeId}_${designation}`;
      this.runways.set(rwyKey, runway);
      
      // Ajouter à l'aérodrome
      const aerodrome = this.aerodromes.get(aerodromeId);
      if (aerodrome) {
        aerodrome.runways.push(runway);
      }
    }
  }

  /**
   * Parse les distances déclarées et informations détaillées des pistes
   */
  parseRunwayDistances(doc) {
    // Parser les directions de piste (Rdn)
    const rdns = doc.getElementsByTagName('Rdn');
    
    for (const rdn of rdns) {
      const rdnUid = rdn.querySelector('RdnUid');
      if (!rdnUid) continue;
      
      const rwyUid = rdnUid.querySelector('RwyUid');
      if (!rwyUid) continue;
      
      const ahpUid = rwyUid.querySelector('AhpUid');
      const aerodromeId = this.getTextContent(ahpUid, 'codeId');
      if (!aerodromeId || !aerodromeId.startsWith('LF')) continue;
      
      const rwyDesignation = this.getTextContent(rwyUid, 'txtDesig');
      const direction = this.getTextContent(rdnUid, 'txtDesig');
      
      // Debug pour LFST
            const directionData = {
        designation: direction,
        trueBearing: parseFloat(this.getTextContent(rdn, 'valTrueBrg') || 0),
        magneticBearing: parseFloat(this.getTextContent(rdn, 'valMagBrg') || 0),
        coordinates: {
          lat: this.convertDMSToDecimal(this.getTextContent(rdn, 'geoLat')),
          lon: this.convertDMSToDecimal(this.getTextContent(rdn, 'geoLong'))
        },
        vasis: {
          type: this.getTextContent(rdn, 'codeTypeVasis'),
          angle: parseFloat(this.getTextContent(rdn, 'valSlopeAngleGpVasis') || 0),
          meht: parseFloat(this.getTextContent(rdn, 'valMeht') || 0)
        },
        distances: {} // Initialiser les distances comme objet vide
      };
      
      // Ajouter à la piste correspondante
      const rwyKey = `${aerodromeId}_${rwyDesignation}`;
      const runway = this.runways.get(rwyKey);
      if (runway) {
        runway.directions.push(directionData);
      }
    }
    
    // Parser les distances déclarées (Rdd)
    const rdds = doc.getElementsByTagName('Rdd');
    
    for (const rdd of rdds) {
      // D'abord récupérer RddUid qui contient le codeType et RdnUid
      const rddUidElement = rdd.querySelector('RddUid');
      if (!rddUidElement) continue;
      
      const rdnUid = rddUidElement.querySelector('RdnUid');
      if (!rdnUid) continue;
      
      const rwyUid = rdnUid.querySelector('RwyUid');
      if (!rwyUid) continue;
      
      const ahpUid = rwyUid.querySelector('AhpUid');
      const aerodromeId = this.getTextContent(ahpUid, 'codeId');
      if (!aerodromeId || !aerodromeId.startsWith('LF')) continue;
      
      const rwyDesignation = this.getTextContent(rwyUid, 'txtDesig');
      const direction = this.getTextContent(rdnUid, 'txtDesig');
      // Le codeType est dans RddUid
      const distanceType = this.getTextContent(rddUidElement, 'codeType');
      const distance = parseFloat(this.getTextContent(rdd, 'valDist') || 0);
      
      // Debug pour LFST (désactivé pour éviter spam)
      // if (aerodromeId === 'LFST') {
      //         // }
      
      // Trouver la direction correspondante
      const rwyKey = `${aerodromeId}_${rwyDesignation}`;
      const runway = this.runways.get(rwyKey);
      if (runway && runway.directions) {
        // Chercher la direction spécifique
        const dir = runway.directions.find(d => d.designation === direction);
        if (dir) {
          // Garder la valeur (elle sera écrasée si dupliquée, ce qui prend la dernière)
          dir.distances[distanceType] = distance;
          
          // Debug uniquement pour LFST et uniquement si on assigne vraiment une valeur
        }
      }
    }

    // Parser les ILS
    const ilss = doc.getElementsByTagName('Ils');
    
    for (const ils of ilss) {
      const rdnUid = ils.querySelector('RdnUid');
      if (!rdnUid) continue;
      
      const rwyUid = rdnUid.querySelector('RwyUid');
      if (!rwyUid) continue;
      
      const ahpUid = rwyUid.querySelector('AhpUid');
      const aerodromeId = this.getTextContent(ahpUid, 'codeId');
      if (!aerodromeId || !aerodromeId.startsWith('LF')) continue;
      
      const rwyDesignation = this.getTextContent(rwyUid, 'txtDesig');
      const direction = this.getTextContent(rdnUid, 'txtDesig');
      
      // Debug pour LFST
            const ilsData = {
        category: this.getTextContent(ils, 'codeCat'),
        frequency: parseFloat(this.getTextContent(ils.querySelector('Ilz'), 'valFreq') || 0),
        identifier: this.getTextContent(ils.querySelector('Ilz'), 'codeId'),
        glidePath: {
          frequency: parseFloat(this.getTextContent(ils.querySelector('Igp'), 'valFreq') || 0),
          slope: parseFloat(this.getTextContent(ils.querySelector('Igp'), 'valSlope') || 0),
          rdh: parseFloat(this.getTextContent(ils.querySelector('Igp'), 'valRdh') || 0)
        }
      };
      
      // Ajouter à la direction correspondante
      const rwyKey = `${aerodromeId}_${rwyDesignation}`;
      const runway = this.runways.get(rwyKey);
      if (runway) {
        const dir = runway.directions.find(d => d.designation === direction);
        if (dir) {
          dir.ils = ilsData;

          // Debug pour LFST
        }
      }
    }
  }

  /**
   * Parse les fréquences depuis SIA
   */
  parseFrequencies(doc) {
    const frequences = doc.getElementsByTagName('Frequence');
    // Log de début désactivé
    //     
    let count = 0;
    for (const freq of frequences) {
      const service = freq.querySelector('Service');
      if (!service) continue;
      
      // Le nom du service est dans l'attribut 'lk', pas dans le contenu texte
      const serviceName = service.getAttribute('lk');
      if (!serviceName) continue;
      
      // Debug: afficher le format du service (désactivé pour éviter spam)
      // if (count < 10) {
      //         //   count++;
      // }
      
      // Chercher spécifiquement LFST (log désactivé)
      // if (serviceName.includes('[LF][ST]')) {
      //         // }
      
      // Extraire l'ICAO du service (format: [LF][ST][SERVICE])
      const icaoMatch = serviceName.match(/\[LF\]\[([A-Z]{2})\]/);
      if (!icaoMatch) {
        // Log désactivé pour éviter spam
        // if (count <= 10) {
        //           // }
        continue;
      }
      
      const icao = 'LF' + icaoMatch[1];
      const aerodrome = this.aerodromes.get(icao);
      if (!aerodrome) continue;
      
      // Extraire le type de service - chercher TWR, APP, GND, etc. dans le nom du service
      // Le format peut être [TWR STRASBOURG Tour] ou [TWR STRASBOURG Sol] ou [ATIS STRASBOURG .]
      let serviceType = null;
      
      // Vérifier d'abord les cas spéciaux basés sur le suffixe
      if (serviceName.includes(' Sol]')) {
        serviceType = 'gnd';  // Sol = Ground
      } else if (serviceName.includes(' Tour]')) {
        serviceType = 'twr';  // Tour = Tower
      } else if (serviceName.includes(' Approche]')) {
        serviceType = 'app';  // Approche = Approach
      } else if (serviceName.includes(' Départ]') || serviceName.includes(' Depart]')) {
        serviceType = 'dep';  // Départ = Departure
      } else {
        // Sinon, chercher le type de service standard dans le préfixe
        const serviceMatch = serviceName.match(/\[(TWR|APP|GND|ATIS|FIS|VDF|INFO|AFIS|DEL|DELIVERY|CTAF)\s+[^\]]*\]/);
        if (!serviceMatch) {
          // Log désactivé - format de service non reconnu
          continue;
        }
        serviceType = serviceMatch[1].toLowerCase();
      }
      const frequency = this.getTextContent(freq, 'Frequence');
      const horaire = this.getTextContent(freq, 'HorCode');
      const remarque = this.getTextContent(freq, 'Remarque');
      
      if (!aerodrome.frequencies[serviceType]) {
        aerodrome.frequencies[serviceType] = [];
      }
      
      aerodrome.frequencies[serviceType].push({
        frequency,
        schedule: horaire,
        remarks: remarque
      });
    }
  }

  /**
   * Parse les fréquences depuis le fichier AIXM
   * Ces fréquences sont plus complètes que celles du SIA
   */
  parseAIXMFrequencies(doc) {
    const frequencies = doc.getElementsByTagName('Fqy');
        
    for (const freq of frequencies) {
      // Extraire les informations de base
      const valFreq = this.getTextContent(freq, 'valFreqTrans');
      const uomFreq = this.getTextContent(freq, 'uomFreq');
      
      if (!valFreq) continue;
      
      // Extraire le call sign (indicatif)
      const callSignNodes = freq.getElementsByTagName('txtCallSign');
      let callSign = '';
      if (callSignNodes.length > 0) {
        callSign = callSignNodes[0].textContent;
      }
      
      // Extraire le service associé
      const serUid = freq.querySelector('SerUid');
      if (!serUid) continue;
      
      const codeType = this.getTextContent(serUid, 'codeType');
      const uniUid = serUid.querySelector('UniUid');
      if (!uniUid) continue;
      
      const txtName = this.getTextContent(uniUid, 'txtName');
      if (!txtName) continue;
      
      // Extraire l'ICAO du nom (format: "LFBD BORDEAUX MERIGNAC")
      const icaoMatch = txtName.match(/^(LF[A-Z]{2})\s/);
      if (!icaoMatch) continue;
      
      const icao = icaoMatch[1];
      const aerodrome = this.aerodromes.get(icao);
      if (!aerodrome) continue;
      
      // Initialiser les fréquences si nécessaire
      if (!aerodrome.frequencies) {
        aerodrome.frequencies = [];
      }
      
      // Déterminer le type de service
      let serviceType = codeType?.toLowerCase() || '';
      
      // Mapper les codes AIXM vers des types standards
      const serviceMap = {
        'TWR': 'twr',
        'APP': 'app',
        'GND': 'gnd',
        'ATIS': 'atis',
        'AFIS': 'afis',
        'INFO': 'info',
        'DEL': 'del',
        'VDF': 'vdf'
      };
      
      serviceType = serviceMap[codeType] || serviceType;
      
      // Ajouter la fréquence si elle n'existe pas déjà
      const existingFreq = aerodrome.frequencies.find(f =>
        f.value === valFreq && f.type === serviceType
      );

      if (!existingFreq) {
        aerodrome.frequencies.push({
          type: serviceType,
          value: valFreq,
          unit: uomFreq || 'MHZ',
          callSign: callSign,
          service: codeType,
          name: txtName
        });
      }
    }
    
    // Log de résumé
    let totalFreqs = 0;
    this.aerodromes.forEach(ad => {
      if (ad.frequencies && ad.frequencies.length > 0) {
        totalFreqs += ad.frequencies.length;
      }
    });
      }

  /**
   * Parse les aides à la navigation
   */
  parseNavaids(doc) {
    // VOR
    const vors = doc.getElementsByTagName('Vor');
    for (const vor of vors) {
      const icao = this.getTextContent(vor, 'codeId');
      const freq = parseFloat(this.getTextContent(vor, 'valFreq') || 0);
      const lat = this.convertDMSToDecimal(this.getTextContent(vor, 'geoLat'));
      const lon = this.convertDMSToDecimal(this.getTextContent(vor, 'geoLong'));
      
      this.navaids.set(icao, {
        type: 'VOR',
        identifier: icao,
        frequency: freq,
        coordinates: { lat, lon }
      });
    }
    
    // DME
    const dmes = doc.getElementsByTagName('Dme');
    for (const dme of dmes) {
      const icao = this.getTextContent(dme, 'codeId');
      const freq = parseFloat(this.getTextContent(dme, 'valFreq') || 0);
      const lat = this.convertDMSToDecimal(this.getTextContent(dme, 'geoLat'));
      const lon = this.convertDMSToDecimal(this.getTextContent(dme, 'geoLong'));
      
      const existing = this.navaids.get(icao);
      if (existing) {
        existing.type = 'VOR/DME';
        existing.dmeFrequency = freq;
      } else {
        this.navaids.set(icao, {
          type: 'DME',
          identifier: icao,
          frequency: freq,
          coordinates: { lat, lon }
        });
      }
    }
    
    // NDB
    const ndbs = doc.getElementsByTagName('Ndb');
    for (const ndb of ndbs) {
      const icao = this.getTextContent(ndb, 'codeId');
      const freq = parseFloat(this.getTextContent(ndb, 'valFreq') || 0);
      const lat = this.convertDMSToDecimal(this.getTextContent(ndb, 'geoLat'));
      const lon = this.convertDMSToDecimal(this.getTextContent(ndb, 'geoLong'));
      
      this.navaids.set(icao, {
        type: 'NDB',
        identifier: icao,
        frequency: freq,
        coordinates: { lat, lon }
      });
    }
  }

  /**
   * Parse les services depuis AIXM
   */
  parseServices(doc) {
    const services = doc.getElementsByTagName('Ahs');
    
    for (const service of services) {
      const ahsUid = service.querySelector('AhsUid');
      if (!ahsUid) continue;
      
      const ahpUid = ahsUid.querySelector('AhpUid');
      const icao = this.getTextContent(ahpUid, 'codeId');
      if (!icao || !icao.startsWith('LF')) continue;
      
      const aerodrome = this.aerodromes.get(icao);
      if (!aerodrome) continue;
      
      // Initialiser les services si nécessaire
      if (!aerodrome.services) {
        aerodrome.services = {
          fuel: false,
          avgas100LL: false,
          jetA1: false,
          maintenance: false,
          customs: false,
          handling: false,
          restaurant: false,
          hotel: false,
          parking: false,
          hangar: false,
          deicing: false,
          security: false,
          medical: false,
          fire: false,
          details: []
        };
      }
      
      const serviceType = this.getTextContent(ahsUid, 'codeType');
      const description = this.getTextContent(service, 'txtDescrFac');
      const workHours = this.getTextContent(service, 'codeWorkHr');
      
      // Ajouter aux détails
      if (serviceType) {
        aerodrome.services.details.push({
          type: serviceType,
          description: description,
          hours: workHours
        });
      }
      
      // Mapper les types de services aux flags booléens
      switch (serviceType) {
        case 'FUEL':
          aerodrome.services.fuel = true;
          // Analyser la description pour les types de carburant
          if (description) {
            if (description.includes('100LL')) {
              aerodrome.services.avgas100LL = true;
            }
            if (description.includes('JET A1') || description.includes('JET-A1')) {
              aerodrome.services.jetA1 = true;
            }
          }
          break;
        case 'REPAIR':
        case 'MAINT':
          aerodrome.services.maintenance = true;
          break;
        case 'CUST':
          aerodrome.services.customs = true;
          break;
        case 'HAND':
          aerodrome.services.handling = true;
          break;
        case 'HANGAR':
          aerodrome.services.hangar = true;
          if (description && description.toLowerCase().includes('parking')) {
            aerodrome.services.parking = true;
          }
          break;
        case 'DEICE':
          aerodrome.services.deicing = true;
          break;
        case 'SECUR':
          aerodrome.services.security = true;
          break;
        case 'SAN':
          aerodrome.services.medical = true;
          break;
        case 'FIRE':
          aerodrome.services.fire = true;
          break;
      }
    }
    
    // Debug pour LFST
    const lfst = this.aerodromes.get('LFST');
      }

  /**
   * Parse les consignes particulières depuis SIA
   */
  parseSpecialInstructions(doc) {
    const aerodromes = doc.getElementsByTagName('Aerodrome');
    
    for (const ad of aerodromes) {
      const icao = this.getTextContent(ad, 'AdCode');
      if (!icao || !icao.startsWith('LF')) continue;
      
      const aerodrome = this.aerodromes.get(icao);
      if (!aerodrome) continue;
      
      // Récupérer AdRem (remarques administratives)
      const adRem = this.getTextContent(ad, 'AdRem');
      if (adRem) {
        aerodrome.specialInstructions = adRem;
      }
      
      // Récupérer les remarques spécifiques
      const remarques = ad.getElementsByTagName('Remarque');
      if (remarques.length > 0) {
        aerodrome.additionalRemarks = [];
        for (const remarque of remarques) {
          const text = remarque.textContent?.trim();
          if (text) {
            aerodrome.additionalRemarks.push(text);
          }
        }
      }
      
      // Debug pour LFST
      if (icao === 'LFST' && (adRem || remarques.length > 0)) {
              }
    }
  }

  /**
   * Parse les informations administratives depuis SIA (téléphone, adresse, etc.)
   */
  parseAdminInfo(doc) {
    const ads = doc.getElementsByTagName('Ad');
    
    for (const ad of ads) {
      const adCode = this.getTextContent(ad, 'AdCode');
      if (!adCode) continue;
      
      const icao = 'LF' + adCode;
      const aerodrome = this.aerodromes.get(icao);
      if (!aerodrome) continue;
      
      // Extraire les informations administratives
      const adminInfo = {
        gestion: this.getTextContent(ad, 'AdGestion'),
        adresse: this.getTextContent(ad, 'AdAdresse'),
        telephone: this.getTextContent(ad, 'AdTel'),
        fax: this.getTextContent(ad, 'AdFax'),
        email: null,
        website: null
      };
      
      // Extraire email et website depuis AdRem
      const adRem = this.getTextContent(ad, 'AdRem');
      if (adRem) {
        // Rechercher l'email
        const emailMatch = adRem.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/);
        if (emailMatch) {
          adminInfo.email = emailMatch[0];
        }
        
        // Rechercher le site web
        const websiteMatch = adRem.match(/(?:www\.|http:\/\/|https:\/\/)[^\s#]+/);
        if (websiteMatch) {
          adminInfo.website = websiteMatch[0];
        }
      }
      
      // Ajouter les informations à l'aérodrome
      aerodrome.adminInfo = adminInfo;
    }
  }

  /**
   * Parse les procédures et consignes particulières depuis SIA
   */
  parseProcedures(doc) {
    const aerodromes = doc.getElementsByTagName('Aerodrome');
    
    for (const ad of aerodromes) {
      const icao = this.getTextContent(ad, 'AdCode');
      if (!icao || !icao.startsWith('LF')) continue;
      
      const aerodrome = this.aerodromes.get(icao);
      if (!aerodrome) continue;
      
      // Initialiser les procédures si nécessaire
      if (!aerodrome.procedures) {
        aerodrome.procedures = {};
      }
      
      // Procédures de déneigement
      const neigePriorite = this.getTextContent(ad, 'NeigePriorite');
      if (neigePriorite) {
        aerodrome.procedures.snowRemoval = {
          priority: neigePriorite,
          equipment: this.getTextContent(ad, 'NeigeEqpt')
        };
      }
      
      // Procédures SSLIA (Service incendie)
      const ssliaAcft = this.getTextContent(ad, 'SsliaAcft');
      if (ssliaAcft) {
        aerodrome.procedures.fireService = {
          aircraft: ssliaAcft,
          remarks: this.getTextContent(ad, 'SsliaRem'),
          category: this.getTextContent(ad, 'SsliaCat'),
          facilities: this.getTextContent(ad, 'SsliaFac')
        };
      }
      
      // Restrictions opérationnelles
      const adOpr = this.getTextContent(ad, 'AdOpr');
      if (adOpr) {
        aerodrome.procedures.operationalRestrictions = adOpr;
      }
      
      // Services passagers remarques
      const svcPaxRem = this.getTextContent(ad, 'SvcPaxRem');
      if (svcPaxRem) {
        aerodrome.procedures.passengerServicesRemarks = svcPaxRem;
      }
      
      // Debug pour LFST
      if (icao === 'LFST' && Object.keys(aerodrome.procedures).length > 0) {
      }
    }
  }

  /**
   * Parse les points VFR (Visual Reporting Points)
   */
  parseVFRPoints(doc) {
    const dpns = doc.getElementsByTagName('Dpn');
    let vfrCount = 0;
    
    for (const dpn of dpns) {
      const dpnUid = dpn.querySelector('DpnUid');
      if (!dpnUid) continue;
      
      const codeId = this.getTextContent(dpnUid, 'codeId');
      const lat = this.getTextContent(dpnUid, 'geoLat');
      const lon = this.getTextContent(dpnUid, 'geoLong');
      
      // Chercher l'aérodrome associé
      const ahpUidAssoc = dpn.querySelector('AhpUidAssoc');
      const aerodromeId = this.getTextContent(ahpUidAssoc, 'codeId');
      
      if (!aerodromeId || !aerodromeId.startsWith('LF')) continue;
      
      // Récupérer les détails du point
      const codeType = this.getTextContent(dpn, 'codeType');
      const txtName = this.getTextContent(dpn, 'txtName');
      const txtRmk = this.getTextContent(dpn, 'txtRmk');
      
      // Filtrer les points VFR (VRP = Visual Reporting Point)
      if (txtRmk && txtRmk.includes('VRP')) {
        const vfrPoint = {
          id: codeId,
          name: txtName,
          description: txtRmk.replace('VRP-', '').trim(),
          coordinates: {
            lat: this.convertDMSToDecimal(lat),
            lon: this.convertDMSToDecimal(lon)
          },
          type: 'VRP'
        };
        
        const aerodrome = this.aerodromes.get(aerodromeId);
        if (aerodrome) {
          aerodrome.vfrPoints.push(vfrPoint);
          vfrCount++;
          
          // Debug pour LFST
                  }
      }
    }
    
      }

  /**
   * Combine toutes les données
   */
  combineData() {
    const result = [];
    
    for (const [icao, aerodrome] of this.aerodromes) {
      // Associer les navaids proches de l'aérodrome (dans un rayon de 30 NM)
      aerodrome.navaids = [];
      for (const [navId, navaid] of this.navaids) {
        const distance = this.calculateDistance(
          aerodrome.coordinates.lat,
          aerodrome.coordinates.lon,
          navaid.coordinates.lat,
          navaid.coordinates.lon
        );

        if (distance <= 30) { // 30 NM de rayon
          aerodrome.navaids.push({
            ...navaid,
            distance: Math.round(distance * 10) / 10,
            radial: this.calculateRadial(
              aerodrome.coordinates.lat,
              aerodrome.coordinates.lon,
              navaid.coordinates.lat,
              navaid.coordinates.lon
            )
          });
        }
      }
      
      // Séparer les pistes bidirectionnelles en entrées individuelles
      const processedRunways = [];
      
      // Debug pour LFST
            for (const runway of aerodrome.runways) {
        if (runway.designation && runway.designation.includes('/')) {
          // Piste bidirectionnelle - créer une entrée pour chaque direction
                    for (const direction of runway.directions || []) {
            // NE PAS inventer de données - utiliser null si pas de données
            let tora = direction.distances?.TORA || null;
            let toda = direction.distances?.TODA || null;
            let asda = direction.distances?.ASDA || null;
            let lda = direction.distances?.LDA || null;
            
            // Log pour debug
                        processedRunways.push({
              designation: direction.designation,
              identifier: direction.designation,
              length: runway.length || null,
              width: runway.width || null,
              surface: runway.surface || null,
              pcn: runway.pcn || null,
              qfu: direction.magneticBearing || direction.trueBearing || null,
              trueBearing: direction.trueBearing || null,
              magneticBearing: direction.magneticBearing || null,
              threshold: direction.coordinates || null,
              tora: tora,  // null si pas de données
              toda: toda,  // null si pas de données
              asda: asda,  // null si pas de données
              lda: lda,    // null si pas de données
              vasis: direction.vasis || null,
              ils: direction.ils || null
            });
          }
        } else {
          // Piste unidirectionnelle ou format non standard
                    processedRunways.push({
            ...runway,
            identifier: runway.designation,
            qfu: runway.directions?.[0]?.magneticBearing || null,
            tora: runway.directions?.[0]?.distances?.TORA || null,  // null si pas de données
            toda: runway.directions?.[0]?.distances?.TODA || null,  // null si pas de données
            asda: runway.directions?.[0]?.distances?.ASDA || null,  // null si pas de données
            lda: runway.directions?.[0]?.distances?.LDA || null     // null si pas de données
          });
        }
      }
      
      aerodrome.runways = processedRunways;
      result.push(aerodrome);
    }
    
    return result;
  }

  /**
   * Utilitaire: Obtenir le contenu texte d'un élément
   */
  getTextContent(element, tagName) {
    if (!element) return '';
    if (!tagName) {
      return element.textContent ? element.textContent.trim() : '';
    }
    
    // Chercher uniquement dans les enfants directs pour éviter les éléments imbriqués
    const children = element.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i].tagName === tagName) {
        return children[i].textContent.trim();
      }
    }
    return '';
  }

  /**
   * Convertir DMS en décimal
   */
  convertDMSToDecimal(dms) {
    if (!dms) return 0;
    
    // Format: DDMMSS.ssN ou DDDMMSS.ssE
    const matches = dms.match(/(\d{2,3})(\d{2})(\d{2}\.?\d*)([NSEW])/);
    if (!matches) return 0;
    
    const degrees = parseInt(matches[1]);
    const minutes = parseInt(matches[2]);
    const seconds = parseFloat(matches[3]);
    const direction = matches[4];
    
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }
  
  /**
   * Formater DMS du format AIXM vers le format standard aéronautique
   */
  formatDMSFromAIXM(dms, isLongitude) {
    if (!dms) return '';
    
    // Format AIXM: DDMMSS.ssN ou DDDMMSS.ssE
    const matches = dms.match(/(\d{2,3})(\d{2})(\d{2})(\.(\d+))?([NSEW])/);
    if (!matches) return dms;
    
    const degrees = matches[1];
    const minutes = matches[2];
    const seconds = matches[3];
    const decimals = matches[5] || '00';
    const direction = matches[6];
    
    // Format standard aéronautique
    if (isLongitude) {
      return `${degrees.padStart(3, '0')}°${minutes}'${seconds}"${direction}`;
    } else {
      return `${degrees.padStart(2, '0')}°${minutes}'${seconds}"${direction}`;
    }
  }

  /**
   * Calculer la distance entre deux points (en NM)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Rayon de la Terre en NM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Calculer le radial entre deux points (en degrés)
   */
  calculateRadial(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    const radial = Math.atan2(y, x);
    return Math.round((radial * 180 / Math.PI + 360) % 360);
  }

  /**
   * Recherche d'aérodromes
   */
  async searchAerodromes(searchTerm = '') {
    if (this.aerodromes.size === 0) {
      await this.loadAndParse();
    }
    
    const results = this.combineData();
    
    if (!searchTerm) return results;
    
    const search = searchTerm.toLowerCase();
    return results.filter(ad => {
      return (
        ad.icao?.toLowerCase().includes(search) ||
        ad.name?.toLowerCase().includes(search) ||
        ad.city?.toLowerCase().includes(search)
      );
    });
  }

  /**
   * Obtenir un aérodrome par ICAO avec toutes ses données
   */
  async getAerodromeByICAO(icao) {
    if (this.aerodromes.size === 0) {
      await this.loadAndParse();
    }
    
    const aerodrome = this.aerodromes.get(icao);
        return aerodrome;
  }
  
  /**
   * Obtenir la date des données
   */
  getDataDate() {
    return this.dataDate;
  }
}

// Export singleton
export const aixmParser = new AIXMParser();

// Fonction de test pour vérifier le parsing - exposée globalement
// ACTIVÉ pour debug
if (typeof window !== 'undefined') {
  // Ne définir la fonction qu'une seule fois
  if (!window.testAIXMParser) {
    window.testAIXMParser = async () => {
            await aixmParser.loadAndParse();
      const lfst = aixmParser.aerodromes.get('LFST');
      const lfga = aixmParser.aerodromes.get('LFGA');
                                    // Afficher quelques codes ICAO pour debug
      const icaos = Array.from(aixmParser.aerodromes.keys()).slice(0, 10);
            return { lfst, lfga, total: aixmParser.aerodromes.size };
    };
  }

  // Exposer aussi l'instance du parser pour debug
  if (!window.aixmParser) {
    window.aixmParser = aixmParser;
  }
}