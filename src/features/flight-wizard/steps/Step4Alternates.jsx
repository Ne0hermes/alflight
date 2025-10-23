// src/features/flight-wizard/steps/Step4Alternates.jsx
import React, { memo, useMemo } from 'react';
import AlternatesModule from '@features/alternates/AlternatesModule';
import { AlertTriangle, Fuel, Navigation } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useNavigation } from '@core/contexts';

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
  },
  infoBox: {
    padding: '16px',
    backgroundColor: '#f0f9ff',
    borderRadius: '8px',
    borderLeft: '4px solid #93163c',
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
    color: '#93163c',
    fontWeight: '700'
  }
};

// Composant principal de l'étape 4 - Utilise directement le AlternatesModule complet
export const Step4Alternates = memo(({ flightPlan, onUpdate }) => {
  const { waypoints } = useNavigation();

  // Calculer le rayon de sélection basé sur le carburant restant à l'arrivée
  const searchRadius = useMemo(() => {
    // Carburant total confirmé (L)
    const totalFuel = flightPlan.fuel.confirmed || 0;

    // Carburant consommé pendant le vol (L)
    const fuelUsed = (flightPlan.fuel.taxi || 0) +
                     (flightPlan.fuel.climb || 0) +
                     (flightPlan.fuel.cruise || 0);

    // Carburant restant à l'arrivée (L)
    const remainingFuel = totalFuel - fuelUsed;

    // Consommation de l'avion (L/h)
    const fuelConsumption = flightPlan.aircraft.fuelConsumption || 40;

    // Vitesse de croisière (kt)
    const cruiseSpeed = flightPlan.aircraft.cruiseSpeed || 120;

    // Autonomie restante (heures)
    const remainingEndurance = remainingFuel / fuelConsumption;

    // Rayon en NM (distance franchissable avec carburant restant)
    const radiusNM = remainingEndurance * cruiseSpeed;

    // Rayon en km
    const radiusKM = radiusNM * 1.852;

    return {
      fuelRemaining: remainingFuel,
      endurance: remainingEndurance,
      radiusNM: radiusNM,
      radiusKM: radiusKM,
      cruiseSpeed: cruiseSpeed,
      fuelConsumption: fuelConsumption
    };
  }, [flightPlan.fuel, flightPlan.aircraft]);

  // Trouver l'aérodrome d'arrivée
  const arrivalAirport = useMemo(() => {
    return waypoints.find(wp => wp.type === 'arrival');
  }, [waypoints]);

  return (
    <div style={commonStyles.container}>
      {/* Titre de l'étape */}
      <div style={commonStyles.label}>
        <AlertTriangle size={20} />
        Sélection des aérodromes de déroutement
      </div>

      {/* Informations sur la zone de recherche */}
      {arrivalAirport && searchRadius.radiusNM > 0 && (
        <div style={commonStyles.infoBox}>
          <div style={commonStyles.infoRow}>
            <Fuel size={18} color="#93163c" />
            <span style={commonStyles.infoLabel}>Carburant restant à l'arrivée :</span>
            <span style={commonStyles.infoValue}>
              {searchRadius.fuelRemaining.toFixed(1)} L
            </span>
          </div>
          <div style={commonStyles.infoRow}>
            <Navigation size={18} color="#93163c" />
            <span style={commonStyles.infoLabel}>Autonomie restante :</span>
            <span style={commonStyles.infoValue}>
              {(searchRadius.endurance * 60).toFixed(0)} minutes
              ({searchRadius.endurance.toFixed(1)}h)
            </span>
          </div>
          <div style={commonStyles.infoRow}>
            <AlertTriangle size={18} color="#93163c" />
            <span style={commonStyles.infoLabel}>Rayon de recherche :</span>
            <span style={commonStyles.infoValue}>
              {searchRadius.radiusNM.toFixed(0)} NM ({searchRadius.radiusKM.toFixed(0)} km)
            </span>
          </div>
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #93163c33',
            fontSize: '13px',
            color: '#6b7280',
            fontStyle: 'italic'
          }}>
            💡 Les aérodromes de déroutement seront recherchés dans un rayon de{' '}
            <strong>{searchRadius.radiusNM.toFixed(0)} NM</strong> autour de l'aérodrome d'arrivée{' '}
            <strong>{arrivalAirport.icao || arrivalAirport.name}</strong>,
            correspondant à votre autonomie disponible.
          </div>
        </div>
      )}

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