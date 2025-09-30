import { styled } from '@mui/material/styles';
import { FormControl, TextField, InputLabel } from '@mui/material';

// Style uniforme pour tous les FormControl du wizard
export const StyledFormControl = styled(FormControl)(({ theme }) => ({
  '& .MuiInputLabel-root': {
    transformOrigin: 'center',
    textAlign: 'center',
    width: '100%',
    '&.MuiInputLabel-shrink': {
      transformOrigin: 'top center',
    }
  },
  '& .MuiSelect-select': {
    textAlign: 'center'
  },
  '& .MuiOutlinedInput-input': {
    textAlign: 'center'
  }
}));

// Style uniforme pour tous les TextField du wizard
export const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiInputLabel-root': {
    transformOrigin: 'center',
    textAlign: 'center',
    width: '100%',
    '&.MuiInputLabel-shrink': {
      transformOrigin: 'top center',
    }
  },
  '& .MuiOutlinedInput-input': {
    textAlign: 'center'
  }
}));

// Configuration par défaut pour les FormControl
export const formControlConfig = {
  fullWidth: true,
  size: 'small',
  sx: { maxWidth: 350 }
};

// Configuration par défaut pour les TextField
export const textFieldConfig = {
  fullWidth: true,
  size: 'small',
  sx: { maxWidth: 400 }
};