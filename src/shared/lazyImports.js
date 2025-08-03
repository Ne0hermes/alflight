// src/shared/lazyImports.js
import React, { lazy } from 'react';

// Chargement paresseux du module Navigation
export const NavigationModule = lazy(() =>
  import('@features/navigation').catch(() => {
    console.error('Failed to load NavigationModule');
    // Composant de secours si le module ne se charge pas
    return { default: () => <div>Erreur de chargement du module Navigation</div> };
  })
);

// Chargement paresseux du module Masse et Centrage (Weight & Balance)
export const WeightBalanceModule = lazy(() =>
  import('@features/weight-balance').catch(() => {
    console.error('Failed to load WeightBalanceModule');
    return { default: () => <div>Erreur de chargement du module Masse et Centrage</div> };
  })
);

// Chargement paresseux du module Carburant
export const FuelModule = lazy(() =>
  import('@features/fuel').catch(() => {
    console.error('Failed to load FuelModule');
    return { default: () => <div>Erreur de chargement du module Carburant</div> };
  })
);

// Chargement paresseux du module Gestion des Avions
export const AircraftModule = lazy(() =>
  import('@features/aircraft').catch(() => {
    console.error('Failed to load AircraftModule');
    return { default: () => <div>Erreur de chargement du module Avions</div> };
  })
);

// Chargement paresseux du module Météo
export const WeatherModule = lazy(() =>
  import('@features/weather').catch(() => {
    console.error('Failed to load WeatherModule');
    return { default: () => <div>Erreur de chargement du module Météo</div> };
  })
);

// Chargement paresseux du module VAC
export const VACModule = lazy(() =>
  import('@features/vac').catch(() => {
    console.error('Failed to load VACModule');
    return { default: () => <div>Erreur de chargement du module VAC</div> };
  })
);
