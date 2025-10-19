# 📊 Configuration du Suivi des Mises à Jour

## Option 1 : Excel Local (Recommandé) 📑

### Utilisation simple :

1. **Dans la console du navigateur** (F12) :
```javascript
// Ajouter un log
excelLogger.log('Fix validation FI/CRI', 'PilotDashboard', 'Correction du problème de validation')

// Exporter vers Excel
excelLogger.exportToCSV()  // Télécharge automatiquement le fichier

// Voir les logs
excelLogger.showLogs()
```

2. **Le fichier CSV s'ouvre directement dans Excel**
   - Colonnes : Date, Action, Composant, Détails, Statut
   - Format français avec séparateur `;`

### Avantages :
- ✅ 100% local, pas de credentials
- ✅ Fonctionne hors ligne
- ✅ Export Excel natif
- ✅ Aucune configuration

## Option 2 : Google Sheets (Privé) 🔐

### Garder vos credentials en local :

1. **Créer le fichier credentials** :
   - Gardez `server/credentials.json` sur votre PC
   - Ne JAMAIS le commit sur Git

2. **Variable d'environnement** :
```bash
# .env.local (jamais sur Git)
GOOGLE_SHEETS_CREDENTIALS_PATH=./server/credentials.json
SPREADSHEET_ID=1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k
```

3. **Lancer le serveur local** :
```bash
node server/googleSheetsServer.js
```

### Pour GitHub (sans credentials) :

Utilisez GitHub Actions secrets :
- `GOOGLE_CREDENTIALS` : Contenu du JSON en base64
- `SPREADSHEET_ID` : ID de votre sheet

## Option 3 : Base de données locale 💾

### SQLite local :
```javascript
// Installation
npm install better-sqlite3

// Utilisation
const Database = require('better-sqlite3');
const db = new Database('tracking.db');
```

## Option 4 : Fichier JSON local 📄

```javascript
// Sauvegarder
localStorage.setItem('tracking', JSON.stringify(logs));

// Charger
const logs = JSON.parse(localStorage.getItem('tracking') || '[]');
```

## 🎯 Ma recommandation :

**Pour vous : Excel Local**
- Simple
- Pas de configuration
- Export direct
- Fonctionne immédiatement

```javascript
// Test rapide
excelLogger.log('Test', 'Setup', 'Premier test');
excelLogger.exportToCSV(); // Ouvre dans Excel
```

## 📝 Template Excel personnalisé

Si vous voulez un vrai fichier Excel (pas CSV) :

```javascript
// Installer
npm install xlsx

// Exporter en .xlsx
import XLSX from 'xlsx';

function exportToExcel(logs) {
  const ws = XLSX.utils.json_to_sheet(logs);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tracking");
  XLSX.writeFile(wb, "alflight_tracking.xlsx");
}
```

## 🔒 Sécurité

**Ce qui ne doit JAMAIS être sur GitHub :**
- `server/credentials.json`
- `*.p8` (clés Apple)
- `*.p12` (certificats)
- `.env` avec secrets

**Ce qui peut être sur GitHub :**
- Code de l'app
- Configuration sans secrets
- Documentation

## 💡 Astuce

Pour Codemagic, mettez les credentials dans leur interface web, pas dans le code !

---

Votre tracking fonctionne déjà ! Testez :
1. F12 dans le navigateur
2. `excelLogger.exportToCSV()`
3. Ouvre dans Excel !