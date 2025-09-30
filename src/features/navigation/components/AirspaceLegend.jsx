/**
 * Légende des espaces aériens
 */

import React from 'react';

export const AirspaceLegend = () => {
  const legendItems = [
    { type: 'CTR', color: '#0099FF', label: 'CTR - Zone de contrôle' },
    { type: 'TMA', color: '#FF6600', label: 'TMA - Zone terminale' },
    { type: 'CTA', color: '#FF9900', label: 'CTA - Zone de contrôle régional' },
    { type: 'P', color: '#CC0000', label: 'Zone P - Interdite', weight: 3 },
    { type: 'R', color: '#CC0066', label: 'Zone R - Réglementée', dash: true },
    { type: 'D', color: '#FF9900', label: 'Zone D - Dangereuse', dash: true },
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      background: 'white',
      padding: '12px',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      fontSize: '12px',
      zIndex: 1000,
      maxWidth: '250px'
    }}>
      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
        Espaces aériens
      </h4>
      {legendItems.map(item => (
        <div key={item.type} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{
            width: '20px',
            height: '12px',
            backgroundColor: item.color,
            opacity: 0.4,
            marginRight: '8px',
            border: `${item.weight || 2}px ${item.dash ? 'dashed' : 'solid'} ${item.color}`,
            borderRadius: '2px'
          }}></div>
          <span style={{ fontSize: '11px' }}>{item.label}</span>
        </div>
      ))}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e0e0e0', fontSize: '11px', color: '#666' }}>
        <strong>Classes d'espace:</strong><br/>
        A: IFR uniquement<br/>
        D: IFR/VFR avec contact radio<br/>
        G: Espace non contrôlé
      </div>
    </div>
  );
};