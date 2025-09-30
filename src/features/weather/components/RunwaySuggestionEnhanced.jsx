import React, { memo, useState, useEffect } from 'react';
import { Plane, Wind, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp, FileText, TrendingUp, TrendingDown, Navigation } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { aeroDataProvider } from '@core/data';
import { useVACStore } from '@core/stores/vacStore';
import { getFallbackRunways, getFallbackAirport } from '@data/fallbackRunways';

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

// Déterminer le côté du vent traversier
const getCrosswindSide = (windDirection, runwayHeading) => {
  // Normaliser les angles
  let wind = windDirection % 360;
  let rwy = runwayHeading % 360;
  
  // Calculer la différence signée
  let diff = wind - rwy;
  
  // Normaliser entre -180 et 180
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  return diff > 0 ? 'droite' : 'gauche';
};

export const RunwaySuggestionEnhanced = memo(({ icao, wind, showCompact = false }) => {
  const [airport, setAirport] = useState(null);
  const [runways, setRunways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(true); // Afficher par défaut
  const vacChart = useVACStore(state => state.getChartByIcao(icao));
  
  // Charger les données de l'aérodrome
  useEffect(() => {
    const loadAirportData = async () => {
      if (!icao) return;
      
      setLoading(true);
      try {
        // D'abord vérifier si on a des données VAC
        if (vacChart?.extractedData?.runways && vacChart.extractedData.runways.length > 0) {
          console.log('Utilisation des données VAC pour', icao);
          
          // Convertir le format VAC vers le format attendu
          const vacRunways = vacChart.extractedData.runways.map(rwy => {
            // Extraire les identifiants des seuils (ex: "05/23" -> ["05", "23"])
            const thresholds = rwy.identifier ? rwy.identifier.split('/') : [];
            const baseIdent = thresholds[0] || '';
            const oppositeIdent = thresholds[1] || '';
            
            // Calculer les QFU pour chaque seuil
            const baseQfu = rwy.qfu || (parseInt(baseIdent.replace(/[LRC]/, '')) * 10) || 0;
            const oppositeQfu = (baseQfu + 180) % 360;
            
            return {
              identifier: rwy.identifier,
              le_ident: baseIdent,
              he_ident: oppositeIdent,
              le_heading: baseQfu,
              he_heading: oppositeQfu,
              qfu: baseQfu,
              length: rwy.length,
              width: rwy.width,
              surface: rwy.surface
            };
          });
          
          setRunways(vacRunways);
          setAirport({ 
            icao, 
            name: vacChart.extractedData.airportName || icao,
            dataSource: 'vac'
          });
        } else {
          // Sinon essayer le provider de données
          const airports = await aeroDataProvider.getAirfields({ icao });
          const airportData = airports.find(a => a.icao === icao);
          
          if (airportData && airportData.runways && airportData.runways.length > 0) {
            setAirport(airportData);
            setRunways(airportData.runways);
          } else {
            // En dernier recours, utiliser les données de secours
            const fallbackRunways = getFallbackRunways(icao);
            const fallbackAirport = getFallbackAirport(icao);
            
            if (fallbackRunways) {
              console.log(`Utilisation des données de secours pour ${icao}`);
              setRunways(fallbackRunways);
              setAirport(fallbackAirport || { icao, name: icao, dataSource: 'fallback' });
            } else if (airportData) {
              // Si on a l'aérodrome mais pas les pistes
              setAirport(airportData);
              setRunways([]);
            }
          }
        }
      } catch (error) {
        console.error('Erreur chargement pistes:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAirportData();
  }, [icao, vacChart]);
  
  if (!wind || wind.direction === 'Calme' || wind.direction === 'Variable') {
    return (
      <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
        <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
          <Wind size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Vent calme ou variable - Toutes pistes utilisables
        </p>
      </div>
    );
  }
  
  if (!runways.length && !loading) {
    return (
      <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
        <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
          <Info size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Pas de données de pistes disponibles
        </p>
      </div>
    );
  }
  
  // Analyser chaque piste par rapport au vent
  const analyzedRunways = [];
  const processedRunways = new Set(); // Pour éviter les doublons
  
  runways.forEach(runway => {
    // Traiter le format avec identifier "05/23"
    if (runway.identifier && runway.identifier.includes('/')) {
      const [baseIdent, oppositeIdent] = runway.identifier.split('/');
      const runwayKey = runway.identifier;
      
      if (!processedRunways.has(runwayKey)) {
        processedRunways.add(runwayKey);
        
        // Analyser le premier seuil
        const baseHeading = runway.qfu || parseInt(baseIdent.replace(/[LRC]/, '')) * 10;
        if (baseIdent && baseHeading !== undefined) {
          const headwind = calculateHeadwindComponent(wind.direction, wind.speed, baseHeading);
          const crosswind = calculateCrosswindComponent(wind.direction, wind.speed, baseHeading);
          const crosswindSide = getCrosswindSide(wind.direction, baseHeading);
          const angleDiff = calculateAngleDifference(wind.direction, baseHeading);
          
          analyzedRunways.push({
            ident: baseIdent,
            heading: baseHeading,
            headwind: Math.round(headwind),
            crosswind: Math.round(crosswind),
            crosswindSide,
            angleDiff: Math.round(angleDiff),
            runway,
            isOptimal: angleDiff <= 30,
            isGood: angleDiff <= 45,
            isAcceptable: angleDiff <= 90,
            isTailwind: headwind < 0,
            score: (headwind * 2) - crosswind
          });
        }
        
        // Analyser le seuil opposé
        const oppositeHeading = (baseHeading + 180) % 360;
        if (oppositeIdent && oppositeHeading !== undefined) {
          const headwind = calculateHeadwindComponent(wind.direction, wind.speed, oppositeHeading);
          const crosswind = calculateCrosswindComponent(wind.direction, wind.speed, oppositeHeading);
          const crosswindSide = getCrosswindSide(wind.direction, oppositeHeading);
          const angleDiff = calculateAngleDifference(wind.direction, oppositeHeading);
          
          analyzedRunways.push({
            ident: oppositeIdent,
            heading: oppositeHeading,
            headwind: Math.round(headwind),
            crosswind: Math.round(crosswind),
            crosswindSide,
            angleDiff: Math.round(angleDiff),
            runway,
            isOptimal: angleDiff <= 30,
            isGood: angleDiff <= 45,
            isAcceptable: angleDiff <= 90,
            isTailwind: headwind < 0,
            score: (headwind * 2) - crosswind
          });
        }
      }
    }
    // Traiter le format avec le_ident et he_ident séparés
    else if (runway.le_ident || runway.he_ident) {
      const runwayKey = `${runway.le_ident || ''}/${runway.he_ident || ''}`;
      
      if (!processedRunways.has(runwayKey)) {
        processedRunways.add(runwayKey);
        
        // Analyser le seuil "le" (lower end)
        if (runway.le_ident && runway.le_heading !== undefined) {
          const headwind = calculateHeadwindComponent(wind.direction, wind.speed, runway.le_heading);
          const crosswind = calculateCrosswindComponent(wind.direction, wind.speed, runway.le_heading);
          const crosswindSide = getCrosswindSide(wind.direction, runway.le_heading);
          const angleDiff = calculateAngleDifference(wind.direction, runway.le_heading);
          
          analyzedRunways.push({
            ident: runway.le_ident,
            heading: runway.le_heading,
            headwind: Math.round(headwind),
            crosswind: Math.round(crosswind),
            crosswindSide,
            angleDiff: Math.round(angleDiff),
            runway,
            isOptimal: angleDiff <= 30,
            isGood: angleDiff <= 45,
            isAcceptable: angleDiff <= 90,
            isTailwind: headwind < 0,
            score: (headwind * 2) - crosswind
          });
        }
        
        // Analyser le seuil "he" (higher end)
        if (runway.he_ident && runway.he_heading !== undefined) {
          const headwind = calculateHeadwindComponent(wind.direction, wind.speed, runway.he_heading);
          const crosswind = calculateCrosswindComponent(wind.direction, wind.speed, runway.he_heading);
          const crosswindSide = getCrosswindSide(wind.direction, runway.he_heading);
          const angleDiff = calculateAngleDifference(wind.direction, runway.he_heading);
          
          analyzedRunways.push({
            ident: runway.he_ident,
            heading: runway.he_heading,
            headwind: Math.round(headwind),
            crosswind: Math.round(crosswind),
            crosswindSide,
            angleDiff: Math.round(angleDiff),
            runway,
            isOptimal: angleDiff <= 30,
            isGood: angleDiff <= 45,
            isAcceptable: angleDiff <= 90,
            isTailwind: headwind < 0,
            score: (headwind * 2) - crosswind
          });
        }
      }
    }
  });
  
  // Trier par score (meilleur en premier)
  const sortedRunways = analyzedRunways.sort((a, b) => b.score - a.score);
  const optimalRunways = sortedRunways.filter(r => r.isOptimal && !r.isTailwind);
  const goodRunways = sortedRunways.filter(r => r.isGood && !r.isTailwind);
  const bestRunway = sortedRunways[0];
  
  // Recommandations spécifiques
  const takeoffRunway = sortedRunways.find(r => !r.isTailwind && r.headwind > -5) || bestRunway;
  const landingRunway = sortedRunways.find(r => r.isOptimal || r.isGood) || bestRunway;
  
  if (loading) {
    return (
      <div style={sx.combine(sx.spacing.mt(3), sx.text.center, sx.text.secondary)}>
        <p style={sx.text.xs}>Chargement des pistes...</p>
      </div>
    );
  }
  
  // Mode compact
  if (showCompact) {
    return (
      <div style={sx.combine(sx.spacing.mt(2), sx.text.xs)}>
        <span style={sx.text.secondary}>Piste suggérée: </span>
        <span style={sx.combine(sx.text.bold, {
          color: bestRunway?.isOptimal ? '#059669' : '#d97706'
        })}>
          {bestRunway?.ident}
        </span>
        {bestRunway?.crosswind > 10 && (
          <span style={sx.text.warning}> (travers {bestRunway.crosswind}kt)</span>
        )}
      </div>
    );
  }
  
  return (
    <div style={sx.combine(sx.spacing.mt(3), sx.spacing.pt(3), { borderTop: '1px solid #e5e7eb' })}>
      {/* Alertes si conditions limites */}
      {bestRunway && (
        <>
          {bestRunway.crosswind > 15 && (
            <div style={sx.combine(
              sx.components.alert.base,
              sx.components.alert.warning,
              sx.spacing.mb(2),
              { padding: '8px' }
            )}>
              <AlertTriangle size={14} />
              <p style={sx.text.xs}>
                <strong>Attention:</strong> Vent traversier fort ({bestRunway.crosswind}kt).
                Vérifiez les limites de votre appareil.
              </p>
            </div>
          )}
          
          {bestRunway.isTailwind && (
            <div style={sx.combine(
              sx.components.alert.base,
              sx.components.alert.danger,
              sx.spacing.mb(2),
              { padding: '8px' }
            )}>
              <AlertTriangle size={14} />
              <p style={sx.text.xs}>
                <strong>Danger:</strong> Vent arrière sur toutes les pistes.
                Évaluez la possibilité de vous dérouter.
              </p>
            </div>
          )}
          
          {wind.gust && wind.gust - wind.speed > 10 && (
            <div style={sx.combine(
              sx.components.alert.base,
              sx.components.alert.warning,
              sx.spacing.mb(2),
              { padding: '8px' }
            )}>
              <Wind size={14} />
              <p style={sx.text.xs}>
                <strong>Rafales:</strong> Variation de {wind.gust - wind.speed}kt.
                Prévoyez une marge de vitesse supplémentaire.
              </p>
            </div>
          )}
        </>
      )}
      
      {/* Tableau détaillé de toutes les pistes - TOUJOURS VISIBLE */}
      <div style={sx.combine(sx.spacing.mt(3))}>
        <h6 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2), sx.flex.start)}>
          <Navigation size={16} style={{ marginRight: '6px' }} />
          Analyse des pistes
          <span style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.ml(2), { fontWeight: 'normal' })}>
            Vent: {wind.direction}°/{wind.speed}kt
            {wind.gust && ` G${wind.gust}kt`}
          </span>
        </h6>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '6px', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>
                  Piste
                </th>
                <th style={{ padding: '6px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>
                  QFU
                </th>
                <th style={{ padding: '6px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>
                  Angle vent
                </th>
                <th style={{ padding: '6px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>
                  Vent face
                </th>
                <th style={{ padding: '6px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>
                  Travers
                </th>
                <th style={{ padding: '6px', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>
                  Évaluation
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRunways.map((analysis, idx) => (
                <tr 
                  key={idx} 
                  style={{
                    backgroundColor: 
                      analysis === takeoffRunway || analysis === landingRunway ? '#f0f9ff' :
                      analysis.isOptimal ? '#f0fdf4' : 
                      analysis.isGood ? '#fef3c7' :
                      analysis.isAcceptable ? '#fefce8' : '#fef2f2',
                    borderBottom: '1px solid #e5e7eb'
                  }}
                >
                  <td style={{ 
                    padding: '6px', 
                    fontWeight: analysis === takeoffRunway || analysis === landingRunway ? 'bold' : 'normal'
                  }}>
                    {analysis.ident}
                    {analysis === takeoffRunway && ' 🛫'}
                    {analysis === landingRunway && ' 🛬'}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>
                    {analysis.heading}°
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 
                        analysis.isOptimal ? '#d1fae5' : 
                        analysis.isGood ? '#fef3c7' :
                        analysis.isAcceptable ? '#fed7aa' : '#fee2e2',
                      color: 
                        analysis.isOptimal ? '#059669' : 
                        analysis.isGood ? '#ca8a04' :
                        analysis.isAcceptable ? '#ea580c' : '#dc2626'
                    }}>
                      {analysis.angleDiff}°
                    </span>
                  </td>
                  <td style={{ 
                    padding: '6px', 
                    textAlign: 'center',
                    color: analysis.headwind < 0 ? '#dc2626' : '#059669'
                  }}>
                    {analysis.headwind > 0 ? '+' : ''}{analysis.headwind}kt
                  </td>
                  <td style={{ 
                    padding: '6px', 
                    textAlign: 'center',
                    color: analysis.crosswind > 15 ? '#dc2626' : 
                           analysis.crosswind > 10 ? '#d97706' : '#6b7280'
                  }}>
                    {analysis.crosswind}kt
                    {analysis.crosswind > 5 && ` (${analysis.crosswindSide})`}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center' }}>
                    {analysis.isOptimal ? (
                      <span style={{ color: '#059669' }}>
                        <CheckCircle size={14} style={{ display: 'inline' }} /> Optimal
                      </span>
                    ) : analysis.isGood ? (
                      <span style={{ color: '#ca8a04' }}>
                        ✓ Bon
                      </span>
                    ) : analysis.isAcceptable ? (
                      <span style={{ color: '#ea580c' }}>
                        ~ Acceptable
                      </span>
                    ) : (
                      <span style={{ color: '#dc2626' }}>
                        <AlertTriangle size={14} style={{ display: 'inline' }} /> Déconseillé
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
      </div>
    </div>
  );
});

RunwaySuggestionEnhanced.displayName = 'RunwaySuggestionEnhanced';

export default RunwaySuggestionEnhanced;