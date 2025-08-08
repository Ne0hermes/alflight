// src/core/stores/openAIPStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { openAIPService } from '@services/openAIPService';
import { useVACStore } from './vacStore';

export const useOpenAIPStore = create(
  immer((set, get) => ({
    // État
    airports: [],
    airspaces: [],
    navaids: [],
    reportingPoints: {}, // { [icao]: [...points] }
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
    coordinateValidation: {}, // { [pointId]: { isValid, diff } }
    
    // Actions
    loadAirports: async (countryCode = 'FR') => {
      set(state => {
        state.loading.airports = true;
        state.errors.airports = null;
      });
      
      try {
        console.log('🛩️ Chargement des aérodromes OpenAIP...');
        const airports = await openAIPService.getAirports(countryCode);
        
        set(state => {
          state.airports = airports;
          state.loading.airports = false;
        });
        
        console.log(`✅ ${airports.length} aérodromes chargés`);
        
        // Charger aussi tous les points de report
        get().loadAllReportingPoints(countryCode);
        
      } catch (error) {
        set(state => {
          state.errors.airports = error.message;
          state.loading.airports = false;
        });
      }
    },
    
    loadAirspaces: async (countryCode = 'FR') => {
      set(state => {
        state.loading.airspaces = true;
        state.errors.airspaces = null;
      });
      
      try {
        console.log('🔶 Chargement des espaces aériens OpenAIP...');
        const airspaces = await openAIPService.getAirspaces(countryCode);
        
        set(state => {
          state.airspaces = airspaces;
          state.loading.airspaces = false;
        });
        
        console.log(`✅ ${airspaces.length} espaces aériens chargés`);
        
      } catch (error) {
        console.warn('Erreur chargement espaces aériens:', error);
        set(state => {
          state.errors.airspaces = error.message;
          state.loading.airspaces = false;
        });
      }
    },
    
    loadNavaids: async (countryCode = 'FR') => {
      set(state => {
        state.loading.navaids = true;
        state.errors.navaids = null;
      });
      
      try {
        console.log('📡 Chargement des balises de navigation OpenAIP...');
        const navaids = await openAIPService.getNavaids(countryCode);
        
        set(state => {
          state.navaids = navaids;
          state.loading.navaids = false;
        });
        
        console.log(`✅ ${navaids.length} balises de navigation chargées`);
        
      } catch (error) {
        console.warn('Erreur chargement balises:', error);
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
        const pointsByAirport = await openAIPService.getAllReportingPoints(countryCode);
        
        set(state => {
          state.reportingPoints = pointsByAirport;
          state.loading.reportingPoints = false;
        });
        
        const totalPoints = Object.values(pointsByAirport).reduce((sum, points) => sum + points.length, 0);
        console.log(`✅ ${totalPoints} points de report chargés pour ${Object.keys(pointsByAirport).length} aérodromes`);
        
        // Valider automatiquement avec les données VAC
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
    
    // Validation des coordonnées avec VAC
    validateAllPoints: () => {
      const { reportingPoints } = get();
      const vacCharts = useVACStore.getState().charts;
      const validationResults = {};
      
      Object.entries(reportingPoints).forEach(([icao, points]) => {
        const vacChart = vacCharts[icao];
        
        if (vacChart?.isDownloaded && vacChart.extractedData?.reportingPoints) {
          // Comparer avec les points VAC
          points.forEach(openAipPoint => {
            const vacPoint = vacChart.extractedData.reportingPoints.find(
              vp => vp.code === openAipPoint.code || vp.name === openAipPoint.name
            );
            
            if (vacPoint) {
              const comparison = openAIPService.compareCoordinates(
                openAipPoint.coordinates,
                vacPoint.coordinates,
                0.001 // Tolérance de 0.001° (~110m)
              );
              
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
    
    // Sélecteurs
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
      
      // Vérifier s'il y a des divergences de coordonnées
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
    
    // Recherche de l'aérodrome le plus proche
    getNearestAirport: (coordinates) => {
      const { airports } = get();
      if (!airports.length) return null;
      
      let nearest = null;
      let minDistance = Infinity;
      
      airports.forEach(airport => {
        const distance = openAIPService.calculateDistance(
          coordinates,
          airport.coordinates
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = airport;
        }
      });
      
      return { airport: nearest, distance: minDistance };
    },
    
    // Export/Import pour backup
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
        
        // Revalider avec les VAC actuelles
        get().validateAllPoints();
      }
    }
  }))
);

// Sélecteurs optimisés
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