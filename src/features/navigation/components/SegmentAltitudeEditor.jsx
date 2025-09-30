/**
 * Composant pour éditer l'altitude de chaque segment de navigation
 */

import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Plane } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const SegmentAltitudeEditor = ({ 
  waypoints = [], 
  segmentAltitudes = {},
  onAltitudeChange,
  defaultAltitude = 3000 
}) => {
  const [expandedSegments, setExpandedSegments] = useState({});
  const [localAltitudes, setLocalAltitudes] = useState({});

  // Initialiser les altitudes locales
  useEffect(() => {
    const initAltitudes = {};
    waypoints.forEach((wp, index) => {
      if (index < waypoints.length - 1) {
        const segmentId = `${wp.id}-${waypoints[index + 1].id}`;
        initAltitudes[segmentId] = segmentAltitudes[segmentId] || {
          startAlt: defaultAltitude,
          endAlt: defaultAltitude,
          type: 'level' // level, climb, descent
        };
      }
    });
    
    // Only update if there's an actual change to prevent infinite loop
    const hasChanged = JSON.stringify(initAltitudes) !== JSON.stringify(localAltitudes);
    if (hasChanged) {
      setLocalAltitudes(initAltitudes);
    }
  }, [waypoints.map(w => w.id).join(','), defaultAltitude]); // Use stable dependency

  const toggleSegment = (segmentId) => {
    setExpandedSegments(prev => ({
      ...prev,
      [segmentId]: !prev[segmentId]
    }));
  };

  const handleAltitudeUpdate = (segmentId, field, value) => {
    const newAltitudes = {
      ...localAltitudes,
      [segmentId]: {
        ...localAltitudes[segmentId],
        [field]: value
      }
    };

    // Déterminer automatiquement le type de segment
    const segment = newAltitudes[segmentId];
    if (segment.startAlt < segment.endAlt) {
      segment.type = 'climb';
    } else if (segment.startAlt > segment.endAlt) {
      segment.type = 'descent';
    } else {
      segment.type = 'level';
    }

    setLocalAltitudes(newAltitudes);
    
    if (onAltitudeChange) {
      onAltitudeChange(segmentId, newAltitudes[segmentId]);
    }
  };

  const getSegmentIcon = (type) => {
    switch (type) {
      case 'climb':
        return <TrendingUp size={16} color="#10b981" />;
      case 'descent':
        return <TrendingDown size={16} color="#f59e0b" />;
      default:
        return <Plane size={16} color="#3b82f6" />;
    }
  };

  const formatAltitude = (alt) => {
    if (alt >= 18000) {
      return `FL${Math.floor(alt / 100).toString().padStart(3, '0')}`;
    }
    return `${alt} ft`;
  };

  const getAltitudeSuggestions = (index, isVFR = true) => {
    const suggestions = [];
    
    if (isVFR) {
      // Règles VFR semi-circulaires
      suggestions.push(
        { value: 2500, label: "2500 ft - VFR bas" },
        { value: 3500, label: "3500 ft - VFR Est (0-179°)" },
        { value: 4500, label: "4500 ft - VFR Ouest (180-359°)" },
        { value: 5500, label: "5500 ft - VFR Est" },
        { value: 6500, label: "6500 ft - VFR Ouest" }
      );
    } else {
      // Règles IFR
      suggestions.push(
        { value: 3000, label: "FL030 - IFR Ouest" },
        { value: 4000, label: "FL040 - IFR Est" },
        { value: 5000, label: "FL050 - IFR Ouest" },
        { value: 6000, label: "FL060 - IFR Est" }
      );
    }
    
    return suggestions;
  };

  if (waypoints.length < 2) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
        <p>Ajoutez au moins 2 waypoints pour configurer les altitudes par segment</p>
      </div>
    );
  }

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(3))}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
        ⛰️ Altitudes par segment
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {waypoints.slice(0, -1).map((waypoint, index) => {
          const nextWaypoint = waypoints[index + 1];
          const segmentId = `${waypoint.id}-${nextWaypoint.id}`;
          const segmentAlt = localAltitudes[segmentId] || { 
            startAlt: defaultAltitude, 
            endAlt: defaultAltitude, 
            type: 'level' 
          };
          const isExpanded = expandedSegments[segmentId];

          return (
            <div 
              key={segmentId}
              style={{
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden'
              }}
            >
              {/* En-tête du segment */}
              <div 
                style={{
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: isExpanded ? '#f3f4f6' : 'transparent'
                }}
                onClick={() => toggleSegment(segmentId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getSegmentIcon(segmentAlt.type)}
                  <span style={{ fontWeight: '600' }}>
                    {waypoint.name || `WP${index + 1}`} → {nextWaypoint.name || `WP${index + 2}`}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    fontSize: '13px', 
                    color: '#6b7280',
                    padding: '4px 8px',
                    background: 'white',
                    borderRadius: '4px'
                  }}>
                    {formatAltitude(segmentAlt.startAlt)} → {formatAltitude(segmentAlt.endAlt)}
                  </span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Éditeur d'altitude (expandable) */}
              {isExpanded && (
                <div style={{ 
                  padding: '16px', 
                  borderTop: '1px solid #e5e7eb',
                  background: 'white' 
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Altitude de départ */}
                    <div>
                      <label style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1))}>
                        Altitude au départ de {waypoint.name || `WP${index + 1}`}
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          value={segmentAlt.startAlt}
                          onChange={(e) => handleAltitudeUpdate(segmentId, 'startAlt', parseInt(e.target.value) || 0)}
                          min="0"
                          max="45000"
                          step="500"
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                        <select
                          onChange={(e) => handleAltitudeUpdate(segmentId, 'startAlt', parseInt(e.target.value))}
                          style={{
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            background: 'white'
                          }}
                        >
                          <option value="">Suggestions...</option>
                          {getAltitudeSuggestions(index).map(sugg => (
                            <option key={sugg.value} value={sugg.value}>
                              {sugg.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Altitude d'arrivée */}
                    <div>
                      <label style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(1))}>
                        Altitude à l'arrivée sur {nextWaypoint.name || `WP${index + 2}`}
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          value={segmentAlt.endAlt}
                          onChange={(e) => handleAltitudeUpdate(segmentId, 'endAlt', parseInt(e.target.value) || 0)}
                          min="0"
                          max="45000"
                          step="500"
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                        />
                        <select
                          onChange={(e) => handleAltitudeUpdate(segmentId, 'endAlt', parseInt(e.target.value))}
                          style={{
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '13px',
                            background: 'white'
                          }}
                        >
                          <option value="">Suggestions...</option>
                          {getAltitudeSuggestions(index).map(sugg => (
                            <option key={sugg.value} value={sugg.value}>
                              {sugg.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Informations sur le changement d'altitude */}
                  {segmentAlt.type !== 'level' && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px',
                      background: segmentAlt.type === 'climb' ? '#f0fdf4' : '#fef3c7',
                      border: `1px solid ${segmentAlt.type === 'climb' ? '#86efac' : '#fde047'}`,
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}>
                      {segmentAlt.type === 'climb' ? '📈' : '📉'} 
                      {' '}
                      {segmentAlt.type === 'climb' ? 'Montée' : 'Descente'} de{' '}
                      <strong>{Math.abs(segmentAlt.endAlt - segmentAlt.startAlt)} ft</strong>
                      {' '}sur ce segment
                    </div>
                  )}

                  {/* Boutons rapides */}
                  <div style={{ 
                    marginTop: '12px', 
                    display: 'flex', 
                    gap: '8px',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={() => {
                        handleAltitudeUpdate(segmentId, 'startAlt', segmentAlt.endAlt);
                      }}
                      style={{
                        padding: '6px 12px',
                        background: '#e5e7eb',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Niveler (même altitude)
                    </button>
                    
                    {index > 0 && (
                      <button
                        onClick={() => {
                          const prevSegmentId = `${waypoints[index - 1].id}-${waypoint.id}`;
                          const prevAlt = localAltitudes[prevSegmentId]?.endAlt || defaultAltitude;
                          handleAltitudeUpdate(segmentId, 'startAlt', prevAlt);
                        }}
                        style={{
                          padding: '6px 12px',
                          background: '#dbeafe',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Continuer depuis segment précédent
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Résumé du profil de vol */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        background: '#f0f9ff',
        border: '1px solid #bfdbfe',
        borderRadius: '6px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
          📊 Profil de vol
        </h4>
        <div style={{ fontSize: '13px', color: '#1e40af' }}>
          Altitude min: <strong>{Math.min(...Object.values(localAltitudes).flatMap(a => [a.startAlt, a.endAlt]))} ft</strong>
          {' | '}
          Altitude max: <strong>{Math.max(...Object.values(localAltitudes).flatMap(a => [a.startAlt, a.endAlt]))} ft</strong>
        </div>
      </div>
    </div>
  );
};