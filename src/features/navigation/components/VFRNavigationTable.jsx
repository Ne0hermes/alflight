// src/features/navigation/components/VFRNavigationTable.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Table, AlertTriangle, Sun, Moon } from 'lucide-react';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import { useAirspaceAnalysis } from '../hooks/useAirspaceAnalysis';
import { getCruiseSpeedKt, getFuelConsumptionLph } from '@utils/aircraftPerf';
import { getDeclination } from '@utils/magneticDeclination';
import { calculateMidpoint } from '@utils/navigationCalculations';
import { useWindsAloftStore } from '@core/stores/windsAloftStore';
import { solveWindTriangle } from '@utils/windTriangle';
import {
  calculateAeronauticalNight,
  parseTimeString,
  analyzeSegmentDayNight,
  formatTime as formatSunTime
} from '@services/dayNightCalculator';

const VFRNavigationTable = ({
  waypoints,
  selectedAircraft,
  plannedAltitude = 3000,
  flightType,
  navigationResults,
  segmentAltitudes = {},
  setSegmentAltitude,
  departureTimeTheoretical = '', // Reçu depuis Step7Summary
  flightDate = null, // Date du vol (optionnel, sinon aujourd'hui)
  hideToggleButton = false, // Masquer le bouton Afficher/Masquer (utilisé dans Step7)
  hideTitle = false // Masquer le titre (utilisé dans FlightRecapTable)
}) => {
  const [showTable, setShowTable] = useState(true);
  const { format, convert, getSymbol } = useUnits();
  const units = useUnitsWatcher(); // Force re-render on units change

  // Récupérer les données météo et VAC
  const weatherData = useWeatherStore(state => state.weatherData) || {};
  const fetchWeather = useWeatherStore(state => state.fetchWeather);
  const vacData = useVACStore(state => state.vacData) || {};

  // 🛫 Analyser les espaces aériens traversés
  const { analysis: airspaceAnalysis, loading: airspacesLoading } = useAirspaceAnalysis(
    waypoints,
    segmentAltitudes,
    plannedAltitude
  );
  
  // Charger automatiquement les données météo pour tous les waypoints
  useEffect(() => {
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach(wp => {
        if (wp.name && wp.name.match(/^[A-Z]{4}$/) && !weatherData[wp.name]) {
          fetchWeather(wp.name).catch(() => {});
        }
      });
    }
  }, [waypoints, weatherData, fetchWeather]);

  // 🔧 LOT 6-B : vents en altitude (Open-Meteo) + vent manuel
  const windsProfiles = useWindsAloftStore(state => state.profiles);
  const manualWind = useWindsAloftStore(state => state.manualWind);
  const setManualWind = useWindsAloftStore(state => state.setManualWind);
  const clearManualWind = useWindsAloftStore(state => state.clearManualWind);
  const ensureWindProfiles = useWindsAloftStore(state => state.ensureProfiles);
  const [manualDirInput, setManualDirInput] = useState('');
  const [manualSpdInput, setManualSpdInput] = useState('');

  // Précharger les profils de vents aux milieux de segments (fire-and-forget,
  // dédupliqué par cellule de grille 0,1° et TTL dans le store)
  useEffect(() => {
    if (!waypoints || waypoints.length < 2) return;
    const mids = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      if (!from?.lat || !from?.lon || !to?.lat || !to?.lon) continue;
      mids.push(calculateMidpoint({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon }));
    }
    if (mids.length > 0) ensureWindProfiles(mids);
  }, [waypoints, ensureWindProfiles]);

  // Calculer les données de navigation pour chaque segment
  const navigationData = useMemo(() => {
    // 🔧 FIX D-moteur : sans vitesse de croisière canonique, on ne fabrique pas 100 kt —
    // le tableau (temps/GS/carburant) reste vide plutôt que d'afficher des valeurs inventées.
    if (!waypoints || waypoints.length < 2 || !selectedAircraft || !getCruiseSpeedKt(selectedAircraft)) return [];

    const segments = [];
    let cumulativeETEMinutes = 0; // Cumul des ETE pour heure théorique
    let cumulativeActualMinutes = 0; // Cumul des temps réels pour heure réelle

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      
      // Vérifier que les coordonnées sont valides
      if (!from.lat || !from.lon || !to.lat || !to.lon) {
                continue;
      }
      
      // Calculer la distance
      const R = 3440.065; // Rayon de la Terre en NM
      const lat1 = from.lat * Math.PI / 180;
      const lat2 = to.lat * Math.PI / 180;
      const dLat = (to.lat - from.lat) * Math.PI / 180;
      const dLon = (to.lon - from.lon) * Math.PI / 180;
      
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      // Calculer le cap vrai
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      let trueCourse = Math.atan2(y, x) * 180 / Math.PI;
      trueCourse = (trueCourse + 360) % 360;
      
      // Identifiant + altitude du segment (nécessaires au vent en altitude)
      const fromIdW = from.id || from.name || `wp${i}`;
      const toIdW = to.id || to.name || `wp${i + 1}`;
      const segmentIdW = `${fromIdW}-${toIdW}`;
      const segAltForWind = segmentAltitudes[segmentIdW]?.startAlt || plannedAltitude;
      const segMid = calculateMidpoint({ lat: from.lat, lon: from.lon }, { lat: to.lat, lon: to.lon });

      // 🔧 LOT 6-B — Vent du segment, par PRIORITÉ :
      // manuel > vents en altitude Open-Meteo (milieu du segment, altitude du
      // segment, heure de départ prévue) > METAR de surface du terrain amont
      // (repli historique) > aucun. La source est affichée dans la colonne VENT.
      const whenForWind = (flightDate && departureTimeTheoretical)
        ? (parseTimeString(departureTimeTheoretical, new Date(flightDate)) || new Date())
        : new Date();
      let windSpeed = 0;
      let windDirection = 0;
      let windSource = 'none';

      const aloftWind = useWindsAloftStore.getState().getWindAt(segMid.lat, segMid.lon, segAltForWind, whenForWind);
      if (aloftWind && aloftWind.speedKt > 0) {
        windSpeed = aloftWind.speedKt;
        windDirection = aloftWind.directionDeg;
        windSource = aloftWind.source; // 'manual' | 'open-meteo'
      } else if (!aloftWind) {
        const weather = weatherData[from.name]?.metar;
        if (weather) {
          if (weather.wind) {
            windSpeed = weather.wind.speed_kts || weather.wind.speed || 0;
            windDirection = weather.wind.degrees || weather.wind.direction || 0;
          } else if (weather.wind_speed !== undefined) {
            windSpeed = weather.wind_speed?.value || 0;
            windDirection = weather.wind_direction?.value || 0;
          }
          if (windSpeed > 0) windSource = 'metar';
        }
      } else {
        // Vent altitude connu et NUL : source honnête, pas de repli METAR
        windSource = aloftWind.source;
      }

      // Dérive et vitesse sol — triangle des vents partagé (formule exacte)
      const tas = getCruiseSpeedKt(selectedAircraft); // garanti non-null (useMemo gardé en amont)
      let groundSpeed = tas;
      let windCorrectionAngle = 0;
      let headingWithDrift = trueCourse;
      let windUntenable = false;

      if (windSpeed > 0) {
        const tri = solveWindTriangle(trueCourse, tas, windDirection, windSpeed);
        if (tri) {
          windCorrectionAngle = tri.windCorrectionAngle;
          groundSpeed = tri.groundSpeed;
          headingWithDrift = tri.headingTrue;
        } else {
          // Vent ≥ TAS : segment intenable — on l'affiche, sans inventer de GS
          windUntenable = true;
        }
      }

      // 🔧 LOT 6-A : cap magnétique = cap vrai (+ dérive) − déclinaison WMM au
      // milieu sphérique du segment. Fail-closed : sans déclinaison, cap vrai
      // (suffixe « (vrai) » dans la colonne).
      const declination = getDeclination(segMid.lat, segMid.lon, flightDate ? new Date(flightDate) : new Date());
      const magneticHeading = (((headingWithDrift - (declination ?? 0)) % 360) + 360) % 360;
      // 🔧 LOT 7 — route magnétique SANS vent (ligne « Mag » de la colonne Cap) :
      // la chaîne complète affichée est Vrai (route) → Mag (− déclinaison) →
      // Vent (+ dérive = cap à afficher au compas)
      const magneticCourse = (((trueCourse - (declination ?? 0)) % 360) + 360) % 360;
      
      // Calculer le temps de vol pour ce segment
      const timeMinutes = (distance / groundSpeed) * 60;
      
      // Récupérer les fréquences depuis les données VAC
      const frequencies = [];
      const vac = vacData[from.name];
      if (vac && vac.frequencies) {
        // Prioriser TWR, puis APP, puis INFO
        const twr = vac.frequencies.find(f => f.type === 'TWR' || f.name?.includes('Tower'));
        const app = vac.frequencies.find(f => f.type === 'APP' || f.name?.includes('Approach'));
        const info = vac.frequencies.find(f => f.type === 'INFO' || f.name?.includes('Information'));
        
        if (twr) frequencies.push(`${twr.frequency} (TWR)`);
        else if (app) frequencies.push(`${app.frequency} (APP)`);
        else if (info) frequencies.push(`${info.frequency} (INFO)`);
      }
      
      // Calculer l'altitude de sécurité (MSA - Minimum Safe Altitude)
      // Utiliser l'élévation du terrain + 1000ft pour le VFR
      const msa = Math.max(
        from.elevation || 0,
        to.elevation || 0
      ) + 1000;

      // 🔧 FIX: Créer un segmentId basé sur les noms ou l'index si pas d'ID
      const fromId = from.id || from.name || `wp${i}`;
      const toId = to.id || to.name || `wp${i+1}`;
      const segmentId = `${fromId}-${toId}`;
      const segmentAlt = segmentAltitudes[segmentId]?.startAlt || plannedAltitude;

      // 🛫 Récupérer les données d'espaces aériens pour ce segment
      const segmentAirspaceData = airspaceAnalysis?.find(a => a.segmentId === segmentId);

      // 🔍 Debug: Log segment matching
      if (airspaceAnalysis && airspaceAnalysis.length > 0) {
        console.log(`🔍 Segment ${segmentId}:`, {
          found: !!segmentAirspaceData,
          hasRestrictedZones: segmentAirspaceData?.hasRestrictedZones,
          restrictedZones: segmentAirspaceData?.restrictedZones?.length || 0,
          availableSegments: airspaceAnalysis.map(a => a.segmentId)
        });
      }

      // Cumuler les temps pour calculer les heures d'arrivée
      cumulativeETEMinutes += Math.round(timeMinutes);
      cumulativeActualMinutes += Math.round(timeMinutes); // Par défaut utiliser ETE, sera mis à jour si actualTime renseigné

      segments.push({
        index: i,
        segmentId: segmentId,
        from: from.name || `WP${i+1}`,
        to: to.name || `WP${i+2}`,
        altitude: segmentAlt,
        // Arrondi PUIS re-normalisation : 359,7° → 360 → 000 (même convention
        // que les cartouches de la carte — revue lot 7)
        trueCourse: Math.round(trueCourse) % 360,
        magneticCourse: Math.round(magneticCourse) % 360,
        magneticHeading: Math.round(magneticHeading) % 360,
        hasDeclination: declination != null,
        declination,
        distance: distance, // Garder la valeur brute pour conversion
        distanceDisplay: format(distance, 'distance', 1),
        windInfo: windSpeed > 0 ? `${windDirection}°/${format(windSpeed, 'windSpeed', 0)}` : 'Calme',
        windSource,
        windUntenable,
        windCorrectionAngle: Math.round(windCorrectionAngle),
        groundSpeed: groundSpeed, // Garder la valeur brute
        groundSpeedDisplay: format(groundSpeed, 'speed', 0),
        estimatedTime: Math.round(timeMinutes),
        actualTime: '', // À remplir pendant le vol
        frequencies: frequencies.join(', ') || 'N/A',
        msa: Math.round(msa),
        position: {
          lat: to.lat ? to.lat.toFixed(4) : 'N/A',
          lon: to.lon ? to.lon.toFixed(4) : 'N/A'
        },
        // 🛫 Données d'espaces aériens
        airspaces: segmentAirspaceData?.controlledAirspaces || [],
        airspaceConflicts: segmentAirspaceData?.conflicts || [],
        airspaceFrequencies: segmentAirspaceData?.frequencies || [],
        hasAirspaceConflict: segmentAirspaceData?.hasConflicts || false,
        // 🚨 Zones réglementées/interdites
        restrictedZones: segmentAirspaceData?.restrictedZones || [],
        hasRestrictedZones: segmentAirspaceData?.hasRestrictedZones || false,
        // ℹ️ Espaces informatifs (FIR, ATZ, SIV, etc.)
        informationalAirspaces: segmentAirspaceData?.informationalAirspaces || [],
        hasInformationalAirspaces: segmentAirspaceData?.hasInformationalAirspaces || false,
        // ⏰ Heures d'arrivée calculées
        cumulativeETEMinutes: cumulativeETEMinutes
      });
    }

    return segments;
  }, [waypoints, selectedAircraft, plannedAltitude, weatherData, vacData, segmentAltitudes, airspaceAnalysis, flightDate, windsProfiles, manualWind, departureTimeTheoretical]);

  // 🌅 Calculer la nuit aéronautique et analyser chaque segment
  const dayNightAnalysis = useMemo(() => {
    if (!waypoints || waypoints.length === 0 || !departureTimeTheoretical) {
      return { sunTimes: null, segments: [], hasWarnings: false };
    }

    // Utiliser la position du premier waypoint (aérodrome de départ)
    const departureWaypoint = waypoints[0];
    if (!departureWaypoint.lat || !departureWaypoint.lon) {
      return { sunTimes: null, segments: [], hasWarnings: false };
    }

    // Date du vol (ou aujourd'hui si non spécifié)
    const date = flightDate ? new Date(flightDate) : new Date();

    // Calculer les heures de lever/coucher du soleil
    const sunTimes = calculateAeronauticalNight(
      departureWaypoint.lat,
      departureWaypoint.lon,
      date
    );

    // Analyser chaque segment
    const segmentsAnalysis = navigationData.map(seg => {
      // Calculer les heures de départ et d'arrivée du segment
      const departureTime = parseTimeString(departureTimeTheoretical, date);
      if (!departureTime) return { ...seg, dayNightStatus: null };

      const arrivalTime = new Date(departureTime.getTime() + seg.cumulativeETEMinutes * 60 * 1000);

      // Analyser jour/nuit pour ce segment
      const analysis = analyzeSegmentDayNight(departureTime, arrivalTime, sunTimes);

      return {
        ...seg,
        dayNightStatus: analysis
      };
    });

    // Détecter les warnings (jour → nuit aéronautique uniquement)
    const hasWarnings = segmentsAnalysis.some(seg =>
      seg.dayNightStatus?.warning
    );

    return {
      sunTimes,
      segments: segmentsAnalysis,
      hasWarnings
    };
  }, [waypoints, navigationData, departureTimeTheoretical, flightDate]);

  // Calculer les totaux
  const totals = useMemo(() => {
    if (navigationData.length === 0) return null;
    
    return {
      distance: navigationData.reduce((sum, seg) => sum + seg.distance, 0),
      estimatedTime: navigationData.reduce((sum, seg) => sum + seg.estimatedTime, 0),
      fuelRequired: selectedAircraft ? 
        (navigationData.reduce((sum, seg) => sum + seg.estimatedTime, 0) / 60) * 
        (getFuelConsumptionLph(selectedAircraft) || 0) : 0
    };
  }, [navigationData, selectedAircraft]);

  // Formater le temps en heures et minutes
  // Fonction pour ajouter des minutes à une heure (format HH:MM)
  const addMinutesToTime = (timeString, minutesToAdd) => {
    if (!timeString || !minutesToAdd) return '';

    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return '';

    const totalMinutes = hours * 60 + minutes + minutesToAdd;
    const newHours = Math.floor(totalMinutes / 60) % 24; // Modulo 24 pour gérer le passage à minuit
    const newMinutes = Math.round(totalMinutes % 60);

    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `0:${String(mins).padStart(2, '0')}`;
  };

  if (!waypoints || waypoints.length < 2 || !selectedAircraft) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-overlay)',
      borderRadius: 'var(--radius-sm)',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* En-tête */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        {!hideTitle && (
          <h3 style={{
            fontSize: 'var(--fs-title)',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Table size={20} />
            Tableau de Navigation VFR
          </h3>
        )}

        {!hideToggleButton && (
          <button
            onClick={() => setShowTable(!showTable)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--text-secondary)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 'var(--fs-body)',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {showTable ? 'Masquer' : 'Afficher'} le tableau
          </button>
        )}
      </div>

      {showTable && (
        <>
          {/* 🔧 LOT 6-B : saisie MANUELLE du vent en altitude (prioritaire sur
              Open-Meteo et METAR pour tous les segments) — masquée dans le PDF */}
          <div
            className="pdf-hidden"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
              marginBottom: '12px', padding: '8px 10px',
              backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-caption)'
            }}
          >
            <span style={{ fontWeight: 600 }}>Vent altitude manuel :</span>
            <input
              type="number" min="0" max="360" placeholder="dir °"
              value={manualDirInput}
              onChange={(e) => setManualDirInput(e.target.value)}
              style={{ width: '70px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <span>/</span>
            <input
              type="number" min="0" placeholder="kt"
              value={manualSpdInput}
              onChange={(e) => setManualSpdInput(e.target.value)}
              style={{ width: '60px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={() => {
                const d = parseFloat(manualDirInput);
                const s = parseFloat(manualSpdInput);
                // Garde : une saisie invalide ne doit PAS effacer silencieusement
                // un vent manuel déjà appliqué (setManualWind(NaN) → null)
                if (!Number.isFinite(d) || !Number.isFinite(s) || s < 0) {
                  alert('Vent manuel : saisissez une direction (0-360°) et une vitesse (kt) valides.');
                  return;
                }
                setManualWind(d, s);
              }}
              style={{ padding: '4px 10px', fontWeight: 600, color: 'var(--accent-primary)', backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              Appliquer
            </button>
            {manualWind && (
              <button
                onClick={() => { clearManualWind(); setManualDirInput(''); setManualSpdInput(''); }}
                style={{ padding: '4px 10px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              >
                Auto (Open-Meteo)
              </button>
            )}
            <span style={{ color: 'var(--text-tertiary)' }}>
              {manualWind
                ? `→ vent manuel ${manualWind.directionDeg}° / ${manualWind.speedKt} kt appliqué à tous les segments`
                : 'sinon : vents en altitude Open-Meteo par segment, repli METAR sol'}
            </span>
          </div>

          {/* 🌅 Alerte jour/nuit si warnings détectés */}
          {dayNightAnalysis.hasWarnings && dayNightAnalysis.sunTimes && (
            <div style={{
              backgroundColor: 'rgba(242, 105, 33, 0.10)',
              border: '2px solid var(--accent-primary)',
              borderLeft: '6px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <Moon size={18} color="var(--accent-primary)" />
                <span style={{ fontWeight: '600', color: 'var(--accent-primary)', fontSize: 'var(--fs-body)' }}>
                  ⚠️ ALERTE JOUR/NUIT : Une partie du vol se déroulera de nuit
                </span>
              </div>
              <div style={{ fontSize: 'var(--fs-body)', color: 'var(--accent-primary)', lineHeight: '1.5' }}>
                <div><strong>Jour aéronautique :</strong> {formatSunTime(dayNightAnalysis.sunTimes.nightEnd)} (lever - 30 min)</div>
                <div><strong>Nuit aéronautique :</strong> {formatSunTime(dayNightAnalysis.sunTimes.nightStart)} (coucher + 30 min)</div>
                <div style={{ marginTop: '8px', fontWeight: '500' }}>
                  Vérifiez que vous êtes qualifié pour le vol de nuit et que l'avion est équipé en conséquence.
                </div>
              </div>
            </div>
          )}

          {/* Tableau de navigation */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--fs-body)'
            }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-overlay)' }}>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)' }}>De</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)' }}>Vers</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>Alt ({getSymbol('altitude')})</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>CAP (°)</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>DIST ({getSymbol('distance')})</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>VENT</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>ETE</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', backgroundColor: 'var(--bg-overlay)' }}>HEURE THÉORIQUE</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', backgroundColor: 'var(--bg-overlay)' }}>JOUR/NUIT</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', backgroundColor: 'rgba(242, 105, 33, 0.10)' }}>ATE</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', backgroundColor: 'rgba(242, 105, 33, 0.10)' }}>HEURE RÉELLE</th>
                  <th style={{ padding: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-overlay)' }}>ESPACES AÉRIENS & FRÉQUENCES</th>
                </tr>
              </thead>
              <tbody>
                {navigationData.map((seg, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', fontWeight: '500' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', fontWeight: '500' }}>
                      {seg.from}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', fontWeight: '500' }}>
                      {seg.to}
                    </td>
                    <td style={{ padding: '4px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={seg.altitude}
                        onChange={(e) => {
                          const newAlt = parseInt(e.target.value) || plannedAltitude;
                          if (setSegmentAltitude) {
                            setSegmentAltitude(seg.segmentId, {
                              startAlt: newAlt,
                              endAlt: newAlt,
                              type: 'level'
                            });
                          }
                        }}
                        style={{
                          width: '70px',
                          padding: '4px 6px',
                          border: '1px solid var(--text-tertiary)',
                          borderRadius: 'var(--radius-sm)',
                          textAlign: 'center',
                          fontSize: 'var(--fs-body)',
                          fontWeight: '500',
                          backgroundColor: 'rgba(242, 105, 33, 0.10)'
                        }}
                        min="0"
                        max="50000"
                        step="500"
                      />
                    </td>
                    {/* 🔧 LOT 7 — les 3 dérivations empilées : Vrai (route),
                        Mag (− déclinaison), Vent (+ dérive = cap à piloter) */}
                    <td style={{ padding: '6px 8px', border: '1px solid var(--border-subtle)', textAlign: 'center', fontWeight: '500', whiteSpace: 'nowrap' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>Vrai </span>
                        {String(seg.trueCourse).padStart(3, '0')}°
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)' }}>Mag </span>
                        {seg.hasDeclination ? `${String(seg.magneticCourse).padStart(3, '0')}°` : '—'}
                      </div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                        <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-tertiary)', fontWeight: 400 }}>Vent </span>
                        {seg.windUntenable
                          ? '⚠'
                          : `${String(seg.magneticHeading).padStart(3, '0')}°${seg.hasDeclination ? '' : ' (vrai)'}`}
                      </div>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', fontWeight: '500' }}>
                      {seg.distanceDisplay || format(seg.distance, 'distance', 1)}
                    </td>
                    {/* 🔧 LOT 6-B : colonne VENT avec provenance (le vent était
                        calculé mais jamais affiché) */}
                    <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: 'var(--fs-caption)' }}>
                      {seg.windUntenable ? (
                        <span style={{ color: 'var(--color-red-critical)', fontWeight: 600 }}>⚠ {seg.windInfo} ≥ TAS</span>
                      ) : (
                        <>
                          {seg.windInfo}
                          {seg.windSource !== 'none' && (
                            <div style={{ color: 'var(--text-tertiary)' }}>
                              {{ manual: 'manuel', 'open-meteo': 'altitude', metar: 'METAR sol' }[seg.windSource] || seg.windSource}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center', fontWeight: '500' }}>
                      {seg.windUntenable ? (
                        <span
                          style={{ color: 'var(--color-red-critical)' }}
                          title="Vent ≥ vitesse propre : segment intenable — temps calculé SANS vent, non représentatif"
                        >
                          ⚠ {formatTime(seg.estimatedTime)}
                        </span>
                      ) : (
                        formatTime(seg.estimatedTime)
                      )}
                    </td>
                    <td style={{
                      padding: '8px',
                      border: '1px solid var(--border-subtle)',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-overlay)',
                      minWidth: '80px',
                      color: 'var(--text-primary)',
                      fontWeight: '500'
                    }}>
                      {departureTimeTheoretical ? addMinutesToTime(departureTimeTheoretical, seg.cumulativeETEMinutes) : '-'}
                    </td>

                    {/* Indicateur jour/nuit */}
                    <td style={{
                      padding: '8px',
                      border: '1px solid var(--border-subtle)',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-overlay)'
                    }}>
                      {(() => {
                        const segAnalysis = dayNightAnalysis.segments[idx];
                        if (!segAnalysis?.dayNightStatus) return '-';

                        const status = segAnalysis.dayNightStatus.status;
                        if (status === 'day') {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Sun size={14} color="var(--accent-primary)" />
                              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)' }}>Jour</span>
                            </div>
                          );
                        } else if (status === 'night') {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Moon size={14} color="var(--accent-primary)" />
                              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--accent-primary)' }}>Nuit</span>
                            </div>
                          );
                        }
                        return '-';
                      })()}
                    </td>

                    <td style={{
                      padding: '8px',
                      border: '1px solid var(--border-subtle)',
                      textAlign: 'center',
                      backgroundColor: 'rgba(242, 105, 33, 0.10)',
                      minWidth: '60px'
                    }}>
                      {/* Champ vide pour remplir pendant le vol */}
                    </td>
                    <td style={{
                      padding: '8px',
                      border: '1px solid var(--border-subtle)',
                      textAlign: 'center',
                      backgroundColor: 'rgba(242, 105, 33, 0.10)',
                      minWidth: '80px'
                    }}>
                      {/* Champ vide à remplir manuellement */}
                    </td>
                    {/* 🛫 Colonne Espaces aériens */}
                    <td style={{
                      padding: '6px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 'var(--fs-caption)',
                      backgroundColor: 'var(--bg-overlay)',
                      maxWidth: '200px'
                    }}>
                      {/* 🚨 ZONES RÉGLEMENTÉES/INTERDITES - Priorité 1 */}
                      {seg.hasRestrictedZones && (
                        <div style={{
                          marginBottom: '8px',
                          padding: '6px',
                          backgroundColor: 'var(--bg-overlay)',
                          border: '2px solid var(--text-secondary)',
                          borderRadius: 'var(--radius-sm)'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '4px',
                            color: 'var(--text-secondary)',
                            fontWeight: '600',
                            fontSize: 'var(--fs-body)'
                          }}>
                            <AlertTriangle size={16} />
                            <span>🚫 ZONE RÉGLEMENTÉE</span>
                          </div>
                          {seg.restrictedZones.map((zone, idx) => (
                            <div key={idx} style={{
                              marginTop: '4px',
                              padding: '4px',
                              backgroundColor: 'var(--bg-overlay)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--text-secondary)'
                            }}>
                              <strong style={{ color: 'var(--text-secondary)' }}>
                                {zone.type === 'P' && '🚫 INTERDITE'}
                                {zone.type === 'R' && '⚠️ RÉGLEMENTÉE'}
                                {zone.type === 'D' && '⚠️ DANGEREUSE'}
                                {zone.type === 'PROHIBITED' && '🚫 INTERDITE'}
                                {zone.type === 'RESTRICTED' && '⚠️ RÉGLEMENTÉE'}
                                {zone.type === 'DANGER' && '⚠️ DANGEREUSE'}
                              </strong>
                              {' '}{zone.name}
                              <br />
                              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                                {zone.floor_raw} - {zone.ceiling_raw}
                              </span>
                              {zone.activity && (
                                <>
                                  <br />
                                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    Activité: {zone.activity}
                                  </span>
                                </>
                              )}
                              {zone.schedule && (
                                <>
                                  <br />
                                  <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    Horaires: {zone.schedule}
                                  </span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 🗺️ ESPACES CONTRÔLÉS (CTR/TMA/CTA) avec FRÉQUENCES */}
                      {seg.airspaces.length > 0 ? (
                        <div>
                          {seg.airspaces.map((airspace, idx) => (
                            <div key={idx} style={{
                              marginBottom: '4px',
                              padding: '4px',
                              backgroundColor: 'var(--bg-overlay)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--text-secondary)'
                            }}>
                              <div style={{ marginBottom: '2px' }}>
                                <strong>{airspace.type}</strong> {airspace.name}
                                <br />
                                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                                  Classe {airspace.class} | {airspace.floor_raw} ({airspace.floor}ft) - {airspace.ceiling_raw} ({airspace.ceiling}ft)
                                </span>
                              </div>
                              {/* 📻 Fréquences de cet espace */}
                              {airspace.frequencies && airspace.frequencies.length > 0 && (
                                <div style={{
                                  marginTop: '3px',
                                  paddingTop: '3px',
                                  borderTop: '1px solid var(--text-tertiary)'
                                }}>
                                  {airspace.frequencies.map((freq, fIdx) => (
                                    <div key={fIdx} style={{
                                      fontSize: 'var(--fs-caption)',
                                      fontWeight: '500',
                                      color: 'var(--text-primary)',
                                      marginBottom: '1px'
                                    }}>
                                      📻 {freq.frequency} ({freq.type})
                                      {freq.schedule && (
                                        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'normal', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                                          {freq.schedule}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : !seg.hasRestrictedZones && !seg.hasInformationalAirspaces && (
                        <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                      )}

                      {/* ℹ️ ESPACES INFORMATIFS (FIR, ATZ, SIV, etc.) */}
                      {seg.informationalAirspaces && seg.informationalAirspaces.length > 0 && (
                        <div style={{ marginTop: seg.airspaces.length > 0 ? '8px' : '0' }}>
                          {seg.informationalAirspaces.map((airspace, idx) => (
                            <div key={idx} style={{
                              marginBottom: '4px',
                              padding: '4px',
                              backgroundColor: 'var(--bg-overlay)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--text-tertiary)'
                            }}>
                              <div style={{ marginBottom: '2px' }}>
                                <strong>{airspace.type}</strong> {airspace.name}
                                <br />
                                <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' }}>
                                  Classe {airspace.class} | {airspace.floor_raw} ({airspace.floor}ft) - {airspace.ceiling_raw} ({airspace.ceiling}ft)
                                </span>
                              </div>
                              {/* 📻 Fréquences de cet espace */}
                              {airspace.frequencies && airspace.frequencies.length > 0 && (
                                <div style={{
                                  marginTop: '3px',
                                  paddingTop: '3px',
                                  borderTop: '1px solid var(--text-tertiary)'
                                }}>
                                  {airspace.frequencies.map((freq, fIdx) => (
                                    <div key={fIdx} style={{
                                      fontSize: 'var(--fs-caption)',
                                      fontWeight: '500',
                                      color: 'var(--text-secondary)',
                                      marginBottom: '1px'
                                    }}>
                                      📻 {freq.frequency} ({freq.type})
                                      {freq.schedule && (
                                        <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'normal', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                                          {freq.schedule}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* Ligne des totaux */}
                <tr style={{ backgroundColor: 'var(--bg-overlay)', fontWeight: '600' }}>
                  <td colSpan="5" style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'right' }}>
                    TOTAUX:
                  </td>
                  <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    {format(totals?.distance || 0, 'distance', 1)}
                  </td>
                  {/* colonne VENT (Lot 6-B) */}
                  <td style={{ padding: '8px', border: '1px solid var(--border-subtle)' }}></td>
                  <td style={{ padding: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    {formatTime(totals?.estimatedTime || 0)}
                  </td>
                  {/* colSpan 5 : couvre jusqu'à la dernière colonne (l'off-by-one
                      pré-existant laissait un trou sous ESPACES AÉRIENS) */}
                  <td colSpan="5" style={{ padding: '8px', border: '1px solid var(--border-subtle)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 🔧 LOT 7 — Détail des calculs de cap (demande pilote : comprendre
              d'où sortent les chiffres de la colonne CAP). Exemple chiffré sur
              le premier segment disposant d'une déclinaison. */}
          {navigationData.length > 0 && (() => {
            // Préférer un segment tenable (revue lot 7 : ne jamais fabriquer un
            // « cap à piloter » pour un segment que le tableau marque ⚠)
            const ex = navigationData.find(s => s.hasDeclination && !s.windUntenable) ||
              navigationData.find(s => !s.windUntenable) ||
              navigationData[0];
            const fmtSigned = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 10) / 10)}°`;
            // Écarts affichés = différences des ENTIERS déjà affichés dans la
            // colonne CAP (sinon l'équation de l'exemple pouvait être fausse de
            // 1° à cause d'arrondis indépendants — revue lot 7)
            const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
            const decShown = ex.hasDeclination ? angDiff(ex.trueCourse, ex.magneticCourse) : null;
            const wcaShown = angDiff(ex.magneticHeading, ex.magneticCourse);
            return (
              <div className="pdf-avoid-break" style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: 'var(--bg-overlay)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--fs-caption)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Détail des calculs de cap
                </div>
                <div>
                  <strong>1. Route vraie (Vrai)</strong> — angle géographique du segment, mesuré sur la carte
                  (référence nord vrai).
                </div>
                <div>
                  <strong>2. Cap magnétique (Mag)</strong> = Route vraie − Déclinaison magnétique.
                  Déclinaison calculée au milieu de chaque segment par le modèle mondial WMM 2025
                  (déclinaison Est = positive, donc soustraite).
                </div>
                <div>
                  <strong>3. Cap corrigé du vent (Vent)</strong> = Cap magnétique + Dérive.
                  La dérive vient du triangle des vents (vent du segment à l'altitude prévue,
                  vitesse propre de l'avion) : c'est le cap à afficher au compas pour suivre la route.
                </div>
                {ex && (
                  <div style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    Exemple segment {ex.from} → {ex.to} :
                    {' '}{String(ex.trueCourse).padStart(3, '0')}° vrai
                    {ex.hasDeclination
                      ? ` − (${fmtSigned(decShown)} déclinaison) = ${String(ex.magneticCourse).padStart(3, '0')}° mag`
                      : ' (déclinaison indisponible — cap vrai conservé)'}
                    {ex.windUntenable
                      ? ' ; vent ≥ vitesse propre : segment intenable — aucun cap à piloter (⚠ dans le tableau)'
                      : wcaShown !== 0
                        ? ` ; dérive ${fmtSigned(wcaShown)} → cap à piloter ${String(ex.magneticHeading).padStart(3, '0')}°`
                        : ` ; vent nul ou inconnu → cap à piloter ${String(ex.magneticHeading).padStart(3, '0')}°`}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 🚨 Bannière zones réglementées/interdites - DÉTAILLÉE avec localisation */}
          {airspaceAnalysis && airspaceAnalysis.some(seg => seg.hasRestrictedZones) && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'var(--bg-overlay)',
              border: '2px solid var(--color-red-critical)',
              borderLeft: '6px solid var(--color-red-critical)',
              borderRadius: 'var(--radius-sm)'
            }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px'
                }}>
                  <AlertTriangle size={20} color="var(--color-red-critical)" />
                  <span style={{ color: 'var(--color-red-critical)', fontWeight: 'bold', fontSize: 'var(--fs-body)' }}>
                    🚫 ALERTE CRITIQUE : Votre route traverse des zones RÉGLEMENTÉES, INTERDITES ou DANGEREUSES !
                  </span>
                </div>

                {/* Liste détaillée des zones par segment */}
                <div style={{
                  backgroundColor: 'var(--bg-overlay)',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {(() => {
                    const segmentsWithZones = navigationData.filter(seg => seg.hasRestrictedZones);
                    console.log('🚨 Segments avec zones restreintes:', {
                      total: navigationData.length,
                      withZones: segmentsWithZones.length,
                      segments: segmentsWithZones.map(s => ({
                        id: s.segmentId,
                        from: s.from,
                        to: s.to,
                        zones: s.restrictedZones?.length || 0
                      })),
                      airspaceAnalysisAvailable: !!airspaceAnalysis,
                      airspaceAnalysisCount: airspaceAnalysis?.length || 0
                    });

                    // 🔍 Si aucun segment avec zones trouvé, afficher message debug
                    if (segmentsWithZones.length === 0) {
                      return (
                        <div style={{ color: 'var(--color-red-critical)', fontSize: 'var(--fs-caption)', padding: '8px' }}>
                          🔍 DEBUG: Aucun segment avec zones trouvé dans navigationData
                          <br />
                          <strong>Total segments:</strong> {navigationData.length}
                          <br />
                          <strong>AirspaceAnalysis disponible:</strong> {airspaceAnalysis ? 'Oui' : 'Non'}
                          <br />
                          <strong>Segments dans airspaceAnalysis:</strong> {airspaceAnalysis?.length || 0}
                          <br />
                          <strong>Segments avec hasRestrictedZones dans airspaceAnalysis:</strong>{' '}
                          {airspaceAnalysis?.filter(a => a.hasRestrictedZones).length || 0}
                          <br />
                          <em>Vérifiez la console pour plus de détails</em>
                        </div>
                      );
                    }

                    return segmentsWithZones.map((seg, idx) => (
                      <div key={idx} style={{
                        marginBottom: '12px',
                        paddingBottom: '12px',
                        borderBottom: idx < navigationData.filter(s => s.hasRestrictedZones).length - 1 ? '1px solid var(--bg-overlay)' : 'none'
                      }}>
                        {/* En-tête du segment */}
                        <div style={{
                          fontWeight: 'bold',
                          color: 'var(--color-red-critical)',
                          fontSize: 'var(--fs-body)',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{
                            backgroundColor: 'var(--color-red-critical)',
                            color: 'var(--text-primary)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--fs-caption)'
                          }}>
                            Segment {seg.index + 1}
                          </span>
                          <span>{seg.from} → {seg.to}</span>
                          <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'normal', color: 'var(--color-red-critical)' }}>
                            (Alt: {seg.altitude} ft)
                          </span>
                        </div>

                        {/* Liste des zones pour ce segment */}
                        {seg.restrictedZones.map((zone, zIdx) => (
                          <div key={zIdx} style={{
                            marginLeft: '12px',
                            marginTop: '6px',
                            padding: '8px',
                            backgroundColor: 'var(--bg-overlay)',
                            border: '1px solid var(--bg-overlay)',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            {/* Type et nom de la zone */}
                            <div style={{
                              fontSize: 'var(--fs-caption)',
                              fontWeight: 'bold',
                              color: 'var(--color-red-critical)',
                              marginBottom: '4px'
                            }}>
                              {zone.type === 'P' && '🚫 ZONE INTERDITE (P)'}
                              {zone.type === 'R' && '⚠️ ZONE RÉGLEMENTÉE (R)'}
                              {zone.type === 'D' && '⚠️ ZONE DANGEREUSE (D)'}
                              {zone.type === 'PROHIBITED' && '🚫 ZONE INTERDITE'}
                              {zone.type === 'RESTRICTED' && '⚠️ ZONE RÉGLEMENTÉE'}
                              {zone.type === 'DANGER' && '⚠️ ZONE DANGEREUSE'}
                              {' - '}{zone.name}
                            </div>

                            {/* Détails de la zone */}
                            <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-red-critical)', lineHeight: '1.4' }}>
                              <div>
                                <strong>Altitudes:</strong> {zone.floor_raw} ({zone.floor}ft) - {zone.ceiling_raw} ({zone.ceiling}ft)
                              </div>
                              {zone.activity && (
                                <div>
                                  <strong>Activité:</strong> {zone.activity}
                                </div>
                              )}
                              {zone.schedule && (
                                <div>
                                  <strong>Horaires activation:</strong> {zone.schedule}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>

                {/* Message d'action */}
                <div style={{
                  marginTop: '10px',
                  padding: '8px',
                  backgroundColor: 'var(--bg-overlay)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--color-red-critical)',
                  fontWeight: '500'
                }}>
                  ⚠️ <strong>ACTION REQUISE:</strong> Vérifiez les horaires d'activation, obtenez les autorisations nécessaires (clairances) ou modifiez votre route pour contourner ces zones avant le vol.
                </div>
            </div>
          )}

        </>
      )}
    </div>
  );
};

export default VFRNavigationTable;