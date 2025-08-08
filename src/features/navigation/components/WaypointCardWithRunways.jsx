import React, { memo, useState, useEffect } from 'react';
import { Trash2, Navigation2, ChevronDown, ChevronUp, AlertTriangle, Download, ExternalLink, Plane, CheckCircle } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { openAIPService } from '@services/openAIPService';
import { useAircraft } from '@core/contexts';
import { SimpleAirportSelector as AirportSelector } from './SimpleAirportSelector';
import { Conversions } from '@utils/conversions';
import { DataSourceBadge, DataField } from '@shared/components';

// Composant pour une carte de waypoint avec analyse des pistes intégrée
export const WaypointCardWithRunways = memo(({ 
  waypoint, 
  index, 
  totalWaypoints, 
  onSelect, 
  onRemove, 
  onShowReportingPoints 
}) => {
  const { selectedAircraft } = useAircraft();
  const [airport, setAirport] = useState(null);
  const [runways, setRunways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRunwayDetails, setShowRunwayDetails] = useState(false);
  
  const isFirst = index === 0;
  const isLast = index === totalWaypoints - 1;
  const canDelete = totalWaypoints > 2;
  
  const getLabel = () => {
    if (isFirst) return { text: 'Départ', color: '#10b981' };
    if (isLast) return { text: 'Arrivée', color: '#f59e0b' };
    return { text: `Étape ${index}`, color: '#3b82f6' };
  };
  
  const label = getLabel();
  
  // Charger les données de l'aérodrome quand le waypoint change
  useEffect(() => {
    const loadAirportData = async () => {
      if (!waypoint.name || !waypoint.name.match(/^[A-Z]{4}$/)) {
        setAirport(null);
        setRunways([]);
        return;
      }
      
      setLoading(true);
      try {
        const airportData = await openAIPService.getAirportDetails(waypoint.name);
        if (airportData) {
          setAirport(airportData);
          setRunways(airportData.runways || []);
        }
      } catch (error) {
        console.error('Erreur chargement aérodrome:', error);
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
      {/* En-tête avec label */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
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
      
      {/* Sélecteur d'aérodrome */}
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
      
      {/* Informations du waypoint */}
      {waypoint.lat && waypoint.lon && (
        <div style={sx.spacing.mt(3)}>
          <DataField
            label="Coordonnées"
            value={`${waypoint.lat.toFixed(4)}°, ${waypoint.lon.toFixed(4)}°`}
            dataSource={airport?.dataSource || 'static'}
            size="sm"
          />
          <div style={sx.combine(sx.text.xs, sx.spacing.mt(1), sx.spacing.ml(2), { color: '#6b7280' })}>
            {Conversions.coordinatesToDMS(waypoint.lat, waypoint.lon).formatted}
          </div>
          {waypoint.elevation && (
            <DataField
              label="Altitude"
              value={waypoint.elevation}
              unit="ft"
              dataSource={airport?.dataSource || 'static'}
              size="sm"
              style={{ marginTop: '4px' }}
            />
          )}
        </div>
      )}
      
      {/* Section pistes et VAC */}
      {airport && (
        <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
          {/* Avertissement données non officielles */}
          {airport.dataSource === 'static' && !airport.vacData && (
            <div style={sx.combine(
              sx.components.alert.base,
              sx.components.alert.warning,
              sx.spacing.mb(2),
              { padding: '8px 12px' }
            )}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={sx.combine(sx.text.xs, sx.text.bold)}>
                  ⚠️ Données non officielles
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  Ces informations proviennent d'une base de données statique et peuvent être obsolètes.
                  {airport.vacAvailable && ' Une carte VAC officielle est disponible.'}
                </p>
                {airport.vacAvailable && (
                  <button
                    onClick={goToVACModule}
                    style={sx.combine(
                      sx.text.xs,
                      { 
                        color: '#d97706',
                        textDecoration: 'underline',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        marginTop: '4px'
                      }
                    )}
                  >
                    Télécharger la carte VAC pour des données officielles
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Indicateur VAC téléchargée */}
          {airport.vacData && (
            <div style={sx.combine(sx.text.xs, sx.text.success, sx.spacing.mb(2))}>
              ✅ Données VAC disponibles
              {airport.vacData.circuitAltitude && ` • Tour: ${airport.vacData.circuitAltitude} ft`}
            </div>
          )}
          
          {/* Résumé des pistes */}
          {runways.length > 0 && (
            <div>
              <button
                onClick={() => setShowRunwayDetails(!showRunwayDetails)}
                style={sx.combine(
                  sx.flex.between,
                  sx.text.sm,
                  sx.spacing.p(2),
                  sx.bg.gray,
                  sx.rounded.md,
                  { 
                    width: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }
                )}
              >
                <div style={sx.flex.start}>
                  <Plane size={16} style={{ marginRight: '8px' }} />
                  <span style={sx.text.bold}>
                    {runways.length} piste{runways.length > 1 ? 's' : ''} • {Object.keys(runwayGroups).length} orientation{Object.keys(runwayGroups).length > 1 ? 's' : ''}
                  </span>
                  {compatibility && selectedAircraft && (
                    <span style={sx.combine(
                      sx.spacing.ml(2),
                      compatibility.compatible === compatibility.total ? sx.text.success : 
                      compatibility.compatible > 0 ? sx.text.warning : sx.text.danger
                    )}>
                      {compatibility.compatible === compatibility.total ? (
                        <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      ) : (
                        <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                      )}
                      {compatibility.compatible}/{compatibility.total} compatible{compatibility.compatible > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {showRunwayDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {/* Détails des pistes groupées par orientation */}
              {showRunwayDetails && (
                <div style={sx.combine(sx.spacing.mt(2), sx.text.xs)}>
                  {Object.entries(runwayGroups).map(([orientation, groupRunways]) => (
                    <div key={orientation} style={sx.spacing.mb(2)}>
                      <div style={sx.combine(
                        sx.text.bold,
                        sx.spacing.mb(1),
                        sx.spacing.px(2),
                        { color: '#4b5563' }
                      )}>
                        Orientation {orientation}
                      </div>
                      {groupRunways.map((runway, idx) => {
                        const isCompatible = selectedAircraft && selectedAircraft.runwayRequirements && 
                          Math.round((runway.dimensions?.toda || 0) * 3.28084) >= selectedAircraft.runwayRequirements.takeoffDistance &&
                          Math.round((runway.dimensions?.lda || 0) * 3.28084) >= selectedAircraft.runwayRequirements.landingDistance;
                        
                        return (
                          <div key={idx} style={sx.combine(
                            sx.spacing.p(2),
                            sx.spacing.mb(1),
                            sx.bg.gray,
                            sx.rounded.sm,
                            sx.spacing.ml(2),
                            {
                              borderLeft: `3px solid ${isCompatible ? '#10b981' : '#ef4444'}`
                            }
                          )}>
                            <div style={sx.flex.between}>
                              <div>
                                <strong>{runway.designator || `${runway.le_ident}/${runway.he_ident}`}</strong>
                                {selectedAircraft && (
                                  <span style={sx.combine(
                                    sx.spacing.ml(2),
                                    isCompatible ? sx.text.success : sx.text.danger,
                                    { fontSize: '10px' }
                                  )}>
                                    {isCompatible ? '✓ Compatible' : '✗ Trop courte'}
                                  </span>
                                )}
                              </div>
                              <span>
                                {runway.dimensions?.length || 'N/A'} m × {runway.dimensions?.width || 'N/A'} m
                              </span>
                            </div>
                            {runway.surface?.type && (
                              <div style={sx.text.secondary}>
                                Surface: {runway.surface.type}
                              </div>
                            )}
                            {runway.dimensions && (
                              <div style={sx.combine(sx.text.secondary, sx.spacing.mt(1))}>
                                TODA: {runway.dimensions.toda || runway.dimensions.length} m ({Math.round((runway.dimensions.toda || runway.dimensions.length) * 3.28084)} ft) • 
                                LDA: {runway.dimensions.lda || runway.dimensions.length} m ({Math.round((runway.dimensions.lda || runway.dimensions.length) * 3.28084)} ft)
                              </div>
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
          
          {/* Pas de pistes disponibles */}
          {!loading && runways.length === 0 && !airport.vacAvailable && (
            <div style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Aucune donnée de piste disponible
            </div>
          )}
        </div>
      )}
      
      {/* Bouton pour les points de report VFR */}
      {waypoint.name && waypoint.name.match(/^LF[A-Z]{2}$/) && (
        <button
          onClick={onShowReportingPoints}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.secondary,
            sx.spacing.mt(2),
            { fontSize: '12px', padding: '6px 12px' }
          )}
        >
          <Navigation2 size={14} />
          Points de report VFR
        </button>
      )}
    </div>
  );
});

WaypointCardWithRunways.displayName = 'WaypointCardWithRunways';

export default WaypointCardWithRunways;