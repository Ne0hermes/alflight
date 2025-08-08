// src/features/navigation/components/SimpleWorkingMap.jsx
import React, { useEffect, useState } from 'react';

const SimpleWorkingMap = ({ waypoints = [], selectedAircraft }) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [markers, setMarkers] = useState([]);
  
  useEffect(() => {
    // Attendre que le DOM soit prêt
    const initMap = () => {
      const container = document.getElementById('simple-working-map');
      if (!container) {
        console.error('Container map non trouvé');
        return;
      }
      
      // Vérifier si Leaflet est disponible
      if (typeof window.L === 'undefined') {
        console.error('Leaflet non disponible');
        return;
      }
      
      // Si une carte existe déjà, la détruire
      if (mapInstance) {
        mapInstance.remove();
      }
      
      try {
        // Créer la carte
        const map = window.L.map('simple-working-map', {
          center: [46.603354, 1.888334], // Centre de la France
          zoom: 6,
          scrollWheelZoom: true
        });
        
        // Ajouter la couche OpenStreetMap
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        
        console.log('Carte créée avec succès');
        setMapInstance(map);
        
        // Forcer un redimensionnement
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
        
      } catch (error) {
        console.error('Erreur création carte:', error);
      }
    };
    
    // Initialiser après un court délai
    setTimeout(initMap, 100);
    
    // Cleanup
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, []);
  
  // Mettre à jour les waypoints
  useEffect(() => {
    if (!mapInstance || !window.L) return;
    
    // Supprimer les anciens marqueurs
    markers.forEach(marker => marker.remove());
    
    const newMarkers = [];
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    
    if (validWaypoints.length > 0) {
      // Ajouter les nouveaux marqueurs
      validWaypoints.forEach((waypoint, index) => {
        const icon = window.L.divIcon({
          html: `
            <div style="
              background-color: ${index === 0 ? '#10b981' : index === validWaypoints.length - 1 ? '#f59e0b' : '#3b82f6'};
              width: 30px;
              height: 30px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
            ">
              ${index === 0 ? 'D' : index === validWaypoints.length - 1 ? 'A' : index + 1}
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          className: 'custom-div-icon'
        });
        
        const marker = window.L.marker([waypoint.lat, waypoint.lon], { icon })
          .addTo(mapInstance)
          .bindPopup(`
            <div>
              <strong>${waypoint.name || `Point ${index + 1}`}</strong><br>
              Lat: ${waypoint.lat.toFixed(4)}°<br>
              Lon: ${waypoint.lon.toFixed(4)}°
            </div>
          `);
        
        newMarkers.push(marker);
      });
      
      // Tracer la route
      if (validWaypoints.length > 1) {
        const routeCoords = validWaypoints.map(w => [w.lat, w.lon]);
        window.L.polyline(routeCoords, {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 5'
        }).addTo(mapInstance);
      }
      
      // Ajuster la vue pour voir tous les waypoints
      if (validWaypoints.length === 1) {
        mapInstance.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
      } else if (validWaypoints.length > 1) {
        const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
      }
    }
    
    setMarkers(newMarkers);
  }, [waypoints, mapInstance]);
  
  // Calculer la distance totale
  const calculateTotalDistance = () => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length < 2) return 0;
    
    let distance = 0;
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const from = validWaypoints[i];
      const to = validWaypoints[i + 1];
      
      // Formule de Haversine
      const R = 6371; // Rayon de la Terre en km
      const dLat = (to.lat - from.lat) * Math.PI / 180;
      const dLon = (to.lon - from.lon) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      distance += R * c;
    }
    
    return (distance / 1.852).toFixed(1); // Conversion km vers NM
  };
  
  const totalDistance = calculateTotalDistance();
  
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Message d'état */}
      <div style={{
        backgroundColor: '#fef3c7',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px'
      }}>
        <strong>📍 Carte Simple (Vanilla Leaflet)</strong>
        <p style={{ margin: '4px 0', fontSize: '12px' }}>
          Cette carte utilise Leaflet en JavaScript pur sans React-Leaflet.
          Si elle fonctionne, le problème vient de React-Leaflet.
        </p>
      </div>
      
      {/* Container de la carte */}
      <div 
        id="simple-working-map"
        style={{
          width: '100%',
          height: '500px',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          backgroundColor: '#e5e7eb',
          position: 'relative'
        }}
      />
      
      {/* Panneau d'information */}
      {waypoints.length > 0 && totalDistance > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '12px'
        }}>
          <div><strong>Distance totale:</strong> {totalDistance} NM</div>
          <div><strong>Waypoints:</strong> {waypoints.filter(w => w.lat && w.lon).length}</div>
          {selectedAircraft && (
            <>
              <div><strong>Temps estimé:</strong> {(totalDistance / (selectedAircraft.cruiseSpeedKt || 100)).toFixed(1)} h</div>
              <div><strong>Carburant:</strong> {(totalDistance / (selectedAircraft.cruiseSpeedKt || 100) * (selectedAircraft.fuelConsumption || 30)).toFixed(1)} L</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleWorkingMap;