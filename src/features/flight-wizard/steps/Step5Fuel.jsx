import React, { memo, useEffect } from 'react';
import FuelModule from '@features/fuel/FuelModule';
import { useFuel } from '@core/contexts';
import { convertValue } from '@utils/unitConversions';

// Styles communs
const commonStyles = {
  container: {
    padding: '0'
  }
};

// Composant principal de l'étape 5 - Utilise directement le FuelModule complet
export const Step5Fuel = memo(({ flightPlan, onUpdate }) => {
  // Le FuelModule gère tout en interne via les contextes et stores
  // Il calcule automatiquement les besoins en fonction de la navigation et des alternates

  // Récupérer le FOB (Fuel On Board) depuis le contexte
  const { fobFuel, calculateTotal, setFobFuel } = useFuel();

  // ⚠️ La réserve réglementaire N'EST PLUS calculée ici. Elle dérive de la source
  // unique « type de vol » (navigationStore.flightType, réglée en Step1) via le
  // calculateur canonique @core/flightType, et s'affiche dans FuelModule
  // (ligne « Final Reserve »). L'ancien calcul local lisait generalInfo et était
  // du code mort (jamais rendu) — supprimé pour éviter une 4e source divergente.

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
      {/* Module carburant en mode wizard : son héro interne est masqué
          (le wizard fournit deja la photo d'etape) -> plus de doublon. */}
      <FuelModule wizardMode={true} />
    </div>
  );
});

// Display name pour le debug
Step5Fuel.displayName = 'Step5Fuel';

export default Step5Fuel;