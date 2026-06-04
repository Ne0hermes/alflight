// src/features/units/UnitsModule.jsx
import React from 'react';
import { Settings, Ruler, Thermometer, Gauge, Scale } from 'lucide-react';
import UnitsPreferences from './components/UnitsPreferences';

const UnitsModule = () => {
  return (
    <div style={{ padding: '20px' }}>
      {/* En-tête du module */}
      <div style={{ 
        backgroundColor: 'var(--bg-overlay)', 
        padding: '20px', 
        borderRadius: 'var(--radius-sm)', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
        marginBottom: '20px' 
      }}>
        <h2 style={{ 
          fontSize: 'var(--fs-title)', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Settings size={28} />
          Système d'Unités
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-body)' }}>
          Configuration des unités de mesure pour l'ensemble de l'application
        </p>
      </div>

      {/* Indicateurs visuels des unités actuelles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          backgroundColor: 'var(--bg-overlay)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Ruler size={20} color="var(--text-secondary)" />
          <div>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>Distance</p>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold' }}>NM / km</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-overlay)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Gauge size={20} color="var(--text-primary)" />
          <div>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>Altitude</p>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold' }}>ft / m</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-overlay)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Scale size={20} color="var(--accent-primary)" />
          <div>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>Poids</p>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold' }}>kg / lbs</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-overlay)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Thermometer size={20} color="var(--color-red-critical)" />
          <div>
            <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>Température</p>
            <p style={{ fontSize: 'var(--fs-body)', fontWeight: 'bold' }}>°C / °F</p>
          </div>
        </div>
      </div>

      {/* Composant des préférences d'unités */}
      <div style={{ 
        backgroundColor: 'var(--bg-overlay)', 
        borderRadius: 'var(--radius-sm)', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '20px'
      }}>
        <UnitsPreferences />
      </div>
    </div>
  );
};

export default UnitsModule;