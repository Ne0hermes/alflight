// src/features/navigation/components/NavigationMapIntegrated.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Navigation, Fuel, MapPin, AlertCircle, Plane, Map as MapIcon, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useFuel } from '@core/contexts';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { aeroDataProvider } from '@core/data';

// Fonction de filtrage mémorisée pour éviter les recalculs
const filterAirports = (airports, showPrivateAirfields) => {
  if (!airports || airports.length === 0) return [];
  
  return airports.filter(airport => {
    const hasICAO = airport.icao || airport.icaoCode;
    if (hasICAO && hasICAO !== 'undefined' && hasICAO.length === 4) return true;
    return showPrivateAirfields;
  });
};

const NavigationMapIntegrated = ({ waypoints = [], onWaypointUpdate, selectedAircraft }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    airports: null,
    waypoints: [],
    route: null,
    range: []
  });
  
  const [mapReady, setMapReady] = useState(false);
  const [showLayers, setShowLayers] = useState({
    airports: true,
    privateAirfields: false,
    waypoints: true,
    range: false,
    openAIPOverlay: true,
    openAIPOpacity: 80,
    openAIPLayerType: 'vfr'
  });
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  const { fobFuel, fuelData } = useFuel();
  const { airports, airspaces, loadAirports, loadAirspaces } = useOpenAIPStore();
  const loading = openAIPSelectors.useLoading();
  const errors = openAIPSelectors.useErrors();
  
  // Charger les données nécessaires
  useEffect(() => {
    const hasAirports = airports.length > 0;
    const hasAirspaces = airspaces.length > 0;
    
    if (!hasAirports) {
      console.log('🚀 Chargement des aérodromes OpenAIP...');
      loadAirports('FR');
    }
    
    // Charger les espaces aériens pour l'analyse (même s'ils ne sont pas affichés sur la carte)
    if (!hasAirspaces) {
      console.log('🚀 Chargement des espaces aériens pour l\'analyse...');
      loadAirspaces('FR');
    }
  }, []); // Dépendances vides pour ne charger qu'une fois

  // Mémoiser les aéroports filtrés
  const filteredAirports = useMemo(() => 
    filterAirports(airports, showLayers.privateAirfields),
    [airports, showLayers.privateAirfields]
  );

  // Fonction de recentrage mémorisée
  const recenterMap = useCallback(() => {
    if (!mapInstanceRef.current || !waypoints || waypoints.length === 0) return;
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) return;
    
    if (validWaypoints.length === 1) {
      mapInstanceRef.current.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
    } else {
      const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [waypoints]);

  // Initialiser la carte une seule fois
  useEffect(() => {
    const initializeMap = () => {
      if (!window.L) {
        console.error('❌ Leaflet non disponible, nouvelle tentative dans 100ms...');
        setTimeout(initializeMap, 100);
        return;
      }

      const container = mapRef.current;
      if (!container || container._leaflet_id) return;

      try {
        console.log('🗺️ Création unique de la carte Leaflet...');
        
        const map = window.L.map(container, {
          center: [46.603354, 1.888334],
          zoom: 6,
          zoomControl: true,
          preferCanvas: true // Améliore les performances avec beaucoup de marqueurs
        });

        // Créer des panes personnalisés pour contrôler l'ordre d'affichage
        map.createPane('airspacesPane');
        map.getPane('airspacesPane').style.zIndex = 400; // Au-dessus des tuiles (200)
        
        map.createPane('navaidsPane');
        map.getPane('navaidsPane').style.zIndex = 450;
        
        map.createPane('airportsPane');
        map.getPane('airportsPane').style.zIndex = 500;
        
        map.createPane('waypointsPane');
        map.getPane('waypointsPane').style.zIndex = 600;

        // Ajouter les tuiles OpenStreetMap comme fond de base
        const osmLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          crossOrigin: true,
          updateWhenIdle: true,
          updateWhenZooming: false
        });
        
        osmLayer.addTo(map);
        
        // Ajouter les tuiles OpenAIP en overlay avec transparence
        const openAIPLayer = window.L.tileLayer(openAIPService.getTileUrl(), {
          attribution: '© OpenAIP',
          maxZoom: 14,
          minZoom: 3,
          crossOrigin: true,
          opacity: 0.8,  // Transparence pour voir OSM en dessous
          updateWhenIdle: true,
          updateWhenZooming: false
        });
        
        // Stocker la référence de la couche OpenAIP
        layersRef.current.openAIPLayer = openAIPLayer;
        openAIPLayer.addTo(map);
        
        mapInstanceRef.current = map;
        setMapReady(true);
        
        console.log('✅ Carte initialisée avec OSM + overlay OpenAIP');

        // Un seul redimensionnement après initialisation
        setTimeout(() => {
          if (map && map.invalidateSize) {
            map.invalidateSize();
          }
        }, 250);

      } catch (error) {
        console.error('❌ Erreur lors de la création de la carte:', error);
        setMapReady(false);
      }
    };

    initializeMap();

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          setMapReady(false);
        } catch (e) {
          console.warn('Erreur cleanup carte:', e);
        }
      }
    };
  }, []); // Créer la carte une seule fois

  // Créer les marqueurs d'aéroports de manière optimisée
  const createAirportMarkers = useCallback((airports, map) => {
    const markers = [];
    
    // S'assurer que le pane existe
    if (!map.getPane('airportsPane')) {
      map.createPane('airportsPane');
      map.getPane('airportsPane').style.zIndex = 500;
    }

    airports.forEach(airport => {
      if (!airport.coordinates?.lat || !airport.coordinates?.lon) return;

      const isMainAirport = airport.type === 'AIRPORT' || airport.type === 'large_airport' || 
                           airport.type === 'medium_airport' || airport.type === 0 || airport.type === 1;
      const isPrivateField = [5, 6, 7, 8].includes(airport.type);
      
      const label = airport.icao || airport.icaoCode || (isPrivateField ? '🛩️' : '✈️');
      const bgColor = isMainAirport ? '#1e40af' : isPrivateField ? '#9333ea' : '#6366f1';
      
      const icon = window.L.divIcon({
        html: `<div style="background:${bgColor};color:white;border-radius:3px;padding:2px 4px;font-size:${isMainAirport ? '11px' : '10px'};font-weight:bold;white-space:nowrap;display:inline-block;border:1px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5);">${label}</div>`,
        iconSize: null,
        iconAnchor: [20, 10],
        className: 'airport-label'
      });

      const marker = window.L.marker([airport.coordinates.lat, airport.coordinates.lon], { 
        icon,
        zIndexOffset: isMainAirport ? 100 : 50,
        pane: 'airportsPane'
      });
      
      // Popup simplifié pour améliorer les performances
      const popupContent = `
        <div style="min-width:200px;">
          <strong style="color:#1e40af;font-size:14px;">${airport.icao || 'Non contrôlé'}</strong><br>
          <strong>${airport.name}</strong><br>
          ${airport.city ? `📍 ${airport.city}<br>` : ''}
          ${airport.elevation ? `⛰️ Altitude: ${airport.elevation} ft<br>` : ''}
        </div>
      `;
      
      marker.bindPopup(popupContent, { autoPan: false });
      markers.push(marker);
    });

    return markers;
  }, []);

  // Créer les polygones d'espaces aériens
  const createAirspacePolygons = useCallback((airspaces, map) => {
    const polygons = [];
    
    // S'assurer que le pane existe
    if (map && !map.getPane('airspacesPane')) {
      map.createPane('airspacesPane');
      map.getPane('airspacesPane').style.zIndex = 400;
    }
    
    const styles = {
      'CTR': { color: '#dc2626', fillOpacity: 0.15, weight: 2 },
      'TMA': { color: '#ea580c', fillOpacity: 0.1, weight: 2 },
      'D': { color: '#f59e0b', fillOpacity: 0.08, weight: 1.5 },
      'R': { color: '#b91c1c', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' },
      'P': { color: '#7f1d1d', fillOpacity: 0.25, weight: 2, dashArray: '2, 2' },
      'A': { color: '#2563eb', fillOpacity: 0.05, weight: 1 },
      'B': { color: '#3b82f6', fillOpacity: 0.05, weight: 1 },
      'C': { color: '#60a5fa', fillOpacity: 0.05, weight: 1 },
      'E': { color: '#10b981', fillOpacity: 0.03, weight: 1 },
      'F': { color: '#84cc16', fillOpacity: 0.03, weight: 1 },
      'G': { color: '#a3e635', fillOpacity: 0.02, weight: 1 }
    };

    airspaces.forEach(airspace => {
      if (!airspace.geometry?.coordinates) {
        console.warn('⚠️ Espace aérien sans géométrie:', airspace);
        return;
      }

      const style = styles[airspace.class] || styles[airspace.type] || { color: '#6b7280', fillOpacity: 0.05, weight: 1 };
      
      try {
        // Vérifier le type de géométrie (Polygon ou MultiPolygon)
        let coords;
        if (airspace.geometry.type === 'Polygon') {
          coords = airspace.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
        } else if (airspace.geometry.type === 'MultiPolygon') {
          // Pour MultiPolygon, prendre le premier polygone
          coords = airspace.geometry.coordinates[0][0].map(coord => [coord[1], coord[0]]);
        } else {
          console.warn('⚠️ Type de géométrie non supporté:', airspace.geometry.type);
          return;
        }
        const polygon = window.L.polygon(coords, {
          color: style.color,
          weight: style.weight,
          opacity: 0.8,
          fillColor: style.color,
          fillOpacity: style.fillOpacity,
          dashArray: style.dashArray || null,
          pane: 'airspacesPane'
        });
        
        // Extraire les altitudes du format OpenAIP
        const lowerLimit = airspace.lowerLimit || airspace.lower_limit || {};
        const upperLimit = airspace.upperLimit || airspace.upper_limit || {};
        
        const floor = lowerLimit.value ? 
          `${lowerLimit.value} ${lowerLimit.unit || 'ft'} ${lowerLimit.referenceDatum || ''}`.trim() : 
          'SFC';
        const ceiling = upperLimit.value ? 
          `${upperLimit.value} ${upperLimit.unit || 'ft'} ${upperLimit.referenceDatum || ''}`.trim() : 
          'UNL';
        
        const popupContent = `
          <div style="min-width:180px;">
            <strong style="color:${style.color};font-size:14px;">${airspace.name || 'Espace aérien'}</strong><br>
            <span style="background:${style.color};color:white;padding:1px 6px;border-radius:3px;font-size:11px;">
              ${airspace.class || airspace.type || 'N/A'}
            </span><br>
            <div style="margin-top:8px;font-size:12px;">
              📊 Plancher: <strong>${floor}</strong><br>
              📈 Plafond: <strong>${ceiling}</strong>
            </div>
          </div>
        `;
        
        polygon.bindPopup(popupContent, { autoPan: false });
        polygons.push(polygon);
      } catch (e) {
        console.warn('Erreur parsing airspace:', e);
      }
    });

    return polygons;
  }, []);

  // Gérer les couches de manière optimisée avec debounce
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    const updateTimer = setTimeout(() => {
      // Nettoyer les anciennes couches
      if (layersRef.current.airports) {
        map.removeLayer(layersRef.current.airports);
        layersRef.current.airports = null;
      }

      // Ajouter les nouvelles couches si nécessaire
      if (showLayers.airports && filteredAirports.length > 0) {
        const airportMarkers = createAirportMarkers(filteredAirports, map);
        if (airportMarkers.length > 0) {
          layersRef.current.airports = window.L.layerGroup(airportMarkers);
          layersRef.current.airports.addTo(map);
        }
      }
      
      // Les espaces aériens et balises sont maintenant affichés via les tuiles OpenAIP
      // Plus besoin de les ajouter en tant que données vectorielles
    }, 100); // Debounce de 100ms

    return () => clearTimeout(updateTimer);
  }, [mapReady, showLayers, filteredAirports, createAirportMarkers]);

  // Gérer les waypoints et la route (séparément des autres couches)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !showLayers.waypoints) return;
    
    const map = mapInstanceRef.current;

    // Nettoyer les anciens waypoints
    layersRef.current.waypoints.forEach(marker => map.removeLayer(marker));
    layersRef.current.waypoints = [];

    if (layersRef.current.route) {
      map.removeLayer(layersRef.current.route);
      layersRef.current.route = null;
    }

    layersRef.current.range.forEach(circle => map.removeLayer(circle));
    layersRef.current.range = [];

    const validWaypoints = waypoints.filter(w => w.lat && w.lon);

    if (validWaypoints.length > 0) {
      // Ajouter les marqueurs de waypoints
      validWaypoints.forEach((waypoint, index) => {
        const isFirst = index === 0;
        const isLast = index === validWaypoints.length - 1;
        const color = isFirst ? '#10b981' : isLast ? '#dc2626' : '#3b82f6';
        const label = isFirst ? 'DEP' : isLast ? 'ARR' : `WP${index}`;

        const icon = window.L.divIcon({
          html: `<div style="background:${color};color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-weight:bold;font-size:11px;">${label}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = window.L.marker([waypoint.lat, waypoint.lon], {
          icon,
          draggable: !!onWaypointUpdate,
          zIndexOffset: 1000
        });

        const popupContent = `
          <div style="min-width:150px;">
            <strong style="font-size:14px;color:${color};">
              ${isFirst ? '🛫 Départ' : isLast ? '🛬 Arrivée' : `📍 Waypoint ${index}`}
            </strong><br>
            ${waypoint.name || `Point ${index + 1}`}
          </div>
        `;

        marker.bindPopup(popupContent, { autoPan: false });

        if (onWaypointUpdate) {
          marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            onWaypointUpdate(waypoint.id, { lat: pos.lat, lon: pos.lng });
          });
        }

        marker.addTo(map);
        layersRef.current.waypoints.push(marker);
      });

      // Tracer la route
      if (validWaypoints.length > 1) {
        const coords = validWaypoints.map(w => [w.lat, w.lon]);
        const polyline = window.L.polyline(coords, {
          color: '#1e40af',
          weight: 4,
          opacity: 0.8,
          dashArray: '15, 10',
          lineCap: 'round',
          lineJoin: 'round'
        });
        polyline.addTo(map);
        layersRef.current.route = polyline;
      }

      // Cercles de rayon d'action (optionnel)
      if (showLayers.range && selectedAircraft && fobFuel && fuelData?.finalReserve && validWaypoints[0]) {
        const usableFuel = fobFuel.ltr - fuelData.finalReserve.ltr;
        if (usableFuel > 0) {
          const endurance = usableFuel / (selectedAircraft.fuelConsumption || 30);
          const maxRangeNM = endurance * (selectedAircraft.cruiseSpeedKt || 100);
          const roundTripRangeNM = (maxRangeNM / 2) * 0.9;

          const maxCircle = window.L.circle([validWaypoints[0].lat, validWaypoints[0].lon], {
            radius: maxRangeNM * 1852,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 2,
            dashArray: '10, 5'
          });
          maxCircle.addTo(map);
          layersRef.current.range.push(maxCircle);

          const roundCircle = window.L.circle([validWaypoints[0].lat, validWaypoints[0].lon], {
            radius: roundTripRangeNM * 1852,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.1,
            weight: 3
          });
          roundCircle.addTo(map);
          layersRef.current.range.push(roundCircle);
        }
      }

      // Ajuster la vue une seule fois
      if (validWaypoints.length === 1) {
        map.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
      } else if (validWaypoints.length > 1) {
        const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [waypoints, mapReady, showLayers.waypoints, showLayers.range, selectedAircraft, fobFuel, fuelData, onWaypointUpdate]);

  // Calculs de vol mémorisés
  const flightStats = useMemo(() => {
    const valid = waypoints.filter(w => w.lat && w.lon);
    if (valid.length < 2) return null;

    let distance = 0;
    for (let i = 0; i < valid.length - 1; i++) {
      const R = 3440.065;
      const dLat = (valid[i+1].lat - valid[i].lat) * Math.PI / 180;
      const dLon = (valid[i+1].lon - valid[i].lon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(valid[i].lat * Math.PI / 180) * Math.cos(valid[i+1].lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      distance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    const speed = selectedAircraft?.cruiseSpeedKt || 100;
    const consumption = selectedAircraft?.fuelConsumption || 30;

    return {
      distance: distance.toFixed(1),
      time: (distance / speed).toFixed(1),
      fuel: ((distance / speed) * consumption).toFixed(1),
      waypoints: valid.length
    };
  }, [waypoints, selectedAircraft]);

  // Callbacks pour les changements de filtres (évite les re-créations)
  const togglePrivateAirfields = useCallback(() => {
    setShowLayers(prev => ({ ...prev, privateAirfields: !prev.privateAirfields }));
  }, []);

  const toggleRange = useCallback(() => {
    setShowLayers(prev => ({ ...prev, range: !prev.range }));
  }, []);

  const toggleOpenAIPOverlay = useCallback(() => {
    setShowLayers(prev => {
      const newState = { ...prev, openAIPOverlay: !prev.openAIPOverlay };
      
      // Gérer l'affichage de la couche OpenAIP
      if (mapInstanceRef.current && layersRef.current.openAIPLayer) {
        if (newState.openAIPOverlay) {
          layersRef.current.openAIPLayer.addTo(mapInstanceRef.current);
        } else {
          mapInstanceRef.current.removeLayer(layersRef.current.openAIPLayer);
        }
      }
      
      return newState;
    });
  }, []);

  const handleOpacityChange = useCallback((value) => {
    const opacity = parseInt(value);
    setShowLayers(prev => ({ ...prev, openAIPOpacity: opacity }));
    
    // Appliquer l'opacité à la couche OpenAIP
    if (layersRef.current.openAIPLayer) {
      layersRef.current.openAIPLayer.setOpacity(opacity / 100);
    }
  }, []);

  const handleLayerTypeChange = useCallback((layerType) => {
    setShowLayers(prev => ({ ...prev, openAIPLayerType: layerType }));
    
    // Recréer la couche OpenAIP avec le nouveau type
    if (mapInstanceRef.current && layersRef.current.openAIPLayer) {
      // Supprimer l'ancienne couche
      mapInstanceRef.current.removeLayer(layersRef.current.openAIPLayer);
      
      // Créer une nouvelle couche avec le nouveau type
      const newLayer = window.L.tileLayer(openAIPService.getTileUrl(layerType), {
        attribution: '© OpenAIP',
        maxZoom: 14,
        minZoom: 3,
        crossOrigin: true,
        opacity: showLayers.openAIPOpacity / 100,
        updateWhenIdle: true,
        updateWhenZooming: false
      });
      
      layersRef.current.openAIPLayer = newLayer;
      
      // Ajouter la nouvelle couche si l'overlay est activé
      if (showLayers.openAIPOverlay) {
        newLayer.addTo(mapInstanceRef.current);
      }
    }
  }, [showLayers.openAIPOpacity, showLayers.openAIPOverlay]);

  return (
    <div>
      {/* En-tête avec titre et contrôles */}
      <div style={{ 
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: 0
        }}>
          <MapIcon size={20} />
          Carte de navigation intégrée
        </h3>

        {/* Boutons de contrôle */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={recenterMap}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              backgroundColor: waypoints && waypoints.length > 0 ? '#10b981' : '#d1d5db',
              color: 'white',
              fontSize: '12px',
              cursor: waypoints && waypoints.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
              opacity: waypoints && waypoints.length > 0 ? 1 : 0.5
            }}
            disabled={!waypoints || waypoints.length === 0}
            title="Recentrer la carte sur votre route"
          >
            🎯 Recentrer
          </button>
          
          <button
            onClick={toggleOpenAIPOverlay}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: showLayers.openAIPOverlay ? '#f59e0b' : 'white',
              color: showLayers.openAIPOverlay ? 'white' : '#374151',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
            title={showLayers.openAIPOverlay ? 'Masquer les données aéronautiques OpenAIP' : 'Afficher les données aéronautiques OpenAIP'}
          >
            🗺️ OpenAIP
          </button>
          
          {showLayers.openAIPOverlay && (
            <>
              <select
                value={showLayers.openAIPLayerType}
                onChange={(e) => handleLayerTypeChange(e.target.value)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                title="Type de données OpenAIP à afficher"
              >
                <option value="vfr">🌤️ VFR</option>
                <option value="ifr-low">☁️ IFR Low</option>
                <option value="ifr-high">✈️ IFR High</option>
                <option value="vrp">📍 Points VFR</option>
                <option value="obstacles">⚠️ Obstacles</option>
              </select>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 8px',
                borderRadius: '6px',
                backgroundColor: '#f3f4f6',
                fontSize: '11px'
              }}>
                <span>Opacité:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={showLayers.openAIPOpacity}
                  onChange={(e) => handleOpacityChange(e.target.value)}
                  style={{
                    width: '80px',
                    height: '20px',
                    cursor: 'pointer'
                  }}
                  title={`Opacité: ${showLayers.openAIPOpacity}%`}
                />
                <span style={{ minWidth: '35px', textAlign: 'right' }}>
                  {showLayers.openAIPOpacity}%
                </span>
              </div>
            </>
          )}
          
          <button
            onClick={togglePrivateAirfields}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: showLayers.privateAirfields ? '#9333ea' : 'white',
              color: showLayers.privateAirfields ? 'white' : '#374151',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
            title={showLayers.privateAirfields ? 'Masquer les terrains sans code ICAO' : 'Afficher tous les terrains privés, ULM, planeurs...'}
          >
            🛩️ Terrains sans ICAO
          </button>

          <button
            onClick={toggleRange}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: showLayers.range ? '#3b82f6' : 'white',
              color: showLayers.range ? 'white' : '#374151',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
            disabled={!selectedAircraft || !waypoints[0]?.lat}
          >
            <Fuel size={14} />
            Rayon d'action
          </button>
        </div>
      </div>

      {/* Container de la carte */}
      <div style={{ position: 'relative' }}>
        <div 
          ref={mapRef}
          style={{
            width: '100%',
            height: '600px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6'
          }}
        >
          {!mapReady && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 1000
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div className="animate-spin" style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Chargement de la carte...</div>
              </div>
            </div>
          )}
        </div>

        {/* Panneau de données affichées (en haut à droite) */}
        {mapReady && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px',
            backdropFilter: 'blur(10px)',
            minWidth: '180px',
            zIndex: 1000
          }}>
            <h4 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '13px',
              fontWeight: 'bold',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '6px'
            }}>
              📊 Données affichées
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {showLayers.openAIPOverlay && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>🗺️ OpenAIP:</span>
                    <strong>{showLayers.openAIPOpacity}%</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                    <span>Type:</span>
                    <span style={{ textTransform: 'uppercase' }}>{showLayers.openAIPLayerType}</span>
                  </div>
                </div>
              )}
              
              {showLayers.airports && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✈️ Aérodromes:</span>
                  <strong>{filteredAirports.length}</strong>
                </div>
              )}
              
              {waypoints && waypoints.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px solid #e5e7eb',
                  marginTop: '6px'
                }}>
                  <span>📍 Waypoints:</span>
                  <strong>{waypoints.filter(w => w.lat && w.lon).length}</strong>
                </div>
              )}
            </div>
            
            {flightStats && (
              <div style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  marginBottom: '6px',
                  color: '#374151'
                }}>
                  ⚙️ Navigation
                </div>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '3px',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Distance:</span>
                    <strong>{flightStats.distance} NM</strong>
                  </div>
                  {selectedAircraft && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Temps:</span>
                        <strong>{flightStats.time} h</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Carburant:</span>
                        <strong>{flightStats.fuel} L</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {(loading.airports || loading.airspaces || loading.navaids) && (
              <div style={{ 
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #e5e7eb',
                color: '#f59e0b',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span className="animate-spin">⏳</span>
                Chargement en cours...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Affichage des erreurs de connexion */}
      {errors.airports && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#fef2f2',
          borderRadius: '6px',
          border: '1px solid #fecaca',
          fontSize: '13px',
          color: '#991b1b'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠️ Problème de connexion à l'API OpenAIP
          </div>
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
            <div>❌ Aérodromes: {errors.airports}</div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #fecaca' }}>
              <strong>Solutions possibles:</strong>
              <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                <li>Vérifiez votre connexion internet</li>
                <li>Le proxy OpenAIP n'est pas démarré (port 3001)</li>
                <li>L'API OpenAIP est temporairement indisponible</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Panneau de contrôles avancés */}
      <div style={{
        marginTop: '12px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <button
          onClick={() => setShowAdvancedControls(!showAdvancedControls)}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: '#f9fafb',
            border: 'none',
            borderBottom: showAdvancedControls ? '1px solid #e5e7eb' : 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={16} />
            Contrôles avancés de la carte
          </div>
          {showAdvancedControls ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        
        {showAdvancedControls && (
          <div style={{ padding: '12px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                🌐 Types de cartes OpenAIP
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {[
                  { value: 'vfr', label: '🌤️ VFR', desc: 'Vol à vue' },
                  { value: 'ifr-low', label: '☁️ IFR Low', desc: 'Vol aux instruments basse altitude' },
                  { value: 'ifr-high', label: '✈️ IFR High', desc: 'Vol aux instruments haute altitude' },
                  { value: 'vrp', label: '📍 Points VFR', desc: 'Points de report VFR' },
                  { value: 'obstacles', label: '⚠️ Obstacles', desc: 'Obstacles à la navigation' }
                ].map(type => (
                  <label
                    key={type.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      padding: '8px',
                      borderRadius: '6px',
                      border: `2px solid ${showLayers.openAIPLayerType === type.value ? '#f59e0b' : '#e5e7eb'}`,
                      backgroundColor: showLayers.openAIPLayerType === type.value ? '#fef3c7' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="radio"
                      name="openAIPLayerType"
                      value={type.value}
                      checked={showLayers.openAIPLayerType === type.value}
                      onChange={(e) => handleLayerTypeChange(e.target.value)}
                      style={{ marginRight: '8px', marginTop: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '500' }}>{type.label}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                        {type.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                🎨 Paramètres d'affichage
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <label style={{ fontSize: '12px' }}>Opacité de l'overlay OpenAIP:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={showLayers.openAIPOpacity}
                      onChange={(e) => handleOpacityChange(e.target.value)}
                      style={{
                        width: '120px',
                        height: '20px',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ minWidth: '40px', fontSize: '12px', textAlign: 'right' }}>
                      {showLayers.openAIPOpacity}%
                    </span>
                  </div>
                </div>
                
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}>
                  <span>Afficher les aérodromes:</span>
                  <input
                    type="checkbox"
                    checked={showLayers.airports}
                    onChange={(e) => setShowLayers(prev => ({ ...prev, airports: e.target.checked }))}
                    style={{ cursor: 'pointer' }}
                  />
                </label>
                
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}>
                  <span>Afficher les terrains privés:</span>
                  <input
                    type="checkbox"
                    checked={showLayers.privateAirfields}
                    onChange={(e) => setShowLayers(prev => ({ ...prev, privateAirfields: e.target.checked }))}
                    style={{ cursor: 'pointer' }}
                  />
                </label>
                
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px'
                }}>
                  <span>Afficher les waypoints:</span>
                  <input
                    type="checkbox"
                    checked={showLayers.waypoints}
                    onChange={(e) => setShowLayers(prev => ({ ...prev, waypoints: e.target.checked }))}
                    style={{ cursor: 'pointer' }}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Note d'utilisation */}
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Navigation:</strong> La carte affiche les données aéronautiques OpenAIP en overlay sur OpenStreetMap. 
        Utilisez les contrôles avancés pour personnaliser l'affichage selon vos besoins (VFR/IFR, opacité, filtres). 
        Cliquez sur les éléments pour voir les détails.
      </div>
    </div>
  );
};

export default NavigationMapIntegrated;