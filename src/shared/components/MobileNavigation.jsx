import React, { useState } from 'react';
import {
  Menu, X, User, Book, Navigation, Plane, Cloud,
  CheckSquare, TrendingUp, Package, Fuel, Settings,
  Map, UserCircle, Home, ChevronDown, ChevronRight, Layers
} from 'lucide-react';
import { theme } from '../../styles/theme';
import AccordionButton from './AccordionButton';

const ICON_MAP = {
  UserCircle: UserCircle,
  User: User,
  Book: Book,
  Navigation: Navigation,
  Plane: Plane,
  Cloud: Cloud,
  CheckSquare: CheckSquare,
  TrendingUp: TrendingUp,
  Scale: Package,
  Fuel: Fuel,
  Settings: Settings,
  Map: Map
};

export const MobileNavigation = ({ tabs, activeTab, onTabChange }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFlightToolsOpen, setIsFlightToolsOpen] = useState(false);

  // Modules à regrouper dans "Outils de vol"
  const flightToolsIds = ['navigation', 'weather', 'weight-balance', 'fuel', 'performance', 'vac'];

  // Séparer les tabs
  const flightTools = tabs.filter(tab => flightToolsIds.includes(tab.id));
  const mainTabs = tabs.filter(tab => !flightToolsIds.includes(tab.id));
  
  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const Icon = activeTabData ? ICON_MAP[activeTabData.icon] || Navigation : Navigation;

  const handleTabSelect = (tabId) => {
    onTabChange(tabId);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <div style={styles.header}>
        <button 
          style={styles.menuButton}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        
        <div style={styles.titleSection}>
          <Icon size={20} style={{ marginRight: '8px' }} />
          <h1 style={styles.title}>{activeTabData?.label || 'ALFlight'}</h1>
        </div>
        
        <div style={styles.spacer} />
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div style={styles.overlay} onClick={() => setIsMenuOpen(false)}>
          <div 
            style={styles.drawer}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.drawerHeader}>
              <h2 style={styles.drawerTitle}>ALFlight</h2>
              <button 
                style={styles.closeButton}
                onClick={() => setIsMenuOpen(false)}
              >
                <X size={24} />
              </button>
            </div>
            
            <nav style={styles.nav}>
              {/* Home button */}
              <button
                style={{
                  ...styles.navItem,
                  ...(activeTab === 'landing' ? styles.navItemActive : {}),
                  backgroundColor: activeTab === 'landing' ? 'rgba(139, 21, 56, 0.1)' : 'transparent',
                }}
                onClick={() => handleTabSelect('landing')}
              >
                <Home size={20} style={{ marginRight: '12px' }} />
                <span>Accueil</span>
              </button>

              <div style={{ height: '1px', backgroundColor: theme.colors.border, margin: '8px 0' }} />

              {/* Modules principaux */}
              {mainTabs.map(tab => {
                const TabIcon = ICON_MAP[tab.icon] || Navigation;
                const isActive = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    style={{
                      ...styles.navItem,
                      ...(isActive ? styles.navItemActive : {})
                    }}
                    onClick={() => handleTabSelect(tab.id)}
                  >
                    <TabIcon size={20} style={{ marginRight: '12px' }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}

              <div style={{ height: '1px', backgroundColor: theme.colors.border, margin: '8px 0' }} />

              {/* Menu déroulant "Outils de vol" */}
              <AccordionButton
                isOpen={isFlightToolsOpen}
                onClick={() => setIsFlightToolsOpen(!isFlightToolsOpen)}
                icon={<Layers size={20} />}
                title="Modules de préparation"
                variant="minimal"
                style={{
                  ...styles.navItem,
                  backgroundColor: flightToolsIds.includes(activeTab) ? 'rgba(139, 21, 56, 0.1)' : 'transparent',
                  borderLeft: flightToolsIds.includes(activeTab) ? '3px solid #8b1538' : '3px solid transparent',
                  marginBottom: '4px',
                  fontSize: '15px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: theme.colors.textSecondary,
                  borderRadius: '8px'
                }}
              />

              {/* Sous-menu des outils de vol */}
              {isFlightToolsOpen && (
                <div style={{ paddingLeft: '20px', backgroundColor: 'rgba(0,0,0,0.05)' }}>
                  {flightTools.map(tab => {
                    const TabIcon = ICON_MAP[tab.icon] || Navigation;
                    const isActive = tab.id === activeTab;

                    return (
                      <button
                        key={tab.id}
                        style={{
                          ...styles.navItem,
                          ...styles.subNavItem,
                          ...(isActive ? styles.navItemActive : {})
                        }}
                        onClick={() => handleTabSelect(tab.id)}
                      >
                        <TabIcon size={18} style={{ marginRight: '10px' }} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '56px',
    backgroundColor: 'rgba(30, 28, 28, 0.95)',
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    zIndex: 1000,
    boxShadow: theme.shadows.md,
    backdropFilter: 'blur(10px)',
  },
  menuButton: {
    background: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    transition: 'all 0.2s',
    color: theme.colors.primary,
    '&:hover': {
      backgroundColor: 'rgba(139, 21, 56, 0.1)',
    },
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '16px',
    flex: 1,
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    margin: 0,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  spacer: {
    width: '40px',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1100,
    animation: 'fadeIn 0.2s',
  },
  drawer: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '280px',
    backgroundColor: theme.colors.backgroundCard,
    borderRight: `1px solid ${theme.colors.border}`,
    boxShadow: '2px 0 20px rgba(139, 21, 56, 0.3)',
    animation: 'slideIn 0.3s',
    overflowY: 'auto',
  },
  drawerHeader: {
    padding: '20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: `linear-gradient(135deg, ${theme.colors.primary}15, ${theme.colors.accent}08)`,
  },
  drawerTitle: {
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  closeButton: {
    background: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    padding: '4px',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textSecondary,
    transition: 'all 0.2s',
  },
  nav: {
    padding: '8px',
  },
  navItem: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'transparent',
    border: `1px solid transparent`,
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '15px',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '4px',
    textAlign: 'left',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  navItemActive: {
    backgroundColor: 'rgba(139, 21, 56, 0.1)',
    color: theme.colors.primary,
    fontWeight: '700',
    borderColor: theme.colors.border,
  },
  subNavItem: {
    fontSize: '14px',
    padding: '12px 14px',
    borderLeft: '2px solid transparent',
  },
};

// Add CSS animations
if (typeof document !== 'undefined' && !document.getElementById('mobile-nav-styles')) {
  const style = document.createElement('style');
  style.id = 'mobile-nav-styles';
  style.innerHTML = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}