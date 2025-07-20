import React from 'react';

export const LoadInput = ({ label, value, onChange, max, highlight = false }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{
      display: 'block',
      fontSize: '14px',
      color: '#6b7280',
      marginBottom: '4px'
    }}>
      {label}
    </label>
    <input
      type="number"
      style={{
        width: '100%',
        padding: '8px 12px',
        border: highlight ? '2px solid #3b82f6' : '1px solid #d1d5db',
        borderRadius: '6px',
        backgroundColor: highlight ? '#eff6ff' : 'white',
        fontSize: '14px'
      }}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      max={max}
    />
  </div>
);