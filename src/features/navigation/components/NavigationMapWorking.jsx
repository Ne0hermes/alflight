// src/features/navigation/components/NavigationMapWorking.jsx
import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import * as L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, Popup, ZoomControl, Circle, useMap } from 'react-leaflet';
import { Navigation, Fuel, RefreshCw } from 'lucide-react';
import { useFuel } from '@core/contexts';

// IMPORTANT: Import CSS Leaflet
import 'leaflet/dist/leaflet.css';

// Fix pour les icônes Leaflet - Utiliser les URLs CDN
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Composant pour ajuster la vue
const MapController = ({ waypoints }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!waypoints || waypoints.length === 0) return;
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) return;
    
    try {
      if (validWaypoints.length === 1) {
        map.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
      } else {
        const bounds = L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error('Erreur ajustement vue:', error);
    }
  }, [waypoints, map]);
  
  return null;
};

// Composant principal
export const NavigationMap = memo(({ waypoints = [], onWaypointUpdate, selectedAircraft, vfrPoints = {} }) => {
  const [showRange, setShowRange] = useState(false);
  const { fobFuel, fuelData } = useFuel();
  
  // Centre par défaut (France)
  const defaultCenter = [46.603354, 1.888334];
  const defaultZoom = 6;

  // Calcul du centre initial
  const initialCenter = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) return defaultCenter;
    
    if (validWaypoints.length === 1) {
      return [validWaypoints[0].lat, validWaypoints[0].lon];
    }
    
    const latitudes = validWaypoints.map(w => w.lat);
    const longitudes = validWaypoints.map(w => w.lon);
    const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
    const centerLon = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
    
    return [centerLat, centerLon];
  }, [waypoints]);

  // Créer la route
  const route = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    return validWaypoints.length > 1 ? validWaypoints.map(w => [w.lat, w.lon]) : [];
  }, [waypoints]);

  // Calcul de la distance totale
  const totalDistance = useMemo(() => {
    if (route.length < 2) return 0;
    
    let distance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const from = L.latLng(route[i]);
      const to = L.latLng(route[i + 1]);
      distance += from.distanceTo(to);
    }
    return (distance / 1852).toFixed(1); // Conversion en NM
  }, [route]);

  // Calcul du rayon d'action
  const rangeData = useMemo(() => {
    if (!showRange || !selectedAircraft || !fobFuel || !fuelData?.finalReserve) {
      return null;
    }
    
    const usableFuel = fobFuel.ltr - fuelData.finalReserve.ltr;
    if (usableFuel <= 0) return null;
    
    const endurance = usableFuel / (selectedAircraft.fuelConsumption || 30);
    const maxRange = endurance * (selectedAircraft.cruiseSpeedKt || 100);
    const roundTripRange = (maxRange / 2) * 0.9;
    
    return {
      maxRange: maxRange * 1852, // Conversion NM vers mètres
      roundTripRange: roundTripRange * 1852,
      maxRangeNM: maxRange,
      roundTripRangeNM: roundTripRange
    };
  }, [showRange, selectedAircraft, fobFuel, fuelData]);

  // Créer des icônes personnalisées
  const createCustomIcon = (color, label) => {
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-weight: bold;
            font-size: 14px;
          ">${label}</span>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
      className: 'custom-waypoint-marker'
    });
  };

  const icons = {
    departure: createCustomIcon('#10b981', 'D'),
    arrival: createCustomIcon('#f59e0b', 'A'),
    waypoint: createCustomIcon('#3b82f6', 'W')
  };

  // Style pour forcer l'affichage de la carte
  const mapContainerStyle = {
    position: 'relative',
    width: '100%',
    height: '600px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    backgroundColor: '#f3f4f6'
  };

  const leafletOverrideStyle = {
    width: '100%',
    height: '100%',
    position: 'relative',
    zIndex: 0
  };

  return (
    <div style={mapContainerStyle}>
      
      {/* Carte Leaflet */}
      <MapContainer
        center={initialCenter}
        zoom={defaultZoom}
        style={leafletOverrideStyle}
        scrollWheelZoom={true}
        zoomControl={false}
        className="leaflet-container-override"
      >
        <ZoomControl position="topright" />
        <MapController waypoints={waypoints} />
        
        {/* Couche de base OpenStreetMap */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
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
        
        {/* Cercles de rayon d'action */}
        {rangeData && waypoints[0]?.lat && waypoints[0]?.lon && (
          <>
            <Circle
              center={[waypoints[0].lat, waypoints[0].lon]}
              radius={rangeData.maxRange}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.05,
                weight: 2,
                dashArray: '10, 5'
              }}
            />
            <Circle
              center={[waypoints[0].lat, waypoints[0].lon]}
              radius={rangeData.roundTripRange}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.1,
                weight: 3
              }}
            />
          </>
        )}
        
        {/* Marqueurs des waypoints */}
        {waypoints.map((waypoint, index) => {
          if (!waypoint.lat || !waypoint.lon) return null;
          
          const icon = index === 0 ? icons.departure :
                      index === waypoints.length - 1 ? icons.arrival :
                      icons.waypoint;
          
          return (
            <Marker
              key={waypoint.id || index}
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
                  }
                }
              }}
            >
              <Popup>
                <div style={{ minWidth: '150px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>
                    {waypoint.name || `Point ${index + 1}`}
                  </h4>
                  <p style={{ margin: '4px 0', fontSize: '12px' }}>
                    Lat: {waypoint.lat.toFixed(4)}°<br />
                    Lon: {waypoint.lon.toFixed(4)}°
                    {waypoint.elevation && <><br />Alt: {waypoint.elevation} ft</>}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Panneau d'information */}
      {route.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 400
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Navigation size={16} />
            Information de vol
          </h4>
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
            <div>Distance: <strong>{totalDistance} NM</strong></div>
            <div>Waypoints: <strong>{waypoints.filter(w => w.lat && w.lon).length}</strong></div>
            {selectedAircraft && (
              <>
                <div>Temps: <strong>{(totalDistance / (selectedAircraft.cruiseSpeedKt || 100)).toFixed(1)} h</strong></div>
                <div>Carburant: <strong>{(totalDistance / (selectedAircraft.cruiseSpeedKt || 100) * (selectedAircraft.fuelConsumption || 30)).toFixed(1)} L</strong></div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Contrôle du rayon d'action */}
      {selectedAircraft && waypoints.length > 0 && waypoints[0].lat && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 400,
          width: '180px'
        }}>
          <button
            onClick={() => setShowRange(!showRange)}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: showRange ? '#3b82f6' : '#e5e7eb',
              color: showRange ? 'white' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Fuel size={16} />
            {showRange ? 'Masquer rayon' : 'Afficher rayon'}
          </button>
          
          {showRange && rangeData && (
            <div style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.4' }}>
              <div style={{ color: '#3b82f6' }}>
                🔵 Max: {Math.round(rangeData.maxRangeNM)} NM
              </div>
              <div style={{ color: '#10b981' }}>
                🟢 A/R: {Math.round(rangeData.roundTripRangeNM)} NM
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

NavigationMap.displayName = 'NavigationMap';
export default NavigationMap;