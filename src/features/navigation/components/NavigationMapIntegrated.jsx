// src/features/navigation/components/NavigationMapIntegrated.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Navigation, Fuel, MapPin, AlertCircle, Plane, Map as MapIcon } from 'lucide-react';
import { useFuel } from '@core/contexts';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { aeroDataProvider } from '@core/data';
import MapFiltersPanel from './MapFiltersPanel';

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
    baseMap: 'osm', // Choix du fond de carte
    // Filtres pour les espaces aériens
    airspaceFilters: {
      CTR: true,  // Control Zone
      TMA: true,  // Terminal Control Area
      ATZ: true,  // Aerodrome Traffic Zone
      D: true,    // Zone Dangereuse
      P: true,    // Zone Interdite
      R: true,    // Zone Réglementée
      TSA: false, // Zone Temporaire
      TRA: false, // Zone d'Entraînement
      C: true,    // Classe C
      E: true,    // Classe E
      F: false,   // Classe F
      G: false    // Classe G
    },
    // Filtres pour les aérodromes
    airportFilters: {
      international: true,
      regional: true,
      small: true,
      heliport: false,
      glider: false,
      ulm: false,
      water: false
    }
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

  // Fonction pour changer le fond de carte
  const changeBaseMap = useCallback((newBaseMap) => {
    if (!mapInstanceRef.current) {
      console.warn('⚠️ Map instance not ready');
      return;
    }
    
    if (!layersRef.current.baseMaps) {
      console.warn('⚠️ Base maps not initialized');
      return;
    }
    
    // Retirer l'ancienne couche de base
    if (layersRef.current.currentBaseMap) {
      try {
        mapInstanceRef.current.removeLayer(layersRef.current.currentBaseMap);
      } catch (e) {
        console.warn('Could not remove previous base layer:', e);
      }
    }
    
    // Ajouter la nouvelle couche de base
    const selectedMap = layersRef.current.baseMaps[newBaseMap];
    if (selectedMap) {
      try {
        selectedMap.addTo(mapInstanceRef.current);
        layersRef.current.currentBaseMap = selectedMap;
        
        // Mettre à jour l'état
        setShowLayers(prev => ({ ...prev, baseMap: newBaseMap }));
        console.log('✅ Fond de carte changé:', newBaseMap);
      } catch (e) {
        console.error('❌ Erreur lors du changement de fond de carte:', e);
      }
    } else {
      console.warn('❌ Fond de carte non trouvé:', newBaseMap);
    }
  }, []);

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

        // Définir les différents fonds de carte disponibles
        const baseMaps = {};
        
        try {
          baseMaps.osm = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            crossOrigin: true,
            updateWhenIdle: true,
            updateWhenZooming: false
          });
          
          baseMaps.osmHot = window.L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, Humanitarian OpenStreetMap Team',
            maxZoom: 19,
            crossOrigin: true
          });
          
          baseMaps.cartoDB = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, © CARTO',
            maxZoom: 19,
            crossOrigin: true
          });
          
          baseMaps.cartoDBDark = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, © CARTO',
            maxZoom: 19,
            crossOrigin: true
          });
          
          baseMaps.esriSatellite = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
            maxZoom: 19,
            crossOrigin: true
          });
          
          baseMaps.openTopoMap = window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, © OpenTopoMap',
            maxZoom: 17,
            crossOrigin: true
          });
          
          baseMaps.stamenTerrain = window.L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.jpg', {
            attribution: '© Stadia Maps, © Stamen Design, © OpenMapTiles © OpenStreetMap contributors',
            maxZoom: 18,
            crossOrigin: true
          });
          
          // Fond de carte OpenAIP par défaut si disponible
          baseMaps.openAIPBase = window.L.tileLayer('https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png', {
            attribution: '© OpenAIP',
            maxZoom: 14,
            minZoom: 3,
            crossOrigin: true
          });
        } catch (e) {
          console.error('❌ Erreur lors de la création des fonds de carte:', e);
          // Créer au moins OSM par défaut
          baseMaps.osm = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            crossOrigin: true
          });
        }

        // Stocker les références des couches de base
        layersRef.current.baseMaps = baseMaps;
        
        // Ajouter la couche de base sélectionnée
        const selectedBaseMap = baseMaps[showLayers.baseMap] || baseMaps.osm;
        if (selectedBaseMap) {
          selectedBaseMap.addTo(map);
          layersRef.current.currentBaseMap = selectedBaseMap;
        } else {
          console.error('❌ Aucun fond de carte disponible');
        }
        
        // Couche OpenAIP supprimée
        
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
  const createAirportMarkers = (airports, map, filters) => {
    const markers = [];
    let filteredCount = 0;
    
    // S'assurer que le pane existe
    if (!map.getPane('airportsPane')) {
      map.createPane('airportsPane');
      map.getPane('airportsPane').style.zIndex = 500;
    }

    airports.forEach(airport => {
      if (!airport.coordinates?.lat || !airport.coordinates?.lon) return;

      const airportType = airport.type;
      const isMainAirport = airportType === 'AIRPORT' || airportType === 'large_airport' || 
                           airportType === 'medium_airport' || airportType === 0 || airportType === 1;
      const isPrivateField = [5, 6, 7, 8].includes(airportType);
      
      // Appliquer les filtres d'aérodromes
      let shouldDisplay = false;
      
      // Vérifier le type et appliquer le filtre correspondant
      if (isMainAirport && airport.icao?.startsWith('LF') && airport.icao?.length === 4) {
        // Aéroport international français (LFXX)
        shouldDisplay = filters.international;
      } else if (isMainAirport) {
        // Aéroport régional
        shouldDisplay = filters.regional;
      } else if (airportType === 'HELIPORT' || airportType === 4) {
        shouldDisplay = filters.heliport;
      } else if (airportType === 'GLIDER' || airportType === 6) {
        shouldDisplay = filters.glider;
      } else if (airportType === 'ULM' || airportType === 7) {
        shouldDisplay = filters.ulm;
      } else if (airportType === 'SEAPLANE' || airportType === 8) {
        shouldDisplay = filters.water;
      } else {
        // Petits terrains et autres
        shouldDisplay = filters.small;
      }
      
      // Ne pas afficher si le filtre est désactivé
      if (!shouldDisplay) {
        filteredCount++;
        return;
      }
      
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

    console.log(`🛬 Aéroports: ${markers.length} affichés, ${filteredCount} filtrés`);
    return markers;
  };

  // Créer les polygones d'espaces aériens
  const createAirspacePolygons = (airspaces, map, filters) => {
    const polygons = [];
    let filteredCount = 0;
    
    // S'assurer que le pane existe
    if (map && !map.getPane('airspacesPane')) {
      map.createPane('airspacesPane');
      map.getPane('airspacesPane').style.zIndex = 400;
    }
    
    const styles = {
      'CTR': { color: '#dc2626', fillOpacity: 0.15, weight: 2 },
      'TMA': { color: '#ea580c', fillOpacity: 0.1, weight: 2 },
      'ATZ': { color: '#3b82f6', fillOpacity: 0.1, weight: 2 },
      'D': { color: '#f59e0b', fillOpacity: 0.08, weight: 1.5 },
      'R': { color: '#b91c1c', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' },
      'P': { color: '#7f1d1d', fillOpacity: 0.25, weight: 2, dashArray: '2, 2' },
      'TSA': { color: '#8b5cf6', fillOpacity: 0.08, weight: 1.5 },
      'TRA': { color: '#6366f1', fillOpacity: 0.08, weight: 1.5 },
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
      
      // Vérifier si ce type d'espace doit être affiché
      const airspaceType = airspace.type || airspace.class || 'OTHER';
      
      // Debug: afficher les types pour les premiers espaces
      if (polygons.length < 5) {
        console.log(`🌐 ${airspace.name}: type='${airspaceType}', filtres actifs:`, Object.keys(filters).filter(k => filters[k]));
      }
      
      // Vérifier si le filtre pour ce type est activé
      if (!filters[airspaceType]) {
        filteredCount++;
        return; // Ne pas afficher si le filtre est désactivé
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

    console.log(`🌍 Espaces aériens: ${polygons.length} affichés, ${filteredCount} filtrés`);
    return polygons;
  };

  // Forcer la mise à jour quand les filtres changent
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    // Fonction pour mettre à jour les couches
    const updateLayers = () => {
      console.log('🔄 Mise à jour des couches avec les filtres:', {
        airports: showLayers.airportFilters,
        airspaces: showLayers.airspaceFilters
      });
      
      // Nettoyer les anciennes couches d'aéroports
      if (layersRef.current.airports) {
        map.removeLayer(layersRef.current.airports);
        layersRef.current.airports = null;
      }

      // Ajouter les nouvelles couches d'aéroports si nécessaire
      if (showLayers.airports && filteredAirports.length > 0) {
        const airportMarkers = createAirportMarkers(filteredAirports, map, showLayers.airportFilters);
        console.log(`✈️ ${airportMarkers.length} aéroports affichés après filtrage`);
        if (airportMarkers.length > 0) {
          layersRef.current.airports = window.L.layerGroup(airportMarkers);
          layersRef.current.airports.addTo(map);
        }
      }
      
      // Nettoyer les anciennes couches d'espaces aériens
      if (layersRef.current.airspaces) {
        map.removeLayer(layersRef.current.airspaces);
        layersRef.current.airspaces = null;
      }
      
      // Ajouter les espaces aériens avec filtrage
      if (airspaces.length > 0) {
        const airspacePolygons = createAirspacePolygons(airspaces, map, showLayers.airspaceFilters);
        console.log(`🌐 ${airspacePolygons.length} espaces aériens affichés après filtrage`);
        if (airspacePolygons.length > 0) {
          layersRef.current.airspaces = window.L.layerGroup(airspacePolygons);
          layersRef.current.airspaces.addTo(map);
        }
      }
    };
    
    // Utiliser un timeout pour le debounce
    const updateTimer = setTimeout(updateLayers, 100);
    
    return () => clearTimeout(updateTimer);
  }, [
    mapReady, 
    showLayers.airports,
    showLayers.airportFilters.international,
    showLayers.airportFilters.regional,
    showLayers.airportFilters.small,
    showLayers.airportFilters.heliport,
    showLayers.airportFilters.glider,
    showLayers.airportFilters.ulm,
    showLayers.airportFilters.water,
    showLayers.airspaceFilters.CTR,
    showLayers.airspaceFilters.TMA,
    showLayers.airspaceFilters.ATZ,
    showLayers.airspaceFilters.D,
    showLayers.airspaceFilters.P,
    showLayers.airspaceFilters.R,
    showLayers.airspaceFilters.TSA,
    showLayers.airspaceFilters.TRA,
    showLayers.airspaceFilters.C,
    showLayers.airspaceFilters.E,
    showLayers.airspaceFilters.F,
    showLayers.airspaceFilters.G,
    filteredAirports, 
    airspaces
  ]);

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

  const toggleAirspaceFilter = useCallback((airspaceType) => {
    setShowLayers(prev => ({
      ...prev,
      airspaceFilters: {
        ...prev.airspaceFilters,
        [airspaceType]: !prev.airspaceFilters[airspaceType]
      }
    }));
  }, []);

  const toggleAirportFilter = useCallback((airportType) => {
    setShowLayers(prev => ({
      ...prev,
      airportFilters: {
        ...prev.airportFilters,
        [airportType]: !prev.airportFilters[airportType]
      }
    }));
  }, []);

  const handleOpacityChange = useCallback((value) => {
    const opacity = parseInt(value);
    setShowLayers(prev => ({ ...prev, openAIPOpacity: opacity }));
    
    // Opacité OpenAIP supprimée
  }, []);

  const toggleOpenAIPOverlay = useCallback(() => {
    setShowLayers(prev => {
      const newState = { ...prev, openAIPOverlay: !prev.openAIPOverlay };
      
      // Gestion OpenAIP supprimée
      
      return newState;
    });
  }, []);

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
          {/* Sélecteur de fond de carte */}
          <select
            value={showLayers.baseMap}
            onChange={(e) => changeBaseMap(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              minWidth: '120px'
            }}
            title="Changer le fond de carte"
          >
            <option value="osm">OpenStreetMap</option>
            <option value="osmHot">OSM Humanitarian</option>
            <option value="cartoDB">CartoDB Light</option>
            <option value="cartoDBDark">CartoDB Dark</option>
            <option value="esriSatellite">Satellite (Esri)</option>
            <option value="openTopoMap">OpenTopoMap</option>
            <option value="stamenTerrain">Terrain (Stamen)</option>
            <option value="openAIPBase">OpenAIP Base</option>
          </select>
          
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
            title={showLayers.openAIPOverlay ? 'Masquer l\'overlay OpenAIP' : 'Afficher l\'overlay OpenAIP'}
          >
            🗺️ OpenAIP {showLayers.openAIPOverlay ? 'ON' : 'OFF'}
          </button>
          
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

      {/* Panneau de filtres pour contrôler l'affichage */}
      <MapFiltersPanel
        showLayers={showLayers}
        showAdvancedControls={showAdvancedControls}
        setShowAdvancedControls={setShowAdvancedControls}
        toggleAirspaceFilter={toggleAirspaceFilter}
        toggleAirportFilter={toggleAirportFilter}
        handleOpacityChange={handleOpacityChange}
      />
      
      {/* Note d'utilisation */}
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Navigation:</strong> La carte affiche les données aéronautiques OpenAIP (espaces aériens, balises) en overlay sur le fond OpenStreetMap. 
        Utilisez les filtres pour afficher/masquer les différents types d'espaces aériens et d'aérodromes.
      </div>
    </div>
  );
};

export default NavigationMapIntegrated;