// src/shared/styles/styleSystem.js

// Thème centralisé avec toutes les valeurs de design
export const theme = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a'
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d'
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f'
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d'
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827'
    }
  },
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem'
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem'
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px'
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
  }
};

// Création d'une classe StyleSystem pour générer des styles statiques
class StyleSystem {
  constructor(theme) {
    this.theme = theme;
    this._cache = new Map();
  }

  // Méthode pour créer des styles avec cache
  create(key, styleFactory) {
    if (!this._cache.has(key)) {
      this._cache.set(key, styleFactory(this.theme));
    }
    return this._cache.get(key);
  }

  // Utilitaires de style pré-définis
  get flex() {
    return this.create('flex', () => ({
      row: { display: 'flex', flexDirection: 'row' },
      col: { display: 'flex', flexDirection: 'column' },
      center: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      between: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      start: { display: 'flex', justifyContent: 'flex-start', alignItems: 'center' },
      end: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }
    }));
  }

  
 get spacing() {
    return this.create('spacing', (theme) => ({
      // Padding
      p: (size) => ({ padding: theme.spacing[size] }),
      px: (size) => ({ paddingLeft: theme.spacing[size], paddingRight: theme.spacing[size] }),
      py: (size) => ({ paddingTop: theme.spacing[size], paddingBottom: theme.spacing[size] }),
      pt: (size) => ({ paddingTop: theme.spacing[size] }),
      pr: (size) => ({ paddingRight: theme.spacing[size] }),
      pb: (size) => ({ paddingBottom: theme.spacing[size] }),
      pl: (size) => ({ paddingLeft: theme.spacing[size] }),
      // Margin
      m: (size) => ({ margin: theme.spacing[size] }),
      mx: (size) => ({ marginLeft: theme.spacing[size], marginRight: theme.spacing[size] }),
      my: (size) => ({ marginTop: theme.spacing[size], marginBottom: theme.spacing[size] }),
      mt: (size) => ({ marginTop: theme.spacing[size] }),
      mr: (size) => ({ marginRight: theme.spacing[size] }),
      mb: (size) => ({ marginBottom: theme.spacing[size] }),
      ml: (size) => ({ marginLeft: theme.spacing[size] }),
      // Gap
      gap: (size) => ({ gap: theme.spacing[size] })
    }));
  }

  get text() {
    return this.create('text', (theme) => ({
      xs: { fontSize: theme.fontSize.xs },
      sm: { fontSize: theme.fontSize.sm },
      base: { fontSize: theme.fontSize.base },
      lg: { fontSize: theme.fontSize.lg },
      xl: { fontSize: theme.fontSize.xl },
      '2xl': { fontSize: theme.fontSize['2xl'] },
      bold: { fontWeight: theme.fontWeight.bold },
      medium: { fontWeight: theme.fontWeight.medium },
      primary: { color: theme.colors.gray[900] },
      secondary: { color: theme.colors.gray[600] },
      muted: { color: theme.colors.gray[500] }
    }));
  }

  get bg() {
    return this.create('bg', (theme) => ({
      white: { backgroundColor: '#ffffff' },
      gray: { backgroundColor: theme.colors.gray[50] },
      primary: { backgroundColor: theme.colors.primary[500] },
      success: { backgroundColor: theme.colors.success[500] },
      warning: { backgroundColor: theme.colors.warning[500] },
      danger: { backgroundColor: theme.colors.danger[500] }
    }));
  }

  get border() {
    return this.create('border', (theme) => ({
      base: { border: `1px solid ${theme.colors.gray[200]}` },
      primary: { border: `2px solid ${theme.colors.primary[500]}` },
      success: { border: `2px solid ${theme.colors.success[500]}` },
      warning: { border: `2px solid ${theme.colors.warning[500]}` },
      danger: { border: `2px solid ${theme.colors.danger[500]}` }
    }));
  }

  get rounded() {
    return this.create('rounded', (theme) => ({
      sm: { borderRadius: theme.borderRadius.sm },
      base: { borderRadius: theme.borderRadius.base },
      md: { borderRadius: theme.borderRadius.md },
      lg: { borderRadius: theme.borderRadius.lg },
      xl: { borderRadius: theme.borderRadius.xl },
      full: { borderRadius: theme.borderRadius.full }
    }));
  }

  get shadow() {
    return this.create('shadow', (theme) => ({
      sm: { boxShadow: theme.shadow.sm },
      base: { boxShadow: theme.shadow.base },
      md: { boxShadow: theme.shadow.md },
      lg: { boxShadow: theme.shadow.lg }
    }));
  }

  // Composants pré-stylés
  get components() {
    return this.create('components', (theme) => ({
      card: {
        base: {
          backgroundColor: '#ffffff',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[4],
          boxShadow: theme.shadow.base,
          border: `1px solid ${theme.colors.gray[200]}`
        },
        hover: {
          backgroundColor: '#ffffff',
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[4],
          boxShadow: theme.shadow.md,
          border: `1px solid ${theme.colors.gray[300]}`,
          transition: 'all 0.2s',
          cursor: 'pointer'
        }
      },
      input: {
        base: {
          width: '100%',
          padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
          border: `1px solid ${theme.colors.gray[300]}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.sm,
          backgroundColor: '#ffffff',
          transition: 'border-color 0.2s',
          outline: 'none'
        },
        focus: {
          borderColor: theme.colors.primary[500]
        },
        error: {
          borderColor: theme.colors.danger[500],
          backgroundColor: theme.colors.danger[50]
        }
      },
      button: {
        base: {
          padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.spacing[2]
        },
        primary: {
          backgroundColor: theme.colors.primary[600],
          color: '#ffffff',
          '&:hover': {
            backgroundColor: theme.colors.primary[700]
          }
        },
        secondary: {
          backgroundColor: theme.colors.gray[200],
          color: theme.colors.gray[900],
          '&:hover': {
            backgroundColor: theme.colors.gray[300]
          }
        },
        danger: {
          backgroundColor: theme.colors.danger[600],
          color: '#ffffff',
          '&:hover': {
            backgroundColor: theme.colors.danger[700]
          }
        }
      },
      label: {
        base: {
          display: 'block',
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          color: theme.colors.gray[700],
          marginBottom: theme.spacing[1]
        }
      },
      section: {
        base: {
          backgroundColor: theme.colors.gray[50],
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[4],
          marginBottom: theme.spacing[4]
        }
      },
      alert: {
        base: {
          padding: theme.spacing[3],
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing[4],
          display: 'flex',
          alignItems: 'flex-start',
          gap: theme.spacing[3]
        },
        success: {
          backgroundColor: theme.colors.success[50],
          color: theme.colors.success[900],
          border: `1px solid ${theme.colors.success[200]}`
        },
        warning: {
          backgroundColor: theme.colors.warning[50],
          color: theme.colors.warning[900],
          border: `1px solid ${theme.colors.warning[200]}`
        },
        danger: {
          backgroundColor: theme.colors.danger[50],
          color: theme.colors.danger[900],
          border: `1px solid ${theme.colors.danger[200]}`
        },
        info: {
          backgroundColor: theme.colors.primary[50],
          color: theme.colors.primary[900],
          border: `1px solid ${theme.colors.primary[200]}`
        }
      }
    }));
  }

  // Méthode pour combiner plusieurs styles
  combine(...styles) {
    return Object.assign({}, ...styles.filter(Boolean));
  }
}

// Instance singleton du système de styles
export const sx = new StyleSystem(theme);

// Hook pour utiliser le thème dans les composants
export const useTheme = () => theme;

// Utilitaire pour créer des variantes de composants
export const createVariants = (baseStyle, variants) => {
  return (variant = 'default') => {
    return sx.combine(baseStyle, variants[variant] || {});
  };
};