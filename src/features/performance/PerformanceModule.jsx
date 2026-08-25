import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Wind, Scale, MapPin, Thermometer, Table } from 'lucide-react';
import { sx } from '../../shared/styles/styleSystem';
import PerformanceDataDebugger from './components/PerformanceDataDebugger';
import { PerformanceStateMatrix } from './components/PerformanceStateMatrix';
import { RunwaySuggestionEnhanced } from '../weather/components/RunwaySuggestionEnhanced';
import { useAircraft, useWeightBalance, useNavigation, useWeather, useFuel } from '../../core/contexts';
import { useWeatherStore, mergeManualWeather } from '../../core/stores/weatherStore';
import { useAlternatesStore } from '../../core/stores/alternatesStore';
import { usePerformanceCalculations } from '../../shared/hooks/usePerformanceCalculations';
import { useActiveRunwayWind } from '../../shared/hooks/useActiveRunwayWind';
import { groupTablesByBaseName, filterGroupsByType } from '../../services/performanceTableGrouping';
import { generatePerformanceState, ResultStatus } from '../../services/operationResolver';
import { convertValue } from '../../utils/unitConversions';
import dataBackupManager from '../../utils/dataBackupManager';
import { resolveWindComponent } from '../../utils/windComponent';
import { getWaypointIcao } from '../../shared/utils/getWaypointIcao';
import { SAFETY_FACTOR_PRESETS, DEFAULT_SAFETY_FACTOR } from '../../utils/performanceSafetyFactor';
import { applyPerformanceCorrections, CORRECTION_TYPES } from '../../utils/performanceCorrections';
import { normalizeSurface } from '../../utils/runwaySurface';
// 🎨 Charte éditoriale ALFlight
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

const PerformanceModule = ({ wizardMode = false, config = {} }) => {
  const { selectedAircraft } = useAircraft();
  // ✈️ Détail des facteurs correctifs du manuel appliqués (affichage pilote)
  const [corrBreakdowns, setCorrBreakdowns] = useState({ takeoff: null, landing: null, takeoffSurface: null, landingSurface: null });
  // 🛬 États de piste DÉCLARÉS par le pilote, par phase (clés CORRECTION_TYPES de
  // kind 'manual' : wet_grass, high_grass, soft_ground, wet_paved…). Défaut : rien
  // de coché — conservateur, c'est le pilote qui déclare ; jamais hérité d'un vol
  // précédent (état local du module, remis à zéro à chaque ouverture).
  const [runwayStates, setRunwayStates] = useState({ takeoff: [], landing: [] });
  const { calculations } = useWeightBalance();
  const { waypoints } = useNavigation();
  const { getWeatherByIcao } = useWeather();
  const { fuelData, fobFuel } = useFuel();
  const weatherData = useWeatherStore(state => state.weatherData || {});
  const fetchWeather = useWeatherStore(state => state.fetchWeather);
  // 🔧 LOT 6-C — saisies météo manuelles (abonnement nécessaire au re-render)
  const manualOverrides = useWeatherStore(state => state.manualOverrides || {});
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

      // 🔧 FIX boucle infinie : on lit le store météo EN DIRECT (getState) au
      // lieu de passer par `weatherData` dans les deps de l'effet. Sinon
      // fetchWeather met à jour weatherData → l'effet se redéclenche → boucle
      // sans fin (d'autant plus que le METAR revient `undefined`, donc le
      // garde-fou `!metar` reste toujours vrai).
      const currentWeather = useWeatherStore.getState().weatherData || {};

      // Vérifier si météo départ existe et est valide
      if (departureIcao) {
        const depWeather = currentWeather[departureIcao];

        // Charger si pas de METAR ou météo trop ancienne (> 30 min)
        if (!depWeather?.metar || (Date.now() - (depWeather.timestamp || 0) > 30 * 60 * 1000)) {
          icaosToLoad.push(departureIcao);
          console.log('🌤️ [PerformanceModule] Chargement météo départ:', departureIcao);
        }
      }

      // Vérifier si météo arrivée existe et est valide
      if (arrivalIcao && arrivalIcao !== departureIcao) {
        const arrWeather = currentWeather[arrivalIcao];

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
            const altWeather = currentWeather[altIcao];

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
    // ⚠️ `weatherData` VOLONTAIREMENT absent des deps : l'effet le PRODUIT
    // (via fetchWeather) ; l'inclure créait une boucle de rendu infinie.
    // La fraîcheur est vérifiée en direct via useWeatherStore.getState().
  }, [departureIcao, arrivalIcao, selectedAlternates, fetchWeather]);

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
  // 🔧 LOT 6-C — météo EFFECTIVE : saisie manuelle > API (forme METAR decoded
  // identique, tout l'aval — temp, vent, fiabilité, pistes — suit sans changement).
  // useMemo OBLIGATOIRE : mergeManualWeather crée un objet neuf à chaque appel,
  // sans memo les useMemo/memo() aval (temp, useActiveRunwayWind, suggestions
  // de piste) recalculeraient à chaque render du module.
  const departureWeather = useMemo(() => departureIcao && (
    mergeManualWeather(weatherData[departureIcao], manualOverrides[departureIcao]) ||
    flightPlan?.weather?.departure
  ), [departureIcao, weatherData, manualOverrides, flightPlan]);
  const arrivalWeather = useMemo(() => arrivalIcao && (
    mergeManualWeather(weatherData[arrivalIcao], manualOverrides[arrivalIcao]) ||
    flightPlan?.weather?.arrival
  ), [arrivalIcao, weatherData, manualOverrides, flightPlan]);

  // 🚨 SÉCURITÉ CRITIQUE : Température depuis METAR uniquement
  // NE JAMAIS utiliser ISA comme fallback → DANGER performances incorrectes
  const departureTemp = useMemo(() => {
    if (!departureAirport) return null;

    // 🔧 FIX: Essayer de restaurer depuis flightPlan d'abord (pour rechargement page)
    const savedTemp = flightPlan?.performance?.departure?.temperature;

    // 🔧 FIX: Chemin correct vers température METAR = metar.decoded.temperature
    // 🔧 LOT 6-C REVUE : ?? au lieu de || — 0 °C est une température VALIDE
    // (saisie manuelle hivernale), || la jetait au profit d'une valeur périmée
    const metarTemp = departureWeather?.metar?.decoded?.temperature ??
      departureWeather?.decoded?.temperature ??
      departureWeather?.temp ??
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
    // 🔧 LOT 6-C REVUE : ?? au lieu de || — 0 °C est une température VALIDE
    const metarTemp = arrivalWeather?.metar?.decoded?.temperature ??
      arrivalWeather?.decoded?.temperature ??
      arrivalWeather?.temp ??
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

    // 🔧 25/08/2026 (Lot 1.0) — plus de « 1310 kg typique DA40 NG » : une
    // MTOW introuvable rend null, et l'aval refuse au lieu de calculer une
    // performance sur la masse d'un AUTRE avion.
    return null;
  }, [selectedAircraft, takeoffGroups]);

  // 🔧 FIX: Sauvegarder les températures dans flightPlan pour persistance
  // 🔧 LOT 6-C REVUE : == null (pas de !temp) — 0 °C doit être persisté
  useEffect(() => {
    if (!flightPlan || (departureTemp == null && arrivalTemp == null)) return;

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
    // 🔧 A9 — Facteur de sécurité PERSISTÉ : on enregistre la marge choisie ET les
    // distances majorées (brut conservé), pour que synthèse/PDF reflètent le chiffre
    // opérationnel, pas seulement l'écran. La marge est appliquée UNE seule fois ici.
    const sf = safetyFactor?.value > 1 ? safetyFactor.value : 1;
    const fx = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * sf) : null);
    flightPlan.performance.safetyFactor = { id: safetyFactor.id, value: safetyFactor.value, label: safetyFactor.label };
    flightPlan.performance.departure = {
      ...flightPlan.performance.departure,
      icao: departureIcao,
      name: departureAirport.name,
      takeoff: {
        groundRoll: result.groundRoll,
        groundRollFactored: fx(result.groundRoll),
        toda50ft: result.distance50ft,
        toda50ftFactored: fx(result.distance50ft),
        toda15m: result.distance50ft, // Utiliser la même valeur pour 15m/50ft
        toda15mFactored: fx(result.distance50ft),
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
    // 🔧 A9 — Facteur de sécurité PERSISTÉ (cf. décollage) : marge + distances majorées.
    const sf = safetyFactor?.value > 1 ? safetyFactor.value : 1;
    const fx = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * sf) : null);
    flightPlan.performance.safetyFactor = { id: safetyFactor.id, value: safetyFactor.value, label: safetyFactor.label };
    flightPlan.performance.arrival = {
      ...flightPlan.performance.arrival,
      icao: arrivalIcao,
      name: arrivalAirport.name,
      landing: {
        groundRoll: result.groundRoll,
        groundRollFactored: fx(result.groundRoll),
        lda50ft: result.distance50ft,
        lda50ftFactored: fx(result.distance50ft),
        lda15m: result.distance50ft, // Utiliser la même valeur pour 15m/50ft
        lda15mFactored: fx(result.distance50ft),
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
  // 🔧 25/08/2026 (Lot 1.0) — le « || 1000 » est SUPPRIMÉ. Son commentaire
  // (« outil de diagnostic, pas le bilan signé ») était périmé : depuis
  // l'effet de persistance, ces distances sont ÉCRITES dans
  // flightPlan.performance et reprises par la synthèse et le PDF. Et il
  // garantissait un nombre au résolveur, dont la garde missingRequiredInputs
  // (« performance non calculée — aucune valeur inventée ») ne pouvait donc
  // JAMAIS se déclencher sur la masse. Sans masse → null → refus propre.
  const takeoffMass = calculations?.totalWeight || selectedAircraft?.emptyWeight || null;

  // Mass atterrissage : SOURCE UNIQUE = module de centrage (scenarios.landing,
  // écrit dans flightPlan.weightBalance.landingWeight par Step6WeightBalance).
  // Plus de recalcul parallèle ici (anomalie A4). Fallback conservateur = masse
  // décollage si le centrage n'a pas encore produit la masse atterrissage.
  const landingMass = flightPlan?.weightBalance?.landingWeight || takeoffMass;

  // 🔧 A5 — Fiabilité météo : une météo SIMULÉE (isMock) ou absente ne doit pas
  // alimenter la perf comme réelle. On NE fabrique plus d'ISA 15° à ce niveau :
  // température réelle, ou null si indisponible (le résolveur traite null en aval).
  const depWxReliable = !!departureWeather?.metar?.decoded;
  const arrWxReliable = !!arrivalWeather?.metar?.decoded;
  const depTempOk = depWxReliable && departureTemp !== null && departureTemp !== undefined;
  const arrTempOk = arrWxReliable && arrivalTemp !== null && arrivalTemp !== undefined;
  const takeoffTemp = depTempOk ? departureTemp : null;
  const landingTemp = arrTempOk ? arrivalTemp : (depTempOk ? departureTemp : null);

  // 🔧 A5 — Altitude pression : élévation terrain réelle, ou null si absente
  // (plus de « niveau mer » fabriqué). 0 reste une élévation valide (bord de mer).
  const takeoffPa = Number.isFinite(departureAirport?.elevation) ? departureAirport.elevation : null;
  const landingPa = Number.isFinite(arrivalAirport?.elevation) ? arrivalAirport.elevation : takeoffPa;

  // 🌡️ ÉCART À L'ISA (2026-08-23) — écart de l'OAT du jour à l'atmosphère
  // standard, PAR PHASE, à partir des MÊMES sources que les conditions envoyées
  // au résolveur (température METAR fiable + altitude-pression du terrain).
  // Positif = plus chaud que la standard, donc distances plus longues.
  // Il pilote la règle « Température au-dessus de la standard » de la fiche avion
  // pour les manuels qui ne publient leurs distances qu'aux conditions standard.
  // null si l'une des deux données manque : le moteur émettra « écart ISA
  // indisponible » plutôt que de corriger sur une valeur inventée.
  const ecartISA = (temp, pa) =>
    (Number.isFinite(temp) && Number.isFinite(pa)) ? temp - calculateISATemperature(pa) : null;
  const takeoffIsaDeviation = ecartISA(takeoffTemp, takeoffPa);
  const landingIsaDeviation = ecartISA(landingTemp, landingPa);

  // ─── COMPOSANTE VENT SIGNÉE SUR LA PISTE ACTIVE ───
  // On charge les pistes de l'aérodrome et on calcule le vent projeté sur la
  // piste la plus favorable (la "meilleure" face au vent METAR).
  // Convention : positif = vent de face (headwind), négatif = vent arrière (tailwind).
  // C'est CE SIGNE que le filtre `windDirection` du résolveur d'abaque va consommer.
  const departureRunwayWind = useActiveRunwayWind(departureIcao, departureWeather);
  const arrivalRunwayWind = useActiveRunwayWind(arrivalIcao, arrivalWeather);

  // 🔧 A5 — Composante vent signée sur la piste active. Direction INDÉTERMINÉE
  // (Variable/Calme, pas de piste) ⇒ 0 conservateur, JAMAIS un vent de face
  // supposé (qui sous-estimerait les distances). Voir utils/windComponent.
  const takeoffWindComponent = resolveWindComponent(departureRunwayWind.headwindComponent).component;
  const landingWindComponent = resolveWindComponent(arrivalRunwayWind.headwindComponent).component;
  // Vitesse brute du vent — AFFICHAGE seulement (jamais utilisée pour la perf).
  const takeoffWindSpeed = departureWeather?.metar?.decoded?.wind?.speed ?? 0;
  const landingWindSpeed = arrivalWeather?.metar?.decoded?.wind?.speed ?? 0;
  // Vent VARIABLE (METAR VRBxxKT) : direction indéterminée mais magnitude connue
  // (≠ calme, où la vitesse = 0). Décision pilote 2026-06-22 : pour ces cas la
  // perf renvoie la MOYENNE des distances vent de face et vent arrière à la
  // magnitude (cf. resolveOperation windVariable). Détecté ici, transmis à la
  // matrice via windVariable + windMagnitude.
  const takeoffWindVariable = departureWeather?.metar?.decoded?.wind?.direction === 'Variable' && takeoffWindSpeed > 0;
  const landingWindVariable = arrivalWeather?.metar?.decoded?.wind?.direction === 'Variable' && landingWindSpeed > 0;

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
    windVariable: takeoffWindVariable,        // vent variable ⇒ moyenne face/arrière
    windMagnitude: takeoffWindVariable ? takeoffWindSpeed : undefined,
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
    windVariable: landingWindVariable,
    windMagnitude: landingWindVariable ? landingWindSpeed : undefined,
    runwaySlope: 0
  };
  // ── SAUVEGARDE DES DISTANCES POUR LA SYNTHÈSE (Step7Summary / FlightRecapTable) ──
  // Depuis le remplacement de PerformanceTableCalculator par PerformanceStateMatrix
  // (affichage pur, commit db84a9b6), plus personne n'appelait handleTakeoffResults /
  // handleLandingResults : flightPlan.performance.departure.takeoff et arrival.landing
  // restaient vides et la synthèse n'affichait aucune distance de perf. Cet effet
  // recalcule via le MÊME résolveur que la matrice et persiste les distances retenues
  // (préférence aux variantes volets explicites ; valeurs en mètres — unité de la synthèse).
  useEffect(() => {
    if (!wizardMode || !flightPlan || !selectedAircraft) return;

    // Le résolveur lit aircraft.performanceModels ; si les abaques ont été chargés
    // depuis IndexedDB (état local), on les greffe sur une copie de l'avion.
    const hasModels = (selectedAircraft.performanceModels?.length || selectedAircraft.performanceTables?.length);
    const aircraftForResolver = !hasModels && loadedPerformanceTables?.length
      ? { ...selectedAircraft, performanceModels: loadedPerformanceTables }
      : selectedAircraft;

    // Premier résultat COMPUTED (valeur finie > 0) de la liste d'opérations. On
    // garde l'OBJET résultat : outre la valeur et l'unité, il porte `windIncluded`
    // (vent déjà lu par la chaîne d'abaques — posé par operationResolver).
    const pickResult = (state, opIds) => {
      for (const opId of opIds) {
        const r = state.results?.[opId];
        if (r?.status === ResultStatus.COMPUTED && Number.isFinite(r.value) && r.value > 0) return r;
      }
      return null;
    };
    // Distance du résultat retenu, convertie en mètres (null sans résultat).
    const toMeters = (r) => {
      if (!r) return null;
      const unit = String(r.unit || 'm').toLowerCase();
      if (unit === 'm') return r.value;
      if (unit === 'ft') {
        const conv = convertValue(r.value, 'ft', 'm', 'runway');
        if (Number.isFinite(conv)) return conv;
      }
      // 🔧 25/08/2026 (Lot 1.0) — unité inconnue : REFUS (null). L'ancien
      // repli « valeur native » pouvait afficher des pieds comme des mètres
      // (facteur 3,28 sur une distance d'atterrissage — cas F-HFGI).
      return null;
    };

    const takeoffState = generatePerformanceState(aircraftForResolver, takeoffInputsForMatrix);
    const landingState = generatePerformanceState(aircraftForResolver, landingInputsForMatrix);

    const takeoffRollRes = pickResult(takeoffState, ['takeoff_ground_roll_flaps_to', 'takeoff_ground_roll_flaps_up', 'takeoff_ground_roll']);
    const takeoff50Res = pickResult(takeoffState, ['takeoff_50ft_flaps_to', 'takeoff_50ft_flaps_up', 'takeoff_50ft']);
    const landingRollRes = pickResult(landingState, ['landing_ground_roll_flaps_landing', 'landing_ground_roll_flaps_up']);
    const landing50Res = pickResult(landingState, ['landing_50ft_flaps_landing', 'landing_50ft_flaps_up']);
    const takeoffRollBase = toMeters(takeoffRollRes);
    const takeoff50Base = toMeters(takeoff50Res);
    const landingRollBase = toMeters(landingRollRes);
    const landing50Base = toMeters(landing50Res);

    // ✈️ FACTEURS CORRECTIFS DU MANUEL (16/08, validé César) : appliqués aux
    // distances calculées AVANT persistance — la marge réglementaire s'applique
    // ensuite dans le pipeline existant. Le détail (critère → calcul → résultat)
    // est affiché dans le module pour que le pilote puisse vérifier chaque
    // facteur contre son manuel de vol.
    const manualCorrections = selectedAircraft?.performanceCorrections || [];
    const famToKind = (fam) => (fam === 'GRASS' ? 'grass' : fam === 'PAVED' ? 'paved' : null);
    const takeoffSurface = famToKind(normalizeSurface(departureRunwayWind.bestRunway?.surface));
    const landingSurface = famToKind(normalizeSurface(arrivalRunwayWind.bestRunway?.surface));
    // `runwayStates` est TOUJOURS fourni (tableau, éventuellement vide) : une règle
    // d'état non déclarée est alors sans objet — le moteur ne la « rappelle » que
    // lorsque l'appelant n'est pas câblé (runwayStates absent).
    // 🛡️ VENT DÉJÀ INTÉGRÉ PAR L'ABAQUE (21/08, ré-audit F-HFGI) : si la distance
    // retenue sort d'une chaîne à panneau vent (`windIncluded` du résolveur), les
    // règles de vent de la fiche avion NE S'APPLIQUENT PAS à cette opération —
    // sinon le vent comptait deux fois (×1,3 en plus des 775 ft lus à −5 kt). Les
    // règles de surface/état restent appliquées ; une distance issue d'un TABLEAU
    // ou d'un abaque sans panneau vent garde ses règles de vent.
    // 🌡️ TEMPÉRATURE (23/08) : `temperatureAppliedBySource` dit si la SOURCE de la
    // distance tient déjà compte de l'OAT (grille à plusieurs températures, abaque
    // à panneau OAT). Faux ⇒ la distance vaut aux conditions standard et c'est la
    // règle d'écart ISA du manuel qui doit la corriger ; sans règle, le moteur
    // lève `unresolvedTemperature` et la distance est ÉCARTÉE (voir plus bas).
    // ⚠️ Le moteur est appelé MÊME sans règle sur la fiche avion : c'est
    // exactement le cas des Cessna 150 « conditions standard seulement », pour
    // lequel l'absence de règle est justement ce qu'il faut signaler.
    const applyCorr = (distance, phase, windComponentKt, surface, res, isaDeviationC) =>
      distance !== null
        ? applyPerformanceCorrections({
            distance, phase, corrections: manualCorrections,
            conditions: {
              windComponentKt, surface, runwayStates: runwayStates[phase] || [],
              windAppliedByAbac: res?.windIncluded === true,
              isaDeviationC,
              temperatureAppliedBySource: res?.temperatureIncluded === true
            }
          })
        : null;
    const corrTakeoffRoll = applyCorr(takeoffRollBase, 'takeoff', takeoffWindComponent, takeoffSurface, takeoffRollRes, takeoffIsaDeviation);
    const corrTakeoff50 = applyCorr(takeoff50Base, 'takeoff', takeoffWindComponent, takeoffSurface, takeoff50Res, takeoffIsaDeviation);
    const corrLandingRoll = applyCorr(landingRollBase, 'landing', landingWindComponent, landingSurface, landingRollRes, landingIsaDeviation);
    const corrLanding50 = applyCorr(landing50Base, 'landing', landingWindComponent, landingSurface, landing50Res, landingIsaDeviation);
    setCorrBreakdowns({
      takeoff: corrTakeoff50 || corrTakeoffRoll,
      landing: corrLanding50 || corrLandingRoll,
      takeoffSurface,
      landingSurface
    });

    // 🛡️ POINT DE SÉCURITÉ (23/08) — DISTANCE STANDARD NON CORRIGÉE.
    // `unresolvedTemperature` : la source ne tient pas compte de la température,
    // il fait plus chaud que la standard, et aucune règle du manuel n'a corrigé.
    // La distance vaut pour l'ISA et pour elle seule — la présenter telle quelle
    // un jour à 35 °C serait afficher une valeur trop courte comme utilisable.
    // On l'ÉCARTE, exactement comme un résultat non-COMPUTED (cf. pickResult) :
    // rien n'est persisté, et la carte des facteurs affiche « — » + le motif.
    const retenue = (corr, base) =>
      corr?.unresolvedTemperature ? null : (corr ? Math.round(corr.corrected) : base);
    const takeoffRoll = retenue(corrTakeoffRoll, takeoffRollBase);
    const takeoff50 = retenue(corrTakeoff50, takeoff50Base);
    const landingRoll = retenue(corrLandingRoll, landingRollBase);
    const landing50 = retenue(corrLanding50, landing50Base);

    // Garde anti-boucle : handleTakeoffResults/handleLandingResults appellent onUpdate
    // (re-render du wizard) — ne re-sauvegarder que si les valeurs utiles ont changé.
    const sfChanged = flightPlan.performance?.safetyFactor?.id !== safetyFactor.id;
    const prevTakeoff = flightPlan.performance?.departure?.takeoff;
    if (takeoff50 !== null && (sfChanged || prevTakeoff?.toda50ft !== takeoff50 || prevTakeoff?.groundRoll !== takeoffRoll)) {
      handleTakeoffResults(
        { groundRoll: takeoffRoll, distance50ft: takeoff50, outOfRange: false },
        { conditions: { temperature: takeoffTemp, pressureAltitude: takeoffPa, weight: takeoffMass, windComponent: takeoffWindComponent } }
      );
    }
    const prevLanding = flightPlan.performance?.arrival?.landing;
    if (landing50 !== null && (sfChanged || prevLanding?.lda50ft !== landing50 || prevLanding?.groundRoll !== landingRoll)) {
      handleLandingResults(
        { groundRoll: landingRoll, distance50ft: landing50, outOfRange: false },
        { conditions: { temperature: landingTemp, pressureAltitude: landingPa, weight: landingMass, windComponent: landingWindComponent } }
      );
    }
    // Deps SCALAIRES uniquement (+ instances stables flightPlan/selectedAircraft/tables) :
    // les objets inputs sont recréés à chaque rendu, les lister relancerait l'effet en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wizardMode, flightPlan, selectedAircraft, loadedPerformanceTables,
    takeoffMass, landingMass, takeoffTemp, landingTemp, takeoffPa, landingPa,
    takeoffWindComponent, landingWindComponent, takeoffWindVariable, landingWindVariable,
    takeoffWindSpeed, landingWindSpeed, safetyFactor.id, runwayStates
  ]);

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
  // Placé en tête du module : le pilote choisit la marge réglementaire. Elle est
  // appliquée aux distances affichées ET persistée dans flightPlan.performance
  // (synthèse/PDF) — A9. N'affecte PAS l'interpolation brute (appliquée une seule fois).
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
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)' }}>
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
      <div style={{ flexBasis: '100%', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.4 }}>
        Cette marge est appliquée aux distances affichées <strong>et enregistrée avec le plan de vol</strong> (synthèse/PDF).
        {' '}⚠ Ces distances n'intègrent <strong>pas</strong> de facteur de dégradation propre à l'avion
        (<em>K-factor</em> : usure moteur/cellule, traînée réelle d'une immatriculation donnée) ; elles supposent un appareil conforme au manuel de vol.
      </div>
    </div>
  );

  // Note d'avertissement : les corrections piste/terrain ne sont appliquées que
  // via les facteurs correctifs de la fiche avion (herbe détectée ; états de
  // piste DÉCLARÉS par le pilote). Sans règle, le pilote en tient compte lui-même.
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
        <strong>Note — Corrections piste/terrain.</strong>
        {' '}Seuls les <strong>facteurs correctifs saisis sur la fiche avion</strong> sont appliqués :
        <strong> herbe</strong> détectée depuis la piste ; <strong>herbe mouillée / haute, terrain meuble,
        piste dure mouillée</strong> uniquement si tu les <strong>déclares</strong> dans la carte
        « Facteurs correctifs du manuel ». Sans règle correspondante, les distances affichées
        <strong> ne tiennent pas compte</strong> de l'état du sol (humide, contaminé, enneigé…) ni du
        revêtement — à ajouter manuellement selon ton manuel de vol et la réglementation applicable.
      </div>
    </div>
  );

  // ✈️ Carte « Facteurs correctifs du manuel » : chaque facteur est détaillé
  // (critère → calcul → résultat) pour que le pilote constate une erreur
  // potentielle en comparant avec son manuel de vol (demande César 16/08).
  const renderCorrectionCard = (phase) => {
    const rules = selectedAircraft?.performanceCorrections || [];
    const bd = corrBreakdowns[phase];
    // Sans aucune règle sur la fiche avion la carte reste masquée — SAUF si la
    // distance a dû être écartée faute de correction de température : c'est
    // précisément là que le pilote doit lire pourquoi il n'a pas de chiffre.
    if (rules.length === 0 && !bd?.unresolvedTemperature) return null;
    const surfaceKind = phase === 'takeoff' ? corrBreakdowns.takeoffSurface : corrBreakdowns.landingSurface;
    const title = phase === 'takeoff' ? 'Décollage' : 'Atterrissage';
    // 🛬 Sélecteur « État de piste » (demande César 21/08) : uniquement les états
    // (kind 'manual') pour lesquels l'avion a une règle sur CETTE phase — cocher un
    // état sans règle ne changerait rien. Défaut : rien de coché, le pilote déclare.
    const declarableStates = [];
    for (const c of rules) {
      if (!c || (c.appliesTo !== 'both' && c.appliesTo !== phase)) continue;
      if (CORRECTION_TYPES[c.type]?.kind !== 'manual') continue;
      if (declarableStates.some((s) => s.type === c.type)) continue;
      declarableStates.push({
        type: c.type,
        label: c.type === 'other' && c.label?.trim() ? c.label.trim() : CORRECTION_TYPES[c.type].label
      });
    }
    const declared = runwayStates[phase] || [];
    const toggleState = (type) => setRunwayStates((prev) => {
      const current = prev[phase] || [];
      const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
      return { ...prev, [phase]: next };
    });
    const declaredLabels = declarableStates.filter((s) => declared.includes(s.type)).map((s) => s.label);
    return (
      <div style={{
        marginBottom: 12, padding: 10,
        backgroundColor: 'var(--bg-overlay)',
        border: '1px solid var(--border-subtle)', borderRadius: 8
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 6 }}>
          ✈️ Facteurs correctifs du manuel — {title}
          {surfaceKind && (
            <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {' '}· piste {surfaceKind === 'grass' ? 'en herbe' : 'revêtue'}
            </span>
          )}
        </div>
        {declarableStates.length > 0 && (
          <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              État de piste à déclarer — un état non coché n'est pas corrigé :
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
              {declarableStates.map((s) => (
                <label key={s.type} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={declared.includes(s.type)}
                    onChange={() => toggleState(s.type)}
                    style={{ accentColor: 'var(--accent-primary)', margin: 0 }}
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              État déclaré : <strong>{declaredLabels.length ? declaredLabels.join(', ') : 'aucun'}</strong>
            </div>
          </div>
        )}
        {!bd ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Distance de base indisponible (matrice non calculée) — facteurs non appliqués.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Distance de base : <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(bd.base)} m</strong>
              {bd.unresolvedTemperature && ' (aux conditions standard)'}
            </div>
            {/* 🛡️ Distance NON utilisable : la valeur du manuel vaut aux conditions
                standard et rien ne l'a corrigée de l'écart ISA du jour. On affiche
                « — » et le motif, jamais un chiffre trop court. */}
            {bd.unresolvedTemperature && (
              <div style={{
                fontSize: 12, lineHeight: 1.5, marginBottom: 6, padding: 8, borderRadius: 6,
                color: 'var(--color-red-error, #b91c1c)',
                border: '1px solid var(--color-red-error, #b91c1c)'
              }}>
                <strong>Distance retenue : —</strong> (non utilisable)
                {' — '}
                {bd.steps.find((s) => s.id === 'isa-non-corrige')?.note
                  || "distance donnée aux conditions standard, non corrigée de l'écart ISA du jour"}.
              </div>
            )}
            {bd.steps.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Aucun facteur applicable aux conditions du jour.
              </div>
            )}
            {/* La note d'écart ISA non corrigé est déjà rendue en clair ci-dessus. */}
            {bd.steps.filter((s) => s.id !== 'isa-non-corrige').map((s, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: s.note ? 'var(--color-orange-warning, #b45309)' : 'var(--text-primary)' }}>
                {s.note
                  ? <>⚠ <strong>{s.label}</strong> — {s.note}</>
                  : <>• <strong>{s.label}</strong> : {s.detail} — {s.before} m → <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{s.after} m</strong></>}
              </div>
            ))}
            {bd.applied && !bd.unresolvedTemperature && (
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
                Total facteurs : ×{(Math.round(bd.totalFactor * 1000) / 1000).toLocaleString('fr-FR')} →{' '}
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(bd.corrected)} m</strong>
                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> (avant marge réglementaire)</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Compat : ancien helper pour les early-returns (legacy). Affiche les 3 matrices à la suite.
  const renderCoverageMatrices = () => (
    <>
      {renderSafetyFactorSelector()}
      {renderRunwayCorrectionsNotice()}
      {renderTakeoffMatrix()}
      {renderCorrectionCard('takeoff')}
      {renderClimbCruiseMatrix()}
      {renderLandingMatrix()}
      {renderCorrectionCard('landing')}
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
              <li>Choisissez <strong>Tableaux</strong> (lecture automatique du manuel par l'IA) ou <strong>Abaques</strong> (construction manuelle)</li>
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
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '3px solid var(--text-secondary)' }}>
        Phase Décollage
        {departureAirport?.name && <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 8, color: 'var(--text-tertiary)' }}>— {departureAirport.name} ({departureAirport.icao})</span>}
      </h2>

      {/* Récapitulatif conditions décollage */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
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
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
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
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
              {takeoffPa} ft
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Scale size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>MASSE</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
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
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
              {takeoffWindSpeed} kt
              {departureWeather?.metar?.decoded?.wind?.direction !== undefined && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4, fontWeight: 500 }}>
                  / {departureWeather.metar.decoded.wind.direction}{typeof departureWeather.metar.decoded.wind.direction === 'number' ? '°' : ''}
                </span>
              )}
            </p>
            {/* Vent variable : la distance affichée est la moyenne face/arrière. */}
            {takeoffWindVariable && (
              <p style={{ fontSize: 11, color: 'var(--accent-primary)', margin: '2px 0 0 0', fontStyle: 'italic' }}>
                (Calcul des distances : moyenne des vents arrière et de face)
              </p>
            )}
            {departureRunwayWind.bestRunway && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                Piste <strong>{departureRunwayWind.bestRunway.ident}</strong> :{' '}
                <span style={{ color: takeoffWindComponent >= 0 ? 'var(--text-primary)' : 'var(--color-red-critical)', fontWeight: 600 }}>
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
      {renderCorrectionCard('takeoff')}

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
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: '3px solid var(--accent-primary)' }}>
        Phase Montée &amp; Croisière
      </h2>
      {renderClimbCruiseMatrix()}

      {/* ════════════════ PHASE ATTERRISSAGE ════════════════ */}
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: '3px solid var(--text-primary)' }}>
        Phase Atterrissage
        {arrivalAirport?.name && <span style={{ fontWeight: 400, fontSize: 14, marginLeft: 8, color: 'var(--text-tertiary)' }}>— {arrivalAirport.name} ({arrivalAirport.icao})</span>}
      </h2>

      {/* Récapitulatif conditions atterrissage */}
      <div style={sx.combine(sx.spacing.mb(4))}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
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
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
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
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
              {landingPa} ft
            </p>
          </div>
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              <Scale size={14} style={{ marginRight: 6, color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.4 }}>MASSE</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
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
            <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
              {landingWindSpeed} kt
              {arrivalWeather?.metar?.decoded?.wind?.direction !== undefined && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4, fontWeight: 500 }}>
                  / {arrivalWeather.metar.decoded.wind.direction}{typeof arrivalWeather.metar.decoded.wind.direction === 'number' ? '°' : ''}
                </span>
              )}
            </p>
            {/* Vent variable : la distance affichée est la moyenne face/arrière. */}
            {landingWindVariable && (
              <p style={{ fontSize: 11, color: 'var(--accent-primary)', margin: '2px 0 0 0', fontStyle: 'italic' }}>
                (Calcul des distances : moyenne des vents arrière et de face)
              </p>
            )}
            {arrivalRunwayWind.bestRunway && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
                Piste <strong>{arrivalRunwayWind.bestRunway.ident}</strong> :{' '}
                <span style={{ color: landingWindComponent >= 0 ? 'var(--text-primary)' : 'var(--color-red-critical)', fontWeight: 600 }}>
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
      {renderCorrectionCard('landing')}

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
            // 🔧 LOT 6-C : météo effective (manuel > API) — cas d'usage
            // typique : petit terrain de déroutement non contrôlé sans METAR
            const altWeather = mergeManualWeather(
              weatherData[alternate.icao?.toUpperCase()],
              manualOverrides[alternate.icao?.toUpperCase()]
            );

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
                    fontWeight: '600',
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

      {/* 🔧 DEBUG (DEV uniquement — tree-shaké du bundle de production, PATTERN-10) */}
      {import.meta.env.DEV && <PerformanceDataDebugger tables={loadedPerformanceTables} />}
    </div>
  );
};

export default PerformanceModule;
