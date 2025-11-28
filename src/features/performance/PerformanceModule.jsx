import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, AlertCircle, TrendingUp, Wind, Compass, FileText, Scale, Plane, MapPin, Thermometer, CheckCircle, XCircle, Table } from 'lucide-react';
import { sx } from '../../shared/styles/styleSystem';
import PerformanceTableCalculator from './components/PerformanceTableCalculator';
import { RunwaySuggestionEnhanced } from '../weather/components/RunwaySuggestionEnhanced';
import { useAircraft, useWeightBalance, useNavigation, useWeather, useFuel } from '../../core/contexts';
import { useWeatherStore } from '../../core/stores/weatherStore';
import { useAlternatesStore } from '../../core/stores/alternatesStore';
import { usePerformanceCalculations } from '../../shared/hooks/usePerformanceCalculations';
import { groupTablesByBaseName, filterGroupsByType } from '../../services/performanceTableGrouping';
import dataBackupManager from '../../utils/dataBackupManager';
import airportDataService from '../../services/airportDataService';

const PerformanceModule = ({ wizardMode = false, config = {} }) => {
  const { selectedAircraft } = useAircraft();
  const { calculations } = useWeightBalance();
  const { waypoints } = useNavigation();
  const { getWeatherByIcao } = useWeather();
  const { fuelData, fobFuel } = useFuel();
  const weatherData = useWeatherStore(state => state.weatherData || {});
  const fetchWeather = useWeatherStore(state => state.fetchWeather);
  const selectedAlternates = useAlternatesStore(state => state.selectedAlternates);
  const { calculateISATemperature } = usePerformanceCalculations();

  // État pour stocker les performanceTables chargées depuis IndexedDB
  const [loadedPerformanceTables, setLoadedPerformanceTables] = useState(null);
  const [loadingTables, setLoadingTables] = useState(false);

  // 🔧 Récupérer les données depuis flightPlan si en mode wizard
  const flightPlan = config?.flightPlan;
  const onUpdate = config?.onUpdate; // Callback pour notifier le wizard des changements

  // Récupérer les aérodromes de départ et d'arrivée
  const departureAirport = waypoints?.[0];
  const arrivalAirport = waypoints?.[waypoints?.length - 1];

  // 🔧 FIX: Charger automatiquement la météo des aérodromes
  useEffect(() => {
    const loadWeather = async () => {
      const icaosToLoad = [];

      // Vérifier si météo départ existe et est valide
      if (departureAirport?.icao) {
        const depIcao = departureAirport.icao.toUpperCase();
        const depWeather = weatherData[depIcao];

        // Charger si pas de METAR ou météo trop ancienne (> 30 min)
        if (!depWeather?.metar || (Date.now() - (depWeather.timestamp || 0) > 30 * 60 * 1000)) {
          icaosToLoad.push(depIcao);
          console.log('🌤️ [PerformanceModule] Chargement météo départ:', depIcao);
        }
      }

      // Vérifier si météo arrivée existe et est valide
      if (arrivalAirport?.icao && arrivalAirport.icao !== departureAirport?.icao) {
        const arrIcao = arrivalAirport.icao.toUpperCase();
        const arrWeather = weatherData[arrIcao];

        if (!arrWeather?.metar || (Date.now() - (arrWeather.timestamp || 0) > 30 * 60 * 1000)) {
          icaosToLoad.push(arrIcao);
          console.log('🌤️ [PerformanceModule] Chargement météo arrivée:', arrIcao);
        }
      }

      // Charger météo des alternates
      if (selectedAlternates && selectedAlternates.length > 0) {
        selectedAlternates.forEach(alternate => {
          if (alternate.icao) {
            const altIcao = alternate.icao.toUpperCase();
            const altWeather = weatherData[altIcao];

            if (!altWeather?.metar || (Date.now() - (altWeather.timestamp || 0) > 30 * 60 * 1000)) {
              icaosToLoad.push(altIcao);
              console.log('🌤️ [PerformanceModule] Chargement météo alternate:', altIcao);
            }
          }
        });
      }

      // Charger en parallèle
      if (icaosToLoad.length > 0) {
        console.log('🌤️ [PerformanceModule] Chargement météo:', icaosToLoad.join(', '));
        await Promise.all(icaosToLoad.map(icao => fetchWeather(icao)));
      }
    };

    loadWeather();
  }, [departureAirport?.icao, arrivalAirport?.icao, selectedAlternates, fetchWeather]);

  // 🔧 Charger les performanceTables depuis IndexedDB quand l'avion change
  useEffect(() => {
    const loadPerformanceTables = async () => {
      if (!selectedAircraft?.id) {
        setLoadedPerformanceTables(null);
        return;
      }

      // Si les tables/models sont déjà chargées dans selectedAircraft, les utiliser
      const existingTables = selectedAircraft.performanceTables || selectedAircraft.performanceModels;
      if (existingTables && existingTables.length > 0) {
        console.log('✅ [PerformanceModule] Abaques déjà chargés:', existingTables.length);
        setLoadedPerformanceTables(existingTables);
        return;
      }

      // Sinon, charger depuis IndexedDB
      setLoadingTables(true);
      console.log('🔍 [PerformanceModule] Chargement abaques depuis IndexedDB pour:', selectedAircraft.registration);

      try {
        await dataBackupManager.initPromise;
        const fullAircraft = await dataBackupManager.getAircraftData(selectedAircraft.id);

        console.log('📊 [PerformanceModule] Données chargées:', {
          hasPerformanceTables: !!fullAircraft?.performanceTables,
          tablesCount: fullAircraft?.performanceTables?.length || 0,
          hasPerformanceModels: !!fullAircraft?.performanceModels,
          modelsCount: fullAircraft?.performanceModels?.length || 0
        });

        // Vérifier d'abord performanceModels (abaques récents), puis performanceTables
        const abaques = fullAircraft?.performanceModels || fullAircraft?.performanceTables;

        if (abaques && abaques.length > 0) {
          console.log('✅ [PerformanceModule] Abaques chargés:', abaques.length);
          setLoadedPerformanceTables(abaques);
        } else {
          console.log('⚠️ [PerformanceModule] Aucun abaque trouvé');
          setLoadedPerformanceTables([]);
        }
      } catch (error) {
        console.error('❌ [PerformanceModule] Erreur chargement abaques:', error);
        setLoadedPerformanceTables([]);
      } finally {
        setLoadingTables(false);
      }
    };

    loadPerformanceTables();
  }, [selectedAircraft?.id]);

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

    // 🔧 FIX: Essayer de restaurer depuis flightPlan d'abord (pour rechargement page)
    const savedTemp = flightPlan?.performance?.departure?.temperature;

    // 🔧 FIX: Chemin correct vers température METAR = metar.decoded.temperature
    // weatherAPI.js ligne 91: { decoded: { temperature: data.temperature?.value ?? null } }
    const metarTemp = departureWeather?.metar?.decoded?.temperature ||
                      departureWeather?.decoded?.temperature ||
                      departureWeather?.temp ||
                      flightPlan?.weather?.departure?.metar?.decoded?.temperature;

    // 🚨 CRITIQUE: Si pas de METAR → utiliser savedTemp si disponible (rechargement page)
    // NE PAS utiliser ISA comme fallback (erreur grave de sécurité)
    const finalTemp = (metarTemp !== undefined && metarTemp !== null) ? metarTemp :
                      (savedTemp !== undefined && savedTemp !== null) ? savedTemp :
                      null;

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

    // 🔧 FIX: Essayer de restaurer depuis flightPlan d'abord (pour rechargement page)
    const savedTemp = flightPlan?.performance?.arrival?.temperature;

    // 🔧 FIX: Chemin correct vers température METAR = metar.decoded.temperature
    // weatherAPI.js ligne 91: { decoded: { temperature: data.temperature?.value ?? null } }
    const metarTemp = arrivalWeather?.metar?.decoded?.temperature ||
                      arrivalWeather?.decoded?.temperature ||
                      arrivalWeather?.temp ||
                      flightPlan?.weather?.arrival?.metar?.decoded?.temperature;

    // 🚨 CRITIQUE: Si pas de METAR → utiliser savedTemp si disponible (rechargement page)
    const finalTemp = (metarTemp !== undefined && metarTemp !== null) ? metarTemp :
                      (savedTemp !== undefined && savedTemp !== null) ? savedTemp :
                      null;

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

  // 🔧 FIX: Sauvegarder les températures dans flightPlan pour persistance
  useEffect(() => {
    if (!flightPlan || (!departureTemp && !arrivalTemp)) return;

    // Initialiser performance s'il n'existe pas
    if (!flightPlan.performance) {
      flightPlan.performance = {};
    }

    // Sauvegarder températures de départ
    if (departureTemp !== null && departureTemp !== undefined) {
      if (!flightPlan.performance.departure) {
        flightPlan.performance.departure = {};
      }
      if (flightPlan.performance.departure.temperature !== departureTemp) {
        flightPlan.performance.departure.temperature = departureTemp;
        console.log('💾 [PerformanceModule] Température départ sauvegardée:', departureTemp);
      }
    }

    // Sauvegarder températures d'arrivée
    if (arrivalTemp !== null && arrivalTemp !== undefined) {
      if (!flightPlan.performance.arrival) {
        flightPlan.performance.arrival = {};
      }
      if (flightPlan.performance.arrival.temperature !== arrivalTemp) {
        flightPlan.performance.arrival.temperature = arrivalTemp;
        console.log('💾 [PerformanceModule] Température arrivée sauvegardée:', arrivalTemp);
      }
    }
  }, [departureTemp, arrivalTemp, flightPlan]);

  // 💾 CALLBACKS : Sauvegarder les résultats de performance calculés
  const handleTakeoffResults = (result, metadata) => {
    if (!flightPlan || !departureAirport) return;

    // Initialiser la structure si nécessaire
    if (!flightPlan.performance) {
      flightPlan.performance = {};
    }
    if (!flightPlan.performance.departure) {
      flightPlan.performance.departure = {};
    }

    // Sauvegarder les résultats de décollage
    flightPlan.performance.departure = {
      ...flightPlan.performance.departure,
      icao: departureAirport.icao,
      name: departureAirport.name,
      takeoff: {
        groundRoll: result.groundRoll,
        toda50ft: result.distance50ft,
        toda15m: result.distance50ft, // Utiliser la même valeur pour 15m/50ft
        outOfRange: result.outOfRange,
        conditions: metadata.conditions
      }
    };

    console.log('💾 [PerformanceModule] Performances décollage sauvegardées:', flightPlan.performance.departure);

    // Notifier le wizard du changement pour forcer le re-render
    console.log('🔔 [PerformanceModule] onUpdate disponible?', !!onUpdate, typeof onUpdate);
    if (onUpdate && typeof onUpdate === 'function') {
      console.log('📢 [PerformanceModule] Appel onUpdate pour décollage');
      onUpdate(flightPlan);
    } else {
      console.warn('⚠️ [PerformanceModule] onUpdate NON disponible!');
    }
  };

  const handleLandingResults = (result, metadata) => {
    if (!flightPlan || !arrivalAirport) return;

    // Initialiser la structure si nécessaire
    if (!flightPlan.performance) {
      flightPlan.performance = {};
    }
    if (!flightPlan.performance.arrival) {
      flightPlan.performance.arrival = {};
    }

    // Sauvegarder les résultats d'atterrissage
    flightPlan.performance.arrival = {
      ...flightPlan.performance.arrival,
      icao: arrivalAirport.icao,
      name: arrivalAirport.name,
      landing: {
        groundRoll: result.groundRoll,
        lda50ft: result.distance50ft,
        lda15m: result.distance50ft, // Utiliser la même valeur pour 15m/50ft
        outOfRange: result.outOfRange,
        conditions: metadata.conditions
      }
    };

    console.log('💾 [PerformanceModule] Performances atterrissage sauvegardées:', flightPlan.performance.arrival);

    // Notifier le wizard du changement pour forcer le re-render
    console.log('🔔 [PerformanceModule] onUpdate disponible?', !!onUpdate, typeof onUpdate);
    if (onUpdate && typeof onUpdate === 'function') {
      console.log('📢 [PerformanceModule] Appel onUpdate pour atterrissage');
      onUpdate(flightPlan);
    } else {
      console.warn('⚠️ [PerformanceModule] onUpdate NON disponible!');
    }
  };

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

  // 🔍 DEBUG: Log pour voir ce qui est chargé
  console.log('🔍 [PerformanceModule] selectedAircraft:', {
    registration: selectedAircraft?.registration,
    hasAdvancedPerformance: !!selectedAircraft?.advancedPerformance,
    advancedPerformanceTablesCount: selectedAircraft?.advancedPerformance?.tables?.length || 0,
    hasPerformanceTables: !!selectedAircraft?.performanceTables,
    performanceTablesCount: selectedAircraft?.performanceTables?.length || 0,
    performanceTablesTypes: selectedAircraft?.performanceTables?.map(t => t.type || t.name) || []
  });

  // Si aucun tableau extrait disponible
  if (!selectedAircraft.advancedPerformance?.tables || selectedAircraft.advancedPerformance.tables.length === 0) {
    // Vérifier si l'avion a des abaques (performanceTables)
    const hasAbaques = selectedAircraft.performanceTables && selectedAircraft.performanceTables.length > 0;

    if (hasAbaques) {
      // L'avion a des abaques - Message différent
      return (
        <div style={sx.spacing.p(6)}>
          <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
            <Table size={48} style={{ margin: '0 auto 16px', color: '#3b82f6' }} />
            <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
              Avion avec abaques de performances
            </h3>
            <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(4))}>
              Cet avion ({selectedAircraft.registration}) utilise des <strong>abaques</strong> (graphiques) dans son MANEX.
            </p>
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, { textAlign: 'left', marginBottom: '16px' })}>
              <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                ⚠️ Limitation actuelle :
              </p>
              <p style={{ fontSize: '13px', lineHeight: '1.6' }}>
                Les abaques ne peuvent pas être interpolées automatiquement comme les tableaux de données.
                Vous devez consulter manuellement les graphiques du MANEX pour calculer les performances.
              </p>
            </div>
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, { textAlign: 'left' })}>
              <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
                📊 Abaques disponibles ({selectedAircraft.performanceTables.length}) :
              </p>
              <ul style={{ marginLeft: '20px', fontSize: '13px', lineHeight: '1.8' }}>
                {selectedAircraft.performanceTables.map((table, idx) => (
                  <li key={idx}>{table.name || table.type || `Abaque ${idx + 1}`}</li>
                ))}
              </ul>
              <p style={{ fontSize: '13px', marginTop: '12px', fontStyle: 'italic', color: '#64748b' }}>
                💡 Consultez votre MANEX pour utiliser ces abaques lors de la préparation du vol.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Cas particulier : Avion sélectionné mais performanceTables pas chargées
    // (données volumineuses chargées à la demande)
    console.log('⚠️ [PerformanceModule] Avion détecté mais performanceTables non chargées - Tentative de chargement depuis IndexedDB');

    // Afficher état de chargement
    if (loadingTables) {
      return (
        <div style={sx.spacing.p(6)}>
          <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
            <Table size={48} style={{ margin: '0 auto 16px', color: '#3b82f6' }} />
            <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
              Chargement des abaques...
            </h3>
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Chargement des données de performances pour {selectedAircraft.registration}
            </p>
          </div>
        </div>
      );
    }

    // Si les tables sont chargées et qu'il y en a, afficher les sections de test
    if (loadedPerformanceTables && loadedPerformanceTables.length > 0) {
      return <AbaqueTestSections
        abaques={loadedPerformanceTables}
        aircraft={selectedAircraft}
        departureTemp={departureTemp}
        departureAlt={departureAirport?.elevation}
        departureWeather={departureWeather}
        arrivalTemp={arrivalTemp}
        arrivalWeather={arrivalWeather}
        calculations={calculations}
        flightPlan={flightPlan}
        departureAirport={departureAirport}
        arrivalAirport={arrivalAirport}
        onUpdate={onUpdate}
      />;
    }

    // Aucune table trouvée après chargement
    return (
      <div style={sx.spacing.p(6)}>
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
          <Table size={48} style={{ margin: '0 auto 16px', color: '#f59e0b' }} />
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
            Aucun abaque trouvé
          </h3>
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(4))}>
            Aucune donnée de performance n'a été trouvée pour {selectedAircraft.registration}.
          </p>
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, { textAlign: 'left' })}>
            <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              💡 Pour ajouter des abaques :
            </p>
            <ol style={{ marginLeft: '20px', fontSize: '13px', lineHeight: '1.8' }}>
              <li>Allez dans l'onglet <strong>"Gestion Avions"</strong></li>
              <li>Sélectionnez votre avion ({selectedAircraft.registration})</li>
              <li>Cliquez sur <strong>"Modifier"</strong></li>
              <li>Allez dans l'onglet <strong>"🤖 Performances IA"</strong></li>
              <li>Uploadez et analysez les abaques du MANEX</li>
            </ol>
          </div>
        </div>
      </div>
    );

    // Aucun tableau ni abaque - Message pour extraire avec IA (CODE MORT - ne devrait jamais être atteint car cas géré au-dessus)
    /*return (
      <div style={sx.spacing.p(6)}>
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
    );*/
  }

  return (
    <div>
      {/* Section Décollage */}
      {takeoffGroups.length > 0 && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Plane size={20} style={{ marginRight: '8px', color: '#3b82f6', transform: 'rotate(-45deg)' }} />
            Décollage{departureAirport?.name && ` - ${departureAirport.name} (${departureAirport.icao})`}
          </h3>

          {/* Paramètres de décollage */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
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
              onResultsCalculated={handleTakeoffResults} // Sauvegarde automatique
            />
          ))}

          {/* Analyse des pistes pour le départ */}
          {departureWeather?.metar?.decoded?.wind && departureAirport?.icao && (
            <div style={sx.spacing.mt(4)}>
              <RunwaySuggestionEnhanced
                icao={departureAirport.icao}
                wind={departureWeather.metar.decoded.wind}
                aircraft={selectedAircraft}
                showCompact={false}
              />
            </div>
          )}
        </div>
      )}

      {/* Section Atterrissage */}
      {landingGroups.length > 0 && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Plane size={20} style={{ marginRight: '8px', color: '#10b981', transform: 'rotate(45deg)' }} />
            Atterrissage{arrivalAirport?.name && ` - ${arrivalAirport.name} (${arrivalAirport.icao})`}
          </h3>

            {/* Paramètres d'atterrissage */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
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
              onResultsCalculated={handleLandingResults} // Sauvegarde automatique
            />
          ))}

          {/* Analyse des pistes pour l'arrivée */}
          {arrivalWeather?.metar?.decoded?.wind && arrivalAirport?.icao && (
            <div style={sx.spacing.mt(4)}>
              <RunwaySuggestionEnhanced
                icao={arrivalAirport.icao}
                wind={arrivalWeather.metar.decoded.wind}
                aircraft={selectedAircraft}
                showCompact={false}
              />
            </div>
          )}
        </div>
      )}

      {/* Section Aérodromes de déroutement */}
      {selectedAlternates && selectedAlternates.length > 0 && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.mb(6))}>
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(4), sx.flex.start)}>
            <Wind size={20} style={{ marginRight: '8px' }} />
            Aérodromes de déroutement
          </h3>

          {selectedAlternates.map((alternate, idx) => {
            const altWeather = weatherData[alternate.icao?.toUpperCase()];

            return (
              <div
                key={idx}
                style={{
                  marginBottom: '24px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}
              >
                {/* En-tête de l'aérodrome */}
                <div style={{
                  marginBottom: '12px'
                }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#111827',
                    marginBottom: '6px'
                  }}>
                    {alternate.name || alternate.icao} ({alternate.icao})
                  </h4>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    display: 'flex',
                    gap: '16px'
                  }}>
                    <span>
                      📍 Distance: {alternate.distanceFromRoute?.toFixed(1) || 'N/A'} NM
                    </span>
                    <span>
                      🏔️ Élévation: {alternate.elevation || 'N/A'} ft
                    </span>
                  </div>
                </div>

                {/* Analyse des pistes */}
                {altWeather?.metar?.decoded?.wind ? (
                  <RunwaySuggestionEnhanced
                    icao={alternate.icao}
                    wind={altWeather.metar.decoded.wind}
                    aircraft={selectedAircraft}
                    showCompact={false}
                  />
                ) : (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    fontSize: '13px',
                    color: '#991b1b'
                  }}>
                    ⚠️ Météo non disponible - impossible d'analyser les pistes
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Composant pour afficher les sections de test des abaques
const AbaqueTestSections = ({
  abaques,
  aircraft,
  departureTemp,
  departureAlt,
  departureWeather,
  arrivalTemp,
  arrivalWeather,
  calculations,
  flightPlan,
  departureAirport,
  arrivalAirport,
  onUpdate
}) => {
  const { fuelData } = useFuel();

  // Paramètres de DÉCOLLAGE - Extraire automatiquement depuis les différentes étapes du wizard
  const takeoffParams = useMemo(() => {
    // Température depuis météo départ (Étape 3) - utiliser departureTemp qui est déjà calculé correctement
    const temperature = departureTemp !== null ? departureTemp : 15;

    // Altitude depuis aérodrome de départ (Étape 3)
    const pressure_altitude = departureAlt || 0;

    // Masse au décollage depuis calculs masse & centrage (Étape 5)
    const mass = calculations?.totalWeight || aircraft?.emptyWeight || 1000;

    // Vent depuis météo départ (Étape 3)
    const windSpeed = departureWeather?.metar?.decoded?.wind?.speed || 0;
    const wind = windSpeed;


    return {
      temperature,
      pressure_altitude,
      mass,
      wind
    };
  }, [departureWeather, departureAlt, calculations, aircraft, departureTemp]);

  // Paramètres d'ATTERRISSAGE - Utiliser les données de destination
  const landingParams = useMemo(() => {
    // Température depuis météo arrivée (Étape 3) - utiliser arrivalTemp qui est déjà calculé correctement
    const temperature = arrivalTemp !== null ? arrivalTemp : (departureTemp !== null ? departureTemp : 15);

    // Altitude depuis aérodrome d'arrivée
    const pressure_altitude = arrivalAirport?.elevation || departureAlt || 0;

    // Masse à l'atterrissage = Masse décollage - Carburant consommé
    const takeoffMass = calculations?.totalWeight || aircraft?.emptyWeight || 1000;
    const fuelConsumedLtr = (fuelData?.trip?.ltr || 0) + (fuelData?.roulage?.ltr || 0);
    const fuelConsumedKg = fuelConsumedLtr * 0.72; // Densité carburant aviation (approximation)
    const mass = takeoffMass - fuelConsumedKg;

    // Vent depuis météo arrivée (Étape 3)
    // Essayer plusieurs chemins possibles pour le vent
    // IMPORTANT: Utiliser ?? au lieu de || pour accepter 0 comme valeur valide
    const windSpeed = arrivalWeather?.metar?.decoded?.wind?.speed ??
                     arrivalWeather?.decoded?.wind?.speed ??
                     arrivalWeather?.wind?.speed ??
                     arrivalWeather?.metar?.wind?.speed ??
                     departureWeather?.metar?.decoded?.wind?.speed ?? 0;
    const wind = windSpeed;


    return {
      temperature,
      pressure_altitude,
      mass,
      wind
    };
  }, [arrivalTemp, arrivalWeather, arrivalAirport, departureTemp, departureWeather, departureAlt, calculations, aircraft, fuelData]);

  const [testResults, setTestResults] = useState({});

  // Grouper les abaques par catégorie
  const groupedAbaques = useMemo(() => {
    const takeoffAbaques = [];
    const landingAbaques = [];
    const otherAbaques = [];

    abaques.forEach((abaque, idx) => {
      const name = (abaque.name || abaque.type || '').toLowerCase();

      // Identifier les abaques de décollage
      if (name.includes('décollage') || name.includes('decollage') || name.includes('takeoff')) {
        takeoffAbaques.push({ abaque, idx });
      }
      // Identifier les abaques d'atterrissage
      else if (name.includes('atterrissage') || name.includes('landing')) {
        landingAbaques.push({ abaque, idx });
      }
      else {
        otherAbaques.push({ abaque, idx });
      }
    });

    return { takeoffAbaques, landingAbaques, otherAbaques };
  }, [abaques]);

  // Initialiser et calculer automatiquement pour tous les abaques
  useEffect(() => {
    const initialResults = {};

    abaques.forEach((abaque, idx) => {
      const name = (abaque.name || abaque.type || '').toLowerCase();

      // Utiliser landingParams pour les abaques d'atterrissage, takeoffParams pour les autres
      const params = (name.includes('atterrissage') || name.includes('landing'))
        ? landingParams
        : takeoffParams;

      // Calculer automatiquement l'interpolation pour chaque abaque avec les paramètres appropriés
      const result = calculateInterpolation(idx, params, abaque);
      initialResults[idx] = result;
    });

    setTestResults(initialResults);
  }, [abaques, takeoffParams, landingParams]);

  // Sauvegarder les résultats des abaques dans le flightPlan
  useEffect(() => {
    if (!flightPlan || !onUpdate || Object.keys(testResults).length === 0) return;

    // Trouver les résultats de décollage et atterrissage
    const takeoffResults = [];
    const landingResults = [];

    abaques.forEach((abaque, idx) => {
      const name = (abaque.name || abaque.type || '').toLowerCase();
      const result = testResults[idx];

      if (!result || result.error) return;

      if (name.includes('décollage') || name.includes('decollage') || name.includes('takeoff')) {
        console.log('📊 [PerformanceModule] Takeoff result:', {
          name: abaque.name || abaque.type,
          resultObject: result,
          distance: result.distance,
          type: typeof result.distance,
          isNaN: isNaN(result.distance),
          isUndefined: result.distance === undefined
        });

        // Valeur de secours si distance est invalide
        const validDistance = (result.distance !== undefined && !isNaN(result.distance))
          ? result.distance
          : 0;

        takeoffResults.push({
          name: abaque.name || abaque.type,
          distance: validDistance,
          unit: 'm'
        });
      } else if (name.includes('atterrissage') || name.includes('landing')) {
        console.log('📊 [PerformanceModule] Landing result:', {
          name: abaque.name || abaque.type,
          resultObject: result,
          distance: result.distance,
          type: typeof result.distance,
          isNaN: isNaN(result.distance),
          isUndefined: result.distance === undefined
        });

        // Valeur de secours si distance est invalide
        const validDistance = (result.distance !== undefined && !isNaN(result.distance))
          ? result.distance
          : 0;

        landingResults.push({
          name: abaque.name || abaque.type,
          distance: validDistance,
          unit: 'm'
        });
      }
    });

    // Sauvegarder dans flightPlan si on a des résultats
    let updated = false;

    if (takeoffResults.length > 0 && departureAirport) {
      if (!flightPlan.performance) flightPlan.performance = {};
      if (!flightPlan.performance.departure) flightPlan.performance.departure = {};

      flightPlan.performance.departure = {
        ...flightPlan.performance.departure,
        icao: departureAirport.icao,
        name: departureAirport.name,
        takeoff: {
          abaques: takeoffResults,
          conditions: {
            temperature: takeoffParams.temperature,
            altitude: takeoffParams.pressure_altitude,
            mass: takeoffParams.mass,
            wind: takeoffParams.wind
          }
        }
      };
      updated = true;
    }

    // Toujours sauvegarder la section atterrissage si on a un aéroport d'arrivée
    // Même sans abaques, on veut afficher les conditions
    if (arrivalAirport) {
      if (!flightPlan.performance) flightPlan.performance = {};
      if (!flightPlan.performance.arrival) flightPlan.performance.arrival = {};

      flightPlan.performance.arrival = {
        ...flightPlan.performance.arrival,
        icao: arrivalAirport.icao,
        name: arrivalAirport.name,
        landing: {
          abaques: landingResults,  // Peut être vide []
          conditions: {
            temperature: landingParams.temperature,
            altitude: landingParams.pressure_altitude,
            mass: landingParams.mass,
            wind: landingParams.wind
          }
        }
      };
      updated = true;
    }

    // Notifier le wizard si quelque chose a été mis à jour
    if (updated && typeof onUpdate === 'function') {
      console.log('💾 [PerformanceModule] Abaques sauvegardés:', {
        takeoff: takeoffResults,
        landing: landingResults,
        flightPlanPerformance: flightPlan.performance
      });
      onUpdate(flightPlan);
    } else {
      console.warn('⚠️ [PerformanceModule] Sauvegarde non effectuée:', {
        updated,
        hasOnUpdate: typeof onUpdate === 'function',
        takeoffResultsCount: takeoffResults.length,
        landingResultsCount: landingResults.length
      });
    }
  }, [testResults, abaques, takeoffParams, landingParams, flightPlan, onUpdate, departureAirport, arrivalAirport]);

  // Fonction pour calculer l'interpolation (IDW - Inverse Distance Weighting)
  const calculateInterpolation = (abaqueIndex, params = null, abaqueData = null) => {
    const abaque = abaqueData || abaques[abaqueIndex];
    const conditions = params || takeoffParams;

    // Essayer plusieurs structures de données possibles pour les extractedPoints
    let extractedPoints = [];

    // Structure 1: data.graphs[].curves[].points[] (structure AbacBuilder)
    if (abaque?.data?.graphs?.length > 0) {
      // DEBUG: Examiner la structure pour comprendre le mapping
      const firstGraph = abaque.data.graphs[0];
      const firstCurve = firstGraph?.curves?.[0];
      console.log('🔍 [DEBUG] Structure du premier graph:', {
        graphCount: abaque.data.graphs.length,
        firstGraphKeys: firstGraph ? Object.keys(firstGraph) : null,
        firstGraph: firstGraph,
        firstCurveKeys: firstCurve ? Object.keys(firstCurve) : null,
        firstCurve: firstCurve,
        first3Points: firstCurve?.points?.slice(0, 3)
      });

      // Extraire tous les points de tous les graphiques et toutes les courbes
      abaque.data.graphs.forEach((graph, gIdx) => {
        if (graph.curves?.length > 0) {
          graph.curves.forEach((curve, cIdx) => {
            if (curve.points?.length > 0) {
              // Déterminer le mapping selon les axes du graphique (axes.xAxis et axes.yAxis)
              const xAxisTitle = (graph.axes?.xAxis?.title || graph.xAxis?.title || '').toLowerCase();
              const yAxisTitle = (graph.axes?.yAxis?.title || graph.yAxis?.title || '').toLowerCase();
              const xAxisType = graph.axes?.xAxis?.type || graph.xAxis?.type || '';
              const yAxisType = graph.axes?.yAxis?.type || graph.yAxis?.type || '';

              // Extraire l'altitude de pression depuis le nom de la courbe (ex: "0ft", "2000ft")
              const curveAltitude = parseInt(curve.name) || 0;

              // Convertir les points XY en format avec métadonnées
              curve.points.forEach((point, pIdx) => {
                // Créer un objet de base
                const pointData = {
                  temperature: conditions.temperature,
                  pressure_altitude: curveAltitude || graph.pressureAltitude || conditions.pressure_altitude,
                  mass: curve.mass || conditions.mass,
                  wind: 0,
                  distance: 0
                };

                // Mapper point.x selon l'axe X (priorité au type, puis au titre)
                if (xAxisType === 'temperature' || xAxisTitle.includes('temp')) {
                  pointData.temperature = point.x;
                } else if (xAxisType === 'masse' || xAxisTitle.includes('masse') || xAxisTitle.includes('mass')) {
                  pointData.mass = point.x;
                } else if (xAxisType === 'vent' || xAxisTitle.includes('vent') || xAxisTitle.includes('wind')) {
                  pointData.wind = point.x;
                } else if (xAxisType === 'distance' || xAxisTitle.includes('distance')) {
                  pointData.distance = point.x;
                }

                // Mapper point.y selon l'axe Y (priorité au type, puis au titre)
                if (yAxisType === 'distance' || yAxisTitle.includes('distance')) {
                  pointData.distance = point.y;
                } else if (yAxisType === 'temperature' || yAxisTitle.includes('temp')) {
                  pointData.temperature = point.y;
                } else if (yAxisType === 'masse' || yAxisTitle.includes('masse') || yAxisTitle.includes('mass')) {
                  pointData.mass = point.y;
                }

                // DEBUG: Logger les 3 premiers points pour comprendre le mapping
                if (gIdx === 0 && cIdx === 0 && pIdx < 3) {
                  console.log(`🔍 [DEBUG] Point ${pIdx} extrait:`, {
                    rawPoint: point,
                    xAxisType,
                    yAxisType,
                    xAxisTitle,
                    yAxisTitle,
                    curveName: curve.name,
                    curveAltitude,
                    extracted: pointData,
                    WARNING: pointData.distance === 0 ? '⚠️ distance is 0! Axes might not match expected patterns' : '✅ distance set'
                  });
                }

                // WARN si la distance est toujours 0 après le mapping
                if (pointData.distance === 0 && pIdx === 0 && gIdx === 0 && cIdx === 0) {
                  console.warn('⚠️ [calculateInterpolation] ATTENTION: distance reste à 0 après mapping. Axes:', {
                    xAxisType, yAxisType, xAxisTitle, yAxisTitle,
                    graphAxes: graph.axes,
                    suggestion: 'Vérifier que les types/titres d\'axes correspondent aux patterns attendus'
                  });
                }

                extractedPoints.push(pointData);
              });
            }
          });
        }
      });
    }
    // Structure 2: data.graphs[0].extractedPoints (ancienne structure)
    else if (abaque?.data?.graphs?.[0]?.extractedPoints?.length > 0) {
      extractedPoints = abaque.data.graphs[0].extractedPoints;
    }
    // Structure 3: data.extractedPoints
    else if (abaque?.data?.extractedPoints?.length > 0) {
      extractedPoints = abaque.data.extractedPoints;
    }
    // Structure 4: extractedPoints direct
    else if (abaque?.extractedPoints?.length > 0) {
      extractedPoints = abaque.extractedPoints;
    }

    if (!extractedPoints || extractedPoints.length === 0) {
      console.warn('⚠️ [AbaqueTest] Aucun point trouvé. Structure abaque:', {
        hasData: !!abaque?.data,
        hasGraphs: !!abaque?.data?.graphs,
        graphsLength: abaque?.data?.graphs?.length,
        firstGraph: abaque?.data?.graphs?.[0],
        dataKeys: abaque?.data ? Object.keys(abaque.data) : null
      });
      return { error: 'Aucun point extrait disponible pour ce graphique' };
    }

    console.log(`✅ [AbaqueTest] ${extractedPoints.length} points trouvés pour l'interpolation`);

    // Calculer les distances entre les conditions de test et chaque point
    const distances = extractedPoints.map(point => {
      const tempDiff = (point.temperature - conditions.temperature) / 30;
      const altDiff = (point.pressure_altitude - conditions.pressure_altitude) / 2000;
      const massDiff = (point.mass - conditions.mass) / 100;
      const windDiff = (point.wind - conditions.wind) / 10;

      const distance = Math.sqrt(
        tempDiff * tempDiff +
        altDiff * altDiff +
        massDiff * massDiff +
        windDiff * windDiff
      );

      return { point, distance };
    });

    // Trier par distance et prendre les 4 points les plus proches
    distances.sort((a, b) => a.distance - b.distance);
    const nearestPoints = distances.slice(0, 4);

    // Interpolation IDW
    let totalWeight = 0;
    let weightedSum = 0;

    nearestPoints.forEach(({ point, distance }) => {
      const weight = 1 / (distance + 0.001); // Éviter division par zéro
      totalWeight += weight;
      weightedSum += point.distance * weight;
    });

    const interpolatedDistance = Math.round(weightedSum / totalWeight);
    const confidence = Math.round((1 - nearestPoints[0].distance) * 100);

    console.log('🧮 [calculateInterpolation] Calcul final:', {
      nearestPointsCount: nearestPoints.length,
      totalWeight,
      weightedSum,
      interpolatedDistance,
      isNaN: isNaN(interpolatedDistance),
      nearestPointDistances: nearestPoints.map(p => p.point.distance)
    });

    return {
      distance: interpolatedDistance,
      nearestPoints: nearestPoints.map(p => p.point),
      confidence: Math.max(0, Math.min(100, confidence))
    };
  };


  return (
    <div style={sx.spacing.p(6)}>
      {/* En-tête avec titre */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4), sx.spacing.mb(4))}>
        <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(2))}>
          🧪 Tests d'Interpolation des Abaques - {aircraft.registration}
        </h2>
        <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
          {abaques.length} abaque(s) disponible(s). Conditions de vol extraites automatiquement du wizard.
        </p>
      </div>

      {/* Section Décollage groupée */}
      {groupedAbaques.takeoffAbaques.length > 0 && (
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(4), sx.spacing.mb(4))}>
          {/* En-tête de la section Décollage */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(1), { color: '#10b981' })}>
              ✈️ Décollage
            </h2>
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              {groupedAbaques.takeoffAbaques.length} abaque(s) de décollage disponible(s)
            </p>
            {/* Affichage aérodrome de départ */}
            {departureAirport && (
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '6px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <MapPin size={14} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af' }}>
                  {departureAirport.icao}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {departureAirport.name}
                </span>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                  {departureAirport.elevation || departureAlt} ft
                </span>
              </div>
            )}

            {/* Paramètres de décollage */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#10b981',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Conditions de décollage
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                    Température
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
                    {takeoffParams.temperature.toFixed(1)}°C
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                    Altitude pression
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
                    {takeoffParams.pressure_altitude} ft
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                    Masse décollage
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
                    {takeoffParams.mass.toFixed(0)} kg
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                    Vent
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>
                    {takeoffParams.wind.toFixed(0)} kt
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Abaques de décollage */}
          {groupedAbaques.takeoffAbaques.map(({ abaque, idx }) => {
            const result = testResults[idx];
            const graphCount = abaque.data?.graphs?.length || 0;

            // Calculer le nombre total de points
            let pointsCount = 0;
            if (abaque.data?.graphs?.length > 0) {
              abaque.data.graphs.forEach(graph => {
                if (graph.curves?.length > 0) {
                  graph.curves.forEach(curve => {
                    pointsCount += curve.points?.length || 0;
                  });
                }
              });
            }

            return (
              <div key={idx} style={{
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: idx < groupedAbaques.takeoffAbaques.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none'
              }}>
                {/* Nom de l'abaque */}
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={sx.combine(sx.text.base, sx.text.bold, { color: '#1e40af' })}>
                    {abaque.name || abaque.type || `Abaque ${idx + 1}`}
                  </h3>
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    {graphCount} graphique(s) • {pointsCount} points extraits
                  </p>
                </div>

                {/* Affichage du résultat */}
                {result && (
                  <div>
                    {result.error ? (
                      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
                        <AlertCircle size={16} style={{ marginRight: '8px' }} />
                        {result.error}
                      </div>
                    ) : (
                      <div style={sx.combine(sx.components.alert.base, sx.components.alert.success)}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                          <CheckCircle size={20} style={{ marginRight: '8px', color: '#10b981' }} />
                          <span style={{ fontWeight: '600', fontSize: '14px' }}>Résultat de l'interpolation</span>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                          <p style={{ marginBottom: '4px' }}>
                            Distance prédite: <strong style={{ fontSize: '16px', color: '#10b981' }}>{result.distance}m</strong>
                          </p>
                          <p style={{ marginBottom: '4px', fontSize: '12px', color: '#64748b' }}>
                            Confiance: {result.confidence}% • Basé sur {result.nearestPoints.length} points voisins
                          </p>
                        </div>

                        {/* Afficher les 4 points voisins utilisés */}
                        <details style={{ marginTop: '12px', fontSize: '12px' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#64748b' }}>
                            🔍 Voir les {result.nearestPoints.length} points voisins utilisés
                          </summary>
                          <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #10b981' }}>
                            {result.nearestPoints.map((point, i) => (
                              <div key={i} style={{ marginBottom: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                                <strong>Point {i + 1}:</strong> Temp: {point.temperature}°C, Alt: {point.pressure_altitude}ft,
                                Masse: {point.mass}kg, Vent: {point.wind}kt → <strong>{point.distance}m</strong>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section Atterrissage */}
      <div style={sx.combine(sx.components.card.base, sx.spacing.p(4), sx.spacing.mb(4))}>
        {/* En-tête de la section Atterrissage */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mb(1), { color: '#f59e0b' })}>
            🛬 Atterrissage
          </h2>
          <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
            {groupedAbaques.landingAbaques.length > 0
              ? `${groupedAbaques.landingAbaques.length} abaque(s) d'atterrissage disponible(s)`
              : "Aucun abaque d'atterrissage disponible"}
          </p>
          {/* Affichage aérodrome de destination */}
          {arrivalAirport && (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MapPin size={14} style={{ color: '#3b82f6' }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af' }}>
                {arrivalAirport.icao}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {arrivalAirport.name}
              </span>
              <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>
                {arrivalAirport.elevation || 0} ft
              </span>
            </div>
          )}

          {/* Paramètres d'atterrissage */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#f59e0b',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Conditions d'atterrissage
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                  Température
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
                  {landingParams.temperature.toFixed(1)}°C
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                  Altitude pression
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
                  {landingParams.pressure_altitude} ft
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                  Masse atterrissage
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
                  {landingParams.mass.toFixed(0)} kg
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                  Vent
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
                  {landingParams.wind.toFixed(0)} kt
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Abaques d'atterrissage */}
        {groupedAbaques.landingAbaques.length > 0 ? (
          groupedAbaques.landingAbaques.map(({ abaque, idx }) => {
            const result = testResults[idx];
            const graphCount = abaque.data?.graphs?.length || 0;

            // Calculer le nombre total de points
            let pointsCount = 0;
            if (abaque.data?.graphs?.length > 0) {
              abaque.data.graphs.forEach(graph => {
                if (graph.curves?.length > 0) {
                  graph.curves.forEach(curve => {
                    pointsCount += curve.points?.length || 0;
                  });
                }
              });
            }

            return (
              <div key={idx} style={{
                marginBottom: '20px',
                paddingBottom: '20px',
                borderBottom: idx < groupedAbaques.landingAbaques.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none'
              }}>
                {/* Nom de l'abaque */}
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={sx.combine(sx.text.base, sx.text.bold, { color: '#d97706' })}>
                    {abaque.name || abaque.type || `Abaque ${idx + 1}`}
                  </h3>
                  <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                    {graphCount} graphique(s) • {pointsCount} points extraits
                  </p>
                </div>

                {/* Affichage du résultat */}
                {result && (
                  <div>
                    {result.error ? (
                      <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
                        <AlertCircle size={16} style={{ marginRight: '8px' }} />
                        {result.error}
                      </div>
                    ) : (
                      <div style={{
                        ...sx.components.alert.base,
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                          <CheckCircle size={20} style={{ marginRight: '8px', color: '#f59e0b' }} />
                          <span style={{ fontWeight: '600', fontSize: '14px' }}>Résultat de l'interpolation</span>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                          <p style={{ marginBottom: '4px' }}>
                            Distance prédite: <strong style={{ fontSize: '16px', color: '#f59e0b' }}>{result.distance}m</strong>
                          </p>
                          <p style={{ marginBottom: '4px', fontSize: '12px', color: '#64748b' }}>
                            Confiance: {result.confidence}% • Basé sur {result.nearestPoints.length} points voisins
                          </p>
                        </div>

                        {/* Afficher les 4 points voisins utilisés */}
                        <details style={{ marginTop: '12px', fontSize: '12px' }}>
                          <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#64748b' }}>
                            🔍 Voir les {result.nearestPoints.length} points voisins utilisés
                          </summary>
                          <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #f59e0b' }}>
                            {result.nearestPoints.map((point, i) => (
                              <div key={i} style={{ marginBottom: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                                <strong>Point {i + 1}:</strong> Temp: {point.temperature}°C, Alt: {point.pressure_altitude}ft,
                                Masse: {point.mass}kg, Vent: {point.wind}kt → <strong>{point.distance}m</strong>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            borderRadius: '8px',
            border: '1px dashed rgba(245, 158, 11, 0.3)',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <p style={{ fontSize: '14px', marginBottom: '8px' }}>
              📊 Aucun abaque d'atterrissage disponible
            </p>
            <p style={{ fontSize: '12px' }}>
              Les abaques d'atterrissage seront affichés ici une fois ajoutés au modèle de performances.
            </p>
          </div>
        )}
      </div>

      {/* Autres abaques (non décollage) */}
      {groupedAbaques.otherAbaques.map(({ abaque, idx }) => {
        const result = testResults[idx];
        const graphCount = abaque.data?.graphs?.length || 0;

        // Calculer le nombre total de points dans tous les graphiques et courbes
        let pointsCount = 0;
        if (abaque.data?.graphs?.length > 0) {
          abaque.data.graphs.forEach(graph => {
            if (graph.curves?.length > 0) {
              graph.curves.forEach(curve => {
                pointsCount += curve.points?.length || 0;
              });
            }
          });
        }

        return (
          <div key={idx} style={sx.combine(sx.components.card.base, sx.spacing.p(4), sx.spacing.mb(4))}>
            {/* En-tête de l'abaque */}
            <div style={{ marginBottom: '16px' }}>
              <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(1))}>
                {abaque.name || abaque.type || `Abaque ${idx + 1}`}
              </h3>
              <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
                {graphCount} graphique(s) • {pointsCount} points extraits
              </p>
              {/* Affichage aérodrome de départ */}
              {departureAirport && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <MapPin size={14} style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e40af' }}>
                    {departureAirport.icao}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {departureAirport.name}
                  </span>
                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                    {departureAirport.elevation || departureAlt} ft
                  </span>
                </div>
              )}
            </div>

            {/* Affichage du résultat (calcul automatique) */}
            {result && (
              <div style={{ marginTop: '16px' }}>
                {result.error ? (
                  <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
                    <AlertCircle size={16} style={{ marginRight: '8px' }} />
                    {result.error}
                  </div>
                ) : (
                  <div style={sx.combine(sx.components.alert.base, sx.components.alert.success)}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <CheckCircle size={20} style={{ marginRight: '8px', color: '#10b981' }} />
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>Résultat de l'interpolation</span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '4px' }}>
                        Distance prédite: <strong style={{ fontSize: '16px', color: '#10b981' }}>{result.distance}m</strong>
                      </p>
                      <p style={{ marginBottom: '4px', fontSize: '12px', color: '#64748b' }}>
                        Confiance: {result.confidence}% • Basé sur {result.nearestPoints.length} points voisins
                      </p>
                    </div>

                    {/* Afficher les 4 points voisins utilisés */}
                    <details style={{ marginTop: '12px', fontSize: '12px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#64748b' }}>
                        🔍 Voir les {result.nearestPoints.length} points voisins utilisés
                      </summary>
                      <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #10b981' }}>
                        {result.nearestPoints.map((point, i) => (
                          <div key={i} style={{ marginBottom: '6px', fontSize: '11px', fontFamily: 'monospace' }}>
                            <strong>Point {i + 1}:</strong> Temp: {point.temperature}°C, Alt: {point.pressure_altitude}ft,
                            Masse: {point.mass}kg, Vent: {point.wind}kt → <strong>{point.distance}m</strong>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PerformanceModule;
