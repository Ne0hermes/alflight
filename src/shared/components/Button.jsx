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
      borderRadius: 'var(--radius-sm)',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: 'normal',
      transition: 'all 0.2s ease',
    };

    if (variant === 'primary') {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, var(--accent-primary), #FF7E36)',
        boxShadow: '0 2px 8px rgba(147, 22, 60, 0.3)',
        '&:hover': {
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary))',
          boxShadow: '0 4px 12px rgba(147, 22, 60, 0.4)',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
        '&:focus-visible': {
          outline: '3px solid #f26921',
          outlineOffset: '2px',
        },
      };
    }

    if (variant === 'secondary') {
      return {
        ...baseStyles,
        backgroundColor: 'transparent',
        color: '#f26921',
        border: '2px solid #f26921',
        '&:hover': {
          backgroundColor: 'rgba(147, 22, 60, 0.05)',
          borderColor: 'var(--accent-primary)',
          color: 'var(--accent-primary)',
        },
        '&:focus-visible': {
          outline: '3px solid #f26921',
          outlineOffset: '2px',
        },
      };
    }

    if (variant === 'outlined') {
      return {
        ...baseStyles,
        borderColor: '#f26921',
        color: '#f26921',
        '&:hover': {
          borderColor: 'var(--accent-primary)',
          backgroundColor: 'rgba(147, 22, 60, 0.05)',
        },
      };
    }

    if (variant === 'text') {
      return {
        ...baseStyles,
        color: '#f26921',
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
