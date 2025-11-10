import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, AlertCircle, TrendingUp, Wind, Compass, FileText, Scale, Plane, MapPin, Thermometer, CheckCircle, XCircle, Table } from 'lucide-react';
import { sx } from '../../shared/styles/styleSystem';
import PerformanceTableCalculator from './components/PerformanceTableCalculator';
import { RunwaySuggestionEnhanced } from '../weather/components/RunwaySuggestionEnhanced';
import { useAircraft, useWeightBalance, useNavigation, useWeather, useFuel } from '../../core/contexts';
import { useWeatherStore } from '../../core/stores/weatherStore';
import { usePerformanceCalculations } from '../../shared/hooks/usePerformanceCalculations';
import { groupTablesByBaseName, filterGroupsByType } from '../../services/performanceTableGrouping';

const PerformanceModule = ({ wizardMode = false, config = {} }) => {
  const { selectedAircraft } = useAircraft();
  const { calculations } = useWeightBalance();
  const { waypoints } = useNavigation();
  const { getWeatherByIcao } = useWeather();
  const { fuelData, fobFuel } = useFuel();
  const weatherData = useWeatherStore(state => state.weatherData || {});
  const { calculateISATemperature } = usePerformanceCalculations();

  // 🔧 Récupérer les données depuis flightPlan si en mode wizard
  const flightPlan = config?.flightPlan;

  // Récupérer les aérodromes de départ et d'arrivée
  const departureAirport = waypoints?.[0];
  const arrivalAirport = waypoints?.[waypoints?.length - 1];

  // Récupérer la météo pour les aérodromes (indexé par ICAO, pas par name)
  // 🔧 FIX: Essayer plusieurs sources pour trouver la météo
  const departureWeather = departureAirport?.icao && (
    weatherData[departureAirport.icao.toUpperCase()] ||
    weatherData[departureAirport.icao] ||
    flightPlan?.weather?.departure
  );
  const arrivalWeather = arrivalAirport?.icao && (
    weatherData[arrivalAirport.icao.toUpperCase()] ||
    weatherData[arrivalAirport.icao] ||
    flightPlan?.weather?.arrival
  );

  // 🚨 SÉCURITÉ CRITIQUE : Température depuis METAR uniquement
  // NE JAMAIS utiliser ISA comme fallback → DANGER performances incorrectes
  const departureTemp = useMemo(() => {
    if (!departureAirport) return null;

    // 🔧 FIX: Chemin correct vers température METAR = metar.decoded.temperature
    // weatherAPI.js ligne 91: { decoded: { temperature: data.temperature?.value ?? null } }
    const metarTemp = departureWeather?.metar?.decoded?.temperature ||
                      departureWeather?.decoded?.temperature ||
                      departureWeather?.temp ||
                      flightPlan?.weather?.departure?.metar?.decoded?.temperature;

    // 🚨 CRITIQUE: Si pas de METAR → null (afficher "NON DISPONIBLE")
    // NE PAS utiliser ISA comme fallback (erreur grave de sécurité)
    const finalTemp = metarTemp !== undefined && metarTemp !== null ? metarTemp : null;

    console.log('🌡️ [PerformanceModule] Départ temp DEBUG:', {
      icao: departureAirport?.icao?.toUpperCase(),
      hasWeather: !!departureWeather,
      hasMETAR: !!departureWeather?.metar,
      hasDecoded: !!departureWeather?.metar?.decoded,
      metarTemp,
      finalTemp,
      weatherStructure: departureWeather ? {
        keys: Object.keys(departureWeather),
        metarKeys: departureWeather.metar ? Object.keys(departureWeather.metar) : 'pas de metar',
        decodedKeys: departureWeather.metar?.decoded ? Object.keys(departureWeather.metar.decoded) : 'pas de decoded'
      } : 'pas de weather',
      verdict: finalTemp !== null ? '✅ METAR trouvé' : '❌ PAS DE METAR - NON DISPONIBLE'
    });

    return finalTemp;
  }, [departureAirport, departureWeather, weatherData, flightPlan]);

  // 🚨 SÉCURITÉ CRITIQUE : Température depuis METAR uniquement
  const arrivalTemp = useMemo(() => {
    if (!arrivalAirport) return null;

    // 🔧 FIX: Chemin correct vers température METAR = metar.decoded.temperature
    // weatherAPI.js ligne 91: { decoded: { temperature: data.temperature?.value ?? null } }
    const metarTemp = arrivalWeather?.metar?.decoded?.temperature ||
                      arrivalWeather?.decoded?.temperature ||
                      arrivalWeather?.temp ||
                      flightPlan?.weather?.arrival?.metar?.decoded?.temperature;

    // 🚨 CRITIQUE: Si pas de METAR → null (afficher "NON DISPONIBLE")
    const finalTemp = metarTemp !== undefined && metarTemp !== null ? metarTemp : null;

    console.log('🌡️ [PerformanceModule] Arrivée temp DEBUG:', {
      icao: arrivalAirport?.icao?.toUpperCase(),
      hasWeather: !!arrivalWeather,
      hasMETAR: !!arrivalWeather?.metar,
      hasDecoded: !!arrivalWeather?.metar?.decoded,
      metarTemp,
      finalTemp,
      weatherStructure: arrivalWeather ? {
        keys: Object.keys(arrivalWeather),
        metarKeys: arrivalWeather.metar ? Object.keys(arrivalWeather.metar) : 'pas de metar',
        decodedKeys: arrivalWeather.metar?.decoded ? Object.keys(arrivalWeather.metar.decoded) : 'pas de decoded'
      } : 'pas de weather',
      verdict: finalTemp !== null ? '✅ METAR trouvé' : '❌ PAS DE METAR - NON DISPONIBLE'
    });

    return finalTemp;
  }, [arrivalAirport, arrivalWeather, flightPlan]);

  // 🔧 NOUVEAU: Regrouper les tableaux par nom de base (sans masse)
  const tableGroups = useMemo(() => {
    if (!selectedAircraft?.advancedPerformance?.tables) return [];

    const groups = groupTablesByBaseName(selectedAircraft.advancedPerformance.tables);
    console.log('📊 [PerformanceModule] Groupes créés:', groups);
    return groups;
  }, [selectedAircraft?.advancedPerformance?.tables]);

  // Séparer les groupes T/O et LDG
  const takeoffGroups = useMemo(() => {
    const groups = filterGroupsByType(tableGroups, 'takeoff');
    console.log('✈️ [PerformanceModule] Groupes décollage:', groups.length, groups);
    return groups;
  }, [tableGroups]);

  const landingGroups = useMemo(() => {
    const groups = filterGroupsByType(tableGroups, 'landing');
    console.log('🛬 [PerformanceModule] Groupes atterrissage:', groups.length, groups);
    return groups;
  }, [tableGroups]);

  // 🔧 NOUVEAU: Poids de repli basé sur le MTOW ou la masse max des tableaux
  const fallbackWeight = useMemo(() => {
    // 1. Essayer MTOW de l'avion
    if (selectedAircraft?.maxTakeoffWeight) {
      return selectedAircraft.maxTakeoffWeight;
    }

    // 2. Utiliser la masse maximale des groupes de tableaux
    if (takeoffGroups.length > 0 && takeoffGroups[0].masses?.length > 0) {
      const maxMass = Math.max(...takeoffGroups[0].masses);
      console.log('⚖️ [PerformanceModule] Poids de repli depuis tableaux:', maxMass);
      return maxMass;
    }

    // 3. Valeur par défaut pour DA40 NG
    return 1310; // kg (MTOW typique DA40 NG)
  }, [selectedAircraft, takeoffGroups]);

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

  // Si aucun tableau extrait disponible
  if (!selectedAircraft.advancedPerformance?.tables || selectedAircraft.advancedPerformance.tables.length === 0) {
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

        {/* Message: Aucun tableau extrait */}
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
          <Table size={48} style={{ margin: '0 auto 16px', color: '#f59e0b' }} />
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
            Aucun tableau de performance extrait
          </h3>
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(4))}>
            Pour utiliser le module Performance, vous devez d'abord analyser les tableaux de performances du MANEX avec l'IA.
          </p>
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, { textAlign: 'left' })}>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              📝 Marche à suivre :
            </p>
            <ol style={{ marginLeft: '20px', marginTop: '8px', fontSize: '13px' }}>
              <li>Allez dans "Gestion Avions"</li>
              <li>Sélectionnez votre avion ({selectedAircraft.registration})</li>
              <li>Cliquez sur "Modifier"</li>
              <li>Allez dans l'onglet "🤖 Performances IA"</li>
              <li>Uploadez ou analysez vos tableaux de performances</li>
              <li>Revenez ici pour utiliser les calculateurs</li>
            </ol>
          </div>
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

      {/* Section: Données de DÉCOLLAGE */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(4))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
            <Plane size={20} style={{ marginRight: '8px', color: '#3b82f6', transform: 'rotate(-45deg)' }} />
            Décollage - {departureAirport?.name || 'Non défini'}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {/* Masse décollage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Scale size={16} style={{ marginRight: '6px', color: '#8b5cf6' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Masse</h4>
            </div>
            {calculations?.totalWeight ? (
              <>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {calculations.totalWeight.toFixed(1)} kg
                </p>
                {calculations.isWithinLimits ? (
                  <div style={sx.combine(sx.flex.start, sx.spacing.mt(1))}>
                    <CheckCircle size={12} style={{ marginRight: '4px', color: '#10b981' }} />
                    <span style={sx.combine(sx.text.xs, { color: '#10b981' })}>OK</span>
                  </div>
                ) : (
                  <div style={sx.combine(sx.flex.start, sx.spacing.mt(1))}>
                    <XCircle size={12} style={{ marginRight: '4px', color: '#ef4444' }} />
                    <span style={sx.combine(sx.text.xs, { color: '#ef4444' })}>Hors limites</span>
                  </div>
                )}
              </>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non définie</p>
            )}
          </div>

          {/* Altitude décollage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <MapPin size={16} style={{ marginRight: '6px', color: '#3b82f6' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Altitude</h4>
            </div>
            {departureAirport ? (
              <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                {departureAirport.elevation || 0} ft
              </p>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non définie</p>
            )}
          </div>

          {/* Température décollage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Thermometer size={16} style={{ marginRight: '6px', color: '#f59e0b' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Température</h4>
            </div>
            {departureTemp !== null ? (
              <>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {departureTemp}°C
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  METAR
                </p>
              </>
            ) : (
              <>
                <p style={sx.combine(sx.text.lg, sx.text.bold, { color: '#ef4444' })}>
                  NON DISPONIBLE
                </p>
                <p style={sx.combine(sx.text.xs, { color: '#ef4444' })}>
                  ⚠️ Consulter météo
                </p>
              </>
            )}
          </div>

          {/* Vent décollage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Wind size={16} style={{ marginRight: '6px', color: '#06b6d4' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Vent</h4>
            </div>
            {/* 🔧 FIX: Chemin correct = metar.decoded.wind (weatherAPI.js lignes 81-85) */}
            {departureWeather?.metar?.decoded?.wind ? (
              <>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {departureWeather.metar.decoded.wind.speed || 0} kt
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  {departureWeather.metar.decoded.wind.direction || '---'}°
                </p>
              </>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non disponible</p>
            )}
          </div>
        </div>
      </div>

      {/* Section: Données d'ATTERRISSAGE */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(4))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.flex.start)}>
            <Plane size={20} style={{ marginRight: '8px', color: '#10b981', transform: 'rotate(45deg)' }} />
            Atterrissage - {arrivalAirport?.name || 'Non défini'}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {/* Masse atterrissage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Scale size={16} style={{ marginRight: '6px', color: '#8b5cf6' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Masse</h4>
            </div>
            {(() => {
              // 🔧 FIX: Utiliser landingWeight depuis flightPlan (Step6) au lieu de recalculer
              const landingWeight = flightPlan?.weightBalance?.landingWeight || calculations?.totalWeight;

              return landingWeight ? (
                <>
                  <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                    {landingWeight.toFixed(1)} kg
                  </p>
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    {flightPlan?.weightBalance?.landingWeight ? 'Depuis Step 6' : 'Estimée'}
                  </p>
                </>
              ) : (
                <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non définie</p>
              );
            })()}
          </div>

          {/* Altitude atterrissage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <MapPin size={16} style={{ marginRight: '6px', color: '#10b981' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Altitude</h4>
            </div>
            {arrivalAirport ? (
              <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                {arrivalAirport.elevation || 0} ft
              </p>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non définie</p>
            )}
          </div>

          {/* Température atterrissage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Thermometer size={16} style={{ marginRight: '6px', color: '#f59e0b' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Température</h4>
            </div>
            {arrivalTemp !== null ? (
              <>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {arrivalTemp}°C
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  METAR
                </p>
              </>
            ) : (
              <>
                <p style={sx.combine(sx.text.lg, sx.text.bold, { color: '#ef4444' })}>
                  NON DISPONIBLE
                </p>
                <p style={sx.combine(sx.text.xs, { color: '#ef4444' })}>
                  ⚠️ Consulter météo
                </p>
              </>
            )}
          </div>

          {/* Vent atterrissage */}
          <div style={sx.combine(sx.components.card.base, sx.bg.gray, sx.spacing.p(3))}>
            <div style={sx.combine(sx.flex.start, sx.spacing.mb(2))}>
              <Wind size={16} style={{ marginRight: '6px', color: '#06b6d4' }} />
              <h4 style={sx.combine(sx.text.xs, sx.text.bold)}>Vent</h4>
            </div>
            {/* 🔧 FIX: Chemin correct = metar.decoded.wind (weatherAPI.js lignes 81-85) */}
            {arrivalWeather?.metar?.decoded?.wind ? (
              <>
                <p style={sx.combine(sx.text.lg, sx.text.bold)}>
                  {arrivalWeather.metar.decoded.wind.speed || 0} kt
                </p>
                <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                  {arrivalWeather.metar.decoded.wind.direction || '---'}°
                </p>
              </>
            ) : (
              <p style={sx.combine(sx.text.sm, sx.text.secondary)}>Non disponible</p>
            )}
          </div>
        </div>
      </div>

      {/* Section: Tableaux extraits et calculateurs */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
        <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
          <Table size={20} style={{ marginRight: '8px' }} />
          Tableaux de performances ({tableGroups.length} groupe{tableGroups.length > 1 ? 's' : ''})
        </h3>

        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(4))}>
          <p style={sx.text.sm}>
            <strong>{tableGroups.length} groupe{tableGroups.length > 1 ? 's' : ''}</strong> de tableaux de performances extraits par IA.
            Chaque groupe peut contenir plusieurs masses. L'interpolation est automatique.
          </p>
          <p style={sx.combine(sx.text.xs, sx.spacing.mt(1))}>
            Les valeurs par défaut (altitude, température, masse) sont automatiquement remplies depuis les autres modules.
            Vous pouvez les modifier manuellement dans chaque calculateur.
          </p>
        </div>

        {/* Groupes de tableaux de décollage */}
        {takeoffGroups.length > 0 && (
          <>
            <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3))}>
              ✈️ Décollage ({takeoffGroups.length} groupe{takeoffGroups.length > 1 ? 's' : ''})
            </h4>
            {takeoffGroups.map((group, index) => (
              <PerformanceTableCalculator
                key={`takeoff-group-${index}`}
                tableGroup={group}
                index={index}
                defaultAltitude={departureAirport?.elevation || 0}
                defaultTemperature={departureTemp}
                defaultWeight={calculations?.totalWeight || fallbackWeight}
                departureAirport={departureAirport}
                isExpanded={index === 0} // Premier groupe ouvert par défaut
              />
            ))}
          </>
        )}

        {/* Groupes de tableaux d'atterrissage */}
        {landingGroups.length > 0 && (
          <>
            <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(3), sx.spacing.mt(4))}>
              🛬 Atterrissage ({landingGroups.length} groupe{landingGroups.length > 1 ? 's' : ''})
            </h4>
            {landingGroups.map((group, index) => (
              <PerformanceTableCalculator
                key={`landing-group-${index}`}
                tableGroup={group}
                index={index}
                defaultAltitude={arrivalAirport?.elevation || 0}
                defaultTemperature={arrivalTemp}
                defaultWeight={(calculations?.totalWeight || fallbackWeight) - 50} // Estimation masse atterrissage (moins carburant)
                arrivalAirport={arrivalAirport}
                isExpanded={index === 0} // Premier groupe ouvert par défaut
              />
            ))}
          </>
        )}
      </div>

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
          {/* 🔧 FIX: Chemin correct = metar.decoded.wind */}
          {departureWeather?.metar?.decoded?.wind && departureAirport?.name && (
            <div style={sx.spacing.mb(4)}>
              <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(2))}>
                ✈️ Départ - {departureAirport.name}
              </h4>
              <RunwaySuggestionEnhanced
                icao={departureAirport.name}
                wind={departureWeather.metar.decoded.wind}
                showDetails={true}
              />
            </div>
          )}

          {/* Pistes recommandées pour l'arrivée */}
          {/* 🔧 FIX: Chemin correct = metar.decoded.wind */}
          {arrivalWeather?.metar?.decoded?.wind && arrivalAirport?.name && (
            <div>
              <h4 style={sx.combine(sx.text.md, sx.text.bold, sx.spacing.mb(2))}>
                🛬 Arrivée - {arrivalAirport.name}
              </h4>
              <RunwaySuggestionEnhanced
                icao={arrivalAirport.name}
                wind={arrivalWeather.metar.decoded.wind}
                showDetails={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceModule;
