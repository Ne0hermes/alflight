import React, { useState, useId } from 'react';
import { tokens } from '@shared/styles/designSystem';
import TechLabel from './TechLabel';

/**
 * CockpitTextField
 * ----------------
 * Input éditorial avec label ALL CAPS au-dessus (pas flottant).
 * Affichage d'une unité en suffix optionnel.
 * Bordure 1px sobre, focus bordure orange + ring orange-soft.
 *
 * Usage :
 *   <CockpitTextField
 *     label="QNH"
 *     value={qnh}
 *     onChange={setQnh}
 *     unit="hPa"
 *     type="number"
 *     placeholder="1013"
 *   />
 */
export const CockpitTextField = ({
  label,
  value,
  onChange,
  unit,
  error,
  helperText,
  placeholder,
  type = 'text',
  disabled = false,
  required = false,
  id: providedId,
  name,
  style,
  className,
  inputStyle,
  autoComplete = 'off',
  ...rest
}) => {
  const generatedId = useId();
  const id = providedId || `cockpit-input-${generatedId}`;
  const [focused, setFocused] = useState(false);

  const handleChange = (event) => {
    if (typeof onChange === 'function') {
      onChange(event);
    }
  };

  const borderColor = error
    ? 'var(--color-red-critical)'
    : focused
    ? 'var(--accent-primary)'
    : 'var(--border-regular)';

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[2], ...(style || {}) }}>
      {label && (
        <TechLabel as="label" htmlFor={id} active={focused}>
          {label}
          {required && <span style={{ color: 'var(--accent-primary)', marginLeft: '4px' }}>*</span>}
        </TechLabel>
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'stretch',
          backgroundColor: 'var(--bg-overlay)',
          border: `${tokens.border.thin} solid ${borderColor}`,
          borderRadius: tokens.radius.sm,
          transition: `border-color ${tokens.motion.fast}, box-shadow ${tokens.motion.fast}`,
          boxShadow: focused && !error ? `0 0 0 3px var(--accent-soft)` : 'none',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          id={id}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={helperText || error ? `${id}-helper` : undefined}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
            fontFamily: tokens.fontFamily.sans,
            fontSize: '15px',
            lineHeight: 1.4,
            color: 'var(--text-primary)',
            caretColor: 'var(--accent-primary)',
            ...(inputStyle || {}),
          }}
          {...rest}
        />
        {unit && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${tokens.spacing[4]}`,
              fontFamily: tokens.fontFamily.mono,
              fontSize: '12px',
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              borderLeft: `${tokens.border.thin} solid var(--border-subtle)`,
              userSelect: 'none',
            }}
          >
            {unit}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <span
          id={`${id}-helper`}
          style={{
            fontFamily: tokens.fontFamily.sans,
            fontSize: '12px',
            color: error ? 'var(--color-red-critical)' : 'var(--text-tertiary)',
            lineHeight: 1.4,
          }}
        >
          {error || helperText}
        </span>
      )}
    </div>
  );
};

export default CockpitTextField;
