// src/features/flight-wizard/steps/Step3Route.jsx
import React, { memo, useState, useEffect, useMemo } from 'react';
import NavigationModule from '@features/navigation/NavigationModule';
// SUPPRIMÉ: AlternatesModule - déplacé à l'étape 7 (après bilan carburant)
import { theme } from '../../../styles/theme';
import RouteMapView from '../components/RouteMapView';
import { useNavigation, useAircraft } from '@core/contexts';
import { vfrPointsExtractor } from '@services/vfrPointsExtractor';
import { getCruiseSpeedKt } from '@utils/aircraftPerf';
import { useNavigationResults } from '@features/navigation/hooks/useNavigationResults';
import DangerousZonesDetector from '@features/navigation/components/DangerousZonesDetector';
import FuelStopAdvisor from '@features/navigation/components/FuelStopAdvisor';
// SUPPRIMÉ: useUnits - plus nécessaire

// Styles communs
const commonStyles = {
  container: {
    padding: 0
  },
  label: {
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px'
  },
  section: {
    marginBottom: '24px'
  },
  mapSection: {
    marginBottom: '32px'
  },
  mapLabel: {
    fontSize: 'var(--fs-body)',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px'
  },
  infoText: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)',
    marginBottom: '12px',
    fontStyle: 'italic'
  },
  alternatesSection: {
    marginTop: '48px',
    paddingTop: '32px',
    borderTop: '2px solid var(--border-subtle)',
  },
  alternatesHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  alternatesTitle: {
    fontSize: 'var(--fs-title)',
    fontWeight: '700',
    color: theme.colors.textPrimary,
    margin: 0,
  }
};

// Composant principal de l'étape 3
export const Step3Route = memo(({ flightPlan, onUpdate }) => {
  console.log('📍📍📍 Step3Route MONTÉ');

  // Récupérer les waypoints et altitudes depuis le contexte Navigation
  const { waypoints, segmentAltitudes } = useNavigation();

  // Récupérer l'avion sélectionné
  const { selectedAircraft, setSelectedAircraft } = useAircraft();
  // SUPPRIMÉ: useUnits() - plus nécessaire (calcul searchRadius retiré)

  // 🔧 FIX F : distance totale du trajet (NM) via le hook canonique, affichée DÈS la
  // définition du trajet (avant elle n'était visible qu'en synthèse, étape 7).
  const flightType = flightPlan.generalInfo?.flightType || 'VFR';
  const navigationResults = useNavigationResults(waypoints, flightType, selectedAircraft);

  // Points VFR chargés depuis AIXM
  const [vfrPoints, setVfrPoints] = useState([]);
  const [loadingVFR, setLoadingVFR] = useState(false);

  // Altitude planifiée par défaut (même valeur que NavigationModule)
  const [plannedAltitude] = useState(3000);

  // 📐 Calcul du TOD (Top of Descent) pour affichage sur la carte
  const todCalculation = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return null;

    const lastWaypoint = waypoints[waypoints.length - 1];
    const secondLastWaypoint = waypoints[waypoints.length - 2];

    // Élévation du terrain de destination
    const terrainElevation = lastWaypoint.elevation || 0;

    // Altitude de croisière (depuis le dernier segment ou plannedAltitude)
    const fromId = secondLastWaypoint.id || secondLastWaypoint.name || `wp${waypoints.length - 2}`;
    const toId = lastWaypoint.id || lastWaypoint.name || `wp${waypoints.length - 1}`;
    const lastSegmentId = `${fromId}-${toId}`;
    const cruiseAltitude = segmentAltitudes[lastSegmentId]?.startAlt || plannedAltitude;

    // Altitude cible par défaut : terrain + 1000 ft
    const targetAltitude = terrainElevation + 1000;

    // Descente totale
    const altitudeToDescent = cruiseAltitude - targetAltitude;

    // Si pas de descente nécessaire
    if (altitudeToDescent <= 0) {
      return {
        error: true,
        message: altitudeToDescent === 0 ? "Déjà à l'altitude pattern" : "Montée requise pour le pattern",
        cruiseAltitude,
        targetAltitude,
        terrainElevation,
        arrivalAerodrome: lastWaypoint.name || 'Destination'
      };
    }

    // Paramètres par défaut
    const descentRate = 500; // ft/min
    // 🔧 FIX D : vitesse canonique (plus de 120 kt fabriqué). Avion incomplet → erreur explicite.
    const groundSpeed = getCruiseSpeedKt(selectedAircraft);
    if (!groundSpeed) {
      return {
        error: true,
        message: 'Vitesse de croisière non renseignée (avion incomplet)',
        cruiseAltitude,
        targetAltitude,
        terrainElevation,
        arrivalAerodrome: lastWaypoint.name || 'Destination'
      };
    }

    // Calculs
    const descentTimeMinutes = altitudeToDescent / descentRate;
    const groundSpeedNmPerMin = groundSpeed / 60;
    const distanceToTod = descentTimeMinutes * groundSpeedNmPerMin;
    const descentAngle = Math.atan((altitudeToDescent / 6076.12) / distanceToTod) * 180 / Math.PI;

    return {
      altitudeToDescent,
      descentTimeMinutes,
      distanceToTod: distanceToTod.toFixed(1),
      descentAngle: descentAngle.toFixed(1),
      targetAltitude,
      cruiseAltitude,
      terrainElevation,
      descentRate,
      groundSpeed,
      arrivalAerodrome: lastWaypoint.name || 'Destination',
      error: false
    };
  }, [waypoints, segmentAltitudes, plannedAltitude, selectedAircraft]);

  // 🔧 FIX: Synchroniser l'avion du flightPlan avec le contexte Aircraft global
  useEffect(() => {
    if (flightPlan?.aircraft?.registration) {
      if (flightPlan.aircraft.id) {
        setSelectedAircraft(flightPlan.aircraft);
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

  // SUPPRIMÉ: searchRadius - Le calcul du rayon de recherche est maintenant fait
  // à l'étape 7 (Step7Alternates) avec le FOB et la zone cône

  // Synchroniser les waypoints du NavigationContext avec le flightPlan
  useEffect(() => {
    // 🔧 FIX CRITIQUE: Ne PAS écraser si waypoints vide ET flightPlan a déjà des données
    // Cela évite d'effacer les waypoints sauvegardés lors du remontage du composant
    const hasWaypointsInContext = waypoints && waypoints.length > 0;
    const hasWaypointsInFlightPlan = flightPlan.route.waypoints && flightPlan.route.waypoints.length > 0;

    if (!hasWaypointsInContext && hasWaypointsInFlightPlan) {
      // Waypoints vides dans le contexte mais présents dans flightPlan
      // → Ne rien faire, laisser la restauration se faire
      console.log('⏳ [Step3Route] Waypoints en attente de restauration depuis flightPlan');
      return;
    }

    if (!hasWaypointsInContext && !hasWaypointsInFlightPlan) {
      // Aucun waypoint nulle part → OK, rien à faire
      return;
    }

    if (!hasWaypointsInContext && flightPlan.route.waypoints?.length > 0) {
      // Waypoints présents dans flightPlan mais pas dans contexte → vider flightPlan
      flightPlan.route.waypoints = [];
      console.log('🔄 Waypoints vidés dans flightPlan');
      if (onUpdate) onUpdate();
      return;
    }

    // Trouver le départ et l'arrivée
    // 🔧 FIX: Utiliser la POSITION plutôt que le type car le type peut être perdu
    // Premier waypoint = départ, dernier waypoint = arrivée
    const departure = waypoints.length > 0 ? waypoints[0] : null;
    const arrival = waypoints.length > 1 ? waypoints[waypoints.length - 1] : null;

    // 🔧 FIX: Extraire les waypoints intermédiaires (ni premier ni dernier)
    // On exclut le premier (départ) et le dernier (arrivée)
    const intermediates = waypoints.length > 2
      ? waypoints.slice(1, -1)
      : [];

    console.log('🔄 Synchronisation waypoints avec flightPlan:', {
      departure,
      arrival,
      intermediates: intermediates.length
    });

    // Mettre à jour le flightPlan si les données sont disponibles
    if (departure || arrival || intermediates.length > 0) {
      if (departure && departure.icao !== flightPlan.route.departure.icao) {
        flightPlan.route.departure = {
          icao: departure.icao || departure.name || '',
          name: departure.name || departure.icao || '',
          coordinates: departure.lat && departure.lon ? { lat: departure.lat, lng: departure.lon } : null,
          elevation: departure.elevation || 0
        };
        console.log('✅ Départ mis à jour dans flightPlan:', flightPlan.route.departure);
      }

      if (arrival && arrival.icao !== flightPlan.route.arrival.icao) {
        flightPlan.route.arrival = {
          icao: arrival.icao || arrival.name || '',
          name: arrival.name || arrival.icao || '',
          coordinates: arrival.lat && arrival.lon ? { lat: arrival.lat, lng: arrival.lon } : null,
          elevation: arrival.elevation || 0
        };
        console.log('✅ Arrivée mise à jour dans flightPlan:', flightPlan.route.arrival);
      }

      // 🔧 FIX: Sauvegarder les waypoints intermédiaires dans flightPlan
      if (intermediates.length > 0) {
        flightPlan.route.waypoints = intermediates.map(wp => ({
          type: wp.type || 'waypoint',
          icao: wp.icao || wp.name,
          name: wp.name,
          coordinates: wp.lat && wp.lon ? { lat: wp.lat, lng: wp.lon } : null,
          lat: wp.lat,
          lon: wp.lon,
          elevation: wp.elevation || 0,
          // 🔧 LOT 8 — une escale avitaillement doit survivre au brouillon
          // (le calcul d'autonomie par tronçon en dépend)
          fuelStop: wp.fuelStop === true,
          // 🔧 LOT 10-C — inséré par l'advisor (Retirer = supprimer) vs
          // aérodrome du trajet marqué (Retirer = dé-marquer)
          fuelStopInserted: wp.fuelStopInserted === true
        }));
        console.log('✅ Waypoints intermédiaires sauvegardés dans flightPlan:', flightPlan.route.waypoints.length);
      } else {
        // Vider les waypoints si plus aucun intermédiaire
        flightPlan.route.waypoints = [];
      }

      // Notifier le wizard de la mise à jour
      if (onUpdate) {
        onUpdate();
      }
    }
  }, [waypoints, flightPlan, onUpdate]);

  // 🔧 FIX: Synchroniser les alternates du store avec flightPlan
  useEffect(() => {
    const syncAlternates = async () => {
      // Importer le store
      const { useAlternatesStore } = await import('@core/stores/alternatesStore');
      const store = useAlternatesStore.getState();
      const selectedAlternates = store.selectedAlternates;

      // 🔧 LOT 2 — Store vide + brouillon avec déroutements = REPRISE : on
      // restaure le store depuis flightPlan au lieu d'écraser flightPlan avec
      // un tableau vide (l'ancienne version amputait le brouillon).
      if (selectedAlternates.length === 0 && (flightPlan.alternates || []).length > 0) {
        store.setSelectedAlternates(flightPlan.alternates.map(alt => ({
          ...alt,
          position: alt.position || alt.coordinates || { lat: alt.lat, lon: alt.lon ?? alt.lng }
        })));
        console.log('♻️ [Step3Route] Déroutements restaurés depuis le brouillon:', flightPlan.alternates.map(a => a.icao));
        return;
      }

      console.log('🔄 [Step3Route] Synchronisation alternates:', {
        storeCount: selectedAlternates.length,
        flightPlanCount: flightPlan.alternates.length
      });

      // Vérifier si les alternates ont changé
      const alternatesChanged = selectedAlternates.length !== flightPlan.alternates.length ||
        selectedAlternates.some((alt, index) => alt.icao !== flightPlan.alternates[index]?.icao);

      if (alternatesChanged) {
        // Mettre à jour flightPlan.alternates
        // 🔧 LOT 2 — conserver position et selectionType (le calcul de
        // dégagement exige la position ; l'ancienne recopie la jetait)
        flightPlan.alternates = selectedAlternates.map(alt => ({
          icao: alt.icao,
          name: alt.name,
          position: alt.position || alt.coordinates || { lat: alt.lat, lon: alt.lon ?? alt.lng },
          coordinates: alt.coordinates || alt.position || { lat: alt.lat, lon: alt.lon ?? alt.lng },
          selectionType: alt.selectionType,
          distance: alt.distance || 0
        }));

        console.log('✅ [Step3Route] Alternates synchronisés dans flightPlan:', flightPlan.alternates);

        // Notifier le wizard de la mise à jour
        if (onUpdate) {
          onUpdate();
        }
      }
    };

    // S'abonner aux changements du store
    import('@core/stores/alternatesStore').then(({ useAlternatesStore }) => {
      const unsubscribe = useAlternatesStore.subscribe((state) => {
        syncAlternates();
      });

      // Synchroniser au montage
      syncAlternates();

      return () => unsubscribe();
    });
  }, [flightPlan, onUpdate]);

  // Charger les points VFR au montage du composant
  useEffect(() => {
    const loadVFRPoints = async () => {
      setLoadingVFR(true);
      try {
        console.log('🔍 Chargement des points VFR depuis AIXM...');
        const allVFRPoints = await vfrPointsExtractor.loadVFRPoints();
        console.log('✅ Points VFR chargés:', allVFRPoints.length);

        // Extraire les codes OACI des aérodromes dans les waypoints
        const aerodromeICAOs = waypoints
          .filter(wp => wp.name && wp.name.match(/^LF[A-Z]{2}$/))
          .map(wp => wp.name);

        console.log('🛫 Aérodromes détectés dans les waypoints:', aerodromeICAOs);

        // Filtrer les points VFR pour les aérodromes sélectionnés
        const filteredPoints = allVFRPoints
          .filter(point => aerodromeICAOs.includes(point.aerodrome))
          .map(point => ({
            name: point.name,
            coordinates: {
              lat: point.coordinates.lat,
              lng: point.coordinates.lon
            },
            description: point.description,
            aerodrome: point.aerodrome,
            visible: true
          }));

        console.log('📍 Points VFR filtrés pour les aérodromes:', filteredPoints.length);
        filteredPoints.forEach(p => {
          console.log(`  - ${p.name} (${p.aerodrome}): ${p.coordinates.lat.toFixed(4)}, ${p.coordinates.lng.toFixed(4)}`);
        });

        setVfrPoints(filteredPoints);
      } catch (error) {
        console.error('❌ Erreur chargement points VFR:', error);
      } finally {
        setLoadingVFR(false);
      }
    };

    loadVFRPoints();
  }, [waypoints]);

  console.log('📍 Step3Route - About to render RouteMapView');
  console.log('📍 vfrPoints à passer:', vfrPoints.length);

  return (
    <div style={commonStyles.container} className="wizard-step-3-route">
      {/* Carte interactive */}
      <div style={commonStyles.mapSection}>
        <div style={commonStyles.mapLabel}>
          Carte du trajet
        </div>
        <RouteMapView
          vfrPoints={vfrPoints}
          flightPlan={flightPlan}
          todCalculation={null}
        />
      </div>

      {/* 🔧 FIX F : distance totale du trajet, visible dès la définition du trajet */}
      {navigationResults?.totalDistance > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', marginTop: '12px',
          backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)',
          borderLeft: '4px solid var(--accent-primary)'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--fs-body)' }}>
            Distance totale du trajet
          </span>
          <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: 'var(--fs-title)', fontVariantNumeric: 'tabular-nums' }}>
            {navigationResults.totalDistance.toFixed(1)} NM
          </span>
        </div>
      )}

      {/* ⛔ Lot 1.0 — vent inconnu ou intenable : signalé dès le trajet (la
          section Résultats de navigation est masquée en mode wizard). */}
      {navigationResults?.totalDistance > 0 &&
        (navigationResults.untenableSegments > 0 ||
          (navigationResults.noWindSegments > 0 && navigationResults.windCorrected === 'partial')) && (
        <div style={{
          padding: '8px 16px', marginTop: '8px',
          backgroundColor: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)',
          borderLeft: '4px solid #f59e0b',
          fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)'
        }}>
          {navigationResults.untenableSegments > 0 && (
            <>⚠ {navigationResults.untenableSegments} tronçon{navigationResults.untenableSegments > 1 ? 's' : ''} au vent intenable (vent ≥ vitesse propre) — temps plancher non représentatif. </>
          )}
          {navigationResults.noWindSegments > 0 && navigationResults.windCorrected === 'partial' && (
            <>Vent inconnu sur {navigationResults.noWindSegments} tronçon{navigationResults.noWindSegments > 1 ? 's' : ''} sur {navigationResults.segmentCount} : temps calculés en air immobile sur ces tronçons.</>
          )}
        </div>
      )}

      {/* 🔧 LOT 8 — alerte autonomie insuffisante + suggestions d'escale
          avitaillement (dès la création de la navigation, demande pilote) */}
      <FuelStopAdvisor
        selectedAircraft={selectedAircraft}
        navigationResults={navigationResults}
      />

      {/* Module de navigation complet pour la gestion des waypoints */}
      <div style={commonStyles.section}>
        <NavigationModule
          wizardMode={true}
          config={{
            showTitle: false,
            showTabs: false,
            showExportButtons: false,
            simplifiedView: true
          }}
        />
      </div>

      {/* Analyse des zones dangereuses survolées + équipements de survie SAR
          obligatoires (NCO.IDE.A.165/170) + codes case 19 du plan de vol.
          Composant auto-géré (détection auto depuis les waypoints + ajustement
          manuel), affiché à titre informatif à ce stade. */}
      <div style={commonStyles.section}>
        <DangerousZonesDetector waypoints={waypoints} plannedAltitude={plannedAltitude} />
      </div>

    </div>
  );
});

// Display name pour le debug
Step3Route.displayName = 'Step3Route';

export default Step3Route;