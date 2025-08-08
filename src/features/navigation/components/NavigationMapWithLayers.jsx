// src/features/navigation/components/NavigationMapWithLayers.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Navigation, Fuel, MapPin, AlertCircle, Layers, Plane, Radio } from 'lucide-react';
import { useFuel } from '@core/contexts';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';

const NavigationMapWithLayers = ({ waypoints = [], onWaypointUpdate, selectedAircraft }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    airports: null,
    airspaces: null,
    navaids: null
  });
  
  const [mapReady, setMapReady] = useState(false);
  const [tileProvider, setTileProvider] = useState('cartodb');
  const [showLayers, setShowLayers] = useState({
    airports: false,
    airspaces: false,
    navaids: false,
    waypoints: true,
    range: false
  });
  
  const { fobFuel, fuelData } = useFuel();
  const { airports, airspaces, navaids, loadAirports, loadAirspaces, loadNavaids } = useOpenAIPStore();
  const loading = openAIPSelectors.useLoading();

  // Fournisseurs de tuiles
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
    }
  };

  // Charger les données OpenAIP
  useEffect(() => {
    loadAirports('FR');
    loadAirspaces('FR');
    loadNavaids('FR');
  }, [loadAirports, loadAirspaces, loadNavaids]);

  // Initialiser la carte
  useEffect(() => {
    if (!window.L) {
      console.error('Leaflet non disponible');
      return;
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const container = mapRef.current;
    if (!container) return;

    try {
      const map = window.L.map(container, {
        center: [46.603354, 1.888334],
        zoom: 6,
        zoomControl: true
      });

      const provider = tileProviders[tileProvider];
      window.L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: 19,
        crossOrigin: true
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);

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

  // Gérer les couches OpenAIP
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Couche Aérodromes
    if (layersRef.current.airports) {
      map.removeLayer(layersRef.current.airports);
      layersRef.current.airports = null;
    }

    if (showLayers.airports && airports && airports.length > 0) {
      const airportMarkers = [];
      
      airports.forEach(airport => {
        if (airport.coordinates?.lat && airport.coordinates?.lon) {
          // Icône selon le type d'aérodrome
          const iconHtml = airport.type === 'medium_airport' ? '🛩️' : 
                          airport.type === 'large_airport' ? '✈️' : '🛬';
          
          const icon = window.L.divIcon({
            html: `<div style="
              background: white;
              border: 2px solid #6366f1;
              border-radius: 4px;
              padding: 2px 4px;
              font-size: 14px;
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            ">
              ${iconHtml} <span style="font-size: 10px; font-weight: bold;">${airport.icao}</span>
            </div>`,
            iconSize: null,
            iconAnchor: [20, 10]
          });

          const marker = window.L.marker([airport.coordinates.lat, airport.coordinates.lon], { icon });
          
          marker.bindPopup(`
            <div style="min-width: 200px;">
              <strong>${airport.icao} - ${airport.name}</strong><br>
              ${airport.city ? `Ville: ${airport.city}<br>` : ''}
              Type: ${airport.type || 'Aérodrome'}<br>
              Alt: ${airport.elevation ? `${airport.elevation} ft` : 'N/A'}<br>
              ${airport.frequencies && airport.frequencies.length > 0 ? 
                `Fréquences: ${airport.frequencies.map(f => `${f.type}: ${f.frequency}`).join(', ')}` : ''}
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

    // Couche Espaces aériens
    if (layersRef.current.airspaces) {
      map.removeLayer(layersRef.current.airspaces);
      layersRef.current.airspaces = null;
    }

    if (showLayers.airspaces && airspaces && airspaces.length > 0) {
      const airspacePolygons = [];
      
      airspaces.forEach(airspace => {
        if (airspace.geometry && airspace.geometry.coordinates) {
          // Couleur selon le type d'espace
          const colors = {
            'CTR': '#ff0000',
            'TMA': '#ff6600',
            'D': '#ffaa00',
            'R': '#cc0000',
            'P': '#990000',
            'A': '#0066ff',
            'B': '#0099ff',
            'C': '#00ccff',
            'E': '#00ff99',
            'F': '#00ff00',
            'G': '#99ff00'
          };
          
          const color = colors[airspace.class] || '#888888';
          
          try {
            // Convertir les coordonnées au format Leaflet
            const coords = airspace.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            
            const polygon = window.L.polygon(coords, {
              color: color,
              weight: 2,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.1
            });
            
            polygon.bindPopup(`
              <div>
                <strong>${airspace.name}</strong><br>
                Classe: ${airspace.class}<br>
                Plancher: ${airspace.floor || '0'} ft<br>
                Plafond: ${airspace.ceiling || 'FL999'} ft
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

    // Couche Navaids (balises)
    if (layersRef.current.navaids) {
      map.removeLayer(layersRef.current.navaids);
      layersRef.current.navaids = null;
    }

    if (showLayers.navaids && navaids && navaids.length > 0) {
      const navaidMarkers = [];
      
      navaids.forEach(navaid => {
        if (navaid.coordinates?.lat && navaid.coordinates?.lon) {
          const typeIcons = {
            'VOR': '📡',
            'VOR-DME': '📡',
            'VORTAC': '📡',
            'NDB': '📻',
            'DME': '📊',
            'TACAN': '🎯'
          };
          
          const iconSymbol = typeIcons[navaid.type] || '📍';
          
          const icon = window.L.divIcon({
            html: `<div style="
              background: #fef3c7;
              border: 2px solid #f59e0b;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            ">${iconSymbol}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const marker = window.L.marker([navaid.coordinates.lat, navaid.coordinates.lon], { icon });
          
          marker.bindPopup(`
            <div>
              <strong>${navaid.ident} - ${navaid.name}</strong><br>
              Type: ${navaid.type}<br>
              ${navaid.frequency ? `Freq: ${navaid.frequency} MHz<br>` : ''}
              ${navaid.channel ? `Canal: ${navaid.channel}<br>` : ''}
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

  }, [mapReady, showLayers, airports, airspaces, navaids]);

  // Gérer les waypoints et la route
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Nettoyer les anciens waypoints et routes
    map.eachLayer(layer => {
      if (layer instanceof window.L.Marker || layer instanceof window.L.Polyline) {
        // Ne pas supprimer les marqueurs des autres couches
        if (!Object.values(layersRef.current).includes(layer.getParent ? layer.getParent() : null)) {
          if (layer instanceof window.L.Marker) {
            const icon = layer.options.icon;
            if (icon && icon.options && icon.options.html && icon.options.html.includes('D</div>')) {
              map.removeLayer(layer);
            } else if (icon && icon.options && icon.options.html && icon.options.html.includes('A</div>')) {
              map.removeLayer(layer);
            } else if (icon && icon.options && icon.options.html && (icon.options.html.includes('1</div>') || 
                     icon.options.html.includes('2</div>') || icon.options.html.includes('3</div>'))) {
              map.removeLayer(layer);
            }
          } else if (layer instanceof window.L.Polyline) {
            map.removeLayer(layer);
          }
        }
      }
    });

    if (!showLayers.waypoints) return;

    const validWaypoints = waypoints.filter(w => w.lat && w.lon);

    if (validWaypoints.length > 0) {
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
          draggable: !!onWaypointUpdate,
          zIndexOffset: 1000 // Mettre les waypoints au-dessus
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
          weight: 4,
          opacity: 0.8,
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
  }, [waypoints, mapReady, showLayers.waypoints, onWaypointUpdate]);

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
        Carte de navigation avec couches OpenAIP
      </h3>

      {/* Contrôles */}
      <div style={{
        marginBottom: '12px',
        padding: '12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '6px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Sélecteur de fond de carte */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>Fond:</strong>
            <select 
              value={tileProvider}
              onChange={(e) => setTileProvider(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                fontSize: '13px'
              }}
            >
              {Object.entries(tileProviders).map(([key, provider]) => (
                <option key={key} value={key}>{provider.name}</option>
              ))}
            </select>
          </div>

          {/* Boutons de couches */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Layers size={16} />
            <strong>Couches:</strong>
            
            <button
              onClick={() => setShowLayers(prev => ({ ...prev, airports: !prev.airports }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                backgroundColor: showLayers.airports ? '#6366f1' : 'white',
                color: showLayers.airports ? 'white' : '#374151',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plane size={12} />
              Aérodromes
              {loading.airports && ' ⏳'}
            </button>

            <button
              onClick={() => setShowLayers(prev => ({ ...prev, airspaces: !prev.airspaces }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                backgroundColor: showLayers.airspaces ? '#6366f1' : 'white',
                color: showLayers.airspaces ? 'white' : '#374151',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Espaces aériens
              {loading.airspaces && ' ⏳'}
            </button>

            <button
              onClick={() => setShowLayers(prev => ({ ...prev, navaids: !prev.navaids }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                backgroundColor: showLayers.navaids ? '#6366f1' : 'white',
                color: showLayers.navaids ? 'white' : '#374151',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Radio size={12} />
              Balises
              {loading.navaids && ' ⏳'}
            </button>

            <button
              onClick={() => setShowLayers(prev => ({ ...prev, waypoints: !prev.waypoints }))}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                backgroundColor: showLayers.waypoints ? '#10b981' : 'white',
                color: showLayers.waypoints ? 'white' : '#374151',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Route
            </button>
          </div>
        </div>

        {/* Légende des espaces aériens */}
        {showLayers.airspaces && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: 'white',
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            <strong>Légende espaces:</strong>
            <span style={{ marginLeft: '8px', color: '#ff0000' }}>■ CTR</span>
            <span style={{ marginLeft: '8px', color: '#ff6600' }}>■ TMA</span>
            <span style={{ marginLeft: '8px', color: '#ffaa00' }}>■ Classe D</span>
            <span style={{ marginLeft: '8px', color: '#cc0000' }}>■ R-Restreint</span>
            <span style={{ marginLeft: '8px', color: '#990000' }}>■ P-Interdit</span>
          </div>
        )}
      </div>

      {/* Container de la carte */}
      <div style={{ position: 'relative' }}>
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

        {/* Statistiques */}
        {mapReady && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px',
            maxWidth: '200px'
          }}>
            <div><strong>Données chargées:</strong></div>
            {showLayers.airports && <div>✈️ {airports?.length || 0} aérodromes</div>}
            {showLayers.airspaces && <div>🔶 {airspaces?.length || 0} espaces</div>}
            {showLayers.navaids && <div>📡 {navaids?.length || 0} balises</div>}
            {showLayers.waypoints && <div>📍 {waypoints.filter(w => w.lat && w.lon).length} waypoints</div>}
          </div>
        )}
      </div>

      {/* Note */}
      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 <strong>Astuce:</strong> Activez les différentes couches pour voir les aérodromes, espaces aériens et balises de navigation. 
        Les données proviennent d'OpenAIP et peuvent prendre quelques secondes à charger.
      </div>
    </div>
  );
};

export default NavigationMapWithLayers;