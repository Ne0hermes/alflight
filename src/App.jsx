// Ajoutez ceci au TOUT DÉBUT de votre App.jsx, avant tous les imports

// Override React.createElement pour capturer l'objet problématique
const originalCreateElement = window.React ? window.React.createElement : null;
if (originalCreateElement) {
  window.React.createElement = function(type, props, ...children) {
    // Vérifier chaque enfant
    children.forEach((child, index) => {
      if (child && typeof child === 'object' && !React.isValidElement(child) && !Array.isArray(child)) {
        // Vérifier si c'est notre objet problématique
        const keys = Object.keys(child);
        if (keys.includes('alternates') && keys.includes('hasAlternates') && keys.includes('addAlternate')) {
          console.error('🚨🚨🚨 OBJET PROBLÉMATIQUE TROUVÉ 🚨🚨🚨');
          console.error('Type:', type);
          console.error('Props:', props);
          console.error('Child index:', index);
          console.error('Objet:', child);
          console.error('Clés:', keys);
          console.error('Stack trace:');
          console.trace();
          
          // Remplacer par un message d'erreur
          children[index] = `[ERREUR: Objet avec clés ${keys.join(', ')}]`;
        }
      }
    });
    
    return originalCreateElement.apply(this, [type, props, ...children]);
  };
}

// Ajouter aussi un listener d'erreur global
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('Objects are not valid as a React child')) {
    console.error('🎯 Erreur React Child capturée !');
    
    // Essayer d'extraire l'objet de l'erreur
    const match = event.error.message.match(/found: object with keys \{([^}]+)\}/);
    if (match) {
      console.error('Clés trouvées:', match[1]);
      
      // Si c'est notre objet problématique
      if (match[1].includes('alternates') && match[1].includes('addAlternate')) {
        console.error('💡 C\'est l\'objet du store Alternates qui est rendu directement !');
        console.error('Recherchez où useAlternatesStore() est utilisé dans le JSX');
      }
    }
  }
}, true);

// src/App.jsx
import React, { lazy, Suspense, memo, useState, useCallback, useMemo, useEffect } from 'react';
import { FlightSystemProviders } from '@core/contexts';
import { TabNavigation } from '@shared/components/TabNavigation';
import { LoadingSpinner } from '@shared/components/LoadingSpinner';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { sx } from '@shared/styles/styleSystem';
import { useOpenAIPStore } from '@core/stores/openAIPStore';
import { OpenAIPStatus } from '@shared/components/OpenAIPStatus';

// Lazy loading des modules
const NavigationModule = lazy(() => import('@features/navigation'));
const WeightBalanceModule = lazy(() => import('@features/weight-balance'));
const FuelModule = lazy(() => import('@features/fuel'));
const AircraftModule = lazy(() => import('@features/aircraft'));
const WeatherModule = lazy(() => import('@features/weather'));
const PerformanceModule = lazy(() => import('@features/performance'));
const VACModule = lazy(() => import('@features/vac'));
const AlternatesModule = lazy(() => import('@features/alternates'));

// Configuration des onglets
const TAB_CONFIG = [
  { id: 'navigation', label: 'Navigation', icon: 'Navigation', component: NavigationModule },
  { id: 'alternates', label: 'Déroutements', icon: 'Plane', component: AlternatesModule },
  { id: 'weather', label: 'Météo', icon: 'Cloud', component: WeatherModule },
  { id: 'performance', label: 'Performances', icon: 'TrendingUp', component: PerformanceModule },
  { id: 'weight-balance', label: 'Masse et Centrage', icon: 'Scale', component: WeightBalanceModule },
  { id: 'fuel', label: 'Bilan Carburant', icon: 'Fuel', component: FuelModule },
  { id: 'aircraft', label: 'Gestion Avions', icon: 'Settings', component: AircraftModule },
  { id: 'vac', label: 'Cartes VAC', icon: 'Map', component: VACModule }
];

const FlightSystemUI = memo(() => {
  const [activeTab, setActiveTab] = useState('navigation');
  
  const ActiveComponent = useMemo(() => {
    const tab = TAB_CONFIG.find(t => t.id === activeTab);
    return tab?.component || null;
  }, [activeTab]);
  
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);
  
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