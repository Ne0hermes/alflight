// src/App.jsx - Version complète avec module météo intégré
import React from 'react';
import { FlightSystemProvider, useFlightSystem } from './context/FlightSystemContext';
import { TabButton } from './components/ui/TabButton';
import { NavigationModule } from './modules/navigation/components/NavigationModule';
import { WeightBalanceModule } from './modules/weightBalance/components/WeightBalanceModule';
import { AircraftManagerModule } from './modules/aircraft/components/AircraftManagerModule';
import { FuelBalanceModule } from './modules/fuel/components/FuelBalanceModule';
import { VACModule } from './modules/vac/components/VACModule';
import { WeatherModule } from './modules/weather/components/WeatherModule';
import { Navigation, Scale, Settings, Fuel, Map, Cloud } from 'lucide-react';

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
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <TabButton
            active={activeTab === 'navigation'}
            onClick={() => setActiveTab('navigation')}
            icon={Navigation}
            label="Navigation"
          />
          <TabButton
            active={activeTab === 'weather'}
            onClick={() => setActiveTab('weather')}
            icon={Cloud}
            label="Météo"
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
          <TabButton
            active={activeTab === 'vac'}
            onClick={() => setActiveTab('vac')}
            icon={Map}
            label="Cartes VAC"
          />
        </div>
        
        {/* Contenu des modules */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '24px', 
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}>
          {activeTab === 'navigation' && <NavigationModule />}
          {activeTab === 'weather' && <WeatherModule />}
          {activeTab === 'weight-balance' && <WeightBalanceModule />}
          {activeTab === 'fuel' && <FuelBalanceModule />}
          {activeTab === 'aircraft' && <AircraftManagerModule />}
          {activeTab === 'vac' && <VACModule />}
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