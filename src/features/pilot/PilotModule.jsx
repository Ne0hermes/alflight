// src/features/pilot/PilotModule.jsx
import React, { useState } from 'react';
import { User, FileText } from 'lucide-react';
import PilotProfile from './components/PilotProfile';
import { FlightHistory } from './components/FlightHistory';

const PilotModule = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profil Pilote', icon: User },
    { id: 'history', label: 'Historique des vols', icon: FileText }
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

      {/* Onglets */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '0'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: activeTab === tab.id ? '#93163C' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#6b7280',
                border: 'none',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px',
                borderBottom: activeTab === tab.id ? '2px solid #93163C' : '2px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'rgba(147, 22, 60, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {activeTab === 'profile' && <PilotProfile />}
        {activeTab === 'history' && <FlightHistory pilotName="F-HSTR" callsign="F-HSTR" />}
      </div>
    </div>
  );
};

export default PilotModule;