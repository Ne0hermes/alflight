import React, { memo, useState, useEffect, useMemo } from 'react';
import { Trash2, Navigation2, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';
import { useAircraft, useNavigation } from '@core/contexts';
import { SimpleAirportSelector as AirportSelector } from './SimpleAirportSelector';
import { VFRPointInserter } from './VFRPointInserter';
import { Conversions } from '@utils/conversions';

// Composant pour une carte de waypoint avec analyse des pistes intégrée
export const WaypointCardWithRunways = memo(({ 
  waypoint, 
  index, 
  totalWaypoints, 
  onSelect, 
  onRemove, 
  onShowReportingPoints,
  onInsertWaypoint,
  allWaypoints,
  segmentAltitude // Altitude du segment précédent pour le calcul TOD
}) => {
  const { selectedAircraft } = useAircraft();
  const { waypoints, updateWaypoint, segmentAltitudes } = useNavigation();
  const [airport, setAirport] = useState(null);
  const [runways, setRunways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [vacData, setVacData] = useState(null);
  
  const isFirst = index === 0;
  const isLast = index === totalWaypoints - 1;
  const canDelete = totalWaypoints > 2;
  
  // Calcul du TOD pour l'arrivée
  const todCalculation = useMemo(() => {
    if (!isLast) return null;
    
    // Utiliser l'altitude du terrain ou une valeur par défaut
    const terrainElevation = waypoint.elevation || vacData?.elevation || 0;
    
    // Altitude de croisière (depuis le segment ou altitude planifiée par défaut)
    const cruiseAltitude = segmentAltitude?.startAlt || segmentAltitude?.endAlt || 3000;
    
    // Altitude pattern (1000ft au-dessus du terrain, ou 1500ft si aérodrome au niveau de la mer)
    const targetAltitude = terrainElevation + (terrainElevation > 0 ? 1000 : 1500);
    
    const altitudeToDescent = cruiseAltitude - targetAltitude;
    
    // Debug logging
    console.log('TOD Calculation:', {
      isLast,
      terrainElevation,
      cruiseAltitude,
      targetAltitude,
      altitudeToDescent,
      segmentAltitude
    });
    
    // Si pas de descente nécessaire ou données insuffisantes
    if (altitudeToDescent <= 0) {
      return {
        error: true,
        message: altitudeToDescent === 0 ? "Déjà à l'altitude pattern" : "Montée requise pour le pattern",
        cruiseAltitude,
        targetAltitude,
        terrainElevation
      };
    }
    
    // Paramètres standard
    const descentRate = 500; // ft/min (taux standard)
    const groundSpeed = selectedAircraft?.cruiseSpeedKt || 100; // kt
    
    // Calculs
    const descentTimeMinutes = altitudeToDescent / descentRate;
    const groundSpeedNmPerMin = groundSpeed / 60;
    const distanceToTod = descentTimeMinutes * groundSpeedNmPerMin;
    const descentAngle = Math.atan((altitudeToDescent / 6076.12) / distanceToTod) * 180 / Math.PI;
    
    return {
      altitudeToDescent,
      descentTimeMinutes,
      distanceToTod: distanceToTod.toFixed(1),
      descentAngle: descentAngle.toFixed(1),
      targetAltitude,
      cruiseAltitude,
      terrainElevation,
      descentRate,
      groundSpeed,
      error: false
    };
  }, [isLast, waypoint.elevation, vacData?.elevation, segmentAltitude, selectedAircraft]);
  
  const getLabel = () => {
    if (isFirst) return { text: 'Départ', color: '#10b981' };
    if (isLast) return { text: 'Arrivée', color: '#f59e0b' };
    return { text: `Étape ${index}`, color: '#3b82f6' };
  };
  
  const label = getLabel();
  
  // Charger les données VAC de l'aérodrome quand le waypoint change
  useEffect(() => {
    const loadAirportData = async () => {
      if (!waypoint.name || !waypoint.name.match(/^[A-Z]{4}$/)) {
        setAirport(null);
        setRunways([]);
        setVacData(null);
        return;
      }
      
      setLoading(true);
      try {
        // Priorité aux données VAC
        if (window.vacStore) {
          const vacChart = window.vacStore.getState().getChartByIcao(waypoint.name);
          if (vacChart && vacChart.extractedData) {
            setVacData(vacChart.extractedData);
            // Utiliser les pistes depuis VAC si disponibles
            if (vacChart.extractedData.runways) {
              setRunways(vacChart.extractedData.runways);
            }
          }
        }
        
        // Fallback sur les données statiques si pas de VAC
        if (!vacData) {
          const airports = await aeroDataProvider.getAirfields({ country: 'FR' });
          const airportData = airports.find(a => a.icao === waypoint.name || a.icaoCode === waypoint.name);
          
          if (airportData) {
            setAirport(airportData);
            if (!runways.length) {
              setRunways(airportData.runways || []);
            }
          }
        }
      } catch (error) {
        console.error('Erreur chargement aérodrome:', error);
        setAirport(null);
        setRunways([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadAirportData();
  }, [waypoint.name]);
  
  const goToVACModule = () => {
    if (window.setActiveTab) {
      window.setActiveTab('vac');
    }
  };
  
  // Analyser la compatibilité des pistes
  const getRunwayCompatibility = () => {
    if (!selectedAircraft || !runways.length) return null;
    
    const compatibleCount = runways.filter(runway => {
      if (!selectedAircraft.runwayRequirements) return true;
      
      const todaFeet = Math.round((runway.dimensions?.toda || runway.dimensions?.length || 0) * 3.28084);
      const ldaFeet = Math.round((runway.dimensions?.lda || runway.dimensions?.length || 0) * 3.28084);
      
      return todaFeet >= selectedAircraft.runwayRequirements.takeoffDistance &&
             ldaFeet >= selectedAircraft.runwayRequirements.landingDistance;
    }).length;
    
    return { compatible: compatibleCount, total: runways.length };
  };
  
  // Grouper les pistes par orientation
  const groupRunwaysByOrientation = () => {
    const groups = {};
    
    runways.forEach(runway => {
      // Extraire l'orientation de base (sans L/R/C)
      let orientation = '';
      
      if (runway.le_ident && runway.he_ident) {
        // Extraire juste les nombres
        const leNum = parseInt(runway.le_ident.replace(/[LRC]/g, ''));
        const heNum = parseInt(runway.he_ident.replace(/[LRC]/g, ''));
        orientation = `${String(leNum).padStart(2, '0')}/${String(heNum).padStart(2, '0')}`;
      } else if (runway.designator) {
        // Pour les pistes avec designator complet
        const parts = runway.designator.split('/');
        if (parts.length === 2) {
          const leNum = parseInt(parts[0].replace(/[LRC]/g, ''));
          const heNum = parseInt(parts[1].replace(/[LRC]/g, ''));
          orientation = `${String(leNum).padStart(2, '0')}/${String(heNum).padStart(2, '0')}`;
        } else {
          orientation = runway.designator;
        }
      }
      
      if (!groups[orientation]) {
        groups[orientation] = [];
      }
      groups[orientation].push(runway);
    });
    
    return groups;
  };
  
  const compatibility = getRunwayCompatibility();
  const runwayGroups = groupRunwaysByOrientation();
  
  return (
    <div style={sx.combine(
      sx.components.card.base,
      { borderColor: label.color, borderWidth: '2px' }
    )}>
      
      {/* Ligne avec sélecteur et détails */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
        {/* Sélecteur d'aérodrome - 40% */}
        <div style={{ flex: '0 0 40%' }}>
          <AirportSelector
            label="Aérodrome"
            value={waypoint.name ? { 
              icao: waypoint.name, 
              name: waypoint.airportName || waypoint.name,
              coordinates: { lat: waypoint.lat, lon: waypoint.lon },
              city: waypoint.city,
              elevation: waypoint.elevation
            } : null}
            onChange={onSelect}
            placeholder="Code OACI ou nom..."
          />
        </div>
        
        {/* Détails compacts - 60% */}
        {waypoint.lat && waypoint.lon ? (
          <div style={{ flex: '0 0 calc(60% - 12px)', display: 'flex', flexDirection: 'column' }}>
            <label style={sx.components.label.base}>Détails</label>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={sx.combine(
                sx.components.input.base,
                sx.text.xs,
                { 
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: showDetails ? '#f3f4f6' : '#f9fafb',
                  '&:hover': {
                    backgroundColor: '#f3f4f6'
                  }
                }
              )}
            >
            <div style={{ display: 'flex', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
              {/* TOD pour l'arrivée */}
              {isLast && todCalculation && !todCalculation.error ? (
                <>
                  <div style={sx.combine({ minWidth: '110px' }, sx.text.warning)}>
                    <TrendingDown size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    TOD: {todCalculation.distanceToTod} NM
                  </div>
                  <div style={sx.combine({ minWidth: '90px' }, sx.text.secondary)}>
                    ⏱️ {Math.round(todCalculation.descentTimeMinutes)} min
                  </div>
                  <div style={sx.combine({ minWidth: '100px' }, sx.text.secondary)}>
                    ↘️ {todCalculation.descentRate} ft/min
                  </div>
                </>
              ) : isLast && todCalculation?.error ? (
                <div style={sx.combine({ minWidth: '200px' }, sx.text.secondary)}>
                  <TrendingDown size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {todCalculation.message}
                </div>
              ) : runways.length > 0 && compatibility && selectedAircraft ? (
                <div style={sx.combine(
                  { minWidth: '140px' },
                  compatibility.compatible > 0 ? sx.text.success : sx.text.danger
                )}>
                  ✈️ {compatibility.compatible} piste{compatibility.compatible > 1 ? 's' : ''} compatible{compatibility.compatible > 1 ? 's' : ''}
                </div>
              ) : isLast ? (
                <div style={sx.combine({ minWidth: '140px' }, sx.text.secondary)}>
                  <TrendingDown size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  TOD: En attente altitude
                </div>
              ) : null}
              
              {/* Altitude - toujours affichée */}
              {(waypoint.elevation || vacData?.elevation) && (
                <div style={{ minWidth: '70px' }}>
                  ⛰️ {vacData?.elevation || waypoint.elevation} ft
                </div>
              )}
              
              {/* Coordonnées - affichées si pas d'arrivée ou pas de place pour TOD */}
              {(!isLast || !todCalculation || todCalculation.error) && (
                <div style={{ minWidth: '110px' }}>
                  📍 {waypoint.lat.toFixed(2)}°, {waypoint.lon.toFixed(2)}°
                </div>
              )}
            </div>
            {/* Chevron */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>
          </div>
        ) : (
          /* Placeholder si pas de coordonnées */
          <div style={{ flex: '0 0 calc(60% - 12px)' }}></div>
        )}
      </div>
      
      {/* Section détails étendue */}
      {waypoint.lat && waypoint.lon && showDetails && (
        <div style={sx.combine(sx.spacing.mt(3), sx.spacing.p(3), sx.bg.gray, sx.rounded.md)}>
          {/* Indicateur VAC si données disponibles */}
          {vacData && (
            <div style={sx.combine(
              sx.text.xs, 
              sx.spacing.mb(3),
              sx.spacing.p(2),
              sx.rounded.sm,
              { 
                background: '#dbeafe',
                color: '#1e40af',
                border: '1px solid #93c5fd'
              }
            )}>
              ✅ Données issues de la carte VAC officielle
            </div>
          )}
          
          {/* Coordonnées détaillées */}
          <div style={sx.spacing.mb(3)}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              📍 Coordonnées complètes
            </h5>
            <div style={sx.text.sm}>
              {waypoint.lat.toFixed(4)}°, {waypoint.lon.toFixed(4)}°
            </div>
            <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              {Conversions.coordinatesToDMS(waypoint.lat, waypoint.lon).formatted}
            </div>
          </div>
          
          {/* Altitude détaillée */}
          {(waypoint.elevation || vacData?.elevation) && (
            <div style={sx.spacing.mb(3)}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                ⛰️ Altitude terrain
              </h5>
              <div style={sx.text.sm}>
                {vacData?.elevation || waypoint.elevation} ft
              </div>
            </div>
          )}
          
          {/* Calcul TOD pour l'arrivée */}
          {isLast && (
            <div style={sx.spacing.mb(3)}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                <TrendingDown size={14} style={{ display: 'inline', marginRight: '4px', color: '#f59e0b' }} />
                Top of Descent (TOD)
              </h5>
              {todCalculation ? (
                <div style={sx.combine(
                  sx.spacing.p(2),
                  sx.rounded.sm,
                  { 
                    background: todCalculation.error ? '#fee2e2' : '#fef3c7', 
                    border: todCalculation.error ? '1px solid #ef4444' : '1px solid #fbbf24' 
                  }
                )}>
                  {!todCalculation.error ? (
                    <>
                      <div style={sx.text.sm}>
                        <strong>Distance TOD : {todCalculation.distanceToTod} NM</strong> avant l'arrivée
                      </div>
                      <div style={sx.combine(sx.text.xs, sx.spacing.mt(2))}>
                        <strong>Paramètres utilisés :</strong>
                      </div>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                        • Altitude croisière : {todCalculation.cruiseAltitude} ft<br/>
                        • Altitude terrain : {todCalculation.terrainElevation} ft<br/>
                        • Altitude pattern : {todCalculation.targetAltitude} ft (terrain + 1000 ft)<br/>
                        • Descente totale : {todCalculation.altitudeToDescent} ft<br/>
                        • Taux de descente : {todCalculation.descentRate} ft/min<br/>
                        • Vitesse sol : {todCalculation.groundSpeed} kt<br/>
                        • Temps de descente : {Math.round(todCalculation.descentTimeMinutes)} min<br/>
                        • Angle de descente : {todCalculation.descentAngle}°
                      </div>
                    </>
                  ) : (
                    <div style={sx.text.sm}>
                      <strong>{todCalculation.message}</strong>
                      <div style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                        • Altitude actuelle : {todCalculation.cruiseAltitude} ft<br/>
                        • Altitude terrain : {todCalculation.terrainElevation} ft<br/>
                        • Altitude pattern requise : {todCalculation.targetAltitude} ft
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={sx.combine(
                  sx.spacing.p(2),
                  sx.rounded.sm,
                  sx.text.sm,
                  sx.text.secondary,
                  { background: '#f3f4f6', border: '1px solid #d1d5db' }
                )}>
                  ⚠️ Définissez l'altitude du segment précédent pour calculer le TOD
                </div>
              )}
            </div>
          )}
          
          {/* Pistes détaillées */}
          {runways.length > 0 && (
            <div>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                ✈️ Détails des pistes
              </h5>
              {Object.entries(runwayGroups).map(([orientation, groupRunways]) => (
                <div key={orientation} style={sx.spacing.mb(2)}>
                  {groupRunways.map((runway, idx) => {
                    const isCompatible = selectedAircraft && selectedAircraft.runwayRequirements && 
                      Math.round((runway.dimensions?.toda || 0) * 3.28084) >= selectedAircraft.runwayRequirements.takeoffDistance &&
                      Math.round((runway.dimensions?.lda || 0) * 3.28084) >= selectedAircraft.runwayRequirements.landingDistance;
                    
                    return (
                      <div key={idx} style={sx.combine(
                        sx.text.xs, 
                        sx.spacing.p(2),
                        sx.spacing.mb(1),
                        sx.rounded.sm,
                        {
                          background: isCompatible ? '#dcfce7' : '#fee2e2',
                          borderLeft: `3px solid ${isCompatible ? '#10b981' : '#ef4444'}`
                        }
                      )}>
                        <strong>{runway.designator || `${runway.le_ident}/${runway.he_ident}`}</strong>
                        {runway.dimensions && (
                          <span style={sx.text.secondary}>
                            {' '}• {runway.dimensions.length} m × {runway.dimensions.width} m
                          </span>
                        )}
                        {runway.surface?.type && (
                          <span style={sx.text.secondary}>
                            {' '}• {runway.surface.type}
                          </span>
                        )}
                        {selectedAircraft && (
                          <span style={sx.combine(
                            sx.spacing.ml(1),
                            isCompatible ? sx.text.success : sx.text.danger
                          )}>
                            {isCompatible ? ' ✓ Compatible' : ' ✗ Trop courte'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Pied de carte avec boutons, label et bouton supprimer sur la même ligne */}
      <div style={sx.combine(
        sx.flex.between, 
        sx.spacing.mt(3),
        sx.spacing.pt(3),
        { borderTop: '1px solid #e5e7eb', alignItems: 'center' }
      )}>
        {/* Boutons d'ajout */}
        {!isLast && onInsertWaypoint && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <VFRPointInserter
              waypoints={allWaypoints || waypoints}
              onInsertWaypoint={(newWaypoint, _) => {
                // Insérer après ce waypoint
                onInsertWaypoint(newWaypoint, index + 1);
              }}
              insertPosition={index + 1}
            />
          </div>
        )}
        
        {/* Étiquette et bouton supprimer */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: label.color,
            backgroundColor: label.color + '20',
            padding: '4px 12px',
            borderRadius: '4px'
          }}>
            {label.text}
          </span>
          
          {canDelete && (
            <button
              onClick={onRemove}
              style={sx.combine(sx.components.button.base, sx.components.button.danger, { padding: '6px' })}
              title="Supprimer ce point"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

WaypointCardWithRunways.displayName = 'WaypointCardWithRunways';

export default WaypointCardWithRunways;