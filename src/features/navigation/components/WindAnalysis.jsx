// src/features/navigation/components/WindAnalysis.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Wind, AlertTriangle, Navigation, Clock, Compass, TrendingUp, Info, Loader } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useUnits } from '@hooks/useUnits';

const WindAnalysis = ({ waypoints, selectedAircraft, plannedAltitude = 3000 }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [windCorrection, setWindCorrection] = useState({});
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const { format, convert, getSymbol } = useUnits();
  
  // Récupérer toutes les données météo et les actions depuis le store
  const weatherData = useWeatherStore(state => state.weatherData) || {};
  const fetchWeather = useWeatherStore(state => state.fetchWeather);
  
  // Récupérer les données météo pour le départ et l'arrivée
  const departureIcao = waypoints[0]?.name;
  const arrivalIcao = waypoints[waypoints.length - 1]?.name;
  
  const departureWeather = departureIcao && weatherData[departureIcao] ? weatherData[departureIcao].metar : null;
  const arrivalWeather = arrivalIcao && weatherData[arrivalIcao] ? weatherData[arrivalIcao].metar : null;
  
  // Charger automatiquement les données météo si elles ne sont pas disponibles
  useEffect(() => {
    const loadWeatherData = async () => {
      if (departureIcao && !departureWeather) {
        console.log(`🌤️ Chargement automatique météo pour ${departureIcao}`);
        setIsLoadingWeather(true);
        try {
          await fetchWeather(departureIcao);
        } catch (error) {
          console.error(`Erreur chargement météo ${departureIcao}:`, error);
        }
      }
      
      if (arrivalIcao && !arrivalWeather && arrivalIcao !== departureIcao) {
        console.log(`🌤️ Chargement automatique météo pour ${arrivalIcao}`);
        try {
          await fetchWeather(arrivalIcao);
        } catch (error) {
          console.error(`Erreur chargement météo ${arrivalIcao}:`, error);
        }
      }
      setIsLoadingWeather(false);
    };
    
    if ((departureIcao && !departureWeather) || (arrivalIcao && !arrivalWeather)) {
      loadWeatherData();
    }
  }, [departureIcao, arrivalIcao, departureWeather, arrivalWeather, fetchWeather]);
  
  // Debug: Afficher le contenu des données météo
  useEffect(() => {
    if (departureWeather || arrivalWeather) {
      console.log('📊 Données météo disponibles:', {
        departure: departureWeather,
        arrival: arrivalWeather
      });
    }
  }, [departureWeather, arrivalWeather]);
  
  // Calculer l'impact du vent
  const windAnalysis = useMemo(() => {
    if (!selectedAircraft || waypoints.length < 2) return null;
    
    const departure = waypoints[0];
    const arrival = waypoints[waypoints.length - 1];
    
    // Calcul de la route vraie entre départ et arrivée
    const calculateTrueCourse = (from, to) => {
      const lat1 = from.lat * Math.PI / 180;
      const lat2 = to.lat * Math.PI / 180;
      const dLon = (to.lon - from.lon) * Math.PI / 180;
      
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      return (bearing + 360) % 360;
    };
    
    const trueCourse = calculateTrueCourse(departure, arrival);
    const tas = selectedAircraft.cruiseSpeedKt || 100; // True Air Speed (toujours en kt pour les calculs)
    
    // Analyser le vent au départ
    const analyzeWind = (weather, label) => {
      // Gérer les différents formats de données météo
      if (!weather) return null;
      
      // Debug pour voir la structure
      console.log(`🌬️ Analyse vent ${label}:`, weather);
      
      // Essayer différents chemins pour accéder aux données de vent
      let windSpeed = 0;
      let windDirection = 0;
      
      // Format standard METAR parsé
      if (weather.wind) {
        windSpeed = weather.wind.speed_kts || weather.wind.speed || 0;
        windDirection = weather.wind.degrees || weather.wind.direction || 0;
      } 
      // Format avec wind_speed et wind_direction séparés
      else if (weather.wind_speed !== undefined) {
        windSpeed = weather.wind_speed?.value || 0;
        windDirection = weather.wind_direction?.value || 0;
      }
      // Format avec raw METAR - extraire manuellement
      else if (weather.raw) {
        const windMatch = weather.raw.match(/(\d{3})(\d{2,3})(?:G(\d{2,3}))?KT/);
        if (windMatch) {
          windDirection = parseInt(windMatch[1]);
          windSpeed = parseInt(windMatch[2]);
        }
      }
      
      // Si pas de vent ou vent calme
      if (windSpeed === 0) {
        return {
          label,
          windSpeed: 0,
          windDirection: 0,
          headwindComponent: 0,
          crosswindComponent: 0,
          crosswindDirection: 'nul',
          windCorrectionAngle: 0,
          groundSpeed: tas,
          impact: 'Vent calme'
        };
      }
      
      // Calcul de la composante de vent de face/arrière (headwind/tailwind)
      const windAngle = (windDirection - trueCourse + 360) % 360;
      const headwindComponent = windSpeed * Math.cos(windAngle * Math.PI / 180);
      const crosswindComponent = windSpeed * Math.sin(windAngle * Math.PI / 180);
      
      // Calcul de la dérive (Wind Correction Angle - WCA)
      const wca = Math.asin(crosswindComponent / tas) * 180 / Math.PI;
      
      // Calcul de la vitesse sol (Ground Speed)
      const groundSpeed = tas - headwindComponent;
      
      return {
        label,
        windSpeed,
        windDirection,
        headwindComponent: Math.round(headwindComponent),
        crosswindComponent: Math.round(Math.abs(crosswindComponent)),
        crosswindDirection: crosswindComponent > 0 ? 'droite' : 'gauche',
        windCorrectionAngle: Math.round(wca),
        groundSpeed: Math.round(groundSpeed),
        impact: headwindComponent > 0 ? 'Vent de face' : 'Vent arrière',
        // Versions converties pour l'affichage
        windSpeedDisplay: format(windSpeed, 'windSpeed', 0),
        groundSpeedDisplay: format(groundSpeed, 'speed', 0),
        headwindDisplay: format(Math.abs(headwindComponent), 'windSpeed', 0),
        crosswindDisplay: format(Math.abs(crosswindComponent), 'windSpeed', 0)
      };
    };
    
    const departureWind = departureWeather ? analyzeWind(departureWeather, 'Départ') : null;
    const arrivalWind = arrivalWeather ? analyzeWind(arrivalWeather, 'Arrivée') : null;
    
    // Estimation du vent moyen en route (interpolation simple)
    let averageWind = null;
    if (departureWind && arrivalWind) {
      const avgHeadwind = (departureWind.headwindComponent + arrivalWind.headwindComponent) / 2;
      const avgCrosswind = (departureWind.crosswindComponent + arrivalWind.crosswindComponent) / 2;
      const avgGroundSpeed = tas - avgHeadwind;
      
      averageWind = {
        headwindComponent: Math.round(avgHeadwind),
        crosswindComponent: Math.round(avgCrosswind),
        groundSpeed: Math.round(avgGroundSpeed),
        windCorrectionAngle: Math.round((departureWind.windCorrectionAngle + arrivalWind.windCorrectionAngle) / 2)
      };
    }
    
    // Calcul de la distance totale
    const calculateDistance = (from, to) => {
      const R = 3440.07; // Rayon de la Terre en NM
      const lat1 = from.lat * Math.PI / 180;
      const lat2 = to.lat * Math.PI / 180;
      const dLat = (to.lat - from.lat) * Math.PI / 180;
      const dLon = (to.lon - from.lon) * Math.PI / 180;
      
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      
      return R * c;
    };
    
    const totalDistance = calculateDistance(departure, arrival);
    
    // Calcul des temps de vol
    const timeNoWind = (totalDistance / tas) * 60; // en minutes
    const timeWithWind = averageWind ? (totalDistance / averageWind.groundSpeed) * 60 : timeNoWind;
    const timeDifference = timeWithWind - timeNoWind;
    
    return {
      departure: departureWind,
      arrival: arrivalWind,
      average: averageWind,
      trueCourse: Math.round(trueCourse),
      tas,
      distance: Math.round(totalDistance),
      timeNoWind: Math.round(timeNoWind),
      timeWithWind: Math.round(timeWithWind),
      timeDifference: Math.round(timeDifference),
      // Versions converties pour l'affichage
      distanceDisplay: format(totalDistance, 'distance', 1),
      tasDisplay: format(tas, 'speed', 0)
    };
  }, [waypoints, selectedAircraft, departureWeather, arrivalWeather]);
  
  // Vérifier que nous avons les données nécessaires
  if (!selectedAircraft || !waypoints || waypoints.length < 2) {
    return null;
  }

  // Si en cours de chargement
  if (isLoadingWeather) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          <Wind size={20} style={{ display: 'inline', marginRight: '8px' }} />
          Analyse du vent et impact sur le vol
        </h3>
        <div style={{
          backgroundColor: '#eff6ff',
          padding: '16px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Loader size={24} style={{ color: '#3b82f6', marginBottom: '8px', animation: 'spin 1s linear infinite' }} />
          <p style={sx.combine(sx.text.sm)}>
            Chargement des données météo...
          </p>
        </div>
      </div>
    );
  }

  // Si pas de données météo disponibles après chargement
  if (!departureWeather && !arrivalWeather) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
          <Wind size={20} style={{ display: 'inline', marginRight: '8px' }} />
          Analyse du vent et impact sur le vol
        </h3>
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '16px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <Info size={24} style={{ color: '#6b7280', marginBottom: '8px' }} />
          <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
            Aucune donnée météo disponible pour cette route.
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
            {departureIcao && arrivalIcao ? 
              `Impossible de récupérer les données météo pour ${departureIcao} et/ou ${arrivalIcao}` :
              'Définissez d\'abord des codes ICAO valides pour vos waypoints'}
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
            Vérifiez que les codes ICAO sont corrects et que le service météo est disponible.
          </p>
        </div>
      </div>
    );
  }
  
  if (!windAnalysis) {
    return null;
  }
  
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins} min`;
  };
  
  const getWindImpactColor = (difference) => {
    if (difference > 10) return '#ef4444'; // Rouge - retard important
    if (difference > 5) return '#f97316'; // Orange - retard modéré
    if (difference > -5) return '#10b981'; // Vert - impact faible
    return '#3b82f6'; // Bleu - gain de temps
  };

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      {/* En-tête avec avertissement */}
      <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold)}>
          <Wind size={20} style={{ display: 'inline', marginRight: '8px' }} />
          Analyse du vent et impact sur le vol
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={sx.combine(sx.components.button.base, sx.components.button.secondary)}
        >
          {showDetails ? 'Masquer' : 'Détails'}
        </button>
      </div>
      
      {/* Avertissement simulation */}
      <div style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '20px'
      }}>
        <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px', color: '#f59e0b' }} />
          Simulation théorique
        </p>
        <p style={sx.combine(sx.text.xs, { lineHeight: '1.5' })}>
          Ces calculs sont basés sur les conditions météo actuelles aux points de départ et d'arrivée. 
          Les conditions réelles en route peuvent varier significativement. Consultez toujours les prévisions 
          météo complètes et les vents en altitude avant le vol.
        </p>
      </div>
      
      {/* Résumé principal */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Temps sans vent */}
        <div style={{
          backgroundColor: '#f3f4f6',
          padding: '12px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
            Temps théorique (sans vent)
          </p>
          <p style={sx.combine(sx.text.xl, sx.text.bold)}>
            {formatTime(windAnalysis.timeNoWind)}
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
            @ {windAnalysis.tasDisplay} TAS
          </p>
        </div>
        
        {/* Temps avec vent */}
        <div style={{
          backgroundColor: getWindImpactColor(windAnalysis.timeDifference) + '20',
          border: `1px solid ${getWindImpactColor(windAnalysis.timeDifference)}`,
          padding: '12px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
            Temps estimé (avec vent)
          </p>
          <p style={sx.combine(sx.text.xl, sx.text.bold)}>
            {formatTime(windAnalysis.timeWithWind)}
          </p>
          <p style={sx.combine(sx.text.xs)}>
            {windAnalysis.timeDifference > 0 ? '+' : ''}{windAnalysis.timeDifference} min
          </p>
        </div>
        
        {/* Correction de cap suggérée */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #3b82f6',
          padding: '12px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>
            Correction de cap moyenne
          </p>
          <p style={sx.combine(sx.text.xl, sx.text.bold)}>
            {windAnalysis.average && windAnalysis.average.windCorrectionAngle !== 0 ? 
              `${windAnalysis.average.windCorrectionAngle > 0 ? '+' : ''}${windAnalysis.average.windCorrectionAngle}°` 
              : '0°'}
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
            Cap vrai: {windAnalysis.trueCourse}°
          </p>
        </div>
      </div>
      
      {/* Détails par segment */}
      {showDetails && (
        <>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Analyse détaillée par segment
          </h4>
          
          {/* Vent au départ */}
          {windAnalysis.departure && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                <Compass size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {windAnalysis.departure.label} ({waypoints[0].name})
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <p style={sx.text.xs}>
                    <strong>Vent:</strong> {windAnalysis.departure.windDirection}° / {windAnalysis.departure.windSpeedDisplay}
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Composante:</strong> {windAnalysis.departure.impact}
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Vent effectif:</strong> {windAnalysis.departure.headwindDisplay}
                  </p>
                </div>
                <div>
                  <p style={sx.text.xs}>
                    <strong>Vent traversier:</strong> {windAnalysis.departure.crosswindDisplay} ({windAnalysis.departure.crosswindDirection})
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Correction cap:</strong> {windAnalysis.departure.windCorrectionAngle}°
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Vitesse sol:</strong> {windAnalysis.departure.groundSpeedDisplay}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Vent à l'arrivée */}
          {windAnalysis.arrival && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                <Compass size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {windAnalysis.arrival.label} ({waypoints[waypoints.length - 1].name})
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <p style={sx.text.xs}>
                    <strong>Vent:</strong> {windAnalysis.arrival.windDirection}° / {windAnalysis.arrival.windSpeedDisplay}
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Composante:</strong> {windAnalysis.arrival.impact}
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Vent effectif:</strong> {windAnalysis.arrival.headwindDisplay}
                  </p>
                </div>
                <div>
                  <p style={sx.text.xs}>
                    <strong>Vent traversier:</strong> {windAnalysis.arrival.crosswindDisplay} ({windAnalysis.arrival.crosswindDirection})
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Correction cap:</strong> {windAnalysis.arrival.windCorrectionAngle}°
                  </p>
                  <p style={sx.text.xs}>
                    <strong>Vitesse sol:</strong> {windAnalysis.arrival.groundSpeedDisplay}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Recommandations */}
          <div style={{
            backgroundColor: '#eff6ff',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #dbeafe'
          }}>
            <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              <Info size={14} style={{ display: 'inline', marginRight: '6px' }} />
              Recommandations de vol
            </h5>
            <ul style={sx.combine(sx.text.xs, { marginLeft: '20px', lineHeight: '1.8' })}>
              <li>
                <strong>Cap magnétique suggéré:</strong> Appliquer une correction moyenne de {' '}
                {windAnalysis.average?.windCorrectionAngle || 0}° au cap vrai de {windAnalysis.trueCourse}°
              </li>
              <li>
                <strong>Carburant supplémentaire:</strong> Prévoir {' '}
                {windAnalysis.timeDifference > 0 ? `${format(Math.ceil(windAnalysis.timeDifference * (selectedAircraft?.fuelConsumptionLph || 30) / 60), 'fuel', 0)} supplémentaires` : 'aucun ajustement nécessaire'}
              </li>
              <li>
                <strong>Points de décision:</strong> Réévaluer les conditions de vent à mi-parcours pour ajuster la correction de cap
              </li>
              <li>
                <strong>Altitude optimale:</strong> Consulter les vents en altitude pour optimiser la vitesse sol
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default WindAnalysis;