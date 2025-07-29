// src/features/weather/WeatherModule.jsx
import React, { memo } from 'react';
import { Cloud } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

export const WeatherModule = memo(() => {
  return (
    <div style={sx.combine(sx.flex.center, sx.spacing.p(8))}>
      <div style={sx.text.center}>
        <Cloud size={48} style={{ margin: '0 auto', color: sx.theme.colors.gray[400] }} />
        <h2 style={sx.combine(sx.text.xl, sx.text.bold, sx.spacing.mt(4))}>
          Module Météo
        </h2>
        <p style={sx.combine(sx.text.secondary, sx.spacing.mt(2))}>
          En cours de développement
        </p>
      </div>
    </div>
  );
});

WeatherModule.displayName = 'WeatherModule';

export default WeatherModule;