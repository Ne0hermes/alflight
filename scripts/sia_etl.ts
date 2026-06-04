// scripts/sia_etl.ts
/**
 * ETL (Extract, Transform, Load) pour les données SIA
 * Parse les fichiers AIXM et génère des GeoJSON par couche
 * AUCUNE donnée inventée - erreur si donnée manquante
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DOMParser } from '@xmldom/xmldom';
import { SIAMissingDataError } from '../src/types/sia.js';
import type {
  Aerodrome,
  Airspace,
  Navaid,
  DesignatedPoint,
  Runway,
  Obstacle,
  ILS,
  ATSService,
  ATCUnit,
  Organization,
  AerodromeService,
  AerodromeFacility,
  AerodromeUsageLimitation,
  AerodromeAddress,
  ObstacleAerodromeLink,
  ATSRouteComplete,
  ATSRouteSegmentDetail
} from '../src/types/sia';
import type { FeatureCollection, Point, Polygon, MultiPolygon, LineString } from 'geojson';

// Chemins (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
// Source XML : public/data — emplacement UNIQUE (servi au runtime ET lu par l'ETL).
// Les XML ne sont plus dupliqués dans src/data.
const INPUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUTPUT_DIR = path.join(DATA_DIR, 'derived', 'geojson');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Texte d'un élément ENFANT DIRECT (et non descendant) du parent.
 * ⚠️ Évite le piège de getElementsByTagName('txtName')[0] qui, sur un <Ahp>,
 * renvoie le <txtName> de <OrgUid> ('FRANCE') au lieu du nom de l'aérodrome.
 */
function directChildText(parent: any, tagName: string): string | undefined {
  const children = parent?.childNodes;
  if (!children) return undefined;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node && node.nodeType === 1 && node.nodeName === tagName) {
      return node.textContent || undefined;
    }
  }
  return undefined;
}

/**
 * Classe principale pour l'ETL SIA
 */
class SIAETL {
  private aixmDoc: Document | null = null;
  private airacDate: string = '';
  
  // Collections de données
  private aerodromes: Aerodrome[] = [];
  private airspaces: Airspace[] = [];
  private navaids: Navaid[] = [];
  private designatedPoints: DesignatedPoint[] = [];
  private runways: Runway[] = [];
  private obstacles: Obstacle[] = [];
  private ilsList: ILS[] = [];
  private atsServices: ATSService[] = [];
  private atcUnits: ATCUnit[] = [];
  private organizations: Organization[] = [];
  private aerodromeServices: AerodromeService[] = [];
  private aerodromeFacilities: AerodromeFacility[] = [];
  private aerodromeUsageLimitations: AerodromeUsageLimitation[] = [];
  private aerodromeAddresses: AerodromeAddress[] = [];
  private obstacleLinks: ObstacleAerodromeLink[] = [];
  private atsRoutes: ATSRouteComplete[] = [];

  // Index aérodromes mid → ICAO (rempli en parseAerodromes, utilisé par les autres parsers)
  private aerodromeMidToIcao = new Map<string, string>();
  // Index ICAO → fréquences (rempli depuis les <Fqy>, lu par parseFrequencies)
  private frequenciesByIcao = new Map<string, any[]>();
  // Index obstacle mid → coords (rempli en parseObstacles)
  private obstacleMidToCoords = new Map<string, { lat: number; lon: number }>();
  
  /**
   * Lance le processus ETL complet
   */
  async run(): Promise<void> {
    console.log('🚀 Démarrage ETL SIA...');
    
    try {
      // 1. Détecter et charger les fichiers AIXM
      await this.loadAIXMFiles();
      
      // 2. Parser les données
      await this.parseAerodromes();
      await this.parseAirspaces();
      await this.parseNavaids();
      await this.parseDesignatedPoints();
      await this.parseRunways();
      await this.parseDeclaredDistances();
      await this.parseObstacles();
      await this.parseOrganizations();
      await this.parseATCUnits();
      await this.parseATSServices();
      await this.parseILS();
      await this.parseATSRoutes();
      await this.parseAerodromeServices();
      await this.parseAerodromeFacilities();
      await this.parseAerodromeUsageLimitations();
      await this.parseAerodromeAddresses();
      await this.parseObstacleAerodromeLinks();

      // 3. Générer les GeoJSON
      await this.generateGeoJSON();
      
      console.log('✅ ETL SIA terminé avec succès');
      this.printStatistics();
      
    } catch (error) {
      console.error('❌ Erreur ETL:', error);
      if (error instanceof SIAMissingDataError) {
        console.error(`Donnée SIA manquante: ${error.dataType} - ${error.identifier}`);
      }
      process.exit(1);
    }
  }
  
  /**
   * Charge les fichiers AIXM
   */
  private async loadAIXMFiles(): Promise<void> {
    console.log('📂 Recherche des fichiers SIA dans:', INPUT_DIR);

    const files = fs.readdirSync(INPUT_DIR);
    const aixmFile = files.find(f => f.startsWith('AIXM4.5_') && f.endsWith('.xml'));

    if (!aixmFile) {
      throw new Error('Aucun fichier AIXM trouvé dans ' + INPUT_DIR);
    }
    
    // Extraire la date AIRAC du nom de fichier
    const dateMatch = aixmFile.match(/(\d{4}-\d{2}-\d{2})/);
    this.airacDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    
    console.log(`📄 Chargement: ${aixmFile} (AIRAC: ${this.airacDate})`);
    
    const xmlContent = fs.readFileSync(path.join(INPUT_DIR, aixmFile), 'utf-8');
    const parser = new DOMParser();
    this.aixmDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Vérifier les erreurs de parsing
    const parserError = this.aixmDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      throw new Error('Erreur parsing XML: ' + parserError[0].textContent);
    }
  }
  
  /**
   * Parse les aérodromes
   */
  private async parseAerodromes(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    // Construire l'index des fréquences AVANT la boucle (lu par parseFrequencies)
    this.buildFrequencyIndex();

    const ahpElements = this.aixmDoc.getElementsByTagName('Ahp');
    console.log(`🛬 Parsing ${ahpElements.length} aérodromes...`);
    
    for (let i = 0; i < ahpElements.length; i++) {
      const ahp = ahpElements[i];
      
      try {
        const uid = ahp.getElementsByTagName('AhpUid')[0];
        const codeId = uid?.getElementsByTagName('codeId')[0]?.textContent;
        
        if (!codeId) continue;
        
        // Coordonnées obligatoires
        const lat = this.parseCoordinate(ahp.getElementsByTagName('geoLat')[0]?.textContent);
        const lon = this.parseCoordinate(ahp.getElementsByTagName('geoLong')[0]?.textContent);
        
        if (lat === null || lon === null) {
          throw new SIAMissingDataError('aerodrome_coordinates', codeId);
        }
        
        // Extraction Aht (sous-bloc horaires)
        const ahtElement = ahp.getElementsByTagName('Aht')[0];
        const hoursCode = ahtElement?.getElementsByTagName('codeWorkHr')[0]?.textContent || undefined;
        const hoursText = ahtElement?.getElementsByTagName('txtRmkWorkHr')[0]?.textContent || undefined;

        const ahpMid = uid?.getAttribute('mid') || undefined;
        if (ahpMid) {
          this.aerodromeMidToIcao.set(ahpMid, codeId);
        }

        const aerodrome: Aerodrome = {
          id: `AD_${codeId}`,
          icao: ahp.getElementsByTagName('codeIcao')[0]?.textContent || undefined,
          iata: ahp.getElementsByTagName('codeIata')[0]?.textContent || undefined,
          name: directChildText(ahp, 'txtName') || codeId,
          city: ahp.getElementsByTagName('txtNameCitySer')[0]?.textContent || undefined,
          latitude: lat,
          longitude: lon,
          elevation_ft: this.parseNumber(ahp.getElementsByTagName('valElev')[0]?.textContent),
          type: this.mapAerodromeType(ahp.getElementsByTagName('codeType')[0]?.textContent),
          magnetic_variation: this.parseNumber(ahp.getElementsByTagName('valMagVar')[0]?.textContent),
          transition_altitude: this.parseNumber(ahp.getElementsByTagName('valTransitionAlt')[0]?.textContent),
          frequencies: this.parseFrequencies(codeId),
          hours_code: hoursCode,
          hours_text: hoursText,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: ahpMid
        };

        // Convertir l'élévation si nécessaire
        const elevUnit = ahp.getElementsByTagName('uomDistVer')[0]?.textContent;
        if (elevUnit === 'M' && aerodrome.elevation_ft) {
          aerodrome.elevation_m = aerodrome.elevation_ft;
          aerodrome.elevation_ft = Math.round(aerodrome.elevation_ft * 3.28084);
        }

        this.aerodromes.push(aerodrome);
        
      } catch (error) {
        if (error instanceof SIAMissingDataError) throw error;
        console.warn(`⚠️ Erreur parsing aérodrome ${i}:`, error);
      }
    }
  }
  
  /**
   * Parse les espaces aériens
   */
  private async parseAirspaces(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');
    
    const aseElements = this.aixmDoc.getElementsByTagName('Ase');
    console.log(`🗺️ Parsing ${aseElements.length} espaces aériens...`);

    // En AIXM, la géométrie (Abd→Avx) n'est PAS dans l'Ase : les Abd (frontières) sont des
    // éléments SÉPARÉS qui référencent leur Ase via AbdUid→AseUid(@mid). On indexe d'abord
    // les Abd par mid d'AseUid pour pouvoir retrouver la géométrie de chaque espace.
    const abdByAse = this.indexAbdByAse();

    for (let i = 0; i < aseElements.length; i++) {
      const ase = aseElements[i];

      try {
        const uid = ase.getElementsByTagName('AseUid')[0];
        const aseMid = uid?.getAttribute('mid');
        const codeId = uid?.getElementsByTagName('codeId')[0]?.textContent;
        const codeType = uid?.getElementsByTagName('codeType')[0]?.textContent;

        if (!codeId) continue;

        // Géométrie obligatoire sauf pour certains types
        const geometry = this.parseAirspaceGeometry(aseMid ? (abdByAse.get(aseMid) || []) : []);
        if (!geometry) {
          // Certains espaces (comme FIR/UIR) peuvent ne pas avoir de géométrie dans l'AIXM
          console.warn(`⚠️ Géométrie manquante pour l'espace ${codeId} (type: ${codeType})`);
          continue;
        }
        
        const airspace: Airspace = {
          id: `AS_${codeId}`,
          code_id: codeId,
          name: ase.getElementsByTagName('txtName')[0]?.textContent || undefined,
          class: this.parseAirspaceClass(ase.getElementsByTagName('codeClass')[0]?.textContent),
          type: this.parseSpecialAirspaceType(codeType),
          activity: ase.getElementsByTagName('codeActivity')[0]?.textContent || undefined,
          geometry: geometry,
          floor: this.parseAltitude(
            ase.getElementsByTagName('valDistVerLower')[0]?.textContent,
            ase.getElementsByTagName('uomDistVerLower')[0]?.textContent
          ),
          floor_ref: this.parseAltRef(ase.getElementsByTagName('codeDistVerLower')[0]?.textContent),
          floor_raw: ase.getElementsByTagName('valDistVerLower')[0]?.textContent || undefined,
          ceiling: this.parseAltitude(
            ase.getElementsByTagName('valDistVerUpper')[0]?.textContent,
            ase.getElementsByTagName('uomDistVerUpper')[0]?.textContent
          ),
          ceiling_ref: this.parseAltRef(ase.getElementsByTagName('codeDistVerUpper')[0]?.textContent),
          ceiling_raw: ase.getElementsByTagName('valDistVerUpper')[0]?.textContent || undefined,
          schedule: ase.getElementsByTagName('txtRmkWorkHr')[0]?.textContent || undefined,
          remarks: ase.getElementsByTagName('txtRmk')[0]?.textContent || undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: ase.getAttribute('mid') || undefined
        };
        
        this.airspaces.push(airspace);
        
      } catch (error) {
        if (error instanceof SIAMissingDataError) throw error;
        console.warn(`⚠️ Erreur parsing espace aérien ${i}:`, error);
      }
    }
  }
  
  /**
   * Parse les navaids
   */
  private async parseNavaids(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');
    
    // VOR
    const vorElements = this.aixmDoc.getElementsByTagName('Vor');
    for (let i = 0; i < vorElements.length; i++) {
      const vor = vorElements[i];
      const uid = vor.getElementsByTagName('VorUid')[0];
      const ident = uid?.getElementsByTagName('codeId')[0]?.textContent;
      
      if (!ident) continue;
      
      const lat = this.parseCoordinate(vor.getElementsByTagName('geoLat')[0]?.textContent);
      const lon = this.parseCoordinate(vor.getElementsByTagName('geoLong')[0]?.textContent);
      
      if (lat === null || lon === null) {
        throw new SIAMissingDataError('navaid_coordinates', ident);
      }
      
      this.navaids.push({
        id: `NAV_VOR_${ident}`,
        type: 'VOR',
        ident: ident,
        name: vor.getElementsByTagName('txtName')[0]?.textContent || undefined,
        latitude: lat,
        longitude: lon,
        elevation_ft: this.parseNumber(vor.getElementsByTagName('valElev')[0]?.textContent),
        frequency: vor.getElementsByTagName('valFreq')[0]?.textContent || undefined,
        channel: vor.getElementsByTagName('codeChannel')[0]?.textContent || undefined,
        range_nm: this.parseNumber(vor.getElementsByTagName('valCoverageRadius')[0]?.textContent),
        magnetic_variation: this.parseNumber(vor.getElementsByTagName('valMagVar')[0]?.textContent),
        source: 'SIA',
        airac: this.airacDate,
        sia_uid: vor.getAttribute('mid') || undefined
      });
    }
    
    // NDB
    const ndbElements = this.aixmDoc.getElementsByTagName('Ndb');
    for (let i = 0; i < ndbElements.length; i++) {
      const ndb = ndbElements[i];
      const uid = ndb.getElementsByTagName('NdbUid')[0];
      const ident = uid?.getElementsByTagName('codeId')[0]?.textContent;
      
      if (!ident) continue;
      
      const lat = this.parseCoordinate(ndb.getElementsByTagName('geoLat')[0]?.textContent);
      const lon = this.parseCoordinate(ndb.getElementsByTagName('geoLong')[0]?.textContent);
      
      if (lat === null || lon === null) {
        throw new SIAMissingDataError('navaid_coordinates', ident);
      }
      
      this.navaids.push({
        id: `NAV_NDB_${ident}`,
        type: 'NDB',
        ident: ident,
        name: ndb.getElementsByTagName('txtName')[0]?.textContent || undefined,
        latitude: lat,
        longitude: lon,
        elevation_ft: this.parseNumber(ndb.getElementsByTagName('valElev')[0]?.textContent),
        frequency: ndb.getElementsByTagName('valFreq')[0]?.textContent || undefined,
        range_nm: this.parseNumber(ndb.getElementsByTagName('valCoverageRadius')[0]?.textContent),
        source: 'SIA',
        airac: this.airacDate,
        sia_uid: ndb.getAttribute('mid') || undefined
      });
    }
    
    // DME
    const dmeElements = this.aixmDoc.getElementsByTagName('Dme');
    for (let i = 0; i < dmeElements.length; i++) {
      const dme = dmeElements[i];
      const uid = dme.getElementsByTagName('DmeUid')[0];
      const ident = uid?.getElementsByTagName('codeId')[0]?.textContent;
      
      if (!ident) continue;
      
      const lat = this.parseCoordinate(dme.getElementsByTagName('geoLat')[0]?.textContent);
      const lon = this.parseCoordinate(dme.getElementsByTagName('geoLong')[0]?.textContent);
      
      if (lat === null || lon === null) {
        throw new SIAMissingDataError('navaid_coordinates', ident);
      }
      
      this.navaids.push({
        id: `NAV_DME_${ident}`,
        type: 'DME',
        ident: ident,
        name: dme.getElementsByTagName('txtName')[0]?.textContent || undefined,
        latitude: lat,
        longitude: lon,
        elevation_ft: this.parseNumber(dme.getElementsByTagName('valElev')[0]?.textContent),
        frequency: dme.getElementsByTagName('valFreq')[0]?.textContent || undefined,
        channel: dme.getElementsByTagName('codeChannel')[0]?.textContent || undefined,
        range_nm: this.parseNumber(dme.getElementsByTagName('valCoverageRadius')[0]?.textContent),
        source: 'SIA',
        airac: this.airacDate,
        sia_uid: dme.getAttribute('mid') || undefined
      });
    }
    
    console.log(`📡 Parsed ${this.navaids.length} navaids`);
  }
  
  /**
   * Parse les points désignés (VFR/IFR)
   */
  private async parseDesignatedPoints(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');
    
    const dpnElements = this.aixmDoc.getElementsByTagName('Dpn');
    console.log(`📍 Parsing ${dpnElements.length} points désignés...`);
    
    for (let i = 0; i < dpnElements.length; i++) {
      const dpn = dpnElements[i];
      
      try {
        const uid = dpn.getElementsByTagName('DpnUid')[0];
        const codeId = uid?.getElementsByTagName('codeId')[0]?.textContent;
        
        if (!codeId) continue;
        
        const lat = this.parseCoordinate(dpn.getElementsByTagName('geoLat')[0]?.textContent);
        const lon = this.parseCoordinate(dpn.getElementsByTagName('geoLong')[0]?.textContent);
        
        if (lat === null || lon === null) {
          throw new SIAMissingDataError('designated_point_coordinates', codeId);
        }
        
        const codeType = dpn.getElementsByTagName('codeType')[0]?.textContent;
        const txtRmk = dpn.getElementsByTagName('txtRmk')[0]?.textContent || undefined;

        // Aérodrome associé (AhpUidAssoc) → marque un point de report VFR. Fallbacks :
        // code OACI dans la remarque, ou préfixe du code (ex "LFST-S").
        const ahpAssoc = dpn.getElementsByTagName('AhpUidAssoc')[0];
        let aerodromeIcao = ahpAssoc ? this.directChildText(ahpAssoc, 'codeId') : null;
        if (!aerodromeIcao && txtRmk) {
          const m = txtRmk.match(/\b(LF[A-Z]{2})\b/);
          if (m) aerodromeIcao = m[1];
        }
        if (!aerodromeIcao && codeId) {
          const m = codeId.match(/^(LF[A-Z]{2})[-_ ]/);
          if (m) aerodromeIcao = m[1];
        }

        const mandatory = codeType === 'COMPULSORY-REP' || codeType === 'VFR-MRP'
          || /COMPULSORY|MRP/i.test(txtRmk || '');
        // VFR si associé à un AD, ou si le codeType/la remarque l'indiquent.
        const isVFR = !!aerodromeIcao
          || /VFR|VRP|VISUAL|REPORT/i.test(txtRmk || '')
          || /VFR|VRP/i.test(codeType || '');
        let type = this.parseDesignatedPointType(codeType);
        if (isVFR && type === 'OTHER') {
          type = mandatory ? 'VFR-COMPULSORY' : 'VFR-RP';
        }

        this.designatedPoints.push({
          id: `DPN_${codeId}`,
          type: type,
          code: codeId,
          name: dpn.getElementsByTagName('txtName')[0]?.textContent || codeId,
          latitude: lat,
          longitude: lon,
          aerodrome_icao: aerodromeIcao || undefined,
          mandatory,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: dpn.getAttribute('mid') || undefined
        });
        
      } catch (error) {
        if (error instanceof SIAMissingDataError) throw error;
        console.warn(`⚠️ Erreur parsing point désigné ${i}:`, error);
      }
    }
  }
  
  /**
   * Parse les pistes
   */
  private async parseRunways(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');
    
    const rwyElements = this.aixmDoc.getElementsByTagName('Rwy');
    console.log(`🛫 Parsing ${rwyElements.length} pistes...`);
    
    for (let i = 0; i < rwyElements.length; i++) {
      const rwy = rwyElements[i];
      
      try {
        const uid = rwy.getElementsByTagName('RwyUid')[0];
        const ahpUid = uid?.getElementsByTagName('AhpUid')[0];
        const airportCode = ahpUid?.getElementsByTagName('codeId')[0]?.textContent;
        const designation = uid?.getElementsByTagName('txtDesig')[0]?.textContent;
        
        if (!airportCode || !designation) continue;
        
        const runway: Runway = {
          id: `RWY_${airportCode}_${designation}`,
          aerodrome_id: `AD_${airportCode}`,
          aerodrome_icao: airportCode,
          designation: designation,
          length_m: this.parseNumber(rwy.getElementsByTagName('valLen')[0]?.textContent),
          width_m: this.parseNumber(rwy.getElementsByTagName('valWid')[0]?.textContent),
          surface: rwy.getElementsByTagName('codeComposition')[0]?.textContent || undefined,
          strength: rwy.getElementsByTagName('codeStrength')[0]?.textContent || undefined,
          pcn: rwy.getElementsByTagName('txtPcnNote')[0]?.textContent || undefined,
          magnetic_bearing: this.parseNumber(rwy.getElementsByTagName('valBrgMag')[0]?.textContent),
          true_bearing: this.parseNumber(rwy.getElementsByTagName('valBrgTrue')[0]?.textContent),
          threshold_elevation_ft: this.parseNumber(rwy.getElementsByTagName('valElevThr')[0]?.textContent),
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: rwy.getAttribute('mid') || undefined
        };
        
        // Convertir les unités si nécessaire
        const lengthUnit = rwy.getElementsByTagName('uomDimRwy')[0]?.textContent;
        if (lengthUnit === 'FT') {
          runway.length_ft = runway.length_m;
          runway.length_m = runway.length_m ? Math.round(runway.length_m * 0.3048) : undefined;
          runway.width_ft = runway.width_m;
          runway.width_m = runway.width_m ? Math.round(runway.width_m * 0.3048) : undefined;
        }
        
        this.runways.push(runway);
        
      } catch (error) {
        console.warn(`⚠️ Erreur parsing piste ${i}:`, error);
      }
    }
  }

  /**
   * Parse les distances déclarées (Rdd AIXM) et les attache aux pistes.
   * Chaque Rdd vaut pour UNE direction (ex: "30L" de la piste "12R/30L") et un type
   * (TORA/TODA/ASDA/LDA). On regroupe par piste → direction → { type: distance_m }.
   */
  private async parseDeclaredDistances(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const rddElements = this.aixmDoc.getElementsByTagName('Rdd');
    console.log(`📏 Parsing ${rddElements.length} distances déclarées (Rdd)...`);

    // runwayId → { direction → { TORA?, TODA?, ASDA?, LDA? } } en mètres
    const byRunway = new Map<string, Record<string, Record<string, number>>>();

    for (let i = 0; i < rddElements.length; i++) {
      const rdd = rddElements[i];
      try {
        const rddUid = rdd.getElementsByTagName('RddUid')[0];
        const rdnUid = rddUid?.getElementsByTagName('RdnUid')[0];
        const rwyUid = rdnUid?.getElementsByTagName('RwyUid')[0];
        const ahpUid = rwyUid?.getElementsByTagName('AhpUid')[0];

        const icao = this.directChildText(ahpUid, 'codeId');
        const rwyDesig = this.directChildText(rwyUid, 'txtDesig');
        const rdnDesig = this.directChildText(rdnUid, 'txtDesig'); // direction (ex: "30L")
        const codeType = this.directChildText(rddUid, 'codeType'); // TORA/TODA/ASDA/LDA
        let dist = this.parseNumber(rdd.getElementsByTagName('valDist')[0]?.textContent);
        const unit = rdd.getElementsByTagName('uomDist')[0]?.textContent;

        if (!icao || !rwyDesig || !rdnDesig || !codeType || dist == null) continue;
        if (unit === 'FT') dist = Math.round(dist * 0.3048);

        const rwyId = `RWY_${icao}_${rwyDesig}`;
        const dirs = byRunway.get(rwyId) || {};
        byRunway.set(rwyId, dirs);
        if (!dirs[rdnDesig]) dirs[rdnDesig] = {};
        dirs[rdnDesig][codeType] = dist;
      } catch (error) {
        console.warn(`⚠️ Erreur parsing distance déclarée ${i}:`, error);
      }
    }

    // Attacher aux pistes déjà parsées (match par id RWY_<icao>_<désignation>).
    let attached = 0;
    for (const rwy of this.runways) {
      const dd = byRunway.get(rwy.id);
      if (dd) {
        rwy.declared_distances = dd as Runway['declared_distances'];
        attached++;
      }
    }
    console.log(`  → distances déclarées attachées à ${attached}/${this.runways.length} pistes`);
  }

  /**
   * Parse les obstacles
   */
  private async parseObstacles(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');
    
    const obsElements = this.aixmDoc.getElementsByTagName('Obs');
    console.log(`⚠️ Parsing ${obsElements.length} obstacles...`);
    
    for (let i = 0; i < obsElements.length; i++) {
      const obs = obsElements[i];
      
      try {
        const uid = obs.getElementsByTagName('ObsUid')[0];
        const lat = this.parseCoordinate(uid?.getElementsByTagName('geoLat')[0]?.textContent);
        const lon = this.parseCoordinate(uid?.getElementsByTagName('geoLong')[0]?.textContent);

        if (lat === null || lon === null) continue;

        const obsMid = uid?.getAttribute('mid') || undefined;
        if (obsMid) {
          this.obstacleMidToCoords.set(obsMid, { lat, lon });
        }

        const obstacle: Obstacle = {
          id: `OBS_${lat}_${lon}`.replace(/\./g, '_'),
          type: obs.getElementsByTagName('codeType')[0]?.textContent || undefined,
          name: obs.getElementsByTagName('txtName')[0]?.textContent || undefined,
          latitude: lat,
          longitude: lon,
          elevation_ft: this.parseNumber(obs.getElementsByTagName('valElev')[0]?.textContent),
          height_ft: this.parseNumber(obs.getElementsByTagName('valHgt')[0]?.textContent),
          lighting: obs.getElementsByTagName('codeLgt')[0]?.textContent === 'Y' ? 'LIT' : 'UNLIT',
          marking: obs.getElementsByTagName('codeMarking')[0]?.textContent || undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: obsMid
        };
        
        // Calculer hauteur totale
        if (obstacle.elevation_ft && obstacle.height_ft) {
          obstacle.total_height_ft = obstacle.elevation_ft + obstacle.height_ft;
        }
        
        this.obstacles.push(obstacle);
        
      } catch (error) {
        console.warn(`⚠️ Erreur parsing obstacle ${i}:`, error);
      }
    }
  }
  
  /**
   * Parse les organisations (Org)
   */
  private async parseOrganizations(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const orgElements = this.aixmDoc.getElementsByTagName('Org');
    console.log(`🏛️ Parsing ${orgElements.length} organisations...`);

    for (let i = 0; i < orgElements.length; i++) {
      const org = orgElements[i];
      try {
        const uid = org.getElementsByTagName('OrgUid')[0];
        const name = uid?.getElementsByTagName('txtName')[0]?.textContent;
        const codeId = org.getElementsByTagName('codeId')[0]?.textContent;

        if (!name || !codeId) continue;

        this.organizations.push({
          id: `ORG_${codeId}_${i}`,
          code_id: codeId,
          name: name,
          type: org.getElementsByTagName('codeType')[0]?.textContent || undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Org ${i}:`, error);
      }
    }
  }

  /**
   * Parse les unités ATC (Uni)
   */
  private async parseATCUnits(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const uniElements = this.aixmDoc.getElementsByTagName('Uni');
    console.log(`🎙️ Parsing ${uniElements.length} unités ATC...`);

    for (let i = 0; i < uniElements.length; i++) {
      const uni = uniElements[i];
      try {
        const uid = uni.getElementsByTagName('UniUid')[0];
        const name = uid?.getElementsByTagName('txtName')[0]?.textContent;
        if (!name) continue;

        const orgUid = uni.getElementsByTagName('OrgUid')[0];
        const ahpUid = uni.getElementsByTagName('AhpUid')[0];
        const lat = this.parseCoordinate(uni.getElementsByTagName('geoLat')[0]?.textContent);
        const lon = this.parseCoordinate(uni.getElementsByTagName('geoLong')[0]?.textContent);

        this.atcUnits.push({
          id: `UNI_${uid?.getAttribute('mid') || i}`,
          name: name,
          org_name: orgUid?.getElementsByTagName('txtName')[0]?.textContent || undefined,
          aerodrome_icao: ahpUid?.getElementsByTagName('codeId')[0]?.textContent || undefined,
          type: uni.getElementsByTagName('codeType')[0]?.textContent || undefined,
          class: uni.getElementsByTagName('codeClass')[0]?.textContent || undefined,
          latitude: lat ?? undefined,
          longitude: lon ?? undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Uni ${i}:`, error);
      }
    }
  }

  /**
   * Parse les services ATS (Ser)
   */
  private async parseATSServices(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const serElements = this.aixmDoc.getElementsByTagName('Ser');
    console.log(`📡 Parsing ${serElements.length} services ATS...`);

    for (let i = 0; i < serElements.length; i++) {
      const ser = serElements[i];
      try {
        const uid = ser.getElementsByTagName('SerUid')[0];
        const uniUid = uid?.getElementsByTagName('UniUid')[0];
        const unitName = uniUid?.getElementsByTagName('txtName')[0]?.textContent || undefined;
        const codeType = uid?.getElementsByTagName('codeType')[0]?.textContent || 'OTHER';
        const noSeq = this.parseNumber(uid?.getElementsByTagName('noSeq')[0]?.textContent);

        const lat = this.parseCoordinate(ser.getElementsByTagName('geoLat')[0]?.textContent);
        const lon = this.parseCoordinate(ser.getElementsByTagName('geoLong')[0]?.textContent);

        this.atsServices.push({
          id: `SER_${uid?.getAttribute('mid') || i}`,
          unit_name: unitName,
          type: codeType,
          sequence: noSeq,
          latitude: lat ?? undefined,
          longitude: lon ?? undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Ser ${i}:`, error);
      }
    }
  }

  /**
   * Parse les ILS (avec Localizer Ilz, Glide path Igp, DME associé, catégorie)
   */
  private async parseILS(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const ilsElements = this.aixmDoc.getElementsByTagName('Ils');
    console.log(`✈️ Parsing ${ilsElements.length} ILS...`);

    for (let i = 0; i < ilsElements.length; i++) {
      const ils = ilsElements[i];
      try {
        const uid = ils.getElementsByTagName('IlsUid')[0];
        const rdnUid = uid?.getElementsByTagName('RdnUid')[0];
        const rwyUid = rdnUid?.getElementsByTagName('RwyUid')[0];
        const ahpUid = rwyUid?.getElementsByTagName('AhpUid')[0];

        const icao = this.directChildText(ahpUid, 'codeId');
        const rwyDesig = this.directChildText(rwyUid, 'txtDesig');
        const rdnDesig = this.directChildText(rdnUid, 'txtDesig');

        if (!icao || !rwyDesig || !rdnDesig) continue;

        // Localizer (Ilz)
        const ilz = ils.getElementsByTagName('Ilz')[0];
        const ilzLat = this.parseCoordinate(ilz?.getElementsByTagName('geoLat')[0]?.textContent);
        const ilzLon = this.parseCoordinate(ilz?.getElementsByTagName('geoLong')[0]?.textContent);
        const ilt = ilz?.getElementsByTagName('Ilt')[0];

        // Glide path (Igp)
        const igp = ils.getElementsByTagName('Igp')[0];
        const igpLat = this.parseCoordinate(igp?.getElementsByTagName('geoLat')[0]?.textContent);
        const igpLon = this.parseCoordinate(igp?.getElementsByTagName('geoLong')[0]?.textContent);
        const igt = igp?.getElementsByTagName('Igt')[0];

        // DME associé
        const dmeUid = ils.getElementsByTagName('DmeUid')[0];
        const dmeIdent = dmeUid?.getElementsByTagName('codeId')[0]?.textContent || undefined;

        const cat = ils.getElementsByTagName('codeCat')[0]?.textContent;

        this.ilsList.push({
          id: `ILS_${icao}_${rwyDesig}_${rdnDesig}`,
          runway_id: `RWY_${icao}_${rwyDesig}`,
          aerodrome_icao: icao,
          runway_designator: rwyDesig,
          runway_direction: rdnDesig,
          category: (cat as ILS['category']) || undefined,
          loc_ident: ilz?.getElementsByTagName('codeId')[0]?.textContent || undefined,
          loc_frequency_mhz: this.parseNumber(ilz?.getElementsByTagName('valFreq')[0]?.textContent),
          loc_latitude: ilzLat ?? undefined,
          loc_longitude: ilzLon ?? undefined,
          loc_elevation_ft: this.parseNumber(ilz?.getElementsByTagName('valElev')[0]?.textContent),
          loc_hours_code: ilt?.getElementsByTagName('codeWorkHr')[0]?.textContent || undefined,
          gp_frequency_mhz: this.parseNumber(igp?.getElementsByTagName('valFreq')[0]?.textContent),
          gp_slope_deg: this.parseNumber(igp?.getElementsByTagName('valSlope')[0]?.textContent),
          gp_rdh_m: this.parseNumber(igp?.getElementsByTagName('valRdh')[0]?.textContent),
          gp_latitude: igpLat ?? undefined,
          gp_longitude: igpLon ?? undefined,
          gp_elevation_ft: this.parseNumber(igp?.getElementsByTagName('valElev')[0]?.textContent),
          gp_hours_code: igt?.getElementsByTagName('codeWorkHr')[0]?.textContent || undefined,
          dme_ident: dmeIdent,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing ILS ${i}:`, error);
      }
    }
  }

  /**
   * Parse les routes ATS (Rte) avec leurs segments (Rsg).
   * Les Rsg référencent leur Rte par mid → on indexe les Rte par mid d'abord.
   */
  private async parseATSRoutes(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const rteElements = this.aixmDoc.getElementsByTagName('Rte');
    console.log(`🛣️ Parsing ${rteElements.length} routes ATS...`);

    // Index Rte par mid
    const rteByMid = new Map<string, ATSRouteComplete>();
    for (let i = 0; i < rteElements.length; i++) {
      const rte = rteElements[i];
      const uid = rte.getElementsByTagName('RteUid')[0];
      const mid = uid?.getAttribute('mid');
      const designation = uid?.getElementsByTagName('txtDesig')[0]?.textContent;
      const locDesig = uid?.getElementsByTagName('txtLocDesig')[0]?.textContent || undefined;

      if (!mid || !designation) continue;

      const route: ATSRouteComplete = {
        id: `RTE_${designation}_${locDesig || 'NA'}`,
        designation: designation,
        location_designator: locDesig,
        segments: [],
        source: 'SIA',
        airac: this.airacDate,
        sia_uid: mid
      };
      rteByMid.set(mid, route);
      this.atsRoutes.push(route);
    }

    // Parse segments Rsg
    const rsgElements = this.aixmDoc.getElementsByTagName('Rsg');
    console.log(`   ↳ ${rsgElements.length} segments à attacher`);
    let attached = 0;
    for (let i = 0; i < rsgElements.length; i++) {
      const rsg = rsgElements[i];
      try {
        const rsgUid = rsg.getElementsByTagName('RsgUid')[0];
        const rteUidRef = rsgUid?.getElementsByTagName('RteUid')[0];
        const rteMid = rteUidRef?.getAttribute('mid');
        if (!rteMid) continue;

        const route = rteByMid.get(rteMid);
        if (!route) continue;

        // Sta = start, End = end (peuvent être DpnUid, VorUid, DmeUid, NdbUid)
        const findRef = (suffix: 'Sta' | 'End') => {
          for (const tag of ['DpnUid', 'VorUid', 'DmeUid', 'NdbUid']) {
            const refs = rsgUid?.getElementsByTagName(tag + suffix);
            if (refs && refs.length > 0) {
              return {
                ident: refs[0].getElementsByTagName('codeId')[0]?.textContent || undefined,
                type: tag.replace('Uid', '').toUpperCase()
              };
            }
          }
          return { ident: undefined, type: undefined };
        };
        const start = findRef('Sta');
        const end = findRef('End');

        const segment: ATSRouteSegmentDetail = {
          start_ident: start.ident,
          start_type: start.type,
          end_ident: end.ident,
          end_type: end.type,
          type: rsg.getElementsByTagName('codeType')[0]?.textContent || undefined,
          rnp: rsg.getElementsByTagName('codeRnp')[0]?.textContent || undefined,
          level: rsg.getElementsByTagName('codeLvl')[0]?.textContent || undefined,
          upper_limit: this.parseNumber(rsg.getElementsByTagName('valDistVerUpper')[0]?.textContent),
          upper_limit_unit: rsg.getElementsByTagName('uomDistVerUpper')[0]?.textContent || undefined,
          lower_limit: this.parseNumber(rsg.getElementsByTagName('valDistVerLower')[0]?.textContent),
          lower_limit_unit: rsg.getElementsByTagName('uomDistVerLower')[0]?.textContent || undefined,
          true_track: this.parseNumber(rsg.getElementsByTagName('valTrueTrack')[0]?.textContent),
          magnetic_track: this.parseNumber(rsg.getElementsByTagName('valMagTrack')[0]?.textContent),
          reverse_true_track: this.parseNumber(rsg.getElementsByTagName('valReversTrueTrack')[0]?.textContent),
          reverse_magnetic_track: this.parseNumber(rsg.getElementsByTagName('valReversMagTrack')[0]?.textContent),
          length_nm: this.parseNumber(rsg.getElementsByTagName('valLen')[0]?.textContent)
        };
        route.segments.push(segment);
        attached++;
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Rsg ${i}:`, error);
      }
    }
    console.log(`   ↳ ${attached} segments attachés`);
  }

  /**
   * Parse les services aérodrome opérationnels (Ahs) — FIRE/FUEL/HANGAR/REPAIR/CUST/etc.
   */
  private async parseAerodromeServices(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const ahsElements = this.aixmDoc.getElementsByTagName('Ahs');
    console.log(`🔧 Parsing ${ahsElements.length} services aérodrome...`);

    for (let i = 0; i < ahsElements.length; i++) {
      const ahs = ahsElements[i];
      try {
        const uid = ahs.getElementsByTagName('AhsUid')[0];
        const ahpUid = uid?.getElementsByTagName('AhpUid')[0];
        const icao = ahpUid?.getElementsByTagName('codeId')[0]?.textContent;
        const type = uid?.getElementsByTagName('codeType')[0]?.textContent;

        if (!icao || !type) continue;

        this.aerodromeServices.push({
          id: `AHS_${uid?.getAttribute('mid') || i}`,
          aerodrome_icao: icao,
          type: type,
          category: ahs.getElementsByTagName('codeCat')[0]?.textContent || undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Ahs ${i}:`, error);
      }
    }
  }

  /**
   * Parse les commodités aérodrome (Pfy) — restaurant, hôtel, banque, etc.
   * ⚠️ Aerodrome FacilitY, PAS une procédure de vol.
   */
  private async parseAerodromeFacilities(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const pfyElements = this.aixmDoc.getElementsByTagName('Pfy');
    console.log(`🏨 Parsing ${pfyElements.length} commodités aérodrome...`);

    for (let i = 0; i < pfyElements.length; i++) {
      const pfy = pfyElements[i];
      try {
        const uid = pfy.getElementsByTagName('PfyUid')[0];
        const ahpUid = uid?.getElementsByTagName('AhpUid')[0];
        const icao = ahpUid?.getElementsByTagName('codeId')[0]?.textContent;
        const type = uid?.getElementsByTagName('codeType')[0]?.textContent;

        if (!icao || !type) continue;

        this.aerodromeFacilities.push({
          id: `PFY_${uid?.getAttribute('mid') || i}`,
          aerodrome_icao: icao,
          type: type,
          sequence: this.parseNumber(uid?.getElementsByTagName('noSeq')[0]?.textContent),
          description: pfy.getElementsByTagName('txtDescr')[0]?.textContent || undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Pfy ${i}:`, error);
      }
    }
  }

  /**
   * Parse les limitations d'usage aérodrome (Ahu) — PPR, restrictions de vol.
   */
  private async parseAerodromeUsageLimitations(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const ahuElements = this.aixmDoc.getElementsByTagName('Ahu');
    console.log(`🚧 Parsing ${ahuElements.length} limitations d'usage...`);

    for (let i = 0; i < ahuElements.length; i++) {
      const ahu = ahuElements[i];
      try {
        const uid = ahu.getElementsByTagName('AhuUid')[0];
        const ahpUid = uid?.getElementsByTagName('AhpUid')[0];
        const icao = ahpUid?.getElementsByTagName('codeId')[0]?.textContent;
        const limitation = ahu.getElementsByTagName('codeUsageLimitation')[0]?.textContent;
        if (!icao || !limitation) continue;

        const flightClass = ahu.getElementsByTagName('FlightClass')[0];

        this.aerodromeUsageLimitations.push({
          id: `AHU_${uid?.getAttribute('mid') || i}`,
          aerodrome_icao: icao,
          limitation: limitation,
          flight_rule: flightClass?.getElementsByTagName('codeRule')[0]?.textContent || undefined,
          flight_status: flightClass?.getElementsByTagName('codeStatus')[0]?.textContent || undefined,
          flight_origin: flightClass?.getElementsByTagName('codeOrigin')[0]?.textContent || undefined,
          flight_purpose: flightClass?.getElementsByTagName('codePurpose')[0]?.textContent || undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Ahu ${i}:`, error);
      }
    }
  }

  /**
   * Parse les adresses aérodrome (Aha) — postales, etc.
   */
  private async parseAerodromeAddresses(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const ahaElements = this.aixmDoc.getElementsByTagName('Aha');
    console.log(`✉️ Parsing ${ahaElements.length} adresses aérodrome...`);

    for (let i = 0; i < ahaElements.length; i++) {
      const aha = ahaElements[i];
      try {
        const uid = aha.getElementsByTagName('AhaUid')[0];
        const ahpUid = uid?.getElementsByTagName('AhpUid')[0];
        const icao = ahpUid?.getElementsByTagName('codeId')[0]?.textContent;
        const type = uid?.getElementsByTagName('codeType')[0]?.textContent;
        const address = aha.getElementsByTagName('txtAddress')[0]?.textContent;
        if (!icao || !type || !address) continue;

        this.aerodromeAddresses.push({
          id: `AHA_${uid?.getAttribute('mid') || i}`,
          aerodrome_icao: icao,
          type: type,
          sequence: this.parseNumber(uid?.getElementsByTagName('noSeq')[0]?.textContent),
          address: address,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Aha ${i}:`, error);
      }
    }
  }

  /**
   * Parse les liaisons Obstacle ↔ Aérodrome (Aho).
   */
  private async parseObstacleAerodromeLinks(): Promise<void> {
    if (!this.aixmDoc) throw new Error('Document AIXM non chargé');

    const ahoElements = this.aixmDoc.getElementsByTagName('Aho');
    console.log(`🏗️ Parsing ${ahoElements.length} liaisons Obstacle↔AD...`);

    for (let i = 0; i < ahoElements.length; i++) {
      const aho = ahoElements[i];
      try {
        const uid = aho.getElementsByTagName('AhoUid')[0];
        const obsUid = uid?.getElementsByTagName('ObsUid')[0];
        const ahpUid = uid?.getElementsByTagName('AhpUid')[0];
        const icao = ahpUid?.getElementsByTagName('codeId')[0]?.textContent;
        if (!icao) continue;

        const obsMid = obsUid?.getAttribute('mid') || undefined;
        const obsLat = this.parseCoordinate(obsUid?.getElementsByTagName('geoLat')[0]?.textContent);
        const obsLon = this.parseCoordinate(obsUid?.getElementsByTagName('geoLong')[0]?.textContent);

        this.obstacleLinks.push({
          id: `AHO_${uid?.getAttribute('mid') || i}`,
          aerodrome_icao: icao,
          obstacle_sia_uid: obsMid,
          obstacle_latitude: obsLat ?? undefined,
          obstacle_longitude: obsLon ?? undefined,
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: uid?.getAttribute('mid') || undefined
        });
      } catch (error) {
        console.warn(`⚠️ Erreur parsing Aho ${i}:`, error);
      }
    }
  }

  /**
   * Génère les fichiers GeoJSON
   */
  private async generateGeoJSON(): Promise<void> {
    console.log('📝 Génération des fichiers GeoJSON...');
    
    // Aérodromes
    const aerodromeFeatures: FeatureCollection<Point, Aerodrome> = {
      type: 'FeatureCollection',
      features: this.aerodromes.map(ad => ({
        type: 'Feature',
        id: ad.id,
        geometry: {
          type: 'Point',
          coordinates: [ad.longitude, ad.latitude]
        },
        properties: ad
      }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'aerodromes.geojson'),
      JSON.stringify(aerodromeFeatures, null, 2)
    );
    
    // Espaces aériens
    const airspaceFeatures: FeatureCollection<Polygon | MultiPolygon, Airspace> = {
      type: 'FeatureCollection',
      features: this.airspaces.map(as => ({
        type: 'Feature',
        id: as.id,
        geometry: as.geometry,
        properties: { ...as, geometry: undefined } as any
      }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'airspaces.geojson'),
      JSON.stringify(airspaceFeatures, null, 2)
    );
    
    // Navaids
    const navaidFeatures: FeatureCollection<Point, Navaid> = {
      type: 'FeatureCollection',
      features: this.navaids.map(nav => ({
        type: 'Feature',
        id: nav.id,
        geometry: {
          type: 'Point',
          coordinates: [nav.longitude, nav.latitude]
        },
        properties: nav
      }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'navaids.geojson'),
      JSON.stringify(navaidFeatures, null, 2)
    );
    
    // Points désignés
    const designatedPointFeatures: FeatureCollection<Point, DesignatedPoint> = {
      type: 'FeatureCollection',
      features: this.designatedPoints.map(dp => ({
        type: 'Feature',
        id: dp.id,
        geometry: {
          type: 'Point',
          coordinates: [dp.longitude, dp.latitude]
        },
        properties: dp
      }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'designated_points.geojson'),
      JSON.stringify(designatedPointFeatures, null, 2)
    );
    
    // Pistes
    const runwayFeatures: FeatureCollection<LineString, Runway> = {
      type: 'FeatureCollection',
      features: this.runways.map(rwy => ({
        type: 'Feature',
        id: rwy.id,
        geometry: rwy.geometry || {
          type: 'LineString',
          coordinates: [] // Géométrie à calculer si nécessaire
        },
        properties: rwy
      }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'runways.geojson'),
      JSON.stringify(runwayFeatures, null, 2)
    );
    
    // Obstacles
    const obstacleFeatures: FeatureCollection<Point, Obstacle> = {
      type: 'FeatureCollection',
      features: this.obstacles.map(obs => ({
        type: 'Feature',
        id: obs.id,
        geometry: {
          type: 'Point',
          coordinates: [obs.longitude, obs.latitude]
        },
        properties: obs
      }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'obstacles.geojson'),
      JSON.stringify(obstacleFeatures, null, 2)
    );

    // ILS (Point sur la position du Localizer, GP en propriétés)
    const ilsFeatures: FeatureCollection<Point, ILS> = {
      type: 'FeatureCollection',
      features: this.ilsList
        .filter(ils => ils.loc_latitude !== undefined && ils.loc_longitude !== undefined)
        .map(ils => ({
          type: 'Feature',
          id: ils.id,
          geometry: {
            type: 'Point',
            coordinates: [ils.loc_longitude!, ils.loc_latitude!]
          },
          properties: ils
        }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'ils.geojson'),
      JSON.stringify(ilsFeatures, null, 2)
    );

    // Services ATS (Point pour ceux avec coords)
    const serviceFeatures: FeatureCollection<Point, ATSService> = {
      type: 'FeatureCollection',
      features: this.atsServices
        .filter(s => s.latitude !== undefined && s.longitude !== undefined)
        .map(s => ({
          type: 'Feature',
          id: s.id,
          geometry: {
            type: 'Point',
            coordinates: [s.longitude!, s.latitude!]
          },
          properties: s
        }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'ats_services.geojson'),
      JSON.stringify(serviceFeatures, null, 2)
    );
    // Et la version table complète (incluant ceux sans coords)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'ats_services.json'),
      JSON.stringify({ airac: this.airacDate, count: this.atsServices.length, items: this.atsServices }, null, 2)
    );

    // Unités ATC (Point)
    const unitFeatures: FeatureCollection<Point, ATCUnit> = {
      type: 'FeatureCollection',
      features: this.atcUnits
        .filter(u => u.latitude !== undefined && u.longitude !== undefined)
        .map(u => ({
          type: 'Feature',
          id: u.id,
          geometry: {
            type: 'Point',
            coordinates: [u.longitude!, u.latitude!]
          },
          properties: u
        }))
    };
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'atc_units.geojson'),
      JSON.stringify(unitFeatures, null, 2)
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'atc_units.json'),
      JSON.stringify({ airac: this.airacDate, count: this.atcUnits.length, items: this.atcUnits }, null, 2)
    );

    // Organisations (table seule)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'organizations.json'),
      JSON.stringify({ airac: this.airacDate, count: this.organizations.length, items: this.organizations }, null, 2)
    );

    // Routes ATS (table avec segments imbriqués)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'ats_routes.json'),
      JSON.stringify({ airac: this.airacDate, count: this.atsRoutes.length, items: this.atsRoutes }, null, 2)
    );

    // Services aérodrome (table)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'aerodrome_services.json'),
      JSON.stringify({ airac: this.airacDate, count: this.aerodromeServices.length, items: this.aerodromeServices }, null, 2)
    );

    // Commodités aérodrome (table)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'aerodrome_facilities.json'),
      JSON.stringify({ airac: this.airacDate, count: this.aerodromeFacilities.length, items: this.aerodromeFacilities }, null, 2)
    );

    // Limitations d'usage aérodrome (table)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'aerodrome_usage_limitations.json'),
      JSON.stringify({ airac: this.airacDate, count: this.aerodromeUsageLimitations.length, items: this.aerodromeUsageLimitations }, null, 2)
    );

    // Adresses aérodrome (table)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'aerodrome_addresses.json'),
      JSON.stringify({ airac: this.airacDate, count: this.aerodromeAddresses.length, items: this.aerodromeAddresses }, null, 2)
    );

    // Liaisons Obstacle ↔ Aérodrome (table)
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'obstacle_aerodrome_links.json'),
      JSON.stringify({ airac: this.airacDate, count: this.obstacleLinks.length, items: this.obstacleLinks }, null, 2)
    );

    console.log(`✅ GeoJSON + JSON générés dans ${OUTPUT_DIR}`);
  }
  
  /**
   * Affiche les statistiques
   */
  private printStatistics(): void {
    console.log('\n📊 Statistiques ETL:');
    console.log(`  - Aérodromes: ${this.aerodromes.length}`);
    console.log(`  - Espaces aériens: ${this.airspaces.length}`);
    console.log(`  - Navaids: ${this.navaids.length}`);
    console.log(`  - Points désignés: ${this.designatedPoints.length}`);
    console.log(`  - Pistes: ${this.runways.length}`);
    console.log(`  - Obstacles: ${this.obstacles.length}`);
    console.log(`  - ILS: ${this.ilsList.length}`);
    console.log(`  - Services ATS: ${this.atsServices.length}`);
    console.log(`  - Unités ATC: ${this.atcUnits.length}`);
    console.log(`  - Organisations: ${this.organizations.length}`);
    console.log(`  - Routes ATS: ${this.atsRoutes.length} (avec ${this.atsRoutes.reduce((acc, r) => acc + r.segments.length, 0)} segments)`);
    console.log(`  - Services AD (Ahs): ${this.aerodromeServices.length}`);
    console.log(`  - Commodités AD (Pfy): ${this.aerodromeFacilities.length}`);
    console.log(`  - Limitations usage AD (Ahu): ${this.aerodromeUsageLimitations.length}`);
    console.log(`  - Adresses AD (Aha): ${this.aerodromeAddresses.length}`);
    console.log(`  - Liaisons Obstacle↔AD (Aho): ${this.obstacleLinks.length}`);
    const adWithHours = this.aerodromes.filter(a => a.hours_code).length;
    console.log(`  - AD avec horaires (Aht): ${adWithHours}`);
    console.log(`  - Cycle AIRAC: ${this.airacDate}`);
  }
  
  // === HELPERS DE PARSING ===
  
  /**
   * Récupère le textContent du premier enfant DIRECT avec le tag donné.
   * Contrairement à getElementsByTagName qui descend récursivement.
   */
  private directChildText(parent: Element | undefined, tag: string): string | undefined {
    if (!parent) return undefined;
    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes[i] as Element;
      if (child.nodeType === 1 && child.tagName === tag) {
        return child.textContent || undefined;
      }
    }
    return undefined;
  }

  private parseCoordinate(coord: string | null | undefined): number | null {
    if (!coord) return null;

    // Format AIXM DMS: DDMMSS.ssH (ex: 484930.00N ou 0022900.00E)
    const dmsMatch = coord.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)(N|S|E|W)$/);
    if (dmsMatch) {
      const degrees = parseInt(dmsMatch[1]);
      const minutes = parseInt(dmsMatch[2]);
      const seconds = parseFloat(dmsMatch[3]);
      const direction = dmsMatch[4];

      let decimal = degrees + minutes / 60 + seconds / 3600;
      if (direction === 'S' || direction === 'W') decimal = -decimal;
      return Math.round(decimal * 1000000) / 1000000;
    }

    // Format AIXM décimal: DD.ddddddH (ex: 46.16371667N ou 005.99990561E)
    const decMatch = coord.match(/^(\d+(?:\.\d+)?)(N|S|E|W)$/);
    if (decMatch) {
      let decimal = parseFloat(decMatch[1]);
      const direction = decMatch[2];
      if (direction === 'S' || direction === 'W') decimal = -decimal;
      return Math.round(decimal * 1000000) / 1000000;
    }

    return null;
  }
  
  private parseNumber(value: string | null | undefined): number | undefined {
    if (!value) return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  
  private parseAltitude(value: string | null | undefined, unit: string | null | undefined): number | undefined {
    if (!value) return undefined;
    
    let altitude = parseFloat(value);
    if (isNaN(altitude)) return undefined;
    
    // Convertir en pieds si nécessaire
    if (unit === 'M') {
      altitude = Math.round(altitude * 3.28084);
    } else if (unit === 'FL') {
      altitude = altitude * 100;
    }
    
    return altitude;
  }
  
  private parseAltRef(ref: string | null | undefined): "AMSL" | "AGL" | "STD" | "SFC" | "GND" | "UNL" | "UNDEFINED" {
    if (!ref) return "UNDEFINED";
    
    switch (ref.toUpperCase()) {
      case 'ALT':
      case 'AMSL': return "AMSL";
      case 'HEI':
      case 'AGL': return "AGL";
      case 'STD':
      case 'FL': return "STD";
      case 'SFC': return "SFC";
      case 'GND': return "GND";
      case 'UNL':
      case 'UNLIM': return "UNL";
      default: return "UNDEFINED";
    }
  }
  
  private parseAirspaceClass(cls: string | null | undefined): "A" | "B" | "C" | "D" | "E" | "F" | "G" | "UNDEFINED" {
    if (!cls) return "UNDEFINED";
    const c = cls.toUpperCase();
    if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(c)) {
      return c as any;
    }
    return "UNDEFINED";
  }
  
  private parseSpecialAirspaceType(type: string | null | undefined): "P" | "R" | "D" | "TMZ" | "RMZ" | "TSA" | "TRA" | "CBA" | "OTHER" | undefined {
    if (!type) return undefined;
    const t = type.toUpperCase();
    if (['P', 'R', 'D', 'TMZ', 'RMZ', 'TSA', 'TRA', 'CBA'].includes(t)) {
      return t as any;
    }
    return "OTHER";
  }
  
  private parseDesignatedPointType(type: string | null | undefined): "VFR-RP" | "VFR-COMPULSORY" | "VFR-OPTIONAL" | "IFR" | "RNAV" | "OTHER" {
    if (!type) return "OTHER";
    
    const t = type.toUpperCase();
    if (t.includes('VFR')) {
      if (t.includes('COMPULSORY') || t.includes('MRP')) return "VFR-COMPULSORY";
      if (t.includes('OPTIONAL')) return "VFR-OPTIONAL";
      return "VFR-RP";
    }
    if (t.includes('IFR')) return "IFR";
    if (t.includes('RNAV')) return "RNAV";
    
    return "OTHER";
  }
  
  private mapAerodromeType(type: string | null | undefined): "AD" | "HP" | "LS" | "OTHER" | undefined {
    if (!type) return undefined;
    
    switch (type.toUpperCase()) {
      case 'AD':
      case 'AH': return "AD";
      case 'HP': return "HP";
      case 'LS': return "LS";
      default: return "OTHER";
    }
  }
  
  /**
   * Construit l'index ICAO → fréquences depuis les éléments <Fqy>.
   * Lien aérodrome : <Fqy><FqyUid><SerUid><UniUid><txtName> commence par le code ICAO
   * (ex. "LFMT MONTPELLIER" → "LFMT"). Type : <SerUid><codeType> (TWR/ATIS/AFIS/APP/GND/VDF…).
   * Valeur : <valFreqTrans> (émission) ou <valFreq>.
   */
  private buildFrequencyIndex(): void {
    this.frequenciesByIcao = new Map();
    if (!this.aixmDoc) return;
    const fqyElements = this.aixmDoc.getElementsByTagName('Fqy');
    for (let i = 0; i < fqyElements.length; i++) {
      const fqy = fqyElements[i];
      const serUid = fqy.getElementsByTagName('SerUid')[0];
      if (!serUid) continue;
      const uniName = serUid.getElementsByTagName('UniUid')[0]?.getElementsByTagName('txtName')[0]?.textContent || '';
      const icao = uniName.trim().split(/\s+/)[0];
      if (!/^[A-Z]{4}$/.test(icao)) continue; // ne garder que les vrais codes ICAO (4 lettres)
      const type = serUid.getElementsByTagName('codeType')[0]?.textContent || 'OTHER';
      const value = fqy.getElementsByTagName('valFreqTrans')[0]?.textContent
                 || fqy.getElementsByTagName('valFreq')[0]?.textContent;
      if (!value || parseFloat(value) <= 0) continue; // ignorer les fréquences placeholder (0)
      const callsign = fqy.getElementsByTagName('Cdl')[0]?.getElementsByTagName('txtCallSign')[0]?.textContent || undefined;
      const ftt = fqy.getElementsByTagName('Ftt')[0];
      const schedule = ftt?.getElementsByTagName('codeWorkHr')[0]?.textContent || undefined; // ex. H24, HO
      const remarks = ftt?.getElementsByTagName('txtRmkWorkHr')[0]?.textContent || undefined;
      if (!this.frequenciesByIcao.has(icao)) this.frequenciesByIcao.set(icao, []);
      this.frequenciesByIcao.get(icao)!.push({ type, frequency: value, callsign, schedule, remarks });
    }
    const total = Array.from(this.frequenciesByIcao.values()).reduce((n, arr) => n + arr.length, 0);
    console.log(`📻 Index fréquences : ${total} fréquences sur ${this.frequenciesByIcao.size} aérodromes`);
  }

  /** Fréquences d'un aérodrome, depuis l'index <Fqy> (clé = code ICAO). */
  private parseFrequencies(icao: string): any[] {
    return this.frequenciesByIcao.get(icao) || [];
  }
  
  /**
   * Indexe les frontières d'espace aérien (Abd) par le mid de leur AseUid, pour relier
   * chaque Ase à sa (ou ses) frontière(s) — celles-ci étant des éléments séparés en AIXM.
   */
  private indexAbdByAse(): Map<string, Element[]> {
    const map = new Map<string, Element[]>();
    if (!this.aixmDoc) return map;
    const abdElements = this.aixmDoc.getElementsByTagName('Abd');
    for (let i = 0; i < abdElements.length; i++) {
      const abd = abdElements[i];
      const abdUid = abd.getElementsByTagName('AbdUid')[0];
      const aseUid = abdUid?.getElementsByTagName('AseUid')[0];
      const aseMid = aseUid?.getAttribute('mid');
      if (!aseMid) continue;
      const arr = map.get(aseMid) || [];
      arr.push(abd);
      map.set(aseMid, arr);
    }
    return map;
  }

  /**
   * Reconstruit la géométrie d'un espace à partir de ses frontières Abd (→ Avx).
   * Approximation : chaque Avx est traité comme un sommet (segments droits) ; les arcs
   * (codeType CWA/CCA) et cercles ne sont pas interpolés — suffisant pour l'affichage/
   * détection de pénétration, à raffiner si besoin.
   */
  private parseAirspaceGeometry(abdElements: Element[]): Polygon | MultiPolygon | null {
    const coordinates: number[][][] = [];

    try {
      for (let i = 0; i < abdElements.length; i++) {
        const abd = abdElements[i];
        const ring: number[][] = [];
        
        const avxElements = abd.getElementsByTagName('Avx');
        for (let j = 0; j < avxElements.length; j++) {
          const avx = avxElements[j];
          const lat = this.parseCoordinate(avx.getElementsByTagName('geoLat')[0]?.textContent);
          const lon = this.parseCoordinate(avx.getElementsByTagName('geoLong')[0]?.textContent);
          
          if (lat !== null && lon !== null) {
            ring.push([lon, lat]);
          }
        }
        
        if (ring.length > 0) {
          // Fermer le polygone si nécessaire
          if (ring[0][0] !== ring[ring.length - 1][0] || 
              ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push(ring[0]);
          }
          coordinates.push(ring);
        }
      }
      
      if (coordinates.length === 0) return null;
      
      if (coordinates.length === 1) {
        return {
          type: 'Polygon',
          coordinates: coordinates
        };
      } else {
        return {
          type: 'MultiPolygon',
          coordinates: [coordinates]
        };
      }
      
    } catch (error) {
      console.warn('Erreur parsing géométrie:', error);
      return null;
    }
  }
}

// Lancer l'ETL
const etl = new SIAETL();
etl.run().catch(error => {
  console.error('❌ Erreur fatale ETL:', error);
  process.exit(1);
});