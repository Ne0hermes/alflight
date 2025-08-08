import React, { useState } from 'react';
import { useAircraft } from '../../core/contexts';
import TechnicalLog from './components/TechnicalLog';
import SurvivalEquipmentChecklist from './components/SurvivalEquipmentChecklist';
import { FileText, Shield } from 'lucide-react';

const TechnicalLogModule = () => {
  const { selectedAircraft } = useAircraft();
  const [activeTab, setActiveTab] = useState('log');
  const [flightZones, setFlightZones] = useState({});
  
  // Récupérer les zones dangereuses depuis le module Navigation
  React.useEffect(() => {
    const checkZones = () => {
      const storedZones = localStorage.getItem('flightDangerousZones');
      if (storedZones) {
        try {
          const zones = JSON.parse(storedZones);
          setFlightZones(zones);
        } catch (error) {
          console.error('Error parsing flight zones:', error);
        }
      }
    };
    
    // Vérifier au montage et à intervalles réguliers
    checkZones();
    const interval = setInterval(checkZones, 2000); // Vérifier toutes les 2 secondes
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '16px' }}>
      {/* Onglets de navigation */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        marginBottom: '16px', 
        borderBottom: '2px solid #e5e7eb',
        gap: '0'
      }}>
        <button
          onClick={() => setActiveTab('log')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'log' ? '#3b82f6' : 'transparent',
            color: activeTab === 'log' ? 'white' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'log' ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            fontWeight: activeTab === 'log' ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <FileText size={18} />
          Log de vol
        </button>
        
        <button
          onClick={() => setActiveTab('survival')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'survival' ? '#3b82f6' : 'transparent',
            color: activeTab === 'survival' ? 'white' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'survival' ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: '-2px',
            cursor: 'pointer',
            fontWeight: activeTab === 'survival' ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Shield size={18} />
          Équipements SAR
        </button>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'log' && (
        <TechnicalLog selectedAircraft={selectedAircraft} />
      )}
      
      {activeTab === 'survival' && (
        <SurvivalEquipmentChecklist 
          aircraftReg={selectedAircraft?.registration || 'DEFAULT'}
          flightZones={flightZones}
        />
      )}
    </div>
  );
};

export default TechnicalLogModule;