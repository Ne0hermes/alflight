
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useOpenAIPStore } from '@core/stores/openAIPStore';
import { useNavigation, useAircraft, useFuel, useWeather } from '@core/contexts';
import { useNavigationResults } from './useNavigationResults';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { 
  calculateSearchZone, 
  isAirportInSearchZone,
  calculateDistanceFromRoute
} from '../utils/geometryCalculations';
import { calculateDistance } from '@utils/navigationCalculations';
import { scoreAlternates } from './useAlternateScoring';

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
  const { fuelData, fobFuel, calculateTotal } = useFuel();
  const navigationResults = useNavigationResults();
  const weatherStore = useWeatherStore();
  const vacStore = useVACStore();

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
      
      try {
        // Accéder directement au store OpenAIP
        const openAIPStore = useOpenAIPStore.getState();
        let loadedAirports = [];
        
        // Essayer d'obtenir les aérodromes depuis le store
        if (openAIPStore.airports && Array.isArray(openAIPStore.airports)) {
          // Filtrer les aérodromes français
          loadedAirports = openAIPStore.airports.filter(apt =>
            apt.icao && apt.icao.startsWith('LF')
          );
        }
        
        if (!loadedAirports || loadedAirports.length === 0) {
          try {
            const { aeroDataProvider } = await import('@core/data');
            const staticAirports = await aeroDataProvider.getAirfields({ country: 'FR' });
            
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
            console.error('❌ Erreur import service:', error);
            loadedAirports = getMinimalAirports();
          }
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
        
        setAirports(loadedAirports);
                
      } catch (error) {
        console.error('❌ Erreur chargement aérodromes:', error);
        setAirports(getMinimalAirports());
      } finally {
        setIsLoadingAirports(false);
      }
    };
    
    loadAirports();
  }, []);
  
  // DEBUG: Afficher l'état des aérodromes
  useEffect(() => {
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
  const fuelDataForRadius = useMemo(() => {
    if (!selectedAircraft || !fobFuel || !navigationResults) return null;
    
    // Vérifier que les propriétés existent
    const fobLiters = fobFuel?.ltr || 0;
    const fuelRequired = navigationResults?.fuelRequired || 0;
    const totalRequired = calculateTotal ? calculateTotal('ltr') : 0;
    const fuelRemaining = fobLiters - fuelRequired;
    
    return {
      aircraft: selectedAircraft,
      fuelRemaining,
      reserves: {
        final: navigationResults?.regulationReserveLiters || 0,
        alternate: fuelData?.alternate?.ltr || 0
      }
    };
  }, [selectedAircraft, fobFuel, navigationResults, calculateTotal, fuelData]);
  
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
  
  // Paramètres dynamiques
  const dynamicParams = useMemo(() => {
    if (!selectedAircraft || !navigationResults || !searchZone) return null;
    
    const landingDistance = selectedAircraft.performances?.landingDistance || 200;
    const requiredRunwayLength = Math.ceil(landingDistance * 1.43);
    const minRunwayLength = 300; // Minimum acceptable

    console.log('Dynamic params:', {
      requiredRunwayLength: minRunwayLength,
      maxRadiusNM: searchZone.dynamicRadius
    });

    return {
      requiredRunwayLength: minRunwayLength,
      maxRadiusNM: searchZone.dynamicRadius,
      flightRules: flightType.rules,
      isDayFlight: flightType.period === 'jour'
    };
  }, [selectedAircraft, navigationResults, searchZone, flightType]);
  
  // Fonction de recherche et scoring
  const findAlternates = useCallback(async () => {
    if (!searchZone || !selectedAircraft || !dynamicParams) {
      console.log('Cannot find alternates: missing requirements');
      return;
    }
    
    // Vérifier qu'on a des aérodromes
    if (!airports || airports.length === 0) {
      console.error('❌ Aucun aérodrome disponible pour la recherche');
      return;
    }
    
    const isSearching = useAlternatesStore.getState().isSearching;
    if (isSearching) {
      console.log('Search already in progress');
      return;
    }
    
    try {
      useAlternatesStore.getState().setIsSearching?.(true);

      console.log(`Starting search with radius ${searchZone.dynamicRadius} NM`);

      // 1. Filtrer les aérodromes dans la zone
      const candidatesInZone = [];
      let testedCount = 0;
      let debugInfo = { inPill: 0, inTurnBuffer: 0, tooFar: 0 };
      
      for (const airport of airports) {
        // Ignorer les aérodromes sans code ICAO
        if (!airport.icao) {
                    continue;
        }
        
        testedCount++;
        const zoneCheck = isAirportInSearchZone(airport, searchZone);
        
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

      console.log(`Found ${candidatesInZone.length} candidates in search zone`);

      if (candidatesInZone.length > 0) {
        candidatesInZone.forEach((airport, index) => {
          console.log(`  ${index + 1}. ${airport.name || airport.icao} - ${airport.position.lat.toFixed(4)}°, ${airport.position.lon.toFixed(4)}°`);
          console.log(`     Distance: ${airport.distance?.toFixed(1) || 'N/A'} NM`);
        });
      }

      // 2. Filtrer selon les critères de compatibilité de piste
      const filtered = candidatesInZone.filter(airport => {
        // Si l'avion n'a pas de critères de compatibilité, accepter tous les aérodromes
        if (!selectedAircraft.compatibleRunwaySurfaces ||
            selectedAircraft.compatibleRunwaySurfaces.length === 0) {
          return true;
        }

        // Vérifier que l'aérodrome a au moins une piste compatible
        if (!airport.runways || airport.runways.length === 0) {
          return false; // Pas de piste = non compatible
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

        // Vérifier si au moins une piste a une surface compatible
        const hasCompatibleRunway = airport.runways.some(runway => {
          const runwaySurface = normalizeSurface(runway.surface);
          if (!runwaySurface) return false;

          // Vérifier la compatibilité de surface
          const isSurfaceCompatible = selectedAircraft.compatibleRunwaySurfaces.some(
            compatible => normalizeSurface(compatible) === runwaySurface
          );

          // Vérifier la longueur minimale si spécifiée
          if (isSurfaceCompatible && selectedAircraft.minimumRunwayLength &&
              selectedAircraft.minimumRunwayLength !== '') {
            const minLength = parseInt(selectedAircraft.minimumRunwayLength);
            return runway.length >= minLength;
          }

          return isSurfaceCompatible;
        });

        return hasCompatibleRunway;
      });

      console.log(`Filtered to ${filtered.length} compatible airports (runway surface check)`);
      
            
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
      // Activé par défaut pour ne montrer que les aérodromes non contrôlés
      const SHOW_ONLY_UNCONTROLLED = true; // true = non contrôlés uniquement, false = tous
      
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
      setScoredAlternates(scoredToDisplay);
      
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
    if (isReady && searchZone && !hasSearchedOnce) {
            setHasSearchedOnce(true);
      findAlternates();
    }
  }, [isReady, searchZone, hasSearchedOnce, findAlternates]);
  
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
    dynamicParams,
    selectedAlternates,
    findAlternates,
    isReady,
    isLoadingAircraft,  // Nouveau : indique si on attend le chargement de l'avion
    isLoadingAirports   // Export de l'état de chargement des aérodromes
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