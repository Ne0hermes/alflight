# Comment activer le mode API OpenAIP

## Problème actuel
L'erreur CORS empêche l'utilisation de l'API via le proxy. C'est un problème de configuration entre le navigateur et le serveur proxy.

## Solution temporaire
Pour l'instant, l'application utilise les données statiques (80 aéroports français) qui fonctionnent parfaitement sans serveur.

## Pour activer l'API (quand le CORS sera résolu)

### 1. Démarrer le serveur proxy
```bash
cd server
npm install
npm run dev
```

### 2. Dans l'application
- Cliquer sur "🔧 Debug Info"
- Cliquer sur "Force API Mode"
- Ou utiliser "Reset & Reload" puis "Activer API"

### 3. Vérifier
Vous devriez voir :
- 1531 aéroports au lieu de 80
- "API OpenAIP via proxy" au lieu de "Données statiques"

## Ce qui fonctionne déjà sans API
✅ Carte avec tuiles OpenAIP (espaces aériens, aérodromes)
✅ 80 aéroports français principaux
✅ Navigation et calculs
✅ Rayon d'action
✅ Points de report VFR pour certains aéroports

## Solutions pour le CORS

### Option 1: Utiliser un proxy en production
Déployer le serveur sur Render, Vercel ou Railway

### Option 2: Extension navigateur
Installer une extension comme "CORS Unblock" pour le développement

### Option 3: Lancer Chrome sans CORS (développement uniquement)
```bash
chrome.exe --disable-web-security --user-data-dir="C:/temp"
```

## Données disponibles en mode statique
- Paris CDG, Orly, Le Bourget
- Lyon, Marseille, Nice, Toulouse
- Bordeaux, Nantes, Strasbourg
- Et 70+ autres aéroports français