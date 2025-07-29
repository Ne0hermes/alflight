// src/modules/weather/services/weatherService.js
import { create } from 'zustand';

// Configuration des API Météo-France
const METEO_FRANCE_CONFIG = {
  AROME: {
    baseUrl: 'https://portail-api.meteofrance.fr/public/arome',
    coverage: 'france',
    resolution: 1.3, // km
    forecast: 42 // heures
  },
  ARPEGE: {
    baseUrl: 'https://portail-api.meteofrance.fr/public/arpege',
    coverage: 'global',
    resolution: 10, // km en Europe
    forecast: 114 // heures
  }
};

// Types de paramètres météo disponibles - Constants pour éviter la recréation
const WEATHER_PARAMS = Object.freeze({
  SURFACE: Object.freeze({
    temperature: 't',
    pressure: 'psl',
    humidity: 'r',
    precipitation: 'tp',
    cloudCover: 'tcc',
    visibility: 'vis',
    windU: 'u10',
    windV: 'v10',
  }),
  ALTITUDE: Object.freeze({
    temperature: 't_altitude',
    humidity: 'r_altitude',
    windU: 'u_altitude',
    windV: 'v_altitude',
    geopotential: 'z'
  }),
  PRESSURE_LEVELS: Object.freeze([1000, 925, 850, 700, 500, 300, 200]),
  ALTITUDE_LEVELS: Object.freeze({
    1000: 0,
    925: 2500,
    850: 5000,
    700: 10000,
    500: 18000,
    300: 30000,
    200: 39000
  })
});

// Cache singleton optimisé
class WeatherCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  getKey(type, lat, lon, params = []) {
    return `${type}_${lat}_${lon}_${params.sort().join('_')}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key, data) {
    // Limiter la taille du cache
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

class WeatherService {
  constructor() {
    this.apiKey = null;
    this.cache = new WeatherCache();
    // Pré-calculer les paramètres de surface pour éviter la recréation
    this.surfaceParams = Object.values(WEATHER_PARAMS.SURFACE);
  }

  // Configuration de la clé API
  setApiKey(key) {
    this.apiKey = key;
  }

  // Récupération des données AROME optimisée
  async getAROMEForecast(lat, lon, params = []) {
    const cacheKey = this.cache.getKey('arome', lat, lon, params);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Mode démo sans clé API
    if (!this.apiKey || this.apiKey === 'demo') {
      const mockData = this.generateMockData(lat, lon, params, 'AROME');
      this.cache.set(cacheKey, mockData);
      return mockData;
    }

    try {
      const url = new URL(`${METEO_FRANCE_CONFIG.AROME.baseUrl}/1.0/forecast`);
      url.searchParams.append('lat', lat);
      url.searchParams.append('lon', lon);
      url.searchParams.append('params', params.join(','));
      url.searchParams.append('apikey', this.apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Erreur API AROME: ${response.status}`);
      }

      const data = await response.json();
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Erreur récupération AROME:', error);
      const mockData = this.generateMockData(lat, lon, params, 'AROME');
      this.cache.set(cacheKey, mockData);
      return mockData;
    }
  }

  // Récupération des données ARPEGE optimisée
  async getARPEGEForecast(lat, lon, params = []) {
    const cacheKey = this.cache.getKey('arpege', lat, lon, params);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Mode démo sans clé API
    if (!this.apiKey || this.apiKey === 'demo') {
      const mockData = this.generateMockData(lat, lon, params, 'ARPEGE');
      this.cache.set(cacheKey, mockData);
      return mockData;
    }

    try {
      const url = new URL(`${METEO_FRANCE_CONFIG.ARPEGE.baseUrl}/1.0/forecast`);
      url.searchParams.append('lat', lat);
      url.searchParams.append('lon', lon);
      url.searchParams.append('params', params.join(','));
      url.searchParams.append('apikey', this.apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Erreur API ARPEGE: ${response.status}`);
      }

      const data = await response.json();
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Erreur récupération ARPEGE:', error);
      const mockData = this.generateMockData(lat, lon, params, 'ARPEGE');
      this.cache.set(cacheKey, mockData);
      return mockData;
    }
  }

  // Récupération des vents en altitude pour un niveau de vol
  async getWindsAloft(lat, lon, flightLevel) {
    const pressureLevel = this.flightLevelToPressure(flightLevel);
    
    try {
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
      const data = await this.getAROMEForecast(lat, lon, this.surfaceParams);
      return this.processAirportWeather(data, icaoCode);
    } catch (error) {
      console.error(`Erreur météo aéroport ${icaoCode}:`, error);
      return null;
    }
  }

  // Génération d'un METAR simulé optimisée
  generateMETAR(weatherData, icaoCode) {
    if (!weatherData) return null;

    const date = new Date();
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hour = date.getUTCHours().toString().padStart(2, '0');
    const minute = date.getUTCMinutes().toString().padStart(2, '0');

    // Conversion des données
    const temp = Math.round(weatherData.temperature - 273.15);
    const dewpoint = this.calculateDewpoint(weatherData.temperature, weatherData.humidity);
    const pressure = Math.round(weatherData.pressure / 100);
    const windDir = this.calculateWindDirection(weatherData.windU, weatherData.windV);
    const windSpeed = this.calculateWindSpeed(weatherData.windU, weatherData.windV);
    const visibility = Math.round(weatherData.visibility);
    
    // Construction du METAR avec string template
    const windStr = windSpeed < 1 ? '00000KT' : `${windDir.toString().padStart(3, '0')}${windSpeed.toString().padStart(2, '0')}KT`;
    const visStr = visibility >= 10000 ? '9999' : visibility.toString().padStart(4, '0');
    
    let phenomena = '';
    if (weatherData.precipitation > 0.1) {
      phenomena = temp > 0 ? 'RA ' : 'SN ';
    }
    
    const cloudCover = weatherData.cloudCover;
    let clouds = '';
    if (cloudCover < 12.5) clouds = 'SKC';
    else if (cloudCover < 37.5) clouds = 'FEW030';
    else if (cloudCover < 62.5) clouds = 'SCT040';
    else if (cloudCover < 87.5) clouds = 'BKN050';
    else clouds = 'OVC060';
    
    return `${icaoCode} ${day}${hour}${minute}Z ${windStr} ${visStr} ${phenomena}${clouds} ${temp.toString().padStart(2, '0')}/${dewpoint.toString().padStart(2, '0')} Q${pressure}`;
  }

  // Génération d'un TAF simplifié optimisée
  generateTAF(forecastData, icaoCode) {
    if (!forecastData || !forecastData.length) return null;

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    
    let taf = `TAF ${icaoCode} ${this.formatTAFDate(startDate)} ${this.formatTAFPeriod(startDate, endDate)} `;
    
    const mainForecast = forecastData[0];
    taf += this.formatTAFConditions(mainForecast);
    
    // Limiter à 4 changements significatifs
    const maxChanges = Math.min(forecastData.length, 4);
    for (let i = 1; i < maxChanges; i++) {
      const forecast = forecastData[i];
      const prevForecast = forecastData[i - 1];
      
      if (this.isSignificantChange(prevForecast, forecast)) {
        const changeTime = new Date(startDate.getTime() + i * 6 * 60 * 60 * 1000);
        taf += ` BECMG ${this.formatTAFTime(changeTime)} ${this.formatTAFConditions(forecast)}`;
      }
    }
    
    return taf;
  }

  // Méthodes utilitaires optimisées
  isInFrance(lat, lon) {
    return lat >= 41 && lat <= 51.5 && lon >= -5.5 && lon <= 10;
  }

  flightLevelToPressure(fl) {
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
    return Math.round(Math.sqrt(u * u + v * v) * 1.94384);
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
    
    const forecast = data.forecast[0];
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
    const forecast = data.forecast.slice(0, 8);
    
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
    
    const windStr = windSpeed < 1 ? '00000KT' : `${windDir.toString().padStart(3, '0')}${windSpeed.toString().padStart(2, '0')}KT`;
    const visStr = visibility >= 10000 ? '9999' : visibility.toString().padStart(4, '0');
    
    const cloudCover = forecast.tcc;
    let clouds = '';
    if (cloudCover < 12.5) clouds = 'SKC';
    else if (cloudCover < 37.5) clouds = 'FEW030';
    else if (cloudCover < 62.5) clouds = 'SCT040';
    else if (cloudCover < 87.5) clouds = 'BKN050';
    else clouds = 'OVC060';
    
    return `${windStr} ${visStr} ${clouds}`;
  }

  isSignificantChange(prev, current) {
    const prevWindSpeed = this.calculateWindSpeed(prev.u10, prev.v10);
    const currentWindSpeed = this.calculateWindSpeed(current.u10, current.v10);
    
    return Math.abs(currentWindSpeed - prevWindSpeed) > 10 ||
           Math.abs(current.vis - prev.vis) > 2000 ||
           Math.abs(current.tcc - prev.tcc) > 25;
  }

  // Génération de données mock optimisée
  generateMockData(lat, lon, params, model) {
    const now = new Date();
    const forecast = [];
    
    // Pré-calculer les valeurs de base
    const baseTemp = 288;
    const basePressure = 101300;
    const baseHumidity = 65;
    const baseWindU = -5;
    const baseWindV = -10;
    const baseVisibility = 8000;
    const baseCloudCover = 40;
    
    for (let i = 0; i < 8; i++) {
      const time = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);
      const hour = time.getHours();
      
      const tempVariation = Math.sin((hour - 6) * Math.PI / 12) * 10;
      
      const forecastData = {
        time: time.toISOString(),
        t: baseTemp + tempVariation + (Math.random() * 2 - 1),
        psl: basePressure + (Math.random() * 200 - 100),
        r: baseHumidity + Math.random() * 20,
        u10: baseWindU + Math.random() * 10,
        v10: baseWindV + Math.random() * 20,
        vis: baseVisibility + Math.random() * 4000,
        tcc: baseCloudCover + Math.random() * 40 - 20,
        tp: Math.random() < 0.3 ? Math.random() * 5 : 0,
      };
      
      // Ajouter les paramètres demandés
      params.forEach(param => {
        if (!(param in forecastData) && (param.includes('altitude') || param.includes('_'))) {
          forecastData[param] = this.generateAltitudeValue(param);
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
    if (param.includes('u_')) return -10 - Math.random() * 30;
    if (param.includes('v_')) return -20 - Math.random() * 40;
    if (param.includes('t_')) return 250 + Math.random() * 10;
    if (param.includes('r_')) return 30 + Math.random() * 20;
    return Math.random() * 100;
  }
}

// Export d'une instance unique
export const weatherService = new WeatherService();

// Store Zustand optimisé
export const useWeatherStore = create((set, get) => ({
  apiKey: null,
  currentWeather: null,
  forecasts: {},
  
  setApiKey: (key) => {
    weatherService.setApiKey(key);
    set({ apiKey: key });
  },
  
  updateWeather: (icao, weather) => set((state) => ({
    currentWeather: { ...state.currentWeather, [icao]: weather }
  })),
  
  updateForecast: (icao, forecast) => set((state) => ({
    forecasts: { ...state.forecasts, [icao]: forecast }
  })),
  
  clearWeatherData: () => {
    weatherService.cache.clear();
    set({
      currentWeather: null,
      forecasts: {}
    });
  }
}));