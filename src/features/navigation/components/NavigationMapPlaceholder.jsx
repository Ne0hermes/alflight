import React from 'react';
import { Map as MapIcon } from 'lucide-react';

const NavigationMapPlaceholder = ({ waypoints = [] }) => {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ 
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <MapIcon size={20} />
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          margin: 0
        }}>
          Carte de navigation
        </h3>
      </div>

      <div style={{
        height: '400px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #d1d5db'
      }}>
        <MapIcon size={48} color="#9ca3af" />
        <p style={{
          marginTop: '16px',
          fontSize: '16px',
          color: '#6b7280',
          fontWeight: '500'
        }}>
          Carte à implémenter
        </p>
        {waypoints.length > 0 && (
          <p style={{
            marginTop: '8px',
            fontSize: '14px',
            color: '#9ca3af'
          }}>
            {waypoints.length} waypoint{waypoints.length > 1 ? 's' : ''} défini{waypoints.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#1e40af'
      }}>
        💡 La carte interactive sera implémentée prochainement. 
        Elle affichera la route, les espaces aériens et les aérodromes.
      </div>
    </div>
  );
};

export default NavigationMapPlaceholder;