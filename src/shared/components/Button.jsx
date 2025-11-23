import React from 'react';
import { Button as MuiButton } from '@mui/material';

/**
 * Composant Button unifié pour l'application ALFlight
 * Utilise le thème bordeaux et garantit la cohérence visuelle
 *
 * @param {string} variant - Type de bouton: 'primary', 'secondary', 'outlined', 'text'
 * @param {string} size - Taille: 'small', 'medium', 'large'
 * @param {ReactNode} children - Contenu du bouton
 * @param {object} sx - Styles personnalisés Material-UI
 * @param {object} props - Autres props passées au bouton MUI
 */
export const Button = ({
  variant = 'primary',
  size = 'medium',
  children,
  sx = {},
  ...props
}) => {
  // Mapper les variants personnalisés vers MUI
  const getMuiVariant = () => {
    if (variant === 'primary') return 'contained';
    if (variant === 'secondary') return 'outlined';
    return variant;
  };

  // Styles de base selon le variant
  const getVariantStyles = () => {
    const baseStyles = {
      borderRadius: '8px',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: 'normal',
      transition: 'all 0.2s ease',
    };

    if (variant === 'primary') {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #8B1538, #A91B45)',
        boxShadow: '0 2px 8px rgba(147, 22, 60, 0.3)',
        '&:hover': {
          background: 'linear-gradient(135deg, #6B0F2B, #8B1538)',
          boxShadow: '0 4px 12px rgba(147, 22, 60, 0.4)',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
        '&:focus-visible': {
          outline: '3px solid #93163C',
          outlineOffset: '2px',
        },
      };
    }

    if (variant === 'secondary') {
      return {
        ...baseStyles,
        backgroundColor: 'transparent',
        color: '#93163C',
        border: '2px solid #93163C',
        '&:hover': {
          backgroundColor: 'rgba(147, 22, 60, 0.05)',
          borderColor: '#6B0F2B',
          color: '#6B0F2B',
        },
        '&:focus-visible': {
          outline: '3px solid #93163C',
          outlineOffset: '2px',
        },
      };
    }

    if (variant === 'outlined') {
      return {
        ...baseStyles,
        borderColor: '#93163C',
        color: '#93163C',
        '&:hover': {
          borderColor: '#6B0F2B',
          backgroundColor: 'rgba(147, 22, 60, 0.05)',
        },
      };
    }

    if (variant === 'text') {
      return {
        ...baseStyles,
        color: '#93163C',
        '&:hover': {
          backgroundColor: 'rgba(147, 22, 60, 0.05)',
        },
      };
    }

    return baseStyles;
  };

  // Tailles de padding
  const getSizeStyles = () => {
    if (size === 'small') {
      return { padding: '8px 16px', fontSize: '14px' };
    }
    if (size === 'large') {
      return { padding: '16px 32px', fontSize: '16px' };
    }
    return { padding: '12px 24px', fontSize: '15px' };
  };

  return (
    <MuiButton
      variant={getMuiVariant()}
      size={size}
      sx={{
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiButton>
  );
};

export default Button;
