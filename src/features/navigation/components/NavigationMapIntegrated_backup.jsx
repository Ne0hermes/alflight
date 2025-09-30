// src/features/navigation/components/NavigationMapIntegrated.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Navigation, Fuel, MapPin, AlertCircle, Layers, Plane, Radio, Map } from 'lucide-react';
import { useFuel } from '@core/contexts';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';

const NavigationMapIntegrated = ({ waypoints = [], onWaypointUpdate, selectedAircraft }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    airports: null,
    airspaces: null,
    navaids: null,
    waypoints: [],
    route: null,
    range: []
  });
  
  const [mapReady, setMapReady] = useState(false);
  
  // Debug
  useEffect(() => {
    console.log('🔍 État mapReady:', mapReady);
  }, [mapReady]);
  const [showLayers, setShowLayers] = useState({
    airports: true, // Activé par défaut
    airspaces: true, // Activé par défaut
    privateAirfields: false, // Terrains privés désactivés par défaut
    navaids: true, // Balises VOR/NDB activées par défaut
    waypoints: true,
    range: false
  });
  
  // Filtres pour les espaces aériens
  const [airspaceFilters, setAirspaceFilters] = useState({
    CTR: true,  // Control zones
    TMA: false,  // Terminal areas (masqué par défaut)
    D: true,    // Class D
    R: true,    // Restricted
    P: true,    // Prohibited
    other: false // Autres espaces (A, B, C, E, F, G)
  });

  // Fonction pour recentrer la carte sur la route
  const recenterMap = () => {
    if (!mapInstanceRef.current || !waypoints || waypoints.length === 0) return;
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    
    if (validWaypoints.length === 0) return;
    
    if (validWaypoints.length === 1) {
      // Un seul waypoint : centrer dessus avec zoom 10
      mapInstanceRef.current.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
    } else {
      // Plusieurs waypoints : ajuster la vue pour tous les voir
      const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };
  
  const { fobFuel, fuelData } = useFuel();
  const { airports, airspaces, navaids, loadAirports, loadAirspaces, loadNavaids } = useOpenAIPStore();
  const loading = openAIPSelectors.useLoading();

  // Charger les données OpenAIP au montage
  useEffect(() => {
    console.log('🚀 Chargement initial des données OpenAIP...');
    loadAirports('FR');
    loadAirspaces('FR');
    loadNavaids('FR');
  }, [loadAirports, loadAirspaces, loadNavaids]);
  
  // Fonction de rechargement manuel
  const reloadAirspaces = () => {
    console.log('🔄 Rechargement des espaces aériens...');
    loadAirspaces('FR');
  };

  // Initialiser la carte avec OpenStreetMap
  useEffect(() => {
    const initializeMap = () => {
      if (!window.L) {
        console.error('❌ Leaflet non disponible, nouvelle tentative dans 100ms...');
        setTimeout(initializeMap, 100);
        return;
      }

      const container = mapRef.current;
      if (!container) {
        console.error('❌ Container de carte non disponible');
        return;
      }

      // Nettoyer toute carte existante
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.warn('Erreur lors de la suppression de l\'ancienne carte:', e);
        }
        mapInstanceRef.current = null;
      }

      // Vérifier si le conteneur a déjà une carte
      if (container._leaflet_id) {
        console.log('🔄 Container a déjà une carte, nettoyage...');
        delete container._leaflet_id;
      }

      try {
        console.log('🗺️ Création de la carte Leaflet...');
        
        const map = window.L.map(container, {
          center: [46.603354, 1.888334], // Centre de la France
          zoom: 6,
          zoomControl: true,
          preferCanvas: true
        });

        console.log('✅ Carte créée, ajout des tuiles OSM...');

        // Utiliser OpenStreetMap avec fallback sur CartoDB si échec
        const osmLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          crossOrigin: true
        });

        osmLayer.on('tileerror', function(error) {
          console.warn('⚠️ Erreur tuile OSM, basculement sur CartoDB...', error);
          
          // Fallback sur CartoDB
          const cartoLayer = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            attribution: '© CartoDB',
            maxZoom: 19
          });
          
          map.removeLayer(osmLayer);
          cartoLayer.addTo(map);
        });

        osmLayer.addTo(map);

        mapInstanceRef.current = map;
        setMapReady(true);
        
        console.log('✅ Carte initialisée avec succès');
        console.log('✅ mapReady défini à true');

        // Forcer le redimensionnement après un court délai
        setTimeout(() => {
          if (map && map.invalidateSize) {
            map.invalidateSize();
            console.log('✅ Taille de carte mise à jour');
          }
        }, 250);

      } catch (error) {
        console.error('❌ Erreur lors de la création de la carte:', error);
        setMapReady(false);
      }
    };

    // Lancer l'initialisation
    initializeMap();

    // Cleanup
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
  }, []);

  // Gérer les couches OpenAIP (aérodromes et espaces)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // COUCHE AÉRODROMES
    if (layersRef.current.airports) {
      map.removeLayer(layersRef.current.airports);
      layersRef.current.airports = null;
    }

    if (showLayers.airports && airports && airports.length > 0) {
      const airportMarkers = [];
      
      // Filtrer les aérodromes selon les options
      const filteredAirports = airports.filter(airport => {
        const hasICAO = airport.icao || airport.icaoCode;
        
        // Toujours afficher les aéroports avec code ICAO valide (4 lettres commençant par L pour la France)
        if (hasICAO && hasICAO !== 'undefined' && hasICAO.length === 4) return true;
        
        // Si pas de code ICAO ou code invalide, ne l'afficher que si terrains privés activés
        if (!showLayers.privateAirfields) return false;
        
        // Si terrains privés activés, afficher tous les terrains sans ICAO
        return true;
      });
      
      filteredAirports.forEach(airport => {
        if (airport.coordinates?.lat && airport.coordinates?.lon) {
          // Icône personnalisée selon le type
          const isMainAirport = airport.type === 'AIRPORT' || airport.type === 'large_airport' || airport.type === 'medium_airport' || airport.type === 0 || airport.type === 1;
          const isPrivateField = airport.type === 5 || airport.type === 6 || airport.type === 7 || airport.type === 8;
          const iconSize = isMainAirport ? 20 : 16;
          
          // Utiliser le code ICAO ou un label générique
          const label = airport.icao || airport.icaoCode || (isPrivateField ? '🛩️' : '✈️');
          
          // Couleur selon le type
          const bgColor = isMainAirport ? '#1e40af' : isPrivateField ? '#9333ea' : '#6366f1';
          
          const icon = window.L.divIcon({
            html: `<div style="
              background: ${bgColor};
              color: white;
              border-radius: 3px;
              padding: 2px 4px;
              font-size: ${isMainAirport ? '11px' : '10px'};
              font-weight: bold;
              white-space: nowrap;
              display: inline-block;
              border: 1px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            ">${label}</div>`,
            iconSize: null,
            iconAnchor: [20, 10],
            className: 'airport-label'
          });

          const marker = window.L.marker([airport.coordinates.lat, airport.coordinates.lon], { 
            icon,
            zIndexOffset: isMainAirport ? 100 : 50
          });
          
          // Déterminer le type d'aérodrome
          const getAirportTypeLabel = (type) => {
            const typeLabels = {
              0: 'Aéroport international',
              1: 'Aéroport régional',
              2: 'Aérodrome',
              3: 'Héliport',
              4: 'Altiport',
              5: 'Base ULM',
              6: 'Terrain privé',
              7: 'Base hydravion',
              8: 'Planeur',
              'AIRPORT': 'Aéroport',
              'AIRFIELD': 'Aérodrome',
              'large_airport': 'Aéroport international',
              'medium_airport': 'Aéroport régional',
              'small_airport': 'Petit aérodrome',
              'heliport': 'Héliport',
              'closed': 'Fermé'
            };
            return typeLabels[type] || `Type ${type}`;
          };
          
          const icaoDisplay = (airport.icao && airport.icao !== 'undefined') ? airport.icao : 
                              (airport.icaoCode && airport.icaoCode !== 'undefined') ? airport.icaoCode : 
                              'Non contrôlé';
          
          // Formatter les pistes
          const runwaysDisplay = airport.runways && airport.runways.length > 0 ? 
            airport.runways
              .filter(r => r && (r.designation || r.name))
              .map(r => r.designation || r.name)
              .filter(r => r && r !== 'undefined')
              .join(', ') : '';
          
          // Formatter les fréquences
          const frequenciesDisplay = airport.frequencies && airport.frequencies.length > 0 ?
            airport.frequencies
              .filter(f => f && f.frequency && f.frequency !== 'undefined')
              .map(f => {
                const typeLabel = f.type === '12' ? 'Tour' : 
                                f.type === '13' ? 'Sol' :
                                f.type === '14' ? 'Approche' :
                                f.type === '15' ? 'Info' :
                                f.type || 'Radio';
                return `&nbsp;&nbsp;• ${typeLabel}: ${f.frequency} MHz`;
              })
              .join('<br>') : '';
          
          marker.bindPopup(`
            <div style="min-width: 200px;">
              <strong style="color: #1e40af; font-size: 14px;">${icaoDisplay}</strong><br>
              <strong>${airport.name}</strong><br>
              ${airport.city ? `📍 ${airport.city}<br>` : ''}
              <em style="color: #6b7280; font-size: 12px;">${getAirportTypeLabel(airport.type)}</em><br>
              ${airport.elevation ? `⛰️ Altitude: ${airport.elevation} ft<br>` : ''}
              ${runwaysDisplay ? `🛫 Pistes: ${runwaysDisplay}<br>` : ''}
              ${frequenciesDisplay ? `📻 Fréquences:<br>${frequenciesDisplay}` : ''}
            </div>
          `);
          
          airportMarkers.push(marker);
        }
      });

      if (airportMarkers.length > 0) {
        layersRef.current.airports = window.L.layerGroup(airportMarkers);
        layersRef.current.airports.addTo(map);
      }
    }

    // COUCHE ESPACES AÉRIENS
    if (layersRef.current.airspaces) {
      map.removeLayer(layersRef.current.airspaces);
      layersRef.current.airspaces = null;
    }

    if (showLayers.airspaces && airspaces && airspaces.length > 0) {
      console.log(`🔶 Filtrage de ${airspaces.length} espaces aériens`);
      const airspacePolygons = [];
      
      // Filtrer les espaces selon les filtres actifs
      const filteredAirspaces = airspaces.filter(airspace => {
        const spaceClass = airspace.class || '';
        const spaceType = airspace.type || '';
        
        // Vérifier si ce type d'espace est activé
        if (spaceClass === 'CTR' || spaceType === 'CTR') return airspaceFilters.CTR;
        if (spaceClass === 'TMA' || spaceType === 'TMA') return airspaceFilters.TMA;
        if (spaceClass === 'D' || spaceType === 'D') return airspaceFilters.D;
        if (spaceClass === 'R' || spaceType === 'R') return airspaceFilters.R;
        if (spaceClass === 'P' || spaceType === 'P') return airspaceFilters.P;
        
        // Autres classes (A, B, C, E, F, G)
        if (['A', 'B', 'C', 'E', 'F', 'G'].includes(spaceClass)) return airspaceFilters.other;
        
        // Par défaut, ne pas afficher
        return false;
      });
      
      console.log(`🔶 ${filteredAirspaces.length} espaces après filtrage`);
      
      filteredAirspaces.forEach(airspace => {
        if (airspace.geometry && airspace.geometry.coordinates) {
          // Couleurs et opacités par type d'espace
          const styles = {
            'CTR': { color: '#dc2626', fillOpacity: 0.15, weight: 2 }, // Rouge
            'TMA': { color: '#ea580c', fillOpacity: 0.1, weight: 2 },  // Orange
            'D': { color: '#f59e0b', fillOpacity: 0.08, weight: 1.5 },  // Jaune
            'R': { color: '#b91c1c', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }, // Rouge foncé pointillé
            'P': { color: '#7f1d1d', fillOpacity: 0.25, weight: 2, dashArray: '2, 2' }, // Marron pointillé
            'A': { color: '#2563eb', fillOpacity: 0.05, weight: 1 },    // Bleu
            'B': { color: '#3b82f6', fillOpacity: 0.05, weight: 1 },    // Bleu clair
            'C': { color: '#60a5fa', fillOpacity: 0.05, weight: 1 },    // Bleu très clair
            'E': { color: '#10b981', fillOpacity: 0.03, weight: 1 },    // Vert
            'F': { color: '#84cc16', fillOpacity: 0.03, weight: 1 },    // Vert clair
            'G': { color: '#a3e635', fillOpacity: 0.02, weight: 1 }     // Vert très clair
          };
          
          const style = styles[airspace.class] || { color: '#6b7280', fillOpacity: 0.05, weight: 1 };
          
          try {
            // Convertir les coordonnées au format Leaflet
            const coords = airspace.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            
            const polygon = window.L.polygon(coords, {
              color: style.color,
              weight: style.weight,
              opacity: 0.8,
              fillColor: style.color,
              fillOpacity: style.fillOpacity,
              dashArray: style.dashArray || null
            });
            
            polygon.bindPopup(`
              <div style="min-width: 180px;">
                <strong style="color: ${style.color}; font-size: 14px;">${airspace.name}</strong><br>
                <span style="background: ${style.color}; color: white; padding: 1px 6px; border-radius: 3px; font-size: 11px;">
                  Classe ${airspace.class}
                </span><br>
                <div style="margin-top: 8px; font-size: 12px;">
                  📊 Plancher: <strong>${airspace.floor || 'SFC'}</strong><br>
                  📈 Plafond: <strong>${airspace.ceiling || 'UNL'}</strong>
                </div>
              </div>
            `);
            
            airspacePolygons.push(polygon);
          } catch (e) {
            console.warn('Erreur parsing airspace:', e);
          }
        }
      });

      if (airspacePolygons.length > 0) {
        layersRef.current.airspaces = window.L.layerGroup(airspacePolygons);
        layersRef.current.airspaces.addTo(map);
      }
    }

    // COUCHE BALISES (optionnelle)
    if (layersRef.current.navaids) {
      map.removeLayer(layersRef.current.navaids);
      layersRef.current.navaids = null;
    }

    if (showLayers.navaids && navaids && navaids.length > 0) {
      const navaidMarkers = [];
      
      navaids.forEach(navaid => {
        if (navaid.coordinates?.lat && navaid.coordinates?.lon) {
          const isVOR = navaid.type?.includes('VOR');
          const isDME = navaid.type?.includes('DME');
          const isNDB = navaid.type === 'NDB';
          const isTACAN = navaid.type?.includes('TACAN');
          
          // Symboles et couleurs selon le type
          const symbol = isVOR ? '◆' : isNDB ? '●' : isTACAN ? '▲' : '■';
          const bgColor = isVOR ? '#f59e0b' : isNDB ? '#8b5cf6' : isTACAN ? '#06b6d4' : '#6b7280';
          const size = isVOR ? '24px' : '20px';
          
          const icon = window.L.divIcon({
            html: `<div style="
              position: relative;
            ">
              <div style="
                background: ${bgColor};
                color: white;
                border-radius: 50%;
                width: ${size};
                height: ${size};
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.5);
              ">${symbol}</div>
              <div style="
                position: absolute;
                top: ${size};
                left: 50%;
                transform: translateX(-50%);
                background: white;
                padding: 1px 3px;
                border-radius: 2px;
                font-size: 9px;
                font-weight: bold;
                color: ${bgColor};
                border: 1px solid ${bgColor};
                white-space: nowrap;
                margin-top: 2px;
              ">${navaid.ident}</div>
            </div>`,
            iconSize: null,
            iconAnchor: [parseInt(size)/2, parseInt(size)/2],
            className: 'navaid-marker'
          });

          const marker = window.L.marker([navaid.coordinates.lat, navaid.coordinates.lon], { 
            icon,
            zIndexOffset: 25
          });
          
          marker.bindPopup(`
            <div style="min-width: 150px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="
                  background: ${bgColor};
                  color: white;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                ">${symbol}</span>
                <strong style="color: ${bgColor}; font-size: 14px;">${navaid.ident}</strong>
              </div>
              <div style="font-size: 12px; color: #4b5563;">
                ${navaid.name || 'Balise de navigation'}<br>
                Type: <strong>${navaid.type}</strong><br>
                ${navaid.frequency ? `📻 Fréquence: <strong>${navaid.frequency} ${navaid.type === 'NDB' ? 'kHz' : 'MHz'}</strong><br>` : ''}
                ${navaid.channel ? `📡 Canal DME: <strong>${navaid.channel}</strong><br>` : ''}
                ${isDME ? '✅ Équipé DME<br>' : ''}
              </div>
            </div>
          `);
          
          navaidMarkers.push(marker);
        }
      });

      if (navaidMarkers.length > 0) {
        layersRef.current.navaids = window.L.layerGroup(navaidMarkers);
        layersRef.current.navaids.addTo(map);
      }
    }

  }, [mapReady, showLayers, airports, airspaces, navaids, airspaceFilters]);

  // Gérer les waypoints et la route
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

    // Nettoyer les cercles de rayon
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
          html: `<div style="
            background: ${color};
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            font-weight: bold;
            font-size: 11px;
          ">${label}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const marker = window.L.marker([waypoint.lat, waypoint.lon], {
          icon,
          draggable: !!onWaypointUpdate,
          zIndexOffset: 1000
        });

        marker.bindPopup(`
          <div style="min-width: 150px;">
            <strong style="font-size: 14px; color: ${color};">
              ${isFirst ? '🛫 Départ' : isLast ? '🛬 Arrivée' : `📍 Waypoint ${index}`}
            </strong><br>
            ${waypoint.name || `Point ${index + 1}`}<br>
            <div style="margin-top: 8px; font-size: 11px; color: #6b7280;">
              Lat: ${waypoint.lat.toFixed(4)}°<br>
              Lon: ${waypoint.lon.toFixed(4)}°
              ${waypoint.elevation ? `<br>Alt: ${waypoint.elevation} ft` : ''}
            </div>
          </div>
        `);

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

      // Cercles de rayon d'action
      if (showLayers.range && selectedAircraft && fobFuel && fuelData?.finalReserve && validWaypoints[0]) {
        const usableFuel = fobFuel.ltr - fuelData.finalReserve.ltr;
        if (usableFuel > 0) {
          const endurance = usableFuel / (selectedAircraft.fuelConsumption || 30);
          const maxRangeNM = endurance * (selectedAircraft.cruiseSpeedKt || 100);
          const roundTripRangeNM = (maxRangeNM / 2) * 0.9;

          // Cercle max
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

          // Cercle aller-retour
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

      // Ajuster la vue
      if (validWaypoints.length === 1) {
        map.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
      } else if (validWaypoints.length > 1) {
        const bounds = window.L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [waypoints, mapReady, showLayers, selectedAircraft, fobFuel, fuelData, onWaypointUpdate]);

  // Calculs de vol
  const flightStats = React.useMemo(() => {
    const valid = waypoints.filter(w => w.lat && w.lon);
    if (valid.length < 2) return null;

    let distance = 0;
    for (let i = 0; i < valid.length - 1; i++) {
      const R = 3440.065; // Rayon terre en NM
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
          <Map size={20} />
          Carte de navigation intégrée
        </h3>

        {/* Boutons de contrôle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Bouton recentrer */}
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
          
          {airspaces.length === 0 && (
            <button
              onClick={reloadAirspaces}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #fbbf24',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ⚠️ Recharger espaces
            </button>
          )}
          
          <button
            onClick={() => setShowLayers(prev => ({ ...prev, airspaces: !prev.airspaces }))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: showLayers.airspaces ? '#f59e0b' : 'white',
              color: showLayers.airspaces ? 'white' : '#374151',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            🔶 Espaces aériens
          </button>
          
          <button
            onClick={() => setShowLayers(prev => ({ ...prev, privateAirfields: !prev.privateAirfields }))}
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
            onClick={() => setShowLayers(prev => ({ ...prev, navaids: !prev.navaids }))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: showLayers.navaids ? '#7c3aed' : 'white',
              color: showLayers.navaids ? 'white' : '#374151',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
            title={showLayers.navaids ? 'Masquer les balises de navigation' : 'Afficher les balises de navigation'}
          >
            <Radio size={14} />
            Balises VOR/NDB
          </button>

          <button
            onClick={() => setShowLayers(prev => ({ ...prev, range: !prev.range }))}
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

      {/* Filtres des espaces aériens */}
      {showLayers.airspaces && (
        <div style={{
          marginBottom: '12px',
          padding: '10px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 'bold', 
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            🔶 Filtrer les espaces aériens :
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setAirspaceFilters(prev => ({ ...prev, CTR: !prev.CTR }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: airspaceFilters.CTR ? '#dc2626' : '#d1d5db',
                backgroundColor: airspaceFilters.CTR ? '#dc2626' : 'white',
                color: airspaceFilters.CTR ? 'white' : '#374151',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              CTR
            </button>
            
            <button
              onClick={() => setAirspaceFilters(prev => ({ ...prev, TMA: !prev.TMA }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: airspaceFilters.TMA ? '#ea580c' : '#d1d5db',
                backgroundColor: airspaceFilters.TMA ? '#ea580c' : 'white',
                color: airspaceFilters.TMA ? 'white' : '#374151',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              TMA
            </button>
            
            <button
              onClick={() => setAirspaceFilters(prev => ({ ...prev, D: !prev.D }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: airspaceFilters.D ? '#f59e0b' : '#d1d5db',
                backgroundColor: airspaceFilters.D ? '#f59e0b' : 'white',
                color: airspaceFilters.D ? 'white' : '#374151',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Classe D
            </button>
            
            <button
              onClick={() => setAirspaceFilters(prev => ({ ...prev, R: !prev.R }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: airspaceFilters.R ? '#b91c1c' : '#d1d5db',
                backgroundColor: airspaceFilters.R ? '#b91c1c' : 'white',
                color: airspaceFilters.R ? 'white' : '#374151',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              R-Restreint
            </button>
            
            <button
              onClick={() => setAirspaceFilters(prev => ({ ...prev, P: !prev.P }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: airspaceFilters.P ? '#7f1d1d' : '#d1d5db',
                backgroundColor: airspaceFilters.P ? '#7f1d1d' : 'white',
                color: airspaceFilters.P ? 'white' : '#374151',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              P-Interdit
            </button>
            
            <button
              onClick={() => setAirspaceFilters(prev => ({ ...prev, other: !prev.other }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: airspaceFilters.other ? '#3b82f6' : '#d1d5db',
                backgroundColor: airspaceFilters.other ? '#3b82f6' : 'white',
                color: airspaceFilters.other ? 'white' : '#374151',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Classes A-C-E-F-G
            </button>
            
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setAirspaceFilters({ CTR: true, TMA: true, D: true, R: true, P: true, other: false })}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #10b981',
                  backgroundColor: 'white',
                  color: '#10b981',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Principaux
              </button>
              
              <button
                onClick={() => setAirspaceFilters({ CTR: true, TMA: true, D: true, R: true, P: true, other: true })}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #6366f1',
                  backgroundColor: 'white',
                  color: '#6366f1',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Tout
              </button>
              
              <button
                onClick={() => setAirspaceFilters({ CTR: false, TMA: false, D: false, R: false, P: false, other: false })}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #ef4444',
                  backgroundColor: 'white',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Aucun
              </button>
            </div>
          </div>
        </div>
      )}

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
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '5px' }}>
                  Initialisation Leaflet et OpenStreetMap
                </div>
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
            
            {/* Compteurs par catégorie */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {showLayers.airports && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✈️ Aérodromes:</span>
                  <strong>{airports?.filter(a => {
                    const hasICAO = a.icao || a.icaoCode;
                    if (hasICAO && hasICAO !== 'undefined' && hasICAO.length === 4) return true;
                    return showLayers.privateAirfields;
                  }).length || 0}</strong>
                </div>
              )}
              
              {showLayers.airspaces && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>🔶 Espaces aériens:</span>
                  <strong>{airspaces?.filter(a => {
                    const spaceClass = a.class || '';
                    const spaceType = a.type || '';
                    if (spaceClass === 'CTR' || spaceType === 'CTR') return airspaceFilters.CTR;
                    if (spaceClass === 'TMA' || spaceType === 'TMA') return airspaceFilters.TMA;
                    if (spaceClass === 'D' || spaceType === 'D') return airspaceFilters.D;
                    if (spaceClass === 'R' || spaceType === 'R') return airspaceFilters.R;
                    if (spaceClass === 'P' || spaceType === 'P') return airspaceFilters.P;
                    if (['A', 'B', 'C', 'E', 'F', 'G'].includes(spaceClass)) return airspaceFilters.other;
                    return false;
                  }).length || 0}</strong>
                </div>
              )}
              
              {showLayers.navaids && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>📡 Balises:</span>
                  <strong>{navaids?.length || 0}</strong>
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
            
            {/* Paramètres de navigation */}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Vitesse:</span>
                        <strong>{selectedAircraft.cruiseSpeedKt} kt</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Conso:</span>
                        <strong>{selectedAircraft.fuelConsumption} L/h</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Statut de chargement */}
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

      {/* Note d'utilisation */}
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Navigation:</strong> Les aérodromes et espaces aériens sont affichés automatiquement. 
        Cliquez sur les éléments pour voir les détails. Glissez les waypoints pour ajuster votre route.
      </div>
    </div>
  );
};

export default NavigationMapIntegrated;