import React from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * LoadingCockpit
 * --------------
 * Loader circulaire sobre orange. Animation rotation 1.2s linear infinite.
 *
 * Props :
 *   • size  → diamètre (default 40)
 *   • label → texte optionnel sous le loader (mono ALL CAPS)
 *
 * Usage :
 *   <LoadingCockpit />
 *   <LoadingCockpit size={56} label="Chargement données SIA" />
 */
export const LoadingCockpit = ({
  size = 40,
  label,
  strokeWidth = 2,
  style,
  className,
  ...rest
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * 0.25; // arc visible
  const gap = circumference - dash;

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacing[4],
        ...(style || {}),
      }}
      {...rest}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          display: 'block',
          animation: 'cockpit-spin 1.2s linear infinite',
        }}
      >
        {/* Cercle de fond */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Arc orange */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${gap}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {label && (
        <span
          style={{
            fontFamily: tokens.fontFamily.mono,
            fontSize: '10px',
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      )}

      <style>{`
        @keyframes cockpit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingCockpit;
