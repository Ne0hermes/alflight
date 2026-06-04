// ============================================================================
//  Thème legacy ALFlight — remappé sur la charte éditoriale v1
//  ----------------------------------------------------------------------------
//  Ce fichier existait historiquement avec une palette bordeaux/SaaS hardcodée.
//  Pour éviter de toucher aux 277 consommateurs de theme.colors.* à travers
//  l'app, les valeurs sont maintenant remappées vers les variables CSS
//  ALFlight officielles définies dans src/index.css.
//
//  ⚠️ NE PAS AJOUTER DE NOUVELLES VALEURS HARDCODÉES ICI.
//  Pour de nouvelles couleurs ou tokens, utiliser directement les variables
//  CSS (var(--app-bg), var(--accent-primary), etc.) ou tokens.* depuis
//  src/shared/styles/designSystem.js.
// ============================================================================

export const theme = {
  colors: {
    // ─── Couleurs de marque (orange ALFlight officiel) ───
    primary: 'var(--accent-primary)',         // #f26921
    secondary: 'var(--accent-hover)',         // #FF7E36 (orange clair)
    accent: 'var(--accent-active)',           // #D85410 (orange foncé)

    // ─── Surfaces ───
    background: 'var(--app-bg)',              // #0A0A0A (noir profond)
    backgroundCard: 'var(--bg-surface)',      // #141414 (cards)
    backgroundGlass: 'var(--bg-overlay)',     // #1C1C1C (surface plus claire)

    // ─── Texte ───
    textPrimary: 'var(--text-primary)',       // #F5F2EC (ivoire)
    textSecondary: 'var(--text-secondary)',   // #C9C5BD (ivoire muted)
    textMuted: 'var(--text-tertiary)',        // #8A867E (gris muted)

    // ─── Bordures ───
    border: 'var(--border-subtle)',           // rgba(245, 242, 236, 0.10)
    borderHover: 'var(--border-regular)',     // rgba(245, 242, 236, 0.20)

    // ─── États sémantiques ───
    success: 'var(--accent-primary)',         // pas de vert SaaS — accent ALFlight
    warning: 'var(--accent-primary)',         // pas de jaune fluo — accent ALFlight
    error: 'var(--color-red-critical)',        // red-critical ALFlight (NO-GO)
    info: 'var(--text-secondary)',            // pas de bleu SaaS — neutre cockpit
  },

  // ─── Polices (charte éditoriale ALFlight) ───
  fonts: {
    primary: "'Century Gothic', 'URW Gothic', 'Questrial', 'Jost', system-ui, sans-serif",
    secondary: "'Century Gothic', 'URW Gothic', 'Questrial', system-ui, sans-serif",
    mono: "'JetBrains Mono', 'IBM Plex Mono', 'Roboto Mono', monospace",
  },

  // ─── Gradients — simplifiés en aplat orange (pas de gradient bordeaux historique) ───
  gradients: {
    primary: 'var(--accent-primary)',
    logo: 'var(--accent-primary)',
    hero: 'var(--app-bg)',
  },

  // ─── Shadows — neutralisées (pas de boxShadow rose bordeaux) ───
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 12px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 40px rgba(0, 0, 0, 0.6)',
  },

  // ─── Animations (conservées) ───
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
    `,
  },
};

// Fonction pour créer un style de carte (legacy — remappée charte ALFlight)
export const createCardStyle = (isHovered = false) => ({
  background: theme.colors.backgroundCard,
  border: `1px solid ${isHovered ? theme.colors.borderHover : theme.colors.border}`,
  borderRadius: '8px', // = tokens.radius.sm (cohérent boutons + dashboard)
  padding: '24px',
  transition: 'border-color 0.2s ease',
  boxShadow: 'none', // pas de boxShadow en cockpit dark (le fond suffit)
  transform: 'none', // pas de transform agressif au hover (cockpit sobre)
});

// Fonction pour créer un style de bouton (legacy — remappée charte ALFlight)
export const createButtonStyle = (variant = 'primary') => {
  const baseStyle = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontFamily: theme.fonts.mono, // boutons en JetBrains Mono cockpit
  };

  if (variant === 'primary') {
    return {
      ...baseStyle,
      background: 'var(--accent-primary)',
      color: 'var(--text-inverse)',
      boxShadow: 'none',
    };
  }

  if (variant === 'secondary') {
    return {
      ...baseStyle,
      background: 'transparent',
      color: 'var(--accent-primary)',
      border: '1px solid var(--accent-primary)',
    };
  }

  return baseStyle;
};

// Glass effect — simplifié charte cockpit dark
export const createGlassStyle = () => ({
  background: theme.colors.backgroundGlass,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: `1px solid ${theme.colors.border}`,
  borderRadius: '8px',
});
