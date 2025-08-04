// src/features/alternates/hooks/useAdvancedAlternateSelection.js

import { useMemo, useCallback, useEffect } from 'react';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useAlternateSelection } from './useAlternateSelection';
import { useVACStore } from '@core/stores/vacStore';
import { calculateDistance } from '../utils/geometryCalculations';

/**
 * Hook avancé pour la sélection automatique des alternates
 * Fournit toutes les données nécessaires pour l'affichage dans AlternatesModule
 */
export const useAdvancedAlternateSelection = () => {
  const { searchZone, dynamicParams, selectedAlternates, findAlternates, isReady } = useAlternateSelection();
  const { scoredAlternates } = useAlternatesStore();
  
  // Calcul des paramètres d'affichage
  const displayParams = useMemo(() => {
    if (!searchZone || !dynamicParams) return null;
    
    return {
      dynamicRadius: dynamicParams.maxRadiusNM || 25,
      triangleArea: searchZone.area || 0,
      turnPointBuffers: searchZone.turnPoints || []
    };
  }, [searchZone, dynamicParams]);
  
  // Formater les alternates pour l'affichage
  const formattedAlternates = useMemo(() => {
    if (!searchZone) return selectedAlternates;
    
    return selectedAlternates.map((alt, index) => ({
      ...alt,
      displayIndex: index + 1,
      displayName: `${alt.icao} - ${alt.name}`,
      displayDistance: `${(alt.distance || 0).toFixed(1)} NM`,
      displayRunway: alt.runways?.[0] ? 
        `${alt.runways[0].length || '?'}m × ${alt.runways[0].width || '?'}m` : 
        'Non disponible',
      displayServices: [
        alt.services?.fuel && '⛽',
        alt.services?.atc && '🗼',
        alt.services?.lighting && '💡'
      ].filter(Boolean).join(' ') || 'Aucun',
      displayWeather: alt.weather?.metar ? 
        `${alt.weather.metar.decoded.wind?.direction || 'VAR'}° / ${alt.weather.metar.decoded.wind?.speed || 0}kt` :
        'Non disponible',
      displayScore: `${Math.round((alt.score || 0) * 100)}%`,
      displayRank: getRankLabel(alt.score),
      vac: {
        available: !!useVACStore.getState().charts[alt.icao],
        downloaded: useVACStore.getState().charts[alt.icao]?.isDownloaded || false
      },
      // Ajouter les distances depuis départ et arrivée
      distanceToDeparture: alt.position && searchZone.departure ? 
        calculateDistance(alt.position, searchZone.departure) : null,
      distanceToArrival: alt.position && searchZone.arrival ? 
        calculateDistance(alt.position, searchZone.arrival) : null
    }));
  }, [selectedAlternates, searchZone]);
  
  // Statistiques pour l'affichage
  const statistics = useMemo(() => ({
    totalCandidates: useAlternatesStore.getState().candidates.length,
    scoredCandidates: scoredAlternates.length,
    selectedCount: selectedAlternates.length,
    averageScore: selectedAlternates.length > 0 
      ? selectedAlternates.reduce((sum, alt) => sum + (alt.score || 0), 0) / selectedAlternates.length
      : 0,
    // Statistiques par côté
    departureSideCount: selectedAlternates.filter(alt => alt.selectionType === 'departure').length,
    arrivalSideCount: selectedAlternates.filter(alt => alt.selectionType === 'arrival').length
  }), [scoredAlternates, selectedAlternates]);
  
  // Fonction de rafraîchissement
  const refreshAlternates = useCallback(async () => {
    await findAlternates();
  }, [findAlternates]);
  
  // Retourner toutes les données nécessaires pour l'affichage
  return {
    searchZone,
    selectedAlternates,
    isReady,
    dynamicRadius: displayParams?.dynamicRadius || 25,
    triangleArea: displayParams?.triangleArea || 0,
    turnPointBuffers: displayParams?.turnPointBuffers || [],
    refreshAlternates,
    formattedAlternates,
    statistics
  };
};

// Fonction helper pour obtenir le label de rang
const getRankLabel = (score) => {
  if (!score) return 'Non évalué';
  if (score >= 0.8) return '⭐ Excellent';
  if (score >= 0.6) return '👍 Bon';
  if (score >= 0.4) return '✅ Acceptable';
  return '⚠️ Marginal';
};