// src/features/units/UnitsModule.jsx
import React from 'react';
import { Settings, Ruler, Thermometer, Gauge, Scale } from 'lucide-react';
import UnitsPreferences from './components/UnitsPreferences';

const UnitsModule = () => {
  return (
    <div style={{ padding: '20px' }}>
      {/* En-tête du module */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
        marginBottom: '20px' 
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Settings size={28} />
          Système d'Unités
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
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
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Ruler size={20} color="#3b82f6" />
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Distance</p>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>NM / km</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Gauge size={20} color="#10b981" />
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Altitude</p>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>ft / m</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Scale size={20} color="#f59e0b" />
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Poids</p>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>kg / lbs</p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Thermometer size={20} color="#ef4444" />
          <div>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>Température</p>
            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>°C / °F</p>
          </div>
        </div>
      </div>

      {/* Composant des préférences d'unités */}
      <div style={{ 
        backgroundColor: 'white', 
        borderRadius: '8px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '20px'
      }}>
        <UnitsPreferences />
      </div>
    </div>
  );
};

export default UnitsModule;