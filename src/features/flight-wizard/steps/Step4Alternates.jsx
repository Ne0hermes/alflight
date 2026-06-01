```
// src/features/flight-wizard/steps/Step4Alternates.jsx
import React, { memo, useMemo, useEffect } from 'react';
import AlternatesModule from '@features/alternates/AlternatesModule';
import { AlertTriangle, Fuel, Navigation } from 'lucide-react';
import { theme } '../../../styles/theme';
import { useNavigation, useAircraft, useFuel } from '@core/contexts';
import { useUnits } from '@hooks/useUnits';
import { useFuelStore } from '@core/stores/fuelStore';

// Styles communs
const commonStyles = {
  container: {
    padding: '24px',
    backgroundColor: 'var(--bg-surface)',
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
  },
  infoBox: {
    padding: '16px',
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    borderLeft: '4px solid #f26921',
    marginBottom: '20px',
    fontSize: '14px'
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  infoLabel: {
    fontWeight: '600',
    color: '#374151',
    minWidth: '180px'
  },
  infoValue: {
    color: '#f26921',
    fontWeight: '700'
  }
};

// Composant principal de l'étape 4 - Utilise directement le AlternatesModule complet
export const Step4Alternates = memo(({ flightPlan, onUpdate }) => {
  const { waypoints } = useNavigation();
  const { setSelectedAircraft } = useAircraft();
  const { convert, getSymbol } = useUnits();
  const { setFobFuel } = useFuel();
  const setFobFuelStore = useFuelStore(state => state.setFobFuel);

  // 🔧 FIX: Synchroniser l'avion du flightPlan avec le contexte Aircraft global
  // Nécessaire pour que AlternatesModule (via useAlternateSelection) puisse accéder à l'avion
  useEffect(() => {
    if (flightPlan?.aircraft?.registration) {
      // Si l'avion du flightPlan a déjà un ID, il vient du store - utiliser directement
      if (flightPlan.aircraft.id) {
        setSelectedAircraft(flightPlan.aircraft);
        console.log('✅ [Step4] Avion synchronisé depuis flightPlan:', flightPlan.aircraft.registration);
        return;
      }

      // Sinon, essayer de le trouver dans le store (pour récupérer les données complètes)
      import('@core/stores/aircraftStore').then(({ useAircraftStore }) => {
        const store = useAircraftStore.getState();

        // Vérifier si le store est initialisé
        if (!store.isInitialized) {
          console.log('⏳ [Step4] Store non initialisé, utilisation de l\'avion du flightPlan');
          setSelectedAircraft(flightPlan.aircraft);
          return;
        }

        const fullAircraft = store.aircraftList.find(
          ac => ac.registration === flightPlan.aircraft.registration
        );

        if (fullAircraft) {
          setSelectedAircraft(fullAircraft);
          console.log('✅ [Step4] Avion trouvé dans le store:', fullAircraft.registration);
        } else {
          // Avion custom ou non encore dans le store - utiliser celui du flightPlan
          console.log('⚠️ [Step4] Avion non trouvé dans le store, utilisation du flightPlan:', flightPlan.aircraft.registration);
          setSelectedAircraft(flightPlan.aircraft);
        }
      });
    }
  }, [flightPlan?.aircraft?.registration, setSelectedAircraft]);

  // 🔧 FIX: Synchroniser le carburant confirmé (FOB) avec le store
  // Nécessaire pour que AlternatesModule puisse calculer le rayon correctement
  useEffect(() => {
    const confirmedFuel = flightPlan?.fuel?.confirmed;
    if (confirmedFuel && confirmedFuel > 0) {
      console.log('⛽ [Step4] Synchronisation FOB depuis flightPlan:', confirmedFuel, 'L');
      
      // Mettre à jour via le contexte ET le store directement pour être sûr
      const fuelData = {
        ltr: confirmedFuel,
        gal: convert(confirmedFuel, 'fuel', 'ltr', { toUnit: 'gal' })
      };
      
      setFobFuel(fuelData);
      setFobFuelStore(fuelData);
    }
  }, [flightPlan?.fuel?.confirmed, setFobFuel, setFobFuelStore, convert]);

  // Calculer le rayon de sélection basé sur le carburant restant à l'arrivée
  const searchRadius = useMemo(() => {
    // Carburant total confirmé (L) - valeur de stockage
    const totalFuel = flightPlan.fuel.confirmed || 0;

    // Carburant consommé pendant le vol (L) - valeur de stockage
    const fuelUsed = (flightPlan.fuel.taxi || 0) +
                     (flightPlan.fuel.climb || 0) +
                     (flightPlan.fuel.cruise || 0);

    // Carburant restant à l'arrivée (L) - valeur de stockage
    const remainingFuel = totalFuel - fuelUsed;

    // 🔧 FIX: Les données avion sont DÉJÀ converties vers les préférences utilisateur
    // par aircraftStore.loadFromSupabase() - PAS de double conversion !
    // NOTE: Pour les CALCULS on garde la valeur originale (déjà en unité utilisateur)
    const fuelConsumption = flightPlan.aircraft.fuelConsumption || 40;
    const fuelRemainingDisplay = convert(remainingFuel, 'fuel', 'ltr');

    // Vitesse de croisière (kt)
    const cruiseSpeed = flightPlan.aircraft.cruiseSpeed || 120;

    // Autonomie restante (heures)
    // NOTE: remainingFuel est en litres, fuelConsumption peut être en gal/h ou l/h
    // Pour un calcul correct, il faudrait convertir les deux dans la même unité
    const remainingEndurance = remainingFuel / fuelConsumption;

    // Rayon en NM (distance franchissable avec carburant restant)
    const radiusNM = remainingEndurance * cruiseSpeed;

    // Rayon en km
    const radiusKM = radiusNM * 1.852;

    return {
      fuelRemaining: remainingFuel,           // Stockage (L)
      fuelRemainingDisplay: fuelRemainingDisplay,  // Affichage converti
      endurance: remainingEndurance,
      radiusNM: radiusNM,
      radiusKM: radiusKM,
      cruiseSpeed: cruiseSpeed,
      fuelConsumption: fuelConsumption,            // Valeur (unité utilisateur)
      fuelConsumptionDisplay: fuelConsumption      // Affichage (même valeur car déjà convertie)
    };
  }, [flightPlan.fuel, flightPlan.aircraft, convert]);

  // Trouver l'aérodrome d'arrivée
  const arrivalAirport = useMemo(() => {
    return waypoints.find(wp => wp.type === 'arrival');
  }, [waypoints]);

  return (
    <div style={commonStyles.container}>
      {/* Module de déroutement complet */}
      <AlternatesModule
        customRadius={searchRadius.radiusKM}
        showRadiusCircle={true}
      />
    </div>
  );
});

// Display name pour le debug
Step4Alternates.displayName = 'Step4Alternates';

export default Step4Alternates;
```