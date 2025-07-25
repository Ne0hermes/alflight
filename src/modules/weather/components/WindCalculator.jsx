// src/modules/weather/components/WindCalculator.jsx
import React, { useState, useEffect } from 'react';
import { Wind, Navigation, Calculator, ArrowRight } from 'lucide-react';

export const WindCalculator = ({ trueAirspeed, trueCourse }) => {
  const [windDirection, setWindDirection] = useState(270);
  const [windSpeed, setWindSpeed] = useState(20);
  const [results, setResults] = useState({
    groundSpeed: 0,
    heading: 0,
    drift: 0,
    headwind: 0,
    crosswind: 0
  });

  useEffect(() => {
    calculateWindEffect();
  }, [trueAirspeed, trueCourse, windDirection, windSpeed]);

  const calculateWindEffect = () => {
    if (!trueAirspeed || !trueCourse) return;

    // Conversion en radians
    const tcRad = trueCourse * Math.PI / 180;
    const wdRad = windDirection * Math.PI / 180;
    
    // Calcul du vent effectif
    const windAngle = wdRad - tcRad;
    const headwind = windSpeed * Math.cos(windAngle);
    const crosswind = windSpeed * Math.sin(windAngle);
    
    // Calcul de la dérive
    const drift = Math.asin(crosswind / trueAirspeed) * 180 / Math.PI;
    
    // Cap à suivre
    const heading = trueCourse - drift;
    
    // Vitesse sol
    const groundSpeed = Math.sqrt(
      Math.pow(trueAirspeed * Math.cos(drift * Math.PI / 180) - headwind, 2) +
      Math.pow(trueAirspeed * Math.sin(drift * Math.PI / 180), 2)
    );

    setResults({
      groundSpeed: Math.round(groundSpeed),
      heading: Math.round((heading + 360) % 360),
      drift: Math.round(drift),
      headwind: Math.round(headwind),
      crosswind: Math.round(crosswind)
    });
  };

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
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Calculator size={20} />
        Calculateur de Vent
      </h3>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Entrées */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#4b5563' }}>
            Paramètres de vol
          </h4>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '13px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Vitesse propre (TAS) - kt
            </label>
            <input
              type="number"
              value={trueAirspeed || ''}
              readOnly
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                backgroundColor: '#f9fafb'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '13px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Route vraie - °
            </label>
            <input
              type="number"
              value={trueCourse || ''}
              readOnly
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px',
                backgroundColor: '#f9fafb'
              }}
            />
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#4b5563' }}>
            Conditions de vent
          </h4>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '13px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Direction du vent - °
            </label>
            <input
              type="number"
              value={windDirection}
              onChange={(e) => setWindDirection(parseInt(e.target.value) || 0)}
              min="0"
              max="360"
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '13px', 
              color: '#6b7280', 
              marginBottom: '4px' 
            }}>
              Vitesse du vent - kt
            </label>
            <input
              type="number"
              value={windSpeed}
              onChange={(e) => setWindSpeed(parseInt(e.target.value) || 0)}
              min="0"
              style={{ 
                width: '100%', 
                padding: '8px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div style={{ 
        backgroundColor: '#f9fafb', 
        borderRadius: '8px',
        padding: '16px'
      }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#4b5563' }}>
          Résultats du calcul
        </h4>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '12px'
        }}>
          <div style={{ 
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Vitesse sol
            </p>
            <p style={{ fontSize: '24px', fontWeight: '600', color: '#10b981' }}>
              {results.groundSpeed} kt
            </p>
          </div>

          <div style={{ 
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Cap magnétique
            </p>
            <p style={{ fontSize: '24px', fontWeight: '600', color: '#3b82f6' }}>
              {results.heading}°
            </p>
          </div>

          <div style={{ 
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Dérive
            </p>
            <p style={{ fontSize: '20px', fontWeight: '600', color: '#f59e0b' }}>
              {results.drift > 0 ? '+' : ''}{results.drift}°
            </p>
          </div>

          <div style={{ 
            padding: '12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Vent effectif
            </p>
            <p style={{ fontSize: '16px', fontWeight: '600' }}>
              <span style={{ color: results.headwind > 0 ? '#ef4444' : '#10b981' }}>
                {results.headwind > 0 ? '↑' : '↓'} {Math.abs(results.headwind)} kt
              </span>
              {' / '}
              <span style={{ color: '#8b5cf6' }}>
                {results.crosswind > 0 ? '→' : '←'} {Math.abs(results.crosswind)} kt
              </span>
            </p>
          </div>
        </div>

        {/* Triangle de vent visuel */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <svg width="200" height="150" viewBox="0 0 200 150" style={{ maxWidth: '100%' }}>
            {/* Grille de fond */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="200" height="150" fill="url(#grid)" />
            
            {/* Route vraie (TC) */}
            <line 
              x1="100" y1="100" 
              x2={100 + 60 * Math.sin(trueCourse * Math.PI / 180)} 
              y2={100 - 60 * Math.cos(trueCourse * Math.PI / 180)}
              stroke="#3b82f6" 
              strokeWidth="2"
              markerEnd="url(#arrowTC)"
            />
            <text x={100 + 70 * Math.sin(trueCourse * Math.PI / 180)} 
                  y={100 - 70 * Math.cos(trueCourse * Math.PI / 180)}
                  textAnchor="middle" 
                  fontSize="10" 
                  fill="#3b82f6">
              TC {trueCourse}°
            </text>
            
            {/* Cap (HDG) */}
            <line 
              x1="100" y1="100" 
              x2={100 + 60 * Math.sin(results.heading * Math.PI / 180)} 
              y2={100 - 60 * Math.cos(results.heading * Math.PI / 180)}
              stroke="#10b981" 
              strokeWidth="2"
              strokeDasharray="5,5"
              markerEnd="url(#arrowHDG)"
            />
            <text x={100 + 70 * Math.sin(results.heading * Math.PI / 180)} 
                  y={100 - 70 * Math.cos(results.heading * Math.PI / 180)}
                  textAnchor="middle" 
                  fontSize="10" 
                  fill="#10b981">
              HDG {results.heading}°
            </text>
            
            {/* Vecteur vent */}
            <line 
              x1="100" y1="100" 
              x2={100 + (windSpeed/2) * Math.sin(windDirection * Math.PI / 180)} 
              y2={100 - (windSpeed/2) * Math.cos(windDirection * Math.PI / 180)}
              stroke="#ef4444" 
              strokeWidth="2"
              markerEnd="url(#arrowWind)"
            />
            
            {/* Flèches */}
            <defs>
              <marker id="arrowTC" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
              </marker>
              <marker id="arrowHDG" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#10b981" />
              </marker>
              <marker id="arrowWind" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
              </marker>
            </defs>
            
            {/* Légende */}
            <text x="10" y="140" fontSize="8" fill="#6b7280">
              Vent: {windDirection}°/{windSpeed}kt
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};