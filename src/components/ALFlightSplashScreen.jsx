import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme';

export const ALFlightSplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [leftSpecs, setLeftSpecs] = useState([]);
  const [rightSpecs, setRightSpecs] = useState([]);

  const leftAircraftData = {
    model: "Diamond DA40",
    specs: [
      "Engine: Austro Engine AE300",
      "Power: 168 HP",
      "Cruise Speed: 285 km/h",
      "Range: 1,333 km", 
      "Ceiling: 16,400 ft",
      "Fuel: JET A-1",
      "Avionics: Garmin G1000"
    ]
  };
  
  const rightAircraftData = {
    model: "Robin DR400",
    specs: [
      "Engine: Lycoming O-360",
      "Power: 180 HP",
      "Cruise Speed: 240 km/h",
      "Range: 1,100 km",
      "Ceiling: 15,000 ft", 
      "Fuel: 100LL",
      "Avionics: Classic/G500"
    ]
  };

  useEffect(() => {
    // Animation du texte
    let leftIndex = 0;
    let rightIndex = 0;
    
    const leftInterval = setInterval(() => {
      if (leftIndex < leftAircraftData.specs.length) {
        setLeftSpecs(prev => [...prev, leftAircraftData.specs[leftIndex]]);
        leftIndex++;
      } else {
        clearInterval(leftInterval);
      }
    }, 300);
    
    const rightInterval = setInterval(() => {
      if (rightIndex < rightAircraftData.specs.length) {
        setRightSpecs(prev => [...prev, rightAircraftData.specs[rightIndex]]);
        rightIndex++;
      } else {
        clearInterval(rightInterval);
      }
    }, 350);

    // Animation de la progression
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    return () => {
      clearInterval(leftInterval);
      clearInterval(rightInterval);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div style={styles.container}>
      {/* Logo en haut à gauche */}
      <div style={styles.navLogo}>
        <h1 style={styles.mainLogo}>ALFLIGHT</h1>
        <div style={styles.subtitle}>DUAL SYSTEMS</div>
      </div>
      
      {/* Compteur central */}
      <div style={styles.counter}>{Math.floor(progress)}%</div>
      
      {/* Double affichage de code */}
      <div style={styles.dualCodeContainer}>
        <div style={styles.codeColumn}>
          <div style={styles.aircraftTitle}>DIAMOND DA40</div>
          <div style={styles.codeContent}>
            {leftSpecs.map((spec, index) => (
              <div key={index} style={styles.codeLine}>{spec}</div>
            ))}
          </div>
        </div>
        <div style={styles.codeColumn}>
          <div style={styles.aircraftTitle}>ROBIN DR400</div>
          <div style={styles.codeContent}>
            {rightSpecs.map((spec, index) => (
              <div key={index} style={styles.codeLine}>{spec}</div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Barre de progression */}
      <div style={styles.progressBar}>
        <div style={{
          ...styles.progressFill,
          width: `${progress}%`
        }} />
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    width: '100%',
    height: '100vh',
    background: theme.colors.background,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3rem',
    fontFamily: theme.fonts.mono,
    boxSizing: 'border-box',
  },
  navLogo: {
    position: 'absolute',
    top: '3rem',
    left: '3rem',
  },
  mainLogo: {
    fontSize: '48px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    background: theme.gradients.logo,
    backgroundSize: '300% 300%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'gradientShift 8s ease infinite',
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    letterSpacing: '0.3em',
    marginTop: '0.5rem',
  },
  counter: {
    fontSize: '120px',
    fontWeight: '700',
    background: theme.gradients.logo,
    backgroundSize: '300% 300%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'gradientShift 8s ease infinite',
    margin: '0 auto',
  },
  dualCodeContainer: {
    display: 'flex',
    gap: '4rem',
    width: '80%',
    maxWidth: '1200px',
  },
  codeColumn: {
    flex: 1,
    background: 'rgba(0, 0, 0, 0.5)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '10px',
    padding: '2rem',
    height: '300px',
    overflow: 'hidden',
  },
  aircraftTitle: {
    color: theme.colors.primary,
    fontSize: '14px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '1.5rem',
    paddingBottom: '0.5rem',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  codeContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  codeLine: {
    fontSize: '12px',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.mono,
    animation: 'fadeIn 0.5s ease-in',
  },
  progressBar: {
    width: '80%',
    height: '2px',
    background: theme.colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: theme.gradients.primary,
    transition: 'width 0.3s ease',
  },
};

// Ajout des animations CSS
if (typeof document !== 'undefined' && !document.getElementById('alflight-animations')) {
  const style = document.createElement('style');
  style.id = 'alflight-animations';
  style.innerHTML = `
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}