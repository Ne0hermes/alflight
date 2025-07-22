export const NavigationCalculations = {
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 3440.065; // Rayon terre en nautiques
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  },

  calculateTotalDistance: (waypoints) => {
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      total += NavigationCalculations.calculateDistance(
        waypoints[i].lat, waypoints[i].lon,
        waypoints[i+1].lat, waypoints[i+1].lon
      );
    }
    return total;
  },

  calculateFlightTime: (distance, groundSpeed) => distance / groundSpeed,
  
  calculateFuelRequired: (time, consumption) => time * consumption
};