import React, { useState, useEffect } from 'react';
import { 
  Plane, MapPin, Fuel, Users, FileText, 
  CheckCircle, AlertCircle, Search, Plus, Trash2,
  Calculator, Scale, Navigation, Settings
} from 'lucide-react';
import { theme } from '../../../styles/theme';
import { useAircraftStore } from '../../../core/stores/aircraftStore';
import { useNavigationStore } from '../../../core/stores/navigationStore';
import { useWeatherStore } from '../../../core/stores/weatherStore';
import { useWeightBalanceStore } from '../../../core/stores/weightBalanceStore';
import { geoJSONDataService } from '../../navigation/services/GeoJSONDataService';

// Styles communs
const commonStyles = {
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
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
  },
  select: {
    padding: '14px 16px',
    fontSize: '16px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
    cursor: 'pointer',
  },
  button: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: theme.colors.textPrimary,
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  hint: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  card: {
    padding: '16px',
    backgroundColor: 'rgba(30, 28, 28, 0.6)',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
  },
  icon: {
    color: theme.colors.primary,
  },
};

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
    <div style={commonStyles.container}>
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <Plane size={18} style={commonStyles.icon} />
          Quel aéronef utiliserez-vous ?
        </label>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            style={{ ...commonStyles.input, flex: 1 }}
            placeholder="Rechercher par immatriculation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button style={commonStyles.button}>
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
              ...commonStyles.card,
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
        <div style={{ ...commonStyles.card, backgroundColor: 'rgba(147, 22, 60, 0.05)' }}>
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

/**
 * Étape 3 : Définition du trajet
 */
export const Step3Route = ({ flightPlan, onUpdate }) => {
  const navigationStore = useNavigationStore();
  const [waypoints, setWaypoints] = useState(flightPlan.route.waypoints || []);
  const [newWaypoint, setNewWaypoint] = useState('');
  const [departureSearch, setDepartureSearch] = useState(flightPlan.route.departure.icao || '');
  const [arrivalSearch, setArrivalSearch] = useState(flightPlan.route.arrival.icao || '');
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const [showArrivalSuggestions, setShowArrivalSuggestions] = useState(false);

  // État pour les suggestions d'aéroports
  const [departureSuggestions, setDepartureSuggestions] = useState([]);
  const [arrivalSuggestions, setArrivalSuggestions] = useState([]);
  const [searchingDeparture, setSearchingDeparture] = useState(false);
  const [searchingArrival, setSearchingArrival] = useState(false);

  const handleAirportSelect = (field, airport) => {
    const routeData = {
      [field]: {
        icao: airport.icao,
        name: airport.name,
        elevation: airport.elevation || airport.elevation_ft || 0
      }
    };
    flightPlan.updateRoute(routeData);
    
    if (field === 'departure') {
      setDepartureSearch(airport.icao);
      setShowDepartureSuggestions(false);
    } else {
      setArrivalSearch(airport.icao);
      setShowArrivalSuggestions(false);
    }
    
    onUpdate();
  };

  // Recherche d'aéroports avec le service GeoJSON
  const searchAirports = async (search, field) => {
    if (!search || search.length < 2) {
      if (field === 'departure') {
        setDepartureSuggestions([]);
      } else {
        setArrivalSuggestions([]);
      }
      return;
    }

    const setSearching = field === 'departure' ? setSearchingDeparture : setSearchingArrival;
    const setSuggestions = field === 'departure' ? setDepartureSuggestions : setArrivalSuggestions;
    
    setSearching(true);
    try {
      const results = await geoJSONDataService.searchAerodromes(search);
      const formatted = results.slice(0, 5).map(feature => {
        const props = feature.properties;
        // Si le nom est "FRANCE" ou autre pays, utiliser la ville ou le code ICAO
        let displayName = props.name;
        if (displayName === 'FRANCE' || displayName === 'NOUVELLE CALEDONIE' || 
            displayName === 'POLYNESIE FRANCAISE' || !displayName) {
          displayName = props.city || props.icao || 'Aérodrome';
        }
        
        return {
          icao: props.icao,
          name: displayName,
          elevation: props.elevation_ft,
          city: props.city,
          type: props.type
        };
      });
      
      setSuggestions(formatted);
      
    } catch (error) {
      console.error('Erreur recherche aérodromes:', error);
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  // Débounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showDepartureSuggestions) {
        searchAirports(departureSearch, 'departure');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [departureSearch, showDepartureSuggestions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showArrivalSuggestions) {
        searchAirports(arrivalSearch, 'arrival');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [arrivalSearch, showArrivalSuggestions]);

  const addWaypoint = () => {
    if (newWaypoint) {
      const updatedWaypoints = [...waypoints, { name: newWaypoint, coordinates: null }];
      setWaypoints(updatedWaypoints);
      flightPlan.updateRoute({ waypoints: updatedWaypoints });
      setNewWaypoint('');
      onUpdate();
    }
  };

  const removeWaypoint = (index) => {
    const updatedWaypoints = waypoints.filter((_, i) => i !== index);
    setWaypoints(updatedWaypoints);
    flightPlan.updateRoute({ waypoints: updatedWaypoints });
    onUpdate();
  };

  return (
    <div style={commonStyles.container}>
      {/* Aérodrome de départ */}
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <MapPin size={18} style={commonStyles.icon} />
          Quel est votre aérodrome de départ ?
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            style={commonStyles.input}
            placeholder="Code OACI ou nom (ex: LFPG, Paris)"
            value={departureSearch}
            onChange={(e) => {
              setDepartureSearch(e.target.value.toUpperCase());
              setShowDepartureSuggestions(true);
            }}
            onFocus={() => setShowDepartureSuggestions(true)}
            onBlur={() => setTimeout(() => setShowDepartureSuggestions(false), 200)}
          />
          {showDepartureSuggestions && departureSearch.length >= 2 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: theme.colors.backgroundCard,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              marginTop: '4px',
              zIndex: 10,
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {searchingDeparture ? (
                <div style={{ padding: '8px', color: theme.colors.textMuted }}>
                  Recherche en cours...
                </div>
              ) : departureSuggestions.length > 0 ? (
                departureSuggestions.map(apt => (
                <div
                  key={apt.icao}
                  style={{
                    padding: '10px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    ':hover': { backgroundColor: 'rgba(147, 22, 60, 0.1)' }
                  }}
                  onClick={() => handleAirportSelect('departure', apt)}
                >
                  <div style={{ fontWeight: '600', color: theme.colors.textPrimary }}>
                    {apt.icao} - {apt.name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                    {apt.city && apt.city !== apt.name ? apt.city : ''}
                    {apt.type ? ` (${apt.type})` : ''}
                  </div>
                </div>
              ))) : (
                <div style={{ padding: '8px', color: theme.colors.textMuted }}>
                  Aucun résultat trouvé
                </div>
              )}
            </div>
          )}
        </div>
        {flightPlan.route.departure.name && (
          <p style={commonStyles.hint}>{flightPlan.route.departure.name}</p>
        )}
      </div>

      {/* Aérodrome d'arrivée */}
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <MapPin size={18} style={commonStyles.icon} />
          Quel est votre aérodrome d'arrivée ?
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            style={commonStyles.input}
            placeholder="Code OACI ou nom (ex: LFMT, Montpellier)"
            value={arrivalSearch}
            onChange={(e) => {
              setArrivalSearch(e.target.value.toUpperCase());
              setShowArrivalSuggestions(true);
            }}
            onFocus={() => setShowArrivalSuggestions(true)}
            onBlur={() => setTimeout(() => setShowArrivalSuggestions(false), 200)}
          />
          {showArrivalSuggestions && arrivalSearch.length >= 2 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: theme.colors.backgroundCard,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              marginTop: '4px',
              zIndex: 10,
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {searchingArrival ? (
                <div style={{ padding: '8px', color: theme.colors.textMuted }}>
                  Recherche en cours...
                </div>
              ) : arrivalSuggestions.length > 0 ? (
                arrivalSuggestions.map(apt => (
                <div
                  key={apt.icao}
                  style={{
                    padding: '10px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    ':hover': { backgroundColor: 'rgba(147, 22, 60, 0.1)' }
                  }}
                  onClick={() => handleAirportSelect('arrival', apt)}
                >
                  <div style={{ fontWeight: '600', color: theme.colors.textPrimary }}>
                    {apt.icao} - {apt.name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                    {apt.city && apt.city !== apt.name ? apt.city : ''}
                    {apt.type ? ` (${apt.type})` : ''}
                  </div>
                </div>
              ))) : (
                <div style={{ padding: '8px', color: theme.colors.textMuted }}>
                  Aucun résultat trouvé
                </div>
              )}
            </div>
          )}
        </div>
        {flightPlan.route.arrival.name && (
          <p style={commonStyles.hint}>{flightPlan.route.arrival.name}</p>
        )}
      </div>

      {/* Points de cheminement */}
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <Navigation size={18} style={commonStyles.icon} />
          Souhaitez-vous ajouter des points de cheminement ? (Optionnel)
        </label>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            style={{ ...commonStyles.input, flex: 1 }}
            placeholder="Nom du waypoint"
            value={newWaypoint}
            onChange={(e) => setNewWaypoint(e.target.value)}
          />
          <button style={commonStyles.button} onClick={addWaypoint}>
            <Plus size={18} />
            Ajouter
          </button>
        </div>

        {waypoints.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {waypoints.map((wp, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ flex: 1, color: theme.colors.textPrimary }}>{wp.name}</span>
                <button
                  style={{ ...commonStyles.button, backgroundColor: 'transparent', border: `1px solid ${theme.colors.border}`, padding: '8px' }}
                  onClick={() => removeWaypoint(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Résumé du trajet */}
      {flightPlan.route.distance > 0 && (
        <div style={{ ...commonStyles.card, backgroundColor: 'rgba(147, 22, 60, 0.05)' }}>
          <h4 style={{ fontSize: '14px', color: theme.colors.primary, marginBottom: '12px' }}>
            Résumé du trajet
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div>
              <span style={{ color: theme.colors.textMuted, fontSize: '12px' }}>Distance:</span>
              <p style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textPrimary }}>
                {flightPlan.route.distance} NM
              </p>
            </div>
            <div>
              <span style={{ color: theme.colors.textMuted, fontSize: '12px' }}>Temps estimé:</span>
              <p style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.textPrimary }}>
                {Math.floor(flightPlan.route.estimatedTime / 60)}h{flightPlan.route.estimatedTime % 60}min
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Étape 4 : Sélection des aérodromes de déroutement
 */
export const Step4Alternates = ({ flightPlan, onUpdate }) => {
  const [availableAlternates, setAvailableAlternates] = useState([]);

  useEffect(() => {
    // Simuler la recherche d'alternates basée sur l'arrivée
    if (flightPlan.route.arrival.icao) {
      const alternates = [
        { icao: 'LFML', name: 'Marseille Provence', distance: 45 },
        { icao: 'LFTH', name: 'Toulon Hyères', distance: 62 },
        { icao: 'LFMN', name: 'Nice Côte d\'Azur', distance: 85 },
      ];
      setAvailableAlternates(alternates);
    }
  }, [flightPlan.route.arrival.icao]);

  const toggleAlternate = (alternate) => {
    const exists = flightPlan.alternates.find(alt => alt.icao === alternate.icao);
    if (exists) {
      flightPlan.removeAlternate(alternate.icao);
    } else {
      flightPlan.addAlternate(alternate);
    }
    onUpdate();
  };

  return (
    <div style={commonStyles.container}>
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <MapPin size={18} style={commonStyles.icon} />
          Veuillez sélectionner vos aérodromes de déroutement
        </label>
        <p style={commonStyles.hint}>
          Sélectionnez au moins un aérodrome de déroutement adapté à votre vol
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {availableAlternates.map(alternate => {
          const isSelected = flightPlan.alternates.find(alt => alt.icao === alternate.icao);
          return (
            <div
              key={alternate.icao}
              style={{
                ...commonStyles.card,
                cursor: 'pointer',
                border: isSelected ? `2px solid ${theme.colors.primary}` : `1px solid ${theme.colors.border}`,
                backgroundColor: isSelected ? 'rgba(147, 22, 60, 0.05)' : 'rgba(30, 28, 28, 0.6)',
              }}
              onClick={() => toggleAlternate(alternate)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: theme.colors.textPrimary }}>
                    {alternate.icao}
                  </h3>
                  <p style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                    {alternate.name}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.primary }}>
                    {alternate.distance} NM
                  </p>
                  <p style={{ fontSize: '12px', color: theme.colors.textMuted }}>
                    depuis {flightPlan.route.arrival.icao}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {flightPlan.alternates.length > 0 && (
        <div style={{ ...commonStyles.card, backgroundColor: 'rgba(147, 22, 60, 0.1)' }}>
          <CheckCircle size={20} style={{ color: theme.colors.primary, marginBottom: '8px' }} />
          <p style={{ fontSize: '14px', color: theme.colors.textPrimary }}>
            {flightPlan.alternates.length} aérodrome(s) de déroutement sélectionné(s)
          </p>
        </div>
      )}
    </div>
  );
};

// Export des autres étapes (simplifiées pour la démonstration)
export { Step1GeneralInfo } from './Step1GeneralInfo';

// Étape 5 : Carburant simplifié
export const Step5Fuel = ({ flightPlan, onUpdate }) => {
  const [crmFuel, setCrmFuel] = useState(flightPlan.fuel.confirmed || 0);
  const [additionalFuel, setAdditionalFuel] = useState(0);

  const handleFuelUpdate = (crm, additional) => {
    const totalFuel = Number(crm) + Number(additional);
    flightPlan.confirmFuel(totalFuel);
    onUpdate();
  };

  return (
    <div style={commonStyles.container}>
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <Fuel size={18} style={commonStyles.icon} />
          Carburant CRM constaté
        </label>
        <input
          type="number"
          style={commonStyles.input}
          placeholder="Litres constatés au CRM"
          value={crmFuel}
          onChange={(e) => {
            setCrmFuel(e.target.value);
            handleFuelUpdate(e.target.value, additionalFuel);
          }}
        />
        <p style={commonStyles.hint}>
          Indiquez la quantité de carburant constatée au Check Réservoir Machine
        </p>
      </div>

      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <Plus size={18} style={commonStyles.icon} />
          Complément carburant (optionnel)
        </label>
        <input
          type="number"
          style={commonStyles.input}
          placeholder="Litres supplémentaires"
          value={additionalFuel}
          onChange={(e) => {
            setAdditionalFuel(e.target.value);
            handleFuelUpdate(crmFuel, e.target.value);
          }}
        />
        <p style={commonStyles.hint}>
          Ajout supplémentaire si besoin (météo, déroutement, etc.)
        </p>
      </div>

      <div style={{ ...commonStyles.card, backgroundColor: 'rgba(147, 22, 60, 0.05)' }}>
        <h4 style={{ fontSize: '14px', color: theme.colors.primary, marginBottom: '12px' }}>
          Bilan carburant
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: theme.colors.textSecondary }}>CRM constaté :</span>
            <span style={{ fontWeight: '600', color: theme.colors.textPrimary }}>{crmFuel} L</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: theme.colors.textSecondary }}>Complément :</span>
            <span style={{ fontWeight: '600', color: theme.colors.textPrimary }}>{additionalFuel} L</span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: `1px solid ${theme.colors.border}`
          }}>
            <span style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>Total embarqué :</span>
            <span style={{ fontSize: '18px', fontWeight: '600', color: theme.colors.primary }}>
              {Number(crmFuel) + Number(additionalFuel)} L
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Ancienne étape 6 supprimée, remplacée par la nouvelle Step5Fuel

// L'étape 6 (Step6WeightBalance) est maintenant dans son propre fichier
// Elle est exportée directement depuis Step6WeightBalance.jsx

// Étape 7 : Synthèse (anciennement étape 8)
export const Step7Summary = ({ flightPlan, onUpdate }) => {
  const summary = flightPlan.generateSummary();
  
  return (
    <div style={commonStyles.container}>
      <div style={commonStyles.field}>
        <label style={commonStyles.label}>
          <FileText size={18} style={commonStyles.icon} />
          Synthèse de votre vol
        </label>
      </div>

      <div style={{ ...commonStyles.card, backgroundColor: 'rgba(147, 22, 60, 0.05)' }}>
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
            <div style={{ fontSize: '12px', color: theme.colors.textMuted }}>
              Carburant: {flightPlan.fuel.confirmed} L
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
          {flightPlan.todParameters.distanceToTod > 0 && (
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