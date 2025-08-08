// src/features/pilot/PilotModule.jsx
import React, { useState } from 'react';
import { User, FileText, Award, Calendar, Settings } from 'lucide-react';
// Style system removed - using inline styles
import PilotProfile from './components/PilotProfile';
import PilotLogbook from './components/PilotLogbook';
import PilotCertifications from './components/PilotCertifications';
import MedicalReminders from './components/MedicalReminders';
import UnitsPreferences from './components/UnitsPreferences';

const PilotModule = () => {
  const [activeTab, setActiveTab] = useState('profile');
  
  // Exposer setActiveTab globalement pour les composants enfants
  React.useEffect(() => {
    window.setPilotActiveTab = setActiveTab;
    return () => {
      delete window.setPilotActiveTab;
    };
  }, []);

  const tabs = [
    { id: 'profile', label: 'Profil Pilote', icon: User },
    { id: 'logbook', label: 'Carnet de Vol', icon: FileText },
    { id: 'certifications', label: 'Licences & Qualifications', icon: Award },
    { id: 'medical', label: 'Suivi Médical', icon: Calendar },
    { id: 'units', label: 'Unités', icon: Settings }
  ];

  return (
    <div style={{ padding: '16px' }}>
      {/* En-tête */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'flex-start' }}>
          <User size={24} style={{ marginRight: '8px' }} />
          Espace Pilote
        </h2>
      </div>

      {/* Onglets de navigation */}
      <div style={{ 
        display: 'flex',
        marginBottom: '16px',
        borderBottom: '2px solid #e5e7eb',
        gap: '0',
        overflowX: 'auto'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#6b7280',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu des onglets */}
      <div>
        {activeTab === 'profile' && <PilotProfile setActiveTab={setActiveTab} />}
        {activeTab === 'logbook' && <PilotLogbook />}
        {activeTab === 'certifications' && <PilotCertifications />}
        {activeTab === 'medical' && <MedicalReminders />}
        {activeTab === 'units' && <UnitsPreferences />}
      </div>
    </div>
  );
};

export default PilotModule;