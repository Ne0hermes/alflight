# Guide du développeur - Système de Gestion de Vol

## Architecture post-migration OpenAIP

### Vue d'ensemble
L'application a été refactorisée pour supprimer la dépendance directe à OpenAIP et utiliser une architecture basée sur des providers abstraits.

### Structure du projet

```
src/
├── core/                      # Logique métier centrale
│   ├── data/                 # Abstraction des données aéronautiques
│   │   ├── AeroDataProvider.js      # Interface abstraite
│   │   ├── index.js                 # Factory pattern
│   │   └── providers/               # Implémentations
│   │       └── NotImplementedProvider.js  # Provider temporaire
│   ├── flags.js              # Feature flags
│   └── stores/               # Stores Zustand
│       ├── openAIPStore.js  # Store adapté pour l'abstraction
│       └── ...
├── features/                  # Modules métier
│   ├── navigation/           # Module navigation
│   ├── fuel/                 # Module carburant
│   ├── weather/              # Module météo
│   └── ...
├── shared/                    # Composants partagés
│   └── components/
│       ├── PlaceholderDev.jsx  # Composants de remplacement
│       └── ...
└── services/                  # Services API
    └── weatherAPI.js         # Seul service actif
```

## Configuration

### Variables d'environnement
Créez un fichier `.env` à la racine :

```env
# OpenAIP désactivé - ne pas configurer
# VITE_OPENAIP_API_KEY=removed

# Autres services
VITE_WEATHER_API_KEY=your_key_here
```

### Feature flags
Configurez les fonctionnalités dans `src/core/flags.js` :

```javascript
export const FEATURES = {
  OPENAIP_ENABLED: false,      // OpenAIP désactivé
  VAC_ENABLED: true,           // Cartes VAC actives
  WEATHER_ENABLED: true,       // Météo active
  SHOW_DEV_PLACEHOLDERS: true  // Afficher placeholders
};
```

## Développement

### Installation
```bash
npm install
```

### Lancer en développement
```bash
npm run dev
# Accessible sur http://127.0.0.1:4000
```

### Build production
```bash
npm run build
# Les fichiers sont dans dist/
```

### Linter
```bash
npm run lint
```

## Architecture des données

### Provider abstrait
L'interface `AeroDataProvider` définit les méthodes pour accéder aux données aéronautiques :

```javascript
class AeroDataProvider {
  async getAirfields(params) { }
  async getAirspaces(params) { }
  async getNavaids(params) { }
  async getReportingPoints(icao) { }
  isAvailable() { }
  getProviderName() { }
}
```

### Provider actuel
`NotImplementedProvider` retourne des données statiques minimales pour maintenir la navigation manuelle fonctionnelle.

### Ajout d'un nouveau provider
1. Créer une classe dans `src/core/data/providers/`
2. Étendre `AeroDataProvider`
3. Implémenter toutes les méthodes
4. Modifier la factory dans `src/core/data/index.js`
5. Activer via feature flag

## Composants de développement

### PlaceholderDev
Indique les fonctionnalités en cours de développement :

```jsx
import { PlaceholderDev } from '@shared/components';

<PlaceholderDev 
  area="Données aéronautiques"
  message="Service en cours de refonte"
  variant="warning"
/>
```

### DevBadge
Badge compact pour signaler le statut :

```jsx
import { DevBadge } from '@shared/components';

<DevBadge text="BETA" compact />
```

## Conventions de code

### Imports
Utilisez les alias configurés :
- `@core` → `src/core`
- `@features` → `src/features`
- `@shared` → `src/shared`
- `@services` → `src/services`
- `@utils` → `src/utils`

### État global
Utilisez Zustand avec le middleware immer :

```javascript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useMyStore = create(
  immer((set, get) => ({
    // État et actions
  }))
);
```

### Gestion d'erreurs
Toujours gérer les erreurs dans les providers :

```javascript
try {
  const data = await provider.getAirfields();
} catch (error) {
  console.error('Erreur:', error);
  // Retourner données par défaut
}
```

## Modules principaux

### Navigation
- Carte Leaflet fonctionnelle avec OSM
- Saisie manuelle des waypoints
- Calculs de distance et cap
- Export GPX

### Carburant (Fuel)
- Calculs de consommation
- Réserves légales
- Intégration avec navigation

### Météo (Weather)
- API météo externe
- Suggestions de pistes
- TAF/METAR

### Alternates
- Sélection de déroutements
- Calculs de distance
- Scoring automatique

## Débogage

### Logs utiles
```javascript
// Dans la console navigateur
localStorage.debug = 'app:*'; // Active tous les logs
localStorage.debug = 'app:navigation'; // Logs navigation uniquement
```

### Vérifier le provider
```javascript
import { aeroDataProvider } from '@core/data';
console.log(aeroDataProvider.getStatus());
```

### État des stores
```javascript
// Dans la console
import { useOpenAIPStore } from '@core/stores/openAIPStore';
console.log(useOpenAIPStore.getState());
```

## Tests

### Structure des tests (à implémenter)
```
src/__tests__/
├── unit/           # Tests unitaires
├── integration/    # Tests d'intégration
└── e2e/           # Tests end-to-end
```

### Lancer les tests
```bash
# Pas encore configuré
# npm run test
```

## Performance

### Bundle analysis
```bash
npm run build
npx vite-bundle-visualizer
```

### Optimisations appliquées
- Code splitting par module
- Lazy loading des features
- Cache des données avec TTL
- Debounce sur les inputs

## Checklist de PR

- [ ] Code suit les conventions
- [ ] Pas de clés API hardcodées
- [ ] Feature flags configurés
- [ ] Placeholders pour features manquantes
- [ ] Build passe sans erreurs
- [ ] Lint passe sans warnings
- [ ] Documentation mise à jour

## Ressources

- [React](https://react.dev/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Leaflet](https://leafletjs.com/)
- [Vite](https://vitejs.dev/)

## Support

Pour les questions sur l'architecture post-migration, consultez :
- `README_AUDIT.md` - Audit détaillé
- `ACTION_PLAN.md` - Plan de migration
- `MIGRATION_NOTES.md` - Notes de migration

---
*Dernière mise à jour : 10/08/2025*