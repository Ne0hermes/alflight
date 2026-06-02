// src/components/LandingPage.jsx
// ============================================================================
//  LandingPage — Refonte charte éditoriale ALFlight (Phase 3.10)
//
//  C'est la VRAIE page d'accueil (montée par MobileApp avec activeTab='landing').
//  Refonte cinematic : hero ALFLIGHT en Century Gothic + tagline mono PERITIA
//  PER PRAEPARATIONEM, dashboard pilote, actions rapides cockpit (mono ALL CAPS
//  + bordure orange + indicateur orange seul, plus de rainbow SaaS).
//
//  Aucune couleur hardcodee : tout consomme les variables CSS du design system
//  (--app-bg / --bg-surface / --text-primary / --accent-primary / --border-*).
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Plane, User, Settings, BookOpen,
  Map, Book, Shield, AlertCircle,
} from 'lucide-react';
import { PilotDashboard } from './PilotDashboard';
import { EditorialHeading, TechLabel, AlflightLogo } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

export const LandingPage = ({ onNavigate, isProfileConfigured = true }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Gérer le redimensionnement de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Vérifier les éléments manquants ou expirés
  const checkPilotStatus = () => {
    const certifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
    const today = new Date();
    let hasExpired = false;
    let hasWarning = false;

    Object.values(certifications).forEach((items) => {
      if (Array.isArray(items)) {
        items.forEach((item) => {
          if (item.expiryDate) {
            const expiryDate = new Date(item.expiryDate);
            const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry < 0) hasExpired = true;
            else if (daysUntilExpiry <= 30) hasWarning = true;
          }
        });
      }
    });

    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const currentMedical = medicalRecords.find((record) => {
      const expiry = new Date(record.expiryDate);
      return expiry > today;
    });

    if (!currentMedical) {
      hasExpired = true;
    } else {
      const expiryDate = new Date(currentMedical.expiryDate);
      const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30) hasWarning = true;
    }

    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const hasMissingInfo = !profile.firstName || !profile.lastName || !profile.licenseNumber;

    return { hasExpired, hasWarning, hasMissingInfo };
  };

  const checkAircraftStatus = () => {
    const aircraft = JSON.parse(localStorage.getItem('selectedAircraft') || 'null');
    const hasNoAircraft = !aircraft;
    const performanceData = JSON.parse(localStorage.getItem('aircraftPerformance') || '{}');
    const hasMissingPerformance = !performanceData.takeoffDistance && !performanceData.landingDistance;
    return { hasNoAircraft, hasMissingPerformance };
  };

  const pilotStatus = checkPilotStatus();
  const aircraftStatus = checkAircraftStatus();

  // Actions rapides — toutes monochromes éditoriales (plus de couleurs SaaS).
  // Le seul accent visuel = orange ALFlight, et UNIQUEMENT comme indicateur d'alerte.
  // NOTE : "Configurer mon avion" et "Je prépare mon vol" sont les 2 actions
  // hero, séparées de cette grille en bas (cf. <section> dédiée).
  const quickActions = [
    { id: 'pilot',           title: 'Info pilote',              eyebrow: 'PROFIL · IDENTITÉ',       Icon: User,     action: () => onNavigate('pilot') },
    { id: 'logbook',         title: 'Carnet de vol',            eyebrow: 'OPS · HISTORIQUE',         Icon: Book,     action: () => onNavigate('logbook') },
    { id: 'checklist',       title: 'Mes checklists',           eyebrow: 'OPS · COCKPIT',            Icon: BookOpen, action: () => onNavigate('checklist') },
    { id: 'regulations',     title: 'Références réglementaires',eyebrow: 'DOCS · EASA',              Icon: Shield,   action: () => onNavigate('regulations') },
    { id: 'aircraft',        title: 'Mes avions',               eyebrow: 'FLOTTE · MES APPAREILS',   Icon: Plane,    action: () => onNavigate('aircraft') },
    { id: 'vac',             title: 'Cartes VAC',               eyebrow: 'DOCS · SIA',               Icon: Map,      action: () => onNavigate('vac') },
  ];

  return (
    <div
      style={{
        ...styles.container,
        ...(isMobile ? { paddingTop: '56px' } : {}),
      }}
    >
      {/* ─── Overlay configuration profil obligatoire ─── */}
      {!isProfileConfigured && (
        <div style={styles.profileOverlay}>
          <div style={styles.profileModal}>
            <AlertCircle size={32} style={{ color: 'var(--accent-primary)', marginBottom: tokens.spacing[4] }} />
            <EditorialHeading level={3} eyebrow="ALFLIGHT · CONFIGURATION REQUISE">
              Profil pilote à compléter
            </EditorialHeading>
            <p style={styles.profileModalText}>
              Avant d'utiliser ALFlight, configurez votre profil pilote.
              Cette étape personnalise l'application selon vos qualifications.
            </p>
            <TechLabel>Requis : Nom · Prénom · Date de naissance</TechLabel>
            <button
              type="button"
              style={styles.profileModalButton}
              onClick={() => onNavigate('pilot')}
            >
              <User size={14} />
              Configurer mon profil
            </button>
          </div>
        </div>
      )}

      {/* ─── Hero cinematic ALFlight ─── */}
      <header style={styles.hero}>
        <div style={styles.heroInner}>
          <AlflightLogo
            size={isMobile ? 120 : 150}
            style={{
              marginBottom: '24px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
          <h1 style={styles.heroLogo}>ALFLIGHT</h1>
          <span style={styles.heroTagline}>PERITIA · PER · PRAEPARATIONEM</span>
          <div style={styles.heroDivider} aria-hidden="true" />
        </div>
      </header>

      {/* ─── Dashboard pilote ─── */}
      <section style={styles.dashboardSection}>
        <PilotDashboard onNavigate={onNavigate} />
      </section>

      {/* ─── Actions rapides — grille cockpit ─── */}
      <section style={styles.quickActions}>
        <div style={styles.actionsHeader}>
          <EditorialHeading level={3} eyebrow="MISSION · ACTIONS RAPIDES">
            Démarrer
          </EditorialHeading>
        </div>

        <div style={styles.actionButtonsGrid}>
          {quickActions.map((action) => {
            // Indicateur orange uniquement si donnée critique manquante / expirée.
            let hasIndicator = false;
            if (action.id === 'pilot') {
              hasIndicator = pilotStatus.hasExpired || pilotStatus.hasWarning || pilotStatus.hasMissingInfo;
            } else if (action.id === 'aircraft') {
              hasIndicator = aircraftStatus.hasNoAircraft || aircraftStatus.hasMissingPerformance;
            }

            const Icon = action.Icon;
            return (
              <button
                key={action.id}
                type="button"
                style={styles.actionButton}
                onClick={action.action}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-regular)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <div style={styles.actionIconWrap}>
                  <Icon size={18} />
                </div>
                <div style={styles.actionTextBlock}>
                  <span style={styles.actionEyebrow}>{action.eyebrow}</span>
                  <span style={styles.actionTitle}>{action.title}</span>
                </div>
                {hasIndicator && <span style={styles.actionDot} aria-label="Action requise" />}
              </button>
            );
          })}
        </div>

        {/* ─── Actions hero : 2 grands boutons (wizard vol + wizard avion) ───
            Pattern charte ALFlight : un seul accent orange plein par écran.
            "Je prépare mon vol" = primary (orange plein) car c'est l'action
            la plus fréquente. "Configurer un avion" = secondary (outline orange)
            pour rester visuellement hiérarchisé sans dédoubler l'accent. */}
        <div style={styles.heroActionsGrid}>
          {/* Bouton primary — wizard vol (orange plein) */}
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => onNavigate('flight-wizard')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            <Plane size={16} />
            <span style={styles.primaryButtonText}>Je prépare mon vol</span>
            <span style={styles.primaryButtonEyebrow}>BRIEFING · WIZARD</span>
          </button>

          {/* Bouton secondary — wizard avion (outline orange) */}
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={() => onNavigate('aircraft-wizard')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
              e.currentTarget.style.color = 'var(--accent-hover)';
              e.currentTarget.style.borderColor = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--accent-primary)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
          >
            <Settings size={16} />
            <span style={styles.secondaryButtonText}>Configurer un avion</span>
            <span style={styles.secondaryButtonEyebrow}>WIZARD · ASSISTANT</span>
          </button>
        </div>
      </section>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles éditoriaux — 100% variables CSS, zéro hardcode
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--app-bg)',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: tokens.fontFamily.sans,
  },

  // ─── Overlay profil obligatoire ───
  profileOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--app-bg-alpha-92)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  profileModal: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-regular)',
    borderRadius: tokens.radius?.sm || '2px',
    padding: tokens.spacing[7],
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
  },
  profileModalText: {
    fontFamily: tokens.fontFamily.sans,
    fontSize: '14px',
    lineHeight: 1.55,
    color: 'var(--text-secondary)',
    marginTop: tokens.spacing[4],
    marginBottom: tokens.spacing[4],
  },
  profileModalButton: {
    marginTop: tokens.spacing[5],
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: tokens.radius?.sm || '2px',
    padding: '12px 24px',
    fontFamily: tokens.fontFamily.mono,
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    transition: `background-color ${tokens.motion.fast}`,
  },

  // ─── Hero ALFlight ───
  hero: {
    padding: '64px 24px 48px',
    paddingTop: 'max(env(safe-area-inset-top), 64px)',
    backgroundColor: 'var(--app-bg)',
    borderBottom: '1px solid var(--border-subtle)',
    textAlign: 'center',
  },
  heroInner: {
    maxWidth: '720px',
    margin: '0 auto',
  },
  heroLogo: {
    margin: 0,
    fontFamily: tokens.fontFamily.sans,
    fontSize: 'clamp(40px, 7vw, 72px)',
    fontWeight: 700,
    lineHeight: 1.0,
    letterSpacing: '0.08em',
    color: 'var(--text-primary)',
  },
  heroTagline: {
    display: 'inline-block',
    marginTop: tokens.spacing[4],
    fontFamily: tokens.fontFamily.mono,
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '0.30em',
    textTransform: 'uppercase',
    color: 'var(--accent-primary)',
  },
  heroDivider: {
    width: '240px',
    height: '2px',
    margin: '24px auto 0',
    backgroundColor: 'var(--accent-primary)',
  },

  // ─── Dashboard ───
  // ⚠️ Largeur et padding STRICTEMENT ALIGNÉS sur la grille des actions
  // rapides en dessous (.quickActions : maxWidth 720px, padding horizontal
  // 16px). Les cards du PilotDashboard démarrent à gauche du bouton
  // "Info pilote" et terminent à droite du bouton "Carnet de vol".
  // Padding vertical réduit (16px top, 8px bottom) car PilotDashboard a son
  // propre marginBottom sur ses cards.
  dashboardSection: {
    padding: '16px 16px 8px',
    backgroundColor: 'var(--app-bg)',
    maxWidth: '720px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },

  // ─── Quick actions ───
  quickActions: {
    padding: '8px 16px 48px',
    flex: 1,
    backgroundColor: 'var(--app-bg)',
    maxWidth: '720px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  actionsHeader: {
    marginBottom: tokens.spacing[5],
  },
  actionButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: tokens.spacing[3],
    marginBottom: tokens.spacing[6],
  },
  actionButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing[4],
    padding: '14px 16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-regular)',
    borderRadius: tokens.radius?.sm || '2px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: `border-color ${tokens.motion.fast}, color ${tokens.motion.fast}`,
    fontFamily: tokens.fontFamily.sans,
    minHeight: '64px',
  },
  actionIconWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    flexShrink: 0,
    color: 'var(--accent-primary)',
  },
  actionTextBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  actionEyebrow: {
    fontFamily: tokens.fontFamily.mono,
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
  },
  actionTitle: {
    fontFamily: tokens.fontFamily.sans,
    fontSize: '15px',
    fontWeight: 500,
    color: 'inherit',
    letterSpacing: '0.01em',
  },
  actionDot: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    boxShadow: '0 0 0 2px var(--bg-surface)',
  },

  // ─── Stack hero actions (2 grands boutons EMPILÉS verticalement) ─────
  // Chaque bouton occupe TOUTE la largeur du conteneur (= même largeur que
  // l'union des 2 colonnes des actions rapides en dessous, soit ~720px max).
  // Choix de l'empilement (au lieu d'un side-by-side) : ces 2 actions sont
  // les workflows principaux, on leur donne le maximum de présence visuelle.
  heroActionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing[3],
    marginTop: tokens.spacing[2],
  },

  // ─── Bouton primary — wizard vol (orange plein, accent unique) ───
  primaryButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    padding: '20px 24px',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    borderRadius: tokens.radius?.sm || '2px',
    cursor: 'pointer',
    fontFamily: tokens.fontFamily.sans,
    fontSize: '18px',
    fontWeight: 600,
    transition: `background-color ${tokens.motion.fast}`,
  },
  primaryButtonText: {
    fontFamily: tokens.fontFamily.sans,
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  primaryButtonEyebrow: {
    fontFamily: tokens.fontFamily.mono,
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    opacity: 0.85,
  },

  // ─── Bouton secondary — wizard avion (outline orange, transparent) ───
  // Même format que le primary mais en outline pour respecter la règle
  // "un seul accent plein par écran" de la charte ALFlight.
  secondaryButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    padding: '20px 24px',
    backgroundColor: 'transparent',
    color: 'var(--accent-primary)',
    border: '1px solid var(--accent-primary)',
    borderRadius: tokens.radius?.sm || '2px',
    cursor: 'pointer',
    fontFamily: tokens.fontFamily.sans,
    fontSize: '18px',
    fontWeight: 600,
    transition: `background-color ${tokens.motion.fast}, color ${tokens.motion.fast}, border-color ${tokens.motion.fast}`,
  },
  secondaryButtonText: {
    fontFamily: tokens.fontFamily.sans,
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  secondaryButtonEyebrow: {
    fontFamily: tokens.fontFamily.mono,
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    opacity: 0.75,
  },
};
