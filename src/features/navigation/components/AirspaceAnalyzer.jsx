// src/features/navigation/components/AirspaceAnalyzer.jsx
import React, { memo, useMemo, useState } from 'react';
import { Radio, Plane, AlertTriangle, ArrowRight, Layers, Navigation, ChevronDown, ChevronRight, Shield, Clock, Gauge } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { FRENCH_AIRSPACES } from '@data/frenchAirspaces';

// Fonction pour calculer si un point est dans un espace aérien circulaire
const isPointInAirspace = (point, airspace) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (airspace.center.lat - point.lat) * Math.PI / 180;
  const dLon = (airspace.center.lon - point.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point.lat * Math.PI / 180) * Math.cos(airspace.center.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance <= airspace.radius;
};

// Fonction pour interpoler des points le long d'une route
const interpolateRoute = (start, end, numPoints = 50) => {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const ratio = i / numPoints;
    points.push({
      lat: start.lat + (end.lat - start.lat) * ratio,
      lon: start.lon + (end.lon - start.lon) * ratio,
      distance: i / numPoints * calculateDistance(start, end)
    });
  }
  return points;
};

// Calcul de distance
const calculateDistance = (point1, point2) => {
  const R = 3440.065; // Rayon en NM
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lon - point1.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const AirspaceAnalyzer = memo(({ waypoints, plannedAltitude = 3000, onAltitudeChange, flightTypeRules, altitudeSuggestions = [] }) => {
  const [expandedSections, setExpandedSections] = useState({
    timeline: true,
    frequencies: true,
    summary: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Analyser les espaces traversés
  const airspaceAnalysis = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return null;
    
    const validWaypoints = waypoints.filter(w => w.lat && w.lon);
    if (validWaypoints.length < 2) return null;
    
    const segments = [];
    const traversedAirspaces = new Map();
    
    // Analyser chaque segment de route
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const start = validWaypoints[i];
      const end = validWaypoints[i + 1];
      const routePoints = interpolateRoute(start, end);
      
      // Vérifier chaque point contre tous les espaces aériens
      routePoints.forEach(point => {
        // Vérifier les CTR
        FRENCH_AIRSPACES.CTR.forEach(ctr => {
          if (isPointInAirspace(point, ctr)) {
            if (!traversedAirspaces.has(ctr.id)) {
              traversedAirspaces.set(ctr.id, {
                ...ctr,
                entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
              });
            }
          }
        });
        
        // Vérifier les TMA
        FRENCH_AIRSPACES.TMA.forEach(tma => {
          if (isPointInAirspace(point, tma)) {
            if (!traversedAirspaces.has(tma.id)) {
              traversedAirspaces.set(tma.id, {
                ...tma,
                entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
              });
            }
          }
        });
        
        // Vérifier les zones réglementées
        FRENCH_AIRSPACES.RESTRICTED.forEach(zone => {
          if (isPointInAirspace(point, zone)) {
            if (!traversedAirspaces.has(zone.id)) {
              traversedAirspaces.set(zone.id, {
                ...zone,
                entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
              });
            }
          }
        });
        
        // Vérifier les SIV (zones d'information de vol spéciales)
        if (FRENCH_AIRSPACES.SIV) {
          FRENCH_AIRSPACES.SIV.forEach(siv => {
            if (isPointInAirspace(point, siv)) {
              if (!traversedAirspaces.has(siv.id)) {
                traversedAirspaces.set(siv.id, {
                  ...siv,
                  entryDistance: point.distance + (i > 0 ? calculateDistance(validWaypoints[0], start) : 0)
                });
              }
            }
          });
        }
      });
      
      segments.push({
        from: start,
        to: end,
        distance: calculateDistance(start, end)
      });
    }
    
    // Trier les espaces par ordre de traversée
    const sortedAirspaces = Array.from(traversedAirspaces.values())
      .sort((a, b) => a.entryDistance - b.entryDistance);
    
    // Calculer la distance totale
    const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
    
    return {
      segments,
      airspaces: sortedAirspaces,
      totalDistance,
      departure: validWaypoints[0],
      arrival: validWaypoints[validWaypoints.length - 1]
    };
  }, [waypoints]);
  
  // Fonction pour convertir l'altitude en pieds
  const parseAltitude = (altitudeStr) => {
    if (!altitudeStr) return 0;
    
    // FL (Flight Level)
    if (altitudeStr.startsWith('FL')) {
      return parseInt(altitudeStr.substring(2)) * 100;
    }
    
    // Altitude en pieds
    const match = altitudeStr.match(/(\d+)\s*ft/i);
    if (match) {
      return parseInt(match[1]);
    }
    
    // SFC (Surface)
    if (altitudeStr === 'SFC' || altitudeStr === 'GND') {
      return 0;
    }
    
    // AMSL (Above Mean Sea Level) - supposer pieds
    if (altitudeStr.includes('AMSL')) {
      return parseInt(altitudeStr.replace(/\D/g, ''));
    }
    
    return parseInt(altitudeStr) || 0;
  };
  
  // Vérifier les conflits d'altitude
  const checkAltitudeConflicts = (airspace) => {
    const floor = parseAltitude(airspace.floor);
    const ceiling = parseAltitude(airspace.ceiling);
    
    if (plannedAltitude >= floor && plannedAltitude <= ceiling) {
      return {
        hasConflict: true,
        message: `Vol prévu à ${plannedAltitude}ft dans l'espace (${airspace.floor} → ${airspace.ceiling})`,
        severity: airspace.type === 'R' || airspace.type === 'P' ? 'danger' : 'warning'
      };
    }
    
    if (plannedAltitude > ceiling) {
      return {
        hasConflict: false,
        message: `Vol au-dessus de l'espace (plafond: ${airspace.ceiling})`,
        severity: 'info'
      };
    }
    
    if (plannedAltitude < floor) {
      return {
        hasConflict: false,
        message: `Vol en-dessous de l'espace (plancher: ${airspace.floor})`,
        severity: 'info'
      };
    }
    
    return { hasConflict: false };
  };
  
  if (!airspaceAnalysis || airspaceAnalysis.airspaces.length === 0) {
    return (
      <div>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          <Layers size={16} style={{ marginRight: '8px' }} />
          Analyse des espaces aériens
        </h4>
        
        {/* Configuration du vol */}
        {onAltitudeChange && (
          <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
              <Gauge size={14} style={{ marginRight: '6px' }} />
              Configuration du vol
            </h5>
            
            <label style={sx.components.label.base}>
              ⬆️ Altitude de vol prévue
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={plannedAltitude === 0 ? '' : plannedAltitude}
                onChange={(e) => {
                  const value = e.target.value;
                  const numValue = parseInt(value);
                  if (!isNaN(numValue) && numValue >= 0 && numValue <= 45000) {
                    onAltitudeChange(numValue);
                  } else if (value === '') {
                    onAltitudeChange(0);
                  }
                }}
                placeholder="0"
                style={sx.combine(sx.components.input.base, { width: '150px' })}
              />
              <span style={sx.text.sm}>pieds (ft)</span>
              <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
                ≈ FL{Math.round(plannedAltitude / 100)}
              </span>
            </div>
            
            {/* Suggestions d'altitude */}
            {altitudeSuggestions && altitudeSuggestions.length > 0 && (
              <div style={sx.combine(sx.spacing.mt(2), sx.text.xs, sx.text.secondary)}>
                <strong>Suggestions {flightTypeRules || 'VFR'} :</strong>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {altitudeSuggestions.map(suggestion => (
                    <button
                      key={suggestion.altitude}
                      onClick={() => onAltitudeChange(suggestion.altitude)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: plannedAltitude === suggestion.altitude ? '#3b82f6' : '#e5e7eb',
                        color: plannedAltitude === suggestion.altitude ? 'white' : '#374151',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        transition: 'all 0.2s'
                      }}
                      title={suggestion.description}
                    >
                      {suggestion.altitude} ft
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
          <Navigation size={16} />
          <p style={sx.text.sm}>
            Aucun espace aérien contrôlé détecté sur cette route.
            Vol en espace G (non contrôlé) - Fréquence auto-info recommandée.
          </p>
        </div>
      </div>
    );
  }
  
  // Vérifier s'il y a des conflits d'altitude
  const altitudeConflicts = airspaceAnalysis.airspaces
    .map(airspace => ({
      airspace,
      conflict: checkAltitudeConflicts(airspace)
    }))
    .filter(item => item.conflict.hasConflict);
  
  // Statistiques pour le résumé
  const stats = {
    totalAirspaces: airspaceAnalysis.airspaces.length,
    ctrCount: airspaceAnalysis.airspaces.filter(a => a.type === 'CTR').length,
    tmaCount: airspaceAnalysis.airspaces.filter(a => a.type === 'TMA').length,
    restrictedCount: airspaceAnalysis.airspaces.filter(a => a.type === 'R' || a.type === 'P').length,
    conflicts: altitudeConflicts.length
  };
  
  return (
    <div>
      <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(4))}>
        <Layers size={16} style={{ marginRight: '8px' }} />
        Analyse des espaces aériens
      </h4>
      
      {/* Configuration du vol */}
      {onAltitudeChange && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4), { backgroundColor: '#f8fafc' })}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
            <Gauge size={14} style={{ marginRight: '6px' }} />
            Configuration du vol
          </h5>
          
          <label style={sx.components.label.base}>
            ⬆️ Altitude de vol prévue
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={plannedAltitude === 0 ? '' : plannedAltitude}
              onChange={(e) => {
                const value = e.target.value;
                const numValue = parseInt(value);
                if (!isNaN(numValue) && numValue >= 0 && numValue <= 45000) {
                  onAltitudeChange(numValue);
                } else if (value === '') {
                  onAltitudeChange(0);
                }
              }}
              placeholder="0"
              style={sx.combine(sx.components.input.base, { width: '150px' })}
            />
            <span style={sx.text.sm}>pieds (ft)</span>
            <span style={sx.combine(sx.text.sm, sx.text.secondary)}>
              ≈ FL{Math.round(plannedAltitude / 100)}
            </span>
          </div>
          
          {/* Suggestions d'altitude */}
          {altitudeSuggestions && altitudeSuggestions.length > 0 && (
            <div style={sx.combine(sx.spacing.mt(2), sx.text.xs, sx.text.secondary)}>
              <strong>Suggestions {flightTypeRules || 'VFR'} :</strong>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {altitudeSuggestions.map(suggestion => (
                  <button
                    key={suggestion.altitude}
                    onClick={() => onAltitudeChange(suggestion.altitude)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: plannedAltitude === suggestion.altitude ? '#3b82f6' : '#e5e7eb',
                      color: plannedAltitude === suggestion.altitude ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      transition: 'all 0.2s'
                    }}
                    title={suggestion.description}
                  >
                    {suggestion.altitude} ft
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Vue d'ensemble */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
        <div 
          style={styles.sectionHeader}
          onClick={() => toggleSection('summary')}
        >
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, { display: 'flex', alignItems: 'center' })}>
            {expandedSections.summary ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Shield size={14} style={{ marginLeft: '8px', marginRight: '6px' }} />
            Vue d'ensemble
          </h5>
          {altitudeConflicts.length > 0 && (
            <span style={styles.conflictBadge}>
              {altitudeConflicts.length} conflit{altitudeConflicts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {expandedSections.summary && (
          <div style={{ marginTop: '16px' }}>
            {/* Statistiques */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
              <div style={styles.statCard}>
                <div style={sx.text.xs}>Distance totale</div>
                <div style={sx.combine(sx.text.lg, sx.text.bold)}>{airspaceAnalysis.totalDistance.toFixed(1)} NM</div>
              </div>
              <div style={styles.statCard}>
                <div style={sx.text.xs}>Espaces traversés</div>
                <div style={sx.combine(sx.text.lg, sx.text.bold)}>{stats.totalAirspaces}</div>
              </div>
              <div style={styles.statCard}>
                <div style={sx.text.xs}>CTR/TMA</div>
                <div style={sx.combine(sx.text.lg, sx.text.bold)}>{stats.ctrCount + stats.tmaCount}</div>
              </div>
              <div style={styles.statCard}>
                <div style={sx.text.xs}>Zones R/P</div>
                <div style={sx.combine(sx.text.lg, sx.text.bold, stats.restrictedCount > 0 && { color: '#f59e0b' })}>
                  {stats.restrictedCount}
                </div>
              </div>
            </div>
            
            {/* Avertissements d'altitude */}
            {altitudeConflicts.length > 0 && (
              <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger)}>
                <AlertTriangle size={16} />
                <div>
                  <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                    ⚠️ Conflits d'altitude détectés !
                  </p>
                  <ul style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
                    {altitudeConflicts.map(({ airspace, conflict }) => (
                      <li key={airspace.id} style={sx.spacing.mb(1)}>
                        <strong>{airspace.name}</strong>: {conflict.message}
                        {(airspace.type === 'R' || airspace.type === 'P') && (
                          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>
                            {' '}(Zone {airspace.type === 'R' ? 'réglementée' : 'interdite'} - Autorisation requise)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Timeline de vol */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
        <div 
          style={styles.sectionHeader}
          onClick={() => toggleSection('timeline')}
        >
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, { display: 'flex', alignItems: 'center' })}>
            {expandedSections.timeline ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Clock size={14} style={{ marginLeft: '8px', marginRight: '6px' }} />
            Séquence de vol
          </h5>
        </div>
        
        {expandedSections.timeline && (
          <div style={styles.timeline}>
            {/* Départ */}
            <div style={styles.timelineItem}>
              <div style={styles.timelineIcon}>
                <Plane size={16} style={{ color: '#10b981' }} />
              </div>
              <div style={styles.timelineContent}>
                <div style={sx.text.bold}>Départ : {airspaceAnalysis.departure.name}</div>
                <div style={sx.text.sm}>0 NM</div>
              </div>
            </div>
            
            {/* Espaces traversés */}
            {airspaceAnalysis.airspaces.map((airspace, index) => (
              <div key={airspace.id}>
                {/* Indicateur de distance */}
                <div style={styles.distanceIndicator}>
                  <ArrowRight size={14} />
                  <span style={sx.text.xs}>
                    {airspace.entryDistance.toFixed(1)} NM
                  </span>
                </div>
                
                <div style={styles.timelineItem}>
                  <div style={sx.combine(
                    styles.timelineIcon,
                    airspace.type === 'R' || airspace.type === 'P' 
                      ? { backgroundColor: '#fef3c7' }
                      : airspace.type === 'CTR'
                      ? { backgroundColor: '#dbeafe' }
                      : airspace.type === 'TMA'
                      ? { backgroundColor: '#e0e7ff' }
                      : airspace.type === 'SIV'
                      ? { backgroundColor: '#dcfce7' }
                      : { backgroundColor: '#f3f4f6' }
                  )}>
                    {airspace.type === 'CTR' && <Radio size={16} style={{ color: '#2563eb' }} />}
                    {airspace.type === 'TMA' && <Layers size={16} style={{ color: '#4f46e5' }} />}
                    {(airspace.type === 'R' || airspace.type === 'P') && 
                      <AlertTriangle size={16} style={{ color: '#f59e0b' }} />}
                    {airspace.type === 'SIV' && <Navigation size={16} style={{ color: '#16a34a' }} />}
                    {airspace.type === 'FIR' && <Plane size={16} style={{ color: '#6b7280' }} />}
                  </div>
                  
                  <div style={styles.airspaceCard}>
                    <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                      <div>
                        <div style={sx.text.bold}>{airspace.name}</div>
                        <div style={sx.combine(sx.text.sm, sx.text.secondary)}>
                          {airspace.unit}
                        </div>
                      </div>
                      <div style={styles.typeTag(airspace.type)}>
                        {airspace.type}
                      </div>
                    </div>
                    
                    {/* Indicateur d'altitude */}
                    {(() => {
                      const altCheck = checkAltitudeConflicts(airspace);
                      return (
                        <div style={sx.combine(
                          styles.altitudeIndicator,
                          altCheck.hasConflict ? styles.altitudeConflict : styles.altitudeOk
                        )}>
                          <Plane size={12} />
                          <span style={sx.text.xs}>
                            {altCheck.message || `Compatible avec ${plannedAltitude}ft`}
                          </span>
                        </div>
                      );
                    })()}
                    
                    {/* Informations rapides */}
                    <div style={styles.quickInfo}>
                      <div style={styles.quickInfoItem}>
                        <Radio size={12} />
                        <span>{airspace.frequency} MHz</span>
                      </div>
                      <div style={styles.quickInfoItem}>
                        <Layers size={12} />
                        <span>{airspace.floor} → {airspace.ceiling}</span>
                      </div>
                    </div>
                    
                    {/* Alertes spéciales */}
                    {(airspace.type === 'R' || airspace.type === 'P') && (
                      <div style={sx.combine(
                        sx.components.alert.base, 
                        sx.components.alert.warning,
                        sx.spacing.mt(2),
                        { padding: '8px 12px' }
                      )}>
                        <AlertTriangle size={12} />
                        <p style={{ fontSize: '11px' }}>
                          Zone {airspace.type === 'R' ? 'réglementée' : 'interdite'} - 
                          {airspace.type === 'R' ? ' Contournement ou autorisation requise' : ' Contournement obligatoire'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Arrivée */}
            <div style={styles.distanceIndicator}>
              <ArrowRight size={14} />
              <span style={sx.text.xs}>
                {airspaceAnalysis.totalDistance.toFixed(1)} NM
              </span>
            </div>
            
            <div style={styles.timelineItem}>
              <div style={styles.timelineIcon}>
                <Plane size={16} style={{ color: '#f59e0b' }} />
              </div>
              <div style={styles.timelineContent}>
                <div style={sx.text.bold}>Arrivée : {airspaceAnalysis.arrival.name}</div>
                <div style={sx.text.sm}>{airspaceAnalysis.totalDistance.toFixed(1)} NM</div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Séquence radio */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
        <div 
          style={styles.sectionHeader}
          onClick={() => toggleSection('frequencies')}
        >
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, { display: 'flex', alignItems: 'center' })}>
            {expandedSections.frequencies ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <Radio size={14} style={{ marginLeft: '8px', marginRight: '6px' }} />
            Séquence radio recommandée
          </h5>
        </div>
        
        {expandedSections.frequencies && (
          <div style={styles.frequencyList}>
            {airspaceAnalysis.airspaces.map((airspace, index) => (
              <div key={airspace.id} style={styles.frequencyItem}>
                <span style={sx.combine(sx.text.bold, { minWidth: '20px' })}>{index + 1}.</span>
                <span style={{ flex: 1 }}>{airspace.unit}</span>
                <span style={sx.combine(sx.text.bold, { color: '#2563eb' })}>
                  {airspace.frequency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

const styles = {
  sectionHeader: {
    cursor: 'pointer',
    padding: '4px',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 0.2s',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: '#f3f4f6'
    }
  },
  conflictBadge: {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600'
  },
  statCard: {
    backgroundColor: '#f8fafc',
    padding: '12px',
    borderRadius: '6px',
    textAlign: 'center'
  },
  timeline: {
    position: 'relative',
    paddingLeft: '40px',
    marginTop: '16px'
  },
  timelineItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '20px'
  },
  timelineIcon: {
    position: 'absolute',
    left: '-40px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  timelineContent: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #e5e7eb'
  },
  airspaceCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  distanceIndicator: {
    position: 'relative',
    left: '-24px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#6b7280',
    margin: '8px 0',
    fontSize: '12px'
  },
  quickInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginTop: '12px'
  },
  quickInfoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#6b7280'
  },
  altitudeIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '11px'
  },
  altitudeConflict: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    border: '1px solid #fbbf24'
  },
  altitudeOk: {
    backgroundColor: '#dcfce7',
    color: '#14532d',
    border: '1px solid #86efac'
  },
  typeTag: (type) => ({
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 
      type === 'CTR' ? '#dbeafe' :
      type === 'TMA' ? '#e0e7ff' :
      type === 'R' || type === 'P' ? '#fef3c7' :
      type === 'SIV' ? '#dcfce7' :
      type === 'FIR' ? '#f3f4f6' :
      '#f3f4f6',
    color:
      type === 'CTR' ? '#1e40af' :
      type === 'TMA' ? '#4338ca' :
      type === 'R' || type === 'P' ? '#92400e' :
      type === 'SIV' ? '#14532d' :
      type === 'FIR' ? '#374151' :
      '#374151'
  }),
  frequencyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '16px'
  },
  frequencyItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    fontSize: '14px',
    borderLeft: '3px solid #3b82f6'
  }
};

AirspaceAnalyzer.displayName = 'AirspaceAnalyzer';

export default AirspaceAnalyzer;