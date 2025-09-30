import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Grid, Smartphone, Monitor, Bug, Camera, Palette } from 'lucide-react';
import { theme } from '../styles/theme';

export const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [debugMode, setDebugMode] = useState({
    borders: false,
    grid: false,
    responsive: false,
    spacing: false,
    performance: false
  });
  
  const [viewportInfo, setViewportInfo] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
    device: window.innerWidth <= 768 ? 'Mobile' : 'Desktop'
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewportInfo({
        width: window.innerWidth,
        height: window.innerHeight,
        device: window.innerWidth <= 768 ? 'Mobile' : 'Desktop'
      });
    };
    
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const toggleDebugMode = (mode) => {
    const newMode = { ...debugMode, [mode]: !debugMode[mode] };
    setDebugMode(newMode);
    
    // Applique les styles de debug
    const body = document.body;
    
    if (mode === 'borders') {
      if (newMode.borders) {
        body.classList.add('debug-borders');
        addDebugStyles('borders', `
          * { outline: 1px solid rgba(255, 0, 0, 0.2) !important; }
          *:hover { outline: 2px solid rgba(255, 0, 0, 0.5) !important; }
        `);
      } else {
        body.classList.remove('debug-borders');
        removeDebugStyles('borders');
      }
    }
    
    if (mode === 'grid') {
      if (newMode.grid) {
        body.classList.add('debug-grid');
        addDebugStyles('grid', `
          body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
              repeating-linear-gradient(0deg, rgba(139, 21, 56, 0.1) 0px, transparent 1px, transparent 19px, rgba(139, 21, 56, 0.1) 20px),
              repeating-linear-gradient(90deg, rgba(139, 21, 56, 0.1) 0px, transparent 1px, transparent 19px, rgba(139, 21, 56, 0.1) 20px);
            pointer-events: none;
            z-index: 9999;
          }
        `);
      } else {
        body.classList.remove('debug-grid');
        removeDebugStyles('grid');
      }
    }
    
    if (mode === 'spacing') {
      if (newMode.spacing) {
        addDebugStyles('spacing', `
          * { 
            background: rgba(0, 255, 0, 0.05) !important;
            padding: 2px !important;
            margin: 2px !important;
          }
        `);
      } else {
        removeDebugStyles('spacing');
      }
    }
  };

  const addDebugStyles = (id, css) => {
    let style = document.getElementById(`debug-style-${id}`);
    if (!style) {
      style = document.createElement('style');
      style.id = `debug-style-${id}`;
      document.head.appendChild(style);
    }
    style.innerHTML = css;
  };

  const removeDebugStyles = (id) => {
    const style = document.getElementById(`debug-style-${id}`);
    if (style) style.remove();
  };

  const captureScreenshot = () => {
    // Simule une capture (nécessite html2canvas en production)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    alert(`Capture d'écran: debug-${timestamp}.png\n(Installez html2canvas pour activer cette fonction)`);
  };

  const reportIssue = () => {
    const issue = {
      viewport: viewportInfo,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
    console.log('🐛 Rapport de bug:', issue);
    alert('Rapport de bug enregistré dans la console');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: theme.shadows.lg,
          zIndex: 10000,
        }}
      >
        <Bug size={24} />
      </button>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.title}>🔍 Debug Panel</h3>
        <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>
          <EyeOff size={20} />
        </button>
      </div>

      <div style={styles.content}>
        {/* Viewport Info */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>📱 Viewport</h4>
          <div style={styles.info}>
            <span>{viewportInfo.device}</span>
            <span>{viewportInfo.width} x {viewportInfo.height}</span>
          </div>
        </div>

        {/* Debug Options */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>⚙️ Options Debug</h4>
          <div style={styles.buttons}>
            <button
              onClick={() => toggleDebugMode('borders')}
              style={{
                ...styles.button,
                ...(debugMode.borders ? styles.buttonActive : {})
              }}
            >
              <Eye size={16} />
              Bordures
            </button>
            
            <button
              onClick={() => toggleDebugMode('grid')}
              style={{
                ...styles.button,
                ...(debugMode.grid ? styles.buttonActive : {})
              }}
            >
              <Grid size={16} />
              Grille
            </button>
            
            <button
              onClick={() => toggleDebugMode('spacing')}
              style={{
                ...styles.button,
                ...(debugMode.spacing ? styles.buttonActive : {})
              }}
            >
              <Palette size={16} />
              Espacements
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>🎬 Actions</h4>
          <div style={styles.buttons}>
            <button onClick={captureScreenshot} style={styles.button}>
              <Camera size={16} />
              Capture
            </button>
            
            <button onClick={reportIssue} style={styles.button}>
              <Bug size={16} />
              Reporter Bug
            </button>
          </div>
        </div>

        {/* Responsive Preview */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>📐 Tailles d'écran</h4>
          <div style={styles.devices}>
            <button 
              onClick={() => window.resizeTo(375, 812)}
              style={styles.deviceBtn}
            >
              <Smartphone size={14} />
              iPhone
            </button>
            <button 
              onClick={() => window.resizeTo(768, 1024)}
              style={styles.deviceBtn}
            >
              <Monitor size={14} />
              iPad
            </button>
            <button 
              onClick={() => window.resizeTo(1920, 1080)}
              style={styles.deviceBtn}
            >
              <Monitor size={14} />
              Desktop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  panel: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '320px',
    backgroundColor: theme.colors.backgroundCard,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '12px',
    boxShadow: theme.shadows.xl,
    zIndex: 10000,
    fontFamily: theme.fonts.mono,
    fontSize: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.border}`,
    background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.accent}08)`,
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    padding: '4px',
  },
  content: {
    padding: '16px',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '11px',
    fontWeight: '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  info: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
    color: theme.colors.textSecondary,
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '6px',
    color: theme.colors.textSecondary,
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonActive: {
    backgroundColor: 'rgba(139, 21, 56, 0.2)',
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  devices: {
    display: 'flex',
    gap: '8px',
  },
  deviceBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '6px',
    color: theme.colors.textSecondary,
    fontSize: '10px',
    cursor: 'pointer',
  },
};

export default DebugPanel;