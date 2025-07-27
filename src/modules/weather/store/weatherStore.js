// src/modules/weather/store/weatherStore.js
import { create } from 'zustand';
import { weatherService } from '../services/weatherService';

// Coordonnées des principaux aéroports français
const AIRPORT_COORDINATES = {
  'LFPG': { lat: 49.0097, lon: 2.5479, name: 'Paris CDG' },
  'LFPO': { lat: 48.7253, lon: 2.3593, name: 'Paris Orly' },
  'LFPB': { lat: 48.9695, lon: 2.4414, name: 'Le Bourget' },
  'LFMT': { lat: 43.5764, lon: 3.9631, name: 'Montpellier' },
  'LFBO': { lat: 43.6293, lon: 1.3677, name: 'Toulouse' },
  'LFML': { lat: 43.4365, lon: 5.2155, name: 'Marseille' },
  'LFMN': { lat: 43.6584, lon: 7.2159, name: 'Nice' },
  'LFLL': { lat: 45.7263, lon: 5.0811, name: 'Lyon' },
  'LFRN': { lat: 48.0706, lon: -1.7348, name: 'Rennes' },
  'LFRS': { lat: 44.8286, lon: -0.7156, name: 'Nantes' },
  'LFBD': { lat: 44.8283, lon: -0.7156, name: 'Bordeaux' },
  'LFLB': { lat: 45.6378, lon: 5.8804, name: 'Chambéry' },
  'LFLS': { lat: 45.8628, lon: 6.8843, name: 'Grenoble' },
  'LFST': { lat: 48.5383, lon: 7.6281, name: 'Strasbourg' },
  'LFPN': { lat: 48.9833, lon: 2.5333, name: 'Toussus' },
  'LFPT': { lat: 48.7333, lon: 2.3833, name: 'Pontoise' }
};

// Store utilisant des objets simples pour éviter les problèmes de sérialisation avec Maps
const useWeatherStoreBase = create((set, get) => ({
  // État - Utilisation d'objets simples
  _airportWeatherData: {}, // ICAO -> données météo
  routeWeather: [], // Points météo le long de la route
  _windsAloftData: {}, // Position -> vents en altitude
  selectedAirport: null,
  loading: false,
  error: null,
  lastUpdate: null,
  apiKey: 'demo', // Mode démo par défaut
  
  // Configuration API
  setApiKey: (key) => {
    weatherService.setApiKey(key);
    set({ apiKey: key });
  },

  // Récupération météo aéroport
  fetchAirportWeather: async (icaoCode) => {
    const coordinates = AIRPORT_COORDINATES[icaoCode];
    if (!coordinates) {
      set({ error: `Coordonnées non trouvées pour ${icaoCode}` });
      return;
    }

    set({ loading: true, error: null });

    try {
      const weather = await weatherService.getAirportWeather(icaoCode, coordinates);
      
      set(state => ({
        _airportWeatherData: {
          ...state._airportWeatherData,
          [icaoCode]: {
            ...weather,
            coordinates,
            lastUpdate: new Date()
          }
        },
        loading: false,
        lastUpdate: new Date()
      }));
    } catch (error) {
      set({ 
        loading: false, 
        error: `Erreur météo ${icaoCode}: ${error.message}` 
      });
    }
  },

  // Récupération météo pour plusieurs aéroports
  fetchMultipleAirports: async (icaoCodes) => {
    set({ loading: true, error: null });

    try {
      await Promise.all(
        icaoCodes.map(code => get().fetchAirportWeather(code))
      );
    } catch (error) {
      set({ error: `Erreur récupération météo: ${error.message}` });
    } finally {
      set({ loading: false });
    }
  },

  // Récupération des vents en altitude pour une route
  fetchRouteWinds: async (waypoints, flightLevel) => {
    set({ loading: true, error: null });

    try {
      const windData = await Promise.all(
        waypoints.map(async (wp) => {
          const winds = await weatherService.getWindsAloft(wp.lat, wp.lon, flightLevel);
          return {
            waypoint: wp.name,
            position: { lat: wp.lat, lon: wp.lon },
            winds,
            flightLevel
          };
        })
      );

      const windsAloftData = {};
      windData.forEach(data => {
        const key = `${data.position.lat}_${data.position.lon}_FL${data.flightLevel}`;
        windsAloftData[key] = data;
      });

      set({
        _windsAloftData: windsAloftData,
        loading: false,
        lastUpdate: new Date()
      });

      return windData;
    } catch (error) {
      set({ 
        loading: false, 
        error: `Erreur vents en altitude: ${error.message}` 
      });
      return [];
    }
  },

  // Récupération météo le long d'une route
  fetchRouteWeather: async (waypoints) => {
    set({ loading: true, error: null });

    try {
      // Pour chaque waypoint, récupérer les conditions météo
      const weatherData = await Promise.all(
        waypoints.map(async (wp) => {
          const params = [
            'temperature', 'pressure', 'humidity',
            'windU', 'windV', 'visibility', 'cloudCover'
          ];
          
          const isInFrance = weatherService.isInFrance(wp.lat, wp.lon);
          const data = isInFrance 
            ? await weatherService.getAROMEForecast(wp.lat, wp.lon, params)
            : await weatherService.getARPEGEForecast(wp.lat, wp.lon, params);
          
          return {
            waypoint: wp.name,
            position: { lat: wp.lat, lon: wp.lon },
            weather: data,
            model: isInFrance ? 'AROME' : 'ARPEGE'
          };
        })
      );

      set({ 
        routeWeather: weatherData,
        loading: false,
        lastUpdate: new Date()
      });
    } catch (error) {
      set({ 
        loading: false, 
        error: `Erreur météo route: ${error.message}` 
      });
    }
  },

  // Calcul du vent effectif pour la navigation
  calculateEffectiveWind: (trueAirspeed, trueCourse, windDirection, windSpeed) => {
    // Conversion en radians
    const courseRad = trueCourse * Math.PI / 180;
    const windDirRad = windDirection * Math.PI / 180;
    
    // Composantes du vent
    const windX = windSpeed * Math.sin(windDirRad);
    const windY = windSpeed * Math.cos(windDirRad);
    
    // Composantes de la vitesse air
    const tasX = trueAirspeed * Math.sin(courseRad);
    const tasY = trueAirspeed * Math.cos(courseRad);
    
    // Vitesse sol
    const gsX = tasX + windX;
    const gsY = tasY + windY;
    const groundSpeed = Math.sqrt(gsX * gsX + gsY * gsY);
    
    // Dérive
    const drift = Math.atan2(gsX, gsY) * 180 / Math.PI - trueCourse;
    
    // Vent de face/arrière
    const headwind = windSpeed * Math.cos((windDirection - trueCourse) * Math.PI / 180);
    
    return {
      groundSpeed: Math.round(groundSpeed),
      drift: Math.round(drift),
      headwind: Math.round(headwind),
      crosswind: Math.round(windSpeed * Math.sin((windDirection - trueCourse) * Math.PI / 180))
    };
  },

  // Sélection d'un aéroport
  selectAirport: (icaoCode) => {
    set({ selectedAirport: icaoCode });
  },

  // Obtenir la météo d'un aéroport
  getAirportWeather: (icaoCode) => {
    return get()._airportWeatherData[icaoCode];
  },

  // Obtenir les vents pour une position et un niveau
  getWindsAt: (lat, lon, flightLevel) => {
    const key = `${lat}_${lon}_FL${flightLevel}`;
    return get()._windsAloftData[key];
  },

  // Vérifier si les données sont périmées (> 30 min)
  isDataStale: (lastUpdate) => {
    if (!lastUpdate) return true;
    const now = new Date();
    const diff = now - lastUpdate;
    return diff > 30 * 60 * 1000; // 30 minutes
  },

  // Effacer les données
  clearWeatherData: () => {
    set({
      _airportWeatherData: {},
      routeWeather: [],
      _windsAloftData: {},
      selectedAirport: null,
      error: null,
      lastUpdate: null
    });
    weatherService.clearCache();
  },

  // Fonction utilitaire pour formatter les données météo
  formatWeatherSummary: (weatherData) => {
    if (!weatherData || !weatherData.current) return 'Pas de données';
    
    const { current } = weatherData;
    const temp = Math.round(current.temperature - 273.15);
    const windDir = weatherService.calculateWindDirection(current.windU, current.windV);
    const windSpeed = weatherService.calculateWindSpeed(current.windU, current.windV);
    const visibility = Math.round(current.visibility / 1000); // m vers km
    
    return `${temp}°C, Vent ${windDir}°/${windSpeed}kt, Vis ${visibility}km`;
  }
}));

// Hook personnalisé qui expose les Maps
export const useWeatherStore = () => {
  const store = useWeatherStoreBase();
  
  // Convertir les objets en Maps pour l'utilisation dans les composants
  return {
    ...store,
    airportWeather: new Map(Object.entries(store._airportWeatherData || {})),
    windsAloft: new Map(Object.entries(store._windsAloftData || {}))
  };
};