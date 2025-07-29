// src/App.jsx
import React, { lazy, Suspense, memo, useState, useCallback, useMemo } from 'react';
import { FlightSystemProviders } from '@core/contexts';
import { TabNavigation } from '@shared/components/TabNavigation';
import { LoadingSpinner } from '@shared/components/LoadingSpinner';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { sx } from '@shared/styles/styleSystem';

// Lazy loading des modules pour optimiser le bundle initial
const NavigationModule = lazy(() => import('@features/navigation/NavigationModule'));
const WeightBalanceModule = lazy(() => import('@features/weight-balance/WeightBalanceModule'));
const FuelModule = lazy(() => import('@features/fuel/FuelModule'));
const AircraftModule = lazy(() => import('@features/aircraft/AircraftModule'));
const WeatherModule = lazy(() => import('@features/weather/WeatherModule'));
const VACModule = lazy(() => import('@features/vac/VACModule'));

// Configuration des onglets
const TAB_CONFIG = [
  { id: 'navigation', label: 'Navigation', icon: 'Navigation', component: NavigationModule },
  { id: 'weather', label: 'Météo', icon: 'Cloud', component: WeatherModule },
  { id: 'weight-balance', label: 'Masse et Centrage', icon: 'Scale', component: WeightBalanceModule },
  { id: 'fuel', label: 'Bilan Carburant', icon: 'Fuel', component: FuelModule },
  { id: 'aircraft', label: 'Gestion Avions', icon: 'Settings', component: AircraftModule },
  { id: 'vac', label: 'Cartes VAC', icon: 'Map', component: VACModule }
];

// Composant principal optimisé
const FlightSystemUI = memo(() => {
  const [activeTab, setActiveTab] = useState('navigation');
  
  // Mémorisation du composant actif
  const ActiveComponent = useMemo(() => {
    const tab = TAB_CONFIG.find(t => t.id === activeTab);
    return tab?.component || null;
  }, [activeTab]);
  
  // Handler mémorisé pour le changement d'onglet
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);
  
  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.title}>
            ✈️ Système de Gestion de Vol
          </h1>
          <AppVersion />
        </header>
        
        {/* Navigation par onglets */}
        <TabNavigation
          tabs={TAB_CONFIG}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        
        {/* Contenu du module actif */}
        <main style={styles.content}>
          <ErrorBoundary fallback={<ErrorFallback />}>
            <Suspense fallback={<ModuleLoader />}>
              {ActiveComponent && <ActiveComponent />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
});

// Version de l'app mémorisée
const AppVersion = memo(() => (
  <div style={styles.version}>
    v2.0.0 - Optimisé
  </div>
));

// Composant de chargement des modules
const ModuleLoader = memo(() => (
  <div style={styles.loader}>
    <LoadingSpinner size="large" />
    <p style={styles.loaderText}>Chargement du module...</p>
  </div>
));

// Composant d'erreur
const ErrorFallback = memo(() => (
  <div style={styles.error}>
    <h2 style={styles.errorTitle}>⚠️ Une erreur est survenue</h2>
    <p style={styles.errorText}>
      Impossible de charger le module. Veuillez rafraîchir la page.
    </p>
    <button 
      onClick={() => window.location.reload()} 
      style={sx.combine(sx.components.button.base, sx.components.button.primary)}
    >
      Rafraîchir
    </button>
  </div>
));

// Application principale avec providers
function App() {
  return (
    <FlightSystemProviders>
      <FlightSystemUI />
    </FlightSystemProviders>
  );
}

// Styles statiques (pas de recréation à chaque render)
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: sx.theme.colors.gray[50],
    padding: sx.theme.spacing[5]
  },
  wrapper: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    ...sx.flex.between,
    marginBottom: sx.theme.spacing[5]
  },
  title: {
    fontSize: sx.theme.fontSize['3xl'],
    fontWeight: sx.theme.fontWeight.bold,
    color: sx.theme.colors.gray[900],
    margin: 0
  },
  version: {
    fontSize: sx.theme.fontSize.sm,
    color: sx.theme.colors.gray[500]
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: sx.theme.borderRadius.lg,
    padding: sx.theme.spacing[6],
    boxShadow: sx.theme.shadow.base
  },
  loader: {
    ...sx.flex.col,
    ...sx.flex.center,
    padding: sx.theme.spacing[10]
  },
  loaderText: {
    marginTop: sx.theme.spacing[4],
    color: sx.theme.colors.gray[600],
    fontSize: sx.theme.fontSize.sm
  },
  error: {
    ...sx.flex.col,
    ...sx.flex.center,
    padding: sx.theme.spacing[10],
    textAlign: 'center'
  },
  errorTitle: {
    fontSize: sx.theme.fontSize.xl,
    color: sx.theme.colors.danger[700],
    marginBottom: sx.theme.spacing[2]
  },
  errorText: {
    color: sx.theme.colors.gray[600],
    marginBottom: sx.theme.spacing[4]
  }
};

// Export avec displayName pour le debug
App.displayName = 'App';
FlightSystemUI.displayName = 'FlightSystemUI';
AppVersion.displayName = 'AppVersion';
ModuleLoader.displayName = 'ModuleLoader';
ErrorFallback.displayName = 'ErrorFallback';

export default App;