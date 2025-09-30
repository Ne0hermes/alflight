# AUDIT COMPLET - Système de Gestion de Vol

## 1. Vue d'ensemble

### Stack technique
- **Frontend**: React 18.2 + Vite 7.0.6
- **État**: Zustand 4.5.7 avec middleware immer
- **Cartographie**: Leaflet 1.9.4 + React-Leaflet 4.2.1
- **PDF**: pdfjs-dist 3.11.174
- **PWA**: vite-plugin-pwa
- **Langages**: JavaScript (pas TypeScript)
- **Tests**: Aucun framework de test configuré ⚠️

### Structure du projet
```
alflight/
├── src/
│   ├── core/          # Contextes et stores Zustand
│   ├── features/      # Modules métier (navigation, fuel, weather, etc.)
│   ├── services/      # Services API (OpenAIP, VAC, Weather)
│   ├── shared/        # Composants partagés et hooks
│   ├── utils/         # Utilitaires et conversions
│   └── data/          # Données statiques
├── server/            # Serveurs proxy (OpenAIP, VAC)
└── docs/              # Documentation
```

## 2. Intégration OpenAIP - État actuel

### 2.1 Points d'entrée principaux

#### Store principal
- **`src/core/stores/openAIPStore.js`** (320 lignes)
  - Gestion complète des données OpenAIP
  - Cache avec TTL de 10 minutes
  - Validation croisée avec données VAC
  - Actions: loadAirports, loadAirspaces, loadNavaids, loadReportingPoints
  - Sélecteurs optimisés

#### Service API
- **`src/services/openAIPService.js`** (estimé ~800 lignes)
  - Connexion API avec fallback proxy
  - Clé API hardcodée: `2717b9196e8100ee2456e09b82b5b08e` ⚠️
  - Cache local avec Map()
  - Retry avec backoff exponentiel
  - Transformation des données

#### Configuration Vite
- **`vite.config.js`** lignes 92-102
  - Proxy `/api/openaip` → `https://api.core.openaip.net`
  - Injection automatique de la clé API

### 2.2 Composants impactés (52 fichiers)

#### Navigation (22 fichiers)
- `NavigationModule.jsx` - Import et utilisation du store
- `NavigationMap.jsx` - Tiles OpenAIP (lignes 434-707)
- `NavigationMapLeaflet.jsx` - Couches cartographiques
- `NavigationMapIntegrated.jsx` + 2 backups
- `NavigationMapReact.jsx` + 2 backups
- `AirportSelector.jsx` - Sélection aérodromes OpenAIP
- `SimpleAirportSelector.jsx` - Version simplifiée
- `AirportsLayer.jsx` - Couche dédiée
- `AirspaceAnalyzer.jsx` - Analyse espaces aériens
- `RunwayAnalyzer.jsx` - Analyse pistes
- `WaypointCardWithRunways.jsx` - Affichage infos
- `ReportingPointsSelector.jsx` - Points VFR
- `MapFiltersPanel.jsx` - Filtres couches
- `MapConnectionTest.jsx` & V2 - Tests connexion
- `NavigationMapWithLayers.jsx`
- `NavigationMapFixed.jsx`

#### Weather (3 fichiers)
- `WeatherModule.jsx` - Intégration données aérodromes
- `RunwaySuggestion.jsx` - Suggestions basées sur OpenAIP
- `RunwaySuggestionEnhanced.jsx` - Version améliorée

#### Alternates (1 fichier)
- `useAlternateSelection.js` - Sélection déroutements

#### Composants UI (3 fichiers)
- `OpenAIPConfig.jsx` - Configuration utilisateur
- `OpenAIPStatus.jsx` - Indicateur de statut
- `DataSourceBadge.jsx` - Badge source données

#### Services additionnels (3 fichiers)
- `openaipAirportsClient.js` - Client spécialisé
- `openAIPService_backup_*.js` - Backup service
- `map/layers/OpenAIPAirportsLayer.js` - Layer Leaflet

### 2.3 Données extraites d'OpenAIP

1. **Aérodromes** (`airports`)
   - ICAO, nom, ville, coordonnées
   - Élévation, type, fréquences
   - Pistes (orientation, longueur, surface)
   - Services disponibles

2. **Espaces aériens** (`airspaces`)
   - Type (CTR, TMA, D, P, R, etc.)
   - Altitudes plancher/plafond
   - Géométrie (polygones)
   - Activation

3. **Balises de navigation** (`navaids`)
   - Type (VOR, NDB, DME, etc.)
   - Fréquence, identifiant
   - Coordonnées, portée

4. **Points de report VFR** (`reportingPoints`)
   - Code, nom, type
   - Coordonnées
   - Obligatoire/optionnel
   - Association aérodrome

## 3. Problèmes identifiés

### 3.1 Sécurité 🔴
- **Clé API hardcodée** dans le code source
- Clé visible dans vite.config.js
- Pas de rotation de secrets

### 3.2 Architecture 🟠
- **Couplage fort** avec OpenAIP dans 52 fichiers
- Pas d'abstraction des données aéronautiques
- Logique métier mélangée avec l'accès données
- Duplication de code (multiples versions NavigationMap)

### 3.3 Performance 🟡
- Cache basique avec Map() (pas de persistance)
- Chargement systématique de toutes les données FR
- Pas de pagination sur les requêtes API
- Bundle size potentiellement impacté

### 3.4 Fiabilité 🟠
- Dépendance critique sans fallback métier
- Pas de mode dégradé si OpenAIP indisponible
- Validation croisée VAC incomplète

### 3.5 Tests 🔴
- **Aucun test automatisé**
- Pas de tests unitaires
- Pas de tests d'intégration
- Pas de tests e2e

### 3.6 DX (Developer Experience) 🟡
- Configuration éparpillée
- Pas de documentation API interne
- Multiples fichiers de debug/test non organisés

## 4. Dépendances à risque

### Directes
- Services OpenAIP (tiles + API)
- Proxy serveur pour contourner CORS
- Variables d'environnement Vite

### Indirectes
- Leaflet pour affichage tiles
- Zustand pour état global
- Cache navigateur pour performances

## 5. Quick Wins identifiés

1. **Extraction clé API** → .env sécurisé
2. **Abstraction données** → Interface AeroDataProvider
3. **Suppression backups** → Nettoyer *_backup*.jsx
4. **Consolidation NavigationMap** → Une seule version
5. **Tests basiques** → Au moins smoke tests

## 6. Risques de régression

### Critiques
- Perte de la carte de navigation
- Impossibilité de sélectionner aérodromes
- Crash au chargement des modules

### Majeurs
- Perte des espaces aériens
- Perte des points de report VFR
- Calculs de distance incorrects

### Mineurs
- Badges de statut incorrects
- Tooltips manquants
- Icônes par défaut

## 7. Métriques actuelles

- **Fichiers impactés**: 52
- **Lignes de code OpenAIP**: ~2000+
- **Composants dépendants**: 25+
- **Stores impactés**: 2 (openAIPStore, vacStore)
- **Services**: 3
- **Couverture tests**: 0%
- **Bundle size**: Non mesuré

## 8. Recommandations prioritaires

1. **P0 - Sécurité**: Retirer immédiatement la clé API du code
2. **P0 - Abstraction**: Créer interface AeroDataProvider
3. **P1 - Placeholders**: UI de remplacement "En développement"
4. **P1 - Tests**: Suite minimale de non-régression
5. **P2 - Refactor**: Consolider les composants carte
6. **P2 - Documentation**: Guide migration et API

## 9. Estimation effort

- **Phase 1** (Sécurisation + Abstraction): 2-3 jours
- **Phase 2** (Suppression OpenAIP): 3-4 jours
- **Phase 3** (Tests + CI): 2-3 jours
- **Phase 4** (Documentation): 1-2 jours
- **Total**: 8-12 jours développeur

## 10. Conclusion

Le système est **fortement couplé** à OpenAIP avec des **risques de sécurité** importants. La suppression nécessite une approche **progressive et testée** pour éviter les régressions. L'absence de tests automatisés est le **risque principal**.

---
*Audit réalisé le 10/08/2025*