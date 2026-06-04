// src/features/aircraft/components/SpeedLimitationChart.jsx
//
// EXCEPTION CHARTE (data-viz réglementaire) : les arcs de l'anémomètre — blanc
// (#ffffff, plage volets), vert (#10b981, Vs1–Vno), jaune (#fbbf24, Vno–Vne)
// et rouge (#dc2626, Vne) — sont des MARQUAGES NORMALISÉS OACI/EASA et ne
// doivent PAS être « orangifiés ». Seul le chrome (fonds/texte gris) est migré
// vers les tokens charte var(--*).
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
      backgroundColor: 'var(--bg-surface)',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <h6 style={{ 
        fontSize: 'var(--fs-body)', 
        fontWeight: 'bold', 
        marginBottom: '12px', 
        color: '#ffffff' 
      }}>
        🎯 Arcs de limitation de vitesse (Airspeed Indicator Markings)
      </h6>
      
      {/* Indicateur visuel des arcs */}
      <div style={{
        backgroundColor: 'var(--bg-overlay)',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '16px',
        position: 'relative',
        minHeight: '160px'
      }}>
        {/* Échelle de vitesse */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '20px',
          right: '20px',
          height: '4px',
          backgroundColor: 'var(--bg-raised)',
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

          {/* Labels de vitesse aux bornes des arcs */}
          {/* VSO - Début arc blanc */}
          {vso > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vso * scale}%`,
                bottom: '50px',
                transform: 'translateX(-50%)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              VSO {vso} kt
            </div>
          )}

          {/* VFE Ldg - Fin arc blanc */}
          {vfeLdg > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vfeLdg * scale}%`,
                bottom: '50px',
                transform: 'translateX(-50%)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              VFE {vfeLdg} kt
            </div>
          )}

          {/* VS1 - Début arc vert */}
          {vs1 > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vs1 * scale}%`,
                bottom: '75px',
                transform: 'translateX(-50%)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'bold',
                color: '#10b981',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              VS1 {vs1} kt
            </div>
          )}

          {/* VNO - Fin arc vert / Début arc jaune */}
          {vno > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vno * scale}%`,
                bottom: '75px',
                transform: 'translateX(-50%)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'bold',
                color: '#fbbf24',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              VNO {vno} kt
            </div>
          )}

          {/* VNE - Trait rouge */}
          {vne > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vne * scale}%`,
                bottom: '75px',
                transform: 'translateX(-50%)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'bold',
                color: '#dc2626',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              VNE {vne} kt
            </div>
          )}

          {/* VFE T/O - si différent de VFE */}
          {vfeTO > 0 && vfeTO !== vfeLdg && (
            <div
              style={{
                position: 'absolute',
                left: `${vfeTO * scale}%`,
                bottom: '50px',
                transform: 'translateX(-50%)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '2px 4px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              VFE T/O {vfeTO} kt
            </div>
          )}

          {/* VO */}
          {vo > 0 && (
            <div
              style={{
                position: 'absolute',
                left: `${vo * scale}%`,
                bottom: '50px',
                transform: 'translateX(-50%)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'bold',
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: '2px 4px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                zIndex: 10
              }}
            >
              VO {vo} kt
            </div>
          )}
        </div>
        
        {/* Graduations et labels */}
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '20px',
          right: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--fs-caption)',
          color: 'var(--text-tertiary)'
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
        fontSize: 'var(--fs-caption)',
        color: 'var(--text-tertiary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px',
            height: '10px',
            backgroundColor: 'white',
            borderRadius: '2px'
          }} />
          <span style={{ color: 'var(--text-secondary)' }}>
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
          <span style={{ color: 'var(--text-secondary)' }}>
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
          <span style={{ color: 'var(--text-secondary)' }}>
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
          <span style={{ color: 'var(--text-secondary)' }}>
            <strong>Trait rouge:</strong> VNE (Ne jamais dépasser)
          </span>
        </div>
      </div>
    </div>
  );
});

SpeedLimitationChart.displayName = 'SpeedLimitationChart';

export default SpeedLimitationChart;