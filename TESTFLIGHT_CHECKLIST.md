# ✅ Checklist TestFlight ALFlight

## 📋 Avant de commencer

- [ ] **Compte Apple Developer** actif (99$/an)
- [ ] **Mac avec Xcode** (version 14+)
- [ ] **Certificats iOS** configurés
- [ ] **App ID** créé: `com.alflight.app`

## 🛠️ Configuration initiale (déjà fait ✅)

- [x] Capacitor installé
- [x] Projet iOS créé
- [x] Permissions configurées dans Info.plist
- [x] Scripts de build prêts

## 🚀 Build pour TestFlight

### 1. Préparation du build
```bash
# Build de production
npm run build

# Synchroniser avec iOS
npx cap sync ios
```

### 2. Ouvrir dans Xcode
```bash
npx cap open ios
```

### 3. Dans Xcode

#### Configuration du projet:
- [ ] **Bundle Identifier**: `com.alflight.app`
- [ ] **Version**: `1.0.0`
- [ ] **Build**: `1` (incrémenter à chaque upload)
- [ ] **Team**: Sélectionner votre équipe développeur
- [ ] **Signing**: Activer "Automatically manage signing"

#### Build Archive:
1. [ ] Sélectionner **"Any iOS Device (arm64)"**
2. [ ] Menu: **Product → Archive**
3. [ ] Attendre la fin (5-10 min)

#### Upload vers TestFlight:
1. [ ] Dans Organizer: **Distribute App**
2. [ ] Choisir **"App Store Connect"**
3. [ ] **Upload** (pas Export)
4. [ ] Options par défaut
5. [ ] **Upload** (10-20 min)

## 📱 Configuration App Store Connect

### Créer l'app (si pas fait):
1. [ ] Aller sur [App Store Connect](https://appstoreconnect.apple.com)
2. [ ] **Mes Apps → "+"**
3. [ ] Remplir:
   - Nom: **ALFlight**
   - Bundle ID: `com.alflight.app`
   - SKU: `ALFLIGHT001`
   - Langue: Français

### Configuration TestFlight:

#### Informations de base:
- [ ] **Description beta**: "Application de gestion de vol pour pilotes"
- [ ] **Contact**: Votre email
- [ ] **Notes de test**: "Testez les plans de vol et le carnet"

#### Testeurs internes:
- [ ] Ajouter votre équipe (jusqu'à 100)
- [ ] Installation immédiate

#### Testeurs externes:
- [ ] Créer un groupe "Pilotes Beta"
- [ ] Ajouter les emails
- [ ] Soumettre pour review (24-48h)

## 📧 Instructions pour testeurs

### Email type à envoyer:
```
Bonjour,

Vous êtes invité à tester ALFlight en beta via TestFlight.

Installation:
1. Installer TestFlight sur votre iPhone/iPad
2. Ouvrir l'invitation sur votre appareil
3. Accepter et installer ALFlight

Merci de tester:
- Création de plans de vol
- Carnet de vol
- Import/Export de données
- Navigation et cartes

Feedback: Dans TestFlight → Envoyer commentaire

Merci !
```

## 🔄 Mises à jour

Pour chaque nouvelle version:
1. [ ] Incrémenter le **build number**
2. [ ] `npm run build && npx cap sync ios`
3. [ ] Archive et upload depuis Xcode
4. [ ] Ajouter notes de version dans TestFlight

## ⚠️ Points d'attention

### Erreurs fréquentes:
- **"Missing compliance"**: Ajouter `ITSAppUsesNonExemptEncryption` ✅
- **"Invalid bundle ID"**: Vérifier dans Xcode et App Store Connect
- **"No suitable device"**: Sélectionner "Any iOS Device"
- **"Profile not found"**: Regenerer dans Apple Developer

### Limites TestFlight:
- Builds valides **90 jours**
- Maximum **10,000 testeurs**
- Review pour testeurs externes

## 📊 Monitoring

### Dans App Store Connect:
- [ ] Vérifier les **crash reports**
- [ ] Lire les **feedbacks**
- [ ] Analyser les **métriques d'usage**
- [ ] Suivre les **installations**

## 🎯 Prochaines étapes

### Après tests réussis:
1. [ ] Préparer screenshots (6.5", 5.5", iPad)
2. [ ] Rédiger description App Store
3. [ ] Définir prix et disponibilité
4. [ ] Soumettre pour review finale

---

## 🆘 Support

- **Apple Developer**: +33 805 540 003
- **Forums**: developer.apple.com/forums
- **Documentation**: developer.apple.com/testflight

## 📝 Notes

Version actuelle: `1.0.0`
Build actuel: `1`
Dernier upload: _À compléter_
Testeurs actifs: _À compléter_