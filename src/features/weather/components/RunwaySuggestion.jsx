import React, { memo, useState, useEffect } from 'react';
import { Plane, Wind, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';

// Calcul de la différence d'angle entre deux directions
const calculateAngleDifference = (heading1, heading2) => {
  let diff = Math.abs(heading1 - heading2);
  if (diff > 180) diff = 360 - diff;
  return diff;
};

// Calcul de la composante vent de face/arrière
const calculateHeadwindComponent = (windDirection, windSpeed, runwayHeading) => {
  const angleDiff = calculateAngleDifference(windDirection, runwayHeading);
  // Conversion en radians
  const angleRad = (angleDiff * Math.PI) / 180;
  // Composante vent de face (positif) ou arrière (négatif)
  return windSpeed * Math.cos(angleRad);
};

// Calcul de la composante vent traversier
const calculateCrosswindComponent = (windDirection, windSpeed, runwayHeading) => {
  const angleDiff = calculateAngleDifference(windDirection, runwayHeading);
  // Conversion en radians
  const angleRad = (angleDiff * Math.PI) / 180;
  // Composante vent traversier (toujours positif)
  return Math.abs(windSpeed * Math.sin(angleRad));
};

export const RunwaySuggestion = memo(({ icao, wind }) => {
  const [airport, setAirport] = useState(null);
  const [runways, setRunways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Charger les données de l'aérodrome
  useEffect(() => {
    const loadAirportData = async () => {
      if (!icao) return;
      
      setLoading(true);
      try {
        const airports = await aeroDataProvider.getAirfields({ icao });
        const airportData = airports.find(a => a.icao === icao);
        if (airportData) {
          setAirport(airportData);
          setRunways(airportData.runways || []);
        }
      } catch (error) {
        console.error('Erreur chargement pistes:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAirportData();
  }, [icao]);
  
  if (!wind || wind.direction === 'Calme' || wind.direction === 'Variable' || !runways.length) {
    return null;
  }
  
  // Analyser chaque piste par rapport au vent
  const analyzedRunways = runways.flatMap(runway => {
    const results = [];
    
    // Analyser chaque seuil de la piste
    if (runway.le_ident && runway.le_heading !== undefined) {
      const headwind = calculateHeadwindComponent(wind.direction, wind.speed, runway.le_heading);
      const crosswind = calculateCrosswindComponent(wind.direction, wind.speed, runway.le_heading);
      const angleDiff = calculateAngleDifference(wind.direction, runway.le_heading);
      
      results.push({
        ident: runway.le_ident,
        heading: runway.le_heading,
        headwind: Math.round(headwind),
        crosswind: Math.round(crosswind),
        angleDiff: Math.round(angleDiff),
        runway: runway,
        isOptimal: angleDiff <= 30, // Vent de face à +/- 30°
        isAcceptable: angleDiff <= 90, // Acceptable jusqu'à 90°
        isTailwind: headwind < 0
      });
    }
    
    if (runway.he_ident && runway.he_heading !== undefined) {
      const headwind = calculateHeadwindComponent(wind.direction, wind.speed, runway.he_heading);
      const crosswind = calculateCrosswindComponent(wind.direction, wind.speed, runway.he_heading);
      const angleDiff = calculateAngleDifference(wind.direction, runway.he_heading);
      
      results.push({
        ident: runway.he_ident,
        heading: runway.he_heading,
        headwind: Math.round(headwind),
        crosswind: Math.round(crosswind),
        angleDiff: Math.round(angleDiff),
        runway: runway,
        isOptimal: angleDiff <= 30,
        isAcceptable: angleDiff <= 90,
        isTailwind: headwind < 0
      });
    }
    
    return results;
  });
  
  // Trier par composante vent de face (meilleur en premier)
  const sortedRunways = analyzedRunways.sort((a, b) => b.headwind - a.headwind);
  const optimalRunways = sortedRunways.filter(r => r.isOptimal && !r.isTailwind);
  const bestRunway = sortedRunways[0];
  
  if (loading) {
    return (
      <div style={sx.combine(sx.spacing.mt(3), sx.text.center, sx.text.secondary)}>
        <p style={sx.text.xs}>Chargement des pistes...</p>
      </div>
    );
  }
  
  return (
    <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
      {/* En-tête avec suggestion */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
        <div>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.flex.start)}>
            <Plane size={16} />
            <span style={sx.spacing.ml(1)}>Piste suggérée</span>
            {airport && (
              <span style={sx.combine(
                sx.text.xs,
                sx.spacing.ml(2),
                {
                  backgroundColor: airport.dataSource === 'vac' ? '#d1fae5' : '#fef3c7',
                  color: airport.dataSource === 'vac' ? '#065f46' : '#92400e',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 'normal'
                }
              )}>
                {airport.dataSource === 'vac' ? (
                  <>
                    <FileText size={10} style={{ display: 'inline', marginRight: '2px' }} />
                    VAC
                  </>
                ) : (
                  <>
                    <AlertTriangle size={10} style={{ display: 'inline', marginRight: '2px' }} />
                    Non officiel
                  </>
                )}
              </span>
            )}
          </h5>
          
          {/* Meilleure piste */}
          {bestRunway && (
            <div style={sx.combine(sx.spacing.mt(1), sx.flex.start)}>
              <div style={sx.combine(
                sx.text.base,
                sx.text.bold,
                sx.spacing.px(2),
                sx.spacing.py(1),
                sx.rounded.md,
                {
                  backgroundColor: bestRunway.isOptimal ? '#d1fae5' : '#fef3c7',
                  color: bestRunway.isOptimal ? '#065f46' : '#92400e',
                  border: `2px solid ${bestRunway.isOptimal ? '#10b981' : '#f59e0b'}`
                }
              )}>
                {bestRunway.ident}
              </div>
              <div style={sx.combine(sx.text.xs, sx.spacing.ml(2))}>
                {bestRunway.isOptimal ? (
                  <span style={sx.text.success}>
                    <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Optimal ({bestRunway.angleDiff}° du vent)
                  </span>
                ) : (
                  <span style={sx.text.warning}>
                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Acceptable ({bestRunway.angleDiff}° du vent)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Bouton détails */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={sx.combine(
            sx.components.button.base,
            sx.components.button.secondary,
            { padding: '4px 8px', fontSize: '12px' }
          )}
        >
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Détails
        </button>
      </div>
      
      {/* Notification VAC */}
      {airport && airport.staticDataWarning && airport.vacAvailable && (
        <div style={sx.combine(
          sx.components.alert.base,
          sx.components.alert.warning,
          sx.spacing.mb(2),
          { padding: '6px 10px' }
        )}>
          <Info size={14} />
          <p style={sx.text.xs}>
            Téléchargez la carte VAC pour obtenir les données de pistes officielles
          </p>
        </div>
      )}
      
      {/* Détails de toutes les pistes */}
      {showDetails && (
        <div style={sx.combine(sx.spacing.mt(2), sx.text.xs)}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '4px', textAlign: 'left' }}>Piste</th>
                <th style={{ padding: '4px', textAlign: 'center' }}>QFU</th>
                <th style={{ padding: '4px', textAlign: 'center' }}>Angle</th>
                <th style={{ padding: '4px', textAlign: 'center' }}>Vent face</th>
                <th style={{ padding: '4px', textAlign: 'center' }}>Travers</th>
              </tr>
            </thead>
            <tbody>
              {sortedRunways.map((analysis, idx) => (
                <tr 
                  key={idx} 
                  style={{
                    backgroundColor: analysis.isOptimal ? '#f0fdf4' : 
                                   analysis.isAcceptable ? '#fefce8' : '#fef2f2',
                    borderBottom: '1px solid #e5e7eb'
                  }}
                >
                  <td style={{ padding: '4px', fontWeight: analysis === bestRunway ? 'bold' : 'normal' }}>
                    {analysis.ident}
                    {analysis === bestRunway && ' ★'}
                  </td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>{analysis.heading}°</td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <span style={{
                      color: analysis.isOptimal ? '#059669' : 
                             analysis.isAcceptable ? '#d97706' : '#dc2626'
                    }}>
                      {analysis.angleDiff}°
                    </span>
                  </td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    {analysis.headwind > 0 ? '+' : ''}{analysis.headwind} kt
                  </td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>{analysis.crosswind} kt</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Légende */}
          <div style={sx.combine(sx.spacing.mt(2), sx.text.secondary)}>
            <p>★ Piste recommandée</p>
            <p>🟢 Optimal : vent de face ±30°</p>
            <p>🟡 Acceptable : vent de face ±90°</p>
            <p>🔴 Non recommandé : vent arrière</p>
          </div>
        </div>
      )}
    </div>
  );
});

RunwaySuggestion.displayName = 'RunwaySuggestion';

export default RunwaySuggestion;