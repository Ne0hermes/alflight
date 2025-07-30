// src/shared/lazyImports.js
import { lazy } from 'react';

// Lazy loading des modules avec gestion d'erreur
export const NavigationModule = lazy(() => 
  import('@features/navigation').catch(() => {
    console.error('Failed to load NavigationModule');
    return { default: () => <div>Erreur de chargement du module Navigation</div> };
  })
);

export const WeightBalanceModule = lazy(() => 
  import('@features/weight-balance').catch(() => {
    console.error('Failed to load WeightBalanceModule');
    return { default: () => <div>Erreur de chargement du module Masse et Centrage</div> };
  })
);

export const FuelModule = lazy(() => 
  import('@features/fuel').catch(() => {
    console.error('Failed to load FuelModule');
    return { default: () => <div>Erreur de chargement du module Carburant</div> };
  })
);

export const AircraftModule = lazy(() => 
  import('@features/aircraft').catch(() => {
    console.error('Failed to load AircraftModule');
    return { default: () => <div>Erreur de chargement du module Avions</div> };
  })
);

export const WeatherModule = lazy(() => 
  import('@features/weather').catch(() => {
    console.error('Failed to load WeatherModule');
    return { default: () => <div>Erreur de chargement du module Météo</div> };
  })
);

export const VACModule = lazy(() => 
  import('@features/vac').catch(() => {
    console.error('Failed to load VACModule');
    return { default: () => <div>Erreur de chargement du module VAC</div> };
  })
);