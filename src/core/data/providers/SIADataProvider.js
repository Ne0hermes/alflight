// src/core/data/providers/SIADataProvider.js
/**
 * Provider de données SIA (Service de l'Information Aéronautique)
 * Utilise les données locales du SIA français
 */

import { AeroDataProvider } from '../AeroDataProvider';
import { FRENCH_AIRSPACES } from '@data/frenchAirspaces';
import airportElevationParser from '@services/airportElevationParser';

// Données complémentaires des aéroports français
const FRENCH_AIRPORTS = [
  // Région parisienne
  { icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris', coordinates: { lat: 49.0097, lon: 2.5478 }, elevation: 392, type: 'AIRPORT' },
  { icao: 'LFPO', name: 'Paris Orly', city: 'Paris', coordinates: { lat: 48.7233, lon: 2.3794 }, elevation: 291, type: 'AIRPORT' },
  { icao: 'LFPB', name: 'Le Bourget', city: 'Le Bourget', coordinates: { lat: 48.9694, lon: 2.4414 }, elevation: 218, type: 'AIRPORT' },
  { icao: 'LFPN', name: 'Toussus-le-Noble', city: 'Toussus-le-Noble', coordinates: { lat: 48.7517, lon: 2.1061 }, elevation: 538, type: 'AIRFIELD' },
  { icao: 'LFPT', name: 'Pontoise-Cormeilles', city: 'Pontoise', coordinates: { lat: 49.0966, lon: 2.0408 }, elevation: 325, type: 'AIRFIELD' },
  
  // Grandes villes
  { icao: 'LFST', name: 'Strasbourg-Entzheim', city: 'Strasbourg', coordinates: { lat: 48.5444, lon: 7.6283 }, elevation: 505, type: 'AIRPORT' },
  { icao: 'LFMN', name: 'Nice Côte d\'Azur', city: 'Nice', coordinates: { lat: 43.6584, lon: 7.2158 }, elevation: 13, type: 'AIRPORT' },
  { icao: 'LFML', name: 'Marseille Provence', city: 'Marseille', coordinates: { lat: 43.4367, lon: 5.2150 }, elevation: 69, type: 'AIRPORT' },
  { icao: 'LFLL', name: 'Lyon Saint-Exupéry', city: 'Lyon', coordinates: { lat: 45.7256, lon: 5.0811 }, elevation: 821, type: 'AIRPORT' },
  { icao: 'LFBO', name: 'Toulouse-Blagnac', city: 'Toulouse', coordinates: { lat: 43.6289, lon: 1.3678 }, elevation: 499, type: 'AIRPORT' },
  { icao: 'LFRN', name: 'Rennes Saint-Jacques', city: 'Rennes', coordinates: { lat: 48.0689, lon: -1.7347 }, elevation: 118, type: 'AIRPORT' },
  { icao: 'LFRS', name: 'Nantes Atlantique', city: 'Nantes', coordinates: { lat: 47.1532, lon: -1.6111 }, elevation: 90, type: 'AIRPORT' },
  { icao: 'LFBD', name: 'Bordeaux-Mérignac', city: 'Bordeaux', coordinates: { lat: 44.8283, lon: -0.7156 }, elevation: 162, type: 'AIRPORT' },
  { icao: 'LFLB', name: 'Chambéry-Savoie', city: 'Chambéry', coordinates: { lat: 45.6381, lon: 5.8802 }, elevation: 779, type: 'AIRPORT' },
  { icao: 'LFLS', name: 'Grenoble-Isère', city: 'Grenoble', coordinates: { lat: 45.3629, lon: 5.3294 }, elevation: 1329, type: 'AIRPORT' },
  { icao: 'LFMT', name: 'Montpellier-Méditerranée', city: 'Montpellier', coordinates: { lat: 43.5762, lon: 3.9630 }, elevation: 17, type: 'AIRPORT' },
  { icao: 'LFMP', name: 'Perpignan-Rivesaltes', city: 'Perpignan', coordinates: { lat: 42.7404, lon: 2.8707 }, elevation: 59, type: 'AIRPORT' },
  { icao: 'LFLC', name: 'Clermont-Ferrand Auvergne', city: 'Clermont-Ferrand', coordinates: { lat: 45.7867, lon: 3.1625 }, elevation: 1090, type: 'AIRPORT' },
  
  // Aérodromes supplémentaires
  { icao: 'LFAY', name: 'Amiens-Glisy', city: 'Amiens', coordinates: { lat: 49.8731, lon: 2.3872 }, elevation: 295, type: 'AIRFIELD' },
  { icao: 'LFAC', name: 'Calais-Dunkerque', city: 'Calais', coordinates: { lat: 50.9621, lon: 1.9548 }, elevation: 157, type: 'AIRFIELD' },
  { icao: 'LFAT', name: 'Le Touquet-Côte d\'Opale', city: 'Le Touquet', coordinates: { lat: 50.5174, lon: 1.6267 }, elevation: 46, type: 'AIRFIELD' },
  { icao: 'LFSB', name: 'Bâle-Mulhouse', city: 'Bâle', coordinates: { lat: 47.5896, lon: 7.5296 }, elevation: 885, type: 'AIRPORT' },
  { icao: 'LFGA', name: 'Colmar-Houssen', city: 'Colmar', coordinates: { lat: 48.1099, lon: 7.3590 }, elevation: 627, type: 'AIRFIELD' },
  { icao: 'LFSD', name: 'Dijon-Bourgogne', city: 'Dijon', coordinates: { lat: 47.2689, lon: 5.0900 }, elevation: 1247, type: 'AIRPORT' },
  { icao: 'LFSG', name: 'Épinal-Mirecourt', city: 'Épinal', coordinates: { lat: 48.3251, lon: 6.0699 }, elevation: 761, type: 'AIRFIELD' },
  { icao: 'LFSC', name: 'Metz-Nancy-Lorraine', city: 'Metz', coordinates: { lat: 48.9821, lon: 6.2513 }, elevation: 1033, type: 'AIRPORT' },
  
  // Aérodromes d'altitude
  { icao: 'LFHM', name: 'Megève', city: 'Megève', coordinates: { lat: 45.8213, lon: 6.6522 }, elevation: 2877, type: 'AIRFIELD' },
  { icao: 'LFKE', name: 'Courchevel', city: 'Courchevel', coordinates: { lat: 45.3967, lon: 6.6350 }, elevation: 5636, type: 'AIRFIELD' },
  { icao: 'LFKD', name: 'Gap-Tallard', city: 'Gap', coordinates: { lat: 44.4550, lon: 6.0378 }, elevation: 6588, type: 'AIRFIELD' },
];

// Navaids français
const FRENCH_NAVAIDS = [
  // VOR majeurs
  { id: 'ABB', identifier: 'ABB', name: 'Abbeville', type: 'VOR-DME', frequency: 108.800, coordinates: { lat: 50.1359, lon: 1.8547 } },
  { id: 'AGN', identifier: 'AGN', name: 'Agen', type: 'VOR-DME', frequency: 114.850, coordinates: { lat: 44.1747, lon: 0.5908 } },
  { id: 'AMB', identifier: 'AMB', name: 'Amboise', type: 'VOR-DME', frequency: 113.750, coordinates: { lat: 47.4256, lon: 1.0656 } },
  { id: 'ANG', identifier: 'ANG', name: 'Angers', type: 'VOR-DME', frequency: 115.000, coordinates: { lat: 47.5597, lon: -0.3117 } },
  { id: 'ATN', identifier: 'ATN', name: 'Autun', type: 'VOR-DME', frequency: 117.650, coordinates: { lat: 46.9617, lon: 4.2603 } },
  { id: 'BRY', identifier: 'BRY', name: 'Berry', type: 'VOR-DME', frequency: 117.150, coordinates: { lat: 47.0814, lon: 2.0264 } },
  { id: 'CGC', identifier: 'CGC', name: 'Cannes', type: 'VOR-DME', frequency: 115.900, coordinates: { lat: 43.4753, lon: 6.9531 } },
  { id: 'CHW', identifier: 'CHW', name: 'Chaumont', type: 'VOR-DME', frequency: 113.000, coordinates: { lat: 48.0569, lon: 5.0403 } },
  { id: 'CLM', identifier: 'CLM', name: 'Clermont-Ferrand', type: 'VOR-DME', frequency: 113.800, coordinates: { lat: 45.6867, lon: 3.1636 } },
  { id: 'DJN', identifier: 'DJN', name: 'Dijon', type: 'VOR-DME', frequency: 115.400, coordinates: { lat: 47.2689, lon: 5.0900 } },
  { id: 'EPL', identifier: 'EPL', name: 'Épinal', type: 'VOR-DME', frequency: 113.450, coordinates: { lat: 48.2119, lon: 6.0750 } },
  { id: 'GAI', identifier: 'GAI', name: 'Gaillac', type: 'VOR-DME', frequency: 116.500, coordinates: { lat: 43.8875, lon: 1.8694 } },
  { id: 'GVS', identifier: 'GVS', name: 'Grenoble', type: 'VOR-DME', frequency: 114.050, coordinates: { lat: 45.3631, lon: 5.3319 } },
  { id: 'LGL', identifier: 'LGL', name: 'L\'Aigle', type: 'VOR-DME', frequency: 115.300, coordinates: { lat: 48.7583, lon: 0.5219 } },
  { id: 'LMG', identifier: 'LMG', name: 'Limoges', type: 'VOR-DME', frequency: 114.500, coordinates: { lat: 45.8622, lon: 1.1794 } },
  { id: 'LUC', identifier: 'LUC', name: 'Luc', type: 'VOR-DME', frequency: 116.800, coordinates: { lat: 43.3831, lon: 6.3872 } },
  { id: 'MEN', identifier: 'MEN', name: 'Mende', type: 'VOR-DME', frequency: 115.850, coordinates: { lat: 44.5019, lon: 3.4628 } },
  { id: 'MOU', identifier: 'MOU', name: 'Moulins', type: 'VOR-DME', frequency: 116.700, coordinates: { lat: 46.5344, lon: 3.4219 } },
  { id: 'MTD', identifier: 'MTD', name: 'Montauban', type: 'VOR-DME', frequency: 113.650, coordinates: { lat: 44.0256, lon: 1.3778 } },
  { id: 'NTS', identifier: 'NTS', name: 'Nantes', type: 'VOR-DME', frequency: 117.200, coordinates: { lat: 47.1567, lon: -1.6178 } },
  { id: 'PGS', identifier: 'PGS', name: 'Périgueux', type: 'VOR-DME', frequency: 112.100, coordinates: { lat: 45.1981, lon: 0.8156 } },
  { id: 'POL', identifier: 'POL', name: 'Pontoise', type: 'VOR-DME', frequency: 112.300, coordinates: { lat: 49.0969, lon: 2.0417 } },
  { id: 'RBT', identifier: 'RBT', name: 'Rambouillet', type: 'VOR-DME', frequency: 114.700, coordinates: { lat: 48.7017, lon: 1.9953 } },
  { id: 'REN', identifier: 'REN', name: 'Rennes', type: 'VOR-DME', frequency: 114.400, coordinates: { lat: 48.0706, lon: -1.7361 } },
  { id: 'RLP', identifier: 'RLP', name: 'Roanne', type: 'VOR-DME', frequency: 117.700, coordinates: { lat: 46.0536, lon: 3.8978 } },
  { id: 'ROM', identifier: 'ROM', name: 'Romilly', type: 'VOR-DME', frequency: 116.950, coordinates: { lat: 48.4994, lon: 3.7297 } },
  { id: 'TBO', identifier: 'TBO', name: 'Toulouse', type: 'VOR-DME', frequency: 117.700, coordinates: { lat: 43.5886, lon: 1.3742 } },
  { id: 'TRO', identifier: 'TRO', name: 'Troyes', type: 'VOR-DME', frequency: 110.200, coordinates: { lat: 48.3228, lon: 4.0131 } },
  
  // NDB majeurs
  { id: 'AA', identifier: 'AA', name: 'Agen', type: 'NDB', frequency: 406, coordinates: { lat: 44.1747, lon: 0.5908 } },
  { id: 'BG', identifier: 'BG', name: 'Le Bourget', type: 'NDB', frequency: 356, coordinates: { lat: 48.9694, lon: 2.4414 } },
  { id: 'BN', identifier: 'BN', name: 'Bordeaux', type: 'NDB', frequency: 367, coordinates: { lat: 44.8283, lon: -0.7156 } },
  { id: 'CA', identifier: 'CA', name: 'Calais', type: 'NDB', frequency: 281, coordinates: { lat: 50.9621, lon: 1.9548 } },
  { id: 'CM', identifier: 'CM', name: 'Cambrai', type: 'NDB', frequency: 385, coordinates: { lat: 50.2203, lon: 3.1547 } },
  { id: 'DN', identifier: 'DN', name: 'Dijon', type: 'NDB', frequency: 399, coordinates: { lat: 47.2689, lon: 5.0900 } },
  { id: 'LN', identifier: 'LN', name: 'Lyon', type: 'NDB', frequency: 416, coordinates: { lat: 45.7256, lon: 5.0811 } },
  { id: 'NC', identifier: 'NC', name: 'Nice', type: 'NDB', frequency: 332, coordinates: { lat: 43.6584, lon: 7.2158 } },
  { id: 'PG', identifier: 'PG', name: 'Paris CDG', type: 'NDB', frequency: 351, coordinates: { lat: 49.0097, lon: 2.5478 } },
  { id: 'PO', identifier: 'PO', name: 'Paris Orly', type: 'NDB', frequency: 369, coordinates: { lat: 48.7233, lon: 2.3794 } },
];

// Points de report VFR pour les principaux aérodromes
const VFR_REPORTING_POINTS = {
  'LFPG': [
    { code: 'N1', name: 'November 1', type: 'mandatory', mandatory: true, coordinates: { lat: 49.1500, lon: 2.5500 } },
    { code: 'N2', name: 'November 2', type: 'mandatory', mandatory: true, coordinates: { lat: 49.0500, lon: 2.7000 } },
    { code: 'E', name: 'Echo', type: 'mandatory', mandatory: true, coordinates: { lat: 48.9500, lon: 2.6500 } },
    { code: 'S', name: 'Sierra', type: 'mandatory', mandatory: true, coordinates: { lat: 48.8500, lon: 2.5500 } },
    { code: 'W', name: 'Whiskey', type: 'mandatory', mandatory: true, coordinates: { lat: 49.0500, lon: 2.3500 } },
  ],
  'LFPO': [
    { code: 'N', name: 'November', type: 'mandatory', mandatory: true, coordinates: { lat: 48.8500, lon: 2.3800 } },
    { code: 'E', name: 'Echo', type: 'mandatory', mandatory: true, coordinates: { lat: 48.7200, lon: 2.5000 } },
    { code: 'S', name: 'Sierra', type: 'mandatory', mandatory: true, coordinates: { lat: 48.6000, lon: 2.3800 } },
    { code: 'W', name: 'Whiskey', type: 'mandatory', mandatory: true, coordinates: { lat: 48.7200, lon: 2.2500 } },
  ],
  'LFPB': [
    { code: 'NE', name: 'Nord-Est', type: 'mandatory', mandatory: true, coordinates: { lat: 49.0500, lon: 2.5500 } },
    { code: 'SE', name: 'Sud-Est', type: 'mandatory', mandatory: true, coordinates: { lat: 48.9000, lon: 2.5500 } },
    { code: 'SW', name: 'Sud-Ouest', type: 'mandatory', mandatory: true, coordinates: { lat: 48.9000, lon: 2.3500 } },
    { code: 'NW', name: 'Nord-Ouest', type: 'mandatory', mandatory: true, coordinates: { lat: 49.0500, lon: 2.3500 } },
  ],
  'LFST': [
    { code: 'N', name: 'November', type: 'mandatory', mandatory: true, coordinates: { lat: 48.6500, lon: 7.6300 } },
    { code: 'E', name: 'Echo', type: 'mandatory', mandatory: true, coordinates: { lat: 48.5400, lon: 7.7500 } },
    { code: 'S', name: 'Sierra', type: 'mandatory', mandatory: true, coordinates: { lat: 48.4500, lon: 7.6300 } },
    { code: 'W', name: 'Whiskey', type: 'mandatory', mandatory: true, coordinates: { lat: 48.5400, lon: 7.5000 } },
  ],
};

export class SIADataProvider extends AeroDataProvider {
  constructor() {
    super();
    this.airspaces = this.initializeAirspaces();
    this.airfields = FRENCH_AIRPORTS.map((af, index) => ({
      ...af,
      id: af.icao || `airfield_${index}`
    }));
    this.navaids = FRENCH_NAVAIDS.map((nav, index) => ({
      ...nav,
      id: nav.id || `navaid_${index}`,
      ident: nav.identifier // Ajouter ident pour la compatibilité
    }));
    this.reportingPoints = VFR_REPORTING_POINTS;
  }

  initializeAirspaces() {
    const allAirspaces = [];
    
    // Convertir les CTR
    if (FRENCH_AIRSPACES.CTR) {
      FRENCH_AIRSPACES.CTR.forEach(ctr => {
        allAirspaces.push({
          id: ctr.id,
          name: ctr.name,
          type: 'CTR',
          class: ctr.class,
          lowerLimit: 0,
          upperLimit: this.parseAltitude(ctr.ceiling),
          lowerLimitUnit: 'FT',
          upperLimitUnit: 'FT',
          geometry: {
            type: 'Polygon',
            coordinates: [this.createCircleGeometry(ctr.center, ctr.radius)]
          },
          frequency: ctr.frequency,
          unit: ctr.unit
        });
      });
    }
    
    // Convertir les TMA
    if (FRENCH_AIRSPACES.TMA) {
      FRENCH_AIRSPACES.TMA.forEach(tma => {
        allAirspaces.push({
          id: tma.id,
          name: tma.name,
          type: 'TMA',
          class: tma.class,
          lowerLimit: this.parseAltitude(tma.floor),
          upperLimit: this.parseAltitude(tma.ceiling),
          lowerLimitUnit: 'FT',
          upperLimitUnit: 'FT',
          geometry: {
            type: 'Polygon',
            coordinates: tma.sectors ? this.mergePolygons(tma.sectors) : [this.createCircleGeometry(tma.center, tma.radius || 20)]
          },
          frequency: tma.frequency
        });
      });
    }
    
    // Convertir les zones réglementées
    if (FRENCH_AIRSPACES.RESTRICTED) {
      FRENCH_AIRSPACES.RESTRICTED.forEach(zone => {
        allAirspaces.push({
          id: zone.id,
          name: zone.name,
          type: zone.type,
          lowerLimit: this.parseAltitude(zone.floor || 'SFC'),
          upperLimit: this.parseAltitude(zone.ceiling),
          lowerLimitUnit: 'FT',
          upperLimitUnit: 'FT',
          geometry: {
            type: 'Polygon',
            coordinates: zone.polygon ? [zone.polygon] : [this.createCircleGeometry(zone.center, zone.radius || 5)]
          },
          activity: zone.activity,
          hours: zone.hours
        });
      });
    }
    
    return allAirspaces;
  }

  parseAltitude(alt) {
    if (typeof alt === 'number') return alt;
    if (alt === 'SFC' || alt === 'GND') return 0;
    if (alt === 'UNL' || alt === 'UNLIM') return 99999;
    if (alt.startsWith('FL')) return parseInt(alt.slice(2)) * 100;
    return parseInt(alt) || 0;
  }

  createCircleGeometry(center, radiusNm) {
    const points = [];
    const radiusKm = radiusNm * 1.852;
    for (let i = 0; i <= 360; i += 10) {
      const angle = (i * Math.PI) / 180;
      const lat = center.lat + (radiusKm / 111.32) * Math.cos(angle);
      const lon = center.lon + (radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle);
      points.push([lon, lat]);
    }
    return points;
  }

  mergePolygons(sectors) {
    // Simplification : on prend juste le premier secteur
    if (sectors && sectors.length > 0 && sectors[0].polygon) {
      return sectors[0].polygon;
    }
    return [];
  }

  async getAirspaces(params = {}) {
    let filtered = [...this.airspaces];
    
    if (params.types && params.types.length > 0) {
      filtered = filtered.filter(airspace => params.types.includes(airspace.type));
    }
    
    if (params.bounds) {
      const [minLat, minLon, maxLat, maxLon] = params.bounds;
      filtered = filtered.filter(airspace => {
        if (!airspace.geometry || airspace.geometry.length === 0) return false;
        return airspace.geometry.some(coord => 
          coord[1] >= minLat && coord[1] <= maxLat &&
          coord[0] >= minLon && coord[0] <= maxLon
      });
    }
    
    return filtered;
  }

  async getAirfields(params = {}) {
    let filtered = [...this.airfields];
    
    if (params.icao) {
      filtered = filtered.filter(af => af.icao === params.icao);
    }
    
    if (params.search) {
      const search = params.search.toLowerCase();
      filtered = filtered.filter(af => 
        af.icao.toLowerCase().includes(search) ||
        af.name.toLowerCase().includes(search) ||
        (af.city && af.city.toLowerCase().includes(search))
    }
    
    if (params.nearPoint) {
      const { lat, lon, radius } = params.nearPoint;
      filtered = filtered.filter(af => {
        const distance = this.calculateDistance(lat, lon, af.coordinates.lat, af.coordinates.lon);
        return distance <= radius;
      });
    }
    
    return filtered;
  }

  async getNavaids(params = {}) {
    let filtered = [...this.navaids];
    
    if (params.types && params.types.length > 0) {
      filtered = filtered.filter(navaid => 
        params.types.some(type => navaid.type.includes(type))
    }
    
    return filtered;
  }

  async getReportingPoints(icao) {
    return this.reportingPoints[icao] || [];
  }

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

  isAvailable() {
    return true;
  }

  getProviderName() {
    return 'SIA France';
  }

  getStatus() {
    return {
      available: true,
      name: this.getProviderName(),
      message: `Données SIA locales - ${this.airfields.length} aérodromes, ${this.airspaces.length} espaces aériens, ${this.navaids.length} navaids`
    };
  }
}