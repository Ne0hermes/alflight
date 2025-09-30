import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import muiTheme from './styles/muiTheme';
import { FlightSystemProviders } from './core/contexts';
import { MobileNavigation } from './shared/components/MobileNavigation';
import { TabNavigation } from './shared/components/TabNavigation';
import ErrorBoundary from './shared/components/ErrorBoundary';
import { autoMigrateIfNeeded } from './utils/manexMigration';
import { NotificationContainer } from './shared/components/Notification';
import { useAuthStore } from './features/account/stores/authStore';
import dataBackupManager from './utils/dataBackupManager';
import { LandingPage } from './components/LandingPage';
import { ALFlightSplashScreen } from './components/ALFlightSplashScreen';

// Import modules directly
import NavigationModule from './features/navigation';
import WeightBalanceModule from './features/weight-balance';
import FuelModule from './features/fuel';
import AircraftModule from './features/aircraft';
import WeatherModule from './features/weather';
import PerformanceModule from './features/performance';
import VACModule from './features/vac';
import ChecklistModule from './features/checklist';
import PilotModule from './features/pilot';
import LogbookModule from './features/logbook';
import RegulationsModule from './features/regulations';
import FlightPlanWizard from './features/flight-wizard/FlightPlanWizard';
import AircraftCreationWizard from './features/aircraft/components/AircraftCreationWizard';

// Import test Google Sheets (dev only)
import './utils/testGoogleSheets';
import './utils/fixSpecificEntry';
import './utils/testLogbookIntegration';
import './utils/analyzeFlightEntry';

// Wrap them in lazy loading
const FlightWizardModule = FlightPlanWizard;
const AircraftWizardModule = AircraftCreationWizard;

const TAB_CONFIG = [
  { id: 'flight-wizard', label: 'Je prépare mon vol', icon: 'Plane', component: FlightWizardModule },
  { id: 'aircraft-wizard', label: 'Configurer un avion', icon: 'Settings', component: AircraftWizardModule },
  { id: 'pilot', label: 'Info Pilote', icon: 'User', component: PilotModule },
  { id: 'navigation', label: 'Navigation', icon: 'Navigation', component: NavigationModule },
  { id: 'weather', label: 'Météo', icon: 'Cloud', component: WeatherModule },
  { id: 'checklist', label: 'Mes checklists', icon: 'CheckSquare', component: ChecklistModule },
  { id: 'performance', label: 'Performances', icon: 'TrendingUp', component: PerformanceModule },
  { id: 'weight-balance', label: 'Masse/Centrage', icon: 'Scale', component: WeightBalanceModule },
  { id: 'fuel', label: 'Carburant', icon: 'Fuel', component: FuelModule },
  { id: 'aircraft', label: 'Avions', icon: 'Settings', component: AircraftModule },
  { id: 'vac', label: 'VAC', icon: 'Map', component: VACModule },
  { id: 'logbook', label: 'Carnet de vol', icon: 'Book', component: LogbookModule },
  { id: 'regulations', label: 'Références réglementaires', icon: 'Shield', component: RegulationsModule }
];

export const MobileApp = () => {
  const [activeTab, setActiveTab] = useState('landing');
  const [isMobile, setIsMobile] = useState(false);
  const [showSplash, setShowSplash] = useState(false); // Désactivé temporairement

  useEffect(() => {
    // Initialize auth - Désactivé temporairement
    // useAuthStore.getState().actions.initialize();

    // Auto-migrate if needed
    try {
      autoMigrateIfNeeded();
    } catch (err) {
      console.error('Migration error:', err);
    }

    // Initialize backup manager
    const initBackupManager = async () => {
      try {
        await dataBackupManager.initPromise;
      } catch (err) {
        console.error('Backup manager init error:', err);
      }
    };
    initBackupManager();

    // Écouter l'événement de navigation vers l'accueil
    const handleNavigateHome = () => {
      setActiveTab('landing');
    };
    window.addEventListener('navigate-to-home', handleNavigateHome);

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('navigate-to-home', handleNavigateHome);
    };
  }, []);

  const ActiveComponent = TAB_CONFIG.find(tab => tab.id === activeTab)?.component;

  // Show splash screen
  if (showSplash) {
    return <ALFlightSplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Show landing page
  if (activeTab === 'landing') {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <FlightSystemProviders>
          <div style={styles.app}>
            {/* Afficher le menu burger aussi sur la page d'accueil */}
            {isMobile && (
              <MobileNavigation
                tabs={TAB_CONFIG}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}
            <LandingPage onNavigate={setActiveTab} />
            <NotificationContainer />
          </div>
        </FlightSystemProviders>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <FlightSystemProviders>
        <div style={styles.app}>
        {/* Navigation */}
        {isMobile ? (
          <MobileNavigation 
            tabs={TAB_CONFIG}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        ) : (
          <div style={styles.desktopNav}>
            <TabNavigation 
              tabs={TAB_CONFIG}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>
        )}
        
        {/* Content */}
        <main style={{
          ...styles.content,
          ...(isMobile ? styles.mobileContent : styles.desktopContent)
        }}>
          <ErrorBoundary>
            {ActiveComponent && (
              activeTab === 'aircraft-wizard' ? (
                <ActiveComponent
                  onComplete={() => setActiveTab('landing')}
                  onCancel={() => setActiveTab('landing')}
                />
              ) : (
                <ActiveComponent />
              )
            )}
          </ErrorBoundary>
        </main>
        
        {/* Notifications */}
        <NotificationContainer />
      </div>
    </FlightSystemProviders>
    </ThemeProvider>
  );
};

const styles = {
  app: {
    position: 'relative',
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
  },
  desktopNav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottom: '1px solid rgba(209, 213, 219, 0.3)',
    backdropFilter: 'blur(10px)',
  },
  content: {
    position: 'relative',
    width: '100%',
    minHeight: 'calc(100vh - 60px)',
    backgroundColor: '#FFFFFF',
  },
  mobileContent: {
    marginTop: '56px',
    padding: '16px',
    paddingBottom: '32px',
    backgroundColor: '#FFFFFF',
  },
  desktopContent: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: '#FFFFFF',
  },
};

export default MobileApp;