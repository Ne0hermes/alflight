// src/hooks/useAirportCoordinates.js
import { useVACStore } from '@core/stores/vacStore';
import airportDataService from '@services/airportDataService';

export const useAirportCoordinates = () => {
  // Récupérer les cartes VAC depuis le store
  const charts = useVACStore(state => state.charts);

  const getCoordinatesByICAO = (icao) => {
    if (!icao) return null;
    const u = icao.toUpperCase();
    
    // Vérifier d'abord dans le service de données aéroport
    const airportInfo = airportDataService.getAirportInfo(u);
    if (airportInfo) {
      return {
        lat: airportInfo.latitude,
        lon: airportInfo.longitude,
        name: airportInfo.name,
        elevation: airportInfo.elevation,
        source: 'data-service'
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
    
    // Récupérer tous les aéroports depuis le service de données
    // (le service peut fournir une méthode pour lister tous les aéroports si nécessaire)
    
    // Ajouter les coordonnées des cartes VAC
    Object.values(charts).forEach(c => { 
      const co = getCoordinatesByICAO(c.airportIcao); 
      if (co) coords[c.airportIcao] = co; 
    });
    
    return coords;
  };

  return { getCoordinatesByICAO, getMultipleCoordinates, getAllAvailableCoordinates };
};