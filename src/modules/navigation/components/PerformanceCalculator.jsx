// src/modules/navigation/components/PerformanceCalculator.jsx
import React, { useEffect, useState } from 'react';
import { Plane, Thermometer, Mountain, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Wind } from 'lucide-react';
import { useFlightSystem } from '@context/FlightSystemContext';
import { useVACStore } from '../../vac/store/vacStore';
import { useWeatherStore } from '../../weather/store/weatherStore';
import { getAirportElevation } from '../../../data/airportElevations';

export const PerformanceCalculator = () => {
  const { selectedAircraft, waypoints } = useFlightSystem();
  const { charts, getChartByIcao } = useVACStore();
  const { airportWeather } = useWeatherStore();
  
  const [performances, setPerformances] = useState({
    departure: null,
    arrival: null
  });

  // Codes OACI des aérodromes
  const departureIcao = waypoints[0]?.name;
  const arrivalIcao = waypoints[waypoints.length - 1]?.name;

  // Calcul de la température ISA
  const calculateISATemp = (altitudeFt) => {
    return 15 - (altitudeFt * 0.002);
  };

  // Calcul du facteur de correction
  const calculateCorrectionFactor = (altitudeFt, actualTemp) => {
    const isaTemp = calculateISATemp(altitudeFt);
    const deltaT = actualTemp - isaTemp;
    
    // Facteur = 1 + (Alt/1000 × 0.1) + (ΔT/10 × 0.1)
    const altitudeFactor = (altitudeFt / 1000) * 0.1;
    const tempFactor = (deltaT / 10) * 0.1;
    
    return 1 + altitudeFactor + tempFactor;
  };

  // Calcul des performances corrigées
  const calculateCorrectedPerformances = (standardPerf, altitudeFt, actualTemp) => {
    const factor = calculateCorrectionFactor(altitudeFt, actualTemp);
    
    return {
      takeoffDistance: Math.round(standardPerf.takeoffDistance * factor),
      accelerateStopDistance: Math.round(standardPerf.accelerateStopDistance * factor),
      landingDistance: Math.round(standardPerf.landingDistance * factor),
      landingDistanceFlapsUp: Math.round(standardPerf.landingDistanceFlapsUp * factor),
      correctionFactor: factor,
      isaTemp: calculateISATemp(altitudeFt),
      deltaT: actualTemp - calculateISATemp(altitudeFt)
    };
  };

  // Extraction des données depuis les modules
  useEffect(() => {
    if (!selectedAircraft?.performances || !departureIcao || !arrivalIcao) return;

    const results = {
      departure: null,
      arrival: null
    };

    // Traitement aérodrome de départ
    const depWeather = airportWeather.get(departureIcao);
    const depChart = Object.values(charts).find(c => c.airportIcao === departureIcao && c.isDownloaded);
    
    if (depWeather) {
      // Utiliser l'altitude de la carte VAC ou le fallback
      const altitudeFt = depChart?.extractedData?.airportElevation || getAirportElevation(departureIcao);
      const tempC = Math.round(depWeather.current.temperature - 273.15);
      
      results.departure = {
        icao: departureIcao,
        altitude: altitudeFt,
        temperature: tempC,
        runways: depChart?.extractedData?.runways || [],
        ...calculateCorrectedPerformances(selectedAircraft.performances, altitudeFt, tempC)
      };
    }

    // Traitement aérodrome d'arrivée
    const arrWeather = airportWeather.get(arrivalIcao);
    const arrChart = Object.values(charts).find(c => c.airportIcao === arrivalIcao && c.isDownloaded);
    
    if (arrWeather) {
      // Utiliser l'altitude de la carte VAC ou le fallback
      const altitudeFt = arrChart?.extractedData?.airportElevation || getAirportElevation(arrivalIcao);
      const tempC = Math.round(arrWeather.current.temperature - 273.15);
      
      results.arrival = {
        icao: arrivalIcao,
        altitude: altitudeFt,
        temperature: tempC,
        runways: arrChart?.extractedData?.runways || [],
        ...calculateCorrectedPerformances(selectedAircraft.performances, altitudeFt, tempC)
      };
    }

    setPerformances(results);
  }, [selectedAircraft, departureIcao, arrivalIcao, charts, airportWeather]);

  // Composant pour afficher les performances d'un aérodrome
  const AirportPerformance = ({ airport, perfData, type }) => {
    if (!perfData) {
      return (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#fef3c7', 
          borderRadius: '8px',
          border: '1px solid #f59e0b'
        }}>
          <p style={{ color: '#92400e', fontSize: '14px', margin: 0 }}>
            <AlertTriangle size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            {type === 'departure' ? 'Départ' : 'Arrivée'} - {airport} : Données météo non disponibles
          </p>
          <p style={{ fontSize: '12px', color: '#78350f', margin: '8px 0 0 0' }}>
            Actualisez les données météo dans l'onglet Météo
          </p>
        </div>
      );
    }

    // Vérifier si les données de pistes sont disponibles
    const hasRunwayData = perfData.runways && perfData.runways.length > 0;

    // Vérifier si les distances corrigées dépassent les longueurs de piste
    const runwayWarnings = hasRunwayData ? perfData.runways.map(runway => {
      const exceedsTakeoff = type === 'departure' && perfData.takeoffDistance > runway.length;
      const exceedsLanding = type === 'arrival' && perfData.landingDistance > runway.length;
      const exceedsAccelStop = type === 'departure' && perfData.accelerateStopDistance > runway.length;
      
      return {
        runway,
        exceedsTakeoff,
        exceedsLanding,
        exceedsAccelStop,
        hasWarning: exceedsTakeoff || exceedsLanding || exceedsAccelStop
      };
    }) : [];

    const hasAnyWarning = runwayWarnings.some(w => w.hasWarning);

    return (
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px',
        border: `2px solid ${hasRunwayData ? (hasAnyWarning ? '#ef4444' : '#10b981') : '#f59e0b'}`,
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        {/* En-tête */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#1f2937',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {type === 'departure' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {type === 'departure' ? 'Décollage' : 'Atterrissage'} - {airport}
          </h4>
          
          {/* Conditions */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px'
            }}>
              <Mountain size={16} style={{ color: '#6b7280' }} />
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Altitude</p>
                <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{perfData.altitude} ft</p>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px'
            }}>
              <Thermometer size={16} style={{ color: '#6b7280' }} />
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Température</p>
                <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  {perfData.temperature}°C
                  <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '4px' }}>
                    (ISA {perfData.deltaT > 0 ? '+' : ''}{perfData.deltaT.toFixed(0)}°)
                  </span>
                </p>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px'
            }}>
              <Wind size={16} style={{ color: '#6b7280' }} />
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Facteur</p>
                <p style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  ×{perfData.correctionFactor.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Performances */}
        <div style={{ marginBottom: '16px' }}>
          <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#4b5563', marginBottom: '8px' }}>
            Distances corrigées
          </h5>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {type === 'departure' ? (
              <>
                <div style={{ 
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px'
                }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>
                    TOD (Take-off Distance)
                  </p>
                  <p style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    {perfData.takeoffDistance} m
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6b7280', 
                      marginLeft: '8px',
                      fontWeight: '400'
                    }}>
                      ({selectedAircraft.performances.takeoffDistance} m std)
                    </span>
                  </p>
                </div>
                
                <div style={{ 
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px'
                }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>
                    ASD (Accelerate-Stop)
                  </p>
                  <p style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    {perfData.accelerateStopDistance} m
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6b7280', 
                      marginLeft: '8px',
                      fontWeight: '400'
                    }}>
                      ({selectedAircraft.performances.accelerateStopDistance} m std)
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div style={{ 
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px'
                }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>
                    LD (Landing Distance)
                  </p>
                  <p style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    {perfData.landingDistance} m
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6b7280', 
                      marginLeft: '8px',
                      fontWeight: '400'
                    }}>
                      ({selectedAircraft.performances.landingDistance} m std)
                    </span>
                  </p>
                </div>
                
                <div style={{ 
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px'
                }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' }}>
                    LD UP (Flaps UP)
                  </p>
                  <p style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                    {perfData.landingDistanceFlapsUp} m
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6b7280', 
                      marginLeft: '8px',
                      fontWeight: '400'
                    }}>
                      ({selectedAircraft.performances.landingDistanceFlapsUp} m std)
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Analyse des pistes */}
        {hasRunwayData ? (
          <div>
            <h5 style={{ fontSize: '14px', fontWeight: '600', color: '#4b5563', marginBottom: '8px' }}>
              Analyse des pistes disponibles
            </h5>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {runwayWarnings.map((warning, index) => (
                <div key={index} style={{ 
                  padding: '12px',
                  backgroundColor: warning.hasWarning ? '#fee2e2' : '#f0fdf4',
                  border: `1px solid ${warning.hasWarning ? '#fecaca' : '#bbf7d0'}`,
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: warning.hasWarning ? '#dc2626' : '#065f46',
                        margin: '0 0 4px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {warning.hasWarning ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                        Piste {warning.runway.identifier} - {warning.runway.length} m × {warning.runway.width} m
                      </p>
                      
                      {warning.hasWarning && (
                        <div style={{ fontSize: '12px', color: '#dc2626', marginLeft: '24px' }}>
                          {warning.exceedsTakeoff && (
                            <p style={{ margin: '2px 0' }}>
                              • Distance de décollage insuffisante (TOD: {perfData.takeoffDistance} m > {warning.runway.length} m)
                            </p>
                          )}
                          {warning.exceedsAccelStop && (
                            <p style={{ margin: '2px 0' }}>
                              • Distance accélération-arrêt insuffisante (ASD: {perfData.accelerateStopDistance} m > {warning.runway.length} m)
                            </p>
                          )}
                          {warning.exceedsLanding && (
                            <p style={{ margin: '2px 0' }}>
                              • Distance d'atterrissage insuffisante (LD: {perfData.landingDistance} m > {warning.runway.length} m)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        QFU {warning.runway.qfu}°
                      </p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        {warning.runway.surface}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ 
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#92400e'
          }}>
            <p style={{ margin: '0', fontWeight: '600' }}>
              ⚠️ Données de pistes non disponibles
            </p>
            <p style={{ margin: '4px 0 0 0' }}>
              Téléchargez la carte VAC dans l'onglet "Cartes VAC" pour obtenir l'analyse des pistes
            </p>
          </div>
        )}

        {/* Note sur les corrections futures */}
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#e0f2fe',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#0c4a6e'
        }}>
          <p style={{ margin: '0', fontWeight: '600' }}>
            ℹ️ Corrections appliquées :
          </p>
          <p style={{ margin: '4px 0 0 0' }}>
            • Altitude : +{((perfData.altitude / 1000) * 0.1 * 100).toFixed(0)}%
            • Température : {perfData.deltaT > 0 ? '+' : ''}{(perfData.deltaT / 10 * 0.1 * 100).toFixed(0)}%
          </p>
          {!hasRunwayData && (
            <p style={{ margin: '4px 0 0 0', fontStyle: 'italic' }}>
              * Altitude issue de la base de données intégrée
            </p>
          )}
          <p style={{ margin: '4px 0 0 0', fontStyle: 'italic' }}>
            Corrections futures : vent, pente, état de piste, masse réelle
          </p>
        </div>
      </div>
    );
  };

  // Interface principale
  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '600', 
        color: '#1f2937', 
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Plane size={20} />
        Performances de décollage et d'atterrissage
      </h3>

      {selectedAircraft ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Performances au départ */}
          {departureIcao && (
            <AirportPerformance 
              airport={departureIcao} 
              perfData={performances.departure}
              type="departure"
            />
          )}
          
          {/* Performances à l'arrivée */}
          {arrivalIcao && arrivalIcao !== departureIcao && (
            <AirportPerformance 
              airport={arrivalIcao} 
              perfData={performances.arrival}
              type="arrival"
            />
          )}
          
          {/* Formule de calcul */}
          <div style={{ 
            padding: '16px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#4b5563'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>
              📐 Formule de calcul utilisée :
            </p>
            <code style={{ 
              display: 'block', 
              padding: '8px', 
              backgroundColor: 'white', 
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}>
              Distance corrigée = Distance standard × [1 + (Alt/1000 × 0.1) + (ΔT/10 × 0.1)]
            </code>
            <p style={{ margin: '8px 0 0 0' }}>
              où ΔT = Température réelle - Température ISA (15°C - Alt × 0.002)
            </p>
          </div>
        </div>
      ) : (
        <div style={{ 
          padding: '32px', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '8px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          Sélectionnez un avion pour calculer les performances
        </div>
      )}
    </div>
  );
};