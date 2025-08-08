import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Radio, ChevronDown, ChevronUp, Plane, AlertTriangle, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { openAIPService } from '@services/openAIPService';
import { calculateDistance } from '@utils/navigationCalculations';

// Types d'espaces aériens avec leurs caractéristiques
const AIRSPACE_TYPES = {
  'CTR': {
    name: 'Control Zone',
    color: '#dc2626',
    priority: 1,
    description: 'Zone de contrôle d\'aérodrome'
  },
  'TMA': {
    name: 'Terminal Control Area',
    color: '#f59e0b',
    priority: 2,
    description: 'Zone de contrôle terminale'
  },
  'ATZ': {
    name: 'Aerodrome Traffic Zone',
    color: '#3b82f6',
    priority: 3,
    description: 'Zone de circulation d\'aérodrome'
  },
  'D': {
    name: 'Zone Dangereuse',
    color: '#ef4444',
    priority: 4,
    description: 'Zone dangereuse'
  },
  'P': {
    name: 'Zone Interdite',
    color: '#991b1b',
    priority: 1,
    description: 'Zone interdite (Prohibited)'
  },
  'R': {
    name: 'Zone Réglementée',
    color: '#f97316',
    priority: 3,
    description: 'Zone réglementée (Restricted)'
  },
  'TSA': {
    name: 'Zone Temporaire',
    color: '#8b5cf6',
    priority: 5,
    description: 'Zone temporairement ségrégée'
  },
  'TRA': {
    name: 'Zone d\'Entraînement',
    color: '#6366f1',
    priority: 5,
    description: 'Zone temporaire réservée aux activités'
  },
  'OTHER': {
    name: 'Autre',
    color: '#6b7280',
    priority: 6,
    description: 'Autre type d\'espace'
  }
};

// Fonction pour convertir les altitudes
const convertAltitude = (altitude, unit, reference) => {
  if (!altitude || altitude === 0) return 'SFC';
  
  // Conversion en pieds si nécessaire
  let altFeet = altitude;
  if (unit === 'M') {
    altFeet = Math.round(altitude * 3.28084);
  }
  
  // Format selon la référence
  if (reference === 'STD') {
    return `FL${Math.round(altFeet / 100).toString().padStart(3, '0')}`;
  } else {
    return `${altFeet} ft ${reference || 'AMSL'}`;
  }
};

// Fonction pour déterminer si un waypoint traverse un espace aérien
const isWaypointInAirspace = (waypoint, airspace) => {
  if (!waypoint.lat || !waypoint.lon || !airspace.geometry) return false;
  
  // Pour simplifier, on vérifie si le waypoint est dans la bounding box
  // En production, il faudrait utiliser un algorithme point-in-polygon plus sophistiqué
  const bounds = airspace.geometry.coordinates[0];
  if (!bounds || bounds.length === 0) return false;
  
  const lats = bounds.map(coord => coord[1]);
  const lons = bounds.map(coord => coord[0]);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  
  return waypoint.lat >= minLat && waypoint.lat <= maxLat &&
         waypoint.lon >= minLon && waypoint.lon <= maxLon;
};

// Fonction pour obtenir les espaces traversés entre deux waypoints
const getAirspacesBetweenWaypoints = (waypoint1, waypoint2, airspaces) => {
  const traversed = [];
  
  // Vérifier chaque espace aérien
  airspaces.forEach(airspace => {
    // Simplification : on vérifie si la ligne traverse la bounding box
    if (isWaypointInAirspace(waypoint1, airspace) || 
        isWaypointInAirspace(waypoint2, airspace)) {
      traversed.push(airspace);
    }
  });
  
  return traversed;
};

export const AirspaceAnalyzer = ({ waypoints, plannedAltitude, onAltitudeChange, flightTypeRules, altitudeSuggestions }) => {
  const [airspaces, setAirspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedAirspace, setExpandedAirspace] = useState(null);

  // Charger les espaces aériens
  useEffect(() => {
    const loadAirspaces = async () => {
      if (!waypoints || waypoints.length === 0) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const validWaypoints = waypoints.filter(w => w.lat && w.lon);
        if (validWaypoints.length === 0) return;
        
        // Calculer la bounding box de la route
        const lats = validWaypoints.map(w => w.lat);
        const lons = validWaypoints.map(w => w.lon);
        
        const bounds = {
          minLat: Math.min(...lats) - 0.5, // Marge de 0.5°
          maxLat: Math.max(...lats) + 0.5,
          minLon: Math.min(...lons) - 0.5,
          maxLon: Math.max(...lons) + 0.5
        };
        
        console.log('📍 Chargement des espaces aériens pour la France');
        
        // Appeler le service OpenAIP avec le code pays
        const result = await openAIPService.getAirspaces('FR');
        
        if (result && Array.isArray(result)) {
          setAirspaces(result);
          console.log(`✅ ${result.length} espaces aériens chargés`);
        } else {
          setAirspaces([]);
        }
      } catch (err) {
        console.error('❌ Erreur chargement espaces aériens:', err);
        setError('Impossible de charger les espaces aériens');
        setAirspaces([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadAirspaces();
  }, [waypoints]);

  // Analyser les espaces traversés
  const traversedAirspaces = useMemo(() => {
    if (!waypoints || waypoints.length < 2 || airspaces.length === 0) return [];
    
    const traversed = new Map();
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    
    // Analyser chaque segment de route
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const segmentAirspaces = getAirspacesBetweenWaypoints(
        validWaypoints[i], 
        validWaypoints[i + 1], 
        airspaces
      );
      
      segmentAirspaces.forEach(airspace => {
        if (!traversed.has(airspace._id)) {
          traversed.set(airspace._id, {
            ...airspace,
            segments: []
          });
        }
        traversed.get(airspace._id).segments.push({
          from: validWaypoints[i].name || `Point ${i + 1}`,
          to: validWaypoints[i + 1].name || `Point ${i + 2}`
        });
      });
    }
    
    // Trier par priorité et altitude plancher
    return Array.from(traversed.values()).sort((a, b) => {
      const typeA = AIRSPACE_TYPES[a.type] || AIRSPACE_TYPES.OTHER;
      const typeB = AIRSPACE_TYPES[b.type] || AIRSPACE_TYPES.OTHER;
      
      if (typeA.priority !== typeB.priority) {
        return typeA.priority - typeB.priority;
      }
      
      return (a.lowerLimit?.value || 0) - (b.lowerLimit?.value || 0);
    });
  }, [waypoints, airspaces]);

  // Vérifier les conflits d'altitude
  const checkAltitudeConflict = (airspace) => {
    if (!plannedAltitude) return null;
    
    const lowerAlt = airspace.lowerLimit?.value || 0;
    const upperAlt = airspace.upperLimit?.value || 99999;
    
    // Convertir en pieds si nécessaire
    let lowerFeet = lowerAlt;
    let upperFeet = upperAlt;
    
    if (airspace.lowerLimit?.unit === 'M') {
      lowerFeet = lowerAlt * 3.28084;
    }
    if (airspace.upperLimit?.unit === 'M') {
      upperFeet = upperAlt * 3.28084;
    }
    
    // Convertir FL en pieds
    if (airspace.lowerLimit?.referenceDatum === 'STD') {
      lowerFeet = lowerAlt * 100;
    }
    if (airspace.upperLimit?.referenceDatum === 'STD') {
      upperFeet = upperAlt * 100;
    }
    
    if (plannedAltitude >= lowerFeet && plannedAltitude <= upperFeet) {
      return 'inside';
    } else if (plannedAltitude < lowerFeet && (lowerFeet - plannedAltitude) < 1000) {
      return 'below-close';
    } else if (plannedAltitude > upperFeet && (plannedAltitude - upperFeet) < 1000) {
      return 'above-close';
    }
    
    return null;
  };

  const toggleAirspace = (airspaceId) => {
    setExpandedAirspace(expandedAirspace === airspaceId ? null : airspaceId);
  };

  if (loading) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
        <div style={sx.combine(sx.flex.center, sx.spacing.p(4))}>
          <div className="animate-spin">⏳</div>
          <span style={sx.spacing.ml(2)}>Chargement des espaces aériens...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
        <Radio size={20} style={{ display: 'inline', marginRight: '8px' }} />
        Analyse des espaces aériens
      </h4>

      {/* Altitude planifiée */}
      <div style={sx.spacing.mb(4)}>
        <label style={sx.components.label.base}>
          <Plane size={14} /> Altitude planifiée (ft)
        </label>
        <div style={sx.combine(sx.flex.row, sx.spacing.gap(2))}>
          <input 
            type="number" 
            value={plannedAltitude}
            onChange={(e) => onAltitudeChange(e.target.value)}
            style={sx.combine(sx.components.input.base, { flex: 1 })}
            placeholder="3000"
          />
          <select
            value={plannedAltitude}
            onChange={(e) => onAltitudeChange(e.target.value)}
            style={sx.combine(sx.components.input.base, { flex: 2 })}
          >
            <option value="">Suggestions d'altitude</option>
            {altitudeSuggestions.map(suggestion => (
              <option key={suggestion.altitude} value={suggestion.altitude}>
                {suggestion.altitude} ft - {suggestion.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Message si aucun espace traversé */}
      {traversedAirspaces.length === 0 && !error && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
          <Info size={16} />
          <p style={sx.text.sm}>
            {airspaces.length === 0 
              ? "Aucun espace aérien chargé pour cette zone"
              : "Aucun espace aérien traversé sur cette route"}
          </p>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
          <AlertCircle size={16} />
          <p style={sx.text.sm}>{error}</p>
        </div>
      )}

      {/* Liste des espaces traversés */}
      {traversedAirspaces.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {traversedAirspaces.map(airspace => {
            const typeInfo = AIRSPACE_TYPES[airspace.type] || AIRSPACE_TYPES.OTHER;
            const conflict = checkAltitudeConflict(airspace);
            const isExpanded = expandedAirspace === airspace._id;
            
            return (
              <div 
                key={airspace._id}
                style={sx.combine(
                  sx.components.card.base,
                  sx.spacing.p(3),
                  {
                    borderLeft: `4px solid ${typeInfo.color}`,
                    backgroundColor: conflict === 'inside' ? '#fef2f2' : 'white'
                  }
                )}
              >
                {/* En-tête */}
                <div 
                  style={sx.combine(sx.flex.between, sx.spacing.mb(2), { cursor: 'pointer' })}
                  onClick={() => toggleAirspace(airspace._id)}
                >
                  <div style={sx.flex.row}>
                    <div>
                      <h5 style={sx.combine(sx.text.base, sx.text.bold)}>
                        {airspace.name || `${typeInfo.name} sans nom`}
                      </h5>
                      <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                        {typeInfo.description} • {airspace.icaoCode || 'Code OACI non défini'}
                      </p>
                    </div>
                    {conflict === 'inside' && (
                      <div style={sx.spacing.ml(3)}>
                        <AlertTriangle size={16} color="#dc2626" />
                      </div>
                    )}
                  </div>
                  <div style={sx.flex.center}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Altitudes */}
                <div style={sx.combine(sx.text.sm, sx.spacing.mb(2))}>
                  <strong>Limites verticales:</strong>{' '}
                  {convertAltitude(
                    airspace.lowerLimit?.value,
                    airspace.lowerLimit?.unit,
                    airspace.lowerLimit?.referenceDatum
                  )}{' - '}
                  {convertAltitude(
                    airspace.upperLimit?.value,
                    airspace.upperLimit?.unit,
                    airspace.upperLimit?.referenceDatum
                  )}
                </div>

                {/* Alerte altitude */}
                {conflict && (
                  <div style={sx.combine(
                    sx.components.alert.base,
                    conflict === 'inside' ? sx.components.alert.danger : sx.components.alert.warning,
                    sx.spacing.mb(2)
                  )}>
                    <AlertCircle size={14} />
                    <p style={sx.text.xs}>
                      {conflict === 'inside' && 'Altitude planifiée DANS cet espace aérien'}
                      {conflict === 'below-close' && 'Altitude planifiée proche du plancher'}
                      {conflict === 'above-close' && 'Altitude planifiée proche du plafond'}
                    </p>
                  </div>
                )}

                {/* Détails étendus */}
                {isExpanded && (
                  <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
                    {/* Fréquences */}
                    {airspace.frequencies && airspace.frequencies.length > 0 && (
                      <div style={sx.spacing.mb(3)}>
                        <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
                          📻 Fréquences
                        </h6>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {airspace.frequencies.map((freq, idx) => (
                            <div key={idx} style={sx.text.xs}>
                              <strong>{freq.name || 'Fréquence'}:</strong> {freq.value} MHz
                              {freq.type && ` (${freq.type})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Classe d'espace */}
                    {airspace.class && (
                      <div style={sx.spacing.mb(2)}>
                        <strong style={sx.text.sm}>Classe:</strong>{' '}
                        <span style={sx.text.sm}>{airspace.class}</span>
                      </div>
                    )}

                    {/* Segments traversés */}
                    {airspace.segments && airspace.segments.length > 0 && (
                      <div style={sx.spacing.mb(2)}>
                        <strong style={sx.text.sm}>Segments traversés:</strong>
                        <ul style={sx.combine(sx.text.xs, sx.spacing.mt(1), sx.spacing.ml(4))}>
                          {airspace.segments.map((segment, idx) => (
                            <li key={idx}>{segment.from} → {segment.to}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Remarques */}
                    {airspace.remarks && (
                      <div>
                        <strong style={sx.text.sm}>Remarques:</strong>{' '}
                        <span style={sx.combine(sx.text.xs, sx.text.secondary)}>
                          {airspace.remarks}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Résumé */}
      {traversedAirspaces.length > 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(4))}>
          <Info size={16} />
          <div style={sx.text.sm}>
            <p><strong>{traversedAirspaces.length} espaces aériens</strong> traversés</p>
            {traversedAirspaces.filter(a => checkAltitudeConflict(a) === 'inside').length > 0 && (
              <p style={sx.spacing.mt(1)}>
                ⚠️ {traversedAirspaces.filter(a => checkAltitudeConflict(a) === 'inside').length} conflit(s) 
                d'altitude détecté(s)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AirspaceAnalyzer;