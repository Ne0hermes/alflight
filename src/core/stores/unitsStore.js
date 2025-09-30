// src/core/stores/unitsStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Store pour la gestion des préférences d'unités
export const useUnitsStore = create(
  persist(
    (set, get) => ({
      // État des préférences d'unités
      units: {
        // Distance et longueur
        distance: 'nm',        // nm (nautical miles), km, mi (statute miles)
        altitude: 'ft',        // ft (feet), m (meters), FL (flight level)
        runway: 'm',           // m (meters), ft (feet)
        visibility: 'km',      // km, sm (statute miles), m (meters)
        
        // Vitesse
        speed: 'kt',           // kt (knots), km/h, mph, m/s
        windSpeed: 'kt',       // kt (knots), km/h, mph, m/s
        
        // Poids et masse
        weight: 'kg',          // kg, lbs (pounds)
        fuel: 'ltr',           // ltr (liters), gal (gallons), kg, lbs
        
        // Pression
        pressure: 'hPa',       // hPa (hectopascals), inHg (inches of mercury), mb (millibars)
        
        // Température
        temperature: 'C',      // C (Celsius), F (Fahrenheit)
        
        // Consommation
        fuelConsumption: 'lph', // lph (liters per hour), gph (gallons per hour)
        
        // Bras de levier
        armLength: 'mm',       // mm (millimeters), cm (centimeters), m (meters), in (inches)
        
        // Format de coordonnées
        coordinates: 'dms',    // dms (degrees minutes seconds), dd (decimal degrees)
        
        // Format de temps
        timeFormat: '24h',     // 24h, 12h (AM/PM)
      },
      
      // Actions pour modifier les préférences
      setUnit: (category, unit) => {
        set((state) => ({
          units: {
            ...state.units,
            [category]: unit
          }
        }));
      },
      
      setUnits: (units) => {
        set({ units });
      },
      
      // Préréglages par région/standard
      setPreset: (preset) => {
        const presets = {
          'europe': {
            distance: 'nm',
            altitude: 'ft',
            runway: 'm',
            visibility: 'km',
            speed: 'kt',
            windSpeed: 'kt',
            weight: 'kg',
            fuel: 'ltr',
            pressure: 'hPa',
            temperature: 'C',
            fuelConsumption: 'lph',
            armLength: 'mm',
            coordinates: 'dms',
            timeFormat: '24h'
          },
          'usa': {
            distance: 'nm',
            altitude: 'ft',
            runway: 'ft',
            visibility: 'sm',
            speed: 'kt',
            windSpeed: 'kt',
            weight: 'lbs',
            fuel: 'gal',
            pressure: 'inHg',
            temperature: 'C',
            fuelConsumption: 'gph',
            armLength: 'in',
            coordinates: 'dms',
            timeFormat: '12h'
          },
          'metric': {
            distance: 'km',
            altitude: 'm',
            runway: 'm',
            visibility: 'km',
            speed: 'km/h',
            windSpeed: 'km/h',
            weight: 'kg',
            fuel: 'ltr',
            pressure: 'hPa',
            temperature: 'C',
            fuelConsumption: 'lph',
            armLength: 'cm',
            coordinates: 'dd',
            timeFormat: '24h'
          },
          'aviation': {
            distance: 'nm',
            altitude: 'ft',
            runway: 'm',
            visibility: 'km',
            speed: 'kt',
            windSpeed: 'kt',
            weight: 'kg',
            fuel: 'kg',
            pressure: 'hPa',
            temperature: 'C',
            fuelConsumption: 'lph',
            armLength: 'mm',
            coordinates: 'dms',
            timeFormat: '24h'
          }
        };
        
        if (presets[preset]) {
          set({ units: presets[preset] });
        }
      },
      
      // Réinitialiser aux valeurs par défaut (Europe/Aviation)
      resetToDefault: () => {
        get().setPreset('europe');
      }
    }),
    {
      name: 'units-preferences',
      storage: createJSONStorage(() => localStorage)
    }
  )
);

// Sélecteurs pour un accès facile
export const unitsSelectors = {
  // Obtenir toutes les unités
  useUnits: () => useUnitsStore(state => state.units),
  
  // Obtenir une unité spécifique
  useUnit: (category) => useUnitsStore(state => state.units[category]),
  
  // Actions
  useUnitsActions: () => useUnitsStore(state => ({
    setUnit: state.setUnit,
    setUnits: state.setUnits,
    setPreset: state.setPreset,
    resetToDefault: state.resetToDefault
  }))
};