import React, { useState } from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * EditorialButton
 * ---------------
 * Bouton sobre éditorial — pas d'arrondi excessif, pas de gradient.
 *
 * Variantes :
 *   • primary   → fond orange #f26921, texte noir, ALL CAPS, letter-spacing 0.08em
 *   • ghost     → transparent + bordure ghost, texte ivoire
 *   • critical  → fond rouge var(--color-red-critical), texte blanc (réservé NO-GO catastrophique)
 *
 * Tailles :
 *   • sm        → padding 8px 14px, fontSize 12px
 *   • md        → padding 12px 20px, fontSize 13px  (défaut)
 *   • lg        → padding 16px 28px, fontSize 14px
 *
 * Usage :
 *   <EditorialButton variant="primary" onClick={...}>Démarrer le briefing</EditorialButton>
 *   <EditorialButton variant="ghost" size="sm">Annuler</EditorialButton>
 *   <EditorialButton variant="critical" disabled={!isReady}>No-go</EditorialButton>
 *   <EditorialButton as="a" href="/docs">Documentation</EditorialButton>
 */
const SIZE_MAP = {
  sm: { padding: '8px 14px', fontSize: '12px', minHeight: '32px' },
  md: { padding: '12px 20px', fontSize: '13px', minHeight: '40px' },
  lg: { padding: '16px 28px', fontSize: '14px', minHeight: '48px' },
};

const getVariantStyles = (variant, hovered, disabled) => {
  if (variant === 'primary') {
    return {
      backgroundColor: disabled
        ? 'var(--border-regular)'
        : hovered
        ? 'var(--accent-hover)'
        : 'var(--accent-primary)',
      color: disabled ? 'var(--text-tertiary)' : 'var(--color-black-deep)',
      border: `${tokens.border.thin} solid transparent`,
    };
  }
  if (variant === 'critical') {
    return {
      backgroundColor: disabled
        ? 'var(--border-regular)'
        : hovered
        ? '#D85B49'
        : 'var(--color-red-critical)',
      color: '#FFFFFF',
      border: `${tokens.border.thin} solid transparent`,
    };
  }
  // ghost (défaut)
  return {
    backgroundColor: hovered && !disabled ? 'var(--accent-soft)' : 'transparent',
    color: disabled
      ? 'var(--text-tertiary)'
      : hovered
      ? 'var(--accent-primary)'
      : 'var(--text-primary)',
    border: `${tokens.border.thin} solid ${
      disabled ? 'var(--border-subtle)' : hovered ? 'var(--accent-primary)' : 'var(--border-ghost)'
    }`,
  };
};

export const EditorialButton = ({
  variant = 'primary',
  size = 'md',
  children,
  disabled = false,
  loading = false,
  onClick,
  as: Tag = 'button',
  type = 'button',
  style,
  className,
  ...rest
}) => {
  const [hovered, setHovered] = useState(false);
  const isDisabled = disabled || loading;
  const sizeStyle = SIZE_MAP[size] || SIZE_MAP.md;
  const variantStyle = getVariantStyles(variant, hovered, isDisabled);

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing[2],
    fontFamily: tokens.fontFamily.sans,
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.4 : 1,
    borderRadius: tokens.radius.sm,
    transition: `background-color ${tokens.motion.base}, color ${tokens.motion.base}, border-color ${tokens.motion.base}, box-shadow ${tokens.motion.base}`,
    outline: 'none',
    userSelect: 'none',
    ...sizeStyle,
    ...variantStyle,
    ...(style || {}),
  };

  // Spinner inline pour l'état loading
  const Spinner = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'editorial-spin 0.9s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42"
        strokeDashoffset="14"
        opacity="0.85"
      />
    </svg>
  );

  return (
    <>
      <Tag
        className={className}
        type={Tag === 'button' ? type : undefined}
        disabled={Tag === 'button' ? isDisabled : undefined}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        onClick={isDisabled ? undefined : onClick}
        onMouseEnter={() => !isDisabled && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.boxShadow = tokens.shadow.focus;
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
        style={baseStyle}
        {...rest}
      >
        {loading && <Spinner />}
        {children}
      </Tag>
      <style>{`
        @keyframes editorial-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default EditorialButton;
