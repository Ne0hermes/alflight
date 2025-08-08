# 🚀 Protocole de démarrage du serveur proxy OpenAIP

## ⚠️ Problème identifié
- **CORS** : Le proxy OpenAIP n'est pas démarré
- **OSM** : Problème de connexion aux tuiles OpenStreetMap

## 📋 Solution : Démarrer le serveur proxy

### Méthode 1 : Avec les fichiers batch (Windows) - RECOMMANDÉ

1. **Ouvrir un nouveau terminal/PowerShell**
2. **Se placer dans le dossier du projet** :
```bash
cd C:\alfight\flight-management-system
```

3. **Lancer le proxy avec le fichier batch** :
```bash
.\start-proxy.bat
```

### Méthode 2 : Commandes manuelles

#### Étape 1 : Installer les dépendances du serveur (si pas déjà fait)
```bash
cd server
npm install
cd ..
```

#### Étape 2 : Démarrer le serveur proxy
```bash
cd server
npm start
```

Le serveur devrait afficher :
```
🚀 Serveur proxy OpenAIP démarré sur le port 3001
✅ CORS configuré pour accepter toutes les origines
```

### Méthode 3 : Démarrage simultané (2 terminaux)

**Terminal 1 - Application React** :
```bash
npm run dev
```

**Terminal 2 - Serveur Proxy** :
```bash
cd server
npm start
```

## ✅ Vérification

Une fois le serveur démarré, vous devriez voir :

1. **Dans le terminal du proxy** :
   - `🚀 Serveur proxy OpenAIP démarré sur le port 3001`
   - Les requêtes qui arrivent : `📨 GET /airports - Origin: http://127.0.0.1:4017`

2. **Dans l'application** :
   - Le test de connexion devrait afficher : `✅ Proxy OpenAIP fonctionnel`
   - Les aérodromes, espaces aériens et balises devraient se charger

## 🔧 Dépannage

### Si le port 3001 est déjà utilisé :
```bash
# Windows - Trouver le processus
netstat -ano | findstr :3001

# Tuer le processus (remplacer PID par le numéro trouvé)
taskkill /PID [PID] /F
```

### Si les dépendances ne sont pas installées :
```bash
cd server
npm install
```

### Si le serveur ne démarre pas :
1. Vérifier que Node.js est installé : `node --version`
2. Vérifier le fichier `.env.local` contient la clé API :
```
VITE_OPENAIP_API_KEY=2717b9196e8100ee2456e09b82b5b08e
```

## 📝 Structure des serveurs

Vous devez avoir **2 serveurs** qui tournent :

| Serveur | Port | Rôle | Commande |
|---------|------|------|----------|
| **Vite (React)** | 4017 | Application web | `npm run dev` |
| **Proxy OpenAIP** | 3001 | Contourner CORS pour l'API | `cd server && npm start` |

## 🎯 Résultat attendu

Une fois les deux serveurs démarrés :
1. La carte s'affiche correctement
2. Les boutons "Aérodromes", "Espaces aériens", "Balises" fonctionnent
3. Les données OpenAIP se chargent sans erreur CORS
4. Le test de connexion affiche tout en vert

## 💡 Astuce

Créez un script pour tout démarrer d'un coup :

**start-all.bat** (Windows) :
```batch
@echo off
echo Démarrage du proxy OpenAIP...
start cmd /k "cd server && npm start"
timeout /t 3
echo Démarrage de l'application...
npm run dev
```

Puis lancez simplement : `.\start-all.bat`