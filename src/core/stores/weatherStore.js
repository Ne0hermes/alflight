// src/core/stores/weatherStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Mock API pour la démo - à remplacer par une vraie API météo
const mockWeatherAPI = {
  fetchMETAR: async (icao) => {
    // Simulation d'un délai réseau
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Données METAR simulées
    const metarData = {
      LFPN: `METAR LFPN ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 27015KT 9999 SCT035 18/12 Q1013 NOSIG`,
      LFPT: `METAR LFPT ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 26012KT 9999 FEW025 17/11 Q1013 NOSIG`,
      LFPG: `METAR LFPG ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 27018G28KT 9999 SCT040 BKN100 19/12 Q1012 TEMPO 27020G35KT`,
      LFPO: `METAR LFPO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 28010KT CAVOK 20/11 Q1013 NOSIG`,
      LFBO: `METAR LFBO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0800Z 31008KT 9999 FEW040 22/14 Q1011 NOSIG`
    };
    
    if (!metarData[icao]) {
      throw new Error(`Pas de données METAR pour ${icao}`);
    }
    
    return {
      raw: metarData[icao],
      decoded: decodeMETAR(metarData[icao])
    };
  },
  
  fetchTAF: async (icao) => {
    await new Promise(resolve => setTimeout(resolve, 700));
    
    const tafData = {
      LFPN: `TAF LFPN ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0700Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0806 27015KT 9999 SCT035 TEMPO 0812 27020G30KT`,
      LFPT: `TAF LFPT ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0700Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0806 26012KT 9999 FEW025 BECMG 1214 SCT030`,
      LFPG: `TAF LFPG ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0600Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0706 27018G28KT 9999 SCT040 BKN100 TEMPO 0915 27020G35KT 5000 SHRA SCT015TCU`,
      LFPO: `TAF LFPO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0600Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0706 28010KT CAVOK BECMG 1517 24008KT SCT045`,
      LFBO: `TAF LFBO ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0600Z ${new Date().toISOString().slice(0,10).replace(/-/g,'')}0706 31008KT 9999 FEW040 PROB30 TEMPO 1621 17015G25KT 3000 TSRA SCT015CB`
    };
    
    if (!tafData[icao]) {
      return null;
    }
    
    return {
      raw: tafData[icao],
      decoded: decodeTAF(tafData[icao])
    };
  }
};

// Décodeur METAR simplifié
function decodeMETAR(raw) {
  const parts = raw.split(' ');
  const decoded = {
    station: parts[1],
    time: parts[2],
    wind: decodeWind(parts[3]),
    visibility: parts[4] === 'CAVOK' ? 'CAVOK' : `${parts[4]}m`,
    clouds: [],
    temperature: null,
    dewpoint: null,
    pressure: null,
    trend: []
  };
  
  // Décoder les nuages
  let i = 4;
  if (parts[4] !== 'CAVOK') {
    while (i < parts.length && (parts[i].startsWith('FEW') || parts[i].startsWith('SCT') || parts[i].startsWith('BKN') || parts[i].startsWith('OVC'))) {
      decoded.clouds.push(decodeCloud(parts[i]));
      i++;
    }
  }
  
  // Température et point de rosée
  const tempMatch = raw.match(/(\d{2})\/(\d{2})/);
  if (tempMatch) {
    decoded.temperature = parseInt(tempMatch[1]);
    decoded.dewpoint = parseInt(tempMatch[2]);
  }
  
  // Pression
  const pressureMatch = raw.match(/Q(\d{4})/);
  if (pressureMatch) {
    decoded.pressure = parseInt(pressureMatch[1]);
  }
  
  return decoded;
}

function decodeTAF(raw) {
  return {
    raw,
    decoded: "TAF décodé (fonctionnalité simplifiée)"
  };
}

function decodeWind(wind) {
  if (wind === '00000KT') return { direction: 'Calme', speed: 0, gust: null };
  
  const match = wind.match(/(\d{3})(\d{2})(G(\d{2}))?KT/);
  if (match) {
    return {
      direction: parseInt(match[1]),
      speed: parseInt(match[2]),
      gust: match[4] ? parseInt(match[4]) : null
    };
  }
  return { direction: 'VRB', speed: 0, gust: null };
}

function decodeCloud(cloud) {
  const types = {
    'FEW': 'Quelques',
    'SCT': 'Épars',
    'BKN': 'Fragmenté',
    'OVC': 'Couvert'
  };
  
  const match = cloud.match(/(FEW|SCT|BKN|OVC)(\d{3})/);
  if (match) {
    return {
      type: types[match[1]],
      altitude: parseInt(match[2]) * 100
    };
  }
  return { type: cloud, altitude: 0 };
}

// Store Zustand pour la météo
export const useWeatherStore = create(
  immer((set, get) => ({
    // État
    weatherData: new Map(), // Map<icao, weatherInfo>
    loading: new Set(), // Set<icao> des stations en cours de chargement
    errors: new Map(), // Map<icao, error>
    lastUpdate: new Map(), // Map<icao, timestamp>
    autoRefreshInterval: 30 * 60 * 1000, // 30 minutes
    
    // Actions
    fetchWeather: async (icao) => {
      const upperIcao = icao.toUpperCase();
      
      // Marquer comme en cours de chargement
      set(state => {
        state.loading.add(upperIcao);
        state.errors.delete(upperIcao);
      });
      
      try {
        // Récupérer METAR et TAF en parallèle
        const [metar, taf] = await Promise.all([
          mockWeatherAPI.fetchMETAR(upperIcao),
          mockWeatherAPI.fetchTAF(upperIcao).catch(() => null)
        ]);
        
        set(state => {
          state.weatherData.set(upperIcao, {
            icao: upperIcao,
            metar,
            taf,
            timestamp: Date.now()
          });
          state.lastUpdate.set(upperIcao, Date.now());
          state.loading.delete(upperIcao);
        });
        
        return true;
      } catch (error) {
        set(state => {
          state.errors.set(upperIcao, error.message);
          state.loading.delete(upperIcao);
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
      state.weatherData.delete(upperIcao);
      state.lastUpdate.delete(upperIcao);
      state.errors.delete(upperIcao);
    }),
    
    clearAll: () => set(state => {
      state.weatherData.clear();
      state.lastUpdate.clear();
      state.errors.clear();
      state.loading.clear();
    }),
    
    // Sélecteurs
    getWeatherByIcao: (icao) => {
      return get().weatherData.get(icao?.toUpperCase());
    },
    
    isLoading: (icao) => {
      return get().loading.has(icao?.toUpperCase());
    },
    
    getError: (icao) => {
      return get().errors.get(icao?.toUpperCase());
    },
    
    needsRefresh: (icao) => {
      const lastUpdate = get().lastUpdate.get(icao?.toUpperCase());
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