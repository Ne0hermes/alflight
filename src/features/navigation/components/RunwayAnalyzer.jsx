// src/features/navigation/components/RunwayAnalyzer.jsx
import React, { memo, useEffect, useMemo } from 'react';
import { Wind, Navigation, AlertTriangle, Plane, RefreshCw, Info, Download, Map, Shield } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useOpenAIPStore, openAIPSelectors } from '@core/stores/openAIPStore';
import { useWeatherStore, weatherSelectors } from '@core/stores/weatherStore';
import { useVACStore, vacSelectors } from '@core/stores/vacStore';
import { useAircraft } from '@core/contexts';

// Fonction pour normaliser les types de surfaces de piste
const normalizeSurfaceType = (surface) => {
  if (!surface) return 'UNKNOWN';
  
  // Normaliser les caractères spéciaux et accents AVANT de convertir en majuscules
  const normalizedSurface = surface
    .normalize('NFD') // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .toUpperCase()
    .trim(); // Enlever les espaces en début/fin
  
  // Garder aussi la version originale en majuscules pour certains tests
  const surfaceUpper = surface.toUpperCase().trim();
  
  // Debug pour les surfaces revêtues
  if (surface.toLowerCase().includes('revêt')) {
    console.log(`🔍 Debug normalisation pour "${surface}":`, {
      original: surface,
      normalized: normalizedSurface,
      containsREVETUE: normalizedSurface.includes('REVETUE'),
      containsREVETU: normalizedSurface.includes('REVETU')
    });
  }
  
  // TERRE/NON REVÊTU - VÉRIFIER EN PREMIER pour éviter les faux positifs
  if (normalizedSurface.includes('NON REVETUE') ||
      normalizedSurface.includes('NON REVETU') ||
      surfaceUpper.includes('NON REVÊTUE') ||
      surfaceUpper.includes('NON REVÊTU') ||
      normalizedSurface.includes('UNPAVED') || 
      normalizedSurface.includes('TERRE') || 
      normalizedSurface.includes('DIRT') ||
      normalizedSurface.includes('EARTH') ||
      normalizedSurface.includes('CLAY') ||
      normalizedSurface.includes('MUD') ||
      normalizedSurface.includes('SOIL') ||
      normalizedSurface.includes('ARGILE') ||
      normalizedSurface.includes('BOUE') ||
      normalizedSurface.includes('NATUREL')) {
    return 'UNPAVED';
  }
  
  // ASPHALTE (inclut toutes les surfaces revêtues sauf béton)
  // Tester APRÈS avoir exclu "NON REVÊTUE"
  if (normalizedSurface.includes('ASPH') || 
      normalizedSurface.includes('BITUM') || 
      normalizedSurface.includes('ASPHALTE') ||
      normalizedSurface === 'ASPHALT' ||
      normalizedSurface.includes('ENROBE') ||
      normalizedSurface.includes('REVETUE') ||
      normalizedSurface.includes('REVETU') ||
      normalizedSurface === 'REVETUE' || // Test exact aussi
      surfaceUpper.includes('REVÊTUE') || // Test aussi avec accent au cas où
      surfaceUpper.includes('REVÊTU') ||
      normalizedSurface === 'PAVED' ||
      normalizedSurface.includes('TARMAC') ||
      normalizedSurface.includes('MACADAM') ||
      normalizedSurface.includes('GOUDRON')) {
    console.log(`✅ Surface "${surface}" normalisée en ASPH`);
    return 'ASPH';
  }
  
  // BÉTON
  if (normalizedSurface.includes('CONC') || 
      normalizedSurface.includes('BETON') ||
      normalizedSurface === 'CONCRETE' ||
      normalizedSurface.includes('CEMENT') ||
      normalizedSurface.includes('CIMENT')) {
    return 'CONC';
  }
  
  // HERBE
  if (normalizedSurface.includes('GRASS') || 
      normalizedSurface.includes('HERBE') || 
      normalizedSurface.includes('GAZON') ||
      normalizedSurface === 'TURF' ||
      normalizedSurface.includes('PELOUSE')) {
    return 'GRASS';
  }
  
  // GRAVIER
  if (normalizedSurface.includes('GRAV') || 
      normalizedSurface.includes('GRAVEL') ||
      normalizedSurface.includes('GRAVIER') ||
      normalizedSurface.includes('CRUSHED') ||
      normalizedSurface.includes('PIERRAILLE') ||
      normalizedSurface.includes('CAILLOU')) {
    return 'GRVL';
  }
  
  // SABLE
  if (normalizedSurface.includes('SAND') || 
      normalizedSurface.includes('SABLE') ||
      normalizedSurface.includes('BEACH') ||
      normalizedSurface.includes('PLAGE')) {
    return 'SAND';
  }
  
  // NEIGE
  if (normalizedSurface.includes('SNOW') || 
      normalizedSurface.includes('NEIGE') ||
      normalizedSurface.includes('ICE') ||
      normalizedSurface.includes('GLACE') ||
      normalizedSurface.includes('GLACIER')) {
    return 'SNOW';
  }
  
  // EAU
  if (normalizedSurface.includes('WATER') || 
      normalizedSurface.includes('EAU') ||
      normalizedSurface.includes('SEA') ||
      normalizedSurface.includes('MER') ||
      normalizedSurface.includes('LAKE') ||
      normalizedSurface.includes('LAC') ||
      normalizedSurface.includes('RIVER') ||
      normalizedSurface.includes('RIVIERE') ||
      surfaceUpper.includes('RIVIÈRE')) { // Garder ce test avec accent
    return 'WATER';
  }
  
  // Si on arrive ici, la surface n'est pas reconnue
  console.warn(`⚠️ Surface non reconnue: "${surface}" (normalisée: "${normalizedSurface}")`);
  return 'UNKNOWN';
};

// Fonction pour obtenir le nom lisible d'un type de surface
const getSurfaceName = (code) => {
  const names = {
    'ASPH': 'Asphalte',
    'CONC': 'Béton',
    'GRASS': 'Herbe',
    'GRVL': 'Gravier',
    'UNPAVED': 'Terre',
    'SAND': 'Sable',
    'SNOW': 'Neige',
    'WATER': 'Eau',
    'UNKNOWN': 'Inconnue'
  };
  return names[code] || code;
};

// Fonction pour vérifier la compatibilité d'une piste avec l'avion
const checkRunwayCompatibility = (runway, aircraft) => {
  // Si pas d'avion sélectionné, on ne peut pas vérifier la compatibilité
  if (!aircraft) {
    console.log('⚠️ checkRunwayCompatibility: Aucun avion sélectionné');
    return { 
      isCompatible: null, 
      reason: 'Aucun avion sélectionné' 
    };
  }
  
  // Debug : afficher les surfaces compatibles de l'avion
  console.log(`🛩️ Surfaces compatibles de ${aircraft.registration}:`, aircraft.compatibleRunwaySurfaces);
  
  // Si l'avion n'a pas de surfaces compatibles définies ou si la liste est vide
  // cela signifie qu'il ne peut opérer sur AUCUNE surface
  if (!aircraft.compatibleRunwaySurfaces || aircraft.compatibleRunwaySurfaces.length === 0) {
    console.warn(`⚠️ Avion ${aircraft.registration} n'a aucune surface compatible définie`);
    return { 
      isCompatible: false, 
      reason: 'Aucune surface compatible définie pour cet avion' 
    };
  }
  
  const normalizedSurface = normalizeSurfaceType(runway.surface);
  
  console.log(`🔍 Vérification compatibilité piste ${runway.name}:`, {
    surfaceOriginale: runway.surface,
    surfaceNormalisée: normalizedSurface,
    surfacesAvion: aircraft.compatibleRunwaySurfaces,
    avionRegistration: aircraft.registration,
    avionContientASPH: aircraft.compatibleRunwaySurfaces.includes('ASPH'),
    avionContientCONC: aircraft.compatibleRunwaySurfaces.includes('CONC'),
    testRevetue: runway.surface ? runway.surface.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().includes('REVETUE') : false
  });
  
  if (normalizedSurface === 'UNKNOWN') {
    console.error(`❌ Type de surface non reconnu pour la piste ${runway.name}: "${runway.surface}"`);
    return { 
      isCompatible: null, 
      reason: `Type de surface inconnu: "${runway.surface}"`,
      surface: runway.surface 
    };
  }
  
  const isCompatible = aircraft.compatibleRunwaySurfaces.includes(normalizedSurface);
  
  console.log(`✈️ Compatibilité ${runway.name} avec ${aircraft.registration}: ${isCompatible ? '✅ OUI' : '❌ NON'} (${normalizedSurface} ${isCompatible ? 'dans' : 'pas dans'} [${aircraft.compatibleRunwaySurfaces.join(', ')}])`);
  
  return {
    isCompatible,
    reason: isCompatible 
      ? `Compatible avec ${getSurfaceName(normalizedSurface)}` 
      : `Avion non compatible avec ${getSurfaceName(normalizedSurface)} (piste: ${runway.surface})`,
    surface: normalizedSurface
  };
};

// Données de secours pour quelques aérodromes majeurs (si VAC non disponible)
const FALLBACK_RUNWAYS = {
  'LFPG': [
    { name: '08L', length: 2700, surface: 'ASPH' }, 
    { name: '26R', length: 2700, surface: 'ASPH' }, 
    { name: '08R', length: 4200, surface: 'ASPH' }, 
    { name: '26L', length: 4200, surface: 'ASPH' }
  ],
  'LFPO': [
    { name: '06', length: 3320, surface: 'ASPH' }, 
    { name: '24', length: 3320, surface: 'ASPH' }, 
    { name: '08', length: 2400, surface: 'CONC' }, 
    { name: '26', length: 2400, surface: 'CONC' }
  ],
  'LFLL': [
    { name: '18L', length: 4000, surface: 'CONC' }, 
    { name: '36R', length: 4000, surface: 'CONC' }, 
    { name: '18R', length: 2670, surface: 'ASPH' }, 
    { name: '36L', length: 2670, surface: 'ASPH' }
  ],
  // Ajouter quelques aéroports majeurs uniquement
};

// Fonction pour calculer la différence entre deux angles (en degrés)
const angleDifference = (angle1, angle2) => {
  // Vérifier que les angles sont valides
  if (angle1 === null || angle1 === undefined || angle2 === null || angle2 === undefined ||
      isNaN(angle1) || isNaN(angle2)) {
    return 0;
  }
  
  // Normaliser les angles entre 0 et 360
  angle1 = ((angle1 % 360) + 360) % 360;
  angle2 = ((angle2 % 360) + 360) % 360;
  
  const diff = Math.abs(angle1 - angle2);
  return Math.min(diff, 360 - diff);
};

// Fonction pour calculer le vent de travers
const calculateCrosswind = (windDirection, windSpeed, runwayHeading) => {
  try {
    // Forcer la conversion en nombre et logger immédiatement
    const wd = windDirection !== null && windDirection !== undefined ? Number(windDirection) : null;
    const ws = Number(windSpeed) || 0;
    const rh = Number(runwayHeading) || 0;
    
    console.log(`🎯 calculateCrosswind - Valeurs converties:`, { wd, ws, rh });
    
    // Si pas de vent ou pas de direction, retourner zéro
    if (wd === null || ws === 0) {
      console.log('🎯 Vent nul ou sans direction');
      return {
        crosswind: 0,
        headwind: 0,
        angleDiff: 0
      };
    }
    
    // MÉTHODE DE CALCUL :
    // 1. Le vent vient DE windDirection (ex: 340° = vent du nord-ouest)
    // 2. La piste pointe VERS runwayHeading (ex: piste 12 = cap 120°)
    // 3. Pour un vent de face parfait, il faudrait que le vent vienne de runwayHeading + 180°
    
    // Direction d'où viendrait un vent de face parfait
    const perfectHeadwindDirection = (rh + 180) % 360;
    
    // Angle entre la direction du vent et cette direction parfaite
    let angleFromPerfectHeadwind = wd - perfectHeadwindDirection;
    
    // Normaliser entre -180 et 180
    while (angleFromPerfectHeadwind > 180) angleFromPerfectHeadwind -= 360;
    while (angleFromPerfectHeadwind < -180) angleFromPerfectHeadwind += 360;
    
    // Valeur absolue pour les calculs
    const absAngle = Math.abs(angleFromPerfectHeadwind);
    
    // Convertir en radians
    const angleRad = absAngle * Math.PI / 180;
    
    // Calculer les composantes
    let headwindComponent = Math.cos(angleRad) * ws;
    const crosswindComponent = Math.sin(angleRad) * ws;
    
    // Si l'angle est > 90°, on a un vent arrière
    if (absAngle > 90) {
      headwindComponent = -Math.abs(headwindComponent);
    }
    
    // L'angle affiché est l'angle entre le vent et la direction de la piste
    const displayAngle = angleDifference(wd, rh);
    
    const result = {
      crosswind: Math.round(Math.abs(crosswindComponent)),
      headwind: Math.round(headwindComponent),
      angleDiff: Math.round(displayAngle)
    };
    
    console.log(`🎯 Résultat calcul:`, result);
    
    return result;
  } catch (error) {
    console.error('❌ Erreur dans calculateCrosswind:', error);
    return {
      crosswind: 0,
      headwind: 0,
      angleDiff: 0
    };
  }
};

// Fonction de diagnostic (pour debug)
const diagnosticRunwayCompatibility = (runway, aircraft) => {
  console.group(`🔍 DIAGNOSTIC Compatibilité ${runway.name}`);
  console.log('1. Surface originale de la piste:', runway.surface);
  
  // Test de normalisation détaillé
  const normalized = runway.surface
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  
  console.log('2. Surface normalisée (sans accents):', normalized);
  console.log('3. Surface normalisée par la fonction:', normalizeSurfaceType(runway.surface));
  console.log('4. Surfaces compatibles de l\'avion:', aircraft?.compatibleRunwaySurfaces);
  console.log('5. L\'avion contient ASPH?', aircraft?.compatibleRunwaySurfaces?.includes('ASPH'));
  console.log('6. L\'avion contient CONC?', aircraft?.compatibleRunwaySurfaces?.includes('CONC'));
  
  if (runway.surface) {
    console.log('7. Tests détaillés de la chaîne:');
    console.log('   - Contient "REVÊTUE"?', runway.surface.toUpperCase().includes('REVÊTUE'));
    console.log('   - Contient "REVETUE" (après normalisation)?', normalized.includes('REVETUE'));
    console.log('   - Longueur originale:', runway.surface.length);
    console.log('   - Longueur normalisée:', normalized.length);
    console.log('   - Codes de caractères:', Array.from(runway.surface).map(c => c.charCodeAt(0)));
  }
  
  const result = checkRunwayCompatibility(runway, aircraft);
  console.log('8. Résultat final:', result);
  console.groupEnd();
  
  return result;
};

export const RunwayAnalyzer = memo(({ icao }) => {
  // Récupérer les données de l'aérodrome
  const airports = openAIPSelectors.useFilteredAirports();
  const airport = airports.find(a => a.icao === icao);
  
  // Récupérer l'avion sélectionné
  const { selectedAircraft } = useAircraft();
  
  // Debug de l'avion sélectionné
  console.log(`🛩️ RunwayAnalyzer - Avion sélectionné:`, {
    exists: !!selectedAircraft,
    registration: selectedAircraft?.registration,
    compatibleSurfaces: selectedAircraft?.compatibleRunwaySurfaces,
    surfaceCount: selectedAircraft?.compatibleRunwaySurfaces?.length || 0
  });
  
  // Récupérer les données VAC
  const vacChart = vacSelectors.useChartByIcao(icao);
  const { downloadChart } = vacSelectors.useVACActions();
  const isVacDownloading = vacSelectors.useIsDownloading(icao);
  
  // Récupérer la météo
  const weather = weatherSelectors.useWeatherByIcao(icao);
  const isLoading = weatherSelectors.useIsLoading(icao);
  const error = weatherSelectors.useError(icao);
  const { fetchWeather } = weatherSelectors.useWeatherActions();
  
  // Charger automatiquement la météo si pas disponible
  useEffect(() => {
    if (icao && !weather && !isLoading && !error) {
      fetchWeather(icao);
    }
  }, [icao, weather, isLoading, error, fetchWeather]);
  
  // Déterminer la source des données de pistes (toujours calculer même si pas d'aéroport)
  let runways = [];
  let dataSource = 'none';
  
  if (airport) {
    // Priorité 1 : Données extraites de la carte VAC
    if (vacChart?.isDownloaded && vacChart?.extractedData?.runways) {
      // Les données VAC peuvent avoir des identifiants comme "05/23"
      // On doit les séparer en deux pistes distinctes
      const vacRunways = [];
      vacChart.extractedData.runways.forEach(rwy => {
        console.log('🔍 Traitement piste VAC:', rwy);
        
        if (rwy.identifier.includes('/')) {
          // Piste double (ex: "05/23")
          const [rwy1, rwy2] = rwy.identifier.split('/');
          
          // Calculer les QFU
          // Si le QFU est fourni dans les données VAC, l'utiliser
          // Sinon, calculer depuis le numéro de piste
          let qfu1, qfu2;
          
          if (rwy.qfu !== undefined && rwy.qfu !== null && !isNaN(rwy.qfu)) {
            qfu1 = parseInt(rwy.qfu);
            qfu2 = (qfu1 + 180) % 360;
          } else {
            // Calculer depuis les numéros de piste
            const num1 = parseInt(rwy1.replace(/[LCR]/g, ''));
            const num2 = parseInt(rwy2.replace(/[LCR]/g, ''));
            qfu1 = num1 * 10;
            qfu2 = num2 * 10;
          }
          
          // Première direction
          vacRunways.push({
            name: rwy1,
            length: rwy.length,
            width: rwy.width,
            surface: rwy.surface,
            qfu: qfu1
          });
          // Direction opposée
          vacRunways.push({
            name: rwy2,
            length: rwy.length,
            width: rwy.width,
            surface: rwy.surface,
            qfu: qfu2
          });
          
          console.log(`📐 Piste ${rwy.identifier} séparée:`, 
            `${rwy1} (QFU ${qfu1}°) et ${rwy2} (QFU ${qfu2}°)`);
        } else {
          // Piste simple
          let qfu;
          if (rwy.qfu !== undefined && rwy.qfu !== null && !isNaN(rwy.qfu)) {
            qfu = parseInt(rwy.qfu);
          } else {
            const num = parseInt(rwy.identifier.replace(/[LCR]/g, ''));
            qfu = num * 10;
          }
          
          vacRunways.push({
            name: rwy.identifier,
            length: rwy.length,
            width: rwy.width,
            surface: rwy.surface,
            qfu: qfu
          });
        }
      });
      runways = vacRunways;
      dataSource = 'vac';
    }
    // Priorité 2 : Données OpenAIP
    else if (airport.runways && airport.runways.length > 0) {
      // Adapter les données OpenAIP au format attendu
      runways = airport.runways.map(rwy => {
        // OpenAIP peut avoir la surface dans différents formats
        let surface = rwy.surface || rwy.surfaceType || rwy.type || '';
        
        // Si toujours pas de surface et c'est un aérodrome important, supposer asphalte
        if (!surface && airport.type !== 'small_airport') {
          surface = 'ASPH';
        }
        
        return {
          name: rwy.name || rwy.identifier || rwy.designator || 'Unknown',
          length: rwy.length || rwy.dimensions?.length || 0,
          width: rwy.width || rwy.dimensions?.width || 0,
          surface: surface,
          qfu: rwy.qfu || rwy.heading || (parseInt((rwy.name || '0').replace(/[LCR]/g, '')) * 10)
        };
      });
      dataSource = 'openaip';
    }
    // Priorité 3 : Base de données de secours
    else if (FALLBACK_RUNWAYS[icao]) {
      runways = FALLBACK_RUNWAYS[icao];
      dataSource = 'fallback';
    }
  }
  
  // Parser les données de vent (toujours parser même si pas de météo)
  let windDirection = null;
  let windSpeed = 0;
  
  if (weather?.metar?.decoded?.wind) {
    const metar = weather.metar.decoded;
    console.log('🌪️ Données vent brutes:', metar.wind);
    
    if (metar.wind.direction === 'Variable' || metar.wind.direction === 'Calme') {
      windDirection = null;
      windSpeed = 0;
    } else {
      // Forcer la conversion en nombre
      windDirection = parseInt(metar.wind.direction);
      
      // Debug détaillé pour windSpeed
      console.log('🔢 Conversion windSpeed:', {
        raw: metar.wind.speed,
        parseFloat: parseFloat(metar.wind.speed),
        parseInt: parseInt(metar.wind.speed),
        Number: Number(metar.wind.speed)
      });
      
      windSpeed = Number(metar.wind.speed) || 0;
      
      // Vérifier que les valeurs sont valides
      if (isNaN(windDirection)) windDirection = null;
      if (isNaN(windSpeed)) windSpeed = 0;
    }
    
    console.log('🌤️ Données météo parsées:', { 
      rawWind: metar.wind,
      windDirection, 
      windSpeed,
      windSpeedType: typeof windSpeed
    });
  }
  
  // Analyser les pistes (TOUJOURS utiliser useMemo, même si runways est vide)
  const runwayAnalysis = useMemo(() => {
    if (!runways || runways.length === 0) return [];
    
    console.log(`📊 Début de l'analyse des pistes pour ${icao} avec avion ${selectedAircraft?.registration || 'non sélectionné'}`);
    
    return runways.map(runway => {
      const heading = runway.qfu || parseInt(runway.name.replace(/[LCR]/g, '')) * 10;
      const windAnalysis = windDirection !== null && windSpeed > 0 
        ? calculateCrosswind(windDirection, windSpeed, heading)
        : { crosswind: 0, headwind: 0, angleDiff: 0 };
      
      const compatibility = checkRunwayCompatibility(runway, selectedAircraft);
      
      // Debug détaillé pour les pistes avec surface "Revêtue"
      if (runway.surface && runway.surface.toLowerCase().includes('revêt')) {
        console.log(`📋 Debug spécial pour piste ${runway.name} avec surface "${runway.surface}"`);
        diagnosticRunwayCompatibility(runway, selectedAircraft);
      }
      
      console.log(`  Piste ${runway.name}: surface=${runway.surface}, compatible=${compatibility.isCompatible}, raison="${compatibility.reason}"`);
      
      return {
        ...runway,
        heading,
        ...windAnalysis,
        compatibility,
        isFavorable: windAnalysis.angleDiff <= 30 && windSpeed > 0,
        score: windAnalysis.headwind - windAnalysis.crosswind
      };
    }).sort((a, b) => b.score - a.score);
  }, [runways, windDirection, windSpeed, selectedAircraft]);
  
  // Debug - afficher dans la console
  console.log(`🛬 Analyse des pistes pour ${icao}:`, {
    vacData: vacChart?.extractedData?.runways,
    openAipData: airport?.runways,
    fallbackData: FALLBACK_RUNWAYS[icao],
    finalRunways: runways,
    dataSource,
    aircraft: selectedAircraft ? {
      registration: selectedAircraft.registration,
      compatibleSurfaces: selectedAircraft.compatibleRunwaySurfaces,
      hasSurfaces: selectedAircraft.compatibleRunwaySurfaces && selectedAircraft.compatibleRunwaySurfaces.length > 0
    } : null
  });
  
  // Debug détaillé des surfaces de pistes
  console.log('📋 Détail des surfaces de pistes:');
  runways.forEach((runway, index) => {
    console.log(`  ${index + 1}. Piste ${runway.name}: surface="${runway.surface || 'non définie'}"`);
  });
  
  // Debug supplémentaire pour les données VAC
  if (dataSource === 'vac') {
    console.log('📋 Données VAC détaillées:', runways);
  }
  
  console.log('🎯 Analyse du vent pour toutes les pistes:', {
    windDirection,
    windSpeed,
    runwayCount: runwayAnalysis ? runwayAnalysis.length : 0,
    results: runwayAnalysis ? runwayAnalysis.map(r => ({
      name: r.name,
      heading: r.heading,
      headwind: r.headwind,
      crosswind: r.crosswind,
      angleDiff: r.angleDiff
    })) : []
  });
  
  // MAINTENANT on peut faire les returns conditionnels
  
  // Si pas d'aérodrome trouvé
  if (!airport) {
    return null;
  }
  
  // Si pas de pistes disponibles
  if (runways.length === 0) {
    return (
      <div style={sx.combine(sx.components.card.base, { borderLeft: '4px solid #f59e0b' })}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2), sx.flex.start)}>
          <Plane size={16} />
          <span style={sx.spacing.ml(1)}>Analyse des pistes - {icao}</span>
        </h4>
        
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.text.sm}>
              Aucune information de piste disponible pour cet aérodrome
            </p>
            <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
              Téléchargez la carte VAC pour obtenir les données précises des pistes
            </p>
          </div>
        </div>
        
        {/* Bouton pour télécharger la VAC */}
        {!vacChart?.isDownloaded && (
          <button
            onClick={() => downloadChart(icao)}
            disabled={isVacDownloading}
            style={sx.combine(
              sx.components.button.base,
              sx.components.button.primary,
              sx.spacing.mt(3),
              isVacDownloading && { opacity: 0.5, cursor: 'not-allowed' }
            )}
          >
            {isVacDownloading ? (
              <>
                <div style={{
                  width: 16,
                  height: 16,
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Téléchargement VAC...
              </>
            ) : (
              <>
                <Download size={16} />
                Télécharger la carte VAC
              </>
            )}
          </button>
        )}
      </div>
    );
  }
  
  // En cours de chargement météo
  if (isLoading) {
    return (
      <div style={sx.combine(sx.components.card.base, { borderLeft: '4px solid #f59e0b' })}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(2), sx.flex.start)}>
          <Plane size={16} />
          <span style={sx.spacing.ml(1)}>Analyse des pistes - {icao}</span>
        </h4>
        <div style={sx.text.center}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={sx.text.secondary}>Chargement de la météo...</p>
        </div>
      </div>
    );
  }
  
  // Pas de météo disponible
  if (!weather || !weather.metar?.decoded) {
    return (
      <div style={sx.combine(sx.components.card.base, { borderLeft: '4px solid #f59e0b' })}>
        <div style={sx.combine(sx.flex.between, sx.spacing.mb(3))}>
          <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.flex.start)}>
            <Plane size={16} />
            <span style={sx.spacing.ml(1)}>Analyse des pistes - {icao}</span>
          </h4>
          <button
            onClick={() => fetchWeather(icao)}
            style={sx.combine(sx.components.button.base, sx.components.button.secondary, { padding: '6px 12px' })}
          >
            <RefreshCw size={14} />
            Charger météo
          </button>
        </div>
        
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning)}>
          <AlertTriangle size={16} />
          <p style={sx.text.sm}>
            Météo non disponible - Impossible d'analyser les pistes
          </p>
        </div>
        
        {/* Afficher quand même les pistes disponibles */}
        <div style={sx.spacing.mt(3)}>
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>
            Pistes disponibles ({dataSource === 'vac' ? 'données VAC' : dataSource === 'openaip' ? 'OpenAIP' : 'base de secours'}) :
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {runways.map(runway => {
              const compatibility = selectedAircraft ? checkRunwayCompatibility(runway, selectedAircraft) : null;
              
              return (
                <span 
                  key={runway.name}
                  style={{
                    padding: '4px 12px',
                    backgroundColor: 
                      compatibility?.isCompatible === false ? '#fee2e2' :
                      dataSource === 'vac' ? '#dcfce7' : 
                      '#f3f4f6',
                    border: 
                      compatibility?.isCompatible === false ? '1px solid #fca5a5' :
                      dataSource === 'vac' ? '1px solid #86efac' : 
                      '1px solid #e5e7eb',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: compatibility?.isCompatible === false ? '#991b1b' : '#374151'
                  }}
                  title={compatibility?.reason || ''}
                >
                  {compatibility?.isCompatible === false && '❌ '}
                  {runway.name}
                  {runway.qfu !== undefined && runway.qfu !== null && ` (QFU ${runway.qfu}°)`}
                  {runway.length && ` • ${runway.length}m`}
                  {runway.surface && ` • ${runway.surface}`}
                </span>
              );
            })}
          </div>
          
          {/* Avertissement si des pistes sont incompatibles */}
          {selectedAircraft && runways.some(r => checkRunwayCompatibility(r, selectedAircraft).isCompatible === false) && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mt(3))}>
              <AlertTriangle size={16} />
              <p style={sx.text.sm}>
                ⚠️ Certaines pistes ne sont pas compatibles avec {selectedAircraft.registration}
              </p>
            </div>
          )}
        </div>
        
        {/* Encourager le téléchargement de la VAC */}
        {!vacChart?.isDownloaded && (
          <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
            <Map size={16} />
            <div>
              <p style={sx.text.sm}>
                <strong>Conseil :</strong> Téléchargez la carte VAC pour obtenir les données exactes des pistes (QFU précis, dimensions, etc.)
              </p>
              <button
                onClick={() => downloadChart(icao)}
                disabled={isVacDownloading}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.primary,
                  sx.spacing.mt(2),
                  { fontSize: '13px', padding: '6px 12px' },
                  isVacDownloading && { opacity: 0.5, cursor: 'not-allowed' }
                )}
              >
                {isVacDownloading ? 'Téléchargement...' : 'Télécharger VAC'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  
  // CAS SPÉCIAL : VENT CALME OU VARIABLE
  if (windSpeed === 0 || windDirection === null) {
    return (
      <div style={sx.combine(sx.components.card.base, { borderLeft: '4px solid #f59e0b' })}>
        <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
          <Plane size={16} />
          <span style={sx.spacing.ml(1)}>Analyse des pistes - {icao}</span>
        </h4>
        
        {/* Badge source de données */}
        <div style={sx.spacing.mb(3)}>
          <span style={{
            padding: '4px 12px',
            backgroundColor: dataSource === 'vac' ? '#dcfce7' : dataSource === 'openaip' ? '#dbeafe' : '#f3f4f6',
            color: dataSource === 'vac' ? '#166534' : dataSource === 'openaip' ? '#1e40af' : '#6b7280',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            {dataSource === 'vac' ? '✅ Données VAC' : dataSource === 'openaip' ? '🌐 Données OpenAIP' : '📋 Données de secours'}
          </span>
        </div>
        
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.success)}>
          <div>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              ✅ Vent calme ou variable
            </p>
            <p style={sx.text.xs}>
              Toutes les pistes sont utilisables - Choisir selon la procédure locale
            </p>
          </div>
        </div>
        
        {/* Liste des pistes */}
        <div style={sx.spacing.mt(3)}>
          <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>
            Pistes disponibles :
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {runways.map(runway => {
              const compatibility = selectedAircraft ? checkRunwayCompatibility(runway, selectedAircraft) : null;
              
              return (
                <span 
                  key={runway.name}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 
                      compatibility?.isCompatible === false ? '#fee2e2' :
                      compatibility?.isCompatible === true ? '#dcfce7' :
                      '#f3f4f6',
                    border: 
                      compatibility?.isCompatible === false ? '1px solid #fca5a5' :
                      compatibility?.isCompatible === true ? '1px solid #86efac' :
                      '1px solid #e5e7eb',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: 
                      compatibility?.isCompatible === false ? '#991b1b' :
                      compatibility?.isCompatible === true ? '#166534' :
                      '#374151'
                  }}
                  title={compatibility?.reason || ''}
                >
                  {compatibility?.isCompatible === false && '❌ '}
                  {runway.name}
                  {runway.qfu !== undefined && runway.qfu !== null && ` (QFU ${runway.qfu}°)`}
                  {runway.length && ` • ${runway.length}m`}
                  {runway.surface && ` • ${runway.surface}`}
                </span>
              );
            })}
          </div>
          
          {/* Avertissement si des pistes sont incompatibles */}
          {selectedAircraft && runways.some(r => checkRunwayCompatibility(r, selectedAircraft).isCompatible === false) && (
            <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mt(3))}>
              <AlertTriangle size={16} />
              <p style={sx.text.sm}>
                ⚠️ Certaines pistes ne sont pas compatibles avec {selectedAircraft.registration}
              </p>
            </div>
          )}
        </div>
        
        {/* Encourager le téléchargement de la VAC si pas déjà fait */}
        {!vacChart?.isDownloaded && (
          <div style={sx.combine(sx.spacing.mt(3), sx.text.xs, sx.text.secondary, sx.text.center)}>
            <button
              onClick={() => downloadChart(icao)}
              disabled={isVacDownloading}
              style={{
                color: '#3b82f6',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Télécharger la carte VAC pour des données plus précises
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // CAS NORMAL : VENT PRÉSENT
  return (
    <div style={sx.combine(sx.components.card.base, { borderLeft: '4px solid #f59e0b' })}>
      <h4 style={sx.combine(sx.text.base, sx.text.bold, sx.spacing.mb(3), sx.flex.start)}>
        <Plane size={16} />
        <span style={sx.spacing.ml(1)}>Analyse des pistes - {icao}</span>
      </h4>
      
      {/* Avertissement général si des incompatibilités sont détectées */}
      {runwayAnalysis && runwayAnalysis.some(r => r.compatibility && r.compatibility.isCompatible === false) && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(3))}>
          <AlertTriangle size={16} />
          <div>
            <p style={sx.combine(sx.text.sm, sx.text.bold)}>
              ⚠️ Incompatibilité détectée avec le type de piste
            </p>
            <p style={sx.text.xs}>
              {selectedAircraft.registration} n'est pas configuré pour opérer sur certaines surfaces disponibles à {icao}
            </p>
          </div>
        </div>
      )}
      
      {/* Badge source de données */}
      <div style={sx.spacing.mb(3)}>
        <span style={{
          padding: '4px 12px',
          backgroundColor: dataSource === 'vac' ? '#dcfce7' : dataSource === 'openaip' ? '#dbeafe' : '#f3f4f6',
          color: dataSource === 'vac' ? '#166534' : dataSource === 'openaip' ? '#1e40af' : '#6b7280',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {dataSource === 'vac' ? '✅ Données VAC précises' : dataSource === 'openaip' ? '🌐 Données OpenAIP' : '📋 Données de secours'}
        </span>
      </div>
      
      {/* Conditions de vent actuelles */}
      <div style={sx.combine(sx.flex.row, sx.spacing.gap(3), sx.spacing.mb(3))}>
        <div style={sx.combine(sx.flex.start, sx.text.sm)}>
          <Wind size={16} style={{ color: '#3b82f6' }} />
          <span style={sx.spacing.ml(1)}>
            Vent : <strong>{windDirection || 'Variable'}° / {windSpeed}kt</strong>
            {weather?.metar?.decoded?.wind?.gust && <span style={{ color: '#f59e0b' }}> (rafales {weather.metar.decoded.wind.gust}kt)</span>}
          </span>
        </div>
      </div>
      
      {/* Piste recommandée ou avertissement */}
      {windSpeed > 0 && (
        (() => {
          // Trouver la meilleure piste compatible
          const compatibleRunways = runwayAnalysis.filter(r => r.compatibility?.isCompatible !== false);
          const bestRunway = compatibleRunways[0];
          const hasIncompatibleRunways = runwayAnalysis.some(r => r.compatibility?.isCompatible === false);
          
          if (!bestRunway) {
            return (
              <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(3))}>
                <AlertTriangle size={16} />
                <div>
                  <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                    ❌ Aucune piste compatible disponible
                  </p>
                  <p style={sx.text.xs}>
                    L'avion {selectedAircraft.registration} n'est pas configuré pour les types de pistes disponibles à {icao}
                  </p>
                </div>
              </div>
            );
          }
          
          return (
            <>
              {bestRunway.isFavorable ? (
                <div style={sx.combine(sx.components.alert.base, sx.components.alert.success, sx.spacing.mb(3))}>
                  <div>
                    <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                      ✅ Piste recommandée : {bestRunway.name}
                    </p>
                    <p style={sx.text.xs}>
                      {bestRunway.headwind >= 0 ? 'Vent de face' : (
                        <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ Vent arrière</span>
                      )} : {Math.abs(bestRunway.headwind)}kt
                      {bestRunway.crosswind > 0 && ` • Vent traversier : ${bestRunway.crosswind}kt`}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={sx.combine(sx.components.alert.base, sx.components.alert.warning, sx.spacing.mb(3))}>
                  <AlertTriangle size={16} />
                  <div>
                    <p style={sx.combine(sx.text.sm, sx.text.bold)}>
                      ⚠️ Vent traversier sur toutes les pistes compatibles
                    </p>
                    <p style={sx.text.xs}>
                      Meilleure option : {bestRunway.name} (écart {bestRunway.angleDiff}°)
                    </p>
                  </div>
                </div>
              )}
              
              {hasIncompatibleRunways && (
                <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
                  <Info size={16} />
                  <p style={sx.text.sm}>
                    💡 Note : Certaines pistes ne sont pas compatibles avec votre avion et ne sont pas recommandées
                  </p>
                </div>
              )}
            </>
          );
        })()
      )}
      
      {/* Analyse détaillée de toutes les pistes */}
      <div>
        <p style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.mb(2))}>
          Analyse détaillée :
        </p>
        
        {/* Explication de la méthode de calcul */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '12px',
          fontSize: '12px'
        }}>
          <strong>📐 Méthode de calcul :</strong>
          <div style={{ marginTop: '4px', lineHeight: '1.6' }}>
            • Le vent vient <strong>DE</strong> la direction indiquée (ex: 340° = vent du nord-ouest)<br/>
            • Pour chaque piste, on calcule l'angle avec la direction idéale du vent de face<br/>
            • Vent de face = cos(angle) × vitesse | Vent traversier = sin(angle) × vitesse<br/>
            • <span style={{ color: '#dc2626' }}>Fond rouge</span> = vent arrière (à éviter)
          </div>
          <div style={{ 
            marginTop: '8px', 
            paddingTop: '8px', 
            borderTop: '1px solid #93c5fd',
            fontSize: '11px',
            fontStyle: 'italic'
          }}>
            <strong>Exemple :</strong> Vent 340°/11kt sur piste 12 (QFU 120°)<br/>
            → Vent de face parfait viendrait du 300° (120° + 180°)<br/>
            → Angle : 340° - 300° = 40°<br/>
            → Vent de face = cos(40°) × 11 = 8kt | Traversier = sin(40°) × 11 = 7kt
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {runwayAnalysis.map((runway, index) => (
            <div 
              key={`${runway.name}-${index}`}
              style={{
                padding: '12px',
                backgroundColor: runway.headwind < 0 ? '#fee2e2' : (index === 0 && runway.compatibility?.isCompatible !== false ? '#f0fdf4' : '#f9fafb'),
                borderRadius: '6px',
                border: runway.headwind < 0 ? '1px solid #fca5a5' : 
                       runway.compatibility?.isCompatible === false ? '2px solid #dc2626' :
                       (index === 0 ? '1px solid #86efac' : '1px solid #e5e7eb')
              }}
            >
              <div style={sx.combine(sx.flex.between, sx.spacing.mb(2))}>
                <div>
                  <span style={sx.combine(sx.text.base, sx.text.bold)}>
                    Piste {runway.name}
                  </span>
                  <span style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.ml(2))}>
                    (QFU {runway.heading}°)
                  </span>
                  {runway.length && (
                    <span style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.ml(2))}>
                      {runway.length}m
                    </span>
                  )}
                  {runway.width && dataSource === 'vac' && (
                    <span style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.ml(1))}>
                      × {runway.width}m
                    </span>
                  )}
                  {runway.surface && dataSource === 'vac' && (
                    <span style={sx.combine(sx.text.sm, sx.text.secondary, sx.spacing.ml(2))}>
                      • {runway.surface}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Indicateur de compatibilité */}
                  {runway.compatibility && (
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: 
                        runway.compatibility.isCompatible === true ? '#dcfce7' :
                        runway.compatibility.isCompatible === false ? '#fee2e2' :
                        '#fef3c7',
                      color: 
                        runway.compatibility.isCompatible === true ? '#166534' :
                        runway.compatibility.isCompatible === false ? '#991b1b' :
                        '#92400e'
                    }}>
                      {runway.compatibility.isCompatible === true ? '✅ Compatible' :
                       runway.compatibility.isCompatible === false ? '❌ Incompatible' :
                       '❓ Type inconnu'}
                    </span>
                  )}
                  {!runway.isFavorable && windSpeed > 0 && (
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: '#fef3c7',
                      color: '#92400e'
                    }}>
                      ⚠ Écart {runway.angleDiff}°
                    </span>
                  )}
                </div>
              </div>
              
              {/* Avertissement détaillé si incompatible */}
              {runway.compatibility?.isCompatible === false && (
                <div style={sx.combine(sx.components.alert.base, sx.components.alert.danger, sx.spacing.mb(2), { padding: '8px 12px' })}>
                  <AlertTriangle size={14} />
                  <p style={{ fontSize: '12px' }}>
                    {selectedAircraft.registration} n'est pas configuré pour les pistes en {getSurfaceName(runway.compatibility.surface)}
                  </p>
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={sx.combine(sx.text.sm)}>
                  <span style={{ color: runway.headwind >= 0 ? '#16a34a' : '#dc2626' }}>
                    {runway.headwind >= 0 ? '↑' : '↓'}
                  </span>
                  {' '}Vent {runway.headwind >= 0 ? 'de face' : (
                    <span style={{ color: '#dc2626', fontWeight: 'bold' }}>arrière</span>
                  )} : 
                  <strong style={{ color: runway.headwind < 0 ? '#dc2626' : 'inherit' }}>
                    {' '}{Math.abs(runway.headwind)}kt
                  </strong>
                </div>
                {runway.crosswind > 0 && (
                  <div style={sx.combine(sx.text.sm)}>
                    <span style={{ color: '#f59e0b' }}>→</span>
                    {' '}Vent traversier : 
                    <strong> {runway.crosswind}kt</strong>
                  </div>
                )}
              </div>
              
              {/* Détail du calcul */}
              <details style={{ marginTop: '8px' }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontSize: '11px', 
                  color: '#6b7280',
                  userSelect: 'none'
                }}>
                  Voir le détail du calcul
                </summary>
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '4px',
                  fontSize: '11px',
                  lineHeight: '1.5'
                }}>
                  {(() => {
                    const perfectHeadwindDir = (runway.heading + 180) % 360;
                    let angleFromPerfect = (windDirection || 0) - perfectHeadwindDir;
                    if (angleFromPerfect > 180) angleFromPerfect -= 360;
                    if (angleFromPerfect < -180) angleFromPerfect += 360;
                    const absAngle = Math.abs(angleFromPerfect);
                    const ws = windSpeed || 0;
                    
                    return (
                      <>
                        <div>• Vent de : <strong>{windDirection || 'N/A'}°</strong> à <strong>{ws}kt</strong></div>
                        <div>• Cap piste : <strong>{runway.heading}°</strong></div>
                        <div>• Vent de face parfait viendrait du : <strong>{perfectHeadwindDir}°</strong></div>
                        <div>• Angle avec vent de face parfait : <strong>{absAngle}°</strong></div>
                        <div style={{ marginTop: '4px' }}>
                          <strong>Calcul :</strong><br/>
                          • Vent de face = cos({absAngle}°) × {ws}kt = <strong>{runway.headwind || 0}kt</strong><br/>
                          • Vent traversier = sin({absAngle}°) × {ws}kt = <strong>{runway.crosswind || 0}kt</strong>
                        </div>
                        {runway.headwind < 0 && (
                          <div style={{ marginTop: '4px', color: '#dc2626' }}>
                            ⚠️ Angle {'>'} 90° = composante de vent arrière
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
      
      {/* Note sur la source des données */}
      {dataSource !== 'vac' && (
        <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mt(3))}>
          <Info size={16} />
          <div>
            <p style={sx.text.sm}>
              <strong>💡 Astuce :</strong> Pour des données de pistes plus précises (QFU exact, dimensions, surface), 
              téléchargez la carte VAC depuis l'onglet "Cartes VAC".
            </p>
            {!vacChart?.isDownloaded && (
              <button
                onClick={() => downloadChart(icao)}
                disabled={isVacDownloading}
                style={sx.combine(
                  sx.components.button.base,
                  sx.components.button.primary,
                  sx.spacing.mt(2),
                  { fontSize: '13px', padding: '6px 12px' },
                  isVacDownloading && { opacity: 0.5, cursor: 'not-allowed' }
                )}
              >
                {isVacDownloading ? 'Téléchargement...' : 'Aller télécharger la VAC'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

RunwayAnalyzer.displayName = 'RunwayAnalyzer';

export default RunwayAnalyzer;