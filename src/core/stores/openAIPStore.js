import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { aeroDataProvider } from '@core/data';
import { useVACStore } from './vacStore';

export const useOpenAIPStore = create(
  immer((set, get) => ({
    airports: [],
    airspaces: [],
    navaids: [],
    reportingPoints: {},
    loading: {
      airports: false,
      airspaces: false,
      navaids: false,
      reportingPoints: false
    },
    errors: {
      airports: null,
      airspaces: null,
      navaids: null,
      reportingPoints: null
    },
    searchQuery: '',
    selectedDeparture: null,
    selectedArrival: null,
    coordinateValidation: {},
    loadAirports: async (countryCode = 'FR') => {
      if (!aeroDataProvider.isAvailable()) {
        set(state => {
          state.airports = [];
          state.errors.airports = 'Service de données aéronautiques non disponible';
          state.loading.airports = false;
        });
        return;
      }
      const state = get();
      const lastLoad = state.lastLoadTime?.airports;
      const cacheValid = lastLoad && Date.now() - lastLoad < 10 * 60 * 1000;
      
      if (state.airports.length > 0 && cacheValid) {
        return;
      }
      
      set(state => {
        state.loading.airports = true;
        state.errors.airports = null;
      });
      
      try {
        const airports = await aeroDataProvider.getAirfields({ country: countryCode });
        
        set(state => {
          state.airports = airports;
          state.loading.airports = false;
          if (!state.lastLoadTime) state.lastLoadTime = {};
          state.lastLoadTime.airports = Date.now();
        });
        get().loadAllReportingPoints(countryCode);
        
      } catch (error) {
        set(state => {
          state.errors.airports = error.message;
          state.loading.airports = false;
        });
      }
    },
    
    loadAirspaces: async (countryCode = 'FR') => {
      if (!aeroDataProvider.isAvailable()) {
        set(state => {
          state.airspaces = [];
          state.errors.airspaces = 'Service de données aéronautiques non disponible';
          state.loading.airspaces = false;
        });
        return;
      }
      const state = get();
      const lastLoad = state.lastLoadTime?.airspaces;
      const cacheValid = lastLoad && Date.now() - lastLoad < 10 * 60 * 1000;
      
      if (state.airspaces.length > 0 && cacheValid) {
        return;
      }
      
      set(state => {
        state.loading.airspaces = true;
        state.errors.airspaces = null;
      });
      
      try {
        const airspaces = await aeroDataProvider.getAirspaces({ country: countryCode });
        
        set(state => {
          state.airspaces = airspaces;
          state.loading.airspaces = false;
          if (!state.lastLoadTime) state.lastLoadTime = {};
          state.lastLoadTime.airspaces = Date.now();
        });
        
      } catch (error) {
        set(state => {
          state.errors.airspaces = error.message;
          state.loading.airspaces = false;
        });
      }
    },
    
    loadNavaids: async (countryCode = 'FR') => {
      if (!aeroDataProvider.isAvailable()) {
        set(state => {
          state.navaids = [];
          state.errors.navaids = 'Service de données aéronautiques non disponible';
          state.loading.navaids = false;
        });
        return;
      }
      const state = get();
      const lastLoad = state.lastLoadTime?.navaids;
      const cacheValid = lastLoad && Date.now() - lastLoad < 10 * 60 * 1000;
      
      if (state.navaids.length > 0 && cacheValid) {
        return;
      }
      
      set(state => {
        state.loading.navaids = true;
        state.errors.navaids = null;
      });
      
      try {
        const navaids = await aeroDataProvider.getNavaids({ country: countryCode });
        
        set(state => {
          state.navaids = navaids;
          state.loading.navaids = false;
          if (!state.lastLoadTime) state.lastLoadTime = {};
          state.lastLoadTime.navaids = Date.now();
        });
        
      } catch (error) {
        set(state => {
          state.errors.navaids = error.message;
          state.loading.navaids = false;
        });
      }
    },
    
    loadAllReportingPoints: async (countryCode = 'FR') => {
      set(state => {
        state.loading.reportingPoints = true;
        state.errors.reportingPoints = null;
      });
      
      try {
        console.log('📍 Chargement des points de report VFR...');
        // Pour l'instant, on charge point par point pour chaque aérodrome
        const airports = get().airports;
        const pointsByAirport = {};
        for (const airport of airports) {
          try {
            const points = await aeroDataProvider.getReportingPoints(airport.icao);
            if (points && points.length > 0) {
              pointsByAirport[airport.icao] = points;
            }
          } catch (err) {
            console.warn(`Erreur chargement points pour ${airport.icao}:`, err);
          }
        }
        
        set(state => {
          state.reportingPoints = pointsByAirport;
          state.loading.reportingPoints = false;
        });
        
        const totalPoints = Object.values(pointsByAirport).reduce((sum, points) => sum + points.length, 0);
        get().validateAllPoints();
        
      } catch (error) {
        set(state => {
          state.errors.reportingPoints = error.message;
          state.loading.reportingPoints = false;
        });
      }
    },
    
    setSelectedDeparture: (airport) => set(state => {
      state.selectedDeparture = airport;
    }),
    
    setSelectedArrival: (airport) => set(state => {
      state.selectedArrival = airport;
    }),
    
    setSearchQuery: (query) => set(state => {
      state.searchQuery = query;
    }),
    validateAllPoints: () => {
      const { reportingPoints } = get();
      const vacCharts = useVACStore.getState().charts;
      const validationResults = {};
      
      Object.entries(reportingPoints).forEach(([icao, points]) => {
        const vacChart = vacCharts[icao];
        
        if (vacChart?.isDownloaded && vacChart.extractedData?.reportingPoints) {
          points.forEach(openAipPoint => {
            const vacPoint = vacChart.extractedData.reportingPoints.find(
              vp => vp.code === openAipPoint.code || vp.name === openAipPoint.name
            );
            
            if (vacPoint) {
              const latDiff = Math.abs(openAipPoint.coordinates.lat - vacPoint.coordinates.lat);
              const lonDiff = Math.abs(openAipPoint.coordinates.lon - vacPoint.coordinates.lon);
              const tolerance = 0.001;
              const comparison = {
                isMatch: latDiff <= tolerance && lonDiff <= tolerance,
                distance: Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000, // Approximation en mètres
                latDiff,
                lonDiff
              };
              
              validationResults[`${icao}_${openAipPoint.code}`] = {
                isValid: comparison.isMatch,
                distance: comparison.distance,
                latDiff: comparison.latDiff,
                lonDiff: comparison.lonDiff,
                openAipCoords: openAipPoint.coordinates,
                vacCoords: vacPoint.coordinates
              };
            }
          });
        }
      });
      
      set(state => {
        state.coordinateValidation = validationResults;
      });
    },
    getAirportByIcao: (icao) => {
      return get().airports.find(a => a.icao === icao);
    },
    
    getReportingPointsForAirport: (icao) => {
      return get().reportingPoints[icao] || [];
    },
    
    getFilteredAirports: () => {
      const { airports, searchQuery } = get();
      if (!searchQuery) return airports;
      
      const query = searchQuery.toLowerCase();
      return airports.filter(airport => 
        airport.icao.toLowerCase().includes(query) ||
        airport.name.toLowerCase().includes(query) ||
        (airport.city && airport.city.toLowerCase().includes(query))
      );
    },
    
    getVacStatus: (icao) => {
      const vacCharts = useVACStore.getState().charts;
      const vacChart = vacCharts[icao];
      
      if (!vacChart) return { status: 'not_available', icon: '❓' };
      if (!vacChart.isDownloaded) return { status: 'not_downloaded', icon: '⚠️' };
      const validation = get().coordinateValidation;
      const airportValidations = Object.entries(validation)
        .filter(([key]) => key.startsWith(icao))
        .map(([, val]) => val);
      
      const hasDiscrepancy = airportValidations.some(v => !v.isValid);
      
      if (hasDiscrepancy) {
        return { status: 'discrepancy', icon: '❗' };
      }
      
      return { status: 'ok', icon: '✅' };
    },
    getNearestAirport: (coordinates) => {
      const { airports } = get();
      if (!airports.length) return null;
      
      let nearest = null;
      let minDistance = Infinity;
      
      airports.forEach(airport => {
        const R = 6371;
        const dLat = (airport.coordinates.lat - coordinates.lat) * Math.PI / 180;
        const dLon = (airport.coordinates.lon - coordinates.lon) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(coordinates.lat * Math.PI / 180) * Math.cos(airport.coordinates.lat * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = airport;
        }
      });
      
      return { airport: nearest, distance: minDistance };
    },
    exportData: () => {
      const { airports, reportingPoints } = get();
      return {
        airports,
        reportingPoints,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
    },
    
    importData: (data) => {
      if (data.version === '1.0') {
        set(state => {
          state.airports = data.airports || [];
          state.reportingPoints = data.reportingPoints || {};
        });
        get().validateAllPoints();
      }
    }
  }))
);

export const openAIPSelectors = {
  useAirports: () => useOpenAIPStore(state => state.airports),
  useFilteredAirports: () => useOpenAIPStore(state => state.getFilteredAirports()),
  useSelectedDeparture: () => useOpenAIPStore(state => state.selectedDeparture),
  useSelectedArrival: () => useOpenAIPStore(state => state.selectedArrival),
  useReportingPoints: (icao) => useOpenAIPStore(state => state.getReportingPointsForAirport(icao)),
  useVacStatus: (icao) => useOpenAIPStore(state => state.getVacStatus(icao)),
  useLoading: () => useOpenAIPStore(state => state.loading),
  useErrors: () => useOpenAIPStore(state => state.errors)
};