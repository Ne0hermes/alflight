import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigation } from '@core/contexts';

// Composant pour ajuster automatiquement la vue de la carte
const MapBoundsUpdater = ({ waypoints }) => {
  const map = useMap();

  useEffect(() => {
    if (waypoints && waypoints.length > 0) {
      const bounds = waypoints
        .filter(wp => wp.lat && wp.lon)
        .map(wp => [wp.lat, wp.lon]);

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    }
  }, [waypoints, map]);

  return null;
};

/**
 * Composant de carte interactive pour la planification de route
 * Affiche les waypoints de navigation et les points VFR sélectionnés
 */
export const RouteMapView = ({ vfrPoints = [], flightPlan = null }) => {
  console.log('🗺️🗺️🗺️ RouteMapView MONTÉ - Début du composant');

  // Récupérer les waypoints depuis le NavigationContext (source de vérité)
  const navigation = useNavigation();
  console.log('🗺️ Navigation context:', navigation);
  const waypoints = navigation?.waypoints || [];
  console.log('🗺️ Waypoints bruts:', waypoints);

  const [center, setCenter] = useState([48.8566, 2.3522]); // Paris par défaut
  const [zoom] = useState(6);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [todPoint, setTodPoint] = useState(null);

  console.log('🗺️ isInitialLoad initial:', isInitialLoad);

  // Les waypoints du NavigationContext incluent déjà départ, arrivée et points intermédiaires
  // Structure: { id, name, lat, lon, type, icao, ... }
  // Filtrer seulement les waypoints avec coordonnées valides
  const validWaypoints = (waypoints || []).filter(wp => wp.lat && wp.lon);

  // Attendre un court délai pour laisser le temps aux données de charger depuis localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 500); // 500ms de délai pour la restauration du localStorage
    return () => clearTimeout(timer);
  }, []);

  // Si des waypoints valides sont trouvés, terminer le chargement immédiatement
  useEffect(() => {
    if (validWaypoints.length > 0 && isInitialLoad) {
      console.log('🗺️ Waypoints détectés, fin du chargement prématurée');
      setIsInitialLoad(false);
    }
  }, [validWaypoints.length, isInitialLoad]);

  // Debug: afficher les waypoints disponibles
  useEffect(() => {
    console.log('🗺️ RouteMapView - isInitialLoad:', isInitialLoad);
    console.log('🗺️ RouteMapView - Waypoints totaux:', waypoints?.length || 0);
    console.log('🗺️ RouteMapView - Waypoints valides (avec coords):', validWaypoints.length);

    // DIAGNOSTIC COMPLET : Afficher TOUS les waypoints avec leur type
    console.log('🗺️ === DIAGNOSTIC WAYPOINTS ===');
    waypoints?.forEach((wp, idx) => {
      console.log(`  [${idx}] ${wp.name || wp.icao || 'VIDE'} - type: "${wp.type}" - coords: ${wp.lat ? 'OUI' : 'NON'}`);
    });
    console.log('🗺️ === FIN DIAGNOSTIC ===');
  }, [waypoints, validWaypoints.length, isInitialLoad]);

  // Identifier le départ et l'arrivée PAR TYPE (pas par position)
  const departure = validWaypoints.find(wp => wp.type === 'departure') || null;
  const arrival = validWaypoints.find(wp => wp.type === 'arrival') || null;

  // Les waypoints intermédiaires sont tous ceux qui ne sont ni départ ni arrivée
  const intermediateWaypoints = validWaypoints.filter(
    wp => wp.type !== 'departure' && wp.type !== 'arrival'
  );

  // Debug: afficher les coordonnées
  useEffect(() => {
    if (departure) {
      console.log('🛫 Départ (type):', departure.type, '-', departure.name || departure.icao, 'lat:', departure.lat, 'lon:', departure.lon);
    }
    if (arrival) {
      console.log('🛬 Arrivée (type):', arrival.type, '-', arrival.name || arrival.icao, 'lat:', arrival.lat, 'lon:', arrival.lon);
    }
    if (intermediateWaypoints.length > 0) {
      console.log('📍 Waypoints intermédiaires:', intermediateWaypoints.length);
      intermediateWaypoints.forEach((wp, idx) => {
        console.log(`  - WP ${idx + 1} (type: ${wp.type}):`, wp.name || wp.icao, 'lat:', wp.lat, 'lon:', wp.lon);
      });
    }
  }, [departure, arrival, intermediateWaypoints.length]);

  // Filtrer les points VFR visibles
  const visibleVFRPoints = vfrPoints.filter(point =>
    point.coordinates?.lat &&
    point.coordinates?.lng &&
    point.visible !== false
  );

  // Préparer les coordonnées pour la ligne de route
  const routeCoordinates = validWaypoints.map(wp => [wp.lat, wp.lon]);

  // Calculer le point de TOD si les données sont disponibles
  useEffect(() => {
    if (flightPlan?.todParameters && arrival) {
      const { distanceToTod } = flightPlan.todParameters;
      if (distanceToTod > 0 && routeCoordinates.length >= 2) {
        // Calculer le point de TOD sur la route
        // Prendre les 2 derniers points de la route (avant l'arrivée)
        const lastSegmentIndex = routeCoordinates.length - 2;
        const pointBeforeArrival = routeCoordinates[lastSegmentIndex];
        const arrivalPoint = routeCoordinates[routeCoordinates.length - 1];

        // Calculer le bearing entre les deux points
        const lat1 = pointBeforeArrival[0] * Math.PI / 180;
        const lat2 = arrivalPoint[0] * Math.PI / 180;
        const dLon = (arrivalPoint[1] - pointBeforeArrival[0]) * Math.PI / 180;

        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const bearing = Math.atan2(y, x);

        // Convertir la distance NM en kilomètres (1 NM = 1.852 km)
        const distanceKm = distanceToTod * 1.852;
        const R = 6371; // Rayon de la Terre en km

        // Calculer le nouveau point depuis l'arrivée en reculant
        const lat = arrivalPoint[0] * Math.PI / 180;
        const lon = arrivalPoint[1] * Math.PI / 180;

        const todLat = Math.asin(
          Math.sin(lat) * Math.cos(distanceKm / R) +
          Math.cos(lat) * Math.sin(distanceKm / R) * Math.cos(bearing + Math.PI)
        );

        const todLon = lon + Math.atan2(
          Math.sin(bearing + Math.PI) * Math.sin(distanceKm / R) * Math.cos(lat),
          Math.cos(distanceKm / R) - Math.sin(lat) * Math.sin(todLat)
        );

        setTodPoint({
          lat: todLat * 180 / Math.PI,
          lon: todLon * 180 / Math.PI,
          distanceToTod
        });
      }
    }
  }, [flightPlan, arrival, routeCoordinates]);

  // Afficher un loader pendant le chargement initial
  if (isInitialLoad) {
    return (
      <div style={{
        height: '500px',
        width: '100%',
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#ddd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        color: '#6b7280',
        fontSize: '14px'
      }}>
        🗺️ Chargement de la carte...
      </div>
    );
  }

  // Afficher un message si aucun aérodrome n'est défini (après le chargement initial)
  if (!departure && !arrival) {
    return (
      <div style={{
        height: '500px',
        width: '100%',
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#ddd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        color: '#6b7280',
        fontSize: '14px',
        fontStyle: 'italic'
      }}>
        📍 Ajoutez des aérodromes de départ et d'arrivée dans le module de navigation ci-dessous
      </div>
    );
  }

  return (
    <div style={{ height: '500px', width: '100%', borderRadius: '8px', overflow: 'hidden', borderWidth: '1px', borderStyle: 'solid', borderColor: '#ddd' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        {/* Couche de tuiles OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Ajuster automatiquement la vue */}
        <MapBoundsUpdater waypoints={validWaypoints} />

        {/* Ligne de route - Différencier aller et retour */}
        {routeCoordinates.length > 1 && (() => {
          // Détecter si c'est une navigation circulaire (retour au départ)
          const isCircular = departure && arrival &&
            (departure.name === arrival.name ||
             (departure.icao && arrival.icao && departure.icao === arrival.icao));

          if (isCircular && routeCoordinates.length > 2) {
            // Trouver le point médian (milieu de la route)
            const midpointIndex = Math.floor(routeCoordinates.length / 2);

            // Segmenter la route en aller et retour
            const outboundRoute = routeCoordinates.slice(0, midpointIndex + 1);
            const returnRoute = routeCoordinates.slice(midpointIndex);

            return (
              <>
                {/* Aller (bordeaux) */}
                <Polyline
                  positions={outboundRoute}
                  color="#93163c"
                  weight={3}
                  opacity={0.7}
                  dashArray="10, 0"
                />
                {/* Retour (bleu) */}
                <Polyline
                  positions={returnRoute}
                  color="#1e40af"
                  weight={3}
                  opacity={0.7}
                  dashArray="5, 5"
                />
              </>
            );
          } else {
            // Route simple (pas circulaire)
            return (
              <Polyline
                positions={routeCoordinates}
                color="#93163c"
                weight={3}
                opacity={0.7}
              />
            );
          }
        })()}

        {/* Marqueur de départ (premier waypoint) */}
        {departure && (
          <CircleMarker
            center={[departure.lat, departure.lon]}
            radius={8}
            pathOptions={{
              color: '#93163c',
              fillColor: '#93163c',
              fillOpacity: 1,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '13px' }}>🛫 {departure.icao || departure.name || 'Départ'}</strong>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Marqueur d'arrivée (aérodrome d'arrivée par type) */}
        {arrival && (
          <CircleMarker
            center={[arrival.lat, arrival.lon]}
            radius={8}
            pathOptions={{
              color: '#93163c',
              fillColor: '#93163c',
              fillOpacity: 1,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '13px' }}>🛬 {arrival.icao || arrival.name || 'Arrivée'}</strong>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Marqueurs des points VFR */}
        {visibleVFRPoints.map((point, index) => (
          <CircleMarker
            key={`vfr-${index}`}
            center={[point.coordinates.lat, point.coordinates.lng]}
            radius={6}
            pathOptions={{
              color: '#93163c',
              fillColor: '#93163c',
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '13px' }}>📍 {point.name || 'Point VFR'}</strong>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Marqueurs des waypoints intermédiaires (points VFR, waypoints, etc.) */}
        {intermediateWaypoints.map((waypoint, index) => (
          <CircleMarker
            key={waypoint.id || `waypoint-${index}`}
            center={[waypoint.lat, waypoint.lon]}
            radius={6}
            pathOptions={{
              color: '#93163c',
              fillColor: '#93163c',
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '13px' }}>
                  {waypoint.type === 'vfr' ? '📍' : '⚓'} {waypoint.icao || waypoint.name || `WP${index + 1}`}
                </strong>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Marqueur du Top of Descent (TOD) */}
        {todPoint && (
          <CircleMarker
            center={[todPoint.lat, todPoint.lon]}
            radius={8}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.9,
              weight: 3
            }}
          >
            <Popup>
              <div style={{ padding: '6px' }}>
                <strong style={{ fontSize: '13px', color: '#f59e0b' }}>
                  ⬇️ Top of Descent (TOD)
                </strong>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#6b7280' }}>
                  À {todPoint.distanceToTod.toFixed(1)} NM de l'arrivée
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
};

export default RouteMapView;
