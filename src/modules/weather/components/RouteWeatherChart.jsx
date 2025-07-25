// src/modules/weather/components/RouteWeatherChart.jsx
import React from 'react';
import { Cloud, Wind, Droplets, Eye } from 'lucide-react';

export const RouteWeatherChart = ({ routeWeather, waypoints }) => {
  if (!routeWeather || routeWeather.length === 0) {
    return (
      <div style={{ 
        padding: '32px', 
        textAlign: 'center', 
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderRadius: '8px'
      }}>
        Aucune donnée météo disponible pour la route
      </div>
    );
  }

  // Extraire les données pour le graphique
  const chartData = routeWeather.map((data, index) => {
    const forecast = data.weather?.forecast?.[0] || {};
    const temp = Math.round((forecast.t || 288) - 273.15);
    const windSpeed = Math.round(Math.sqrt(
      Math.pow(forecast.u10 || 0, 2) + Math.pow(forecast.v10 || 0, 2)
    ) * 1.94384);
    const cloudCover = Math.round(forecast.tcc || 0);
    const visibility = Math.round((forecast.vis || 10000) / 1000);
    
    return {
      waypoint: data.waypoint,
      temp,
      windSpeed,
      cloudCover,
      visibility,
      precipitation: forecast.tp || 0
    };
  });

  // Échelles pour le graphique
  const maxTemp = Math.max(...chartData.map(d => d.temp)) + 5;
  const minTemp = Math.min(...chartData.map(d => d.temp)) - 5;
  const maxWind = Math.max(...chartData.map(d => d.windSpeed)) + 10;

  return (
    <div style={{ 
      backgroundColor: 'white', 
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      padding: '20px'
    }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '600', 
        color: '#1f2937', 
        marginBottom: '20px'
      }}>
        📈 Profil Météo de la Route
      </h3>

      {/* Graphique SVG */}
      <div style={{ overflowX: 'auto' }}>
        <svg 
          width={Math.max(600, chartData.length * 100)} 
          height="300" 
          style={{ display: 'block' }}
        >
          {/* Grille de fond */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="300" fill="url(#grid)" />

          {/* Axes */}
          <line x1="50" y1="250" x2={chartData.length * 100} y2="250" stroke="#e5e7eb" strokeWidth="2" />
          <line x1="50" y1="50" x2="50" y2="250" stroke="#e5e7eb" strokeWidth="2" />

          {/* Échelle température (gauche) */}
          <text x="10" y="140" fontSize="12" fill="#6b7280" transform="rotate(-90 10 140)">
            Température (°C)
          </text>
          
          {/* Échelle vent (droite) */}
          <text x={chartData.length * 100 + 40} y="140" fontSize="12" fill="#6b7280" transform="rotate(90 40 140)">
            Vent (kt)
          </text>

          {/* Courbe de température */}
          <polyline
            points={chartData.map((d, i) => 
              `${50 + i * 100},${250 - ((d.temp - minTemp) / (maxTemp - minTemp)) * 200}`
            ).join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3"
          />

          {/* Courbe du vent */}
          <polyline
            points={chartData.map((d, i) => 
              `${50 + i * 100},${250 - (d.windSpeed / maxWind) * 200}`
            ).join(' ')}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeDasharray="5,5"
          />

          {/* Points et labels */}
          {chartData.map((d, i) => {
            const x = 50 + i * 100;
            const yTemp = 250 - ((d.temp - minTemp) / (maxTemp - minTemp)) * 200;
            const yWind = 250 - (d.windSpeed / maxWind) * 200;
            
            return (
              <g key={i}>
                {/* Point température */}
                <circle cx={x} cy={yTemp} r="5" fill="#ef4444" />
                <text x={x} y={yTemp - 10} textAnchor="middle" fontSize="10" fill="#ef4444">
                  {d.temp}°
                </text>

                {/* Point vent */}
                <circle cx={x} cy={yWind} r="5" fill="#3b82f6" />
                <text x={x} y={yWind + 20} textAnchor="middle" fontSize="10" fill="#3b82f6">
                  {d.windSpeed}kt
                </text>

                {/* Waypoint */}
                <text x={x} y="270" textAnchor="middle" fontSize="12" fill="#1f2937" fontWeight="600">
                  {d.waypoint}
                </text>

                {/* Symboles météo */}
                {d.cloudCover > 75 && (
                  <text x={x} y="30" textAnchor="middle" fontSize="20">☁️</text>
                )}
                {d.precipitation > 0 && (
                  <text x={x} y="30" textAnchor="middle" fontSize="20">🌧️</text>
                )}
              </g>
            );
          })}

          {/* Légende */}
          <g transform="translate(60, 20)">
            <line x1="0" y1="0" x2="20" y2="0" stroke="#ef4444" strokeWidth="3" />
            <text x="25" y="5" fontSize="12" fill="#6b7280">Température</text>
            
            <line x1="100" y1="0" x2="120" y2="0" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5,5" />
            <text x="125" y="5" fontSize="12" fill="#6b7280">Vent</text>
          </g>
        </svg>
      </div>

      {/* Tableau des conditions */}
      <div style={{ marginTop: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>Waypoint</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>
                <Cloud size={16} style={{ margin: '0 auto' }} />
              </th>
              <th style={{ padding: '8px', textAlign: 'center' }}>
                <Eye size={16} style={{ margin: '0 auto' }} />
              </th>
              <th style={{ padding: '8px', textAlign: 'center' }}>
                <Droplets size={16} style={{ margin: '0 auto' }} />
              </th>
              <th style={{ padding: '8px', textAlign: 'center' }}>Conditions</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px', fontWeight: '500' }}>{d.waypoint}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{d.cloudCover}%</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{d.visibility}km</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  {d.precipitation > 0 ? `${d.precipitation.toFixed(1)}mm` : '-'}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  {d.cloudCover < 25 ? '☀️ Clair' :
                   d.cloudCover < 50 ? '⛅ Peu nuageux' :
                   d.cloudCover < 75 ? '☁️ Nuageux' :
                   '☁️ Très nuageux'}
                  {d.precipitation > 0 && ' 🌧️'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Résumé */}
      <div style={{ 
        marginTop: '20px',
        padding: '12px',
        backgroundColor: '#e0f2fe',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#0c4a6e'
      }}>
        <p style={{ margin: '0', fontWeight: '600' }}>
          📊 Analyse de la route :
        </p>
        <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
          <li>Température moyenne : {Math.round(chartData.reduce((sum, d) => sum + d.temp, 0) / chartData.length)}°C</li>
          <li>Vent moyen : {Math.round(chartData.reduce((sum, d) => sum + d.windSpeed, 0) / chartData.length)} kt</li>
          <li>Visibilité minimale : {Math.min(...chartData.map(d => d.visibility))} km</li>
          <li>Couverture nuageuse maximale : {Math.max(...chartData.map(d => d.cloudCover))}%</li>
        </ul>
      </div>
    </div>
  );
};