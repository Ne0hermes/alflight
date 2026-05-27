// src/shared/components/TabNavigation.jsx
// ============================================================================
//  TabNavigation — Refonte charte éditoriale ALFlight (Phase 3.2)
//
//  Labels mono ALL CAPS, underline orange sur l'onglet actif,
//  icônes Lucide en accent quand actives. Aucune couleur hardcodée :
//  tout consomme les variables CSS du design system.
// ============================================================================

import React, { memo } from 'react';
import {
  Navigation, Cloud, Scale, Fuel, Settings, Map, TrendingUp,
  User, UserCircle, Book, Plane, CheckSquare,
} from 'lucide-react';
import { sx } from '@shared/styles/styleSystem';
import { tokens } from '@shared/styles/designSystem';

const ICONS = {
  Navigation,
  Cloud,
  TrendingUp,
  Scale,
  Fuel,
  Settings,
  Map,
  User,
  UserCircle,
  Book,
  Plane,
  CheckSquare,
};

export const TabNavigation = memo(({ tabs, activeTab, onTabChange }) => {
  return (
    <nav
      role="tablist"
      style={{
        ...sx.combine(sx.flex.row, sx.spacing.gap(1), sx.spacing.mb(4)),
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        paddingTop: 'max(env(safe-area-inset-top), 8px)',
        paddingBottom: '0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {tabs.map((tab) => {
        const Icon = ICONS[tab.icon];
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            style={{
              ...styles.tab,
              ...(isActive ? styles.activeTab : {}),
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }
            }}
          >
            {Icon && (
              <Icon
                size={14}
                style={{
                  color: isActive ? 'var(--accent-primary)' : 'inherit',
                  transition: `color ${tokens.motion.fast}`,
                }}
              />
            )}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
});

const styles = {
  tab: {
    // Style éditorial : mono ALL CAPS, transparent, underline animé sur l'actif.
    // Toutes les couleurs proviennent des variables CSS (--app-bg / --text-* / --accent-*).
    padding: '10px 16px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 0,
    fontFamily: tokens.fontFamily.mono,
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: `color ${tokens.motion.fast}, border-color ${tokens.motion.fast}`,
    color: 'var(--text-tertiary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    borderBottom: '2px solid transparent',
    marginBottom: '-1px', // chevauche le borderBottom du <nav> pour donner l'effet underline
  },
  activeTab: {
    color: 'var(--text-primary)',
    borderBottom: '2px solid var(--accent-primary)',
    fontWeight: 600,
  },
};

TabNavigation.displayName = 'TabNavigation';

export default TabNavigation;
