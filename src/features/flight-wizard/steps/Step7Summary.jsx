import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet';
import { FileText, CheckCircle, Map } from 'lucide-react';
import { theme } from '../../../styles/theme';
import RouteMapView from '../components/RouteMapView';
import { useNavigation } from '@core/contexts';
import 'leaflet/dist/leaflet.css';

/**
 * Composant de carte affichant les rayons d'action
 */
const ActionRadiusMap = ({ waypoints, maxRadiusKM, roundTripRadiusKM }) => {
  // Trouver l'aérodrome de départ
  const departure = waypoints.find(wp => wp.type === 'departure');

  if (!departure || !departure.lat || !departure.lon) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        color: '#6b7280',
        fontSize: '14px'
      }}>
        📍 Aucun aérodrome de départ défini
      </div>
    );
  }

  const centerPosition = [departure.lat, departure.lon];

  return (
    <div style={{ height: '400px', width: '100%', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer
        center={centerPosition}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Cercle bleu : distance maximale (aller simple) */}
        <Circle
          center={centerPosition}
          radius={maxRadiusKM * 1000} // Convertir km en mètres
          pathOptions={{
            color: '#1e40af',
            fillColor: '#1e40af',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '5, 5'
          }}
        >
          <Popup>
            <div style={{ padding: '4px' }}>
              <strong style={{ fontSize: '13px', color: '#1e40af' }}>
                🔵 Distance maximale (aller simple)
              </strong>
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>
                Rayon: {(maxRadiusKM * 0.539957).toFixed(0)} NM ({maxRadiusKM.toFixed(0)} km)
              </div>
            </div>
          </Popup>
        </Circle>

        {/* Cercle vert : distance maximale (aller-retour) */}
        <Circle
          center={centerPosition}
          radius={roundTripRadiusKM * 1000} // Convertir km en mètres
          pathOptions={{
            color: '#16a34a',
            fillColor: '#16a34a',
            fillOpacity: 0.15,
            weight: 2
          }}
        >
          <Popup>
            <div style={{ padding: '4px' }}>
              <strong style={{ fontSize: '13px', color: '#16a34a' }}>
                🟢 Distance maximale (aller-retour)
              </strong>
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#6b7280' }}>
                Rayon: {(roundTripRadiusKM * 0.539957).toFixed(0)} NM ({roundTripRadiusKM.toFixed(0)} km)
              </div>
            </div>
          </Popup>
        </Circle>

        {/* Marqueur de l'aérodrome de départ */}
        <CircleMarker
          center={centerPosition}
          radius={8}
          pathOptions={{
            color: '#93163c',
            fillColor: '#93163c',
            fillOpacity: 1,
            weight: 2
          }}
        >
          <Popup>
            <div style={{ padding: '4px' }}>
              <strong style={{ fontSize: '13px' }}>
                🛫 {departure.icao || departure.name || 'Départ'}
              </strong>
              <div style={{ fontSize: '11px', marginTop: '4px', color: '#6b7280' }}>
                Centre des rayons d'action
              </div>
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
};

/**
 * Étape 7 : Synthèse du vol
 */
export const Step7Summary = ({ flightPlan, onUpdate }) => {
  const summary = flightPlan.generateSummary();
  const { waypoints } = useNavigation();

  // Calculer les rayons d'action basés sur le carburant
  const actionRadii = useMemo(() => {
    // Carburant utilisable (confirmé - réserve)
    const usableFuel = (flightPlan.fuel.confirmed || 0) - (flightPlan.fuel.reserve || 0);

    // Consommation et vitesse de l'avion
    const fuelConsumption = flightPlan.aircraft.fuelConsumption || 40; // L/h
    const cruiseSpeed = flightPlan.aircraft.cruiseSpeed || 120; // kt

    // Autonomie avec carburant utilisable (heures)
    const endurance = usableFuel / fuelConsumption;

    // Rayon maximum (distance simple)
    const maxRadiusNM = endurance * cruiseSpeed;
    const maxRadiusKM = maxRadiusNM * 1.852;

    // Rayon aller-retour (distance divisée par 2)
    const roundTripRadiusNM = maxRadiusNM / 2;
    const roundTripRadiusKM = maxRadiusKM / 2;

    return {
      usableFuel,
      endurance,
      maxRadiusNM,
      maxRadiusKM,
      roundTripRadiusNM,
      roundTripRadiusKM
    };
  }, [flightPlan.fuel, flightPlan.aircraft]);

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
          {/* Informations générales */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Vol
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>{flightPlan.generalInfo.callsign} - {flightPlan.generalInfo.flightType}</div>
              <div>{flightPlan.generalInfo.dayNight === 'day' ? 'Jour' : 'Nuit'} - {flightPlan.generalInfo.flightNature === 'local' ? 'Local' : 'Navigation'}</div>
            </div>
          </div>

          {/* Route */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Trajet
            </h5>
            <div>{flightPlan.route.departure.icao} → {flightPlan.route.arrival.icao}</div>
            {flightPlan.alternates.length > 0 && (
              <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                Déroutement: {flightPlan.alternates.map(a => a.icao).join(', ')}
              </div>
            )}
          </div>

          {/* Aéronef et carburant */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Aéronef
            </h5>
            <div>{flightPlan.aircraft.registration} - {flightPlan.aircraft.type}</div>

            {/* Détails carburant */}
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '6px',
              fontSize: '13px'
            }}>
              <div style={{ fontWeight: '600', color: theme.colors.primary, marginBottom: '4px' }}>
                ⛽ Carburant
              </div>
              <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                Requis: {flightPlan.fuel.required || 0}L |
                Réserve: {flightPlan.fuel.reserveTime || '30min'} ({flightPlan.fuel.reserve || 0}L) |
                Total: <strong>{flightPlan.fuel.confirmed || 0}L</strong>
              </div>
            </div>
          </div>

          {/* Masse et centrage */}
          <div style={{ paddingBottom: '12px', borderBottom: `1px solid ${theme.colors.border}` }}>
            <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
              Masse et centrage
            </h5>
            <div>Masse décollage: {flightPlan.weightBalance.takeoffWeight} kg</div>
            <div style={{
              fontSize: '14px',
              color: flightPlan.weightBalance.withinLimits ? theme.colors.success : theme.colors.error,
              fontWeight: '600'
            }}>
              {flightPlan.weightBalance.withinLimits ? '✓ Dans les limites' : '✗ Hors limites'}
            </div>
          </div>

          {/* TOD (Top of Descent) */}
          {flightPlan.todParameters && flightPlan.todParameters.distanceToTod > 0 && (
            <div>
              <h5 style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '8px' }}>
                Top of Descent (TOD)
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>
                  <span style={{ fontWeight: '600', color: theme.colors.warning }}>
                    TOD à {flightPlan.todParameters.distanceToTod} NM
                  </span> de l'arrivée
                </div>
                <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                  Altitude: {flightPlan.todParameters.cruiseAltitude} ft → {flightPlan.todParameters.arrivalElevation + flightPlan.todParameters.patternAltitude} ft
                </div>
                <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                  Descente: {flightPlan.todParameters.descentRate} ft/min • {flightPlan.todParameters.descentTime} min • {flightPlan.todParameters.descentAngle}°
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Carte des rayons d'action basés sur le carburant */}
      {actionRadii.usableFuel > 0 && waypoints.length > 0 && (
        <div style={{ ...styles.card, marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Map size={20} style={{ color: theme.colors.primary }} />
            <h4 style={{ fontSize: '16px', color: theme.colors.primary, margin: 0 }}>
              Rayons d'action
            </h4>
          </div>

          {/* Informations sur les rayons */}
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '600', color: theme.colors.textSecondary }}>
                  ⛽ Carburant utilisable :
                </span>
                <span style={{ color: theme.colors.primary, fontWeight: '700' }}>
                  {actionRadii.usableFuel.toFixed(1)} L
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '600', color: theme.colors.textSecondary }}>
                  ⏱️ Autonomie :
                </span>
                <span style={{ color: theme.colors.primary, fontWeight: '700' }}>
                  {(actionRadii.endurance * 60).toFixed(0)} minutes ({actionRadii.endurance.toFixed(1)}h)
                </span>
              </div>
              <div style={{
                paddingTop: '8px',
                borderTop: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600', color: theme.colors.textSecondary }}>
                    🔵 Distance maximale (aller simple) :
                  </span>
                  <span style={{ color: '#1e40af', fontWeight: '700' }}>
                    {actionRadii.maxRadiusNM.toFixed(0)} NM ({actionRadii.maxRadiusKM.toFixed(0)} km)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600', color: theme.colors.textSecondary }}>
                    🟢 Distance maximale (aller-retour) :
                  </span>
                  <span style={{ color: '#16a34a', fontWeight: '700' }}>
                    {actionRadii.roundTripRadiusNM.toFixed(0)} NM ({actionRadii.roundTripRadiusKM.toFixed(0)} km)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Carte avec les cercles de rayon d'action */}
          <ActionRadiusMap
            waypoints={waypoints}
            maxRadiusKM={actionRadii.maxRadiusKM}
            roundTripRadiusKM={actionRadii.roundTripRadiusKM}
          />
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
