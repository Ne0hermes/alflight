// src/hooks/useFuelSync.js
import { useEffect } from 'react';
import { useFuel } from '@core/contexts';
import { useNavigationResults } from '@features/navigation/hooks/useNavigationResults';

export const useFuelSync = () => {
  const { updateTripFuel, updateFinalReserve } = useFuel();
  const navigationResults = useNavigationResults();
  
  // Auto-sync avec la navigation
  useEffect(() => {
    if (navigationResults?.fuelRequired) {
      updateTripFuel(navigationResults.fuelRequired);
    }
  }, [navigationResults?.fuelRequired, updateTripFuel]);
  
  // Auto-sync de la réserve finale
  useEffect(() => {
    if (navigationResults?.regulationReserveLiters) {
      updateFinalReserve(navigationResults.regulationReserveLiters);
    }
  }, [navigationResults?.regulationReserveLiters, updateFinalReserve]);
};