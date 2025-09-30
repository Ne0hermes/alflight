# Guide de Déploiement ALFlight

## 🚀 Déploiement Rapide (Sans App Store)

### Option 1: Vercel (Recommandé)
```bash
# 1. Installer Vercel CLI
npm i -g vercel

# 2. Build l'application
npm run build

# 3. Déployer
vercel

# URL: https://alflight.vercel.app
```

### Option 2: Netlify
```bash
# 1. Build l'application
npm run build

# 2. Glisser-déposer le dossier 'dist' sur netlify.com
# OU utiliser Netlify CLI:
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

### Option 3: GitHub Pages
```bash
# 1. Ajouter homepage dans package.json
"homepage": "https://[username].github.io/alflight"

# 2. Installer gh-pages
npm install --save-dev gh-pages

# 3. Ajouter script de déploiement
"scripts": {
  "deploy": "npm run build && gh-pages -d dist"
}

# 4. Déployer
npm run deploy
```

## 📱 Installation Mobile (PWA)

Une fois déployée, les utilisateurs peuvent installer l'app :

### iOS (Safari)
1. Ouvrir l'URL dans Safari
2. Tap sur l'icône "Partager"
3. "Ajouter à l'écran d'accueil"

### Android (Chrome)
1. Ouvrir l'URL dans Chrome
2. Menu → "Installer l'application"
3. Ou bannière d'installation automatique

## 🔐 Variables d'environnement

Créer `.env.production`:
```env
VITE_API_URL=https://votre-api.com
VITE_GOOGLE_SHEETS_URL=https://votre-backend.com
```

## 🌍 Domaine personnalisé

### Vercel
- Ajouter dans Project Settings → Domains
- CNAME: `cname.vercel-dns.com`

### Netlify
- Site Settings → Domain management
- CNAME: `[votre-site].netlify.app`

## 📊 Backend Google Sheets

Pour le serveur Google Sheets, déployer séparément :

### Heroku
```bash
cd server
git init
heroku create alflight-sheets-api
git push heroku main
```

### Railway
```bash
cd server
railway init
railway up
```

## ✅ Checklist de déploiement

- [ ] Build de production testé localement
- [ ] Variables d'environnement configurées
- [ ] Service worker actif pour mode hors-ligne
- [ ] Manifest.json configuré avec icônes
- [ ] HTTPS activé (automatique sur Vercel/Netlify)
- [ ] Backend Google Sheets déployé
- [ ] Tests sur mobile (iOS/Android)

## 🔗 URLs de production

- Frontend: `https://alflight.vercel.app`
- Backend: `https://alflight-api.herokuapp.com`
- Documentation: `https://docs.alflight.app`

## 📱 Distribution alternative iOS

### TestFlight (sans App Store)
1. Build avec Xcode/Capacitor
2. Upload sur App Store Connect
3. Inviter jusqu'à 10,000 testeurs
4. Valide 90 jours

### PWA Direct
- Aucune installation requise
- Fonctionne sur tous les navigateurs
- Mise à jour automatique
- Mode hors-ligne avec service worker

## 🆘 Support

- Issues: GitHub Issues
- Email: support@alflight.app
- Documentation: `/docs`