// src/features/weight-balance/components/LoadInput.jsx
import React, { memo } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const LoadInput = memo(({ label, value, onChange, max, highlight = false }) => {
  const inputStyle = sx.combine(
    sx.components.input.base,
    highlight && {
      borderColor: sx.theme.colors.primary[500],
      backgroundColor: sx.theme.colors.primary[50]
    }
  );

  return (
    <div>
      <label style={sx.combine(sx.components.label.base, sx.spacing.mb(1))}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        max={max}
        style={inputStyle}
      />
    </div>
  );
});

LoadInput.displayName = 'LoadInput';