// src/features/flight-wizard/steps/Step5Fuel.jsx
import React, { memo, useEffect } from 'react';
import FuelModule from '@features/fuel/FuelModule';
import { Fuel } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useFuel } from '@core/contexts';

// Styles communs
const commonStyles = {
  container: {
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  label: {
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px'
  }
};

// Composant principal de l'étape 5 - Utilise directement le FuelModule complet
export const Step5Fuel = memo(({ flightPlan, onUpdate }) => {
  // Le FuelModule gère tout en interne via les contextes et stores
  // Il calcule automatiquement les besoins en fonction de la navigation et des alternates

  // Récupérer le FOB (Fuel On Board) depuis le contexte
  const { fobFuel, calculateTotal, setFobFuel } = useFuel();

  // 🔧 FIX: Restaurer fobFuel depuis flightPlan au montage
  const hasRestored = React.useRef(false);
  useEffect(() => {
    if (hasRestored.current) return;

    const savedFuel = flightPlan?.fuel?.confirmed;
    if (savedFuel && savedFuel > 0) {
      // Restaurer fobFuel depuis flightPlan
      console.log('🔄 [Step5Fuel] Restauration CRM depuis flightPlan:', savedFuel, 'L');
      setFobFuel({
        ltr: savedFuel,
        gal: savedFuel / 3.78541
      });
      hasRestored.current = true;
    }
  }, [flightPlan?.fuel?.confirmed, setFobFuel]);

  // Synchroniser le FOB avec flightPlan.fuel.confirmed pour la validation du wizard
  useEffect(() => {
    const fobValue = fobFuel?.ltr || 0;
    const totalRequired = calculateTotal ? calculateTotal('ltr') : 0;

    console.log('🔧 [Step5Fuel] Synchronisation carburant:', {
      fobValue,
      totalRequired,
      currentConfirmed: flightPlan.fuel.confirmed
    });

    // Synchroniser même si fobValue est 0 pour permettre la mise à jour
    if (fobValue !== flightPlan.fuel.confirmed) {
      flightPlan.confirmFuel(fobValue);
      console.log('✅ [Step5Fuel] Carburant confirmé mis à jour:', fobValue);

      if (onUpdate) {
        onUpdate(); // Notifier le wizard du changement
      }
    }
  }, [fobFuel?.ltr, flightPlan, onUpdate, calculateTotal]);

  return (
    <div style={commonStyles.container}>
      {/* Module de carburant complet - le titre est affiché par le module */}
      <FuelModule />
    </div>
  );
});

// Display name pour le debug
Step5Fuel.displayName = 'Step5Fuel';

export default Step5Fuel;