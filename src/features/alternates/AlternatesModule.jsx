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
import { WeatherRateLimitIndicator } from '@components/WeatherRateLimitIndicator';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { DataSourceBadge, DataField } from '@shared/components';
import { calculateDistance } from '@utils/navigationCalculations';
import { useWeatherStore } from '@core/stores/weatherStore';

const AlternatesModule = memo(() => {
  
  const {
    searchZone,
    isReady,
    dynamicRadius,
    triangleArea,
    turnPointBuffers,
    refreshAlternates,
    formattedAlternates,
    statistics
  } = useAdvancedAlternateSelection();
  
  const { scoredAlternates, setSelectedAlternates, selectedAlternates } = useAlternatesStore();
  const { fetchMultiple } = useWeatherStore();
  
  const [hasSearched, setHasSearched] = useState(false);
  
  // Dériver la sélection manuelle depuis le store
  const manualSelection = React.useMemo(() => {
    const selection = {
      departure: selectedAlternates?.find(alt => alt.selectionType === 'departure') || null,
      arrival: selectedAlternates?.find(alt => alt.selectionType === 'arrival') || null
    };
    return selection;
  }, [selectedAlternates]);
  
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
  
  // Gérer la sélection manuelle - DOIT être défini AVANT le return conditionnel
  const handleManualSelection = React.useCallback((selection) => {
    // Mettre à jour le store avec la sélection manuelle
    const newSelection = [];
    if (selection.departure) {
      // S'assurer que la position est correctement définie
      const depAirport = selection.departure;
      const position = depAirport.position || depAirport.coordinates || { lat: depAirport.lat, lon: depAirport.lon || depAirport.lng };
      newSelection.push({ 
        ...depAirport, 
        position: position,
        selectionType: 'departure' 
      });
    }
    if (selection.arrival) {
      // S'assurer que la position est correctement définie
      const arrAirport = selection.arrival;
      const position = arrAirport.position || arrAirport.coordinates || { lat: arrAirport.lat, lon: arrAirport.lon || arrAirport.lng };
      newSelection.push({ 
        ...arrAirport, 
        position: position,
        selectionType: 'arrival' 
      });
    }
    setSelectedAlternates(newSelection);
  }, [setSelectedAlternates]);
  
  // Déterminer quels alternates afficher sur la carte
  const mapAlternates = (manualSelection.departure || manualSelection.arrival)
    ? [manualSelection.departure, manualSelection.arrival].filter(Boolean)
    : [];
  
  // Récupérer les METAR pour les aérodromes sélectionnés
  useEffect(() => {
    if (selectedAlternates && selectedAlternates.length > 0) {
      // Extraire les codes ICAO
      const icaoCodes = selectedAlternates.map(alt => alt.icao).filter(Boolean);
      
      if (icaoCodes.length > 0) {
        // Récupérer les METAR en parallèle
        fetchMultiple(icaoCodes).catch(error => {
          console.error('Erreur récupération METAR:', error);
        });
      }
    }
  }, [selectedAlternates, fetchMultiple]);
  
  // Rendu conditionnel - DOIT être APRÈS tous les hooks
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
          
          {/* Calcul de la distance et du rayon de la pilule */}
          {searchZone && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
              <Info size={16} />
              <div>
                <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                  Calcul de la zone de recherche (pilule)
                </p>
                <div style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
                  <p>Distance départ-arrivée : <strong>{Math.round(calculateDistance(searchZone.departure, searchZone.arrival))} NM</strong></p>
                  <p>Formule adaptative :</p>
                  <ul style={{ paddingLeft: '20px', fontSize: '12px', marginTop: '4px' }}>
                    <li>0-100 NM : h = (√3/2) × distance (formule classique)</li>
                    <li>100-200 NM : croissance réduite à 50%</li>
                    <li>200-400 NM : croissance réduite à 30%</li>
                    <li>&gt;400 NM : croissance minimale (10%), max 250 NM</li>
                  </ul>
                  <p style={sx.spacing.mt(1)}>Rayon calculé : <strong>{dynamicRadius || 25} NM</strong></p>
                  {dynamicRadius && searchZone.radius && dynamicRadius < searchZone.radius && (
                    <p style={sx.combine(sx.text.warning, sx.spacing.mt(1))}>
                      ⚠️ Rayon limité par le carburant disponible : <strong>{dynamicRadius} NM</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
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
        
        {/* Conteneur pour la carte et la sélection côte à côte */}
        {searchZone && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '24px',
            alignItems: 'start'
          }}>
            {/* Colonne gauche : Carte */}
            <div style={sx.components.card.base}>
              <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
                📍 Visualisation de la zone de recherche
              </h4>
              <AlternateMap 
                searchZone={searchZone}
                alternates={mapAlternates}
                allCandidates={scoredAlternates}
                showAllCandidates={true}
                selectedIcaos={[manualSelection.departure?.icao, manualSelection.arrival?.icao].filter(Boolean)}
              />
            </div>
            
            {/* Colonne droite : Interface de sélection */}
            <div>
              <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
                ✈️ Sélection des aérodromes
              </h4>
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
            </div>
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
                  <DataField
                    label="Aérodrome"
                    value={`${manualSelection.departure.icao} - ${manualSelection.departure.name}`}
                    dataSource={manualSelection.departure.dataSource || 'static'}
                    emphasis={true}
                  />
                  <DataField
                    label="Distance"
                    value={manualSelection.departure.distanceToDeparture?.toFixed(1) || '?'}
                    unit="NM depuis le départ"
                    dataSource={manualSelection.departure.dataSource || 'static'}
                    size="sm"
                    style={{ marginTop: '8px' }}
                  />
                  <DataField
                    label="Score"
                    value={`${((manualSelection.departure.score || 0) * 100).toFixed(0)}%`}
                    dataSource="calculated"
                    size="sm"
                    style={{ marginTop: '4px' }}
                  />
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
                  <DataField
                    label="Aérodrome"
                    value={`${manualSelection.arrival.icao} - ${manualSelection.arrival.name}`}
                    dataSource={manualSelection.arrival.dataSource || 'static'}
                    emphasis={true}
                  />
                  <DataField
                    label="Distance"
                    value={manualSelection.arrival.distanceToArrival?.toFixed(1) || '?'}
                    unit="NM depuis l'arrivée"
                    dataSource={manualSelection.arrival.dataSource || 'static'}
                    size="sm"
                    style={{ marginTop: '8px' }}
                  />
                  <DataField
                    label="Score"
                    value={`${((manualSelection.arrival.score || 0) * 100).toFixed(0)}%`}
                    dataSource="calculated"
                    size="sm"
                    style={{ marginTop: '4px' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      
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
              <strong>Zone de recherche :</strong> Capsule (pilule) autour de la route avec rayon adaptatif. 
              Pour les vols courts (&lt;100 NM), la formule classique h = (√3/2) × distance est utilisée. 
              Pour les vols plus longs, la croissance du rayon est progressivement réduite pour éviter des zones 
              de recherche démesurées, avec un maximum de 250 NM. Des tampons de 5-10 NM sont ajoutés autour 
              des points tournants critiques.
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
const StatCard = memo(({ icon, label, value, detail, dataSource = 'static' }) => (
  <div style={sx.combine(sx.spacing.p(3), sx.bg.gray, sx.rounded.lg)}>
    <div style={sx.combine(sx.flex.start, sx.spacing.gap(2), sx.spacing.mb(2))}>
      <div style={{ color: '#3b82f6' }}>{icon}</div>
      <span style={sx.combine(sx.text.sm, sx.text.muted)}>{label}</span>
      {dataSource !== 'static' && (
        <DataSourceBadge source={dataSource} size="xs" showLabel={false} inline={true} />
      )}
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