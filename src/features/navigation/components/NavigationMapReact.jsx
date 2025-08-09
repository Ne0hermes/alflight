// src/features/navigation/components/NavigationMapReact.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, GeoJSON, LayerGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Settings, Loader } from 'lucide-react';
import { openAIPService } from '@services/openAIPService';
import { useOpenAIPStore } from '@core/stores/openAIPStore';

// Fix pour les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Composant pour gérer les changements de vue
const MapController = ({ waypoints }) => {
  const map = useMap();
  
  useEffect(() => {
    if (waypoints.length >= 2) {
      const bounds = waypoints
        .filter(w => w.lat && w.lon)
        .map(w => [w.lat, w.lon]);
      
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [waypoints, map]);
  
  return null;
};

// Composant pour charger les données dynamiquement
const DataLoader = ({ filters, onDataUpdate }) => {
  const map = useMap();
  const { loadAirspaces, loadNavaids } = useOpenAIPStore();
  const airports = useOpenAIPStore(state => state.airports);
  const airspaces = useOpenAIPStore(state => state.airspaces);
  const navaids = useOpenAIPStore(state => state.navaids);
  
  const loadData = useCallback(async () => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    if (zoom < 7) {
      onDataUpdate({
        airspaces: [],
        airfields: [],
        navaids: []
      });
      return;
    }
    
    // Charger les données si nécessaire
    if (!airspaces.length) {
      await loadAirspaces('FR');
    }
    if (!navaids.length) {
      await loadNavaids('FR');
    }
    
    // Filtrer les données visibles
    const visibleAirspaces = airspaces.filter(airspace => {
      if (!airspace.geometry?.coordinates) return false;
      const coords = airspace.geometry.type === 'MultiPolygon' 
        ? airspace.geometry.coordinates[0][0]
        : airspace.geometry.coordinates[0];
      return coords.some(coord => bounds.contains([coord[1], coord[0]]));
    });
    
    const visibleAirfields = airports.filter(airport => 
      bounds.contains([airport.coordinates.lat, airport.coordinates.lon])
    );
    
    const visibleNavaids = navaids.filter(navaid => 
      bounds.contains([navaid.coordinates.lat, navaid.coordinates.lon])
    );
    
    onDataUpdate({
      airspaces: visibleAirspaces,
      airfields: visibleAirfields,
      navaids: visibleNavaids
    });
  }, [map, airports, airspaces, navaids, loadAirspaces, loadNavaids, onDataUpdate]);
  
  useEffect(() => {
    // Chargement initial
    loadData();
    
    // Écouter les événements de la carte
    map.on('moveend', loadData);
    map.on('zoomend', loadData);
    
    return () => {
      map.off('moveend', loadData);
      map.off('zoomend', loadData);
    };
  }, [map, loadData]);
  
  return null;
};

const NavigationMapReact = ({ waypoints = [], onWaypointUpdate }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showDetailedFilters, setShowDetailedFilters] = useState(false);
  const [baseMap, setBaseMap] = useState('osm');
  const [showAirspaces, setShowAirspaces] = useState(true);
  const [showOpenAIP, setShowOpenAIP] = useState(true);
  const [visibleData, setVisibleData] = useState({
    airspaces: [],
    airfields: [],
    navaids: []
  });
  
  const [filters, setFilters] = useState({
    airspaces: {
      CTR: true,
      TMA: true,
      D: true,
      P: true,
      R: true,
      TSA: false,
      TRA: false,
      ATZ: true,
      RMZ: true,
      TMZ: true,
      A: true,
      B: true,
      C: true,
      E: true,
      F: true,
      G: false
    },
    airfields: {
      AIRPORT: true,
      AIRFIELD: true,
      HELIPORT: false,
      GLIDER: false,
      ULM: false
    },
    navaids: {
      VOR: true,
      NDB: true,
      DME: true,
      TACAN: false
    }
  });

  // Couleurs des espaces aériens
  const getAirspaceColor = (type) => {
    const colors = {
      CTR: '#FF0000',
      TMA: '#FF6B00',
      D: '#0066FF',
      P: '#FF0000',
      R: '#FF0000',
      TSA: '#9900FF',
      TRA: '#9900FF',
      ATZ: '#00AA00',
      RMZ: '#FFD700',
      TMZ: '#FFA500',
      A: '#AA0000',
      B: '#FF0066',
      C: '#FF9900',
      E: '#00AA00',
      F: '#0099FF',
      G: '#808080'
    };
    return colors[type] || '#666666';
  };

  // Style pour les espaces aériens
  const getAirspaceStyle = (feature) => ({
    color: getAirspaceColor(feature.properties.type),
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.15,
    dashArray: ['D', 'P', 'R'].includes(feature.properties.type) ? '5, 5' : null
  });

  // Créer les icônes personnalisées
  const createWaypointIcon = (index, total) => {
    const color = index === 0 ? '#00AA00' : index === total - 1 ? '#FF0000' : '#0066CC';
    
    return L.divIcon({
      html: `<div style="
        background-color: ${color};
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      ">${index + 1}</div>`,
      className: 'custom-waypoint-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  };

  const createAirfieldIcon = (type) => {
    const colors = {
      AIRPORT: '#0066CC',
      AIRFIELD: '#00AA00',
      HELIPORT: '#FF6600',
      GLIDER: '#9900CC',
      ULM: '#FF00FF'
    };
    
    return L.divIcon({
      html: `<div style="
        background-color: ${colors[type] || '#666'};
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">✈</div>`,
      className: 'custom-airfield-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  const createNavaidIcon = (type) => {
    const symbols = {
      VOR: '◈',
      NDB: '◉',
      DME: '◊',
      TACAN: '▲'
    };
    
    return L.divIcon({
      html: `<div style="
        background-color: #6B46C1;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${symbols[type] || '?'}</div>`,
      className: 'custom-navaid-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  // Handler pour les changements de filtres
  const handleFilterChange = (category, type) => {
    setFilters(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [type]: !prev[category][type]
      }
    }));
  };

  // Filtrer les espaces aériens
  const filteredAirspaces = visibleData.airspaces.filter(airspace => 
    filters.airspaces[airspace.type]
  );

  // Filtrer les aérodromes
  const filteredAirfields = visibleData.airfields.filter(airfield => 
    filters.airfields[airfield.type]
  );

  // Filtrer les balises
  const filteredNavaids = visibleData.navaids.filter(navaid => 
    filters.navaids[navaid.type]
  );

  // Créer les features GeoJSON pour les espaces aériens avec mémoïsation
  const airspaceFeatures = useMemo(() => ({
    type: 'FeatureCollection',
    features: filteredAirspaces
      .filter(airspace => airspace.geometry)
      .map(airspace => ({
        type: 'Feature',
        properties: {
          name: airspace.name,
          type: airspace.type,
          class: airspace.class,
          lowerLimit: airspace.lowerLimit,
          upperLimit: airspace.upperLimit
        },
        geometry: airspace.geometry
      }))
  }), [filteredAirspaces]);

  // Route entre les waypoints
  const routeCoordinates = waypoints
    .filter(w => w.lat && w.lon)
    .map(w => [w.lat, w.lon]);

  // URLs des tiles mémorisées pour éviter les rechargements
  const tileUrls = {
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    osmHot: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    cartoDB: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    cartoDBDark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    esriSatellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    openTopoMap: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    stamenTerrain: "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg"
  };
  
  const tileAttributions = {
    osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    osmHot: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Humanitarian OSM Team',
    cartoDB: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CARTO',
    cartoDBDark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CARTO',
    esriSatellite: '&copy; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    openTopoMap: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; OpenTopoMap',
    stamenTerrain: '&copy; Stadia Maps, &copy; Stamen Design, &copy; OpenMapTiles &copy; OpenStreetMap'
  };
  
  const openAipUrl = useMemo(() => openAIPService.getTileUrl('vfr'), []);

  return (
    <div style={{ position: 'relative' }}>
      {/* Barre de contrôle avec sélecteur de carte */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '8px',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <select
          value={baseMap}
          onChange={(e) => setBaseMap(e.target.value)}
          style={{
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            minWidth: '150px'
          }}
        >
          <option value="osm">OpenStreetMap</option>
          <option value="osmHot">OSM Humanitarian</option>
          <option value="cartoDB">CartoDB Light</option>
          <option value="cartoDBDark">CartoDB Dark</option>
          <option value="esriSatellite">Satellite (Esri)</option>
          <option value="openTopoMap">OpenTopoMap</option>
          <option value="stamenTerrain">Terrain (Stamen)</option>
        </select>
        
        <button
          onClick={() => setShowAirspaces(!showAirspaces)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: showAirspaces ? '#3b82f6' : 'white',
            color: showAirspaces ? 'white' : '#374151',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Afficher/masquer les espaces aériens"
        >
          ✈️ Espaces {showAirspaces ? 'ON' : 'OFF'}
        </button>
        
        <button
          onClick={() => setShowOpenAIP(!showOpenAIP)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: showOpenAIP ? '#f59e0b' : 'white',
            color: showOpenAIP ? 'white' : '#374151',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Afficher/masquer l'overlay OpenAIP"
        >
          🗺️ OpenAIP {showOpenAIP ? 'ON' : 'OFF'}
        </button>
        
        <button
          onClick={() => setShowDetailedFilters(!showDetailedFilters)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: showDetailedFilters ? '#8b5cf6' : 'white',
            color: showDetailedFilters ? 'white' : '#374151',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Filtres détaillés"
        >
          ⚙️ Filtres
        </button>
      </div>
      
      {/* Panneau de filtres détaillés */}
      {showDetailedFilters && (
        <div style={{
          position: 'absolute',
          top: '60px',
          left: '10px',
          zIndex: 999,
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          minWidth: '250px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>
            Filtrer les espaces aériens
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Zones contrôlées */}
            <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#6b7280' }}>
                Zones contrôlées
              </div>
              {['CTR', 'TMA', 'ATZ'].map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.airspaces[type]}
                    onChange={() => handleFilterChange('airspaces', type)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: getAirspaceColor(type), fontWeight: 'bold' }}>■</span>
                  {type} - {type === 'CTR' ? 'Zone de contrôle' : type === 'TMA' ? 'Zone terminale' : 'Zone de trafic'}
                </label>
              ))}
            </div>
            
            {/* Zones dangereuses/interdites */}
            <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#6b7280' }}>
                Zones spéciales
              </div>
              {['D', 'P', 'R'].map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.airspaces[type]}
                    onChange={() => handleFilterChange('airspaces', type)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: getAirspaceColor(type), fontWeight: 'bold' }}>■</span>
                  {type} - {type === 'D' ? 'Zone dangereuse' : type === 'P' ? 'Zone interdite' : 'Zone réglementée'}
                </label>
              ))}
            </div>
            
            {/* Zones temporaires */}
            <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#6b7280' }}>
                Zones temporaires
              </div>
              {['TSA', 'TRA'].map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.airspaces[type]}
                    onChange={() => handleFilterChange('airspaces', type)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: getAirspaceColor(type), fontWeight: 'bold' }}>■</span>
                  {type} - {type === 'TSA' ? 'Zone ségrégée' : 'Zone réservée'}
                </label>
              ))}
            </div>
            
            {/* Classes d'espace */}
            <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#6b7280' }}>
                Classes d'espace aérien
              </div>
              {['A', 'B', 'C', 'E', 'F', 'G'].map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.airspaces[type]}
                    onChange={() => handleFilterChange('airspaces', type)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: getAirspaceColor(type), fontWeight: 'bold' }}>■</span>
                  Classe {type}
                </label>
              ))}
            </div>
            
            {/* Zones spéciales */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#6b7280' }}>
                Autres zones
              </div>
              {['RMZ', 'TMZ'].map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.airspaces[type]}
                    onChange={() => handleFilterChange('airspaces', type)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ color: getAirspaceColor(type), fontWeight: 'bold' }}>■</span>
                  {type} - {type === 'RMZ' ? 'Zone radio obligatoire' : 'Zone transpondeur obligatoire'}
                </label>
              ))}
            </div>
            
            {/* Boutons d'action rapide */}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    airspaces: Object.keys(prev.airspaces).reduce((acc, key) => ({ ...acc, [key]: true }), {})
                  }));
                }}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Tout cocher
              </button>
              <button
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    airspaces: Object.keys(prev.airspaces).reduce((acc, key) => ({ ...acc, [key]: false }), {})
                  }));
                }}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Tout décocher
              </button>
            </div>
          </div>
        </div>
      )}
      
      <MapContainer
        center={[46.603354, 1.888334]}
        zoom={7}
        style={{ height: '500px', width: '100%', borderRadius: '8px' }}
        preferCanvas={true}
      >
        {/* Couche de base dynamique */}
        <TileLayer
          key={`base-${baseMap}`}
          url={tileUrls[baseMap] || tileUrls.osm}
          attribution={tileAttributions[baseMap] || tileAttributions.osm}
          maxZoom={baseMap === 'openTopoMap' ? 17 : 19}
          minZoom={2}
          keepBuffer={2}
          tileSize={256}
          crossOrigin={true}
        />
        
        {/* Couche OpenAIP - conditionnelle */}
        {showOpenAIP && (
          <TileLayer
            key="openaip"
            url={openAipUrl}
            attribution='&copy; <a href="https://www.openaip.net">OpenAIP</a>'
            opacity={0.7}
            maxZoom={14}
            keepBuffer={2}
          />
        )}
        
        {/* Controleur de vue et chargeur de données */}
        <MapController waypoints={waypoints} />
        <DataLoader filters={filters} onDataUpdate={setVisibleData} />
        
        {/* Espaces aériens - conditionnels */}
        {showAirspaces && airspaceFeatures.features.length > 0 && (
          <GeoJSON
            key={JSON.stringify(filteredAirspaces.map(a => a.id))}
            data={airspaceFeatures}
            style={getAirspaceStyle}
            onEachFeature={(feature, layer) => {
              const props = feature.properties;
              const lower = props.lowerLimit?.value || props.lowerLimit || 'SFC';
              const upper = props.upperLimit?.value || props.upperLimit || 'UNL';
              
              layer.bindPopup(`
                <div style="min-width: 200px;">
                  <h3 style="margin: 0 0 8px 0; color: ${getAirspaceColor(props.type)};">
                    ${props.name}
                  </h3>
                  <table style="width: 100%; font-size: 12px;">
                    <tr><td><b>Type:</b></td><td>${props.type}</td></tr>
                    <tr><td><b>Classe:</b></td><td>${props.class || '-'}</td></tr>
                    <tr><td><b>Plancher:</b></td><td>${lower}</td></tr>
                    <tr><td><b>Plafond:</b></td><td>${upper}</td></tr>
                  </table>
                </div>
              `);
            }}
          />
        )}
        
        {/* Aérodromes */}
        <LayerGroup>
          {filteredAirfields.map(airfield => (
            <Marker
              key={airfield.id}
              position={[airfield.coordinates.lat, airfield.coordinates.lon]}
              icon={createAirfieldIcon(airfield.type)}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#0066CC' }}>
                    {airfield.icao || '----'} - {airfield.name}
                  </h3>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <tr><td><b>Type:</b></td><td>{airfield.type}</td></tr>
                    <tr><td><b>Ville:</b></td><td>{airfield.city || '-'}</td></tr>
                    <tr><td><b>Altitude:</b></td><td>{airfield.elevation || 0} ft</td></tr>
                    <tr><td><b>Pistes:</b></td><td>{airfield.runways?.length || 0}</td></tr>
                  </table>
                </div>
              </Popup>
            </Marker>
          ))}
        </LayerGroup>
        
        {/* Balises */}
        <LayerGroup>
          {filteredNavaids.map(navaid => (
            <Marker
              key={navaid.id}
              position={[navaid.coordinates.lat, navaid.coordinates.lon]}
              icon={createNavaidIcon(navaid.type)}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#6B46C1' }}>
                    {navaid.ident} - {navaid.name}
                  </h3>
                  <table style={{ width: '100%', fontSize: '12px' }}>
                    <tr><td><b>Type:</b></td><td>{navaid.type}</td></tr>
                    <tr><td><b>Fréquence:</b></td><td>{navaid.frequency || '-'}</td></tr>
                    <tr><td><b>Canal:</b></td><td>{navaid.channel || '-'}</td></tr>
                    <tr><td><b>Altitude:</b></td><td>{navaid.elevation || 0} ft</td></tr>
                  </table>
                </div>
              </Popup>
            </Marker>
          ))}
        </LayerGroup>
        
        {/* Route */}
        {routeCoordinates.length >= 2 && (
          <Polyline
            positions={routeCoordinates}
            color="#FF00FF"
            weight={3}
            opacity={0.8}
            dashArray="10, 10"
          />
        )}
        
        {/* Waypoints */}
        <LayerGroup>
          {waypoints.map((waypoint, index) => {
            if (!waypoint.lat || !waypoint.lon) return null;
            
            return (
              <Marker
                key={waypoint.id}
                position={[waypoint.lat, waypoint.lon]}
                icon={createWaypointIcon(index, waypoints.length)}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const newPos = e.target.getLatLng();
                    if (onWaypointUpdate) {
                      onWaypointUpdate(waypoint.id, {
                        lat: newPos.lat,
                        lon: newPos.lng
                      });
                    }
                  }
                }}
              >
                <Popup>
                  <div>
                    <h4>Point {index + 1}: {waypoint.name || 'Sans nom'}</h4>
                    {waypoint.airportName && <p>{waypoint.airportName}</p>}
                    <p>Lat: {waypoint.lat.toFixed(4)}°</p>
                    <p>Lon: {waypoint.lon.toFixed(4)}°</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </LayerGroup>
      </MapContainer>
      
      {/* Bouton des filtres */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'white',
          border: 'none',
          padding: '8px',
          borderRadius: '6px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Filtres"
      >
        <Settings size={20} />
      </button>
      
      {/* Panneau des filtres */}
      {showFilters && (
        <div style={{
          position: 'absolute',
          top: '50px',
          left: '10px',
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000,
          maxHeight: '400px',
          overflowY: 'auto',
          minWidth: '250px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>
            Filtres de la carte
          </h3>
          
          {/* Espaces aériens */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>
              Espaces aériens
            </h4>
            {Object.entries(filters.airspaces).map(([type, enabled]) => (
              <label key={type} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleFilterChange('airspaces', type)}
                />
                <span style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  backgroundColor: getAirspaceColor(type),
                  borderRadius: '2px'
                }} />
                {type}
              </label>
            ))}
          </div>
          
          {/* Aérodromes */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>
              Aérodromes
            </h4>
            {Object.entries(filters.airfields).map(([type, enabled]) => (
              <label key={type} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleFilterChange('airfields', type)}
                />
                {type}
              </label>
            ))}
          </div>
          
          {/* Balises */}
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold' }}>
              Balises de navigation
            </h4>
            {Object.entries(filters.navaids).map(([type, enabled]) => (
              <label key={type} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => handleFilterChange('navaids', type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavigationMapReact;