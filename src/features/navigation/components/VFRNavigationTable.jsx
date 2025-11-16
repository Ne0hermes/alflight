// src/features/navigation/components/VFRNavigationTable.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Table, RefreshCw, Navigation2, Clock, Radio, Map, AlertTriangle, Sun, Sunset, Moon } from 'lucide-react';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { useUnits } from '@hooks/useUnits';
import { useUnitsWatcher } from '@hooks/useUnitsWatcher';
import { useAirspaceAnalysis } from '../hooks/useAirspaceAnalysis';
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

  // Calculer les données de navigation pour chaque segment
  const navigationData = useMemo(() => {
    if (!waypoints || waypoints.length < 2 || !selectedAircraft) return [];

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
      
      // Récupérer les données météo pour le point de départ
      const weather = weatherData[from.name]?.metar;
      let windSpeed = 0;
      let windDirection = 0;
      
      if (weather) {
        if (weather.wind) {
          windSpeed = weather.wind.speed_kts || weather.wind.speed || 0;
          windDirection = weather.wind.degrees || weather.wind.direction || 0;
        } else if (weather.wind_speed !== undefined) {
          windSpeed = weather.wind_speed?.value || 0;
          windDirection = weather.wind_direction?.value || 0;
        }
      }
      
      // Calculer la dérive et la vitesse sol
      const tas = selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100;
      let groundSpeed = tas;
      let windCorrectionAngle = 0;
      let magneticHeading = trueCourse;
      
      if (windSpeed > 0) {
        const windAngle = (windDirection - trueCourse + 360) % 360;
        const headwindComponent = windSpeed * Math.cos(windAngle * Math.PI / 180);
        const crosswindComponent = windSpeed * Math.sin(windAngle * Math.PI / 180);
        
        windCorrectionAngle = Math.asin(crosswindComponent / tas) * 180 / Math.PI;
        groundSpeed = tas - headwindComponent;
        magneticHeading = trueCourse + windCorrectionAngle;
      }
      
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
        trueCourse: Math.round(trueCourse),
        magneticHeading: Math.round(magneticHeading),
        distance: distance, // Garder la valeur brute pour conversion
        distanceDisplay: format(distance, 'distance', 1),
        windInfo: windSpeed > 0 ? `${windDirection}°/${format(windSpeed, 'windSpeed', 0)}` : 'Calme',
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
  }, [waypoints, selectedAircraft, plannedAltitude, weatherData, vacData, segmentAltitudes, airspaceAnalysis]);

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

    // Détecter les warnings
    const hasWarnings = segmentsAnalysis.some(seg =>
      seg.dayNightStatus?.warning || seg.dayNightStatus?.twilightWarning
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
        (selectedAircraft.fuelConsumptionLph || selectedAircraft.fuelConsumption || 30) : 0
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
      backgroundColor: 'white',
      borderRadius: '8px',
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
            fontSize: '18px',
            fontWeight: 'bold',
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
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
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
          {/* 🌅 Alerte jour/nuit si warnings détectés */}
          {dayNightAnalysis.hasWarnings && dayNightAnalysis.sunTimes && (
            <div style={{
              backgroundColor: '#fef3c7',
              border: '2px solid #f59e0b',
              borderLeft: '6px solid #d97706',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <Sunset size={18} color="#d97706" />
                <span style={{ fontWeight: 'bold', color: '#92400e', fontSize: '14px' }}>
                  ⚠️ ALERTE JOUR/NUIT : Une partie du vol se déroulera au crépuscule ou de nuit
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#78350f', lineHeight: '1.5' }}>
                <div><strong>Coucher du soleil :</strong> {formatSunTime(dayNightAnalysis.sunTimes.sunset)}</div>
                <div><strong>Début nuit aéronautique :</strong> {formatSunTime(dayNightAnalysis.sunTimes.nightStart)} (coucher + 30min)</div>
                <div><strong>Lever du soleil :</strong> {formatSunTime(dayNightAnalysis.sunTimes.sunrise)}</div>
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
              fontSize: '12px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb' }}>De</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb' }}>Vers</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>Alt ({getSymbol('altitude')})</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>CAP (°)</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>DIST ({getSymbol('distance')})</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>ETE</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', backgroundColor: '#f0f9ff' }}>HEURE THÉORIQUE</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', backgroundColor: '#fef9e5' }}>JOUR/NUIT</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', backgroundColor: '#fef3c7' }}>ATE</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', backgroundColor: '#fef3c7' }}>HEURE RÉELLE</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', backgroundColor: '#dbeafe' }}>ESPACES AÉRIENS & FRÉQUENCES</th>
                </tr>
              </thead>
              <tbody>
                {navigationData.map((seg, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                      {seg.from}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                      {seg.to}
                    </td>
                    <td style={{ padding: '4px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
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
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          textAlign: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          backgroundColor: '#fef3c7'
                        }}
                        min="0"
                        max="50000"
                        step="500"
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>
                      {seg.magneticHeading}°
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {seg.distanceDisplay || format(seg.distance, 'distance', 1)}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                      {formatTime(seg.estimatedTime)}
                    </td>
                    <td style={{
                      padding: '8px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                      backgroundColor: '#f0f9ff',
                      minWidth: '80px',
                      color: '#1e40af',
                      fontWeight: 'bold'
                    }}>
                      {departureTimeTheoretical ? addMinutesToTime(departureTimeTheoretical, seg.cumulativeETEMinutes) : '-'}
                    </td>

                    {/* Indicateur jour/nuit */}
                    <td style={{
                      padding: '8px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                      backgroundColor: '#fef9e5'
                    }}>
                      {(() => {
                        const segAnalysis = dayNightAnalysis.segments[idx];
                        if (!segAnalysis?.dayNightStatus) return '-';

                        const status = segAnalysis.dayNightStatus.status;
                        if (status === 'day') {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Sun size={14} color="#f59e0b" />
                              <span style={{ fontSize: '11px', color: '#92400e' }}>Jour</span>
                            </div>
                          );
                        } else if (status === 'twilight') {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Sunset size={14} color="#f59e0b" />
                              <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 'bold' }}>Crépuscule</span>
                            </div>
                          );
                        } else if (status === 'night') {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <Moon size={14} color="#7c3aed" />
                              <span style={{ fontSize: '11px', color: '#5b21b6', fontWeight: 'bold' }}>Nuit</span>
                            </div>
                          );
                        }
                        return '-';
                      })()}
                    </td>

                    <td style={{
                      padding: '8px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                      backgroundColor: '#fef3c7',
                      minWidth: '60px'
                    }}>
                      {/* Champ vide pour remplir pendant le vol */}
                    </td>
                    <td style={{
                      padding: '8px',
                      border: '1px solid #e5e7eb',
                      textAlign: 'center',
                      backgroundColor: '#fef3c7',
                      minWidth: '80px'
                    }}>
                      {/* Champ vide à remplir manuellement */}
                    </td>
                    {/* 🛫 Colonne Espaces aériens */}
                    <td style={{
                      padding: '6px',
                      border: '1px solid #e5e7eb',
                      fontSize: '11px',
                      backgroundColor: '#f0f9ff',
                      maxWidth: '200px'
                    }}>
                      {/* 🚨 ZONES RÉGLEMENTÉES/INTERDITES - Priorité 1 */}
                      {seg.hasRestrictedZones && (
                        <div style={{
                          marginBottom: '8px',
                          padding: '6px',
                          backgroundColor: '#e0f2fe',
                          border: '2px solid #0284c7',
                          borderRadius: '4px'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '4px',
                            color: '#0369a1',
                            fontWeight: 'bold',
                            fontSize: '12px'
                          }}>
                            <AlertTriangle size={16} />
                            <span>🚫 ZONE RÉGLEMENTÉE</span>
                          </div>
                          {seg.restrictedZones.map((zone, idx) => (
                            <div key={idx} style={{
                              marginTop: '4px',
                              padding: '4px',
                              backgroundColor: '#e0f2fe',
                              borderRadius: '3px',
                              border: '1px solid #0284c7'
                            }}>
                              <strong style={{ color: '#0369a1' }}>
                                {zone.type === 'P' && '🚫 INTERDITE'}
                                {zone.type === 'R' && '⚠️ RÉGLEMENTÉE'}
                                {zone.type === 'D' && '⚠️ DANGEREUSE'}
                                {zone.type === 'PROHIBITED' && '🚫 INTERDITE'}
                                {zone.type === 'RESTRICTED' && '⚠️ RÉGLEMENTÉE'}
                                {zone.type === 'DANGER' && '⚠️ DANGEREUSE'}
                              </strong>
                              {' '}{zone.name}
                              <br />
                              <span style={{ fontSize: '10px', color: '#075985' }}>
                                {zone.floor_raw} - {zone.ceiling_raw}
                              </span>
                              {zone.activity && (
                                <>
                                  <br />
                                  <span style={{ fontSize: '9px', color: '#075985', fontStyle: 'italic' }}>
                                    Activité: {zone.activity}
                                  </span>
                                </>
                              )}
                              {zone.schedule && (
                                <>
                                  <br />
                                  <span style={{ fontSize: '9px', color: '#075985', fontStyle: 'italic' }}>
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
                              backgroundColor: '#e0f2fe',
                              borderRadius: '3px',
                              border: '1px solid #0284c7'
                            }}>
                              <div style={{ marginBottom: '2px' }}>
                                <strong>{airspace.type}</strong> {airspace.name}
                                <br />
                                <span style={{ fontSize: '10px', color: '#666' }}>
                                  Classe {airspace.class} | {airspace.floor_raw} ({airspace.floor}ft) - {airspace.ceiling_raw} ({airspace.ceiling}ft)
                                </span>
                              </div>
                              {/* 📻 Fréquences de cet espace */}
                              {airspace.frequencies && airspace.frequencies.length > 0 && (
                                <div style={{
                                  marginTop: '3px',
                                  paddingTop: '3px',
                                  borderTop: '1px solid #94a3b8'
                                }}>
                                  {airspace.frequencies.map((freq, fIdx) => (
                                    <div key={fIdx} style={{
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      color: '#1e40af',
                                      marginBottom: '1px'
                                    }}>
                                      📻 {freq.frequency} ({freq.type})
                                      {freq.schedule && (
                                        <span style={{ fontSize: '9px', fontWeight: 'normal', color: '#64748b', marginLeft: '4px' }}>
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
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}

                      {/* ℹ️ ESPACES INFORMATIFS (FIR, ATZ, SIV, etc.) */}
                      {seg.informationalAirspaces && seg.informationalAirspaces.length > 0 && (
                        <div style={{ marginTop: seg.airspaces.length > 0 ? '8px' : '0' }}>
                          {seg.informationalAirspaces.map((airspace, idx) => (
                            <div key={idx} style={{
                              marginBottom: '4px',
                              padding: '4px',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '3px',
                              border: '1px solid #9ca3af'
                            }}>
                              <div style={{ marginBottom: '2px' }}>
                                <strong>{airspace.type}</strong> {airspace.name}
                                <br />
                                <span style={{ fontSize: '10px', color: '#666' }}>
                                  Classe {airspace.class} | {airspace.floor_raw} ({airspace.floor}ft) - {airspace.ceiling_raw} ({airspace.ceiling}ft)
                                </span>
                              </div>
                              {/* 📻 Fréquences de cet espace */}
                              {airspace.frequencies && airspace.frequencies.length > 0 && (
                                <div style={{
                                  marginTop: '3px',
                                  paddingTop: '3px',
                                  borderTop: '1px solid #9ca3af'
                                }}>
                                  {airspace.frequencies.map((freq, fIdx) => (
                                    <div key={fIdx} style={{
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      color: '#4b5563',
                                      marginBottom: '1px'
                                    }}>
                                      📻 {freq.frequency} ({freq.type})
                                      {freq.schedule && (
                                        <span style={{ fontSize: '9px', fontWeight: 'normal', color: '#64748b', marginLeft: '4px' }}>
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
                <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                  <td colSpan="5" style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                    TOTAUX:
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    {format(totals?.distance || 0, 'distance', 1)}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    {formatTime(totals?.estimatedTime || 0)}
                  </td>
                  <td colSpan="4" style={{ padding: '8px', border: '1px solid #e5e7eb' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 🚨 Bannière zones réglementées/interdites - DÉTAILLÉE avec localisation */}
          {airspaceAnalysis && airspaceAnalysis.some(seg => seg.hasRestrictedZones) && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fef2f2',
              border: '2px solid #dc2626',
              borderLeft: '6px solid #991b1b',
              borderRadius: '4px'
            }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px'
                }}>
                  <AlertTriangle size={20} color="#991b1b" />
                  <span style={{ color: '#991b1b', fontWeight: 'bold', fontSize: '14px' }}>
                    🚫 ALERTE CRITIQUE : Votre route traverse des zones RÉGLEMENTÉES, INTERDITES ou DANGEREUSES !
                  </span>
                </div>

                {/* Liste détaillée des zones par segment */}
                <div style={{
                  backgroundColor: 'white',
                  padding: '10px',
                  borderRadius: '4px',
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
                        <div style={{ color: '#dc2626', fontSize: '11px', padding: '8px' }}>
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
                        borderBottom: idx < navigationData.filter(s => s.hasRestrictedZones).length - 1 ? '1px solid #fee2e2' : 'none'
                      }}>
                        {/* En-tête du segment */}
                        <div style={{
                          fontWeight: 'bold',
                          color: '#dc2626',
                          fontSize: '12px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{
                            backgroundColor: '#dc2626',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '11px'
                          }}>
                            Segment {seg.index + 1}
                          </span>
                          <span>{seg.from} → {seg.to}</span>
                          <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#7f1d1d' }}>
                            (Alt: {seg.altitude} ft)
                          </span>
                        </div>

                        {/* Liste des zones pour ce segment */}
                        {seg.restrictedZones.map((zone, zIdx) => (
                          <div key={zIdx} style={{
                            marginLeft: '12px',
                            marginTop: '6px',
                            padding: '8px',
                            backgroundColor: '#fef2f2',
                            border: '1px solid #fca5a5',
                            borderRadius: '4px'
                          }}>
                            {/* Type et nom de la zone */}
                            <div style={{
                              fontSize: '11px',
                              fontWeight: 'bold',
                              color: '#991b1b',
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
                            <div style={{ fontSize: '10px', color: '#7f1d1d', lineHeight: '1.4' }}>
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
                  backgroundColor: '#fee2e2',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#7f1d1d',
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