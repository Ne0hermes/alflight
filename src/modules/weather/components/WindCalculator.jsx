// src/modules/weather/components/WindCalculator.jsx
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Wind, Navigation, Calculator, ArrowRight } from 'lucide-react';

// Styles constants
const styles = {
  container: { 
    backgroundColor: 'white', 
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '20px'
  },
  title: { 
    fontSize: '18px', 
    fontWeight: '600', 
    color: '#1f2937', 
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  sectionTitle: { 
    fontSize: '14px', 
    fontWeight: '600', 
    marginBottom: '12px', 
    color: '#4b5563' 
  },
  label: { 
    display: 'block', 
    fontSize: '13px', 
    color: '#6b7280', 
    marginBottom: '4px' 
  },
  input: { 
    width: '100%', 
    padding: '8px 12px', 
    border: '1px solid #d1d5db', 
    borderRadius: '6px'
  },
  readOnlyInput: { 
    width: '100%', 
    padding: '8px 12px', 
    border: '1px solid #d1d5db', 
    borderRadius: '6px',
    backgroundColor: '#f9fafb'
  },
  resultsContainer: { 
    backgroundColor: '#f9fafb', 
    borderRadius: '8px',
    padding: '16px'
  },
  resultCard: { 
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '6px',
    textAlign: 'center'
  },
  resultLabel: { 
    fontSize: '12px', 
    color: '#6b7280', 
    marginBottom: '4px' 
  }
};

// Composant pour afficher un résultat
const ResultCard = memo(({ label, value, color = '#10b981' }) => (
  <div style={styles.resultCard}>
    <p style={styles.resultLabel}>{label}</p>
    <p style={{ fontSize: '24px', fontWeight: '600', color }}>{value}</p>
  </div>
));

// Composant SVG mémorisé pour le triangle de vent
const WindTriangleSVG = memo(({ trueCourse, heading, windDirection, windSpeed }) => {
  const tcRadians = trueCourse * Math.PI / 180;
  const hdgRadians = heading * Math.PI / 180;
  const wdRadians = windDirection * Math.PI / 180;

  // Points pour le dessin
  const tcX = 100 + 60 * Math.sin(tcRadians);
  const tcY = 100 - 60 * Math.cos(tcRadians);
  const hdgX = 100 + 60 * Math.sin(hdgRadians);
  const hdgY = 100 - 60 * Math.cos(hdgRadians);
  const windX = 100 + (windSpeed / 2) * Math.sin(wdRadians);
  const windY = 100 - (windSpeed / 2) * Math.cos(wdRadians);

  return (
    <svg width="200" height="150" viewBox="0 0 200 150" style={{ maxWidth: '100%' }}>
      {/* Grille de fond */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
        </pattern>
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
      <rect width="200" height="150" fill="url(#grid)" />
      
      {/* Route vraie (TC) */}
      <line x1="100" y1="100" x2={tcX} y2={tcY} stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowTC)" />
      <text x={100 + 70 * Math.sin(tcRadians)} y={100 - 70 * Math.cos(tcRadians)} textAnchor="middle" fontSize="10" fill="#3b82f6">
        TC {trueCourse}°
      </text>
      
      {/* Cap (HDG) */}
      <line x1="100" y1="100" x2={hdgX} y2={hdgY} stroke="#10b981" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowHDG)" />
      <text x={100 + 70 * Math.sin(hdgRadians)} y={100 - 70 * Math.cos(hdgRadians)} textAnchor="middle" fontSize="10" fill="#10b981">
        HDG {heading}°
      </text>
      
      {/* Vecteur vent */}
      <line x1="100" y1="100" x2={windX} y2={windY} stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowWind)" />
      
      {/* Légende */}
      <text x="10" y="140" fontSize="8" fill="#6b7280">
        Vent: {windDirection}°/{windSpeed}kt
      </text>
    </svg>
  );
});

export const WindCalculator = memo(({ trueAirspeed, trueCourse }) => {
  const [windDirection, setWindDirection] = useState(270);
  const [windSpeed, setWindSpeed] = useState(20);

  // Calcul optimisé des effets du vent
  const results = useMemo(() => {
    if (!trueAirspeed || !trueCourse) {
      return {
        groundSpeed: 0,
        heading: 0,
        drift: 0,
        headwind: 0,
        crosswind: 0
      };
    }

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

    return {
      groundSpeed: Math.round(groundSpeed),
      heading: Math.round((heading + 360) % 360),
      drift: Math.round(drift),
      headwind: Math.round(headwind),
      crosswind: Math.round(crosswind)
    };
  }, [trueAirspeed, trueCourse, windDirection, windSpeed]);

  // Handlers mémorisés
  const handleWindDirectionChange = useCallback((e) => {
    setWindDirection(parseInt(e.target.value) || 0);
  }, []);

  const handleWindSpeedChange = useCallback((e) => {
    setWindSpeed(parseInt(e.target.value) || 0);
  }, []);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>
        <Calculator size={20} />
        Calculateur de Vent
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Entrées */}
        <div>
          <h4 style={styles.sectionTitle}>
            Paramètres de vol
          </h4>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={styles.label}>
              Vitesse propre (TAS) - kt
            </label>
            <input
              type="number"
              value={trueAirspeed || ''}
              readOnly
              style={styles.readOnlyInput}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={styles.label}>
              Route vraie - °
            </label>
            <input
              type="number"
              value={trueCourse || ''}
              readOnly
              style={styles.readOnlyInput}
            />
          </div>
        </div>

        <div>
          <h4 style={styles.sectionTitle}>
            Conditions de vent
          </h4>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={styles.label}>
              Direction du vent - °
            </label>
            <input
              type="number"
              value={windDirection}
              onChange={handleWindDirectionChange}
              min="0"
              max="360"
              style={styles.input}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={styles.label}>
              Vitesse du vent - kt
            </label>
            <input
              type="number"
              value={windSpeed}
              onChange={handleWindSpeedChange}
              min="0"
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div style={styles.resultsContainer}>
        <h4 style={styles.sectionTitle}>
          Résultats du calcul
        </h4>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <ResultCard label="Vitesse sol" value={`${results.groundSpeed} kt`} color="#10b981" />
          <ResultCard label="Cap magnétique" value={`${results.heading}°`} color="#3b82f6" />
          <ResultCard label="Dérive" value={`${results.drift > 0 ? '+' : ''}${results.drift}°`} color="#f59e0b" />
          
          <div style={styles.resultCard}>
            <p style={styles.resultLabel}>Vent effectif</p>
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
          <WindTriangleSVG
            trueCourse={trueCourse}
            heading={results.heading}
            windDirection={windDirection}
            windSpeed={windSpeed}
          />
        </div>
      </div>
    </div>
  );
});