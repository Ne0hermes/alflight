# Guide TestFlight pour ALFlight

## 🎯 TestFlight - Test sur App Store sans publication

TestFlight permet de tester votre app iOS avec de vrais utilisateurs SANS la publier publiquement sur l'App Store.

## 📋 Prérequis

1. **Compte Apple Developer** (99$/an)
2. **Xcode** installé sur Mac
3. **App ID** et **Provisioning Profile**
4. **Capacitor** configuré pour iOS

## 🔧 Configuration Capacitor iOS

### 1. Initialiser Capacitor
```bash
# Si pas déjà fait
npm install @capacitor/core @capacitor/ios
npx cap init "ALFlight" "com.yourcompany.alflight"

# Ajouter la plateforme iOS
npx cap add ios

# Synchroniser
npx cap sync ios
```

### 2. Configuration iOS
```javascript
// capacitor.config.json
{
  "appId": "com.yourcompany.alflight",
  "appName": "ALFlight",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  },
  "ios": {
    "contentInset": "automatic",
    "preferredContentMode": "mobile"
  }
}
```

## 📱 Préparation pour TestFlight

### 1. Info.plist Configuration
```xml
<!-- ios/App/App/Info.plist -->
<key>ITSAppUsesNonExemptEncryption</key>
<false/>

<key>NSLocationWhenInUseUsageDescription</key>
<string>ALFlight utilise votre position pour la navigation aérienne</string>

<key>NSCameraUsageDescription</key>
<string>ALFlight utilise la caméra pour scanner les documents</string>
```

### 2. Build de production
```bash
# Build web
npm run build

# Synchroniser avec iOS
npx cap sync ios

# Ouvrir dans Xcode
npx cap open ios
```

## 🚀 Étapes TestFlight

### Étape 1: Préparation dans Xcode

1. **Ouvrir le projet** dans Xcode
2. **Sélectionner** "Any iOS Device" comme destination
3. **Configurer** :
   - Bundle Identifier: `com.yourcompany.alflight`
   - Version: `1.0.0`
   - Build: `1`
4. **Signing & Capabilities** :
   - Team: Votre équipe développeur
   - Automatically manage signing: ✅

### Étape 2: Archive et Upload

```bash
# Dans Xcode
Product → Archive
# Attendre la fin de l'archive

# Fenêtre Organizer s'ouvre
Distribute App → App Store Connect → Upload

# Sélectionner les options :
- [x] Include bitcode
- [x] Upload symbols
```

### Étape 3: Configuration TestFlight

1. **Connectez-vous** à [App Store Connect](https://appstoreconnect.apple.com)
2. **Mes Apps** → **ALFlight**
3. **TestFlight** tab

#### Testeurs internes (jusqu'à 100)
- Membres de votre équipe développeur
- Installation immédiate
- Pas de review Apple

```
Testeurs internes → + → Ajouter emails
```

#### Testeurs externes (jusqu'à 10,000)
- N'importe qui avec email
- Review Apple requise (24-48h)
- Valide 90 jours

```
Testeurs externes → + → Créer groupe
→ Ajouter testeurs → Inviter
```

### Étape 4: Informations de test

```yaml
Informations de test:
  Description: "Application de gestion de vol pour pilotes privés"
  Notes de test: "Testez la création de plans de vol et le carnet"
  Email: "support@alflight.com"

Beta App Review:
  Contact: "Votre nom"
  Téléphone: "+33..."
  Email: "contact@..."
```

## 📧 Processus pour les testeurs

### Ce que reçoivent vos testeurs :

1. **Email d'invitation** TestFlight
2. **Lien** pour installer TestFlight (si pas déjà fait)
3. **Code** ou lien direct vers votre app
4. **Installation** directe sur leur iPhone/iPad

### Instructions pour les testeurs :
```markdown
## Installation ALFlight Beta

1. Installez TestFlight depuis l'App Store
2. Ouvrez l'email d'invitation sur votre iPhone
3. Tapez "Afficher dans TestFlight"
4. Acceptez et installez ALFlight
5. L'icône apparaît sur votre écran d'accueil

## Envoyer des retours
- Dans TestFlight → ALFlight → Envoyer un commentaire
- Screenshot + shake pour reporter un bug
```

## 🔄 Mises à jour TestFlight

### Nouvelle version :
```bash
# Incrémenter build number
# Version 1.0.0 → Build 2, 3, 4...

# Rebuild et resync
npm run build
npx cap sync ios

# Archive et upload depuis Xcode
Product → Archive → Distribute
```

### Limites TestFlight :
- ✅ Builds valides **90 jours**
- ✅ Jusqu'à **10,000 testeurs externes**
- ✅ **Multiples groupes** de test
- ✅ **Versions simultanées** possibles
- ⚠️ Review Apple pour testeurs externes

## 🎯 Workflow recommandé

```mermaid
1. Dev local → 2. Build Capacitor → 3. TestFlight interne
→ 4. TestFlight externe → 5. App Store (quand prêt)
```

### Phase 1: Test interne (Semaine 1-2)
- Équipe développement
- Tests fonctionnels de base
- Corrections critiques

### Phase 2: Beta fermée (Semaine 3-4)
- 50-100 pilotes sélectionnés
- Feedback sur l'UX
- Ajustements

### Phase 3: Beta ouverte (Semaine 5-8)
- 500+ testeurs
- Tests de charge
- Préparation production

## 📝 Checklist avant TestFlight

- [ ] Apple Developer Program actif
- [ ] Certificats et profils configurés
- [ ] App ID créé dans Apple Developer
- [ ] App créée dans App Store Connect
- [ ] Icônes de l'app (1024x1024 minimum)
- [ ] Screenshots pour l'iPad si universel
- [ ] Description et notes de test
- [ ] Contact support configuré
- [ ] Build number unique

## 🔐 Données sensibles

```javascript
// .env.production.ios
VITE_API_URL=https://api.alflight.com
VITE_TESTFLIGHT=true
VITE_ANALYTICS_ID=your-id
```

## 🐛 Debug TestFlight

### Voir les logs :
```swift
// iOS Console dans Xcode
Window → Devices and Simulators
→ Select device → View Device Logs
```

### Crash reports :
```
App Store Connect → TestFlight
→ Builds → Build → Crashes
```

## 💡 Tips TestFlight

1. **Groupes multiples** : Créez "Pilotes Pro", "Débutants", etc.
2. **Feedback organisé** : Utilisez un Trello/Notion pour tracker
3. **Versions A/B** : Testez différentes features par groupe
4. **Expiration** : Prévenez 1 semaine avant les 90 jours
5. **Notes de version** : Détaillez chaque build

## 🚫 Restrictions TestFlight

- ❌ Pas de paiements réels (utilisez sandbox)
- ❌ Pas de contenu inapproprié
- ❌ Respecter les guidelines Apple
- ❌ Pas de redistribution du lien public

## 📊 Métriques TestFlight

Disponibles dans App Store Connect :
- Installations par build
- Crashes et feedbacks
- Sessions par testeur
- Devices et iOS versions

## 🎉 Prêt pour l'App Store

Quand les tests sont concluants :
1. **Préparer** screenshots et description finale
2. **Soumettre** pour review (5-7 jours)
3. **Publier** manuellement ou automatiquement

---

💼 **Contact Support Apple Developer**
- https://developer.apple.com/contact/
- Téléphone : +33 805 540 003