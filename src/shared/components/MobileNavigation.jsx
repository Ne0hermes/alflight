import React, { useState } from 'react';
import {
  Menu, X, User, Book, Navigation, Plane, Cloud,
  CheckSquare, TrendingUp, Package, Fuel, Settings,
  Map, UserCircle, Home, ChevronDown, ChevronRight, Layers, LogOut
} from 'lucide-react';
import { theme } from '../../styles/theme';
import AccordionButton from './AccordionButton';
import LogoutButton from '../../components/auth/LogoutButton';

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
                <span>Accueil</span>
              </button>

              <div style={{ height: '1px', backgroundColor: theme.colors.border, margin: '8px 0' }} />

              {/* Modules principaux */}
              {mainTabs.map(tab => {
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
                    <span>{tab.label}</span>
                  </button>
                );
              })}

              <div style={{ height: '1px', backgroundColor: theme.colors.border, margin: '8px 0' }} />

              {/* Menu déroulant "Outils de vol" */}
              <AccordionButton
                isOpen={isFlightToolsOpen}
                onClick={() => setIsFlightToolsOpen(!isFlightToolsOpen)}
                title="Modules de préparation"
                variant="minimal"
                textAlign="left"
                className="mobile-menu-button"
                style={{
                  ...styles.navItem,
                  backgroundColor: flightToolsIds.includes(activeTab) ? 'rgba(139, 21, 56, 0.1)' : 'transparent',
                  borderLeft: flightToolsIds.includes(activeTab) ? '3px solid #8b1538' : '3px solid transparent',
                  marginBottom: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: theme.colors.textSecondary,
                  borderRadius: '6px',
                  padding: '10px 20px',
                  justifyContent: 'flex-start'
                }}
              />

              {/* Sous-menu des outils de vol */}
              {isFlightToolsOpen && (
                <div style={{ paddingLeft: '20px', backgroundColor: 'rgba(0,0,0,0.05)' }}>
                  {flightTools.map(tab => {
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
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ height: '1px', backgroundColor: theme.colors.border, margin: '8px 0' }} />

              {/* Bouton de déconnexion */}
              <div style={{ padding: '0 8px' }}>
                <LogoutButton
                  variant="contained"
                  fullWidth
                  size="medium"
                  className="mobile-menu-button"
                  sx={{
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: '500',
                    color: theme.colors.textSecondary,
                    padding: '10px 20px',
                    justifyContent: 'flex-start',
                    textAlign: 'left'
                  }}
                />
              </div>
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
    paddingTop: 'max(env(safe-area-inset-top), 16px)',
    paddingBottom: '16px',
    paddingLeft: 'max(env(safe-area-inset-left), 16px)',
    paddingRight: 'max(env(safe-area-inset-right), 16px)',
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
    borderRadius: '6px',
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
    paddingTop: 'env(safe-area-inset-top)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingBottom: 'env(safe-area-inset-bottom)',
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
    borderRadius: '6px',
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
    padding: '10px 20px',
    backgroundColor: 'transparent',
    border: `1px solid transparent`,
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '4px',
    textAlign: 'left',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    justifyContent: 'flex-start',
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