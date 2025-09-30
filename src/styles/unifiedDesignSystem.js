/**
 * UNIFIED DESIGN SYSTEM FOR ALFLIGHT
 * ====================================
 * Système de design centralisé résolvant tous les problèmes de cohérence
 * Basé sur l'analyse exhaustive du projet
 * 
 * @author ALFlight Team
 * @version 2.0.0
 */

// ==========================================
// 1. PALETTE DE COULEURS UNIFIÉE
// ==========================================
export const colors = {
  // Couleurs primaires - Bleu aviation
  primary: {
    50: '#EFF6FF',   // Très clair
    100: '#DBEAFE',  
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',  // Principal
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',  // Très foncé
  },

  // Couleurs secondaires - Gris neutres
  neutral: {
    0: '#FFFFFF',    // Blanc pur
    50: '#F9FAFB',   
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',  // Presque noir
    1000: '#000000', // Noir pur
  },

  // États - Success (Vert)
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',  // Principal
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },

  // États - Warning (Jaune/Orange)
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',  // Principal
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // États - Error/Danger (Rouge)
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',  // Principal
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  // États - Info (Bleu clair)
  info: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',  // Principal
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
  },

  // Couleurs spécifiques aviation
  aviation: {
    sky: '#87CEEB',
    cloud: '#F0F4F8',
    runway: '#2C3E50',
    taxiway: '#F4D03F',
    grass: '#2ECC71',
    vfr: '#00A86B',
    ifr: '#FF6B6B',
    night: '#2C3E50',
    military: '#8B0000',
    danger: '#FF0000',
  },

  // Couleurs sémantiques
  semantic: {
    text: {
      primary: '#111827',    // Texte principal (noir)
      secondary: '#4B5563',  // Texte secondaire
      muted: '#9CA3AF',      // Texte désactivé
      inverse: '#FFFFFF',    // Texte sur fond sombre
      link: '#2563EB',       // Liens
      danger: '#DC2626',     // Texte d'erreur
      success: '#16A34A',    // Texte de succès
      warning: '#D97706',    // Texte d'avertissement
    },
    background: {
      primary: '#FFFFFF',    // Fond principal
      secondary: '#F9FAFB',  // Fond secondaire
      tertiary: '#F3F4F6',   // Fond tertiaire
      hover: '#E5E7EB',      // Fond au survol
      active: '#D1D5DB',     // Fond actif
      disabled: '#F3F4F6',   // Fond désactivé
      overlay: 'rgba(0, 0, 0, 0.5)', // Overlay
    },
    border: {
      light: '#E5E7EB',      // Bordure légère
      default: '#D1D5DB',    // Bordure par défaut
      strong: '#9CA3AF',     // Bordure forte
      focus: '#3B82F6',      // Bordure au focus
      error: '#EF4444',      // Bordure d'erreur
    }
  }
};

// ==========================================
// 2. TYPOGRAPHIE UNIFIÉE
// ==========================================
export const typography = {
  // Familles de polices
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },

  // Tailles de police
  fontSize: {
    '2xs': '0.625rem',   // 10px
    xs: '0.75rem',       // 12px
    sm: '0.875rem',      // 14px
    base: '1rem',        // 16px
    lg: '1.125rem',      // 18px
    xl: '1.25rem',       // 20px
    '2xl': '1.5rem',     // 24px
    '3xl': '1.875rem',   // 30px
    '4xl': '2.25rem',    // 36px
    '5xl': '3rem',       // 48px
    '6xl': '3.75rem',    // 60px
  },

  // Poids de police
  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // Hauteur de ligne
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Espacement des lettres
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Styles de texte prédéfinis
  styles: {
    // Titres
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.25,
      color: colors.semantic.text.primary,
    },
    h2: {
      fontSize: '1.875rem',
      fontWeight: 700,
      lineHeight: 1.3,
      color: colors.semantic.text.primary,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: colors.semantic.text.primary,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.5,
      color: colors.semantic.text.primary,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
      color: colors.semantic.text.primary,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
      color: colors.semantic.text.primary,
    },

    // Corps de texte
    body: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      color: colors.semantic.text.primary,
    },
    bodySmall: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.5,
      color: colors.semantic.text.primary,
    },
    bodyLarge: {
      fontSize: '1.125rem',
      fontWeight: 400,
      lineHeight: 1.625,
      color: colors.semantic.text.primary,
    },

    // Labels et légendes
    label: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
      color: colors.semantic.text.primary,
      display: 'flex',
      alignItems: 'center',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.5,
      color: colors.semantic.text.secondary,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: colors.semantic.text.secondary,
    },

    // Liens
    link: {
      fontSize: 'inherit',
      fontWeight: 'inherit',
      color: colors.semantic.text.link,
      textDecoration: 'none',
      cursor: 'pointer',
      '&:hover': {
        textDecoration: 'underline',
      },
    },

    // Code
    code: {
      fontFamily: '"SF Mono", Monaco, Consolas, monospace',
      fontSize: '0.875rem',
      fontWeight: 400,
      backgroundColor: colors.neutral[100],
      padding: '0.125rem 0.25rem',
      borderRadius: '0.25rem',
      color: colors.semantic.text.primary,
    },
  },
};

// ==========================================
// 3. ESPACEMENT UNIFIÉ
// ==========================================
export const spacing = {
  // Échelle d'espacement (base 4px)
  0: '0',
  0.5: '0.125rem',    // 2px
  1: '0.25rem',       // 4px
  1.5: '0.375rem',    // 6px
  2: '0.5rem',        // 8px
  2.5: '0.625rem',    // 10px
  3: '0.75rem',       // 12px
  3.5: '0.875rem',    // 14px
  4: '1rem',          // 16px
  5: '1.25rem',       // 20px
  6: '1.5rem',        // 24px
  7: '1.75rem',       // 28px
  8: '2rem',          // 32px
  9: '2.25rem',       // 36px
  10: '2.5rem',       // 40px
  11: '2.75rem',      // 44px
  12: '3rem',         // 48px
  14: '3.5rem',       // 56px
  16: '4rem',         // 64px
  20: '5rem',         // 80px
  24: '6rem',         // 96px
  28: '7rem',         // 112px
  32: '8rem',         // 128px
  36: '9rem',         // 144px
  40: '10rem',        // 160px
  44: '11rem',        // 176px
  48: '12rem',        // 192px
  52: '13rem',        // 208px
  56: '14rem',        // 224px
  60: '15rem',        // 240px
  64: '16rem',        // 256px
  72: '18rem',        // 288px
  80: '20rem',        // 320px
  96: '24rem',        // 384px
};

// ==========================================
// 4. BORDURES ET RAYONS
// ==========================================
export const borders = {
  // Largeurs de bordure
  width: {
    0: '0',
    1: '1px',
    2: '2px',
    4: '4px',
    8: '8px',
  },

  // Rayons de bordure
  radius: {
    none: '0',
    sm: '0.125rem',     // 2px
    base: '0.25rem',    // 4px
    md: '0.375rem',     // 6px
    lg: '0.5rem',       // 8px
    xl: '0.75rem',      // 12px
    '2xl': '1rem',      // 16px
    '3xl': '1.5rem',    // 24px
    full: '9999px',     // Cercle parfait
  },

  // Styles de bordure prédéfinis
  styles: {
    none: 'none',
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
    double: 'double',
  },
};

// ==========================================
// 5. OMBRES
// ==========================================
export const shadows = {
  none: 'none',
  xs: '0 0 0 1px rgba(0, 0, 0, 0.05)',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  
  // Ombres colorées
  primary: '0 4px 14px 0 rgba(59, 130, 246, 0.35)',
  success: '0 4px 14px 0 rgba(34, 197, 94, 0.35)',
  warning: '0 4px 14px 0 rgba(245, 158, 11, 0.35)',
  error: '0 4px 14px 0 rgba(239, 68, 68, 0.35)',
  
  // Ombres d'élévation Material Design
  elevation: {
    0: 'none',
    1: '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)',
    2: '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
    3: '0px 3px 3px -2px rgba(0,0,0,0.2), 0px 3px 4px 0px rgba(0,0,0,0.14), 0px 1px 8px 0px rgba(0,0,0,0.12)',
    4: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
    6: '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
    8: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
    12: '0px 7px 8px -4px rgba(0,0,0,0.2), 0px 12px 17px 2px rgba(0,0,0,0.14), 0px 5px 22px 4px rgba(0,0,0,0.12)',
    16: '0px 8px 10px -5px rgba(0,0,0,0.2), 0px 16px 24px 2px rgba(0,0,0,0.14), 0px 6px 30px 5px rgba(0,0,0,0.12)',
    24: '0px 11px 15px -7px rgba(0,0,0,0.2), 0px 24px 38px 3px rgba(0,0,0,0.14), 0px 9px 46px 8px rgba(0,0,0,0.12)',
  },
};

// ==========================================
// 6. TRANSITIONS ET ANIMATIONS
// ==========================================
export const transitions = {
  // Durées
  duration: {
    instant: '0ms',
    fast: '150ms',
    base: '250ms',
    slow: '350ms',
    slower: '500ms',
    slowest: '1000ms',
  },

  // Courbes d'animation
  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Transitions prédéfinies
  all: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  colors: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1), border-color 250ms cubic-bezier(0.4, 0, 0.2, 1), color 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  opacity: 'opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  shadow: 'box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1)',
  transform: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// ==========================================
// 7. Z-INDEX SYSTÈME
// ==========================================
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  notification: 80,
  loading: 90,
  max: 99999,
};

// ==========================================
// 8. BREAKPOINTS RESPONSIVE
// ==========================================
export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ==========================================
// 9. COMPOSANTS PRÉDÉFINIS
// ==========================================
export const components = {
  // Boutons
  button: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      padding: `${spacing[2]} ${spacing[4]}`,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
      borderRadius: borders.radius.md,
      border: borders.width[1],
      borderStyle: borders.styles.solid,
      transition: transitions.all,
      cursor: 'pointer',
      userSelect: 'none',
      outline: 'none',
      '&:focus': {
        boxShadow: `0 0 0 3px ${colors.primary[200]}`,
      },
      '&:disabled': {
        opacity: 0.5,
        cursor: 'not-allowed',
      },
    },
    variants: {
      primary: {
        backgroundColor: colors.primary[600],
        borderColor: colors.primary[600],
        color: colors.neutral[0],
        '&:hover': {
          backgroundColor: colors.primary[700],
          borderColor: colors.primary[700],
        },
        '&:active': {
          backgroundColor: colors.primary[800],
          borderColor: colors.primary[800],
        },
      },
      secondary: {
        backgroundColor: colors.neutral[0],
        borderColor: colors.neutral[300],
        color: colors.neutral[700],
        '&:hover': {
          backgroundColor: colors.neutral[50],
          borderColor: colors.neutral[400],
        },
        '&:active': {
          backgroundColor: colors.neutral[100],
          borderColor: colors.neutral[500],
        },
      },
      success: {
        backgroundColor: colors.success[600],
        borderColor: colors.success[600],
        color: colors.neutral[0],
        '&:hover': {
          backgroundColor: colors.success[700],
          borderColor: colors.success[700],
        },
      },
      warning: {
        backgroundColor: colors.warning[500],
        borderColor: colors.warning[500],
        color: colors.neutral[0],
        '&:hover': {
          backgroundColor: colors.warning[600],
          borderColor: colors.warning[600],
        },
      },
      danger: {
        backgroundColor: colors.error[600],
        borderColor: colors.error[600],
        color: colors.neutral[0],
        '&:hover': {
          backgroundColor: colors.error[700],
          borderColor: colors.error[700],
        },
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        color: colors.neutral[700],
        '&:hover': {
          backgroundColor: colors.neutral[100],
        },
      },
    },
    sizes: {
      xs: {
        padding: `${spacing[1]} ${spacing[2]}`,
        fontSize: typography.fontSize.xs,
      },
      sm: {
        padding: `${spacing[1.5]} ${spacing[3]}`,
        fontSize: typography.fontSize.sm,
      },
      md: {
        padding: `${spacing[2]} ${spacing[4]}`,
        fontSize: typography.fontSize.sm,
      },
      lg: {
        padding: `${spacing[2.5]} ${spacing[5]}`,
        fontSize: typography.fontSize.base,
      },
      xl: {
        padding: `${spacing[3]} ${spacing[6]}`,
        fontSize: typography.fontSize.lg,
      },
    },
  },

  // Inputs
  input: {
    base: {
      width: '100%',
      padding: `${spacing[2]} ${spacing[3]}`,
      fontSize: typography.fontSize.sm,
      lineHeight: typography.lineHeight.normal,
      color: colors.semantic.text.primary,
      backgroundColor: colors.neutral[0],
      border: `${borders.width[1]} ${borders.styles.solid} ${colors.neutral[300]}`,
      borderRadius: borders.radius.md,
      transition: transitions.all,
      outline: 'none',
      '&:focus': {
        borderColor: colors.primary[500],
        boxShadow: `0 0 0 3px ${colors.primary[100]}`,
      },
      '&:disabled': {
        backgroundColor: colors.neutral[50],
        color: colors.neutral[400],
        cursor: 'not-allowed',
      },
      '&::placeholder': {
        color: colors.neutral[400],
      },
    },
    variants: {
      error: {
        borderColor: colors.error[500],
        '&:focus': {
          borderColor: colors.error[500],
          boxShadow: `0 0 0 3px ${colors.error[100]}`,
        },
      },
      success: {
        borderColor: colors.success[500],
        '&:focus': {
          borderColor: colors.success[500],
          boxShadow: `0 0 0 3px ${colors.success[100]}`,
        },
      },
    },
    sizes: {
      sm: {
        padding: `${spacing[1.5]} ${spacing[2.5]}`,
        fontSize: typography.fontSize.xs,
      },
      md: {
        padding: `${spacing[2]} ${spacing[3]}`,
        fontSize: typography.fontSize.sm,
      },
      lg: {
        padding: `${spacing[2.5]} ${spacing[3.5]}`,
        fontSize: typography.fontSize.base,
      },
    },
  },

  // Cards
  card: {
    base: {
      backgroundColor: colors.neutral[0],
      borderRadius: borders.radius.lg,
      border: `${borders.width[1]} ${borders.styles.solid} ${colors.neutral[200]}`,
      boxShadow: shadows.base,
      overflow: 'hidden',
    },
    variants: {
      elevated: {
        border: 'none',
        boxShadow: shadows.md,
      },
      outlined: {
        boxShadow: 'none',
      },
      filled: {
        backgroundColor: colors.neutral[50],
        border: 'none',
        boxShadow: 'none',
      },
    },
  },

  // Labels
  label: {
    base: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[1],
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.normal,
      color: colors.semantic.text.primary,
      marginBottom: spacing[1],
    },
    required: {
      '&::after': {
        content: '" *"',
        color: colors.error[500],
      },
    },
  },

  // Sections
  section: {
    base: {
      padding: spacing[4],
      marginBottom: spacing[4],
      backgroundColor: colors.neutral[50],
      borderRadius: borders.radius.lg,
    },
    variants: {
      bordered: {
        backgroundColor: colors.neutral[0],
        border: `${borders.width[1]} ${borders.styles.solid} ${colors.neutral[200]}`,
      },
      elevated: {
        backgroundColor: colors.neutral[0],
        boxShadow: shadows.md,
      },
    },
  },

  // Alerts
  alert: {
    base: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: spacing[3],
      padding: spacing[3],
      borderRadius: borders.radius.md,
      border: `${borders.width[1]} ${borders.styles.solid}`,
      fontSize: typography.fontSize.sm,
      lineHeight: typography.lineHeight.relaxed,
    },
    variants: {
      info: {
        backgroundColor: colors.info[50],
        borderColor: colors.info[200],
        color: colors.info[900],
      },
      success: {
        backgroundColor: colors.success[50],
        borderColor: colors.success[200],
        color: colors.success[900],
      },
      warning: {
        backgroundColor: colors.warning[50],
        borderColor: colors.warning[200],
        color: colors.warning[900],
      },
      error: {
        backgroundColor: colors.error[50],
        borderColor: colors.error[200],
        color: colors.error[900],
      },
    },
  },

  // Tables
  table: {
    base: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: typography.fontSize.sm,
      backgroundColor: colors.neutral[0],
    },
    thead: {
      backgroundColor: colors.neutral[50],
      borderBottom: `${borders.width[2]} ${borders.styles.solid} ${colors.neutral[200]}`,
    },
    th: {
      padding: spacing[3],
      fontWeight: typography.fontWeight.semibold,
      textAlign: 'left',
      color: colors.semantic.text.primary,
    },
    tbody: {
      '& tr:hover': {
        backgroundColor: colors.neutral[50],
      },
    },
    td: {
      padding: spacing[3],
      borderTop: `${borders.width[1]} ${borders.styles.solid} ${colors.neutral[200]}`,
      color: colors.semantic.text.primary,
    },
  },

  // Modals
  modal: {
    backdrop: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: zIndex.modalBackdrop,
    },
    content: {
      backgroundColor: colors.neutral[0],
      borderRadius: borders.radius.xl,
      boxShadow: shadows.xl,
      maxWidth: '90vw',
      maxHeight: '90vh',
      overflow: 'auto',
      zIndex: zIndex.modal,
    },
    header: {
      padding: spacing[4],
      borderBottom: `${borders.width[1]} ${borders.styles.solid} ${colors.neutral[200]}`,
    },
    body: {
      padding: spacing[4],
    },
    footer: {
      padding: spacing[4],
      borderTop: `${borders.width[1]} ${borders.styles.solid} ${colors.neutral[200]}`,
      display: 'flex',
      justifyContent: 'flex-end',
      gap: spacing[2],
    },
  },

  // Badges
  badge: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: `${spacing[0.5]} ${spacing[2]}`,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      lineHeight: typography.lineHeight.none,
      borderRadius: borders.radius.full,
      textTransform: 'uppercase',
    },
    variants: {
      primary: {
        backgroundColor: colors.primary[100],
        color: colors.primary[800],
      },
      success: {
        backgroundColor: colors.success[100],
        color: colors.success[800],
      },
      warning: {
        backgroundColor: colors.warning[100],
        color: colors.warning[800],
      },
      danger: {
        backgroundColor: colors.error[100],
        color: colors.error[800],
      },
      neutral: {
        backgroundColor: colors.neutral[200],
        color: colors.neutral[800],
      },
    },
  },

  // Tooltips
  tooltip: {
    base: {
      position: 'absolute',
      padding: `${spacing[2]} ${spacing[3]}`,
      fontSize: typography.fontSize.xs,
      lineHeight: typography.lineHeight.normal,
      color: colors.neutral[0],
      backgroundColor: colors.neutral[900],
      borderRadius: borders.radius.md,
      boxShadow: shadows.lg,
      zIndex: zIndex.tooltip,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    },
    arrow: {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    },
  },
};

// ==========================================
// 10. FONCTIONS UTILITAIRES
// ==========================================

/**
 * Combine plusieurs styles en un seul objet
 * @param {...Object} styles - Les styles à combiner
 * @returns {Object} Les styles combinés
 */
export const combineStyles = (...styles) => {
  return Object.assign({}, ...styles.filter(Boolean));
};

/**
 * Applique une variante à un composant
 * @param {Object} baseStyle - Le style de base
 * @param {Object} variants - Les variantes disponibles
 * @param {string} variant - La variante à appliquer
 * @returns {Object} Le style avec la variante appliquée
 */
export const applyVariant = (baseStyle, variants, variant) => {
  return combineStyles(baseStyle, variants[variant] || {});
};

/**
 * Crée une classe CSS à partir d'un objet de style
 * @param {Object} style - L'objet de style
 * @returns {string} La classe CSS
 */
export const createClassName = (style) => {
  return Object.entries(style)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
};

/**
 * Obtient une couleur avec opacité
 * @param {string} color - La couleur hex
 * @param {number} opacity - L'opacité (0-1)
 * @returns {string} La couleur avec opacité
 */
export const withOpacity = (color, opacity) => {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

/**
 * Crée un dégradé linéaire
 * @param {string} direction - La direction du dégradé
 * @param {Array} colors - Les couleurs du dégradé
 * @returns {string} Le dégradé CSS
 */
export const createGradient = (direction, colors) => {
  return `linear-gradient(${direction}, ${colors.join(', ')})`;
};

/**
 * Applique un thème sombre
 * @param {Object} lightColors - Les couleurs du thème clair
 * @returns {Object} Les couleurs du thème sombre
 */
export const darkTheme = (lightColors) => {
  return {
    ...lightColors,
    semantic: {
      text: {
        primary: colors.neutral[100],
        secondary: colors.neutral[300],
        muted: colors.neutral[500],
        inverse: colors.neutral[900],
        link: colors.primary[400],
        danger: colors.error[400],
        success: colors.success[400],
        warning: colors.warning[400],
      },
      background: {
        primary: colors.neutral[900],
        secondary: colors.neutral[800],
        tertiary: colors.neutral[700],
        hover: colors.neutral[600],
        active: colors.neutral[500],
        disabled: colors.neutral[800],
        overlay: 'rgba(0, 0, 0, 0.7)',
      },
      border: {
        light: colors.neutral[700],
        default: colors.neutral[600],
        strong: colors.neutral[500],
        focus: colors.primary[500],
        error: colors.error[500],
      },
    },
  };
};

// ==========================================
// 11. HOOKS REACT PERSONNALISÉS
// ==========================================

/**
 * Hook pour utiliser le système de design
 * @returns {Object} Le système de design complet
 */
export const useDesignSystem = () => {
  return {
    colors,
    typography,
    spacing,
    borders,
    shadows,
    transitions,
    zIndex,
    breakpoints,
    components,
    utils: {
      combineStyles,
      applyVariant,
      createClassName,
      withOpacity,
      createGradient,
      darkTheme,
    },
  };
};

/**
 * Hook pour le responsive design
 * @returns {Object} Les utilitaires responsive
 */
export const useResponsive = () => {
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < parseInt(breakpoints.sm);
  const isTablet = windowWidth >= parseInt(breakpoints.sm) && windowWidth < parseInt(breakpoints.lg);
  const isDesktop = windowWidth >= parseInt(breakpoints.lg);

  return {
    windowWidth,
    isMobile,
    isTablet,
    isDesktop,
    breakpoint: Object.entries(breakpoints)
      .reverse()
      .find(([_, value]) => windowWidth >= parseInt(value))?.[0] || 'xs',
  };
};

// ==========================================
// 12. EXPORT PAR DÉFAUT
// ==========================================

const unifiedDesignSystem = {
  colors,
  typography,
  spacing,
  borders,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  components,
  utils: {
    combineStyles,
    applyVariant,
    createClassName,
    withOpacity,
    createGradient,
    darkTheme,
  },
};

export default unifiedDesignSystem;