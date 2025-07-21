import React from 'react';
import { FlightSystemProvider, useFlightSystem } from './context/FlightSystemContext';
import { TabButton } from './components/ui/TabButton';
import { NavigationModule } from './modules/navigation/components/NavigationModule';
import { WeightBalanceModule } from './modules/weightBalance/components/WeightBalanceModule';
import { AircraftManagerModule } from './modules/aircraft/components/AircraftManagerModule';
import { FuelBalanceModule } from './modules/fuel/components/FuelBalanceModule';
import { Navigation, Scale, Settings, Fuel, Map } from 'lucide-react';

// Composant principal
const FlightSystemUI = () => {
  const { activeTab, setActiveTab } = useFlightSystem();

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb', 
      padding: '20px' 
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          color: '#1f2937',
          marginBottom: '20px'
        }}>
          ✈️ Système de Gestion de Vol
        </h1>
        
        {/* Onglets */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '20px' 
        }}>
          <TabButton
            active={activeTab === 'navigation'}
            onClick={() => setActiveTab('navigation')}
            icon={Navigation}
            label="Navigation"
          />
          <TabButton
            active={activeTab === 'weight-balance'}
            onClick={() => setActiveTab('weight-balance')}
            icon={Scale}
            label="Masse et Centrage"
          />
          <TabButton
            active={activeTab === 'fuel'}
            onClick={() => setActiveTab('fuel')}
            icon={Fuel}
            label="Bilan Carburant"
          />
          <TabButton
            active={activeTab === 'aircraft'}
            onClick={() => setActiveTab('aircraft')}
            icon={Settings}
            label="Gestion Avions"
          />
        </div>
        
        {/* Contenu des modules */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '24px', 
          borderRadius: '8px'
        }}>
          {activeTab === 'navigation' && <NavigationModule />}
          {activeTab === 'weight-balance' && <WeightBalanceModule />}
          {activeTab === 'fuel' && <FuelBalanceModule />}
          {activeTab === 'aircraft' && <AircraftManagerModule />}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <FlightSystemProvider>
      <FlightSystemUI />
    </FlightSystemProvider>
  );
}

export default App;