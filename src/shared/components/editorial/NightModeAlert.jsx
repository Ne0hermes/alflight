import React, { useEffect, useState } from 'react';
import { tokens } from '@shared/styles/designSystem';
import TechLabel from './TechLabel';

/**
 * NightModeAlert
 * --------------
 * Alerte minimaliste slide-in bas-droite, fond #141414, bordure gauche 3px.
 *
 * Severities :
 *   • info     → bordure gauche #F5F2EC (soft)
 *   • warn     → bordure gauche #f26921 (orange)
 *   • critical → bordure gauche var(--color-red-critical) (rouge)
 *   • success  → bordure gauche #f26921 transparent (signal positif sobre)
 *
 * Usage :
 *   <NightModeAlert
 *     severity="warn"
 *     title="QNH non saisi"
 *     description="Veuillez renseigner le QNH avant le briefing."
 *     onClose={() => ...}
 *     actions={<EditorialButton size="sm">Compléter</EditorialButton>}
 *   />
 */
const SEVERITY_MAP = {
  info: {
    borderColor: 'var(--text-primary)',
    icon: 'i',
    label: 'Info',
  },
  warn: {
    borderColor: 'var(--accent-primary)',
    icon: '!',
    label: 'Attention',
  },
  critical: {
    borderColor: 'var(--color-red-critical)',
    icon: '×',
    label: 'Critique',
  },
  success: {
    borderColor: 'var(--accent-primary)',
    icon: '✓',
    label: 'OK',
  },
};

export const NightModeAlert = ({
  severity = 'info',
  title,
  description,
  onClose,
  actions,
  position = 'bottom-right',
  style,
  className,
  ...rest
}) => {
  const [visible, setVisible] = useState(false);
  const config = SEVERITY_MAP[severity] || SEVERITY_MAP.info;

  useEffect(() => {
    // Slide-in à l'apparition
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClose = () => {
    setVisible(false);
    if (onClose) {
      setTimeout(onClose, 280);
    }
  };

  const positionStyle = (() => {
    const offset = tokens.spacing[6];
    if (position === 'bottom-left') return { left: offset, bottom: offset };
    if (position === 'top-right') return { right: offset, top: offset };
    if (position === 'top-left') return { left: offset, top: offset };
    return { right: offset, bottom: offset };
  })();

  const enterX = position.includes('right') ? 24 : -24;

  return (
    <div
      role="alert"
      aria-live={severity === 'critical' ? 'assertive' : 'polite'}
      className={className}
      style={{
        position: 'fixed',
        zIndex: tokens.zIndex.alert,
        maxWidth: '360px',
        minWidth: '280px',
        backgroundColor: 'var(--bg-surface)',
        borderLeft: `${tokens.border.accent} solid ${config.borderColor}`,
        borderTop: `${tokens.border.thin} solid var(--border-subtle)`,
        borderRight: `${tokens.border.thin} solid var(--border-subtle)`,
        borderBottom: `${tokens.border.thin} solid var(--border-subtle)`,
        borderRadius: tokens.radius.sm,
        padding: tokens.spacing[5],
        boxShadow: tokens.shadow.lift,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : `translateX(${enterX}px)`,
        transition: `opacity ${tokens.motion.slow}, transform ${tokens.motion.slow}`,
        ...positionStyle,
        ...(style || {}),
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: tokens.spacing[4] }}>
        {/* Icône carrée minimaliste */}
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `${tokens.border.thin} solid ${config.borderColor}`,
            color: config.borderColor,
            fontFamily: tokens.fontFamily.mono,
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {config.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <TechLabel style={{ color: config.borderColor, marginBottom: tokens.spacing[1] }}>
            {config.label}
          </TechLabel>
          {title && (
            <div
              style={{
                fontFamily: tokens.fontFamily.sans,
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                marginBottom: description ? tokens.spacing[2] : 0,
              }}
            >
              {title}
            </div>
          )}
          {description && (
            <div
              style={{
                fontFamily: tokens.fontFamily.sans,
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {description}
            </div>
          )}
          {actions && (
            <div
              style={{
                display: 'flex',
                gap: tokens.spacing[3],
                marginTop: tokens.spacing[4],
              }}
            >
              {actions}
            </div>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            aria-label="Fermer l'alerte"
            onClick={handleClose}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontFamily: tokens.fontFamily.mono,
              fontSize: '16px',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: `color ${tokens.motion.fast}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default NightModeAlert;
