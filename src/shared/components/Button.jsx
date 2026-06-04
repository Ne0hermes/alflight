import React from 'react';
import { Button as MuiButton } from '@mui/material';

/**
 * Composant Button unifié pour l'application ALFlight
 * Utilise les tokens charte ALFlight (accent orange unique) et garantit la cohérence visuelle
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
        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
        // Charte cockpit : pas de boxShadow (le fond suffit). L'ancienne ombre
        // noire rgba(0,0,0,.3) virait « bordeaux » sur les fonds orange (login).
        boxShadow: 'none',
        '&:hover': {
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary))',
          boxShadow: 'none',
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
        '&:focus-visible': {
          outline: '3px solid var(--accent-primary)',
          outlineOffset: '2px',
        },
      };
    }

    if (variant === 'secondary') {
      return {
        ...baseStyles,
        backgroundColor: 'transparent',
        color: 'var(--accent-primary)',
        border: '2px solid var(--accent-primary)',
        '&:hover': {
          backgroundColor: 'var(--accent-soft)',
          borderColor: 'var(--accent-primary)',
          color: 'var(--accent-primary)',
        },
        '&:focus-visible': {
          outline: '3px solid var(--accent-primary)',
          outlineOffset: '2px',
        },
      };
    }

    if (variant === 'outlined') {
      return {
        ...baseStyles,
        borderColor: 'var(--accent-primary)',
        color: 'var(--accent-primary)',
        '&:hover': {
          borderColor: 'var(--accent-primary)',
          backgroundColor: 'var(--accent-soft)',
        },
      };
    }

    if (variant === 'text') {
      return {
        ...baseStyles,
        color: 'var(--accent-primary)',
        '&:hover': {
          backgroundColor: 'var(--accent-soft)',
        },
      };
    }

    return baseStyles;
  };

  // Tailles de padding
  const getSizeStyles = () => {
    if (size === 'small') {
      return { padding: '8px 16px', fontSize: 'var(--fs-body)' };
    }
    if (size === 'large') {
      return { padding: '16px 32px', fontSize: 'var(--fs-title)' };
    }
    return { padding: '12px 24px', fontSize: 'var(--fs-body)' };
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
