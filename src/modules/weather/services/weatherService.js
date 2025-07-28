// src/modules/weather/services/weatherService.js
import { create } from 'zustand';

// Configuration des API Météo-France
const METEO_FRANCE_CONFIG = {
  AROME: {
    baseUrl: 'https://portail-api.meteofrance.fr/public/arome',
    // AROME : modèle haute résolution (1.3km) pour la France métropolitaine
    // Prévisions jusqu'à 42h
    coverage: 'france',
    resolution: 1.3, // km
    forecast: 42 // heures
  },
  ARPEGE: {
    baseUrl: 'https://portail-api.meteofrance.fr/public/arpege',
    // ARPEGE : modèle global (10km Europe, 60km monde)
    // Prévisions jusqu'à 114h
    coverage: 'global',
    resolution: 10, // km en Europe
    forecast: 114 // heures
  }
};

// Types de paramètres météo disponibles
const WEATHER_PARAMS = {
  // Paramètres de surface
  SURFACE: {
    temperature: 't', // Température (K)
    pressure: 'psl', // Pression au niveau de la mer (Pa)
    humidity: 'r', // Humidité relative (%)
    precipitation: 'tp', // Précipitations totales (mm)
    cloudCover: 'tcc', // Couverture nuageuse totale (%)
    visibility: 'vis', // Visibilité (m)
    windU: 'u10', // Composante U du vent à 10m (m/s)
    windV: 'v10', // Composante V du vent à 10m (m/s)
  },
  // Paramètres en altitude
  ALTITUDE: {
    temperature: 't_altitude',
    humidity: 'r_altitude',
    windU: 'u_altitude',
    windV: 'v_altitude',
    geopotential: 'z' // Hauteur géopotentielle
  },
  // Niveaux de pression standards (hPa)
  PRESSURE_LEVELS: [1000, 925, 850, 700, 500, 300, 200],
  // Altitudes approximatives (ft)
  ALTITUDE_LEVELS: {
    1000: 0,
    925: 2500,
    850: 5000,
    700: 10000,
    500: 18000,
    300: 30000,
    200: 39000
  }
};

class WeatherService {
  constructor() {
    this.apiKey = null; // À configurer avec une clé API réelle
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  // Configuration de la clé API
  setApiKey(key) {
    this.apiKey = key;
  }

  // Récupération des données AROME
  async getAROMEForecast(lat, lon, params = []) {
    const cacheKey = `arome_${lat}_${lon}_${params.join('_')}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Mode démo sans clé API
    if (!this.apiKey || this.apiKey === 'demo') {
      const mockData = this.generateMockData(lat, lon, params, 'AROME');
      this.setCache(cacheKey, mockData);
      return mockData;
    }

    try {
      // Construction de l'URL avec les paramètres
      const url = new URL(`${METEO_FRANCE_CONFIG.AROME.baseUrl}/1.0/forecast`);
      url.searchParams.append('lat', lat);
      url.searchParams.append('lon', lon);
      url.searchParams.append('params', params.join(','));
      url.searchParams.append('apikey', this.apiKey);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erreur API AROME: ${response.status}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Erreur récupération AROME:', error);
      // Fallback sur données mock en cas d'erreur
      const mockData = this.generateMockData(lat, lon, params, 'AROME');
      this.setCache(cacheKey, mockData);
      return mockData;
    }
  }

  // Récupération des données ARPEGE
  async getARPEGEForecast(lat, lon, params = []) {
    const cacheKey = `arpege_${lat}_${lon}_${params.join('_')}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Mode démo sans clé API
    if (!this.apiKey || this.apiKey === 'demo') {
      const mockData = this.generateMockData(lat, lon, params, 'ARPEGE');
      this.setCache(cacheKey, mockData);
      return mockData;
    }

    try {
      const url = new URL(`${METEO_FRANCE_CONFIG.ARPEGE.baseUrl}/1.0/forecast`);
      url.searchParams.append('lat', lat);
      url.searchParams.append('lon', lon);
      url.searchParams.append('params', params.join(','));
      url.searchParams.append('apikey', this.apiKey);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erreur API ARPEGE: ${response.status}`);
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Erreur récupération ARPEGE:', error);
      // Fallback sur données mock en cas d'erreur
      const mockData = this.generateMockData(lat, lon, params, 'ARPEGE');
      this.setCache(cacheKey, mockData);
      return mockData;
    }
  }

  // Récupération des vents en altitude pour un niveau de vol
  async getWindsAloft(lat, lon, flightLevel) {
    // Conversion FL en pression
    const pressureLevel = this.flightLevelToPressure(flightLevel);
    
    try {
      // Utiliser AROME pour la France, ARPEGE pour l'international
      const isInFrance = this.isInFrance(lat, lon);
      const params = [`u_${pressureLevel}`, `v_${pressureLevel}`];
      
      const data = isInFrance 
        ? await this.getAROMEForecast(lat, lon, params)
        : await this.getARPEGEForecast(lat, lon, params);
      
      return this.processWindData(data, pressureLevel);
    } catch (error) {
      console.error('Erreur récupération vents:', error);
      return null;
    }
  }

  // Récupération des conditions météo pour un aérodrome
  async getAirportWeather(icaoCode, coordinates) {
    const { lat, lon } = coordinates;
    
    try {
      // Paramètres pertinents pour l'aviation
      const params = [
        WEATHER_PARAMS.SURFACE.temperature,
        WEATHER_PARAMS.SURFACE.pressure,
        WEATHER_PARAMS.SURFACE.humidity,
        WEATHER_PARAMS.SURFACE.windU,
        WEATHER_PARAMS.SURFACE.windV,
        WEATHER_PARAMS.SURFACE.visibility,
        WEATHER_PARAMS.SURFACE.cloudCover,
        WEATHER_PARAMS.SURFACE.precipitation
      ];

      const data = await this.getAROMEForecast(lat, lon, params);
      return this.processAirportWeather(data, icaoCode);
    } catch (error) {
      console.error(`Erreur météo aéroport ${icaoCode}:`, error);
      return null;
    }
  }

  // Génération d'un METAR simulé à partir des données
  generateMETAR(weatherData, icaoCode) {
    if (!weatherData) return null;

    const date = new Date();
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hour = date.getUTCHours().toString().padStart(2, '0');
    const minute = date.getUTCMinutes().toString().padStart(2, '0');

    // Conversion des données
    const temp = Math.round(weatherData.temperature - 273.15); // K vers °C
    const dewpoint = this.calculateDewpoint(weatherData.temperature, weatherData.humidity);
    const pressure = Math.round(weatherData.pressure / 100); // Pa vers hPa
    const windDir = this.calculateWindDirection(weatherData.windU, weatherData.windV);
    const windSpeed = this.calculateWindSpeed(weatherData.windU, weatherData.windV);
    const visibility = Math.round(weatherData.visibility);
    
    // Construction du METAR
    let metar = `${icaoCode} ${day}${hour}${minute}Z `;
    
    // Vent
    if (windSpeed < 1) {
      metar += '00000KT ';
    } else {
      metar += `${windDir.toString().padStart(3, '0')}${windSpeed.toString().padStart(2, '0')}KT `;
    }
    
    // Visibilité
    if (visibility >= 10000) {
      metar += '9999 ';
    } else {
      metar += `${visibility.toString().padStart(4, '0')} `;
    }
    
    // Phénomènes météo (simplifié)
    if (weatherData.precipitation > 0.1) {
      if (temp > 0) {
        metar += 'RA '; // Pluie
      } else {
        metar += 'SN '; // Neige
      }
    }
    
    // Nuages (simplifié)
    const cloudCover = weatherData.cloudCover;
    if (cloudCover < 12.5) {
      metar += 'SKC ';
    } else if (cloudCover < 37.5) {
      metar += 'FEW030 ';
    } else if (cloudCover < 62.5) {
      metar += 'SCT040 ';
    } else if (cloudCover < 87.5) {
      metar += 'BKN050 ';
    } else {
      metar += 'OVC060 ';
    }
    
    // Température et point de rosée
    metar += `${temp.toString().padStart(2, '0')}/${dewpoint.toString().padStart(2, '0')} `;
    
    // QNH
    metar += `Q${pressure}`;
    
    return metar;
  }

  // Génération d'un TAF simplifié
  generateTAF(forecastData, icaoCode) {
    if (!forecastData || !forecastData.length) return null;

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    
    let taf = `TAF ${icaoCode} `;
    taf += `${this.formatTAFDate(startDate)} `;
    taf += `${this.formatTAFPeriod(startDate, endDate)} `;
    
    // Conditions principales (première prévision)
    const mainForecast = forecastData[0];
    taf += this.formatTAFConditions(mainForecast);
    
    // Évolutions significatives
    for (let i = 1; i < Math.min(forecastData.length, 4); i++) {
      const forecast = forecastData[i];
      const prevForecast = forecastData[i - 1];
      
      if (this.isSignificantChange(prevForecast, forecast)) {
        const changeTime = new Date(startDate.getTime() + i * 6 * 60 * 60 * 1000);
        taf += ` BECMG ${this.formatTAFTime(changeTime)} `;
        taf += this.formatTAFConditions(forecast);
      }
    }
    
    return taf;
  }

  // Méthodes utilitaires
  isInFrance(lat, lon) {
    // Limites approximatives de la France métropolitaine
    return lat >= 41 && lat <= 51.5 && lon >= -5.5 && lon <= 10;
  }

  flightLevelToPressure(fl) {
    // Approximation : FL100 = 700 hPa, FL180 = 500 hPa, FL300 = 300 hPa
    if (fl <= 100) return 700;
    if (fl <= 180) return 500;
    if (fl <= 300) return 300;
    return 200;
  }

  calculateWindDirection(u, v) {
    const dir = Math.atan2(-u, -v) * 180 / Math.PI;
    return Math.round((dir + 360) % 360);
  }

  calculateWindSpeed(u, v) {
    return Math.round(Math.sqrt(u * u + v * v) * 1.94384); // m/s vers kt
  }

  calculateDewpoint(temp, humidity) {
    const tempC = temp - 273.15;
    const a = 17.27;
    const b = 237.7;
    const gamma = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
    return Math.round((b * gamma) / (a - gamma));
  }

  processWindData(data, pressureLevel) {
    if (!data || !data.forecast) return null;
    
    const forecast = data.forecast[0]; // Première échéance
    const u = forecast[`u_${pressureLevel}`];
    const v = forecast[`v_${pressureLevel}`];
    
    return {
      direction: this.calculateWindDirection(u, v),
      speed: this.calculateWindSpeed(u, v),
      u: u,
      v: v,
      timestamp: forecast.time
    };
  }

  processAirportWeather(data, icaoCode) {
    if (!data || !data.forecast) return null;
    
    const current = data.forecast[0];
    const forecast = data.forecast.slice(0, 8); // 24h de prévisions (par 3h)
    
    return {
      icao: icaoCode,
      current: {
        temperature: current.t,
        pressure: current.psl,
        humidity: current.r,
        windU: current.u10,
        windV: current.v10,
        visibility: current.vis,
        cloudCover: current.tcc,
        precipitation: current.tp,
        timestamp: current.time
      },
      forecast: forecast,
      metar: this.generateMETAR(current, icaoCode),
      taf: this.generateTAF(forecast, icaoCode)
    };
  }

  formatTAFDate(date) {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hour = date.getUTCHours().toString().padStart(2, '0');
    const minute = date.getUTCMinutes().toString().padStart(2, '0');
    return `${day}${hour}${minute}Z`;
  }

  formatTAFPeriod(start, end) {
    const startDay = start.getUTCDate().toString().padStart(2, '0');
    const startHour = start.getUTCHours().toString().padStart(2, '0');
    const endDay = end.getUTCDate().toString().padStart(2, '0');
    const endHour = end.getUTCHours().toString().padStart(2, '0');
    return `${startDay}${startHour}/${endDay}${endHour}`;
  }

  formatTAFTime(date) {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hour = date.getUTCHours().toString().padStart(2, '0');
    return `${day}${hour}00`;
  }

  formatTAFConditions(forecast) {
    const temp = Math.round(forecast.t - 273.15);
    const windDir = this.calculateWindDirection(forecast.u10, forecast.v10);
    const windSpeed = this.calculateWindSpeed(forecast.u10, forecast.v10);
    const visibility = Math.round(forecast.vis);
    
    let conditions = '';
    
    // Vent
    if (windSpeed < 1) {
      conditions += '00000KT ';
    } else {
      conditions += `${windDir.toString().padStart(3, '0')}${windSpeed.toString().padStart(2, '0')}KT `;
    }
    
    // Visibilité
    if (visibility >= 10000) {
      conditions += '9999 ';
    } else {
      conditions += `${visibility.toString().padStart(4, '0')} `;
    }
    
    // Nuages
    const cloudCover = forecast.tcc;
    if (cloudCover < 12.5) {
      conditions += 'SKC';
    } else if (cloudCover < 37.5) {
      conditions += 'FEW030';
    } else if (cloudCover < 62.5) {
      conditions += 'SCT040';
    } else if (cloudCover < 87.5) {
      conditions += 'BKN050';
    } else {
      conditions += 'OVC060';
    }
    
    return conditions;
  }

  isSignificantChange(prev, current) {
    // Changement significatif si :
    // - Vent change de plus de 10 kt
    // - Visibilité change de plus de 2000m
    // - Couverture nuageuse change de plus de 25%
    
    const prevWindSpeed = this.calculateWindSpeed(prev.u10, prev.v10);
    const currentWindSpeed = this.calculateWindSpeed(current.u10, current.v10);
    
    if (Math.abs(currentWindSpeed - prevWindSpeed) > 10) return true;
    if (Math.abs(current.vis - prev.vis) > 2000) return true;
    if (Math.abs(current.tcc - prev.tcc) > 25) return true;
    
    return false;
  }

  // Gestion du cache
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  // Génération de données mock pour les tests
  generateMockData(lat, lon, params, model) {
    const now = new Date();
    const forecast = [];
    
    // Générer 8 échéances de prévision (24h par pas de 3h)
    for (let i = 0; i < 8; i++) {
      const time = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);
      const hour = time.getHours();
      
      // Variation réaliste selon l'heure
      const tempVariation = Math.sin((hour - 6) * Math.PI / 12) * 10;
      const baseTemp = 288 + tempVariation; // 15°C de base
      
      const forecastData = {
        time: time.toISOString(),
        // Paramètres de surface
        t: baseTemp + Math.random() * 2 - 1, // Température
        psl: 101300 + Math.random() * 200 - 100, // Pression
        r: 65 + Math.random() * 20, // Humidité
        u10: -5 + Math.random() * 10, // Vent U
        v10: -10 + Math.random() * 20, // Vent V
        vis: 8000 + Math.random() * 4000, // Visibilité
        tcc: Math.random() * 60 + 20, // Couverture nuageuse
        tp: Math.random() < 0.3 ? Math.random() * 5 : 0, // Précipitations
      };
      
      // Ajouter les paramètres demandés
      params.forEach(param => {
        if (!(param in forecastData)) {
          if (param.includes('altitude') || param.includes('_')) {
            // Paramètres en altitude
            forecastData[param] = this.generateAltitudeValue(param);
          }
        }
      });
      
      forecast.push(forecastData);
    }
    
    return {
      model: model,
      location: { lat, lon },
      forecast: forecast,
      generated: now.toISOString(),
      notice: "Données de démonstration - Ne pas utiliser pour un vol réel"
    };
  }

  generateAltitudeValue(param) {
    // Générer des valeurs réalistes pour les paramètres en altitude
    if (param.includes('u_')) {
      return -10 - Math.random() * 30; // Vent U plus fort en altitude
    }
    if (param.includes('v_')) {
      return -20 - Math.random() * 40; // Vent V plus fort en altitude
    }
    if (param.includes('t_')) {
      return 250 + Math.random() * 10; // Température plus froide en altitude
    }
    if (param.includes('r_')) {
      return 30 + Math.random() * 20; // Humidité plus faible en altitude
    }
    return Math.random() * 100;
  }
}

// Export d'une instance unique
export const weatherService = new WeatherService();

// Store Zustand pour gérer l'état global de la météo (optionnel)
export const useWeatherStore = create((set, get) => ({
  apiKey: null,
  currentWeather: null,
  forecasts: {},
  
  // Actions
  setApiKey: (key) => set({ apiKey: key }),
  
  updateWeather: (icao, weather) => set((state) => ({
    currentWeather: { ...state.currentWeather, [icao]: weather }
  })),
  
  updateForecast: (icao, forecast) => set((state) => ({
    forecasts: { ...state.forecasts, [icao]: forecast }
  })),
  
  clearWeatherData: () => set({
    currentWeather: null,
    forecasts: {}
  })
}));