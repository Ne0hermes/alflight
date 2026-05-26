import React from 'react';
import { tokens } from '@shared/styles/designSystem';

/**
 * StepDial
 * --------
 * Stepper horizontal compact pour les wizards (FlightPlan, Performance…).
 * Ligne horizontale fine. Chaque étape = cercle 32px avec numéro mono.
 *
 *   • Étape actuelle  → bordure orange + glow orange
 *   • Étape complétée → fond orange transparent
 *   • Étape future    → bordure ghost
 *
 * Usage :
 *   <StepDial
 *     steps={[
 *       { label: 'Avion' },
 *       { label: 'Route' },
 *       { label: 'Carburant' },
 *       { label: 'Briefing' }
 *     ]}
 *     currentIndex={1}
 *     onStepClick={(i) => goToStep(i)}
 *   />
 */
export const StepDial = ({
  steps = [],
  currentIndex = 0,
  onStepClick,
  style,
  className,
  ...rest
}) => {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  return (
    <div
      className={className}
      role="list"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        position: 'relative',
        width: '100%',
        ...(style || {}),
      }}
      {...rest}
    >
      {/* Ligne connecteur en arrière-plan */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          height: '1px',
          backgroundColor: 'var(--border-subtle)',
          zIndex: 0,
        }}
      />
      {/* Ligne orange remplie jusqu'à currentIndex */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          height: '1px',
          backgroundColor: 'var(--accent-primary)',
          width:
            steps.length > 1
              ? `calc((100% - 32px) * ${currentIndex / (steps.length - 1)})`
              : 0,
          transition: `width ${tokens.motion.slow}`,
          zIndex: 0,
        }}
      />

      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isComplete = index < currentIndex;
        const isClickable = typeof onStepClick === 'function' && index <= currentIndex;

        const circleStyle = (() => {
          if (isCurrent) {
            return {
              backgroundColor: 'var(--bg-canvas)',
              border: `${tokens.border.thin} solid var(--accent-primary)`,
              color: 'var(--accent-primary)',
              boxShadow: '0 0 16px var(--accent-soft)',
            };
          }
          if (isComplete) {
            return {
              backgroundColor: 'var(--accent-soft)',
              border: `${tokens.border.thin} solid var(--accent-primary)`,
              color: 'var(--accent-primary)',
            };
          }
          return {
            backgroundColor: 'var(--bg-canvas)',
            border: `${tokens.border.thin} solid var(--border-ghost)`,
            color: 'var(--text-tertiary)',
          };
        })();

        return (
          <div
            key={step.id || step.label || index}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: tokens.spacing[3],
              flex: 1,
              minWidth: 0,
            }}
          >
            <button
              type="button"
              disabled={!isClickable}
              onClick={isClickable ? () => onStepClick(index) : undefined}
              aria-label={`Étape ${index + 1} : ${step.label || ''}`}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: tokens.fontFamily.mono,
                fontSize: '12px',
                fontWeight: 600,
                cursor: isClickable ? 'pointer' : 'default',
                padding: 0,
                transition: `box-shadow ${tokens.motion.base}, background-color ${tokens.motion.base}, color ${tokens.motion.base}`,
                ...circleStyle,
              }}
            >
              {isComplete ? '✓' : step.icon || String(index + 1).padStart(2, '0')}
            </button>
            <span
              style={{
                fontFamily: tokens.fontFamily.mono,
                fontSize: '10px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: isCurrent
                  ? 'var(--accent-primary)'
                  : isComplete
                  ? 'var(--text-secondary)'
                  : 'var(--text-tertiary)',
                textAlign: 'center',
                fontWeight: 500,
                lineHeight: 1.3,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: `color ${tokens.motion.base}`,
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default StepDial;
