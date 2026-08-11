import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-polylinedecorator';
import { useNavigation } from '@core/contexts';
import { calculateBearing, calculateDistance, calculateDestination, calculateMidpoint } from '@utils/navigationCalculations';
import { getDeclination, trueToMagnetic } from '@utils/magneticDeclination';
import { useWindsAloftStore } from '@core/stores/windsAloftStore';
import { solveWindTriangle } from '@utils/windTriangle';
import { getCruiseSpeedKt } from '@utils/aircraftPerf';

// Fonction pour appliquer un offset perpendiculaire à une ligne
// Cela permet de séparer visuellement les lignes qui se superposent
const applyPerpendicularOffset = (coordinates, offsetMeters = 50) => {
  if (coordinates.length < 2) return coordinates;

  const offsetCoords = [];

  for (let i = 0; i < coordinates.length; i++) {
    const [lat, lon] = coordinates[i];

    // Calculer la direction perpendiculaire
    let perpLat, perpLon;

    if (i === 0) {
      // Premier point : utiliser la direction vers le point suivant
      const [nextLat, nextLon] = coordinates[i + 1];
      const deltaLat = nextLat - lat;
      const deltaLon = nextLon - lon;
      perpLat = -deltaLon;
      perpLon = deltaLat;
    } else if (i === coordinates.length - 1) {
      // Dernier point : utiliser la direction depuis le point précédent
      const [prevLat, prevLon] = coordinates[i - 1];
      const deltaLat = lat - prevLat;
      const deltaLon = lon - prevLon;
      perpLat = -deltaLon;
      perpLon = deltaLat;
    } else {
      // Points intermédiaires : moyenne des deux directions
      const [prevLat, prevLon] = coordinates[i - 1];
      const [nextLat, nextLon] = coordinates[i + 1];
      const deltaLat1 = lat - prevLat;
      const deltaLon1 = lon - prevLon;
      const deltaLat2 = nextLat - lat;
      const deltaLon2 = nextLon - lon;
      perpLat = -(deltaLon1 + deltaLon2) / 2;
      perpLon = (deltaLat1 + deltaLat2) / 2;
    }

    // Normaliser et appliquer l'offset
    const length = Math.sqrt(perpLat * perpLat + perpLon * perpLon);
    if (length > 0) {
      // Convertir les mètres en degrés (approximation)
      const metersToDegreesLat = offsetMeters / 111000; // 1 degré ≈ 111 km
      const metersToDegreesLon = offsetMeters / (111000 * Math.cos(lat * Math.PI / 180));

      const normPerpLat = (perpLat / length) * metersToDegreesLat;
      const normPerpLon = (perpLon / length) * metersToDegreesLon;

      offsetCoords.push([lat + normPerpLat, lon + normPerpLon]);
    } else {
      offsetCoords.push([lat, lon]);
    }
  }

  return offsetCoords;
};

// Composant pour forcer le recalcul de la taille de la carte
// Utile quand la carte est dans une section collapsible
const MapSizeInvalidator = () => {
  const map = useMap();

  useEffect(() => {
    // Fonction pour invalider la taille
    const invalidate = () => {
      try {
        map.invalidateSize({ pan: false });
      } catch (e) {
        console.warn('Map invalidateSize error:', e);
      }
    };

    // Invalider immédiatement et de manière répétée
    invalidate();
    const timer1 = setTimeout(invalidate, 100);
    const timer2 = setTimeout(invalidate, 300);
    const timer3 = setTimeout(invalidate, 500);
    const timer4 = setTimeout(invalidate, 1000);
    const timer5 = setTimeout(invalidate, 2000);

    // Invalider sur resize de la fenêtre
    const handleResize = () => invalidate();
    window.addEventListener('resize', handleResize);

    // Observer pour détecter changements de visibilité
    const container = map.getContainer();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          invalidate();
          setTimeout(invalidate, 100);
        }
      });
    });

    if (container) {
      observer.observe(container);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [map]);

  return null;
};

// Composant pour ajuster automatiquement la vue de la carte
const MapBoundsUpdater = ({ waypoints }) => {
  const map = useMap();

  useEffect(() => {
    if (waypoints && waypoints.length > 0) {
      const bounds = waypoints
        .filter(wp => wp.lat && wp.lon)
        .map(wp => [wp.lat, wp.lon]);

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    }
  }, [waypoints, map]);

  return null;
};

// Composant pour ajouter des flèches sur les polylines avec polylineDecorator
const PolylineWithArrows = ({ positions, color, weight, opacity, dashArray, isReturn }) => {
  const map = useMap();
  const polylineRef = useRef(null);
  const decoratorRef = useRef(null);

  useEffect(() => {
    if (!map || !positions || positions.length < 2) return;

    // Créer la polyline
    const polyline = L.polyline(positions, {
      color: color,
      weight: weight,
      opacity: opacity,
      dashArray: dashArray
    }).addTo(map);

    polylineRef.current = polyline;

    // Ajouter des flèches avec polylineDecorator
    const decorator = L.polylineDecorator(polyline, {
      patterns: [
        {
          offset: '50%',
          repeat: 150, // Distance en pixels entre les flèches
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: false,
            // 🔧 LOT 10-A — fill:false : avec polygon:false, le remplissage
            // fermait le chevron en « pilule » orange sur chaque tronçon
            pathOptions: {
              stroke: true,
              color: color,
              weight: 2,
              opacity: opacity,
              fill: false
            }
          })
        }
      ]
    }).addTo(map);

    decoratorRef.current = decorator;

    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
      }
      if (decoratorRef.current) {
        map.removeLayer(decoratorRef.current);
      }
    };
  }, [map, positions, color, weight, opacity, dashArray]);

  return null;
};

/**
 * Calcule la position géographique du point TOD sur la trajectoire
 * @param {Object} arrival - Waypoint d'arrivée
 * @param {number} distanceToTodNM - Distance du TOD en NM avant l'arrivée
 * @param {Array} waypoints - Tous les waypoints de la route
 * @returns {Object|null} - {lat, lon} du point TOD
 */
function calculateTodPosition(arrival, distanceToTodNM, waypoints) {
  if (!arrival || !distanceToTodNM || distanceToTodNM <= 0 || !waypoints || waypoints.length < 2) {
    return null;
  }

  // Convertir NM en km
  const distanceToTodKM = distanceToTodNM * 1.852;

  // Parcourir la route en sens inverse depuis l'arrivée
  let remainingDistance = distanceToTodKM;

  for (let i = waypoints.length - 1; i > 0; i--) {
    const to = waypoints[i];
    const from = waypoints[i - 1];

    if (!to.lat || !to.lon || !from.lat || !from.lon) continue;

    // Calculer la distance de ce segment
    const segmentDistance = calculateDistanceKM(from.lat, from.lon, to.lat, to.lon);

    if (remainingDistance <= segmentDistance) {
      // Le point TOD est sur ce segment
      const ratio = remainingDistance / segmentDistance;

      // Interpolation linéaire
      const todLat = to.lat - (to.lat - from.lat) * ratio;
      const todLon = to.lon - (to.lon - from.lon) * ratio;

      return { lat: todLat, lon: todLon };
    }

    remainingDistance -= segmentDistance;
  }

  // Si on arrive ici, le TOD est avant le premier waypoint
  return null;
}

/**
 * Calcule la distance entre deux points en km
 */
function calculateDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Composant de carte interactive pour la planification de route
 * Affiche les waypoints de navigation et les points VFR sélectionnés
 */
export const RouteMapView = ({ vfrPoints = [], flightPlan = null, todCalculation = null }) => {
  console.log('🗺️🗺️🗺️ RouteMapView MONTÉ - Début du composant');

  // Récupérer les waypoints depuis le NavigationContext (source de vérité)
  const navigation = useNavigation();
  console.log('🗺️ Navigation context:', navigation);
  const waypoints = navigation?.waypoints || [];
  console.log('🗺️ Waypoints bruts:', waypoints);

  const [center, setCenter] = useState([48.8566, 2.3522]); // Paris par défaut
  const [zoom] = useState(6);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [todPoint, setTodPoint] = useState(null);

  console.log('🗺️ isInitialLoad initial:', isInitialLoad);

  // Les waypoints du NavigationContext incluent déjà départ, arrivée et points intermédiaires
  // Structure: { id, name, lat, lon, type, icao, ... }
  // Filtrer seulement les waypoints avec coordonnées valides
  // Utilisation de useMemo pour éviter une boucle infinie dans le useEffect ligne 285
  const validWaypoints = React.useMemo(() => {
    return (waypoints || []).filter(wp => wp.lat && wp.lon);
  }, [waypoints]);

  // Attendre un court délai pour laisser le temps aux données de charger depuis localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 500); // 500ms de délai pour la restauration du localStorage
    return () => clearTimeout(timer);
  }, []);

  // Si des waypoints valides sont trouvés, terminer le chargement immédiatement
  useEffect(() => {
    if (validWaypoints.length > 0 && isInitialLoad) {
      console.log('🗺️ Waypoints détectés, fin du chargement prématurée');
      setIsInitialLoad(false);
    }
  }, [validWaypoints.length, isInitialLoad]);

  // Debug: afficher les waypoints disponibles
  useEffect(() => {
    console.log('🗺️ RouteMapView - isInitialLoad:', isInitialLoad);
    console.log('🗺️ RouteMapView - Waypoints totaux:', waypoints?.length || 0);
    console.log('🗺️ RouteMapView - Waypoints valides (avec coords):', validWaypoints.length);

    // DIAGNOSTIC COMPLET : Afficher TOUS les waypoints avec leur type
    console.log('🗺️ === DIAGNOSTIC WAYPOINTS ===');
    waypoints?.forEach((wp, idx) => {
      console.log(`  [${idx}] ${wp.name || wp.icao || 'VIDE'} - type: "${wp.type}" - coords: ${wp.lat ? 'OUI' : 'NON'}`);
    });
    console.log('🗺️ === FIN DIAGNOSTIC ===');
  }, [waypoints, validWaypoints.length, isInitialLoad]);

  // Identifier le départ et l'arrivée PAR TYPE (pas par position)
  const departure = validWaypoints.find(wp => wp.type === 'departure') || null;
  const arrival = validWaypoints.find(wp => wp.type === 'arrival') || null;

  // Les waypoints intermédiaires sont tous ceux qui ne sont ni départ ni arrivée
  const intermediateWaypoints = validWaypoints.filter(
    wp => wp.type !== 'departure' && wp.type !== 'arrival'
  );

  // Debug: afficher les coordonnées
  useEffect(() => {
    if (departure) {
      console.log('🛫 Départ (type):', departure.type, '-', departure.name || departure.icao, 'lat:', departure.lat, 'lon:', departure.lon);
    }
    if (arrival) {
      console.log('🛬 Arrivée (type):', arrival.type, '-', arrival.name || arrival.icao, 'lat:', arrival.lat, 'lon:', arrival.lon);
    }
    if (intermediateWaypoints.length > 0) {
      console.log('📍 Waypoints intermédiaires:', intermediateWaypoints.length);
      intermediateWaypoints.forEach((wp, idx) => {
        console.log(`  - WP ${idx + 1} (type: ${wp.type}):`, wp.name || wp.icao, 'lat:', wp.lat, 'lon:', wp.lon);
      });
    }
  }, [departure, arrival, intermediateWaypoints.length]);

  // Préparer les coordonnées pour la ligne de route
  const routeCoordinates = validWaypoints.map(wp => [wp.lat, wp.lon]);

  // ─── LOT 6-A : tracé « au cap magnétique » (pédagogique) ─────────────────
  // À partir du départ, chaque segment est retracé en suivant le CHIFFRE du
  // CAP MAGNÉTIQUE (cap vrai − déclinaison WMM au milieu du segment) comme
  // s'il était un cap VRAI (référence GPS/track), sur la même distance, en
  // CHAÎNAGE CUMULATIF : l'écart de déclinaison s'accumule et le tracé dévie
  // vers l'OUEST de la route pour une déclinaison Est — visualisation de
  // l'écart vrai/magnétique le long de la navigation. Positions mémoïsées
  // (PolylineWithArrows recrée ses layers quand `positions` change de réf.).
  const magneticTrace = useMemo(() => {
    if (validWaypoints.length < 2) return { positions: [], available: false };
    const date = flightPlan?.generalInfo?.date ? new Date(flightPlan.generalInfo.date) : new Date();
    const positions = [[validWaypoints[0].lat, validWaypoints[0].lon]];
    let anchor = { lat: validWaypoints[0].lat, lon: validWaypoints[0].lon };
    let anyDeclination = false;
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const from = validWaypoints[i];
      const to = validWaypoints[i + 1];
      const trueCourse = calculateBearing(from.lat, from.lon, to.lat, to.lon);
      const distanceNM = calculateDistance(from.lat, from.lon, to.lat, to.lon);
      const mid = calculateMidpoint({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });
      const declination = getDeclination(mid.lat, mid.lon, date);
      const course = declination == null ? trueCourse : trueToMagnetic(trueCourse, declination);
      if (declination != null) anyDeclination = true;
      anchor = calculateDestination(anchor, distanceNM, course);
      positions.push([anchor.lat, anchor.lon]);
    }
    // Sans aucune déclinaison calculable (échec WMM), le tracé serait identique
    // à la route : ne rien afficher plutôt qu'un doublon trompeur.
    return { positions, available: anyDeclination };
  }, [validWaypoints, flightPlan?.generalInfo?.date]);

  // ─── LOT 6-B : tracé « cap corrigé du vent » (bleu, tirets courts) ───────
  // PAR SEGMENT, ré-ancré à chaque waypoint réel : depuis chaque waypoint, on
  // trace l'orientation du NEZ de l'avion (cap vrai + dérive = le « crabe »)
  // sur la distance du segment — l'écart visuel avec la route montre la
  // correction de dérive à tenir. Vent : manuel > profils Open-Meteo en cache.
  const windsProfiles = useWindsAloftStore(state => state.profiles);
  const manualWind = useWindsAloftStore(state => state.manualWind);
  const ensureWindProfiles = useWindsAloftStore(state => state.ensureProfiles);

  useEffect(() => {
    if (validWaypoints.length < 2) return;
    const mids = [];
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      mids.push(calculateMidpoint(
        { lat: validWaypoints[i].lat, lon: validWaypoints[i].lon },
        { lat: validWaypoints[i + 1].lat, lon: validWaypoints[i + 1].lon }
      ));
    }
    ensureWindProfiles(mids);
  }, [validWaypoints, ensureWindProfiles]);

  const windTrace = useMemo(() => {
    const tas = getCruiseSpeedKt(flightPlan?.aircraft);
    if (validWaypoints.length < 2 || !tas) return { segments: [], available: false, source: null };
    const store = useWindsAloftStore.getState();
    const segments = [];
    let source = null;
    // 🔧 REVUE LOT 7 — vent à la DATE DU VOL (cohérent avec le tableau de
    // navigation et les cartouches), pas au moment du rendu
    const flightDateForWind = flightPlan?.generalInfo?.date ? new Date(flightPlan.generalInfo.date) : new Date();
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const from = validWaypoints[i];
      const to = validWaypoints[i + 1];
      const mid = calculateMidpoint({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });
      // Altitude de référence : 3000 ft (altitude VFR par défaut du projet) —
      // l'altitude par segment fine vit dans le tableau de navigation.
      const wind = store.getWindAt(mid.lat, mid.lon, 3000, flightDateForWind);
      if (!wind || !(wind.speedKt > 0)) continue;
      const trueCourse = calculateBearing(from.lat, from.lon, to.lat, to.lon);
      const distanceNM = calculateDistance(from.lat, from.lon, to.lat, to.lon);
      const tri = solveWindTriangle(trueCourse, tas, wind.directionDeg, wind.speedKt);
      if (!tri || tri.windCorrectionAngle === 0) continue;
      const end = calculateDestination({ lat: from.lat, lon: from.lon }, distanceNM, tri.headingTrue);
      segments.push([[from.lat, from.lon], [end.lat, end.lon]]);
      source = wind.source;
    }
    return { segments, available: segments.length > 0, source };
  }, [validWaypoints, windsProfiles, manualWind, flightPlan?.aircraft, flightPlan?.generalInfo?.date]);

  // ─── LOT 7 — étiquettes de cap PAR TRONÇON DROIT ─────────────────────────
  // À chaque changement de cap (= chaque segment), un cartouche à côté du
  // trait : Rte (route vraie), Mag (cap magnétique, déclinaison WMM) et Vent
  // (correction de dérive signée). Fail-closed : ligne omise/« — » sans donnée.
  const segmentCapLabels = useMemo(() => {
    if (validWaypoints.length < 2) return [];
    const date = flightPlan?.generalInfo?.date ? new Date(flightPlan.generalInfo.date) : new Date();
    const tas = getCruiseSpeedKt(flightPlan?.aircraft);
    const store = useWindsAloftStore.getState();
    const labels = [];
    // Aller-retour A→B→A : les deux segments ont le MÊME milieu — le second
    // cartouche prend le côté OPPOSÉ au premier pour rester lisible (revue lot 7)
    const seenMids = new Map(); // midKey → below (côté pris au premier passage)
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const from = validWaypoints[i];
      const to = validWaypoints[i + 1];
      const trueCourse = calculateBearing(from.lat, from.lon, to.lat, to.lon);
      const mid = calculateMidpoint({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });
      const midKey = `${mid.lat.toFixed(6)},${mid.lon.toFixed(6)}`;
      // 🔧 LOT 10-B — anti-chevauchement : alternance dessus/dessous par parité
      // de segment (deux cartouches voisins ne sont jamais du même côté du
      // trait) ; si milieux identiques (aller-retour), le second passage prend
      // le côté OPPOSÉ à celui mémorisé au premier passage — « toujours
      // dessous » superposait deux cartouches quand le 1er passage était un
      // segment impair (ex. A→B→C→B→A, segments B→C et C→B)
      const below = seenMids.has(midKey) ? !seenMids.get(midKey) : (i % 2 === 1);
      seenMids.set(midKey, below);
      const declination = getDeclination(mid.lat, mid.lon, date);
      const magCourse = declination == null ? null : Math.round(trueToMagnetic(trueCourse, declination)) % 360;
      let wca = null;
      if (tas) {
        // Vent à la DATE DU VOL (même référence que le tableau de navigation),
        // pas au moment du rendu
        const wind = store.getWindAt(mid.lat, mid.lon, 3000, date);
        if (wind && wind.speedKt > 0) {
          const tri = solveWindTriangle(trueCourse, tas, wind.directionDeg, wind.speedKt);
          if (tri) wca = Math.round(tri.windCorrectionAngle);
        }
      }
      // Échappement HTML : les noms de waypoints sont saisis par l'utilisateur
      // et injectés dans le HTML du divIcon Leaflet
      const esc = (s) => String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
      labels.push({
        position: [mid.lat, mid.lon],
        legLabel: `${esc(from.icao || from.name || `WP${i + 1}`)} → ${esc(to.icao || to.name || `WP${i + 2}`)}`,
        below,
        trueCourse: Math.round(trueCourse) % 360,
        magCourse,
        wca
      });
    }
    return labels;
  }, [validWaypoints, flightPlan?.generalInfo?.date, flightPlan?.aircraft, windsProfiles, manualWind]);

  // 🛬 Calculer le point de TOD si les données sont disponibles
  useEffect(() => {
    if (todCalculation && !todCalculation.error && arrival && validWaypoints.length >= 2) {
      const distanceToTodNM = parseFloat(todCalculation.distanceToTod);

      if (distanceToTodNM > 0) {
        console.log('🛬 Calcul position TOD:', {
          distanceToTodNM,
          arrivalName: arrival.name || arrival.icao,
          waypointsCount: validWaypoints.length
        });

        const todPosition = calculateTodPosition(arrival, distanceToTodNM, validWaypoints);

        if (todPosition) {
          setTodPoint({
            ...todPosition,
            distanceToTod: distanceToTodNM,
            arrivalName: arrival.name || arrival.icao,
            cruiseAltitude: todCalculation.cruiseAltitude,
            targetAltitude: todCalculation.targetAltitude,
            descentRate: todCalculation.descentRate
          });
          console.log('✅ Point TOD calculé:', todPosition);
        } else {
          console.warn('⚠️ Impossible de calculer la position TOD');
          setTodPoint(null);
        }
      } else {
        setTodPoint(null);
      }
    } else {
      setTodPoint(null);
    }
  }, [todCalculation, arrival, validWaypoints]);

  // Calculer les positions des flèches le long de la route
  const arrowMarkers = useMemo(() => {
    if (routeCoordinates.length < 2) return [];

    const markers = [];

    // Placer une flèche au milieu de chaque segment
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const [lat1, lon1] = routeCoordinates[i];
      const [lat2, lon2] = routeCoordinates[i + 1];

      // Point au milieu du segment
      const midLat = (lat1 + lat2) / 2;
      const midLon = (lon1 + lon2) / 2;

      // Calculer l'angle de rotation pour la flèche
      const angle = Math.atan2(lon2 - lon1, lat2 - lat1) * (180 / Math.PI);

      markers.push({
        position: [midLat, midLon],
        angle: angle,
        segmentIndex: i
      });
    }

    return markers;
  }, [routeCoordinates]);

  // Afficher un loader pendant le chargement initial
  if (isInitialLoad) {
    return (
      <div style={{
        height: '500px',
        width: '100%',
        borderRadius: 'var(--radius-sm)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--fs-body)'
      }}>
        🗺️ Chargement de la carte...
      </div>
    );
  }

  // Afficher un message si aucun aérodrome n'est défini (après le chargement initial)
  if (!departure && !arrival) {
    return (
      <div style={{
        height: '500px',
        width: '100%',
        borderRadius: 'var(--radius-sm)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-overlay)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--fs-body)',
        fontStyle: 'italic'
      }}>
        📍 Ajoutez des aérodromes de départ et d'arrivée dans le module de navigation ci-dessous
      </div>
    );
  }

  return (
    <>
      {/* 🔧 LOT 3 : l'ancien bloc @media print (800px) était MORT — le PDF est
          une capture html2canvas, jamais une impression. La hauteur et les
          protections de la carte dans le PDF sont désormais dans
          src/styles/pdf-capture.css (scope .html2pdf__container). */}
      <style>{`
        @media screen {
          .route-map-container {
            min-height: 500px !important;
          }
          .route-map-container .leaflet-container {
            min-height: 500px !important;
          }
        }
      `}</style>

      {/* 🔧 LOT 6-B : disclaimer vent CONDITIONNEL — avertissement tant
          qu'aucun vent n'est disponible, provenance honnête sinon. Affiché à
          l'étape Carte, sur la synthèse et dans le PDF. */}
      {windTrace.available ? (
        <div
          className="nav-wind-disclaimer"
          style={{
            backgroundColor: 'var(--bg-overlay)',
            border: '1px solid var(--border-subtle)',
            borderLeft: '6px solid #2196f3',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            marginBottom: '12px',
            fontSize: 'var(--fs-caption)',
            color: 'var(--text-primary)',
            fontWeight: 500
          }}
        >
          ℹ️ Caps et temps par segment corrigés du vent
          ({windTrace.source === 'manual' ? 'vent saisi manuellement' : 'vents en altitude Open-Meteo'}) —
          voir le tableau de navigation. Le temps total de la synthèse reste basé
          sur la vitesse de croisière sans vent.
        </div>
      ) : (
        <div
          className="nav-wind-disclaimer"
          style={{
            backgroundColor: 'rgba(242, 105, 33, 0.10)',
            border: '1px solid var(--accent-primary)',
            borderLeft: '6px solid var(--accent-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            marginBottom: '12px',
            fontSize: 'var(--fs-caption)',
            color: 'var(--text-primary)',
            fontWeight: 500
          }}
        >
          ⚠️ Tracés de la carte non corrigés du vent (vents en altitude
          indisponibles). Les temps du tableau de navigation utilisent le
          meilleur vent disponible par segment (altitude, METAR sol ou manuel),
          le cas échéant.
        </div>
      )}

      <div
        className="route-map-container"
        style={{ position: 'relative', height: '500px', width: '100%', borderRadius: 'var(--radius-sm)', overflow: 'hidden', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-subtle)' }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          zoomControl={false}
          attributionControl={false}
        >
        {/* Couche de tuiles OpenStreetMap — 🔧 LOT 9-B : contrôle d'attribution
            masqué sur la carte ; mention licence OSM affichée sous la carte */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Forcer le recalcul de la taille (pour sections collapsibles) */}
        <MapSizeInvalidator />

        {/* Ajuster automatiquement la vue */}
        <MapBoundsUpdater waypoints={validWaypoints} />

        {/* Ligne de route avec flèches - Différencier aller et retour */}
        {routeCoordinates.length > 1 && (() => {
          // Détecter si c'est une navigation circulaire (retour au départ)
          const isCircular = departure && arrival &&
            (departure.name === arrival.name ||
             (departure.icao && arrival.icao && departure.icao === arrival.icao));

          if (isCircular && routeCoordinates.length > 2) {
            // Trouver le point médian (milieu de la route)
            const midpointIndex = Math.floor(routeCoordinates.length / 2);

            // Segmenter la route en aller et retour
            const outboundRoute = routeCoordinates.slice(0, midpointIndex + 1);
            const returnRoute = routeCoordinates.slice(midpointIndex);

            // Appliquer un offset perpendiculaire à la ligne de retour pour éviter la superposition
            const offsetReturnRoute = applyPerpendicularOffset(returnRoute, 50);

            return (
              <>
                {/* Aller (bordeaux) avec flèches */}
                <PolylineWithArrows
                  positions={outboundRoute}
                  color="#f26921"
                  weight={3}
                  opacity={0.7}
                  dashArray="10, 0"
                  isReturn={false}
                />
                {/* Retour (bleu) avec flèches */}
                <PolylineWithArrows
                  positions={offsetReturnRoute}
                  color="var(--text-primary)"
                  weight={3}
                  opacity={0.7}
                  dashArray="5, 5"
                  isReturn={true}
                />
              </>
            );
          } else {
            // Route simple (pas circulaire) avec flèches
            return (
              <PolylineWithArrows
                positions={routeCoordinates}
                color="#f26921"
                weight={3}
                opacity={0.7}
                isReturn={false}
              />
            );
          }
        })()}

        {/* 🔧 LOT 6-A : tracé « au cap magnétique » (violet, tirets longs) —
            visualisation cumulative de l'écart de déclinaison (WMM NOAA) */}
        {magneticTrace.available && magneticTrace.positions.length > 1 && (
          <PolylineWithArrows
            positions={magneticTrace.positions}
            color="#8b5cf6"
            weight={3}
            opacity={0.8}
            dashArray="8, 6"
            isReturn={false}
          />
        )}

        {/* 🔧 LOT 6-B : tracé « cap corrigé du vent » (bleu, tirets courts) —
            par segment, l'orientation du nez de l'avion (crabe) */}
        {windTrace.available && windTrace.segments.map((positions, idx) => (
          <PolylineWithArrows
            key={`wind-${idx}`}
            positions={positions}
            color="#2196f3"
            weight={2}
            opacity={0.85}
            dashArray="3, 6"
            isReturn={false}
          />
        ))}

        {/* 🔧 LOT 7 — cartouche de cap à côté de chaque tronçon droit :
            Rte (vraie) / Mag (déclinaison WMM) / Vent (dérive signée) */}
        {segmentCapLabels.map((lbl, idx) => (
          <Marker
            key={`cap-label-${idx}`}
            position={lbl.position}
            interactive={false}
            icon={L.divIcon({
              className: 'route-cap-chip',
              iconSize: [0, 0],
              html: `<div style="transform: translate(-50%, ${lbl.below ? '15%' : '-115%'}); display: inline-block; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 10px; line-height: 1.35; color: var(--text-primary); white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3); opacity: 0.92;">
                <div style="color: var(--text-tertiary);">${lbl.legLabel}</div>
                <div>Rte ${String(lbl.trueCourse).padStart(3, '0')}°</div>
                <div>Mag ${lbl.magCourse != null ? `${String(lbl.magCourse).padStart(3, '0')}°` : '—'}</div>
                ${lbl.wca != null ? `<div>Vent ${lbl.wca >= 0 ? '+' : '−'}${Math.abs(lbl.wca)}°</div>` : ''}
              </div>`
            })}
          />
        ))}

        {/* Marqueur de départ (premier waypoint) */}
        {departure && (
          <CircleMarker
            center={[departure.lat, departure.lon]}
            radius={8}
            pathOptions={{
              color: '#f26921',
              fillColor: '#f26921',
              fillOpacity: 1,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: 'var(--fs-body)' }}>🛫 {departure.icao || departure.name || 'Départ'}</strong>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Marqueur d'arrivée (aérodrome d'arrivée par type) */}
        {arrival && (
          <CircleMarker
            center={[arrival.lat, arrival.lon]}
            radius={8}
            pathOptions={{
              color: '#f26921',
              fillColor: '#f26921',
              fillOpacity: 1,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: 'var(--fs-body)' }}>🛬 {arrival.icao || arrival.name || 'Arrivée'}</strong>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Marqueurs des waypoints intermédiaires (points VFR, waypoints, etc.) */}
        {intermediateWaypoints.map((waypoint, index) => (
          <CircleMarker
            key={waypoint.id || `waypoint-${index}`}
            center={[waypoint.lat, waypoint.lon]}
            radius={6}
            pathOptions={{
              color: '#f26921',
              fillColor: '#f26921',
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: 'var(--fs-body)' }}>
                  {waypoint.type === 'vfr' ? '📍' : '⚓'} {waypoint.icao || waypoint.name || `WP${index + 1}`}
                </strong>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Marqueur du Top of Descent (TOD) */}
        {todPoint && (
          <CircleMarker
            center={[todPoint.lat, todPoint.lon]}
            radius={10}
            pathOptions={{
              color: 'var(--accent-primary)',
              fillColor: 'rgba(242, 105, 33, 0.10)',
              fillOpacity: 0.9,
              weight: 3
            }}
          >
            <Popup>
              <div style={{ padding: '8px', minWidth: '200px' }}>
                <strong style={{ fontSize: 'var(--fs-body)', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px' }}>
                  ⬇️ Top of Descent (TOD)
                </strong>
                <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Arrivée :</strong> {todPoint.arrivalName}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Distance TOD :</strong> {todPoint.distanceToTod.toFixed(1)} NM
                  </div>
                  {todPoint.cruiseAltitude && (
                    <>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Altitude croisière :</strong> {todPoint.cruiseAltitude} ft
                      </div>
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Altitude cible :</strong> {todPoint.targetAltitude} ft
                      </div>
                      <div>
                        <strong>Taux descente :</strong> {todPoint.descentRate} ft/min
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {/* 🔧 LOT 7 — légende/définitions RETIRÉES de la carte (demande pilote) :
          l'information de cap vit désormais dans les cartouches par tronçon. */}
    </div>

    {/* Mention licence OSM (obligatoire ODbL) — discrète, SOUS la carte */}
    <p style={{ margin: '2px 0 0', fontSize: '9px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
      Fond de carte © contributeurs OpenStreetMap
    </p>
    </>
  );
};

export default RouteMapView;
