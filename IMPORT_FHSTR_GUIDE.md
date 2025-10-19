# 🚀 Guide: Importer F-HSTR depuis Supabase

## ✅ Corrections appliquées

Les corrections suivantes ont été appliquées pour garantir que **TOUTES** les données sont importées:

### 1. Service Supabase (`communityService.js`)
- ✅ Fonction `getPresetById()` corrigée
- ✅ Retourne maintenant `aircraft_data` complet sans écraser les champs
- ✅ Logs ajoutés pour tracer les données

### 2. Wizard d'import (`Step0CommunityCheck.jsx`)
- ✅ Ordre des spread operators inversé (`...fullAircraftData` en premier)
- ✅ Ne plus écraser les données de Supabase
- ✅ Logs ajoutés pour débugger

### 3. Données F-HSTR dans Supabase
- ✅ Manufacturer: Diamond Aircraft
- ✅ Type: Airplane
- ✅ Category: SEP
- ✅ Fuel Type: JET-A1
- ✅ Fuel Capacity: 148 L
- ✅ Fuel Consumption: 26 L/h
- ✅ Photo: Incluse (72 KB)
- ✅ Surfaces compatibles: ASPH, CONC
- ✅ Performances: Complètes

## 📋 Procédure d'import

### Étape 1: Nettoyer le localStorage

Ouvrez la console DevTools (F12) et exécutez:

```javascript
localStorage.setItem('aircraft-storage-backup', JSON.stringify({timestamp: new Date().toISOString(), data: JSON.parse(localStorage.getItem('aircraft-storage'))})); localStorage.setItem('aircraft-storage', JSON.stringify({state: {aircraftList: [], selectedAircraftId: null}, version: 0})); location.reload();
```

### Étape 2: Vérifier que le module Aircraft est vide

Après le rechargement:
1. Ouvrir http://localhost:4002
2. Aller dans **"Gestion Avions"**
3. Vérifier: **0 avions** dans la liste

### Étape 3: Importer F-HSTR

1. Cliquer sur **"+ Nouvel Avion"**
2. Le wizard s'ouvre sur **Step 0: Community Check**
3. Rechercher **"F-HSTR"** ou **"DA40NG"** dans la barre de recherche
4. Sélectionner **F-HSTR** dans la liste
5. Cliquer sur **"Import direct"** (icône download)
6. Attendre la confirmation

### Étape 4: Vérifier les données importées

Ouvrir la console et chercher les logs:

```
📦 Données complètes de Supabase:
  registration: F-HSTR
  manufacturer: Diamond Aircraft
  aircraftType: Airplane
  category: SEP
  fuelType: JET-A1
  fuelCapacity: 148
  hasPhoto: true
  surfaces: ["ASPH", "CONC"]

✅ Avion créé avec:
  registration: F-HSTR
  manufacturer: Diamond Aircraft
  aircraftType: Airplane
  category: SEP
  fuelType: JET-A1
  hasPhoto: true
```

### Étape 5: Vérifier l'affichage dans l'interface

Aller dans **"Gestion Avions"** → Sélectionner F-HSTR → Onglet "Infos de base":

**Section 1 doit afficher:**
- ✅ Registration: F-HSTR
- ✅ Model: DA40NG
- ✅ Manufacturer: Diamond Aircraft
- ✅ Type: Airplane
- ✅ Category: SEP
- ✅ Fuel Type: JET-A1
- ✅ Fuel Capacity: 148
- ✅ Fuel Consumption: 26
- ✅ Photo: Visible
- ✅ Surfaces compatibles: ASPH, CONC
- ✅ Performances: Visibles

## 🔍 Débogage

### Si les données ne s'affichent toujours pas

1. **Ouvrir la console DevTools**
2. **Chercher les logs d'import**:
   ```
   📦 Données complètes de Supabase
   ✅ Avion créé avec
   ```

3. **Vérifier l'objet avion**:
   ```javascript
   // Dans la console
   const aircraft = JSON.parse(localStorage.getItem('aircraft-storage'));
   console.log(aircraft.state.aircraftList[0]);
   ```

4. **Vérifier les champs**:
   ```javascript
   const plane = aircraft.state.aircraftList[0];
   console.log({
     manufacturer: plane.manufacturer,
     aircraftType: plane.aircraftType,
     category: plane.category,
     fuelType: plane.fuelType,
     hasPhoto: !!plane.photo,
     surfaces: plane.compatibleRunwaySurfaces
   });
   ```

### Si un champ est undefined

Vérifier dans Supabase que `aircraft_data` contient bien le champ:

```javascript
// Test dans la console après import
const plane = aircraft.state.aircraftList[0];
console.log('Keys:', Object.keys(plane));
```

## 📊 Supabase: Vérifier aircraft_data

Dashboard Supabase: https://supabase.com/dashboard/project/bgmscwckawgybymbimga/editor

1. Table `community_presets`
2. Ligne F-HSTR (ID: `0bda59c9-61bc-4a29-bacf-115159957607`)
3. Colonne `aircraft_data` (JSONB)
4. Vérifier que tous les champs sont présents:
   - `manufacturer`: "Diamond Aircraft"
   - `aircraftType`: "Airplane"
   - `category`: "SEP"
   - `fuelType`: "JET-A1"
   - `fuelCapacity`: 148
   - `photo`: (base64 string)
   - `compatibleRunwaySurfaces`: ["ASPH", "CONC"]

## 🛠️ Scripts de vérification

### Vérifier les données dans Supabase

```bash
cd D:\Applicator\alflight
node scripts/check-fhstr-data.cjs
```

### Re-enrichir et mettre à jour

```bash
node scripts/enrich-fhstr.cjs
node scripts/update-supabase-fhstr.js
```

## ✅ Checklist complète

- [ ] localStorage nettoyé
- [ ] Module Aircraft vide (0 avions)
- [ ] F-HSTR importé depuis Supabase
- [ ] Logs dans la console affichent les bonnes données
- [ ] Section 1 affiche tous les champs
- [ ] Photo visible
- [ ] Surfaces compatibles visibles
- [ ] Performances visibles

## 🔗 Liens

- **App**: http://localhost:4002
- **Supabase**: https://supabase.com/dashboard/project/bgmscwckawgybymbimga
- **Google Sheets**: https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k

---

**Date**: 2025-10-07
**Version**: 2.0.0 - Import complet depuis Supabase
