// src/features/navigation/components/NavigationMap.jsx
import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, ZoomControl, LayersControl, LayerGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, AlertTriangle, Info, Map } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

// Import des styles Leaflet - TRÈS IMPORTANT
import 'leaflet/dist/leaflet.css';

// Correction du problème d'icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icônes personnalisées pour les waypoints
const createIcon = (color, type) => {
  const svgIcon = `
    <svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C7.5 0 1 6.5 1 14C1 24.5 15 40 15 40C15 40 29 24.5 29 14C29 6.5 22.5 0 15 0Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="14" r="6" fill="#ffffff"/>
      <text x="15" y="18" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${type}</text>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
    className: 'custom-waypoint-icon'
  });
};

const WAYPOINT_ICONS = {
  departure: createIcon('#10b981', 'D'),
  arrival: createIcon('#f59e0b', 'A'),
  waypoint: createIcon('#3b82f6', 'W'),
  alternate: createIcon('#ef4444', 'ALT')
};

// Composant pour gérer les changements de vue
const MapViewController = ({ waypoints, setZoomWarning }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !waypoints || waypoints.length === 0) return;
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) return;
    
    try {
      if (validWaypoints.length === 1) {
        // Un seul waypoint : centrer dessus
        map.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
        setZoomWarning(false);
      } else {
        // Plusieurs waypoints : ajuster la vue pour tous les voir
        const bounds = L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        
        // Calculer la distance maximale pour anticiper le zoom
        let maxDistance = 0;
        for (let i = 0; i < validWaypoints.length - 1; i++) {
          for (let j = i + 1; j < validWaypoints.length; j++) {
            const dist = L.latLng(validWaypoints[i].lat, validWaypoints[i].lon)
              .distanceTo(L.latLng(validWaypoints[j].lat, validWaypoints[j].lon));
            maxDistance = Math.max(maxDistance, dist);
          }
        }
        
        // Si la distance est très grande, avertir l'utilisateur
        const distanceKm = maxDistance / 1000;
        if (distanceKm > 1000) {
          setZoomWarning(true);
          console.log('⚠️ Distance très importante:', distanceKm.toFixed(0), 'km');
        } else {
          setZoomWarning(false);
        }
        
        // IMPORTANT: Limiter le zoom pour rester dans les limites OpenAIP
        map.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 12,  // Pas trop près
          minZoom: 5    // Pas trop loin (OpenAIP minimum = 4)
        });
        
        // Vérifier et ajuster le zoom si nécessaire
        setTimeout(() => {
          try {
            const currentZoom = map.getZoom();
            console.log('🔍 Zoom actuel:', currentZoom);
            
            // Si le zoom est trop faible pour OpenAIP, le remonter
            if (currentZoom < 5) {
              console.log('⚠️ Zoom trop faible pour OpenAIP, ajustement à 5');
              map.setZoom(5);
            }
            // Si le zoom est trop fort pour OpenAIP, le baisser
            else if (currentZoom > 12) {
              console.log('⚠️ Zoom trop fort pour OpenAIP, ajustement à 12');
              map.setZoom(12);
            }
          } catch (error) {
            console.warn('Erreur lors de l\'ajustement du zoom:', error);
          }
        }, 300);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajustement de la vue:', error);
    }
  }, [waypoints, map, setZoomWarning]);
  
  return null;
};

export const NavigationMap = memo(({ waypoints, onWaypointUpdate, selectedAircraft }) => {
  const [mapReady, setMapReady] = useState(false);
  const [zoomWarning, setZoomWarning] = useState(false);
  const mapRef = useRef(null);
  const [mapKey, setMapKey] = useState(Date.now()); // Clé unique pour forcer la réinitialisation
  
  // Clé API OpenAIP fournie
  const openAIPToken = '2717b9196e8100ee2456e09b82b5b08e';

  // Centre par défaut (France) avec zoom sûr pour OpenAIP
  const defaultCenter = [46.603354, 1.888334];
  const defaultZoom = 6; // Zoom sûr pour OpenAIP (entre 5 et 12)

  // Nettoyer la carte au démontage
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current = null;
      }
    };
  }, []);

  // Calcul du centre initial (utilisé uniquement à l'initialisation)
  const initialCenter = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) {
      return defaultCenter;
    }
    
    // Si un seul waypoint, centrer dessus
    if (validWaypoints.length === 1) {
      return [validWaypoints[0].lat, validWaypoints[0].lon];
    }
    
    // Sinon, calculer le centre entre tous les waypoints
    const bounds = L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
    const center = bounds.getCenter();
    return [center.lat, center.lng];
  }, []); // Calcul uniquement à l'initialisation

  // Créer la route entre les waypoints
  const route = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    return validWaypoints.length > 1 ? validWaypoints.map(w => [w.lat, w.lon]) : [];
  }, [waypoints]);

  // Calcul de la distance totale
  const totalDistance = useMemo(() => {
    let distance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      distance += L.latLng(route[i]).distanceTo(L.latLng(route[i + 1]));
    }
    return (distance / 1852).toFixed(1); // Conversion en NM
  }, [route]);

  // Configuration des cartes
  const openAIPLayerUrl = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${openAIPToken}`;
  const openAIPAirspaceUrl = `https://api.tiles.openaip.net/api/data/airspace/{z}/{x}/{y}.png?apiKey=${openAIPToken}`;
  const openAIPAirportUrl = `https://api.tiles.openaip.net/api/data/airport/{z}/{x}/{y}.png?apiKey=${openAIPToken}`;
  const openAIPAttribution = '&copy; <a href="https://www.openaip.net" target="_blank">OpenAIP</a> - Carte aéronautique';
  
  // Cartes alternatives gratuites
  const openTopoMapUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
  const openTopoMapAttribution = '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors';
  
  const cartoDBUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  const cartoDBAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  // Debug
  useEffect(() => {
    console.log('🗺️ NavigationMap monté avec clé:', mapKey);
    console.log('📍 Centre initial:', initialCenter);
    console.log('✈️ Waypoints valides:', waypoints.filter(w => w.lat && w.lon).length);
    console.log('🔑 Token OpenAIP:', openAIPToken ? 'Configuré' : 'Manquant');
  }, [initialCenter, waypoints, openAIPToken, mapKey]);

  return (
    <div style={styles.mapContainer}>
      {/* Avertissement pour les distances importantes */}
      {zoomWarning && (
        <div style={styles.zoomWarning}>
          <AlertTriangle size={16} />
          <span style={{ marginLeft: '8px' }}>
            Distance importante détectée. Si la carte OpenAIP ne s'affiche pas correctement, 
            basculez sur "OpenStreetMap" avec le sélecteur en haut à droite.
          </span>
        </div>
      )}
      
      <MapContainer
        key={mapKey} // Clé unique pour forcer la réinitialisation
        ref={mapRef}
        center={initialCenter}
        zoom={6} // Toujours commencer avec un zoom sûr pour OpenAIP
        minZoom={3} // Permettre un zoom arrière minimal
        maxZoom={15} // Permettre un zoom avant maximal
        style={styles.map}
        whenReady={(map) => {
          console.log('✅ Carte prête');
          setMapReady(true);
          
          // Forcer le redimensionnement
          if (map && map.target) {
            setTimeout(() => {
              try {
                map.target.invalidateSize();
              } catch (error) {
                console.warn('Erreur lors du redimensionnement de la carte:', error);
              }
            }, 100);
            
            // Écouter les changements de zoom
            map.target.on('zoomend', () => {
              const currentZoom = map.target.getZoom();
              console.log('🔍 Changement de zoom:', currentZoom);
              
              // Avertir si on sort des limites OpenAIP
              if (currentZoom < 5 || currentZoom > 12) {
                console.log('⚠️ Zoom hors limites OpenAIP (5-12)');
              }
            });
          }
        }}
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        
        {/* Composant pour gérer les changements de vue */}
        <MapViewController waypoints={waypoints} setZoomWarning={setZoomWarning} />
        
        <LayersControl position="topright">
          {/* Groupe de cartes de base */}
          
          {/* OpenStreetMap comme base fiable */}
          <LayersControl.BaseLayer checked name="OpenStreetMap + OpenAIP">
            <LayerGroup>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
              />
              {/* Superposer OpenAIP si disponible */}
              <TileLayer
                url={openAIPLayerUrl}
                attribution={openAIPAttribution}
                tileSize={256}
                minZoom={5}
                maxZoom={12}
                opacity={0.7}
                errorTileUrl=""
              />
            </LayerGroup>
          </LayersControl.BaseLayer>
          
          {/* OpenStreetMap seul */}
          <LayersControl.BaseLayer name="OpenStreetMap seul">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          
          {/* Carte topographique */}
          <LayersControl.BaseLayer name="Carte Topographique">
            <TileLayer
              url={openTopoMapUrl}
              attribution={openTopoMapAttribution}
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
          
          {/* Carte CartoDB claire */}
          <LayersControl.BaseLayer name="Carte Claire">
            <TileLayer
              url={cartoDBUrl}
              attribution={cartoDBAttribution}
              subdomains='abcd'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          
          {/* Vue satellite */}
          <LayersControl.BaseLayer name="Vue satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          
          {/* Overlay: Espaces aériens OpenAIP */}
          <LayersControl.Overlay name="Espaces aériens" checked>
            <TileLayer
              url={openAIPAirspaceUrl}
              attribution=""
              tileSize={256}
              minZoom={5}
              maxZoom={12}
              opacity={0.7}
            />
          </LayersControl.Overlay>
          
          {/* Overlay: Aérodromes OpenAIP */}
          <LayersControl.Overlay name="Aérodromes" checked>
            <TileLayer
              url={openAIPAirportUrl}
              attribution=""
              tileSize={256}
              minZoom={5}
              maxZoom={12}
              opacity={0.8}
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* Route */}
        {route.length > 1 && (
          <Polyline
            positions={route}
            color="#3b82f6"
            weight={3}
            opacity={0.8}
            dashArray="10, 5"
          />
        )}

        {/* Waypoints */}
        {waypoints.map((waypoint, index) => {
          if (!waypoint.lat || !waypoint.lon) return null;

          const icon = index === 0 
            ? WAYPOINT_ICONS.departure 
            : index === waypoints.length - 1 
            ? WAYPOINT_ICONS.arrival 
            : WAYPOINT_ICONS.waypoint;

          return (
            <Marker
              key={waypoint.id}
              position={[waypoint.lat, waypoint.lon]}
              icon={icon}
              draggable={onWaypointUpdate ? true : false}
              eventHandlers={{
                dragend: (e) => {
                  if (onWaypointUpdate) {
                    const newPos = e.target.getLatLng();
                    onWaypointUpdate(waypoint.id, {
                      lat: newPos.lat,
                      lon: newPos.lng
                    });
                  }
                }
              }}
            >
              <Popup>
                <div style={{ minWidth: '150px' }}>
                  <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                    {waypoint.name || `Point ${index + 1}`}
                  </h4>
                  <p style={sx.text.sm}>
                    Lat: {waypoint.lat.toFixed(4)}°<br />
                    Lon: {waypoint.lon.toFixed(4)}°
                    {waypoint.elevation && (
                      <>
                        <br />Alt: {waypoint.elevation} ft
                      </>
                    )}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Panneau d'information */}
      {mapReady && route.length > 0 && (
        <div style={styles.infoPanel}>
          <div style={styles.infoPanelContent}>
            <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              <Navigation size={16} style={{ marginRight: '4px' }} />
              Information de vol
            </h4>
            <div style={sx.text.xs}>
              <p>Distance totale : <strong>{totalDistance} NM</strong></p>
              <p>Waypoints : <strong>{waypoints.filter(w => w.lat && w.lon).length}</strong></p>
              {selectedAircraft && (
                <>
                  <p>Temps estimé : <strong>{(totalDistance / selectedAircraft.cruiseSpeedKt).toFixed(1)} h</strong></p>
                  <p>Carburant : <strong>{(totalDistance / selectedAircraft.cruiseSpeedKt * selectedAircraft.fuelConsumption).toFixed(1)} L</strong></p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Légende des couches */}
      <div style={styles.legendPanel}>
        <div style={styles.legendContent}>
          <h5 style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>
            Légende OpenAIP
          </h5>
          <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
            <p>🔵 CTR/TMA</p>
            <p>🟡 Zone réglementée</p>
            <p>🔴 Zone dangereuse</p>
            <p>✈️ Aérodrome</p>
          </div>
        </div>
      </div>
    </div>
  );
});

const styles = {
  mapContainer: {
    position: 'relative',
    width: '100%',
    height: '500px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb'
  },
  map: {
    width: '100%',
    height: '100%'
  },
  zoomWarning: {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '8px 16px',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    maxWidth: '80%'
  },
  infoPanel: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 400
  },
  infoPanelContent: {
    padding: '12px 16px'
  },
  legendPanel: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 400
  },
  legendContent: {
    padding: '12px 16px'
  }
};

NavigationMap.displayName = 'NavigationMap';

export default NavigationMap;