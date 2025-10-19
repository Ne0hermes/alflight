// src/components/WeatherRateLimitIndicator.jsx
import React, { memo } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { useWeatherStore } from '@core/stores/weatherStore';

export const WeatherRateLimitIndicator = memo(() => {
  const { rateLimitInfo } = useWeatherStore();
  
  // Si pas d'info de rate limit, ne rien afficher
  if (!rateLimitInfo || !rateLimitInfo.isLimited) {
    return null;
  }
  
  const remainingMinutes = rateLimitInfo.resetTime 
    ? Math.ceil((rateLimitInfo.resetTime - Date.now()) / 60000)
    : 0;
  
  return (
    <div style={sx.combine(
      sx.components.alert.base,
      sx.components.alert.warning,
      sx.spacing.mb(4)
    )}>
      <AlertTriangle size={16} />
      <div>
        <p style={sx.combine(sx.text.sm, sx.text.bold)}>
          Limite API météo atteinte
        </p>
        <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
          Les appels météo sont temporairement désactivés. 
          {remainingMinutes > 0 && ` Réessayez dans ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`}
        </p>
        <p style={sx.combine(sx.text.xs, sx.text.secondary, sx.spacing.mt(1))}>
          <Info size={12} style={{ display: 'inline', marginRight: '4px' }} />
          Les données météo existantes restent disponibles.
        </p>
      </div>
    </div>


  );
});

WeatherRateLimitIndicator.displayName = 'WeatherRateLimitIndicator';

export default WeatherRateLimitIndicator;