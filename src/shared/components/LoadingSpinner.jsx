// src/shared/components/LoadingSpinner.jsx
import React, { memo } from 'react';
import { sx } from '@shared/styles/styleSystem';

export const LoadingSpinner = memo(({ size = 'medium' }) => {
  const sizes = {
    small: 24,
    medium: 40,
    large: 60
  };
  
  return (
    <div style={sx.combine(sx.flex.center, sx.spacing.p(8))}>
      <div style={{
        width: sizes[size],
        height: sizes[size],
        border: '3px solid var(--border-subtle)',
        borderTopColor: 'var(--text-secondary)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;