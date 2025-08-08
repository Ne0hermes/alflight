# Serveur Proxy OpenAIP

Ce serveur proxy permet d'accéder à l'API OpenAIP depuis votre application web en contournant les restrictions CORS.

## Installation

```bash
cd server
npm install
```

## Configuration

Le serveur utilise la même clé API que l'application principale (depuis le fichier `.env.local` à la racine).

## Démarrage

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm start
```

Le serveur démarre sur http://localhost:3001

## Endpoints disponibles

- `GET /api/health` - Vérifier l'état du serveur
- `GET /api/openaip/airports?country=FR` - Récupérer les aéroports
- `GET /api/openaip/airspaces?country=FR` - Récupérer les espaces aériens
- `GET /api/openaip/reporting-points?airportId=XXX` - Récupérer les points de report

## Utilisation dans l'application

1. Démarrer le serveur proxy
2. Dans l'application, activer le mode API :

```javascript
import { openAIPService } from '@/services/openAIPService';

// Activer l'utilisation de l'API via proxy
openAIPService.toggleDataSource(false);

// Tester la connexion
const status = await openAIPService.testConnection();
console.log(status); // { connected: true, mode: 'proxy', ... }
```

## Déploiement

Pour déployer en production :

### Option 1 : Heroku
```bash
heroku create votre-app-proxy
heroku config:set VITE_OPENAIP_API_KEY=votre-clé-api
git push heroku main
```

### Option 2 : Railway
```bash
railway login
railway init
railway add
railway up
```

### Option 3 : Render
1. Créer un nouveau Web Service sur render.com
2. Connecter votre repository GitHub
3. Configurer les variables d'environnement
4. Déployer

## Variables d'environnement

- `VITE_OPENAIP_API_KEY` - Votre clé API OpenAIP
- `PORT` - Port du serveur (par défaut 3001)

## CORS

Le serveur est configuré pour accepter les requêtes depuis :
- http://localhost:4000
- http://localhost:4001
- https://votre-domaine.com (à modifier selon votre domaine)