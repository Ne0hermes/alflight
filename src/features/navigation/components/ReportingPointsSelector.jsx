// src/features/navigation/components/ReportingPointsSelector.jsx
import React, { memo, useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, AlertTriangle, CheckCircle, Navigation } from 'lucide-react';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { sx } from '@shared/styles/styleSystem';

export const ReportingPointsSelector = memo(({ 
  airportIcao, 
  selectedPoints = [], 
  onPointsChange,
  maxPoints = 5
}) => {
  const reportingPoints = openAIPSelectors.useReportingPoints(airportIcao);
  const { coordinateValidation } = useOpenAIPStore();
  const [expandedPoint, setExpandedPoint] = useState(null);
  
  // Grouper les points par direction
  const groupedPoints = React.useMemo(() => {
    const groups = {
      'N': [], 'NE': [], 'E': [], 'SE': [],
      'S': [], 'SW': [], 'W': [], 'NW': [],
      'OTHER': []
    };
    
    reportingPoints.forEach(point => {
      const group = groups[point.code] ? point.code : 'OTHER';
      groups[group].push(point);
    });
    
    // Retirer les groupes vides
    return Object.entries(groups).filter(([, points]) => points.length > 0);
  }, [reportingPoints]);
  
  const handleAddPoint = (point) => {
    if (selectedPoints.length >= maxPoints) {
      alert(`Maximum ${maxPoints} points de report autorisés`);
      return;
    }
    
    if (!selectedPoints.find(p => p.id === point.id)) {
      onPointsChange([...selectedPoints, point]);
    }
  };
  
  const handleRemovePoint = (pointId) => {
    onPointsChange(selectedPoints.filter(p => p.id !== pointId));
  };
  
  const getPointValidation = (point) => {
    const key = `${airportIcao}_${point.code}`;
    return coordinateValidation[key];
  };
  
  if (!airportIcao) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
        <Info size={16} />
        <p style={sx.text.sm}>
          Sélectionnez d'abord un aérodrome pour voir les points de report VFR disponibles
        </p>
      </div>
    );
  }
  
  if (reportingPoints.length === 0) {
    return (
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={16} />
        <p style={sx.text.sm}>
          Aucun point de report VFR trouvé pour {airportIcao}
        </p>
      </div>
    );
  }
  
  return (
    <div>
      <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
        <Navigation size={16} style={{ marginRight: '8px' }} />
        Points de report VFR - {airportIcao}
      </h4>
      
      {/* Points sélectionnés */}
      {selectedPoints.length > 0 && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Points sélectionnés ({selectedPoints.length}/{maxPoints})
          </h5>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedPoints.map((point, index) => {
              const validation = getPointValidation(point);
              
              return (
                <div 
                  key={point.id}
                  style={sx.combine(
                    styles.selectedPoint,
                    validation && !validation.isValid && styles.selectedPointWarning
                  )}
                >
                  <div style={styles.pointInfo}>
                    <span style={sx.text.bold}>
                      {index + 1}. {point.code}
                    </span>
                    <span style={sx.text.sm}> - {point.name}</span>
                    <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
                      {point.coordinates.lat.toFixed(6)}°, {point.coordinates.lon.toFixed(6)}°
                    </div>
                  </div>
                  
                  <div style={styles.pointActions}>
                    {validation && (
                      <span title={validation.isValid ? 'Coordonnées cohérentes' : `Écart: ${validation.distance.toFixed(0)}m`}>
                        {validation.isValid ? '✅' : '❗'}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemovePoint(point.id)}
                      style={styles.removeButton}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Points disponibles groupés */}
      <div style={sx.components.card.base}>
        <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(3))}>
          Points disponibles
        </h5>
        
        <div style={styles.pointGroups}>
          {groupedPoints.map(([direction, points]) => (
            <PointGroup
              key={direction}
              direction={direction}
              points={points}
              selectedPoints={selectedPoints}
              onAddPoint={handleAddPoint}
              getPointValidation={getPointValidation}
              expandedPoint={expandedPoint}
              setExpandedPoint={setExpandedPoint}
            />
          ))}
        </div>
      </div>
      
      {/* Légende */}
      <div style={sx.combine(sx.spacing.mt(3), sx.text.xs, sx.text.secondary)}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>✅ Coordonnées vérifiées avec VAC</span>
          <span>❗ Divergence avec VAC</span>
          <span>❓ VAC non disponible</span>
        </div>
      </div>
    </div>
  );
});

// Composant pour un groupe de points
const PointGroup = memo(({ 
  direction, 
  points, 
  selectedPoints, 
  onAddPoint, 
  getPointValidation,
  expandedPoint,
  setExpandedPoint
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div style={styles.pointGroup}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={styles.groupHeader}
      >
        <span style={sx.text.bold}>
          {getDirectionLabel(direction)} ({points.length})
        </span>
        <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▶
        </span>
      </button>
      
      {isExpanded && (
        <div style={styles.pointList}>
          {points.map(point => {
            const isSelected = selectedPoints.find(p => p.id === point.id);
            const validation = getPointValidation(point);
            const isExpanded = expandedPoint === point.id;
            
            return (
              <div key={point.id}>
                <div style={sx.combine(
                  styles.pointItem,
                  isSelected && styles.pointItemSelected
                )}>
                  <div 
                    style={styles.pointMain}
                    onClick={() => setExpandedPoint(isExpanded ? null : point.id)}
                  >
                    <div>
                      <strong>{point.code}</strong> - {point.name}
                      {point.elevation && (
                        <span style={sx.combine(sx.text.xs, sx.text.secondary)}>
                          {' '}• {point.elevation} ft
                        </span>
                      )}
                    </div>
                    
                    <div style={styles.pointItemActions}>
                      {validation ? (
                        <span title={validation.isValid ? 'Cohérent' : `Écart: ${validation.distance.toFixed(0)}m`}>
                          {validation.isValid ? '✅' : '❗'}
                        </span>
                      ) : (
                        <span title="VAC non disponible">❓</span>
                      )}
                      
                      {!isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddPoint(point);
                          }}
                          style={styles.addButton}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Détails étendus */}
                  {isExpanded && (
                    <div style={styles.pointDetails}>
                      <div style={sx.text.xs}>
                        <p><strong>Coordonnées:</strong> {point.coordinates.lat.toFixed(6)}°, {point.coordinates.lon.toFixed(6)}°</p>
                        {point.description && <p><strong>Description:</strong> {point.description}</p>}
                        
                        {validation && !validation.isValid && (
                          <div style={sx.combine(sx.spacing.mt(2), { color: '#dc2626' })}>
                            <strong>⚠️ Divergence détectée:</strong>
                            <p>OpenAIP: {validation.openAipCoords.lat.toFixed(6)}°, {validation.openAipCoords.lon.toFixed(6)}°</p>
                            <p>VAC: {validation.vacCoords.lat.toFixed(6)}°, {validation.vacCoords.lon.toFixed(6)}°</p>
                            <p>Écart: {validation.distance.toFixed(0)}m</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// Helper pour les labels de direction
const getDirectionLabel = (direction) => {
  const labels = {
    'N': 'Nord',
    'NE': 'Nord-Est',
    'E': 'Est',
    'SE': 'Sud-Est',
    'S': 'Sud',
    'SW': 'Sud-Ouest',
    'W': 'Ouest',
    'NW': 'Nord-Ouest',
    'OTHER': 'Autres'
  };
  return labels[direction] || direction;
};

// Styles
const styles = {
  selectedPoint: {
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  selectedPointWarning: {
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24'
  },
  pointInfo: {
    flex: 1
  },
  pointActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  removeButton: {
    padding: '4px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  pointGroups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  pointGroup: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  groupHeader: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#f9fafb',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#f3f4f6'
    }
  },
  pointList: {
    padding: '8px'
  },
  pointItem: {
    marginBottom: '4px',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s'
  },
  pointItemSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6'
  },
  pointMain: {
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    '&:hover': {
      backgroundColor: '#f9fafb'
    }
  },
  pointItemActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  addButton: {
    padding: '4px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  pointDetails: {
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #e5e7eb'
  }
};

ReportingPointsSelector.displayName = 'ReportingPointsSelector';
PointGroup.displayName = 'PointGroup';

export default ReportingPointsSelector;