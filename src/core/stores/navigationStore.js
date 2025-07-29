// src/core/stores/navigationStore.js
export const useNavigationStore = create(
  immer((set, get) => ({
    // État
    waypoints: [
      { id: 1, name: 'LFPN', type: 'departure', lat: 48.9833, lon: 2.5333 },
      { id: 2, name: 'LFPT', type: 'arrival', lat: 48.7333, lon: 2.3833 }
    ],
    flightParams: {
      altitude: 3000,
      trueAirspeed: 150,
      windDirection: 270,
      windSpeed: 15
    },
    flightType: {
      period: 'jour',
      rules: 'VFR',
      category: 'navigation'
    },
    
    // Actions
    setWaypoints: (waypoints) => set(state => {
      state.waypoints = waypoints;
    }),
    
    addWaypoint: (waypoint) => set(state => {
      state.waypoints.push({
        ...waypoint,
        id: Date.now()
      });
    }),
    
    updateWaypoint: (id, updates) => set(state => {
      const index = state.waypoints.findIndex(wp => wp.id === id);
      if (index !== -1) {
        Object.assign(state.waypoints[index], updates);
      }
    }),
    
    removeWaypoint: (id) => set(state => {
      state.waypoints = state.waypoints.filter(wp => wp.id !== id);
    }),
    
    setFlightParams: (params) => set(state => {
      Object.assign(state.flightParams, params);
    }),
    
    setFlightType: (type) => set(state => {
      Object.assign(state.flightType, type);
    }),
    
    // Méthodes de calcul (pures, sans effet de bord)
    calculateTotalDistance: () => {
      const waypoints = get().waypoints;
      let total = 0;
      
      for (let i = 0; i < waypoints.length - 1; i++) {
        const distance = calculateDistance(
          waypoints[i].lat, waypoints[i].lon,
          waypoints[i + 1].lat, waypoints[i + 1].lon
        );
        total += distance;
      }
      
      return total;
    },
    
    calculateFlightTime: (groundSpeed) => {
      const distance = get().calculateTotalDistance();
      return distance / groundSpeed; // en heures
    },
    
    calculateFuelRequired: (fuelConsumption) => {
      const flightTime = get().calculateFlightTime(get().flightParams.trueAirspeed);
      return flightTime * fuelConsumption;
    },
    
    getRegulationReserveMinutes: () => {
      const { flightType } = get();
      const ifrAdditional = flightType.rules === 'IFR' ? 15 : 0;
      
      if (flightType.period === 'nuit') {
        return 45 + ifrAdditional;
      } else if (flightType.category === 'local') {
        return 10 + ifrAdditional;
      } else {
        return 30 + ifrAdditional;
      }
    },
    
    getRegulationReserveLiters: (fuelConsumption) => {
      const minutes = get().getRegulationReserveMinutes();
      return (minutes / 60) * fuelConsumption;
    }
  }))
);

// Fonction utilitaire de calcul de distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Rayon terre en nautiques
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}