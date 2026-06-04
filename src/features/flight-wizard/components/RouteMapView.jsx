import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-polylinedecorator';
import { useNavigation } from '@core/contexts';

// Fonction pour appliquer un offset perpendiculaire à une ligne
// Cela permet de séparer visuellement les lignes qui se superposent
const applyPerpendicularOffset = (coordinates, offsetMeters = 50) => {
  if (coordinates.length < 2) return coordinates;

  const offsetCoords = [];

  for (let i = 0; i < coordinates.length; i++) {
    const [lat, lon] = coordinates[i];

    // Calculer la direction perpendiculaire
    let perpLat, perpLon;

    if (i === 0) {
      // Premier point : utiliser la direction vers le point suivant
      const [nextLat, nextLon] = coordinates[i + 1];
      const deltaLat = nextLat - lat;
      const deltaLon = nextLon - lon;
      perpLat = -deltaLon;
      perpLon = deltaLat;
    } else if (i === coordinates.length - 1) {
      // Dernier point : utiliser la direction depuis le point précédent
      const [prevLat, prevLon] = coordinates[i - 1];
      const deltaLat = lat - prevLat;
      const deltaLon = lon - prevLon;
      perpLat = -deltaLon;
      perpLon = deltaLat;
    } else {
      // Points intermédiaires : moyenne des deux directions
      const [prevLat, prevLon] = coordinates[i - 1];
      const [nextLat, nextLon] = coordinates[i + 1];
      const deltaLat1 = lat - prevLat;
      const deltaLon1 = lon - prevLon;
      const deltaLat2 = nextLat - lat;
      const deltaLon2 = nextLon - lon;
      perpLat = -(deltaLon1 + deltaLon2) / 2;
      perpLon = (deltaLat1 + deltaLat2) / 2;
    }

    // Normaliser et appliquer l'offset
    const length = Math.sqrt(perpLat * perpLat + perpLon * perpLon);
    if (length > 0) {
      // Convertir les mètres en degrés (approximation)
      const metersToDegreesLat = offsetMeters / 111000; // 1 degré ≈ 111 km
      const metersToDegreesLon = offsetMeters / (111000 * Math.cos(lat * Math.PI / 180));

      const normPerpLat = (perpLat / length) * metersToDegreesLat;
      const normPerpLon = (perpLon / length) * metersToDegreesLon;

      offsetCoords.push([lat + normPerpLat, lon + normPerpLon]);
    } else {
      offsetCoords.push([lat, lon]);
    }
  }

  return offsetCoords;
};

// Composant pour forcer le recalcul de la taille de la carte
// Utile quand la carte est dans une section collapsible
const MapSizeInvalidator = () => {
  const map = useMap();

  useEffect(() => {
    // Fonction pour invalider la taille
    const invalidate = () => {
      try {
        map.invalidateSize({ pan: false });
      } catch (e) {
        console.warn('Map invalidateSize error:', e);
      }
    };

    // Invalider immédiatement et de manière répétée
    invalidate();
    const timer1 = setTimeout(invalidate, 100);
    const timer2 = setTimeout(invalidate, 300);
    const timer3 = setTimeout(invalidate, 500);
    const timer4 = setTimeout(invalidate, 1000);
    const timer5 = setTimeout(invalidate, 2000);

    // Invalider sur resize de la fenêtre
    const handleResize = () => invalidate();
    window.addEventListener('resize', handleResize);

    // Observer pour détecter changements de visibilité
    const container = map.getContainer();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          invalidate();
          setTimeout(invalidate, 100);
        }
      });
    });

    if (container) {
      observer.observe(container);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [map]);

  return null;
};

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

// Composant pour ajouter des flèches sur les polylines avec polylineDecorator
const PolylineWithArrows = ({ positions, color, weight, opacity, dashArray, isReturn }) => {
  const map = useMap();
  const polylineRef = useRef(null);
  const decoratorRef = useRef(null);

  useEffect(() => {
    if (!map || !positions || positions.length < 2) return;

    // Créer la polyline
    const polyline = L.polyline(positions, {
      color: color,
      weight: weight,
      opacity: opacity,
      dashArray: dashArray
    }).addTo(map);

    polylineRef.current = polyline;

    // Ajouter des flèches avec polylineDecorator
    const decorator = L.polylineDecorator(polyline, {
      patterns: [
        {
          offset: '50%',
          repeat: 150, // Distance en pixels entre les flèches
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: false,
            pathOptions: {
              stroke: true,
              color: color,
              weight: 2,
              opacity: opacity,
              fill: true,
              fillColor: color,
              fillOpacity: opacity
            }
          })
        }
      ]
    }).addTo(map);

    decoratorRef.current = decorator;

    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
      }
      if (decoratorRef.current) {
        map.removeLayer(decoratorRef.current);
      }
    };
  }, [map, positions, color, weight, opacity, dashArray]);

  return null;
};

/**
 * Calcule la position géographique du point TOD sur la trajectoire
 * @param {Object} arrival - Waypoint d'arrivée
 * @param {number} distanceToTodNM - Distance du TOD en NM avant l'arrivée
 * @param {Array} waypoints - Tous les waypoints de la route
 * @returns {Object|null} - {lat, lon} du point TOD
 */
function calculateTodPosition(arrival, distanceToTodNM, waypoints) {
  if (!arrival || !distanceToTodNM || distanceToTodNM <= 0 || !waypoints || waypoints.length < 2) {
    return null;
  }

  // Convertir NM en km
  const distanceToTodKM = distanceToTodNM * 1.852;

  // Parcourir la route en sens inverse depuis l'arrivée
  let remainingDistance = distanceToTodKM;

  for (let i = waypoints.length - 1; i > 0; i--) {
    const to = waypoints[i];
    const from = waypoints[i - 1];

    if (!to.lat || !to.lon || !from.lat || !from.lon) continue;

    // Calculer la distance de ce segment
    const segmentDistance = calculateDistanceKM(from.lat, from.lon, to.lat, to.lon);

    if (remainingDistance <= segmentDistance) {
      // Le point TOD est sur ce segment
      const ratio = remainingDistance / segmentDistance;

      // Interpolation linéaire
      const todLat = to.lat - (to.lat - from.lat) * ratio;
      const todLon = to.lon - (to.lon - from.lon) * ratio;

      return { lat: todLat, lon: todLon };
    }

    remainingDistance -= segmentDistance;
  }

  // Si on arrive ici, le TOD est avant le premier waypoint
  return null;
}

/**
 * Calcule la distance entre deux points en km
 */
function calculateDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Composant de carte interactive pour la planification de route
 * Affiche les waypoints de navigation et les points VFR sélectionnés
 */
export const RouteMapView = ({ vfrPoints = [], flightPlan = null, todCalculation = null }) => {
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
  // Utilisation de useMemo pour éviter une boucle infinie dans le useEffect ligne 285
  const validWaypoints = React.useMemo(() => {
    return (waypoints || []).filter(wp => wp.lat && wp.lon);
  }, [waypoints]);

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

  // Préparer les coordonnées pour la ligne de route
  const routeCoordinates = validWaypoints.map(wp => [wp.lat, wp.lon]);

  // 🛬 Calculer le point de TOD si les données sont disponibles
  useEffect(() => {
    if (todCalculation && !todCalculation.error && arrival && validWaypoints.length >= 2) {
      const distanceToTodNM = parseFloat(todCalculation.distanceToTod);

      if (distanceToTodNM > 0) {
        console.log('🛬 Calcul position TOD:', {
          distanceToTodNM,
          arrivalName: arrival.name || arrival.icao,
          waypointsCount: validWaypoints.length
        });

        const todPosition = calculateTodPosition(arrival, distanceToTodNM, validWaypoints);

        if (todPosition) {
          setTodPoint({
            ...todPosition,
            distanceToTod: distanceToTodNM,
            arrivalName: arrival.name || arrival.icao,
            cruiseAltitude: todCalculation.cruiseAltitude,
            targetAltitude: todCalculation.targetAltitude,
            descentRate: todCalculation.descentRate
          });
          console.log('✅ Point TOD calculé:', todPosition);
        } else {
          console.warn('⚠️ Impossible de calculer la position TOD');
          setTodPoint(null);
        }
      } else {
        setTodPoint(null);
      }
    } else {
      setTodPoint(null);
    }
  }, [todCalculation, arrival, validWaypoints]);

  // Calculer les positions des flèches le long de la route
  const arrowMarkers = useMemo(() => {
    if (routeCoordinates.length < 2) return [];

    const markers = [];

    // Placer une flèche au milieu de chaque segment
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const [lat1, lon1] = routeCoordinates[i];
      const [lat2, lon2] = routeCoordinates[i + 1];

      // Point au milieu du segment
      const midLat = (lat1 + lat2) / 2;
      const midLon = (lon1 + lon2) / 2;

      // Calculer l'angle de rotation pour la flèche
      const angle = Math.atan2(lon2 - lon1, lat2 - lat1) * (180 / Math.PI);

      markers.push({
        position: [midLat, midLon],
        angle: angle,
        segmentIndex: i
      });
    }

    return markers;
  }, [routeCoordinates]);

  // Afficher un loader pendant le chargement initial
  if (isInitialLoad) {
    return (
      <div style={{
        height: '500px',
        width: '100%',
        borderRadius: 'var(--radius-sm)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        color: 'var(--text-secondary)',
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
        borderRadius: 'var(--radius-sm)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        color: 'var(--text-secondary)',
        fontSize: '14px',
        fontStyle: 'italic'
      }}>
        📍 Ajoutez des aérodromes de départ et d'arrivée dans le module de navigation ci-dessous
      </div>
    );
  }

  return (
    <>
      {/* Styles pour l'impression PDF */}
      <style>{`
        @media print {
          .route-map-container {
            height: 800px !important;
            min-height: 800px !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
            overflow: visible !important;
            display: block !important;
          }
          .route-map-container .leaflet-container {
            height: 800px !important;
            min-height: 800px !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }

        @media screen {
          .route-map-container {
            min-height: 500px !important;
          }
          .route-map-container .leaflet-container {
            min-height: 500px !important;
          }
        }
      `}</style>

      <div
        className="route-map-container"
        style={{ height: '500px', width: '100%', borderRadius: 'var(--radius-sm)', overflow: 'hidden', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-subtle)' }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={false}
        >
        {/* Couche de tuiles OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Forcer le recalcul de la taille (pour sections collapsibles) */}
        <MapSizeInvalidator />

        {/* Ajuster automatiquement la vue */}
        <MapBoundsUpdater waypoints={validWaypoints} />

        {/* Ligne de route avec flèches - Différencier aller et retour */}
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

            // Appliquer un offset perpendiculaire à la ligne de retour pour éviter la superposition
            const offsetReturnRoute = applyPerpendicularOffset(returnRoute, 50);

            return (
              <>
                {/* Aller (bordeaux) avec flèches */}
                <PolylineWithArrows
                  positions={outboundRoute}
                  color="#f26921"
                  weight={3}
                  opacity={0.7}
                  dashArray="10, 0"
                  isReturn={false}
                />
                {/* Retour (bleu) avec flèches */}
                <PolylineWithArrows
                  positions={offsetReturnRoute}
                  color="var(--text-primary)"
                  weight={3}
                  opacity={0.7}
                  dashArray="5, 5"
                  isReturn={true}
                />
              </>
            );
          } else {
            // Route simple (pas circulaire) avec flèches
            return (
              <PolylineWithArrows
                positions={routeCoordinates}
                color="#f26921"
                weight={3}
                opacity={0.7}
                isReturn={false}
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
              color: '#f26921',
              fillColor: '#f26921',
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
              color: '#f26921',
              fillColor: '#f26921',
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

        {/* Marqueurs des waypoints intermédiaires (points VFR, waypoints, etc.) */}
        {intermediateWaypoints.map((waypoint, index) => (
          <CircleMarker
            key={waypoint.id || `waypoint-${index}`}
            center={[waypoint.lat, waypoint.lon]}
            radius={6}
            pathOptions={{
              color: '#f26921',
              fillColor: '#f26921',
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
            radius={10}
            pathOptions={{
              color: 'var(--accent-primary)',
              fillColor: 'rgba(242, 105, 33, 0.10)',
              fillOpacity: 0.9,
              weight: 3
            }}
          >
            <Popup>
              <div style={{ padding: '8px', minWidth: '200px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px' }}>
                  ⬇️ Top of Descent (TOD)
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Arrivée :</strong> {todPoint.arrivalName}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Distance TOD :</strong> {todPoint.distanceToTod.toFixed(1)} NM
                  </div>
                  {todPoint.cruiseAltitude && (
                    <>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Altitude croisière :</strong> {todPoint.cruiseAltitude} ft
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Altitude cible :</strong> {todPoint.targetAltitude} ft
                      </div>
                      <div>
                        <strong>Taux descente :</strong> {todPoint.descentRate} ft/min
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
    </>
  );
};

export default RouteMapView;
