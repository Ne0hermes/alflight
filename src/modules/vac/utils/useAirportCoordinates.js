import { useVACStore } from '../store/vacStore';

export const useAirportCoordinates = () => {
  const { charts } = useVACStore();

  const getCoordinatesByICAO = icao => {
    if (!icao) return null;
    const u = icao.toUpperCase();
    
    for (const c of Object.values(charts)) {
      if (c.airportIcao === u) {
        if (c.isDownloaded && c.extractedData?.coordinates) {
          return { lat: c.extractedData.coordinates.lat, lon: c.extractedData.coordinates.lon, source: 'extracted', elevation: c.extractedData.airportElevation };
        }
        if (c.coordinates) {
          return { lat: c.coordinates.lat, lon: c.coordinates.lon, source: 'predefined', elevation: null };
        }
      }
    }
    return null;
  };

  const getMultipleCoordinates = codes => {
    const coords = {};
    codes.forEach(c => { const co = getCoordinatesByICAO(c); if (co) coords[c] = co; });
    return coords;
  };

  const getAllAvailableCoordinates = () => {
    const coords = {};
    Object.values(charts).forEach(c => { const co = getCoordinatesByICAO(c.airportIcao); if (co) coords[c.airportIcao] = co; });
    return coords;
  };

  return { getCoordinatesByICAO, getMultipleCoordinates, getAllAvailableCoordinates };
};

export const FRENCH_AIRPORTS_COORDINATES = {
  LFPG: { lat: 49.012779, lon: 2.550000, name: 'Paris Charles de Gaulle' },
  LFPO: { lat: 48.723333, lon: 2.379444, name: 'Paris Orly' },
  LFPB: { lat: 48.969444, lon: 2.441667, name: 'Paris Le Bourget' },
  LFPT: { lat: 48.751111, lon: 2.106111, name: 'Pontoise' },
  LFPN: { lat: 48.596111, lon: 2.518056, name: 'Toussus-le-Noble' },
  LFML: { lat: 43.435556, lon: 5.213889, name: 'Marseille Provence' },
  LFLL: { lat: 45.726389, lon: 5.090833, name: 'Lyon Saint-Exupéry' },
  LFBO: { lat: 43.629167, lon: 1.363333, name: 'Toulouse Blagnac' },
  LFMN: { lat: 43.658333, lon: 7.215556, name: 'Nice Côte d\'Azur' },
  LFBD: { lat: 44.828333, lon: -0.715556, name: 'Bordeaux Mérignac' },
  LFRS: { lat: 44.407778, lon: -0.956111, name: 'Nantes Atlantique' },
  LFRB: { lat: 48.447778, lon: -4.418333, name: 'Brest Bretagne' },
  LFST: { lat: 48.538333, lon: 7.628056, name: 'Strasbourg' },
  LFLC: { lat: 45.786111, lon: 3.169167, name: 'Clermont-Ferrand' },
  LFRK: { lat: 49.650833, lon: -1.470278, name: 'Caen Carpiquet' }
};
