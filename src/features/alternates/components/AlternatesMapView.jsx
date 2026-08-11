// src/features/alternates/components/AlternatesMapView.jsx
import React, { memo, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Popup, Circle, CircleMarker, useMap } from 'react-leaflet';
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
  selection = [],
  style = {}
}) => {
  // Récupérer les waypoints de l'étape 2 pour afficher le trajet complet
  const { waypoints } = useNavigation();

  // 🔧 LOT 7 — sélection SIMPLE : ajoute/retire l'aérodrome de la liste
  const handleToggle = React.useCallback((airport) => {
    if (!onSelectionChange || !airport) return;
    const isSelected = (selection || []).some(alt => alt?.icao === airport.icao);
    const next = isSelected
      ? (selection || []).filter(alt => alt.icao !== airport.icao)
      : [...(selection || []), airport];
    onSelectionChange(next);
  }, [onSelectionChange, selection]);

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
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: 'var(--radius-sm)',
        borderWidth: '2px',
        borderStyle: 'dashed',
        borderColor: 'var(--text-tertiary)',
        ...style
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-body)' }}>
          Aucune route définie
        </p>
      </div>
    );
  }

  // 🔧 REVUE LOT 9 — le conteneur 400px overflow:hidden ne DOIT contenir que la
  // carte : la mention OSM et les infos de distance vivent APRÈS lui (elles
  // étaient clippées, donc invisibles).
  return (
    <>
    <div style={{
      height: '400px',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'var(--border-subtle)',
      ...style
    }}>
      <MapContainer
        center={center}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
      >
        {/* 🔧 LOT 9-B — contrôle d'attribution masqué sur la carte (demande
            pilote) ; la mention licence OSM reste affichée sous la carte */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Ajuster automatiquement la vue */}
        {bounds && <FitBounds bounds={bounds} />}

        {/* 🔧 LOT 9-A — la BANDE orange du corridor (« pilule ») n'est plus
            dessinée, à la demande du pilote : le corridor reste actif comme
            FILTRE (curseur 0-50 NM) et la liste affiche la distance à la route,
            mais la carte ne superpose plus de zone colorée. */}

        {/* Repli : ancien cercle circulaire si la zone n'est pas un corridor */}
        {searchZone?.type !== 'corridor' && dynamicRadius && searchZone && searchZone.departure && (
          <Circle
            center={[searchZone.departure.lat, searchZone.departure.lon]}
            radius={dynamicRadius * 1852}
            pathOptions={{
              color: 'var(--accent-primary)',
              fillColor: 'var(--accent-primary)',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '5, 10'
            }}
          />
        )}

        {/* Ligne de route (trait rouge) passant par tous les waypoints */}
        {routeLine.length > 0 && (
          <Polyline
            positions={routeLine}
            color="var(--color-red-critical)"
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
              color: 'var(--text-primary)',
              weight: 2,
              opacity: 0.7,
              dashArray: '5, 10'
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: 'var(--fs-body)' }}>
                  Distance perpendiculaire
                </strong>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '4px' }}>
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
              color: 'var(--accent-primary)',
              fillColor: 'var(--accent-primary)',
              fillOpacity: 0.9,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: 'var(--fs-body)', display: 'block', marginBottom: '4px' }}>
                  ✈️ {marker.icao}
                </strong>
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {marker.name}
                </div>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Score: {((marker.score || 0) * 100).toFixed(0)}%
                </div>
                {marker.distanceToDeparture && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    Départ: {marker.distanceToDeparture.toFixed(1)} NM
                  </div>
                )}
                {marker.distanceToArrival && (
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                    Arrivée: {marker.distanceToArrival.toFixed(1)} NM
                  </div>
                )}

                {/* 🔧 LOT 7 — bouton de sélection unique (plus de côté) */}
                {onSelectionChange && (
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-subtle)'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const airport = scoredAlternates.find(a => a.icao === marker.icao);
                        if (airport) handleToggle(airport);
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: '#ffffff',
                        color: 'var(--accent-primary)',
                        cursor: 'pointer',
                        fontSize: 'var(--fs-caption)',
                        fontWeight: 'bold',
                        transition: 'all 0.2s'
                      }}
                    >
                      + Sélectionner en déroutement
                    </button>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 🔧 LOT 7 — Marqueurs des déroutements sélectionnés (couleur unique) */}
        {selectedMarkers.map((marker, index) => (
          <CircleMarker
            key={`selected-${marker.icao}-${index}`}
            center={marker.position}
            radius={6}
            pathOptions={{
              color: 'var(--accent-primary)',
              fillColor: 'var(--accent-primary)',
              fillOpacity: 1,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: 'var(--fs-body)', display: 'block', marginBottom: '4px' }}>
                  🛬 {marker.icao}
                </strong>
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {marker.name}
                </div>
                <div style={{
                  fontSize: 'var(--fs-caption)',
                  color: '#ffffff',
                  backgroundColor: 'var(--accent-primary)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'inline-block'
                }}>
                  Déroutement sélectionné
                </div>

                {/* Bouton de désélection */}
                {onSelectionChange && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const airport = selectedAlternates.find(a => a.icao === marker.icao);
                      if (airport) handleToggle(airport);
                    }}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-red-critical)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: 'var(--fs-caption)',
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
        ))}
      </MapContainer>
    </div>

      {/* Mention licence OSM (obligatoire ODbL) — discrète, SOUS le conteneur */}
      <div style={{ padding: '2px 8px', fontSize: '9px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
        Fond de carte © contributeurs OpenStreetMap
      </div>

      {/* Informations de distance sous la carte */}
      {routeDistance > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--bg-overlay)',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {/* Première ligne : Distance de route et nombre de déroutements */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0'
          }}>
            <div>
              <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginRight: '8px' }}>
                Distance de route:
              </span>
              <strong style={{ fontSize: 'var(--fs-body)', color: '#f26921' }}>
                {routeDistance.toFixed(1)} NM
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              {suggestedMarkers.length > 0 && (
                <div>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginRight: '8px' }}>
                    Aérodromes suggérés:
                  </span>
                  <strong style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
                    {suggestedMarkers.length}
                  </strong>
                </div>
              )}
              {selectedMarkers.length > 0 && (
                <div>
                  <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', marginRight: '8px' }}>
                    Sélectionnés:
                  </span>
                  <strong style={{ fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>
                    {selectedMarkers.length}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* 🔧 LOT 7 — le bloc « distance entre déroutements départ/arrivée »
              a été retiré avec la disparition des côtés de sélection */}
        </div>
      )}
    </>
  );
});

AlternatesMapView.displayName = 'AlternatesMapView';

export default AlternatesMapView;
