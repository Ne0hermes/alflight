# Notes de migration - Suppression OpenAIP

## Résumé exécutif

Cette migration supprime complètement la dépendance à OpenAIP et introduit une architecture basée sur des providers abstraits pour les données aéronautiques.

## Changements majeurs

### 1. Architecture des données

#### Avant
```javascript
import { openAIPService } from '@services/openAIPService';
const airports = await openAIPService.getAirports('FR');
```

#### Après
```javascript
import { aeroDataProvider } from '@core/data';
const airports = await aeroDataProvider.getAirfields({ country: 'FR' });
```

### 2. Configuration

#### Avant
- Clé API OpenAIP hardcodée dans le code
- Proxy Vite configuré pour OpenAIP
- Tiles OpenAIP directement dans les cartes

#### Après
- Aucune clé API OpenAIP nécessaire
- Proxy OpenAIP désactivé
- Placeholders pour les données manquantes
- Feature flags pour contrôler les fonctionnalités

### 3. Store Zustand

Le `openAIPStore` a été adapté pour utiliser `aeroDataProvider` :
- Vérification de disponibilité du provider
- Retour de données vides si non disponible
- Messages d'erreur explicites

## Breaking changes

### Pour les utilisateurs
**Aucun** - L'interface utilisateur reste identique, avec des placeholders pour les fonctionnalités OpenAIP.

### Pour les développeurs

1. **Imports modifiés**
   ```javascript
   // ❌ Ancien
   import { openAIPService } from '@services/openAIPService';
   
   // ✅ Nouveau
   import { aeroDataProvider } from '@core/data';
   ```

2. **Méthodes renommées**
   - `getAirports()` → `getAirfields()`
   - `getAirspaces()` → `getAirspaces()` (inchangé)
   - `getNavaids()` → `getNavaids()` (inchangé)

3. **Format des paramètres**
   ```javascript
   // ❌ Ancien
   getAirports('FR')
   
   // ✅ Nouveau
   getAirfields({ country: 'FR' })
   ```

## Guide de migration

### Pour un fork existant

1. **Récupérer les changements**
   ```bash
   git pull origin main
   npm install
   ```

2. **Nettoyer l'environnement**
   ```bash
   # Supprimer l'ancienne configuration
   rm .env
   rm -rf node_modules
   npm install
   ```

3. **Créer nouvelle configuration**
   ```bash
   cp .env.example .env
   # Éditer .env si nécessaire (pas de clé OpenAIP requise)
   ```

4. **Vérifier le build**
   ```bash
   npm run build
   npm run dev
   ```

### Pour réactiver OpenAIP (non recommandé)

Si vous devez absolument réactiver OpenAIP :

1. **Créer un provider OpenAIP**
   ```javascript
   // src/core/data/providers/OpenAIPProvider.js
   import { AeroDataProvider } from '../AeroDataProvider';
   
   export class OpenAIPProvider extends AeroDataProvider {
     // Implémenter les méthodes
   }
   ```

2. **Modifier la factory**
   ```javascript
   // src/core/data/index.js
   import { OpenAIPProvider } from './providers/OpenAIPProvider';
   
   if (FEATURES.OPENAIP_ENABLED) {
     return new OpenAIPProvider();
   }
   ```

3. **Activer le feature flag**
   ```javascript
   // src/core/flags.js
   OPENAIP_ENABLED: true
   ```

4. **Configurer la clé API**
   ```env
   VITE_OPENAIP_API_KEY=your_key_here
   ```

## Composants affectés

### Supprimés
- `src/services/openAIPService.js`
- `src/services/openaipAirportsClient.js`
- `src/map/layers/OpenAIPAirportsLayer.js`
- `server/openaip-proxy.js`
- Tous les fichiers `*_backup*.js`

### Modifiés
- `src/core/stores/openAIPStore.js` - Utilise aeroDataProvider
- `src/features/navigation/components/NavigationMap.jsx` - Placeholders pour tiles
- `vite.config.js` - Proxy OpenAIP désactivé

### Ajoutés
- `src/core/data/AeroDataProvider.js` - Interface abstraite
- `src/core/data/providers/NotImplementedProvider.js` - Provider temporaire
- `src/core/flags.js` - Feature flags
- `src/shared/components/PlaceholderDev.jsx` - Composants placeholder

## Données statiques disponibles

Le `NotImplementedProvider` fournit des données statiques minimales :

### Aérodromes
- LFPG - Paris Charles de Gaulle
- LFPO - Paris Orly
- LFPB - Paris Le Bourget
- LFPT - Pontoise Cormeilles
- LFPN - Toussus-le-Noble

### Balises
- PON - Pontoise VOR-DME
- CRL - Charles de Gaulle VOR-DME

### Points de report
- Points VFR pour LFPT et LFPN

## Fonctionnalités maintenues

✅ Navigation manuelle (saisie ICAO)
✅ Calculs de distance et cap
✅ Carte OSM de base
✅ Module carburant
✅ Module météo
✅ Sélection alternates
✅ Export GPX
✅ Cartes VAC

## Fonctionnalités temporairement indisponibles

⚠️ Recherche automatique d'aérodromes
⚠️ Affichage des espaces aériens
⚠️ Points de report VFR complets
⚠️ Balises de navigation complètes
⚠️ Tiles aéronautiques OpenAIP

## Rollback

Si nécessaire, pour revenir à la version avec OpenAIP :

```bash
git checkout tags/v1.0.0-with-openaip
npm install
```

## FAQ

**Q: Pourquoi supprimer OpenAIP ?**
R: Pour des raisons de sécurité (clé API exposée), de fiabilité (service tiers), et d'architecture (couplage fort).

**Q: Les données aéronautiques reviendront-elles ?**
R: Oui, via un provider alternatif ou des données officielles SIA.

**Q: Puis-je utiliser mon propre provider ?**
R: Oui, en étendant `AeroDataProvider` et en modifiant la factory.

**Q: L'application est-elle toujours utilisable ?**
R: Oui, toutes les fonctionnalités principales restent disponibles.

## Support

Pour toute question sur la migration :
1. Consultez `README_AUDIT.md` pour l'analyse détaillée
2. Consultez `ACTION_PLAN.md` pour le plan de migration
3. Consultez `README_DEV.md` pour le guide de développement

---
*Migration effectuée le 10/08/2025*
*Version : 2.0.0-no-openaip*