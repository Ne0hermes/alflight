# 🚀 Guide Rapide Codemagic - Votre app sur TestFlight en 30 minutes !

## 📱 Étape 1 : Créer votre compte Codemagic (5 min)

1. **Aller sur** https://codemagic.io/signup
2. **Cliquer** sur "Sign up with GitHub"
3. **Autoriser** Codemagic à accéder à votre GitHub
4. **Confirmer** votre email

✅ **Vous avez maintenant 500 minutes gratuites par mois !**

## 🔗 Étape 2 : Connecter votre projet (2 min)

1. Dans Codemagic, cliquer **"Add your first app"**
2. Sélectionner **"GitHub"**
3. Trouver et sélectionner **"alflight"**
4. Cliquer **"Finish: Add application"**

## ⚙️ Étape 3 : Configuration rapide (10 min)

### A. Sélectionner le workflow

1. Dans votre projet, aller à **"Settings"**
2. **Workflow editor** → **"codemagic.yaml"**
3. Codemagic détecte automatiquement votre fichier `codemagic.yaml` ✅

### B. Configurer l'authentification Apple

1. Aller dans **"Teams"** (menu gauche)
2. **"Personal Account"** → **"Integrations"**
3. Cliquer **"Developer Portal"** sous Apple

#### Option 1 : Connexion simple (Recommandé)
- **Username** : Votre Apple ID
- **Password** : Mot de passe spécifique d'app
- Cliquer **"Connect"**

#### Option 2 : API Key (Plus pro)
Si vous avez créé une API Key App Store Connect :
- **Key ID** : `XXXXXXXXXX`
- **Issuer ID** : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Private Key** : Contenu du fichier .p8
- Cliquer **"Save"**

### C. Configuration du projet

1. Retourner dans votre app
2. **"Settings"** → **"Build configuration"**
3. Vérifier/modifier :

```yaml
environment:
  vars:
    # Remplacer par vos valeurs
    APP_STORE_APP_ID: "6736986315"  # Votre App ID
    BUNDLE_ID: "com.alflight.app"
    XCODE_WORKSPACE: "ios/App/App.xcworkspace"
    XCODE_SCHEME: "App"
```

## 🎯 Étape 4 : Créer l'app sur App Store Connect (5 min)

Si pas encore fait :

1. Aller sur https://appstoreconnect.apple.com
2. **"My Apps"** → **"+"** → **"New App"**
3. Remplir :
   - **Platform** : iOS
   - **Name** : ALFlight
   - **Primary Language** : French
   - **Bundle ID** : com.alflight.app (créer si nécessaire)
   - **SKU** : ALFLIGHT001
   - **User Access** : Full Access

## 🏃 Étape 5 : Lancer votre premier build ! (2 min)

1. Dans Codemagic, sur votre projet
2. Cliquer le gros bouton **"Start new build"**
3. Sélectionner :
   - **Branch** : `main`
   - **Workflow** : `ios-workflow`
4. Cliquer **"Start new build"**

## ⏳ Étape 6 : Attendre et observer (15-30 min)

### Ce qui se passe automatiquement :

1. ✅ **Clone** de votre repo
2. ✅ **Installation** des dépendances
3. ✅ **Build** de l'app web
4. ✅ **Sync** avec Capacitor iOS
5. ✅ **Signature** automatique
6. ✅ **Build** Xcode
7. ✅ **Export** IPA
8. ✅ **Upload** vers TestFlight !

### Suivre le progrès :
- Les logs s'affichent en temps réel
- Chaque étape a une ✅ quand terminée
- Email de notification à la fin

## 🎉 Étape 7 : Vérifier sur TestFlight (5 min)

1. Aller sur https://appstoreconnect.apple.com
2. **"My Apps"** → **"ALFlight"** → **"TestFlight"**
3. Votre build apparaît ! (peut prendre 5-10 min)
4. Status : **"Processing"** → **"Ready to Test"**

## 📧 Étape 8 : Inviter des testeurs

### Testeurs internes (immédiat) :
1. **"Internal Testing"** → **"+"**
2. Ajouter emails de votre équipe
3. Ils reçoivent l'invitation instantanément

### Testeurs externes (24-48h review) :
1. **"External Testing"** → **"Add Group"**
2. Nom : "Pilotes Beta"
3. **"+"** → Ajouter emails
4. **"Submit for Review"**

## 🔄 Builds suivants

Pour les prochains builds :

### Option 1 : Automatique
Chaque `git push` sur `main` déclenche un build !

### Option 2 : Manuel
Dans Codemagic → **"Start new build"**

## 📊 Tableau de bord Codemagic

### Voir vos stats :
- **Builds** : Historique et status
- **Minutes** : Consommation (500/mois gratuit)
- **Artifacts** : Télécharger IPA si besoin
- **Logs** : Debugger si problème

## ⚠️ Troubleshooting rapide

### Build échoué ?

#### "No certificate found"
→ Vérifier la connexion Apple dans Teams → Integrations

#### "Invalid bundle identifier"
→ Vérifier que `com.alflight.app` existe dans Apple Developer

#### "Archive failed"
→ Vérifier les logs, souvent une erreur de code

#### Upload TestFlight échoué
→ Vérifier que l'app existe dans App Store Connect

## 💰 Gestion des minutes

### Gratuit : 500 min/mois
- ~15-20 builds iOS
- Réinitialisation chaque mois
- Suffisant pour développement

### Si besoin de plus :
- **Pay as you go** : $0.045/min
- **Professional** : $299/mois (unlimited)
- Ou utiliser GitHub Actions en complément

## 🎯 Checklist finale

- [ ] Compte Codemagic créé
- [ ] Projet connecté depuis GitHub
- [ ] Apple Developer connecté
- [ ] App créée sur App Store Connect
- [ ] Premier build lancé
- [ ] Build visible sur TestFlight
- [ ] Testeurs invités

## 🚀 Commandes Git pour déclencher un build

```bash
# Faire un changement
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main

# Build automatique déclenché !
```

## 📱 Pour vos testeurs

Envoyez ce message :

```
Bonjour !

Vous êtes invité à tester ALFlight sur TestFlight.

Installation :
1. Installer TestFlight depuis l'App Store
2. Ouvrir l'email d'invitation sur votre iPhone
3. Accepter et installer ALFlight

Merci de tester et envoyer vos retours !
```

## 🎊 Félicitations !

Votre app est maintenant sur TestFlight, **sans avoir touché un Mac !**

### Prochaines étapes :
1. ✅ Tester avec quelques amis
2. ✅ Corriger les bugs trouvés
3. ✅ Élargir aux testeurs externes
4. ✅ Préparer la publication App Store

## 💬 Support

- **Codemagic** : https://docs.codemagic.io
- **Discord** : https://discord.gg/codemagic
- **Email** : support@codemagic.io

---

💡 **Astuce** : Gardez ce guide ouvert pendant la configuration !