// src/features/alternates/components/AlternateMap.jsx
import React, { memo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup, LayerGroup, LayersControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useNavigation } from '@core/contexts';

// Import des styles Leaflet
import 'leaflet/dist/leaflet.css';

// Configuration des icônes
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Créer des icônes personnalisées
const createAlternateIcon = (number, color, selectionType) => {
  const svgIcon = `
    <svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C7.5 0 1 6.5 1 14C1 24.5 15 40 15 40C15 40 29 24.5 29 14C29 6.5 22.5 0 15 0Z" 
            fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="14" r="8" fill="#ffffff"/>
      <text x="15" y="18" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}">${number}</text>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
    className: 'alternate-marker'
  });
};

export const AlternateMap = memo(({ searchZone, alternates = [] }) => {
  const { waypoints } = useNavigation();
  
  // Calculer le centre et le zoom
  const getMapBounds = () => {
    if (!searchZone || !waypoints.length) return null;
    
    const allPoints = [
      ...waypoints.filter(w => w.lat && w.lon).map(w => [w.lat, w.lon]),
      ...alternates.map(a => [a.position.lat, a.position.lon])
    ];
    
    if (searchZone.vertices) {
      allPoints.push(...searchZone.vertices.map(v => [v.lat, v.lon]));
    }
    
    return L.latLngBounds(allPoints);
  };
  
  const bounds = getMapBounds();
  const center = bounds ? bounds.getCenter() : [46.603354, 1.888334];
  
  return (
    <div style={styles.mapContainer}>
      <MapContainer
        center={center}
        zoom={7}
        bounds={bounds}
        style={styles.map}
        zoomControl={false}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        
        {/* Zone de recherche pilule */}
        {searchZone && searchZone.type === 'pill' && searchZone.vertices && (
          <LayerGroup>
            <Polygon
              positions={searchZone.vertices.map(v => [v.lat, v.lon])}
              color="#3b82f6"
              fillColor="#3b82f6"
              fillOpacity={0.15}
              weight={2}
            />
            <Polyline
              positions={[
                [searchZone.departure.lat, searchZone.departure.lon],
                [searchZone.arrival.lat, searchZone.arrival.lon]
              ]}
              color="#1f2937"
              weight={2}
              opacity={0.5}
              dashArray="5, 10"
            />
            
            {/* Médiatrice */}
            {searchZone.perpendicular && (
              <>
                <Polyline
                  positions={[
                    [searchZone.perpendicular.point1.lat, searchZone.perpendicular.point1.lon],
                    [searchZone.perpendicular.point2.lat, searchZone.perpendicular.point2.lon]
                  ]}
                  color="#8b5cf6"
                  weight={3}
                  opacity={0.8}
                  dashArray="10, 5"
                />
                <Marker position={[searchZone.perpendicular.midpoint.lat, searchZone.perpendicular.midpoint.lon]}>
                  <Popup>
                    <strong>Point médian</strong><br />
                    Division départ/arrivée
                  </Popup>
                </Marker>
              </>
            )}
          </LayerGroup>
        )}
        
        {/* Zone de recherche rectangle (pour compatibilité) */}
        {searchZone && searchZone.type === 'rectangle' && searchZone.vertices && (
          <LayerGroup>
            <Polygon
              positions={searchZone.vertices.map(v => [v.lat, v.lon])}
              color="#3b82f6"
              fillColor="#3b82f6"
              fillOpacity={0.15}
              weight={2}
            />
            
            {/* Médiatrice */}
            {searchZone.perpendicular && (
              <Polyline
                positions={[
                  [searchZone.perpendicular.point1.lat, searchZone.perpendicular.point1.lon],
                  [searchZone.perpendicular.point2.lat, searchZone.perpendicular.point2.lon]
                ]}
                color="#8b5cf6"
                weight={3}
                opacity={0.8}
                dashArray="10, 5"
              />
            )}
          </LayerGroup>
        )}
        
        {/* Tampons des points tournants */}
        {searchZone && searchZone.turnPoints && searchZone.turnPoints.map((turnPoint, idx) => (
          <Circle
            key={idx}
            center={[turnPoint.lat, turnPoint.lon]}
            radius={turnPoint.bufferRadius * 1852} // Conversion NM vers mètres
            color="#f59e0b"
            fillColor="#f59e0b"
            fillOpacity={0.15}
            weight={1}
            dashArray="3, 3"
          />
        ))}
        
        {/* Route principale */}
        {waypoints.length >= 2 && (
          <Polyline
            positions={waypoints.filter(w => w.lat && w.lon).map(w => [w.lat, w.lon])}
            color="#1f2937"
            weight={3}
            opacity={0.8}
          />
        )}
        
        {/* Waypoints de départ et arrivée */}
        {waypoints.length > 0 && waypoints[0].lat && (
          <Marker position={[waypoints[0].lat, waypoints[0].lon]}>
            <Popup>
              <strong>🛫 Départ</strong><br />
              {waypoints[0].name}
            </Popup>
          </Marker>
        )}
        
        {waypoints.length > 1 && waypoints[waypoints.length - 1].lat && (
          <Marker position={[waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lon]}>
            <Popup>
              <strong>🛬 Arrivée</strong><br />
              {waypoints[waypoints.length - 1].name}
            </Popup>
          </Marker>
        )}
        
        {/* Aérodromes de déroutement */}
        {alternates.map((alternate, index) => {
          const color = alternate.selectionType === 'departure' ? '#dc2626' : '#059669';
          
          return (
            <Marker
              key={alternate.icao}
              position={[alternate.position.lat, alternate.position.lon]}
              icon={createAlternateIcon(index + 1, color, alternate.selectionType)}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                    Déroutement #{index + 1}
                  </h4>
                  <p style={sx.text.sm}>
                    <strong>{alternate.icao}</strong> - {alternate.name}
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
                    Type : <strong style={{ color }}>{alternate.selectionType === 'departure' ? 'Côté départ' : 'Côté arrivée'}</strong><br />
                    Distance route : {alternate.distance.toFixed(1)} NM<br />
                    Score : {(alternate.score * 100).toFixed(0)}%<br />
                    Piste : {alternate.runways[0]?.length || '?'}m
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Légende */}
      <div style={styles.legend}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
          Légende
        </h5>
        <div style={sx.text.xs}>
          <div style={sx.spacing.mb(1)}>
            <span style={{ color: '#1f2937' }}>━━━</span> Route principale
          </div>
          <div style={sx.spacing.mb(1)}>
            <span style={{ color: '#8b5cf6' }}>┅┅┅</span> Médiatrice (division départ/arrivée)
          </div>
          {searchZone && searchZone.type === 'pill' && (
            <div style={sx.spacing.mb(1)}>
              <span style={{ color: '#3b82f6' }}>⬭</span> Zone pilule (rayon {searchZone.radius ? searchZone.radius.toFixed(0) : '?'} NM)
            </div>
          )}
          {searchZone && searchZone.turnPoints && searchZone.turnPoints.length > 0 && (
            <div style={sx.spacing.mb(1)}>
              <span style={{ color: '#f59e0b' }}>○</span> Tampons points tournants
            </div>
          )}
          <div style={sx.spacing.mb(1)}>
            <span style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#dc2626',
              marginRight: '4px',
              verticalAlign: 'middle'
            }} />
            Déroutement côté départ
          </div>
          <div style={sx.spacing.mb(1)}>
            <span style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#059669',
              marginRight: '4px',
              verticalAlign: 'middle'
            }} />
            Déroutement côté arrivée
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
  legend: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    backgroundColor: 'white',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    maxWidth: '250px'
  }
};

AlternateMap.displayName = 'AlternateMap';