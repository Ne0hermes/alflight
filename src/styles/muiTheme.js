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
          // Demande utilisateur : fond ET bordure TRANSPARENTS sur les
          // accordéons du wizard avion (encart gris fin trop visible).
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          border: 'none',
          boxShadow: 'none',
          '&:before': { display: 'none' }, // supprime la barre du haut MUI
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
          backgroundColor: 'transparent',
          padding: '0 16px',
          '&.Mui-expanded': {
            borderBottom: 'none',
            minHeight: '48px',
          },
        },
        content: {
          margin: '12px 0',
          '&.Mui-expanded': {
            margin: '12px 0',
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          padding: '8px 16px 16px',
          borderTop: 'none',
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
    // ⚠️ PATTERN GLOBAL : "Stacked Label Centered"
    // ----------------------------------------------------------------------
    // L'utilisateur veut que TOUS les labels MUI (TextField, Select, Auto-
    // complete, FormControl) soient :
    //   1) STRICTEMENT AU-DESSUS de l'input (jamais chevauchés sur la
    //      bordure du fieldset comme le pattern "Outlined Floating Label"
    //      de MUI par défaut).
    //   2) CENTRÉS horizontalement (même alignement que le texte input).
    //   3) Police UNIFORMISÉE : JetBrains Mono 11px 0.12em uppercase ivoire-dim.
    //   4) Espace AÉRÉ entre le label et l'input (6-8px) pour la lisibilité.
    //   5) Le <legend> de la "notched outline" est SUPPRIMÉ (display: none)
    //      pour ne plus avoir l'encoche qui chevauche la bordure.
    //
    // Effet : pattern identique à un <label> stacké au-dessus d'un <input>.
    // Cohérent avec les <CustomSelect> partagés et les natifs HTML stylés
    // via la classe .alflight-field-stack.
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
        InputLabelProps: { shrink: true },
      },
      styleOverrides: {
        root: {
          // Container du TextField : flex column pour stacker label puis input.
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',

          // ─── Label "stacked above" ────────────────────────────────────
          '& .MuiInputLabel-root': {
            position: 'static !important',
            transform: 'none !important',
            transformOrigin: 'top center !important',
            marginBottom: '8px',
            textAlign: 'center',
            width: '100%',
            // Plus d'encart noir au-dessus de la bordure : le label est
            // hors du fieldset maintenant, donc fond TRANSPARENT.
            backgroundColor: 'transparent !important',
            padding: '0 !important',
            // Typographie unifiée (eyebrow mono ALFlight)
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace !important",
            fontSize: '11px !important',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: ALFLIGHT_COLORS.textTertiary,
            // Permet le wrap si label long (ex. "Marque/Constructeur")
            whiteSpace: 'normal',
            overflow: 'visible',
            lineHeight: 1.4,
            maxWidth: '100%',
            pointerEvents: 'auto',
            '&.Mui-focused': { color: ALFLIGHT_COLORS.accent },
            '&.Mui-error': { color: ALFLIGHT_COLORS.redCritical || '#C04534' },
          },

          // ─── Fieldset input : SANS bordure au repos, transparent ─────
          // Demande utilisateur : "rendre cet élément transparent" car
          // même avec 20% d'opacité ivoire, le fieldset crée un "léger
          // encart gris" autour de l'input et du Select.
          //
          // Solution : bordure 100% TRANSPARENTE au repos. Le contraste
          // entre le fond input (--app-bg #0A0A0A) et le fond parent
          // (--bg-overlay #1C1C1C ou --bg-surface #141414) suffit à
          // délimiter visuellement la zone de saisie sans bordure.
          //
          // Au hover : bordure subtle (10% ivoire) légère.
          // Au focus : bordure orange (accent-primary).
          '& .MuiOutlinedInput-root': {
            backgroundColor: ALFLIGHT_COLORS.appBg,
            color: ALFLIGHT_COLORS.textPrimary,
            borderRadius: '8px',
            fontFamily: "'Century Gothic', 'Questrial', sans-serif",
            '& fieldset': {
              borderColor: ALFLIGHT_COLORS.borderRegular + ' !important',
              borderWidth: '1px',
              '& > legend': {
                display: 'none !important',
                width: '0 !important',
                maxWidth: '0 !important',
                height: '0 !important',
                padding: '0 !important',
                visibility: 'hidden !important',
                overflow: 'hidden !important',
                '& > span': {
                  display: 'none !important',
                },
              },
            },
            '&:hover fieldset': {
              borderColor: ALFLIGHT_COLORS.borderRegular + ' !important',
            },
            '&.Mui-focused fieldset': {
              borderColor: ALFLIGHT_COLORS.accent + ' !important',
              borderWidth: '1px',
            },
            // ⚠️ MUI Select rend son trigger en <div role="combobox"> AVEC
            // les classes MuiSelect-select + MuiInputBase-input + MuiOutlinedInput-input
            // PAS en <input>. Donc cibler input/textarea seul ne suffit PAS
            // pour appliquer la police Century Gothic au texte affiché.
            // → Cibler aussi .MuiSelect-select + .MuiInputBase-input.
            '& input, & textarea, & .MuiSelect-select, & .MuiInputBase-input': {
              color: ALFLIGHT_COLORS.textPrimary,
              fontFamily: "'Century Gothic', 'Questrial', sans-serif !important",
              fontSize: '14px',
              textAlign: 'center', // Texte input CENTRÉ comme le label
            },
            // L'<input class="MuiSelect-nativeInput"> est un input caché que
            // MUI utilise pour le form submit + accessibilité. Il a déjà
            // opacity:0 par défaut, mais on force pour être sûr qu'il ne
            // déforme jamais le layout (effet "double zone de saisie").
            '& .MuiSelect-nativeInput': {
              opacity: 0,
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
            },
          },

          // Helper text sous l'input : centré aussi
          '& .MuiFormHelperText-root': {
            fontFamily: "'Century Gothic', 'Questrial', sans-serif",
            fontSize: '11px',
            color: ALFLIGHT_COLORS.textTertiary,
            textAlign: 'center',
            marginTop: '6px',
            marginLeft: 0,
            marginRight: 0,
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
          // Bordure UNIFORME au repos sur tous les inputs MUI (TextField,
          // Select, Autocomplete). borderRegular (20% ivoire) pour matcher
          // visuellement le contour perçu par l'utilisateur sur le
          // TextField "Puissance moteur".
          borderColor: ALFLIGHT_COLORS.borderRegular + ' !important',
          borderWidth: '1px',
          top: '0 !important',
          '& > legend': {
            display: 'none !important',
            width: '0 !important',
            maxWidth: '0 !important',
            height: '0 !important',
            padding: '0 !important',
            visibility: 'hidden !important',
            overflow: 'hidden !important',
            '& > span': {
              display: 'none !important',
              padding: '0 !important',
            },
          },
        },
        input: {
          color: ALFLIGHT_COLORS.textPrimary,
          fontFamily: "'Century Gothic', 'Questrial', sans-serif !important",
          fontSize: '14px',
          textAlign: 'center', // Centre le texte input
        },
      },
    },
    // .MuiInputBase-input cible TOUS les inputs MUI (texte, select, date…)
    // Override de la police au niveau le plus large pour cohérence absolue.
    MuiInputBase: {
      styleOverrides: {
        input: {
          fontFamily: "'Century Gothic', 'Questrial', sans-serif !important",
          fontSize: '14px',
          color: ALFLIGHT_COLORS.textPrimary,
        },
      },
    },
    MuiInputLabel: {
      defaultProps: { shrink: true },
      styleOverrides: {
        root: {
          // Pattern stacked global (déjà détaillé dans MuiTextField mais
          // utile pour les InputLabel isolés de FormControl avec Select).
          position: 'static !important',
          transform: 'none !important',
          transformOrigin: 'top center',
          marginBottom: '8px',
          textAlign: 'center',
          width: '100%',
          backgroundColor: 'transparent !important',
          padding: '0 !important',
          fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace !important",
          fontSize: '11px !important',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: ALFLIGHT_COLORS.textTertiary,
          whiteSpace: 'normal',
          overflow: 'visible',
          lineHeight: 1.4,
          maxWidth: '100%',
          '&.Mui-focused': { color: ALFLIGHT_COLORS.accent },
        },
      },
    },
    // FormControl : container du Select + InputLabel — mêmes contraintes
    // que MuiTextField pour stacker label puis input.
    MuiFormControl: {
      defaultProps: {
        fullWidth: true,
      },
      styleOverrides: {
        root: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true, // garantit la classe MuiInputBase-fullWidth → largeur 100%
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
        // ⚠️ MuiSelect.select cible le <div role="combobox"> qui contient
        // le texte affiché (ex. "Monomoteur", "Léger (L)"). Sans cet
        // override la police par défaut MUI (Roboto) prend le dessus sur
        // la police ALFlight (Century Gothic).
        select: {
          color: ALFLIGHT_COLORS.textPrimary,
          fontFamily: "'Century Gothic', 'Questrial', sans-serif !important",
          fontSize: '14px',
          textAlign: 'center',
          // ⚠️ Padding ALIGNÉ sur MuiOutlinedInput.input par défaut MUI
          // (16.5px vertical, 14px horizontal). Conservation du
          // paddingRight 32px nécessaire pour la flèche dropdown absolue.
          //
          // Mon override précédent (paddingLeft 32 + paddingRight 32) créait
          // une différence de 36px de largeur utile vs TextField → effet
          // visuel "Select plus étroit / plus rétréci / contour plus pâle".
          //
          // Avec 14px à gauche et 32px à droite, le contenu textAlign:center
          // est légèrement décalé à gauche de 9px par rapport au centre
          // mathématique, mais reste imperceptible à l'œil. L'apparence est
          // strictement identique au TextField voisin "Puissance moteur".
          paddingTop: '16.5px !important',
          paddingBottom: '16.5px !important',
          paddingLeft: '14px !important',
          paddingRight: '32px !important',
          minWidth: 0,
          boxSizing: 'border-box',
        },
        icon: {
          color: ALFLIGHT_COLORS.textTertiary,
        },
        nativeInput: {
          // Force l'<input class="MuiSelect-nativeInput"> à rester
          // strictement invisible (jamais d'effet "double zone de saisie").
          opacity: 0,
          pointerEvents: 'none',
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
        // ⚠️ Autocomplete a sa propre hiérarchie qui contourne les
        // overrides MuiTextField. Sans ces règles, le TextField interne
        // (rendu via renderInput) conserve le pattern Outlined par défaut
        // de MUI (fieldset 20% gris + legend visible + police Roboto).
        // → Forcer ici les mêmes overrides que MuiTextField pour cohérence
        // visuelle stricte avec "Puissance moteur", "Catégorie", etc.
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: ALFLIGHT_COLORS.appBg,
            borderRadius: '8px',
            fontFamily: "'Century Gothic', 'Questrial', sans-serif !important",
            '& fieldset': {
              borderColor: ALFLIGHT_COLORS.borderRegular + ' !important',
              borderWidth: '1px',
              '& > legend': {
                display: 'none !important',
                width: '0 !important',
                maxWidth: '0 !important',
                height: '0 !important',
                padding: '0 !important',
                visibility: 'hidden !important',
                overflow: 'hidden !important',
                '& > span': {
                  display: 'none !important',
                },
              },
            },
            '&:hover fieldset': {
              borderColor: ALFLIGHT_COLORS.borderRegular + ' !important',
            },
            '&.Mui-focused fieldset': {
              borderColor: ALFLIGHT_COLORS.accent + ' !important',
              borderWidth: '1px',
            },
          },
          '& .MuiAutocomplete-input': {
            color: ALFLIGHT_COLORS.textPrimary,
            fontFamily: "'Century Gothic', 'Questrial', sans-serif !important",
            fontSize: '14px',
            textAlign: 'center !important',
          },
          '& .MuiInputLabel-root': {
            position: 'static !important',
            transform: 'none !important',
            marginBottom: '8px',
            textAlign: 'center',
            width: '100%',
            backgroundColor: 'transparent !important',
            padding: '0 !important',
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace !important",
            fontSize: '11px !important',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: ALFLIGHT_COLORS.textTertiary,
            whiteSpace: 'normal',
          },
        },
        paper: {
          backgroundColor: ALFLIGHT_COLORS.bgSurface,
          border: `1px solid ${ALFLIGHT_COLORS.borderRegular}`,
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          backgroundImage: 'none',
        },
        listbox: {
          padding: '4px',
          fontFamily: "'Century Gothic', 'Questrial', sans-serif",
        },
        option: {
          borderRadius: '6px',
          margin: '2px 0',
          minHeight: '40px',
          fontFamily: "'Century Gothic', 'Questrial', sans-serif",
          '&[aria-selected="true"]': {
            backgroundColor: ALFLIGHT_COLORS.accentSoft,
            color: ALFLIGHT_COLORS.accent,
          },
          '&.Mui-focused, &:hover': {
            backgroundColor: 'rgba(245, 242, 236, 0.04)',
          },
        },
        // L'icône Clear (croix) du bouton aria-label="Clear" doit utiliser
        // la couleur tertiaire ALFlight, pas le bleu par défaut MUI.
        clearIndicator: {
          color: ALFLIGHT_COLORS.textTertiary,
          '&:hover': {
            color: ALFLIGHT_COLORS.textPrimary,
            backgroundColor: 'rgba(245, 242, 236, 0.04)',
          },
        },
        popupIndicator: {
          color: ALFLIGHT_COLORS.textTertiary,
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
