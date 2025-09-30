/**
 * Carte de navigation avec intégration complète des données SIA
 * Affiche les couches GeoJSON générées par l'ETL
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, LayerGroup, LayersControl, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geoJSONDataService } from '../services/GeoJSONDataService';
import './NavigationMapSIA.css';

// Fix pour les icônes Leaflet par défaut
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
});

// Configuration des icônes
const createIcon = (color, symbol) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${symbol}</div>`,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

const icons = {
  airport: createIcon('#2196F3', '✈'),
  heliport: createIcon('#FF9800', 'H'),
  vor: createIcon('#4CAF50', 'V'),
  ndb: createIcon('#9C27B0', 'N'),
  dme: createIcon('#00BCD4', 'D'),
  vfrPoint: createIcon('#FFC107', 'P'),
  ifrPoint: createIcon('#795548', 'W'),
  obstacle: createIcon('#F44336', '!')
};

// Styles pour les espaces aériens
const getAirspaceStyle = (feature) => {
  const props = feature.properties || {};
  const type = props.type;
  const airspaceClass = props.class;
  
  let color = '#808080';
  let fillOpacity = 0.2;
  
  // Couleurs par type
  if (type === 'CTR') color = '#FF0000';
  else if (type === 'TMA') color = '#FF6600';
  else if (type === 'P') color = '#CC0000';
  else if (type === 'R') color = '#CC0066';
  else if (type === 'D') color = '#FF9900';
  else if (type === 'TSA' || type === 'TRA') color = '#9966FF';
  else if (airspaceClass === 'A') color = '#990000';
  else if (airspaceClass === 'B') color = '#0066CC';
  else if (airspaceClass === 'C') color = '#00AA00';
  else if (airspaceClass === 'D') color = '#0099FF';
  else if (airspaceClass === 'E') color = '#FF99CC';
  else if (airspaceClass === 'G') color = '#99CC00';
  
  return {
    color,
    weight: 2,
    opacity: 0.8,
    fillColor: color,
    fillOpacity,
    dashArray: type === 'D' ? '5, 5' : null
  };
};

// Composant pour gérer les layers
const MapLayers = ({ layers, filters }) => {
  const map = useMap();
  
  // Fonction pour créer les popups
  const onEachFeature = useCallback((feature, layer) => {
    const props = feature.properties || {};
    let popupContent = '<div class="sia-popup">';
    
    // Contenu selon le type
    if (props.icao) {
      // Aérodrome
      popupContent += `
        <h3>${props.name || props.icao}</h3>
        <p><strong>ICAO:</strong> ${props.icao}</p>
        ${props.iata ? `<p><strong>IATA:</strong> ${props.iata}</p>` : ''}
        ${props.city ? `<p><strong>Ville:</strong> ${props.city}</p>` : ''}
        ${props.elevation_ft ? `<p><strong>Altitude:</strong> ${props.elevation_ft} ft</p>` : ''}
        ${props.type ? `<p><strong>Type:</strong> ${props.type}</p>` : ''}
      `;
    } else if (props.ident) {
      // Navaid
      popupContent += `
        <h3>${props.name || props.ident}</h3>
        <p><strong>Type:</strong> ${props.type}</p>
        <p><strong>Ident:</strong> ${props.ident}</p>
        ${props.frequency ? `<p><strong>Fréquence:</strong> ${props.frequency}</p>` : ''}
        ${props.channel ? `<p><strong>Canal:</strong> ${props.channel}</p>` : ''}
      `;
    } else if (props.code) {
      // Point désigné
      popupContent += `
        <h3>${props.name || props.code}</h3>
        <p><strong>Code:</strong> ${props.code}</p>
        <p><strong>Type:</strong> ${props.type}</p>
        ${props.mandatory ? '<p><strong>Obligatoire</strong></p>' : ''}
      `;
    } else if (props.designation) {
      // Piste
      popupContent += `
        <h3>Piste ${props.designation}</h3>
        <p><strong>Aérodrome:</strong> ${props.aerodrome_icao}</p>
        ${props.length_m ? `<p><strong>Longueur:</strong> ${props.length_m}m</p>` : ''}
        ${props.width_m ? `<p><strong>Largeur:</strong> ${props.width_m}m</p>` : ''}
        ${props.surface ? `<p><strong>Surface:</strong> ${props.surface}</p>` : ''}
      `;
    } else if (props.code_id) {
      // Espace aérien
      popupContent += `
        <h3>${props.name || props.code_id}</h3>
        <p><strong>Type:</strong> ${props.type || 'N/A'}</p>
        ${props.class ? `<p><strong>Classe:</strong> ${props.class}</p>` : ''}
        <p><strong>Plancher:</strong> ${props.floor_raw || props.floor || 'SFC'}</p>
        <p><strong>Plafond:</strong> ${props.ceiling_raw || props.ceiling || 'UNL'}</p>
        ${props.activity ? `<p><strong>Activité:</strong> ${props.activity}</p>` : ''}
      `;
    }
    
    popupContent += '</div>';
    layer.bindPopup(popupContent);
  }, []);
  
  // Fonction pour créer les markers points
  const pointToLayer = useCallback((feature, latlng) => {
    const props = feature.properties || {};
    let icon = icons.airport;
    
    // Sélectionner l'icône selon le type
    if (props.type === 'HP') icon = icons.heliport;
    else if (props.type === 'VOR') icon = icons.vor;
    else if (props.type === 'NDB') icon = icons.ndb;
    else if (props.type === 'DME') icon = icons.dme;
    else if (props.type?.startsWith('VFR')) icon = icons.vfrPoint;
    else if (props.type === 'IFR' || props.type === 'RNAV') icon = icons.ifrPoint;
    else if (feature.id?.startsWith('OBS')) icon = icons.obstacle;
    
    return L.marker(latlng, { icon });
  }, []);
  
  // Filtrer les features selon les filtres actifs
  const filterFeatures = useCallback((features, layerType) => {
    if (!filters[layerType]) return features;
    
    return features.filter(feature => {
      const props = feature.properties || {};
      const filter = filters[layerType];
      
      // Filtres spécifiques par type
      if (layerType === 'airspaces' && filter.classes?.length > 0) {
        if (!filter.classes.includes(props.class)) return false;
      }
      
      if (layerType === 'airspaces' && filter.types?.length > 0) {
        if (!filter.types.includes(props.type)) return false;
      }
      
      if (layerType === 'aerodromes' && filter.types?.length > 0) {
        if (!filter.types.includes(props.type)) return false;
      }
      
      return true;
    });
  }, [filters]);
  
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="OpenStreetMap">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
      </LayersControl.BaseLayer>
      
      <LayersControl.BaseLayer name="OpenTopoMap">
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenTopoMap contributors'
        />
      </LayersControl.BaseLayer>
      
      {/* Aérodromes */}
      {layers.aerodromes && (
        <LayersControl.Overlay checked name="Aérodromes">
          <LayerGroup>
            <GeoJSON
              data={{
                type: 'FeatureCollection',
                features: filterFeatures(layers.aerodromes, 'aerodromes')
              }}
              pointToLayer={pointToLayer}
              onEachFeature={onEachFeature}
            />
          </LayerGroup>
        </LayersControl.Overlay>
      )}
      
      {/* Espaces aériens */}
      {layers.airspaces && (
        <LayersControl.Overlay name="Espaces aériens">
          <LayerGroup>
            <GeoJSON
              data={{
                type: 'FeatureCollection',
                features: filterFeatures(layers.airspaces, 'airspaces')
              }}
              style={getAirspaceStyle}
              onEachFeature={onEachFeature}
            />
          </LayerGroup>
        </LayersControl.Overlay>
      )}
      
      {/* Navaids */}
      {layers.navaids && (
        <LayersControl.Overlay name="Navaids">
          <LayerGroup>
            <GeoJSON
              data={{
                type: 'FeatureCollection',
                features: filterFeatures(layers.navaids, 'navaids')
              }}
              pointToLayer={pointToLayer}
              onEachFeature={onEachFeature}
            />
          </LayerGroup>
        </LayersControl.Overlay>
      )}
      
      {/* Points VFR/IFR */}
      {layers.designatedPoints && (
        <LayersControl.Overlay name="Points VFR/IFR">
          <LayerGroup>
            <GeoJSON
              data={{
                type: 'FeatureCollection',
                features: filterFeatures(layers.designatedPoints, 'designatedPoints')
              }}
              pointToLayer={pointToLayer}
              onEachFeature={onEachFeature}
            />
          </LayerGroup>
        </LayersControl.Overlay>
      )}
      
      {/* Obstacles */}
      {layers.obstacles && (
        <LayersControl.Overlay name="Obstacles">
          <LayerGroup>
            <GeoJSON
              data={{
                type: 'FeatureCollection',
                features: filterFeatures(layers.obstacles, 'obstacles')
              }}
              pointToLayer={pointToLayer}
              onEachFeature={onEachFeature}
            />
          </LayerGroup>
        </LayersControl.Overlay>
      )}
    </LayersControl>
  );
};

// Composant principal
export const NavigationMapSIA = ({ waypoints = [], onWaypointUpdate, onWaypointAdd, onWaypointRemove }) => {
  const [layers, setLayers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    airspaces: { classes: [], types: [] },
    aerodromes: { types: [] }
  });
  
  // Extraire départ et arrivée des waypoints
  const departure = waypoints.length > 0 ? waypoints[0] : null;
  const arrival = waypoints.length > 1 ? waypoints[waypoints.length - 1] : null;
  
  // Charger les données GeoJSON
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [aerodromes, airspaces, navaids, designatedPoints, obstacles] = await Promise.all([
          geoJSONDataService.getAerodromes(),
          geoJSONDataService.getAirspaces(),
          geoJSONDataService.getNavaids(),
          geoJSONDataService.getDesignatedPoints(),
          geoJSONDataService.getObstacles()
        ]);
        
        setLayers({
          aerodromes,
          airspaces,
          navaids,
          designatedPoints,
          obstacles
        });
        
        console.log('✅ Données SIA chargées:', {
          aerodromes: aerodromes.length,
          airspaces: airspaces.length,
          navaids: navaids.length,
          designatedPoints: designatedPoints.length,
          obstacles: obstacles.length
        });
      } catch (error) {
        console.error('❌ Erreur chargement données SIA:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Position et zoom initiaux
  const initialPosition = useMemo(() => {
    if (departure?.lat && departure?.lon) {
      return [departure.lat, departure.lon];
    } else if (departure?.coordinates?.lat && departure?.coordinates?.lon) {
      return [departure.coordinates.lat, departure.coordinates.lon];
    }
    return [46.603354, 1.888334]; // Centre de la France
  }, [departure]);
  
  const initialZoom = departure ? 10 : 6;
  
  if (loading) {
    return (
      <div className="map-loading">
        <div className="spinner"></div>
        <p>Chargement des données SIA...</p>
      </div>
    );
  }
  
  return (
    <div className="navigation-map-sia">
      <MapContainer
        center={initialPosition}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        className="leaflet-container"
      >
        <MapLayers layers={layers} filters={filters} />
        
        {/* Marqueurs pour départ/arrivée */}
        {departure && (
          <Marker 
            position={[
              departure.lat || departure.coordinates?.lat,
              departure.lon || departure.coordinates?.lon
            ]}
            icon={createIcon('#4CAF50', 'D')}
          >
            <Popup>
              <div>
                <h4>Départ</h4>
                <p>{departure.name || departure.icao}</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {arrival && (
          <Marker 
            position={[
              arrival.lat || arrival.coordinates?.lat,
              arrival.lon || arrival.coordinates?.lon
            ]}
            icon={createIcon('#F44336', 'A')}
          >
            <Popup>
              <div>
                <h4>Arrivée</h4>
                <p>{arrival.name || arrival.icao}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};