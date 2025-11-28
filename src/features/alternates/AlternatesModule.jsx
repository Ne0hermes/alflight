// src/features/alternates/AlternatesModule.jsx
// VERSION 5 - Module Déroutements avec sélection manuelle uniquement et suggestions visuelles

 // LOG DE VÉRIFICATION

import React, { memo, useEffect, useState } from 'react';
import { Navigation2, AlertTriangle, Fuel, Wind, Plane, Info, MapPin, RefreshCw } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useAdvancedAlternateSelection } from './hooks/useAdvancedAlternateSelection';
import { AlternateSelectorUnified } from './components/AlternateSelectorUnified';
import { AlternatesMapView } from './components/AlternatesMapView';
import { useNavigationResults } from './hooks/useNavigationResults';
import { WeatherRateLimitIndicator } from '@components/WeatherRateLimitIndicator';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { DataSourceBadge, DataField } from '@shared/components';
import { calculateDistance } from '@utils/navigationCalculations';
import { useWeatherStore } from '@core/stores/weatherStore';
import { Conversions } from '@utils/conversions';

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

// Composant pour afficher les détails complets d'un aérodrome sélectionné
const AerodromeDetailsCard = memo(({ airport, side, sideColor, sideEmoji, sideLabel, distanceLabel, distanceValue }) => {
  // Fonction pour séparer les pistes bidirectionnelles en directions
  const separateRunwayDirections = () => {
    if (!airport.runways || airport.runways.length === 0) {
      return [];
    }

    const directions = [];

    airport.runways.forEach(runway => {
      const designator = runway.designator || runway.designation || runway.id || '';
      const baseOrientation = runway.orientation || runway.bearing || runway.trueBearing || null;

      // Si c'est une piste bidirectionnelle (ex: "08/26")
      if (designator.includes('/')) {
        const [rwy1, rwy2] = designator.split('/');

        // Récupérer les distances par direction
        const dir1Distances = runway.distancesByDirection?.[rwy1.trim()] || {};
        const dir2Distances = runway.distancesByDirection?.[rwy2.trim()] || {};

        // Direction 1
        directions.push({
          ...runway,
          runwayNumber: rwy1.trim(),
          qfu: baseOrientation,
          tora: dir1Distances.tora,
          toda: dir1Distances.toda,
          asda: dir1Distances.asda,
          lda: dir1Distances.lda
        });

        // Direction 2 (QFU opposé)
        const oppositeQfu = baseOrientation !== null ? (baseOrientation + 180) % 360 : null;
        directions.push({
          ...runway,
          runwayNumber: rwy2.trim(),
          qfu: oppositeQfu,
          tora: dir2Distances.tora,
          toda: dir2Distances.toda,
          asda: dir2Distances.asda,
          lda: dir2Distances.lda
        });
      } else {
        // Piste unidirectionnelle
        directions.push({
          ...runway,
          runwayNumber: designator,
          qfu: baseOrientation
        });
      }
    });

    return directions;
  };

  const runwayDirections = separateRunwayDirections();
  const position = airport.position || airport.coordinates || { lat: airport.lat, lon: airport.lon || airport.lng };
  const dmsCoords = position ? Conversions.coordinatesToDMS(position.lat, position.lon) : null;

  return (
    <div style={{
      padding: '20px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: sideColor,
      borderRadius: '12px',
      backgroundColor: side === 'departure' ? '#fef2f2' : '#f0fdf4'
    }}>
      <p style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
        {sideEmoji} {sideLabel}
      </p>

      {/* Aérodrome */}
      <DataField
        label="Aérodrome"
        value={`${airport.icao} - ${airport.name}`}
        dataSource={airport.dataSource || 'static'}
        emphasis={true}
      />

      {/* Distance */}
      <div style={{ marginTop: '12px' }}>
        <DataField
          label="Distance"
          value={distanceValue?.toFixed(1) || '?'}
          unit={distanceLabel}
          dataSource={airport.dataSource || 'static'}
          size="sm"
        />
      </div>

      {/* Score */}
      <div style={{ marginTop: '8px' }}>
        <DataField
          label="Score"
          value={`${((airport.score || 0) * 100).toFixed(0)}%`}
          dataSource="calculated"
          size="sm"
        />
      </div>

      {/* Coordonnées */}
      {position && (
        <div style={sx.spacing.mt(3)}>
          <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>📍 Coordonnées complètes</p>
          <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
            <p>{position.lat.toFixed(4)}°, {position.lon.toFixed(4)}°</p>
            {dmsCoords && dmsCoords.lat && dmsCoords.lon && (
              <p style={sx.spacing.mt(1)}>
                {dmsCoords.lat.degrees}°{dmsCoords.lat.minutes}'{(dmsCoords.lat.seconds || 0).toFixed(0)}"{dmsCoords.lat.direction} - {' '}
                {dmsCoords.lon.degrees}°{dmsCoords.lon.minutes}'{(dmsCoords.lon.seconds || 0).toFixed(0)}"{dmsCoords.lon.direction}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Altitude terrain */}
      {airport.elevation !== undefined && (
        <div style={sx.spacing.mt(3)}>
          <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>⛰️ Altitude terrain</p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
            {Math.round(airport.elevation)} ft
          </p>
        </div>
      )}

      {/* Pistes par direction */}
      {runwayDirections.length > 0 && (
        <div style={sx.spacing.mt(4)}>
          <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(2))}>✈️ Détails des pistes (par direction)</p>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {runwayDirections.map((runway, idx) => {
              const lengthM = typeof runway.length === 'number' ? runway.length : 0;
              const lengthFt = Math.round(lengthM * 3.28084);
              const widthM = typeof runway.width === 'number' ? runway.width : 0;
              const surfaceType = typeof runway.surface === 'string' ? runway.surface :
                                  (typeof runway.composition === 'string' ? runway.composition : 'N/A');

              return (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    backgroundColor: 'white',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: '#e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                    <strong style={sx.text.sm}>Piste {runway.runwayNumber}</strong>
                    {runway.designation && (
                      <span style={sx.combine(sx.text.xs, {
                        padding: '2px 6px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px'
                      })}>
                        {runway.designation}
                      </span>
                    )}
                  </div>

                  <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    {runway.qfu !== null && (
                      <div style={sx.combine(sx.flex.between, sx.spacing.mb(1))}>
                        <span>• QFU :</span>
                        <strong style={{ color: sideColor }}>{Math.round(runway.qfu)}° • Orientation: {runway.orientation?.toFixed(2)}°</strong>
                      </div>
                    )}
                    <div style={sx.flex.between}>
                      <span>Longueur :</span>
                      <strong>{lengthFt} ft ({lengthM} m)</strong>
                    </div>
                    {widthM > 0 && (
                      <div style={sx.combine(sx.flex.between, sx.spacing.mt(1))}>
                        <span>Largeur :</span>
                        <strong>{widthM} m</strong>
                      </div>
                    )}
                    <div style={sx.combine(sx.flex.between, sx.spacing.mt(1))}>
                      <span>Revêtement :</span>
                      <strong>{surfaceType}</strong>
                    </div>

                    {/* Distances déclarées */}
                    {(
                      (typeof runway.tora === 'number') ||
                      (typeof runway.toda === 'number') ||
                      (typeof runway.asda === 'number') ||
                      (typeof runway.lda === 'number')
                    ) && (
                      <div style={sx.spacing.mt(2)}>
                        <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>Distances déclarées :</p>
                        {typeof runway.tora === 'number' && (
                          <div style={sx.flex.between}>
                            <span>• TORA :</span>
                            <strong>{runway.tora} m ({Math.round(runway.tora * 3.28084)} ft)</strong>
                          </div>
                        )}
                        {typeof runway.toda === 'number' && (
                          <div style={sx.combine(sx.flex.between, sx.spacing.mt(1))}>
                            <span>• TODA :</span>
                            <strong>{runway.toda} m ({Math.round(runway.toda * 3.28084)} ft)</strong>
                          </div>
                        )}
                        {typeof runway.asda === 'number' && (
                          <div style={sx.combine(sx.flex.between, sx.spacing.mt(1))}>
                            <span>• ASDA :</span>
                            <strong>{runway.asda} m ({Math.round(runway.asda * 3.28084)} ft)</strong>
                          </div>
                        )}
                        {typeof runway.lda === 'number' && (
                          <div style={sx.combine(sx.flex.between, sx.spacing.mt(1))}>
                            <span>• LDA :</span>
                            <strong>{runway.lda} m ({Math.round(runway.lda * 3.28084)} ft)</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

const AlternatesModule = memo(({ wizardMode = false, config = {}, filters = {} }) => {

  const {
    searchZone,
    isReady,
    isLoadingAircraft,
    isLoadingAirports,
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
    const depAlt = selectedAlternates?.find(alt => alt.selectionType === 'departure') || null;
    const arrAlt = selectedAlternates?.find(alt => alt.selectionType === 'arrival') || null;

    // Calculer les distances si elles ne sont pas déjà présentes
    let departure = depAlt;
    let arrival = arrAlt;

    if (depAlt && searchZone && depAlt.position) {
      const needsDistances = depAlt.distanceToDeparture === undefined || depAlt.distanceToArrival === undefined;

      if (needsDistances) {
        departure = {
          ...depAlt,
          distanceToDeparture: depAlt.distanceToDeparture !== undefined
            ? depAlt.distanceToDeparture
            : calculateDistance(depAlt.position, searchZone.departure),
          distanceToArrival: depAlt.distanceToArrival !== undefined
            ? depAlt.distanceToArrival
            : calculateDistance(depAlt.position, searchZone.arrival)
        };
      }
    }

    if (arrAlt && searchZone && arrAlt.position) {
      const needsDistances = arrAlt.distanceToDeparture === undefined || arrAlt.distanceToArrival === undefined;

      if (needsDistances) {
        arrival = {
          ...arrAlt,
          distanceToDeparture: arrAlt.distanceToDeparture !== undefined
            ? arrAlt.distanceToDeparture
            : calculateDistance(arrAlt.position, searchZone.departure),
          distanceToArrival: arrAlt.distanceToArrival !== undefined
            ? arrAlt.distanceToArrival
            : calculateDistance(arrAlt.position, searchZone.arrival)
        };
      }
    }

    return { departure, arrival };
  }, [selectedAlternates, searchZone]);
  
  // Déclencher automatiquement la recherche quand les conditions sont remplies
  useEffect(() => {
    if (isReady && !hasSearched) {
            setHasSearched(true);
      refreshAlternates();
    }
  }, [isReady, hasSearched, refreshAlternates]);
  
  // Réinitialiser et relancer la recherche quand la route change
  useEffect(() => {
    if (searchZone) {
      const routeKey = `${searchZone.departure.lat}-${searchZone.departure.lon}-${searchZone.arrival.lat}-${searchZone.arrival.lon}`;
      const previousKey = useAlternatesStore.getState().lastRouteKey;
      if (routeKey !== previousKey) {
        // Mettre à jour la clé de route
        useAlternatesStore.getState().setLastRouteKey(routeKey);
        // Réinitialiser et relancer la recherche
        setHasSearched(false);
        // Relancer immédiatement la recherche si ready
        if (isReady) {
          setTimeout(() => {
            setHasSearched(true);
            refreshAlternates();
          }, 0);
        }
      }
    }
  }, [searchZone, isReady, refreshAlternates]);
  
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
      // Extraire les codes ICAO et filtrer uniquement les codes valides (4 lettres alphabétiques)
      const icaoCodes = selectedAlternates
        .map(alt => alt.icao)
        .filter(Boolean)
        .filter(icao => /^[A-Z]{4}$/.test(icao)); // Uniquement codes ICAO valides

      if (icaoCodes.length > 0) {
        // Récupérer les METAR en parallèle
        fetchMultiple(icaoCodes).catch(error => {
          console.error('Erreur récupération METAR:', error);
        });
      }
    }
  }, [selectedAlternates, fetchMultiple]);
  
  // Rendu conditionnel - DOIT être APRÈS tous les hooks

  // Loader pour le chargement de l'avion
  if (isLoadingAircraft) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.text.center, sx.spacing.p(8))}>
        <div style={{
          display: 'inline-block',
          animation: 'spin 2s linear infinite'
        }}>
          <Plane size={48} style={{ color: '#3b82f6' }} />
        </div>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mt(4), sx.spacing.mb(2))}>
          Chargement de l'avion...
        </h4>
        <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
          Récupération des données de l'avion depuis la base de données
        </p>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Loader pour le chargement des aérodromes
  if (isLoadingAirports) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.text.center, sx.spacing.p(8))}>
        <div style={{
          display: 'inline-block',
          animation: 'spin 2s linear infinite'
        }}>
          <MapPin size={48} style={{ color: '#10b981' }} />
        </div>
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mt(4), sx.spacing.mb(2))}>
          Chargement des aérodromes...
        </h4>
        <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
          Chargement de la base de données des aérodromes français
        </p>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Alerte si les données ne sont pas prêtes
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
        {/* Conteneur pour la carte et la sélection en dessous */}
        {searchZone && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            marginBottom: '24px'
          }}>
            {/* Carte en haut */}
            <div style={sx.components.card.base}>
              <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
                📍 Visualisation de la route et des déroutements
              </h4>
              <div style={{
                fontSize: '13px',
                color: '#374151',
                marginBottom: '16px',
                marginTop: '0',
                padding: '12px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#1e40af' }}>
                  🛩️ Zone de recherche : {Math.ceil(dynamicRadius || 25)} NM de rayon
                </p>
                <p style={{ margin: '0', fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                  Le rayon correspond à un temps de déroutement de 20-30 min selon l'autonomie de l'avion.
                  Cela représente la zone où vous pourriez rejoindre un aérodrome de déroutement en cas de besoin.
                </p>
              </div>
              <AlternatesMapView
                searchZone={searchZone}
                selectedAlternates={selectedAlternates}
                scoredAlternates={scoredAlternates}
                dynamicRadius={dynamicRadius}
                onSelectionChange={handleManualSelection}
                currentSelection={manualSelection}
              />
            </div>

            {/* Interface de sélection en dessous */}
            <div>
              <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
                ✈️ Sélection des aérodromes
              </h4>
              {scoredAlternates && scoredAlternates.length > 0 ? (
                <AlternateSelectorUnified
                  candidates={scoredAlternates}
                  searchZone={searchZone}
                  onSelectionChange={handleManualSelection}
                  currentSelection={manualSelection}
                  filters={filters}
                />
              ) : hasSearched ? (
                <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
                  <Info size={16} />
                  <p style={sx.text.sm}>
                    Aucun aérodrome trouvé dans la zone de recherche.
                  </p>
                </div>
              ) : (
                <div style={sx.combine(sx.components.card.base, sx.text.left, sx.spacing.p(8))}>
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

        {/* Détails complets des aérodromes sélectionnés */}
        {(manualSelection.departure || manualSelection.arrival) && (
          <div style={sx.combine(sx.components.card.base, sx.spacing.mt(4))}>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
              ✅ Aérodromes sélectionnés
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {manualSelection.departure && (
                <AerodromeDetailsCard
                  airport={manualSelection.departure}
                  side="departure"
                  sideColor="#dc2626"
                  sideEmoji="🔴"
                  sideLabel="Déroutement côté départ"
                  distanceLabel="NM depuis le départ"
                  distanceValue={manualSelection.departure.distanceToDeparture}
                />
              )}

              {manualSelection.arrival && (
                <AerodromeDetailsCard
                  airport={manualSelection.arrival}
                  side="arrival"
                  sideColor="#059669"
                  sideEmoji="🟢"
                  sideLabel="Déroutement côté arrivée"
                  distanceLabel="NM depuis l'arrivée"
                  distanceValue={manualSelection.arrival.distanceToArrival}
                />
              )}
            </div>
          </div>
        )}
      </section>
    </div>

  );
});

AlternatesModule.displayName = 'AlternatesModule';
StatCard.displayName = 'StatCard';
AerodromeDetailsCard.displayName = 'AerodromeDetailsCard';


// Export par défaut pour le lazy loading
export default AlternatesModule;