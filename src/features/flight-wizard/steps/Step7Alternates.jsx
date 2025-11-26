// src/features/flight-wizard/steps/Step7Alternates.jsx
// Étape 7 : Sélection des aérodromes de déroutement (après bilan carburant)
// Utilise la zone CÔNE basée sur FOB et le filtrage LDA × 1.43

import React, { memo, useMemo, useEffect, useState } from 'react';
import AlternatesModule from '@features/alternates/AlternatesModule';
import { AlertTriangle, Fuel, Navigation, Info, MapPin, Plane } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useNavigation, useAircraft, useFuel } from '@core/contexts';
import { useUnits } from '@hooks/useUnits';
import { useAlternateSelection } from '@features/alternates/hooks/useAlternateSelection';

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
  infoBoxWarning: {
    padding: '16px',
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    borderLeft: '4px solid #f59e0b',
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
  },
  coneInfoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px'
  },
  coneInfoCard: {
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  coneInfoTitle: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  coneInfoValueLarge: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1e293b'
  },
  coneInfoValueSmall: {
    fontSize: '14px',
    color: '#64748b'
  }
};

/**
 * Étape 7 : Sélection des aérodromes de déroutement
 *
 * Cette étape utilise:
 * - FOB (Fuel On Board) : carburant confirmé au décollage
 * - Zone CÔNE : rayon variable (plus large au départ, plus étroit à l'arrivée)
 * - Filtrage LDA × 1.43 : longueur de piste minimale requise
 */
export const Step7Alternates = memo(({ flightPlan, onUpdate }) => {
  const { waypoints } = useNavigation();
  const { selectedAircraft, setSelectedAircraft } = useAircraft();
  const { fobFuel } = useFuel();
  const { convert, getSymbol, format } = useUnits();

  // Utiliser le hook de sélection avec les nouvelles fonctionnalités
  const {
    searchZone,
    coneZone,
    coneZoneParams,
    ldaFilterParams,
    dynamicParams,
    isReady,
    isLoadingAircraft,
    isLoadingAirports
  } = useAlternateSelection();

  // Synchroniser l'avion du flightPlan avec le contexte Aircraft global
  useEffect(() => {
    if (flightPlan?.aircraft?.registration) {
      if (flightPlan.aircraft.id) {
        setSelectedAircraft(flightPlan.aircraft);
        console.log('✅ [Step7] Avion synchronisé depuis flightPlan:', flightPlan.aircraft.registration);
        return;
      }

      import('@core/stores/aircraftStore').then(({ useAircraftStore }) => {
        const store = useAircraftStore.getState();
        if (!store.isInitialized) {
          setSelectedAircraft(flightPlan.aircraft);
          return;
        }

        const fullAircraft = store.aircraftList.find(
          ac => ac.registration === flightPlan.aircraft.registration
        );

        if (fullAircraft) {
          setSelectedAircraft(fullAircraft);
        } else {
          setSelectedAircraft(flightPlan.aircraft);
        }
      });
    }
  }, [flightPlan?.aircraft?.registration, setSelectedAircraft]);

  // Calculer le rayon de recherche pour affichage
  const searchRadius = useMemo(() => {
    if (!coneZoneParams) {
      // Fallback vers l'ancien calcul si pas de données cône
      const totalFuel = flightPlan.fuel?.confirmed || 0;
      const fuelUsed = (flightPlan.fuel?.taxi || 0) +
                       (flightPlan.fuel?.climb || 0) +
                       (flightPlan.fuel?.cruise || 0);
      const remainingFuel = totalFuel - fuelUsed;
      const fuelConsumption = flightPlan.aircraft?.fuelConsumption || 40;
      const cruiseSpeed = flightPlan.aircraft?.cruiseSpeed || 120;
      const remainingEndurance = remainingFuel / fuelConsumption;
      const radiusNM = remainingEndurance * cruiseSpeed;

      return {
        radiusAtDep: radiusNM,
        radiusAtArr: radiusNM * 0.7, // Estimation
        fuelRemaining: remainingFuel,
        endurance: remainingEndurance,
        isCone: false
      };
    }

    return {
      radiusAtDep: coneZoneParams.radiusAtDep,
      radiusAtArr: coneZoneParams.radiusAtArr,
      fobLiters: coneZoneParams.fobLiters,
      tripFuel: coneZoneParams.tripFuel,
      enduranceAtDep: coneZoneParams.enduranceAtDep,
      enduranceAtArr: coneZoneParams.enduranceAtArr,
      isCone: true
    };
  }, [flightPlan.fuel, flightPlan.aircraft, coneZoneParams]);

  // Trouver l'aérodrome d'arrivée
  const arrivalAirport = useMemo(() => {
    return waypoints.find(wp => wp.type === 'arrival');
  }, [waypoints]);

  // Vérifier si le bilan carburant est disponible
  const hasFuelData = useMemo(() => {
    return fobFuel && fobFuel.ltr > 0;
  }, [fobFuel]);

  return (
    <div style={commonStyles.container}>
      {/* En-tête avec informations sur le mode de sélection */}
      <div style={commonStyles.label}>
        <MapPin size={20} color={theme.colors.primary} />
        <span>Sélection des aérodromes de déroutement</span>
      </div>

      {/* Alerte si pas de bilan carburant */}
      {!hasFuelData && (
        <div style={commonStyles.infoBoxWarning}>
          <div style={commonStyles.infoRow}>
            <AlertTriangle size={18} color="#f59e0b" />
            <span style={{ fontWeight: '600' }}>Bilan carburant non disponible</span>
          </div>
          <p style={{ margin: '8px 0 0 26px', color: '#92400e' }}>
            Le FOB (Fuel On Board) n'est pas défini. La zone de recherche utilise les paramètres par défaut.
            Pour une sélection optimale, complétez d'abord l'étape "Bilan carburant".
          </p>
        </div>
      )}

      {/* Informations sur la zone cône (si disponible) */}
      {searchRadius.isCone && (
        <div style={commonStyles.infoBox}>
          <div style={commonStyles.infoRow}>
            <Info size={18} color="#93163c" />
            <span style={{ fontWeight: '600' }}>Zone de recherche en forme de cône</span>
          </div>
          <p style={{ margin: '8px 0 12px 26px', color: '#374151', fontSize: '13px' }}>
            La zone de déroutement est calculée en fonction du carburant restant théorique le long de la route.
            Elle est plus large au départ (plus de carburant) et plus étroite à l'arrivée.
          </p>

          {/* Grille d'informations sur le cône */}
          <div style={commonStyles.coneInfoGrid}>
            <div style={commonStyles.coneInfoCard}>
              <div style={commonStyles.coneInfoTitle}>Rayon au départ (R1)</div>
              <div style={commonStyles.coneInfoValueLarge}>
                {searchRadius.radiusAtDep?.toFixed(0)} NM
              </div>
              <div style={commonStyles.coneInfoValueSmall}>
                Autonomie: {searchRadius.enduranceAtDep?.toFixed(1)}h
              </div>
            </div>

            <div style={commonStyles.coneInfoCard}>
              <div style={commonStyles.coneInfoTitle}>Rayon à l'arrivée (R2)</div>
              <div style={commonStyles.coneInfoValueLarge}>
                {searchRadius.radiusAtArr?.toFixed(0)} NM
              </div>
              <div style={commonStyles.coneInfoValueSmall}>
                Autonomie: {searchRadius.enduranceAtArr?.toFixed(1)}h
              </div>
            </div>

            <div style={commonStyles.coneInfoCard}>
              <div style={commonStyles.coneInfoTitle}>FOB au décollage</div>
              <div style={commonStyles.coneInfoValueLarge}>
                {searchRadius.fobLiters?.toFixed(0)} L
              </div>
              <div style={commonStyles.coneInfoValueSmall}>
                Trip fuel: {searchRadius.tripFuel?.toFixed(0)} L
              </div>
            </div>

            {ldaFilterParams && (
              <div style={commonStyles.coneInfoCard}>
                <div style={commonStyles.coneInfoTitle}>Piste minimale (LDA × 1.43)</div>
                <div style={commonStyles.coneInfoValueLarge}>
                  {ldaFilterParams.minRunwayRequired} m
                </div>
                <div style={commonStyles.coneInfoValueSmall}>
                  {ldaFilterParams.averageLDA ?
                    `Moyenne LDA: ${ldaFilterParams.averageLDA.toFixed(0)} m` :
                    `Perf. avion: ${ldaFilterParams.landingDistanceRequired} m`
                  }
                </div>
              </div>
            )}
          </div>

          {/* Note sur la méthode de calcul */}
          <div style={{
            padding: '10px 12px',
            backgroundColor: '#e0f2fe',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#0369a1',
            marginTop: '12px'
          }}>
            <strong>Note:</strong> La distance de piste minimale est calculée comme la moyenne des LDA
            (Landing Distance Available) de l'aérodrome de départ et d'arrivée, multipliée par 1.43
            (marge réglementaire VFR). Les aérodromes avec des pistes plus courtes sont filtrés.
            <br />
            <em style={{ display: 'block', marginTop: '4px', opacity: 0.8 }}>
              TBD: Calcul exact des performances théoriques en cours d'implémentation.
            </em>
          </div>
        </div>
      )}

      {/* Module de déroutement complet */}
      <AlternatesModule
        customRadius={coneZone ? null : searchRadius.radiusAtDep * 1.852} // Convertir NM en km si pas de cône
        showRadiusCircle={true}
        useConeZone={!!coneZone} // Nouveau prop pour utiliser la zone cône
      />
    </div>
  );
});

// Display name pour le debug
Step7Alternates.displayName = 'Step7Alternates';

export default Step7Alternates;
