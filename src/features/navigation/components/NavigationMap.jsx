// src/features/navigation/components/NavigationMap.jsx
import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, ZoomControl, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, AlertTriangle, Info, Map } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

// Import des styles Leaflet
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
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_IGN_API_KEY || '');
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(!apiKey);
  const [tempApiKey, setTempApiKey] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true); // Pour afficher le placeholder
  const mapRef = useRef(null);

  // Centre par défaut (France)
  const defaultCenter = [46.603354, 1.888334];
  const defaultZoom = 6;

  // Calcul du centre et du zoom basé sur les waypoints
  const { mapCenter, mapZoom } = useMemo(() => {
    if (!waypoints || waypoints.length === 0) {
      return { mapCenter: defaultCenter, mapZoom: defaultZoom };
    }

    const lats = waypoints.map(w => w.lat).filter(Boolean);
    const lons = waypoints.map(w => w.lon).filter(Boolean);

    if (lats.length === 0 || lons.length === 0) {
      return { mapCenter: defaultCenter, mapZoom: defaultZoom };
    }

    const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lon]).filter(w => w[0] && w[1]));
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

  // Gestion de la clé API
  const handleApiKeySubmit = () => {
    if (tempApiKey.trim()) {
      setApiKey(tempApiKey.trim());
      setShowApiKeyDialog(false);
      localStorage.setItem('ign_api_key', tempApiKey.trim());
    }
  };

  // Charger la clé API depuis localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('ign_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setShowApiKeyDialog(false);
    }
  }, []);

  // URL de la couche OACI IGN - Format corrigé
  const getOaciLayerUrl = (apiKey) => {
    if (!apiKey) return null;
    
    return `https://wxs.ign.fr/${apiKey}/geoportail/wmts?` +
      `SERVICE=WMTS&` +
      `REQUEST=GetTile&` +
      `VERSION=1.0.0&` +
      `LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI&` +
      `STYLE=normal&` +
      `TILEMATRIXSET=PM&` +
      `TILEMATRIX={z}&` +
      `TILEROW={y}&` +
      `TILECOL={x}&` +
      `FORMAT=image/jpeg`;
  };

  const oaciLayerUrl = getOaciLayerUrl(apiKey);

  // Attribution IGN
  const ignAttribution = '&copy; <a href="https://www.ign.fr/" target="_blank">IGN</a> - Carte OACI';

  return (
    <>
      {/* Dialog pour la clé API */}
      {showApiKeyDialog && (
        <div style={styles.apiKeyDialog}>
          <div style={styles.apiKeyContent}>
            <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
              <AlertTriangle size={20} style={{ marginRight: '8px', color: '#f59e0b' }} />
              Clé API IGN requise
            </h3>
            
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
              <Info size={16} />
              <div>
                <p style={sx.text.sm}>
                  Pour afficher les cartes aéronautiques OACI officielles, vous devez obtenir une clé API IGN gratuite.
                </p>
                <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
                  <strong>Comment obtenir une clé :</strong>
                </p>
                <ol style={sx.combine(sx.text.sm, sx.spacing.ml(4))}>
                  <li>Inscrivez-vous sur <a href="https://geoservices.ign.fr/inscription" target="_blank" style={{ color: '#3b82f6' }}>geoservices.ign.fr</a></li>
                  <li>Créez une nouvelle clé API</li>
                  <li>Dans les services, activez "Cartes SCAN Express Standard" et "Cartes SCAN Express OACI"</li>
                  <li>Copiez la clé et collez-la ci-dessous</li>
                </ol>
              </div>
            </div>

            <input
              type="text"
              placeholder="Collez votre clé API IGN ici"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              style={sx.combine(sx.components.input.base, sx.spacing.mb(3))}
            />

            <div style={sx.combine(sx.flex.end, sx.spacing.gap(2))}>
              <button
                onClick={() => setShowApiKeyDialog(false)}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
              >
                Utiliser carte de base
              </button>
              <button
                onClick={handleApiKeySubmit}
                disabled={!tempApiKey.trim()}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.primary,
                  !tempApiKey.trim() && { opacity: 0.5, cursor: 'not-allowed' }
                )}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carte */}
      <div style={styles.mapContainer}>
        {/* PLACEHOLDER TEMPORAIRE */}
        {showPlaceholder ? (
          <div style={styles.placeholderContainer}>
            <div style={styles.placeholderContent}>
              <Map size={60} color="#3b82f6" />
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', margin: '16px 0' }}>
                CARTE IGN ICI
              </h2>
              <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                Placeholder temporaire pour la carte IGN OACI
              </p>
              <button
                onClick={() => setShowPlaceholder(false)}
                style={sx.combine(sx.components.button.base, sx.components.button.primary)}
              >
                Afficher la carte Leaflet
              </button>
              <button
                onClick={() => setShowApiKeyDialog(true)}
                style={sx.combine(sx.components.button.base, sx.components.button.secondary, sx.spacing.ml(2))}
              >
                Configurer IGN
              </button>
            </div>
            
            {/* Informations de debug */}
            <div style={styles.debugInfo}>
              <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Debug Info:</h4>
              <p>Clé API: {apiKey ? '✅ Configurée' : '❌ Non configurée'}</p>
              <p>Waypoints: {waypoints.length}</p>
              <p>Route calculée: {route.length > 0 ? '✅ Oui' : '❌ Non'}</p>
              {apiKey && <p style={{ fontSize: '11px', wordBreak: 'break-all' }}>URL: {oaciLayerUrl}</p>}
            </div>
          </div>
        ) : (
          <>
            <MapContainer
              ref={mapRef}
              center={mapCenter}
              zoom={mapZoom}
              style={styles.map}
              whenReady={() => setMapReady(true)}
              zoomControl={false}
            >
              <ZoomControl position="topright" />
              
              <LayersControl position="topright">
                {/* Couche OACI IGN (si clé disponible) */}
                {oaciLayerUrl && (
                  <LayersControl.BaseLayer checked name="Carte OACI (IGN)">
                    <TileLayer
                      url={oaciLayerUrl}
                      attribution={ignAttribution}
                      tileSize={256}
                      minZoom={6}
                      maxZoom={12}
                    />
                  </LayersControl.BaseLayer>
                )}
                
                {/* Couche OpenStreetMap (fallback) */}
                <LayersControl.BaseLayer checked={!oaciLayerUrl} name="OpenStreetMap">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                </LayersControl.BaseLayer>

                {/* Couche satellite (optionnelle) */}
                <LayersControl.BaseLayer name="Vue satellite">
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="&copy; Esri"
                  />
                </LayersControl.BaseLayer>
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

            {/* Boutons de contrôle */}
            <button
              onClick={() => setShowApiKeyDialog(true)}
              style={styles.configButton}
              title="Configurer la clé API IGN"
            >
              ⚙️
            </button>
            
            <button
              onClick={() => setShowPlaceholder(true)}
              style={{ ...styles.configButton, top: '60px' }}
              title="Afficher le placeholder"
            >
              📍
            </button>
          </>
        )}
      </div>
    </>
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
  placeholderContainer: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    position: 'relative'
  },
  placeholderContent: {
    textAlign: 'center',
    padding: '32px'
  },
  debugInfo: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    fontSize: '12px',
    maxWidth: '300px'
  },
  apiKeyDialog: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  apiKeyContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto'
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
  configButton: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    width: '40px',
    height: '40px',
    backgroundColor: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    zIndex: 400,
    transition: 'all 0.2s'
  }
};

NavigationMap.displayName = 'NavigationMap';

export default NavigationMap;