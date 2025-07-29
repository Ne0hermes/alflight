import React, { useState, useEffect } from 'react';
import { 
  Navigation2, 
  Plane, 
  MapPin, 
  Clock, 
  Users, 
  Fuel, 
  AlertCircle,
  Home,
  Calculator,
  Map,
  FileText
} from 'lucide-react';
import { useFlightSystem } from '../../../context/FlightSystemContext';
import { useAirportCoordinates } from '../../../../hooks/useAirportCoordinates';
import { PerformanceCalculator } from './PerformanceCalculator';
import { RouteMap } from './RouteMap';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '24px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  subtitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px',
    color: '#666'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    ':hover': {
      borderColor: '#999'
    },
    ':focus': {
      outline: 'none',
      borderColor: '#0066cc'
    }
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#0052a3'
    }
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginTop: '16px'
  },
  results: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e9ecef'
  },
  resultItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e9ecef'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    borderBottom: '2px solid #e9ecef'
  },
  tab: {
    padding: '10px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    marginBottom: '-2px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  activeTab: {
    color: '#0066cc',
    borderBottomColor: '#0066cc'
  }
};

// Composant pour les informations de réserve carburant
const ReserveInfo = ({ flightType, navigationResults }) => {
  if (!navigationResults || !navigationResults.fuelCalculation) return null;

  const { reserves } = navigationResults.fuelCalculation;
  const isLocal = flightType?.category === 'local';

  return (
    <div style={styles.warningBox}>
      <AlertCircle size={20} color="#856404" />
      <div>
        <strong>Réserves réglementaires :</strong>
        <ul style={{ margin: '4px 0 0 20px', fontSize: '13px' }}>
          {isLocal ? (
            <li>Réserve finale : 20 minutes de vol</li>
          ) : (
            <>
              <li>Réserve de route : {reserves.routeReserve} gallons (10% du carburant étape)</li>
              <li>Réserve finale : {reserves.finalReserve} gallons (30 min)</li>
              <li>Réserve dégagement : {reserves.alternateReserve} gallons</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

// Composant pour la sélection du type de vol
const FlightTypeSelector = ({ flightType, setFlightType, navigationResults }) => (
  <div style={styles.section}>
    <h3 style={styles.subtitle}>
      <Plane size={20} />
      Type de Vol
    </h3>
    <div style={styles.grid}>
      <SelectField
        label="Catégorie"
        icon={flightType?.category === 'local' ? <Home size={16} /> : <Navigation2 size={16} />}
        value={flightType?.category || 'navigation'}
        onChange={(e) => setFlightType({...flightType, category: e.target.value})}
        options={[
          { value: 'local', label: 'Vol Local' },
          { value: 'navigation', label: 'Navigation' }
        ]}
      />
    </div>
    <ReserveInfo flightType={flightType} navigationResults={navigationResults} />
  </div>
);

// Composant générique pour les champs de sélection
const SelectField = ({ label, icon, value, onChange, options }) => (
  <div>
    <label style={styles.label}>
      {icon}
      {label}
    </label>
    <select style={styles.select} value={value} onChange={onChange}>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// Composant générique pour les champs de saisie
const InputField = ({ label, icon, ...props }) => (
  <div>
    <label style={styles.label}>
      {icon}
      {label}
    </label>
    <input style={styles.input} {...props} />
  </div>
);

// Composant pour la saisie des données de vol
const FlightDataInput = ({ flightData, setFlightData, onCalculate, loading }) => {
  const { profile } = useFlightSystem();
  
  const handleChange = (field, value) => {
    setFlightData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={styles.section}>
      <h3 style={styles.subtitle}>
        <MapPin size={20} />
        Données de Vol
      </h3>
      
      <div style={styles.grid}>
        <InputField
          label="Départ (ICAO)"
          icon={<MapPin size={16} />}
          type="text"
          placeholder="LFPG"
          value={flightData.departure}
          onChange={(e) => handleChange('departure', e.target.value.toUpperCase())}
        />
        
        <InputField
          label="Arrivée (ICAO)"
          icon={<MapPin size={16} />}
          type="text"
          placeholder="LFPO"
          value={flightData.arrival}
          onChange={(e) => handleChange('arrival', e.target.value.toUpperCase())}
        />
        
        <InputField
          label="Altitude (ft)"
          icon={<Navigation2 size={16} />}
          type="number"
          placeholder="5500"
          value={flightData.altitude}
          onChange={(e) => handleChange('altitude', e.target.value)}
        />
        
        <SelectField
          label="Puissance"
          icon={<Fuel size={16} />}
          value={flightData.powerSetting}
          onChange={(e) => handleChange('powerSetting', e.target.value)}
          options={[
            { value: '65', label: '65% - Économique' },
            { value: '75', label: '75% - Standard' },
            { value: 'max', label: 'Max - Performance' }
          ]}
        />
      </div>

      <div style={styles.grid}>
        <InputField
          label="Distance (NM)"
          icon={<Navigation2 size={16} />}
          type="number"
          placeholder="120"
          value={flightData.distance}
          onChange={(e) => handleChange('distance', e.target.value)}
        />
        
        <InputField
          label="Passagers"
          icon={<Users size={16} />}
          type="number"
          placeholder="3"
          value={flightData.passengers}
          onChange={(e) => handleChange('passengers', e.target.value)}
        />
        
        <InputField
          label="Bagages (lbs)"
          icon={<Users size={16} />}
          type="number"
          placeholder="100"
          value={flightData.baggage}
          onChange={(e) => handleChange('baggage', e.target.value)}
        />
        
        <InputField
          label="Durée estimée (min)"
          icon={<Clock size={16} />}
          type="number"
          placeholder="60"
          value={flightData.estimatedDuration}
          onChange={(e) => handleChange('estimatedDuration', e.target.value)}
        />
      </div>

      <button 
        style={styles.button} 
        onClick={onCalculate}
        disabled={loading}
      >
        <Calculator size={16} />
        {loading ? 'Calcul en cours...' : 'Calculer'}
      </button>
    </div>
  );
};

// Composant pour afficher les résultats
const NavigationResults = ({ results }) => {
  if (!results) return null;

  const { fuelCalculation, weightBalance, performance } = results;

  return (
    <div style={styles.section}>
      <h3 style={styles.subtitle}>
        <FileText size={20} />
        Résultats de Navigation
      </h3>

      <div style={styles.results}>
        <h4>Carburant</h4>
        <div style={styles.resultItem}>
          <span>Consommation totale :</span>
          <strong>{fuelCalculation.totalFuel.toFixed(1)} gallons</strong>
        </div>
        <div style={styles.resultItem}>
          <span>Carburant minimum requis :</span>
          <strong>{fuelCalculation.minimumFuel.toFixed(1)} gallons</strong>
        </div>
        <div style={styles.resultItem}>
          <span>Autonomie avec plein :</span>
          <strong>{fuelCalculation.endurance.toFixed(1)} heures</strong>
        </div>
      </div>

      <div style={styles.results}>
        <h4>Masse et Centrage</h4>
        <div style={styles.resultItem}>
          <span>Masse au décollage :</span>
          <strong>{weightBalance.totalWeight.toFixed(0)} lbs</strong>
        </div>
        <div style={styles.resultItem}>
          <span>Centrage :</span>
          <strong style={{ color: weightBalance.isWithinCG ? 'green' : 'red' }}>
            {weightBalance.cg.toFixed(1)} pouces {!weightBalance.isWithinCG && '⚠️'}
          </strong>
        </div>
      </div>

      <div style={styles.results}>
        <h4>Performances</h4>
        <div style={styles.resultItem}>
          <span>Distance de décollage :</span>
          <strong>{performance.takeoffDistance.toFixed(0)} ft</strong>
        </div>
        <div style={styles.resultItem}>
          <span>Taux de montée :</span>
          <strong>{performance.climbRate.toFixed(0)} ft/min</strong>
        </div>
        <div style={styles.resultItem}>
          <span>Vitesse de croisière :</span>
          <strong>{performance.cruiseSpeed.toFixed(0)} kts</strong>
        </div>
      </div>
    </div>
  );
};

// Composant principal
export const NavigationModule = () => {
  const { profile } = useFlightSystem();
  const [activeTab, setActiveTab] = useState('planning');
  const [loading, setLoading] = useState(false);
  const [flightType, setFlightType] = useState({ category: 'navigation' });
  const [flightData, setFlightData] = useState({
    departure: '',
    arrival: '',
    alternate: '',
    altitude: '',
    powerSetting: '75',
    distance: '',
    passengers: '1',
    baggage: '0',
    estimatedDuration: ''
  });
  const [navigationResults, setNavigationResults] = useState(null);

  // Hook pour récupérer les coordonnées des aéroports
  const departureCoords = useAirportCoordinates(flightData.departure);
  const arrivalCoords = useAirportCoordinates(flightData.arrival);

  const calculateNavigation = async () => {
    setLoading(true);
    try {
      // Simulation du calcul
      await new Promise(resolve => setTimeout(resolve, 1000));

      const fuelConsumption = profile?.performance?.cruise?.fuelFlow || 8.5;
      const duration = parseFloat(flightData.estimatedDuration) || 60;
      const baseFuel = (duration / 60) * fuelConsumption;

      const results = {
        fuelCalculation: {
          totalFuel: baseFuel * 1.3,
          minimumFuel: baseFuel * 1.15,
          endurance: 53 / fuelConsumption,
          reserves: {
            routeReserve: baseFuel * 0.1,
            finalReserve: fuelConsumption * 0.5,
            alternateReserve: fuelConsumption * 0.75
          }
        },
        weightBalance: {
          totalWeight: 2300 + (parseFloat(flightData.passengers) || 1) * 170 + 
                       (parseFloat(flightData.baggage) || 0),
          cg: 40.5,
          isWithinCG: true
        },
        performance: {
          takeoffDistance: 1200,
          climbRate: 700,
          cruiseSpeed: 115
        }
      };

      setNavigationResults(results);
    } catch (error) {
      console.error('Erreur de calcul:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'planning', label: 'Planification', icon: <Navigation2 size={16} /> },
    { id: 'performance', label: 'Performances', icon: <Calculator size={16} /> },
    { id: 'map', label: 'Carte', icon: <Map size={16} /> }
  ];

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h2 style={styles.title}>
          <Navigation2 size={24} />
          Module Navigation
        </h2>
        
        <div style={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.activeTab : {})
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'planning' && (
        <>
          <FlightTypeSelector 
            flightType={flightType} 
            setFlightType={setFlightType}
            navigationResults={navigationResults}
          />
          
          <FlightDataInput
            flightData={flightData}
            setFlightData={setFlightData}
            onCalculate={calculateNavigation}
            loading={loading}
          />
          
          <NavigationResults results={navigationResults} />
        </>
      )}

      {activeTab === 'performance' && (
        <PerformanceCalculator flightData={flightData} />
      )}

      {activeTab === 'map' && (
        <RouteMap 
          departure={departureCoords}
          arrival={arrivalCoords}
          flightData={flightData}
        />
      )}
    </div>
  );
};