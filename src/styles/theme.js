// Thème ALFlight - Charte graphique Bordeaux
export const theme = {
  colors: {
    // Couleurs Bordeaux
    primary: '#93163C',
    secondary: '#A91B45', 
    accent: '#6B0F2B',
    
    // Couleurs de base
    background: '#FFFFFF',
    backgroundCard: 'rgba(255, 255, 255, 0.95)',
    backgroundGlass: 'rgba(255, 255, 255, 0.8)',
    
    // Texte
    textPrimary: '#000000',
    textSecondary: '#9CA3AF',
    textMuted: '#D1D5DB',
    
    // Bordures
    border: 'rgba(147, 22, 60, 0.2)',
    borderHover: 'rgba(147, 22, 60, 0.5)',
    
    // États
    success: '#10b981',
    warning: '#fbbf24',
    error: '#ef4444',
    info: '#3b82f6'
  },
  
  fonts: {
    primary: "'Space Grotesk', 'Inter', sans-serif",
    secondary: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace"
  },
  
  gradients: {
    primary: 'linear-gradient(135deg, #8B1538, #A91B45)',
    logo: 'linear-gradient(135deg, #ffffff, #8B1538, #A91B45, #8B1538, #ffffff)',
    hero: 'linear-gradient(135deg, #8B1538 0%, #6B0F2B 100%)'
  },
  
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
    md: '0 10px 30px rgba(0, 0, 0, 0.5)',
    lg: '0 20px 50px rgba(139, 21, 56, 0.3)',
    xl: '0 30px 60px rgba(139, 21, 56, 0.4)'
  },
  
  animations: {
    gradientShift: `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `,
    float: `
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    `,
    fly: `
      @keyframes fly {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        25% { transform: translateX(5px) rotate(2deg); }
        75% { transform: translateX(-5px) rotate(-2deg); }
      }
    `
  }
};

// Fonction pour créer un style de carte
export const createCardStyle = (isHovered = false) => ({
  background: theme.colors.backgroundCard,
  border: `1px solid ${isHovered ? theme.colors.borderHover : theme.colors.border}`,
  borderRadius: '15px',
  padding: '2.5rem',
  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  boxShadow: isHovered ? theme.shadows.lg : theme.shadows.md,
  transform: isHovered ? 'translateY(-10px) scale(1.02)' : 'none'
});

// Fonction pour créer un style de bouton
export const createButtonStyle = (variant = 'primary') => {
  const baseStyle = {
    padding: '1rem 2rem',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: theme.fonts.primary
  };
  
  if (variant === 'primary') {
    return {
      ...baseStyle,
      background: theme.gradients.primary,
      color: theme.colors.textPrimary,
      boxShadow: theme.shadows.sm
    };
  }
  
  if (variant === 'secondary') {
    return {
      ...baseStyle,
      background: 'transparent',
      color: theme.colors.primary,
      border: `2px solid ${theme.colors.primary}`
    };
  }
  
  return baseStyle;
};

// Fonction pour créer un style glass effect
export const createGlassStyle = () => ({
  background: theme.colors.backgroundGlass,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '15px'
});