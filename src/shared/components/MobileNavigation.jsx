// src/shared/components/MobileNavigation.jsx
// ============================================================================
//  MobileNavigation — Refonte charte éditoriale ALFlight (Phase 3.10)
//
//  Drawer mono ALL CAPS, underline orange sur item actif, fond --bg-surface,
//  bordures via --border-*. Plus aucune trace de bordeaux #93163C ni couleurs
//  hardcodées.
// ============================================================================

import React, { useState } from 'react';
import {
  Menu, X, User, Book, Navigation, Plane, Cloud,
  CheckSquare, TrendingUp, Package, Fuel, Settings,
  Map, UserCircle, Info, Shield,
} from 'lucide-react';
import LogoutButton from '../../components/auth/LogoutButton';
import { EditorialHeading, TechLabel, AlflightLogo } from './editorial';
import { tokens } from '../styles/designSystem';

const ICON_MAP = {
  UserCircle,
  User,
  Book,
  Navigation,
  Plane,
  Cloud,
  CheckSquare,
  TrendingUp,
  Scale: Package,
  Fuel,
  Settings,
  Map,
};

export const MobileNavigation = ({ tabs, activeTab, onTabChange, isProfileConfigured = true }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Le filtrage des modules cachés est fait en amont dans MobileApp.jsx
  // (cf. HIDDEN_FROM_MENU / MENU_TABS). Ici on se contente de réorganiser :
  // placer VAC juste après checklist pour grouper les outils opérationnels.
  const checklistIndex = tabs.findIndex((tab) => tab.id === 'checklist');
  const vacTab = tabs.find((tab) => tab.id === 'vac');
  const tabsWithoutVac = tabs.filter((tab) => tab.id !== 'vac');

  const mainTabs = vacTab && checklistIndex !== -1
    ? [
        ...tabsWithoutVac.slice(0, checklistIndex + 1),
        vacTab,
        ...tabsWithoutVac.slice(checklistIndex + 1),
      ]
    : tabs;

  const handleTabSelect = (tabId) => {
    onTabChange(tabId);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Header mobile fixe */}
      <div style={styles.header}>
        {/* 🧭 Header MobileNavigation — bouton menu burger CENTRÉ. */}
        <button
          type="button"
          style={styles.menuButton}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Menu"
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Drawer overlay */}
      {isMenuOpen && (
        <div style={styles.overlay} onClick={() => setIsMenuOpen(false)}>
          <div
            style={styles.drawer}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.drawerHeader}>
              {/* Logo officiel ALFlight. Le titre textuel "ALFlight"
                  est volontairement supprimé : le logo porte déjà
                  l'identité de marque, le doubler ferait redondance. */}
              <AlflightLogo
                size={64}
                style={{ marginBottom: '12px', alignSelf: 'flex-start' }}
              />
              <span style={styles.drawerEyebrow}>MENU · NAVIGATION</span>
              <button
                type="button"
                style={styles.closeButton}
                onClick={() => setIsMenuOpen(false)}
                aria-label="Fermer le menu"
              >
                <X size={14} />
              </button>
            </div>

            <nav style={styles.nav}>
              {/* Accueil */}
              <button
                type="button"
                style={{
                  ...styles.navItem,
                  ...(activeTab === 'landing' ? styles.navItemActive : {}),
                }}
                onClick={() => handleTabSelect('landing')}
              >
                <span style={styles.navItemLabel}>Accueil</span>
              </button>

              <div style={styles.divider} aria-hidden="true" />

              {/* Modules principaux */}
              {mainTabs.map((tab) => {
                const isActive = tab.id === activeTab;
                const Icon = tab.icon ? ICON_MAP[tab.icon] : null;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    style={{
                      ...styles.navItem,
                      ...(isActive ? styles.navItemActive : {}),
                    }}
                    onClick={() => handleTabSelect(tab.id)}
                  >
                    {Icon && (
                      <Icon
                        size={14}
                        style={{
                          marginRight: tokens.spacing[3],
                          color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={styles.navItemLabel}>{tab.label}</span>
                  </button>
                );
              })}

              <div style={styles.divider} aria-hidden="true" />

              {/* À propos */}
              <button
                type="button"
                style={styles.navItem}
                onClick={() => setShowAbout(true)}
              >
                <Info size={14} style={{ marginRight: tokens.spacing[3], color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <span style={styles.navItemLabel}>À propos</span>
              </button>

              {/* Déconnexion */}
              <LogoutButton
                variant="contained"
                fullWidth
                size="medium"
                className="mobile-menu-button"
                sx={{
                  marginTop: 1,
                  color: 'var(--text-secondary)',
                }}
              />
            </nav>
          </div>
        </div>
      )}

      {/* Modal À propos — charte éditoriale */}
      {showAbout && (
        <div style={styles.aboutOverlay} onClick={() => setShowAbout(false)}>
          <div style={styles.aboutModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              style={styles.aboutCloseButton}
              onClick={() => setShowAbout(false)}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
            <EditorialHeading level={3} eyebrow="ABOUT · ALFLIGHT v1.0.0">
              À propos
            </EditorialHeading>
            <p style={styles.aboutText}>
              Application d'assistance au vol pour pilotes privés VFR.
            </p>

            <div style={styles.aboutLinks}>
              <button type="button" style={styles.aboutLink}>
                <Shield size={12} /> Mentions légales
              </button>
              <button type="button" style={styles.aboutLink}>
                <Shield size={12} /> Confidentialité
              </button>
              <button type="button" style={styles.aboutLink}>
                <Shield size={12} /> CGU
              </button>
            </div>

            <TechLabel>© 2026 ALFlight · Tous droits réservés</TechLabel>
            <p style={styles.aboutDisclaimer}>
              Outil d'aide à la décision. Le pilote reste seul responsable de la
              préparation et de la conduite du vol.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles éditoriaux — 100% variables CSS
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  // Header sticky persistant — sur toutes les pages, toutes les tailles.
  // Le bouton burger est CENTRÉ (transform translateX(-50%) sur position
  // absolute) pour servir de cible visuelle principale. Le logo ALFLIGHT
  // est positionné en absolute à gauche pour rester visible sans casser
  // le centrage du burger.
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '56px',
    backgroundColor: 'var(--app-bg-alpha-92)',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', // ← bouton burger centré
    padding: '0 16px',
    paddingTop: 'max(env(safe-area-inset-top), 0px)',
    paddingLeft: 'max(env(safe-area-inset-left), 16px)',
    paddingRight: 'max(env(safe-area-inset-right), 16px)',
    zIndex: 1000,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
  // Bouton burger central (cible principale d'interaction)
  menuButton: {
    // Demande utilisateur : fond et bordure 100% TRANSPARENTS sur le
    // bouton burger (juste l'icône Menu/X visible, pas de cadre).
    background: 'transparent',
    backgroundColor: 'transparent',
    border: 'none',
    padding: '10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius?.sm || '2px',
    transition: `color ${tokens.motion.fast}`,
    color: 'var(--text-primary)',
    minWidth: '44px',
    minHeight: '44px',
    outline: 'none',
  },

  // Drawer overlay
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--app-bg-alpha-85)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1100,
    animation: 'fadeIn 0.2s',
  },
  drawer: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '300px',
    backgroundColor: 'var(--bg-surface)',
    borderRight: '1px solid var(--border-subtle)',
    boxShadow: '2px 0 20px rgba(0, 0, 0, 0.5)',
    animation: 'slideIn 0.3s',
    overflowY: 'auto',
    paddingTop: 'env(safe-area-inset-top)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  drawerHeader: {
    padding: tokens.spacing[5],
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: tokens.spacing[2],
    position: 'relative',
  },
  drawerEyebrow: {
    fontFamily: tokens.fontFamily.mono,
    fontSize: 'var(--fs-caption)',
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
    lineHeight: 1.2,
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    padding: '6px',
    cursor: 'pointer',
    borderRadius: tokens.radius?.sm || '2px',
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    top: tokens.spacing[5],
    right: tokens.spacing[5],
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    transition: `border-color ${tokens.motion.fast}`,
    flexShrink: 0,
  },
  nav: {
    padding: tokens.spacing[3],
  },
  navItem: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: tokens.radius?.sm || '2px',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: `color ${tokens.motion.fast}, background-color ${tokens.motion.fast}, border-color ${tokens.motion.fast}`,
    marginBottom: '4px',
    textAlign: 'left',
    justifyContent: 'flex-start',
  },
  navItemActive: {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--text-primary)',
    borderColor: 'var(--accent-primary)',
  },
  navItemLabel: {
    fontFamily: tokens.fontFamily.mono,
    fontSize: 'var(--fs-caption)',
    fontWeight: 500,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-subtle)',
    margin: '8px 0',
  },

  // Modal About
  aboutOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--app-bg-alpha-85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '20px',
  },
  aboutModal: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: tokens.radius?.sm || '2px',
    padding: tokens.spacing[6],
    maxWidth: '380px',
    width: '100%',
    position: 'relative',
    border: '1px solid var(--border-regular)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  aboutCloseButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'transparent',
    border: '1px solid var(--border-regular)',
    padding: '6px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    borderRadius: tokens.radius?.sm || '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutText: {
    fontFamily: tokens.fontFamily.sans,
    fontSize: 'var(--fs-body)',
    color: 'var(--text-secondary)',
    marginTop: tokens.spacing[4],
    marginBottom: tokens.spacing[5],
    lineHeight: 1.55,
  },
  aboutLinks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: tokens.spacing[5],
  },
  aboutLink: {
    backgroundColor: 'transparent',
    border: '1px solid var(--border-regular)',
    borderRadius: tokens.radius?.sm || '2px',
    padding: '6px 10px',
    fontFamily: tokens.fontFamily.mono,
    fontSize: 'var(--fs-caption)',
    fontWeight: 500,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: `border-color ${tokens.motion.fast}`,
  },
  aboutDisclaimer: {
    fontFamily: tokens.fontFamily.sans,
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
    lineHeight: 1.5,
    marginTop: tokens.spacing[3],
  },
};

// Animations CSS (injectées une fois)
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
