// src/features/alternates/hooks/useAdvancedAlternateSelection.js

import { useMemo, useCallback, useEffect } from 'react';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useAlternateSelection } from './useAlternateSelection';
import { useVACStore } from '@core/stores/vacStore';
import { calculateDistance } from '@utils/navigationCalculations';

/**
 * Hook avancé pour la sélection automatique des alternates
 * Fournit toutes les données nécessaires pour l'affichage dans AlternatesModule
 */
export const useAdvancedAlternateSelection = () => {
  const { searchZone, dynamicParams, findAlternates, isReady, isLoadingAircraft, isLoadingAirports } = useAlternateSelection();
  const { scoredAlternates, candidates, selectedAlternates } = useAlternatesStore();
  
  // Log de debug
  useEffect(() => {
      }, [selectedAlternates, scoredAlternates, candidates, isReady]);
  
  // Calcul des paramètres d'affichage
  const displayParams = useMemo(() => {
    if (!searchZone || !dynamicParams) return null;
    
    return {
      dynamicRadius: dynamicParams.maxRadiusNM || searchZone?.radius || 25,
      triangleArea: searchZone.area || 0,
      turnPointBuffers: searchZone.turnPoints || []
    };
  }, [searchZone, dynamicParams]);
  
  // Formater les alternates pour l'affichage
  const formattedAlternates = useMemo(() => {
    if (!selectedAlternates || selectedAlternates.length === 0) {
            return [];
    }
    
        
    const formatted = selectedAlternates.map((alt, index) => {
      // S'assurer que toutes les propriétés requises existent
      const formatted = {
        ...alt,
        displayIndex: index + 1,
        displayName: `${alt.icao} - ${alt.name}`,
        displayDistance: `${(alt.distance || 0).toFixed(1)} NM`,
        displayRunway: alt.runways && alt.runways.length > 0 && alt.runways[0] ? 
          `${alt.runways[0].length || '?'}m × ${alt.runways[0].width || '?'}m` : 
          'Non disponible',
        displayServices: [
          (alt.services?.fuel || alt.fuel) && '⛽',
          alt.services?.atc && '🗼',
          alt.services?.lighting && '💡'
        ].filter(Boolean).join(' ') || 'Aucun',
        displayWeather: alt.weather?.metar ? 
          `${alt.weather.metar.decoded?.wind?.direction || 'VAR'}° / ${alt.weather.metar.decoded?.wind?.speed || 0}kt` :
          'Non disponible',
        displayScore: `${Math.round((alt.score || 0) * 100)}%`,
        displayRank: getRankLabel(alt.score),
        vac: {
          available: !!useVACStore.getState().charts[alt.icao],
          downloaded: useVACStore.getState().charts[alt.icao]?.isDownloaded || false
        }
      };
      
      // Ajouter les distances depuis départ et arrivée si la zone de recherche est définie
      if (searchZone && searchZone.departure && searchZone.arrival && alt.position) {
        formatted.distanceToDeparture = calculateDistance(alt.position, searchZone.departure);
        formatted.distanceToArrival = calculateDistance(alt.position, searchZone.arrival);
      }
      
      return formatted;
    });
    
    // .join(', '));
    return formatted;
  }, [selectedAlternates, searchZone]);
  
  // Statistiques pour l'affichage
  const statistics = useMemo(() => {
    const stats = {
      totalCandidates: candidates?.length || 0,
      scoredCandidates: scoredAlternates?.length || 0,
      selectedCount: selectedAlternates?.length || 0,
      averageScore: selectedAlternates && selectedAlternates.length > 0 
        ? selectedAlternates.reduce((sum, alt) => sum + (alt.score || 0), 0) / selectedAlternates.length
        : 0,
      // Statistiques par côté
      departureSideCount: selectedAlternates?.filter(alt => alt.selectionType === 'departure').length || 0,
      arrivalSideCount: selectedAlternates?.filter(alt => alt.selectionType === 'arrival').length || 0
    };
    
        return stats;
  }, [scoredAlternates, selectedAlternates, candidates]);
  
  // Fonction de rafraîchissement
  const refreshAlternates = useCallback(async () => {
        await findAlternates();
  }, [findAlternates]);
  
  // Retourner toutes les données nécessaires pour l'affichage
  const result = {
    searchZone,
    selectedAlternates,
    isReady,
    isLoadingAircraft,     // Nouveau : indique si l'avion est en cours de chargement
    isLoadingAirports,     // Nouveau : indique si les aérodromes sont en cours de chargement
    dynamicRadius: displayParams?.dynamicRadius || searchZone?.radius || 25,
    triangleArea: displayParams?.triangleArea || 0,
    turnPointBuffers: displayParams?.turnPointBuffers || [],
    refreshAlternates,
    formattedAlternates,
    statistics
  };


  return result;
};

// Fonction helper pour obtenir le label de rang
const getRankLabel = (score) => {
  if (!score && score !== 0) return 'Non évalué';
  if (score >= 0.8) return '⭐ Excellent';
  if (score >= 0.6) return '👍 Bon';
  if (score >= 0.4) return '✅ Acceptable';
  return '⚠️ Marginal';
};