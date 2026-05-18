// src/features/performance/components/AdvancedPerformanceCalculator.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, Thermometer, Mountain, Wind, Plane, 
  AlertTriangle, Info, RefreshCw, CheckCircle, MapPin,
  ChevronDown, ChevronUp, Table
} from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import performanceInterpolation from '../../../services/performanceInterpolation';
import { useWeather, useNavigation, useWeightBalance } from '../../../core/contexts';
import { getWaypointIcao } from '../../../shared/utils/getWaypointIcao';

const AdvancedPerformanceCalculator = ({ aircraft }) => {
  const { getWeatherByIcao } = useWeather();
  const { waypoints } = useNavigation();
  const { calculations } = useWeightBalance();
  
  // Fonction pour s'assurer que l'altitude est en pieds
  // Les données des aérodromes français sont généralement déjà en pieds
  const ensureAltitudeInFeet = (airport, sourceName = '') => {
    if (!airport) return 0;
    
    // Priorité : elevation (généralement en ft), sinon altitude
    let altValue = airport.elevation || airport.altitude || 0;
    
    // Pour les aérodromes français, les altitudes sont généralement déjà en pieds
    // Vérifier si c'est un champ qui indique explicitement des mètres
    if (airport.elevationM || airport.altitudeM) {
      // Si on a une valeur explicite en mètres, la convertir
      const metersValue = airport.elevationM || airport.altitudeM;
      altValue = Math.round(metersValue * 3.28084);
      
    } else {
      // Sinon, on suppose que c'est déjà en pieds (cas standard pour les données aéro)
    }
    
    return altValue;
  };
  
  // États pour les calculs
  const [takeoffPerformance, setTakeoffPerformance] = useState(null);
  const [landingPerformance, setLandingPerformance] = useState(null);
  const [alternatePerformances, setAlternatePerformances] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [errors, setErrors] = useState([]);
  const [temperatureSource, setTemperatureSource] = useState('ISA'); // 'METAR' ou 'ISA'
  const [showDetails, setShowDetails] = useState(false); // Pour afficher/masquer les détails
  const [showExtractedTables, setShowExtractedTables] = useState(false); // Pour afficher les tableaux extraits
  
  // Récupérer les aérodromes
  const departureAirport = waypoints?.[0];
  const arrivalAirport = waypoints?.[waypoints?.length - 1];
  const alternates = waypoints?.filter(wp => wp.isAlternate);
  
  // Debug des waypoints
  React.useEffect(() => {
    
    
    
  }, [waypoints, departureAirport, arrivalAirport]);
  
  // Codes ICAO départ/arrivée via util partagé (source unique de vérité,
  // cf. src/shared/utils/getWaypointIcao.js)
  const departureIcao = getWaypointIcao(departureAirport);
  const arrivalIcao = getWaypointIcao(arrivalAirport);
  
  
  
  
  const departureWeather = departureIcao && typeof departureIcao === 'string' ? getWeatherByIcao(departureIcao) : null;
  const arrivalWeather = arrivalIcao && typeof arrivalIcao === 'string' ? getWeatherByIcao(arrivalIcao) : null;
  
  // Debug des données météo
  React.useEffect(() => {
    
    
      }, [departureWeather, arrivalWeather, departureIcao, arrivalIcao]);
  
  // Poids actuel de l'avion
  const currentWeight = calculations?.totalWeight || aircraft?.maxTakeoffWeight || 1200;
  
  // Fonction pour extraire la température du METAR
  const extractTemperature = (weather) => {
    if (!weather) {
      
      return null;
    }
    
    // D'abord, vérifier si la température est directement disponible dans l'objet weather
    if (weather.temperature !== undefined && weather.temperature !== null) {
      
      return Math.round(weather.temperature); // Arrondir si c'est 13.99
    }
    
    // Vérifier d'autres champs possibles
    if (weather.temp !== undefined && weather.temp !== null) {
      
      return Math.round(weather.temp);
    }
    
    // Si on a des données décodées
    if (weather.decoded) {
      if (weather.decoded.temperature !== undefined) {
        
        return Math.round(weather.decoded.temperature);
      }
      if (weather.decoded.temp !== undefined) {
        
        return Math.round(weather.decoded.temp);
      }
    }
    
    // Sinon, essayer d'extraire du METAR brut
    if (!weather.metar) {
      
      
      return null;
    }
    
    // S'assurer que metar est une chaîne de caractères
    let metarString = weather.metar;
    
    // Si c'est un objet avec une propriété raw ou text
    if (typeof metarString === 'object' && metarString !== null) {
      metarString = metarString.raw || metarString.text || metarString.metar || JSON.stringify(metarString);
      
    }
    
    // Vérifier que c'est maintenant une chaîne
    if (typeof metarString !== 'string') {
      
      return null;
    }
    
    
    
    // Chercher le pattern de température dans le METAR
    // Format standard METAR: ...vent... température/point_de_rosée ...QNH...
    // Exemple: "12010KT 20/12 Q1020" où 20 est la température et 12 le point de rosée
    
    // Pattern pour capturer température/point de rosée
    // Peut être précédé par KT (vent) et suivi par Q (QNH) ou A (altimètre)
    let tempMatch = metarString.match(/\b(M?\d{1,2})\/(M?\d{1,2})\b/);
    
    if (tempMatch) {
      let temp = tempMatch[1];
      // Remplacer M par - pour les températures négatives
      temp = temp.replace('M', '-');
      const temperature = parseInt(temp);
      return temperature;
    }
    return null;
  };
  
  // Fonction pour calculer les performances
  const calculatePerformances = () => {
    setIsCalculating(true);
    setErrors([]);
    const newErrors = [];
    let hasMetarTemp = false; // Pour suivre si on a pu extraire au moins une température METAR
    
    try {
      // Vérifier qu'on a des tableaux de performance
      if (!aircraft?.advancedPerformance?.tables || aircraft.advancedPerformance.tables.length === 0) {
        newErrors.push("Aucun tableau de performance disponible. Analysez d'abord vos tableaux dans le module Gestion Avions.");
        setErrors(newErrors);
        setIsCalculating(false);
        return;
      }
      
      const tables = aircraft.advancedPerformance.tables;
      
      // CALCUL DÉCOLLAGE
      if (departureAirport) {
        // S'assurer que l'altitude est en pieds
        const altitudeFt = ensureAltitudeInFeet(
          departureAirport,
          `Départ ${departureAirport.icao}`
        );
        const metarTemp = extractTemperature(departureWeather);
        const isaTemp = performanceInterpolation.getISATemperature(altitudeFt);
        const temperature = metarTemp !== null ? metarTemp : isaTemp;
        
        if (metarTemp !== null) {
          hasMetarTemp = true;
        }
        
        
        
        // Trouver le bon tableau
        const takeoffTable = performanceInterpolation.findBestTable(tables, 'takeoff', currentWeight);
        
        if (takeoffTable) {
          const result = performanceInterpolation.calculatePerformance(
            takeoffTable,
            altitudeFt,  // Utiliser l'altitude en pieds
            temperature,
            currentWeight
          );
          if (result) {
            // Ajouter les corrections environnementales
            const metarStr = typeof departureWeather?.metar === 'string' 
              ? departureWeather.metar 
              : (departureWeather?.metar?.raw || departureWeather?.metar?.text || '');
            
            const corrections = {
              runwayWet: metarStr.includes('RA') || metarStr.includes('SN'),
              headwind: extractHeadwind(departureWeather),
              tailwind: extractTailwind(departureWeather)
            };
            
            if (result.groundRoll) {
              result.groundRollCorrected = performanceInterpolation.applyCorrections(
                result.groundRoll,
                corrections
              );
            }
            if (result.distance50ft) {
              result.distance50ftCorrected = performanceInterpolation.applyCorrections(
                result.distance50ft,
                corrections
              );
            }

            result.airport = departureAirport;
            
            // Ajouter la suggestion de piste
            const windInfo = extractWindInfo(departureWeather);
            result.windInfo = windInfo;
            result.suggestedRunway = suggestBestRunway(departureAirport, windInfo);
            
            setTakeoffPerformance(result);
          } else {
            newErrors.push("Impossible d'interpoler les données de décollage");
          }
        } else {
          newErrors.push("Aucun tableau de décollage trouvé dans les performances extraites");
        }
      }
      
      // CALCUL ATTERRISSAGE
      if (arrivalAirport) {
        // S'assurer que l'altitude est en pieds
        const altitudeFt = ensureAltitudeInFeet(
          arrivalAirport,
          `Arrivée ${arrivalAirport.icao}`
        );        
        const metarTemp = extractTemperature(arrivalWeather);
        const isaTemp = performanceInterpolation.getISATemperature(altitudeFt);
        const temperature = metarTemp !== null ? metarTemp : isaTemp;
        
        if (metarTemp !== null) {
          hasMetarTemp = true;
        }
        
        
        
        // Poids estimé à l'atterrissage (à améliorer avec le calcul de carburant)
        const landingWeight = currentWeight - 50; // Estimation simple
        
        // Trouver le bon tableau
        const landingTable = performanceInterpolation.findBestTable(tables, 'landing', landingWeight);
        
        if (landingTable) {
          const result = performanceInterpolation.calculatePerformance(
            landingTable,
            altitudeFt,  // Utiliser l'altitude en pieds
            temperature,
            landingWeight
          );

          if (result) {
            // Ajouter les corrections environnementales
            const metarStr = typeof arrivalWeather?.metar === 'string' 
              ? arrivalWeather.metar 
              : (arrivalWeather?.metar?.raw || arrivalWeather?.metar?.text || '');
            
            const corrections = {
              runwayWet: metarStr.includes('RA') || metarStr.includes('SN'),
              headwind: extractHeadwind(arrivalWeather),
              tailwind: extractTailwind(arrivalWeather)
            };
            
            if (result.groundRoll) {
              result.groundRollCorrected = performanceInterpolation.applyCorrections(
                result.groundRoll,
                corrections
              );
            }
            if (result.distance50ft) {
              result.distance50ftCorrected = performanceInterpolation.applyCorrections(
                result.distance50ft,
                corrections
              );
            }

            result.airport = arrivalAirport;
            result.weightUsed = landingWeight;
            result.corrections = corrections;
            
            // Ajouter la suggestion de piste
            const windInfo = extractWindInfo(arrivalWeather);
            result.windInfo = windInfo;
            result.suggestedRunway = suggestBestRunway(arrivalAirport, windInfo);
            
            setLandingPerformance(result);
          } else {
            newErrors.push("Impossible d'interpoler les données d'atterrissage");
          }
        } else {
          newErrors.push("Aucun tableau d'atterrissage trouvé dans les performances extraites");
        }
      }
      
      // CALCUL POUR LES ALTERNATES
      if (alternates && alternates.length > 0) {
        const altPerfs = [];
        
        for (const alternate of alternates) {
          const altIcao = alternate?.icao || alternate?.code || alternate?.id;
          const altWeather = altIcao ? getWeatherByIcao(altIcao) : null;
          const altitudeFt = ensureAltitudeInFeet(
            alternate,
            `Alternate ${altIcao || 'Unknown'}`
          );
          const temperature = extractTemperature(altWeather) ||
                            performanceInterpolation.getISATemperature(altitudeFt);
          
          const landingTable = performanceInterpolation.findBestTable(tables, 'landing', currentWeight - 30);
          
          if (landingTable) {
            const result = performanceInterpolation.calculatePerformance(
              landingTable,
              altitudeFt,  // Utiliser l'altitude en pieds
              temperature,
              currentWeight - 30
            );

            if (result) {
              result.airport = alternate;
              result.weather = altWeather;
              result.temperatureUsed = temperature;
              altPerfs.push(result);
            }
          }
        }
        
        setAlternatePerformances(altPerfs);
      }
      
      // Mettre à jour la source de température utilisée
      setTemperatureSource(hasMetarTemp ? 'METAR' : 'ISA');
      
      setErrors(newErrors);
    } catch (error) {
      console.error('Erreur lors du calcul des performances:', error);
      newErrors.push(`Erreur de calcul: ${error.message}`);
      setErrors(newErrors);
    } finally {
      setIsCalculating(false);
    }
  };
  
  // Extraire les informations de vent du METAR
  const extractWindInfo = (weather) => {
    if (!weather?.metar) return { direction: 0, speed: 0 };
    
    // S'assurer que metar est une chaîne
    const metarStr = typeof weather.metar === 'string' 
      ? weather.metar 
      : (weather.metar?.raw || weather.metar?.text || '');
    
    if (!metarStr) return { direction: 0, speed: 0 };
    
    // Pattern pour extraire direction et vitesse du vent
    const windMatch = metarStr.match(/(\d{3})(\d{2,3})(?:G\d{2,3})?KT/);
    if (windMatch) {
      return {
        direction: parseInt(windMatch[1]),
        speed: parseInt(windMatch[2])
      };
    }
    
    // Vent calme
    if (metarStr.includes('00000KT')) {
      return { direction: 0, speed: 0 };
    }
    
    return { direction: 0, speed: 0 };
  };
  
  // Suggérer la meilleure piste basée sur le vent
  const suggestBestRunway = (airport, windInfo) => {
    if (!airport || !windInfo || windInfo.speed === 0) return null;
    
    // Liste des pistes connues pour certains aéroports français
    const runwayDatabase = {
      'LFST': [{ name: '02/20', direction: 20 }],
      'LFGA': [{ name: '02/20', direction: 20 }],
      'LFSG': [{ name: '02/20', direction: 20 }],
      'LFGC': [{ name: '08/26', direction: 80 }],
      // Ajouter d'autres aéroports si nécessaire
    };
    
    const airportCode = airport?.icao || airport?.code || airport?.name;
    const runways = runwayDatabase[airportCode];
    
    if (!runways || runways.length === 0) {
      // Estimation générale si pas de données de piste
      // Suggérer une piste alignée avec le vent
      const suggestedDirection = Math.round(windInfo.direction / 10) * 10;
      const runway1 = String(Math.round(suggestedDirection / 10)).padStart(2, '0');
      const oppositeDir = (suggestedDirection + 180) % 360;
      const runway2 = String(Math.round(oppositeDir / 10)).padStart(2, '0');
      
      // Déterminer quelle extrémité utiliser
      const windAngle = windInfo.direction;
      const useFirstEnd = Math.abs(windAngle - suggestedDirection) < 90;
      
      return {
        suggested: useFirstEnd ? runway1 : runway2,
        runwayPair: `${runway1}/${runway2}`,
        headwind: Math.round(windInfo.speed * Math.cos((windAngle - (useFirstEnd ? suggestedDirection : oppositeDir)) * Math.PI / 180)),
        crosswind: Math.round(windInfo.speed * Math.sin((windAngle - (useFirstEnd ? suggestedDirection : oppositeDir)) * Math.PI / 180))
      };
    }
    
    // Calculer la meilleure piste parmi celles disponibles
    let bestRunway = null;
    let maxHeadwind = -Infinity;
    
    runways.forEach(runway => {
      // Calculer pour chaque extrémité de la piste
      [runway.direction, (runway.direction + 180) % 360].forEach(dir => {
        const angleDiff = (windInfo.direction - dir + 360) % 360;
        const headwind = windInfo.speed * Math.cos(angleDiff * Math.PI / 180);
        
        if (headwind > maxHeadwind) {
          maxHeadwind = headwind;
          const runwayNumber = String(Math.round(dir / 10)).padStart(2, '0');
          bestRunway = {
            suggested: runwayNumber,
            runwayPair: runway.name,
            headwind: Math.round(Math.abs(headwind)),
            crosswind: Math.round(windInfo.speed * Math.sin(angleDiff * Math.PI / 180))
          };
        }
      });
    });
    
    return bestRunway;
  };
  
  // Extraire le vent de face du METAR
  const extractHeadwind = (weather) => {
    const windInfo = extractWindInfo(weather);
    return windInfo.speed * 0.7; // Estimation approximative
  };
  
  // Extraire le vent arrière du METAR
  const extractTailwind = (weather) => {
    // Simplification - à améliorer avec la direction de piste
    return 0;
  };
  
  // Calculer automatiquement au chargement
  useEffect(() => {
    if (aircraft?.advancedPerformance?.tables && aircraft.advancedPerformance.tables.length > 0) {
      calculatePerformances();
    }
  }, [aircraft?.advancedPerformance, departureAirport?.icao, arrivalAirport?.icao, currentWeight]);
  
  // Composant pour afficher une carte de performance
  const PerformanceCard = ({ title, icon: Icon, performance, type }) => {
    if (!performance) return null;
    
    const hasCorrections = performance.corrections && 
      (performance.corrections.runwayWet || 
       performance.corrections.headwind || 
       performance.corrections.tailwind);
    
    return (
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
          <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.flex.start)}>
            <Icon size={20} style={{ marginRight: '8px' }} />
            {title}
          </h4>
          {performance.confidence && (
            <span style={sx.combine(
              sx.text.xs,
              sx.spacing.px(2),
              sx.spacing.py(1),
              { 
                backgroundColor: performance.confidence > 0.8 ? '#10b981' : '#f59e0b',
                color: 'white',
                borderRadius: '4px'
              }
            )}>
              Confiance: {Math.round(performance.confidence * 100)}%
            </span>
          )}
        </div>
        
        {/* Aéroport et conditions */}
        <div style={sx.combine(sx.bg.gray, sx.spacing.p(3), sx.spacing.mb(3), { borderRadius: '6px' })}>
          <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
                {performance.airport?.icao || performance.airport?.code || performance.airport?.id || 'N/A'} - {performance.airport?.name || ''}
              </p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                Élévation: {Math.round(performance.altitudeUsed)} ft / {Math.round(performance.altitudeUsed / 3.28084)} m
              </p>
              {/* Afficher la piste suggérée */}
              {performance.suggestedRunway && (
                <p style={sx.combine(sx.text.xs, sx.spacing.mt(1), { color: '#059669' })}>
                  <Plane size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Piste suggérée: <strong>{performance.suggestedRunway.suggested}</strong> ({performance.suggestedRunway.runwayPair})
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={sx.combine(sx.text.sm)}>
                <Thermometer size={14} style={{ display: 'inline', marginRight: '4px' }} />
                {performance.temperatureUsed}°C
              </p>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                {performance.weather ? 'METAR' : 'ISA'}
              </p>
              {/* Afficher les informations de vent */}
              {performance.windInfo && performance.windInfo.speed > 0 && (
                <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
                  <Wind size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {performance.windInfo.direction}° / {performance.windInfo.speed} kt
                </p>
              )}
            </div>
          </div>
          
          {performance.weather?.metar && (
            <p style={sx.combine(sx.text.xs, sx.text.secondary, { 
              fontFamily: 'monospace',
              backgroundColor: 'white',
              padding: '8px',
              borderRadius: '4px',
              marginTop: '8px'
            })}>
              {typeof performance.weather.metar === 'string' 
                ? performance.weather.metar 
                : (performance.weather.metar?.raw || performance.weather.metar?.text || JSON.stringify(performance.weather.metar))}
            </p>
          )}
        </div>
        
        {/* Distances calculées */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
              Roulage au sol
            </p>
            <p style={sx.combine(sx.text.xl, sx.text.bold)}>
              {performance.groundRoll || '--'} m
            </p>
            {hasCorrections && performance.groundRollCorrected && (
              <p style={sx.combine(sx.text.sm, sx.text.accent)}>
                Corrigé: {performance.groundRollCorrected} m
              </p>
            )}
          </div>
          
          <div>
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
              Distance 50ft/15m
            </p>
            <p style={sx.combine(sx.text.xl, sx.text.bold)}>
              {performance.distance50ft || '--'} m
            </p>
            {hasCorrections && performance.distance50ftCorrected && (
              <p style={sx.combine(sx.text.sm, sx.text.accent)}>
                Corrigé: {performance.distance50ftCorrected} m
              </p>
            )}
          </div>
        </div>
        
        {/* Marges de sécurité */}
        {(performance.groundRollWithMargin || performance.distance50ftWithMargin) && (
          <div style={sx.combine(
            sx.components.alert.base,
            sx.components.alert.warning,
            sx.spacing.mt(3)
          )}>
            <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>
              Avec marge de sécurité (15%)
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              {performance.groundRollWithMargin && (
                <span style={sx.text.xs}>
                  Sol: {performance.groundRollWithMargin} m
                </span>
              )}
              {performance.distance50ftWithMargin && (
                <span style={sx.text.xs}>
                  50ft: {performance.distance50ftWithMargin} m
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Corrections appliquées */}
        {hasCorrections && (
          <div style={sx.combine(sx.spacing.mt(3), sx.text.xs, sx.text.secondary)}>
            <p style={sx.text.bold}>Corrections appliquées:</p>
            {performance.corrections.runwayWet && <p>• Piste mouillée (+15%)</p>}
            {performance.corrections.headwind > 0 && <p>• Vent de face: {performance.corrections.headwind} kt</p>}
            {performance.corrections.tailwind > 0 && <p>• Vent arrière: {performance.corrections.tailwind} kt</p>}
            {performance.suggestedRunway?.crosswind && Math.abs(performance.suggestedRunway.crosswind) > 5 && (
              <p>• Vent traversier: {Math.abs(performance.suggestedRunway.crosswind)} kt</p>
            )}
          </div>
        )}
        
        {/* Source du tableau */}
        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
          Source: {performance.conditions?.tableUsed || 'Tableau de performance'}
        </p>
        
        {/* Détails de l'interpolation */}
        {performance.interpolationDetails && (
          <div style={sx.combine(sx.spacing.mt(3), sx.spacing.p(2), sx.bg.gray, { borderRadius: '4px' })}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={sx.combine(
                sx.text.xs,
                sx.text.bold,
                sx.flex.start,
                { 
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#3b82f6'
                }
              )}
            >
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span style={{ marginLeft: '4px' }}>Détails du calcul d'interpolation</span>
            </button>
            
            {showDetails && (
              <div style={sx.combine(sx.spacing.mt(2), sx.text.xs)}>
                <p style={sx.text.bold}>Méthode: {performance.interpolationDetails.method}</p>
                
                <p style={sx.combine(sx.spacing.mt(1), sx.text.bold)}>Cibles:</p>
                <ul style={{ marginLeft: '16px' }}>
                  <li>Altitude: {performance.interpolationDetails.targetAltitude} ft</li>
                  <li>Température: {performance.interpolationDetails.targetTemperature}°C</li>
                </ul>
                
                <p style={sx.combine(sx.spacing.mt(2), sx.text.bold)}>Points du tableau utilisés:</p>
                {performance.interpolationDetails.dataPointsUsed && 
                 performance.interpolationDetails.dataPointsUsed.length > 0 ? (
                  <table style={{ width: '100%', marginTop: '8px', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '4px' }}>Alt (ft)</th>
                        <th style={{ textAlign: 'left', padding: '4px' }}>Temp (°C)</th>
                        <th style={{ textAlign: 'left', padding: '4px' }}>Roulage</th>
                        <th style={{ textAlign: 'left', padding: '4px' }}>50ft/15m</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.interpolationDetails.dataPointsUsed.map((point, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '4px' }}>{point.altitude}</td>
                          <td style={{ padding: '4px' }}>{point.temperature}</td>
                          <td style={{ padding: '4px' }}>{point.groundRoll || '--'} m</td>
                          <td style={{ padding: '4px' }}>{point.distance50ft || '--'} m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={sx.text.secondary}>Aucun point disponible</p>
                )}
                
                <p style={sx.combine(sx.spacing.mt(2), sx.text.bold)}>Plages disponibles dans le tableau:</p>
                <ul style={{ marginLeft: '16px', marginTop: '4px' }}>
                  <li>Altitudes: {performance.interpolationDetails.altitudesInTable?.join(', ')} ft</li>
                  <li>Températures: {performance.interpolationDetails.temperaturesInTable?.join(', ')} °C</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  if (!aircraft?.advancedPerformance?.tables || aircraft.advancedPerformance.tables.length === 0) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
        <AlertTriangle size={48} style={{ margin: '0 auto 16px', color: '#f59e0b' }} />
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
          Performances non disponibles
        </h3>
        <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(4))}>
          Aucune analyse IA des performances disponible pour cet avion.
        </p>
        <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
          Allez dans le module "Gestion Avions" → Modifier l'avion → Onglet "🤖 Performances IA" 
          pour analyser vos tableaux de performances.
        </p>
      </div>
    );
  }
  
  return (
    <div>
      {/* En-tête avec bouton de recalcul */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          <Calculator size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
          Calcul des performances avec tableaux extraits
        </h3>
        <div style={sx.flex.center}>
          <button
            onClick={() => setShowExtractedTables(!showExtractedTables)}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.secondary,
              { marginRight: '8px' }
            )}
          >
            <Table size={16} style={{ marginRight: '4px' }} />
            Voir tableaux ({aircraft.advancedPerformance.tables.length})
          </button>
          <button
            onClick={calculatePerformances}
            disabled={isCalculating}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.primary,
              isCalculating && { opacity: 0.5, cursor: 'not-allowed' }
            )}
          >
            <RefreshCw size={16} style={{ marginRight: '4px' }} />
            {isCalculating ? 'Calcul...' : 'Recalculer'}
          </button>
        </div>
      </div>
      
      {/* Informations sur les données utilisées */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
        <Info size={16} />
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold)}>
            Données utilisées pour les calculs:
          </p>
          <ul style={sx.combine(sx.text.xs, { marginLeft: '16px', marginTop: '4px' })}>
            <li>• Tableaux extraits: {aircraft.advancedPerformance.tables.length}</li>
            <li>• Masse actuelle: {currentWeight} kg</li>
            <li>• Températures: {temperatureSource === 'METAR' ? 'METAR (données météo réelles)' : 'ISA standard'}</li>
            <li>• Méthode: Interpolation bilinéaire</li>
          </ul>
        </div>
      </div>
      
      {/* Affichage des tableaux extraits */}
      {showExtractedTables && aircraft.advancedPerformance?.tables && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4), sx.spacing.p(4))}>
          <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
            <Table size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Tableaux extraits disponibles
          </h4>
          
          {aircraft.advancedPerformance.tables.map((table, index) => (
            <div key={index} style={sx.combine(sx.spacing.mb(4), sx.spacing.p(3), sx.bg.gray, { borderRadius: '6px' })}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                {index + 1}. {table.table_name || `Tableau ${index + 1}`}
              </h5>
              
              <div style={sx.text.xs}>
                <p>Type: {table.table_type || 'Non spécifié'}</p>
                {table.conditions && <p>Conditions: {table.conditions}</p>}
                <p>Points de données: {table.data?.length || 0}</p>
                
                {/* Aperçu des données */}
                {table.data && table.data.length > 0 && (
                  <div style={sx.spacing.mt(2)}>
                    <p style={sx.text.bold}>Aperçu des données (5 premiers):</p>
                    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                      <table style={{ fontSize: '10px', width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f3f4f6' }}>
                            {Object.keys(table.data[0]).map(key => (
                              <th key={key} style={{ padding: '4px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.data.slice(0, 5).map((row, rowIdx) => (
                            <tr key={rowIdx}>
                              {Object.values(row).map((value, colIdx) => (
                                <td key={colIdx} style={{ padding: '4px', borderBottom: '1px solid #f3f4f6' }}>
                                  {value !== null ? value : '--'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {table.data.length > 5 && (
                        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
                          ... et {table.data.length - 5} lignes supplémentaires
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Erreurs */}
      {errors.length > 0 && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(4))}>
          <AlertTriangle size={16} />
          <div>
            {errors.map((error, index) => (
              <p key={index} style={sx.text.sm}>{error}</p>
            ))}
          </div>
        </div>
      )}
      
      {/* Performances calculées */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
        {/* Décollage */}
        {takeoffPerformance && (
          <PerformanceCard
            title="Performance de décollage"
            icon={Plane}
            performance={takeoffPerformance}
            type="takeoff"
          />
        )}
        
        {/* Atterrissage */}
        {landingPerformance && (
          <PerformanceCard
            title="Performance d'atterrissage"
            icon={Plane}
            performance={landingPerformance}
            type="landing"
          />
        )}
        
        {/* Alternates */}
        {alternatePerformances.map((perf, index) => (
          <PerformanceCard
            key={index}
            title={`Alternate: ${perf.airport?.icao}`}
            icon={MapPin}
            performance={perf}
            type="landing"
          />
        ))}
      </div>
      
      {/* Message si aucun calcul disponible */}
      {!takeoffPerformance && !landingPerformance && alternatePerformances.length === 0 && !isCalculating && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
          <Info size={32} style={{ margin: '0 auto 16px', color: '#6b7280' }} />
          <p style={sx.text.secondary}>
            Configurez votre navigation pour voir les calculs de performance
          </p>
        </div>
      )}
    </div>
  );
};

export default AdvancedPerformanceCalculator;
