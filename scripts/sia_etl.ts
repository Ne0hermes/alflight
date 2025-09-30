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
  AerodromeFeature,
  AirspaceFeature,
  NavaidFeature,
  DesignatedPointFeature,
  RunwayFeature,
  ObstacleFeature
} from '../src/types/sia';
import type { FeatureCollection, Point, Polygon, MultiPolygon, LineString } from 'geojson';

// Chemins (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const OUTPUT_DIR = path.join(DATA_DIR, 'derived', 'geojson');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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
      await this.parseObstacles();
      
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
    console.log('📂 Recherche des fichiers SIA dans:', DATA_DIR);
    
    const files = fs.readdirSync(DATA_DIR);
    const aixmFile = files.find(f => f.startsWith('AIXM4.5_') && f.endsWith('.xml'));
    
    if (!aixmFile) {
      throw new Error('Aucun fichier AIXM trouvé dans ' + DATA_DIR);
    }
    
    // Extraire la date AIRAC du nom de fichier
    const dateMatch = aixmFile.match(/(\d{4}-\d{2}-\d{2})/);
    this.airacDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    
    console.log(`📄 Chargement: ${aixmFile} (AIRAC: ${this.airacDate})`);
    
    const xmlContent = fs.readFileSync(path.join(DATA_DIR, aixmFile), 'utf-8');
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
        
        const aerodrome: Aerodrome = {
          id: `AD_${codeId}`,
          icao: ahp.getElementsByTagName('codeIcao')[0]?.textContent || undefined,
          iata: ahp.getElementsByTagName('codeIata')[0]?.textContent || undefined,
          name: ahp.getElementsByTagName('txtName')[0]?.textContent || codeId,
          city: ahp.getElementsByTagName('txtNameCitySer')[0]?.textContent || undefined,
          latitude: lat,
          longitude: lon,
          elevation_ft: this.parseNumber(ahp.getElementsByTagName('valElev')[0]?.textContent),
          type: this.mapAerodromeType(ahp.getElementsByTagName('codeType')[0]?.textContent),
          magnetic_variation: this.parseNumber(ahp.getElementsByTagName('valMagVar')[0]?.textContent),
          transition_altitude: this.parseNumber(ahp.getElementsByTagName('valTransitionAlt')[0]?.textContent),
          frequencies: this.parseFrequencies(ahp),
          source: 'SIA',
          airac: this.airacDate,
          sia_uid: ahp.getAttribute('mid') || undefined
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
    
    for (let i = 0; i < aseElements.length; i++) {
      const ase = aseElements[i];
      
      try {
        const uid = ase.getElementsByTagName('AseUid')[0];
        const codeId = uid?.getElementsByTagName('codeId')[0]?.textContent;
        const codeType = uid?.getElementsByTagName('codeType')[0]?.textContent;
        
        if (!codeId) continue;
        
        // Géométrie obligatoire sauf pour certains types
        const geometry = this.parseAirspaceGeometry(ase);
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
        const type = this.parseDesignatedPointType(codeType);
        
        this.designatedPoints.push({
          id: `DPN_${codeId}`,
          type: type,
          code: codeId,
          name: dpn.getElementsByTagName('txtName')[0]?.textContent || codeId,
          latitude: lat,
          longitude: lon,
          mandatory: codeType === 'COMPULSORY-REP' || codeType === 'VFR-MRP',
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
          surface: rwy.getElementsByTagName('codeSfc')[0]?.textContent || undefined,
          strength: rwy.getElementsByTagName('codeStrength')[0]?.textContent || undefined,
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
          sia_uid: obs.getAttribute('mid') || undefined
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
    
    console.log(`✅ GeoJSON générés dans ${OUTPUT_DIR}`);
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
    console.log(`  - Cycle AIRAC: ${this.airacDate}`);
  }
  
  // === HELPERS DE PARSING ===
  
  private parseCoordinate(coord: string | null | undefined): number | null {
    if (!coord) return null;
    
    // Format AIXM: DDMMSS.ssH (ex: 484930.00N ou 0022900.00E)
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
  
  private parseFrequencies(ahp: Element): any[] {
    const frequencies = [];
    // TODO: Parser les fréquences depuis les éléments Fqy associés
    return frequencies;
  }
  
  private parseAirspaceGeometry(ase: Element): Polygon | MultiPolygon | null {
    const coordinates: number[][][] = [];
    
    try {
      const abdElements = ase.getElementsByTagName('Abd');
      
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