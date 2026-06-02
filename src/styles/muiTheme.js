// ============================================================================
//  Thème MUI v5 — ALFlight Dark Cockpit
//  ----------------------------------------------------------------------------
//  Refonte complète pour aligner tous les composants MUI sur la charte
//  éditoriale ALFlight (noir profond + ivoire + accent orange).
//
//  Couvre automatiquement les 24 fichiers qui utilisent MUI dans le wizard
//  Avion (AircraftCreationWizard, Step1BasicInfo, Step2Speeds, ...) sans
//  toucher au code de chaque composant.
//
//  Les couleurs sont exprimées en hex/rgba parce que MUI ne consomme pas les
//  variables CSS custom (besoin de valeurs résolues côté JS pour générer les
//  styles inline). Les valeurs sont SYNCHRONISÉES avec les variables CSS
//  définies dans src/index.css. Si tu changes --app-bg dans index.css, change
//  AUSSI ces valeurs ici (et inversement).
// ============================================================================

import { createTheme } from '@mui/material/styles';

// ─── Couleurs ALFlight (synchronisées avec src/index.css) ───────────────────
const ALFLIGHT_COLORS = {
  // Noirs
  appBg: '#0A0A0A',           // --app-bg
  bgSurface: '#141414',       // --bg-surface
  bgOverlay: '#1C1C1C',       // --bg-overlay
  bgRaised: '#232323',        // --bg-raised

  // Blancs / ivoire
  textPrimary: '#F5F2EC',     // --text-primary
  textSecondary: '#C9C5BD',   // --text-secondary
  textTertiary: '#8A867E',    // --text-tertiary

  // Accent orange ALFlight
  accent: '#f26921',
  accentBright: '#FF7E36',
  accentDim: '#D85410',
  accentSoft: 'rgba(242, 105, 33, 0.16)',

  // Bordures
  borderSubtle: 'rgba(245, 242, 236, 0.10)',
  borderRegular: 'rgba(245, 242, 236, 0.20)',
  borderGhost: 'rgba(245, 242, 236, 0.32)',

  // Sémantiques cockpit (parcimonieux)
  redCritical: '#C04534',
};

const muiTheme = createTheme({
  palette: {
    mode: 'dark', // 🌑 Dark mode : MUI rendra ses composants en sombre par défaut
    primary: {
      main: ALFLIGHT_COLORS.accent,
      light: ALFLIGHT_COLORS.accentBright,
      dark: ALFLIGHT_COLORS.accentDim,
      contrastText: ALFLIGHT_COLORS.appBg, // texte noir sur bouton orange
    },
    secondary: {
      main: ALFLIGHT_COLORS.accent,
      light: ALFLIGHT_COLORS.accentBright,
      dark: ALFLIGHT_COLORS.accentDim,
      contrastText: ALFLIGHT_COLORS.appBg,
    },
    error: {
      main: ALFLIGHT_COLORS.redCritical,
    },
    warning: {
      main: ALFLIGHT_COLORS.accent, // pas de jaune fluo — accent orange unique
    },
    info: {
      main: ALFLIGHT_COLORS.textSecondary, // pas de bleu — neutre cockpit
    },
    success: {
      main: ALFLIGHT_COLORS.accent, // pas de vert SaaS — accent orange unique
    },
    background: {
      default: ALFLIGHT_COLORS.appBg,
      paper: ALFLIGHT_COLORS.bgSurface,
    },
    text: {
      primary: ALFLIGHT_COLORS.textPrimary,
      secondary: ALFLIGHT_COLORS.textSecondary,
      disabled: ALFLIGHT_COLORS.textTertiary,
    },
    divider: ALFLIGHT_COLORS.borderSubtle,
    action: {
      hover: 'rgba(245, 242, 236, 0.04)',
      selected: ALFLIGHT_COLORS.accentSoft,
      disabled: ALFLIGHT_COLORS.textTertiary,
      disabledBackground: ALFLIGHT_COLORS.bgOverlay,
    },
  },

  typography: {
    fontFamily: [
      "'Century Gothic'",
      "'URW Gothic'",
      "'Questrial'",
      "'Jost'",
      'system-ui',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontWeight: 500, letterSpacing: '0' },
    h4: { fontWeight: 500 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    button: {
      fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
      fontWeight: 600,
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
  },

  shape: {
    borderRadius: 2, // angles vifs cockpit (au lieu de 8px arrondis SaaS)
  },

  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1400,
    },
  },

  components: {
    // ─── Surfaces (Paper, Card, Accordion, Dialog) ───────────────────────────
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          backgroundImage: 'none', // désactive les gradients de surface MUI
          color: ALFLIGHT_COLORS.textPrimary,
          border: `1px solid ${ALFLIGHT_COLORS.borderSubtle}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          backgroundImage: 'none',
          border: `1px solid ${ALFLIGHT_COLORS.borderSubtle}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          backgroundImage: 'none',
          border: `1px solid ${ALFLIGHT_COLORS.borderRegular}`,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          backgroundImage: 'none',
          border: `1px solid ${ALFLIGHT_COLORS.borderSubtle}`,
          '&:before': { display: 'none' }, // supprime la barre du haut
          '&.Mui-expanded': {
            margin: 0,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          color: ALFLIGHT_COLORS.textPrimary,
          '&.Mui-expanded': {
            borderBottom: `1px solid ${ALFLIGHT_COLORS.borderSubtle}`,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          backgroundImage: 'none',
          borderColor: ALFLIGHT_COLORS.borderSubtle,
        },
      },
    },

    // ─── Boutons ────────────────────────────────────────────────────────────
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          borderRadius: '2px',
          padding: '10px 20px',
          minHeight: '40px',
          boxShadow: 'none',
          '&:focus-visible': {
            outline: `2px solid ${ALFLIGHT_COLORS.accent}`,
            outlineOffset: '2px',
          },
        },
        contained: {
          backgroundColor: ALFLIGHT_COLORS.accent,
          color: ALFLIGHT_COLORS.appBg,
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: ALFLIGHT_COLORS.accentBright,
            boxShadow: 'none',
          },
          '&:active': {
            backgroundColor: ALFLIGHT_COLORS.accentDim,
          },
          '&.Mui-disabled': {
            backgroundColor: ALFLIGHT_COLORS.bgOverlay,
            color: ALFLIGHT_COLORS.textTertiary,
          },
        },
        outlined: {
          color: ALFLIGHT_COLORS.textPrimary,
          borderColor: ALFLIGHT_COLORS.borderRegular,
          '&:hover': {
            backgroundColor: 'rgba(245, 242, 236, 0.04)',
            borderColor: ALFLIGHT_COLORS.accent,
            color: ALFLIGHT_COLORS.accent,
          },
        },
        text: {
          color: ALFLIGHT_COLORS.textSecondary,
          '&:hover': {
            backgroundColor: 'rgba(245, 242, 236, 0.04)',
            color: ALFLIGHT_COLORS.textPrimary,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: ALFLIGHT_COLORS.textSecondary,
          '&:hover': {
            backgroundColor: 'rgba(245, 242, 236, 0.06)',
            color: ALFLIGHT_COLORS.textPrimary,
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.accent,
          color: ALFLIGHT_COLORS.appBg,
          '&:hover': { backgroundColor: ALFLIGHT_COLORS.accentBright },
        },
      },
    },

    // ─── Inputs ──────────────────────────────────────────────────────────────
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
        InputLabelProps: { shrink: true },
      },
      styleOverrides: {
        root: {
          // Fond input strictement identique aux <CustomSelect> (--app-bg)
          // pour cohérence visuelle desktop entre champs MUI et React custom.
          '& .MuiOutlinedInput-root': {
            backgroundColor: ALFLIGHT_COLORS.appBg,
            color: ALFLIGHT_COLORS.textPrimary,
            borderRadius: '8px', // = tokens.radius.sm + var(--radius-sm)
            fontFamily: "'Century Gothic', 'Questrial', sans-serif",
            '& fieldset': {
              borderColor: ALFLIGHT_COLORS.borderRegular,
              borderWidth: '1px',
            },
            '&:hover fieldset': {
              borderColor: ALFLIGHT_COLORS.borderGhost,
            },
            '&.Mui-focused fieldset': {
              borderColor: ALFLIGHT_COLORS.accent,
              borderWidth: '1px',
            },
            '& input, & textarea': {
              color: ALFLIGHT_COLORS.textPrimary,
              fontFamily: "'Century Gothic', 'Questrial', sans-serif",
            },
          },
          '& .MuiInputLabel-root': {
            color: ALFLIGHT_COLORS.textTertiary,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            '&.Mui-focused': { color: ALFLIGHT_COLORS.accent },
            // Patch entourant le label sur la bordure : couleur du fond
            // de l'input (PAS du parent Paper). Évite l'effet "halo gris".
            backgroundColor: ALFLIGHT_COLORS.appBg,
            padding: '0 4px',
          },
          // Helper text (texte sous l'input)
          '& .MuiFormHelperText-root': {
            fontFamily: "'Century Gothic', 'Questrial', sans-serif",
            fontSize: '11px',
            color: ALFLIGHT_COLORS.textTertiary,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.appBg,
          color: ALFLIGHT_COLORS.textPrimary,
          borderRadius: '8px',
          fontFamily: "'Century Gothic', 'Questrial', sans-serif",
        },
        notchedOutline: {
          // La "notched outline" est le fieldset MUI qui dessine le rectangle
          // autour de l'input avec une encoche pour le label. C'est CETTE
          // bordure qui créait l'"encadré gris" visible. La couleur subtle
          // (#10% ivoire) devient ici borderRegular (#20% ivoire) pour être
          // discrètement visible sur fond app-bg, sans halo gris.
          borderColor: ALFLIGHT_COLORS.borderRegular + ' !important',
          borderWidth: '1px',
        },
        input: {
          color: ALFLIGHT_COLORS.textPrimary,
        },
      },
    },
    MuiInputLabel: {
      defaultProps: { shrink: true },
      styleOverrides: {
        root: {
          color: ALFLIGHT_COLORS.textTertiary,
          // Patch sur la bordure : MÊME couleur que le fond de l'input
          // (--app-bg, pas --bg-surface) sinon halo gris visible.
          backgroundColor: ALFLIGHT_COLORS.appBg,
          padding: '0 4px',
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'outlined',
        MenuProps: {
          // ⚠️ Le menu dropdown des <Select> MUI doit avoir EXACTEMENT
          // la largeur du select fermé (pas plus large), des angles arrondis
          // ALFlight et un fond cockpit dark. anchorOrigin/transformOrigin
          // garantissent un alignement strict sous le trigger.
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          PaperProps: {
            style: {
              backgroundColor: ALFLIGHT_COLORS.bgSurface,
              border: `1px solid ${ALFLIGHT_COLORS.borderRegular}`,
              borderRadius: '8px', // identique aux selects/boutons
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)', // ombre noire neutre (PAS BLEUE)
              marginTop: '4px',
              maxHeight: '320px',
              backgroundImage: 'none',
            },
          },
          MenuListProps: {
            sx: {
              padding: '4px',
              backgroundColor: 'transparent',
            },
          },
        },
      },
      styleOverrides: {
        select: {
          color: ALFLIGHT_COLORS.textPrimary,
        },
        icon: {
          color: ALFLIGHT_COLORS.textTertiary,
        },
      },
    },
    // ─── Popover (utilisé par Select, Menu, Autocomplete, DatePicker, etc.) ──
    // Style identique au Paper de MuiSelect → cohérence sur TOUS les dropdowns
    // de l'app, pas juste les <Select>.
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          border: `1px solid ${ALFLIGHT_COLORS.borderRegular}`,
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          backgroundImage: 'none',
        },
      },
    },
    // ─── Menu (Popover spécialisé pour <Menu>) ───────────────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          border: `1px solid ${ALFLIGHT_COLORS.borderRegular}`,
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          backgroundImage: 'none',
        },
        list: {
          padding: '4px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: ALFLIGHT_COLORS.textPrimary,
          borderRadius: '6px', // léger arrondi sur les items individuels
          margin: '2px 0',
          fontFamily: "'Century Gothic', 'Questrial', 'Jost', system-ui, sans-serif",
          fontSize: '14px',
          minHeight: '40px',
          '&:hover': {
            backgroundColor: 'rgba(245, 242, 236, 0.04)', // ivoire subtle (PAS bleu)
          },
          '&.Mui-selected': {
            backgroundColor: ALFLIGHT_COLORS.accentSoft,
            color: ALFLIGHT_COLORS.accent,
            fontWeight: 600,
            '&:hover': {
              backgroundColor: ALFLIGHT_COLORS.accentSoft,
            },
          },
          '&.Mui-focusVisible': {
            backgroundColor: 'rgba(245, 242, 236, 0.06)',
          },
        },
      },
    },
    // ─── Autocomplete (utilisé par AeroclubAutocomplete) ─────────────────────
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          border: `1px solid ${ALFLIGHT_COLORS.borderRegular}`,
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          backgroundImage: 'none',
        },
        listbox: {
          padding: '4px',
        },
        option: {
          borderRadius: '6px',
          margin: '2px 0',
          minHeight: '40px',
          '&[aria-selected="true"]': {
            backgroundColor: ALFLIGHT_COLORS.accentSoft,
            color: ALFLIGHT_COLORS.accent,
          },
          '&.Mui-focused, &:hover': {
            backgroundColor: 'rgba(245, 242, 236, 0.04)',
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: ALFLIGHT_COLORS.textTertiary,
          '&.Mui-checked': { color: ALFLIGHT_COLORS.accent },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: ALFLIGHT_COLORS.textTertiary,
          '&.Mui-checked': { color: ALFLIGHT_COLORS.accent },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          '&.Mui-checked': { color: ALFLIGHT_COLORS.accent },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: ALFLIGHT_COLORS.accent },
        },
      },
    },

    // ─── Stepper ─────────────────────────────────────────────────────────────
    MuiStepper: {
      styleOverrides: {
        root: { backgroundColor: 'transparent' },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          color: ALFLIGHT_COLORS.textTertiary,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          '&.Mui-active': { color: ALFLIGHT_COLORS.accent },
          '&.Mui-completed': { color: ALFLIGHT_COLORS.textPrimary },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: ALFLIGHT_COLORS.borderRegular,
          '&.Mui-active': { color: ALFLIGHT_COLORS.accent },
          '&.Mui-completed': { color: ALFLIGHT_COLORS.accent },
        },
        text: { fill: ALFLIGHT_COLORS.appBg },
      },
    },

    // ─── Feedback (Alert, Snackbar, Tooltip) ────────────────────────────────
    MuiAlert: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          color: ALFLIGHT_COLORS.textPrimary,
          border: `1px solid ${ALFLIGHT_COLORS.borderSubtle}`,
        },
        standardWarning: {
          borderLeft: `3px solid ${ALFLIGHT_COLORS.accent}`,
        },
        standardError: {
          borderLeft: `3px solid ${ALFLIGHT_COLORS.redCritical}`,
        },
        standardInfo: {
          borderLeft: `3px solid ${ALFLIGHT_COLORS.borderGhost}`,
        },
        standardSuccess: {
          borderLeft: `3px solid ${ALFLIGHT_COLORS.accent}`,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: ALFLIGHT_COLORS.bgRaised,
          color: ALFLIGHT_COLORS.textPrimary,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.06em',
          border: `1px solid ${ALFLIGHT_COLORS.borderSubtle}`,
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.bgRaised,
          color: ALFLIGHT_COLORS.textPrimary,
        },
      },
    },

    // ─── Chips / Badges ──────────────────────────────────────────────────────
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: ALFLIGHT_COLORS.bgOverlay,
          color: ALFLIGHT_COLORS.textSecondary,
          borderRadius: '2px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
        colorPrimary: {
          backgroundColor: ALFLIGHT_COLORS.accentSoft,
          color: ALFLIGHT_COLORS.accent,
        },
      },
    },

    // ─── Tables ──────────────────────────────────────────────────────────────
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: ALFLIGHT_COLORS.borderSubtle,
          color: ALFLIGHT_COLORS.textPrimary,
        },
        head: {
          color: ALFLIGHT_COLORS.textTertiary,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 500,
        },
      },
    },

    // ─── Divider ─────────────────────────────────────────────────────────────
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: ALFLIGHT_COLORS.borderSubtle },
      },
    },

    // ─── CssBaseline : assure que body est sur --app-bg ─────────────────────
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: ALFLIGHT_COLORS.appBg,
          color: ALFLIGHT_COLORS.textPrimary,
        },
      },
    },
  },
});

export default muiTheme;
