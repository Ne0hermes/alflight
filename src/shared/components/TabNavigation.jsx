// src/shared/components/TabNavigation.jsx
import React, { memo } from 'react';
import { Navigation, Cloud, Scale, Fuel, Settings, Map, TrendingUp } from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';

const ICONS = {
  Navigation: Navigation,
  Cloud: Cloud,
  TrendingUp: TrendingUp,
  Scale: Scale,
  Fuel: Fuel,
  Settings: Settings,
  Map: Map
};

export const TabNavigation = memo(({ tabs, activeTab, onTabChange }) => {
  return (
    <nav style={sx.combine(sx.flex.row, sx.spacing.gap(2), sx.spacing.mb(4))}>
      {tabs.map(tab => {
        const Icon = ICONS[tab.icon];
        const isActive = tab.id === activeTab;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={sx.combine(
              styles.tab,
              isActive && styles.activeTab
            )}
          >
            {Icon && <Icon size={16} />}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
});

const styles = {
  tab: {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    color: '#D1D5DB'
  },
  activeTab: {
    backgroundColor: 'rgba(147, 22, 60, 0.2)',
    color: '#FFFFFF',
    fontWeight: '700'
  }
};

TabNavigation.displayName = 'TabNavigation';

export default TabNavigation;