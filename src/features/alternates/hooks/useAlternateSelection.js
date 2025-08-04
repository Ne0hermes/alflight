// src/features/alternates/hooks/useAlternateSelection.js

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useAlternatesStore } from '@core/stores/alternatesStore';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { useNavigation, useAircraft, useFuel, useWeather } from '@core/contexts';
import { useNavigationResults } from '@hooks/useNavigationResults';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { 
  calculateSearchZone, 
  isAirportInSearchZone,
  calculateDistanceFromRoute,
  calculateDistance 
} from '../utils/geometryCalculations';
import { scoreAlternates } from './useAlternateScoring';

// Fonction pour obtenir un minimum d'aérodromes
const getMinimalAirports = () => {
  console.log('📍 Utilisation des aérodromes minimaux de secours');
  return [
    {
      icao: 'LFPG',
      name: 'Paris Charles de Gaulle',
      type: 'large_airport',
      lat: 49.0097,
      lon: 2.5479,
      coordinates: { lat: 49.0097, lon: 2.5479 },
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
  
  // État pour les aérodromes
  const [airports, setAirports] = useState([]);
  const [isLoadingAirports, setIsLoadingAirports] = useState(true);
  
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
        // D'abord essayer depuis le store
        let loadedAirports = openAIPSelectors.useFilteredAirports?.() || [];
        
        // Si pas d'aérodromes depuis le store, charger depuis le service
        if (!loadedAirports || loadedAirports.length === 0) {
          console.warn('⚠️ Store vide, chargement depuis openAIPService...');
          
          try {
            // Import dynamique du service
            const { openAIPService } = await import('@services/openAIPService');
            const staticAirports = await openAIPService.getAirports('FR');
            console.log(`✅ ${staticAirports.length} aérodromes chargés depuis le service`);
            
            // Formater pour correspondre à la structure attendue
            loadedAirports = staticAirports.map(apt => ({
              ...apt,
              icao: apt.icao,
              name: apt.name,
              type: apt.type === 'AIRPORT' ? 'large_airport' : 
                    apt.type === 'AIRFIELD' ? 'small_airport' : 'medium_airport',
              lat: apt.coordinates.lat,
              lon: apt.coordinates.lon,
              coordinates: apt.coordinates,
              elevation: apt.elevation,
              runways: [
                // Données de piste par défaut basées sur le type et l'ICAO
                {
                  length: getDefaultRunwayLength(apt.icao, apt.type),
                  width: apt.type === 'AIRPORT' ? 45 : 20,
                  surface: apt.type === 'AIRPORT' ? 'asphalt' : 'grass'
                }
              ],
              fuel: apt.type === 'AIRPORT',
              services: {
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
        }
        
        setAirports(loadedAirports);
        console.log(`📊 Total aérodromes disponibles: ${loadedAirports.length}`);
        
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
    if (!isLoadingAirports) {
      console.log('🛬 État des aérodromes:', {
        loading: isLoadingAirports,
        count: airports.length,
        sample: airports[0]
      });
    }
  }, [airports, isLoadingAirports]);
  
  // Validation des données
  const isReady = useMemo(() => {
    const ready = (
      waypoints.length >= 2 &&
      waypoints[0].lat && waypoints[0].lon &&
      waypoints[waypoints.length - 1].lat && waypoints[waypoints.length - 1].lon &&
      selectedAircraft &&
      navigationResults &&
      airports.length > 0 &&
      !isLoadingAirports
    );
    
    if (!ready) {
      console.log('🚫 Conditions non remplies pour la recherche:', {
        waypoints: waypoints.length,
        departure: waypoints[0] ? `${waypoints[0].name || 'Sans nom'} (${waypoints[0].lat ? 'OK' : 'Pas de coordonnées'})` : 'Manquant',
        arrival: waypoints[waypoints.length - 1] ? `${waypoints[waypoints.length - 1].name || 'Sans nom'} (${waypoints[waypoints.length - 1].lat ? 'OK' : 'Pas de coordonnées'})` : 'Manquant',
        aircraft: selectedAircraft ? selectedAircraft.model : 'Aucun',
        navigationResults: !!navigationResults,
        airportsLoaded: airports.length,
        loadingAirports: isLoadingAirports
      });
    }
    
    return ready;
  }, [waypoints, selectedAircraft, navigationResults, airports, isLoadingAirports]);
  
  // Calcul des données carburant pour le rayon dynamique
  const fuelDataForRadius = useMemo(() => {
    if (!selectedAircraft || !fobFuel || !navigationResults) return null;
    
    const totalRequired = calculateTotal('ltr');
    const fuelRemaining = fobFuel.ltr - navigationResults.fuelRequired;
    
    return {
      aircraft: selectedAircraft,
      fuelRemaining,
      reserves: {
        final: navigationResults.regulationReserveLiters,
        alternate: fuelData.alternate.ltr
      }
    };
  }, [selectedAircraft, fobFuel, navigationResults, calculateTotal, fuelData]);
  
  // Calcul de la zone de recherche
  const searchZone = useMemo(() => {
    if (!isReady) return null;
    
    const departure = {
      lat: waypoints[0].lat,
      lon: waypoints[0].lon
    };
    const arrival = {
      lat: waypoints[waypoints.length - 1].lat,
      lon: waypoints[waypoints.length - 1].lon
    };
    
    console.log('🗺️ DEBUG - Points de vol:', {
      departure,
      arrival,
      distance: calculateDistance(departure, arrival)
    });
    
    // Zone normale basée sur la formule pilule
    const zone = calculateSearchZone(departure, arrival, waypoints, fuelDataForRadius);
    if (zone) {
      console.log('🗺️ Zone calculée:', {
        type: zone.type,
        radius: zone.radius?.toFixed(1) + ' NM',
        area: zone.area?.toFixed(0) + ' NM²'
      });
    }
    
    return zone;
  }, [waypoints, fuelDataForRadius, isReady]);
  
  // Paramètres dynamiques
  const dynamicParams = useMemo(() => {
    if (!selectedAircraft || !navigationResults || !searchZone) return null;
    
    // Utiliser une longueur par défaut plus réaliste si pas de données
    const landingDistance = selectedAircraft.performances?.landingDistance || 200; // Réduit à 200m !
    const requiredRunwayLength = Math.ceil(landingDistance * 1.43);
    
    // Pour les petits avions, être moins restrictif
    const minRunwayLength = 300; // TEMPORAIRE : Accepter toute piste de plus de 300m !
    
    // DEBUG: Afficher les critères
    console.log('🛬 DEBUG - Critères de piste:', {
      landingDistance,
      requiredRunwayLength,
      minRunwayLength,
      aircraft: selectedAircraft?.model
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
      console.log('🔍 findAlternates - Conditions non remplies:', {
        searchZone: !!searchZone,
        selectedAircraft: !!selectedAircraft,
        dynamicParams: !!dynamicParams
      });
      return;
    }
    
    // ÉVITER LES APPELS RÉPÉTÉS
    const isSearching = useAlternatesStore.getState().isSearching;
    if (isSearching) {
      console.log('🔍 Recherche déjà en cours, abandon');
      return;
    }
    
    try {
      useAlternatesStore.getState().setIsSearching?.(true);
    
    console.log('🔍 Recherche avancée d\'alternates...');
    console.log('Zone de recherche:', searchZone);
    console.log(`Type de zone: ${searchZone.type}, Rayon: ${searchZone.radius?.toFixed(1)} NM`);
    console.log('Nombre total d\'aérodromes disponibles:', airports?.length || 0);
    
    // 1. Filtrer les aérodromes dans la zone
    const candidatesInZone = [];
    let testedCount = 0;
    let debugInfo = { inPill: 0, inTurnBuffer: 0, tooFar: 0 };
    
    // DEBUG: Vérifier la structure du premier aérodrome
    if (airports && airports.length > 0) {
      console.log('🔍 Structure premier aérodrome:', {
        icao: airports[0].icao,
        hasCoordinates: !!airports[0].coordinates,
        hasPosition: !!airports[0].position,
        hasLat: !!airports[0].lat,
        hasLon: !!(airports[0].lon || airports[0].lng),
        sample: airports[0]
      });
    }
    
    // OPTION DEBUG : Forcer l'acceptation de TOUS les aérodromes
    const FORCE_ACCEPT_ALL = false; // Retour au comportement normal avec zone géographique
    
    if (FORCE_ACCEPT_ALL) {
      console.log('⚠️ MODE DEBUG : Acceptation forcée de TOUS les aérodromes');
      
      // Ajouter TOUS les aérodromes comme candidats
      for (const airport of airports) {
        candidatesInZone.push({
          ...airport,
          distance: 10, // Distance arbitraire pour le debug
          position: airport.coordinates || airport.position || { lat: airport.lat, lon: airport.lon || airport.lng },
          zoneInfo: { isInZone: true, location: 'forced', distanceToRoute: 10 }
        });
      }
      
      console.log(`🎯 ${candidatesInZone.length} aérodromes forcés dans la zone`);
    } else {
      // Comportement normal avec vérification de zone
      for (const airport of airports) {
        testedCount++;
        const zoneCheck = isAirportInSearchZone(airport, searchZone);
        
        // DEBUG DÉTAILLÉ pour les 5 premiers aérodromes
        if (testedCount <= 5) {
          console.log(`🎯 Test zone pour ${airport.icao}:`, {
            position: airport.coordinates || airport.position || { lat: airport.lat, lon: airport.lon || airport.lng },
            zoneCheck,
            searchZoneType: searchZone.type,
            searchZoneRadius: searchZone.radius
          });
        }
        
        if (zoneCheck.isInZone) {
          // Enrichir avec les informations de distance
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
    }
    
    console.log(`Aérodromes testés: ${testedCount}`);
    console.log(`Dans la zone pilule: ${debugInfo.inPill}`);
    console.log(`Dans tampons virages: ${debugInfo.inTurnBuffer}`);
    console.log(`Trop loin: ${debugInfo.tooFar}`);
    console.log(`Total candidats dans zone: ${candidatesInZone.length}`);
    
    // AFFICHER TOUS LES AÉRODROMES DANS LA ZONE
    if (candidatesInZone.length > 0) {
      console.log('🗺️ TOUS LES AÉRODROMES DANS LA ZONE DE DÉROUTEMENT:');
      console.log('================================================');
      candidatesInZone.forEach((airport, index) => {
        console.log(`${index + 1}. ${airport.icao} - ${airport.name}`);
        console.log(`   📍 Position: ${airport.position.lat.toFixed(4)}°, ${airport.position.lon.toFixed(4)}°`);
        console.log(`   📏 Distance route: ${airport.distance?.toFixed(1)} NM`);
        console.log(`   🛬 Pistes: ${airport.runways?.length || 0}`);
        if (airport.runways && airport.runways.length > 0) {
          airport.runways.forEach((rwy, i) => {
            console.log(`      Piste ${i+1}: ${rwy.length || '?'}m × ${rwy.width || '?'}m (${rwy.surface || 'N/A'})`);
          });
        }
        console.log(`   🏢 Type: ${airport.type}`);
        console.log(`   📍 Localisation dans zone: ${airport.zoneInfo?.location || 'N/A'}`);
        console.log('   ---');
      });
      console.log('================================================');
    } else {
      console.log('❌ AUCUN AÉRODROME TROUVÉ DANS LA ZONE');
    }
    
    // 2. Filtrer selon les critères
    // TEMPORAIRE : ACCEPTER TOUS LES AÉRODROMES POUR DEBUG
    const filtered = candidatesInZone.map(airport => {
      console.log(`🛩️ Analyse ${airport.icao}:`, {
        runways: airport.runways?.length || 0,
        longueurPiste: airport.runways?.[0]?.length || 'N/A',
        type: airport.type,
        requiredLength: dynamicParams.requiredRunwayLength
      });
      return airport;
    });
    
    // const filtered = candidatesInZone.filter(airport => {
    //   // Code de filtrage désactivé temporairement
    // });
    
    console.log(`Après filtrage piste (min ${dynamicParams.requiredRunwayLength}m): ${filtered.length}`);
    
    // AFFICHER LA DIFFÉRENCE ENTRE ZONE ET FILTRÉS
    if (candidatesInZone.length > filtered.length) {
      console.log('⚠️ AÉRODROMES EXCLUS PAR LES FILTRES:');
      const excluded = candidatesInZone.filter(apt => !filtered.includes(apt));
      excluded.forEach(airport => {
        console.log(`   ❌ ${airport.icao} - ${airport.name}`);
        console.log(`      Raison: Piste trop courte ou pas de données`);
        console.log(`      Pistes: ${airport.runways?.map(r => r.length + 'm').join(', ') || 'Aucune donnée'}`);
      });
    }
    
    setCandidates(filtered);
    
    // 3. MÉTÉO DÉSACTIVÉE TEMPORAIREMENT (erreur 429)
    console.log('🌤️ Appels météo désactivés temporairement (limite API atteinte)');
    // await Promise.all(
    //   filtered.slice(0, 3).map(airport => 
    //     weatherStore.fetchWeather(airport.icao).catch((err) => {
    //       console.log(`Météo ${airport.icao} non disponible (normal pour petits aérodromes)`);
    //       return null;
    //     })
    //   )
    // );
    
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
    
    // Enrichir avec les métadonnées
    const scored = scoredAirports.map(airport => ({
      ...airport,
      // S'assurer que la distance est bien définie
      distance: airport.distance || airport.zoneInfo?.distanceToRoute || 0,
      // Services
      services: {
        fuel: airport.fuel || false,
        atc: hasATCService(airport),
        lighting: hasNightLighting(airport)
      },
      // Pistes
      runways: airport.runways || []
    }));
    
    // 5. Trier par score
    scored.sort((a, b) => b.score - a.score);
    setScoredAlternates(scored);
    
    // 6. Sélectionner automatiquement les 3 meilleurs
    const top3 = scored.slice(0, 3);
    useAlternatesStore.getState().setSelectedAlternates(top3);
    
    console.log(`✅ ${scored.length} alternates scorés`);
    console.log('Top 3 sélectionnés:', top3.map(a => `${a.icao} (${(a.score * 100).toFixed(0)}%)`));
    
    // RÉSUMÉ FINAL
    console.log('📊 RÉSUMÉ FINAL:');
    console.log(`- Aérodromes testés: ${testedCount}`);
    console.log(`- Dans la zone: ${candidatesInZone.length}`);
    console.log(`- Après filtrage: ${filtered.length}`);
    console.log(`- Après scoring: ${scored.length}`);
    console.log(`- Sélectionnés: ${top3.length}`);
    
    // DIAGNOSTIC SI AUCUN RÉSULTAT
    if (candidatesInZone.length === 0) {
      console.log('❌ PROBLÈME: Aucun aérodrome dans la zone');
      console.log('   Vérifiez:');
      console.log('   - La zone de recherche est-elle correcte ?');
      console.log('   - Les coordonnées de départ/arrivée sont-elles bonnes ?');
      console.log('   - Y a-t-il des aérodromes chargés ?');
    } else if (filtered.length === 0) {
      console.log('❌ PROBLÈME: Tous les aérodromes filtrés');
      console.log('   Les critères sont trop restrictifs');
      console.log(`   Longueur minimale requise: ${dynamicParams.requiredRunwayLength}m`);
    } else if (scored.length === 0) {
      console.log('❌ PROBLÈME: Erreur lors du scoring');
    }
    
    if (top3.length > 0) {
      console.log('✈️ Alternates sélectionnés:');
      top3.forEach((alt, i) => {
        console.log(`  ${i+1}. ${alt.icao} - ${alt.name}`);
        console.log(`     Distance: ${alt.distance?.toFixed(1)} NM`);
        console.log(`     Piste: ${alt.runways?.[0]?.length || '?'} m`);
        console.log(`     Score: ${(alt.score * 100).toFixed(0)}%`);
      });
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
  
  // Mise à jour automatique à chaque changement de route
  useEffect(() => {
    // Réinitialiser le flag quand la route change
    if (searchZone) {
      const routeKey = `${waypoints[0]?.lat}-${waypoints[0]?.lon}-${waypoints[waypoints.length-1]?.lat}-${waypoints[waypoints.length-1]?.lon}`;
      const lastRouteKey = useAlternatesStore.getState().lastRouteKey;
      
      if (routeKey !== lastRouteKey) {
        console.log('🔄 Route modifiée, recalcul automatique des alternates');
        useAlternatesStore.getState().setLastRouteKey?.(routeKey);
        setSearchZone(searchZone);
        findAlternates();
      }
    }
  }, [searchZone, waypoints, findAlternates, setSearchZone]);
  
  return {
    searchZone,
    dynamicParams,
    selectedAlternates,
    findAlternates,
    isReady
  };
};

// Fonction pour obtenir une longueur de piste par défaut basée sur l'ICAO
const getDefaultRunwayLength = (icao, type) => {
  // Données connues pour certains aérodromes majeurs
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