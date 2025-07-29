// src/modules/weather/components/WeatherModule.jsx
import React, { useEffect, useState } from 'react';
import { useFlightSystem } from '@context/FlightSystemContext';
import { useWeatherStore } from '../store/weatherStore';
import { weatherService } from '../services/weatherService';
import { MeteoCharts } from './RouteWeatherChart';
import { Cloud, Wind, Eye, Droplets, Gauge, Navigation, RefreshCw, Settings, AlertTriangle, MapPin, CheckCircle } from 'lucide-react';

export const WeatherModule = () => {
  const { waypoints = [], flightParams = { altitude: 0, trueAirspeed: 0 }, selectedAircraft } = useFlightSystem();
  const { 
    airportWeather = new Map(),
    routeWeather = [],
    windsAloft = new Map(),
    loading,
    error,
    lastUpdate,
    apiKey,
    setApiKey,
    fetchAirportWeather,
    fetchRouteWinds,
    isDataStale,
    formatWeatherSummary,
    calculateEffectiveWind
  } = useWeatherStore();

  const [showApiConfig, setShowApiConfig] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [selectedAirport, setSelectedAirport] = useState(null);

  // Extraire les codes OACI des waypoints
  const departureIcao = waypoints[0]?.name;
  const arrivalIcao = waypoints[waypoints.length - 1]?.name;

  // Charger la météo au montage et quand les waypoints changent
  useEffect(() => {
    if (apiKey && departureIcao && arrivalIcao) {
      fetchAirportWeather(departureIcao);
      fetchAirportWeather(arrivalIcao);
    }
  }, [departureIcao, arrivalIcao, apiKey]);

  // Charger les vents en altitude
  useEffect(() => {
    if (apiKey && waypoints.length > 0 && flightParams.altitude) {
      const flightLevel = Math.round(flightParams.altitude / 100);
      fetchRouteWinds(waypoints, flightLevel);
    }
  }, [waypoints, flightParams.altitude, apiKey]);

  const handleApiKeySubmit = () => {
    if (tempApiKey) {
      setApiKey(tempApiKey);
      setShowApiConfig(false);
    }
  };

  const handleRefresh = () => {
    if (departureIcao) fetchAirportWeather(departureIcao);
    if (arrivalIcao) fetchAirportWeather(arrivalIcao);
    if (waypoints.length > 0 && flightParams.altitude) {
      const flightLevel = Math.round(flightParams.altitude / 100);
      fetchRouteWinds(waypoints, flightLevel);
    }
  };

  // Formatter l'heure
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Fonction pour détecter les phénomènes météo significatifs
  const detectWeatherPhenomena = (weatherData) => {
    if (!weatherData || !weatherData.current) return [];
    
    const phenomena = [];
    const { current } = weatherData;
    const temp = current.temperature - 273.15;
    const visibility = current.visibility;
    const cloudCover = current.cloudCover;
    const precipitation = current.precipitation || 0;
    const humidity = current.humidity;
    const windSpeed = Math.sqrt(current.windU ** 2 + current.windV ** 2) * 1.94384;
    
    // Cumulonimbus (CB) - forte couverture nuageuse + précipitations
    if (cloudCover > 75 && precipitation > 0.5) {
      phenomena.push({ code: 'CB', description: 'Cumulonimbus', severity: 'danger' });
    }
    
    // Towering Cumulus (TCU) - couverture importante
    else if (cloudCover > 60 && cloudCover <= 75) {
      phenomena.push({ code: 'TCU', description: 'Towering Cumulus', severity: 'warning' });
    }
    
    // Thunderstorm (TS) - CB + conditions orageuses
    if (phenomena.some(p => p.code === 'CB') && precipitation > 2) {
      phenomena.push({ code: 'TS', description: 'Orage', severity: 'danger' });
    }
    
    // Rain (RA) / Snow (SN) / Freezing Rain (FZRA)
    if (precipitation > 0) {
      if (temp > 0) {
        if (precipitation > 0.5) {
          phenomena.push({ code: 'RA', description: 'Pluie', severity: 'caution' });
        } else {
          phenomena.push({ code: 'DZ', description: 'Bruine', severity: 'info' });
        }
        
        // Freezing rain conditions
        if (temp < 3 && temp > -2) {
          phenomena.push({ code: 'FZRA', description: 'Pluie verglaçante', severity: 'danger' });
        }
      } else {
        phenomena.push({ code: 'SN', description: 'Neige', severity: 'warning' });
      }
    }
    
    // Showers (SH) - précipitations intermittentes
    if (precipitation > 0 && precipitation < 0.5 && cloudCover < 50) {
      phenomena.push({ code: 'SH', description: 'Averses', severity: 'caution' });
    }
    
    // Fog (FG) / Mist (BR) / Haze (HZ)
    if (visibility < 1000) {
      phenomena.push({ code: 'FG', description: 'Brouillard', severity: 'danger' });
    } else if (visibility < 5000) {
      if (humidity > 80) {
        phenomena.push({ code: 'BR', description: 'Brume', severity: 'warning' });
      } else {
        phenomena.push({ code: 'HZ', description: 'Brume sèche', severity: 'caution' });
      }
    }
    
    // Strong winds
    if (windSpeed > 25) {
      phenomena.push({ code: 'WS', description: 'Vent fort', severity: 'warning' });
    }
    
    // Gusts (if wind variations significant - simplified)
    if (windSpeed > 15) {
      const gustFactor = 1.5;
      if (windSpeed * gustFactor > windSpeed + 10) {
        phenomena.push({ code: 'G', description: 'Rafales', severity: 'caution' });
      }
    }
    
    return phenomena;
  };

  // Composant pour afficher la météo d'un aéroport
  const AirportWeatherCard = ({ icaoCode, label }) => {
    const weather = airportWeather.get(icaoCode);
    
    if (!weather) {
      return (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#f9fafb', 
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            {icaoCode ? `Chargement météo ${icaoCode}...` : 'Aucun aéroport défini'}
          </p>
        </div>
      );
    }

    const { current, metar, taf, coordinates } = weather;
    const temp = Math.round(current.temperature - 273.15);
    const dewpoint = weatherService.calculateDewpoint(current.temperature, current.humidity);
    const pressure = Math.round(current.pressure / 100);
    const windDir = Math.round(Math.atan2(-current.windU, -current.windV) * 180 / Math.PI + 180);
    const windSpeed = Math.round(Math.sqrt(current.windU ** 2 + current.windV ** 2) * 1.94384);
    const visibility = Math.round(current.visibility / 1000);
    const cloudCover = Math.round(current.cloudCover);
    
    // Détecter les phénomènes météo
    const phenomena = detectWeatherPhenomena(weather);

    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white', 
        borderRadius: '8px',
        border: '2px solid #3b82f6',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1f2937',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <MapPin size={20} />
            {label} - {icaoCode}
          </h3>
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            {coordinates.name} • Lat: {coordinates.lat.toFixed(4)}° Lon: {coordinates.lon.toFixed(4)}°
          </p>
        </div>

        {/* Conditions actuelles */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <Cloud size={24} style={{ color: '#3b82f6' }} />
            </div>
            <p style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>{temp}°C</p>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Température</p>
          </div>

          <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <Wind size={24} style={{ color: '#10b981' }} />
            </div>
            <p style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>{windDir}°/{windSpeed}kt</p>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Vent</p>
          </div>

          <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <Eye size={24} style={{ color: '#f59e0b' }} />
            </div>
            <p style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>{visibility}km</p>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Visibilité</p>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <Gauge size={24} style={{ color: '#8b5cf6' }} />
            </div>
            <p style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{pressure} hPa</p>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>QNH</p>
          </div>

          <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <Droplets size={24} style={{ color: '#06b6d4' }} />
            </div>
            <p style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{dewpoint}°C</p>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Point de rosée</p>
          </div>

          <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <Cloud size={24} style={{ color: '#6b7280' }} />
            </div>
            <p style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>{cloudCover}%</p>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Couverture</p>
          </div>
        </div>
        
        {/* Phénomènes météo significatifs */}
        <div style={{ 
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: phenomena.length > 0 ? 
            (phenomena.some(p => p.severity === 'danger') ? '#fee2e2' :
             phenomena.some(p => p.severity === 'warning') ? '#fef3c7' :
             phenomena.some(p => p.severity === 'caution') ? '#e0f2fe' : '#f0fdf4') :
            '#f0fdf4',
          borderRadius: '6px',
          border: `1px solid ${
            phenomena.length > 0 ?
              (phenomena.some(p => p.severity === 'danger') ? '#fecaca' :
               phenomena.some(p => p.severity === 'warning') ? '#fde68a' :
               phenomena.some(p => p.severity === 'caution') ? '#bae6fd' : '#bbf7d0') :
              '#bbf7d0'
          }`
        }}>
          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: phenomena.length > 0 ?
              (phenomena.some(p => p.severity === 'danger') ? '#dc2626' :
               phenomena.some(p => p.severity === 'warning') ? '#d97706' :
               phenomena.some(p => p.severity === 'caution') ? '#0369a1' : '#059669') :
              '#059669',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {phenomena.length > 0 ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle size={16} />
            )}
            Phénomènes significatifs
          </h4>
          
          {phenomena.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {phenomena.map((pheno, index) => (
                <span key={index} style={{ 
                  padding: '4px 8px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: pheno.severity === 'danger' ? '#dc2626' :
                         pheno.severity === 'warning' ? '#d97706' :
                         pheno.severity === 'caution' ? '#0369a1' : '#059669',
                  border: `1px solid ${
                    pheno.severity === 'danger' ? '#fecaca' :
                    pheno.severity === 'warning' ? '#fde68a' :
                    pheno.severity === 'caution' ? '#bae6fd' : '#bbf7d0'
                  }`
                }}>
                  {pheno.code} - {pheno.description}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ 
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#059669'
            }}>
              RAS - Rien à signaler
            </p>
          )}
        </div>

        {/* METAR */}
        {metar && (
          <div style={{ 
            marginBottom: '12px',
            padding: '12px',
            backgroundColor: '#dbeafe',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#1e40af'
          }}>
            <strong>METAR:</strong> {metar}
          </div>
        )}

        {/* TAF */}
        {taf && (
          <div style={{ 
            padding: '12px',
            backgroundColor: '#e0e7ff',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#4338ca'
          }}>
            <strong>TAF:</strong> {taf}
          </div>
        )}
      </div>
    );
  };

  // Composant pour afficher les vents en altitude
  const WindsAloftDisplay = () => {
    const flightLevel = Math.round(flightParams.altitude / 100);
    const windData = Array.from(windsAloft.values()).filter(w => w.flightLevel === flightLevel);

    if (windData.length === 0) {
      return (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#f9fafb', 
          borderRadius: '8px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          Aucune donnée de vent en altitude disponible
        </div>
      );
    }

    return (
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Waypoint</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>FL{flightLevel}</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>Direction</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>Vitesse</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>Impact</th>
            </tr>
          </thead>
          <tbody>
            {windData.map((data, index) => {
              const effectiveWind = calculateEffectiveWind(
                flightParams.trueAirspeed,
                90, // Route approximative Est-Ouest
                data.winds?.direction || 0,
                data.winds?.speed || 0
              );

              return (
                <tr key={index} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{data.waypoint}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>FL{data.flightLevel}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {data.winds?.direction || 0}°
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {data.winds?.speed || 0} kt
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{ 
                      color: effectiveWind.headwind > 0 ? '#ef4444' : '#10b981',
                      fontWeight: '600'
                    }}>
                      {effectiveWind.headwind > 0 ? '+' : ''}{effectiveWind.headwind} kt
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Configuration API
  if (showApiConfig) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
        <div style={{ 
          backgroundColor: '#fef3c7', 
          border: '2px solid #f59e0b', 
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#92400e', 
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Settings size={24} />
            Configuration API Météo-France
          </h3>
          
          <p style={{ marginBottom: '16px', color: '#92400e' }}>
            Pour utiliser le module météo, vous devez configurer une clé API Météo-France.
          </p>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Clé API
            </label>
            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Votre clé API Météo-France"
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px' 
              }}
            />
          </div>
          
          <div style={{ 
            padding: '12px',
            backgroundColor: '#e0f2fe',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#0c4a6e',
            marginBottom: '16px'
          }}>
            <p style={{ margin: '0', fontWeight: '600' }}>
              💡 Comment obtenir une clé API :
            </p>
            <ol style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
              <li>Rendez-vous sur <a href="https://portail-api.meteofrance.fr" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1' }}>portail-api.meteofrance.fr</a></li>
              <li>Créez un compte développeur</li>
              <li>Souscrivez aux API AROME et ARPEGE</li>
              <li>Copiez votre clé API</li>
            </ol>
          </div>
          
          <button
            onClick={handleApiKeySubmit}
            disabled={!tempApiKey}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: tempApiKey ? '#3b82f6' : '#e5e7eb',
              color: tempApiKey ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: tempApiKey ? 'pointer' : 'not-allowed'
            }}
          >
            Valider la clé API
          </button>
          
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <button
              onClick={() => {
                setApiKey('demo');
                setShowApiConfig(false);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#3b82f6',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Utiliser le mode démo
            </button>
            <p style={{ 
              marginTop: '8px', 
              fontSize: '12px', 
              color: '#6b7280' 
            }}>
              Mode démo avec données simulées pour tester l'interface
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Cloud size={28} />
            Informations Météorologiques
          </h2>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {apiKey === 'demo' && (
              <span style={{ 
                fontSize: '12px', 
                color: '#f59e0b',
                backgroundColor: '#fef3c7',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>
                Mode démo
              </span>
            )}
            {lastUpdate && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Mis à jour: {formatTime(lastUpdate)}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: loading ? 0.5 : 1
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
            <button
              onClick={() => setShowApiConfig(true)}
              style={{
                padding: '8px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
        
        {error && (
          <div style={{ 
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
      </div>

      {/* Météo des aéroports */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px' 
        }}>
          ⛅ Conditions aux aérodromes
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {departureIcao && (
            <AirportWeatherCard icaoCode={departureIcao} label="Départ" />
          )}
          {arrivalIcao && arrivalIcao !== departureIcao && (
            <AirportWeatherCard icaoCode={arrivalIcao} label="Arrivée" />
          )}
        </div>
      </div>

      {/* Vents en altitude */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1f2937', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Wind size={20} />
          Vents en altitude - FL{Math.round(flightParams.altitude / 100)}
        </h3>
        
        <WindsAloftDisplay />
      </div>

      {/* Informations supplémentaires */}
      <div style={{ 
        padding: '16px',
        backgroundColor: '#e0f2fe',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#0c4a6e'
      }}>
        <p style={{ margin: '0', fontWeight: '600' }}>
          ℹ️ Informations sur les modèles météo :
        </p>
        <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
          <li><strong>AROME</strong> : Modèle haute résolution (1.3km) pour la France, prévisions jusqu'à 42h</li>
          <li><strong>ARPEGE</strong> : Modèle global (10km Europe), prévisions jusqu'à 114h</li>
          <li>Les METAR et TAF affichés sont générés à partir des données de prévision</li>
          <li>Consultez toujours les bulletins météo officiels avant le vol</li>
        </ul>
      </div>

      {/* Cartes météorologiques TEMSI et WINTEM */}
      <MeteoCharts selectedAltitude={flightParams.altitude} />
    </div>
  );
};