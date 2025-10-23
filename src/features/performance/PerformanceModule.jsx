import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, AlertCircle, TrendingUp, Wind, Compass, FileText, Scale, Plane, MapPin, Thermometer, Gauge, CheckCircle, XCircle, Settings } from 'lucide-react';
import { sx } from '../../shared/styles/styleSystem';
import PerformanceCalculator from './components/PerformanceCalculator';
import AdvancedPerformanceCalculator from './components/AdvancedPerformanceCalculator';
import { RunwaySuggestionEnhanced } from '../weather/components/RunwaySuggestionEnhanced';
import { useAircraft, useWeightBalance, useNavigation, useWeather, useFuel } from '../../core/contexts';
import { useWeatherStore } from '../../core/stores/weatherStore';
import { usePerformanceCalculations } from '../../shared/hooks/usePerformanceCalculations';

const PerformanceModule = ({ wizardMode = false, config = {} }) => {
  const { selectedAircraft } = useAircraft();
  const { calculations } = useWeightBalance();
  const { waypoints } = useNavigation();
  const { getWeatherByIcao } = useWeather();
  const { fuelData, fobFuel } = useFuel();
  const weatherData = useWeatherStore(state => state.weatherData || {});
  const { calculateCorrectedDistances, calculateISATemperature } = usePerformanceCalculations();

  // États pour les ajustements manuels
  const [manualAdjustments, setManualAdjustments] = useState({
    departureTemp: null,
    arrivalTemp: null,
    departureWind: null,
    arrivalWind: null,
    weight: null
  });

  const [showManualAdjustments, setShowManualAdjustments] = useState(false);

  // Récupérer les aérodromes de départ et d'arrivée
  const departureAirport = waypoints?.[0];
  const arrivalAirport = waypoints?.[waypoints?.length - 1];

  // Récupérer la météo pour les aérodromes
  const departureWeather = departureAirport?.name && weatherData[departureAirport.name];
  const arrivalWeather = arrivalAirport?.name && weatherData[arrivalAirport.name];

  // Calcul des performances pour le départ
  const departurePerformance = useMemo(() => {
    if (!departureAirport || !selectedAircraft?.performances) return null;

    const altitude = departureAirport.elevation || 0;
    const isaTemp = calculateISATemperature(altitude);

    // Utiliser température manuelle OU température METAR OU température ISA
    let actualTemp = manualAdjustments.departureTemp;
    if (actualTemp === null && departureWeather?.metar?.temp !== undefined) {
      actualTemp = departureWeather.metar.temp;
    }
    if (actualTemp === null) {
      actualTemp = isaTemp;
    }

    // Utiliser masse manuelle OU masse depuis Weight & Balance
    const weight = manualAdjustments.weight || calculations?.totalWeight || null;

    const correctedDistances = calculateCorrectedDistances(altitude, actualTemp, weight);

    return {
      altitude,
      isaTemp,
      actualTemp,
      weight,
      correctedDistances,
      dataSource: {
        temp: manualAdjustments.departureTemp !== null ? 'manuel' : (departureWeather?.metar?.temp !== undefined ? 'METAR' : 'ISA'),
        weight: manualAdjustments.weight !== null ? 'manuel' : (calculations?.totalWeight ? 'Masse et centrage' : 'non défini')
      }
    };
  }, [departureAirport, selectedAircraft, manualAdjustments, departureWeather, calculations, calculateCorrectedDistances, calculateISATemperature]);

  // Calcul des performances pour l'arrivée
  const arrivalPerformance = useMemo(() => {
    if (!arrivalAirport || !selectedAircraft?.performances) return null;

    const altitude = arrivalAirport.elevation || 0;
    const isaTemp = calculateISATemperature(altitude);

    // Utiliser température manuelle OU température METAR OU température ISA
    let actualTemp = manualAdjustments.arrivalTemp;
    if (actualTemp === null && arrivalWeather?.metar?.temp !== undefined) {
      actualTemp = arrivalWeather.metar.temp;
    }
    if (actualTemp === null) {
      actualTemp = isaTemp;
    }

    // Utiliser masse manuelle OU masse depuis Weight & Balance
    // Pour l'atterrissage, la masse est réduite du carburant brûlé
    let weight = manualAdjustments.weight || calculations?.totalWeight || null;
    if (weight && fuelData?.burnOff) {
      weight = weight - fuelData.burnOff; // Masse à l'atterrissage
    }

    const correctedDistances = calculateCorrectedDistances(altitude, actualTemp, weight);

    return {
      altitude,
      isaTemp,
      actualTemp,
      weight,
      correctedDistances,
      dataSource: {
        temp: manualAdjustments.arrivalTemp !== null ? 'manuel' : (arrivalWeather?.metar?.temp !== undefined ? 'METAR' : 'ISA'),
        weight: manualAdjustments.weight !== null ? 'manuel' : (calculations?.totalWeight ? 'Masse et centrage (- carburant brûlé)' : 'non défini')
      }
    };
  }, [arrivalAirport, selectedAircraft, manualAdjustments, arrivalWeather, calculations, fuelData, calculateCorrectedDistances, calculateISATemperature]);

  // Si aucun avion sélectionné, afficher un message
  if (!selectedAircraft) {
    return (
      <div style={sx.spacing.p(6)}>
        <div style={sx.combine(sx.components.card.base, sx.text.left, sx.spacing.p(8))}>
          <AlertCircle size={48} style={{ marginBottom: '16px', color: '#f59e0b' }} />
          <p style={sx.combine(sx.text.lg, sx.text.secondary)}>
            Sélectionnez un avion pour voir ses performances
          </p>
        </div>
      </div>
    );
  }


  return (
    <div style={sx.spacing.p(6)}>
      {/* Header du module */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.flex.start)}>
            <TrendingUp size={24} style={{ marginRight: '8px', color: '#10b981' }} />
            Calcul des performances
          </h2>
          
        </div>
        
        {/* Info avion */}
        <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
          <div style={sx.combine(sx.flex.between)}>
            <div>
              <h4 style={sx.text.bold}>{selectedAircraft.registration}</h4>
              <p style={sx.text.secondary}>{selectedAircraft.model}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={sx.text.sm}>
                <span style={sx.text.secondary}>MTOW: </span>
                <span style={sx.text.bold}>{selectedAircraft.maxTakeoffWeight || 'N/A'} kg</span>
              </p>
              <p style={sx.text.sm}>
                <span style={sx.text.secondary}>Vitesse: </span>
                <span style={sx.text.bold}>{selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 'N/A'} kt</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Données collectées depuis les autres modules */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
            <FileText size={20} style={{ marginRight: '8px' }} />
            Données collectées pour le calcul des performances
          </h3>
          <button
            onClick={() => setShowManualAdjustments(!showManualAdjustments)}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.secondary,
              { padding: '6px 12px', fontSize: '13px' }
            )}
          >
            <Settings size={16} style={{ marginRight: '6px' }} />
            {showManualAdjustments ? 'Masquer' : 'Ajustements manuels'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Masse de l'avion */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Scale size={18} style={{ marginRight: '6px', color: '#8b5cf6' }} />
              <h4 style={sx.combine(sx.text.sm, sx.text.bold)}>Masse</h4>
            </div>
            {calculations?.totalWeight ? (
              <>
                <p style={sx.combine(sx.text.xl, sx.text.bold)}>
                  {calculations.totalWeight} kg
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  Source: Module Masse et centrage
                </p>
                {calculations.isWithinLimits ? (
                  <div style={sx.combine(sx.flex.start, sx.spacing.mt(2))}>
                    <CheckCircle size={14} style={{ marginRight: '4px', color: '#10b981' }} />
                    <span style={sx.combine(sx.text.xs, { color: '#10b981' })}>Dans les limites</span>
                  </div>
                ) : (
                  <div style={sx.combine(sx.flex.start, sx.spacing.mt(2))}>
                    <XCircle size={14} style={{ marginRight: '4px', color: '#ef4444' }} />
                    <span style={sx.combine(sx.text.xs, { color: '#ef4444' })}>Hors limites!</span>
                  </div>
                )}
              </>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Non définie - Configurer dans Module Masse et centrage
              </p>
            )}
          </div>

          {/* Aérodromes départ/arrivée */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <MapPin size={18} style={{ marginRight: '6px', color: '#3b82f6' }} />
              <h4 style={sx.combine(sx.text.sm, sx.text.bold)}>Aérodromes</h4>
            </div>
            {departureAirport && arrivalAirport ? (
              <>
                <p style={sx.combine(sx.text.sm, sx.spacing.mb(1))}>
                  <strong>Départ:</strong> {departureAirport.name} ({departureAirport.elevation || 0} ft)
                </p>
                <p style={sx.combine(sx.text.sm)}>
                  <strong>Arrivée:</strong> {arrivalAirport.name} ({arrivalAirport.elevation || 0} ft)
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                  Source: Module Navigation
                </p>
              </>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Non définis - Configurer dans Module Navigation
              </p>
            )}
          </div>

          {/* Météo (vent + température) */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Wind size={18} style={{ marginRight: '6px', color: '#06b6d4' }} />
              <h4 style={sx.combine(sx.text.sm, sx.text.bold)}>Météo</h4>
            </div>
            {(departureWeather || arrivalWeather) ? (
              <>
                {departureWeather?.metar && (
                  <div style={sx.spacing.mb(2)}>
                    <p style={sx.combine(sx.text.xs, sx.text.bold)}>Départ ({departureAirport.name}):</p>
                    <p style={sx.text.xs}>
                      Vent: {departureWeather.metar.wind?.speed || 0} kt / {departureWeather.metar.wind?.direction || '---'}°
                    </p>
                    <p style={sx.text.xs}>Temp: {departureWeather.metar.temp !== undefined ? `${departureWeather.metar.temp}°C` : 'N/A'}</p>
                  </div>
                )}
                {arrivalWeather?.metar && (
                  <div>
                    <p style={sx.combine(sx.text.xs, sx.text.bold)}>Arrivée ({arrivalAirport.name}):</p>
                    <p style={sx.text.xs}>
                      Vent: {arrivalWeather.metar.wind?.speed || 0} kt / {arrivalWeather.metar.wind?.direction || '---'}°
                    </p>
                    <p style={sx.text.xs}>Temp: {arrivalWeather.metar.temp !== undefined ? `${arrivalWeather.metar.temp}°C` : 'N/A'}</p>
                  </div>
                )}
                <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                  Source: Module Météo (METAR)
                </p>
              </>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
                Non disponible - Charger dans Module Météo
              </p>
            )}
          </div>
        </div>

        {/* Ajustements manuels (affichés conditionnellement) */}
        {showManualAdjustments && (
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.mt(4), sx.spacing.p(4))}>
            <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
              ⚙️ Ajustements manuels (optionnel)
            </h4>
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mb(3))}>
              Les valeurs ci-dessous surchargent les données collectées automatiquement.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {/* Température départ */}
              <div>
                <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                  Température départ (°C)
                </label>
                <input
                  type="number"
                  value={manualAdjustments.departureTemp || ''}
                  onChange={(e) => setManualAdjustments(prev => ({
                    ...prev,
                    departureTemp: e.target.value ? parseFloat(e.target.value) : null
                  }))}
                  placeholder={departureWeather?.metar?.temp !== undefined
                    ? `Auto: ${departureWeather.metar.temp}°C`
                    : 'ISA'}
                  style={sx.components.input.base}
                />
              </div>

              {/* Température arrivée */}
              <div>
                <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                  Température arrivée (°C)
                </label>
                <input
                  type="number"
                  value={manualAdjustments.arrivalTemp || ''}
                  onChange={(e) => setManualAdjustments(prev => ({
                    ...prev,
                    arrivalTemp: e.target.value ? parseFloat(e.target.value) : null
                  }))}
                  placeholder={arrivalWeather?.metar?.temp !== undefined
                    ? `Auto: ${arrivalWeather.metar.temp}°C`
                    : 'ISA'}
                  style={sx.components.input.base}
                />
              </div>

              {/* Masse */}
              <div>
                <label style={sx.combine(sx.components.label.base, sx.text.xs)}>
                  Masse totale (kg)
                </label>
                <input
                  type="number"
                  value={manualAdjustments.weight || ''}
                  onChange={(e) => setManualAdjustments(prev => ({
                    ...prev,
                    weight: e.target.value ? parseFloat(e.target.value) : null
                  }))}
                  placeholder={calculations?.totalWeight
                    ? `Auto: ${calculations.totalWeight} kg`
                    : 'Non définie'}
                  style={sx.components.input.base}
                />
              </div>

              {/* Reset */}
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={() => setManualAdjustments({
                    departureTemp: null,
                    arrivalTemp: null,
                    departureWind: null,
                    arrivalWind: null,
                    weight: null
                  })}
                  style={sx.combine(
                    sx.components.button.base,
                    sx.components.button.secondary,
                    { padding: '8px 16px', fontSize: '13px', width: '100%' }
                  )}
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section: Calculs de performances */}
      {(departurePerformance || arrivalPerformance) && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Calculator size={20} style={{ marginRight: '8px', color: '#10b981' }} />
            Performances calculées
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Performances décollage */}
            {departurePerformance && (
              <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(4))}>
                <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
                  ✈️ Décollage - {departureAirport.name}
                </h4>

                {/* Conditions */}
                <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
                  <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>Conditions utilisées :</p>
                  <p style={sx.text.xs}>• Altitude: {departurePerformance.altitude} ft</p>
                  <p style={sx.text.xs}>• Température ISA: {departurePerformance.isaTemp.toFixed(1)}°C</p>
                  <p style={sx.text.xs}>
                    • Température réelle: {departurePerformance.actualTemp.toFixed(1)}°C
                    <span style={sx.text.secondary}> ({departurePerformance.dataSource.temp})</span>
                  </p>
                  {departurePerformance.weight && (
                    <p style={sx.text.xs}>
                      • Masse: {departurePerformance.weight} kg
                      <span style={sx.text.secondary}> ({departurePerformance.dataSource.weight})</span>
                    </p>
                  )}
                </div>

                {/* Résultats */}
                {departurePerformance.correctedDistances && (
                  <div>
                    <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(2))}>Distances requises :</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <p style={sx.text.xs}>Décollage</p>
                        <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                          {departurePerformance.correctedDistances.takeoffDistance} ft
                        </p>
                        <p style={sx.text.xs}>
                          ({Math.round(departurePerformance.correctedDistances.takeoffDistance / 3.28084)} m)
                        </p>
                      </div>
                      <div>
                        <p style={sx.text.xs}>Arrêt accéléré</p>
                        <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                          {departurePerformance.correctedDistances.accelerateStopDistance} ft
                        </p>
                        <p style={sx.text.xs}>
                          ({Math.round(departurePerformance.correctedDistances.accelerateStopDistance / 3.28084)} m)
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Performances atterrissage */}
            {arrivalPerformance && (
              <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(4))}>
                <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
                  🛬 Atterrissage - {arrivalAirport.name}
                </h4>

                {/* Conditions */}
                <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
                  <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(1))}>Conditions utilisées :</p>
                  <p style={sx.text.xs}>• Altitude: {arrivalPerformance.altitude} ft</p>
                  <p style={sx.text.xs}>• Température ISA: {arrivalPerformance.isaTemp.toFixed(1)}°C</p>
                  <p style={sx.text.xs}>
                    • Température réelle: {arrivalPerformance.actualTemp.toFixed(1)}°C
                    <span style={sx.text.secondary}> ({arrivalPerformance.dataSource.temp})</span>
                  </p>
                  {arrivalPerformance.weight && (
                    <p style={sx.text.xs}>
                      • Masse: {arrivalPerformance.weight} kg
                      <span style={sx.text.secondary}> ({arrivalPerformance.dataSource.weight})</span>
                    </p>
                  )}
                </div>

                {/* Résultats */}
                {arrivalPerformance.correctedDistances && (
                  <div>
                    <p style={sx.combine(sx.text.xs, sx.text.bold, sx.spacing.mb(2))}>Distances requises :</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      <div>
                        <p style={sx.text.xs}>Atterrissage</p>
                        <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                          {arrivalPerformance.correctedDistances.landingDistance} ft
                        </p>
                        <p style={sx.text.xs}>
                          ({Math.round(arrivalPerformance.correctedDistances.landingDistance / 3.28084)} m)
                        </p>
                      </div>
                      <div>
                        <p style={sx.text.xs}>Volets rentrés</p>
                        <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                          {arrivalPerformance.correctedDistances.landingDistanceFlapsUp} ft
                        </p>
                        <p style={sx.text.xs}>
                          ({Math.round(arrivalPerformance.correctedDistances.landingDistanceFlapsUp / 3.28084)} m)
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Affichage des performances si disponibles */}
      {selectedAircraft.performance && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4))}>
            <Calculator size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            Performances de l'avion
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {selectedAircraft.performance.takeoff && (
              <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
                <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                  ✈️ Décollage (conditions standards)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <p style={sx.text.xs}>TOD</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.takeoff.tod} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>15m</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.takeoff.toda15m} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>50ft</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.takeoff.toda50ft} m
                    </p>
                  </div>
                </div>
                {selectedAircraft.performance.conditions?.takeoff && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                    Conditions: {selectedAircraft.performance.conditions.takeoff.mass}kg, 
                    {selectedAircraft.performance.conditions.takeoff.altitude}ft, 
                    {selectedAircraft.performance.conditions.takeoff.temperature}°C
                  </p>
                )}
              </div>
            )}
            
            {selectedAircraft.performance.landing && (
              <div style={sx.combine(sx.components.card.base, sx.bg.gray)}>
                <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                  🛬 Atterrissage (conditions standards)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <p style={sx.text.xs}>LD</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.landing.ld} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>15m</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.landing.lda15m} m
                    </p>
                  </div>
                  <div>
                    <p style={sx.text.xs}>50ft</p>
                    <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                      {selectedAircraft.performance.landing.lda50ft} m
                    </p>
                  </div>
                </div>
                {selectedAircraft.performance.conditions?.landing && (
                  <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(2))}>
                    Conditions: {selectedAircraft.performance.conditions.landing.mass}kg, 
                    {selectedAircraft.performance.conditions.landing.altitude}ft, 
                    {selectedAircraft.performance.conditions.landing.temperature}°C
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Section Analyse du vent et pistes recommandées */}
      {(departureWeather || arrivalWeather) && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Wind size={20} style={{ marginRight: '8px' }} />
            Analyse du vent et pistes recommandées
          </h3>
          
          {/* Explication des calculs */}
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
            <h4 style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              <Compass size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Calcul des composantes de vent
            </h4>
            <div style={sx.text.xs}>
              <p style={sx.spacing.mb(1)}>
                <strong>Vent de face (Headwind):</strong> VF = V × cos(α) où α = angle entre vent et piste
              </p>
              <p style={sx.spacing.mb(1)}>
                <strong>Vent traversier (Crosswind):</strong> VT = V × sin(α)
              </p>
              <p style={sx.spacing.mb(1)}>
                <strong>Critères de sélection:</strong>
              </p>
              <ul style={{ marginLeft: '20px', marginTop: '4px' }}>
                <li>Piste recommandée = vent de face maximal (meilleure performance)</li>
                <li>Vent traversier {'<'} 15 kt = acceptable</li>
                <li>Vent traversier {'>'} 20 kt = attention requise</li>
                <li>Vent arrière {'>'} 10 kt = déconseillé (augmente distance de décollage/atterrissage)</li>
              </ul>
            </div>
          </div>
          
          {/* Pistes recommandées pour le départ */}
          {departureWeather?.metar?.wind && departureAirport?.name && (
            <div style={sx.spacing.mb(4)}>
              <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(2))}>
                ✈️ Départ - {departureAirport.name}
              </h4>
              <RunwaySuggestionEnhanced 
                icao={departureAirport.name} 
                wind={departureWeather.metar.wind}
                showDetails={true}
              />
            </div>
          )}
          
          {/* Pistes recommandées pour l'arrivée */}
          {arrivalWeather?.metar?.wind && arrivalAirport?.name && (
            <div>
              <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(2))}>
                🛬 Arrivée - {arrivalAirport.name}
              </h4>
              <RunwaySuggestionEnhanced 
                icao={arrivalAirport.name} 
                wind={arrivalWeather.metar.wind}
                showDetails={true}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Calculateur avancé si tableaux extraits disponibles */}
      {selectedAircraft.advancedPerformance?.tables && selectedAircraft.advancedPerformance.tables.length > 0 && (
        <AdvancedPerformanceCalculator aircraft={selectedAircraft} />
      )}
      
      {/* Calculateur de performances standard */}
      {(!selectedAircraft.advancedPerformance || selectedAircraft.advancedPerformance.tables?.length === 0) && (
        <PerformanceCalculator />
      )}
    </div>
  );
};

export default PerformanceModule;