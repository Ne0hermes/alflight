// src/core/stores/weatherStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { weatherAPI } from '@services/weatherAPI';

// Store Zustand pour la météo (version corrigée sans Map/Set)
export const useWeatherStore = create(
  immer((set, get) => ({
    // État (utilisation d'objets au lieu de Map/Set pour compatibilité Immer)
    weatherData: {}, // Object<icao, weatherInfo>
    loading: {}, // Object<icao, boolean>
    errors: {}, // Object<icao, error>
    lastUpdate: {}, // Object<icao, timestamp>
    autoRefreshInterval: 30 * 60 * 1000, // 30 minutes
    
    // Actions
    fetchWeather: async (icao) => {
      const upperIcao = icao.toUpperCase();
      
      console.log(`🌤️ Récupération météo pour ${upperIcao}...`);
      
      // Marquer comme en cours de chargement
      set(state => {
        state.loading[upperIcao] = true;
        delete state.errors[upperIcao];
      });
      
      try {
        // Récupérer METAR et TAF en parallèle
        const [metar, taf] = await Promise.all([
          weatherAPI.fetchMETAR(upperIcao),
          weatherAPI.fetchTAF(upperIcao).catch(() => null)
        ]);
        
        console.log(`✅ Météo reçue pour ${upperIcao}:`, { metar: metar?.raw?.substring(0, 50) + '...' });
        
        set(state => {
          state.weatherData[upperIcao] = {
            icao: upperIcao,
            metar,
            taf,
            timestamp: Date.now()
          };
          state.lastUpdate[upperIcao] = Date.now();
          delete state.loading[upperIcao];
        });
        
        return true;
      } catch (error) {
        set(state => {
          state.errors[upperIcao] = error.message;
          delete state.loading[upperIcao];
        });
        return false;
      }
    },
    
    fetchMultiple: async (icaoCodes) => {
      const promises = icaoCodes.map(icao => get().fetchWeather(icao));
      await Promise.allSettled(promises);
    },
    
    clearWeather: (icao) => set(state => {
      const upperIcao = icao.toUpperCase();
      delete state.weatherData[upperIcao];
      delete state.lastUpdate[upperIcao];
      delete state.errors[upperIcao];
      delete state.loading[upperIcao];
    }),
    
    clearAll: () => set(state => {
      state.weatherData = {};
      state.lastUpdate = {};
      state.errors = {};
      state.loading = {};
    }),
    
    // Sélecteurs
    getWeatherByIcao: (icao) => {
      return get().weatherData[icao?.toUpperCase()];
    },
    
    isLoading: (icao) => {
      return !!get().loading[icao?.toUpperCase()];
    },
    
    getError: (icao) => {
      return get().errors[icao?.toUpperCase()];
    },
    
    needsRefresh: (icao) => {
      const lastUpdate = get().lastUpdate[icao?.toUpperCase()];
      if (!lastUpdate) return true;
      return Date.now() - lastUpdate > get().autoRefreshInterval;
    }
  }))
);

// Sélecteurs optimisés
export const weatherSelectors = {
  useWeatherByIcao: (icao) => useWeatherStore(state => state.getWeatherByIcao(icao)),
  useIsLoading: (icao) => useWeatherStore(state => state.isLoading(icao)),
  useError: (icao) => useWeatherStore(state => state.getError(icao)),
  useWeatherActions: () => useWeatherStore(
    state => ({
      fetchWeather: state.fetchWeather,
      fetchMultiple: state.fetchMultiple,
      clearWeather: state.clearWeather,
      clearAll: state.clearAll
    }),
    (a, b) => Object.is(a, b)
  )
};