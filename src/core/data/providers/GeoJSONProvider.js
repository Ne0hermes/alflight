// src/core/data/providers/GeoJSONProvider.js
/**
 * Provider de données aéronautiques basé sur les fichiers GeoJSON optimisés
 * Utilise les fichiers pré-traités dans /public/data/geojson/
 * Beaucoup plus rapide et léger que le parser AIXM XML (42 MB → 10 MB GeoJSON)
 */

import { AeroDataProvider } from '../AeroDataProvider';
import { geoJSONDataService } from '../../../features/navigation/services/GeoJSONDataService';

export class GeoJSONProvider extends AeroDataProvider {
  constructor() {
    super();
    this.data = null;
    this.dataInfo = null; // { airac, source } — métadonnées du cycle RÉELLEMENT chargé
    this.isLoading = false;
  }

  /**
   * Charge les données GeoJSON (appelé une seule fois)
   */
  async loadData() {
    if (this.data) {
      return this.data;
    }

    this.isLoading = true;

    try {
      console.log('📦 Chargement données GeoJSON depuis /data/geojson/...');

      // Charger tous les fichiers GeoJSON en parallèle
      const [aerodromes, airspaces, navaids, runways, designatedPoints, obstacles] = await Promise.all([
        geoJSONDataService.getAerodromes(),
        geoJSONDataService.getAirspaces(),
        geoJSONDataService.getNavaids(),
        geoJSONDataService.getRunways(),
        geoJSONDataService.getDesignatedPoints(),
        geoJSONDataService.getObstacles()
      ]);

      // Métadonnées du cycle AIRAC RÉELLEMENT chargé (lues dans la donnée, pas un constant config)
      this.dataInfo = {
        airac: aerodromes.find((f) => f?.properties?.airac)?.properties?.airac || null,
        source: aerodromes.find((f) => f?.properties?.source)?.properties?.source || 'SIA',
      };

      // Convertir au format attendu par l'application
      this.data = {
        airports: this.convertAerodromes(aerodromes),
        airspaces: this.convertAirspaces(airspaces),
        navaids: this.convertNavaids(navaids),
        runways: this.convertRunways(runways),
        waypoints: this.convertDesignatedPoints(designatedPoints),
        obstacles: this.convertObstacles(obstacles),
        frequencies: [],
        routes: []
      };

      // Enrichir les données (associer pistes aux aérodromes, etc.)
      this.enrichData(this.data);

      console.log(`✅ Données GeoJSON chargées: ${this.data.airports.length} aérodromes, ${this.data.airspaces.length} espaces, ${this.data.navaids.length} navaids`);

      return this.data;
    } catch (error) {
      console.error('❌ Erreur chargement données GeoJSON:', error);
      // Retourner structure vide en cas d'erreur
      this.data = {
        airports: [],
        airspaces: [],
        navaids: [],
        runways: [],
        waypoints: [],
        obstacles: [],
        frequencies: [],
        routes: []
      };
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Convertit les aérodromes GeoJSON au format application
   */
  convertAerodromes(features) {
    return features.map(feature => ({
      icao: feature.properties.icao || feature.properties.id,
      name: feature.properties.name,
      city: feature.properties.city,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      },
      elevation: feature.properties.elevation_ft || feature.properties.elevation,
      type: feature.properties.type || 'AD',
      runways: [], // Sera rempli par enrichData
      frequencies: feature.properties.frequencies || [] // exposé depuis la source GeoJSON (ETL)
    }));
  }

  /**
   * Convertit les espaces aériens GeoJSON
   */
  convertAirspaces(features) {
    return features.map(feature => ({
      id: feature.properties.id || feature.properties.name,
      name: feature.properties.name,
      type: feature.properties.type,
      class: feature.properties.class,
      floor: feature.properties.floor || 0,
      ceiling: feature.properties.ceiling || 99999,
      geometry: feature.geometry
    }));
  }

  /**
   * Convertit les navaids GeoJSON
   */
  convertNavaids(features) {
    return features.map(feature => ({
      identifier: feature.properties.code || feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.type,
      frequency: feature.properties.frequency,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      }
    }));
  }

  /**
   * Convertit les pistes GeoJSON
   */
  convertRunways(features) {
    return features.map(feature => ({
      // Correspondance avec le format du fichier GeoJSON: aerodrome_icao est la propriété principale
      airportId: feature.properties.aerodrome_icao || feature.properties.airport_icao || feature.properties.icao,
      designation: feature.properties.designation,
      identifier: feature.properties.designation,
      length: feature.properties.length_m || feature.properties.length,
      width: feature.properties.width_m || feature.properties.width,
      dimensions: {
        length: feature.properties.length_m || feature.properties.length || 0,
        width: feature.properties.width_m || feature.properties.width || 0
      },
      surface: feature.properties.surface
    }));
  }

  /**
   * Convertit les points désignés (waypoints VFR/IFR)
   */
  convertDesignatedPoints(features) {
    return features.map(feature => ({
      id: feature.properties.code || feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.type,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      }
    }));
  }

  /**
   * Convertit les obstacles GeoJSON
   */
  convertObstacles(features) {
    return features.map(feature => ({
      id: feature.properties.id,
      name: feature.properties.name,
      type: feature.properties.type,
      height: feature.properties.height_ft || feature.properties.height,
      coordinates: {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0]
      }
    }));
  }

  /**
   * Enrichit les données (associer pistes aux aérodromes, etc.)
   */
  enrichData(data) {
    console.log(`🛬 [GeoJSONProvider.enrichData] Runways à associer: ${data.runways.length}`);
    console.log(`🛬 [GeoJSONProvider.enrichData] Sample runways:`, data.runways.slice(0, 3).map(r => ({
      airportId: r.airportId,
      designation: r.designation,
      length: r.length
    })));

    // Associer les pistes aux aéroports
    let totalAssociated = 0;
    data.airports.forEach(airport => {
      airport.runways = data.runways.filter(rwy => rwy.airportId === airport.icao);
      totalAssociated += airport.runways.length;

      // Normaliser le format des pistes
      airport.runways.forEach(rwy => {
        if (rwy.designation && !rwy.identifier) {
          rwy.identifier = rwy.designation;
        }

        // Extraire le_ident et he_ident depuis designation (ex: "05/23" → "05", "23")
        if (rwy.designation && rwy.designation.includes('/')) {
          const [le, he] = rwy.designation.split('/');
          rwy.le_ident = le.trim();
          rwy.he_ident = he.trim();

          // Calculer les QFU (caps magnétiques)
          const leQfu = parseInt(le.replace(/[LRC]/, '')) * 10;
          const heQfu = (leQfu + 180) % 360;

          rwy.le_heading = leQfu;
          rwy.he_heading = heQfu;
          rwy.qfu = leQfu;
        }
      });

      // Catégorie d'aérodrome basée sur longueur piste
      if (airport.runways.length > 0) {
        const maxLength = Math.max(...airport.runways.map(r => r.dimensions?.length || r.length || 0));
        if (maxLength > 2000) {
          airport.category = 'large';
        } else if (maxLength > 1000) {
          airport.category = 'medium';
        } else {
          airport.category = 'small';
        }
      }
    });

    console.log(`✅ [GeoJSONProvider.enrichData] Total pistes associées: ${totalAssociated} / ${data.runways.length}`);
    const airportsWithRunways = data.airports.filter(a => a.runways.length > 0).length;
    console.log(`✅ [GeoJSONProvider.enrichData] Aérodromes avec pistes: ${airportsWithRunways} / ${data.airports.length}`);

    // Classifier les espaces aériens par priorité
    data.airspaces.forEach(airspace => {
      const priorities = {
        'CTR': 1,
        'TMA': 2,
        'D': 3,
        'P': 3,
        'R': 3,
        'CTA': 4,
        'AWY': 5,
        'FIR': 10
      };
      airspace.priority = priorities[airspace.type] || 99;
    });
  }

  /**
   * Assure que les données sont chargées
   */
  async ensureDataLoaded() {
    if (!this.data) {
      await this.loadData();
    }
  }

  /**
   * Récupère les aérodromes avec filtres
   */
  async getAirfields(params = {}) {
    await this.ensureDataLoaded();

    let filtered = [...this.data.airports];

    if (params.icao) {
      filtered = filtered.filter(af => af.icao === params.icao);
    }

    if (params.search) {
      const search = params.search.toLowerCase();
      filtered = filtered.filter(af =>
        af.icao?.toLowerCase().includes(search) ||
        af.name?.toLowerCase().includes(search) ||
        af.city?.toLowerCase().includes(search)
      );
    }

    if (params.nearPoint) {
      const { lat, lon, radius } = params.nearPoint;
      filtered = filtered.filter(af => {
        const distance = this.calculateDistance(lat, lon, af.coordinates.lat, af.coordinates.lon);
        return distance <= radius;
      });
    }

    if (params.minRunwayLength) {
      filtered = filtered.filter(af => {
        if (!af.runways || af.runways.length === 0) return false;
        const maxLength = Math.max(...af.runways.map(r => r.dimensions?.length || 0));
        return maxLength >= params.minRunwayLength;
      });
    }

    return filtered;
  }

  /**
   * Nom usuel d'un aérodrome par code ICAO — depuis la source GeoJSON (SIA).
   * Remplace le hardcodé airportNames.js (source unique). Async : les données
   * étant préchargées au démarrage (cf. épic #11), le nom est dispo à l'usage.
   * @param {string} icao
   * @returns {Promise<string>} nom usuel, ou le code ICAO si introuvable
   */
  async getAirportName(icao) {
    await this.ensureDataLoaded();
    const airport = this.data.airports.find(a => a.icao === icao);
    return airport?.name || icao;
  }

  /**
   * Récupère les espaces aériens
   */
  async getAirspaces(params = {}) {
    await this.ensureDataLoaded();

    let filtered = [...this.data.airspaces];

    if (params.types && params.types.length > 0) {
      filtered = filtered.filter(airspace => params.types.includes(airspace.type));
    }

    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(airspace => {
        if (!airspace.geometry?.coordinates?.[0]) return false;
        return airspace.geometry.coordinates[0].some(coord =>
          coord[1] >= minLat && coord[1] <= maxLat &&
          coord[0] >= minLon && coord[0] <= maxLon
        );
      });
    }

    filtered.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    return filtered;
  }

  /**
   * Récupère les navaids
   */
  async getNavaids(params = {}) {
    await this.ensureDataLoaded();

    let filtered = [...this.data.navaids];

    if (params.types && params.types.length > 0) {
      filtered = filtered.filter(navaid =>
        params.types.some(type => navaid.type.includes(type))
      );
    }

    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(navaid =>
        navaid.coordinates.lat >= minLat && navaid.coordinates.lat <= maxLat &&
        navaid.coordinates.lon >= minLon && navaid.coordinates.lon <= maxLon
      );
    }

    return filtered;
  }

  /**
   * Récupère les waypoints
   */
  async getWaypoints(params = {}) {
    await this.ensureDataLoaded();

    let filtered = [...this.data.waypoints];

    if (params.id) {
      filtered = filtered.filter(wp => wp.id === params.id);
    }

    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(wp =>
        wp.coordinates.lat >= minLat && wp.coordinates.lat <= maxLat &&
        wp.coordinates.lon >= minLon && wp.coordinates.lon <= maxLon
      );
    }

    return filtered;
  }

  /**
   * Récupère les obstacles
   */
  async getObstacles(params = {}) {
    await this.ensureDataLoaded();

    let filtered = [...this.data.obstacles];

    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(obs =>
        obs.coordinates.lat >= minLat && obs.coordinates.lat <= maxLat &&
        obs.coordinates.lon >= minLon && obs.coordinates.lon <= maxLon
      );
    }

    if (params.minHeight) {
      filtered = filtered.filter(obs =>
        (obs.height || 0) >= params.minHeight
      );
    }

    return filtered;
  }

  /**
   * Récupère les routes ATS (non implémenté dans GeoJSON)
   */
  async getRoutes(params = {}) {
    return [];
  }

  /**
   * Récupère les points de report VFR pour un aérodrome
   */
  async getReportingPoints(icao) {
    // ⚡ PERF/ROBUSTESSE : on charge UNIQUEMENT les 2 couches nécessaires
    // (aérodromes + points désignés) via le cache par-couche de geoJSONDataService,
    // au lieu de `ensureDataLoaded()` qui déclenche le full loadData() — incl.
    // obstacles (8 Mo) + espaces aériens (5 Mo) + navaids, totalement inutiles ici.
    // Sous pression mémoire (avions avec photos/MANEX/abaques), ce chargement
    // massif est le point de blocage le plus probable du module Info & Météo.
    const code = (icao || '').toUpperCase();
    const [adFeatures, dpFeatures] = await Promise.all([
      geoJSONDataService.getAerodromes(),
      geoJSONDataService.getDesignatedPoints()
    ]);

    const adFeature = adFeatures.find(f => (f.properties?.icao || '').toUpperCase() === code);
    const [adLon, adLat] = adFeature?.geometry?.coordinates || [];
    if (adLat == null || adLon == null) return [];

    const points = [];
    for (const f of dpFeatures) {
      const [wLon, wLat] = f.geometry?.coordinates || [];
      if (wLat == null || wLon == null) continue;
      if (this.calculateDistance(adLat, adLon, wLat, wLon) <= 15) { // 15 km de rayon
        const type = f.properties?.type;
        points.push({
          code: f.properties?.code || f.properties?.id,
          name: f.properties?.name,
          type: type === 'VFR-RP' ? 'mandatory' : 'optional',
          mandatory: type === 'VFR-RP',
          coordinates: { lat: wLat, lon: wLon }
        });
      }
    }
    return points;
  }

  /**
   * Calcule la distance entre deux points (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Métadonnées du cycle de données RÉELLEMENT chargé (AIRAC, source).
   * Source unique pour la fraîcheur des données (au lieu d'un constant config baké en JS).
   * @returns {Promise<{airac: string|null, source: string}>}
   */
  async getDataInfo() {
    await this.ensureDataLoaded();
    return this.dataInfo || { airac: null, source: 'SIA' };
  }

  /**
   * Détail VAC complet d'un aérodrome, dans la forme attendue par les modules VAC
   * (compatible avec l'ancienne sortie `aixmParser.loadAndParse()` par aérodrome).
   *
   * Source : GeoJSON dérivé VERSIONNÉ (`/data/geojson/`) au lieu du parse runtime du
   * XML AIXM 42 Mo — ce dernier est gitignore (cf. .gitignore `public/data/*.xml`) donc
   * ABSENT en production (Vercel) → l'ancien chemin renvoyait un 404 et cassait tout le
   * module VAC en prod. Ce provider, lui, lit des fichiers committés → marche partout.
   *
   * Champs NON extraits par l'ETL actuel (surface piste, TORA/TODA/ASDA/LDA, ILS, VASIS,
   * obstacles par AD, procédures) → laissés `null`/`[]` : le commandant de bord les
   * complète manuellement (cf. disclaimer SIAReportEnhanced). Une future passe d'ETL
   * pourra les renseigner sans changer ce contrat.
   *
   * NB : circuitAltitude / integrationAltitude / circuitRemarks NE viennent PAS d'ici
   * (non dérivables de l'AIXM) → ils restent fournis par le vacStore côté consommateur.
   *
   * @param {string} icao — code OACI (ex: 'LFST')
   * @returns {Promise<Object|null>} objet aérodrome enrichi, ou null si introuvable
   */
  async getVACDetail(icao) {
    if (!icao || typeof icao !== 'string') return null;
    // ⚡ Ne PAS appeler ensureDataLoaded() ici : cette méthode lit directement les
    // couches dont elle a besoin (aérodromes, pistes, ILS, services, points VFR) via
    // le cache par-couche de geoJSONDataService. Le full loadData() (obstacles 8 Mo +
    // espaces 5 Mo + navaids) était chargé pour rien et bloquait le module sous
    // pression mémoire. cf. getReportingPoints.
    const code = icao.toUpperCase();

    // Features brutes (cache géré par geoJSONDataService) : on lit les propriétés
    // complètes — les convert*() du provider sont volontairement « lossy » (perdent
    // iata / magnetic_variation / transition_altitude, aplatissent elevation) ; ici
    // on a besoin de la fidélité maximale.
    const adFeatures = await geoJSONDataService.getAerodromes();
    const feature = adFeatures.find(
      f => (f.properties?.icao || '').toUpperCase() === code
    );
    if (!feature) return null;

    // Métadonnées AIRAC (label de fraîcheur) — dérivées à bas coût des aérodromes
    // déjà chargés, sans imposer le full loadData(). Best-effort : null si absent.
    if (!this.dataInfo) {
      this.dataInfo = {
        airac: adFeatures.find((f) => f?.properties?.airac)?.properties?.airac || null,
        source: adFeatures.find((f) => f?.properties?.source)?.properties?.source || 'SIA',
      };
    }

    // ILS (indexés par id de piste) + services (mappés en flags) de cet AD.
    const ilsByRunway = this.indexILSByRunway(
      (await geoJSONDataService.getILS()).filter(
        f => (f.properties?.aerodrome_icao || '').toUpperCase() === code
      )
    );
    const serviceFlags = this.mapServicesToFlags(
      (await geoJSONDataService.getAerodromeServices()).filter(
        s => (s?.aerodrome_icao || '').toUpperCase() === code
      )
    );

    // Pistes de cet AD, remises à la forme attendue par le module VAC.
    const rwyFeatures = await geoJSONDataService.getRunways();
    const runways = rwyFeatures
      .filter(r => (r.properties?.aerodrome_icao || '').toUpperCase() === code)
      .map(r => this.buildVACRunway(r.properties || {}, ilsByRunway));

    // Points de report VFR proches (best-effort, ne doit jamais casser le détail).
    let vfrPoints = [];
    try {
      vfrPoints = await this.getReportingPoints(code);
    } catch (e) {
      vfrPoints = [];
    }

    return this.buildVACAerodrome(feature, runways, vfrPoints, serviceFlags);
  }

  /**
   * Liste VAC de TOUS les aérodromes (vrais AD avec ICAO), même forme que getVACDetail.
   * Remplace le chargement complet `aixmParser.loadAndParse()` des écrans liste/recherche
   * (SIAReportEnhanced). Les points VFR par AD (filtre géo 15 km) sont DIFFÉRÉS ici pour
   * la perf (→ `[]`) ; ils restent disponibles par AD via getVACDetail(icao) (utilisé par
   * le wizard Step3VAC). NB : la liste VAC affiche déjà un disclaimer « VFR à consulter
   * séparément », donc l'absence de VFR en vue liste est cohérente avec l'UI.
   * @returns {Promise<Object[]>}
   */
  async getVACList() {
    await this.ensureDataLoaded();
    const adFeatures = await geoJSONDataService.getAerodromes();
    const rwyFeatures = await geoJSONDataService.getRunways();
    // Index ILS (par id de piste) + services (par ICAO), construits une seule fois.
    const ilsByRunway = this.indexILSByRunway(await geoJSONDataService.getILS());
    const servicesByIcao = this.indexServicesByIcao(await geoJSONDataService.getAerodromeServices());

    // Index des pistes par ICAO (une seule passe au lieu d'un filter par AD).
    const rwyByIcao = new Map();
    for (const r of rwyFeatures) {
      const code = (r.properties?.aerodrome_icao || '').toUpperCase();
      if (!code) continue;
      if (!rwyByIcao.has(code)) rwyByIcao.set(code, []);
      rwyByIcao.get(code).push(this.buildVACRunway(r.properties || {}, ilsByRunway));
    }

    return adFeatures
      .filter(f => f.properties?.icao) // exclut les stubs sans OACI (LS fermés sans code)
      .map(f => {
        const code = f.properties.icao.toUpperCase();
        return this.buildVACAerodrome(
          f,
          rwyByIcao.get(code) || [],
          [],
          this.mapServicesToFlags(servicesByIcao.get(code) || [])
        );
      });
  }

  /**
   * Assemble un objet aérodrome VAC à la forme attendue par les consommateurs
   * (compatible ancienne sortie aixmParser). Partagé par getVACDetail / getVACList.
   * Points de forme IMPORTANTS (contrat consommateur) :
   *  - elevation : OBJET { value, valueFt, unit } (Step3VAC lit valueFt ?? value)
   *  - magneticVariation : OBJET { value, date } (signé : E>0, W<0)
   *  - frequencies : OBJET groupé par type { TWR:[{frequency,callsign,schedule}], … }
   *  - services : OBJET de booléens (clés fuel/avgas100LL/jetA1/…)
   * @param {Object} feature — feature GeoJSON aérodrome (propriétés brutes)
   * @param {Object[]} runways — pistes déjà construites (buildVACRunway)
   * @param {Object[]} vfrPoints — points de report VFR (ou [])
   * @returns {Object}
   */
  buildVACAerodrome(feature, runways = [], vfrPoints = [], services = null) {
    const p = feature.properties || {};
    const geom = feature.geometry?.coordinates || [];
    const lon = geom[0] ?? p.longitude ?? null;
    const lat = geom[1] ?? p.latitude ?? null;
    const isClosed = /\(closed\)|ferm[ée]/i.test(p.name || '');

    return {
      icao: p.icao,
      iata: p.iata || null,
      name: p.name || '',
      city: p.city || '',
      type: p.type || 'AD',
      coordinates: { lat, lon },
      // OBJET (consommateurs : elevation.value et elevation.valueFt) — ne pas aplatir.
      elevation: { value: p.elevation_ft ?? null, valueFt: p.elevation_ft ?? null, unit: 'FT' },
      // OBJET { value, date } attendu par SIAReportEnhanced / Step3VAC.
      magneticVariation: { value: p.magnetic_variation ?? null, date: null },
      transitionAltitude: p.transition_altitude ?? null,
      // OBJET groupé par type (consommateurs : Object.entries(frequencies)).
      frequencies: this.groupFrequenciesByType(p.frequencies),
      runways,
      vfrPoints,
      // Flags mappés depuis aerodrome_services.json (SIA) ; défauts sûrs si absent.
      services: services || {
        fuel: false, avgas100LL: false, jetA1: false, maintenance: false,
        customs: false, handling: false, restaurant: false, hotel: false,
        parking: false, hangar: false
      },
      obstacles: [],
      procedures: { departure: [], arrival: [] },
      remarks: isClosed ? 'AD CLOSED' : '',
      specialInstructions: '',
      source: 'GeoJSON (SIA dérivé)',
      airac: this.dataInfo?.airac || null
    };
  }

  /**
   * Regroupe un tableau de fréquences GeoJSON [{type,frequency,callsign,schedule}] en
   * OBJET indexé par type { TWR:[{frequency,callsign,schedule}], APP:[…] } — la forme
   * attendue par les écrans VAC (qui font Object.entries(frequencies)).
   * @param {Array} list
   * @returns {Object}
   */
  groupFrequenciesByType(list) {
    const grouped = {};
    if (!Array.isArray(list)) return grouped;
    for (const f of list) {
      const type = (f?.type || 'AUTRE').toUpperCase();
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        frequency: f?.frequency ?? '',
        callsign: f?.callsign ?? '',
        schedule: f?.schedule ?? ''
      });
    }
    return grouped;
  }

  /**
   * Indexe les features ILS par id de piste (runway_id) → [features].
   * @param {Array} features
   * @returns {Map<string, Array>}
   */
  indexILSByRunway(features = []) {
    const map = new Map();
    for (const f of features) {
      const rid = f?.properties?.runway_id;
      if (!rid) continue;
      if (!map.has(rid)) map.set(rid, []);
      map.get(rid).push(f);
    }
    return map;
  }

  /**
   * Indexe les items de service par ICAO d'aérodrome → [items].
   * @param {Array} items
   * @returns {Map<string, Array>}
   */
  indexServicesByIcao(items = []) {
    const map = new Map();
    for (const it of items) {
      const code = (it?.aerodrome_icao || '').toUpperCase();
      if (!code) continue;
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(it);
    }
    return map;
  }

  /**
   * Mappe une feature ILS GeoJSON vers la forme attendue par les écrans VAC
   * (runway.ils.category / .frequency).
   * @param {Object} feature
   * @returns {Object}
   */
  mapILS(feature) {
    const p = feature?.properties || {};
    return {
      category: p.category || null,          // I / II / III
      frequency: p.loc_frequency_mhz ?? null,
      ident: p.loc_ident || null,
      direction: p.runway_direction || null,
      glidePathSlope: p.gp_slope_deg ?? null,
      dme: p.dme_ident || null
    };
  }

  /**
   * Mappe les items de service SIA (codes FUEL/CUST/REPAIR/HAND/HANGAR…) vers les flags
   * booléens attendus par les écrans VAC. Les codes sans flag consommateur correspondant
   * (FIRE/SAN/SECUR/CLEAR/DEICE/OTHER) sont ignorés. Le grade carburant (AVGAS/JET) n'est
   * PAS renseigné par le SIA (category vide) → avgas100LL/jetA1 restent false (pas de
   * fausse donnée).
   * @param {Array} items
   * @returns {Object}
   */
  mapServicesToFlags(items = []) {
    const flags = {
      fuel: false, avgas100LL: false, jetA1: false, maintenance: false,
      customs: false, handling: false, restaurant: false, hotel: false,
      parking: false, hangar: false
    };
    for (const it of items) {
      switch ((it?.type || '').toUpperCase()) {
        case 'FUEL': flags.fuel = true; break;
        case 'CUST': flags.customs = true; break;
        case 'REPAIR': flags.maintenance = true; break;
        case 'HAND': flags.handling = true; break;
        case 'HANGAR': flags.hangar = true; break;
        default: break;
      }
    }
    return flags;
  }

  /**
   * Construit une piste au format module VAC depuis les propriétés GeoJSON brutes.
   * Calcule le QFU depuis la désignation (ex: "05/23" → 50), attache les ILS (si index
   * fourni), la surface, le PCN et les distances déclarées (Rdd) par direction.
   * @param {Object} props — propriétés de la feature runway
   * @param {Map<string,Array>|null} ilsByRunway — index ILS par runway_id
   * @returns {Object}
   */
  buildVACRunway(props = {}, ilsByRunway = null) {
    const designation = props.designation || '';
    let qfu = null;
    let le_ident = null;
    let he_ident = null;
    if (designation.includes('/')) {
      const [le, he] = designation.split('/');
      le_ident = le.trim();
      he_ident = he.trim();
      const n = parseInt(le_ident.replace(/[LRC]/i, ''), 10);
      if (!Number.isNaN(n)) qfu = (n * 10) % 360;
    }
    // ILS éventuels de cette piste (un par direction équipée), via l'index runway_id.
    const ilsList = (ilsByRunway && props.id)
      ? (ilsByRunway.get(props.id) || []).map(f => this.mapILS(f))
      : [];
    // Distances déclarées (Rdd) par direction ; on expose aussi la direction primaire
    // (le_ident) à plat pour les écrans qui lisent runway.tora/toda/asda/lda.
    const declaredDistances = props.declared_distances || null;
    const primary = declaredDistances
      ? (declaredDistances[le_ident] || Object.values(declaredDistances)[0] || null)
      : null;
    return {
      designation,
      identifier: designation,
      le_ident,
      he_ident,
      length: props.length_m ?? props.length ?? null,
      width: props.width_m ?? props.width ?? null,
      dimensions: {
        length: props.length_m ?? props.length ?? 0,
        width: props.width_m ?? props.width ?? 0
      },
      surface: props.surface || null,
      pcn: props.pcn || null,
      qfu,
      magneticBearing: qfu,
      // ILS depuis ils.geojson (SIA) : le 1er alimente le badge, ilsList expose tous les seuils.
      ils: ilsList[0] || null,
      ilsList,
      // Distances déclarées (m, Rdd AIXM) : plat = direction primaire ; objet = par direction.
      tora: primary?.TORA ?? null,
      toda: primary?.TODA ?? null,
      asda: primary?.ASDA ?? null,
      lda: primary?.LDA ?? null,
      declaredDistances,
      // Non extrait par l'ETL → complété manuellement côté VAC.
      vasis: null
    };
  }

  isAvailable() {
    return true;
  }

  getProviderName() {
    return 'SIA France GeoJSON (Optimisé)';
  }

  getStatus() {
    if (this.isLoading) {
      return {
        available: true,
        name: this.getProviderName(),
        message: 'Chargement des données GeoJSON en cours...'
      };
    }

    if (this.data) {
      return {
        available: true,
        name: this.getProviderName(),
        message: `Données GeoJSON chargées - ${this.data.airports.length} aérodromes, ${this.data.airspaces.length} espaces, ${this.data.navaids.length} navaids`
      };
    }

    return {
      available: true,
      name: this.getProviderName(),
      message: 'Prêt à charger les données GeoJSON'
    };
  }
}
