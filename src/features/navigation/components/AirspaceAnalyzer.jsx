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

// Fonction pour convertir les altitudes pour l'affichage
const convertAltitude = (altitude, unit, reference) => {
  if (!altitude || altitude === 0) return 'SFC';
  
  // Si c'est déjà un FL
  if (unit === 'FL' || reference === 'STD') {
    return `FL${altitude.toString().padStart(3, '0')}`;
  }
  
  // Conversion en pieds si nécessaire
  let altFeet = altitude;
  if (unit === 'M') {
    altFeet = Math.round(altitude * 3.28084);
  }
  
  // Retourner avec l'unité appropriée
  return `${altFeet} ft ${reference || 'AMSL'}`;
};

// Fonction pour déterminer si un waypoint traverse un espace aérien
const isWaypointInAirspace = (waypoint, airspace) => {
  if (!waypoint.lat || !waypoint.lon || !airspace.geometry) return false;
  
  // Gérer les différents types de géométrie
  let coordinates;
  try {
    if (airspace.geometry.type === 'Polygon') {
      coordinates = airspace.geometry.coordinates[0];
    } else if (airspace.geometry.type === 'MultiPolygon') {
      // Pour MultiPolygon, vérifier tous les polygones
      for (const polygon of airspace.geometry.coordinates) {
        const coords = polygon[0];
        if (isPointInPolygon(waypoint, coords)) {
          return true;
        }
      }
      return false;
    } else {
      console.warn('Type de géométrie non supporté:', airspace.geometry.type);
      return false;
    }
    
    return isPointInPolygon(waypoint, coordinates);
  } catch (e) {
    console.warn('Erreur lors de la vérification de l\'espace aérien:', e);
    return false;
  }
};

// Fonction helper pour vérifier si un point est dans un polygone (ray casting algorithm)
const isPointInPolygon = (point, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  
  let inside = false;
  const x = point.lon;
  const y = point.lat;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]; // longitude
    const yi = polygon[i][1]; // latitude
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) &&
                     (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
};

// Fonction helper pour vérifier si un point est dans les limites (bounding box)
const isPointInBounds = (waypoint, coordinates) => {
  if (!coordinates || coordinates.length === 0) return false;
  
  // Utiliser l'algorithme de ray casting pour une détection précise
  return isPointInPolygon(waypoint, coordinates);
};

// Fonction pour vérifier si un segment traverse un polygone
const doesSegmentIntersectPolygon = (p1, p2, polygon) => {
  // Si un des points est dans le polygone, il y a intersection
  if (isPointInPolygon(p1, polygon) || isPointInPolygon(p2, polygon)) {
    return true;
  }
  
  // Vérifier l'intersection avec chaque côté du polygone
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const p3 = { lat: polygon[i][1], lon: polygon[i][0] };
    const p4 = { lat: polygon[j][1], lon: polygon[j][0] };
    
    if (doSegmentsIntersect(p1, p2, p3, p4)) {
      return true;
    }
  }
  
  return false;
};

// Fonction helper pour vérifier si deux segments s'intersectent
const doSegmentsIntersect = (p1, p2, p3, p4) => {
  const ccw = (A, B, C) => {
    return (C.lat - A.lat) * (B.lon - A.lon) > (B.lat - A.lat) * (C.lon - A.lon);
  };
  
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
};

// Fonction pour obtenir les espaces traversés entre deux waypoints
const getAirspacesBetweenWaypoints = (waypoint1, waypoint2, airspaces) => {
  const traversed = [];
  
  // Vérifier chaque espace aérien
  airspaces.forEach(airspace => {
    if (!airspace.geometry?.coordinates) return;
    
    try {
      let intersects = false;
      
      if (airspace.geometry.type === 'Polygon') {
        const coords = airspace.geometry.coordinates[0];
        intersects = doesSegmentIntersectPolygon(waypoint1, waypoint2, coords);
      } else if (airspace.geometry.type === 'MultiPolygon') {
        // Pour MultiPolygon, vérifier chaque polygone
        for (const polygon of airspace.geometry.coordinates) {
          if (doesSegmentIntersectPolygon(waypoint1, waypoint2, polygon[0])) {
            intersects = true;
            break;
          }
        }
      }
      
      if (intersects) {
        traversed.push(airspace);
      }
    } catch (e) {
      console.warn('Erreur lors de la vérification de l\'intersection:', e);
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
        
        console.log('📍 Chargement des espaces aériens pour la zone de vol');
        console.log('📐 Bounding box:', bounds);
        
        // Appeler le service OpenAIP avec le code pays
        const result = await openAIPService.getAirspaces('FR');
        
        if (result && Array.isArray(result)) {
          // Filtrer les espaces dans la zone de vol (avec marge)
          const relevantAirspaces = result.filter(airspace => {
            if (!airspace.geometry?.coordinates) return false;
            
            try {
              // Obtenir la bounding box de l'espace aérien
              let coords = [];
              if (airspace.geometry.type === 'Polygon') {
                coords = airspace.geometry.coordinates[0];
              } else if (airspace.geometry.type === 'MultiPolygon') {
                coords = airspace.geometry.coordinates[0][0];
              }
              
              if (coords.length === 0) return false;
              
              const lats = coords.map(c => c[1]);
              const lons = coords.map(c => c[0]);
              const airspaceMinLat = Math.min(...lats);
              const airspaceMaxLat = Math.max(...lats);
              const airspaceMinLon = Math.min(...lons);
              const airspaceMaxLon = Math.max(...lons);
              
              // Vérifier si les bounding boxes s'intersectent
              return !(airspaceMaxLat < bounds.minLat || 
                      airspaceMinLat > bounds.maxLat ||
                      airspaceMaxLon < bounds.minLon ||
                      airspaceMinLon > bounds.maxLon);
            } catch (e) {
              return false;
            }
          });
          
          setAirspaces(relevantAirspaces);
          console.log(`✅ ${relevantAirspaces.length}/${result.length} espaces aériens dans la zone`);
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
    if (!waypoints || waypoints.length < 2 || airspaces.length === 0) {
      console.log('⚠️ Conditions non remplies pour l\'analyse:', {
        waypoints: waypoints?.length || 0,
        airspaces: airspaces.length
      });
      return [];
    }
    
    const traversed = new Map();
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    
    console.log(`🔍 Analyse de ${validWaypoints.length} waypoints sur ${airspaces.length} espaces aériens`);
    
    // Analyser chaque segment de route
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const segmentAirspaces = getAirspacesBetweenWaypoints(
        validWaypoints[i], 
        validWaypoints[i + 1], 
        airspaces
      );
      
      if (segmentAirspaces.length > 0) {
        console.log(`✅ Segment ${i}: ${segmentAirspaces.length} espaces trouvés`);
      }
      
      segmentAirspaces.forEach(airspace => {
        const id = airspace._id || airspace.id || `airspace-${Math.random()}`;
        if (!traversed.has(id)) {
          traversed.set(id, {
            ...airspace,
            segments: []
          });
        }
        traversed.get(id).segments.push({
          from: validWaypoints[i].name || `Point ${i + 1}`,
          to: validWaypoints[i + 1].name || `Point ${i + 2}`
        });
      });
    }
    
    console.log(`📊 Total espaces traversés: ${traversed.size}`);
    
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
    
    // Récupérer les limites verticales
    const lowerLimit = airspace.lowerLimit || airspace.lower_limit || {};
    const upperLimit = airspace.upperLimit || airspace.upper_limit || {};
    
    // Calculer l'altitude plancher en pieds
    let lowerFeet = 0; // Par défaut SFC (surface)
    
    // Vérifier si c'est une valeur spéciale
    if (lowerLimit === 'SFC' || lowerLimit === 'GND' || 
        lowerLimit.value === 0 || lowerLimit.value === null || lowerLimit.value === undefined) {
      lowerFeet = 0;
    } else if (typeof lowerLimit === 'object' && lowerLimit.value !== undefined) {
      lowerFeet = lowerLimit.value;
      
      // Convertir selon l'unité
      const unit = String(lowerLimit.unit || '').toUpperCase();
      const datum = String(lowerLimit.referenceDatum || '').toUpperCase();
      
      if (unit === 'M') {
        // Mètres vers pieds
        lowerFeet = Math.round(lowerFeet * 3.28084);
      } else if (unit === 'FL' || datum === 'STD') {
        // Flight Level - multiplier par 100 pour avoir des pieds
        lowerFeet = lowerFeet * 100;
      }
      // Si unit === 'FT' ou 'F', c'est déjà en pieds
    }
    
    // Calculer l'altitude plafond en pieds
    let upperFeet = 999999; // Par défaut illimité
    
    // Vérifier si c'est une valeur spéciale
    if (upperLimit === 'UNL' || upperLimit === 'UNLIM' || 
        upperLimit.value === 999 || upperLimit.value === 9999 || upperLimit.value === 99999) {
      upperFeet = 999999;
    } else if (typeof upperLimit === 'object' && upperLimit.value !== undefined && upperLimit.value !== null) {
      upperFeet = upperLimit.value;
      
      // Convertir selon l'unité
      const unit = String(upperLimit.unit || '').toUpperCase();
      const datum = String(upperLimit.referenceDatum || '').toUpperCase();
      
      if (unit === 'M') {
        // Mètres vers pieds
        upperFeet = Math.round(upperFeet * 3.28084);
      } else if (unit === 'FL' || datum === 'STD') {
        // Flight Level - multiplier par 100 pour avoir des pieds
        upperFeet = upperFeet * 100;
      }
      // Si unit === 'FT' ou 'F', c'est déjà en pieds
    }
    
    // Vérifier les conflits (avec une altitude planifiée en pieds)
    const altitudeNum = parseInt(plannedAltitude) || 0;
    
    // Ne signaler un conflit que si l'altitude est réellement dans l'espace
    // et que l'espace a des limites définies
    if (lowerFeet === 0 && upperFeet === 999999) {
      // Espace sans limites définies, pas de conflit
      return null;
    }
    
    if (altitudeNum >= lowerFeet && altitudeNum <= upperFeet) {
      return 'inside';
    } else if (altitudeNum < lowerFeet && (lowerFeet - altitudeNum) < 1000) {
      return 'below-close';
    } else if (altitudeNum > upperFeet && (altitudeNum - upperFeet) < 1000) {
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
          {traversedAirspaces.map((airspace, index) => {
            const typeInfo = AIRSPACE_TYPES[airspace.type] || AIRSPACE_TYPES.OTHER;
            const conflict = checkAltitudeConflict(airspace);
            const airspaceId = airspace._id || airspace.id || `airspace-${index}`;
            const isExpanded = expandedAirspace === airspaceId;
            
            return (
              <div 
                key={airspaceId}
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
                  onClick={() => toggleAirspace(airspaceId)}
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