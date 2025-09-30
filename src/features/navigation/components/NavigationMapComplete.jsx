// src/features/navigation/components/NavigationMapComplete.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Navigation, Fuel, MapPin, Info, Plane } from 'lucide-react';
import { useFuel } from '@core/contexts';

const NavigationMapComplete = ({ waypoints = [], onWaypointUpdate, selectedAircraft }) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [showRange, setShowRange] = useState(false);
  const { fobFuel, fuelData } = useFuel();
  
  // Initialiser la carte
  useEffect(() => {
    if (typeof window.L === 'undefined') return;
    
    const container = document.getElementById('navigation-map-complete');
    if (!container) return;
    
    // Si une carte existe déjà, la détruire
    if (mapInstance) {
      mapInstance.remove();
    }
    
    // Créer la nouvelle carte
    const map = window.L.map('navigation-map-complete', {
      center: [46.603354, 1.888334], // Centre France
      zoom: 6,
      zoomControl: false // On va ajouter notre propre contrôle
    });
    
    // Ajouter le contrôle de zoom à droite
    window.L.control.zoom({
      position: 'topright'
    }).addTo(map);
    
    // Ajouter la couche OSM
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
    
    setMapInstance(map);
    
    // Forcer le redimensionnement
    setTimeout(() => map.invalidateSize(), 100);
    
    return () => {
      if (map) map.remove();
    };
  }, []);
  
  // Mettre à jour les waypoints et la route
  useEffect(() => {
    if (!mapInstance || !window.L) return;
    
    // Nettoyer les anciens layers
    mapInstance.eachLayer(layer => {
      if (layer instanceof window.L.Marker || layer instanceof window.L.Polyline || layer instanceof window.L.Circle) {
        mapInstance.removeLayer(layer);
      }
    });
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    
    if (validWaypoints.length > 0) {
      // Ajouter les marqueurs
      validWaypoints.forEach((waypoint, index) => {
        const color = index === 0 ? '#10b981' : // Vert pour départ
                     index === validWaypoints.length - 1 ? '#f59e0b' : // Orange pour arrivée
                     '#3b82f6'; // Bleu pour intermédiaires
        
        const label = index === 0 ? 'D' : 
                     index === validWaypoints.length - 1 ? 'A' : 
                     (index + 1).toString();
        
        const icon = window.L.divIcon({
          html: `
            <div style="
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
              font-size: 14px;
            ">${label}</div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          className: ''
        });
        
        const marker = window.L.marker([waypoint.lat, waypoint.lon], { 
          icon,
          draggable: !!onWaypointUpdate 
        }).addTo(mapInstance);
        
        // Popup
        marker.bindPopup(`
          <div style="min-width: 150px;">
            <strong>${waypoint.name || `Point ${index + 1}`}</strong><br>
            Lat: ${waypoint.lat.toFixed(4)}°<br>
            Lon: ${waypoint.lon.toFixed(4)}°
            ${waypoint.elevation ? `<br>Alt: ${waypoint.elevation} ft` : ''}
          </div>
        `);
        
        // Gestion du drag
        if (onWaypointUpdate) {
          marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            onWaypointUpdate(waypoint.id, {
              lat: newPos.lat,
              lon: newPos.lng
            });
          });
        }
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
      
      // Ajouter les cercles de rayon si activé
      if (showRange && selectedAircraft && fobFuel && fuelData?.finalReserve && validWaypoints[0]) {
        const usableFuel = fobFuel.ltr - fuelData.finalReserve.ltr;
        if (usableFuel > 0) {
          const endurance = usableFuel / (selectedAircraft.fuelConsumption || 30);
          const maxRangeNM = endurance * (selectedAircraft.cruiseSpeedKt || 100);
          const roundTripRangeNM = (maxRangeNM / 2) * 0.9;
          
          // Conversion NM vers mètres
          const maxRangeM = maxRangeNM * 1852;
          const roundTripRangeM = roundTripRangeNM * 1852;
          
          // Cercle max
          window.L.circle([validWaypoints[0].lat, validWaypoints[0].lon], {
            radius: maxRangeM,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 2,
            dashArray: '10, 5'
          }).addTo(mapInstance);
          
          // Cercle aller-retour
          window.L.circle([validWaypoints[0].lat, validWaypoints[0].lon], {
            radius: roundTripRangeM,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.1,
            weight: 3
          }).addTo(mapInstance);
        }
      }
      
      // Ajuster la vue
      if (validWaypoints.length === 1) {
        mapInstance.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
      } else if (validWaypoints.length > 1) {
        const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [waypoints, mapInstance, showRange, selectedAircraft, fobFuel, fuelData, onWaypointUpdate]);
  
  // Calculs
  const calculations = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length < 2) {
      return { distance: 0, time: 0, fuel: 0 };
    }
    
    let totalDistance = 0;
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const from = validWaypoints[i];
      const to = validWaypoints[i + 1];
      
      // Haversine formula
      const R = 3440.065; // Rayon terre en NM
      const dLat = (to.lat - from.lat) * Math.PI / 180;
      const dLon = (to.lon - from.lon) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    
    const cruiseSpeed = selectedAircraft?.cruiseSpeedKt || 100;
    const fuelConsumption = selectedAircraft?.fuelConsumption || 30;
    const time = totalDistance / cruiseSpeed;
    const fuel = time * fuelConsumption;
    
    return {
      distance: totalDistance.toFixed(1),
      time: time.toFixed(1),
      fuel: fuel.toFixed(1),
      waypointCount: validWaypoints.length
    };
  }, [waypoints, selectedAircraft]);
  
  return (
    <div style={{ position: 'relative' }}>
      {/* Titre de la section */}
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: 'bold', 
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <MapPin size={20} />
        Carte de navigation & Rayon d'action
      </h3>
      
      {/* Container principal avec tous les éléments */}
      <div style={{ 
        position: 'relative',
        width: '100%',
        height: '600px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#f3f4f6'
      }}>
        
        {/* La carte */}
        <div 
          id="navigation-map-complete"
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
          }}
        />
        
        {/* Panneau d'information (en bas à gauche) */}
        {calculations.distance > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            backdropFilter: 'blur(10px)'
          }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Navigation size={16} />
              Information de vol
            </h4>
            <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <div>📏 Distance totale : <strong>{calculations.distance} NM</strong></div>
              <div>📍 Waypoints : <strong>{calculations.waypointCount}</strong></div>
              {selectedAircraft && (
                <>
                  <div>⏱️ Temps estimé : <strong>{calculations.time} h</strong></div>
                  <div>⛽ Carburant : <strong>{calculations.fuel} L</strong></div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Contrôle du rayon d'action (en bas à droite) */}
        {selectedAircraft && waypoints.length > 0 && waypoints[0]?.lat && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            width: '200px',
            backdropFilter: 'blur(10px)'
          }}>
            <button
              onClick={() => setShowRange(!showRange)}
              style={{
                width: '100%',
                padding: '8px 12px',
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
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Fuel size={16} />
              {showRange ? 'Masquer rayon' : 'Afficher rayon'}
            </button>
            
            {showRange && (
              <div style={{ marginTop: '12px', fontSize: '11px', lineHeight: '1.5' }}>
                {(!fobFuel || !fuelData?.finalReserve) ? (
                  <div style={{ color: '#f59e0b' }}>
                    ⚠️ Configurez le bilan carburant
                  </div>
                ) : (
                  <>
                    <div>Carburant utilisable :</div>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                      {(fobFuel.ltr - fuelData.finalReserve.ltr).toFixed(1)} L
                    </div>
                    <div style={{ color: '#3b82f6' }}>
                      🔵 Max: {((fobFuel.ltr - fuelData.finalReserve.ltr) / (selectedAircraft.fuelConsumption || 30) * (selectedAircraft.cruiseSpeedKt || 100)).toFixed(0)} NM
                    </div>
                    <div style={{ color: '#10b981' }}>
                      🟢 A/R: {((fobFuel.ltr - fuelData.finalReserve.ltr) / (selectedAircraft.fuelConsumption || 30) * (selectedAircraft.cruiseSpeedKt || 100) / 2 * 0.9).toFixed(0)} NM
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Légende (en haut à gauche) */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          fontSize: '11px',
          backdropFilter: 'blur(10px)'
        }}>
          <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>
            Légende
          </h5>
          <div style={{ lineHeight: '1.6' }}>
            <div>🟢 D - Départ</div>
            <div>🟠 A - Arrivée</div>
            <div>🔵 1,2... - Waypoints</div>
            <div>➖ Route planifiée</div>
          </div>
        </div>
      </div>
      
      {/* Note d'utilisation */}
      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Astuce :</strong> Glissez les marqueurs pour ajuster les positions. 
        Utilisez la molette pour zoomer et clic + glisser pour naviguer sur la carte.
      </div>
    </div>
  );
};

export default NavigationMapComplete;