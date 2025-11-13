// src/features/alternates/components/AlternatesMapView.jsx
import React, { memo, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { calculateDistance } from '@utils/navigationCalculations';
import { useNavigation } from '@core/contexts';

/**
 * Calcule le point le plus proche sur un segment de ligne depuis un point donné
 * Retourne le point de projection perpendiculaire
 */
const getClosestPointOnSegment = (point, segmentStart, segmentEnd) => {
  const A = point.lat - segmentStart.lat;
  const B = point.lon - segmentStart.lon;
  const C = segmentEnd.lat - segmentStart.lat;
  const D = segmentEnd.lon - segmentStart.lon;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let closestLat, closestLon;

  if (param < 0) {
    closestLat = segmentStart.lat;
    closestLon = segmentStart.lon;
  } else if (param > 1) {
    closestLat = segmentEnd.lat;
    closestLon = segmentEnd.lon;
  } else {
    closestLat = segmentStart.lat + param * C;
    closestLon = segmentStart.lon + param * D;
  }

  return { lat: closestLat, lon: closestLon };
};

/**
 * Trouve le point le plus proche sur la route (ensemble de segments) depuis un alternate
 */
const getClosestPointOnRoute = (alternatePosition, routePoints) => {
  if (routePoints.length < 2) return null;

  let minDistance = Infinity;
  let closestPoint = null;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const segmentStart = { lat: routePoints[i][0], lon: routePoints[i][1] };
    const segmentEnd = { lat: routePoints[i + 1][0], lon: routePoints[i + 1][1] };

    const pointOnSegment = getClosestPointOnSegment(alternatePosition, segmentStart, segmentEnd);
    const distance = calculateDistance(alternatePosition, pointOnSegment);

    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = pointOnSegment;
    }
  }

  return closestPoint;
};

// Fix pour les icônes Leaflet qui ne s'affichent pas correctement avec Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Note : Les icônes SVG ne sont plus utilisées, remplacées par CircleMarker

// Composant pour ajuster automatiquement la vue de la carte
const FitBounds = ({ bounds }) => {
  const map = useMap();

  React.useEffect(() => {
    if (bounds && bounds.length > 0) {
      try {
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (e) {
        console.error('Error fitting bounds:', e);
      }
    }
  }, [bounds, map]);

  return null;
};

/**
 * Composant de carte pour visualiser la route et les aérodromes de déroutement
 */
export const AlternatesMapView = memo(({
  searchZone,
  selectedAlternates = [],
  scoredAlternates = [],
  dynamicRadius = null,
  onSelectionChange = null,
  currentSelection = { departure: null, arrival: null },
  style = {}
}) => {
  // Récupérer les waypoints de l'étape 2 pour afficher le trajet complet
  const { waypoints } = useNavigation();

  // Gérer la sélection depuis la carte
  const handleSelect = React.useCallback((airport, side) => {
    if (!onSelectionChange) return;

    if (side === 'departure') {
      const newDeparture = airport?.icao === currentSelection.departure?.icao ? null : airport;
      onSelectionChange({ departure: newDeparture, arrival: currentSelection.arrival });
    } else {
      const newArrival = airport?.icao === currentSelection.arrival?.icao ? null : airport;
      onSelectionChange({ departure: currentSelection.departure, arrival: newArrival });
    }
  }, [onSelectionChange, currentSelection]);

  // Calculer les coordonnées pour le trajet complet (trait rouge passant par tous les waypoints)
  const routeLine = useMemo(() => {
    // Si on a des waypoints dans le contexte, les utiliser
    if (waypoints && waypoints.length > 0) {
      const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
      if (validWaypoints.length > 0) {
        return validWaypoints.map(wp => [wp.lat, wp.lon]);
      }
    }

    // Fallback : ligne directe départ-arrivée
    if (!searchZone || !searchZone.departure || !searchZone.arrival) return [];
    return [
      [searchZone.departure.lat, searchZone.departure.lon],
      [searchZone.arrival.lat, searchZone.arrival.lon]
    ];
  }, [waypoints, searchZone]);

  // Préparer les marqueurs pour les alternates sélectionnés (points verts)
  const selectedMarkers = useMemo(() => {
    return selectedAlternates
      .filter(alt => alt && alt.position && alt.position.lat && alt.position.lon)
      .filter(alt => alt.icao && /^[A-Z]{4}$/.test(alt.icao)) // Filtrer codes non-ICAO (ex: LF01)
      .map(alt => ({
        position: [alt.position.lat, alt.position.lon],
        icao: alt.icao,
        name: alt.name,
        selectionType: alt.selectionType,
        isSelected: true
      }));
  }, [selectedAlternates]);

  // Préparer les marqueurs pour tous les aérodromes suggérés (points gris)
  const suggestedMarkers = useMemo(() => {
    if (!scoredAlternates || scoredAlternates.length === 0) return [];

    // Récupérer les ICAOs des aérodromes déjà sélectionnés
    const selectedICAOs = new Set(selectedAlternates.map(alt => alt.icao));

    // Filtrer pour n'afficher que les aérodromes non sélectionnés
    return scoredAlternates
      .filter(alt => !selectedICAOs.has(alt.icao))
      .filter(alt => alt && alt.position && alt.position.lat && alt.position.lon)
      .filter(alt => alt.icao && /^[A-Z]{4}$/.test(alt.icao)) // Filtrer codes non-ICAO (ex: LF01)
      .map(alt => ({
        position: [alt.position.lat, alt.position.lon],
        icao: alt.icao,
        name: alt.name,
        score: alt.score,
        distanceToDeparture: alt.distanceToDeparture,
        distanceToArrival: alt.distanceToArrival,
        isSelected: false
      }));
  }, [scoredAlternates, selectedAlternates]);

  // Calculer les lignes perpendiculaires (pointillées vertes) entre la route et les alternates sélectionnés
  const perpendicularLines = useMemo(() => {
    if (!selectedAlternates || selectedAlternates.length === 0 || routeLine.length < 2) {
      return [];
    }

    return selectedAlternates
      .filter(alt => alt && alt.position && alt.position.lat && alt.position.lon)
      .map(alt => {
        const alternatePos = { lat: alt.position.lat, lon: alt.position.lon };
        const closestPoint = getClosestPointOnRoute(alternatePos, routeLine);

        if (!closestPoint) return null;

        const distance = calculateDistance(alternatePos, closestPoint);

        return {
          line: [
            [alternatePos.lat, alternatePos.lon],
            [closestPoint.lat, closestPoint.lon]
          ],
          icao: alt.icao,
          distance: distance
        };
      })
      .filter(line => line !== null);
  }, [selectedAlternates, routeLine]);

  // Calculer les bounds pour ajuster automatiquement la vue
  const bounds = useMemo(() => {
    const points = [];

    // Ajouter les points de la route
    if (routeLine.length > 0) {
      points.push(...routeLine);
    }

    // Ajouter les points des alternates sélectionnés
    selectedMarkers.forEach(marker => {
      points.push(marker.position);
    });

    // Ajouter les points des alternates suggérés
    suggestedMarkers.forEach(marker => {
      points.push(marker.position);
    });

    return points.length > 0 ? points : null;
  }, [routeLine, selectedMarkers, suggestedMarkers]);

  // Centre de la carte (milieu de la route)
  const center = useMemo(() => {
    if (!searchZone || !searchZone.departure || !searchZone.arrival) {
      return [46.603354, 1.888334]; // Centre de la France par défaut
    }

    return [
      (searchZone.departure.lat + searchZone.arrival.lat) / 2,
      (searchZone.departure.lon + searchZone.arrival.lon) / 2
    ];
  }, [searchZone]);

  // Calculer la distance totale de la route (somme de tous les segments)
  const routeDistance = useMemo(() => {
    // Si on a des waypoints, calculer la distance totale du trajet
    if (waypoints && waypoints.length >= 2) {
      const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);
      if (validWaypoints.length >= 2) {
        let totalDistance = 0;
        for (let i = 0; i < validWaypoints.length - 1; i++) {
          totalDistance += calculateDistance(
            { lat: validWaypoints[i].lat, lon: validWaypoints[i].lon },
            { lat: validWaypoints[i + 1].lat, lon: validWaypoints[i + 1].lon }
          );
        }
        return totalDistance;
      }
    }

    // Fallback : distance directe départ-arrivée
    if (!searchZone || !searchZone.departure || !searchZone.arrival) return 0;
    return calculateDistance(searchZone.departure, searchZone.arrival);
  }, [waypoints, searchZone]);

  if (!searchZone || routeLine.length === 0) {
    return (
      <div style={{
        padding: '60px 40px',
        textAlign: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        borderWidth: '2px',
        borderStyle: 'dashed',
        borderColor: '#d1d5db',
        ...style
      }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Aucune route définie
        </p>
      </div>
    );
  }

  return (
    <div style={{
      height: '400px',
      borderRadius: '8px',
      overflow: 'hidden',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: '#e5e7eb',
      ...style
    }}>
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Ajuster automatiquement la vue */}
        {bounds && <FitBounds bounds={bounds} />}

        {/* Cercles de rayon d'action autour du départ et de l'arrivée */}
        {dynamicRadius && searchZone && searchZone.departure && (
          <Circle
            center={[searchZone.departure.lat, searchZone.departure.lon]}
            radius={dynamicRadius * 1852}
            pathOptions={{
              color: '#dc2626',
              fillColor: '#dc2626',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 10'
            }}
          />
        )}
        {dynamicRadius && searchZone && searchZone.arrival && (
          <Circle
            center={[searchZone.arrival.lat, searchZone.arrival.lon]}
            radius={dynamicRadius * 1852}
            pathOptions={{
              color: '#059669',
              fillColor: '#059669',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '5, 10'
            }}
          />
        )}

        {/* Ligne de route (trait rouge) passant par tous les waypoints */}
        {routeLine.length > 0 && (
          <Polyline
            positions={routeLine}
            color="#dc2626"
            weight={3}
            opacity={0.8}
          />
        )}

        {/* Lignes perpendiculaires (pointillées vertes) entre la route et les alternates */}
        {perpendicularLines.map((line, index) => (
          <Polyline
            key={`perpendicular-${line.icao}-${index}`}
            positions={line.line}
            pathOptions={{
              color: '#10b981',
              weight: 2,
              opacity: 0.7,
              dashArray: '5, 10'
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '12px' }}>
                  Distance perpendiculaire
                </strong>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                  {line.icao}: {line.distance.toFixed(1)} NM
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}

        {/* Marqueurs pour les aérodromes suggérés (cercles bleus) */}
        {suggestedMarkers.map((marker, index) => (
          <CircleMarker
            key={`suggested-${marker.icao}-${index}`}
            center={marker.position}
            radius={6}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  ✈️ {marker.icao}
                </strong>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  {marker.name}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                  Score: {((marker.score || 0) * 100).toFixed(0)}%
                </div>
                {marker.distanceToDeparture && (
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    Départ: {marker.distanceToDeparture.toFixed(1)} NM
                  </div>
                )}
                {marker.distanceToArrival && (
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    Arrivée: {marker.distanceToArrival.toFixed(1)} NM
                  </div>
                )}

                {/* Boutons de sélection */}
                {onSelectionChange && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const airport = scoredAlternates.find(a => a.icao === marker.icao);
                        if (airport) handleSelect(airport, 'departure');
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        borderWidth: currentSelection.departure?.icao === marker.icao ? '0' : '1px',
                        borderStyle: 'solid',
                        borderColor: '#dc2626',
                        borderRadius: '4px',
                        backgroundColor: currentSelection.departure?.icao === marker.icao ? '#dc2626' : '#ffffff',
                        color: currentSelection.departure?.icao === marker.icao ? '#ffffff' : '#dc2626',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      {currentSelection.departure?.icao === marker.icao ? '✓' : ''} 🔴 Départ
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const airport = scoredAlternates.find(a => a.icao === marker.icao);
                        if (airport) handleSelect(airport, 'arrival');
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        borderWidth: currentSelection.arrival?.icao === marker.icao ? '0' : '1px',
                        borderStyle: 'solid',
                        borderColor: '#059669',
                        borderRadius: '4px',
                        backgroundColor: currentSelection.arrival?.icao === marker.icao ? '#059669' : '#ffffff',
                        color: currentSelection.arrival?.icao === marker.icao ? '#ffffff' : '#059669',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      {currentSelection.arrival?.icao === marker.icao ? '✓' : ''} 🟢 Arrivée
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Marqueurs pour les aérodromes de déroutement sélectionnés */}
        {selectedMarkers.map((marker, index) => {
          // Couleur selon le type de déroutement : rouge pour départ, vert pour arrivée
          const markerColor = marker.selectionType === 'departure' ? '#dc2626' : '#059669';

          return (
            <CircleMarker
              key={`selected-${marker.icao}-${index}`}
              center={marker.position}
              radius={6}
              pathOptions={{
                color: markerColor,
                fillColor: markerColor,
                fillOpacity: 1,
                weight: 2
              }}
            >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  {marker.selectionType === 'departure' ? '🔴' : '🟢'} {marker.icao}
                </strong>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  {marker.name}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: 'white',
                  backgroundColor: marker.selectionType === 'departure' ? '#dc2626' : '#059669',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-block'
                }}>
                  {marker.selectionType === 'departure' ? 'Déroutement départ' : 'Déroutement arrivée'}
                </div>

                {/* Bouton de désélection */}
                {onSelectionChange && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const airport = selectedAlternates.find(a => a.icao === marker.icao);
                      if (airport) handleSelect(airport, marker.selectionType);
                    }}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    ✗ Désélectionner
                  </button>
                )}
              </div>
            </Popup>
          </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Informations de distance sous la carte */}
      {routeDistance > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f3f4f6',
          borderTop: '1px solid #e5e7eb'
        }}>
          {/* Première ligne : Distance de route et nombre de déroutements */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: selectedMarkers.length === 2 ? '8px' : '0'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '8px' }}>
                Distance de route:
              </span>
              <strong style={{ fontSize: '14px', color: '#93163c' }}>
                {routeDistance.toFixed(1)} NM
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              {suggestedMarkers.length > 0 && (
                <div>
                  <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '8px' }}>
                    Aérodromes suggérés:
                  </span>
                  <strong style={{ fontSize: '14px', color: '#3b82f6' }}>
                    {suggestedMarkers.length}
                  </strong>
                </div>
              )}
              {selectedMarkers.length > 0 && (
                <div>
                  <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '8px' }}>
                    Sélectionnés:
                  </span>
                  <strong style={{ fontSize: '14px', color: '#10b981' }}>
                    {selectedMarkers.length}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Deuxième ligne : Distance entre les déroutements si les deux sont sélectionnés */}
          {(() => {
            const departureAlternate = selectedAlternates.find(alt => alt.selectionType === 'departure');
            const arrivalAlternate = selectedAlternates.find(alt => alt.selectionType === 'arrival');

            if (departureAlternate && arrivalAlternate &&
                departureAlternate.position && arrivalAlternate.position) {
              const distanceBetweenAlternates = calculateDistance(
                departureAlternate.position,
                arrivalAlternate.position
              );

              return (
                <div style={{
                  paddingTop: '8px',
                  borderTop: '1px solid #d1d5db',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
                      Distance entre déroutements:
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#3b82f6' }}>
                      {distanceBetweenAlternates.toFixed(1)} NM
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
                      Trajet:
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                      {departureAlternate.icao} → {arrivalAlternate.icao}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
});

AlternatesMapView.displayName = 'AlternatesMapView';

export default AlternatesMapView;
