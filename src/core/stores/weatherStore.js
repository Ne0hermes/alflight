// src/core/stores/weatherStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { weatherAPI } from '@services/weatherAPI';

// 🔧 LOT 6-C — Fusionne une saisie MANUELLE (vent/température/QNH) avec la
// météo API, en FORME METAR decoded : le résultat traverse useActiveRunwayWind
// et PerformanceModule sans aucune modification aval. Helper PUR exporté
// (utilisable dans les composants avec abonnement React).
// @param base weatherData[icao] | undefined
// @param override manualOverrides[icao] | undefined
// @returns weather effectif | base | undefined
export function mergeManualWeather(base, override) {
  if (!override) return base;
  const baseDecoded = base?.metar?.decoded || {
    station: override.icao || null,
    time: null,
    visibility: null,
    clouds: [],
    dewpoint: null
  };
  return {
    ...(base || {}),
    icao: base?.icao || override.icao,
    timestamp: override.updatedAt || base?.timestamp || null,
    isManual: true,
    manualFields: ['wind', 'temperature', 'qnh'].filter(k =>
      k === 'wind' ? !!override.wind : override[k] != null
    ),
    taf: base?.taf ?? null,
    metar: {
      raw: base?.metar?.raw || `SAISIE MANUELLE ${override.icao || ''}`.trim(),
      time: base?.metar?.time ?? null,
      decoded: {
        ...baseDecoded,
        ...(override.wind
          ? { wind: { direction: override.wind.direction, speed: override.wind.speed, gust: null } }
          : {}),
        ...(override.temperature != null ? { temperature: override.temperature } : {}),
        // ⚠️ le champ decoded s'appelle `pressure` (hPa), pas `qnh`
        ...(override.qnh != null ? { pressure: override.qnh } : {})
      }
    }
  };
}

// Store Zustand pour la météo (version corrigée sans Map/Set)
export const useWeatherStore = create(
  immer((set, get) => ({
    // État (utilisation d'objets au lieu de Map/Set pour compatibilité Immer)
    weatherData: {}, // Object<icao, weatherInfo>
    loading: {}, // Object<icao, boolean>
    errors: {}, // Object<icao, error>
    lastUpdate: {}, // Object<icao, timestamp>
    autoRefreshInterval: 30 * 60 * 1000, // 30 minutes
    // 🔧 LOT 6-C — saisies MANUELLES par aérodrome (terrains non contrôlés) :
    // Object<icao, { icao, wind:{direction,speed}|null, temperature|null,
    // qnh|null, updatedAt }>. Prioritaire sur l'API via getEffectiveWeather.
    // Survit aux refresh METAR (clearWeather/clearAll n'y touchent pas).
    manualOverrides: {},
    
    // Actions
    fetchWeather: async (icao) => {
      const upperIcao = icao.toUpperCase();
      
            
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

        console.log('✅ Weather fetched for ' + upperIcao + ': ' + metar?.raw?.substring(0, 50) + '...');

        set(state => {
          state.weatherData[upperIcao] = {
            icao: upperIcao,
            metar,
            taf,
            timestamp: Date.now()
          };
          state.lastUpdate[upperIcao] = Date.now();
          delete state.loading[upperIcao];
          // 🔧 A5 — Plus de météo fabriquée : METAR indisponible ⇒ erreur explicite
          // (l'UI affiche « Météo non disponible » au lieu d'un faux METAR).
          if (!metar || !metar.decoded) {
            state.errors[upperIcao] = 'Météo non disponible';
          }
        });

        return !!(metar && metar.decoded);
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
    
    // 🔧 LOT 6-C — saisie météo manuelle par aérodrome
    setManualWeather: (icao, values) => set(state => {
      const upperIcao = icao?.toUpperCase();
      if (!upperIcao) return;
      const prev = state.manualOverrides[upperIcao] || {};
      state.manualOverrides[upperIcao] = {
        ...prev,
        ...values,
        icao: upperIcao,
        updatedAt: Date.now()
      };
    }),

    clearManualWeather: (icao) => set(state => {
      const upperIcao = icao?.toUpperCase();
      if (upperIcao) delete state.manualOverrides[upperIcao];
    }),

    // 🔧 REVUE 6-C — purge GLOBALE aux frontières de vol (nouvelle préparation,
    // clôture, annulation) : sans elle, la saisie du vol A s'appliquait
    // silencieusement au vol B (météo d'un autre vol = météo fabriquée, A5)
    clearAllManualWeather: () => set(state => {
      state.manualOverrides = {};
    }),

    // Hydratation depuis un brouillon restauré (le store n'est pas persisté).
    // 🔧 REVUE 6-C — REMPLACE l'état au lieu de fusionner : l'hydratation
    // représente l'état complet du brouillon, pas un delta (sinon un brouillon
    // sans saisie hériterait des saisies du vol précédent)
    setManualWeatherBulk: (map) => set(state => {
      state.manualOverrides = {};
      if (map && typeof map === 'object') {
        Object.entries(map).forEach(([icao, values]) => {
          if (values) state.manualOverrides[icao.toUpperCase()] = { ...values, icao: icao.toUpperCase() };
        });
      }
    }),

    // Météo EFFECTIVE (manuel > API) en forme METAR decoded
    getEffectiveWeather: (icao) => {
      const upperIcao = icao?.toUpperCase();
      if (!upperIcao) return undefined;
      const state = get();
      return mergeManualWeather(state.weatherData[upperIcao], state.manualOverrides[upperIcao]);
    },

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
    (a, b) => Object.is(a, b))
};