# 🔐 Configuration des Certificats Apple (depuis PC)

## 📋 Prérequis
- ✅ Compte Apple Developer (99$/an)
- ✅ Accès à App Store Connect
- ✅ Repo GitHub configuré

## 🚀 Étape 1 : Créer l'App ID

1. Aller sur [Apple Developer](https://developer.apple.com)
2. **Certificates, IDs & Profiles** → **Identifiers** → **+**
3. Créer un App ID :
   - **Type** : App
   - **Bundle ID** : `com.alflight.app`
   - **Description** : ALFlight
   - **Capabilities** : Sélectionner les permissions nécessaires

## 📱 Étape 2 : Créer l'app sur App Store Connect

1. Aller sur [App Store Connect](https://appstoreconnect.apple.com)
2. **Mes Apps** → **+** → **Nouvelle app**
3. Remplir :
   - **Nom** : ALFlight
   - **Langue** : Français
   - **Bundle ID** : `com.alflight.app`
   - **SKU** : `ALFLIGHT001`
   - **Accès** : Accès complet

## 🔑 Étape 3 : Créer la clé API App Store Connect

### Créer la clé :
1. **App Store Connect** → **Utilisateurs et accès**
2. **Clés** → **Clés API App Store Connect** → **+**
3. **Nom** : `ALFlight CI/CD`
4. **Accès** : Admin
5. **Télécharger** le fichier `.p8` (⚠️ Une seule fois !)
6. Noter :
   - **Key ID** : `XXXXXXXXXX`
   - **Issuer ID** : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## 🏗️ Étape 4 : Générer les certificats (sans Mac)

### Option A : Via Codemagic (Automatique)
Codemagic peut générer automatiquement les certificats !

1. Connecter votre compte Apple dans Codemagic
2. Settings → **iOS code signing**
3. **Automatic** → Codemagic génère tout

### Option B : Service en ligne
Utiliser [AppUploader](https://www.appuploader.net) :
- Génère certificats depuis PC
- 20$ pour version complète
- Interface simple

### Option C : Via un ami avec Mac
Demander à quelqu'un de générer :
```bash
# Sur Mac de votre ami
security create-keychain -p temp ios-build.keychain
security unlock-keychain -p temp ios-build.keychain

# Générer CSR
openssl req -new -key private.key -out request.csr

# Télécharger le certificat depuis Apple Developer
# Exporter en .p12
```

## 🔧 Étape 5 : Configuration GitHub Secrets

### Ajouter les secrets dans GitHub :
Repo → **Settings** → **Secrets and variables** → **Actions**

| Secret | Description | Où le trouver |
|--------|-------------|---------------|
| `APP_STORE_CONNECT_API_KEY_ID` | ID de la clé API | App Store Connect |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID | App Store Connect |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Contenu du .p8 en base64 | Voir ci-dessous |
| `BUILD_CERTIFICATE_BASE64` | Certificat .p12 en base64 | Voir ci-dessous |
| `P12_PASSWORD` | Mot de passe du .p12 | Vous le définissez |
| `BUILD_PROVISION_PROFILE_BASE64` | Profil .mobileprovision | Apple Developer |
| `KEYCHAIN_PASSWORD` | Mot de passe temporaire | Ex: `temp123` |

### Encoder en base64 (PowerShell) :
```powershell
# Pour le fichier .p8
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXX.p8"))

# Pour le certificat .p12
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.p12"))

# Pour le profil
[Convert]::ToBase64String([IO.File]::ReadAllBytes("profile.mobileprovision"))
```

## 🎯 Étape 6 : Configuration Codemagic

### 1. Créer compte Codemagic
- https://codemagic.io/signup
- Utiliser GitHub pour se connecter

### 2. Ajouter votre app
- **Add application** → **GitHub**
- Sélectionner `alflight`
- Choisir **iOS** → **Capacitor**

### 3. Configurer les variables
Dans Codemagic → **Environment variables** :

```yaml
APP_STORE_CONNECT_PRIVATE_KEY: (contenu du .p8)
APP_STORE_CONNECT_KEY_IDENTIFIER: XXXXXXXXXX
APP_STORE_CONNECT_ISSUER_ID: xxxxxxxx-xxxx-xxxx
BUNDLE_ID: com.alflight.app
APP_STORE_APP_ID: 6736986315  # Votre App ID
```

### 4. Code signing automatique
- **Automatic** → Codemagic gère tout
- OU **Manual** → Upload vos fichiers

## ✅ Étape 7 : Lancer le build

### Via Codemagic :
1. **Start new build**
2. Choisir `main` branch
3. **Start build**
4. ⏳ Attendre ~20-30 min
5. ✅ Upload automatique sur TestFlight !

### Via GitHub Actions :
```bash
git add .
git commit -m "Setup iOS CI/CD"
git push origin main
```
- Le workflow se déclenche automatiquement
- Voir dans **Actions** tab

## 📱 Étape 8 : TestFlight

1. **App Store Connect** → **TestFlight**
2. Build apparaît après ~5-30 min
3. **Manage** → Ajouter testeurs
4. Envoyer invitations

## 🎉 C'est fait !

Votre app est maintenant sur TestFlight **sans jamais avoir touché un Mac** !

## 🆘 Troubleshooting

### Erreur "No certificate"
→ Vérifier que Codemagic a accès à votre compte Apple

### Erreur "Invalid bundle ID"
→ Vérifier que le bundle ID correspond partout

### Build échoue
→ Vérifier les logs dans Codemagic/GitHub Actions

### TestFlight ne reçoit pas
→ Attendre 30 min, vérifier App Store Connect

## 💡 Tips

1. **Commencer avec Codemagic** (plus simple)
2. **500 minutes gratuites** = ~15-20 builds/mois
3. **GitHub Actions** si vous dépassez la limite
4. **Toujours tester** en PWA d'abord

## 📞 Support

- Codemagic : https://docs.codemagic.io
- GitHub Actions : https://docs.github.com/actions
- Apple Developer : https://developer.apple.com/support