/**
 * Hook pour analyser les espaces aériens traversés par une route
 * - Vérifie si les segments traversent des espaces contrôlés
 * - Détecte les conflits d'altitude
 * - Récupère les fréquences radio
 */

import { useState, useEffect } from 'react';
import { openAIPAirspacesService } from '../../../services/openAIPAirspacesService.js';
import { hybridAirspacesService } from '../../../services/hybridAirspacesService.js';

/**
 * Vérifie si deux segments se croisent (test d'intersection de segments)
 */
function segmentsIntersect(p1, p2, p3, p4) {
  const det = (p2.lon - p1.lon) * (p4.lat - p3.lat) - (p4.lon - p3.lon) * (p2.lat - p1.lat);

  if (det === 0) {
    return false; // Segments parallèles ou colinéaires
  }

  const lambda = ((p4.lat - p3.lat) * (p4.lon - p1.lon) + (p3.lon - p4.lon) * (p4.lat - p1.lat)) / det;
  const gamma = ((p1.lat - p2.lat) * (p4.lon - p1.lon) + (p2.lon - p1.lon) * (p4.lat - p1.lat)) / det;

  return (lambda > 0 && lambda < 1) && (gamma > 0 && gamma < 1);
}

/**
 * Vérifie si un segment (ligne) traverse un espace aérien (polygone)
 * Algorithme CORRECT - teste l'intersection réelle avec les bords du polygone
 */
function segmentIntersectsPolygon(fromLat, fromLon, toLat, toLon, airspaceGeometry) {
  if (!airspaceGeometry || airspaceGeometry.type !== 'Polygon') {
    return false;
  }

  const coordinates = airspaceGeometry.coordinates[0];

  // ✅ TEST 1 : Vérifier si un des waypoints est DANS le polygone
  if (pointInPolygon(fromLat, fromLon, coordinates) ||
      pointInPolygon(toLat, toLon, coordinates)) {
    return true;
  }

  // ✅ TEST 2 : Vérifier si la LIGNE traverse un des BORDS du polygone
  // (Algorithme correct d'intersection segment-segment)
  const flightSegment = {
    p1: { lat: fromLat, lon: fromLon },
    p2: { lat: toLat, lon: toLon }
  };

  // Tester l'intersection avec chaque segment du polygone
  for (let i = 0; i < coordinates.length - 1; i++) {
    const polySegment = {
      p1: { lat: coordinates[i][1], lon: coordinates[i][0] },
      p2: { lat: coordinates[i + 1][1], lon: coordinates[i + 1][0] }
    };

    if (segmentsIntersect(
      flightSegment.p1, flightSegment.p2,
      polySegment.p1, polySegment.p2
    )) {
      return true; // Intersection trouvée !
    }
  }

  // ❌ Aucune intersection détectée
  return false;
}

/**
 * Vérifie si un point est dans un polygone (algorithme ray casting)
 */
function pointInPolygon(lat, lon, polygonCoords) {
  let inside = false;

  for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
    const [xi, yi] = polygonCoords[i];
    const [xj, yj] = polygonCoords[j];

    const intersect = ((yi > lon) !== (yj > lon)) &&
      (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}


/**
 * Vérifie si l'altitude crée un conflit avec un espace aérien
 */
function checkAltitudeConflict(segmentAltitude, airspaceFloor, airspaceCeiling) {
  // Si l'altitude du segment est entre le plancher et le plafond, il y a conflit
  return segmentAltitude >= airspaceFloor && segmentAltitude <= airspaceCeiling;
}

/**
 * Extrait l'ICAO d'un nom d'espace aérien et récupère les fréquences associées
 */
async function enrichWithAerodromeFrequencies(airspaceName) {
  try {
    // Chercher un code ICAO à 4 lettres dans le nom (ex: "FIR LFEE" → "LFEE")
    const icaoMatch = airspaceName.match(/\b(LF[A-Z]{2})\b/);
    if (!icaoMatch) {
      return [];
    }

    const icao = icaoMatch[1];

    // Charger les fréquences AIXM si pas déjà fait
    await hybridAirspacesService.loadAerodromeFrequencies();

    // Récupérer les fréquences de cet aérodrome
    const freqs = hybridAirspacesService.aerodromeFrequencies.get(icao);

    return freqs || [];
  } catch (error) {
    console.error('Erreur enrichissement fréquences:', error);
    return [];
  }
}

/**
 * Hook principal
 */
export function useAirspaceAnalysis(waypoints, segmentAltitudes = {}, plannedAltitude = 3000) {
  const [airspaces, setAirspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  // Charger les espaces aériens au montage
  useEffect(() => {
    let isMounted = true;

    async function loadAirspaces() {
      setLoading(true);
      try {
        // Calculer la bbox englobant toute la route
        const bbox = calculateRouteBbox(waypoints);

        // Charger les espaces aériens depuis OpenAIP
        const data = await openAIPAirspacesService.getFrenchAirspaces(bbox);

        if (isMounted) {
          console.log(`🗺️ ${data.length} espaces aériens OpenAIP chargés`);
          setAirspaces(data);
        }
      } catch (error) {
        console.error('❌ Erreur chargement espaces aériens:', error);
        if (isMounted) {
          setAirspaces([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (waypoints && waypoints.length >= 2) {
      loadAirspaces();
    }

    return () => {
      isMounted = false;
    };
  }, [waypoints]);

  // Analyser les segments dès que les espaces sont chargés
  useEffect(() => {
    if (airspaces.length === 0 || !waypoints || waypoints.length < 2) {
      setAnalysis(null);
      return;
    }

    async function analyzeSegments() {
      const segmentsAnalysis = [];

      // Analyser chaque segment
      for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];

      if (!from.lat || !from.lon || !to.lat || !to.lon) {
        continue;
      }

      // 🔧 FIX: Créer un segmentId basé sur les noms ou l'index si pas d'ID
      const fromId = from.id || from.name || `wp${i}`;
      const toId = to.id || to.name || `wp${i+1}`;
      const segmentId = `${fromId}-${toId}`;
      const segmentAlt = segmentAltitudes[segmentId]?.startAlt || plannedAltitude;

      // Trouver les espaces aériens traversés
      const crossedAirspaces = airspaces.filter(airspace =>
        segmentIntersectsPolygon(from.lat, from.lon, to.lat, to.lon, airspace.geometry)
      );

      // Analyser les conflits d'altitude
      const conflicts = [];
      const frequencies = [];
      const controlledAirspaces = [];
      const restrictedZones = []; // 🚨 Zones réglementées/interdites
      const informationalAirspaces = []; // ℹ️ Espaces informatifs (FIR, ATZ, SIV, etc.)

      crossedAirspaces.forEach(airspace => {
        const props = airspace.properties;

        // ✅ FILTRAGE PAR ALTITUDE : Ne garder que les espaces concernés par l'altitude du segment
        const isAltitudeConcerned = checkAltitudeConflict(segmentAlt, props.floor, props.ceiling);

        // Si l'altitude du segment n'est pas concernée par cet espace, passer au suivant
        if (!isAltitudeConcerned) {
          return;
        }

        // 🚨 Vérifier si c'est une zone réglementée/interdite/dangereuse
        const isRestricted = ['R', 'P', 'D', 'RESTRICTED', 'PROHIBITED', 'DANGER'].includes(props.type);

        if (isRestricted) {
          restrictedZones.push({
            name: props.name,
            type: props.type,
            class: props.class,
            floor: props.floor,
            ceiling: props.ceiling,
            floor_raw: props.floor_raw,
            ceiling_raw: props.ceiling_raw,
            remarks: props.remarks,
            activity: props.activity,
            schedule: props.schedule
          });
        }

        // Vérifier si c'est un espace contrôlé
        const isControlled = ['A', 'B', 'C', 'D', 'E'].includes(props.class);

        if (isControlled) {
          // Extraire les fréquences pour cet espace
          const airspaceFreqs = [];
          if (props.frequencies && props.frequencies.length > 0) {
            props.frequencies.forEach(freq => {
              airspaceFreqs.push({
                type: freq.type || 'COM',
                frequency: freq.frequency || freq.freq,
                schedule: freq.schedule,
                remarks: freq.remarks
              });
            });
          }

          controlledAirspaces.push({
            name: props.name,
            type: props.type,
            class: props.class,
            floor: props.floor,
            ceiling: props.ceiling,
            floor_raw: props.floor_raw,
            ceiling_raw: props.ceiling_raw,
            frequencies: airspaceFreqs // 🆕 Fréquences attachées à l'espace
          });
        } else if (!isRestricted) {
          // ℹ️ Espace informatif (ni contrôlé, ni restreint) : FIR, ATZ, SIV, classe G, etc.
          informationalAirspaces.push({
            name: props.name,
            type: props.type,
            class: props.class || 'N/A',
            floor: props.floor,
            ceiling: props.ceiling,
            floor_raw: props.floor_raw,
            ceiling_raw: props.ceiling_raw,
            frequencies: [] // Sera enrichi plus tard avec AIXM
          });
        }

        // ✅ CONFLIT uniquement pour espaces contrôlés A/B/C/D ou zones réglementées P/R/D
        // Classe E, FIR, ATZ, SIV ne sont pas des conflits (information seulement)
        const isRealConflict = (
          ['A', 'B', 'C', 'D'].includes(props.class) || // Espaces très contrôlés
          isRestricted // Zones réglementées/interdites/dangereuses
        );

        if (isRealConflict) {
          conflicts.push({
            airspaceName: props.name,
            airspaceType: props.type,
            airspaceClass: props.class,
            segmentAltitude: segmentAlt,
            airspaceFloor: props.floor,
            airspaceCeiling: props.ceiling,
            floor_raw: props.floor_raw,
            ceiling_raw: props.ceiling_raw,
            isRestricted: isRestricted,
            message: `Altitude ${segmentAlt}ft dans ${props.type} ${props.name} (${props.floor_raw} - ${props.ceiling_raw})`
          });
        }

        // Extraire les fréquences (uniquement pour les espaces concernés par l'altitude)
        if (props.frequencies && props.frequencies.length > 0) {
          props.frequencies.forEach(freq => {
            frequencies.push({
              airspace: props.name,
              type: freq.type || 'COM',
              frequency: freq.frequency || freq.freq
            });
          });
        }
      });

      // 🔄 Enrichir les espaces informatifs avec les fréquences AIXM
      await Promise.all(informationalAirspaces.map(async (airspace) => {
        const freqs = await enrichWithAerodromeFrequencies(airspace.name);
        airspace.frequencies = freqs;
      }));

      segmentsAnalysis.push({
        segmentId,
        from: from.name || `WP${i + 1}`,
        to: to.name || `WP${i + 2}`,
        fromId: from.id,
        toId: to.id,
        altitude: segmentAlt,
        crossedAirspaces: crossedAirspaces.length,
        controlledAirspaces,
        conflicts,
        frequencies,
        hasConflicts: conflicts.length > 0,
        hasControlledAirspace: controlledAirspaces.length > 0,
        // 🚨 Zones réglementées/interdites
        restrictedZones,
        hasRestrictedZones: restrictedZones.length > 0,
        // ℹ️ Espaces informatifs (FIR, ATZ, SIV, etc.)
        informationalAirspaces,
        hasInformationalAirspaces: informationalAirspaces.length > 0
      });
    }

      console.log('📊 Analyse des espaces aériens:', segmentsAnalysis);
      setAnalysis(segmentsAnalysis);
    }

    analyzeSegments();

  }, [airspaces, waypoints, segmentAltitudes, plannedAltitude]);

  return {
    airspaces,
    loading,
    analysis,
    hasData: airspaces.length > 0
  };
}

/**
 * Calcule la bounding box englobant toute la route
 */
function calculateRouteBbox(waypoints) {
  if (!waypoints || waypoints.length === 0) {
    return null;
  }

  const validWaypoints = waypoints.filter(wp => wp.lat && wp.lon);

  if (validWaypoints.length === 0) {
    return null;
  }

  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  validWaypoints.forEach(wp => {
    minLat = Math.min(minLat, wp.lat);
    maxLat = Math.max(maxLat, wp.lat);
    minLon = Math.min(minLon, wp.lon);
    maxLon = Math.max(maxLon, wp.lon);
  });

  // Ajouter une marge de 0.5° (~50km) autour de la route
  const margin = 0.5;

  return {
    minLat: minLat - margin,
    maxLat: maxLat + margin,
    minLon: minLon - margin,
    maxLon: maxLon + margin
  };
}
