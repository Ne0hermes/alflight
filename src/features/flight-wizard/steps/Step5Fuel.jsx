import React, { memo, useEffect } from 'react';
import FuelModule from '@features/fuel/FuelModule';
import { Fuel } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useFuel } from '@core/contexts';
import { convertValue } from '@utils/unitConversions';

// Styles communs
const commonStyles = {
  container: {
    padding: '0',
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

// Style pour la carte de réserve réglementaire
const reserveCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  marginBottom: '20px',
  borderRadius: '8px',
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: 'rgba(59, 130, 246, 0.05)',
};

// Composant principal de l'étape 5 - Utilise directement le FuelModule complet
export const Step5Fuel = memo(({ flightPlan, onUpdate }) => {
  // Le FuelModule gère tout en interne via les contextes et stores
  // Il calcule automatiquement les besoins en fonction de la navigation et des alternates

  // Récupérer le FOB (Fuel On Board) depuis le contexte
  const { fobFuel, calculateTotal, setFobFuel } = useFuel();

  // Calculer la réserve réglementaire selon les règles (depuis Step1)
  const calculateRegulatoryReserve = () => {
    let regulationReserveMinutes = 30;

    // Nuit = 45 minutes
    if (flightPlan.generalInfo.dayNight === 'night') {
      regulationReserveMinutes = 45;
    }

    // IFR = +15 minutes
    if (flightPlan.generalInfo.flightType === 'IFR') {
      regulationReserveMinutes += 15;
    }

    // Local + Jour = 20 minutes
    if (flightPlan.generalInfo.flightNature === 'local' && flightPlan.generalInfo.dayNight === 'day') {
      regulationReserveMinutes = 20;
    }

    return regulationReserveMinutes;
  };

  const reserveMinutes = calculateRegulatoryReserve();

  // Description de la réserve
  const getReserveDescription = () => {
    const parts = [];

    if (flightPlan.generalInfo.flightType) {
      parts.push(flightPlan.generalInfo.flightType);
    }

    if (flightPlan.generalInfo.flightNature) {
      parts.push(flightPlan.generalInfo.flightNature === 'local' ? 'LOCAL' : 'NAV');
    }

    if (flightPlan.generalInfo.dayNight) {
      parts.push(flightPlan.generalInfo.dayNight === 'night' ? 'NUIT' : 'JOUR');
    }

    return parts.length > 0 ? parts.join(' - ') : 'Complétez les informations de l\'étape 1';
  };

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
        gal: convertValue(savedFuel, 'ltr', 'gal', 'fuel')
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