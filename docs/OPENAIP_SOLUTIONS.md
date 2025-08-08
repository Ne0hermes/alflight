# Solutions pour utiliser l'API OpenAIP

## Problème : CORS (Cross-Origin Resource Sharing)

L'API OpenAIP n'autorise pas les appels directs depuis les navigateurs web pour des raisons de sécurité. C'est une limitation côté OpenAIP, pas de votre application.

## Solutions disponibles

### 1. ✅ Serveur Proxy (Recommandé)
- Créer un serveur backend qui fait les appels API pour vous
- Le serveur n'a pas de restrictions CORS
- Voir le dossier `/server` pour l'implémentation

**Avantages :**
- Accès complet à l'API
- Données en temps réel
- Sécurité de la clé API

**Inconvénients :**
- Nécessite un hébergement supplémentaire
- Coût d'hébergement (~5-10€/mois)

### 2. ✅ Fonctions Serverless
Utiliser des services comme :
- **Vercel Functions**
- **Netlify Functions**
- **Cloudflare Workers**

**Exemple avec Vercel :**
```javascript
// api/openaip.js
export default async function handler(req, res) {
  const response = await fetch('https://api.core.openaip.net/api/airports', {
    headers: {
      'x-openaip-api-key': process.env.OPENAIP_API_KEY
    }
  });
  
  const data = await response.json();
  res.status(200).json(data);
}
```

**Avantages :**
- Gratuit pour usage modéré
- Facile à déployer
- Pas de serveur à gérer

### 3. ⚠️ Extension navigateur
Créer une extension Chrome/Firefox qui désactive CORS pour le développement.

**Attention :** Seulement pour le développement local !

### 4. ✅ Données statiques (Solution actuelle)
Utiliser des données pré-téléchargées et mises à jour périodiquement.

**Avantages :**
- Pas de serveur nécessaire
- Fonctionne partout
- Rapide

**Inconvénients :**
- Données pas toujours à jour
- Maintenance manuelle

## Ce qui fonctionne déjà sans proxy

Les **tuiles de carte OpenAIP** fonctionnent directement car elles sont servies comme des images :
- Cartes aéronautiques
- Espaces aériens
- Symboles d'aérodromes

## Recommandation

Pour une application de production, je recommande :

1. **Court terme** : Continuer avec les données statiques + tuiles OpenAIP
2. **Moyen terme** : Déployer le serveur proxy sur un service gratuit (Render, Railway)
3. **Long terme** : Intégrer avec d'autres APIs aviation (AviationStack, AeroDataBox)

## Coûts estimés

- **Données statiques** : 0€
- **Vercel/Netlify Functions** : 0€ (usage modéré)
- **Serveur dédié** : 5-20€/mois
- **API alternatives** : Variable selon usage

## Instructions de déploiement

### Déployer sur Render (Gratuit)

1. Créer un compte sur [render.com](https://render.com)
2. Nouveau Web Service
3. Connecter GitHub
4. Sélectionner le dossier `server`
5. Ajouter la variable d'environnement `VITE_OPENAIP_API_KEY`
6. Déployer

### Déployer sur Vercel (Gratuit)

1. Installer Vercel CLI : `npm i -g vercel`
2. Dans le dossier racine : `vercel`
3. Suivre les instructions
4. L'API sera disponible sur `votre-app.vercel.app/api/openaip`

## Mise à jour de l'application

Une fois le proxy déployé, ajouter dans `.env.local` :
```
VITE_OPENAIP_PROXY_URL=https://votre-proxy.render.com/api/openaip
```

Puis dans l'application :
```javascript
// Activer l'API
openAIPService.toggleDataSource(false);
```