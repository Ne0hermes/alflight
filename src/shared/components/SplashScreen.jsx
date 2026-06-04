import React, { useEffect, useState, useRef } from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * SplashScreen
 * ------------
 * Écran d'introduction cinematic affiché au boot de l'app.
 *
 * Composition :
 *   • Fond #0A0A0A plein écran fixed
 *   • Logo « ALFLIGHT » Century Gothic 96px bold, letter-spacing 0.08em, #F5F2EC
 *   • Tagline « PERITA PER PREPARATEM » mono 12px, letter-spacing 0.30em, #8A867E
 *   • Barre de progression 2px x 240px, fond #232323, fill orange #f26921
 *     animée width 0→100% sur 1.2s ease-out
 *   • Texte rotatif des étapes de boot (200ms chacun)
 *   • Animation entrée logo : opacity + scale 600ms cubic-bezier
 *   • Animation sortie : fade-out déclenchée par `onComplete`
 *
 * Props :
 *   • onComplete (fn)       → callback déclenchée à la fin (parent fait fade-out)
 *   • minDuration (number)  → durée minimum d'affichage (default 1800ms)
 *
 * Usage :
 *   {showSplash && (
 *     <SplashScreen
 *       onComplete={() => setShowSplash(false)}
 *       minDuration={2000}
 *     />
 *   )}
 */
const BOOT_MESSAGES = [
  'CHARGEMENT DONNÉES SIA',
  'SYNCHRONISATION AVIONS',
  'VÉRIFICATION ESPACES AÉRIENS',
  'PRÊT POUR LE BRIEFING',
];

export const SplashScreen = ({ onComplete, minDuration = 1800 }) => {
  const [logoVisible, setLogoVisible] = useState(false);
  const [progressStarted, setProgressStarted] = useState(false);
  const [bootIndex, setBootIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const startedAt = useRef(Date.now());

  // 1) Apparition logo
  useEffect(() => {
    const id = requestAnimationFrame(() => setLogoVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // 2) Démarrage de la barre de progression après apparition du logo
  useEffect(() => {
    if (!logoVisible) return undefined;
    const id = setTimeout(() => setProgressStarted(true), 300);
    return () => clearTimeout(id);
  }, [logoVisible]);

  // 3) Cycle des messages de boot
  useEffect(() => {
    if (!progressStarted) return undefined;
    const id = setInterval(() => {
      setBootIndex((prev) => {
        const next = prev + 1;
        return next >= BOOT_MESSAGES.length ? prev : next;
      });
    }, 300);
    return () => clearInterval(id);
  }, [progressStarted]);

  // 4) Fin de la barre → respect du minDuration → callback
  useEffect(() => {
    if (!progressStarted) return undefined;
    // 1200ms de barre + 300ms de délai initial = 1500ms
    const progressDoneAt = startedAt.current + Math.max(minDuration, 1500);
    const remaining = Math.max(0, progressDoneAt - Date.now());

    const id = setTimeout(() => {
      setFadingOut(true);
      // Petit délai pour laisser le fade-out se jouer avant de notifier le parent
      setTimeout(() => {
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, 320);
    }, remaining);

    return () => clearTimeout(id);
  }, [progressStarted, minDuration, onComplete]);

  return (
    <div
      role="dialog"
      aria-label="Chargement ALFlight"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: tokens.zIndex.splash,
        backgroundColor: tokens.palette.black.deep,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        opacity: fadingOut ? 0 : 1,
        transition: `opacity 320ms cubic-bezier(0.4, 0, 0.2, 1)`,
        pointerEvents: fadingOut ? 'none' : 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Cadre éditorial subtil — 4 coins */}
      <SplashCorners />

      {/* Logo */}
      <div
        style={{
          opacity: logoVisible ? 1 : 0,
          transform: logoVisible ? 'scale(1)' : 'scale(0.95)',
          transition: `opacity 600ms cubic-bezier(0.4, 0, 0.2, 1), transform 600ms cubic-bezier(0.4, 0, 0.2, 1)`,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: tokens.fontFamily.sans,
            fontSize: 'clamp(56px, 12vw, 96px)',
            lineHeight: 1.0,
            letterSpacing: '0.08em',
            fontWeight: 700,
            color: tokens.palette.white.soft,
            textAlign: 'center',
          }}
        >
          ALFLIGHT
        </h1>

        <p
          style={{
            margin: `${tokens.spacing[5]} 0 0 0`,
            fontFamily: tokens.fontFamily.mono,
            fontSize: 'var(--fs-body)',
            lineHeight: 1.4,
            letterSpacing: '0.30em',
            textTransform: 'uppercase',
            color: tokens.palette.white.dim,
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          Perita per Preparatem
        </p>
      </div>

      {/* Barre de progression */}
      <div
        style={{
          marginTop: tokens.spacing[8],
          width: '240px',
          height: '2px',
          backgroundColor: tokens.palette.black.surface,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: progressStarted ? '100%' : '0%',
            backgroundColor: tokens.palette.orange.primary,
            transition: `width 1200ms cubic-bezier(0.16, 1, 0.3, 1)`,
          }}
        />
      </div>

      {/* Message rotatif */}
      <div
        style={{
          marginTop: tokens.spacing[4],
          minHeight: '14px',
          fontFamily: tokens.fontFamily.mono,
          fontSize: 'var(--fs-caption)',
          lineHeight: 1.3,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: tokens.palette.white.muted,
          fontWeight: 500,
          textAlign: 'center',
          opacity: progressStarted ? 1 : 0,
          transition: `opacity ${tokens.motion.slow}`,
        }}
      >
        {BOOT_MESSAGES[bootIndex]}
      </div>
    </div>
  );
};

/**
 * SplashCorners — 4 marqueurs d'angle éditoriaux discrets
 * Reprend l'esprit datasheet SR-71.
 */
const SplashCorners = () => {
  const cornerSize = '32px';
  const borderColor = 'rgba(245, 242, 236, 0.20)';
  const inset = '40px';
  const thickness = '1px';

  const baseCorner = {
    position: 'absolute',
    width: cornerSize,
    height: cornerSize,
    pointerEvents: 'none',
  };

  return (
    <>
      {/* Top-left */}
      <div
        aria-hidden="true"
        style={{
          ...baseCorner,
          top: inset,
          left: inset,
          borderTop: `${thickness} solid ${borderColor}`,
          borderLeft: `${thickness} solid ${borderColor}`,
        }}
      />
      {/* Top-right */}
      <div
        aria-hidden="true"
        style={{
          ...baseCorner,
          top: inset,
          right: inset,
          borderTop: `${thickness} solid ${borderColor}`,
          borderRight: `${thickness} solid ${borderColor}`,
        }}
      />
      {/* Bottom-left */}
      <div
        aria-hidden="true"
        style={{
          ...baseCorner,
          bottom: inset,
          left: inset,
          borderBottom: `${thickness} solid ${borderColor}`,
          borderLeft: `${thickness} solid ${borderColor}`,
        }}
      />
      {/* Bottom-right */}
      <div
        aria-hidden="true"
        style={{
          ...baseCorner,
          bottom: inset,
          right: inset,
          borderBottom: `${thickness} solid ${borderColor}`,
          borderRight: `${thickness} solid ${borderColor}`,
        }}
      />
    </>
  );
};

export default SplashScreen;
