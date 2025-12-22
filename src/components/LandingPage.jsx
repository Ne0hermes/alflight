import React, { useState, useEffect } from 'react';
import {
  Plane, User, Settings, BookOpen,
  Map, Book, Shield
} from 'lucide-react';
import { theme, createCardStyle, createButtonStyle } from '../styles/theme';
import { PilotDashboard } from './PilotDashboard';

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
    // Vérifier les certifications
    const certifications = JSON.parse(localStorage.getItem('pilotCertifications') || '{}');
    const today = new Date();
    let hasExpired = false;
    let hasWarning = false;
    
    Object.values(certifications).forEach(items => {
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (item.expiryDate) {
            const expiryDate = new Date(item.expiryDate);
            const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry < 0) hasExpired = true;
            else if (daysUntilExpiry <= 30) hasWarning = true;
          }
        });
      }
    });
    
    // Vérifier le certificat médical
    const medicalRecords = JSON.parse(localStorage.getItem('pilotMedicalRecords') || '[]');
    const currentMedical = medicalRecords.find(record => {
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
    
    // Vérifier le profil pilote
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const hasMissingInfo = !profile.firstName || !profile.lastName || !profile.licenseNumber;
    
    return { hasExpired, hasWarning, hasMissingInfo };
  };
  
  const checkAircraftStatus = () => {
    // Vérifier la configuration de l'avion
    const aircraft = JSON.parse(localStorage.getItem('selectedAircraft') || 'null');
    const hasNoAircraft = !aircraft;
    
    // Vérifier les données de performance
    const performanceData = JSON.parse(localStorage.getItem('aircraftPerformance') || '{}');
    const hasMissingPerformance = !performanceData.takeoffDistance && !performanceData.landingDistance;
    
    return { hasNoAircraft, hasMissingPerformance };
  };
  
  const pilotStatus = checkPilotStatus();
  const aircraftStatus = checkAircraftStatus();

  const quickActions = [
    {
      id: 'pilot',
      title: 'Info Pilote',
      description: 'Gérer mon profil et mes qualifications',
      icon: User,
      color: theme.colors.primary,
      action: () => onNavigate('pilot')
    },
    {
      id: 'aircraft-config',
      title: 'Configurer mon avion',
      description: 'Assistant de configuration d\'avion',
      icon: Settings,
      color: '#06b6d4',
      action: () => onNavigate('aircraft-wizard'),
      highlight: aircraftStatus.hasNoAircraft
    },
    {
      id: 'logbook',
      title: 'Carnet de vol',
      description: 'Enregistrer et consulter mes vols',
      icon: Book,
      color: '#10b981',
      action: () => onNavigate('logbook')
    },
    {
      id: 'checklist',
      title: 'Mes checklists',
      description: 'Check-lists personnalisées',
      icon: BookOpen,
      color: theme.colors.accent,
      action: () => onNavigate('checklist')
    },
    {
      id: 'regulations',
      title: 'Références réglementaires',
      description: 'Réglementations EASA pour pilotes',
      icon: Shield,
      color: theme.colors.primary,
      action: () => onNavigate('regulations')
    },
    {
      id: 'aircraft',
      title: 'Mes Avions',
      description: 'Gérer ma flotte d\'appareils',
      icon: Plane,
      color: '#06b6d4',
      action: () => onNavigate('aircraft')
    },
    {
      id: 'vac',
      title: 'Cartes VAC',
      description: 'Importer et gérer les cartes VAC',
      icon: Map,
      color: '#8b5cf6',
      action: () => onNavigate('vac')
    }
  ];

  return (
    <div style={{
      ...styles.container,
      ...(isMobile ? { paddingTop: '56px' } : {})
    }}>
      {/* Overlay configuration profil obligatoire */}
      {!isProfileConfigured && (
        <div style={styles.profileOverlay}>
          <div style={styles.profileModal}>
            <User size={48} style={{ color: theme.colors.primary, marginBottom: '16px' }} />
            <h2 style={styles.profileModalTitle}>Configuration du profil requise</h2>
            <p style={styles.profileModalText}>
              Avant de pouvoir utiliser ALFlight, vous devez configurer votre profil pilote.
              Cette étape est nécessaire pour personnaliser l'application selon vos besoins.
            </p>
            <p style={styles.profileModalSubtext}>
              Informations requises : Nom, Prénom, Date de naissance
            </p>
            <button
              style={styles.profileModalButton}
              onClick={() => onNavigate('pilot')}
            >
              <User size={20} style={{ marginRight: '8px' }} />
              Configurer mon profil
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h1 style={styles.title}>ALFlight</h1>
            <p style={styles.subtitle}>Peritia per Praeparationem</p>
          </div>
        </div>
      </header>

      {/* Dashboard Section */}
      <PilotDashboard onNavigate={onNavigate} />

      {/* Quick Actions */}
      <section style={styles.quickActions}>
        <div style={styles.allButtonsContainer}>
          {/* Boutons d'action rapide */}
          <div style={styles.actionButtonsGrid}>
            {quickActions.map(action => {
              // Déterminer si le bouton doit avoir un indicateur
              let hasIndicator = false;
              let indicatorColor = null;

              if (action.id === 'pilot') {
                if (pilotStatus.hasExpired) {
                  hasIndicator = true;
                  indicatorColor = '#dc2626'; // Rouge
                } else if (pilotStatus.hasWarning || pilotStatus.hasMissingInfo) {
                  hasIndicator = true;
                  indicatorColor = '#f59e0b'; // Orange
                }
              } else if (action.id === 'aircraft' || action.id === 'aircraft-config') {
                if (aircraftStatus.hasNoAircraft || aircraftStatus.hasMissingPerformance) {
                  hasIndicator = true;
                  indicatorColor = '#f59e0b'; // Orange
                }
              }
              
              return (
                <button
                  key={action.id}
                  style={{
                    ...styles.actionButton,
                    position: 'relative'
                  }}
                  onClick={action.action}
                >
                  <action.icon size={20} style={{ marginRight: '8px' }} />
                  {action.title}
                  {hasIndicator && (
                    <span style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: indicatorColor,
                      boxShadow: '0 0 0 2px white'
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Boutons supplémentaires */}
          <div style={styles.additionalActions}>
          <button
            style={styles.primaryButton}
            onClick={() => onNavigate('flight-wizard')}
          >
            <Plane size={20} style={{ marginRight: '8px' }} />
            Je prépare mon vol (Assistant)
          </button>
        </div>
        </div>
      </section>


    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: theme.colors.background,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: theme.fonts.primary,
  },
  profileOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  profileModal: {
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
    border: `2px solid ${theme.colors.primary}`,
    boxShadow: '0 20px 60px rgba(139, 21, 56, 0.3)',
  },
  profileModalTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: '16px',
  },
  profileModalText: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  profileModalSubtext: {
    fontSize: '12px',
    color: theme.colors.primary,
    fontWeight: '600',
    marginBottom: '24px',
  },
  profileModalButton: {
    backgroundColor: theme.colors.primary,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '25px',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.3s ease',
  },
  header: {
    backgroundColor: 'rgba(139, 21, 56, 0.05)',
    padding: '20px',
    paddingTop: 'max(env(safe-area-inset-top), 20px)',
    borderBottom: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.sm,
    backdropFilter: 'blur(10px)',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logo: {
    color: theme.colors.primary,
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.primary,
  },
  subtitle: {
    fontSize: '14px',
    color: theme.colors.primary,
    letterSpacing: '0.2em',
    margin: '8px 0 0 0',
    fontStyle: 'italic',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  hero: {
    padding: '40px 20px',
    textAlign: 'center',
    background: `linear-gradient(135deg, ${theme.colors.primary}22, ${theme.colors.accent}11)`,
    color: theme.colors.textPrimary,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  heroTitle: {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  heroDescription: {
    fontSize: '16px',
    opacity: 0.95,
  },
  quickActions: {
    padding: '32px 16px',
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  allButtonsContainer: {
    maxWidth: '400px',
    margin: '0 auto',
    width: '100%',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  actionButtonsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    marginBottom: '20px',
  },
  actionButton: {
    ...createButtonStyle(),
    backgroundColor: 'transparent',
    border: `2px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 24px',
    fontSize: '15px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    width: '100%',
    minHeight: '56px',
  },
  footer: {
    backgroundColor: 'rgba(30, 28, 28, 0.5)',
    borderTop: `1px solid ${theme.colors.border}`,
    padding: '16px',
    marginTop: 'auto',
  },
  infoButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
  infoPanel: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: theme.colors.backgroundCard,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
  },
  infoTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px',
    color: theme.colors.textPrimary,
  },
  infoText: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    marginBottom: '16px',
  },
  legalLinks: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  },
  legalLink: {
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  copyright: {
    fontSize: '12px',
    color: theme.colors.textMuted,
    marginBottom: '8px',
  },
  disclaimer: {
    fontSize: '11px',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    lineHeight: '1.4',
  },
  additionalActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  secondaryButton: {
    ...createButtonStyle(),
    backgroundColor: 'transparent',
    border: `2px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 24px',
    fontSize: '15px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  primaryButton: {
    ...createButtonStyle(),
    backgroundColor: 'transparent',
    border: `2px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 24px',
    fontSize: '15px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    width: '100%',
    minHeight: '56px',
    borderRadius: '25px',
  },
};

// Note: Mobile styles are handled via responsive CSS in the styles object