// src/features/alternates/components/AlternateMap.jsx
import React, { memo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup, LayerGroup, LayersControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useNavigation } from '@core/contexts';

// Import des styles Leaflet
import 'leaflet/dist/leaflet.css';

// Composant de debug pour visualiser les points de la zone pilule
const DebugPillZone = ({ searchZone }) => {
  if (!searchZone || searchZone.type !== 'pill') return null;
  
  const midPoint = Math.floor(searchZone.vertices.length / 2);
  
  return (
    <>
      {/* Afficher chaque vertex avec un numéro */}
      {searchZone.vertices.map((vertex, index) => {
        let color = '#3b82f6';
        let size = 20;
        let label = index.toString();
        
        // Points spéciaux
        if (index === 0) {
          color = '#dc2626'; // Rouge
          label = '0-START';
          size = 30;
        } else if (index === Math.floor(searchZone.vertices.length / 4)) {
          color = '#f59e0b'; // Orange
          label = `${index}-Q1`;
          size = 25;
        } else if (index === midPoint) {
          color = '#8b5cf6'; // Violet
          label = `${index}-MID`;
          size = 30;
        } else if (index === Math.floor(3 * searchZone.vertices.length / 4)) {
          color = '#10b981'; // Vert
          label = `${index}-Q3`;
          size = 25;
        } else if (index === searchZone.vertices.length - 1) {
          color = '#059669'; // Vert foncé
          label = `${index}-END`;
          size = 30;
        } else if (index < midPoint) {
          color = '#3b82f6'; // Bleu pour le premier demi-cercle
        } else {
          color = '#06b6d4'; // Cyan pour le second demi-cercle
        }
        
        return (
          <Marker
            key={index}
            position={[vertex.lat, vertex.lon]}
            icon={L.divIcon({
              html: `<div style="
                background: ${color};
                color: white;
                width: ${size}px;
                height: ${size}px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${label.length > 3 ? '8px' : '10px'};
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              ">${label}</div>`,
              iconSize: [size, size],
              className: 'debug-marker'
            })}
          >
            <Popup>
              <div>
                Point {index}<br/>
                {index === 0 && '🟥 DÉBUT du tracé (départ côté droit)'}<br/>
                {index === Math.floor(searchZone.vertices.length / 4) && '🟧 1/4 (départ côté haut)'}<br/>
                {index === midPoint && '🟣 TRANSITION vers arrivée'}<br/>
                {index === Math.floor(3 * searchZone.vertices.length / 4) && '🟩 3/4 (arrivée côté bas)'}<br/>
                {index === searchZone.vertices.length - 1 && '🟢 FIN du tracé (arrivée côté droit)'}<br/>
                Lat: {vertex.lat.toFixed(4)}<br/>
                Lon: {vertex.lon.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        );
      })}
      
      {/* Lignes de connexion pour voir les segments problématiques */}
      <Polyline
        positions={[[searchZone.vertices[midPoint-1].lat, searchZone.vertices[midPoint-1].lon], 
                   [searchZone.vertices[midPoint].lat, searchZone.vertices[midPoint].lon]]}
        color="#ff0000"
        weight={3}
        opacity={1}
        dashArray="5, 5"
      />
      <Polyline
        positions={[[searchZone.vertices[searchZone.vertices.length-1].lat, searchZone.vertices[searchZone.vertices.length-1].lon], 
                   [searchZone.vertices[0].lat, searchZone.vertices[0].lon]]}
        color="#00ff00"
        weight={3}
        opacity={1}
        dashArray="5, 5"
      />
      
      {/* Afficher les points de départ et arrivée de la route */}
      <Marker
        position={[searchZone.departure.lat, searchZone.departure.lon]}
        icon={L.divIcon({
          html: '<div style="background: #dc2626; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold;">DÉPART</div>',
          iconSize: [60, 20],
          className: 'center-marker'
        })}
      />
      <Marker
        position={[searchZone.arrival.lat, searchZone.arrival.lon]}
        icon={L.divIcon({
          html: '<div style="background: #059669; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold;">ARRIVÉE</div>',
          iconSize: [60, 20],
          className: 'center-marker'
        })}
      />
    </>
  );
};

// Configuration des icônes
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Créer des icônes personnalisées
const createAlternateIcon = (number, color) => {
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
  
  // Couleurs pour les alternates
  const alternateColors = ['#3b82f6', '#10b981', '#f59e0b'];
  
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
        
        {/* Zone de recherche rectangle */}
        {searchZone && searchZone.type === 'rectangle' && searchZone.vertices && (
          <LayerGroup>
            <Polygon
              positions={searchZone.vertices.map(v => [v.lat, v.lon])}
              color="#3b82f6"
              fillColor="#3b82f6"
              fillOpacity={0.15}
              weight={2}
            />
            {/* Ligne centrale pour visualiser l'axe de la route */}
            <Polyline
              positions={[
                [searchZone.departure.lat, searchZone.departure.lon],
                [searchZone.arrival.lat, searchZone.arrival.lon]
              ]}
              color="#1f2937"
              weight={1}
              opacity={0.5}
              dashArray="5, 10"
            />
          </LayerGroup>
        )}
        
        {/* Zone de recherche pilule */}
        {searchZone && searchZone.type === 'pill' && searchZone.vertices && (
          <LayerGroup>
            <Polygon
              positions={searchZone.vertices.map(v => [v.lat, v.lon])}
              color="#3b82f6"
              fillColor="#3b82f6"
              fillOpacity={0.15}
              weight={2}
              smoothFactor={0}
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
          </LayerGroup>
        )}
        
        {/* Debug désactivé - Décommenter pour voir les points de la zone */}
        {/* <DebugPillZone searchZone={searchZone} /> */}
        
        {/* Zone de recherche triangle (pour compatibilité) */}
        {searchZone && searchZone.type === 'triangle' && searchZone.vertices && (
          <LayerGroup>
            <Polygon
              positions={searchZone.vertices.map(v => [v.lat, v.lon])}
              color="#3b82f6"
              fillColor="#3b82f6"
              fillOpacity={0.1}
              weight={2}
              dashArray="5, 5"
            />
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
              <strong>Départ</strong><br />
              {waypoints[0].name}
            </Popup>
          </Marker>
        )}
        
        {waypoints.length > 1 && waypoints[waypoints.length - 1].lat && (
          <Marker position={[waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lon]}>
            <Popup>
              <strong>Arrivée</strong><br />
              {waypoints[waypoints.length - 1].name}
            </Popup>
          </Marker>
        )}
        
        {/* Aérodromes de déroutement */}
        {alternates.map((alternate, index) => (
          <Marker
            key={alternate.icao}
            position={[alternate.position.lat, alternate.position.lon]}
            icon={createAlternateIcon(index + 1, alternateColors[index] || '#6b7280')}
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
                  Distance : {alternate.distance.toFixed(1)} NM<br />
                  Score : {(alternate.score * 100).toFixed(0)}%<br />
                  Piste : {alternate.runways[0]?.length || '?'}m
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
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
          {searchZone && searchZone.type === 'pill' && (
            <div style={sx.spacing.mb(1)}>
              <span style={{ color: '#3b82f6' }}>⬭</span> Zone pilule (rayon {searchZone.radius ? searchZone.radius.toFixed(0) : '?'} NM)
            </div>
          )}
          {searchZone && searchZone.type === 'rectangle' && (
            <div style={sx.spacing.mb(1)}>
              <span style={{ color: '#3b82f6' }}>▭</span> Zone rectangle ({searchZone.width ? searchZone.width.toFixed(0) : '?'} NM de large)
            </div>
          )}
          {searchZone && searchZone.turnPoints && searchZone.turnPoints.length > 0 && (
            <div style={sx.spacing.mb(1)}>
              <span style={{ color: '#f59e0b' }}>○</span> Tampons points tournants
            </div>
          )}
          {alternates.map((alt, idx) => (
            <div key={alt.icao} style={sx.spacing.mb(1)}>
              <span style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: alternateColors[idx] || '#6b7280',
                marginRight: '4px',
                verticalAlign: 'middle'
              }} />
              #{idx + 1} {alt.icao}
            </div>
          ))}
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
    maxWidth: '200px'
  }
};

AlternateMap.displayName = 'AlternateMap';