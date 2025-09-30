import { AeroDataProvider } from '../AeroDataProvider';

export class NotImplementedProvider extends AeroDataProvider {
  constructor() {
    super();
    this.name = 'En cours de développement';
  }

  isAvailable() {
    return false; // Provider non disponible
  }

  getProviderName() {
    return this.name;
  }

  getStatus() {
    return {
      available: false,
      name: this.name,
      message: 'Le service de données aéronautiques est en cours de refonte. Utilisez la saisie manuelle.'
    };
  }

  async getAirspaces(params) {
    return [];
  }

  async getAirfields(params) {
    
    const staticAirfields = [
      {
        icao: 'LFPG',
        name: 'Paris Charles de Gaulle',
        city: 'Paris',
        coordinates: { lat: 49.0097, lon: 2.5479 },
        elevation: 392,
        type: 'large_airport',
        runways: [
          { designation: '08L/26R', length: 4200, surface: 'asphalt' },
          { designation: '08R/26L', length: 2700, surface: 'asphalt' },
          { designation: '09L/27R', length: 4200, surface: 'asphalt' },
          { designation: '09R/27L', length: 2700, surface: 'asphalt' }
        ]
      },
      {
        icao: 'LFPO',
        name: 'Paris Orly',
        city: 'Paris',
        coordinates: { lat: 48.7233, lon: 2.3794 },
        elevation: 291,
        type: 'large_airport',
        runways: [
          { designation: '06/24', length: 3650, surface: 'asphalt' },
          { designation: '07/25', length: 3320, surface: 'asphalt' },
          { designation: '08/26', length: 2400, surface: 'asphalt' }
        ]
      },
      {
        icao: 'LFPB',
        name: 'Paris Le Bourget',
        city: 'Le Bourget',
        coordinates: { lat: 48.9694, lon: 2.4414 },
        elevation: 218,
        type: 'medium_airport',
        runways: [
          { designation: '07/25', length: 2665, surface: 'asphalt' },
          { designation: '09/27', length: 3000, surface: 'asphalt' }
        ]
      },
      {
        icao: 'LFPT',
        name: 'Pontoise Cormeilles',
        city: 'Pontoise',
        coordinates: { lat: 49.0967, lon: 2.0408 },
        elevation: 325,
        type: 'small_airport',
        runways: [
          { designation: '12/30', length: 1650, surface: 'asphalt' },
          { designation: '05/23', length: 1150, surface: 'grass' }
        ]
      },
      {
        icao: 'LFPN',
        name: 'Toussus-le-Noble',
        city: 'Toussus-le-Noble',
        coordinates: { lat: 48.7517, lon: 2.1061 },
        elevation: 538,
        type: 'small_airport',
        runways: [
          { designation: '07L/25R', length: 1100, surface: 'asphalt' },
          { designation: '07R/25L', length: 1015, surface: 'grass' }
        ]
      }
    ];

    if (params?.search) {
      const search = params.search.toLowerCase();
      return staticAirfields.filter(a => 
        a.icao.toLowerCase().includes(search) ||
        a.name.toLowerCase().includes(search) ||
        a.city?.toLowerCase().includes(search)
      );
    }

    if (params?.icao) {
      return staticAirfields.filter(a => a.icao === params.icao);
    }

    return staticAirfields;
  }

  async getNavaids(params) {
    
    return [
      {
        id: 'vor-pon',
        identifier: 'PON',
        name: 'Pontoise',
        type: 'VOR-DME',
        frequency: 113.65,
        coordinates: { lat: 49.0967, lon: 2.0408 }
      },
      {
        id: 'vor-crl',
        identifier: 'CRL',
        name: 'Charles de Gaulle',
        type: 'VOR-DME',
        frequency: 115.15,
        coordinates: { lat: 49.0097, lon: 2.5479 }
      }
    ];
  }

  async getReportingPoints(icao) {
    
    const pointsByAirport = {
      'LFPT': [
        { code: 'N', name: 'November', mandatory: true, coordinates: { lat: 49.1167, lon: 2.0408 } },
        { code: 'S', name: 'Sierra', mandatory: true, coordinates: { lat: 49.0767, lon: 2.0408 } },
        { code: 'E', name: 'Echo', mandatory: false, coordinates: { lat: 49.0967, lon: 2.0608 } },
        { code: 'W', name: 'Whiskey', mandatory: false, coordinates: { lat: 49.0967, lon: 2.0208 } }
      ],
      'LFPN': [
        { code: 'NE', name: 'Nord-Est', mandatory: true, coordinates: { lat: 48.7717, lon: 2.1261 } },
        { code: 'SE', name: 'Sud-Est', mandatory: true, coordinates: { lat: 48.7317, lon: 2.1261 } }
      ]
    };
    
    return pointsByAirport[icao] || [];
  }

  async testConnection() {
    return {
      success: false,
      mode: 'not_implemented',
      error: 'Service en cours de développement'
    };
  }

  calculateDistance(coord1, coord2) {
    const R = 6371;
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  compareCoordinates(coord1, coord2, tolerance = 0.001) {
    const latDiff = Math.abs(coord1.lat - coord2.lat);
    const lonDiff = Math.abs(coord1.lon - coord2.lon);
    const distance = this.calculateDistance(coord1, coord2);
    
    return {
      isMatch: latDiff <= tolerance && lonDiff <= tolerance,
      distance: distance * 1000,
      latDiff,
      lonDiff
    };
  }
}