import React, { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';
import { theme } from '../styles/theme';

export const SplashScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Initialisation...');

  useEffect(() => {
    const messages = [
      'Initialisation...',
      'Chargement des modules...',
      'Préparation de l\'interface...',
      'Prêt au décollage !'
    ];

    let currentProgress = 0;
    let messageIndex = 0;

    const interval = setInterval(() => {
      currentProgress += 25;
      messageIndex++;

      if (currentProgress <= 100) {
        setProgress(currentProgress);
        if (messages[messageIndex]) {
          setMessage(messages[messageIndex]);
        }
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 500);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Logo Animation */}
        <div style={styles.logoContainer}>
          <Plane size={80} style={styles.plane} />
          <div style={styles.trail}></div>
        </div>

        {/* App Title */}
        <h1 style={styles.title}>ALFlight</h1>
        <p style={styles.subtitle}>Assistant de Vol VFR</p>

        {/* Progress Bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div 
              style={{
                ...styles.progressFill,
                width: `${progress}%`
              }}
            />
          </div>
          <p style={styles.message}>{message}</p>
        </div>

        {/* Version */}
        <p style={styles.version}>Version 1.0.0</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.colors.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  content: {
    textAlign: 'center',
    padding: '40px',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: '40px',
    animation: 'float 3s ease-in-out infinite',
  },
  plane: {
    color: '#ffffff',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
    animation: 'fly 2s ease-in-out infinite',
  },
  trail: {
    position: 'absolute',
    top: '50%',
    left: '-30px',
    width: '60px',
    height: '2px',
    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.8), transparent)',
    animation: 'trail 2s ease-in-out infinite',
  },
  title: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#ffffff',
    margin: '0 0 8px 0',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  subtitle: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '40px',
  },
  progressContainer: {
    width: '280px',
    margin: '0 auto',
  },
  progressBar: {
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
    boxShadow: '0 0 10px rgba(255,255,255,0.5)',
  },
  message: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '40px',
  },
  version: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
};

// Add animations
if (typeof document !== 'undefined' && !document.getElementById('splash-animations')) {
  const style = document.createElement('style');
  style.id = 'splash-animations';
  style.innerHTML = `
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes fly {
      0%, 100% { transform: translateX(0) rotate(0deg); }
      25% { transform: translateX(5px) rotate(2deg); }
      75% { transform: translateX(-5px) rotate(-2deg); }
    }
    
    @keyframes trail {
      0%, 100% { opacity: 0; transform: scaleX(0); }
      50% { opacity: 1; transform: scaleX(1); }
    }
  `;
  document.head.appendChild(style);
}