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
  { id: 'pilot', label: 'Info Pilote', icon: 'User', component: PilotModule },
  { id: 'logbook', label: 'Carnet de vol', icon: 'Book', component: LogbookModule },
  { id: 'aircraft', label: 'Mes avions', icon: 'Settings', component: AircraftModule },
  { id: 'flight-wizard', label: 'Je prépare mon vol', icon: 'Plane', component: FlightWizardModule },
  { id: 'aircraft-wizard', label: 'Configurer un avion', icon: 'Settings', component: AircraftWizardModule },
  { id: 'checklist', label: 'Mes checklists', icon: 'CheckSquare', component: ChecklistModule },
  { id: 'regulations', label: 'Références réglementaires', icon: 'Shield', component: RegulationsModule },
  { id: 'navigation', label: 'Navigation', icon: 'Navigation', component: NavigationModule },
  { id: 'weather', label: 'Météo', icon: 'Cloud', component: WeatherModule },
  { id: 'performance', label: 'Performances', icon: 'TrendingUp', component: PerformanceModule },
  { id: 'weight-balance', label: 'Masse/Centrage', icon: 'Scale', component: WeightBalanceModule },
  { id: 'fuel', label: 'Carburant', icon: 'Fuel', component: FuelModule },
  { id: 'vac', label: 'VAC', icon: 'Map', component: VACModule }
];

// 🧭 Onglets MASQUÉS du menu de navigation (mobile drawer + desktop tabnav).
// Ces modules sont des CALCULATEURS DE PRÉPARATION DE VOL, accessibles
// uniquement via le wizard "Je prépare mon vol" (étapes Step3VAC, Step4Weather,
// Step5Performance, Step5Fuel, Step6WeightBalance, etc.). Ils restent dans
// TAB_CONFIG pour la résolution programmatique du composant actif (ex. quand
// le wizard navigue vers ces tabs via setActiveTab) mais n'apparaissent plus
// dans la barre de navigation principale pour ne pas brouiller l'UX.
const HIDDEN_FROM_MENU = new Set([
  'navigation',
  'weather',
  'performance',
  'weight-balance',
  'fuel',
]);

// Liste des tabs visibles dans les menus de navigation (drawer + tabnav).
const MENU_TABS = TAB_CONFIG.filter((tab) => !HIDDEN_FROM_MENU.has(tab.id));

const MobileApp = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [isMobile, setIsMobile] = useState(false);
  const [showSplash, setShowSplash] = useState(false); // Désactivé temporairement
  const [isProfileConfigured, setIsProfileConfigured] = useState(null); // null = en cours de vérification

  // Vérifier si le profil est configuré
  const checkProfileConfiguration = () => {
    const profile = JSON.parse(localStorage.getItem('pilotProfile') || '{}');
    const hasRequiredFields = profile.firstName && profile.lastName &&
                              (profile.dateOfBirth || profile.birthDate);
    setIsProfileConfigured(hasRequiredFields);
    return hasRequiredFields;
  };

  useEffect(() => {
    // Vérifier si le profil est configuré au démarrage
    checkProfileConfiguration();

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

    // Écouter l'événement de configuration de profil terminée
    const handleProfileConfigured = () => {
      checkProfileConfiguration();
    };
    window.addEventListener('profile-configured', handleProfileConfigured);

    // Check if mobile / tablette : breakpoint 1024px pour que tablettes en
    // mode portrait (768-1024) bénéficient aussi du menu burger (la TabNav
    // horizontale est cramée par 8-12 onglets sur une tablette portrait).
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('navigate-to-home', handleNavigateHome);
      window.removeEventListener('profile-configured', handleProfileConfigured);
    };
  }, [activeTab]); // 🔧 Ajouter activeTab pour charger backup/migration quand on quitte landing

  // Handler pour navigation avec vérification profil
  const handleNavigate = (tabId) => {
    // Si le profil n'est pas configuré et qu'on essaie d'aller ailleurs que pilot
    if (!isProfileConfigured && tabId !== 'pilot' && tabId !== 'landing') {
      // Forcer la navigation vers pilot pour configurer le profil
      setActiveTab('pilot');
      return;
    }
    setActiveTab(tabId);
  };

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

  // Attendre la vérification du profil
  if (isProfileConfigured === null) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <ALFlightSplashScreen />
      </ThemeProvider>
    );
  }

  // 🔒 BLOCAGE OBLIGATOIRE : Si le profil n'est pas configuré, afficher uniquement le module Pilot
  if (!isProfileConfigured) {
    return (
      <IndexedDBChecker>
        <ThemeProvider theme={muiTheme}>
          <CssBaseline />
          <FlightSystemProviders>
            <div style={styles.app}>
              {/* Header fixe avec message */}
              <div style={styles.profileRequiredHeader}>
                <h2 style={styles.profileRequiredTitle}>Configuration requise</h2>
                <p style={styles.profileRequiredText}>
                  Veuillez configurer votre profil pilote pour accéder à ALFlight
                </p>
              </div>

              {/* Module Pilot en plein écran */}
              <main style={{
                ...styles.content,
                ...(isMobile ? styles.mobileContent : styles.desktopContent),
                marginTop: '100px'
              }}>
                <ErrorBoundary>
                  <React.Suspense fallback={
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '18px', color: '#3b82f6' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: '16px' }}>⏳</div>
                        <div>Chargement...</div>
                      </div>
                    </div>
                  }>
                    <PilotModule />
                  </React.Suspense>
                </ErrorBoundary>
              </main>

              <NotificationContainer />
            </div>
          </FlightSystemProviders>
        </ThemeProvider>
      </IndexedDBChecker>
    );
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
                onTabChange={handleNavigate}
                isProfileConfigured={isProfileConfigured}
              />
            )}
            <LandingPage onNavigate={handleNavigate} isProfileConfigured={isProfileConfigured} />
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
            tabs={MENU_TABS}
            activeTab={activeTab}
            onTabChange={handleNavigate}
            isProfileConfigured={isProfileConfigured}
          />
        ) : (
          <div className="app-navigation" style={styles.desktopNav}>
            <TabNavigation
              tabs={MENU_TABS}
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
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                minHeight: '200px',
                fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--accent-primary)',
              }}>
                Chargement du module…
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
    // 🎨 Fond noir ALFlight — référence la variable maître --app-bg (index.css).
    // NE JAMAIS coder en dur une couleur ici : pour changer la teinte de fond,
    // modifier UNIQUEMENT --app-bg dans index.css.
    backgroundColor: 'var(--app-bg)',
  },
  profileRequiredHeader: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#8b1538',
    color: '#FFFFFF',
    padding: '16px 20px',
    paddingTop: 'max(env(safe-area-inset-top), 16px)',
    zIndex: 1000,
    textAlign: 'center',
    boxShadow: '0 2px 10px rgba(139, 21, 56, 0.3)',
  },
  profileRequiredTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    marginBottom: '4px',
  },
  profileRequiredText: {
    margin: 0,
    fontSize: '14px',
    opacity: 0.9,
  },
  desktopNav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    // Surcouche sticky : version semi-opaque du fond noir maître
    backgroundColor: 'var(--app-bg-alpha-92)',
    borderBottom: '1px solid var(--border-subtle)',
    backdropFilter: 'blur(10px)',
  },
  // Fond unifié sur les conteneurs <main> de MobileApp.
  // Tout référence --app-bg (variable maître) — plus aucune couleur codée en dur.
  content: {
    position: 'relative',
    width: '100%',
    minHeight: 'calc(100vh - 60px)',
    backgroundColor: 'var(--app-bg)',
  },
  mobileContent: {
    marginTop: '56px',
    padding: '16px',
    paddingBottom: '32px',
    backgroundColor: 'var(--app-bg)',
  },
  desktopContent: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    backgroundColor: 'var(--app-bg)',
  },
};

export default MobileApp;