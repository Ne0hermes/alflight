import React, { useMemo, useState, useEffect } from 'react';
import { FileText, Plane } from 'lucide-react';
import { theme } from '../../../styles/theme';
import RouteMapView from '../components/RouteMapView';
import { useNavigation, useAircraft, useWeightBalance } from '@core/contexts';
import AirspacesSummaryTable from '../../navigation/components/AirspacesSummaryTable';
import { useNavigationResults } from '@features/navigation/hooks/useNavigationResults';
import { useUnits } from '@hooks/useUnits';
import { useFuelStore } from '@core/stores/fuelStore';
import { normalizeElevationToFeet } from '@utils/elevationUtils';
import { useWeatherStore } from '@core/stores/weatherStore';
import { calculateAeronauticalNight, formatTime as formatSunTime } from '@services/dayNightCalculator';
import { WeightBalanceChart } from '@features/weight-balance/components/WeightBalanceChart';
import { ScenarioCards } from '@features/weight-balance/components/ScenarioCards';
import { FUEL_DENSITIES } from '@utils/constants';
import { useVACStore } from '@core/stores/vacStore';
import { aixmParser } from '@services/aixmParser';
// REMOVED: import { getCircuitAltitudes } from '@data/circuitAltitudesComplete'; - File deleted, data must come from official XML
import { CollapsibleSection } from './components/CollapsibleSection';
import { FlightRecapTable } from '../components/FlightRecapTable';

/**
 * Étape 7 : Synthèse du vol
 */
export const Step7Summary = ({ flightPlan, onUpdate }) => {
  const summary = flightPlan.generateSummary();
  const { waypoints, segmentAltitudes, setSegmentAltitude } = useNavigation();
  const { selectedAircraft } = useAircraft();
  const { calculations, loads } = useWeightBalance();
  const { format } = useUnits();
  const { charts } = useVACStore(state => ({ charts: state.charts || {} }));

  // State pour le temps de départ théorique
  const [departureTimeTheoretical, setDepartureTimeTheoretical] = useState('');

  // States pour TOD (Top of Descent)
  const [descentRate, setDescentRate] = useState(500); // ft/min
  const [targetAltitude, setTargetAltitude] = useState(0); // ft

  // State pour les données d'aérodromes VAC
  const [aerodromeData, setAerodromeData] = useState([]);

  // Altitude planifiée par défaut (définie avant todCalculation pour éviter erreur d'initialisation)
  const plannedAltitude = 3000;

  // Initialiser l'altitude cible basée sur le terrain de destination + 1000 ft
  React.useEffect(() => {
    if (waypoints && waypoints.length >= 2) {
      const lastWaypoint = waypoints[waypoints.length - 1];
      const terrainElevation = lastWaypoint.elevation || 0;
      // Initialiser seulement si pas encore défini
      if (targetAltitude === 0) {
        setTargetAltitude(terrainElevation + 1000);
      }
    }
  }, [waypoints, targetAltitude]);

  // 🔍 DEBUG: Logger les données de performance
  useEffect(() => {
    console.log('🔍 [Step7Summary] flightPlan.performance:', flightPlan?.performance);
    console.log('🔍 [Step7Summary] flightPlan complet:', flightPlan);
  }, [flightPlan?.performance, flightPlan]);

  // Fonction pour enrichir un aérodrome avec les données extraites du vacStore (même logique que Step3)
  const getEnrichedAerodrome = (aerodrome) => {
    const upperIcao = aerodrome.icao?.toUpperCase();
    const chart = charts[upperIcao];

    // Si pas de chart VAC, retourner les données AIXM telles quelles
    if (!chart) {
      return aerodrome;
    }

    // Enrichir avec les données extraites de la VAC (SANS écraser les données AIXM existantes)
    const enriched = { ...aerodrome };

    // Priorité : extractedData du vacStore > données racine du chart > données AIXM
    if (chart.extractedData) {
      // Utiliser extractedData SEULEMENT si les valeurs existent
      if (chart.extractedData.transitionAltitude !== undefined) {
        enriched.transitionAltitude = chart.extractedData.transitionAltitude;
      }
      if (chart.extractedData.circuitAltitude !== undefined) {
        // Garder la valeur AAL (Above Aerodrome Level) telle quelle
        // La conversion AAL → AMSL se fait à l'affichage
        enriched.circuitAltitude = chart.extractedData.circuitAltitude;
      }
      if (chart.extractedData.integrationAltitude !== undefined) {
        // Garder la valeur AAL (Above Aerodrome Level) telle quelle
        // La conversion AAL → AMSL se fait à l'affichage
        enriched.integrationAltitude = chart.extractedData.integrationAltitude;
      }
    } else {
      // Fallback: utiliser les données au niveau racine du chart (si elles existent)
      if (chart.transitionAltitude !== undefined) {
        enriched.transitionAltitude = chart.transitionAltitude;
      }
      if (chart.circuitAltitude !== undefined) {
        enriched.circuitAltitude = chart.circuitAltitude;
      }
      if (chart.integrationAltitude !== undefined) {
        enriched.integrationAltitude = chart.integrationAltitude;
      }
    }

    // Si toujours undefined après tentative d'enrichissement, garder les valeurs AIXM originales
    // (ne rien faire, elles sont déjà dans enriched via { ...aerodrome })

    return enriched;
  };

  // Charger les données d'aérodromes pour la section VAC
  useEffect(() => {
    const loadAerodromeData = async () => {
      if (!waypoints || waypoints.length === 0) {
        setAerodromeData([]);
        return;
      }

      try {
        // Récupérer uniquement les aérodromes (départ, arrivée, alternates)
        const aerodromeIcaos = waypoints
          .filter(wp => wp.type === 'departure' || wp.type === 'arrival')
          .map(wp => wp.icao || wp.name)
          .filter(Boolean);

        // Ajouter les alternates depuis le flightPlan
        if (flightPlan?.alternates) {
          flightPlan.alternates.forEach(alt => {
            if (alt.icao && !aerodromeIcaos.includes(alt.icao)) {
              aerodromeIcaos.push(alt.icao);
            }
          });
        }

        // Charger les données AIXM pour ces aérodromes
        const aixmData = await aixmParser.loadAndParse();
        const filteredData = aixmData
          .filter(ad => ad && ad.icao && aerodromeIcaos.includes(ad.icao));

        // ENRICHIR les données AIXM avec les données du vacStore (circuitAltitude, integrationAltitude)
        const enrichedData = filteredData.map(ad => getEnrichedAerodrome(ad));

        console.log('✅ [Step7Summary] Données aérodromes enrichies:', enrichedData);
        setAerodromeData(enrichedData);
      } catch (error) {
        console.error('❌ Erreur chargement données VAC pour Step7:', error);
        setAerodromeData([]);
      }
    };

    loadAerodromeData();
  }, [waypoints, flightPlan?.alternates, charts]);

  // 🌅 Calculer les heures de nuit aéronautique pour l'aérodrome de départ
  const sunTimes = useMemo(() => {
    if (!waypoints || waypoints.length === 0) return null;

    const departureWaypoint = waypoints[0];
    if (!departureWaypoint.lat || !departureWaypoint.lon) return null;

    const date = flightPlan.generalInfo.date ? new Date(flightPlan.generalInfo.date) : new Date();
    return calculateAeronauticalNight(departureWaypoint.lat, departureWaypoint.lon, date);
  }, [waypoints, flightPlan.generalInfo.date]);

  // 📐 Calcul du TOD (Top of Descent) pour l'arrivée
  const todCalculation = useMemo(() => {
    if (!waypoints || waypoints.length < 2) return null;

    const lastWaypoint = waypoints[waypoints.length - 1];
    const secondLastWaypoint = waypoints[waypoints.length - 2];

    // Élévation du terrain de destination
    const terrainElevation = lastWaypoint.elevation || 0;

    // Altitude de croisière : utiliser l'altitude du segment juste avant l'arrivée
    // (c'est l'altitude depuis laquelle la descente commence réellement)
    // 🔧 FIX: Créer segmentId comme dans VFRNavigationTable (id || name || fallback)
    const fromId = secondLastWaypoint.id || secondLastWaypoint.name || `wp${waypoints.length - 2}`;
    const toId = lastWaypoint.id || lastWaypoint.name || `wp${waypoints.length - 1}`;
    const lastSegmentId = `${fromId}-${toId}`;
    const lastSegmentAlt = segmentAltitudes[lastSegmentId]?.startAlt;

    // Log pour debug
    console.log('🔍 [TOD] Calcul altitude croisière:', {
      secondLastWaypoint: secondLastWaypoint.name,
      lastWaypoint: lastWaypoint.name,
      fromId,
      toId,
      lastSegmentId,
      lastSegmentAlt,
      segmentAltitudes,
      plannedAltitude
    });

    // Utiliser l'altitude du dernier segment, ou plannedAltitude par défaut
    const cruiseAltitude = lastSegmentAlt || plannedAltitude;

    // Descente totale (utilise l'altitude cible modifiable)
    const altitudeToDescent = cruiseAltitude - targetAltitude;

    // Si pas de descente nécessaire
    if (altitudeToDescent <= 0) {
      return null; // Pas de TOD à afficher
    }

    // Paramètres (utilise le taux de descente modifiable)
    const groundSpeed = selectedAircraft?.cruiseSpeedKt || 120; // kt

    // Calculs
    const descentTimeMinutes = altitudeToDescent / descentRate;
    const groundSpeedNmPerMin = groundSpeed / 60;
    const distanceToTod = descentTimeMinutes * groundSpeedNmPerMin;
    const descentAngle = Math.atan((altitudeToDescent / 6076.12) / distanceToTod) * 180 / Math.PI;

    return {
      distanceToTod: distanceToTod.toFixed(1),
      descentTime: Math.round(descentTimeMinutes),
      descentAngle: descentAngle.toFixed(1),
      cruiseAltitude,
      arrivalElevation: terrainElevation,
      patternAltitude: targetAltitude,
      altitudeToDescent,
      descentRate,
      groundSpeed,
      arrivalAerodrome: lastWaypoint.icao || lastWaypoint.name || 'Destination'
    };
  }, [waypoints, segmentAltitudes, selectedAircraft, descentRate, targetAltitude, plannedAltitude]);

  // Récupérer les informations du pilote depuis localStorage
  const pilotProfile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
  const pilotName = pilotProfile.firstName && pilotProfile.lastName
    ? `${pilotProfile.firstName} ${pilotProfile.lastName}`
    : 'Non renseigné';

  // Récupérer les données de carburant depuis le store
  const fuelData = useFuelStore(state => state.fuelData);
  const fobFuel = useFuelStore(state => state.fobFuel);
  const calculateTotal = useFuelStore(state => state.calculateTotal);

  // Récupérer les données météo depuis le store
  const weatherData = useWeatherStore(state => state.weatherData || {});

  // Données pour le tableau de navigation VFR (provenant de l'étape 2)
  const flightType = flightPlan.generalInfo.flightType || 'VFR';
  const navigationResults = useNavigationResults(waypoints, flightType, selectedAircraft);

  // Calculer les vraies valeurs de carburant
  const fuelInfo = useMemo(() => {
    const totalRequired = calculateTotal('ltr');
    const totalConfirmed = fobFuel.ltr || 0;
    const reserveFuel = fuelData.finalReserve.ltr || 0;

    // Déterminer le temps de réserve selon le type de vol
    const reserveTime = flightPlan.generalInfo.flightType === 'VFR' ? '30min' : '45min';

    console.log('🔍 [Step7] Calcul carburant:', {
      totalRequired,
      totalConfirmed,
      'fobFuel.ltr': fobFuel.ltr,
      'fobFuel.gal': fobFuel.gal,
      difference: totalConfirmed - totalRequired,
      isSufficient: totalConfirmed >= totalRequired
    });

    return {
      required: totalRequired,
      reserve: reserveFuel,
      reserveTime: reserveTime,
      confirmed: totalConfirmed
    };
  }, [fuelData, fobFuel, calculateTotal, flightPlan.generalInfo.flightType]);

  // Calculer les rayons d'action basés sur le carburant
  const actionRadii = useMemo(() => {
    // Carburant utilisable (confirmé - réserve)
    const usableFuel = (fuelInfo.confirmed || 0) - (fuelInfo.reserve || 0);

    // 🔧 FIX: Carburant disponible pour le rayon d'action
    // = Carburant utilisable - Roulage - Contingence
    const taxiFuel = fuelData?.roulage?.ltr || 0;
    const contingencyFuel = fuelData?.contingency?.ltr || 0;
    const fuelForRange = Math.max(0, usableFuel - taxiFuel - contingencyFuel);

    // Consommation et vitesse de l'avion
    const fuelConsumption = flightPlan.aircraft.fuelConsumption || 40; // L/h
    const cruiseSpeed = flightPlan.aircraft.cruiseSpeedKt || 120; // kt

    // Autonomie avec carburant disponible pour le vol (heures)
    const endurance = fuelForRange / fuelConsumption;

    // Rayon maximum (distance simple)
    const maxRadiusNM = endurance * cruiseSpeed;
    const maxRadiusKM = maxRadiusNM * 1.852;

    // Rayon aller-retour (distance divisée par 2)
    const roundTripRadiusNM = maxRadiusNM / 2;
    const roundTripRadiusKM = maxRadiusKM / 2;

    return {
      usableFuel,
      fuelForRange,
      endurance,
      maxRadiusNM,
      maxRadiusKM,
      roundTripRadiusNM,
      roundTripRadiusKM
    };
  }, [fuelInfo, fuelData, flightPlan.aircraft]);

  return (
    <>
      {/* Styles pour l'impression PDF - Responsive A4 portrait */}
      <style>{`
        @media print {
          .departure-time-container {
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .departure-time-label,
          .sun-times-badge,
          .sun-time-item {
            white-space: normal !important;
            word-wrap: break-word !important;
          }
          .sun-times-badge {
            flex-wrap: wrap !important;
            gap: 4px !important;
          }
          .vfr-nav-table-wrapper {
            page-break-before: always !important;
            page-break-inside: avoid !important;
          }
          .weight-balance-alert {
            display: none !important;
          }
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.field}>
          <label style={styles.label}>
            <FileText size={18} style={styles.icon} />
            Synthèse de votre vol
          </label>
        </div>

        <div style={{ ...styles.card, backgroundColor: 'var(--accent-soft)' }}>
          <h4 style={{ fontSize: '16px', color: theme.colors.primary, marginBottom: '16px' }}>
            Résumé de la préparation
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Date, Pilote, Aéronef, Vol */}
            <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>
                <strong style={{ fontWeight: '600' }}>
                  {new Date(flightPlan.generalInfo.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </strong>
                <span> | </span>
                <strong style={{ fontWeight: '600' }}>{pilotName}</strong>
                <span> | </span>
                <span>{flightPlan.generalInfo.flightType} {flightPlan.generalInfo.dayNight === 'day' ? 'Jour' : 'Nuit'} - {flightPlan.generalInfo.flightNature === 'local' ? 'Local' : 'Navigation'}</span>
              </div>
            </div>

            {/* Route détaillée avec tous les waypoints */}
            <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '14px' }}>
                <span style={{ color: theme.colors.textSecondary }}>Trajet complet: </span>
                {/* Afficher tous les waypoints */}
                {waypoints.length > 0 ? (
                  <>
                    <span style={{ fontWeight: '500' }}>
                      {waypoints.map((wp, index) => (
                        <span key={index}>
                          <span style={{
                            color: wp.type === 'departure' ? 'var(--text-primary)' : wp.type === 'arrival' ? '#C04534' : theme.colors.textPrimary,
                            fontWeight: wp.type === 'departure' || wp.type === 'arrival' ? '600' : '500'
                          }}>
                            {wp.name || wp.icao}
                          </span>
                          {index < waypoints.length - 1 && (
                            <span style={{ margin: '0 4px', color: 'var(--text-secondary)' }}>→</span>
                          )}
                        </span>
                      ))}
                    </span>
                    {navigationResults?.totalDistance > 0 && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '13px',
                        color: 'var(--accent-primary)',
                        fontWeight: '600'
                      }}>
                        ({format(navigationResults.totalDistance, 'distance', 0)})
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontWeight: '500' }}>
                    {flightPlan.route.departure.icao} → {flightPlan.route.arrival.icao}
                  </span>
                )}
                {flightPlan.alternates.length > 0 && (
                  <span style={{
                    fontSize: '13px',
                    color: theme.colors.textMuted,
                    marginLeft: '8px',
                    fontStyle: 'italic'
                  }}>
                    (Déroutement: {flightPlan.alternates.map(a => a.icao).join(', ')})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section Informations Avion */}
        <CollapsibleSection
          defaultExpanded={true}
          title={`${flightPlan.aircraft.registration} ${flightPlan.aircraft.type || flightPlan.aircraft.model ? `(${flightPlan.aircraft.type || flightPlan.aircraft.model})` : ''}`}
          containerStyle={{ marginTop: '24px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Équipements SAR */}
            <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                  Équipements SAR:
                </span>
                <div style={{ fontSize: '14px', textAlign: 'right', flex: '1 1 auto', minWidth: '200px' }}>
                  {(() => {
                    // Lire les équipements SAR depuis aircraft.approvedOperations
                    const ops = flightPlan.aircraft.approvedOperations || {};
                    const survEquip = flightPlan.aircraft.equipmentSurv || {};

                    // Collecter les équipements SAR cochés
                    const sarEquipment = [];

                    // ELT (via transponder mode ou explicite)
                    if (survEquip.transponderMode) {
                      sarEquipment.push(`ELT (${survEquip.transponderMode})`);
                    }

                    // Canot de sauvetage
                    if (ops.lifeRaft) {
                      sarEquipment.push('Canot');
                    }

                    // Kit de survie
                    if (ops.survivalKit) {
                      sarEquipment.push('Kit survie');
                    }

                    // PLB (Personal Locator Beacon)
                    if (ops.plb) {
                      sarEquipment.push('PLB');
                    }

                    // Radio de survie
                    if (ops.survivalRadio) {
                      sarEquipment.push('Radio survie');
                    }

                    // Trousse premiers secours
                    if (ops.firstAidKit) {
                      sarEquipment.push('Trousse secours');
                    }

                    // Extincteur
                    if (ops.fireExtinguisherPowder) {
                      sarEquipment.push('Extincteur');
                    }

                    // Fusées de détresse
                    if (ops.flares) {
                      sarEquipment.push('Fusées détresse');
                    }

                    // Miroir de signalisation
                    if (ops.signalMirror) {
                      sarEquipment.push('Miroir');
                    }

                    // Vêtements de survie
                    if (ops.survivalClothing) {
                      sarEquipment.push('Vêtements survie');
                    }

                    // Bouteilles d'oxygène
                    if (ops.oxygenBottles) {
                      sarEquipment.push('O₂');
                    }

                    if (sarEquipment.length > 0) {
                      return <strong style={{ fontWeight: '600' }}>{sarEquipment.join(' • ')}</strong>;
                    }

                    // Pas de données SAR
                    return <span style={{ color: 'var(--accent-primary)', fontStyle: 'italic' }}>Non renseignés</span>;
                  })()}
                </div>
              </div>
            </div>

            {/* Vitesse de croisière */}
            {selectedAircraft?.cruiseSpeedKt && (
              <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                    Vitesse de croisière:
                  </span>
                  <strong style={{ fontSize: '15px' }}>
                    {format(selectedAircraft.cruiseSpeedKt, 'speed', 0)}
                  </strong>
                </div>
              </div>
            )}

            {/* Facteur de base */}
            {selectedAircraft?.baseFactor && (
              <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                    Facteur de base:
                  </span>
                  <strong style={{ fontSize: '15px' }}>
                    {parseFloat(selectedAircraft.baseFactor).toFixed(3)}
                  </strong>
                </div>
              </div>
            )}



            {/* Volume réservoir */}
            {selectedAircraft?.fuelCapacity && (
              <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                    Volume réservoir:
                  </span>
                  <strong style={{ fontSize: '15px' }}>
                    {format(selectedAircraft.fuelCapacity, 'fuel', 1)}
                  </strong>
                </div>
              </div>
            )}

            {/* Consommation moyenne */}
            {selectedAircraft?.fuelConsumption && (
              <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                    Consommation moyenne:
                  </span>
                  <strong style={{ fontSize: '15px' }}>
                    {format(selectedAircraft.fuelConsumption, 'fuelConsumption', 1)}
                  </strong>
                </div>
              </div>
            )}

            {/* Type de carburant */}
            {selectedAircraft?.fuelType && (() => {
              const normalizedFuelType = selectedAircraft.fuelType?.replace(/-/g, ' ');
              const fuelDensity = FUEL_DENSITIES[selectedAircraft.fuelType] ||
                FUEL_DENSITIES[normalizedFuelType] ||
                FUEL_DENSITIES['JET A-1'] ||
                0.84;
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                      Type de carburant:
                    </span>
                    <strong style={{ fontSize: '15px' }}>
                      {selectedAircraft.fuelType} ({fuelDensity} kg/L)
                    </strong>
                  </div>
                </div>
              );
            })()}
          </div>
        </CollapsibleSection>

        {/* Carte statique de navigation avec points VFR */}
        {waypoints.length > 0 && (
          <CollapsibleSection
            defaultExpanded={true}
            title="Navigation VFR"
            containerStyle={{ marginTop: '24px' }}
          >
            {/* Carte interactive avec waypoints et points VFR */}
            <div style={{ marginBottom: '24px' }}>
              <RouteMapView
                flightPlan={flightPlan}
                todCalculation={todCalculation}
              />
              {/* Debug info */}
              {console.log('📊 Step7Summary - waypoints pour carte:', waypoints)}
              {console.log('📊 Step7Summary - selectedAircraft:', selectedAircraft)}
              {console.log('📊 Step7Summary - waypoints.length:', waypoints?.length)}
            </div>
          </CollapsibleSection>
        )}

        {/* Section Espaces Aériens - Déplacé ici */}
        <CollapsibleSection
          defaultExpanded={true}
          title="Espaces Aériens et Zones Traversés"
          containerStyle={{ marginTop: '24px' }}
          titleColor='var(--text-secondary)'
        >
          <AirspacesSummaryTable
            waypoints={waypoints}
            segmentAltitudes={segmentAltitudes}
            plannedAltitude={plannedAltitude}
          />
        </CollapsibleSection>

        {/* Section Météo (METAR) - Séparée */}
        {(() => {
          // Récupérer les codes ICAO de départ et arrivée
          const departureIcao = waypoints[0]?.icao?.toUpperCase();
          const arrivalIcao = waypoints[waypoints.length - 1]?.icao?.toUpperCase();

          // Vérifier s'il y a des données météo
          const hasWeatherData = (departureIcao && weatherData[departureIcao]?.metar?.raw) ||
            (arrivalIcao && arrivalIcao !== departureIcao && weatherData[arrivalIcao]?.metar?.raw);

          if (!hasWeatherData) {
            return null; // Ne rien afficher si pas de données météo
          }

          return (
            <CollapsibleSection
              defaultExpanded={true}
              title="Météo (METAR)"
              containerStyle={{ marginTop: '24px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* METAR Départ */}
                {departureIcao && weatherData[departureIcao]?.metar?.raw && (
                  <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{departureIcao}</strong>
                      <span style={{ marginLeft: '8px', color: theme.colors.textSecondary, fontSize: '13px' }}>
                        {departureIcao === arrivalIcao ? '(Départ/Arrivée)' : '(Départ)'}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      backgroundColor: 'var(--bg-overlay)',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      lineHeight: '1.6',
                      color: 'var(--text-primary)'
                    }}>
                      {weatherData[departureIcao].metar.raw}
                    </div>
                  </div>
                )}

                {/* METAR Arrivée (si différent du départ) */}
                {arrivalIcao && arrivalIcao !== departureIcao && weatherData[arrivalIcao]?.metar?.raw && (
                  <div>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                      <strong style={{ color: '#C04534', fontSize: '15px' }}>{arrivalIcao}</strong>
                      <span style={{ marginLeft: '8px', color: theme.colors.textSecondary, fontSize: '13px' }}>
                        (Arrivée)
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      backgroundColor: 'var(--bg-overlay)',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      lineHeight: '1.6',
                      color: 'var(--text-primary)'
                    }}>
                      {weatherData[arrivalIcao].metar.raw}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          );
        })()}

        {/* Section Performances */}
        {flightPlan?.performance && (flightPlan.performance.departure || flightPlan.performance.arrival) && (
          <CollapsibleSection
            defaultExpanded={true}
            title="Performances Décollage / Atterrissage"
            containerStyle={{ marginTop: '24px' }}
          >
            {/* DÉPART - Performances de décollage */}
            {flightPlan.performance.departure?.takeoff && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Plane size={16} style={{ transform: 'rotate(-45deg)' }} />
                  Départ - {flightPlan.performance.departure.name || flightPlan.performance.departure.icao}
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${theme.colors.border}`
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'var(--text-secondary)',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}>
                    ✈️ Décollage - Take-Off Distance
                  </div>
                  <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginBottom: '8px', fontStyle: 'italic' }}>
                    Normal Procedure
                  </div>

                  {/* Affichage format abaques */}
                  {flightPlan.performance.departure.takeoff.abaques ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {flightPlan.performance.departure.takeoff.abaques.map((abaque, idx) => (
                        <div key={idx} style={{
                          padding: '12px',
                          backgroundColor: 'var(--bg-overlay)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            {abaque.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                            {Math.round(abaque.distance)} {abaque.unit || 'm'}
                          </div>
                        </div>
                      ))}
                      {flightPlan.performance.departure.takeoff.conditions && (
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px', fontStyle: 'italic' }}>
                          Conditions: {flightPlan.performance.departure.takeoff.conditions.temperature?.toFixed(1)}°C,
                          {' '}{flightPlan.performance.departure.takeoff.conditions.altitude} ft,
                          {' '}{flightPlan.performance.departure.takeoff.conditions.mass?.toFixed(0)} kg,
                          {' '}{flightPlan.performance.departure.takeoff.conditions.wind?.toFixed(0)} kt
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Affichage format classique */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      {/* Distance de roulage */}
                      <div>
                        <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                          Distance de roulage (Ground Roll)
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.textPrimary }}>
                          {flightPlan.performance.departure.takeoff.groundRoll
                            ? `${Math.round(flightPlan.performance.departure.takeoff.groundRoll)} m`
                            : '—'}
                        </div>
                      </div>

                      {/* Distance passage 50ft */}
                      <div>
                        <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                          Distance passage 50ft
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: theme.colors.textPrimary }}>
                          {flightPlan.performance.departure.takeoff.toda50ft
                            ? `${Math.round(flightPlan.performance.departure.takeoff.toda50ft)} m`
                            : '—'}
                        </div>
                      </div>

                      {/* Distance passage 15m */}
                      <div>
                        <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                          Distance passage 15m
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: theme.colors.textPrimary }}>
                          {flightPlan.performance.departure.takeoff.toda15m
                            ? `${Math.round(flightPlan.performance.departure.takeoff.toda15m)} m`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ARRIVÉE - Performances d'atterrissage */}
            {flightPlan.performance.arrival?.landing && (
              <div>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Plane size={16} style={{ transform: 'rotate(45deg)' }} />
                  Arrivée - {flightPlan.performance.arrival.name || flightPlan.performance.arrival.icao}
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${theme.colors.border}`
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}>
                    🛬 Atterrissage - Landing Distance
                  </div>
                  <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginBottom: '8px', fontStyle: 'italic' }}>
                    Flaps LDG
                  </div>

                  {/* Affichage format abaques */}
                  {flightPlan.performance.arrival.landing.abaques && flightPlan.performance.arrival.landing.abaques.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {flightPlan.performance.arrival.landing.abaques.map((abaque, idx) => (
                        <div key={idx} style={{
                          padding: '12px',
                          backgroundColor: 'var(--bg-overlay)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--bg-overlay)'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
                            {abaque.name}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {Math.round(abaque.distance)} {abaque.unit || 'm'}
                          </div>
                        </div>
                      ))}
                      {flightPlan.performance.arrival.landing.conditions && (
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px', fontStyle: 'italic' }}>
                          Conditions: {flightPlan.performance.arrival.landing.conditions.temperature?.toFixed(1)}°C,
                          {' '}{flightPlan.performance.arrival.landing.conditions.altitude} ft,
                          {' '}{flightPlan.performance.arrival.landing.conditions.mass?.toFixed(0)} kg,
                          {' '}{(typeof flightPlan.performance.arrival.landing.conditions.wind === 'object' ? flightPlan.performance.arrival.landing.conditions.wind?.speed : flightPlan.performance.arrival.landing.conditions.wind)?.toFixed(0)} kt
                        </div>
                      )}
                    </div>
                  ) : flightPlan.performance.arrival.landing.conditions ? (
                    /* Affichage conditions seules si pas d'abaques */
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', fontStyle: 'italic' }}>
                        Aucun abaque d'atterrissage disponible pour cet avion
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                        Conditions: {flightPlan.performance.arrival.landing.conditions.temperature?.toFixed(1)}°C,
                        {' '}{flightPlan.performance.arrival.landing.conditions.altitude} ft,
                        {' '}{flightPlan.performance.arrival.landing.conditions.mass?.toFixed(0)} kg,
                        {' '}{(typeof flightPlan.performance.arrival.landing.conditions.wind === 'object' ? flightPlan.performance.arrival.landing.conditions.wind?.speed : flightPlan.performance.arrival.landing.conditions.wind)?.toFixed(0)} kt
                      </div>
                    </div>
                  ) : (
                    /* Affichage format classique */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      {/* Distance de roulage */}
                      <div>
                        <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                          Distance de roulage (Ground Roll)
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.textPrimary }}>
                          {flightPlan.performance.arrival.landing.groundRoll
                            ? `${Math.round(flightPlan.performance.arrival.landing.groundRoll)} m`
                            : '—'}
                        </div>
                      </div>

                      {/* Distance passage 50ft */}
                      <div>
                        <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                          Distance passage 50ft
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: theme.colors.textPrimary }}>
                          {flightPlan.performance.arrival.landing.lda50ft
                            ? `${Math.round(flightPlan.performance.arrival.landing.lda50ft)} m`
                            : '—'}
                        </div>
                      </div>

                      {/* Distance passage 15m */}
                      <div>
                        <div style={{ fontSize: '10px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                          Distance passage 15m
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: theme.colors.textPrimary }}>
                          {flightPlan.performance.arrival.landing.lda15m
                            ? `${Math.round(flightPlan.performance.arrival.landing.lda15m)} m`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Section Bilan Carburant */}
        <CollapsibleSection
          defaultExpanded={true}
          title="Bilan Carburant et Autonomie"
          containerStyle={{ marginTop: '24px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Carburant requis */}
            <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                  Carburant total requis:
                </span>
                <strong style={{ fontSize: '15px', color: 'var(--accent-primary)' }}>
                  {format(fuelInfo.required, 'fuel', 1)}
                </strong>
              </div>
            </div>

            {/* Carburant confirmé (FOB) */}
            <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                  Carburant à bord (FOB):
                </span>
                <strong style={{
                  fontSize: '15px',
                  color: fuelInfo.confirmed >= fuelInfo.required ? 'var(--text-primary)' : '#C04534'
                }}>
                  {format(fuelInfo.confirmed, 'fuel', 1)}
                </strong>
              </div>
            </div>

            {/* Détail des composantes */}
            <div style={{
              backgroundColor: 'var(--bg-overlay)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Carburant trajet */}
                {fuelData?.trip?.ltr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.colors.textSecondary }}>• Trajet:</span>
                    <span style={{ fontWeight: '500' }}>{format(fuelData.trip.ltr, 'fuel', 1)}</span>
                  </div>
                )}

                {/* Carburant réserve réglementaire */}
                {fuelData?.finalReserve?.ltr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.colors.textSecondary }}>• Réserve réglementaire:</span>
                    <span style={{ fontWeight: '500' }}>{format(fuelData.finalReserve.ltr, 'fuel', 1)}</span>
                  </div>
                )}

                {/* Carburant déroutement */}
                {fuelData?.alternate?.ltr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.colors.textSecondary }}>• Déroutement:</span>
                    <span style={{ fontWeight: '500' }}>{format(fuelData.alternate.ltr, 'fuel', 1)}</span>
                  </div>
                )}

                {/* Carburant contingence */}
                {fuelData?.contingency?.ltr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.colors.textSecondary }}>• Contingence:</span>
                    <span style={{ fontWeight: '500' }}>{format(fuelData.contingency.ltr, 'fuel', 1)}</span>
                  </div>
                )}

                {/* Carburant taxi/roulage */}
                {fuelData?.roulage?.ltr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.colors.textSecondary }}>• Roulage:</span>
                    <span style={{ fontWeight: '500' }}>{format(fuelData.roulage.ltr, 'fuel', 1)}</span>
                  </div>
                )}

                {/* Carburant additionnel */}
                {fuelData?.additional?.ltr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.colors.textSecondary }}>• Additionnel:</span>
                    <span style={{ fontWeight: '500' }}>{format(fuelData.additional.ltr, 'fuel', 1)}</span>
                  </div>
                )}

                {/* Carburant extra */}
                {fuelData?.extra?.ltr > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.colors.textSecondary }}>• Extra:</span>
                    <span style={{ fontWeight: '500' }}>{format(fuelData.extra.ltr, 'fuel', 1)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Statut suffisance carburant */}
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: fuelInfo.confirmed >= fuelInfo.required ? 'var(--bg-overlay)' : 'var(--bg-overlay)',
              border: `1px solid ${fuelInfo.confirmed >= fuelInfo.required ? 'var(--text-primary)' : '#C04534'}`
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', textAlign: 'center', color: fuelInfo.confirmed >= fuelInfo.required ? 'var(--text-primary)' : '#C04534' }}>
                {fuelInfo.confirmed >= fuelInfo.required ?
                  `✓ Carburant suffisant (+${format(fuelInfo.confirmed - fuelInfo.required, 'fuel', 1)} de marge)` :
                  `✗ Carburant insuffisant (${format(fuelInfo.required - fuelInfo.confirmed, 'fuel', 1)} manquant)`
                }
              </div>
            </div>

            {/* Autonomie et rayons d'action */}
            {actionRadii.fuelForRange > 0 && (
              <>
                {/* Carburant pour le vol */}
                <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                      Carburant pour le vol:
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '15px' }}>
                        {format(actionRadii.fuelForRange, 'fuel', 1)}
                      </strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        (hors roulage/contingence)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Autonomie */}
                <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                      Autonomie:
                    </span>
                    <strong style={{ fontSize: '15px' }}>
                      {(actionRadii.endurance * 60).toFixed(0)} min ({actionRadii.endurance.toFixed(1)}h)
                    </strong>
                  </div>
                </div>

                {/* Distance maximale aller simple */}
                <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                      Distance maximale (aller simple):
                    </span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                      {format(actionRadii.maxRadiusNM, 'distance', 0)}
                    </strong>
                  </div>
                </div>

                {/* Distance maximale aller-retour */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                      Distance maximale (aller-retour):
                    </span>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                      {format(actionRadii.roundTripRadiusNM, 'distance', 0)}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Section Masse et Centrage - Données de l'étape 5 */}
        {selectedAircraft && flightPlan.weightBalance && (() => {
          console.log('📊 [Step7] Weight Balance Data:', {
            hasWeightBalance: !!flightPlan.weightBalance,
            hasScenarios: !!flightPlan.weightBalance?.scenarios,
            scenarios: flightPlan.weightBalance?.scenarios,
            scenarioKeys: flightPlan.weightBalance?.scenarios ? Object.keys(flightPlan.weightBalance.scenarios) : []
          });
          return true;
        })() && (
            <CollapsibleSection
              defaultExpanded={true}
              title="Masse et Centrage"
              containerStyle={{ marginTop: '24px' }}
            >
              {/* Les 4 scénarios */}
              <div style={{ marginBottom: '24px' }}>
                <ScenarioCards
                  scenarios={flightPlan.weightBalance.scenarios}
                  fobFuel={fobFuel}
                  fuelData={fuelData}
                  aircraft={selectedAircraft}
                />
              </div>

              {/* Enveloppe de centrage */}
              <div>
                <WeightBalanceChart
                  aircraft={selectedAircraft}
                  scenarios={flightPlan.weightBalance.scenarios}
                  calculations={flightPlan.weightBalance}
                />
              </div>
            </CollapsibleSection>
          )}

        {/* Section Informations Aérodromes (VAC) */}
        {aerodromeData.length > 0 && (
          <CollapsibleSection
            defaultExpanded={true}
            title="Informations Aérodromes (VAC)"
            containerStyle={{ marginTop: '24px' }}
            titleColor='var(--accent-primary)'
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {aerodromeData.map((aerodrome, idx) => {
                const hasVAC = charts[aerodrome.icao]?.isDownloaded;
                const elevation = normalizeElevationToFeet(aerodrome.elevation, { context: `${aerodrome.icao} (Summary)` });
                const altPlusQNH = elevation ? elevation + 300 : null;

                return (
                  <div
                    key={aerodrome.icao}
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--border-subtle)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    {/* En-tête aérodrome */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '2px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                            {aerodrome.icao}
                          </span>
                          {hasVAC ? (
                            <div style={{
                              padding: '2px 8px',
                              backgroundColor: 'var(--bg-overlay)',
                              border: '1px solid var(--text-primary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '10px',
                              fontWeight: '600',
                              color: 'var(--text-primary)'
                            }}>
                              ✓ VAC
                            </div>
                          ) : (
                            <div style={{
                              padding: '2px 8px',
                              backgroundColor: 'var(--bg-overlay)',
                              border: '1px solid #C04534',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '10px',
                              fontWeight: '600',
                              color: '#C04534'
                            }}>
                              ✗ VAC
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {aerodrome.name}
                        </div>
                        {hasVAC && charts[aerodrome.icao]?.vacNumber && (
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            N° VAC: {charts[aerodrome.icao].vacNumber}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Informations générales du terrain */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '10px',
                      marginBottom: '12px',
                      padding: '10px',
                      backgroundColor: 'var(--bg-overlay)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      {/* Altitude terrain */}
                      {aerodrome.elevation && (
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Altitude</div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {normalizeElevationToFeet(aerodrome.elevation, { context: `${aerodrome.icao} (display)` })} ft
                          </div>
                        </div>
                      )}

                      {/* Altitude TdP (Tour de Piste / Circuit) */}
                      {aerodrome.circuitAltitude && (
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Altitude TdP</div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {(() => {
                              const elevation = normalizeElevationToFeet(aerodrome.elevation, { context: `${aerodrome.icao} (Summary)` });
                              const circuitAAL = typeof aerodrome.circuitAltitude === 'object' ? aerodrome.circuitAltitude.value : aerodrome.circuitAltitude;
                              return elevation && circuitAAL
                                ? `${elevation + circuitAAL} ft (${circuitAAL} AAL)`
                                : `${circuitAAL} ft`;
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Alt + 300 QNH */}
                      {altPlusQNH && (
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Alt + 300 QNH</div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {altPlusQNH} ft
                          </div>
                        </div>
                      )}

                      {/* Altitude VT (Vol de Tour / Integration) */}
                      {aerodrome.integrationAltitude && (
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Altitude VT</div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {(() => {
                              const elevation = normalizeElevationToFeet(aerodrome.elevation, { context: `${aerodrome.icao} (Summary)` });
                              const integrationAAL = typeof aerodrome.integrationAltitude === 'object' ? aerodrome.integrationAltitude.value : aerodrome.integrationAltitude;
                              return elevation && integrationAAL
                                ? `${elevation + integrationAAL} ft (${integrationAAL} AAL)`
                                : `${integrationAAL} ft`;
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Position GPS */}
                      {aerodrome.coordinates && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Position GPS</div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {typeof aerodrome.coordinates.lat === 'number' ? aerodrome.coordinates.lat.toFixed(4) : aerodrome.coordinates.lat}° / {' '}
                            {typeof aerodrome.coordinates.lon === 'number' ? aerodrome.coordinates.lon.toFixed(4) : aerodrome.coordinates.lon}°
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fréquences */}
                    {(() => {
                      // Debug: log de la structure des fréquences
                      console.log('🔍 [Step7] Fréquences pour', aerodrome.icao, ':', aerodrome.frequencies);

                      // Extraire toutes les fréquences disponibles
                      const freqs = [];

                      const addFreq = (label, freqData) => {
                        let freq = null;

                        // Check if it's an array first
                        if (Array.isArray(freqData) && freqData.length > 0) {
                          const firstItem = freqData[0];
                          // Check if array element is object or primitive
                          if (typeof firstItem === 'object' && firstItem !== null) {
                            freq = firstItem.frequency || firstItem.freq || firstItem.value;
                          } else {
                            freq = firstItem; // Direct string or number
                          }
                        } else if (typeof freqData === 'object' && freqData !== null) {
                          freq = freqData.frequency || freqData.freq || freqData.value;
                        } else if (typeof freqData === 'string' || typeof freqData === 'number') {
                          freq = freqData;
                        }

                        if (freq) freqs.push({ label, value: freq });
                      };

                      if (aerodrome.frequencies) {
                        addFreq('ATIS', aerodrome.frequencies.atis);
                        addFreq('Tour', aerodrome.frequencies.twr);
                        addFreq('AFIS', aerodrome.frequencies.afis);
                        addFreq('Sol', aerodrome.frequencies.gnd);
                        addFreq('Approche', aerodrome.frequencies.app);
                      }

                      const hasFreqs = freqs.length > 0;
                      const hasPhone = aerodrome.phone;

                      // Ne pas afficher la section si aucune fréquence ET aucun téléphone
                      if (!hasFreqs && !hasPhone) return null;

                      return (
                        <div style={{
                          marginBottom: '12px',
                          padding: '10px',
                          backgroundColor: 'var(--bg-overlay)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
                            📡 Fréquences Utiles
                          </div>

                          {hasFreqs ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', fontSize: '11px' }}>
                              {freqs.map((f, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{f.label}:</span>
                                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{f.value} MHz</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                              Aucune fréquence disponible dans les données AIXM
                            </div>
                          )}

                          {/* Téléphone Tour */}
                          {hasPhone && (
                            <div style={{ marginTop: hasFreqs ? '8px' : '0', paddingTop: hasFreqs ? '8px' : '0', borderTop: hasFreqs ? '1px solid var(--border-subtle)' : 'none' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>📞 Téléphone Tour:</span>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{aerodrome.phone}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Remarques circuit */}
                    {aerodrome.circuitRemarks && (
                      <div style={{
                        marginBottom: '12px',
                        padding: '8px 10px',
                        backgroundColor: 'rgba(242, 105, 33, 0.10)',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        color: 'var(--accent-primary)'
                      }}>
                        ℹ️ {aerodrome.circuitRemarks}
                      </div>
                    )}

                    {/* Pistes détaillées */}
                    {aerodrome.runways && aerodrome.runways.length > 0 && (() => {
                      // Regrouper les pistes par paires réciproques (01/19, 01L/19R, etc.)
                      const runwayPairs = {};
                      const processedIndices = new Set();

                      aerodrome.runways.forEach((runway, idx) => {
                        if (processedIndices.has(idx)) return;

                        const ident = runway.le_ident || runway.he_ident || runway.identifier;
                        if (!ident) return;

                        // Extraire le numéro et le suffixe (L/R/C)
                        const match = ident.match(/^(\d{1,2})([LRC]?)$/);
                        if (!match) return;

                        const [, numStr, suffix] = match;
                        const identNum = parseInt(numStr);

                        // Calculer l'identifiant réciproque
                        const reciprocalNum = (identNum + 18) % 36;
                        const reciprocalNumStr = reciprocalNum.toString().padStart(2, '0');

                        // Inverser le suffixe L/R pour la piste réciproque
                        let reciprocalSuffix = suffix;
                        if (suffix === 'L') reciprocalSuffix = 'R';
                        else if (suffix === 'R') reciprocalSuffix = 'L';
                        // C reste C

                        const reciprocalIdent = reciprocalNumStr + reciprocalSuffix;

                        // Chercher la piste réciproque
                        const reciprocalIdx = aerodrome.runways.findIndex((r, i) => {
                          if (i <= idx || processedIndices.has(i)) return false;
                          const rIdent = r.le_ident || r.he_ident || r.identifier;
                          return rIdent === reciprocalIdent;
                        });

                        const pairKey = `${Math.min(identNum, reciprocalNum)}-${suffix}-${idx}`;

                        runwayPairs[pairKey] = {
                          runway1: runway,
                          runway2: reciprocalIdx >= 0 ? aerodrome.runways[reciprocalIdx] : null,
                          identifier: reciprocalIdx >= 0 ? `${ident}/${reciprocalIdent}` : ident
                        };

                        processedIndices.add(idx);
                        if (reciprocalIdx >= 0) processedIndices.add(reciprocalIdx);
                      });

                      return (
                        <div style={{ marginTop: '12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
                            🛬 Informations de Pistes
                          </div>

                          {Object.entries(runwayPairs).map(([pairKey, { runway1, runway2, identifier }], pairIdx) => {
                            const surface = runway1.surface?.type || runway1.surface || 'N/A';
                            const width = runway1.width || runway1.le_width || runway1.he_width || null;

                            // Données QFU 1 (cap magnétique)
                            const qfu1_ident = runway1.le_ident || runway1.he_ident || runway1.identifier;
                            const qfu1_heading = runway1.le_heading || runway1.he_heading || null;

                            // Affichage QFU : uniquement le cap magnétique en degrés (ex: "010°")
                            let qfu1_display;
                            if (qfu1_heading !== null && qfu1_heading !== undefined) {
                              qfu1_display = `${String(qfu1_heading).padStart(3, '0')}°`;
                            } else {
                              // Fallback: calculer à partir du numéro de piste (01 → 010°, 19 → 190°)
                              const runwayNum = parseInt(qfu1_ident.replace(/[LRC]/g, ''));
                              if (!isNaN(runwayNum)) {
                                qfu1_display = `${String(runwayNum * 10).padStart(3, '0')}°`;
                              } else {
                                qfu1_display = qfu1_ident;
                              }
                            }

                            // Récupérer les données ILS depuis runway.ils (structure AIXM)
                            const ils1_raw = runway1.ils || null;

                            // Formater l'affichage ILS avec fréquence si disponible
                            let ils1_display = 'N/A';
                            if (ils1_raw) {
                              // Afficher la catégorie ILS (ex: "CAT I")
                              ils1_display = ils1_raw.category || 'ILS';
                              // Ajouter la fréquence si disponible
                              if (ils1_raw.frequency) {
                                ils1_display += ` - ${ils1_raw.frequency} MHz`;
                              }
                            }

                            const tora1 = runway1.length || runway1.le_length || runway1.he_length || 0;
                            const toda1 = runway1.le_toda || runway1.he_toda || tora1;
                            const asda1 = runway1.le_asda || runway1.he_asda || tora1;
                            const lda1 = runway1.lda || runway1.le_lda || runway1.he_lda || tora1;

                            // Données QFU 2 (si piste réciproque existe)
                            let qfu2_display = null;
                            let ils2_display = 'N/A';
                            let tora2 = 0, toda2 = 0, asda2 = 0, lda2 = 0;
                            if (runway2) {
                              const qfu2_ident = runway2.le_ident || runway2.he_ident || runway2.identifier;
                              const qfu2_heading = runway2.le_heading || runway2.he_heading || null;

                              // Affichage QFU : uniquement le cap magnétique en degrés (ex: "190°")
                              if (qfu2_heading !== null && qfu2_heading !== undefined) {
                                qfu2_display = `${String(qfu2_heading).padStart(3, '0')}°`;
                              } else {
                                // Fallback: calculer à partir du numéro de piste (19 → 190°, 01 → 010°)
                                const runwayNum = parseInt(qfu2_ident.replace(/[LRC]/g, ''));
                                if (!isNaN(runwayNum)) {
                                  qfu2_display = `${String(runwayNum * 10).padStart(3, '0')}°`;
                                } else {
                                  qfu2_display = qfu2_ident;
                                }
                              }

                              // Récupérer les données ILS depuis runway.ils (structure AIXM)
                              const ils2_raw = runway2.ils || null;

                              // Formater l'affichage ILS avec fréquence si disponible
                              if (ils2_raw) {
                                // Afficher la catégorie ILS (ex: "CAT I")
                                ils2_display = ils2_raw.category || 'ILS';
                                // Ajouter la fréquence si disponible
                                if (ils2_raw.frequency) {
                                  ils2_display += ` - ${ils2_raw.frequency} MHz`;
                                }
                              }

                              tora2 = runway2.length || runway2.le_length || runway2.he_length || 0;
                              toda2 = runway2.le_toda || runway2.he_toda || tora2;
                              asda2 = runway2.le_asda || runway2.he_asda || tora2;
                              lda2 = runway2.lda || runway2.le_lda || runway2.he_lda || tora2;
                            }

                            return (
                              <div key={pairKey} style={{
                                marginBottom: pairIdx < Object.keys(runwayPairs).length - 1 ? '12px' : '0',
                                padding: '12px',
                                backgroundColor: 'var(--bg-overlay)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)'
                              }}>
                                {/* En-tête piste */}
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: '10px',
                                  paddingBottom: '8px',
                                  borderBottom: '1px solid var(--text-tertiary)'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                      Piste {identifier}
                                    </span>
                                    <span style={{
                                      padding: '2px 6px',
                                      backgroundColor: surface.includes('ASPH') || surface.includes('CONC') ? 'var(--bg-overlay)' : 'rgba(242, 105, 33, 0.10)',
                                      color: surface.includes('ASPH') || surface.includes('CONC') ? 'var(--text-primary)' : 'var(--accent-primary)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '10px',
                                      fontWeight: '600'
                                    }}>
                                      {surface}
                                    </span>
                                  </div>
                                  {width && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      Largeur: {width}m
                                    </span>
                                  )}
                                </div>

                                {/* Tableau à 2 colonnes : QFU 1 et QFU 2 */}
                                <div style={{ display: 'grid', gridTemplateColumns: runway2 ? '1fr 1fr' : '1fr', gap: '12px' }}>
                                  {/* QFU 1 */}
                                  <div style={{
                                    padding: '10px',
                                    backgroundColor: 'var(--bg-surface)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-subtle)'
                                  }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                      QFU {qfu1_display}
                                    </div>
                                    <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>ILS:</span>
                                        <span style={{ fontWeight: '600', color: ils1_display === 'N/A' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{ils1_display}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>TORA:</span>
                                        <span style={{ fontWeight: '600' }}>{tora1}m</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>TODA:</span>
                                        <span style={{ fontWeight: '600' }}>{toda1}m</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>ASDA:</span>
                                        <span style={{ fontWeight: '600' }}>{asda1}m</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>LDA:</span>
                                        <span style={{ fontWeight: '600' }}>{lda1}m</span>
                                      </div>

                                      {/* Distances de performance calculées */}
                                      {(() => {
                                        // idx === 0 = DÉPART (décollage), idx === 1 = ARRIVÉE (atterrissage)
                                        const isDeparture = idx === 0;
                                        const perfData = isDeparture
                                          ? flightPlan?.performance?.departure?.takeoff
                                          : flightPlan?.performance?.arrival?.landing;

                                        if (!perfData || !perfData.abaques || perfData.abaques.length === 0) {
                                          return null;
                                        }

                                        return (
                                          <div style={{
                                            marginTop: '8px',
                                            paddingTop: '8px',
                                            borderTop: '1px solid var(--border-subtle)'
                                          }}>
                                            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                                              📊 {isDeparture ? 'Décollage' : 'Atterrissage'}
                                            </div>
                                            {perfData.abaques.map((abaque, aIdx) => (
                                              <div key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{abaque.name}:</span>
                                                <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '10px' }}>
                                                  {Math.round(abaque.distance)}m
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* QFU 2 (si existe) */}
                                  {runway2 && (
                                    <div style={{
                                      padding: '10px',
                                      backgroundColor: 'var(--bg-surface)',
                                      borderRadius: 'var(--radius-sm)',
                                      border: '1px solid var(--border-subtle)'
                                    }}>
                                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        QFU {qfu2_display}
                                      </div>
                                      <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>ILS:</span>
                                          <span style={{ fontWeight: '600', color: ils2_display === 'N/A' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{ils2_display}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>TORA:</span>
                                          <span style={{ fontWeight: '600' }}>{tora2}m</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>TODA:</span>
                                          <span style={{ fontWeight: '600' }}>{toda2}m</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>ASDA:</span>
                                          <span style={{ fontWeight: '600' }}>{asda2}m</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span style={{ color: 'var(--text-secondary)' }}>LDA:</span>
                                          <span style={{ fontWeight: '600' }}>{lda2}m</span>
                                        </div>

                                        {/* Distances de performance calculées */}
                                        {(() => {
                                          // idx === 0 = DÉPART (décollage), idx === 1 = ARRIVÉE (atterrissage)
                                          const isDeparture = idx === 0;
                                          const perfData = isDeparture
                                            ? flightPlan?.performance?.departure?.takeoff
                                            : flightPlan?.performance?.arrival?.landing;

                                          if (!perfData || !perfData.abaques || perfData.abaques.length === 0) {
                                            return null;
                                          }

                                          return (
                                            <div style={{
                                              marginTop: '8px',
                                              paddingTop: '8px',
                                              borderTop: '1px solid var(--border-subtle)'
                                            }}>
                                              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                                                📊 {isDeparture ? 'Décollage' : 'Atterrissage'}
                                              </div>
                                              {perfData.abaques.map((abaque, aIdx) => (
                                                <div key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                  <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>{abaque.name}:</span>
                                                  <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '10px' }}>
                                                    {Math.round(abaque.distance)}m
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Tableau récapitulatif pour le PDF */}
        <FlightRecapTable
          flightPlan={flightPlan}
          waypoints={waypoints}
          selectedAircraft={selectedAircraft}
          aerodromeData={aerodromeData}
          todCalculation={todCalculation}
          navigationResults={navigationResults}
          segmentAltitudes={segmentAltitudes}
          setSegmentAltitude={setSegmentAltitude}
          departureTimeTheoretical={departureTimeTheoretical}
          setDepartureTimeTheoretical={setDepartureTimeTheoretical}
          flightType={flightType}
          descentRate={descentRate}
          setDescentRate={setDescentRate}
          targetAltitude={targetAltitude}
          setTargetAltitude={setTargetAltitude}
          sunTimes={sunTimes}
          formatSunTime={formatSunTime}
          onUpdate={onUpdate}
        />

        {/* Page de rappel pour documents à joindre */}
        <div
          className="documents-reminder-page"
          style={{
            marginTop: '48px',
            padding: '40px',
            minHeight: '400px',
            backgroundColor: 'var(--bg-overlay)',
            border: '3px solid var(--text-secondary)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            pageBreakBefore: 'always',
            pageBreakInside: 'avoid'
          }}
        >
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '40px',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            📋 Documents à joindre au dossier de vol
          </div>

          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            width: '100%',
            maxWidth: '600px'
          }}>
            <li style={{
              backgroundColor: 'var(--bg-surface)',
              border: '2px solid var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '20px 24px',
              marginBottom: '20px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px', flexShrink: 0 }}>🗺️</span>
              <span>Ajouter les cartes VAC des aérodromes de la nav</span>
            </li>
            <li style={{
              backgroundColor: 'var(--bg-surface)',
              border: '2px solid var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '20px 24px',
              marginBottom: '20px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px', flexShrink: 0 }}>☁️</span>
              <span>Ajouter les cartes météo Wind Temp et TEMSI du SIA</span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontSize: '16px',
    fontWeight: '600',
    color: theme.colors.textPrimary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  card: {
    padding: '16px',
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${theme.colors.border}`,
  },
  icon: {
    color: theme.colors.primary,
  },
};
