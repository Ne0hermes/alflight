import React, { useState } from 'react';
import { Plane, Search } from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useAircraftStore } from '../../../core/stores/aircraftStore';

/**
 * Étape 2 : Sélection de l'aéronef
 */
export const Step2Aircraft = ({ flightPlan, onUpdate }) => {
  const { aircraftList, selectedAircraft } = useAircraftStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Utiliser les avions du store, avec fallback sur des avions par défaut
  const storeAircraft = aircraftList || [];
  const defaultAircraft = [
    { registration: 'F-GBCD', type: 'DR400', model: 'Robin DR400-140B', cruiseSpeed: 115, fuelConsumption: 30, fuelCapacity: 110, emptyWeight: 650, maxWeight: 1100 },
    { registration: 'F-HPDA', type: 'DA40', model: 'Diamond DA40 TDI', cruiseSpeed: 130, fuelConsumption: 18, fuelCapacity: 140, emptyWeight: 820, maxWeight: 1280 },
    { registration: 'F-GCYP', type: 'C172', model: 'Cessna 172S', cruiseSpeed: 110, fuelConsumption: 35, fuelCapacity: 200, emptyWeight: 743, maxWeight: 1111 },
  ];

  const availableAircraft = storeAircraft.length > 0 ? storeAircraft : defaultAircraft;

  const handleSelectAircraft = (aircraft) => {
    flightPlan.updateAircraft(aircraft);
    onUpdate();
  };

  const filteredAircraft = availableAircraft.filter(ac =>
    ac.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ac.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.container}>
      <div style={styles.field}>
        <label style={styles.label}>
          <Plane size={18} style={styles.icon} />
          Quel aéronef utiliserez-vous ?
        </label>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            style={{ ...styles.input, flex: 1 }}
            placeholder="Rechercher par immatriculation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button style={styles.button}>
            <Search size={18} />
            Rechercher
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredAircraft.map(aircraft => (
          <div
            key={aircraft.registration}
            style={{
              ...styles.card,
              cursor: 'pointer',
              border: flightPlan.aircraft.registration === aircraft.registration
                ? `2px solid ${theme.colors.primary}`
                : `1px solid ${theme.colors.border}`,
            }}
            onClick={() => handleSelectAircraft(aircraft)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textPrimary }}>
                {aircraft.registration}
              </h3>
              <span style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                {aircraft.type}
              </span>
            </div>
            <p style={{ fontSize: '14px', color: theme.colors.textSecondary, marginBottom: '12px' }}>
              {aircraft.model}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12px' }}>
              <div><span style={{ color: theme.colors.textMuted }}>Vitesse:</span> {aircraft.cruiseSpeed} kt</div>
              <div><span style={{ color: theme.colors.textMuted }}>Conso:</span> {aircraft.fuelConsumption} L/h</div>
              <div><span style={{ color: theme.colors.textMuted }}>Carburant:</span> {aircraft.fuelCapacity} L</div>
              <div><span style={{ color: theme.colors.textMuted }}>MTOW:</span> {aircraft.maxWeight} kg</div>
            </div>
          </div>
        ))}
      </div>

      {flightPlan.aircraft.registration && (
        <div style={{ ...styles.card, backgroundColor: 'rgba(147, 22, 60, 0.05)' }}>
          <h4 style={{ fontSize: '14px', color: theme.colors.primary, marginBottom: '8px' }}>
            Aéronef sélectionné
          </h4>
          <p style={{ fontSize: '16px', fontWeight: '600', color: theme.colors.textPrimary }}>
            {flightPlan.aircraft.registration} - {flightPlan.aircraft.model}
          </p>
        </div>
      )}
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
  input: {
    padding: '14px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
  },
  button: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
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