// src/features/navigation/components/PerformanceCalculator.jsx
import React, { memo } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { Calculator } from 'lucide-react';

export const PerformanceCalculator = memo(() => {
  return (
    <div style={sx.combine(sx.flex.center, sx.spacing.p(8))}>
      <div style={sx.text.center}>
        <Calculator size={48} style={{ margin: '0 auto', color: sx.theme.colors.gray[400] }} />
        <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mt(4))}>
          Calculateur de performances
        </h2>
        <p style={sx.combine(sx.text.secondary, sx.spacing.mt(2))}>
          Module en cours de développement
        </p>
      </div>
    </div>
  );
});

PerformanceCalculator.displayName = 'PerformanceCalculator';