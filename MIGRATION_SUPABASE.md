# Migration vers Supabase - Guide Complet

## 📋 Résumé

L'application ALFlight utilise maintenant Supabase comme base de données centrale pour les avions. Le module Aircraft doit être **vide au démarrage** et tous les avions doivent être récupérés via le **Wizard communautaire** depuis Supabase.

## ✅ État actuel

### Avions dans Supabase

- **F-HSTR (DA40NG)** - ID: `0bda59c9-61bc-4a29-bacf-115159957607`
  - ✅ Données complètes (306 KB)
  - ✅ Tous les paramètres de performance
  - ✅ Configuration complète

### Configuration

- **Supabase URL**: `https://bgmscwckawgybymbimga.supabase.co`
- **Project ID**: `bgmscwckawgybymbimga`
- **Variables d'environnement**: Configurées dans `.env`

## 🚀 Utilisation

### 1. Démarrer l'application

```bash
D:\Applicator\alflight\START_SESSION.bat
```

Ou manuellement:
```bash
cd D:\Applicator\alflight
npm run dev
```

L'application sera accessible sur: **http://localhost:4002**

### 2. Nettoyer le localStorage

**Option A: Via l'interface Admin**

1. Ouvrir l'application: http://localhost:4002
2. Aller dans l'onglet **"Admin"** (premier onglet)
3. Cliquer sur **"Vider le localStorage"**
4. Confirmer la suppression
5. La page se rechargera automatiquement

**Option B: Via la console du navigateur**

1. Ouvrir les DevTools (F12)
2. Aller dans la Console
3. Exécuter:
```javascript
// Créer un backup
const backup = {
  timestamp: new Date().toISOString(),
  data: JSON.parse(localStorage.getItem('aircraft-storage'))
};
localStorage.setItem('aircraft-storage-backup', JSON.stringify(backup));

// Vider
localStorage.setItem('aircraft-storage', JSON.stringify({
  state: { aircraftList: [], selectedAircraftId: null },
  version: 0
}));

// Recharger
location.reload();
```

### 3. Importer depuis Supabase

1. Aller dans **"Gestion Avions"**
2. Cliquer sur **"+ Nouvel Avion"** ou **"Wizard de création"**
3. Dans le wizard, **Step 0: Community Check**
4. Rechercher **"F-HSTR"** ou **"DA40NG"**
5. Sélectionner l'avion et cliquer **"Importer"**
6. L'avion complet sera chargé depuis Supabase

## 📁 Structure des fichiers

```
alflight/
├── .env                                    # Variables Supabase
├── src/
│   ├── services/
│   │   └── communityService.js            # Service Supabase
│   ├── features/
│   │   ├── admin/
│   │   │   └── AdminPanel.jsx             # Panel d'administration
│   │   └── aircraft/
│   │       └── components/
│   │           └── AircraftCreationWizard.jsx
│   └── core/
│       └── stores/
│           └── aircraftStore.js           # Store Zustand (vide par défaut)
└── scripts/
    ├── migrate-to-supabase.js             # Script de migration
    ├── clear-local-aircraft.js            # Script de nettoyage
    ├── analyze-fhstr.cjs                  # Analyse F-HSTR
    └── fhstr-aircraft-only.json           # Données extraites

```

## 🛠️ Scripts disponibles

### Migration vers Supabase

```bash
cd D:\Applicator\alflight
node scripts/migrate-to-supabase.js
```

Insère F-HSTR dans Supabase (si pas déjà présent).

### Nettoyage localStorage

```bash
node scripts/clear-local-aircraft.js
```

Ou importer dans la console:
```javascript
import { clearLocalAircraft } from './scripts/clear-local-aircraft.js';
clearLocalAircraft();
```

## 🔧 Configuration Supabase

### Tables utilisées

- `community_presets` - Avions partagés
- `presets_with_stats` - Vue avec statistiques
- `manex_files` - Fichiers MANEX
- `preset_downloads` - Téléchargements
- `preset_votes` - Votes

### Structure de `community_presets`

```sql
CREATE TABLE community_presets (
  id UUID PRIMARY KEY,
  registration TEXT,
  model TEXT,
  manufacturer TEXT,
  aircraft_type TEXT,
  category TEXT,
  aircraft_data JSONB,        -- Données complètes de l'avion
  submitted_by TEXT,
  description TEXT,
  manex_file_id UUID,
  has_manex BOOLEAN,
  status TEXT,
  verified BOOLEAN,
  admin_verified BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## 📊 Données F-HSTR

L'avion F-HSTR contient:

- **Informations de base**: Registration, modèle, type
- **Performance**: Vitesses, consommation, plafond
- **Masse et centrage**: Bras, enveloppe CG, limites
- **Tables de performance**: Décollage, atterrissage
- **Équipements**: COM, NAV, Surveillance
- **Limites**: Vent, surfaces compatibles

**Taille totale**: 306 KB de données JSON complètes

## ⚠️ Important

1. **DEFAULT_AIRCRAFT_LIST = []** (vide) dans `src/utils/constants.js`
2. Les avions en localStorage sont **temporaires** et doivent être nettoyés
3. La source de vérité est **Supabase**
4. Toujours passer par le **Wizard communautaire** pour importer

## 🔗 Liens utiles

- **Dashboard Supabase**: https://supabase.com/dashboard/project/bgmscwckawgybymbimga
- **Table Editor**: https://supabase.com/dashboard/project/bgmscwckawgybymbimga/editor/17474
- **App locale**: http://localhost:4002
- **Google Sheets Tracker**: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

## 🐛 Troubleshooting

### Les avions réapparaissent au redémarrage

Le localStorage contient encore des données. Utilisez le Panel Admin pour nettoyer.

### F-HSTR n'apparaît pas dans le wizard

Vérifiez:
1. La connexion Supabase dans `.env`
2. Que l'avion existe dans la table `community_presets`
3. Les logs console pour les erreurs d'API

### Erreur "EADDRINUSE: port 3001"

Le serveur Google Sheets tourne déjà. C'est normal, ignorez l'erreur.

## 📝 Prochaines étapes

1. ✅ Nettoyer le localStorage via l'Admin Panel
2. ✅ Vérifier que le module Aircraft est vide au démarrage
3. ✅ Tester l'import de F-HSTR depuis Supabase
4. ⏳ Migrer les autres avions si nécessaire
5. ⏳ Documenter le processus de soumission d'avions

---

**Date de migration**: 2025-10-07
**Version**: 1.0.0
