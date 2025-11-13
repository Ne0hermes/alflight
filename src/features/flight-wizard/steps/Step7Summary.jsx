import React, { useMemo, useState } from 'react';
import { FileText, CheckCircle, Fuel, Navigation, Table } from 'lucide-react';
import { theme } from '../../../styles/theme';
import RouteMapView from '../components/RouteMapView';
import { useNavigation, useAircraft } from '@core/contexts';
import VFRNavigationTable from '@features/navigation/components/VFRNavigationTable';
import { useNavigationResults } from '@features/navigation/hooks/useNavigationResults';
import { useUnits } from '@hooks/useUnits';
import { useFuelStore } from '@core/stores/fuelStore';
import { useWeatherStore } from '@core/stores/weatherStore';
import { calculateAeronauticalNight, formatTime as formatSunTime } from '@services/dayNightCalculator';

/**
 * Étape 7 : Synthèse du vol
 */
export const Step7Summary = ({ flightPlan, onUpdate }) => {
  const summary = flightPlan.generateSummary();
  const { waypoints, segmentAltitudes, setSegmentAltitude } = useNavigation();
  const { selectedAircraft } = useAircraft();
  const { format } = useUnits();

  // State pour le temps de départ théorique
  const [departureTimeTheoretical, setDepartureTimeTheoretical] = useState('');

  // States pour TOD (Top of Descent)
  const [descentRate, setDescentRate] = useState(500); // ft/min
  const [targetAltitude, setTargetAltitude] = useState(0); // ft

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

    // Altitude de croisière (depuis le dernier segment ou plannedAltitude)
    const lastSegmentId = `${secondLastWaypoint.id}-${lastWaypoint.id}`;
    const cruiseAltitude = segmentAltitudes[lastSegmentId]?.startAlt || plannedAltitude;

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
  const { fuelData, fobFuel, calculateTotal } = useFuelStore();

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
    <div style={styles.container}>
      <div style={styles.field}>
        <label style={styles.label}>
          <FileText size={18} style={styles.icon} />
          Synthèse de votre vol
        </label>
      </div>

      <div style={{ ...styles.card, backgroundColor: 'rgba(147, 22, 60, 0.05)' }}>
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
                          color: wp.type === 'departure' ? '#10b981' : wp.type === 'arrival' ? '#ef4444' : theme.colors.textPrimary,
                          fontWeight: wp.type === 'departure' || wp.type === 'arrival' ? '600' : '500'
                        }}>
                          {wp.name || wp.icao}
                        </span>
                        {index < waypoints.length - 1 && (
                          <span style={{ margin: '0 4px', color: '#6b7280' }}>→</span>
                        )}
                      </span>
                    ))}
                  </span>
                  {navigationResults?.totalDistance > 0 && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '13px',
                      color: '#f59e0b',
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

          {/* Temps de départ théorique + Heures nuit aéronautique */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
              {/* Label */}
              <span style={{ fontSize: '14px', color: theme.colors.textSecondary, whiteSpace: 'nowrap' }}>
                ⏰ Temps de départ théorique:
              </span>

              {/* Input */}
              <input
                type="time"
                value={departureTimeTheoretical}
                onChange={(e) => setDepartureTimeTheoretical(e.target.value)}
                style={{
                  padding: '4px 6px',
                  border: '2px solid #3b82f6',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  backgroundColor: 'white',
                  width: '85px',
                  flexShrink: 0
                }}
              />

              {/* Badge heures de nuit aéronautique */}
              {sunTimes && (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  fontSize: '11px',
                  color: '#78350f',
                  backgroundColor: '#fef3c7',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #f59e0b',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    🌅 <strong>Coucher:</strong> {formatSunTime(sunTimes.sunset)}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    🌙 <strong>Nuit:</strong> {formatSunTime(sunTimes.nightStart)}
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    🌄 <strong>Lever:</strong> {formatSunTime(sunTimes.sunrise)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Informations Avion */}
      <div style={{ ...styles.card, marginTop: '24px', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CheckCircle size={20} style={{ color: theme.colors.primary }} />
          <h4 style={{ fontSize: '16px', color: theme.colors.primary, margin: 0 }}>
            {flightPlan.aircraft.registration} {flightPlan.aircraft.type || flightPlan.aircraft.model ? `(${flightPlan.aircraft.type || flightPlan.aircraft.model})` : ''}
          </h4>
        </div>

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
                  return <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>Non renseignés</span>;
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
          {selectedAircraft?.fuelType && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                  Type de carburant:
                </span>
                <strong style={{ fontSize: '15px' }}>
                  {selectedAircraft.fuelType}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

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
          <div style={{ ...styles.card, marginTop: '24px', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
            <h4 style={{ fontSize: '16px', color: theme.colors.primary, marginBottom: '16px' }}>
              Météo (METAR)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* METAR Départ */}
              {departureIcao && weatherData[departureIcao]?.metar?.raw && (
                <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <strong style={{ color: '#10b981', fontSize: '15px' }}>{departureIcao}</strong>
                    <span style={{ marginLeft: '8px', color: theme.colors.textSecondary, fontSize: '13px' }}>
                      {departureIcao === arrivalIcao ? '(Départ/Arrivée)' : '(Départ)'}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    backgroundColor: '#f9fafb',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    lineHeight: '1.6',
                    color: '#1f2937'
                  }}>
                    {weatherData[departureIcao].metar.raw}
                  </div>
                </div>
              )}

              {/* METAR Arrivée (si différent du départ) */}
              {arrivalIcao && arrivalIcao !== departureIcao && weatherData[arrivalIcao]?.metar?.raw && (
                <div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <strong style={{ color: '#ef4444', fontSize: '15px' }}>{arrivalIcao}</strong>
                    <span style={{ marginLeft: '8px', color: theme.colors.textSecondary, fontSize: '13px' }}>
                      (Arrivée)
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    backgroundColor: '#f9fafb',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    lineHeight: '1.6',
                    color: '#1f2937'
                  }}>
                    {weatherData[arrivalIcao].metar.raw}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Section Bilan Carburant */}
      <div style={{ ...styles.card, marginTop: '24px', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Fuel size={20} style={{ color: theme.colors.primary }} />
          <h4 style={{ fontSize: '16px', color: theme.colors.primary, margin: 0 }}>
            Bilan Carburant et Autonomie
          </h4>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Carburant requis */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                Carburant total requis:
              </span>
              <strong style={{ fontSize: '15px', color: '#f59e0b' }}>
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
                color: fuelInfo.confirmed >= fuelInfo.required ? '#10b981' : '#ef4444'
              }}>
                {format(fuelInfo.confirmed, 'fuel', 1)}
              </strong>
            </div>
          </div>

          {/* Détail des composantes */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '12px',
            borderRadius: '6px',
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
            borderRadius: '6px',
            backgroundColor: fuelInfo.confirmed >= fuelInfo.required ? '#d1fae5' : '#fee2e2',
            border: `1px solid ${fuelInfo.confirmed >= fuelInfo.required ? '#10b981' : '#ef4444'}`
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', textAlign: 'center', color: fuelInfo.confirmed >= fuelInfo.required ? '#065f46' : '#991b1b' }}>
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
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
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
                  <strong style={{ fontSize: '15px', color: '#1e40af' }}>
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
                  <strong style={{ fontSize: '15px', color: '#15803d' }}>
                    {format(actionRadii.roundTripRadiusNM, 'distance', 0)}
                  </strong>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Section TOD (Top of Descent) - Indépendante */}
      {todCalculation && (
        <div style={{ ...styles.card, marginTop: '24px', backgroundColor: 'rgba(251, 146, 60, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Navigation size={20} style={{ color: '#fb923c' }} />
            <h4 style={{ fontSize: '16px', color: '#fb923c', margin: 0 }}>
              Top of Descent (TOD) - Arrivée {todCalculation.arrivalAerodrome}
            </h4>
          </div>

          {/* Inputs pour ajuster les paramètres TOD */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                Taux de descente (ft/min)
              </label>
              <input
                type="number"
                value={descentRate}
                onChange={(e) => setDescentRate(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: 'white'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: theme.colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                Altitude cible (ft)
              </label>
              <input
                type="number"
                value={targetAltitude}
                onChange={(e) => setTargetAltitude(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: 'white'
                }}
              />
            </div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'rgba(251, 146, 60, 0.1)', borderRadius: '6px', border: '1px solid rgba(251, 146, 60, 0.3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>
                <span style={{ fontWeight: '600', color: theme.colors.warning }}>
                  Distance TOD : {todCalculation.distanceToTod} NM
                </span> avant {todCalculation.arrivalAerodrome}
              </div>
              <div style={{ fontSize: '13px', color: theme.colors.textMuted }}>
                <strong>Paramètres utilisés :</strong>
              </div>
              <div style={{ fontSize: '13px', color: theme.colors.textMuted, paddingLeft: '12px' }}>
                • Altitude croisière : {todCalculation.cruiseAltitude} ft<br />
                • Altitude terrain : {todCalculation.arrivalElevation} ft<br />
                • Altitude pattern : {todCalculation.patternAltitude} ft<br />
                • Descente totale : {todCalculation.altitudeToDescent} ft<br />
                • Taux de descente : {todCalculation.descentRate} ft/min<br />
                • Vitesse sol : {todCalculation.groundSpeed} kt<br />
                • Temps de descente : {todCalculation.descentTime} min<br />
                • Angle de descente : {todCalculation.descentAngle}°
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carte statique de navigation avec points VFR */}
      {waypoints.length > 0 && (
        <div style={{ ...styles.card, marginTop: '24px', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Navigation size={20} style={{ color: theme.colors.primary }} />
            <h4 style={{ fontSize: '16px', color: theme.colors.primary, margin: 0 }}>
              Navigation VFR
            </h4>
          </div>

          {/* Carte interactive avec waypoints et points VFR */}
          <div style={{ marginBottom: '24px' }}>
            <RouteMapView
              flightPlan={flightPlan}
              todCalculation={todCalculation}
            />
          </div>

          {/* Tableau de navigation VFR */}
          {selectedAircraft && waypoints.length >= 2 && (
            <VFRNavigationTable
              waypoints={waypoints}
              selectedAircraft={selectedAircraft}
              plannedAltitude={plannedAltitude}
              flightType={flightType}
              navigationResults={navigationResults}
              segmentAltitudes={segmentAltitudes}
              setSegmentAltitude={setSegmentAltitude}
              departureTimeTheoretical={departureTimeTheoretical}
              flightDate={flightPlan.generalInfo.date}
              hideToggleButton={true}
            />
          )}
        </div>
      )}

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <CheckCircle size={20} style={{ color: theme.colors.primary, marginBottom: '8px' }} />
        <p style={{ fontSize: '14px', color: theme.colors.textPrimary }}>
          Préparation du vol terminée. Vérifiez tous les éléments avant le départ.
        </p>
      </div>
    </div>
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
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
  },
  icon: {
    color: theme.colors.primary,
  },
};
