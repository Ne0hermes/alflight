// src/features/weight-balance/components/WeightBalanceInfo.jsx
import React, { memo } from 'react';
import { sx } from '@shared/styles/styleSystem';
import { FUEL_DENSITIES } from '@utils/constants';

export const WeightBalanceInfo = memo(({ aircraft, fobFuel, fuelData }) => {
  if (!aircraft) return null;

  const fuelDensity = FUEL_DENSITIES[aircraft.fuelType];
  const wb = aircraft.weightBalance;
  
  // Calcul du carburant restant à l'atterrissage
  const fuelBalance = fuelData ? Object.values(fuelData).reduce((sum, f) => sum + (f?.ltr || 0), 0) : 0;
  const remainingFuelL = Math.max(0, (fobFuel?.ltr || 0) - fuelBalance);

  return (
    <div style={sx.combine(sx.components.section.base, sx.spacing.mt(6))}>
      <h4 style={sx.combine(sx.text.lg, sx.text.bold, sx.spacing.mb(3))}>
        💡 Informations complémentaires
      </h4>
      
      {/* Guide de lecture */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info, sx.spacing.mb(3))}>
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            📘 Guide de lecture du diagramme
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li style={sx.text.sm}>
              Le <span style={{ color: '#3b82f6', fontWeight: 600 }}>point bleu (FULLTANK)</span> représente la configuration avec réservoirs pleins
            </li>
            <li style={sx.text.sm}>
              Le <span style={{ color: '#10b981', fontWeight: 600 }}>point vert (T/O CRM)</span> représente la masse et centrage au décollage
            </li>
            <li style={sx.text.sm}>
              Le <span style={{ color: '#f59e0b', fontWeight: 600 }}>point orange (LANDING)</span> représente la position prévue à l'atterrissage
            </li>
            <li style={sx.text.sm}>
              Le <span style={{ color: '#ef4444', fontWeight: 600 }}>point rouge (ZFW)</span> représente la configuration sans carburant
            </li>
          </ul>
        </div>
      </div>
      
      {/* Informations carburant */}
      <div style={sx.combine(sx.components.alert.base, sx.components.alert.info)}>
        <div>
          <p style={sx.combine(sx.text.sm, sx.text.bold, sx.spacing.mb(2))}>
            ⛽ Informations carburant
          </p>
          <div style={sx.text.sm}>
            <p>• Densité {aircraft.fuelType} : {fuelDensity} kg/L</p>
            <p>• Capacité totale : {aircraft.fuelCapacity} L = {(aircraft.fuelCapacity * fuelDensity).toFixed(1)} kg</p>
            <p>• Bras de levier carburant : {wb.fuelArm} m (constant)</p>
            
            {fobFuel?.ltr > 0 && (
              <div style={sx.combine(sx.spacing.mt(2), sx.spacing.p(2), sx.bg.primary, { color: 'white', borderRadius: '4px' })}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  📊 Carburant à l'atterrissage : {remainingFuelL.toFixed(1)} L = {(remainingFuelL * fuelDensity).toFixed(1)} kg
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

WeightBalanceInfo.displayName = 'WeightBalanceInfo';