// src/App.jsx
import React, { lazy, Suspense, memo, useState, useCallback, useMemo, useEffect } from 'react';
import { FlightSystemProviders } from '@core/contexts';
import { TabNavigation } from '@shared/components/TabNavigation';
import { LoadingSpinner } from '@shared/components/LoadingSpinner';
import ErrorBoundary from '@shared/components/ErrorBoundary';
import { sx } from '@shared/styles/styleSystem';
import { useOpenAIPStore } from '@core/stores/openAIPStore';
import { OpenAIPStatus } from '@shared/components/OpenAIPStatus';
import { autoMigrateIfNeeded } from '@utils/manexMigration';
import { NotificationContainer } from '@shared/components/Notification';

// Lazy loading des modules
const NavigationModule = lazy(() => import('@features/navigation'));
const WeightBalanceModule = lazy(() => import('@features/weight-balance'));
const FuelModule = lazy(() => import('@features/fuel'));
const AircraftModule = lazy(() => import('@features/aircraft'));
const WeatherModule = lazy(() => import('@features/weather'));
const PerformanceModule = lazy(() => import('@features/performance'));
const VACModule = lazy(() => import('@features/vac'));
const AlternatesModule = lazy(() => import('@features/alternates'));
const TechnicalLogModule = lazy(() => import('@features/technical-log'));
const ChecklistModule = lazy(() => import('@features/checklist'));
const PilotModule = lazy(() => import('@features/pilot'));

// Configuration des onglets
const TAB_CONFIG = [
  { id: 'pilot', label: 'Pilote', icon: 'User', component: PilotModule },
  { id: 'navigation', label: 'Navigation', icon: 'Navigation', component: NavigationModule },
  { id: 'alternates', label: 'Déroutements', icon: 'Plane', component: AlternatesModule },
  { id: 'weather', label: 'Météo', icon: 'Cloud', component: WeatherModule },
  { id: 'checklist', label: 'Checklists', icon: 'CheckSquare', component: ChecklistModule },
  { id: 'performance', label: 'Performances', icon: 'TrendingUp', component: PerformanceModule },
  { id: 'weight-balance', label: 'Masse et Centrage', icon: 'Scale', component: WeightBalanceModule },
  { id: 'fuel', label: 'Bilan Carburant', icon: 'Fuel', component: FuelModule },
  { id: 'technical-log', label: 'Log Technique', icon: 'FileText', component: TechnicalLogModule },
  { id: 'aircraft', label: 'Gestion Avions', icon: 'Settings', component: AircraftModule },
  { id: 'vac', label: 'Cartes VAC', icon: 'Map', component: VACModule }
];

const FlightSystemUI = memo(() => {
  const [activeTab, setActiveTab] = useState('navigation');
  
  // Effectuer la migration des données MANEX au montage si nécessaire
  useEffect(() => {
    try {
      autoMigrateIfNeeded();
    } catch (err) {
      console.error('Erreur lors de la migration MANEX:', err);
    }
  }, []);
  
  const ActiveComponent = useMemo(() => {
    const tab = TAB_CONFIG.find(t => t.id === activeTab);
    return tab?.component || null;
  }, [activeTab]);
  
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);
  
  // Exposer la fonction pour changer d'onglet globalement
  useEffect(() => {
    window.setActiveTab = handleTabChange;
    return () => {
      delete window.setActiveTab;
    };
  }, [handleTabChange]);
  
  return (
    <div style={sx.combine(sx.bg.gray, sx.spacing.p(5))}>
      <div style={styles.wrapper}>
        <header style={sx.combine(sx.flex.between, sx.spacing.mb(5))}>
          <h1 style={sx.combine(sx.text['3xl'], sx.text.bold, sx.text.primary)}>
            ✈️ Système de Gestion de Vol
          </h1>
          <AppVersion />
        </header>
        
        <TabNavigation
          tabs={TAB_CONFIG}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        
        <main style={sx.combine(sx.components.card.base, sx.spacing.p(6))}>
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

const AppVersion = memo(() => (
  <div style={sx.combine(sx.text.sm, sx.text.muted)}>
    v3.0.0 - Architecture Zustand
  </div>
));

function App() {
  return (
    <FlightSystemProviders>
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