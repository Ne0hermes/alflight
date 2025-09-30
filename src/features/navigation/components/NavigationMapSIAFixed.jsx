/**
 * Carte de navigation avec intégration des données SIA - Version corrigée
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, LayerGroup, LayersControl, GeoJSON, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geoJSONDataService } from '../services/GeoJSONDataService';
import { openAIPAirspacesService } from '../../../services/openAIPAirspacesService';
import { AirspaceLegend } from './AirspaceLegend';
import AirspaceFilters from './AirspaceFilters';
import AirspaceEditor from './AirspaceEditor';
import { getAirportFrequenciesSync } from '../hooks/useAirportFrequencies';
import { useCustomVFRStore } from '../../../core/stores/customVFRStore';
import { CustomVFRPointForm } from './CustomVFRPointForm';
import * as turf from '@turf/helpers';
import booleanIntersects from '@turf/boolean-intersects';
import lineIntersect from '@turf/line-intersect';
import pointToLineDistance from '@turf/point-to-line-distance';
import centroid from '@turf/centroid';

// Composant pour gérer le centrage de la carte
function MapCenterController({ centerTarget }) {
  const map = useMap();
  
  useEffect(() => {
    if (centerTarget && map) {
      const { bounds, zoom } = centerTarget;
      if (bounds) {
        try {
          map.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: zoom || 10,
            animate: true,
            duration: 0.5
          });
        } catch (error) {
          console.warn('Erreur lors du centrage de la carte:', error);
        }
      }
    }
  }, [centerTarget, map]);
  
  return null;
}

// Composant pour gérer la création de points VFR personnalisés
function CustomVFRCreator({ isCreating, onPointCreated }) {
  const map = useMapEvents({
    click: (e) => {
      if (isCreating) {
        // Empêcher la propagation de l'événement pour éviter les conflits avec les espaces aériens
        L.DomEvent.stopPropagation(e.originalEvent);
        const { lat, lng } = e.latlng;
        onPointCreated([lat, lng]);
      }
    }
  });

  useEffect(() => {
    if (isCreating) {
      map.getContainer().style.cursor = 'crosshair';
      
      // Désactiver temporairement l'interactivité des espaces aériens
      map.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON) {
          layer.setStyle({ interactive: false });
        }
      });
    } else {
      map.getContainer().style.cursor = '';
      
      // Réactiver l'interactivité des espaces aériens
      map.eachLayer((layer) => {
        if (layer instanceof L.GeoJSON) {
          layer.setStyle({ interactive: true });
        }
      });
    }
    
    return () => {
      map.getContainer().style.cursor = '';
    };
  }, [isCreating, map]);

  return null;
}

// Fix pour les icônes Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
});

// Configuration des icônes personnalisées
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
  vor: createIcon('#4CAF50', 'V'),
  ndb: createIcon('#9C27B0', 'N'),
  vfrPoint: createIcon('#FFC107', 'P'),
  obstacle: createIcon('#F44336', '!')
};

export const NavigationMapSIAFixed = ({ 
  waypoints = [], 
  onWaypointUpdate,
  plannedAltitude = 3000,
  onPlannedAltitudeChange,
  segmentAltitudes = {}
}) => {
  // États pour l'analyse des espaces traversés
  const [traversedAirspaces, setTraversedAirspaces] = useState([]);
  const [currentSegmentAltitude, setCurrentSegmentAltitude] = useState(plannedAltitude);
  const [layers, setLayers] = useState({
    aerodromes: null,
    navaids: null,
    designatedPoints: null,
    obstacles: null,
    airspaces: null,
    vfrPoints: null // Points VFR issus des cartes VAC
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [airspaceFilters, setAirspaceFilters] = useState({
    types: ['CTR', 'TMA', 'CTA', 'AWY', 'R', 'P', 'D', 'TMZ', 'RMZ', 'TSA', 'TRA', 'ATZ'],
    classes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],  // Classes simplifiées
    plannedAltitude: plannedAltitude,
    showLabels: true,
    showInactive: false,
    showAllAltitudes: false  // Par défaut, filtrer par altitude
  });
  const [airspaceStats, setAirspaceStats] = useState({});
  const [editingAirspace, setEditingAirspace] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [mapCenterTarget, setMapCenterTarget] = useState(null);
  
  // États pour les points VFR personnalisés
  const [isCreatingVFR, setIsCreatingVFR] = useState(false);
  const [showVFRForm, setShowVFRForm] = useState(false);
  const [newVFRPosition, setNewVFRPosition] = useState(null);
  const [customVFRPoints, setCustomVFRPoints] = useState([]);
  
  // Hook du store VFR personnalisé
  const { 
    addCustomVFRPoint, 
    getAllCustomVFRPoints,
    deleteCustomVFRPoint,
    toGeoJSON: getCustomVFRGeoJSON
  } = useCustomVFRStore();
  
  // Synchroniser l'altitude planifiée avec les filtres
  useEffect(() => {
    setAirspaceFilters(prev => ({
      ...prev,
      plannedAltitude: plannedAltitude
    }));
  }, [plannedAltitude]);
  
  // Calculer le centre et les limites de la navigation
  const getNavigationBounds = useMemo(() => {
    if (!waypoints || waypoints.length === 0) {
      // Position par défaut (centre de la France)
      return {
        center: [46.603354, 1.888334],
        bounds: null,
        zoom: 7
      };
    }
    
    // Obtenir tous les points valides
    const validPoints = waypoints.filter(wp => wp.lat && wp.lon);
    
    if (validPoints.length === 0) {
      return {
        center: [46.603354, 1.888334],
        bounds: null,
        zoom: 7
      };
    }
    
    if (validPoints.length === 1) {
      // Un seul point : centrer dessus avec un zoom approprié
      return {
        center: [validPoints[0].lat, validPoints[0].lon],
        bounds: null,
        zoom: 11
      };
    }
    
    // Calculer les limites
    let minLat = validPoints[0].lat;
    let maxLat = validPoints[0].lat;
    let minLon = validPoints[0].lon;
    let maxLon = validPoints[0].lon;
    
    validPoints.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLon = Math.min(minLon, point.lon);
      maxLon = Math.max(maxLon, point.lon);
    });
    
    // Ajouter une marge de 10% autour des points
    const latMargin = (maxLat - minLat) * 0.1;
    const lonMargin = (maxLon - minLon) * 0.1;
    
    const bounds = [
      [minLat - latMargin, minLon - lonMargin],
      [maxLat + latMargin, maxLon + lonMargin]
    ];
    
    // Calculer le centre
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    
    // Calculer un zoom approprié basé sur la distance
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    const maxDiff = Math.max(latDiff, lonDiff);
    
    let zoom = 7;
    if (maxDiff < 0.1) zoom = 12;      // Très proche
    else if (maxDiff < 0.3) zoom = 11;  // Local
    else if (maxDiff < 0.5) zoom = 10;  // Régional proche
    else if (maxDiff < 1) zoom = 9;     // Régional
    else if (maxDiff < 2) zoom = 8;     // Inter-régional
    else if (maxDiff < 4) zoom = 7;     // National
    else zoom = 6;                      // Grande distance
    
    return {
      center: [centerLat, centerLon],
      bounds: bounds,
      zoom: zoom
    };
  }, [waypoints]);
  
  const center = getNavigationBounds.center;
  const navigationBounds = getNavigationBounds.bounds;
  const defaultZoom = getNavigationBounds.zoom;
  
  // Charger les points VFR personnalisés
  useEffect(() => {
    const customPoints = getAllCustomVFRPoints();
    setCustomVFRPoints(customPoints);
  }, [getAllCustomVFRPoints]);
  
  // Recentrer la carte automatiquement quand les waypoints changent
  useEffect(() => {
    if (navigationBounds && waypoints.length >= 2) {
      // Forcer le recentrage après un court délai pour laisser la carte se charger
      const timer = setTimeout(() => {
        setMapCenterTarget({ 
          bounds: navigationBounds, 
          zoom: defaultZoom 
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [waypoints, navigationBounds, defaultZoom]);
  
  // Handlers pour les points VFR personnalisés
  const handleStartCreatingVFR = () => {
    setIsCreatingVFR(true);
  };
  
  const handlePointCreated = (position) => {
    setNewVFRPosition(position);
    setShowVFRForm(true);
    setIsCreatingVFR(false);
  };
  
  const handleSaveVFRPoint = (pointData) => {
    const newPoint = addCustomVFRPoint(pointData);
    setCustomVFRPoints([...customVFRPoints, newPoint]);
    setShowVFRForm(false);
    setNewVFRPosition(null);
    
    // Optionnellement, ajouter directement au trajet
    if (onWaypointUpdate) {
      const newWaypoint = {
        id: Date.now(),
        name: pointData.name,
        lat: pointData.lat,
        lon: pointData.lon,
        type: 'waypoint',
        vfrType: 'CUSTOM',
        description: pointData.description,
        altitude: pointData.altitude
      };
      
      const newWaypoints = [...waypoints];
      if (newWaypoints.length >= 2) {
        newWaypoints.splice(newWaypoints.length - 1, 0, newWaypoint);
      } else {
        newWaypoints.push(newWaypoint);
      }
      
      onWaypointUpdate(newWaypoints);
    }
  };
  
  const handleCancelVFRForm = () => {
    setShowVFRForm(false);
    setNewVFRPosition(null);
    setIsCreatingVFR(false);
  };
  
  // Charger les données GeoJSON
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔄 Chargement des données SIA...');
        
        // Charger chaque couche séparément pour identifier les erreurs
        const loadedLayers = {};
        
        try {
          const aerodromes = await geoJSONDataService.getAerodromes();
          loadedLayers.aerodromes = aerodromes;
          console.log(`✅ Aérodromes chargés: ${aerodromes.length}`);
        } catch (err) {
          console.warn('⚠️ Erreur chargement aérodromes:', err);
        }
        
        try {
          const navaids = await geoJSONDataService.getNavaids();
          loadedLayers.navaids = navaids;
          console.log(`✅ Navaids chargés: ${navaids.length}`);
        } catch (err) {
          console.warn('⚠️ Erreur chargement navaids:', err);
        }
        
        try {
          const points = await geoJSONDataService.getDesignatedPoints();
          loadedLayers.designatedPoints = points;
          console.log(`✅ Points désignés chargés: ${points.length}`);
        } catch (err) {
          console.warn('⚠️ Erreur chargement points:', err);
        }
        
        try {
          const obstacles = await geoJSONDataService.getObstacles();
          loadedLayers.obstacles = obstacles;
          console.log(`✅ Obstacles chargés: ${obstacles.length}`);
        } catch (err) {
          console.warn('⚠️ Erreur chargement obstacles:', err);
        }
        
        // Charger les points VFR depuis les aérodromes
        try {
          const vfrPoints = await geoJSONDataService.getAllVFRPoints();
          loadedLayers.vfrPoints = vfrPoints;
          console.log(`✅ Points VFR chargés: ${vfrPoints.length}`);
        } catch (err) {
          console.warn('⚠️ Erreur chargement points VFR:', err);
        }
        
        // Charger les espaces aériens OpenAIP avec géométries réelles
        try {
          const airspaces = await openAIPAirspacesService.getFrenchAirspaces();
          loadedLayers.airspaces = airspaces;
          console.log(`✅ Espaces aériens OpenAIP chargés: ${airspaces.length}`);
          
          // Calculer les statistiques des espaces aériens
          const stats = {};
          airspaces.forEach(airspace => {
            const type = airspace.properties?.type;
            if (type) {
              stats[type] = (stats[type] || 0) + 1;
            }
          });
          setAirspaceStats(stats);
        } catch (err) {
          console.warn('⚠️ Erreur chargement espaces aériens OpenAIP:', err);
          // Continuer sans espaces aériens plutôt qu'avec des fausses données
          loadedLayers.airspaces = [];
        }
        
        setLayers(loadedLayers);
        
      } catch (error) {
        console.error('❌ Erreur chargement données SIA:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Fonction pour créer les popups
  const createPopup = useCallback((feature) => {
    const props = feature.properties || {};
    let content = '<div>';
    
    if (props.icao) {
      content += `<h4>${props.name || props.icao}</h4>`;
      content += `<p>ICAO: ${props.icao}</p>`;
      if (props.city) content += `<p>Ville: ${props.city}</p>`;
      if (props.elevation_ft) content += `<p>Altitude: ${props.elevation_ft} ft</p>`;
    } else if (props.ident) {
      content += `<h4>${props.name || props.ident}</h4>`;
      content += `<p>Type: ${props.type}</p>`;
      if (props.frequency) content += `<p>Fréquence: ${props.frequency}</p>`;
    } else if (props.code) {
      content += `<h4>${props.name || props.code}</h4>`;
      content += `<p>Type: ${props.type}</p>`;
    }
    
    content += '</div>';
    return content;
  }, []);
  
  // Fonction pour créer les markers
  const pointToLayer = useCallback((feature, latlng) => {
    const props = feature.properties || {};
    let markerIcon = icons.airport;
    
    if (props.type === 'VOR') markerIcon = icons.vor;
    else if (props.type === 'NDB') markerIcon = icons.ndb;
    else if (props.type?.startsWith('VFR')) markerIcon = icons.vfrPoint;
    else if (feature.id?.startsWith('OBS')) markerIcon = icons.obstacle;
    
    return L.marker(latlng, { icon: markerIcon });
  }, []);
  
  // Fonction de filtrage des espaces aériens
  const filterAirspaces = useCallback((airspaces) => {
    if (!airspaces || !Array.isArray(airspaces)) return [];
    
    return airspaces.filter(airspace => {
      const props = airspace.properties || {};
      const type = props.type;
      
      // Filtrer par type et classe
      const isTypeAllowed = airspaceFilters.types.includes(type) || 
                           airspaceFilters.classes.includes(type);
      
      if (!isTypeAllowed) return false;
      
      // Filtrer par altitude planifiée (en pieds) - sauf si showAllAltitudes est activé
      if (airspaceFilters.plannedAltitude && !airspaceFilters.showAllAltitudes) {
        // Extraire les altitudes en pieds
        let lowerValue = props.floor || 0;
        let upperValue = props.ceiling || 999999;
        
        // Si floor_raw contient FL, convertir en pieds
        if (props.floor_raw && typeof props.floor_raw === 'string') {
          if (props.floor_raw.startsWith('FL')) {
            const fl = parseInt(props.floor_raw.substring(2));
            lowerValue = fl * 100; // FL to feet
          } else if (props.floor_raw === 'SFC' || props.floor_raw === 'GND') {
            lowerValue = 0;
          } else {
            // Vérifier si c'est en mètres
            if (props.floor_raw.includes('m') && !props.floor_raw.includes('nm')) {
              const match = props.floor_raw.match(/(\d+)m/);
              if (match) {
                lowerValue = Math.round(parseInt(match[1]) * 3.28084); // Convertir mètres en pieds
              }
            } else {
              // Essayer d'extraire un nombre de la chaîne (supposé en pieds)
              const match = props.floor_raw.match(/(\d+)/);
              if (match) {
                lowerValue = parseInt(match[1]);
              }
            }
          }
        }
        
        // Si ceiling_raw contient FL, convertir en pieds
        if (props.ceiling_raw && typeof props.ceiling_raw === 'string') {
          if (props.ceiling_raw.startsWith('FL')) {
            const fl = parseInt(props.ceiling_raw.substring(2));
            upperValue = fl * 100; // FL to feet
          } else if (props.ceiling_raw === 'UNLIMITED') {
            upperValue = 999999;
          } else {
            // Vérifier si c'est en mètres
            if (props.ceiling_raw.includes('m') && !props.ceiling_raw.includes('nm')) {
              const match = props.ceiling_raw.match(/(\d+)m/);
              if (match) {
                upperValue = Math.round(parseInt(match[1]) * 3.28084); // Convertir mètres en pieds
              }
            } else {
              // Essayer d'extraire un nombre de la chaîne (supposé en pieds)
              const match = props.ceiling_raw.match(/(\d+)/);
              if (match) {
                upperValue = parseInt(match[1]);
              }
            }
          }
        }
        
        // Vérifier si l'altitude planifiée est dans la plage de l'espace aérien
        // L'espace n'est affiché que si l'altitude est entre son plancher et son plafond
        const altitudeInRange = airspaceFilters.plannedAltitude >= lowerValue && 
                               airspaceFilters.plannedAltitude <= upperValue;
        
        if (!altitudeInRange) {
          return false; // Altitude en dehors de la plage de cet espace
        }
      }
      
      // Filtrer les espaces inactifs si nécessaire
      if (!airspaceFilters.showInactive && props.onDemand) {
        return false;
      }
      
      return true;
    });
  }, [airspaceFilters]);
  
  // Espaces aériens filtrés
  const filteredAirspaces = useMemo(() => {
    return filterAirspaces(layers.airspaces);
  }, [layers.airspaces, filterAirspaces]);

  // Analyser les espaces traversés en fonction de la route et l'altitude
  useEffect(() => {
    const analyzeTraversedAirspaces = async () => {
      if (!waypoints || waypoints.length < 2 || !filteredAirspaces || filteredAirspaces.length === 0) {
        setTraversedAirspaces([]);
        return;
      }
      
      // Créer un tableau des segments avec leurs altitudes
      const segments = [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const segmentId = `${waypoints[i].id}-${waypoints[i + 1].id}`;
        const segmentAltitude = segmentAltitudes?.[segmentId];
        
        segments.push({
          from: waypoints[i],
          to: waypoints[i + 1],
          altitude: segmentAltitude?.startAlt || plannedAltitude,
          endAltitude: segmentAltitude?.endAlt || segmentAltitude?.startAlt || plannedAltitude
        });
      }
      
      // Utiliser l'altitude du premier segment pour l'affichage global
      const displayAltitude = segments.length > 0 ? segments[0].altitude : plannedAltitude;
      setCurrentSegmentAltitude(displayAltitude);
      
      // Debug : vérifier la présence des espaces recherchés
      const debugSpaces = {
        'R (tous)': filteredAirspaces.filter(a => a.properties?.type === 'R'),
        'P (tous)': filteredAirspaces.filter(a => a.properties?.type === 'P'),
        'D (tous)': filteredAirspaces.filter(a => a.properties?.type === 'D'),
      };
      
      // Recherche plus flexible des espaces spécifiques
      const searchTerms = ['205', '49E2', 'PARIS', 'COGNAC', 'P23', 'P21', 'BRUYERES'];
      const foundSpaces = {};
      
      searchTerms.forEach(term => {
        foundSpaces[term] = filteredAirspaces.filter(a => {
          const name = a.properties?.name?.toUpperCase() || '';
          return name.includes(term.toUpperCase());
        });
      });
      
      console.log('📊 Analyse des espaces aériens:', {
        'Total espaces filtrés': filteredAirspaces.length,
        'Espaces R': debugSpaces['R (tous)'].length,
        'Espaces P': debugSpaces['P (tous)'].length,
        'Espaces D': debugSpaces['D (tous)'].length,
      });
      
      // Afficher les espaces trouvés
      Object.entries(foundSpaces).forEach(([term, spaces]) => {
        if (spaces.length > 0) {
          console.log(`✅ Trouvé pour "${term}":`, spaces.map(s => ({
            name: s.properties.name,
            type: s.properties.type,
            floor: s.properties.floor_raw,
            ceiling: s.properties.ceiling_raw
          })));
        } else {
          console.log(`❌ Aucun espace trouvé pour "${term}"`);
        }
      });
      
      // Lister tous les espaces R et P pour diagnostic
      if (debugSpaces['R (tous)'].length < 20) {
        console.log('🔍 Tous les espaces R:', debugSpaces['R (tous)'].map(s => s.properties.name));
      }
      if (debugSpaces['P (tous)'].length < 20) {
        console.log('🔍 Tous les espaces P:', debugSpaces['P (tous)'].map(s => s.properties.name));
      }

      const traversed = [];
      const traversedSet = new Set(); // Pour éviter les doublons
      
      // Debug : afficher la route avec les altitudes par segment
      console.log('🛩️ Route avec altitudes par segment:');
      segments.forEach((seg, idx) => {
        console.log(`  Segment ${idx + 1}: ${seg.from.name || seg.from.id} → ${seg.to.name || seg.to.id} | Alt: ${seg.altitude} ft → ${seg.endAltitude} ft`);
      });
      
      // Analyser chaque segment individuellement avec son altitude
      for (const segment of segments) {
        const segmentCoordinates = [
          [segment.from.lon, segment.from.lat],
          [segment.to.lon, segment.to.lat]
        ];
        
        const segmentLine = turf.lineString(segmentCoordinates);
        
        // Pour chaque segment, vérifier avec son altitude propre
        // Si le segment a une altitude qui change (montée/descente), utiliser la moyenne
        const segmentAltitude = (segment.altitude + segment.endAltitude) / 2;
        
        // Vérifier chaque espace aérien pour ce segment
        filteredAirspaces.forEach(airspace => {
          if (!airspace.geometry) return;
          
          const props = airspace.properties || {};
          
          // Créer une clé unique pour éviter les doublons
          const airspaceKey = `${props.name}-${props.type}`;
          if (traversedSet.has(airspaceKey)) return; // Déjà ajouté
          
          // Vérifier l'altitude pour ce segment spécifique
          let lowerValue = props.floor || 0;
          let upperValue = props.ceiling || 999999;
          
          // Gérer les FL (Flight Levels) et les altitudes en mètres
          if (props.floor_raw) {
            if (props.floor_raw.startsWith('FL')) {
              const fl = parseInt(props.floor_raw.substring(2));
              lowerValue = fl * 100;
            } else if (props.floor_raw === 'SFC') {
              lowerValue = 0;
            } else if (props.floor_raw.includes('m')) {
              // Altitude en mètres - convertir en pieds
              const match = props.floor_raw.match(/(\d+)m/);
              if (match) {
                lowerValue = Math.round(parseInt(match[1]) * 3.28084);
              }
            } else {
              // Essayer de parser les pieds directement
              const match = props.floor_raw.match(/(\d+)/);
              if (match) {
                lowerValue = parseInt(match[1]);
              }
            }
          }
          
          if (props.ceiling_raw) {
            if (props.ceiling_raw.startsWith('FL')) {
              const fl = parseInt(props.ceiling_raw.substring(2));
              upperValue = fl * 100;
            } else if (props.ceiling_raw.includes('m')) {
              // Altitude en mètres - convertir en pieds
              const match = props.ceiling_raw.match(/(\d+)m/);
              if (match) {
                upperValue = Math.round(parseInt(match[1]) * 3.28084);
              }
            } else {
              // Essayer de parser les pieds directement
              const match = props.ceiling_raw.match(/(\d+)/);
              if (match) {
                upperValue = parseInt(match[1]);
              }
            }
          }
          
          // Debug pour les espaces recherchés
          if (props.name && (props.name.includes('R205') || props.name.includes('R49E2') || 
              props.name.includes('PARIS 3') || props.name.includes('COGNAC') ||
              props.name.includes('P23') || props.name.includes('P21') || 
              props.name.includes('BRUYERES'))) {
            console.log(`🔍 Debug espace ${props.name} pour segment ${segment.from.name}→${segment.to.name}:`, {
              type: props.type,
              floor_raw: props.floor_raw,
              ceiling_raw: props.ceiling_raw,
              lowerValue,
              upperValue,
              segmentAltitude,
              altitudeInRange: segmentAltitude >= lowerValue && segmentAltitude <= upperValue
            });
          }
          
          // Si notre altitude est dans l'espace
          const altitudeInRange = segmentAltitude >= lowerValue && segmentAltitude <= upperValue;
          
          // Debug spécifique pour R205/3
          if (props.name && props.name.includes('R205/3')) {
            console.log(`🔴 R205/3 PARIS 3 - Vérification altitude pour segment:`, {
              segment: `${segment.from.name}→${segment.to.name}`,
              floor_raw: props.floor_raw,
              ceiling_raw: props.ceiling_raw,
              lowerValue,
              upperValue,
              segmentAltitude,
              altitudeInRange,
              test: `${segmentAltitude} >= ${lowerValue} && ${segmentAltitude} <= ${upperValue} = ${altitudeInRange}`
            });
          }
          
          if (altitudeInRange) {
            try {
              // Utiliser Turf.js pour une détection précise de l'intersection
              let airspaceFeature;
              
              if (airspace.geometry.type === 'Polygon') {
                airspaceFeature = turf.polygon(airspace.geometry.coordinates);
              } else if (airspace.geometry.type === 'MultiPolygon') {
                airspaceFeature = turf.multiPolygon(airspace.geometry.coordinates);
              } else {
                return; // Type non supporté
              }
              
              // Vérifier l'intersection exacte entre le segment et l'espace aérien
              const intersects = booleanIntersects(segmentLine, airspaceFeature);
              
              // Si pas d'intersection directe, vérifier la proximité (5 km)
              let isNearRoute = false;
              if (!intersects) {
                try {
                  // Calculer le centroïde de l'espace aérien
                  const airspaceCentroid = centroid(airspaceFeature);
                  // Calculer la distance du centroïde au segment
                  const distance = pointToLineDistance(airspaceCentroid, segmentLine, { units: 'kilometers' });
                  // Considérer l'espace comme "proche" s'il est à moins de 5 km
                  isNearRoute = distance < 5;
                } catch (err) {
                  // En cas d'erreur, ne pas considérer comme proche
                  isNearRoute = false;
                }
              }
              
              // Debug pour les espaces recherchés
              if (props.name && (props.name.includes('R205') || props.name.includes('R49E2') || 
                  props.name.includes('PARIS 3') || props.name.includes('COGNAC') ||
                  props.name.includes('P23') || props.name.includes('P21') || 
                  props.name.includes('BRUYERES'))) {
                
                // Calculer le centre approximatif de l'espace
                let centerLat = 0, centerLon = 0, pointCount = 0;
                if (airspace.geometry.type === 'Polygon') {
                  const coords = airspace.geometry.coordinates[0];
                  coords.forEach(coord => {
                    centerLon += coord[0];
                    centerLat += coord[1];
                    pointCount++;
                  });
                } else if (airspace.geometry.type === 'MultiPolygon') {
                  const coords = airspace.geometry.coordinates[0][0];
                  coords.forEach(coord => {
                    centerLon += coord[0];
                    centerLat += coord[1];
                    pointCount++;
                  });
                }
                
                if (pointCount > 0) {
                  centerLat /= pointCount;
                  centerLon /= pointCount;
                }
                
                let distanceStr = '';
                if (!intersects && isNearRoute) {
                  try {
                    const airspaceCentroid = centroid(airspaceFeature);
                    const distance = pointToLineDistance(airspaceCentroid, segmentLine, { units: 'kilometers' });
                    distanceStr = ` | Distance: ${distance.toFixed(1)} km`;
                  } catch (err) {}
                }
                
                console.log(`🔍 ${props.name} sur segment ${segment.from.name}→${segment.to.name}: Intersection=${intersects}, Proche=${isNearRoute}${distanceStr} | Centre: ${centerLat.toFixed(4)}, ${centerLon.toFixed(4)}`);
              }
              
              // Inclure l'espace s'il est traversé OU s'il est proche
              if (intersects || isNearRoute) {
                // Marquer cet espace comme ajouté
                traversedSet.add(airspaceKey);
                
                // Enrichir avec les fréquences si disponibles
                const enrichedAirspace = { 
                  ...airspace,
                  properties: {
                    ...airspace.properties,
                    isNearRoute: isNearRoute && !intersects,
                    isDirectlyTraversed: intersects,
                    traversedAtAltitude: segmentAltitude,
                    traversedOnSegment: `${segment.from.name || segment.from.id} → ${segment.to.name || segment.to.id}`
                  }
                };
                  
                // Essayer de trouver les fréquences associées
                // Les CTR et TMA sont généralement liés à un aérodrome
                if (props.type === 'CTR' || props.type === 'TMA' || props.type === 'ATZ') {
                  // Extraire l'ICAO depuis le nom (ex: "LFBD CTR" ou "CTR BORDEAUX")
                  const icaoMatch = props.name?.match(/(LF[A-Z]{2})/);
                  if (icaoMatch) {
                    const icao = icaoMatch[1];
                    // Ajouter l'ICAO aux propriétés pour récupération ultérieure
                    enrichedAirspace.properties = {
                      ...enrichedAirspace.properties,
                      associatedIcao: icao
                    };
                  }
                }
                
                traversed.push(enrichedAirspace);
              }
            } catch (error) {
              console.warn('Erreur lors de la vérification d\'intersection:', error);
            }
          }
        });
      }
    
    // Enrichir avec les fréquences
    const enrichedTraversed = await Promise.all(
      traversed.map(async (airspace) => {
        // Si l'espace a déjà des fréquences, les garder
        if (airspace.properties?.frequencies && airspace.properties.frequencies.length > 0) {
          return airspace;
        }
        
        // Sinon, essayer de récupérer les fréquences via l'ICAO associé
        if (airspace.properties?.associatedIcao) {
          const frequencies = await getAirportFrequenciesSync(airspace.properties.associatedIcao);
          if (frequencies && frequencies.length > 0) {
            return {
              ...airspace,
              properties: {
                ...airspace.properties,
                frequencies: frequencies
              }
            };
          }
        }
        
        // Si c'est un CTR/TMA/ATZ, ajouter des fréquences génériques basées sur le type
        if (airspace.properties?.type === 'CTR' || airspace.properties?.type === 'TMA') {
          // Fréquences typiques pour CTR/TMA
          return {
            ...airspace,
            properties: {
              ...airspace.properties,
              frequencies: [
                { type: 'TWR', value: '118.300', unit: 'MHz', service: 'Tower' },
                { type: 'APP', value: '119.100', unit: 'MHz', service: 'Approach' }
              ]
            }
          };
        }
        
        return airspace;
      })
    );
    
    setTraversedAirspaces(enrichedTraversed);
    };
    
    analyzeTraversedAirspaces();
  }, [waypoints, plannedAltitude, filteredAirspaces, segmentAltitudes]);
  
  // Style pour les espaces aériens
  const getAirspaceStyle = useCallback((feature) => {
    const props = feature.properties || {};
    const type = props.type;
    const airspaceClass = props.class;
    
    // Vérifier si cet espace est traversé
    const isTraversed = traversedAirspaces.some(t => 
      t.properties?.name === props.name && t.properties?.type === props.type
    );
    
    let color = '#808080';
    let fillOpacity = isTraversed ? 0.3 : 0.2;  // Plus opaque si traversé
    let dashArray = null;
    let weight = isTraversed ? 3 : 2;  // Plus épais si traversé
    
    // Couleurs par type d'espace aérien OpenAIP
    if (type === 'CTR') {
      color = '#0099FF';  // Bleu pour CTR
      fillOpacity = 0.15;
    } else if (type === 'TMA') {
      color = '#FF6600';  // Orange pour TMA
      fillOpacity = 0.15;
    } else if (type === 'CTA') {
      color = '#FF9900';  // Orange foncé pour CTA
      fillOpacity = 0.15;
    } else if (type === 'P' || type === 'PROHIBITED') {
      color = '#CC0000';  // Rouge foncé pour zones interdites
      fillOpacity = 0.4;
      weight = 3;
    } else if (type === 'R' || type === 'RESTRICTED') {
      color = '#CC0066';  // Violet pour zones réglementées
      fillOpacity = 0.25;
      dashArray = '8, 4';
    } else if (type === 'D' || type === 'DANGER') {
      color = '#FF9900';  // Orange pour zones dangereuses
      fillOpacity = 0.2;
      dashArray = '5, 5';
    } else if (type === 'AIRSPACE_A' || airspaceClass === 'A') {
      color = '#990000';  // Rouge pour classe A
      fillOpacity = 0.3;
    } else if (type === 'AIRSPACE_B' || airspaceClass === 'B') {
      color = '#0066CC';  // Bleu pour classe B
      fillOpacity = 0.25;
    } else if (type === 'AIRSPACE_C' || airspaceClass === 'C') {
      color = '#00AA00';  // Vert pour classe C
      fillOpacity = 0.2;
    } else if (type === 'AIRSPACE_D' || airspaceClass === 'D') {
      color = '#0099FF';  // Bleu clair pour classe D
      fillOpacity = 0.15;
    } else if (type === 'AIRSPACE_E' || airspaceClass === 'E') {
      color = '#FF99CC';  // Rose pour classe E
      fillOpacity = 0.15;
    } else if (type === 'AIRSPACE_G' || airspaceClass === 'G') {
      color = '#99CC00';  // Vert clair pour classe G
      fillOpacity = 0.1;
      dashArray = '10, 10';
    } else if (type === 'TMZ') {
      color = '#9966FF';  // Violet pour TMZ
      fillOpacity = 0.2;
      dashArray = '10, 5';
    } else if (type === 'RMZ') {
      color = '#FF6699';  // Rose foncé pour RMZ
      fillOpacity = 0.2;
      dashArray = '6, 3';
    }
    
    // Ajustements par classe si pas déjà défini par type
    if (!type.includes('AIRSPACE_')) {
      if (airspaceClass === 'A') {
        color = '#990000';
        fillOpacity = 0.3;
      } else if (airspaceClass === 'D') {
        color = '#0099FF';
        fillOpacity = 0.15;
      }
    }
    
    // Si traversé, ajouter une animation ou un style spécial
    if (isTraversed) {
      color = type === 'CTR' || type === 'TMA' ? '#dc2626' : color; // Rouge pour les zones contrôlées
      fillOpacity = 0.35;
    }
    
    return {
      color,
      weight,
      opacity: 0.8,
      fillColor: color,
      fillOpacity,
      dashArray
    };
  }, [traversedAirspaces]);
  
  // État de chargement
  if (loading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '500px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e0e0e0',
            borderTopColor: '#2196f3',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Chargement des données SIA...</p>
        </div>
      </div>
    );
  }
  
  // État d'erreur
  if (error) {
    return (
      <div style={{ 
        width: '100%', 
        height: '500px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#fff3e0'
      }}>
        <div style={{ textAlign: 'center', color: '#e65100' }}>
          <p>⚠️ Erreur de chargement</p>
          <p style={{ fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: '500px', position: 'relative' }}>
        <MapContainer
          center={center}
          zoom={defaultZoom}
          style={{ width: '100%', height: '100%' }}
      >
        {/* Composant pour contrôler le centrage de la carte */}
        <MapCenterController centerTarget={mapCenterTarget || (navigationBounds ? { bounds: navigationBounds, zoom: defaultZoom } : null)} />
        
        {/* Composant pour créer des points VFR personnalisés */}
        <CustomVFRCreator 
          isCreating={isCreatingVFR} 
          onPointCreated={handlePointCreated} 
        />
        
        {/* Fond de carte par défaut toujours présent */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <LayersControl position="topright">
          {/* Fond de carte principal */}
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
              crossOrigin=""
            />
          </LayersControl.BaseLayer>
          
          <LayersControl.BaseLayer name="OpenTopoMap">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenTopoMap'
              crossOrigin=""
            />
          </LayersControl.BaseLayer>
          
          {/* Aérodromes - Non coché par défaut */}
          {layers.aerodromes && layers.aerodromes.length > 0 && (
            <LayersControl.Overlay name={`Aérodromes (${layers.aerodromes.length})`}>
              <LayerGroup>
                <GeoJSON
                  data={{
                    type: 'FeatureCollection',
                    features: layers.aerodromes
                  }}
                  pointToLayer={pointToLayer}
                  onEachFeature={(feature, layer) => {
                    layer.bindPopup(createPopup(feature));
                  }}
                />
              </LayerGroup>
            </LayersControl.Overlay>
          )}
          
          {/* Navaids */}
          {layers.navaids && layers.navaids.length > 0 && (
            <LayersControl.Overlay name={`Navaids (${layers.navaids.length})`}>
              <LayerGroup>
                <GeoJSON
                  data={{
                    type: 'FeatureCollection',
                    features: layers.navaids
                  }}
                  pointToLayer={pointToLayer}
                  onEachFeature={(feature, layer) => {
                    layer.bindPopup(createPopup(feature));
                  }}
                />
              </LayerGroup>
            </LayersControl.Overlay>
          )}
          
          {/* Points VFR */}
          {layers.designatedPoints && layers.designatedPoints.length > 0 && (
            <LayersControl.Overlay name={`Points VFR (${layers.designatedPoints.length})`}>
              <LayerGroup>
                <GeoJSON
                  data={{
                    type: 'FeatureCollection',
                    features: layers.designatedPoints.slice(0, 500) // Limiter pour les performances
                  }}
                  pointToLayer={pointToLayer}
                  onEachFeature={(feature, layer) => {
                    layer.bindPopup(createPopup(feature));
                  }}
                />
              </LayerGroup>
            </LayersControl.Overlay>
          )}
          
          {/* Points VFR issus des cartes VAC */}
          {layers.vfrPoints && layers.vfrPoints.length > 0 && (
            <LayersControl.Overlay checked name={`Points VFR VAC (${layers.vfrPoints.length})`}>
              <LayerGroup>
                {layers.vfrPoints.map((vfrPoint, index) => {
                  const coords = vfrPoint.geometry?.coordinates;
                  if (!coords || coords.length !== 2) return null;
                  
                  return (
                    <Marker
                      key={`vfr-${index}`}
                      position={[coords[1], coords[0]]} // [lat, lon]
                      icon={icons.vfrPoint}
                    >
                      <Popup>
                        <div style={{ minWidth: '200px' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#1f2937', fontSize: '16px' }}>
                            {vfrPoint.properties?.name || 'Point VFR'}
                          </h4>
                          <div style={{ fontSize: '14px', color: '#4b5563' }}>
                            {vfrPoint.properties?.aerodrome && (
                              <p style={{ margin: '5px 0' }}>
                                <strong>Aérodrome:</strong> {vfrPoint.properties.aerodrome} - {vfrPoint.properties.aerodromeName}
                              </p>
                            )}
                            {vfrPoint.properties?.description && (
                              <p style={{ margin: '5px 0' }}>
                                <strong>Description:</strong> {vfrPoint.properties.description}
                              </p>
                            )}
                            {vfrPoint.properties?.altitude && (
                              <p style={{ margin: '5px 0' }}>
                                <strong>Altitude:</strong> {vfrPoint.properties.altitude}
                              </p>
                            )}
                            {vfrPoint.properties?.reference && (
                              <p style={{ margin: '5px 0' }}>
                                <strong>Référence:</strong> {vfrPoint.properties.reference}
                              </p>
                            )}
                            {onWaypointUpdate && (
                              <button
                                onClick={() => {
                                  // Ajouter ce point VFR au trajet en insérant avant le dernier waypoint (destination)
                                  const newWaypoint = {
                                    id: Date.now(),
                                    name: vfrPoint.properties?.name || 'Point VFR',
                                    lat: coords[1],
                                    lon: coords[0],
                                    type: 'waypoint',
                                    vfrType: 'VFR',
                                    aerodrome: vfrPoint.properties?.aerodrome,
                                    description: vfrPoint.properties?.description,
                                    altitude: vfrPoint.properties?.altitude
                                  };
                                  
                                  // Insérer avant la destination (dernier waypoint)
                                  const newWaypoints = [...waypoints];
                                  if (newWaypoints.length >= 2) {
                                    newWaypoints.splice(newWaypoints.length - 1, 0, newWaypoint);
                                  } else {
                                    newWaypoints.push(newWaypoint);
                                  }
                                  
                                  // Appeler setWaypoints directement si disponible, sinon utiliser onWaypointUpdate
                                  if (typeof onWaypointUpdate === 'function') {
                                    // Si onWaypointUpdate est la fonction setWaypoints du store
                                    onWaypointUpdate(newWaypoints);
                                  }
                                }}
                                style={{
                                  marginTop: '12px',
                                  width: '100%',
                                  padding: '8px 16px',
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                ➕ Ajouter au trajet
                              </button>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </LayerGroup>
            </LayersControl.Overlay>
          )}
          
          {/* Points VFR personnalisés */}
          {customVFRPoints && customVFRPoints.length > 0 && (
            <LayersControl.Overlay checked name={`Points VFR personnalisés (${customVFRPoints.length})`}>
              <LayerGroup>
                {customVFRPoints.map((point) => {
                  const customIcon = createIcon('#8B5CF6', 'C'); // Violet pour les points custom
                  
                  return (
                    <Marker
                      key={point.id}
                      position={[point.lat, point.lon]}
                      icon={customIcon}
                    >
                      <Popup>
                        <div style={{ minWidth: '200px' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#1f2937', fontSize: '16px' }}>
                            {point.name} 
                            <span style={{ 
                              marginLeft: '8px',
                              padding: '2px 6px',
                              background: '#8B5CF6',
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              PERSO
                            </span>
                          </h4>
                          <div style={{ fontSize: '14px', color: '#4b5563' }}>
                            {point.description && (
                              <p style={{ margin: '5px 0' }}>
                                <strong>Description:</strong> {point.description}
                              </p>
                            )}
                            {point.aerodrome && (
                              <p style={{ margin: '5px 0' }}>
                                <strong>Aérodrome:</strong> {point.aerodrome}
                              </p>
                            )}
                            {point.altitude && (
                              <p style={{ margin: '5px 0' }}>
                                <strong>Altitude:</strong> {point.altitude}
                              </p>
                            )}
                            <p style={{ margin: '5px 0', fontSize: '12px', color: '#9ca3af' }}>
                              Créé le {new Date(point.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                            
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                              {onWaypointUpdate && (
                                <button
                                  onClick={() => {
                                    const newWaypoint = {
                                      id: Date.now(),
                                      name: point.name,
                                      lat: point.lat,
                                      lon: point.lon,
                                      type: 'waypoint',
                                      vfrType: 'CUSTOM',
                                      description: point.description
                                    };
                                    
                                    const newWaypoints = [...waypoints];
                                    if (newWaypoints.length >= 2) {
                                      newWaypoints.splice(newWaypoints.length - 1, 0, newWaypoint);
                                    } else {
                                      newWaypoints.push(newWaypoint);
                                    }
                                    
                                    onWaypointUpdate(newWaypoints);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '8px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                >
                                  ➕ Ajouter
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (confirm(`Supprimer le point "${point.name}" ?`)) {
                                    deleteCustomVFRPoint(point.id);
                                    setCustomVFRPoints(customVFRPoints.filter(p => p.id !== point.id));
                                  }
                                }}
                                style={{
                                  padding: '8px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </LayerGroup>
            </LayersControl.Overlay>
          )}
          
          {/* Espaces aériens filtrés */}
          {filteredAirspaces && filteredAirspaces.length > 0 && !isCreatingVFR && (
            <LayersControl.Overlay checked name={`Espaces aériens (${filteredAirspaces.length}/${layers.airspaces?.length || 0})`}>
              <LayerGroup>
                <GeoJSON
                  key={JSON.stringify(airspaceFilters)} // Force re-render when filters change
                  data={{
                    type: 'FeatureCollection',
                    features: filteredAirspaces
                  }}
                  style={getAirspaceStyle}
                  onEachFeature={(feature, layer) => {
                    
                    const props = feature.properties || {};
                    
                    // Fonction pour formater les altitudes correctement avec conversion en pieds
                    const formatAltitude = (val, raw) => {
                      if (raw && typeof raw === 'string') {
                        // Si l'altitude est en mètres, ajouter la conversion en pieds
                        if (raw.includes('m') && !raw.includes('nm')) {
                          const match = raw.match(/(\d+)m/);
                          if (match) {
                            const meters = parseInt(match[1]);
                            const feet = Math.round(meters * 3.28084);
                            return `${raw} (${feet} ft)`;
                          }
                        }
                        // Si c'est un FL, ajouter aussi les pieds
                        if (raw.startsWith('FL')) {
                          const fl = parseInt(raw.substring(2));
                          const feet = fl * 100;
                          return `${raw} (${feet} ft)`;
                        }
                        return raw;
                      }
                      if (typeof val === 'object' && val !== null) {
                        // Si c'est un objet, extraire la valeur
                        const value = val.value || val.altitude || 0;
                        const unit = val.unit || val.uom || 'FT';
                        const ref = val.referenceDatum || val.reference || 'MSL';
                        if (value === 0 || ref === 'GND') return 'SFC';
                        if (value === 999999) return 'UNLIMITED';
                        if (unit === 'FL' || ref === 'STD') return `FL${String(value).padStart(3, '0')}`;
                        return `${value} ft ${ref}`;
                      }
                      if (val === 0) return 'SFC';
                      if (val === 999999) return 'UNLIMITED';
                      if (typeof val === 'number') return `${val} ft`;
                      return val || 'N/A';
                    };
                    
                    // Créer un ID unique pour le bouton
                    const buttonId = `edit-btn-${feature.id || Math.random().toString(36).substr(2, 9)}`;
                    
                    const popup = `
                      <div style="min-width: 250px;">
                        <h4 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px;">${props.name || props.code_id}</h4>
                        <div style="font-size: 14px; color: #4b5563;">
                          <p style="margin: 5px 0;"><strong>Type:</strong> ${props.type}</p>
                          ${props.class ? `<p style="margin: 5px 0;"><strong>Classe:</strong> ${props.class}</p>` : ''}
                          <p style="margin: 5px 0;"><strong>Plancher:</strong> ${formatAltitude(props.floor || props.lowerLimit, props.floor_raw)}</p>
                          <p style="margin: 5px 0;"><strong>Plafond:</strong> ${formatAltitude(props.ceiling || props.upperLimit, props.ceiling_raw)}</p>
                          ${props.activity ? `<p style="margin: 5px 0;"><strong>Activité:</strong> ${props.activity}</p>` : ''}
                          ${props.schedule ? `<p style="margin: 5px 0;"><strong>Horaires:</strong> ${props.schedule}</p>` : ''}
                          ${props.remarks ? `<p style="margin: 5px 0;"><strong>Remarques:</strong> ${props.remarks}</p>` : ''}
                          ${props.frequencies && props.frequencies.length > 0 ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                              <strong>Fréquences:</strong>
                              ${props.frequencies.map(freq => `
                                <div style="margin: 3px 0; font-size: 13px;">
                                  📻 ${freq.type?.toUpperCase() || freq.service}: ${freq.value} ${freq.unit || 'MHz'}
                                  ${freq.callSign ? `<span style="color: #6b7280; font-size: 12px;"> - ${freq.callSign}</span>` : ''}
                                </div>
                              `).join('')}
                            </div>
                          ` : ''}
                        </div>
                        ${props.editable !== false ? `
                          <button 
                            id="${buttonId}"
                            style="
                              margin-top: 12px;
                              width: 100%;
                              padding: 8px 16px;
                              background: #3b82f6;
                              color: white;
                              border: none;
                              border-radius: 6px;
                              font-size: 14px;
                              font-weight: 500;
                              cursor: pointer;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              gap: 6px;
                              transition: background 0.2s;
                            "
                            onmouseover="this.style.background='#2563eb'"
                            onmouseout="this.style.background='#3b82f6'"
                          >
                            ✏️ Éditer
                          </button>
                        ` : ''}
                      </div>
                    `;
                    
                    // Bind le popup
                    layer.bindPopup(popup);
                    
                    // Ajouter le handler pour le bouton après l'ouverture du popup
                    layer.on('popupopen', () => {
                      const btn = document.getElementById(buttonId);
                      if (btn) {
                        btn.onclick = () => {
                          // Fermer le popup
                          layer.closePopup();
                          // Ouvrir l'éditeur
                          setEditingAirspace(feature);
                          setShowEditor(true);
                        };
                      }
                    });
                  }}
                />
              </LayerGroup>
            </LayersControl.Overlay>
          )}
        </LayersControl>
        
        {/* Tracé de la route entre les waypoints */}
        {waypoints.length >= 2 && (() => {
          const routePoints = waypoints
            .map(waypoint => {
              const lat = waypoint.lat || waypoint.coordinates?.lat;
              const lon = waypoint.lon || waypoint.coordinates?.lon;
              return lat && lon ? [lat, lon] : null;
            })
            .filter(point => point !== null);
          
          if (routePoints.length >= 2) {
            return (
              <Polyline
                positions={routePoints}
                color="#2196F3"
                weight={3}
                opacity={0.8}
                dashArray="10, 5"
              />
            );
          }
          return null;
        })()}
        
        {/* Marqueurs des waypoints */}
        {waypoints.map((waypoint, index) => {
          const lat = waypoint.lat || waypoint.coordinates?.lat;
          const lon = waypoint.lon || waypoint.coordinates?.lon;
          
          if (!lat || !lon) return null;
          
          return (
            <Marker 
              key={index} 
              position={[lat, lon]}
              icon={createIcon(index === 0 ? '#4CAF50' : index === waypoints.length - 1 ? '#F44336' : '#2196F3', 
                               index === 0 ? 'D' : index === waypoints.length - 1 ? 'A' : (index + 1).toString())}
            >
              <Popup>
                <div>
                  <h4>{index === 0 ? 'Départ' : index === waypoints.length - 1 ? 'Arrivée' : `Waypoint ${index}`}</h4>
                  <p>{waypoint.name || waypoint.icao || `Point ${index + 1}`}</p>
                  {waypoint.frequency && <p>Fréquence: {waypoint.frequency}</p>}
                  {waypoint.elevation && <p>Altitude: {waypoint.elevation} ft</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}
        </MapContainer>
        
        {/* Boutons de contrôle de la carte */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Bouton pour recentrer sur la navigation */}
          {waypoints.length >= 2 && (
            <button
              onClick={() => {
                if (navigationBounds) {
                  setMapCenterTarget({ 
                    bounds: navigationBounds, 
                    zoom: defaultZoom 
                  });
                }
              }}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
              title="Recentrer la carte sur votre trajet"
            >
              🎯 Centrer sur le trajet
            </button>
          )}
          
          {/* Bouton pour créer un point VFR personnalisé */}
          <button
            onClick={handleStartCreatingVFR}
            disabled={isCreatingVFR}
            style={{
              background: isCreatingVFR ? '#9ca3af' : '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              cursor: isCreatingVFR ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📍 {isCreatingVFR ? 'Cliquez sur la carte...' : 'Créer point VFR'}
          </button>
          
          {isCreatingVFR && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              background: '#fef3c7',
              border: '1px solid #fde047',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#78350f'
            }}>
              💡 Cliquez n'importe où sur la carte pour placer le point VFR
              <br />
              <button
                onClick={() => setIsCreatingVFR(false)}
                style={{
                  marginTop: '5px',
                  padding: '4px 8px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
            </div>
          )}
        </div>
        
        {/* Contrôle d'altitude planifiée toujours visible */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          background: 'white',
          borderRadius: '8px',
          padding: '10px 16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: '250px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
            🛩️ Altitude:
          </span>
          <input
            type="number"
            value={plannedAltitude || ''}
            onChange={(e) => {
              const altitude = parseInt(e.target.value) || 0;
              setAirspaceFilters(prev => ({ ...prev, plannedAltitude: altitude }));
              if (onPlannedAltitudeChange) {
                onPlannedAltitudeChange(altitude);
              }
            }}
            placeholder="3000"
            min="0"
            max="60000"
            step="500"
            style={{
              width: '100px',
              padding: '4px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <span style={{ fontSize: '13px', color: '#666' }}>ft</span>
          {plannedAltitude >= 19500 && (
            <span style={{ fontSize: '11px', color: '#0369a1' }}>
              (FL{Math.floor(plannedAltitude / 100)})
            </span>
          )}
        </div>
        
        {/* Bouton pour afficher/masquer les filtres */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1001,
            padding: '8px 16px',
            background: showFilters ? '#2196F3' : '#fff',
            color: showFilters ? '#fff' : '#333',
            border: '2px solid #2196F3',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          🎛️ Filtres espaces aériens
        </button>
      </div>
      
      {/* Indicateur des espaces traversés - En dehors de la carte */}
      {waypoints.length >= 2 && plannedAltitude > 0 && (
        <div style={{
          marginTop: '12px',
          background: traversedAirspaces.length > 0 ? '#fff5f5' : '#f0fdf4',
          borderRadius: '8px',
          padding: '12px 16px',
          border: traversedAirspaces.length > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0'
        }}>
          {traversedAirspaces.length > 0 ? (
            <>
              <div style={{ 
                fontWeight: '600', 
                marginBottom: '10px',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px'
              }}>
                ⚠️ Espaces aériens traversés:
              </div>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '8px',
                marginBottom: '10px'
              }}>
                {traversedAirspaces.map((airspace, idx) => {
                  const props = airspace.properties || {};
                  const type = props.type;
                  let bgColor = '#e5e7eb';
                  let textColor = '#374151';
                  
                  // Couleurs par type
                  if (type === 'CTR') {
                    bgColor = '#dbeafe';
                    textColor = '#1e40af';
                  } else if (type === 'TMA') {
                    bgColor = '#fed7aa';
                    textColor = '#c2410c';
                  } else if (type === 'R' || type === 'P' || type === 'D') {
                    bgColor = '#fee2e2';
                    textColor = '#991b1b';
                  } else if (type === 'TMZ' || type === 'RMZ') {
                    bgColor = '#e9d5ff';
                    textColor = '#6b21a8';
                  }
                  
                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                        // Calculer les limites de l'espace aérien
                        if (airspace.geometry) {
                          const geoJsonLayer = L.geoJSON(airspace);
                          const bounds = geoJsonLayer.getBounds();
                          setMapCenterTarget({ 
                            bounds: bounds,
                            zoom: 10 
                          });
                        }
                      }}
                      style={{
                        backgroundColor: bgColor,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0,0,0,0.1)',
                        display: 'inline-block',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        ':hover': {
                          transform: 'scale(1.05)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      title={`Cliquer pour centrer sur ${props.name || 'cet espace'}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px' }}>
                          {props.isNearRoute ? '⚠️' : '📍'}
                        </span>
                        <span style={{ fontWeight: '700', color: textColor }}>{type}</span>
                        <span style={{ color: textColor }}>{props.name || 'Sans nom'}</span>
                        {props.traversedOnSegment && (
                          <span style={{ 
                            fontSize: '11px', 
                            color: '#6b7280',
                            fontStyle: 'italic'
                          }}>
                            ({props.traversedOnSegment} @ {props.traversedAtAltitude}ft)
                          </span>
                        )}
                        {props.isNearRoute && (
                          <span style={{ 
                            fontSize: '10px', 
                            background: '#fbbf24', 
                            color: '#78350f',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontWeight: '600'
                          }}>
                            PROCHE
                          </span>
                        )}
                        {props.floor_raw && props.ceiling_raw && (
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>
                            ({(() => {
                              let floor = props.floor_raw;
                              let ceiling = props.ceiling_raw;
                              
                              // Convertir le plancher
                              if (floor.includes('m') && !floor.includes('nm')) {
                                const match = floor.match(/(\d+)m/);
                                if (match) {
                                  const feet = Math.round(parseInt(match[1]) * 3.28084);
                                  floor = `${floor} / ${feet}ft`;
                                }
                              } else if (floor.startsWith('FL')) {
                                const fl = parseInt(floor.substring(2));
                                floor = `${floor} / ${fl * 100}ft`;
                              }
                              
                              // Convertir le plafond
                              if (ceiling.includes('m') && !ceiling.includes('nm')) {
                                const match = ceiling.match(/(\d+)m/);
                                if (match) {
                                  const feet = Math.round(parseInt(match[1]) * 3.28084);
                                  ceiling = `${ceiling} / ${feet}ft`;
                                }
                              } else if (ceiling.startsWith('FL')) {
                                const fl = parseInt(ceiling.substring(2));
                                ceiling = `${ceiling} / ${fl * 100}ft`;
                              }
                              
                              return `${floor} - ${ceiling}`;
                            })()})
                          </span>
                        )}
                      </div>
                      {props.frequencies && props.frequencies.length > 0 && (
                        <div style={{ 
                          marginTop: '4px', 
                          paddingTop: '4px', 
                          borderTop: '1px solid rgba(0,0,0,0.1)',
                          fontSize: '11px'
                        }}>
                          {props.frequencies.slice(0, 3).map((freq, fidx) => (
                            <div key={fidx} style={{ color: textColor, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📻</span>
                              <span style={{ fontWeight: '600' }}>
                                {freq.type?.toUpperCase() || freq.service || 'FREQ'}:
                              </span>
                              <span>{freq.value} {freq.unit || 'MHz'}</span>
                              {freq.callSign && (
                                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                                  ({freq.callSign})
                                </span>
                              )}
                            </div>
                          ))}
                          {props.frequencies.length > 3 && (
                            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                              +{props.frequencies.length - 3} autres fréquences
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#7c2d12',
                fontStyle: 'italic',
                borderTop: '1px solid #fecaca',
                paddingTop: '8px',
                marginTop: '8px'
              }}>
                💡 Vérifiez les conditions d'entrée et contactez les fréquences appropriées
              </div>
            </>
          ) : (
            <div style={{
              fontSize: '13px',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500'
            }}>
              ✅ Aucun espace aérien contrôlé traversé à {currentSegmentAltitude} ft
              {currentSegmentAltitude >= 19500 && ` (FL${Math.floor(currentSegmentAltitude / 100)})`}
            </div>
          )}
        </div>
      )}
      
      {/* Panneau de filtres en dessous de la carte */}
      {showFilters && (
        <AirspaceFilters
          filters={airspaceFilters}
          onFilterChange={setAirspaceFilters}
          airspaceStats={airspaceStats}
        />
      )}
      
      {/* Éditeur d'espace aérien */}
      {showEditor && editingAirspace && (
        <AirspaceEditor
          airspace={editingAirspace}
          onSave={async (id, updates) => {
            try {
              // Mettre à jour l'espace aérien via le service hybride
              const { hybridAirspacesService } = await import('../../../services/hybridAirspacesService.js');
              await hybridAirspacesService.updateAirspace(id, updates);
              
              // Recharger les espaces aériens
              const updatedAirspaces = await openAIPAirspacesService.getFrenchAirspaces();
              setLayers(prev => ({ ...prev, airspaces: updatedAirspaces }));
              
              // Fermer l'éditeur
              setShowEditor(false);
              setEditingAirspace(null);
              
              console.log('✅ Espace aérien mis à jour');
            } catch (error) {
              console.error('Erreur mise à jour espace aérien:', error);
            }
          }}
          onCancel={() => {
            setShowEditor(false);
            setEditingAirspace(null);
          }}
        />
      )}
      
      {/* Formulaire de création de point VFR */}
      {showVFRForm && newVFRPosition && (
        <CustomVFRPointForm
          position={newVFRPosition}
          onSave={handleSaveVFRPoint}
          onCancel={handleCancelVFRForm}
        />
      )}
      
      {/* Ajout du style pour l'animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};