// src/utils/theme.js
export const theme = {
  colors: {
    // Couleurs principales - plus neutres et épurées
    primary: '#2563eb',      // Bleu principal
    primaryLight: '#dbeafe', // Bleu très clair
    primaryDark: '#1e40af',  // Bleu foncé
    
    // Couleurs neutres
    background: '#ffffff',
    surface: '#f8fafc',      // Gris très clair pour les surfaces
    border: '#e2e8f0',       // Bordures plus douces
    
    // Textes
    text: {
      primary: '#1e293b',    // Texte principal
      secondary: '#64748b',  // Texte secondaire
      muted: '#94a3b8'       // Texte désactivé
    },
    
    // États
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Backgrounds spécifiques
    section: '#f8fafc',      // Fond des sections
    hover: '#f1f5f9',        // Survol
    selected: '#e0e7ff'      // Sélection
  },
  
  spacing: {
    // Espacements réduits
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px'
  },
  
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px'
  },
  
  fontSize: {
    xs: '11px',
    sm: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    xxl: '18px',
    xxxl: '20px'
  },
  
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
  }
};

// Styles réutilisables
export const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: theme.spacing.lg
  },
  
  card: {
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md
  },
  
  section: {
    backgroundColor: theme.colors.section,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  
  input: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background,
    outline: 'none',
    transition: 'border-color 0.2s',
    ':focus': {
      borderColor: theme.colors.primary
    }
  },
  
  button: {
    primary: {
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      backgroundColor: theme.colors.primary,
      color: theme.colors.background,
      border: 'none',
      borderRadius: theme.borderRadius.sm,
      fontSize: theme.fontSize.md,
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      ':hover': {
        backgroundColor: theme.colors.primaryDark
      }
    },
    secondary: {
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      backgroundColor: 'transparent',
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.sm,
      fontSize: theme.fontSize.md,
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      ':hover': {
        backgroundColor: theme.colors.hover
      }
    }
  },
  
  label: {
    display: 'block',
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    fontWeight: '500'
  },
  
  heading: {
    h1: {
      fontSize: theme.fontSize.xxxl,
      fontWeight: '600',
      color: theme.colors.text.primary,
      margin: '0 0 ' + theme.spacing.md + ' 0'
    },
    h2: {
      fontSize: theme.fontSize.xxl,
      fontWeight: '600',
      color: theme.colors.text.primary,
      margin: '0 0 ' + theme.spacing.md + ' 0'
    },
    h3: {
      fontSize: theme.fontSize.xl,
      fontWeight: '600',
      color: theme.colors.text.primary,
      margin: '0 0 ' + theme.spacing.sm + ' 0'
    }
  },
  
  grid: {
    display: 'grid',
    gap: theme.spacing.md
  },
  
  flex: {
    display: 'flex',
    gap: theme.spacing.sm
  }
};