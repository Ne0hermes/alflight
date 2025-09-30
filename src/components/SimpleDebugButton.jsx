import React, { useState } from 'react';

export const SimpleDebugButton = () => {
  const [showInfo, setShowInfo] = useState(false);
  
  const toggleDebugStyles = () => {
    const body = document.body;
    if (body.classList.contains('debug-mode')) {
      body.classList.remove('debug-mode');
      const style = document.getElementById('debug-styles');
      if (style) style.remove();
      setShowInfo(false);
    } else {
      body.classList.add('debug-mode');
      const style = document.createElement('style');
      style.id = 'debug-styles';
      style.innerHTML = `
        .debug-mode * {
          outline: 1px solid rgba(255, 0, 0, 0.2) !important;
        }
        .debug-mode *:hover {
          outline: 2px solid rgba(255, 0, 0, 0.5) !important;
          background: rgba(255, 255, 0, 0.1) !important;
        }
      `;
      document.head.appendChild(style);
      setShowInfo(true);
    }
  };
  
  return (
    <>
      <button
        onClick={toggleDebugStyles}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B1538, #A91B45)',
          border: '2px solid #6B0F2B',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(139, 21, 56, 0.5)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🐛
      </button>
      
      {showInfo && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          background: 'rgba(30, 28, 28, 0.95)',
          border: '1px solid #8B1538',
          borderRadius: '8px',
          padding: '12px',
          color: 'white',
          fontSize: '12px',
          zIndex: 99999,
          maxWidth: '200px',
        }}>
          <div>📱 {window.innerWidth} x {window.innerHeight}</div>
          <div>🔍 Mode Debug Activé</div>
          <div style={{ marginTop: '8px', fontSize: '10px', opacity: 0.7 }}>
            Cliquez pour désactiver
          </div>
        </div>
      )}
    </>
  );
};

export default SimpleDebugButton;