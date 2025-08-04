// src/features/alternates/AlternatesModule.jsx
// VERSION 5 - Module Déroutements avec sélection manuelle uniquement et suggestions visuelles

console.log('🛬 AlternatesModule v5 - Chargement...'); // LOG DE VÉRIFICATION

import React, { memo, useEffect, useState } from 'react';
import { Navigation2, AlertTriangle, Fuel, Wind, Plane, Info, MapPin, RefreshCw } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAdvancedAlternateSelection } from './hooks/useAdvancedAlternateSelection';
import { AlternateMap } from './components/AlternateMap';
import { AlternateSelectorDual } from './components/AlternateSelectorDual';
import { useNavigationResults } from './hooks/useNavigationResults';
import { WeatherRateLimitIndicator } from './components/WeatherRateLimitIndicator';
import { useAlternatesStore } from '@core/stores/alternatesStore';

const AlternatesModule = memo(() => {
  console.log('🛬 AlternatesModule - Rendu du composant'); // LOG DE RENDU
  
  const {
    searchZone,
    selectedAlternates,
    isReady,
    dynamicRadius,
    triangleArea,
    turnPointBuffers,
    refreshAlternates,
    formattedAlternates,
    statistics
  } = useAdvancedAlternateSelection();
  
  const { scoredAlternates, setSelectedAlternates } = useAlternatesStore();
  const [manualSelection, setManualSelection] = useState({ departure: null, arrival: null });
  
  const [hasSearched, setHasSearched] = useState(false);
  
  // Log détaillé de l'état
  useEffect(() => {
    console.log('🛬 AlternatesModule - État complet:', { 
      isReady, 
      alternatesCount: selectedAlternates?.length,
      scoredAlternatesCount: scoredAlternates?.length,
      formattedCount: formattedAlternates?.length,
      statistics,
      searchZone: searchZone ? {
        type: searchZone.type,
        radius: searchZone.radius,
        hasPerpendicular: !!searchZone.perpendicular
      } : null,
      manualSelection
    });
  }, [isReady, selectedAlternates, scoredAlternates, formattedAlternates, statistics, searchZone, manualSelection]);
  
  // Déclencher automatiquement la recherche quand les conditions sont remplies
  useEffect(() => {
    if (isReady && !hasSearched) {
      console.log('🚀 Déclenchement automatique de la recherche');
      setHasSearched(true);
      refreshAlternates();
    }
  }, [isReady, hasSearched, refreshAlternates]);
  
  // Réinitialiser hasSearched si la route change
  useEffect(() => {
    if (searchZone) {
      const routeKey = `${searchZone.departure.lat}-${searchZone.departure.lon}-${searchZone.arrival.lat}-${searchZone.arrival.lon}`;
      const previousKey = useAlternatesStore.getState().lastRouteKey;
      if (routeKey !== previousKey) {
        setHasSearched(false);
      }
    }
  }, [searchZone]);
  
  if (!isReady) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={16} />
        <p style={sx.text.sm}>
          Définissez un vol avec départ et arrivée pour voir les suggestions de déroutements
        </p>
      </div>
    );
  }
  
  // Gérer la sélection manuelle
  const handleManualSelection = (selection) => {
    setManualSelection(selection);
    
    // Mettre à jour le store avec la sélection manuelle
    const newSelection = [];
    if (selection.departure) {
      newSelection.push({ ...selection.departure, selectionType: 'departure' });
    }
    if (selection.arrival) {
      newSelection.push({ ...selection.arrival, selectionType: 'arrival' });
    }
    
    setSelectedAlternates(newSelection);
  };
  
  // Déterminer quels alternates afficher sur la carte
  const mapAlternates = (manualSelection.departure || manualSelection.arrival)
    ? [manualSelection.departure, manualSelection.arrival].filter(Boolean)
    : [];
  
  return (
    <div>
      {/* Indicateur de rate limiting météo */}
      <WeatherRateLimitIndicator />
      
      {/* En-tête avec résumé et statistiques */}
      <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
        <div style={sx.spacing.mb(4)}>
          <h3 style={sx.combine(sx.text.xl, sx.text.bold)}>
            🛬 Sélection des aérodromes de déroutement
          </h3>
        </div>
        
        {/* Statistiques de recherche */}
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Zone de recherche géométrique
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <StatCard
              icon={<Navigation2 size={20} />}
              label="Zone principale"
              value="Capsule (pilule)"
              detail={`Rayon: ${dynamicRadius || 25} NM`}
            />
            <StatCard
              icon={<Fuel size={20} />}
              label="Rayon dynamique"
              value={`${dynamicRadius || 25} NM`}
              detail="Basé sur carburant"
            />
            <StatCard
              icon={<Plane size={20} />}
              label="Points tournants"
              value={turnPointBuffers?.length || 0}
              detail={turnPointBuffers?.length > 0 ? "Avec tampons 5-10 NM" : "Aucun détecté"}
            />
            <StatCard
              icon={<Info size={20} />}
              label="Candidats trouvés"
              value={statistics?.scoredCandidates || 0}
              detail={`Sur ${statistics?.totalCandidates || 0} total`}
            />
          </div>
        </div>
        
        {/* Interface de sélection manuelle avec tous les aérodromes suggérés */}
        {scoredAlternates && scoredAlternates.length > 0 ? (
          <AlternateSelectorDual
            candidates={scoredAlternates}
            searchZone={searchZone}
            onSelectionChange={handleManualSelection}
            currentSelection={manualSelection}
          />
        ) : hasSearched ? (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
            <Info size={16} />
            <p style={sx.text.sm}>
              Aucun aérodrome trouvé dans la zone de recherche.
            </p>
          </div>
        ) : (
          <div style={sx.combine(sx.components.card.base, sx.text.center, sx.spacing.p(8))}>
            <div style={{ 
              display: 'inline-block',
              animation: 'spin 2s linear infinite'
            }}>
              <RefreshCw size={48} style={{ color: '#3b82f6' }} />
            </div>
            <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mt(4), sx.spacing.mb(2))}>
              Recherche en cours...
            </h4>
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Analyse de la zone de vol et recherche des aérodromes de déroutement
            </p>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        {/* Résumé de la sélection actuelle */}
        {(manualSelection.departure || manualSelection.arrival) && (
          <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              ✅ Aérodromes sélectionnés
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {manualSelection.departure && (
                <div style={{
                  padding: '16px',
                  border: '2px solid #dc2626',
                  borderRadius: '8px',
                  backgroundColor: '#fef2f2'
                }}>
                  <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                    🔴 Déroutement côté départ
                  </p>
                  <p style={sx.text.base}>
                    <strong>{manualSelection.departure.icao}</strong> - {manualSelection.departure.name}
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(1))}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {manualSelection.departure.distanceToDeparture?.toFixed(1) || '?'} NM depuis le départ
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                    Score: {((manualSelection.departure.score || 0) * 100).toFixed(0)}%
                  </p>
                </div>
              )}
              
              {manualSelection.arrival && (
                <div style={{
                  padding: '16px',
                  border: '2px solid #059669',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4'
                }}>
                  <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                    🟢 Déroutement côté arrivée
                  </p>
                  <p style={sx.text.base}>
                    <strong>{manualSelection.arrival.icao}</strong> - {manualSelection.arrival.name}
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mt(1))}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {manualSelection.arrival.distanceToArrival?.toFixed(1) || '?'} NM depuis l'arrivée
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                    Score: {((manualSelection.arrival.score || 0) * 100).toFixed(0)}%
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      
      {/* Carte avec visualisation */}
      {searchZone && (
        <section style={sx.combine(sx.components.section.base, sx.spacing.mb(6))}>
          <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
            Visualisation de la zone de recherche
          </h4>
          <AlternateMap 
            searchZone={searchZone}
            alternates={mapAlternates}
            allCandidates={scoredAlternates}
            showAllCandidates={true}
            selectedIcaos={[manualSelection.departure?.icao, manualSelection.arrival?.icao].filter(Boolean)}
          />
        </section>
      )}
      
      {/* Informations détaillées */}
      <section style={sx.components.section.base}>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          ℹ️ Méthodologie de sélection
        </h4>
        <div style={sx.components.card.base}>
          <div style={sx.text.sm}>
            <p style={sx.spacing.mb(2)}>
              <strong>Système dual :</strong> La zone est divisée par la médiatrice du segment [départ, arrivée]. 
              Vous pouvez sélectionner un aérodrome de chaque côté pour garantir une couverture complète.
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Zone de recherche :</strong> Capsule (pilule) autour de la route avec rayon h = (√3/2) × distance + tampons de 5-10 NM autour des points tournants critiques
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Garantie :</strong> Aucun chemin de déroutement n'est plus long que la navigation initiale
            </p>
            <p style={sx.spacing.mb(2)}>
              <strong>Critères de scoring :</strong>
            </p>
            <ul style={{ marginLeft: '20px', listStyleType: 'disc' }}>
              <li>Distance à la route (30%)</li>
              <li>Infrastructure piste (25%)</li>
              <li>Services disponibles (20%)</li>
              <li>Conditions météo (15%)</li>
              <li>Position stratégique (10%)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
});

// Composant pour afficher une carte de statistique
const StatCard = memo(({ icon, label, value, detail }) => (
  <div style={sx.combine(sx.spacing.p(3), sx.bg.gray, sx.rounded.lg)}>
    <div style={sx.combine(sx.flex.start, sx.spacing.gap(2), sx.spacing.mb(2))}>
      <div style={{ color: '#3b82f6' }}>{icon}</div>
      <span style={sx.combine(sx.text.sm, sx.text.muted)}>{label}</span>
    </div>
    <p style={sx.combine(sx.text.lg, sx.text.bold)}>{value}</p>
    <p style={sx.combine(sx.text.xs, sx.text.secondary)}>{detail}</p>
  </div>
));

AlternatesModule.displayName = 'AlternatesModule';
StatCard.displayName = 'StatCard';

console.log('🛬 AlternatesModule v5 - Chargement terminé');

// Export par défaut pour le lazy loading
export default AlternatesModule;