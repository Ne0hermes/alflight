// src/features/navigation/components/NavigationMapAlternative.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Navigation, Fuel, MapPin, AlertCircle } from 'lucide-react';
import { useFuel } from '@core/contexts';

const NavigationMapAlternative = ({ waypoints = [], onWaypointUpdate, selectedAircraft }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [tileProvider, setTileProvider] = useState('cartodb');
  const { fobFuel, fuelData } = useFuel();

  // Différents fournisseurs de tuiles
  const tileProviders = {
    cartodb: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      attribution: '© CartoDB',
      name: 'CartoDB Light'
    },
    cartodbDark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      attribution: '© CartoDB',
      name: 'CartoDB Dark'
    },
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap',
      name: 'OpenStreetMap'
    },
    stamen: {
      url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png',
      attribution: '© Stamen Design',
      name: 'Stamen Toner'
    }
  };

  useEffect(() => {
    if (!window.L) {
      console.error('Leaflet non disponible');
      return;
    }

    // Nettoyer l'ancienne carte
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const container = mapRef.current;
    if (!container) return;

    try {
      // Créer la carte
      const map = window.L.map(container, {
        center: [46.603354, 1.888334],
        zoom: 6,
        zoomControl: true
      });

      // Ajouter les tuiles avec le fournisseur sélectionné
      const provider = tileProviders[tileProvider];
      window.L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: 19,
        crossOrigin: true
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);

      // Redimensionner
      setTimeout(() => map.invalidateSize(), 100);

    } catch (error) {
      console.error('Erreur création carte:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [tileProvider]);

  // Mise à jour des waypoints
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Nettoyer les anciens layers
    map.eachLayer(layer => {
      if (layer instanceof window.L.Marker || 
          layer instanceof window.L.Polyline || 
          layer instanceof window.L.Circle) {
        map.removeLayer(layer);
      }
    });

    const validWaypoints = waypoints.filter(w => w.lat && w.lon);

    if (validWaypoints.length > 0) {
      // Ajouter les marqueurs
      validWaypoints.forEach((waypoint, index) => {
        const isFirst = index === 0;
        const isLast = index === validWaypoints.length - 1;
        const color = isFirst ? '#10b981' : isLast ? '#f59e0b' : '#3b82f6';
        const label = isFirst ? 'D' : isLast ? 'A' : String(index);

        const icon = window.L.divIcon({
          html: `<div style="
            background: ${color};
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            font-weight: bold;
          ">${label}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = window.L.marker([waypoint.lat, waypoint.lon], {
          icon,
          draggable: !!onWaypointUpdate
        }).addTo(map);

        marker.bindPopup(`
          <strong>${waypoint.name || `Point ${index + 1}`}</strong><br>
          Lat: ${waypoint.lat.toFixed(4)}°<br>
          Lon: ${waypoint.lon.toFixed(4)}°
        `);

        if (onWaypointUpdate) {
          marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            onWaypointUpdate(waypoint.id, { lat: pos.lat, lon: pos.lng });
          });
        }
      });

      // Tracer la route
      if (validWaypoints.length > 1) {
        const coords = validWaypoints.map(w => [w.lat, w.lon]);
        window.L.polyline(coords, {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 5'
        }).addTo(map);
      }

      // Ajuster la vue
      if (validWaypoints.length === 1) {
        map.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
      } else if (validWaypoints.length > 1) {
        const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [waypoints, mapReady, onWaypointUpdate]);

  return (
    <div>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: 'bold', 
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <MapPin size={20} />
        Carte de navigation (Alternative)
      </h3>

      {/* Sélecteur de fournisseur de tuiles */}
      <div style={{
        marginBottom: '12px',
        padding: '12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <strong>Fournisseur de cartes:</strong>
        <select 
          value={tileProvider}
          onChange={(e) => setTileProvider(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            backgroundColor: 'white',
            fontSize: '14px'
          }}
        >
          {Object.entries(tileProviders).map(([key, provider]) => (
            <option key={key} value={key}>{provider.name}</option>
          ))}
        </select>
        <div style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <AlertCircle size={14} />
          Changez de fournisseur si la carte ne charge pas
        </div>
      </div>

      {/* Container de la carte */}
      <div style={{ position: 'relative' }}>
        <div 
          ref={mapRef}
          style={{
            width: '100%',
            height: '500px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6'
          }}
        />

        {/* Info panneau */}
        {mapReady && waypoints.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px'
          }}>
            <strong>Waypoints:</strong> {waypoints.filter(w => w.lat && w.lon).length}
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationMapAlternative;