// src/features/navigation/components/NavigationMapFinal.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Navigation, Fuel, MapPin } from 'lucide-react';
import { useFuel } from '@core/contexts';

const NavigationMapFinal = ({ waypoints = [], onWaypointUpdate, selectedAircraft }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  const circlesRef = useRef([]);
  
  const [showRange, setShowRange] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const { fobFuel, fuelData } = useFuel();
  
  // Initialisation de la carte
  useEffect(() => {
    // Vérifier que Leaflet est disponible
    if (typeof window === 'undefined' || !window.L) {
      console.error('Leaflet non disponible');
      return;
    }
    
    // Nettoyer l'ancienne carte si elle existe
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    
    // Créer la carte après un court délai pour s'assurer que le DOM est prêt
    const timer = setTimeout(() => {
      const container = mapRef.current;
      if (!container) return;
      
      try {
        // Créer la carte
        const map = window.L.map(container, {
          center: [46.603354, 1.888334],
          zoom: 6,
          zoomControl: true
        });
        
        // Ajouter les tuiles OSM
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        }).addTo(map);
        
        mapInstanceRef.current = map;
        setMapReady(true);
        
        // Redimensionner après création
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
        
      } catch (error) {
        console.error('Erreur création carte:', error);
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);
  
  // Mise à jour des waypoints
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !window.L) return;
    
    const map = mapInstanceRef.current;
    
    // Nettoyer les anciens marqueurs
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];
    
    // Nettoyer l'ancienne route
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    
    // Nettoyer les anciens cercles
    circlesRef.current.forEach(circle => map.removeLayer(circle));
    circlesRef.current = [];
    
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
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-weight: bold;
            font-size: 14px;
          ">${label}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        
        const marker = window.L.marker([waypoint.lat, waypoint.lon], { 
          icon,
          draggable: !!onWaypointUpdate
        });
        
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
        
        marker.addTo(map);
        markersRef.current.push(marker);
      });
      
      // Tracer la route
      if (validWaypoints.length > 1) {
        const coords = validWaypoints.map(w => [w.lat, w.lon]);
        const polyline = window.L.polyline(coords, {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 5'
        });
        polyline.addTo(map);
        routeRef.current = polyline;
      }
      
      // Cercles de rayon
      if (showRange && selectedAircraft && fobFuel && fuelData?.finalReserve && validWaypoints[0]) {
        const usable = fobFuel.ltr - fuelData.finalReserve.ltr;
        if (usable > 0) {
          const hours = usable / (selectedAircraft.fuelConsumption || 30);
          const maxNM = hours * (selectedAircraft.cruiseSpeedKt || 100);
          const roundNM = (maxNM / 2) * 0.9;
          
          const maxCircle = window.L.circle([validWaypoints[0].lat, validWaypoints[0].lon], {
            radius: maxNM * 1852,
            color: '#3b82f6',
            fillOpacity: 0.05,
            weight: 2
          });
          maxCircle.addTo(map);
          circlesRef.current.push(maxCircle);
          
          const roundCircle = window.L.circle([validWaypoints[0].lat, validWaypoints[0].lon], {
            radius: roundNM * 1852,
            color: '#10b981',
            fillOpacity: 0.1,
            weight: 3
          });
          roundCircle.addTo(map);
          circlesRef.current.push(roundCircle);
        }
      }
      
      // Ajuster la vue
      if (validWaypoints.length === 1) {
        map.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
      } else if (validWaypoints.length > 1) {
        const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [waypoints, showRange, selectedAircraft, fobFuel, fuelData, onWaypointUpdate, mapReady]);
  
  // Calculs
  const stats = useMemo(() => {
    const valid = waypoints.filter(w => w.lat && w.lon);
    if (valid.length < 2) return null;
    
    let dist = 0;
    for (let i = 0; i < valid.length - 1; i++) {
      const R = 3440.065;
      const dLat = (valid[i+1].lat - valid[i].lat) * Math.PI / 180;
      const dLon = (valid[i+1].lon - valid[i].lon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(valid[i].lat * Math.PI / 180) * Math.cos(valid[i+1].lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    
    const speed = selectedAircraft?.cruiseSpeedKt || 100;
    const consumption = selectedAircraft?.fuelConsumption || 30;
    
    return {
      distance: dist.toFixed(1),
      time: (dist / speed).toFixed(1),
      fuel: ((dist / speed) * consumption).toFixed(1),
      count: valid.length
    };
  }, [waypoints, selectedAircraft]);
  
  return (
    <div>
      {/* Titre */}
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MapPin size={20} />
        Carte de navigation & Rayon d'action
      </h3>
      
      {/* Container principal */}
      <div style={{ position: 'relative' }}>
        {/* La carte */}
        <div 
          ref={mapRef}
          style={{
            width: '100%',
            height: '600px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6'
          }}
        />
        
        {/* Panneau info - Position fixed pour éviter les problèmes */}
        {mapReady && stats && (
          <div style={{
            position: 'fixed',
            bottom: '100px',
            left: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Navigation size={16} />
              Information de vol
            </h4>
            <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
              <div>Distance: <strong>{stats.distance} NM</strong></div>
              <div>Waypoints: <strong>{stats.count}</strong></div>
              <div>Temps: <strong>{stats.time} h</strong></div>
              <div>Carburant: <strong>{stats.fuel} L</strong></div>
            </div>
          </div>
        )}
        
        {/* Contrôle rayon - Position fixed */}
        {mapReady && selectedAircraft && waypoints[0]?.lat && (
          <div style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
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
              {showRange ? 'Masquer' : 'Afficher'} rayon
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationMapFinal;