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
 * Vérifie si un segment (ligne) traverse un espace aérien (polygone)
 */
function segmentIntersectsPolygon(fromLat, fromLon, toLat, toLon, airspaceGeometry) {
  if (!airspaceGeometry || airspaceGeometry.type !== 'Polygon') {
    return false;
  }

  // Algorithme simplifié : vérifier si l'un des points est dans le polygone
  // OU si la ligne traverse les bords du polygone
  const coordinates = airspaceGeometry.coordinates[0];

  // Vérifier si le point de départ ou d'arrivée est dans le polygone
  if (pointInPolygon(fromLat, fromLon, coordinates) ||
      pointInPolygon(toLat, toLon, coordinates)) {
    return true;
  }

  // Vérifier si la ligne traverse les bords du polygone (algorithme simplifié)
  // Pour une version complète, il faudrait tester toutes les intersections de segments
  // Version simplifiée : si les deux points sont proches du polygone, on considère une traversée
  const bbox = getPolygonBbox(coordinates);
  const segmentBbox = {
    minLat: Math.min(fromLat, toLat),
    maxLat: Math.max(fromLat, toLat),
    minLon: Math.min(fromLon, toLon),
    maxLon: Math.max(fromLon, toLon)
  };

  // Si les bboxes se chevauchent, il y a une forte probabilité de traversée
  return bboxesOverlap(bbox, segmentBbox);
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
 * Calcule la bounding box d'un polygone
 */
function getPolygonBbox(coordinates) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;

  coordinates.forEach(([lon, lat]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  });

  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Vérifie si deux bboxes se chevauchent
 */
function bboxesOverlap(bbox1, bbox2) {
  return !(bbox1.maxLat < bbox2.minLat ||
           bbox1.minLat > bbox2.maxLat ||
           bbox1.maxLon < bbox2.minLon ||
           bbox1.minLon > bbox2.maxLon);
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

      const segmentId = `${from.id}-${to.id}`;
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
