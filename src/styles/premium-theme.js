// Premium theme for ALFlight
export const premiumTheme = {
  colors: {
    white: '#FFFFFF',
    black: '#000000',

    bordeaux: {
      DEFAULT: '#93163C',
      light: '#A91B45',
      dark: '#6B0F2B',
      glow: 'rgba(147, 22, 60, 0.3)',
    },

    gold: {
      DEFAULT: '#D4AF37',
      light: '#F4E5A1',
      dark: '#B8941C',
      glow: 'rgba(212, 175, 55, 0.3)',
    },

    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },

    glass: {
      white: 'rgba(255, 255, 255, 0.1)',
      dark: 'rgba(44, 44, 52, 0.8)',
      border: 'rgba(255, 255, 255, 0.2)',
    },
  },

  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    fontSize: {
      tiny: { size: '12px', weight: 400 },
      bodySmall: { size: '14px', weight: 400 },
      body: { size: '16px', weight: 400 },
      bodyLarge: { size: '18px', weight: 400 },
      h3: { size: '24px', weight: 600 },
      h2: { size: '32px', weight: 700 },
      h1: { size: '40px', weight: 700 },
    },
  },

  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    pill: '9999px',
  },

  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
  },

  transitions: {
    base: 'all 0.3s ease',
    fast: 'all 0.15s ease',
    slow: 'all 0.5s ease',
  },

  zIndex: {
    dropdown: 1000,
    sticky: 100,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
  },
};

// Alias pour compatibilité
export const theme = premiumTheme;