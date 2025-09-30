# 📱 Préparation iOS sur PC pour ALFlight

## 🖥️ Ce que vous pouvez faire depuis votre PC

### ✅ Déjà fait :
1. **Capacitor iOS** installé et configuré
2. **Projet iOS** généré dans `/ios`
3. **Build de production** prêt
4. **Permissions** configurées
5. **Documentation** complète

### 📦 Préparation des assets

#### 1. Créer les icônes (sur PC)
Préparez ces images dans `D:\Applicator\alflight\resources\` :

- **icon-1024.png** - 1024x1024px (pour App Store)
- **icon-180.png** - 180x180px (iPhone)
- **icon-167.png** - 167x167px (iPad Pro)
- **icon-152.png** - 152x152px (iPad)
- **icon-120.png** - 120x120px (iPhone Retina)
- **icon-87.png** - 87x87px (iPhone Settings)
- **icon-80.png** - 80x80px (iPad Settings)
- **icon-76.png** - 76x76px (iPad)
- **icon-60.png** - 60x60px (iPhone Notification)
- **icon-58.png** - 58x58px (iPad Settings)
- **icon-40.png** - 40x40px (iPad Notification)
- **icon-29.png** - 29x29px (Settings)
- **icon-20.png** - 20x20px (Notification)

#### 2. Splash screens
- **splash-2732x2732.png** - iPad Pro 12.9"
- **splash-2048x2732.png** - iPad Pro 11"
- **splash-1668x2388.png** - iPad Pro 10.5"
- **splash-1536x2048.png** - iPad Mini
- **splash-1242x2688.png** - iPhone 11 Pro Max
- **splash-1125x2436.png** - iPhone X/XS
- **splash-828x1792.png** - iPhone XR
- **splash-750x1334.png** - iPhone 8

### 🔄 Transfert vers Mac

#### Option 1: Via GitHub
```bash
# Sur PC - Pusher les changements
git add .
git commit -m "iOS preparation from PC"
git push

# Sur Mac - Récupérer
git pull
npx cap sync ios
npx cap open ios
```

#### Option 2: Via Cloud (OneDrive/Dropbox/Google Drive)
1. Compresser le dossier `alflight`
2. Uploader sur le cloud
3. Télécharger sur Mac
4. Décompresser et ouvrir dans Xcode

#### Option 3: Clé USB
1. Copier tout le dossier `D:\Applicator\alflight`
2. Transférer sur Mac
3. Ouvrir Terminal sur Mac :
```bash
cd /path/to/alflight
npm install
npx cap sync ios
npx cap open ios
```

### 🛠️ Services Mac Cloud (Alternatives)

#### MacinCloud (Location Mac en ligne)
- https://www.macincloud.com
- À partir de 1$/heure
- Xcode préinstallé
- Upload via leur interface

#### MacStadium
- https://www.macstadium.com
- Mac Mini dans le cloud
- Plus cher mais plus puissant

#### Demander à un ami avec Mac
- Faire un TeamViewer/AnyDesk
- Ou leur envoyer le projet

### 📝 Checklist avant Mac

#### Fichiers à vérifier :
- [ ] `capacitor.config.json` configuré
- [ ] `ios/App/App/Info.plist` avec permissions
- [ ] Build de production généré (`dist/`)
- [ ] Icônes préparées (optionnel)

#### Informations à préparer :
- [ ] **Apple ID** : _________________
- [ ] **Team ID** : _________________
- [ ] **Bundle ID** : `com.alflight.app`
- [ ] **App Name** : ALFlight
- [ ] **Version** : 1.0.0
- [ ] **Build** : 1

### 🚀 Script automatique pour Mac

Créez ce script `setup-mac.sh` à exécuter sur Mac :

```bash
#!/bin/bash
echo "🚀 Setup ALFlight pour iOS"

# Installation des dépendances
echo "📦 Installation des dépendances..."
npm install

# Build de production
echo "🔨 Build de production..."
npm run build

# Sync iOS
echo "📱 Synchronisation iOS..."
npx cap sync ios

# Installation pods (si CocoaPods installé)
if command -v pod &> /dev/null; then
    echo "🎯 Installation des CocoaPods..."
    cd ios/App
    pod install
    cd ../..
fi

# Ouvrir Xcode
echo "✅ Ouverture dans Xcode..."
npx cap open ios

echo "🎉 Prêt pour Xcode!"
echo ""
echo "Dans Xcode :"
echo "1. Sélectionner votre Team"
echo "2. Product → Archive"
echo "3. Upload vers TestFlight"
```

### 💡 Tips PC → Mac

1. **Compte Apple Developer**
   - Peut être créé depuis PC
   - https://developer.apple.com
   - 99$/an

2. **App Store Connect**
   - Créer l'app depuis PC
   - https://appstoreconnect.apple.com
   - Préparer les métadonnées

3. **TestFlight**
   - Configurer les groupes de test depuis PC
   - Préparer les emails des testeurs
   - Rédiger les notes de test

### 📱 Test sans Mac (Alternatif)

#### Expo (Conversion possible)
```bash
# Installer Expo
npm install -g expo-cli

# Créer une version Expo
expo init alflight-expo
# Copier votre code
# Publier sur Expo Go
```

#### PWA Direct
- Déployer sur Vercel/Netlify
- Installer comme PWA sur iPhone
- Pas besoin de Mac ni TestFlight

### 🔗 Ressources utiles

- [Capacitor sans Mac](https://capacitorjs.com/docs/guides/ci-cd)
- [GitHub Actions pour iOS](https://github.com/marketplace/actions/ios-build-action)
- [Codemagic CI/CD](https://codemagic.io) - Build iOS sans Mac
- [Bitrise](https://bitrise.io) - CI/CD pour mobile

### ⚡ Commande rapide

Quand vous aurez accès à un Mac :
```bash
# Une seule commande pour tout préparer
curl -s https://raw.githubusercontent.com/votre-repo/alflight/main/setup-mac.sh | bash
```

---

## 📞 Support

Si vous avez besoin d'aide pour le transfert PC → Mac :
- Discord communauté Capacitor
- Forums Apple Developer
- Stack Overflow tag: capacitor-ios

Votre projet est **100% prêt** côté PC ! Il ne reste que l'étape Xcode sur Mac.