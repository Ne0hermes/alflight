import React from 'react';

export const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    style={{
      padding: '12px 16px',
      borderRadius: '8px',
      fontWeight: '500',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: active ? '#dbeafe' : '#f3f4f6',
      color: active ? '#1d4ed8' : '#6b7280',
      transition: 'all 0.2s'
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.target.style.backgroundColor = '#e5e7eb';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.target.style.backgroundColor = '#f3f4f6';
      }
    }}
  >
    <Icon size={16} />
    {label}
  </button>
);
