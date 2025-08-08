// src/features/navigation/components/NavigationMapDebug.jsx
import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, ZoomControl, LayersControl, LayerGroup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, AlertTriangle, Fuel, RefreshCw, Bug } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useFuel } from '@core/contexts';
import { Conversions } from '@utils/conversions';
import MapDiagnostic from './MapDiagnostic';
import TestMapMinimal from './TestMapMinimal';

// Import des styles Leaflet - TRÈS IMPORTANT
import 'leaflet/dist/leaflet.css';
import './map-debug.css';

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
  waypoint: createIcon('#3b82f6', 'W')
};

// Composant de debug pour afficher les logs
const DebugPanel = ({ logs }) => {
  const [showLogs, setShowLogs] = useState(true);
  
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      backgroundColor: 'white',
      border: '2px solid #ef4444',
      borderRadius: '8px',
      padding: '12px',
      maxWidth: '400px',
      maxHeight: '300px',
      overflow: 'auto',
      zIndex: 1000,
      fontSize: '11px',
      fontFamily: 'monospace'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '8px'
      }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Bug size={14} />
          Debug Logs
        </h4>
        <button 
          onClick={() => setShowLogs(!showLogs)}
          style={{
            padding: '2px 6px',
            fontSize: '10px',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showLogs ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {showLogs && (
        <div>
          {logs.map((log, idx) => (
            <div key={idx} style={{ 
              padding: '2px 0',
              borderBottom: '1px solid #f3f4f6',
              color: log.type === 'error' ? '#dc2626' : 
                    log.type === 'warning' ? '#f59e0b' : 
                    log.type === 'success' ? '#10b981' : '#374151'
            }}>
              <span style={{ fontWeight: 'bold' }}>{log.time}:</span> {log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Composant simple de test
const SimpleMapTest = () => {
  const [testLogs, setTestLogs] = useState([]);
  
  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTestLogs(prev => [...prev, { time, message, type }]);
    console.log(`[MAP DEBUG ${time}] ${message}`);
  };
  
  useEffect(() => {
    addLog('SimpleMapTest monté', 'success');
    
    // Vérifier que Leaflet est chargé
    if (typeof L !== 'undefined') {
      addLog('Leaflet chargé ✓', 'success');
      addLog(`Version Leaflet: ${L.version}`, 'info');
    } else {
      addLog('Leaflet non chargé ✗', 'error');
    }
    
    // Vérifier react-leaflet
    try {
      if (MapContainer && TileLayer) {
        addLog('react-leaflet composants disponibles ✓', 'success');
      }
    } catch (e) {
      addLog(`react-leaflet erreur: ${e.message}`, 'error');
    }
  }, []);
  
  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '400px',
      border: '2px solid #3b82f6',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <DebugPanel logs={testLogs} />
      
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'white',
        padding: '8px',
        borderRadius: '4px',
        zIndex: 500,
        fontSize: '12px'
      }}>
        <strong>Test Map Simple</strong><br />
        Centre: Paris (48.8566, 2.3522)<br />
        Zoom: 10
      </div>
      
      <MapContainer
        center={[48.8566, 2.3522]}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
        whenReady={() => {
          addLog('MapContainer prêt ✓', 'success');
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OSM'
          eventHandlers={{
            load: () => addLog('TileLayer chargé ✓', 'success'),
            error: (e) => addLog(`TileLayer erreur: ${e.error}`, 'error')
          }}
        />
        
        <Marker position={[48.8566, 2.3522]}>
          <Popup>Test Marker - Paris</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

// Composant principal avec debug
export const NavigationMap = memo(({ waypoints, onWaypointUpdate, selectedAircraft, vfrPoints = {} }) => {
  const [debugLogs, setDebugLogs] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);
  
  const { fobFuel, fuelData } = useFuel();
  
  const addDebugLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-20), { time, message, type }]);
    console.log(`[NAV MAP ${time}] ${message}`);
  };
  
  // Centre par défaut (France)
  const defaultCenter = [46.603354, 1.888334];
  const defaultZoom = 6;

  // Calcul du centre initial
  const initialCenter = useMemo(() => {
    addDebugLog('Calcul du centre initial...', 'info');
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    
    if (validWaypoints.length === 0) {
      addDebugLog('Aucun waypoint valide, utilisation centre par défaut', 'warning');
      return defaultCenter;
    }
    
    if (validWaypoints.length === 1) {
      addDebugLog(`Un waypoint trouvé: ${validWaypoints[0].name}`, 'info');
      return [validWaypoints[0].lat, validWaypoints[0].lon];
    }
    
    addDebugLog(`${validWaypoints.length} waypoints valides trouvés`, 'success');
    const bounds = L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
    const center = bounds.getCenter();
    return [center.lat, center.lng];
  }, [waypoints]);

  // Logs au montage
  useEffect(() => {
    addDebugLog('NavigationMap monté', 'success');
    addDebugLog(`Waypoints: ${waypoints.length}`, 'info');
    addDebugLog(`Aircraft: ${selectedAircraft ? selectedAircraft.registration : 'Aucun'}`, 'info');
    addDebugLog(`Centre: [${initialCenter[0].toFixed(4)}, ${initialCenter[1].toFixed(4)}]`, 'info');
    
    // Vérifications système
    if (typeof L === 'undefined') {
      addDebugLog('ERREUR: Leaflet non chargé!', 'error');
      setMapError('Leaflet non chargé');
    } else {
      addDebugLog(`Leaflet v${L.version} OK`, 'success');
    }
    
    if (!MapContainer) {
      addDebugLog('ERREUR: MapContainer non disponible!', 'error');
      setMapError('react-leaflet non chargé');
    } else {
      addDebugLog('react-leaflet OK', 'success');
    }
  }, []);

  // Si erreur critique, afficher le test simple
  if (mapError) {
    return (
      <div>
        <div style={{
          backgroundColor: '#fee2e2',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <h3 style={{ color: '#dc2626', marginTop: 0 }}>
            ❌ Erreur de carte: {mapError}
          </h3>
          <p>Test avec une carte simple:</p>
        </div>
        <SimpleMapTest />
      </div>
    );
  }

  // Créer la route
  const route = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    const routePoints = validWaypoints.length > 1 ? validWaypoints.map(w => [w.lat, w.lon]) : [];
    addDebugLog(`Route créée avec ${routePoints.length} segments`, 'info');
    return routePoints;
  }, [waypoints]);

  return (
    <div>
      {/* Diagnostic complet */}
      <MapDiagnostic />
      
      {/* Test minimal en vanilla JS */}
      <TestMapMinimal />
      
      <div style={{ position: 'relative', width: '100%', height: '600px' }}>
        <DebugPanel logs={debugLogs} />
      
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '8px',
        borderRadius: '4px',
        zIndex: 500,
        fontSize: '11px',
        maxWidth: '200px'
      }}>
        <strong>État de la carte:</strong><br />
        Map Ready: {mapReady ? '✓' : '✗'}<br />
        Waypoints: {waypoints.length}<br />
        Route segments: {route.length}<br />
        Centre: [{initialCenter[0].toFixed(2)}, {initialCenter[1].toFixed(2)}]<br />
        Zoom: {defaultZoom}
      </div>
      
      <MapContainer
        center={initialCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%' }}
        ref={mapRef}
        whenReady={(mapInstance) => {
          addDebugLog('MapContainer whenReady appelé', 'success');
          setMapReady(true);
          
          if (mapInstance && mapInstance.target) {
            addDebugLog('Map instance disponible', 'success');
            setTimeout(() => {
              try {
                mapInstance.target.invalidateSize();
                addDebugLog('Map invalidateSize OK', 'success');
              } catch (e) {
                addDebugLog(`Erreur invalidateSize: ${e.message}`, 'error');
              }
            }, 100);
          }
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          eventHandlers={{
            load: () => addDebugLog('Tiles OSM chargées', 'success'),
            error: (e) => addDebugLog(`Erreur tiles: ${e}`, 'error'),
            loading: () => addDebugLog('Chargement tiles...', 'info')
          }}
        />
        
        <ZoomControl position="topright" />
        
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
              draggable={!!onWaypointUpdate}
              eventHandlers={{
                dragend: (e) => {
                  if (onWaypointUpdate) {
                    const newPos = e.target.getLatLng();
                    onWaypointUpdate(waypoint.id, {
                      lat: newPos.lat,
                      lon: newPos.lng
                    });
                    addDebugLog(`Waypoint ${waypoint.name} déplacé`, 'info');
                  }
                }
              }}
            >
              <Popup>
                <div>
                  <h4>{waypoint.name || `Point ${index + 1}`}</h4>
                  <p>Lat: {waypoint.lat.toFixed(4)}°</p>
                  <p>Lon: {waypoint.lon.toFixed(4)}°</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      </div>
    </div>
  );
});

NavigationMap.displayName = 'NavigationMap';

export default NavigationMap;