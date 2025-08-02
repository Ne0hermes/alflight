// src/features/navigation/components/NavigationMap.jsx
import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, ZoomControl, LayersControl } from 'react-leaflet';
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

export const NavigationMap = memo(({ waypoints, onWaypointUpdate, selectedAircraft }) => {
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  
  // Clé API OpenAIP fournie
  const openAIPToken = '2717b9196e8100ee2456e09b82b5b08e';

  // Centre par défaut (France)
  const defaultCenter = [46.603354, 1.888334];
  const defaultZoom = 6;

  // Calcul du centre et du zoom basé sur les waypoints
  const { mapCenter, mapZoom } = useMemo(() => {
    if (!waypoints || waypoints.length === 0) {
      return { mapCenter: defaultCenter, mapZoom: defaultZoom };
    }

    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) {
      return { mapCenter: defaultCenter, mapZoom: defaultZoom };
    }

    const lats = validWaypoints.map(w => w.lat);
    const lons = validWaypoints.map(w => w.lon);

    if (validWaypoints.length === 1) {
      return { mapCenter: [validWaypoints[0].lat, validWaypoints[0].lon], mapZoom: 12 };
    }

    const bounds = L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
    const center = bounds.getCenter();

    // Calculer le zoom approprié
    const maxLat = Math.max(...lats);
    const minLat = Math.min(...lats);
    const maxLon = Math.max(...lons);
    const minLon = Math.min(...lons);
    
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    const maxDiff = Math.max(latDiff, lonDiff);

    let zoom = 10;
    if (maxDiff > 5) zoom = 6;
    else if (maxDiff > 2) zoom = 7;
    else if (maxDiff > 1) zoom = 8;
    else if (maxDiff > 0.5) zoom = 9;

    return { mapCenter: [center.lat, center.lng], mapZoom: zoom };
  }, [waypoints]);

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
  // OpenAIP avec token
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
    console.log('🗺️ NavigationMap monté');
    console.log('📍 Centre:', mapCenter, 'Zoom:', mapZoom);
    console.log('✈️ Waypoints:', waypoints.length);
    console.log('🔑 Token OpenAIP:', openAIPToken ? 'Configuré' : 'Manquant');
  }, [mapCenter, mapZoom, waypoints, openAIPToken]);

  return (
    <div style={styles.mapContainer}>
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={mapZoom}
        style={styles.map}
        whenReady={(map) => {
          console.log('✅ Carte prête');
          setMapReady(true);
          // Forcer le redimensionnement
          setTimeout(() => {
            map.target.invalidateSize();
          }, 100);
        }}
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        
        <LayersControl position="topright">
          {/* Couche OpenAIP (principale) */}
          <LayersControl.BaseLayer checked name="Carte OpenAIP">
            <TileLayer
              url={openAIPLayerUrl}
              attribution={openAIPAttribution}
              tileSize={256}
              minZoom={4}
              maxZoom={14}
              opacity={1}
              eventHandlers={{
                load: () => console.log('✅ Tiles OpenAIP chargées'),
                error: (e) => console.error('❌ Erreur tiles OpenAIP:', e)
              }}
            />
          </LayersControl.BaseLayer>
          
          {/* OpenStreetMap comme alternative */}
          <LayersControl.BaseLayer name="OpenStreetMap">
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
              minZoom={4}
              maxZoom={14}
              opacity={0.7}
            />
          </LayersControl.Overlay>
          
          {/* Overlay: Aérodromes OpenAIP */}
          <LayersControl.Overlay name="Aérodromes" checked>
            <TileLayer
              url={openAIPAirportUrl}
              attribution=""
              tileSize={256}
              minZoom={4}
              maxZoom={14}
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
              <p>Waypoints : <strong>{waypoints.length}</strong></p>
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