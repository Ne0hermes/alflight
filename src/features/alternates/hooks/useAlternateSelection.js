
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useOpenAIPStore } from '@core/stores/openAIPStore';
import { useNavigation, useAircraft, useFuel, useWeather } from '@core/contexts';
import { useNavigationResults } from './useNavigationResults';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { useFuelStore } from '@core/stores/fuelStore'; // Accès direct au store pour fobFuel
import {
  calculateSearchZone,
  isAirportInSearchZone,
  isAirportInConeZone,
  calculateDistanceFromRoute,
  calculateConeZone
} from '../utils/geometryCalculations';
import { calculateDistance } from '@utils/navigationCalculations';
import { scoreAlternates } from './useAlternateScoring';
import { filterOutHospitalHeliports, isHospitalHeliport } from '../utils/alternateFilters';

// Fonction pour obtenir un minimum d'aérodromes
const getMinimalAirports = () => {
    return [
    {
      icao: 'LFPG',
      name: 'Paris Charles de Gaulle',
      type: 'large_airport',
      lat: 49.0097,
      lon: 2.5479,
      coordinates: { lat: 49.0097, lon: 2.5479 },
      position: { lat: 49.0097, lon: 2.5479 },
      elevation: 392,
      runways: [{ length: 4200, width: 60, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFPO',
      name: 'Paris Orly',
      type: 'large_airport',
      lat: 48.7233,
      lon: 2.3794,
      coordinates: { lat: 48.7233, lon: 2.3794 },
      position: { lat: 48.7233, lon: 2.3794 },
      elevation: 291,
      runways: [{ length: 3650, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFBO',
      name: 'Toulouse Blagnac',
      type: 'large_airport',
      lat: 43.6294,
      lon: 1.3639,
      coordinates: { lat: 43.6294, lon: 1.3639 },
      position: { lat: 43.6294, lon: 1.3639 },
      elevation: 499,
      runways: [{ length: 3500, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFML',
      name: 'Marseille Provence',
      type: 'large_airport',
      lat: 43.4367,
      lon: 5.2144,
      coordinates: { lat: 43.4367, lon: 5.2144 },
      position: { lat: 43.4367, lon: 5.2144 },
      elevation: 69,
      runways: [{ length: 3500, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFLL',
      name: 'Lyon Saint-Exupéry',
      type: 'large_airport',
      lat: 45.7256,
      lon: 5.0811,
      coordinates: { lat: 45.7256, lon: 5.0811 },
      position: { lat: 45.7256, lon: 5.0811 },
      elevation: 821,
      runways: [{ length: 4000, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFBD',
      name: 'Bordeaux Mérignac',
      type: 'large_airport',
      lat: 44.8283,
      lon: -0.7156,
      coordinates: { lat: 44.8283, lon: -0.7156 },
      position: { lat: 44.8283, lon: -0.7156 },
      elevation: 162,
      runways: [{ length: 3100, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFMN',
      name: 'Nice Côte d\'Azur',
      type: 'large_airport',
      lat: 43.6584,
      lon: 7.2159,
      coordinates: { lat: 43.6584, lon: 7.2159 },
      position: { lat: 43.6584, lon: 7.2159 },
      elevation: 13,
      runways: [{ length: 2960, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFLS',
      name: 'Grenoble Alpes Isère',
      type: 'medium_airport',
      lat: 45.3629,
      lon: 5.3294,
      coordinates: { lat: 45.3629, lon: 5.3294 },
      position: { lat: 45.3629, lon: 5.3294 },
      elevation: 1329,
      runways: [{ length: 3050, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFST',
      name: 'Strasbourg Entzheim',
      type: 'medium_airport',
      lat: 48.5383,
      lon: 7.6283,
      coordinates: { lat: 48.5383, lon: 7.6283 },
      position: { lat: 48.5383, lon: 7.6283 },
      elevation: 505,
      runways: [{ length: 2400, width: 45, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    },
    {
      icao: 'LFSB',
      name: 'Bâle Mulhouse',
      type: 'large_airport',
      lat: 47.5896,
      lon: 7.5299,
      coordinates: { lat: 47.5896, lon: 7.5299 },
      position: { lat: 47.5896, lon: 7.5299 },
      elevation: 885,
      runways: [{ length: 3900, width: 60, surface: 'asphalt' }],
      fuel: true,
      services: { fuel: true, atc: true, lighting: true },
      frequencies: [{ type: 'TWR' }]
    }
  ];
};

/**
 * Hook principal pour la sélection automatique avancée des aérodromes de déroutement
 * Utilise la logique géométrique complète avec zone pilule et scoring multi-critères
 */
export const useAlternateSelection = () => {
  const { waypoints, flightType } = useNavigation();
  const { selectedAircraft } = useAircraft();
  const { fuelData, fobFuel: fobFuelContext, calculateTotal } = useFuel();
  const navigationResults = useNavigationResults();
  const weatherStore = useWeatherStore();
  const vacStore = useVACStore();

  // 🔧 FIX: Accéder DIRECTEMENT au store Zustand pour avoir la valeur la plus récente
  // Le contexte React peut avoir un délai de mise à jour
  const fobFuelStore = useFuelStore(state => state.fobFuel);

  // Utiliser la valeur du store en priorité, sinon celle du contexte
  // Vérifier AUSSI gal car l'utilisateur peut avoir configuré ses unités en gallons
  const hasFobInStore = (fobFuelStore?.ltr > 0) || (fobFuelStore?.gal > 0);
  const fobFuel = hasFobInStore ? fobFuelStore : fobFuelContext;

  // 🔧 DEBUG: Log des valeurs FOB pour diagnostic
  useEffect(() => {
    console.log('🔍 [useAlternateSelection] FOB Debug:', {
      fobFuelStore,
      fobFuelContext,
      hasFobInStore,
      fobFuelUsed: fobFuel,
      ltr: fobFuel?.ltr,
      gal: fobFuel?.gal
    });
  }, [fobFuelStore, fobFuelContext, fobFuel, hasFobInStore]);

  // DEBUG: Log de l'avion sélectionné
  useEffect(() => {
    console.log('🛩️ [useAlternateSelection] selectedAircraft:', {
      aircraft: selectedAircraft,
      registration: selectedAircraft?.registration,
      model: selectedAircraft?.model,
      id: selectedAircraft?.id
    });
  }, [selectedAircraft]);

  // État pour les aérodromes
  const [airports, setAirports] = useState([]);
  const [isLoadingAirports, setIsLoadingAirports] = useState(true);
  const [hasSearchedOnce, setHasSearchedOnce] = useState(false);
  
  const { 
    searchConfig,
    setCandidates,
    setScoredAlternates,
    setSearchZone,
    selectedAlternates
  } = useAlternatesStore();
  
  // Charger les aérodromes au montage
  useEffect(() => {
    const loadAirports = async () => {
      setIsLoadingAirports(true);
      console.log('🔍 [Alternates] Début du chargement des aérodromes...');

      try {
        // Accéder directement au store OpenAIP
        const openAIPStore = useOpenAIPStore.getState();
        let loadedAirports = [];

        console.log('🔍 [Alternates] Store OpenAIP airports count:', openAIPStore.airports?.length || 0);

        // Essayer d'obtenir les aérodromes depuis le store
        if (openAIPStore.airports && Array.isArray(openAIPStore.airports) && openAIPStore.airports.length > 0) {
          // Filtrer les aérodromes français
          loadedAirports = openAIPStore.airports.filter(apt =>
            apt.icao && apt.icao.startsWith('LF')
          );
          console.log('✅ [Alternates] Aérodromes français depuis OpenAIP store:', loadedAirports.length);
        }

        // Si le store est vide, essayer de charger via loadAirports
        if (!loadedAirports || loadedAirports.length === 0) {
          console.log('⚠️ [Alternates] Store vide, tentative de chargement via loadAirports...');

          // Forcer le chargement des aérodromes via le store
          try {
            await openAIPStore.loadAirports('FR');
            const reloadedStore = useOpenAIPStore.getState();
            if (reloadedStore.airports && reloadedStore.airports.length > 0) {
              loadedAirports = reloadedStore.airports.filter(apt =>
                apt.icao && apt.icao.startsWith('LF')
              );
              console.log('✅ [Alternates] Aérodromes chargés via loadAirports:', loadedAirports.length);
            }
          } catch (storeError) {
            console.warn('⚠️ [Alternates] Échec loadAirports du store:', storeError);
          }
        }

        // Si toujours vide, essayer aeroDataProvider
        if (!loadedAirports || loadedAirports.length === 0) {
          console.log('⚠️ [Alternates] Tentative via aeroDataProvider...');
          try {
            const { aeroDataProvider } = await import('@core/data');
            const staticAirports = await aeroDataProvider.getAirfields({ country: 'FR' });
            console.log('✅ [Alternates] aeroDataProvider retourne:', staticAirports?.length || 0, 'aérodromes');

            // Formater pour correspondre à la structure attendue
            loadedAirports = staticAirports.map(apt => ({
              ...apt,
              icao: apt.icao,
              name: apt.name,
              type: apt.type === 'AIRPORT' ? 'large_airport' :
                    apt.type === 'AIRFIELD' ? 'small_airport' : 'medium_airport',
              lat: apt.coordinates?.lat || apt.lat,
              lon: apt.coordinates?.lon || apt.lon || apt.lng,
              coordinates: apt.coordinates || { lat: apt.lat, lon: apt.lon || apt.lng },
              position: apt.coordinates || { lat: apt.lat, lon: apt.lon || apt.lng },
              elevation: apt.elevation,
              runways: apt.runways || [
                {
                  length: getDefaultRunwayLength(apt.icao, apt.type),
                  width: apt.type === 'AIRPORT' ? 45 : 20,
                  surface: apt.type === 'AIRPORT' ? 'asphalt' : 'grass'
                }
              ],
              fuel: apt.fuel || apt.type === 'AIRPORT',
              services: apt.services || {
                fuel: apt.type === 'AIRPORT',
                atc: apt.type === 'AIRPORT',
                lighting: apt.type === 'AIRPORT'
              },
              frequencies: apt.frequencies || []
            }));
          } catch (error) {
            console.error('❌ [Alternates] Erreur aeroDataProvider:', error);
          }
        }

        // Dernier recours : aérodromes minimaux
        if (!loadedAirports || loadedAirports.length === 0) {
          console.warn('⚠️ [Alternates] Aucune source disponible, utilisation des aérodromes minimaux');
          loadedAirports = getMinimalAirports();
        } else {
          // Formater les aérodromes du store pour s'assurer qu'ils ont la bonne structure
          loadedAirports = loadedAirports.map(apt => ({
            ...apt,
            coordinates: apt.coordinates || { lat: apt.lat, lon: apt.lon || apt.lng },
            position: apt.coordinates || { lat: apt.lat, lon: apt.lon || apt.lng },
            runways: apt.runways || [{
              length: getDefaultRunwayLength(apt.icao, apt.type),
              width: 45,
              surface: 'asphalt'
            }],
            services: apt.services || {
              fuel: apt.fuel || false,
              atc: apt.type !== 'small_airport',
              lighting: apt.type !== 'small_airport'
            }
          }));
        }

        // Filtrer les héliports d'hôpitaux et centres médicaux
        const filteredAirports = filterOutHospitalHeliports(loadedAirports);
        console.log('✅ [Alternates] TOTAL aérodromes chargés:', loadedAirports.length, '-> après filtrage héliports:', filteredAirports.length);
        setAirports(filteredAirports);

      } catch (error) {
        console.error('❌ [Alternates] Erreur critique chargement aérodromes:', error);
        setAirports(getMinimalAirports());
      } finally {
        setIsLoadingAirports(false);
      }
    };

    loadAirports();
  }, []);
  
  // DEBUG: Afficher l'état des aérodromes
  useEffect(() => {
    console.log('📊 [DEBUG] État aérodromes:', {
      airportsCount: airports.length,
      isLoadingAirports,
      sampleAirports: airports.slice(0, 3).map(a => a.icao)
    });
  }, [airports, isLoadingAirports]);
  
  // Validation des données
  const isReady = useMemo(() => {
    const ready = (
      waypoints.length >= 2 &&
      waypoints[0].lat && waypoints[0].lon &&
      waypoints[waypoints.length - 1].lat && waypoints[waypoints.length - 1].lon &&
      selectedAircraft &&
      // navigationResults est maintenant optionnel - permet de sélectionner les alternates avant le calcul complet
      airports.length > 0 &&
      !isLoadingAirports
    );
    if (!ready) {
      console.log('🚨 Alternates not ready:', {
        waypointsCount: waypoints.length,
        departure: waypoints[0] ? `${waypoints[0].name || 'Sans nom'} (${waypoints[0].lat ? 'OK' : 'Pas de coordonnées'})` : 'Manquant',
        arrival: waypoints[waypoints.length - 1] ? `${waypoints[waypoints.length - 1].name || 'Sans nom'} (${waypoints[waypoints.length - 1].lat ? 'OK' : 'Pas de coordonnées'})` : 'Manquant',
        aircraft: selectedAircraft ? `${selectedAircraft.registration} (${selectedAircraft.model})` : '❌ AUCUN',
        aircraftId: selectedAircraft?.id || 'N/A',
        aircraftObject: selectedAircraft ? 'EXISTS' : 'NULL/UNDEFINED',
        navigationResults: !!navigationResults,
        airportsLoaded: airports.length,
        loadingAirports: isLoadingAirports
      });

      // Log additionnel pour debugger le problème
      console.log('🔍 DEBUG selectedAircraft:', {
        value: selectedAircraft,
        type: typeof selectedAircraft,
        isNull: selectedAircraft === null,
        isUndefined: selectedAircraft === undefined
      });
    } else {
      console.log('✅ Alternates ready!', {
        aircraft: `${selectedAircraft.registration} (${selectedAircraft.model})`,
        waypointsCount: waypoints.length,
        airportsCount: airports.length
      });
    }

    return ready;
  }, [waypoints, selectedAircraft, navigationResults, airports, isLoadingAirports]);
  
  // Calcul des données carburant pour le rayon dynamique
  // IMPORTANT: À l'étape 3, le carburant n'est pas encore saisi (étape 4)
  // On utilise donc les données de l'avion (capacité, consommation, vitesse)
  // pour calculer un rayon basé sur l'autonomie MAXIMALE

  const fuelDataForRadius = useMemo(() => {
    // Minimum requis : l'avion doit être sélectionné
    if (!selectedAircraft) return null;

    // 🔧 DIAGNOSTIC: Afficher TOUTES les données brutes de l'avion
    console.log('🔍 [fuelDataForRadius] DONNÉES BRUTES selectedAircraft:', {
      registration: selectedAircraft.registration,
      fuelCapacity: selectedAircraft.fuelCapacity,
      fuelConsumption: selectedAircraft.fuelConsumption,
      cruiseSpeedKt: selectedAircraft.cruiseSpeedKt,
      cruiseSpeed: selectedAircraft.cruiseSpeed,
      fuel: selectedAircraft.fuel,
      _metadata: selectedAircraft._metadata,
      units: selectedAircraft._metadata?.units
    });

    // Récupérer les valeurs brutes
    let fuelCapacity = selectedAircraft.fuelCapacity || selectedAircraft.fuel?.capacity || 0;
    let fuelConsumption = selectedAircraft.fuelConsumption || selectedAircraft.fuel?.consumption || 0;
    const cruiseSpeed = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 120;

    // 🔧 DÉTECTION AUTOMATIQUE: Si les valeurs semblent être en gallons (< 50), convertir
    // Logique:
    // - Une capacité < 50 est probablement en gallons (un avion typique a 100-400 L)
    // - Une consommation < 15 est probablement en gal/h (typiquement 20-60 L/h)
    const probablyInGallons = (fuelCapacity > 0 && fuelCapacity < 60) ||
                              (fuelConsumption > 0 && fuelConsumption < 20);

    console.log('🔍 [fuelDataForRadius] ANALYSE UNITÉS:', {
      fuelCapacityBrut: fuelCapacity,
      fuelConsumptionBrut: fuelConsumption,
      probablyInGallons,
      seuilCapacite: '< 60 = probablement gallons',
      seuilConso: '< 20 = probablement gal/h'
    });

    // Si les données semblent être en gallons, convertir en litres
    if (probablyInGallons) {
      console.log('⚠️ [fuelDataForRadius] CONVERSION GAL → L détectée nécessaire');
      fuelCapacity = fuelCapacity * 3.78541;
      fuelConsumption = fuelConsumption * 3.78541;
    }

    // Construire les données pour le calcul du rayon (toujours en litres)
    const aircraftData = {
      fuelCapacity: fuelCapacity,
      fuelConsumption: fuelConsumption,
      cruiseSpeedKt: cruiseSpeed
    };

    console.log('✅ [fuelDataForRadius] Données FINALES (en litres):', {
      fuelCapacity: aircraftData.fuelCapacity.toFixed(1) + ' L',
      fuelConsumption: aircraftData.fuelConsumption.toFixed(1) + ' L/h',
      cruiseSpeedKt: aircraftData.cruiseSpeedKt + ' kt',
      wasConverted: probablyInGallons
    });

    // Si le carburant est saisi (étape 4+), on peut être plus précis
    if (fobFuel && navigationResults) {
      const fobLiters = fobFuel?.ltr || 0;
      const fuelRequired = navigationResults?.fuelRequired || 0;
      const fuelRemaining = fobLiters - fuelRequired;

      return {
        aircraft: aircraftData,
        fuelRemaining,
        reserves: {
          final: navigationResults?.regulationReserveLiters || 0,
          alternate: fuelData?.alternate?.ltr || 0
        }
      };
    }

    // Sinon, on retourne juste les données avion pour le calcul d'autonomie max
    return {
      aircraft: aircraftData,
      fuelRemaining: null, // Pas de carburant saisi encore
      reserves: null
    };
  }, [selectedAircraft, fobFuel, navigationResults, fuelData]);

  // ========================================================================================
  // NOUVEAU: Calcul des rayons pour zone CÔNE basée sur FOB (Fuel On Board)
  // Le cône est plus large au départ (plus de carburant) et plus étroit à l'arrivée
  // FORMULE UTILISATEUR: Rayon = FOB / Consommation × Vitesse × 0.5
  // Exemple: 10 gal / 7 gal/h × 120 kt × 0.5 = 85 NM
  // ========================================================================================
  const coneZoneParams = useMemo(() => {
    if (!selectedAircraft || !fuelDataForRadius?.aircraft) return null;

    const aircraft = fuelDataForRadius.aircraft;
    const cruiseSpeed = aircraft.cruiseSpeedKt || 120;
    const consumption = aircraft.fuelConsumption || 40; // L/h (en storage units)

    // FOB = Carburant confirmé au décollage (depuis fobFuel du contexte Fuel)
    // IMPORTANT: Utiliser fobFuel.ltr OU convertir fobFuel.gal si ltr est 0
    // NE PAS utiliser aircraft.fuelCapacity comme fallback (c'est la capacité max, pas le FOB réel)
    let fobLiters = 0;
    if (fobFuel?.ltr && fobFuel.ltr > 0) {
      fobLiters = fobFuel.ltr;
    } else if (fobFuel?.gal && fobFuel.gal > 0) {
      // Convertir les gallons en litres (1 gal = 3.78541 L)
      fobLiters = fobFuel.gal * 3.78541;
    }

    // 🔧 DEBUG: Afficher les valeurs réelles pour diagnostic
    console.log('🔍 [CONE ZONE] DEBUG valeurs FOB:', {
      fobFuel: fobFuel,
      fobFuelLtr: fobFuel?.ltr,
      fobFuelGal: fobFuel?.gal,
      fobLitersCalculated: fobLiters,
      aircraftFuelCapacity: aircraft.fuelCapacity,
      consumption: consumption,
      willUseFallback: fobLiters === 0
    });

    // Si pas de FOB défini, on ne peut pas calculer les rayons précis
    if (fobLiters === 0) {
      console.log('⚠️ [CONE ZONE PARAMS] FOB non défini, utilisation de la capacité max comme estimation');
      // Fallback: utiliser la capacité max de l'avion
      const maxCapacity = aircraft.fuelCapacity || 0;
      if (maxCapacity === 0) return null;

      // Autonomie max (sans réserve pour simplicité)
      const maxEndurance = maxCapacity / consumption;
      const maxRadius = cruiseSpeed * maxEndurance * 0.5;

      return {
        radiusAtDep: Math.max(10, Math.min(100, maxRadius)), // Plafonner à 100 NM si FOB inconnu
        radiusAtArr: Math.max(5, Math.min(50, maxRadius * 0.5)),
        fobLiters: maxCapacity,
        tripFuel: 0,
        finalReserve: 0,
        enduranceAtDep: maxEndurance,
        enduranceAtArr: maxEndurance,
        isEstimate: true
      };
    }

    // Carburant consommé pendant le vol (si disponible)
    const tripFuel = navigationResults?.fuelRequired || 0;

    // RAYON AU DÉPART (R1): Basé sur FOB BRUT (pas de réserve soustraite)
    // Formule exacte demandée: FOB / Consommation × Vitesse × 0.5
    // Autonomie au départ = FOB / consommation
    const enduranceAtDep = fobLiters / consumption;
    // Rayon = vitesse × autonomie × 0.5 (demi-autonomie pour aller-retour théorique)
    const radiusAtDep = cruiseSpeed * enduranceAtDep * 0.5;

    // RAYON À L'ARRIVÉE (R2): Basé sur carburant restant théorique
    // Autonomie à l'arrivée = (FOB - carburant_vol) / consommation
    const fuelAtArrival = Math.max(0, fobLiters - tripFuel);
    const enduranceAtArr = fuelAtArrival / consumption;
    // Rayon à l'arrivée
    const radiusAtArr = cruiseSpeed * enduranceAtArr * 0.5;

    console.log('🔺 [CONE ZONE PARAMS] Calcul (formule: FOB/Conso×Vit×0.5):', {
      fobLiters: fobLiters.toFixed(1) + ' L',
      fobGallons: (fobLiters / 3.785).toFixed(1) + ' gal',
      tripFuel: tripFuel.toFixed(1) + ' L',
      fuelAtArrival: fuelAtArrival.toFixed(1) + ' L',
      cruiseSpeed: cruiseSpeed + ' kt',
      consumptionLph: consumption.toFixed(1) + ' L/h',
      consumptionGph: (consumption / 3.785).toFixed(1) + ' gal/h',
      enduranceAtDep: enduranceAtDep.toFixed(2) + ' h',
      enduranceAtArr: enduranceAtArr.toFixed(2) + ' h',
      radiusAtDep: radiusAtDep.toFixed(1) + ' NM',
      radiusAtArr: radiusAtArr.toFixed(1) + ' NM',
      formule: `${(fobLiters / 3.785).toFixed(1)} gal / ${(consumption / 3.785).toFixed(1)} gal/h × ${cruiseSpeed} kt × 0.5 = ${radiusAtDep.toFixed(1)} NM`
    });

    return {
      radiusAtDep: Math.max(10, radiusAtDep), // Min 10 NM, pas de max (calcul exact)
      radiusAtArr: Math.max(5, radiusAtArr),   // Min 5 NM, pas de max (calcul exact)
      fobLiters,
      tripFuel,
      finalReserve: 0, // Plus de réserve soustraite dans le calcul du rayon
      enduranceAtDep,
      enduranceAtArr
    };
  }, [selectedAircraft, fuelDataForRadius, fobFuel, fobFuelStore, navigationResults]);

  // ========================================================================================
  // NOUVEAU: Calcul du filtrage LDA (Landing Distance Available)
  // Distance moyenne entre départ et arrivée × 1.43 (marge VFR)
  // ========================================================================================
  const ldaFilterParams = useMemo(() => {
    if (!selectedAircraft || !waypoints || waypoints.length < 2) return null;

    // Récupérer les performances d'atterrissage de l'avion
    const landingDistanceRequired = selectedAircraft.performances?.landingDistance ||
                                     selectedAircraft.landingDistance || 200; // mètres

    // LDA au départ (si disponible dans les données du waypoint)
    const departureWp = waypoints[0];
    const arrivalWp = waypoints[waypoints.length - 1];

    // Essayer de récupérer les LDA des aérodromes (depuis runways)
    const getLongestRunway = (wp) => {
      if (wp.runways && wp.runways.length > 0) {
        return Math.max(...wp.runways.map(r => r.length || 0));
      }
      return null;
    };

    const ldaDeparture = getLongestRunway(departureWp);
    const ldaArrival = getLongestRunway(arrivalWp);

    // Si on a les deux LDA, calculer la moyenne
    // Sinon, utiliser la distance d'atterrissage de l'avion × 1.43 comme minimum
    let averageLDA = null;
    if (ldaDeparture && ldaArrival) {
      averageLDA = (ldaDeparture + ldaArrival) / 2;
    }

    // Distance minimale de piste requise = LDA moyenne × 1.43 (ou performance avion × 1.43)
    const minRunwayRequired = averageLDA ?
      Math.ceil(averageLDA * 1.43) :
      Math.ceil(landingDistanceRequired * 1.43);

    console.log('🛬 [LDA FILTER PARAMS] Calcul:', {
      ldaDeparture: ldaDeparture ? ldaDeparture + ' m' : 'N/A',
      ldaArrival: ldaArrival ? ldaArrival + ' m' : 'N/A',
      averageLDA: averageLDA ? averageLDA.toFixed(0) + ' m' : 'N/A',
      landingDistanceRequired: landingDistanceRequired + ' m',
      minRunwayRequired: minRunwayRequired + ' m',
      note: averageLDA ? 'Basé sur moyenne LDA × 1.43' : 'Basé sur performance avion × 1.43'
    });

    return {
      ldaDeparture,
      ldaArrival,
      averageLDA,
      landingDistanceRequired,
      minRunwayRequired
    };
  }, [selectedAircraft, waypoints]);

  // Calcul de la zone de recherche
  const searchZone = useMemo(() => {
    if (!isReady) return null;

    console.log('🛣️ WAYPOINTS DISPONIBLES:', {
      nbWaypoints: waypoints.length,
      waypoints: waypoints.map((wp, idx) => ({
        index: idx,
        icao: wp.icao,
        name: wp.name,
        lat: wp.lat,
        lon: wp.lon
      }))
    });

    const departure = {
      lat: waypoints[0].lat,
      lon: waypoints[0].lon
    };
    const arrival = {
      lat: waypoints[waypoints.length - 1].lat,
      lon: waypoints[waypoints.length - 1].lon
    };

    // CALCUL DE LA DISTANCE TOTALE DU CIRCUIT
    // Pour une navigation circulaire (retour au point de départ),
    // on doit sommer tous les segments au lieu de calculer départ→arrivée
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const segmentDist = calculateDistance(
        { lat: waypoints[i].lat, lon: waypoints[i].lon },
        { lat: waypoints[i + 1].lat, lon: waypoints[i + 1].lon }
      );
      totalDistance += segmentDist;
    }

    console.log('📍 ANALYSE CIRCUIT:', {
      departure: departure,
      arrival: arrival,
      samePoint: waypoints[0].icao === waypoints[waypoints.length - 1].icao,
      distanceDirecte: calculateDistance(departure, arrival).toFixed(1) + ' NM',
      distanceTotaleCircuit: totalDistance.toFixed(1) + ' NM',
      nbSegments: waypoints.length - 1,
      isCircuit: waypoints[0].icao === waypoints[waypoints.length - 1].icao
    });

    // Zone normale basée sur la formule pilule
    // IMPORTANT : Pour un circuit fermé, on passe la distance totale via options
    const zone = calculateSearchZone(departure, arrival, waypoints, fuelDataForRadius, {
      totalDistance: totalDistance  // Passer la distance totale du circuit
    });
    if (zone) {
      console.log('Search zone calculated:', {
        radius: zone.dynamicRadius + ' NM',
        area: zone.area?.toFixed(0) + ' NM²',
        hasPerpendicular: !!zone.perpendicular
      });
    }
    
    return zone;
  }, [waypoints, fuelDataForRadius, isReady]);

  // ========================================================================================
  // NOUVEAU: Calcul de la zone CÔNE (utilise FOB pour rayons variables)
  // Le cône remplace la pilule quand le bilan carburant est disponible (étape 7)
  // ========================================================================================
  const coneZone = useMemo(() => {
    // La zone cône nécessite les paramètres FOB calculés
    if (!isReady || !coneZoneParams || !waypoints || waypoints.length < 2) return null;

    const departure = {
      lat: waypoints[0].lat,
      lon: waypoints[0].lon
    };
    const arrival = {
      lat: waypoints[waypoints.length - 1].lat,
      lon: waypoints[waypoints.length - 1].lon
    };

    // Utiliser calculateConeZone avec les rayons basés sur FOB
    const cone = calculateConeZone(
      departure,
      arrival,
      coneZoneParams.radiusAtDep,
      coneZoneParams.radiusAtArr
    );

    if (cone) {
      console.log('🔺 [CONE ZONE] Zone cône calculée:', {
        radiusAtDep: cone.radiusAtDep?.toFixed(1) + ' NM',
        radiusAtArr: cone.radiusAtArr?.toFixed(1) + ' NM',
        area: cone.area?.toFixed(0) + ' NM²',
        fobUsed: coneZoneParams.fobLiters?.toFixed(1) + ' L'
      });
    }

    return cone;
  }, [isReady, coneZoneParams, waypoints]);

  // Paramètres dynamiques
  // MISE À JOUR: Utilise ldaFilterParams pour le filtrage des pistes
  // 🔧 FIX: Utiliser coneZoneParams.radiusAtDep si FOB disponible, sinon searchZone.dynamicRadius
  const dynamicParams = useMemo(() => {
    if (!selectedAircraft || !searchZone) return null;

    // NOUVEAU: Utiliser ldaFilterParams si disponible, sinon fallback
    const minRunwayLength = ldaFilterParams?.minRunwayRequired || 300;

    // 🔧 FIX: Utiliser le rayon du cône (basé sur FOB réel) si disponible
    // sinon utiliser le rayon de la zone pilule (basé sur capacité max)
    const effectiveRadius = (coneZoneParams && !coneZoneParams.isEstimate)
      ? coneZoneParams.radiusAtDep
      : searchZone.dynamicRadius;

    console.log('✅ [dynamicParams] Calculés:', {
      requiredRunwayLength: minRunwayLength,
      maxRadiusNM: effectiveRadius,
      searchZoneRadius: searchZone.dynamicRadius,
      coneZoneRadius: coneZoneParams?.radiusAtDep,
      useConeRadius: !!(coneZoneParams && !coneZoneParams.isEstimate),
      hasNavigationResults: !!navigationResults,
      ldaFilterUsed: !!ldaFilterParams
    });

    return {
      requiredRunwayLength: minRunwayLength,
      maxRadiusNM: effectiveRadius,
      flightRules: flightType.rules,
      isDayFlight: flightType.period === 'jour',
      // NOUVEAU: Informations LDA pour affichage
      ldaInfo: ldaFilterParams
    };
  }, [selectedAircraft, navigationResults, searchZone, flightType, ldaFilterParams, coneZoneParams]);
  
  // Fonction de recherche et scoring
  const findAlternates = useCallback(async () => {
    console.log('🚀🚀🚀 [findAlternates] FONCTION APPELÉE 🚀🚀🚀');
    console.log('🔍 [findAlternates] ÉTAT:', {
      searchZone: !!searchZone,
      searchZoneRadius: searchZone?.dynamicRadius,
      selectedAircraft: !!selectedAircraft,
      aircraftReg: selectedAircraft?.registration,
      dynamicParams: !!dynamicParams,
      airportsCount: airports?.length || 0
    });

    if (!searchZone) {
      console.log('❌ [findAlternates] BLOQUÉ: searchZone manquant');
      return;
    }
    if (!selectedAircraft) {
      console.log('❌ [findAlternates] BLOQUÉ: selectedAircraft manquant');
      return;
    }
    if (!dynamicParams) {
      console.log('❌ [findAlternates] BLOQUÉ: dynamicParams manquant');
      return;
    }

    // Vérifier qu'on a des aérodromes
    if (!airports || airports.length === 0) {
      console.error('❌ [findAlternates] BLOQUÉ: Aucun aérodrome disponible');
      return;
    }

    const isSearching = useAlternatesStore.getState().isSearching;
    console.log('🔍 [findAlternates] isSearching:', isSearching);
    if (isSearching) {
      console.log('⏳ [findAlternates] BLOQUÉ: Recherche déjà en cours');
      return;
    }
    
    try {
      useAlternatesStore.getState().setIsSearching?.(true);

      console.log(`Starting search with radius ${searchZone.dynamicRadius} NM`);

      // 1. Filtrer les aérodromes dans la zone
      const candidatesInZone = [];
      let testedCount = 0;
      let debugInfo = { inPill: 0, inTurnBuffer: 0, tooFar: 0, noIcao: 0, noCoords: 0 };

      console.log('🔍 [findAlternates] Zone de recherche:', {
        departure: searchZone.departure,
        arrival: searchZone.arrival,
        radius: searchZone.dynamicRadius,
        type: searchZone.type
      });

      // Afficher quelques aérodromes de test pour comprendre la structure
      console.log('🔍 [findAlternates] Exemples d\'aérodromes:', airports.slice(0, 5).map(a => ({
        icao: a.icao,
        name: a.name,
        lat: a.lat || a.coordinates?.lat,
        lon: a.lon || a.coordinates?.lon
      })));

      for (const airport of airports) {
        // Ignorer les aérodromes sans code ICAO
        if (!airport.icao) {
          debugInfo.noIcao++;
          continue;
        }

        // Double vérification : ignorer les héliports d'hôpitaux (import en haut du fichier)
        if (isHospitalHeliport(airport)) {
          continue;
        }

        // Vérifier les coordonnées
        const coords = airport.coordinates || airport.position || { lat: airport.lat, lon: airport.lon || airport.lng };
        if (!coords.lat || !coords.lon) {
          debugInfo.noCoords++;
          continue;
        }

        testedCount++;

        // 🔧 FIX: Utiliser la zone CÔNE (basée sur FOB réel) si disponible
        // La zone cône a des rayons R1 (départ) et R2 (arrivée) différents
        // Sinon utiliser la zone pilule (basée sur capacité max)
        let zoneCheck;
        if (coneZone) {
          zoneCheck = isAirportInConeZone(airport, coneZone);
        } else {
          zoneCheck = isAirportInSearchZone(airport, searchZone);
        }

        // Log détaillé pour les premiers aérodromes testés
        if (testedCount <= 10) {
          console.log(`🧪 Test ${airport.icao}: inZone=${zoneCheck.isInZone}, location=${zoneCheck.location}, useCone=${!!coneZone}, reason=${zoneCheck.reason || 'OK'}`);
        }

        if (zoneCheck.isInZone) {
          candidatesInZone.push({
            ...airport,
            distance: zoneCheck.distanceToRoute || calculateDistanceFromRoute(
              airport.coordinates || airport.position || { lat: airport.lat, lon: airport.lon || airport.lng },
              { lat: waypoints[0].lat, lon: waypoints[0].lon },
              { lat: waypoints[waypoints.length - 1].lat, lon: waypoints[waypoints.length - 1].lon }
            ),
            position: airport.coordinates || airport.position || { lat: airport.lat, lon: airport.lon || airport.lng },
            zoneInfo: zoneCheck
          });
          
          if (zoneCheck.location === 'pill') debugInfo.inPill++;
          else if (zoneCheck.location === 'turnBuffer') debugInfo.inTurnBuffer++;
        } else if (zoneCheck.distanceToRoute) {
          debugInfo.tooFar++;
        }
      }

      console.log(`📊 [findAlternates] RÉSUMÉ DE LA RECHERCHE:`, {
        totalAirports: airports.length,
        testedCount,
        noIcao: debugInfo.noIcao,
        noCoords: debugInfo.noCoords,
        inPill: debugInfo.inPill,
        inTurnBuffer: debugInfo.inTurnBuffer,
        tooFar: debugInfo.tooFar,
        candidatesFound: candidatesInZone.length
      });

      if (candidatesInZone.length > 0) {
        console.log('✅ [findAlternates] CANDIDATS TROUVÉS:');
        candidatesInZone.forEach((airport, index) => {
          console.log(`  ${index + 1}. ${airport.icao} - ${airport.name || 'Sans nom'}`);
          console.log(`     Position: ${airport.position?.lat?.toFixed(4)}°, ${airport.position?.lon?.toFixed(4)}°`);
          console.log(`     Distance: ${airport.distance?.toFixed(1) || 'N/A'} NM`);
        });
      } else {
        console.log('⚠️ [findAlternates] AUCUN CANDIDAT TROUVÉ!');
        console.log('⚠️ Vérifiez que les aérodromes ont des coordonnées valides et sont dans le rayon de recherche');
      }

      // 2. Filtrer selon les critères de compatibilité de piste
      // DEBUG: Afficher les critères de l'avion (format string pour voir le contenu)
      console.log('🛫 [FILTRAGE PISTES] Critères avion - surfaces:', JSON.stringify(selectedAircraft.compatibleRunwaySurfaces));
      console.log('🛫 [FILTRAGE PISTES] Critères avion - longueur min:', selectedAircraft.minimumRunwayLength);

      // DEBUG: Afficher quelques exemples de pistes d'aérodromes (format string)
      const exemplesPistes = candidatesInZone.slice(0, 5).map(apt => ({
        icao: apt.icao,
        runways: apt.runways?.map(r => ({ surface: r.surface, length: r.length }))
      }));
      console.log('🛬 [FILTRAGE PISTES] Exemples de pistes:', JSON.stringify(exemplesPistes, null, 2));

      let rejectedReasons = { noRunways: 0, noSurface: 0, incompatibleSurface: 0, tooShort: 0 };

      const filtered = candidatesInZone.filter(airport => {
        // Si l'aérodrome n'a pas d'info sur les pistes, l'accepter quand même
        // (on ne peut pas vérifier la compatibilité, mais mieux vaut l'afficher que l'exclure)
        if (!airport.runways || airport.runways.length === 0) {
          // Accepter par défaut si pas d'info de pistes
          return true;
        }

        // Fonction pour normaliser le type de surface
        const normalizeSurface = (surface) => {
          if (!surface) return null;
          // Vérifier que surface est bien une string
          if (typeof surface !== 'string') {
            // Si c'est un objet avec une propriété type, l'utiliser
            if (surface && typeof surface === 'object' && surface.type) {
              surface = surface.type;
            } else {
              return null;
            }
          }
          const s = surface.toUpperCase();
          if (s.includes('ASPH') || s === 'ASPHALT') return 'ASPH';
          if (s.includes('CONC') || s === 'CONCRETE') return 'CONC';
          if (s.includes('GRASS') || s === 'TURF') return 'GRASS';
          if (s.includes('DIRT') || s === 'EARTH') return 'DIRT';
          return s;
        };

        // Vérifier si au moins une piste est compatible
        // NOUVEAU: On accepte les pistes sans info de surface (données GeoJSON incomplètes)
        let isTooShort = false;
        let allTooShort = true;

        const hasCompatibleRunway = airport.runways.some(runway => {
          // Récupérer la longueur de piste (peut être à différents endroits)
          const runwayLength = runway.length || runway.dimensions?.length || 0;

          // 1. Vérifier la SURFACE EN PREMIER (critère le plus important)
          const runwaySurface = normalizeSurface(runway.surface);
          if (runwaySurface && selectedAircraft.compatibleRunwaySurfaces?.length > 0) {
            const isSurfaceCompatible = selectedAircraft.compatibleRunwaySurfaces.some(
              compatible => normalizeSurface(compatible) === runwaySurface
            );
            if (!isSurfaceCompatible) {
              // Log pour debug LFGC
              if (airport.icao === 'LFGC') {
                console.log(`❌ [LFGC] Piste surface incompatible: ${runwaySurface} pas dans [${selectedAircraft.compatibleRunwaySurfaces.join(', ')}]`);
              }
              return false; // Surface incompatible - REJET
            }
          }

          // 2. Vérifier la longueur minimale si l'avion a un critère
          if (selectedAircraft.minimumRunwayLength &&
              selectedAircraft.minimumRunwayLength !== '' &&
              runwayLength > 0) {
            const minLength = parseInt(selectedAircraft.minimumRunwayLength);
            if (runwayLength < minLength) {
              isTooShort = true;
              return false; // Cette piste est trop courte
            }
          }

          // Si on arrive ici, la piste est compatible (surface OK et longueur OK)
          allTooShort = false;
          return true;
        });

        if (!hasCompatibleRunway) {
          if (allTooShort) rejectedReasons.tooShort++;
          else rejectedReasons.incompatibleSurface++;
        }

        return hasCompatibleRunway;
      });

      console.log('📊 [FILTRAGE PISTES] Résultat:',
        'avant=' + candidatesInZone.length +
        ', après=' + filtered.length +
        ', rejets: noRunways=' + rejectedReasons.noRunways +
        ', noSurface=' + rejectedReasons.noSurface +
        ', incompatibleSurface=' + rejectedReasons.incompatibleSurface +
        ', tooShort=' + rejectedReasons.tooShort
      );
      
            
      setCandidates(filtered);
      
      // 3. MÉTÉO DÉSACTIVÉE TEMPORAIREMENT (erreur 429)

      // 4. Calculer les scores
      const context = {
        departure: { lat: waypoints[0].lat, lon: waypoints[0].lon },
        arrival: { lat: waypoints[waypoints.length - 1].lat, lon: waypoints[waypoints.length - 1].lon },
        waypoints,
        aircraft: selectedAircraft,
        weather: weatherStore.weatherData,
        flightType
      };
      
      // Utiliser scoreAlternates qui retourne une liste d'aérodromes scorés
      const scoredAirports = await scoreAlternates(filtered, context);
      
      // Enrichir avec les métadonnées et le côté (departure/arrival)
      const scored = scoredAirports.map(airport => ({
        ...airport,
        // S'assurer que la distance est bien définie
        distance: airport.distance || airport.zoneInfo?.distanceToRoute || 0,
        // Côté par rapport à la médiatrice
        side: airport.zoneInfo?.side || 'unknown',
        // Services
        services: {
          fuel: airport.fuel || false,
          atc: hasATCService(airport),
          lighting: hasNightLighting(airport)
        },
        // Pistes
        runways: airport.runways || []
      }));
      
      // OPTION : Filtrer pour n'afficher que les aérodromes non contrôlés
      // DÉSACTIVÉ pour afficher TOUS les aérodromes de déroutement disponibles
      const SHOW_ONLY_UNCONTROLLED = false; // true = non contrôlés uniquement, false = tous
      
      let scoredToDisplay = scored;
      if (SHOW_ONLY_UNCONTROLLED) {
        scoredToDisplay = scored.filter(airport => {
          const isControlled = hasATCService(airport);
          if (isControlled) {
                        return false;
          }
          return true;
        });
              }
      
      // 5. Séparer les aérodromes par côté
      const departureSideAirports = scoredToDisplay.filter(apt => apt.side === 'departure');
      const arrivalSideAirports = scoredToDisplay.filter(apt => apt.side === 'arrival');
      
                        
      // Trier chaque groupe par score
      departureSideAirports.sort((a, b) => b.score - a.score);
      arrivalSideAirports.sort((a, b) => b.score - a.score);
      
      // Stocker tous les aérodromes scorés (après filtrage optionnel)
      console.log('📝 [findAlternates] STOCKAGE DES RÉSULTATS:', {
        scoredCount: scoredToDisplay.length,
        departureSide: departureSideAirports.length,
        arrivalSide: arrivalSideAirports.length,
        airports: scoredToDisplay.map(a => `${a.icao} (score: ${(a.score * 100).toFixed(0)}%, side: ${a.side})`)
      });

      setScoredAlternates(scoredToDisplay);

      // Vérifier que le store a bien été mis à jour
      setTimeout(() => {
        const storeState = useAlternatesStore.getState();
        console.log('🔍 [findAlternates] VÉRIFICATION STORE:', {
          scoredAlternates: storeState.scoredAlternates?.length || 0,
          candidates: storeState.candidates?.length || 0
        });
      }, 100);

      // 6. PAS DE SÉLECTION AUTOMATIQUE - Juste stocker les suggestions
      const filterText = SHOW_ONLY_UNCONTROLLED ? ' (non contrôlés uniquement)' : '';

      // Ne pas sélectionner automatiquement - laisser l'utilisateur choisir
      // Les alternates scorés sont disponibles dans scoredAlternates du store

      // RÉSUMÉ FINAL
      if (SHOW_ONLY_UNCONTROLLED) {
        console.log(`Filtered to uncontrolled: ${scoredToDisplay.length}`);
      }
          
    } finally {
      // Fin de la recherche
      useAlternatesStore.getState().setIsSearching?.(false);
    }
  }, [
    searchZone,
    airports,
    selectedAircraft,
    dynamicParams,
    waypoints,
    weatherStore,
    flightType,
    setCandidates,
    setScoredAlternates
  ]);
  
  // Effet pour déclencher la recherche automatique une fois que tout est prêt
  useEffect(() => {
    console.log('🔄 [AUTO-SEARCH EFFECT] Vérification conditions:', {
      isReady,
      hasSearchZone: !!searchZone,
      hasSearchedOnce,
      dynamicParams: !!dynamicParams,
      airportsCount: airports.length
    });

    if (isReady && searchZone && !hasSearchedOnce) {
      console.log('🚀 [AUTO-SEARCH] Conditions remplies! Lancement de findAlternates...');
      setHasSearchedOnce(true);
      findAlternates();
    } else if (!isReady) {
      console.log('⏳ [AUTO-SEARCH] En attente: isReady = false');
    } else if (!searchZone) {
      console.log('⏳ [AUTO-SEARCH] En attente: searchZone = null');
    } else if (hasSearchedOnce) {
      console.log('✅ [AUTO-SEARCH] Déjà recherché une fois');
    }
  }, [isReady, searchZone, hasSearchedOnce, findAlternates, dynamicParams, airports.length]);
  
  // Mise à jour automatique à chaque changement de route
  useEffect(() => {
    if (searchZone && hasSearchedOnce) {
      const routeKey = `${waypoints[0]?.lat}-${waypoints[0]?.lon}-${waypoints[waypoints.length-1]?.lat}-${waypoints[waypoints.length-1]?.lon}`;
      const lastRouteKey = useAlternatesStore.getState().lastRouteKey;
      
      if (routeKey !== lastRouteKey) {
                useAlternatesStore.getState().setLastRouteKey?.(routeKey);
        setSearchZone(searchZone);
        // Effacer les suggestions mais GARDER les sélections manuelles
        setScoredAlternates([]);
        // NE PAS effacer les sélections manuelles
        // useAlternatesStore.getState().setSelectedAlternates([]);
        // Relancer la recherche
        findAlternates();
      }
    }
  }, [searchZone, waypoints, findAlternates, setSearchZone, setScoredAlternates, hasSearchedOnce]);
  
  // État de chargement : true si l'avion n'est pas encore chargé
  const isLoadingAircraft = useMemo(() => {
    return !selectedAircraft && !isLoadingAirports;
  }, [selectedAircraft, isLoadingAirports]);

  return {
    searchZone,
    coneZone,              // NOUVEAU: Zone cône basée sur FOB
    coneZoneParams,        // NOUVEAU: Paramètres du cône (rayons, FOB, etc.)
    ldaFilterParams,       // NOUVEAU: Paramètres de filtrage LDA
    dynamicParams,
    selectedAlternates,
    findAlternates,
    isReady,
    isLoadingAircraft,     // Indique si on attend le chargement de l'avion
    isLoadingAirports      // État de chargement des aérodromes
  };
};

// Fonction pour obtenir une longueur de piste par défaut basée sur l'ICAO
const getDefaultRunwayLength = (icao, type) => {
  const knownRunways = {
    'LFPG': 4200,
    'LFPO': 3650,
    'LFBO': 3500,
    'LFML': 3500,
    'LFLL': 4000,
    'LFMN': 2960,
    'LFBD': 3100,
    'LFSB': 3900,
    'LFLS': 3050,
    'LFST': 2400,
    'LFMT': 2600,
    'LFMU': 2200,
    'LFTW': 2440,
    'LFCR': 2100,
    'LFPN': 1500,
    'LFPT': 1200,
    'LFPB': 3000,
    'LFOB': 2430
  };
  
  return knownRunways[icao] || (type === 'AIRPORT' ? 2000 : 800);
};

// Fonctions utilitaires
const hasATCService = (airport) => {
  if (airport.frequencies) {
    return airport.frequencies.some(freq =>
      ['TWR', 'APP', 'AFIS'].includes(freq.type)
    );
  }
  return ['medium_airport', 'large_airport'].includes(airport.type);
};

const hasNightLighting = (airport) => {
  if (airport.runways) {
    return airport.runways.some(rwy =>
      rwy.lighting || rwy.lights || rwy.hasLighting
    );
  }
  return airport.type !== 'small_airport';
};