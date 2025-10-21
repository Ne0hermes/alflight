// src/core/stores/navigationStore.js
// Version avec Zustand pour être cohérent avec aircraft-storage, etc.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Fonction de calcul des résultats de navigation
const calculateNavigationResults = (waypoints, flightType, selectedAircraft) => {
  if (!selectedAircraft || !waypoints || waypoints.length < 2) {
    return null;
  }

  const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
  if (validWaypoints.length < 2) {
    return null;
  }

  let totalDistance = 0;
  const legs = [];

  for (let i = 0; i < validWaypoints.length - 1; i++) {
    const wp1 = validWaypoints[i];
    const wp2 = validWaypoints[i + 1];
    
    const R = 3440.065;
    const dLat = (wp2.lat - wp1.lat) * Math.PI / 180;
    const dLon = (wp2.lon - wp1.lon) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(wp1.lat * Math.PI / 180) * Math.cos(wp2.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    totalDistance += distance;
    
    const y = Math.sin(dLon) * Math.cos(wp2.lat * Math.PI / 180);
    const x = Math.cos(wp1.lat * Math.PI / 180) * Math.sin(wp2.lat * Math.PI / 180) -
              Math.sin(wp1.lat * Math.PI / 180) * Math.cos(wp2.lat * Math.PI / 180) * Math.cos(dLon);
    const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    
    legs.push({
      from: wp1.name || `WP${i+1}`,
      to: wp2.name || `WP${i+2}`,
      distance: distance,
      heading: Math.round(heading)
    });
  }

  const cruiseSpeed = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100;
  const totalTime = totalDistance > 0 ? Math.round((totalDistance / cruiseSpeed) * 60) : 0;
  const fuelConsumption = selectedAircraft.fuelConsumption || 30;
  const fuelRequired = totalTime > 0 ? (totalTime / 60) * fuelConsumption : 0;

  let regulationReserveMinutes = 30;
  if (flightType.period === 'nuit') regulationReserveMinutes = 45;
  if (flightType.rules === 'IFR') regulationReserveMinutes += 15;
  if (flightType.category === 'local' && flightType.period === 'jour') regulationReserveMinutes = 20;

  const regulationReserveLiters = (regulationReserveMinutes / 60) * fuelConsumption;

  return {
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalTime,
    fuelRequired: Math.round(fuelRequired * 10) / 10,
    regulationReserveMinutes,
    regulationReserveLiters: Math.round(regulationReserveLiters * 10) / 10,
    cruiseSpeed,
    fuelConsumption,
    legs
  };
};

// Store Zustand
export const useNavigationStore = create(
  persist(
    (set, get) => ({
      // États
      waypoints: [
        { id: 1, name: '', lat: null, lon: null, type: 'departure' },
        { id: 2, name: '', lat: null, lon: null, type: 'arrival' }
      ],
      
      flightType: {
        period: 'jour',
        rules: 'VFR',
        category: 'navigation'
      },
      
      flightParams: {
        altitude: 3000,
        speed: 100,
        heading: 0
      },
      
      // Altitudes par segment (clé: "waypointId1-waypointId2")
      segmentAltitudes: {},

      // Actions
      setWaypoints: (waypoints) => set({ waypoints }),
      
      setSegmentAltitude: (segmentId, altitudeData) => {
        set(state => ({
          segmentAltitudes: {
            ...state.segmentAltitudes,
            [segmentId]: altitudeData
          }
        }));
      },
      
      getSegmentAltitude: (segmentId) => {
        const state = get();
        return state.segmentAltitudes[segmentId] || {
          startAlt: state.flightParams.altitude,
          endAlt: state.flightParams.altitude,
          type: 'level'
        };
      },
      
      setFlightType: (flightType) => set({ flightType }),
      
      setFlightParams: (flightParams) => set({ flightParams }),
      
      addWaypoint: () => {
        const newWaypoint = {
          id: Date.now(),
          name: '',
          lat: null,
          lon: null,
          type: 'waypoint'
        };
        set(state => ({ 
          waypoints: [...state.waypoints, newWaypoint] 
        }));
      },
      
      removeWaypoint: (id) => {
        const waypoints = get().waypoints;
        if (waypoints.length > 2) {
          set({ waypoints: waypoints.filter(wp => wp.id !== id) });
        }
      },
      
      updateWaypoint: (id, updates) => {
        set(state => ({
          waypoints: state.waypoints.map(wp =>
            wp.id === id ? { ...wp, ...updates } : wp
          )
        }));
      },
      
      clearRoute: () => {
        set({
          waypoints: [
            { id: Date.now(), name: '', lat: null, lon: null, type: 'departure' },
            { id: Date.now() + 1, name: '', lat: null, lon: null, type: 'arrival' }
          ]
        });
      },

      // Déplacer un waypoint vers le haut
      moveWaypointUp: (id) => {
        const waypoints = get().waypoints;
        const index = waypoints.findIndex(wp => wp.id === id);

        // Ne pas déplacer si c'est le premier ou si le précédent est le départ
        if (index <= 1) return;

        const newWaypoints = [...waypoints];
        [newWaypoints[index - 1], newWaypoints[index]] = [newWaypoints[index], newWaypoints[index - 1]];
        set({ waypoints: newWaypoints });
      },

      // Déplacer un waypoint vers le bas
      moveWaypointDown: (id) => {
        const waypoints = get().waypoints;
        const index = waypoints.findIndex(wp => wp.id === id);

        // Ne pas déplacer si c'est l'avant-dernier ou dernier (l'arrivée doit rester à la fin)
        if (index >= waypoints.length - 2) return;

        const newWaypoints = [...waypoints];
        [newWaypoints[index], newWaypoints[index + 1]] = [newWaypoints[index + 1], newWaypoints[index]];
        set({ waypoints: newWaypoints });
      },
      
      // Getter pour les résultats (calculé à la volée)
      getNavigationResults: (selectedAircraft) => {
        const state = get();
        return calculateNavigationResults(state.waypoints, state.flightType, selectedAircraft);
      }
    }),
    {
      name: 'navigation-storage',
      version: 0
    }
  )
);