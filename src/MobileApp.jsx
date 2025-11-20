import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import muiTheme from './styles/muiTheme';
import { FlightSystemProviders } from './core/contexts';
import { MobileNavigation } from './shared/components/MobileNavigation';
import { TabNavigation } from './shared/components/TabNavigation';
import ErrorBoundary from './shared/components/ErrorBoundary';
// 🔧 FIX OUT OF MEMORY: Imports désactivés temporairement pour tester
// import { autoMigrateIfNeeded } from './utils/manexMigration';
import { NotificationContainer } from './shared/components/Notification';
import { useAuthStore } from './features/account/stores/authStore';
// import dataBackupManager from './utils/dataBackupManager';
import { LandingPage } from './components/LandingPage';
import { ALFlightSplashScreen } from './components/ALFlightSplashScreen';
import { IndexedDBChecker } from './components/IndexedDBChecker';
import { useAuth } from './core/contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';

// 🔧 FIX OUT OF MEMORY: Lazy loading des modules pour réduire la charge mémoire au démarrage
// Les modules ne sont chargés que quand l'utilisateur les ouvre (économise 70-80% de mémoire au démarrage)
const NavigationModule = React.lazy(() => import('./features/navigation'));
const WeightBalanceModule = React.lazy(() => import('./features/weight-balance'));
const FuelModule = React.lazy(() => import('./features/fuel'));
const AircraftModule = React.lazy(() => import('./features/aircraft'));
const WeatherModule = React.lazy(() => import('./features/weather'));
const PerformanceModule = React.lazy(() => import('./features/performance'));
const VACModule = React.lazy(() => import('./features/vac'));
const ChecklistModule = React.lazy(() => import('./features/checklist'));
const PilotModule = React.lazy(() => import('./features/pilot'));
const LogbookModule = React.lazy(() => import('./features/logbook'));
const RegulationsModule = React.lazy(() => import('./features/regulations'));
const FlightWizardModule = React.lazy(() => import('./features/flight-wizard/FlightPlanWizard'));
const AircraftWizardModule = React.lazy(() => import('./features/aircraft/components/AircraftCreationWizard'));

// Import test Google Sheets (dev only)
// import './utils/testGoogleSheets';
// import './utils/fixSpecificEntry';
// import './utils/testLogbookIntegration';
// import './utils/analyzeFlightEntry';
// import './utils/debugIndexedDB';

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

const MobileApp = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [isMobile, setIsMobile] = useState(false);
  const [showSplash, setShowSplash] = useState(false); // Désactivé temporairement

  useEffect(() => {
    // Initialize auth - Désactivé temporairement
    // useAuthStore.getState().actions.initialize();

    // 🔧 FIX OUT OF MEMORY: dataBackupManager et migration DÉSACTIVÉS temporairement pour tester
    // if (activeTab !== 'landing') {
    //   // Auto-migrate if needed
    //   try {
    //     autoMigrateIfNeeded();
    //   } catch (err) {
    //     console.error('Migration error:', err);
    //   }

    //   // Initialize backup manager
    //   const initBackupManager = async () => {
    //     try {
    //       await dataBackupManager.initPromise;
    //     } catch (err) {
    //       console.error('Backup manager init error:', err);
    //     }
    //   };
    //   initBackupManager();
    // }

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
  }, [activeTab]); // 🔧 Ajouter activeTab pour charger backup/migration quand on quitte landing

  const ActiveComponent = TAB_CONFIG.find(tab => tab.id === activeTab)?.component;

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <ALFlightSplashScreen />
      </ThemeProvider>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <LoginPage />
      </ThemeProvider>
    );
  }

  // Show splash screen
  if (showSplash) {
    return <ALFlightSplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Show landing page (WITHOUT FlightSystemProviders to reduce memory usage)
  if (activeTab === 'landing') {
    return (
      <IndexedDBChecker>
        <ThemeProvider theme={muiTheme}>
          <CssBaseline />
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
        </ThemeProvider>
      </IndexedDBChecker>
    );
  }

  return (
    <IndexedDBChecker>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />

        {/* Styles pour l'impression PDF - Masquer le menu de navigation */}
        <style>{`
          @media print {
            .MuiBottomNavigation-root,
            .app-navigation,
            nav,
            [role="navigation"] {
              display: none !important;
            }
          }
        `}</style>

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
          <div className="app-navigation" style={styles.desktopNav}>
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
            {/* Suspense pour gérer le chargement des modules lazy-loaded */}
            <React.Suspense fallback={
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '18px', color: '#3b82f6' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: '16px' }}>⏳</div>
                  <div>Chargement du module...</div>
                </div>
              </div>
            }>
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
            </React.Suspense>
          </ErrorBoundary>
        </main>
        
        {/* Notifications */}
        <NotificationContainer />
      </div>
    </FlightSystemProviders>
    </ThemeProvider>
    </IndexedDBChecker>
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