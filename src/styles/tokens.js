/**
 * Design Tokens centralisés pour ALFlight
 *
 * Utilisation :
 * import { colors, spacing, shadows, borderRadius, typography } from './styles/tokens';
 */

// ============================================
// COULEURS
// ============================================
export const colors = {
  // Couleurs principales ALFlight
  primary: {
    main: '#93163C',
    light: '#A91B45',
    dark: '#6B0F2B',
    lighter: '#B91D4C',
    darker: '#5A0C22',
  },

  // Couleurs secondaires
  secondary: {
    main: '#93163C',
    light: '#A91B45',
    dark: '#6B0F2B',
  },

  // Couleurs de statut
  success: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
    background: '#d1fae5',
  },
  warning: {
    main: '#fbbf24',
    light: '#fcd34d',
    dark: '#f59e0b',
    background: '#fef3c7',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
    background: '#fee2e2',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
    background: '#dbeafe',
  },

  // Couleurs de fond
  background: {
    default: '#FFFFFF',
    paper: '#FFFFFF',
    elevated: '#F9FAFB',
    subtle: '#F3F4F6',
  },

  // Couleurs de texte
  text: {
    primary: '#000000',
    secondary: '#374151',
    tertiary: '#6B7280',
    muted: '#9CA3AF',
    disabled: '#D1D5DB',
  },

  // Couleurs de bordure
  border: {
    default: '#D1D5DB',
    light: 'rgba(209, 213, 219, 0.3)',
    dark: '#93163C',
    focus: '#93163C',
  },

  // Mode sombre (pour future implémentation complète)
  dark: {
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
      elevated: '#3a3a3a',
    },
    text: {
      primary: '#f9fafb',
      secondary: '#d1d5db',
      tertiary: '#9ca3af',
    },
  },
};

// ============================================
// ESPACEMENTS
// ============================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Spacers fonctionnels
  compact: 12,
  comfortable: 20,
  spacious: 28,
};

// ============================================
// OMBRES
// ============================================
export const shadows = {
  none: 'none',
  sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
  md: '0 4px 12px rgba(0, 0, 0, 0.15)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.2)',
  xl: '0 12px 32px rgba(0, 0, 0, 0.25)',
  xxl: '0 20px 50px rgba(139, 21, 56, 0.3)',

  // Ombres spécifiques
  card: '0 1px 3px rgba(0, 0, 0, 0.1)',
  button: '0 2px 8px rgba(147, 22, 60, 0.3)',
  buttonHover: '0 4px 12px rgba(147, 22, 60, 0.4)',
  modal: '0 20px 40px rgba(0, 0, 0, 0.2)',
  dropdown: '0 10px 25px rgba(0, 0, 0, 0.1)',

  // Ombres internes
  insetSm: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
  insetMd: 'inset 0 4px 8px rgba(0, 0, 0, 0.15)',

  // Ombres de focus
  focusPrimary: '0 0 0 3px rgba(147, 22, 60, 0.2)',
  focusSecondary: '0 0 0 2px rgba(147, 22, 60, 0.2)',
};

// ============================================
// RAYONS DE BORDURE
// ============================================
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,

  // Radius fonctionnels
  button: 8,
  card: 12,
  input: 8,
  modal: 12,
  badge: 9999,
};

// ============================================
// TYPOGRAPHIE
// ============================================
export const typography = {
  // Familles de polices
  fontFamily: {
    primary: "'Space Grotesk', 'Inter', sans-serif",
    secondary: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },

  // Tailles de police
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
  },

  // Poids de police
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Hauteurs de ligne
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 2,
  },

  // Espacement des lettres
  letterSpacing: {
    tight: '-0.05em',
    normal: '0',
    wide: '0.05em',
    wider: '0.1em',
  },
};

// ============================================
// GRADIENTS
// ============================================
export const gradients = {
  primary: 'linear-gradient(135deg, #8B1538, #A91B45)',
  primaryHover: 'linear-gradient(135deg, #6B0F2B, #8B1538)',
  hero: 'linear-gradient(135deg, #8B1538 0%, #6B0F2B 100%)',
  logo: 'linear-gradient(135deg, #ffffff, #8B1538, #A91B45, #8B1538, #ffffff)',
  subtle: 'linear-gradient(135deg, rgba(147, 22, 60, 0.05), rgba(147, 22, 60, 0.02))',
};

// ============================================
// TRANSITIONS
// ============================================
export const transitions = {
  fast: '0.1s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
  slower: '0.5s ease',

  // Transitions fonctionnelles
  button: '0.2s ease',
  modal: '0.3s ease',
  dropdown: '0.2s ease',
  tooltip: '0.15s ease',
};

// ============================================
// Z-INDEX
// ============================================
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  notification: 800,
  max: 9999,
};

// ============================================
// BREAKPOINTS
// ============================================
export const breakpoints = {
  xs: 0,      // Mobile portrait
  sm: 640,    // Mobile landscape
  md: 768,    // Tablet
  lg: 1024,   // Desktop
  xl: 1400,   // Large desktop

  // Media queries helpers
  up: (breakpoint) => `@media (min-width: ${breakpoints[breakpoint]}px)`,
  down: (breakpoint) => `@media (max-width: ${breakpoints[breakpoint] - 1}px)`,
  between: (min, max) => `@media (min-width: ${breakpoints[min]}px) and (max-width: ${breakpoints[max] - 1}px)`,
};

// ============================================
// ANIMATIONS
// ============================================
export const animations = {
  // Keyframes
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  slideIn: `
    @keyframes slideIn {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `,
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  float: `
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,

  // Classes d'animation
  classes: {
    fadeIn: 'animation: fadeIn 0.3s ease-in',
    slideIn: 'animation: slideIn 0.3s ease-out',
    spin: 'animation: spin 0.8s linear infinite',
    float: 'animation: float 3s ease-in-out infinite',
    pulse: 'animation: pulse 2s ease-in-out infinite',
  },
};

// ============================================
// EXPORT PAR DÉFAUT
// ============================================
export default {
  colors,
  spacing,
  shadows,
  borderRadius,
  typography,
  gradients,
  transitions,
  zIndex,
  breakpoints,
  animations,
};
