// ============================================================================
//  AlflightLogo — Logo officiel ALFlight (warbird vintage cockpit)
//  ----------------------------------------------------------------------------
//  Composant factorisé qui rend le logo officiel de l'application :
//   - Variante BLANC pour les fonds sombres (mode nuit par défaut)
//   - Variante NOIR pour les fonds clairs (mode jour / cockpit ivoire)
//
//  Auto-sélection selon le thème actif (data-theme="day-cockpit") quand
//  variant="auto" (par défaut). Possibilité de forcer manuellement
//  variant="white" ou variant="black".
//
//  Usage :
//    <AlflightLogo size={120} />                       // auto
//    <AlflightLogo size={64} variant="white" />        // forcé blanc
//    <AlflightLogo size="large" />                     // tailles preset
//
//  Tailles preset : "xs" (24), "sm" (40), "md" (64), "lg" (120), "xl" (200), "hero" (320)
// ============================================================================

import React, { useEffect, useState } from 'react';

const SIZE_PRESETS = {
  xs: 24,
  sm: 40,
  md: 64,
  lg: 120,
  xl: 200,
  hero: 320,
};

const LOGO_PATHS = {
  white: '/assets/photos/logo_blanc.png',
  black: '/assets/photos/logo_noir.png',
};

export const AlflightLogo = ({
  size = 'md',
  variant = 'auto',
  alt = 'ALFlight',
  className,
  style,
  ...rest
}) => {
  // Resolve size (preset string or numeric px)
  const px = typeof size === 'number' ? size : (SIZE_PRESETS[size] || SIZE_PRESETS.md);

  // Auto-detect theme to pick the right variant when variant === 'auto'
  const [resolvedVariant, setResolvedVariant] = useState(
    variant === 'auto' ? 'white' : variant
  );

  useEffect(() => {
    if (variant !== 'auto') {
      setResolvedVariant(variant);
      return;
    }
    if (typeof document === 'undefined') return;

    const detectTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      // Mode jour cockpit ivoire → logo noir, sinon (mode nuit par défaut) → blanc
      setResolvedVariant(theme === 'day-cockpit' ? 'black' : 'white');
    };

    detectTheme();

    // Watch for theme switches (data-theme attribute changes on <html>)
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [variant]);

  return (
    <img
      src={LOGO_PATHS[resolvedVariant]}
      alt={alt}
      width={px}
      height={px}
      className={className}
      style={{
        display: 'block',
        objectFit: 'contain',
        userSelect: 'none',
        // Pas de pointer-events sur le logo (jamais cliquable directement)
        pointerEvents: 'none',
        ...style,
      }}
      draggable={false}
      {...rest}
    />
  );
};

export default AlflightLogo;
