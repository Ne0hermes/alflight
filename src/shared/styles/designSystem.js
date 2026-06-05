// ============================================================================
//  ALFlight — Design System v1
//  Charte éditoriale cinematic aviation : NOIR / BLANC / ORANGE.
//  Référence visuelle : sr-seventy.one (Lockheed SR-71 Blackbird datasheet).
//  Pilote : Cesar — 2026-05-22
// ============================================================================
//
//  RÈGLES D'USAGE OBLIGATOIRES
//  --------------------------
//  1. UNE SEULE couleur d'accent par écran : orange #f26921.
//     Pas de bordeaux. Pas de violet. Pas de bleu. Pas de couleurs sémantiques
//     (vert, jaune…). Le rouge #C04534 est RÉSERVÉ aux NO-GO catastrophiques.
//  2. Police principale : Century Gothic (fallbacks Questrial, Jost…).
//     Utilisée PARTOUT (titres, body, labels).
//     JetBrains Mono uniquement pour data : coords, ICAO, immat, valeurs.
//  3. Mode nuit (par défaut). Mode jour appliqué via [data-theme="day-cockpit"].
//  4. Pas de glass morphism flashy. Éventuellement backdrop-filter: blur(12px)
//     pour les surfaces au-dessus de photos cinematic, sans teinte colorée.
//
// ============================================================================

/* ---------------------------------------------------------------------------
 * COULEURS DE MARQUE
 * ------------------------------------------------------------------------- */
const palette = {
  // Orange aviation officiel ALFlight
  orange: {
    primary: '#f26921', // accent unique
    bright: '#FF7E36',  // hover
    dim: '#D85410',     // active / pressed
    soft: 'rgba(242, 105, 33, 0.16)', // focus ring / overlays
  },

  // Noirs (mode nuit)
  // ⚠️ palette.black.deep est conservé en valeur littérale UNIQUEMENT comme
  // fallback de secours pour les rares contextes JS qui ne peuvent pas
  // consommer une CSS variable. Pour tout style React/CSS, préférer
  // 'var(--app-bg)' (variable maître définie dans src/index.css).
  black: {
    deep: 'var(--app-bg)', // canvas — référence la variable maître --app-bg
    elevated: '#141414',   // cards, surfaces
    overlay: '#1C1C1C',    // inputs, modals
    surface: '#232323',    // separators, progress track
  },

  // Blancs (mode nuit + mode jour)
  white: {
    pure: '#FFFFFF',     // parcimonieux — KPI critiques uniquement
    soft: '#F5F2EC',     // texte par défaut en mode nuit, canvas en mode jour
    muted: '#C9C5BD',    // secondaire
    dim: '#8A867E',      // tertiaire / placeholders / disabled
  },

  // Rouge réservé aux NO-GO catastrophiques (météo VFR impossible, masse hors limite…)
  red: {
    critical: '#C04534',
    criticalDim: '#8B2E22',
  },

  // Transparents utilitaires (mode nuit) — référencent les variables CSS maîtres.
  // Le noir est dérivé de --app-bg (défini dans src/index.css). Pour changer le ton
  // de fond global, modifier UNIQUEMENT --app-bg : tout suit automatiquement.
  alpha: {
    border: 'var(--border-subtle, rgba(245, 242, 236, 0.10))',
    borderStrong: 'var(--border-regular, rgba(245, 242, 236, 0.20))',
    borderGhost: 'var(--border-ghost, rgba(245, 242, 236, 0.32))',
    overlay: 'var(--app-bg-alpha-72)',
  },
};

/* ---------------------------------------------------------------------------
 * POLICES
 * ------------------------------------------------------------------------- */
const fontFamily = {
  // Police principale — Century Gothic et fallbacks libres pour le web
  sans: "'Century Gothic', 'URW Gothic', 'Questrial', 'Jost', 'Avant Garde', system-ui, sans-serif",
  // `mono` = ALIAS de `sans` : police UNIQUE (Century Gothic) PARTOUT, valeurs comprises.
  // Plus de JetBrains Mono ; l'alignement des chiffres passe par tabular-nums (cf. data/dataLg).
  mono: "'Century Gothic', 'URW Gothic', 'Questrial', 'Jost', 'Avant Garde', system-ui, sans-serif",
};

/* ---------------------------------------------------------------------------
 * ÉCHELLE TYPOGRAPHIQUE
 *
 *  hero      → splash, page d'accueil cinematic (96px)
 *  display   → titres principaux d'écran (56px)
 *  h1        → entêtes de section majeure (40px)
 *  h2        → entêtes de section (28px)
 *  h3        → sous-section / titre de card (20px)
 *  body      → texte courant (15px)
 *  small     → notes secondaires (13px)
 *  eyebrow   → labels ALL CAPS mono au-dessus des titres (11px)
 *  data      → valeurs en monospace (15px)
 *  dataLg    → valeurs principales en monospace (28px)
 * ------------------------------------------------------------------------- */
const typography = {
  hero: {
    fontFamily: fontFamily.sans,
    fontSize: '96px',
    lineHeight: 1.0,
    letterSpacing: '0.08em',
    fontWeight: 700,
  },
  display: {
    fontFamily: fontFamily.sans,
    fontSize: '56px',
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    fontWeight: 600,
  },
  h1: {
    fontFamily: fontFamily.sans,
    fontSize: '40px',
    lineHeight: 1.1,
    letterSpacing: '-0.015em',
    fontWeight: 600,
  },
  h2: {
    fontFamily: fontFamily.sans,
    fontSize: '28px',
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    fontWeight: 500,
  },
  h3: {
    fontFamily: fontFamily.sans,
    fontSize: '20px',
    lineHeight: 1.3,
    letterSpacing: '-0.005em',
    fontWeight: 500,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: '15px',
    lineHeight: 1.55,
    letterSpacing: '0',
    fontWeight: 400,
  },
  small: {
    fontFamily: fontFamily.sans,
    fontSize: '13px',
    lineHeight: 1.5,
    letterSpacing: '0',
    fontWeight: 400,
  },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: '11px',
    lineHeight: 1.2,
    letterSpacing: '0.20em',
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  data: {
    fontFamily: fontFamily.mono,
    fontSize: '15px',
    lineHeight: 1.4,
    letterSpacing: '0',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums', // chiffres à chasse fixe (alignement colonnes)
  },
  dataLg: {
    fontFamily: fontFamily.mono,
    fontSize: '28px',
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
    fontWeight: 500,
    fontVariantNumeric: 'tabular-nums',
  },
};

/* ---------------------------------------------------------------------------
 * ESPACEMENTS — échelle 4px
 * ------------------------------------------------------------------------- */
const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '32px',
  8: '40px',
  9: '48px',
  10: '64px',
  11: '80px',
  12: '96px',
};

/* ---------------------------------------------------------------------------
 * RAYONS
 *
 *  L'esprit éditorial cinematic privilégie les angles vifs.
 *  Arrondis modérés pour cohérence avec l'app existante (cards 12-16px).
 * ------------------------------------------------------------------------- */
const radius = {
  none: '0',
  sm: '8px',     /* éléments compacts (chips, boutons icônes, inputs) */
  md: '12px',    /* default cards, sections */
  lg: '16px',    /* hero, grandes surfaces */
  xl: '20px',    /* modales pleine page */
  pill: '999px', /* badges très petits, toggles */
};

/* ---------------------------------------------------------------------------
 * BORDURES
 * ------------------------------------------------------------------------- */
const border = {
  thin: '1px',
  regular: '1.5px',
  thick: '2px',
  accent: '3px',
};

/* ---------------------------------------------------------------------------
 * OMBRES (très sobres — l'éditorial préfère les lignes aux ombres)
 * ------------------------------------------------------------------------- */
const shadow = {
  none: 'none',
  glow: '0 0 0 1px rgba(242, 105, 33, 0.32), 0 0 24px rgba(242, 105, 33, 0.20)',
  focus: '0 0 0 3px rgba(242, 105, 33, 0.32)',
  lift: '0 8px 24px rgba(0, 0, 0, 0.40)',
};

/* ---------------------------------------------------------------------------
 * BREAKPOINTS
 * ------------------------------------------------------------------------- */
const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
};

/* ---------------------------------------------------------------------------
 * TRANSITIONS
 * ------------------------------------------------------------------------- */
const motion = {
  fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '180ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '280ms cubic-bezier(0.4, 0, 0.2, 1)',
  cinematic: '600ms cubic-bezier(0.4, 0, 0.2, 1)',
};

/* ---------------------------------------------------------------------------
 * Z-INDEX
 * ------------------------------------------------------------------------- */
const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  overlay: 1000,
  modal: 1100,
  alert: 1200,
  splash: 1300,
};

/* ---------------------------------------------------------------------------
 * EXPORT — TOKENS
 * ------------------------------------------------------------------------- */
export const tokens = {
  palette,
  fontFamily,
  typography,
  spacing,
  radius,
  border,
  shadow,
  breakpoints,
  motion,
  zIndex,
};

/* ---------------------------------------------------------------------------
 * EXPORT — DARK THEME (mode nuit, défaut)
 * ------------------------------------------------------------------------- */
export const darkTheme = {
  mode: 'night-cockpit',
  background: {
    canvas: palette.black.deep,
    surface: palette.black.elevated,
    overlay: palette.black.overlay,
    raised: palette.black.surface,
  },
  text: {
    primary: palette.white.soft,
    secondary: palette.white.muted,
    tertiary: palette.white.dim,
    inverse: palette.black.deep,
    accent: palette.orange.primary,
    critical: palette.red.critical,
  },
  border: {
    subtle: palette.alpha.border,
    regular: palette.alpha.borderStrong,
    ghost: palette.alpha.borderGhost,
    accent: palette.orange.primary,
    critical: palette.red.critical,
  },
  accent: {
    primary: palette.orange.primary,
    hover: palette.orange.bright,
    active: palette.orange.dim,
    soft: palette.orange.soft,
  },
};

/* ---------------------------------------------------------------------------
 * EXPORT — LIGHT THEME (mode jour — pleine luminosité cockpit)
 * ------------------------------------------------------------------------- */
export const lightTheme = {
  mode: 'day-cockpit',
  background: {
    canvas: palette.white.soft,
    surface: '#FFFFFF',
    overlay: '#EFECE5',
    raised: '#E5E1D9',
  },
  text: {
    primary: '#0F0F0F',
    secondary: '#3A3A3A',
    tertiary: '#6B6B6B',
    inverse: palette.white.soft,
    accent: palette.orange.dim,
    critical: palette.red.critical,
  },
  border: {
    subtle: 'rgba(15, 15, 15, 0.10)',
    regular: 'rgba(15, 15, 15, 0.20)',
    ghost: 'rgba(15, 15, 15, 0.32)',
    accent: palette.orange.dim,
    critical: palette.red.critical,
  },
  accent: {
    primary: palette.orange.dim,
    hover: palette.orange.primary,
    active: '#A8420C',
    soft: 'rgba(242, 105, 33, 0.12)',
  },
};

/* ===========================================================================
 *  HELPERS
 * ======================================================================== */

/**
 * Concatène des classes (équivalent classnames léger).
 * Filtre les valeurs falsy.
 * @param  {...(string|false|null|undefined)} classes
 * @returns {string}
 */
export const cx = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Convertit une valeur px en rem.
 * Base : 16px.
 * @param {number} px
 * @returns {string} ex: "1.5rem"
 */
export const pxToRem = (px) => `${px / 16}rem`;

/**
 * Génère une media query CSS minWidth pour un breakpoint donné.
 * @param {keyof typeof breakpoints} breakpoint
 * @returns {string} ex: "@media (min-width: 768px)"
 */
export const mq = (breakpoint) => {
  const value = breakpoints[breakpoint];
  if (typeof value !== 'number') {
    return '';
  }
  return `@media (min-width: ${value}px)`;
};

/**
 * Helper d'accès au thème actif.
 * Lit l'attribut [data-theme] sur <html>. Par défaut : darkTheme.
 * @returns {typeof darkTheme}
 */
export const getActiveTheme = () => {
  if (typeof document === 'undefined') return darkTheme;
  const mode = document.documentElement.getAttribute('data-theme');
  return mode === 'day-cockpit' ? lightTheme : darkTheme;
};

export default {
  tokens,
  darkTheme,
  lightTheme,
  cx,
  pxToRem,
  mq,
  getActiveTheme,
};
