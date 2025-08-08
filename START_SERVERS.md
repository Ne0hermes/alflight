# 🚀 DÉMARRAGE RAPIDE DES SERVEURS

## ⚠️ IMPORTANT : Vous devez être dans le bon dossier !

### Étape 1 : Aller dans le dossier du projet
```powershell
cd C:\alfight\flight-management-system
```

### Étape 2 : Démarrer tout automatiquement
```powershell
.\start-all.bat
```

---

## OU Méthode manuelle (2 terminaux) :

### Terminal 1 - Serveur Proxy OpenAIP
```powershell
# 1. Aller dans le projet
cd C:\alfight\flight-management-system

# 2. Aller dans le dossier server
cd server

# 3. Installer les dépendances (première fois seulement)
npm install

# 4. Démarrer le proxy
npm start
```

### Terminal 2 - Application React
```powershell
# 1. Ouvrir un NOUVEAU terminal PowerShell
# 2. Aller dans le projet
cd C:\alfight\flight-management-system

# 3. Démarrer l'application
npm run dev
```

## ✅ Vérification que tout fonctionne

Vous devez voir :

**Dans Terminal 1 (Proxy)** :
```
🚀 Serveur proxy OpenAIP démarré sur le port 3001
✅ CORS configuré pour accepter toutes les origines
```

**Dans Terminal 2 (React)** :
```
VITE v7.0.6 ready in XXX ms
➜ Local: http://127.0.0.1:4017/
```

## 📍 Résumé des commandes depuis n'importe où :

```powershell
# Commande complète pour démarrer le proxy depuis n'importe où
cd C:\alfight\flight-management-system\server && npm start

# Commande complète pour démarrer l'app depuis n'importe où  
cd C:\alfight\flight-management-system && npm run dev

# Ou utilisez le script automatique
cd C:\alfight\flight-management-system && .\start-all.bat
```