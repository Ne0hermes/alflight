// src/features/navigation/components/PerformanceCalculator.jsx
import React, { memo, useState, useEffect } from 'react';
import { Plane, Thermometer, Mountain, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Wind } from 'lucide-react';
import { useAircraft, useNavigation } from '@core/contexts';
import { getAirportElevation } from '@data/airportElevations';
import { sx } from '@shared/styles/styleSystem';

export const PerformanceCalculator = memo(() => {
  const { selectedAircraft } = useAircraft();
  const { waypoints } = useNavigation();
  
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

  // Calculs simplifiés sans weather store
  useEffect(() => {
    if (!selectedAircraft?.performances || !departureIcao || !arrivalIcao) return;

    const results = {
      departure: null,
      arrival: null
    };

    // Pour l'instant, utiliser une température standard
    const standardTemp = 15; // °C

    // Traitement aérodrome de départ
    const depAltitude = getAirportElevation(departureIcao);
    results.departure = {
      icao: departureIcao,
      altitude: depAltitude,
      temperature: standardTemp,
      runways: [], // À implémenter avec les cartes VAC
      ...calculateCorrectedPerformances(selectedAircraft.performances, depAltitude, standardTemp)
    };

    // Traitement aérodrome d'arrivée
    const arrAltitude = getAirportElevation(arrivalIcao);
    results.arrival = {
      icao: arrivalIcao,
      altitude: arrAltitude,
      temperature: standardTemp,
      runways: [], // À implémenter avec les cartes VAC
      ...calculateCorrectedPerformances(selectedAircraft.performances, arrAltitude, standardTemp)
    };

    setPerformances(results);
  }, [selectedAircraft, departureIcao, arrivalIcao]);

  // Composant pour afficher les performances d'un aérodrome
  const AirportPerformance = ({ airport, perfData, type }) => {
    if (!perfData) {
      return (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
          <AlertTriangle size={16} />
          <p style={sx.text.sm}>
            {type === 'departure' ? 'Départ' : 'Arrivée'} - {airport} : Données non disponibles
          </p>
        </div>
      );
    }

    const hasRunwayData = perfData.runways && perfData.runways.length > 0;

    return (
      <div style={sx.combine(
        sx.components.card.base,
        sx.border[hasRunwayData ? 'success' : 'warning']
      )}>
        {/* En-tête */}
        <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2), sx.flex.start, sx.spacing.gap(2))}>
          {type === 'departure' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          {type === 'departure' ? 'Décollage' : 'Atterrissage'} - {airport}
        </h4>
        
        {/* Conditions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
          <InfoCard icon={Mountain} label="Altitude" value={`${perfData.altitude} ft`} />
          <InfoCard icon={Thermometer} label="Température" value={`${perfData.temperature}°C`} subvalue={`ISA ${perfData.deltaT > 0 ? '+' : ''}${perfData.deltaT.toFixed(0)}°`} />
          <InfoCard icon={Wind} label="Facteur" value={`×${perfData.correctionFactor.toFixed(2)}`} />
        </div>

        {/* Performances */}
        <div style={sx.spacing.mb(3)}>
          <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.text.secondary, sx.spacing.mb(2))}>
            Distances corrigées
          </h5>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {type === 'departure' ? (
              <>
                <DistanceCard label="TOD (Take-off Distance)" value={perfData.takeoffDistance} standard={selectedAircraft.performances.takeoffDistance} />
                <DistanceCard label="ASD (Accelerate-Stop)" value={perfData.accelerateStopDistance} standard={selectedAircraft.performances.accelerateStopDistance} />
              </>
            ) : (
              <>
                <DistanceCard label="LD (Landing Distance)" value={perfData.landingDistance} standard={selectedAircraft.performances.landingDistance} />
                <DistanceCard label="LD UP (Flaps UP)" value={perfData.landingDistanceFlapsUp} standard={selectedAircraft.performances.landingDistanceFlapsUp} />
              </>
            )}
          </div>
        </div>

        {/* Note */}
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
          <p style={sx.text.sm}>
            <strong>ℹ️ Corrections appliquées :</strong><br />
            • Altitude : +{((perfData.altitude / 1000) * 0.1 * 100).toFixed(0)}%<br />
            • Température : {perfData.deltaT > 0 ? '+' : ''}{(perfData.deltaT / 10 * 0.1 * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    );
  };

  const InfoCard = ({ icon: Icon, label, value, subvalue }) => (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(2))}>
      <div style={sx.combine(sx.flex.start, sx.spacing.gap(2))}>
        <Icon size={16} style={{ color: sx.theme.colors.gray[500] }} />
        <div>
          <p style={sx.combine(sx.text.xs, sx.text.secondary)}>{label}</p>
          <p style={sx.combine(sx.text.base, sx.text.bold)}>
            {value}
            {subvalue && <span style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.ml(1))}>{subvalue}</span>}
          </p>
        </div>
      </div>
    </div>
  );

  const DistanceCard = ({ label, value, standard }) => (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(3), sx.bg.gray)}>
      <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(1))}>{label}</p>
      <p style={sx.combine(sx.text.xl, sx.text.bold, sx.text.primary)}>
        {value} m
        <span style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.ml(2), { fontWeight: 'normal' })}>
          ({standard} m std)
        </span>
      </p>
    </div>
  );

  // Interface principale
  return (
    <div style={sx.spacing.mt(6)}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start, sx.spacing.gap(2))}>
        <Plane size={20} />
        Performances de décollage et d'atterrissage
      </h3>

      {selectedAircraft ? (
        <div style={sx.combine(sx.flex.col, sx.spacing.gap(5))}>
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
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
            <div>
              <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                📐 Formule de calcul utilisée :
              </p>
              <code style={sx.combine(sx.bg.white, sx.spacing.p(2), sx.rounded.md, { display: 'block', fontFamily: 'monospace' })}>
                Distance corrigée = Distance standard × [1 + (Alt/1000 × 0.1) + (ΔT/10 × 0.1)]
              </code>
              <p style={sx.combine(sx.text.sm, sx.spacing.mt(2))}>
                où ΔT = Température réelle - Température ISA (15°C - Alt × 0.002)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.text.center)}>
          <p>Sélectionnez un avion pour calculer les performances</p>
        </div>
      )}
    </div>
  );
});

PerformanceCalculator.displayName = 'PerformanceCalculator';