// src/features/navigation/components/VFRNavigationTable.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { Table, Download, Printer, RefreshCw, Navigation2, Clock, Wind, Radio, Map, Copy, Check } from 'lucide-react';
import { useWeatherStore } from '@core/stores/weatherStore';
import { useVACStore } from '@core/stores/vacStore';
import { useUnits } from '@hooks/useUnits';

const VFRNavigationTable = ({ 
  waypoints, 
  selectedAircraft, 
  plannedAltitude = 3000,
  flightType,
  navigationResults 
}) => {
  const [showTable, setShowTable] = useState(false);
  const [copied, setCopied] = useState(false);
  const { format, convert, getSymbol } = useUnits();
  
  // Récupérer les données météo et VAC
  const weatherData = useWeatherStore(state => state.weatherData) || {};
  const fetchWeather = useWeatherStore(state => state.fetchWeather);
  const vacData = useVACStore(state => state.vacData) || {};
  
  // Charger automatiquement les données météo pour tous les waypoints
  useEffect(() => {
    if (waypoints && waypoints.length > 0) {
      waypoints.forEach(wp => {
        if (wp.name && wp.name.match(/^[A-Z]{4}$/) && !weatherData[wp.name]) {
          fetchWeather(wp.name).catch(err => 
            console.warn(`Pas de données météo pour ${wp.name}`)
          );
        }
      });
    }
  }, [waypoints, weatherData, fetchWeather]);

  // Calculer les données de navigation pour chaque segment
  const navigationData = useMemo(() => {
    if (!waypoints || waypoints.length < 2 || !selectedAircraft) return [];

    const segments = [];
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      
      // Vérifier que les coordonnées sont valides
      if (!from.lat || !from.lon || !to.lat || !to.lon) {
        console.warn(`Coordonnées manquantes pour le segment ${from.name} -> ${to.name}`);
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
      
      segments.push({
        index: i,
        from: from.name || `WP${i+1}`,
        to: to.name || `WP${i+2}`,
        altitude: plannedAltitude,
        trueCourse: Math.round(trueCourse),
        magneticHeading: Math.round(magneticHeading),
        distance: Math.round(distance),
        windInfo: windSpeed > 0 ? `${windDirection}°/${windSpeed}kt` : 'Calme',
        windCorrectionAngle: Math.round(windCorrectionAngle),
        groundSpeed: Math.round(groundSpeed),
        estimatedTime: Math.round(timeMinutes),
        actualTime: '', // À remplir pendant le vol
        frequencies: frequencies.join(', ') || 'N/A',
        msa: Math.round(msa),
        position: {
          lat: to.lat ? to.lat.toFixed(4) : 'N/A',
          lon: to.lon ? to.lon.toFixed(4) : 'N/A'
        }
      });
    }
    
    return segments;
  }, [waypoints, selectedAircraft, plannedAltitude, weatherData, vacData]);

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
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}:${String(mins).padStart(2, '0')}` : `0:${String(mins).padStart(2, '0')}`;
  };

  // Exporter le tableau en CSV
  const exportToCSV = () => {
    const headers = ['Segment', 'De', 'Vers', 'Alt(ft)', 'Cap(°)', 'Dist(NM)', 'Vent', 'Dérive(°)', 'GS(kt)', 'Temps Est.', 'Temps Réel', 'Freq', 'MSA(ft)'];
    const rows = navigationData.map((seg, idx) => [
      `${idx + 1}`,
      seg.from,
      seg.to,
      seg.altitude,
      seg.magneticHeading,
      seg.distance,
      seg.windInfo,
      seg.windCorrectionAngle,
      seg.groundSpeed,
      formatTime(seg.estimatedTime),
      seg.actualTime,
      seg.frequencies,
      seg.msa
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `navigation_vfr_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Copier le tableau formaté dans le presse-papiers
  const copyToClipboard = () => {
    const tableText = navigationData.map((seg, idx) => 
      `${idx + 1}. ${seg.from} → ${seg.to} | ${seg.altitude}ft | ${seg.magneticHeading}° | ${seg.distance}NM | ${seg.windInfo} | GS:${seg.groundSpeed}kt | ETE:${formatTime(seg.estimatedTime)} | ${seg.frequencies}`
    ).join('\n');
    
    const summary = `
NAVIGATION VFR - ${new Date().toLocaleDateString()}
Avion: ${selectedAircraft?.registration || 'N/A'}
Route: ${waypoints[0]?.name || 'DEP'} → ${waypoints[waypoints.length-1]?.name || 'ARR'}
Distance totale: ${totals?.distance || 0}NM
Temps estimé: ${formatTime(totals?.estimatedTime || 0)}
Carburant requis: ${Math.round(totals?.fuelRequired || 0)}L

${tableText}`;
    
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Imprimer le tableau
  const printTable = () => {
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Navigation VFR - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: monospace; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #333; padding: 4px 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .header { margin-bottom: 20px; }
          .totals { margin-top: 20px; font-weight: bold; }
          @media print { body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>TABLEAU DE NAVIGATION VFR</h2>
          <p>Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
          <p>Avion: ${selectedAircraft?.registration || 'N/A'} - ${selectedAircraft?.model || 'N/A'}</p>
          <p>Route: ${waypoints[0]?.name || 'DEP'} → ${waypoints[waypoints.length-1]?.name || 'ARR'}</p>
          <p>Type de vol: ${flightType?.rules || 'VFR'} - ${flightType?.period || 'Jour'}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>De</th>
              <th>Vers</th>
              <th>Alt</th>
              <th>CAP</th>
              <th>DIST</th>
              <th>VENT</th>
              <th>DER</th>
              <th>GS</th>
              <th>ETE</th>
              <th>ATE</th>
              <th>FREQ</th>
              <th>MSA</th>
            </tr>
          </thead>
          <tbody>
            ${navigationData.map((seg, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${seg.from}</td>
                <td>${seg.to}</td>
                <td>${seg.altitude}</td>
                <td>${seg.magneticHeading}°</td>
                <td>${seg.distance}</td>
                <td>${seg.windInfo}</td>
                <td>${seg.windCorrectionAngle > 0 ? '+' : ''}${seg.windCorrectionAngle}°</td>
                <td>${seg.groundSpeed}</td>
                <td>${formatTime(seg.estimatedTime)}</td>
                <td>____</td>
                <td>${seg.frequencies}</td>
                <td>${seg.msa}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <p>Distance totale: ${totals?.distance || 0} NM</p>
          <p>Temps estimé total: ${formatTime(totals?.estimatedTime || 0)}</p>
          <p>Carburant requis: ${Math.round(totals?.fuelRequired || 0)} L</p>
          <p>Réserve réglementaire: ${navigationResults?.regulationReserveMinutes || 30} min (${Math.round(navigationResults?.regulationReserveLiters || 0)} L)</p>
        </div>
        
        <div style="margin-top: 30px;">
          <p>Notes de vol:</p>
          <div style="border: 1px solid #333; height: 100px; margin-top: 10px;"></div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
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
      </div>

      {showTable && (
        <>
          {/* Informations de vol */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div>
                <strong>Avion:</strong> {selectedAircraft.registration}
              </div>
              <div>
                <strong>Type:</strong> {flightType?.rules || 'VFR'} {flightType?.period || 'Jour'}
              </div>
              <div>
                <strong>Altitude:</strong> {plannedAltitude} ft
              </div>
              <div>
                <strong>TAS:</strong> {selectedAircraft.cruiseSpeedKt || selectedAircraft.cruiseSpeed || 100} kt
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <button
              onClick={exportToCSV}
              style={{
                padding: '6px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Download size={14} />
              CSV
            </button>
            
            <button
              onClick={printTable}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Printer size={14} />
              Imprimer
            </button>
            
            <button
              onClick={copyToClipboard}
              style={{
                padding: '6px 12px',
                backgroundColor: copied ? '#10b981' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copié!' : 'Copier'}
            </button>
          </div>

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
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>Alt (ft)</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>CAP (°)</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>DIST (NM)</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>VENT</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>DÉR (°)</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>GS (kt)</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>ETE</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', backgroundColor: '#fef3c7' }}>ATE</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb' }}>FREQ</th>
                  <th style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>MSA (ft)</th>
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
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {seg.altitude}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: '#3b82f6' }}>
                      {seg.magneticHeading}°
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {seg.distance}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontSize: '11px' }}>
                      {seg.windInfo}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {seg.windCorrectionAngle > 0 ? '+' : ''}{seg.windCorrectionAngle}°
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {seg.groundSpeed}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>
                      {formatTime(seg.estimatedTime)}
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
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontSize: '11px' }}>
                      {seg.frequencies}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {seg.msa}
                    </td>
                  </tr>
                ))}
                
                {/* Ligne des totaux */}
                <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold' }}>
                  <td colSpan="5" style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'right' }}>
                    TOTAUX:
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    {totals?.distance || 0}
                  </td>
                  <td colSpan="3" style={{ padding: '8px', border: '1px solid #e5e7eb' }}></td>
                  <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                    {formatTime(totals?.estimatedTime || 0)}
                  </td>
                  <td colSpan="3" style={{ padding: '8px', border: '1px solid #e5e7eb' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            fontSize: '11px'
          }}>
            <strong>Légende:</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
              <div><strong>Alt:</strong> Altitude de vol</div>
              <div><strong>CAP:</strong> Cap magnétique corrigé</div>
              <div><strong>DIST:</strong> Distance en miles nautiques</div>
              <div><strong>DÉR:</strong> Dérive due au vent</div>
              <div><strong>GS:</strong> Ground Speed (vitesse sol)</div>
              <div><strong>ETE:</strong> Temps estimé (Estimated)</div>
              <div style={{ backgroundColor: '#fef3c7', padding: '2px 4px', borderRadius: '3px' }}>
                <strong>ATE:</strong> Temps réel (à remplir)
              </div>
              <div><strong>MSA:</strong> Altitude minimale de sécurité</div>
            </div>
          </div>

          {/* Informations supplémentaires */}
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <strong>Carburant:</strong> Requis: {Math.round(totals?.fuelRequired || 0)}L | 
            Réserve: {navigationResults?.regulationReserveMinutes || 30}min ({Math.round(navigationResults?.regulationReserveLiters || 0)}L) | 
            Total: {Math.round((totals?.fuelRequired || 0) + (navigationResults?.regulationReserveLiters || 0))}L
          </div>
        </>
      )}
    </div>
  );
};

export default VFRNavigationTable;