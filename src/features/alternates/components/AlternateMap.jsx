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

// Créer des icônes personnalisées pour les alternates sélectionnés
const createSelectedAlternateIcon = (number, color, selectionType) => {
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
    className: 'alternate-marker-selected'
  });
};

// Créer des icônes pour les candidats non sélectionnés
const createCandidateIcon = (color) => {
  const svgIcon = `
    <svg width="20" height="28" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0C4.5 0 0 4.5 0 10C0 18 10 28 10 28C10 28 20 18 20 10C20 4.5 15.5 0 10 0Z" 
            fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="1.5"/>
      <circle cx="10" cy="10" r="4" fill="${color}" fill-opacity="0.8"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [20, 28],
    iconAnchor: [10, 28],
    popupAnchor: [0, -28],
    className: 'alternate-marker-candidate'
  });
};

// Créer des icônes pour les points de départ et arrivée
const createDepartureIcon = () => {
  const svgIcon = `
    <svg width="44" height="50" viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#shadow)">
        <circle cx="22" cy="22" r="20" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>
        <path d="M17 22 L17 12 L29 22 L17 32 Z" fill="#ffffff"/>
      </g>
      <rect x="8" y="40" width="28" height="10" rx="2" fill="#3b82f6"/>
      <text x="22" y="47" text-anchor="middle" font-size="7" font-weight="bold" fill="#ffffff">DÉPART</text>
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [44, 50],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
    className: 'departure-marker'
  });
};

const createArrivalIcon = () => {
  const svgIcon = `
    <svg width="44" height="50" viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#shadow2)">
        <circle cx="22" cy="22" r="20" fill="#dc2626" stroke="#ffffff" stroke-width="3"/>
        <rect x="14" y="14" width="16" height="16" rx="2" fill="#ffffff"/>
      </g>
      <rect x="8" y="40" width="28" height="10" rx="2" fill="#dc2626"/>
      <text x="22" y="47" text-anchor="middle" font-size="7" font-weight="bold" fill="#ffffff">ARRIVÉE</text>
      <defs>
        <filter id="shadow2">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [44, 50],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
    className: 'arrival-marker'
  });
};

export const AlternateMap = memo(({ searchZone, alternates = [], allCandidates = [], showAllCandidates = false, selectedIcaos = [] }) => {
  const { waypoints } = useNavigation();
  
  // Calculer le centre et le zoom
  const getMapBounds = () => {
    if (!searchZone || !waypoints.length) return null;
    
    const allPoints = [
      ...waypoints.filter(w => w.lat && w.lon).map(w => [w.lat, w.lon]),
      ...alternates.map(a => [a.position.lat, a.position.lon]),
      ...allCandidates.map(c => [c.position.lat, c.position.lon])
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
        
        {/* Route principale avec style amélioré */}
        {waypoints.length >= 2 && (
          <>
            {/* Ligne principale */}
            <Polyline
              positions={waypoints.filter(w => w.lat && w.lon).map(w => [w.lat, w.lon])}
              color="#1f2937"
              weight={4}
              opacity={0.8}
            />
            {/* Points intermédiaires */}
            {waypoints.slice(1, -1).filter(w => w.lat && w.lon).map((waypoint, index) => (
              <Circle
                key={`waypoint-${index}`}
                center={[waypoint.lat, waypoint.lon]}
                radius={1000} // 1km
                color="#6b7280"
                fillColor="#6b7280"
                fillOpacity={0.8}
                weight={2}
              >
                <Popup>
                  <strong>Point de passage</strong><br />
                  {waypoint.name || waypoint.icao || `WPT ${index + 1}`}
                </Popup>
              </Circle>
            ))}
          </>
        )}
        
        {/* Waypoints de départ et arrivée avec icônes personnalisées */}
        {waypoints.length > 0 && waypoints[0].lat && (
          <Marker 
            position={[waypoints[0].lat, waypoints[0].lon]}
            icon={createDepartureIcon()}
            zIndexOffset={2000}
          >
            <Popup>
              <div style={{ minWidth: '150px' }}>
                <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2), { color: '#3b82f6' })}>
                  🛫 DÉPART
                </h4>
                <p style={sx.text.sm}>
                  <strong>{waypoints[0].icao || waypoints[0].name}</strong>
                </p>
                {waypoints[0].lat && waypoints[0].lon && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                    {waypoints[0].lat.toFixed(4)}°, {waypoints[0].lon.toFixed(4)}°
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        
        {waypoints.length > 1 && waypoints[waypoints.length - 1].lat && (
          <Marker 
            position={[waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lon]}
            icon={createArrivalIcon()}
            zIndexOffset={2000}
          >
            <Popup>
              <div style={{ minWidth: '150px' }}>
                <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2), { color: '#dc2626' })}>
                  🛬 ARRIVÉE
                </h4>
                <p style={sx.text.sm}>
                  <strong>{waypoints[waypoints.length - 1].icao || waypoints[waypoints.length - 1].name}</strong>
                </p>
                {waypoints[waypoints.length - 1].lat && waypoints[waypoints.length - 1].lon && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                    {waypoints[waypoints.length - 1].lat.toFixed(4)}°, {waypoints[waypoints.length - 1].lon.toFixed(4)}°
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* TOUS LES CANDIDATS NON SÉLECTIONNÉS */}
        {showAllCandidates && allCandidates.map((candidate) => {
          // Ne pas afficher si c'est un aérodrome sélectionné
          if (selectedIcaos.includes(candidate.icao)) return null;
          
          const color = candidate.side === 'departure' ? '#dc2626' : '#059669';
          
          return (
            <Marker
              key={`candidate-${candidate.icao}`}
              position={[candidate.position.lat, candidate.position.lon]}
              icon={createCandidateIcon(color)}
              zIndexOffset={-100} // Mettre en arrière-plan
            >
              <Popup>
                <div style={{ minWidth: '180px' }}>
                  <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                    Candidat suggéré
                  </h4>
                  <p style={sx.text.xs}>
                    <strong>{candidate.icao}</strong> - {candidate.name}
                  </p>
                  <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      backgroundColor: color + '20',
                      color: color,
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}>
                      {candidate.side === 'departure' ? 'Côté départ' : 'Côté arrivée'}
                    </span><br />
                    Distance route : {candidate.distance.toFixed(1)} NM<br />
                    Score : <strong>{(candidate.score * 100).toFixed(0)}%</strong><br />
                    Piste : {candidate.runways[0]?.length || '?'}m
                    {candidate.services?.fuel && ' • ⛽ Fuel'}
                    {candidate.services?.atc && ' • 🗼 ATC'}
                  </p>
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2), {
                    backgroundColor: '#f3f4f6',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  })}>
                    💡 Cliquez dans le panneau de sélection pour choisir cet aérodrome
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* AÉRODROMES SÉLECTIONNÉS (au premier plan) */}
        {alternates.map((alternate, index) => {
          const color = alternate.selectionType === 'departure' ? '#dc2626' : '#059669';
          
          return (
            <Marker
              key={`selected-${alternate.icao}`}
              position={[alternate.position.lat, alternate.position.lon]}
              icon={createSelectedAlternateIcon(index + 1, color, alternate.selectionType)}
              zIndexOffset={1000} // Mettre au premier plan
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2), {
                    color: color,
                    borderBottom: `2px solid ${color}`,
                    paddingBottom: '8px'
                  })}>
                    ✅ Déroutement sélectionné #{index + 1}
                  </h4>
                  <p style={sx.text.sm}>
                    <strong>{alternate.icao}</strong> - {alternate.name}
                  </p>
                  <p style={sx.combine(sx.text.sm, sx.spacing.mt(1))}>
                    Type : <strong style={{ color }}>{alternate.selectionType === 'departure' ? 'Côté départ' : 'Côté arrivée'}</strong><br />
                    Distance route : <strong>{alternate.distance.toFixed(1)} NM</strong><br />
                    Score : <strong>{(alternate.score * 100).toFixed(0)}%</strong><br />
                    Piste principale : <strong>{alternate.runways[0]?.length || '?'}m</strong>
                  </p>
                  <div style={sx.combine(sx.text.xs, sx.spacing.mt(2))}>
                    {alternate.services?.fuel && <span style={styles.serviceTag}>⛽ Carburant</span>}
                    {alternate.services?.atc && <span style={styles.serviceTag}>🗼 ATC/AFIS</span>}
                    {alternate.services?.lighting && <span style={styles.serviceTag}>💡 Balisage</span>}
                  </div>
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
          <div style={sx.spacing.mt(2)}>
            <strong>Points de navigation :</strong>
          </div>
          <div style={sx.spacing.mb(1)}>
            <span style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              marginRight: '4px',
              verticalAlign: 'middle',
              position: 'relative'
            }}>
              <span style={{
                position: 'absolute',
                top: '5px',
                left: '5px',
                width: '0',
                height: '0',
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: '8px solid white'
              }} />
            </span>
            Point de départ
          </div>
          <div style={sx.spacing.mb(1)}>
            <span style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#dc2626',
              marginRight: '4px',
              verticalAlign: 'middle',
              position: 'relative'
            }}>
              <span style={{
                position: 'absolute',
                top: '6px',
                left: '6px',
                width: '8px',
                height: '8px',
                backgroundColor: 'white'
              }} />
            </span>
            Point d'arrivée
          </div>
          <div style={sx.spacing.mt(2)}>
            <strong>Aérodromes candidats :</strong>
          </div>
          <div style={sx.spacing.mb(1)}>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#dc262640',
              border: '1px solid #dc2626',
              marginRight: '4px',
              verticalAlign: 'middle'
            }} />
            Suggestions côté départ
          </div>
          <div style={sx.spacing.mb(1)}>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#05966940',
              border: '1px solid #059669',
              marginRight: '4px',
              verticalAlign: 'middle'
            }} />
            Suggestions côté arrivée
          </div>
          <div style={sx.spacing.mt(2)}>
            <strong>Aérodromes sélectionnés :</strong>
          </div>
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
            Sélection côté départ
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
            Sélection côté arrivée
          </div>
        </div>
      </div>
      
      {/* Compteur d'aérodromes */}
      <div style={styles.counter}>
        <p style={sx.combine(sx.text.xs, sx.text.bold)}>
          {allCandidates.length} candidats trouvés
        </p>
        <p style={sx.text.xs}>
          {selectedIcaos.length} sélectionné{selectedIcaos.length > 1 ? 's' : ''}
        </p>
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
  },
  counter: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    backgroundColor: 'white',
    padding: '8px 12px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
  },
  serviceTag: {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    marginRight: '4px',
    marginBottom: '4px'
  }
};

AlternateMap.displayName = 'AlternateMap';