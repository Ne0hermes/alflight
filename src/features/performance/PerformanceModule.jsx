import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Wind, Scale, MapPin, Thermometer, Table } from 'lucide-react';
import { sx } from '../../shared/styles/styleSystem';
import PerformanceDataDebugger from './components/PerformanceDataDebugger';
import { PerformanceStateMatrix } from './components/PerformanceStateMatrix';
import { RunwaySuggestionEnhanced } from '../weather/components/RunwaySuggestionEnhanced';
import { useAircraft, useWeightBalance, useNavigation, useWeather, useFuel } from '../../core/contexts';
import { useWeatherStore } from '../../core/stores/weatherStore';
import { useAlternatesStore } from '../../core/stores/alternatesStore';
import { usePerformanceCalculations } from '../../shared/hooks/usePerformanceCalculations';
import { useActiveRunwayWind } from '../../shared/hooks/useActiveRunwayWind';
import { groupTablesByBaseName, filterGroupsByType } from '../../services/performanceTableGrouping';
import dataBackupManager from '../../utils/dataBackupManager';
import { FUEL_DENSITIES } from '../../utils/constants';
import { getWaypointIcao } from '../../shared/utils/getWaypointIcao';
import { SAFETY_FACTOR_PRESETS, DEFAULT_SAFETY_FACTOR } from '../../utils/performanceSafetyFactor';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

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
  // Facteur de sécurité OPTIONNEL appliqué à l'affichage des distances.
  // Par défaut : 'raw' (× 1.0) — strictement les valeurs MANEX, aucune marge.
  // Le pilote peut sélectionner une marge réglementaire (VFR/IFR/CAT) via le
  // dropdown au-dessus des matrices. Le facteur n'affecte QUE le rendu, pas
  // les valeurs stockées ni les calculs amont.
  const [safetyFactorId, setSafetyFactorId] = useState(DEFAULT_SAFETY_FACTOR.id);
  const safetyFactor = useMemo(
    () => SAFETY_FACTOR_PRESETS.find(p => p.id === safetyFactorId) || DEFAULT_SAFETY_FACTOR,
    [safetyFactorId]
  );

  // 🔧 Récupérer les données depuis flightPlan si en mode wizard
  const flightPlan = config?.flightPlan;
  const onUpdate = config?.onUpdate; // Callback pour notifier le wizard des changements

  // Récupérer les aérodromes de départ et d'arrivée
  const departureAirport = waypoints?.[0];
  const arrivalAirport = waypoints?.[waypoints?.length - 1];

  // Code ICAO départ/arrivée via util partagé (source unique de vérité,
  // cf. src/shared/utils/getWaypointIcao.js)
  const departureIcao = getWaypointIcao(departureAirport);
  const arrivalIcao = getWaypointIcao(arrivalAirport);

  // 🔧 FIX: Charger automatiquement la météo des aérodromes
  useEffect(() => {
    const loadWeather = async () => {
      const icaosToLoad = [];

      // Vérifier si météo départ existe et est valide
      if (departureIcao) {
        const depWeather = weatherData[departureIcao];

        // Charger si pas de METAR ou météo trop ancienne (> 30 min)
        if (!depWeather?.metar || (Date.now() - (depWeather.timestamp || 0) > 30 * 60 * 1000)) {
          icaosToLoad.push(departureIcao);
          console.log('🌤️ [PerformanceModule] Chargement météo départ:', departureIcao);
        }
      }

      // Vérifier si météo arrivée existe et est valide
      if (arrivalIcao && arrivalIcao !== departureIcao) {
        const arrWeather = weatherData[arrivalIcao];

        if (!arrWeather?.metar || (Date.now() - (arrWeather.timestamp || 0) > 30 * 60 * 1000)) {
          icaosToLoad.push(arrivalIcao);
          console.log('🌤️ [PerformanceModule] Chargement météo arrivée:', arrivalIcao);
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
  }, [departureIcao, arrivalIcao, selectedAlternates, fetchWeather, weatherData]);

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
  // 🔧 FIX: Utiliser departureIcao/arrivalIcao qui gère le fallback name → icao
  const departureWeather = departureIcao && (
    weatherData[departureIcao] ||
    flightPlan?.weather?.departure
  );
  const arrivalWeather = arrivalIcao && (
    weatherData[arrivalIcao] ||
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
      icao: departureIcao,
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
      icao: arrivalIcao,
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
        conditions: {
          ...metadata.conditions,
          mass: metadata.conditions.weight || calculations?.totalWeight || fallbackWeight,
          wind: departureWeather?.metar?.decoded?.wind || departureWeather?.wind || null
        }
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
        conditions: {
          ...metadata.conditions,
          mass: metadata.conditions.weight || flightPlan?.weightBalance?.landingWeight || calculations?.totalWeight || fallbackWeight,
          wind: arrivalWeather?.metar?.decoded?.wind || arrivalWeather?.wind || null
        }
      }
    };

    console.log('🔍 [PerformanceModule] DEBUG Atterrissage:', {
      metadataWeight: metadata?.conditions?.weight,
      arrivalWeatherWind: arrivalWeather?.metar?.decoded?.wind,
      arrivalWeatherRaw: arrivalWeather,
      savedConditions: flightPlan.performance.arrival.landing.conditions
    });

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

  // ─── PHASE 3 : pré-calcul des inputs pour la matrice de couverture exhaustive ───
  // Ces inputs sont consommés dans chaque branche de rendu (early-returns + main return)
  // pour que la matrice s'affiche en toutes circonstances, y compris quand l'avion
  // n'a pas (encore) de tableaux AI ou que la prep de vol est en cours.
  // ─── INPUTS DE LA MATRICE DE COUVERTURE ───
  // Fallbacks alignés sur les anciens tests d'interpolation legacy pour garantir
  // la cohérence des résultats produits par le résolveur en cascade.

  // Mass : calculations.totalWeight → emptyWeight → 1000 (PAS le MTOW comme avant)
  const takeoffMass = calculations?.totalWeight || selectedAircraft?.emptyWeight || 1000;

  // Mass atterrissage : décollage - carburant consommé
  // Densité dépendant du type carburant de l'avion (FUEL_DENSITIES centralisé,
  // cohérent avec WeightBalanceStore + ScenarioCards). Fallback AVGAS 100LL.
  const fuelConsumedLtr = (fuelData?.trip?.ltr || 0) + (fuelData?.roulage?.ltr || 0);
  const fuelDensity = FUEL_DENSITIES[selectedAircraft?.fuelType] || FUEL_DENSITIES['AVGAS 100LL'];
  const landingMassFromConsumption = takeoffMass - (fuelConsumedLtr * fuelDensity);
  const landingMass = flightPlan?.weightBalance?.landingWeight || landingMassFromConsumption;

  // OAT : null → 15 (ISA fallback)
  const takeoffTemp = departureTemp !== null && departureTemp !== undefined ? departureTemp : 15;
  const landingTemp = arrivalTemp !== null && arrivalTemp !== undefined ? arrivalTemp
                     : (departureTemp !== null && departureTemp !== undefined ? departureTemp : 15);

  // Altitude pression
  const takeoffPa = departureAirport?.elevation || 0;
  const landingPa = arrivalAirport?.elevation || takeoffPa || 0;

  // ─── COMPOSANTE VENT SIGNÉE SUR LA PISTE ACTIVE ───
  // On charge les pistes de l'aérodrome et on calcule le vent projeté sur la
  // piste la plus favorable (la "meilleure" face au vent METAR).
  // Convention : positif = vent de face (headwind), négatif = vent arrière (tailwind).
  // C'est CE SIGNE que le filtre `windDirection` du résolveur d'abaque va consommer.
  const departureRunwayWind = useActiveRunwayWind(departureIcao, departureWeather);
  const arrivalRunwayWind = useActiveRunwayWind(arrivalIcao, arrivalWeather);

  // Vitesse brute du vent (fallback si pas de piste sélectionnable)
  const takeoffWindRaw = departureWeather?.metar?.decoded?.wind?.speed || 0;
  const landingWindRaw = arrivalWeather?.metar?.decoded?.wind?.speed
                       ?? arrivalWeather?.decoded?.wind?.speed
                       ?? arrivalWeather?.wind?.speed
                       ?? arrivalWeather?.metar?.wind?.speed
                       ?? departureWeather?.metar?.decoded?.wind?.speed
                       ?? 0;

  // Composante signée si dispo (piste détectée), sinon fallback vitesse brute supposée face
  const takeoffWindComponent = typeof departureRunwayWind.headwindComponent === 'number'
    ? departureRunwayWind.headwindComponent
    : takeoffWindRaw;
  const landingWindComponent = typeof arrivalRunwayWind.headwindComponent === 'number'
    ? arrivalRunwayWind.headwindComponent
    : landingWindRaw;

  // Pour les inputs de la matrice : on injecte la composante SIGNÉE.
  // Le résolveur d'abaque détectera le signe pour filtrer les courbes
  // headwind/tailwind du graphe primaire.
  const takeoffInputsForMatrix = {
    mass: takeoffMass,
    massTakeoff: takeoffMass,
    oat: takeoffTemp,
    pressureAltitude: takeoffPa,
    headwind: takeoffWindComponent,           // signé : >0 face, <0 arrière
    windComponent: takeoffWindComponent,      // signé
    tailwind: -takeoffWindComponent,          // signe inversé (cohérent avec headwind)
    runwaySlope: 0
  };
  const landingInputsForMatrix = {
    mass: landingMass,
    massLanding: landingMass,
    oat: landingTemp,
    pressureAltitude: landingPa,
    headwind: landingWindComponent,
    windComponent: landingWindComponent,
    tailwind: -landingWindComponent,
    runwaySlope: 0
  };
  // Helpers par phase : on les rend séparément pour les regrouper dans chaque section.
  const renderTakeoffMatrix = () => (
    <PerformanceStateMatrix
      aircraft={selectedAircraft}
      inputs={takeoffInputsForMatrix}
      phases={['takeoff']}
      title="Matrice de couverture — Décollage"
      safetyFactor={safetyFactor}
    />
  );
  const renderClimbCruiseMatrix = () => (
    <PerformanceStateMatrix
      aircraft={selectedAircraft}
      inputs={takeoffInputsForMatrix}
      phases={['climb', 'cruise', 'descent']}
      title="Matrice de couverture — Montée & Croisière"
      safetyFactor={safetyFactor}
    />
  );
  const renderLandingMatrix = () => (
    <PerformanceStateMatrix
      aircraft={selectedAircraft}
      inputs={landingInputsForMatrix}
      phases={['landing']}
      title="Matrice de couverture — Atterrissage"
      safetyFactor={safetyFactor}
    />
  );

  // Dropdown de sélection du facteur de sécurité réglementaire.
  // Placé en tête du module : le pilote choisit la marge à appliquer aux
  // distances affichées. N'affecte PAS les calculs amont ni le stockage.
  const renderSafetyFactorSelector = () => (
    <div style={{
      marginBottom: 12,
      padding: 10,
      backgroundColor: 'var(--bg-overlay)',
      border: '1px solid var(--bg-overlay)',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-primary)' }}>
        Marge réglementaire appliquée aux distances :
      </span>
      <select
        value={safetyFactorId}
        onChange={(e) => setSafetyFactorId(e.target.value)}
        style={{
          padding: '4px 8px',
          fontSize: 13,
          fontWeight: 600,
          backgroundColor: 'var(--bg-overlay)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
          cursor: 'pointer'
        }}
      >
        {SAFETY_FACTOR_PRESETS.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontStyle: 'italic' }}>
        {safetyFactor.description}
      </span>
    </div>
  );

  // Note d'avertissement : corrections piste/terrain non encore appliquées par
  // le résolveur. Le pilote doit en tenir compte manuellement le cas échéant.
  const renderRunwayCorrectionsNotice = () => (
    <div style={{
      marginBottom: 12,
      padding: 10,
      backgroundColor: 'var(--bg-overlay)',
      border: '1px solid var(--accent-primary)',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }}>
      <div style={{ fontSize: 12, color: 'var(--accent-primary)', lineHeight: 1.5 }}>
        <strong>Note — Corrections piste/terrain non encore implémentées.</strong>
        {' '}Les distances affichées <strong>ne tiennent pas compte</strong> des facteurs
        multiplicatifs liés à <strong>l'état du sol</strong> (sèche, humide, contaminée,
        enneigée) ni au <strong>type de revêtement</strong> (asphalte, herbe, gravier).
        À ajouter manuellement selon ton MANEX et la réglementation applicable.
      </div>
    </div>
  );

  // Compat : ancien helper pour les early-returns (legacy). Affiche les 3 matrices à la suite.
  const renderCoverageMatrices = () => (
    <>
      {renderSafetyFactorSelector()}
      {renderRunwayCorrectionsNotice()}
      {renderTakeoffMatrix()}
      {renderClimbCruiseMatrix()}
      {renderLandingMatrix()}
    </>
  );

  // Si aucun avion sélectionné, afficher un message
  if (!selectedAircraft) {
    return (
      <div style={sx.spacing.p(6)}>
        <div style={sx.combine(sx.components.card.base, sx.text.left, sx.spacing.p(8))}>
          <AlertCircle size={48} style={{ marginBottom: '16px', color: 'var(--accent-primary)' }} />
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

  // ─── DÉTECTION DES SOURCES DE DONNÉES DE PERFORMANCE ───
  // Un avion peut être configuré par 3 voies équivalentes côté pilote :
  //   - performanceModels[] : ABAQUES (graphiques avec courbes digitalisées)
  //   - advancedPerformance.tables[] : TABLEAUX IA (extractions OpenAI/Claude)
  //   - performanceTables[] : alias legacy de performanceModels
  // À partir du moment où une seule source contient au moins 1 entrée, l'avion
  // est considéré comme exploitable et le rendu COMPLET est affiché (conditions,
  // matrice de couverture, analyse pistes, déroutements) — UNIFIÉ entre abaques
  // et tableaux. Le résolveur `operationResolver` choisit automatiquement la
  // source disponible pour chaque opération (P1).
  const hasAITables = (selectedAircraft.advancedPerformance?.tables?.length || 0) > 0;
  const hasPerformanceModels = (selectedAircraft.performanceModels?.length || 0) > 0;
  const hasPerformanceTablesLegacy = (selectedAircraft.performanceTables?.length || 0) > 0;
  const hasLoadedPerfTables = (loadedPerformanceTables?.length || 0) > 0;
  const hasAnyPerfData = hasAITables || hasPerformanceModels || hasPerformanceTablesLegacy || hasLoadedPerfTables;

  // Si vraiment AUCUNE donnée : afficher message d'aide (avec spinner si chargement en cours)
  if (!hasAnyPerfData) {
    if (loadingTables) {
      return (
        <div style={sx.spacing.p(6)}>
          <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
            <Table size={48} style={{ margin: '0 auto 16px', color: 'var(--text-secondary)' }} />
            <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
              Chargement des données de performance…
            </h3>
            <p style={sx.combine(sx.text.sm, sx.text.secondary)}>
              Chargement pour {selectedAircraft.registration}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={sx.spacing.p(6)}>
        {/* Matrice exhaustive même sans données — utile pour voir les "trous" */}
        {renderCoverageMatrices()}
        <div style={sx.combine(sx.components.card.base, sx.spacing.p(6), sx.text.center)}>
          <Table size={48} style={{ margin: '0 auto 16px', color: 'var(--accent-primary)' }} />
          <h3 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(2))}>
            Aucune donnée de performance trouvée
          </h3>
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(4))}>
            {selectedAircraft.registration} n'a ni abaques ni tableaux configurés.
          </p>
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, { textAlign: 'left' })}>
            <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
              💡 Pour ajouter des performances :
            </p>
            <ol style={{ marginLeft: '20px', fontSize: 'var(--fs-body)', lineHeight: '1.8' }}>
              <li>Allez dans l'onglet <strong>"Gestion Avions"</strong></li>
              <li>Sélectionnez votre avion ({selectedAircraft.registration})</li>
              <li>Cliquez sur <strong>"Modifier"</strong></li>
              <li>Étape <strong>"Performances"</strong> → cliquez "Ajouter des données"</li>
              <li>Choisissez <strong>Tableaux</strong> (extraction IA Claude) ou <strong>Abaques</strong> (construction manuelle)</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDU COMPLET UNIFIÉ ───
  // Au moins une source de données est disponible (abaque OU tableau).
  // Le rendu inclut : sélecteur marge sécu + sections décollage/montée/atterrissage
  // (chacune avec encart Conditions + matrice de couverture + analyse pistes).

  return (
    <div
      style={{
        backgroundColor: wizardMode ? 'transparent' : 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: wizardMode ? 'auto' : '100vh',
        padding: wizardMode
          ? 0
          : `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié */}
      {!wizardMode && (
        <ModuleHero
          image="/assets/photos/hero-performance.jpg"
          eyebrow="PERF · DÉCOLLAGE & ATTERRISSAGE"
          title="Performances"
        />
      )}

      {/* Sélecteur de facteur de sécurité réglementaire + note corrections piste */}
      <div style={{ padding: '0 8px' }}>
        {renderSafetyFactorSelector()}
        {renderRunwayCorrectionsNotice()}
      </div>

      {/* ─── REGROUPEMENT PAR PHASE ───
          Chaque phase de vol affiche :
          - 📋 Le récapitulatif des conditions (aérodrome, OAT, alt. pression, masse, vent)
          - 🧮 La matrice de couverture (résolveur cascade : bracket / slope-follow / IDW) */}

      {/* ════════════════ PHASE DÉCOLLAGE ════════════════ */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '3px solid var(--text-secondary)' }}>
        Phase Décollage
        {departureAirport?.name && <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 8, color: 'var(--text-tertiary)' }}>— {departureAirport.name} ({departureAirport.icao})</span>}
      </h2>

      {/* Récapitulatif conditions décollage */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Conditions de décollage</span>
          {departureAirport?.name && (
            <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-tertiary)' }}>
              — {departureAirport.name}{departureAirport.icao ? ` (${departureAirport.icao})` : ''}
            </span>
          )}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Thermometer size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>TEMPÉRATURE</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {Number(takeoffTemp).toFixed(0)}°C
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6, fontWeight: 400 }}>
                {departureTemp !== null && departureTemp !== undefined ? 'METAR' : 'ISA'}
              </span>
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <MapPin size={14} style={{ marginRight: 6, color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>ALT. PRESSION</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {takeoffPa} ft
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Scale size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>MASSE</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {Number(takeoffMass).toFixed(1)} kg
              {calculations?.isWithinLimits === false && (
                <span style={{ fontSize: 11, color: 'var(--color-red-critical)', marginLeft: 6, fontWeight: 600 }}>Hors limites</span>
              )}
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Wind size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>VENT</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {takeoffWindRaw} kt
              {departureWeather?.metar?.decoded?.wind?.direction !== undefined && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4, fontWeight: 500 }}>
                  / {departureWeather.metar.decoded.wind.direction}°
                </span>
              )}
            </p>
            {departureRunwayWind.bestRunway && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                Piste <strong>{departureRunwayWind.bestRunway.ident}</strong> :{' '}
                <span style={{ color: takeoffWindComponent >= 0 ? 'var(--text-primary)' : 'var(--color-red-critical)', fontWeight: 700 }}>
                  {takeoffWindComponent >= 0 ? '↑ face' : '↓ arrière'} {Math.abs(takeoffWindComponent).toFixed(1)} kt
                </span>
                {departureRunwayWind.crosswindComponent > 0 && (
                  <span style={{ color: 'var(--text-tertiary)' }}> · travers {departureRunwayWind.crosswindComponent.toFixed(1)} kt</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {renderTakeoffMatrix()}

      {/* Analyse des pistes pour le départ */}
      {departureWeather?.metar?.decoded?.wind && departureIcao && (
        <div style={sx.spacing.mb(6)}>
          <RunwaySuggestionEnhanced
            icao={departureIcao}
            wind={departureWeather.metar.decoded.wind}
            aircraft={selectedAircraft}
            showCompact={false}
          />
        </div>
      )}

      {/* ════════════════ PHASE MONTÉE / CROISIÈRE ════════════════ */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: '3px solid var(--accent-primary)' }}>
        Phase Montée &amp; Croisière
      </h2>
      {renderClimbCruiseMatrix()}

      {/* ════════════════ PHASE ATTERRISSAGE ════════════════ */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: '3px solid var(--text-primary)' }}>
        Phase Atterrissage
        {arrivalAirport?.name && <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 8, color: 'var(--text-tertiary)' }}>— {arrivalAirport.name} ({arrivalAirport.icao})</span>}
      </h2>

      {/* Récapitulatif conditions atterrissage */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Conditions d'atterrissage</span>
          {arrivalAirport?.name && (
            <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-tertiary)' }}>
              — {arrivalAirport.name}{arrivalAirport.icao ? ` (${arrivalAirport.icao})` : ''}
            </span>
          )}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Thermometer size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>TEMPÉRATURE</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {Number(landingTemp).toFixed(0)}°C
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6, fontWeight: 400 }}>
                {arrivalTemp !== null && arrivalTemp !== undefined
                  ? 'METAR'
                  : (departureTemp !== null && departureTemp !== undefined ? 'Départ' : 'ISA')}
              </span>
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <MapPin size={14} style={{ marginRight: 6, color: 'var(--text-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>ALT. PRESSION</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {landingPa} ft
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Scale size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>MASSE</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {Number(landingMass).toFixed(1)} kg
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6, fontWeight: 400 }}>
                {flightPlan?.weightBalance?.landingWeight ? 'Step 6' : 'Estimée'}
              </span>
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Wind size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>VENT</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {landingWindRaw} kt
              {arrivalWeather?.metar?.decoded?.wind?.direction !== undefined && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4, fontWeight: 500 }}>
                  / {arrivalWeather.metar.decoded.wind.direction}°
                </span>
              )}
            </p>
            {arrivalRunwayWind.bestRunway && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                Piste <strong>{arrivalRunwayWind.bestRunway.ident}</strong> :{' '}
                <span style={{ color: landingWindComponent >= 0 ? 'var(--text-primary)' : 'var(--color-red-critical)', fontWeight: 700 }}>
                  {landingWindComponent >= 0 ? '↑ face' : '↓ arrière'} {Math.abs(landingWindComponent).toFixed(1)} kt
                </span>
                {arrivalRunwayWind.crosswindComponent > 0 && (
                  <span style={{ color: 'var(--text-tertiary)' }}> · travers {arrivalRunwayWind.crosswindComponent.toFixed(1)} kt</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {renderLandingMatrix()}

      {/* Analyse des pistes pour l'arrivée */}
      {arrivalWeather?.metar?.decoded?.wind && arrivalIcao && (
        <div style={sx.spacing.mb(6)}>
          <RunwaySuggestionEnhanced
            icao={arrivalIcao}
            wind={arrivalWeather.metar.decoded.wind}
            aircraft={selectedAircraft}
            showCompact={false}
          />
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
                  backgroundColor: 'var(--bg-overlay)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {/* En-tête de l'aérodrome */}
                <div style={{
                  marginBottom: '12px'
                }}>
                  <h4 style={{
                    fontSize: 'var(--fs-title)',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    marginBottom: '6px'
                  }}>
                    {alternate.name || alternate.icao} ({alternate.icao})
                  </h4>
                  <div style={{
                    fontSize: 'var(--fs-body)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    gap: '16px'
                  }}>
                    <span>
                      Distance: {alternate.distanceFromRoute?.toFixed(1) || 'N/A'} NM
                    </span>
                    <span>
                      Élévation: {alternate.elevation || 'N/A'} ft
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
                    backgroundColor: 'var(--bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 'var(--fs-body)',
                    color: 'var(--color-red-critical)'
                  }}>
                    Météo non disponible - impossible d'analyser les pistes
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 🔧 DEBUG: Afficher les données brutes pour vérification */}
      <PerformanceDataDebugger tables={loadedPerformanceTables} />
    </div>
  );
};

export default PerformanceModule;
