/**
 * Composant pour insérer des points VFR dans la navigation
 * Permet la réutilisation des mêmes points (ex: STS pour LFST)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Plus, Navigation2, Search, X } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { geoJSONDataService } from '../services/GeoJSONDataService';
import { useCustomVFRStore } from '@core/stores/customVFRStore';

// PAS DE POINTS PRÉDÉFINIS - Uniquement les données SIA/AIXM locales

export const VFRPointInserter = ({ 
  waypoints = [],
  onInsertWaypoint,
  insertPosition = null // Position où insérer le point (null = avant dernier)
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availablePoints, setAvailablePoints] = useState([]);
  const [loadedVFRPoints, setLoadedVFRPoints] = useState([]);
  
  const { customVFRPoints } = useCustomVFRStore();

  // Charger les points VFR depuis le service
  useEffect(() => {
    const loadVFRPoints = async () => {
      try {
        const vfrPoints = await geoJSONDataService.getAllVFRPoints();
        setLoadedVFRPoints(vfrPoints);
        console.log(`Loaded ${vfrPoints.length} VFR points from service`);
      } catch (error) {
        console.error('Error loading VFR points:', error);
      }
    };
    loadVFRPoints();
  }, []);

  // Identifier les aérodromes présents dans la navigation
  const airportsInRoute = useMemo(() => {
    const airports = new Set();
    waypoints.forEach(wp => {
      // Vérifier plusieurs façons d'identifier un aérodrome
      if (wp.type === 'airport') {
        // Priorité : icaoCode, puis name si c'est un code OACI
        if (wp.icaoCode) {
          airports.add(wp.icaoCode);
        } else if (wp.name && wp.name.match(/^[A-Z]{4}$/)) {
          // Code OACI standard (4 lettres majuscules)
          airports.add(wp.name);
        }
      } else if (wp.name && wp.name.match(/^LF[A-Z]{2}$/)) {
        // Aérodrome français même sans type='airport'
        airports.add(wp.name);
      }
    });
    
    // Debug pour voir ce qui est détecté
    if (airports.size > 0) {
      console.log('🛩️ Aérodromes détectés dans la navigation:', Array.from(airports));
    }
    
    return airports;
  }, [waypoints]);

  // Organiser les points VFR par catégorie
  const organizedPoints = useMemo(() => {
    const result = {
      custom: [],        // Points personnalisés
      routeVFR: [],     // Points VFR des aérodromes de la route
      otherVFR: []      // Autres points VFR
    };
    const addedIds = new Set();
    
    // 1. Points personnalisés créés par l'utilisateur
    customVFRPoints.forEach(p => {
      if (!addedIds.has(p.id)) {
        result.custom.push({
          ...p,
          source: 'custom',
          displayName: p.name,
          searchName: `${p.name} ${p.description || ''} custom personnalisé`.toLowerCase()
        });
        addedIds.add(p.id);
      }
    });
    
    // 2. Points VFR chargés depuis les fichiers SIA locaux (AIXM)
    loadedVFRPoints.forEach(feature => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      if (coords && coords.length === 2) {
        const pointId = props.identification || props.name || `vfr-${coords[0]}-${coords[1]}`;
        const pointCode = props.identification || props.name || '';
        
        // Filtrer pour ne garder que les vrais points VFR
        // Exclure les points avec des codes simples d'une lettre (N, S, E, W) qui sont souvent IFR
        const isRealVFR = (
          (props.description && (
            props.description.includes('VRP') ||
            props.description.includes('VFR') ||
            props.description.includes('visual') ||
            props.description.includes('Visual')
          )) ||
          (props.type === 'VRP') ||
          (pointCode.length >= 2 && !pointCode.match(/^[NSEW]$/)) // Au moins 2 caractères et pas juste N/S/E/W
        );
        
        if (!addedIds.has(pointId) && isRealVFR) {
          const point = {
            id: pointId,
            code: pointCode,
            name: props.name || props.identification,
            description: props.description || props.txtRmk || '',
            lat: coords[1],
            lon: coords[0],
            source: 'sia',
            airportIcao: props.aerodrome,
            displayName: `${props.name || props.identification}`,
            searchName: `${props.aerodrome || ''} ${props.name || ''} ${props.identification || ''} ${props.description || ''}`.toLowerCase()
          };
          
          // N'ajouter que les points VFR des aérodromes présents dans la navigation
          if (props.aerodrome && airportsInRoute.has(props.aerodrome)) {
            point.displayName = `${props.aerodrome} - ${point.displayName}`;
            result.routeVFR.push(point);
          }
          // Ignorer tous les autres points (autres aérodromes ou sans aérodrome)
          
          addedIds.add(pointId);
        }
      }
    });
    
    return result;
  }, [customVFRPoints, loadedVFRPoints, airportsInRoute]);

  // Filtrer les points selon la recherche
  const filteredPoints = useMemo(() => {
    const result = {
      custom: [],
      routeVFR: []
    };
    
    const term = searchTerm.toLowerCase();
    
    // Filtrer les points personnalisés
    result.custom = organizedPoints.custom.filter(p => 
      !term || p.searchName.includes(term) ||
      p.code?.toLowerCase().includes(term)
    );
    
    // Filtrer les points VFR de la route
    result.routeVFR = organizedPoints.routeVFR.filter(p => 
      !term || p.searchName.includes(term) ||
      p.code?.toLowerCase().includes(term) ||
      p.airportIcao?.toLowerCase().includes(term)
    );
    
    return result;
  }, [organizedPoints, searchTerm]);

  // Fonction pour insérer un point VFR
  const handleInsertPoint = (point) => {
    const newWaypoint = {
      id: `vfr-${Date.now()}`,
      name: point.code || point.name,
      lat: point.lat,
      lon: point.lon,
      type: 'vfr-point',
      vfrPointId: point.id,
      description: point.description,
      displayName: point.displayName,
      airportRef: point.airportIcao
    };

    // Déterminer la position d'insertion
    let position = insertPosition;
    if (position === null) {
      // Par défaut, insérer avant le dernier waypoint (arrivée)
      position = Math.max(0, waypoints.length - 1);
    }
    
    onInsertWaypoint(newWaypoint, position);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Bouton pour ouvrir le sélecteur */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={sx.combine(
          sx.components.button.base,
          sx.components.button.secondary,
          {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '13px'
          }
        )}
        title="Ajouter un point VFR"
      >
        <Navigation2 size={14} />
        Ajouter un point VFR
      </button>

      {/* Popup de sélection */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '8px',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          padding: '12px',
          minWidth: '300px',
          maxWidth: '400px',
          zIndex: 1000
        }}>
          {/* En-tête avec recherche */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '12px',
            gap: '8px'
          }}>
            <div style={{ 
              flex: 1,
              position: 'relative'
            }}>
              <Search size={14} style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher (ex: STS, LFST)..."
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 28px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}
                autoFocus
              />
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                padding: '4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Liste des points organisés par catégorie */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {filteredPoints.custom.length === 0 && filteredPoints.routeVFR.length === 0 ? (
              <p style={{
                padding: '12px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px'
              }}>
                {airportsInRoute.size === 0 
                  ? "Ajoutez d'abord des aérodromes à votre navigation pour voir leurs points VFR"
                  : "Aucun point VFR trouvé pour les aérodromes de votre route"}
              </p>
            ) : (
              <>
                {/* Points VFR personnalisés */}
                {filteredPoints.custom.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#92400e',
                      marginBottom: '6px',
                      padding: '4px 8px',
                      background: '#fef3c7',
                      borderRadius: '4px',
                      display: 'inline-block'
                    }}>
                      📝 Points personnalisés
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filteredPoints.custom.map(point => (
                        <div
                          key={`${point.id}-${Math.random()}`}
                          onClick={() => handleInsertPoint(point)}
                          style={{
                            padding: '8px',
                            background: '#fffbeb',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: '1px solid #fde68a'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fef3c7';
                            e.currentTarget.style.borderColor = '#fbbf24';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fffbeb';
                            e.currentTarget.style.borderColor = '#fde68a';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>
                                {point.displayName}
                              </div>
                              {point.description && (
                                <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '2px' }}>
                                  {point.description}
                                </div>
                              )}
                              <div style={{ fontSize: '10px', color: '#b45309' }}>
                                📍 {point.lat?.toFixed(4)}°, {point.lon?.toFixed(4)}°
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Points VFR de la navigation */}
                {filteredPoints.routeVFR.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#1e40af',
                      marginBottom: '6px',
                      padding: '4px 8px',
                      background: '#dbeafe',
                      borderRadius: '4px',
                      display: 'inline-block'
                    }}>
                      ✈️ Points VFR des aérodromes de la route
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filteredPoints.routeVFR.map(point => (
                        <div
                          key={`${point.id}-${Math.random()}`}
                          onClick={() => handleInsertPoint(point)}
                          style={{
                            padding: '8px',
                            background: '#f0f9ff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: '1px solid #bfdbfe'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#dbeafe';
                            e.currentTarget.style.borderColor = '#60a5fa';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.borderColor = '#bfdbfe';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>
                                {point.displayName}
                              </div>
                              {point.description && (
                                <div style={{ fontSize: '11px', color: '#1e40af', marginBottom: '2px' }}>
                                  {point.description}
                                </div>
                              )}
                              <div style={{ fontSize: '10px', color: '#3b82f6' }}>
                                📍 {point.lat?.toFixed(4)}°, {point.lon?.toFixed(4)}°
                              </div>
                            </div>
                            {point.airportIcao && (
                              <div style={{
                                padding: '2px 6px',
                                background: '#e0f2fe',
                                color: '#0c4a6e',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600',
                                marginLeft: '8px'
                              }}>
                                {point.airportIcao}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Info */}
          <div style={{
            marginTop: '12px',
            padding: '8px',
            background: '#f0f9ff',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#0369a1'
          }}>
            💡 Affichage limité aux points VFR des aérodromes présents dans votre navigation. Les points peuvent être réutilisés.
          </div>
        </div>
      )}
    </div>
  );
};

export default VFRPointInserter;