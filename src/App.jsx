import React, { lazy, Suspense, memo, useState, useCallback, useMemo, useEffect } from 'react';
import { FlightSystemProviders } from '@core/contexts';
import { TabNavigation } from '@shared/components/TabNavigation';
import { LoadingSpinner } from '@shared/components/LoadingSpinner';
import ErrorBoundary from '@shared/components/ErrorBoundary';
import { sx } from '@shared/styles/styleSystem';
import { autoMigrateIfNeeded } from '@utils/manexMigration';
import { NotificationContainer } from '@shared/components/Notification';
import { SupabaseErrorBanner } from '@shared/components/SupabaseErrorBanner';
import { DataBackupUI } from '@components/DataBackupUI';
import dataBackupManager from '@utils/dataBackupManager';
import { useAuthStore } from '@features/account/stores/authStore';
// 🎨 Charte éditoriale ALFlight — primitives partagées
import { EditorialHeading, TechLabel } from '@shared/components/editorial';
import { tokens } from '@shared/styles/designSystem';

// Import automatique du logger Google Sheets direct
import '@services/directGoogleSheetsLogger';

const NavigationModule = lazy(() => import('@features/navigation'));
const WeightBalanceModule = lazy(() => import('@features/weight-balance'));
const FuelModule = lazy(() => import('@features/fuel'));
const AircraftModule = lazy(() => import('@features/aircraft'));
const WeatherModule = lazy(() => import('@features/weather'));
const PerformanceModule = lazy(() => import('@features/performance'));
const VACModule = lazy(() => import('@features/vac'));
const AlternatesModule = lazy(() => import('@features/alternates'));
const ChecklistModule = lazy(() => import('@features/checklist'));
const PilotModule = lazy(() => import('@features/pilot'));
const LogbookModule = lazy(() => import('@features/logbook'));
const AccountModule = lazy(() => import('@features/account/components/AccountPanel').then(module => ({ default: module.AccountPanel })));
const RegulationsModule = lazy(() => import('@features/regulations'));
const AdminPanel = lazy(() => import('@features/admin/AdminPanel'));

const TAB_CONFIG = [
  { id: 'admin', label: 'Admin', icon: 'Settings', component: AdminPanel },
  { id: 'account', label: 'Compte', icon: 'UserCircle', component: AccountModule },
  { id: 'pilot', label: 'Pilote', icon: 'User', component: PilotModule },
  { id: 'logbook', label: 'Carnet de bord', icon: 'Book', component: LogbookModule },
  { id: 'navigation', label: 'Navigation', icon: 'Navigation', component: NavigationModule },
  { id: 'alternates', label: 'Déroutements', icon: 'Plane', component: AlternatesModule },
  { id: 'weather', label: 'Météo', icon: 'Cloud', component: WeatherModule },
  { id: 'checklist', label: 'Checklists', icon: 'CheckSquare', component: ChecklistModule },
  { id: 'performance', label: 'Performances', icon: 'TrendingUp', component: PerformanceModule },
  { id: 'weight-balance', label: 'Masse et Centrage', icon: 'Scale', component: WeightBalanceModule },
  { id: 'fuel', label: 'Bilan Carburant', icon: 'Fuel', component: FuelModule },
  { id: 'aircraft', label: 'Gestion Avions', icon: 'Settings', component: AircraftModule },
  { id: 'vac', label: 'Cartes VAC', icon: 'Map', component: VACModule },
  { id: 'regulations', label: 'Réglementations', icon: 'Book', component: RegulationsModule }
];

const FlightSystemUI = memo(() => {
  const [activeTab, setActiveTab] = useState('navigation');

  // Vérifier si on doit naviguer vers VAC au démarrage
  useEffect(() => {
    const shouldNavigateToVAC = localStorage.getItem('navigateToVAC');
    if (shouldNavigateToVAC === 'true') {
      console.log('🔧 [App] Navigation automatique vers VAC détectée');
      localStorage.removeItem('navigateToVAC');
      setActiveTab('vac');

      // Afficher un message pour retourner au wizard
      const tempDraft = localStorage.getItem('flightPlanDraft_temp');
      if (tempDraft) {
        console.log('💾 [App] Brouillon temporaire détecté');
        // Créer un gestionnaire global pour restaurer le wizard
        window.restoreFlightPlanWizard = () => {
          localStorage.setItem('flightPlanDraft', tempDraft);
          localStorage.removeItem('flightPlanDraft_temp');
          setActiveTab('navigation');
        };
      }
    }
  }, []);

  useEffect(() => {
    try {
      autoMigrateIfNeeded();
    } catch (err) {
    }
    
    // Initialiser l'authentification
    useAuthStore.getState().actions.initialize();
    
    // Initialiser le gestionnaire de sauvegarde au démarrage
    const initBackupManager = async () => {
      try {
        await dataBackupManager.initPromise;
              } catch (error) {
        console.error('❌ Erreur initialisation gestionnaire de sauvegarde:', error);
      }
    };
    initBackupManager();
  }, []);
  
  const ActiveComponent = useMemo(() => {
    const tab = TAB_CONFIG.find(t => t.id === activeTab);
    return tab?.component || null;
  }, [activeTab]);
  
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);
  
  useEffect(() => {
    window.setActiveTab = handleTabChange;
    return () => {
      delete window.setActiveTab;
    };
  }, [handleTabChange]);
  
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
        padding: 'clamp(16px, 2.5vw, 24px)',
        boxSizing: 'border-box'
      }}
    >
      <div style={styles.wrapper}>
        {/* 🎨 En-tête éditorial ALFlight — eyebrow mono + titre Century Gothic */}
        <header
          style={{
            ...sx.combine(sx.flex.between, sx.spacing.mb(5)),
            alignItems: 'flex-end',
            gap: tokens.spacing[4],
            flexWrap: 'wrap',
          }}
        >
          <EditorialHeading level={3} eyebrow="ALFLIGHT · OPS COCKPIT">
            Système de Gestion de Vol
          </EditorialHeading>
          <AppVersion />
        </header>

        <DataBackupUI />

        <TabNavigation
          tabs={TAB_CONFIG}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />

        {/* Pas de wrapper <main> stylé — chaque module gère son propre
            fond/padding pour une expérience immersive edge-to-edge. */}
        <main
          style={{
            background: 'transparent',
            color: 'var(--text-primary)',
            marginTop: '16px'
          }}
        >
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner size="large" />}>
              {ActiveComponent && <ActiveComponent />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
});

// Version chip — mono ALL CAPS pour cohérence editorial
const AppVersion = memo(() => (
  <TechLabel>
    v3.0.0 · Zustand
  </TechLabel>
));

function App() {
  return (
    <FlightSystemProviders>
      <SupabaseErrorBanner />
      <FlightSystemUI />
      <NotificationContainer />
    </FlightSystemProviders>
  );
}

const styles = {
  wrapper: {
    maxWidth: '1400px',
    margin: '0 auto'
  }
};

export default App;