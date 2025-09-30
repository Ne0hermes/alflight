# PLAN D'ACTION - Suppression OpenAIP

## Vue d'ensemble
Suppression complète et sécurisée d'OpenAIP avec zéro régression fonctionnelle.

## Phase 0: Préparation (IMMÉDIAT - 30min)

### 0.1 Sécurisation clé API 🔴
**Fichiers**: `.env`, `vite.config.js`, `openAIPService.js`
```bash
# Actions:
1. Créer .env avec VITE_OPENAIP_API_KEY=removed
2. Retirer clé hardcodée de vite.config.js ligne 99
3. Retirer clé hardcodée de openAIPService.js ligne 9
4. Ajouter .env au .gitignore
```
**Impact**: Aucun si .env existe
**Test**: Build doit passer

## Phase 1: Abstraction des données (Jour 1 - 4h)

### 1.1 Créer l'interface AeroDataProvider
**Nouveau fichier**: `src/core/data/AeroDataProvider.ts`
```javascript
export interface AirspaceQuery {
  country?: string;
  bounds?: [number, number, number, number];
  types?: string[];
}

export interface AirfieldQuery {
  country?: string;
  icao?: string;
  search?: string;
  nearPoint?: { lat: number; lon: number; radius: number };
}

export interface NavaidQuery {
  country?: string;
  type?: string[];
}

export interface AeroDataProvider {
  // Core methods
  getAirspaces(params: AirspaceQuery): Promise<Airspace[]>;
  getAirfields(params: AirfieldQuery): Promise<Airfield[]>;
  getNavaids(params: NavaidQuery): Promise<Navaid[]>;
  getReportingPoints(icao: string): Promise<ReportingPoint[]>;
  
  // Status
  isAvailable(): boolean;
  getProviderName(): string;
}
```

### 1.2 Créer le provider "NotImplemented"
**Nouveau fichier**: `src/core/data/providers/NotImplementedProvider.js`
```javascript
export class NotImplementedProvider {
  isAvailable() { return false; }
  getProviderName() { return "En cours de développement"; }
  
  async getAirspaces() { 
    return []; // Retour vide au lieu d'erreur pour éviter crash
  }
  
  async getAirfields() { 
    // Retourner quelques aérodromes statiques pour test
    return [
      { icao: 'LFPG', name: 'Paris CDG', lat: 49.0097, lon: 2.5479 },
      { icao: 'LFPO', name: 'Paris Orly', lat: 48.7233, lon: 2.3794 }
    ];
  }
  
  async getNavaids() { return []; }
  async getReportingPoints() { return []; }
}
```

### 1.3 Feature flags
**Nouveau fichier**: `src/core/flags.js`
```javascript
export const FEATURES = {
  OPENAIP_ENABLED: false, // Désactivé par défaut
  VAC_ENABLED: true,
  WEATHER_ENABLED: true
};
```

### 1.4 Factory pattern
**Nouveau fichier**: `src/core/data/index.js`
```javascript
import { FEATURES } from '../flags';
import { NotImplementedProvider } from './providers/NotImplementedProvider';

export const aeroDataProvider = new NotImplementedProvider();
```

**Impact**: Préparation pour migration
**Tests**: Vérifier que factory retourne le bon provider

## Phase 2: Composants Placeholder (Jour 1 - 2h)

### 2.1 Créer PlaceholderDev
**Nouveau fichier**: `src/shared/components/PlaceholderDev.jsx`
```javascript
import React from 'react';
import { AlertCircle } from 'lucide-react';

export const PlaceholderDev = ({ area, message, showIcon = true }) => {
  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#fef3c7',
      border: '1px solid #f59e0b',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      {showIcon && <AlertCircle size={20} color="#f59e0b" />}
      <div>
        <div style={{ fontWeight: 600, color: '#92400e' }}>
          {area} - En cours de développement
        </div>
        {message && (
          <div style={{ fontSize: '14px', color: '#78350f', marginTop: '4px' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};
```

### 2.2 Badge pour statut
**Nouveau fichier**: `src/shared/components/DevBadge.jsx`
```javascript
export const DevBadge = ({ compact = false }) => (
  <span style={{
    padding: compact ? '2px 6px' : '4px 8px',
    backgroundColor: '#f59e0b',
    color: 'white',
    borderRadius: '4px',
    fontSize: compact ? '10px' : '12px',
    fontWeight: 600
  }}>
    DEV
  </span>
);
```

**Tests**: Snapshot des composants

## Phase 3: Migration du store (Jour 2 - 4h)

### 3.1 Adapter openAIPStore
**Modifier**: `src/core/stores/openAIPStore.js`
```javascript
import { aeroDataProvider } from '@core/data';
import { PlaceholderDev } from '@shared/components/PlaceholderDev';

// Remplacer toutes les références openAIPService par aeroDataProvider
// Ajouter gestion du mode "non disponible"

loadAirports: async (countryCode = 'FR') => {
  if (!aeroDataProvider.isAvailable()) {
    set(state => {
      state.airports = []; 
      state.errors.airports = 'Service en cours de développement';
    });
    return;
  }
  // Code existant avec aeroDataProvider
}
```

### 3.2 Créer store de migration
**Nouveau**: `src/core/stores/migrationStore.js`
```javascript
// Store temporaire pour gérer la migration
export const useMigrationStore = create((set) => ({
  openAIPRemoved: true,
  showPlaceholders: true,
  migrationWarnings: [],
  addWarning: (warning) => set(state => ({
    migrationWarnings: [...state.migrationWarnings, warning]
  }))
}));
```

**Impact**: Store continue de fonctionner mais retourne données vides
**Tests**: Vérifier état vide ne crash pas l'app

## Phase 4: Migration des composants carte (Jour 3 - 6h)

### 4.1 NavigationMap principal
**Modifier**: `src/features/navigation/components/NavigationMap.jsx`

Remplacer les tiles OpenAIP (lignes 484-487, 636-644, 688-696, 702-710) par:
```javascript
// Retirer les URLs OpenAIP
// const openAIPLayerUrl = ... // SUPPRIMÉ
// const openAIPAirspaceUrl = ... // SUPPRIMÉ

// Ajouter placeholder pour les overlays
{FEATURES.OPENAIP_ENABLED ? (
  <TileLayer url={openAIPLayerUrl} ... />
) : (
  <PlaceholderDev 
    area="Données aéronautiques"
    message="Intégration OpenAIP en cours de refonte"
  />
)}
```

### 4.2 AirportSelector
**Modifier**: `src/features/navigation/components/AirportSelector.jsx`
```javascript
// Ajouter en haut du render
if (!aeroDataProvider.isAvailable()) {
  return (
    <PlaceholderDev 
      area="Sélection aérodromes"
      message="Utilisez la saisie manuelle ICAO"
    />
  );
}
```

### 4.3 Consolidation NavigationMap
**Actions**:
1. Supprimer tous les *_backup*.jsx
2. Supprimer versions alternatives (NavigationMapLeaflet, etc.)
3. Garder uniquement NavigationMap.jsx principal

**Impact**: UI affiche placeholders au lieu de crasher
**Tests**: Navigation manuelle doit continuer à fonctionner

## Phase 5: Suppression complète OpenAIP (Jour 4 - 4h)

### 5.1 Supprimer les services
```bash
rm src/services/openAIPService.js
rm src/services/openAIPService_backup_*.js
rm src/services/openaipAirportsClient.js
rm src/map/layers/OpenAIPAirportsLayer.js
rm server/openaip-proxy.js
```

### 5.2 Nettoyer vite.config.js
Supprimer lignes 92-102 (proxy OpenAIP)

### 5.3 Nettoyer les imports
```bash
# Remplacer tous les imports
find src -type f -name "*.jsx" -o -name "*.js" | xargs sed -i "s/import.*openAIPService.*//g"
find src -type f -name "*.jsx" -o -name "*.js" | xargs sed -i "s/from.*openAIPService.*//g"
```

### 5.4 Supprimer store si vide
Si openAIPStore n'est plus utilisé, le supprimer

**Impact**: Code OpenAIP complètement retiré
**Tests**: Build doit passer sans erreurs

## Phase 6: Tests de non-régression (Jour 5 - 4h)

### 6.1 Installer Vitest
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### 6.2 Créer tests critiques
**Nouveau**: `src/__tests__/migration.test.js`
```javascript
describe('Migration OpenAIP', () => {
  test('App se lance sans OpenAIP', () => {});
  test('Navigation manuelle fonctionne', () => {});
  test('Placeholders sont visibles', () => {});
  test('Pas de références OpenAIP', () => {});
});
```

### 6.3 Tests E2E basiques
**Nouveau**: `e2e/basic.spec.js`
```javascript
// Tests Playwright ou Cypress
- App charge
- Navigation entre modules
- Carte s'affiche
- Formulaires fonctionnent
```

**Validation**: Tous les tests passent

## Phase 7: Optimisation & CI (Jour 5 - 2h)

### 7.1 Analyse bundle
```bash
npm run build
npx vite-bundle-visualizer
```

### 7.2 Configuration CI
**Nouveau**: `.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

### 7.3 Nettoyage final
```bash
# Supprimer fichiers de test/debug
rm test-*.html
rm *-backup.*
```

## Phase 8: Documentation (Jour 6 - 2h)

### 8.1 README_DEV.md
- Architecture mise à jour
- Instructions de développement
- Configuration des flags

### 8.2 MIGRATION_NOTES.md
- Breaking changes (aucun si bien fait)
- Guide de migration pour forks
- FAQ

## Checklist finale

- [ ] Aucune référence à "openaip" dans le code (grep -r openaip src)
- [ ] Build de production fonctionne
- [ ] Tests passent (>80% couverture sur code modifié)
- [ ] Bundle size non augmenté >10%
- [ ] Placeholders visibles partout où OpenAIP était
- [ ] Navigation manuelle fonctionne
- [ ] Pas de console.error en runtime
- [ ] Documentation à jour
- [ ] .env.example mis à jour
- [ ] Secrets retirés du code

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Crash au démarrage | Faible | Critique | Tests E2E |
| Perte sélection aérodromes | Moyenne | Majeur | Saisie manuelle ICAO |
| Carte vide | Faible | Majeur | Fallback OSM |
| Calculs distance KO | Faible | Mineur | Utiliser utils existants |
| Build échoue | Faible | Bloquant | CI/CD |

## Timeline

- **Jour 0**: Phase 0-1 (Sécurisation + Abstraction)
- **Jour 1**: Phase 2-3 (Placeholders + Store)
- **Jour 2-3**: Phase 4 (Composants)
- **Jour 4**: Phase 5 (Suppression)
- **Jour 5**: Phase 6-7 (Tests + CI)
- **Jour 6**: Phase 8 (Documentation)

## Commandes utiles

```bash
# Vérifier références OpenAIP
grep -r "openaip\|openAIP\|OpenAIP\|OPENAIP" src/ --include="*.js" --include="*.jsx"

# Lancer les tests
npm run test

# Build production
npm run build

# Analyser bundle
npx vite-bundle-visualizer

# Nettoyer
find . -name "*backup*" -delete
find . -name "test-*.html" -delete
```

---
*Plan créé le 10/08/2025 - À exécuter dans l'ordre*