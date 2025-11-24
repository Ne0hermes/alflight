import { createTheme } from '@mui/material/styles';

// Force le thème blanc pour toute l'application
const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#93163C',      // Bordeaux ALFlight
      light: '#A91B45',     // Bordeaux clair
      dark: '#6B0F2B',      // Bordeaux foncé
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#93163C',      // Bordeaux également pour cohérence
      light: '#A91B45',
      dark: '#6B0F2B',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#ef4444',      // Rouge moderne
    },
    warning: {
      main: '#fbbf24',      // Orange moderne
    },
    info: {
      main: '#3b82f6',      // Bleu moderne
    },
    success: {
      main: '#10b981',      // Vert moderne
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#000000',
      secondary: '#374151',
    },
    divider: 'rgba(209, 213, 219, 0.3)',
  },
  typography: {
    fontFamily: [
      'Space Grotesk',
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    h2: {
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    h3: {
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    h4: {
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    h5: {
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  breakpoints: {
    values: {
      xs: 0,      // Mobile portrait (0-640px)
      sm: 640,    // Mobile landscape (640-768px)
      md: 768,    // Tablet (768-1024px)
      lg: 1024,   // Desktop (1024-1400px)
      xl: 1400,   // Large desktop (1400px+)
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          padding: '12px 24px',
          fontWeight: 600,
          '&:focus-visible': {
            outline: '3px solid #93163C',
            outlineOffset: '2px',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #8B1538, #A91B45)',
          boxShadow: '0 2px 8px rgba(147, 22, 60, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #6B0F2B, #8B1538)',
            boxShadow: '0 4px 12px rgba(147, 22, 60, 0.4)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
        InputLabelProps: {
          shrink: true,
        },
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            height: '56px',
            '& input': {
              padding: '16.5px 14px',
            },
            '&:focus-within': {
              boxShadow: '0 0 0 2px rgba(147, 22, 60, 0.2)',
            },
            '& fieldset': {
              borderColor: 'rgba(209, 213, 219, 1)',
            },
            '&:hover fieldset': {
              borderColor: '#93163C',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#93163C',
              borderWidth: '2px',
            },
          },
          '& .MuiInputLabel-root': {
            transform: 'translate(14px, -9px) scale(0.75)',
            '&.Mui-focused': {
              color: '#93163C',
            },
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'outlined',
        displayEmpty: true,
      },
      styleOverrides: {
        root: {
          height: '56px',
        },
        select: {
          height: '56px',
          paddingTop: '16.5px',
          paddingBottom: '16.5px',
          display: 'flex',
          alignItems: 'center',
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            height: '56px',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          height: '56px',
        },
        input: {
          padding: '16.5px 14px',
        },
      },
    },
    MuiInputLabel: {
      defaultProps: {
        shrink: true,
      },
      styleOverrides: {
        root: {
          position: 'absolute',
          transform: 'translate(14px, -6px) scale(0.75)',
          backgroundColor: '#fff',
          padding: '0 4px',
        },
      },
    },
  },
});

export default muiTheme;