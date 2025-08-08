# 🔧 Résolution : Port 3001 déjà utilisé

## Problème
Le message d'erreur `EADDRINUSE: address already in use 0.0.0.0:3001` signifie qu'un autre processus utilise déjà le port 3001.

## Solution rapide

### 1. Trouver le processus qui utilise le port
```powershell
netstat -ano | findstr :3001
```
Résultat exemple : `TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    21112`
Le nombre à la fin (21112) est le PID du processus.

### 2. Tuer le processus
```powershell
# Remplacez 21112 par le PID trouvé
taskkill //PID 21112 //F
```

### 3. Redémarrer le serveur
```powershell
cd C:\alfight\flight-management-system\server
npm start
```

## Script automatique pour Windows

Créez un fichier `kill-and-restart.bat` :
```batch
@echo off
echo Recherche du processus sur le port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
    echo Fermeture du processus PID: %%a
    taskkill //PID %%a //F
)
timeout /t 2
echo Demarrage du serveur proxy...
cd server
npm start
```

## Alternative : Changer le port

Si le problème persiste, vous pouvez changer le port dans `server/openaip-proxy.js` :
```javascript
const PORT = process.env.PORT || 3002; // Changé de 3001 à 3002
```

Et mettre à jour dans `src/services/openAIPService.js` :
```javascript
proxyUrl: import.meta.env.VITE_OPENAIP_PROXY_URL || 'http://localhost:3002/api/openaip',
```

## Vérification

Une fois le serveur démarré, vous devriez voir :
```
🚀 Serveur proxy OpenAIP démarré sur http://localhost:3001
✅ CORS configuré pour accepter toutes les origines
```

Et dans l'application, le test de connexion devrait afficher :
- ✅ Proxy OpenAIP fonctionnel