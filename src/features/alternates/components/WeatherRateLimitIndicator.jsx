// src/components/WeatherRateLimitIndicator.jsx
import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

/**
 * Composant pour afficher l'état de limitation de l'API météo
 * Affiche un avertissement si les appels à l'API météo sont limités
 */
export const WeatherRateLimitIndicator = () => {
  // Pour le moment, affichage temporaire de l'avertissement
  // Pourrait être connecté à un store pour tracking des erreurs 429
  const isRateLimited = true; // Temporairement toujours actif
  
  if (!isRateLimited) {
    return null;
  }
  
  return (
    <div style={sx.combine(
      sx.components.alert.base, 
      sx.components.alert.warning,
      sx.spacing.mb(4),
      {
        borderLeft: '4px solid #f59e0b'
      }
    )}>
      <AlertTriangle size={20} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(1))}>
          API Météo temporairement limitée
        </p>
        <p style={sx.combine(sx.text.xs, sx.text.secondary)}>
          Les données météo en temps réel sont temporairement désactivées suite à une limitation du service. 
          Les fonctionnalités de sélection d'aérodromes restent disponibles sans les conditions météo actuelles.
        </p>
      </div>
      <Info size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
    </div>
  );
};