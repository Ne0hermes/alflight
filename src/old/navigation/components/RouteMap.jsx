// src/modules/navigation/components/RouteMap.jsx
import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Plane, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// Configuration des tuiles IGN OACI
const IGN_OACI_CONFIG = {
  // URL des tuiles SCAN OACI 2024
  url: 'https://wxs.ign.fr/{apiKey}/geoportail/wmts',
  // Clé API publique pour les essais (remplacer par votre clé en production)
  apiKey: 'essentiels',
  layer: 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI',
  style: 'normal',
  tilematrixSet: 'PM',
  format: 'image/jpeg',
  service: 'WMTS',
  version: '1.0.0',
  request: 'GetTile'
};

// Symboles pour les aérodromes
const AIRPORT_ICONS = {
  departure: {
    color: '#10b981',
    size: 12,
    symbol: '⬤'
  },
  arrival: {
    color: '#ef4444',
    size: 12,
    symbol: '⬤'
  },
  waypoint: {
    color: '#3b82f6',
    size: 8,
    symbol: '▲'
  }
};

export const RouteMap = ({ waypoints = [] }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(10);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialisation de la carte
  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded) return;

    // Créer l'élément carte
    const mapElement = document.createElement('div');
    mapElement.style.width = '100%';
    mapElement.style.height = '100%';
    mapElement.id = 'route-map';
    mapContainerRef.current.appendChild(mapElement);

    // Import dynamique de Leaflet
    Promise.all([
      import('leaflet/dist/leaflet.css'),
      import('leaflet')
    ]).then(([, L]) => {
      // Centre par défaut sur la France
      const defaultCenter = [46.603354, 1.888334];
      
      // Initialiser la carte
      const map = L.map('route-map', {
        center: defaultCenter,
        zoom: 7,
        zoomControl: false
      });

      // Ajouter les tuiles OACI de l'IGN
      const oaciLayer = L.tileLayer(
        `${IGN_OACI_CONFIG.url}?` +
        `SERVICE=${IGN_OACI_CONFIG.service}&` +
        `VERSION=${IGN_OACI_CONFIG.version}&` +
        `REQUEST=${IGN_OACI_CONFIG.request}&` +
        `LAYER=${IGN_OACI_CONFIG.layer}&` +
        `STYLE=${IGN_OACI_CONFIG.style}&` +
        `FORMAT=${IGN_OACI_CONFIG.format}&` +
        `TILEMATRIXSET=${IGN_OACI_CONFIG.tilematrixSet}&` +
        `TILEMATRIX={z}&` +
        `TILEROW={y}&` +
        `TILECOL={x}`,
        {
          attribution: '© IGN-F/Geoportail',
          minZoom: 6,
          maxZoom: 14,
          bounds: [[41, -5], [51, 10]] // Limites France métropolitaine
        }
      );

      oaciLayer.addTo(map);
      
      // Ajouter une couche de fond OSM en fallback
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        opacity: 0.3
      });
      
      // Contrôle des couches
      L.control.layers({
        'Carte OACI': oaciLayer,
        'OSM (fond)': osmLayer
      }).addTo(map);

      // Ajouter l'échelle
      L.control.scale({
        metric: true,
        imperial: false,
        position: 'bottomleft'
      }).addTo(map);

      mapRef.current = { map, L };
      setMapLoaded(true);

      // Écouter les changements de zoom
      map.on('zoomend', () => {
        setZoomLevel(map.getZoom());
      });
    });

    return () => {
      if (mapRef.current?.map) {
        mapRef.current.map.remove();
      }
    };
  }, []);

  // Mise à jour des waypoints et de la route
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || waypoints.length === 0) return;

    const { map, L } = mapRef.current;

    // Nettoyer les anciens layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Créer les marqueurs pour chaque waypoint
    const markers = [];
    const bounds = L.latLngBounds();

    waypoints.forEach((wp, index) => {
      if (!wp.lat || !wp.lon) return;

      const position = [wp.lat, wp.lon];
      bounds.extend(position);

      // Déterminer le type de waypoint
      let iconConfig;
      let label;
      if (index === 0) {
        iconConfig = AIRPORT_ICONS.departure;
        label = `Départ: ${wp.name}`;
      } else if (index === waypoints.length - 1) {
        iconConfig = AIRPORT_ICONS.arrival;
        label = `Arrivée: ${wp.name}`;
      } else {
        iconConfig = AIRPORT_ICONS.waypoint;
        label = `Point tournant: ${wp.name}`;
      }

      // Créer l'icône personnalisée
      const icon = L.divIcon({
        html: `
          <div style="
            width: ${iconConfig.size * 2}px;
            height: ${iconConfig.size * 2}px;
            background-color: ${iconConfig.color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          ">
            ${index === 0 ? '<div style="position: absolute; top: -3px; left: -3px; font-size: 16px;">✈️</div>' : ''}
          </div>
        `,
        className: 'custom-waypoint-icon',
        iconSize: [iconConfig.size * 2, iconConfig.size * 2],
        iconAnchor: [iconConfig.size, iconConfig.size]
      });

      const marker = L.marker(position, { icon })
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 14px;">
            <strong>${label}</strong><br/>
            <span style="color: #6b7280; font-size: 12px;">
              ${wp.lat.toFixed(4)}°, ${wp.lon.toFixed(4)}°
            </span>
          </div>
        `)
        .addTo(map);

      // Ajouter un label permanent pour les aéroports
      if (index === 0 || index === waypoints.length - 1) {
        marker.bindTooltip(wp.name, {
          permanent: true,
          direction: index === 0 ? 'top' : 'bottom',
          className: 'airport-label',
          offset: [0, index === 0 ? -10 : 10]
        }).openTooltip();
      }

      markers.push(marker);
    });

    // Tracer la route
    if (waypoints.length > 1) {
      const routeCoordinates = waypoints
        .filter(wp => wp.lat && wp.lon)
        .map(wp => [wp.lat, wp.lon]);

      // Ligne principale de la route
      const routeLine = L.polyline(routeCoordinates, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5',
        className: 'route-line'
      }).addTo(map);

      // Ajouter une animation à la ligne
      const routeLineBackground = L.polyline(routeCoordinates, {
        color: '#1e40af',
        weight: 5,
        opacity: 0.3
      }).addTo(map);

      // Calculer et afficher la distance totale
      let totalDistance = 0;
      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const from = L.latLng(routeCoordinates[i]);
        const to = L.latLng(routeCoordinates[i + 1]);
        totalDistance += from.distanceTo(to) / 1852; // Conversion en nautiques
      }

      // Ajouter les segments avec distances
      for (let i = 0; i < routeCoordinates.length - 1; i++) {
        const from = L.latLng(routeCoordinates[i]);
        const to = L.latLng(routeCoordinates[i + 1]);
        const distance = from.distanceTo(to) / 1852; // En NM
        
        // Point milieu pour afficher la distance
        const midpoint = [
          (routeCoordinates[i][0] + routeCoordinates[i + 1][0]) / 2,
          (routeCoordinates[i][1] + routeCoordinates[i + 1][1]) / 2
        ];

        // Calculer le cap magnétique
        const bearing = calculateBearing(
          routeCoordinates[i][0], routeCoordinates[i][1],
          routeCoordinates[i + 1][0], routeCoordinates[i + 1][1]
        );

        // Marqueur pour la distance et le cap
        const distanceIcon = L.divIcon({
          html: `
            <div style="
              background-color: white;
              padding: 4px 8px;
              border-radius: 4px;
              border: 1px solid #3b82f6;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              ${distance.toFixed(1)} NM<br/>
              ${bearing}°
            </div>
          `,
          className: 'distance-label',
          iconSize: [60, 30],
          iconAnchor: [30, 15]
        });

        L.marker(midpoint, { icon: distanceIcon }).addTo(map);
      }
    }

    // Adapter le zoom pour voir toute la route
    if (waypoints.length > 0) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 12
      });
    }

    // Ajouter un indicateur de distance totale
    addRouteInfo(map, L, waypoints);

  }, [waypoints, mapLoaded]);

  // Fonction pour calculer le cap
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return Math.round((bearing + 360) % 360);
  };

  // Ajouter les informations de route
  const addRouteInfo = (map, L, waypoints) => {
    // Retirer l'ancien contrôle s'il existe
    if (mapRef.current.routeInfoControl) {
      map.removeControl(mapRef.current.routeInfoControl);
    }

    // Calculer la distance totale
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (!waypoints[i].lat || !waypoints[i].lon) continue;
      const from = L.latLng(waypoints[i].lat, waypoints[i].lon);
      const to = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lon);
      totalDistance += from.distanceTo(to) / 1852;
    }

    // Créer un contrôle personnalisé pour les infos
    const RouteInfoControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div', 'route-info-control');
        div.innerHTML = `
          <div style="
            background-color: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            font-family: sans-serif;
          ">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 24px; height: 24px; background-color: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M3 12h18m0 0l-6-6m6 6l-6 6"/>
                </svg>
              </div>
              <strong style="font-size: 14px;">Plan de vol</strong>
            </div>
            <div style="font-size: 13px; color: #374151;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Départ:</span>
                <strong>${waypoints[0]?.name || '-'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Arrivée:</span>
                <strong>${waypoints[waypoints.length - 1]?.name || '-'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Points:</span>
                <strong>${waypoints.length}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                <span>Distance:</span>
                <strong style="color: #3b82f6;">${totalDistance.toFixed(1)} NM</strong>
              </div>
            </div>
          </div>
        `;
        return div;
      }
    });

    const routeInfoControl = new RouteInfoControl({ position: 'topright' });
    routeInfoControl.addTo(map);
    mapRef.current.routeInfoControl = routeInfoControl;
  };

  // Gestion du zoom
  const handleZoomIn = () => {
    if (mapRef.current?.map) {
      mapRef.current.map.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current?.map) {
      mapRef.current.map.zoomOut();
    }
  };

  // Gestion du plein écran
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current.parentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div style={{ 
      marginTop: '24px',
      backgroundColor: 'white',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      overflow: 'hidden'
    }}>
      {/* En-tête */}
      <div style={{
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Navigation size={18} style={{ color: 'white' }} />
          </div>
          <div>
            <h3 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1f2937',
              margin: 0
            }}>
              Carte OACI - Visualisation du plan de vol
            </h3>
            <p style={{ 
              fontSize: '12px', 
              color: '#6b7280',
              margin: '2px 0 0 0'
            }}>
              Source: IGN/SIA - SCAN OACI 2024
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleZoomOut}
            style={{
              padding: '8px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Zoom arrière"
          >
            <ZoomOut size={16} />
          </button>
          <span style={{
            padding: '8px 12px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            minWidth: '60px',
            textAlign: 'center'
          }}>
            Zoom {zoomLevel}
          </span>
          <button
            onClick={handleZoomIn}
            style={{
              padding: '8px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Zoom avant"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            style={{
              padding: '8px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Plein écran"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Conteneur de la carte */}
      <div 
        ref={mapContainerRef}
        style={{ 
          height: isFullscreen ? '100vh' : '500px',
          position: 'relative',
          backgroundColor: '#f3f4f6'
        }}
      >
        {!mapLoaded && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#6b7280' }}>Chargement de la carte OACI...</p>
          </div>
        )}
      </div>

      {/* Légende */}
      <div style={{
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }} />
            <span>Aérodrome de départ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }} />
            <span>Aérodrome d'arrivée</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }} />
            <span>Point tournant</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px',
              height: '3px',
              backgroundColor: '#3b82f6',
              border: '1px dashed #1e40af'
            }} />
            <span>Route prévue</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .custom-waypoint-icon {
          background: none !important;
          border: none !important;
        }
        
        .airport-label {
          background-color: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid #3b82f6 !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          color: #1e40af !important;
        }
        
        .distance-label {
          background: none !important;
          border: none !important;
        }
        
        .route-info-control {
          margin: 10px !important;
        }
        
        .route-line {
          animation: dash 20s linear infinite;
        }
        
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
      `}</style>
    </div>
  );
};