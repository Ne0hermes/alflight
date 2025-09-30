/**
 * Carte de navigation simplifiée pour tester l'affichage
 */

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix pour les icônes Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
});

export const NavigationMapSimple = ({ waypoints = [] }) => {
  const center = [46.603354, 1.888334]; // Centre de la France
  
  return (
    <div style={{ width: '100%', height: '500px', position: 'relative' }}>
      <MapContainer 
        center={center} 
        zoom={6} 
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {/* Marqueur de test */}
        <Marker position={center}>
          <Popup>
            Centre de la France<br />
            Carte de test SIA
          </Popup>
        </Marker>
        
        {/* Afficher les waypoints s'il y en a */}
        {waypoints.map((waypoint, index) => {
          const lat = waypoint.lat || waypoint.coordinates?.lat;
          const lon = waypoint.lon || waypoint.coordinates?.lon;
          
          if (!lat || !lon) return null;
          
          return (
            <Marker key={index} position={[lat, lon]}>
              <Popup>
                {waypoint.name || `Waypoint ${index + 1}`}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};