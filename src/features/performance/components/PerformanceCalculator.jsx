// src/features/performance/components/PerformanceCalculator.jsx
import React, { memo, useState, useMemo, useEffect } from 'react';
import { Calculator, AlertTriangle, Info, Wind, Thermometer, Mountain, Plane } from 'lucide-react';
import { sx } from '../../../shared/styles/styleSystem';
import { useAircraft, useNavigation, useWeather, useWeightBalance, useFuel } from '../../../core/contexts';
import { 
  interpolatePerformance, 
  applyEnvironmentalCorrections,
  calculateDensityAltitude 
} from '../../aircraft/utils/performanceCharts';

export const PerformanceCalculator = memo(() => {
  const { selectedAircraft } = useAircraft();
  const { waypoints } = useNavigation();
  const { getWeatherByIcao } = useWeather();
  const { calculations } = useWeightBalance();
  const { fuelData, fobFuel } = useFuel();
  
  // État pour les conditions de calcul
  const [conditions, setConditions] = useState({
    airport: '',
    elevation: 0,
    temperature: 15,
    qnh: 1013.25,
    headwind: 0,
    tailwind: 0,
    crosswind: 0,
    runwaySlope: 0,
    surfaceCondition: 'dry', // dry, wet, contaminated, grass
    weight: selectedAircraft?.maxTakeoffWeight || 1000,
    flaps: 'takeoff' // takeoff, landing
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Mise à jour automatique des conditions depuis la météo
  useEffect(() => {
    if (conditions.airport && conditions.airport.length === 4) {
      const weather = getWeatherByIcao(conditions.airport);
      if (weather) {
        const temp = weather.decoded?.temperature || weather.metar?.temperature;
        const qnh = weather.decoded?.altimeter?.value || weather.metar?.altimeter;
        
        setConditions(prev => ({
          ...prev,
          temperature: temp || prev.temperature,
          qnh: qnh ? qnh * 33.8639 : prev.qnh, // Conversion inHg vers hPa si nécessaire
          // Analyser le vent depuis METAR
          ...(weather.decoded?.wind && {
            headwind: weather.decoded.wind.speed?.value || 0 // Simplification, nécessiterait l'angle de piste
          })
        }));
      }
    }
  }, [conditions.airport, getWeatherByIcao]);

  // Calculer les performances
  const calculatePerformances = useMemo(() => {
    if (!selectedAircraft || !selectedAircraft.manex?.performanceCharts) {
      return null;
    }

    const charts = selectedAircraft.manex.performanceCharts;
    const densityAlt = calculateDensityAltitude(
      conditions.elevation,
      conditions.temperature,
      conditions.qnh
    );

    // Calcul des distances de décollage
    const baseTakeoffDistance = interpolatePerformance(
      charts.takeoffDistance,
      densityAlt,
      conditions.temperature,
      conditions.weight

    );
    const baseTakeoffRoll = interpolatePerformance(
      charts.takeoffRoll,
      densityAlt,
      conditions.temperature,
      conditions.weight

    );
    // Calcul des distances d'atterrissage
    const baseLandingDistance = interpolatePerformance(
      charts.landingDistance,
      densityAlt,
      conditions.temperature,
      conditions.weight * 0.95 // Masse à l'atterrissage typiquement plus faible

    );
    const baseLandingRoll = interpolatePerformance(
      charts.landingRoll,
      densityAlt,
      conditions.temperature,
      conditions.weight * 0.95

    );
    // Calcul du taux de montée
    const climbRate = interpolatePerformance(
      charts.climbRate,
      densityAlt,
      conditions.temperature,
      conditions.weight

    );
    // Appliquer les corrections environnementales
    const envConditions = {
      headwind: conditions.headwind,
      tailwind: conditions.tailwind,
      slope: conditions.runwaySlope,
      surfaceCondition: conditions.surfaceCondition
    };

    const correctedTakeoffDistance = applyEnvironmentalCorrections(
      baseTakeoffDistance,
      charts.takeoffDistance.corrections,
      envConditions

    );
    const correctedTakeoffRoll = applyEnvironmentalCorrections(
      baseTakeoffRoll,
      charts.takeoffRoll.corrections,
      envConditions

    );
    const correctedLandingDistance = applyEnvironmentalCorrections(
      baseLandingDistance,
      charts.landingDistance.corrections,
      envConditions

    );
    const correctedLandingRoll = applyEnvironmentalCorrections(
      baseLandingRoll,
      charts.landingRoll.corrections,
      envConditions

    );
    return {
      densityAltitude: densityAlt,
      takeoff: {
        groundRoll: correctedTakeoffRoll,
        totalDistance: correctedTakeoffDistance,
        baseGroundRoll: baseTakeoffRoll,
        baseDistance: baseTakeoffDistance
      },
      landing: {
        groundRoll: correctedLandingRoll,
        totalDistance: correctedLandingDistance,
        baseGroundRoll: baseLandingRoll,
        baseDistance: baseLandingDistance
      },
      climbRate: climbRate,
      corrections: {
        wind: ((conditions.headwind || 0) - (conditions.tailwind || 0)),
        slope: conditions.runwaySlope,
        surface: conditions.surfaceCondition !== 'dry' ? conditions.surfaceCondition : null
      }
    };
  }, [selectedAircraft, conditions]);

  const handleConditionChange = (field, value) => {
    setConditions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid var(--text-tertiary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    width: '100%',
    backgroundColor: 'var(--bg-overlay)'
  };

  const labelStyle = {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
    marginBottom: '4px',
    display: 'block'
  };

  if (!selectedAircraft) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.text.center, sx.spacing.p(8))}>
        <Plane size={48} style={{ margin: '0 auto 16px', color: 'var(--text-tertiary)' }} />
        <p style={sx.text.base}>Sélectionnez un avion pour calculer les performances</p>
      </div>
    );
  }

  // Si pas d'abaques MANEX mais performances IA disponibles
  if (!selectedAircraft.manex?.performanceCharts && selectedAircraft.performance) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
          <Calculator size={20} style={{ marginRight: '8px' }} />
          Calculateur de Performances
        </h3>

        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
          <Info size={16} />
          <div>
            <p style={sx.text.sm}>
              Calculs basés sur les performances IA extraites. Pour des calculs plus précis avec abaques, importez le MANEX.
            </p>
          </div>
        </div>

        {/* Affichage des conditions actuelles */}
        <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3), sx.spacing.mb(4))}>
          <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            Conditions actuelles du vol
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <p style={sx.text.xs}>Masse au décollage</p>
              <p style={sx.text.base}>{calculations?.totalWeight || selectedAircraft.maxTakeoffWeight} kg</p>
            </div>
            <div>
              <p style={sx.text.xs}>Masse à l'atterrissage</p>
              <p style={sx.text.base}>
                {calculations && fuelData ? 
                  Math.round(calculations.totalWeight - (fuelData.trip?.kg || 0)) : 
                  Math.round(selectedAircraft.maxTakeoffWeight * 0.9)} kg
              </p>
            </div>
            {waypoints?.length >= 2 && (
              <>
                <div>
                  <p style={sx.text.xs}>Départ</p>
                  <p style={sx.text.base}>{waypoints[0].icao || waypoints[0].name}</p>
                </div>
                <div>
                  <p style={sx.text.xs}>Arrivée</p>
                  <p style={sx.text.base}>{waypoints[waypoints.length - 1].icao || waypoints[waypoints.length - 1].name}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Performances IA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
            <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              ✈️ Décollage (référence IA)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <p style={sx.text.xs}>TOD</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {selectedAircraft.performance.takeoff?.tod || 'N/A'} m
                </p>
              </div>
              <div>
                <p style={sx.text.xs}>15m</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {selectedAircraft.performance.takeoff?.toda15m || 'N/A'} m
                </p>
              </div>
              <div>
                <p style={sx.text.xs}>50ft</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {selectedAircraft.performance.takeoff?.toda50ft || 'N/A'} m
                </p>
              </div>
            </div>
          </div>

          <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
            <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              🛬 Atterrissage (référence IA)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <p style={sx.text.xs}>LD</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {selectedAircraft.performance.landing?.ld || 'N/A'} m
                </p>
              </div>
              <div>
                <p style={sx.text.xs}>15m</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {selectedAircraft.performance.landing?.lda15m || 'N/A'} m
                </p>
              </div>
              <div>
                <p style={sx.text.xs}>50ft</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {selectedAircraft.performance.landing?.lda50ft || 'N/A'} m
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={sx.combine(sx.spacing.mt(4), sx.components.alert.base, sx.components.alert.warning)}>
          <AlertTriangle size={16} />
          <p style={sx.text.xs}>
            Ces valeurs sont des références extraites par IA. Pour des calculs ajustés aux conditions actuelles, 
            importez le MANEX de l'avion.
          </p>
        </div>
      </div>
    );
  }

  // Si ni abaques ni performances IA
  if (!selectedAircraft.manex?.performanceCharts && !selectedAircraft.performance) {
    return (
      <div style={sx.combine(sx.components.card.base, sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={20} />
        <div>
          <p style={sx.text.sm}>
            <strong>Performances non disponibles</strong>
          </p>
          <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
            Analysez les tableaux de performances avec l'IA dans le module "Gestion Avions" ou importez le MANEX de l'avion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={sx.combine(sx.components.card.base, sx.spacing.p(4))}>
      <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
        <Calculator size={20} style={{ marginRight: '8px' }} />
        Calculateur de Performances avec Abaques
      </h3>

      {/* Conditions atmosphériques et terrain */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          Conditions atmosphériques et terrain
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          {/* Aéroport */}
          <div>
            <label style={labelStyle}>
              Code OACI aéroport
            </label>
            <input
              type="text"
              value={conditions.airport}
              onChange={(e) => handleConditionChange('airport', e.target.value.toUpperCase())}
              placeholder="LFPG"
              maxLength={4}
              style={inputStyle}
            />
          </div>

          {/* Élévation */}
          <div>
            <label style={labelStyle}>
              Élévation terrain (ft)
            </label>
            <input
              type="number"
              value={conditions.elevation}
              onChange={(e) => handleConditionChange('elevation', parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>

          {/* Température */}
          <div>
            <label style={labelStyle}>
              <Thermometer size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Température (°C)
            </label>
            <input
              type="number"
              value={conditions.temperature}
              onChange={(e) => handleConditionChange('temperature', parseFloat(e.target.value) || 15)}
              style={inputStyle}
            />
          </div>

          {/* QNH */}
          <div>
            <label style={labelStyle}>
              QNH (hPa)
            </label>
            <input
              type="number"
              value={conditions.qnh}
              onChange={(e) => handleConditionChange('qnh', parseFloat(e.target.value) || 1013.25)}
              step="0.1"
              style={inputStyle}
            />
          </div>

          {/* Masse */}
          <div>
            <label style={labelStyle}>
              Masse (kg)
            </label>
            <input
              type="number"
              value={conditions.weight}
              onChange={(e) => handleConditionChange('weight', parseFloat(e.target.value) || 1000)}
              style={inputStyle}
            />
          </div>

          {/* Altitude densité calculée */}
          {calculatePerformances && (
            <div>
              <label style={labelStyle}>
                <Mountain size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Altitude densité (ft)
              </label>
              <div style={{
                ...inputStyle,
                backgroundColor: 'var(--bg-overlay)',
                border: '1px solid var(--accent-primary)',
                fontWeight: 'bold'
              }}>
                {calculatePerformances.densityAltitude}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conditions de vent */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          <Wind size={16} style={{ display: 'inline', marginRight: '8px' }} />
          Conditions de vent
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Vent de face (kt)</label>
            <input
              type="number"
              value={conditions.headwind}
              onChange={(e) => handleConditionChange('headwind', parseFloat(e.target.value) || 0)}
              min="0"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Vent arrière (kt)</label>
            <input
              type="number"
              value={conditions.tailwind}
              onChange={(e) => handleConditionChange('tailwind', parseFloat(e.target.value) || 0)}
              min="0"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Vent traversier (kt)</label>
            <input
              type="number"
              value={conditions.crosswind}
              onChange={(e) => handleConditionChange('crosswind', parseFloat(e.target.value) || 0)}
              min="0"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Conditions de piste */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
          Conditions de piste
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>État de surface</label>
            <select
              value={conditions.surfaceCondition}
              onChange={(e) => handleConditionChange('surfaceCondition', e.target.value)}
              style={inputStyle}
            >
              <option value="dry">Sèche</option>
              <option value="wet">Mouillée</option>
              <option value="contaminated">Contaminée</option>
              <option value="grass">Herbe</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Pente de piste (%)</label>
            <input
              type="number"
              value={conditions.runwaySlope}
              onChange={(e) => handleConditionChange('runwaySlope', parseFloat(e.target.value) || 0)}
              step="0.1"
              style={inputStyle}
            />
            <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
              Positif = montée, Négatif = descente
            </p>
          </div>

          <div>
            <label style={labelStyle}>Configuration volets</label>
            <select
              value={conditions.flaps}
              onChange={(e) => handleConditionChange('flaps', e.target.value)}
              style={inputStyle}
            >
              <option value="takeoff">Décollage</option>
              <option value="landing">Atterrissage</option>
            </select>
          </div>
        </div>
      </div>

      {/* Résultats calculés */}
      {calculatePerformances && (
        <div style={sx.combine(sx.spacing.mt(4))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3))}>
            Résultats des calculs
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Performances au décollage */}
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-regular)'
            }}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                Décollage
              </h5>
              
              <div style={sx.spacing.mb(2)}>
                <p style={sx.text.xs}>Distance de roulement:</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {calculatePerformances.takeoff.groundRoll} m
                </p>
                {calculatePerformances.takeoff.baseGroundRoll !== calculatePerformances.takeoff.groundRoll && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    Base: {calculatePerformances.takeoff.baseGroundRoll} m
                  </p>
                )}
              </div>

              <div>
                <p style={sx.text.xs}>Distance totale (15m/50ft):</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {calculatePerformances.takeoff.totalDistance} m
                </p>
                {calculatePerformances.takeoff.baseDistance !== calculatePerformances.takeoff.totalDistance && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    Base: {calculatePerformances.takeoff.baseDistance} m
                  </p>
                )}
              </div>
            </div>

            {/* Performances à l'atterrissage */}
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--accent-primary)'
            }}>
              <h5 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                Atterrissage
              </h5>
              
              <div style={sx.spacing.mb(2)}>
                <p style={sx.text.xs}>Distance de roulement:</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {calculatePerformances.landing.groundRoll} m
                </p>
                {calculatePerformances.landing.baseGroundRoll !== calculatePerformances.landing.groundRoll && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    Base: {calculatePerformances.landing.baseGroundRoll} m
                  </p>
                )}
              </div>

              <div>
                <p style={sx.text.xs}>Distance totale (15m/50ft):</p>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {calculatePerformances.landing.totalDistance} m
                </p>
                {calculatePerformances.landing.baseDistance !== calculatePerformances.landing.totalDistance && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    Base: {calculatePerformances.landing.baseDistance} m
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Taux de montée */}
          {calculatePerformances.climbRate && (
            <div style={sx.combine(sx.spacing.mt(3), {
              backgroundColor: 'var(--bg-overlay)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-regular)'
            })}>
              <p style={sx.text.sm}>
                <strong>Taux de montée:</strong> {calculatePerformances.climbRate} fpm
              </p>
            </div>
          )}

          {/* Corrections appliquées */}
          {(calculatePerformances.corrections.wind || 
            calculatePerformances.corrections.slope || 
            calculatePerformances.corrections.surface) && (
            <div style={sx.combine(sx.spacing.mt(3), sx.components.alert.base, sx.components.alert.info)}>
              <Info size={16} />
              <div>
                <p style={sx.combine(sx.text.xs, sx.text.bold)}>Corrections appliquées:</p>
                <ul style={sx.combine(sx.text.xs, { marginLeft: '16px', marginTop: '4px' })}>
                  {calculatePerformances.corrections.wind && (
                    <li>Vent: {calculatePerformances.corrections.wind > 0 ? '+' : ''}{calculatePerformances.corrections.wind} kt</li>
                  )}
                  {calculatePerformances.corrections.slope && (
                    <li>Pente: {calculatePerformances.corrections.slope > 0 ? '+' : ''}{calculatePerformances.corrections.slope}%</li>
                  )}
                  {calculatePerformances.corrections.surface && (
                    <li>Surface: {calculatePerformances.corrections.surface}</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Note sur les marges de sécurité */}
      <div style={sx.combine(sx.spacing.mt(4), sx.components.alert.base, sx.components.alert.warning)}>
        <AlertTriangle size={16} />
        <p style={sx.text.xs}>
          <strong>Important:</strong> Ces calculs sont basés sur les abaques du MANEX. 
          Appliquez toujours les marges de sécurité réglementaires appropriées (facteur 1.15 pour l'aviation générale, 
          1.25 pour le transport public).
        </p>
      </div>
    </div>

  );
});

PerformanceCalculator.displayName = 'PerformanceCalculator';

export default PerformanceCalculator;