import { createTheme } from '@mui/material/styles';

const muiTheme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
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
          },
          '& .MuiInputLabel-root': {
            transform: 'translate(14px, -9px) scale(0.75)',
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