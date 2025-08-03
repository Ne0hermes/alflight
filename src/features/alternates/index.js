// src/features/alternates/index.js
import { useState, useCallback } from 'react';
import { useNavigation } from '@core/contexts';


/**
 * Hook pour gérer les aérodromes de dégagement (alternates)
 */
export const useAlternatesForNavigation = () => {
  const [alternates, setAlternates] = useState([]);
  const { waypoints, setWaypoints } = useNavigation();
  
  const hasAlternates = alternates.length > 0;
  
  const addAlternate = useCallback((airport) => {
    if (!airport) return;
    
    const newAlternate = {
      id: `alt-${Date.now()}`,
      icao: airport.icao,
      name: airport.name,
      coordinates: airport.coordinates,
      type: 'alternate'
    };
    
    setAlternates(prev => [...prev, newAlternate]);
  }, []);
  
  const removeAlternate = useCallback((alternateId) => {
    setAlternates(prev => prev.filter(alt => alt.id !== alternateId));
  }, []);
  
  const addAlternateAsWaypoint = useCallback((alternateId) => {
    const alternate = alternates.find(alt => alt.id === alternateId);
    if (!alternate) return;
    
    const newWaypoint = {
      id: Date.now(),
      name: alternate.icao,
      type: 'waypoint',
      lat: alternate.coordinates.lat,
      lon: alternate.coordinates.lon,
      elevation: alternate.elevation || null,
      airportName: alternate.name,
      isAlternate: true
    };
    
    setWaypoints(prev => [...prev, newWaypoint]);
  }, [alternates, setWaypoints]);
  
  const clearAlternates = useCallback(() => {
    setAlternates([]);
  }, []);
  
  return {
    alternates,
    hasAlternates,
    addAlternate,
    removeAlternate,
    addAlternateAsWaypoint,
    clearAlternates
  };
};

// Export par défaut pour le lazy loading
export default useAlternatesForNavigation;