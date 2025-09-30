// src/features/aircraft/components/SpeedLimitationChart.jsx
import React, { memo } from 'react';

const SpeedLimitationChart = memo(({ speeds }) => {
  // Extraction des vitesses
  const vso = parseFloat(speeds?.vso) || 0;
  const vs1 = parseFloat(speeds?.vs1) || 0;
  const vfeLdg = parseFloat(speeds?.vfeLdg) || parseFloat(speeds?.vfe) || 0;
  const vfeTO = parseFloat(speeds?.vfeTO) || 0;
  const vno = parseFloat(speeds?.vno) || 0;
  const vne = parseFloat(speeds?.vne) || 0;
  
  // VO - Déterminer la vitesse VO basée sur la masse actuelle
  const voSpeed1 = parseFloat(speeds?.voSpeed1) || 0;
  const voSpeed2 = parseFloat(speeds?.voSpeed2) || 0;
  const voSpeed3 = parseFloat(speeds?.voSpeed3) || 0;
  const vo = Math.max(voSpeed1, voSpeed2, voSpeed3);
  
  // Calculer la vitesse max pour l'échelle
  const maxSpeed = Math.max(vne * 1.1, 200);
  const scale = 100 / maxSpeed;

  return (
    <div style={{
      backgroundColor: '#1f2937',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <h6 style={{ 
        fontSize: '13px', 
        fontWeight: 'bold', 
        marginBottom: '12px', 
        color: '#ffffff' 
      }}>
        🎯 Arcs de limitation de vitesse (Airspeed Indicator Markings)
      </h6>
      
      {/* Indicateur visuel des arcs */}
      <div style={{
        backgroundColor: '#374151',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '16px',
        position: 'relative',
        minHeight: '120px'
      }}>
        {/* Échelle de vitesse */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '20px',
          right: '20px',
          height: '4px',
          backgroundColor: '#4b5563',
          borderRadius: '2px'
        }}>
          {/* Arc blanc - Volets sortis (Vso à VfeLdg) */}
          {vso > 0 && vfeLdg > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vso * scale}%`,
                width: `${(vfeLdg - vso) * scale}%`,
                height: '20px',
                backgroundColor: 'white',
                bottom: '0',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
              title={`Arc blanc: ${vso} - ${vfeLdg} kt (Plage volets)`}
            />
          )}
          
          {/* Arc vert - Vol normal (Vs1 à Vno) */}
          {vs1 > 0 && vno > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vs1 * scale}%`,
                width: `${(vno - vs1) * scale}%`,
                height: '20px',
                backgroundColor: '#10b981',
                bottom: '25px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
              title={`Arc vert: ${vs1} - ${vno} kt (Plage normale)`}
            />
          )}
          
          {/* Arc jaune - Précaution (Vno à Vne) */}
          {vno > 0 && vne > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vno * scale}%`,
                width: `${(vne - vno) * scale}%`,
                height: '20px',
                backgroundColor: '#fbbf24',
                bottom: '25px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
              title={`Arc jaune: ${vno} - ${vne} kt (Précaution)`}
            />
          )}
          
          {/* Trait rouge - Vne */}
          {vne > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vne * scale}%`,
                width: '3px',
                height: '40px',
                backgroundColor: '#dc2626',
                bottom: '15px',
                borderRadius: '2px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
              title={`Trait rouge: ${vne} kt (Ne jamais dépasser)`}
            />
          )}
          
          {/* Trait blanc - VFE T/O */}
          {vfeTO > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vfeTO * scale}%`,
                width: '2px',
                height: '30px',
                backgroundColor: 'white',
                bottom: '10px',
                borderRadius: '1px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
              title={`VFE T/O: ${vfeTO} kt (Max volets décollage)`}
            />
          )}
          
          {/* Trait blanc pointillé - VO */}
          {vo > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vo * scale}%`,
                width: '2px',
                height: '35px',
                background: 'repeating-linear-gradient(to bottom, white 0px, white 4px, transparent 4px, transparent 8px)',
                bottom: '12px',
                borderRadius: '1px',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
              }}
              title={`VO: ${vo} kt (Operating manoeuvring speed)`}
            />
          )}
        </div>
        
        {/* Graduations et labels */}
        <div style={{
          position: 'absolute',
          bottom: '60px',
          left: '20px',
          right: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#9ca3af'
        }}>
          <span>0</span>
          <span>{Math.round(maxSpeed * 0.25)}</span>
          <span>{Math.round(maxSpeed * 0.5)}</span>
          <span>{Math.round(maxSpeed * 0.75)}</span>
          <span>{Math.round(maxSpeed)} kt</span>
        </div>
      </div>
      
      {/* Légende */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        fontSize: '11px',
        color: '#9ca3af'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '10px',
            backgroundColor: 'white',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#d1d5db' }}>
            <strong>Arc blanc:</strong> VSO-VFE (Volets)
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '10px',
            backgroundColor: '#10b981',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#d1d5db' }}>
            <strong>Arc vert:</strong> VS1-VNO (Normal)
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '10px',
            backgroundColor: '#fbbf24',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#d1d5db' }}>
            <strong>Arc jaune:</strong> VNO-VNE (Précaution)
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '10px',
            backgroundColor: '#dc2626',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#d1d5db' }}>
            <strong>Trait rouge:</strong> VNE (Ne jamais dépasser)
          </span>
        </div>
      </div>
    </div>
  );
});

SpeedLimitationChart.displayName = 'SpeedLimitationChart';

export default SpeedLimitationChart;