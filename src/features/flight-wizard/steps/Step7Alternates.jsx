// src/features/flight-wizard/steps/Step7Alternates.jsx
// Étape 7 : Sélection des aérodromes de déroutement (après bilan carburant)
// Utilise la zone CÔNE basée sur FOB et le filtrage LDA × 1.43

import React, { memo, useMemo, useEffect, useState } from 'react';
import AlternatesModule from '@features/alternates/AlternatesModule';
import { AlertTriangle, Fuel, Navigation, Info, MapPin, Plane, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useNavigation, useAircraft, useFuel } from '@core/contexts';
import { useUnits } from '@hooks/useUnits';
import { useAlternateSelection } from '@features/alternates/hooks/useAlternateSelection';
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
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    borderLeft: '4px solid #f26921',
    marginBottom: '20px',
    fontSize: '14px'
  },
  infoBoxWarning: {
    padding: '16px',
    backgroundColor: 'rgba(242, 105, 33, 0.10)',
    borderRadius: '8px',
    borderLeft: '4px solid var(--accent-primary)',
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
    color: 'var(--text-secondary)',
    minWidth: '180px'
  },
  infoValue: {
    color: '#f26921',
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
    backgroundColor: 'var(--bg-overlay)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)'
  },
  coneInfoTitle: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  coneInfoValueLarge: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  coneInfoValueSmall: {
    fontSize: '14px',
    color: 'var(--text-tertiary)'
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
  const { fobFuel, setFobFuel } = useFuel();
  const { convert, getSymbol, format } = useUnits();

  // Synchroniser les données de carburant avec le store global
  const setFobFuelStore = useFuelStore(state => state.setFobFuel);

  useEffect(() => {
    const confirmedLtr = flightPlan?.fuel?.confirmed;
    if (confirmedLtr && confirmedLtr > 0) {
      console.log('⛽ [Step7Alternates] Syncing fuel from flightPlan:', confirmedLtr);
      const fuelObject = {
        ltr: confirmedLtr,
        gal: parseFloat((confirmedLtr / 3.78541).toFixed(2))
      };
      // Sync local context
      setFobFuel(fuelObject);
      // Sync global store
      setFobFuelStore(fuelObject);
    }
  }, [flightPlan?.fuel?.confirmed, setFobFuel, setFobFuelStore]);

  // Effet pour logger le carburant disponible
  useEffect(() => {
    console.log('⛽ [Step7Alternates] Fuel state:', {
      fobFuel,
      hasFuelData: fobFuel && (fobFuel.ltr > 0 || fobFuel.gal > 0),
      flightPlanFuel: flightPlan?.fuel
    });
  }, [fobFuel, flightPlan]);

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

  // État des filtres manuels
  const [filters, setFilters] = useState({
    hideShortRunways: true,        // Cacher les pistes trop courtes
    hideIncompatibleSurface: true, // Cacher les revêtements incompatibles
    hideIncompatibleType: true,    // Cacher les types incompatibles (ULM, héliport)
    showFilters: false             // Afficher/masquer le panneau de filtres
  });

  // Récupérer les surfaces compatibles de l'avion
  const aircraftCompatibleSurfaces = useMemo(() => {
    // Par défaut, tous les avions peuvent se poser sur dur
    const defaultSurfaces = ['hard', 'asphalt', 'concrete', 'bituminous', 'tarmac'];

    // Si l'avion a des surfaces configurées
    if (selectedAircraft?.compatibleSurfaces) {
      return selectedAircraft.compatibleSurfaces;
    }

    // Si c'est un avion léger, ajouter herbe
    if (selectedAircraft?.category === 'SEP' || selectedAircraft?.category === 'ULM') {
      return [...defaultSurfaces, 'grass', 'gravel', 'turf', 'soil'];
    }

    return defaultSurfaces;
  }, [selectedAircraft]);

  // Récupérer le type d'avion pour le filtrage
  const aircraftType = useMemo(() => {
    // Catégories : 'airplane', 'ulm', 'helicopter', 'glider'
    const category = selectedAircraft?.category?.toUpperCase();

    if (category === 'ULM' || category === 'MICROLIGHT') {
      return 'ulm';
    }
    if (category === 'HELICOPTER' || category === 'HELI') {
      return 'helicopter';
    }
    if (category === 'GLIDER' || category === 'SAILPLANE') {
      return 'glider';
    }
    return 'airplane';
  }, [selectedAircraft]);

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
  // 🔧 FIX: Vérifier à la fois fobFuel (contexte) ET fobFuel.gal pour les utilisateurs en gallons
  const hasFuelData = useMemo(() => {
    // Vérifier si le FOB est défini (en litres OU en gallons)
    const hasLiters = fobFuel && fobFuel.ltr > 0;
    const hasGallons = fobFuel && fobFuel.gal > 0;
    return hasLiters || hasGallons;
  }, [fobFuel]);

  // 🔧 Calculer la piste minimale basée sur les distances d'atterrissage de l'étape Performance
  const performanceBasedLDA = useMemo(() => {
    // Récupérer les distances d'atterrissage calculées à l'étape Performance
    const departureLanding = flightPlan?.performance?.departure?.takeoff?.lda50ft ||
      flightPlan?.performance?.departure?.takeoff?.groundRoll ||
      flightPlan?.performance?.departure?.landing?.lda50ft ||
      flightPlan?.performance?.departure?.landing?.groundRoll;

    const arrivalLanding = flightPlan?.performance?.arrival?.landing?.lda50ft ||
      flightPlan?.performance?.arrival?.landing?.groundRoll;

    console.log('🛬 [Step7] Distances atterrissage depuis Performance:', {
      departureLanding,
      arrivalLanding,
      departurePerf: flightPlan?.performance?.departure,
      arrivalPerf: flightPlan?.performance?.arrival
    });

    // CAS 1: Les deux distances disponibles → moyenne × 1.43
    if (departureLanding && arrivalLanding) {
      const average = (departureLanding + arrivalLanding) / 2;
      const minRequired = Math.ceil(average * 1.43);

      return {
        departureLandingDistance: Math.round(departureLanding),
        arrivalLandingDistance: Math.round(arrivalLanding),
        averageLDA: average,
        minRunwayRequired: minRequired,
        source: 'performance_both'
      };
    }

    // CAS 2: Seulement distance départ disponible → utiliser comme minimum × 1.43
    if (departureLanding && !arrivalLanding) {
      const minRequired = Math.ceil(departureLanding * 1.43);

      return {
        departureLandingDistance: Math.round(departureLanding),
        arrivalLandingDistance: null,
        minRunwayRequired: minRequired,
        source: 'performance_departure_only'
      };
    }

    // CAS 3: Seulement distance arrivée disponible → utiliser comme minimum × 1.43
    if (!departureLanding && arrivalLanding) {
      const minRequired = Math.ceil(arrivalLanding * 1.43);

      return {
        departureLandingDistance: null,
        arrivalLandingDistance: Math.round(arrivalLanding),
        minRunwayRequired: minRequired,
        source: 'performance_arrival_only'
      };
    }

    // CAS 4: Aucune distance Performance disponible → avertissement
    return {
      departureLandingDistance: null,
      arrivalLandingDistance: null,
      minRunwayRequired: null,
      source: 'no_performance_data'
    };
  }, [flightPlan?.performance]);

  return (
    <div style={commonStyles.container}>
      {/* Alerte si pas de bilan carburant */}
      {!hasFuelData && (
        <div style={commonStyles.infoBoxWarning}>
          <div style={commonStyles.infoRow}>
            <AlertTriangle size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: '600' }}>Bilan carburant non disponible</span>
          </div>
          <p style={{ margin: '8px 0 0 26px', color: 'var(--accent-primary)' }}>
            Le FOB (Fuel On Board) n'est pas défini. La zone de recherche utilise les paramètres par défaut.
            Pour une sélection optimale, complétez d'abord l'étape "Bilan carburant".
          </p>
        </div>
      )}

      {/* Informations sur la zone cône (si disponible) */}
      {searchRadius.isCone && (
        <div style={commonStyles.infoBox}>
          <div style={commonStyles.infoRow}>
            <Info size={18} color="#f26921" />
            <span style={{ fontWeight: '600' }}>Zone de recherche en forme de cône</span>
          </div>
          <p style={{ margin: '8px 0 12px 26px', color: 'var(--text-secondary)', fontSize: '13px' }}>
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
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                = {convert(searchRadius.fobLiters || 0, 'fuel', 'ltr').toFixed(0)} {getSymbol('fuel')} / {(selectedAircraft?.fuelConsumption || 40).toFixed(0)} {getSymbol('fuelConsumption')} × {selectedAircraft?.cruiseSpeedKt || selectedAircraft?.cruiseSpeed || 120} kt × 0.5
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
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                = ({convert(searchRadius.fobLiters || 0, 'fuel', 'ltr').toFixed(0)} - {convert(searchRadius.tripFuel || 0, 'fuel', 'ltr').toFixed(0)}) {getSymbol('fuel')} / {(selectedAircraft?.fuelConsumption || 40).toFixed(0)} {getSymbol('fuelConsumption')} × {selectedAircraft?.cruiseSpeedKt || selectedAircraft?.cruiseSpeed || 120} kt × 0.5
              </div>
            </div>

            <div style={commonStyles.coneInfoCard}>
              <div style={commonStyles.coneInfoTitle}>FOB au décollage</div>
              <div style={commonStyles.coneInfoValueLarge}>
                {convert(searchRadius.fobLiters || 0, 'fuel', 'ltr').toFixed(0)} {getSymbol('fuel')}
              </div>
              <div style={commonStyles.coneInfoValueSmall}>
                Trip fuel: {convert(searchRadius.tripFuel || 0, 'fuel', 'ltr').toFixed(0)} {getSymbol('fuel')}
              </div>
            </div>

            {performanceBasedLDA && performanceBasedLDA.source === 'performance_both' && (
              <div style={commonStyles.coneInfoCard}>
                <div style={commonStyles.coneInfoTitle}>Piste minimale × 1.43</div>
                <div style={commonStyles.coneInfoValueLarge}>
                  {performanceBasedLDA.minRunwayRequired} m
                </div>
                <div style={commonStyles.coneInfoValueSmall}>
                  Dép: {performanceBasedLDA.departureLandingDistance} m | Arr: {performanceBasedLDA.arrivalLandingDistance} m
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  = ({performanceBasedLDA.departureLandingDistance} + {performanceBasedLDA.arrivalLandingDistance}) / 2 × 1.43
                </div>
              </div>
            )}

            {performanceBasedLDA && performanceBasedLDA.source === 'performance_departure_only' && (
              <div style={{ ...commonStyles.coneInfoCard, backgroundColor: 'var(--bg-overlay)' }}>
                <div style={commonStyles.coneInfoTitle}>Piste minimale × 1.43</div>
                <div style={commonStyles.coneInfoValueLarge}>
                  {performanceBasedLDA.minRunwayRequired} m
                </div>
                <div style={commonStyles.coneInfoValueSmall}>
                  Départ: {performanceBasedLDA.departureLandingDistance} m
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  = {performanceBasedLDA.departureLandingDistance} × 1.43 (arrivée N/A)
                </div>
              </div>
            )}

            {performanceBasedLDA && performanceBasedLDA.source === 'performance_arrival_only' && (
              <div style={{ ...commonStyles.coneInfoCard, backgroundColor: 'var(--bg-overlay)' }}>
                <div style={commonStyles.coneInfoTitle}>Piste minimale × 1.43</div>
                <div style={commonStyles.coneInfoValueLarge}>
                  {performanceBasedLDA.minRunwayRequired} m
                </div>
                <div style={commonStyles.coneInfoValueSmall}>
                  Arrivée: {performanceBasedLDA.arrivalLandingDistance} m
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  = {performanceBasedLDA.arrivalLandingDistance} × 1.43 (départ N/A)
                </div>
              </div>
            )}

            {performanceBasedLDA && performanceBasedLDA.source === 'no_performance_data' && (
              <div style={{ ...commonStyles.coneInfoCard, backgroundColor: 'rgba(242, 105, 33, 0.10)', borderColor: 'var(--accent-primary)' }}>
                <div style={commonStyles.coneInfoTitle}>Piste minimale</div>
                <div style={{ ...commonStyles.coneInfoValueLarge, color: 'var(--accent-primary)' }}>
                  N/A
                </div>
                <div style={{ ...commonStyles.coneInfoValueSmall, color: 'var(--accent-primary)' }}>
                  Données Performance non disponibles
                </div>
              </div>
            )}
          </div>

          {/* Avertissement si pas de données performance */}
          {performanceBasedLDA && performanceBasedLDA.source === 'no_performance_data' && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(242, 105, 33, 0.10)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--accent-primary)',
              marginTop: '12px'
            }}>
              <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              <strong>Filtrage piste minimale désactivé:</strong> Les distances d'atterrissage n'ont pas été calculées à l'étape Performance.
              Complétez les calculs Performance pour activer le filtrage automatique des pistes.
            </div>
          )}
        </div>
      )}

      {/* Filtres manuels */}
      <div style={{
        backgroundColor: 'var(--bg-overlay)',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '20px',
        overflow: 'hidden'
      }}>
        {/* En-tête cliquable */}
        <button
          onClick={() => setFilters(prev => ({ ...prev, showFilters: !prev.showFilters }))}
          style={{
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-secondary)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="var(--accent-primary)" />
            Filtres de recherche
            {(filters.hideShortRunways || filters.hideIncompatibleSurface || filters.hideIncompatibleType) && (
              <span style={{
                padding: '2px 8px',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                borderRadius: '10px',
                fontSize: '11px'
              }}>
                {[filters.hideShortRunways, filters.hideIncompatibleSurface, filters.hideIncompatibleType].filter(Boolean).length} actif(s)
              </span>
            )}
          </span>
          {filters.showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {/* Contenu des filtres */}
        {filters.showFilters && (
          <div style={{ padding: '0 16px 16px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Filtre piste minimale */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: filters.hideShortRunways ? 'var(--bg-overlay)' : 'var(--bg-surface)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={filters.hideShortRunways}
                  onChange={e => setFilters(prev => ({ ...prev, hideShortRunways: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--text-primary)' }}>
                    Masquer les pistes trop courtes
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Piste minimale requise: {performanceBasedLDA?.minRunwayRequired ? `${performanceBasedLDA.minRunwayRequired} m` : 'N/A (données Performance requises)'}
                  </div>
                </div>
              </label>

              {/* Filtre revêtement */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: filters.hideIncompatibleSurface ? 'var(--bg-overlay)' : 'var(--bg-surface)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={filters.hideIncompatibleSurface}
                  onChange={e => setFilters(prev => ({ ...prev, hideIncompatibleSurface: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--text-primary)' }}>
                    Masquer les revêtements incompatibles
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Surfaces compatibles: {aircraftCompatibleSurfaces.slice(0, 3).join(', ')}{aircraftCompatibleSurfaces.length > 3 ? '...' : ''}
                  </div>
                </div>
              </label>

              {/* Filtre type d'aérodrome */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                backgroundColor: filters.hideIncompatibleType ? 'var(--bg-overlay)' : 'var(--bg-surface)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={filters.hideIncompatibleType}
                  onChange={e => setFilters(prev => ({ ...prev, hideIncompatibleType: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--text-primary)' }}>
                    Masquer les types d'aérodromes incompatibles
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Type avion: {aircraftType === 'airplane' ? 'Avion (exclure héliports, ULM...)' : aircraftType}
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Module de déroutement complet */}
      <AlternatesModule
        customRadius={coneZone ? null : searchRadius.radiusAtDep * 1.852} // Convertir NM en km si pas de cône
        showRadiusCircle={true}
        useConeZone={!!coneZone} // Nouveau prop pour utiliser la zone cône
        filters={{
          minRunwayLength: filters.hideShortRunways ? performanceBasedLDA?.minRunwayRequired : null,
          compatibleSurfaces: filters.hideIncompatibleSurface ? aircraftCompatibleSurfaces : null,
          aircraftType: filters.hideIncompatibleType ? aircraftType : null
        }}
      />
    </div>
  );
});

// Display name pour le debug
Step7Alternates.displayName = 'Step7Alternates';

export default Step7Alternates;
