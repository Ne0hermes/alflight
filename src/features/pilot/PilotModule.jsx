// src/features/pilot/PilotModule.jsx
// ============================================================================
//  PilotModule — Refonte charte éditoriale ALFlight (Phase 3.3)
//
//  Header EditorialHeading + eyebrow, sous-tabs en mono ALL CAPS avec
//  underline orange, contenu sur fond --bg-surface.
//  Aucune couleur hardcodée.
// ============================================================================

import React, { useState } from 'react';
import { User, FileText } from 'lucide-react';
import PilotProfile from './components/PilotProfile';
import { FlightHistory } from './components/FlightHistory';
import { ModuleHero } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

const PilotModule = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profil pilote', icon: User },
    { id: 'history', label: 'Historique des vols', icon: FileText },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontFamily: tokens.fontFamily.sans,
        minHeight: '100vh',
        padding: `clamp(${tokens.spacing[6]}, 4vw, ${tokens.spacing[9]}) clamp(${tokens.spacing[5]}, 3vw, ${tokens.spacing[8]})`,
        boxSizing: 'border-box',
      }}
    >
      {/* 🎨 Hero éditorial unifié */}
      <ModuleHero
        image="/assets/photos/hero-pilot.jpg"
        eyebrow="PILOT · IDENTITÉ & EXPÉRIENCE"
        title="Espace pilote"
      />

      {/* Sous-onglets éditoriaux : mono ALL CAPS + underline orange */}
      <nav
        role="tablist"
        style={{
          display: 'flex',
          gap: tokens.spacing[1],
          marginBottom: tokens.spacing[6],
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px 12px',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--accent-primary)'
                  : '2px solid transparent',
                marginBottom: '-1px',
                fontFamily: tokens.fontFamily.mono,
                fontSize: 'var(--fs-caption)',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: `color ${tokens.motion.fast}, border-color ${tokens.motion.fast}`,
              }}
            >
              <Icon
                size={14}
                style={{
                  color: isActive ? 'var(--accent-primary)' : 'inherit',
                  transition: `color ${tokens.motion.fast}`,
                }}
              />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Conteneur principal sur fond surface */}
      <section
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: tokens.radius?.sm || '2px',
          padding: tokens.spacing[6],
        }}
      >
        {activeTab === 'profile' && <PilotProfile />}
        {activeTab === 'history' && <FlightHistory pilotName="F-HSTR" callsign="F-HSTR" />}
      </section>
    </div>
  );
};

export default PilotModule;
