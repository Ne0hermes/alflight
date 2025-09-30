// src/features/navigation/components/NavigationMapFixed.jsx
import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, ZoomControl, LayersControl, LayerGroup, useMap, Circle, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, AlertTriangle, Info, Map, Fuel, RefreshCw } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useFuel } from '@core/contexts';
import { Conversions } from '@utils/conversions';

// Import des styles Leaflet - TRÈS IMPORTANT
import 'leaflet/dist/leaflet.css';

// Correction du problème d'icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Icônes personnalisées pour les waypoints
const createIcon = (color, type) => {
  const svgIcon = `
    <svg width="30" height="40" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C7.5 0 1 6.5 1 14C1 24.5 15 40 15 40C15 40 29 24.5 29 14C29 6.5 22.5 0 15 0Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="15" cy="14" r="6" fill="#ffffff"/>
      <text x="15" y="18" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${type}</text>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -40],
    className: 'custom-waypoint-icon'
  });
};

const WAYPOINT_ICONS = {
  departure: createIcon('#10b981', 'D'),
  arrival: createIcon('#f59e0b', 'A'),
  waypoint: createIcon('#3b82f6', 'W'),
  alternate: createIcon('#ef4444', 'ALT')
};

// Icône pour les points VFR
const createVFRIcon = (code, mandatory) => {
  const color = mandatory ? '#f59e0b' : '#3b82f6';
  const svgIcon = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="#ffffff">${code}</text>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    className: 'vfr-point-icon'
  });
};

// Composant pour gérer les changements de vue
const MapViewController = ({ waypoints, setZoomWarning }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !waypoints || waypoints.length === 0) return;
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) return;
    
    try {
      if (validWaypoints.length === 1) {
        map.setView([validWaypoints[0].lat, validWaypoints[0].lon], 10);
        setZoomWarning(false);
      } else {
        const bounds = L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
        
        // Calculer la distance maximale
        let maxDistance = 0;
        for (let i = 0; i < validWaypoints.length - 1; i++) {
          for (let j = i + 1; j < validWaypoints.length; j++) {
            const dist = L.latLng(validWaypoints[i].lat, validWaypoints[i].lon)
              .distanceTo(L.latLng(validWaypoints[j].lat, validWaypoints[j].lon));
            maxDistance = Math.max(maxDistance, dist);
          }
        }
        
        const distanceKm = maxDistance / 1000;
        if (distanceKm > 1000) {
          setZoomWarning(true);
        } else {
          setZoomWarning(false);
        }
        
        map.fitBounds(bounds, { 
          padding: [50, 50],
          maxZoom: 12,
          minZoom: 5
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajustement de la vue:', error);
    }
  }, [waypoints, map, setZoomWarning]);
  
  return null;
};

// Composant pour afficher les cercles de rayon d'action
const RangeCircles = memo(({ center, selectedAircraft, showRange }) => {
  const { fobFuel, fuelData } = useFuel();
  
  if (!showRange || !center || !selectedAircraft) return null;
  if (!selectedAircraft.fuelConsumption || !selectedAircraft.cruiseSpeedKt) return null;
  if (!fobFuel || !fuelData || !fuelData.finalReserve) return null;
  
  const usableFuelLtr = fobFuel.ltr - fuelData.finalReserve.ltr;
  if (usableFuelLtr <= 0) return null;
  
  const enduranceHours = usableFuelLtr / selectedAircraft.fuelConsumption;
  const maxRangeNM = enduranceHours * selectedAircraft.cruiseSpeedKt;
  const roundTripRangeNM = (maxRangeNM / 2) * 0.9;
  
  const NM_TO_METERS = 1852;
  const maxRangeMeters = maxRangeNM * NM_TO_METERS;
  const roundTripRangeMeters = roundTripRangeNM * NM_TO_METERS;
  
  const lat = parseFloat(center.lat);
  const lon = parseFloat(center.lon);
  
  if (isNaN(lat) || isNaN(lon)) return null;
  
  return (
    <>
      {/* Cercle extérieur - Distance maximale */}
      <Circle
        center={[lat, lon]}
        radius={maxRangeMeters}
        pathOptions={{
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.05,
          weight: 2,
          dashArray: '10, 5'
        }}
      >
        <Popup>
          <div style={{ minWidth: '200px' }}>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
              🛫 Distance maximale
            </h4>
            <p style={sx.text.sm}>
              <strong>{Math.round(maxRangeNM)} NM</strong> ({Math.round(maxRangeNM * 1.852)} km)
            </p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              Aller simple - Autonomie {enduranceHours.toFixed(1)}h
            </p>
          </div>
        </Popup>
      </Circle>
      
      {/* Cercle intérieur - Rayon aller-retour */}
      <Circle
        center={[lat, lon]}
        radius={roundTripRangeMeters}
        pathOptions={{
          color: '#10b981',
          fillColor: '#10b981',
          fillOpacity: 0.1,
          weight: 3
        }}
      >
        <Popup>
          <div style={{ minWidth: '200px' }}>
            <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
              🔄 Rayon aller-retour
            </h4>
            <p style={sx.text.sm}>
              <strong>{Math.round(roundTripRangeNM)} NM</strong> ({Math.round(roundTripRangeNM * 1.852)} km)
            </p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              Avec marge de sécurité 10%
            </p>
          </div>
        </Popup>
      </Circle>
    </>
  );
});

export const NavigationMap = memo(({ waypoints, onWaypointUpdate, selectedAircraft, vfrPoints = {} }) => {
  const [mapReady, setMapReady] = useState(false);
  const [zoomWarning, setZoomWarning] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [mapKey, setMapKey] = useState(Date.now());
  const mapRef = useRef(null);
  
  const { fobFuel, fuelData } = useFuel();
  
  // Clé API OpenAIP
  const openAIPToken = import.meta.env.VITE_OPENAIP_API_KEY || '2717b9196e8100ee2456e09b82b5b08e';
  
  // Centre par défaut (France)
  const defaultCenter = [46.603354, 1.888334];
  const defaultZoom = 6;

  // Calcul du centre initial
  const initialCenter = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length === 0) {
      return defaultCenter;
    }
    if (validWaypoints.length === 1) {
      return [validWaypoints[0].lat, validWaypoints[0].lon];
    }
    const bounds = L.latLngBounds(validWaypoints.map(w => [w.lat, w.lon]));
    const center = bounds.getCenter();
    return [center.lat, center.lng];
  }, []); // Calcul uniquement à l'initialisation

  // Créer la route entre les waypoints
  const route = useMemo(() => {
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    return validWaypoints.length > 1 ? validWaypoints.map(w => [w.lat, w.lon]) : [];
  }, [waypoints]);

  // Calcul de la distance totale
  const totalDistance = useMemo(() => {
    let distance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      distance += L.latLng(route[i]).distanceTo(L.latLng(route[i + 1]));
    }
    return (distance / 1852).toFixed(1);
  }, [route]);

  // Configuration des cartes OpenAIP
  const openAIPLayerUrl = `https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${openAIPToken}`;
  const openAIPAirspaceUrl = `https://api.tiles.openaip.net/api/data/airspaces/{z}/{x}/{y}.png?apiKey=${openAIPToken}`;
  const openAIPAirportUrl = `https://api.tiles.openaip.net/api/data/airports/{z}/{x}/{y}.png?apiKey=${openAIPToken}`;

  // Fonction pour réinitialiser la carte
  const resetMap = () => {
    console.log('🔄 Réinitialisation de la carte');
    setMapKey(Date.now());
    setMapReady(false);
    setTimeout(() => setMapReady(true), 100);
  };

  useEffect(() => {
    console.log('🗺️ NavigationMap monté');
    console.log('📍 Centre initial:', initialCenter);
    console.log('✈️ Waypoints valides:', waypoints.filter(w => w.lat && w.lon).length);
  }, [initialCenter, waypoints]);

  return (
    <div style={styles.mapContainer}>
      {/* Avertissement pour les distances importantes */}
      {zoomWarning && (
        <div style={styles.zoomWarning}>
          <AlertTriangle size={16} />
          <span style={{ marginLeft: '8px' }}>
            Distance importante détectée. Utilisez le sélecteur de couches en haut à droite si nécessaire.
          </span>
        </div>
      )}
      
      {/* Bouton de réinitialisation */}
      {mapReady && (
        <button
          onClick={resetMap}
          style={styles.resetButton}
          title="Réinitialiser la carte si elle ne s'affiche plus correctement"
        >
          <RefreshCw size={14} />
          Réinitialiser
        </button>
      )}
      
      <MapContainer
        key={mapKey}
        ref={mapRef}
        center={initialCenter}
        zoom={defaultZoom}
        minZoom={3}
        maxZoom={15}
        style={styles.map}
        whenReady={() => {
          console.log('✅ Carte prête');
          setMapReady(true);
          if (mapRef.current) {
            setTimeout(() => {
              try {
                mapRef.current.invalidateSize();
              } catch (error) {
                console.warn('Erreur lors du redimensionnement:', error);
              }
            }, 100);
          }
        }}
        zoomControl={false}
      >
        <ZoomControl position="topright" />
        
        {/* Composant pour gérer les changements de vue */}
        <MapViewController waypoints={waypoints} setZoomWarning={setZoomWarning} />
        
        <LayersControl position="topright">
          {/* OpenStreetMap + OpenAIP */}
          <LayersControl.BaseLayer checked name="OpenStreetMap + OpenAIP">
            <LayerGroup>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
              />
              <TileLayer
                url={openAIPLayerUrl}
                attribution='&copy; <a href="https://www.openaip.net">OpenAIP</a>'
                tileSize={256}
                minZoom={4}
                maxZoom={14}
                opacity={0.7}
                errorTileUrl=""
              />
            </LayerGroup>
          </LayersControl.BaseLayer>
          
          {/* OpenStreetMap seul */}
          <LayersControl.BaseLayer name="OpenStreetMap seul">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          
          {/* Carte topographique */}
          <LayersControl.BaseLayer name="Carte Topographique">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
          
          {/* Vue satellite */}
          <LayersControl.BaseLayer name="Vue satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          
          {/* Overlay: Espaces aériens */}
          <LayersControl.Overlay name="Espaces aériens" checked>
            <TileLayer
              url={openAIPAirspaceUrl}
              attribution=""
              tileSize={256}
              minZoom={4}
              maxZoom={14}
              opacity={0.7}
              errorTileUrl=""
            />
          </LayersControl.Overlay>
          
          {/* Overlay: Aérodromes */}
          <LayersControl.Overlay name="Aérodromes" checked>
            <TileLayer
              url={openAIPAirportUrl}
              attribution=""
              tileSize={256}
              minZoom={4}
              maxZoom={14}
              opacity={0.8}
              errorTileUrl=""
            />
          </LayersControl.Overlay>
        </LayersControl>

        {/* Route */}
        {route.length > 1 && (
          <Polyline
            positions={route}
            color="#3b82f6"
            weight={3}
            opacity={0.8}
            dashArray="10, 5"
          />
        )}

        {/* Cercles de rayon d'action */}
        {mapReady && waypoints.length > 0 && waypoints[0].lat && waypoints[0].lon && (
          <RangeCircles 
            center={{ lat: waypoints[0].lat, lon: waypoints[0].lon }} 
            selectedAircraft={selectedAircraft}
            showRange={showRange}
          />
        )}

        {/* Waypoints */}
        {waypoints.map((waypoint, index) => {
          if (!waypoint.lat || !waypoint.lon) return null;

          const icon = index === 0 
            ? WAYPOINT_ICONS.departure 
            : index === waypoints.length - 1 
            ? WAYPOINT_ICONS.arrival 
            : WAYPOINT_ICONS.waypoint;

          return (
            <Marker
              key={waypoint.id}
              position={[waypoint.lat, waypoint.lon]}
              icon={icon}
              draggable={!!onWaypointUpdate}
              eventHandlers={{
                dragend: (e) => {
                  if (onWaypointUpdate) {
                    const newPos = e.target.getLatLng();
                    onWaypointUpdate(waypoint.id, {
                      lat: newPos.lat,
                      lon: newPos.lng
                    });
                  }
                }
              }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                    {waypoint.name || `Point ${index + 1}`}
                  </h4>
                  <div style={sx.text.sm}>
                    <p style={sx.spacing.mb(1)}>
                      <strong>Décimal:</strong><br />
                      Lat: {waypoint.lat.toFixed(4)}°<br />
                      Lon: {waypoint.lon.toFixed(4)}°
                    </p>
                    <p style={sx.spacing.mb(1)}>
                      <strong>DMS:</strong><br />
                      {Conversions.coordinatesToDMS(waypoint.lat, waypoint.lon).lat}<br />
                      {Conversions.coordinatesToDMS(waypoint.lat, waypoint.lon).lon}
                    </p>
                    {waypoint.elevation && (
                      <p>Alt: {waypoint.elevation} ft</p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* Points VFR */}
        {Object.entries(vfrPoints).map(([waypointId, points]) => {
          return points.map(point => {
            if (!point.coordinates || !point.coordinates.lat || !point.coordinates.lon) return null;
            
            return (
              <Marker
                key={point.id}
                position={[point.coordinates.lat, point.coordinates.lon]}
                icon={createVFRIcon(point.code, point.mandatory)}
              >
                <Popup>
                  <div style={{ minWidth: '220px' }}>
                    <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2))}>
                      Point VFR: {point.code}
                    </h4>
                    <div style={sx.text.sm}>
                      <p style={sx.spacing.mb(1)}>
                        <strong>{point.name}</strong><br />
                        {point.description}
                      </p>
                      <p style={sx.spacing.mb(1)}>
                        <span style={{ color: point.mandatory ? '#f59e0b' : '#3b82f6' }}>
                          {point.mandatory ? '⚠️ Obligatoire' : '📍 Optionnel'}
                        </span>
                      </p>
                      <p style={sx.spacing.mb(1)}>
                        <strong>Coordonnées:</strong><br />
                        {point.coordinates.lat.toFixed(4)}°, {point.coordinates.lon.toFixed(4)}°<br />
                        <span style={sx.text.xs}>
                          {Conversions.coordinatesToDMS(point.coordinates.lat, point.coordinates.lon).formatted}
                        </span>
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          });
        })}
      </MapContainer>

      {/* Panneau d'information */}
      {mapReady && route.length > 0 && (
        <div style={styles.infoPanel}>
          <div style={styles.infoPanelContent}>
            <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              <Navigation size={16} style={{ marginRight: '4px' }} />
              Information de vol
            </h4>
            <div style={sx.text.xs}>
              <p>Distance totale : <strong>{totalDistance} NM</strong></p>
              <p>Waypoints : <strong>{waypoints.filter(w => w.lat && w.lon).length}</strong></p>
              {selectedAircraft && (
                <>
                  <p>Temps estimé : <strong>{(totalDistance / selectedAircraft.cruiseSpeedKt).toFixed(1)} h</strong></p>
                  <p>Carburant : <strong>{(totalDistance / selectedAircraft.cruiseSpeedKt * selectedAircraft.fuelConsumption).toFixed(1)} L</strong></p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Panneau de contrôle du rayon d'action */}
      {selectedAircraft && waypoints.length > 0 && waypoints[0].lat && waypoints[0].lon && (
        <div style={styles.rangePanel}>
          <div style={styles.rangePanelContent}>
            <button
              onClick={() => {
                console.log('🔘 Bouton rayon cliqué, état actuel:', showRange, '-> nouveau:', !showRange);
                setShowRange(!showRange);
              }}
              style={sx.combine(
                sx.components.button.base,
                showRange ? sx.components.button.primary : sx.components.button.secondary,
                { width: '100%', fontSize: '13px', padding: '8px 12px' }
              )}
            >
              <Fuel size={16} />
              {showRange ? 'Masquer rayon' : 'Afficher rayon'}
            </button>
            
            {showRange && (
              <div style={sx.combine(sx.spacing.mt(2), sx.text.xs)}>
                {(!fobFuel || !fuelData || !fuelData.finalReserve) ? (
                  <div style={{ color: '#f59e0b', marginTop: '4px' }}>
                    <p style={sx.text.bold}>⚠️ Configuration requise</p>
                    <p style={{ marginTop: '4px' }}>
                      Veuillez d'abord configurer le bilan carburant dans l'onglet "Bilan Carburant"
                    </p>
                  </div>
                ) : (
                  <>
                    <p style={sx.text.secondary}>Carburant utilisable :</p>
                    <p style={sx.text.bold}>
                      {(fobFuel.ltr - fuelData.finalReserve.ltr).toFixed(1)} L
                    </p>
                    {(() => {
                      const usableFuel = fobFuel.ltr - fuelData.finalReserve.ltr;
                      
                      if (usableFuel <= 0) {
                        return (
                          <p style={{ color: '#dc2626', marginTop: '4px' }}>
                            ⚠️ Insuffisant
                          </p>
                        );
                      }
                      const endurance = usableFuel / selectedAircraft.fuelConsumption;
                      const maxRange = endurance * selectedAircraft.cruiseSpeedKt;
                      const roundTripRange = (maxRange / 2) * 0.9;
                      
                      return (
                        <>
                          <p style={sx.combine(sx.spacing.mt(1))}>
                            <span style={{ color: '#3b82f6' }}>🔵</span> Max: {Math.round(maxRange)} NM
                          </p>
                          <p>
                            <span style={{ color: '#10b981' }}>🟢</span> A/R: {Math.round(roundTripRange)} NM
                          </p>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Légende des couches */}
      <div style={styles.legendPanel}>
        <div style={styles.legendContent}>
          <h5 style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>
            Légende OpenAIP
          </h5>
          <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
            <p>🔵 CTR/TMA</p>
            <p>🟡 Zone réglementée</p>
            <p>🔴 Zone dangereuse</p>
            <p>✈️ Aérodrome</p>
          </div>
          {Object.keys(vfrPoints).length > 0 && (
            <>
              <h5 style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mt(2), sx.spacing.mb(1))}>
                Points VFR
              </h5>
              <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
                <p>🟠 Point obligatoire</p>
                <p>🔵 Point optionnel</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

const styles = {
  mapContainer: {
    position: 'relative',
    width: '100%',
    height: '600px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb'
  },
  map: {
    width: '100%',
    height: '100%'
  },
  zoomWarning: {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '8px 16px',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    maxWidth: '80%'
  },
  resetButton: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 1000,
    backgroundColor: 'white',
    border: '2px solid #e5e7eb',
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  infoPanel: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 400
  },
  infoPanelContent: {
    padding: '12px 16px'
  },
  rangePanel: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 400,
    width: '200px'
  },
  rangePanelContent: {
    padding: '12px'
  },
  legendPanel: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    zIndex: 400
  },
  legendContent: {
    padding: '12px 16px'
  }
};

NavigationMap.displayName = 'NavigationMap';
RangeCircles.displayName = 'RangeCircles';

export default NavigationMap;