// src/features/navigation/components/NavigationMapLeaflet.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
// Utiliser Leaflet depuis le CDN au lieu du module NPM
const L = window.L || {};
// CSS déjà chargé dans index.html
import { MapPin, Plane, Navigation2, AlertCircle, Loader, Settings } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';
import { useOpenAIPStore } from '@core/stores/openAIPStore';

// Fix pour les icônes Leaflet par défaut si nécessaire
if (L.Icon && L.Icon.Default) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const NavigationMapLeaflet = ({ waypoints = [], onWaypointUpdate }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const dataLayersRef = useRef({
    airspaces: null,
    airfields: null,
    navaids: null
  });
  const [leafletReady, setLeafletReady] = useState(false);
  
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
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
  
  const { loadAirspaces, loadNavaids } = useOpenAIPStore();
  const airports = useOpenAIPStore(state => state.airports);
  const airspaces = useOpenAIPStore(state => state.airspaces);
  const navaids = useOpenAIPStore(state => state.navaids);

  // Couleurs par type d'espace aérien
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
  const getAirspaceStyle = (airspace) => ({
    color: getAirspaceColor(airspace.type),
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.15,
    dashArray: airspace.type === 'D' || airspace.type === 'P' || airspace.type === 'R' ? '5, 5' : null
  });

  // Création des icônes personnalisées
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

  // Fonction pour charger les données dans la zone visible
  const loadDataInBounds = useCallback(async () => {
    if (!mapRef.current) return;
    
    const bounds = mapRef.current.getBounds();
    const zoom = mapRef.current.getZoom();
    
    // Ne charger que si le zoom est suffisant
    if (zoom < 7) return;
    
    setLoading(true);
    
    try {
      // Charger les espaces aériens et balises si nécessaire
      if (!airspaces.length) {
        await loadAirspaces('FR');
      }
      if (!navaids.length) {
        await loadNavaids('FR');
      }
      
      // Filtrer les données dans les limites visibles
      const visibleAirspaces = airspaces.filter(airspace => {
        if (!airspace.geometry?.coordinates) return false;
        
        // Vérifier si au moins un point est dans les limites
        const coords = airspace.geometry.type === 'MultiPolygon' 
          ? airspace.geometry.coordinates[0][0]
          : airspace.geometry.coordinates[0];
          
        return coords.some(coord => {
          const lat = coord[1];
          const lng = coord[0];
          return bounds.contains([lat, lng]);
        });
      });
      
      const visibleAirfields = airports.filter(airport => {
        const lat = airport.coordinates.lat;
        const lng = airport.coordinates.lon;
        return bounds.contains([lat, lng]);
      });
      
      const visibleNavaids = navaids.filter(navaid => {
        const lat = navaid.coordinates.lat;
        const lng = navaid.coordinates.lon;
        return bounds.contains([lat, lng]);
      });
      
      // Mettre à jour les couches
      updateAirspacesLayer(visibleAirspaces);
      updateAirfieldsLayer(visibleAirfields);
      updateNavaidsLayer(visibleNavaids);
      
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  }, [airspaces, airports, navaids, loadAirspaces, loadNavaids]);

  // Mettre à jour la couche des espaces aériens
  const updateAirspacesLayer = useCallback((airspacesToShow) => {
    if (!mapRef.current) return;
    
    // Supprimer l'ancienne couche
    if (dataLayersRef.current.airspaces) {
      mapRef.current.removeLayer(dataLayersRef.current.airspaces);
    }
    
    // Filtrer selon les préférences
    const filtered = airspacesToShow.filter(airspace => 
      filters.airspaces[airspace.type]
    );
    
    if (filtered.length === 0) {
      dataLayersRef.current.airspaces = null;
      return;
    }
    
    // Créer la nouvelle couche
    const features = filtered.map(airspace => {
      if (!airspace.geometry) return null;
      
      const feature = {
        type: 'Feature',
        properties: {
          name: airspace.name,
          type: airspace.type,
          class: airspace.class,
          lowerLimit: airspace.lowerLimit,
          upperLimit: airspace.upperLimit
        },
        geometry: airspace.geometry
      };
      
      return feature;
    }).filter(f => f !== null);
    
    const geojsonLayer = L.geoJSON({
      type: 'FeatureCollection',
      features
    }, {
      style: (feature) => getAirspaceStyle(feature.properties),
      onEachFeature: (feature, layer) => {
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
      }
    });
    
    geojsonLayer.addTo(mapRef.current);
    dataLayersRef.current.airspaces = geojsonLayer;
  }, [filters.airspaces]);

  // Mettre à jour la couche des aérodromes
  const updateAirfieldsLayer = useCallback((airfieldsToShow) => {
    if (!mapRef.current) return;
    
    // Supprimer l'ancienne couche
    if (dataLayersRef.current.airfields) {
      mapRef.current.removeLayer(dataLayersRef.current.airfields);
    }
    
    // Filtrer selon les préférences
    const filtered = airfieldsToShow.filter(airfield => 
      filters.airfields[airfield.type]
    );
    
    if (filtered.length === 0) {
      dataLayersRef.current.airfields = null;
      return;
    }
    
    // Créer la nouvelle couche
    const layerGroup = L.layerGroup();
    
    filtered.forEach(airfield => {
      const marker = L.marker(
        [airfield.coordinates.lat, airfield.coordinates.lon],
        { icon: createAirfieldIcon(airfield.type) }
      );
      
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #0066CC;">
            ${airfield.icao || '----'} - ${airfield.name}
          </h3>
          <table style="width: 100%; font-size: 12px;">
            <tr><td><b>Type:</b></td><td>${airfield.type}</td></tr>
            <tr><td><b>Ville:</b></td><td>${airfield.city || '-'}</td></tr>
            <tr><td><b>Altitude:</b></td><td>${airfield.elevation || 0} ft</td></tr>
            <tr><td><b>Pistes:</b></td><td>${airfield.runways?.length || 0}</td></tr>
          </table>
        </div>
      `);
      
      layerGroup.addLayer(marker);
    });
    
    layerGroup.addTo(mapRef.current);
    dataLayersRef.current.airfields = layerGroup;
  }, [filters.airfields]);

  // Mettre à jour la couche des balises
  const updateNavaidsLayer = useCallback((navaidsToShow) => {
    if (!mapRef.current) return;
    
    // Supprimer l'ancienne couche
    if (dataLayersRef.current.navaids) {
      mapRef.current.removeLayer(dataLayersRef.current.navaids);
    }
    
    // Filtrer selon les préférences
    const filtered = navaidsToShow.filter(navaid => 
      filters.navaids[navaid.type]
    );
    
    if (filtered.length === 0) {
      dataLayersRef.current.navaids = null;
      return;
    }
    
    // Créer la nouvelle couche
    const layerGroup = L.layerGroup();
    
    filtered.forEach(navaid => {
      const marker = L.marker(
        [navaid.coordinates.lat, navaid.coordinates.lon],
        { icon: createNavaidIcon(navaid.type) }
      );
      
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #6B46C1;">
            ${navaid.ident} - ${navaid.name}
          </h3>
          <table style="width: 100%; font-size: 12px;">
            <tr><td><b>Type:</b></td><td>${navaid.type}</td></tr>
            <tr><td><b>Fréquence:</b></td><td>${navaid.frequency || '-'}</td></tr>
            <tr><td><b>Canal:</b></td><td>${navaid.channel || '-'}</td></tr>
            <tr><td><b>Altitude:</b></td><td>${navaid.elevation || 0} ft</td></tr>
          </table>
        </div>
      `);
      
      layerGroup.addLayer(marker);
    });
    
    layerGroup.addTo(mapRef.current);
    dataLayersRef.current.navaids = layerGroup;
  }, [filters.navaids]);

  // Vérifier que Leaflet est chargé
  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      console.log('✅ Leaflet est disponible');
    } else {
      console.error('❌ Leaflet n\'est pas chargé');
      // Attendre que Leaflet soit chargé
      const checkLeaflet = setInterval(() => {
        if (window.L) {
          setLeafletReady(true);
          clearInterval(checkLeaflet);
          console.log('✅ Leaflet maintenant disponible');
        }
      }, 100);
      return () => clearInterval(checkLeaflet);
    }
  }, []);

  // Initialisation de la carte
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !leafletReady) return;
    
    console.log('🗺️ Initialisation de la carte Leaflet...');
    
    // Créer la carte
    const map = L.map(mapContainerRef.current, {
      center: [46.603354, 1.888334], // Centre de la France
      zoom: 7,
      zoomControl: true
    });
    
    // Ajouter la couche de base OSM
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
      minZoom: 3
    });
    
    osmLayer.addTo(map);
    
    // Couche OpenAIP supprimée
    
    mapRef.current = map;
    
    console.log('✅ Carte initialisée avec succès');
    
    // Charger les données initiales après un court délai
    setTimeout(() => {
      loadDataInBounds();
    }, 500);
    
    // Écouter les événements de la carte
    map.on('moveend', loadDataInBounds);
    map.on('zoomend', loadDataInBounds);
    
    return () => {
      map.off('moveend', loadDataInBounds);
      map.off('zoomend', loadDataInBounds);
      map.remove();
      mapRef.current = null;
    };
  }, [leafletReady]); // Ne dépendre que de leafletReady

  // Mettre à jour les marqueurs des waypoints
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Supprimer les anciens marqueurs
    markersRef.current.forEach(marker => {
      mapRef.current.removeLayer(marker);
    });
    markersRef.current = [];
    
    // Ajouter les nouveaux marqueurs
    waypoints.forEach((waypoint, index) => {
      if (!waypoint.lat || !waypoint.lon) return;
      
      const icon = L.divIcon({
        html: `<div style="
          background-color: ${index === 0 ? '#00AA00' : index === waypoints.length - 1 ? '#FF0000' : '#0066CC'};
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
      
      const marker = L.marker([waypoint.lat, waypoint.lon], { 
        icon,
        draggable: true 
      });
      
      marker.bindPopup(`
        <div>
          <h4>Point ${index + 1}: ${waypoint.name || 'Sans nom'}</h4>
          ${waypoint.airportName ? `<p>${waypoint.airportName}</p>` : ''}
          <p>Lat: ${waypoint.lat.toFixed(4)}°</p>
          <p>Lon: ${waypoint.lon.toFixed(4)}°</p>
        </div>
      `);
      
      // Gérer le déplacement des marqueurs
      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        if (onWaypointUpdate) {
          onWaypointUpdate(waypoint.id, {
            lat: newPos.lat,
            lon: newPos.lng
          });
        }
      });
      
      marker.addTo(mapRef.current);
      markersRef.current.push(marker);
    });
    
    // Tracer la route
    if (waypoints.length >= 2) {
      const routeCoords = waypoints
        .filter(w => w.lat && w.lon)
        .map(w => [w.lat, w.lon]);
      
      if (markersRef.current.routeLine) {
        mapRef.current.removeLayer(markersRef.current.routeLine);
      }
      
      const routeLine = L.polyline(routeCoords, {
        color: '#FF00FF',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 10'
      });
      
      routeLine.addTo(mapRef.current);
      markersRef.current.routeLine = routeLine;
      
      // Ajuster la vue pour montrer tous les waypoints
      if (routeCoords.length > 0) {
        const bounds = L.latLngBounds(routeCoords);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [waypoints, onWaypointUpdate]);

  // Mettre à jour les couches quand les filtres changent
  useEffect(() => {
    if (!mapRef.current) return;
    loadDataInBounds();
  }, [filters, loadDataInBounds]);

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

  // Afficher un message si Leaflet n'est pas encore prêt
  if (!leafletReady) {
    return (
      <div style={{
        height: '500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
          <p>Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Carte */}
      <div 
        ref={mapContainerRef}
        style={{ 
          height: '500px', 
          width: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      />
      
      {/* Indicateur de chargement */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000
        }}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: '12px' }}>Chargement...</span>
        </div>
      )}
      
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

export default NavigationMapLeaflet;