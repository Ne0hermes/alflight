// src/features/vac/VACModule.jsx
import React, { memo } from 'react';
import { Map } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const VACModule = memo(() => {
  return (
    <div style={sx.combine(sx.flex.center, sx.spacing.p(8))}>
      <div style={sx.text.center}>
        <Map size={48} style={{ margin: '0 auto', color: sx.theme.colors.gray[400] }} />
        <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mt(4))}>
          Module Cartes VAC
        </h2>
        <p style={sx.combine(sx.text.secondary, sx.spacing.mt(2))}>
          En cours de développement
        </p>
      </div>
    </div>
  );
});

VACModule.displayName = 'VACModule';

export default VACModule;