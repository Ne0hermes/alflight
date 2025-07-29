// src/modules/weather/store/weatherStore.js
import { create } from 'zustand';
import { weatherService } from '../services/weatherService';
import { useMemo } from 'react';

// Coordonnées des principaux aéroports français - Object freeze pour optimisation
const AIRPORT_COORDINATES = Object.freeze({
  'LFPG': Object.freeze({ lat: 49.0097, lon: 2.5479, name: 'Paris CDG' }),
  'LFPO': Object.freeze({ lat: 48.7253, lon: 2.3593, name: 'Paris Orly' }),
  'LFPB': Object.freeze({ lat: 48.9695, lon: 2.4414, name: 'Le Bourget' }),
  'LFMT': Object.freeze({ lat: 43.5764, lon: 3.9631, name: 'Montpellier' }),
  'LFBO': Object.freeze({ lat: 43.6293, lon: 1.3677, name: 'Toulouse' }),
  'LFML': Object.freeze({ lat: 43.4365, lon: 5.2155, name: 'Marseille' }),
  'LFMN': Object.freeze({ lat: 43.6584, lon: 7.2159, name: 'Nice' }),
  'LFLL': Object.freeze({ lat: 45.7263, lon: 5.0811, name: 'Lyon' }),
  'LFRN': Object.freeze({ lat: 48.0706, lon: -1.7348, name: 'Rennes' }),
  'LFRS': Object.freeze({ lat: 44.8286, lon: -0.7156, name: 'Nantes' }),
  'LFBD': Object.freeze({ lat: 44.8283, lon: -0.7156, name: 'Bordeaux' }),
  'LFLB': Object.freeze({ lat: 45.6378, lon: 5.8804, name: 'Chambéry' }),
  'LFLS': Object.freeze({ lat: 45.8628, lon: 6.8843, name: 'Grenoble' }),
  'LFST': Object.freeze({ lat: 48.5383, lon: 7.6281, name: 'Strasbourg' }),
  'LFPN': Object.freeze({ lat: 48.9833, lon: 2.5333, name: 'Toussus' }),
  'LFPT': Object.freeze({ lat: 48.7333, lon: 2.3833, name: 'Pontoise' })
});

// Store optimisé avec sélecteurs
const useWeatherStoreBase = create((set, get) => ({
  // État
  _airportWeatherData: {},
  routeWeather: [],
  _windsAloftData: {},
  selectedAirport: null,
  loading: false,
  error: null,
  lastUpdate: null,
  apiKey: 'demo',
  
  // Actions optimisées
  setApiKey: (key) => {
    weatherService.setApiKey(key);
    set({ apiKey: key });
  },

  fetchAirportWeather: async (icaoCode) => {
    const coordinates = AIRPORT_COORDINATES[icaoCode];
    if (!coordinates) {
      set({ error: `Coordonnées non trouvées pour ${icaoCode}` });
      return;
    }

    // Éviter les requêtes multiples pour le même aéroport
    const existingData = get()._airportWeatherData[icaoCode];
    if (existingData && !get().isDataStale(existingData.lastUpdate)) {
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

  fetchMultipleAirports: async (icaoCodes) => {
    // Filtrer les aéroports qui ont déjà des données récentes
    const airportsToFetch = icaoCodes.filter(code => {
      const existingData = get()._airportWeatherData[code];
      return !existingData || get().isDataStale(existingData.lastUpdate);
    });

    if (airportsToFetch.length === 0) return;

    set({ loading: true, error: null });

    try {
      // Utiliser Promise.allSettled pour ne pas échouer complètement si une requête échoue
      const results = await Promise.allSettled(
        airportsToFetch.map(code => get().fetchAirportWeather(code))
      );
      
      const failedRequests = results.filter(r => r.status === 'rejected');
      if (failedRequests.length > 0) {
        console.warn('Certaines requêtes météo ont échoué:', failedRequests);
      }
    } catch (error) {
      set({ error: `Erreur récupération météo: ${error.message}` });
    } finally {
      set({ loading: false });
    }
  },

  fetchRouteWinds: async (waypoints, flightLevel) => {
    // Éviter les requêtes si les données sont récentes
    const existingWinds = Object.values(get()._windsAloftData);
    const hasRecentData = existingWinds.some(data => 
      data.flightLevel === flightLevel && !get().isDataStale(data.timestamp)
    );
    
    if (hasRecentData && existingWinds.length >= waypoints.length) {
      return existingWinds;
    }

    set({ loading: true, error: null });

    try {
      // Optimiser en groupant les requêtes par batch
      const batchSize = 5;
      const windData = [];
      
      for (let i = 0; i < waypoints.length; i += batchSize) {
        const batch = waypoints.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (wp) => {
            const winds = await weatherService.getWindsAloft(wp.lat, wp.lon, flightLevel);
            return {
              waypoint: wp.name,
              position: { lat: wp.lat, lon: wp.lon },
              winds,
              flightLevel,
              timestamp: new Date()
            };
          })
        );
        windData.push(...batchResults);
      }

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

  fetchRouteWeather: async (waypoints) => {
    set({ loading: true, error: null });

    try {
      // Optimiser avec batch processing
      const batchSize = 5;
      const weatherData = [];
      
      for (let i = 0; i < waypoints.length; i += batchSize) {
        const batch = waypoints.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (wp) => {
            const params = weatherService.surfaceParams;
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
        weatherData.push(...batchResults);
      }

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

  // Fonction de calcul optimisée
  calculateEffectiveWind: (trueAirspeed, trueCourse, windDirection, windSpeed) => {
    const courseRad = trueCourse * Math.PI / 180;
    const windDirRad = windDirection * Math.PI / 180;
    
    const windX = windSpeed * Math.sin(windDirRad);
    const windY = windSpeed * Math.cos(windDirRad);
    
    const tasX = trueAirspeed * Math.sin(courseRad);
    const tasY = trueAirspeed * Math.cos(courseRad);
    
    const gsX = tasX + windX;
    const gsY = tasY + windY;
    const groundSpeed = Math.sqrt(gsX * gsX + gsY * gsY);
    
    const drift = Math.atan2(gsX, gsY) * 180 / Math.PI - trueCourse;
    const headwind = windSpeed * Math.cos((windDirection - trueCourse) * Math.PI / 180);
    const crosswind = windSpeed * Math.sin((windDirection - trueCourse) * Math.PI / 180);
    
    return {
      groundSpeed: Math.round(groundSpeed),
      drift: Math.round(drift),
      headwind: Math.round(headwind),
      crosswind: Math.round(crosswind)
    };
  },

  selectAirport: (icaoCode) => {
    set({ selectedAirport: icaoCode });
  },

  getAirportWeather: (icaoCode) => {
    return get()._airportWeatherData[icaoCode];
  },

  getWindsAt: (lat, lon, flightLevel) => {
    const key = `${lat}_${lon}_FL${flightLevel}`;
    return get()._windsAloftData[key];
  },

  isDataStale: (lastUpdate) => {
    if (!lastUpdate) return true;
    const now = new Date();
    const diff = now - lastUpdate;
    return diff > 30 * 60 * 1000; // 30 minutes
  },

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

  formatWeatherSummary: (weatherData) => {
    if (!weatherData || !weatherData.current) return 'Pas de données';
    
    const { current } = weatherData;
    const temp = Math.round(current.temperature - 273.15);
    const dewpoint = weatherService.calculateDewpoint(current.temperature, current.humidity);
    const windDir = weatherService.calculateWindDirection(current.windU, current.windV);
    const windSpeed = weatherService.calculateWindSpeed(current.windU, current.windV);
    const visibility = Math.round(current.visibility / 1000);
    
    return `${temp}°C (Td ${dewpoint}°C), Vent ${windDir}°/${windSpeed}kt, Vis ${visibility}km`;
  }
}));

// Hook personnalisé optimisé avec mémorisation
export const useWeatherStore = () => {
  const store = useWeatherStoreBase();
  
  // Mémoriser les Maps uniquement si les données changent
  const airportWeather = useMemo(() => {
    const data = store._airportWeatherData || {};
    return new Map(Object.entries(data));
  }, [store._airportWeatherData]);
  
  const windsAloft = useMemo(() => {
    const data = store._windsAloftData || {};
    return new Map(Object.entries(data));
  }, [store._windsAloftData]);
  
  // Retourner uniquement les propriétés nécessaires
  return {
    airportWeather,
    windsAloft,
    routeWeather: store.routeWeather,
    selectedAirport: store.selectedAirport,
    loading: store.loading,
    error: store.error,
    lastUpdate: store.lastUpdate,
    apiKey: store.apiKey,
    setApiKey: store.setApiKey,
    fetchAirportWeather: store.fetchAirportWeather,
    fetchMultipleAirports: store.fetchMultipleAirports,
    fetchRouteWinds: store.fetchRouteWinds,
    fetchRouteWeather: store.fetchRouteWeather,
    calculateEffectiveWind: store.calculateEffectiveWind,
    selectAirport: store.selectAirport,
    getAirportWeather: store.getAirportWeather,
    getWindsAt: store.getWindsAt,
    isDataStale: store.isDataStale,
    clearWeatherData: store.clearWeatherData,
    formatWeatherSummary: store.formatWeatherSummary
  };
};