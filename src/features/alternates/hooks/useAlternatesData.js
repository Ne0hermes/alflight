// src/features/navigation/hooks/useAlternatesData.js
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useNavigation } from '@core/contexts';
import { useCallback } from 'react';

export const useAlternatesData = () => {
  const { selectedAlternates } = useAlternatesStore();
  const { waypoints, setWaypoints } = useNavigation();
  
  const addAlternateAsWaypoint = useCallback((alternate) => {
    // Créer un waypoint depuis l'alternate
    const newWaypoint = {
      id: Date.now(),
      name: alternate.icao,
      type: 'alternate',
      lat: alternate.position.lat,
      lon: alternate.position.lon,
      elevation: alternate.elevation,
      airportName: alternate.name
    };
    
    // Insérer avant la destination finale
    const newWaypoints = [...waypoints];
    newWaypoints.splice(waypoints.length - 1, 0, newWaypoint);
    setWaypoints(newWaypoints);
  }, [waypoints, setWaypoints]);
  
  return {
    alternates: selectedAlternates,
    hasAlternates: selectedAlternates.length > 0,
    addAlternateAsWaypoint,
    isAlternate: (icao) => selectedAlternates.some(alt => alt.icao === icao)
  };
};