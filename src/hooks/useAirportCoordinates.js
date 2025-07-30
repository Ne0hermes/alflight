// src/hooks/useAirportCoordinates.js
import { FRENCH_AIRPORTS_COORDINATES } from '@data/airportElevations';
import { useVACStore } from '@core/stores/vacStore';

export const useAirportCoordinates = () => {
  // Récupérer les cartes VAC depuis le store
  const charts = useVACStore(state => state.charts);

  const getCoordinatesByICAO = (icao) => {
    if (!icao) return null;
    const u = icao.toUpperCase();
    
    // Vérifier d'abord dans les données statiques
    if (FRENCH_AIRPORTS_COORDINATES[u]) {
      const airport = FRENCH_AIRPORTS_COORDINATES[u];
      return {
        lat: airport.lat,
        lon: airport.lon,
        name: airport.name,
        source: 'static'
      };
    }
    
    // Vérifier dans les cartes VAC téléchargées
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

  const getMultipleCoordinates = (codes) => {
    const coords = {};
    codes.forEach(c => { 
      const co = getCoordinatesByICAO(c); 
      if (co) coords[c] = co; 
    });
    return coords;
  };

  const getAllAvailableCoordinates = () => {
    const coords = {};
    
    // Ajouter les coordonnées statiques
    Object.keys(FRENCH_AIRPORTS_COORDINATES).forEach(icao => {
      const co = getCoordinatesByICAO(icao);
      if (co) coords[icao] = co;
    });
    
    // Ajouter les coordonnées des cartes VAC
    Object.values(charts).forEach(c => { 
      const co = getCoordinatesByICAO(c.airportIcao); 
      if (co) coords[c.airportIcao] = co; 
    });
    
    return coords;
  };

  return { getCoordinatesByICAO, getMultipleCoordinates, getAllAvailableCoordinates };
};

// Exporter les données pour compatibilité
export { FRENCH_AIRPORTS_COORDINATES } from '@data/airportElevations';