# 🔄 Duplication d'Avion - Guide Rapide

## 🎯 Objectif

Dupliquer un avion existant dans Supabase pour créer un nouvel avion complètement différent, en utilisant les données de l'avion source comme point de départ.

## ⚡ Utilisation Rapide (Console du Navigateur)

### Étape 1: Ouvrir la Console

1. Ouvrir votre application dans le navigateur
2. Appuyer sur **F12** pour ouvrir les outils développeur
3. Aller dans l'onglet **Console**

### Étape 2: Charger le Script

Dans la console, taper:

```javascript
// Charger le script de duplication
const script = document.createElement('script');
script.type = 'module';
script.src = '/scripts/quick-duplicate.js';
document.head.appendChild(script);
```

### Étape 3: Lister les Avions

```javascript
await listerAvions()
```

Cela affiche un tableau avec tous vos avions et leur index.

### Étape 4: Dupliquer

```javascript
// Dupliquer l'avion à l'index 0 avec une nouvelle immatriculation
await dupliquerAvion(0, 'F-ABCD')

// OU avec un nouveau modèle
await dupliquerAvion(0, 'F-GEEK', 'DR400-180', 'Robin')
```

## 📝 Exemples Concrets

### Exemple 1: Copier F-HSTR vers F-ABCD (même configuration)

```javascript
await listerAvions()  // Voir que F-HSTR est à l'index 0
await dupliquerAvion(0, 'F-ABCD')
```

✅ Résultat: Nouvel avion F-ABCD avec exactement la même configuration que F-HSTR

### Exemple 2: Créer un DR400 basé sur F-HSTR

```javascript
await listerAvions()
await dupliquerAvion(0, 'F-GEEK', 'DR400-180', 'Robin')
```

✅ Résultat: Nouvel avion F-GEEK (DR400-180) avec la configuration de masse/centrage/performances de F-HSTR

### Exemple 3: Duplication Avancée avec Modifications

```javascript
await dupliquerAvionAvance(0, {
  registration: 'F-TECH',
  model: 'PA-28-161',
  manufacturer: 'Piper',
  category: 'SEP',
  overrides: {
    weights: {
      emptyWeight: '650',
      maxWeight: '1157',
      maxBaggage: '100'
    },
    fuel: {
      capacity: 190,
      unusable: 7,
      type: 'AVGAS'
    }
  }
})
```

✅ Résultat: Nouvel avion F-TECH avec masse et carburant personnalisés

## 🎨 Utilisation Interface Graphique

Si vous préférez une interface graphique, le composant `AircraftDuplicator` peut être intégré dans votre application.

**Fichier:** `src/features/aircraft/components/AircraftDuplicator.jsx`

Il fournit:
- ✅ Liste déroulante des avions disponibles
- ✅ Formulaire de saisie des nouvelles informations
- ✅ Validation automatique
- ✅ Gestion des erreurs

## 📋 Ce qui est Dupliqué

Toutes les données de l'avion source sont copiées:

- ✅ Configuration de masse et centrage
- ✅ Enveloppe CG (graphique)
- ✅ Performances (décollage, atterrissage)
- ✅ Configuration carburant
- ✅ Positions des sièges et bagages
- ✅ MANEX (manuel d'exploitation)
- ✅ Photo de l'avion
- ✅ Métadonnées d'unités

## ⚙️ Ce qui est Modifié

Les champs suivants sont automatiquement nettoyés/modifiés:

- ❌ ID de l'avion (nouvel ID généré)
- ❌ ID du preset communautaire
- ✏️ Immatriculation (celle que vous spécifiez)
- ✏️ Modèle (si spécifié)
- ✏️ Constructeur (si spécifié)
- ✏️ Catégorie (si spécifiée)

## 🔧 Modification Post-Duplication

Après duplication, vous pouvez modifier toutes les données dans l'éditeur d'avion:

1. Sélectionner le nouvel avion dans la liste
2. Ouvrir l'éditeur d'avion
3. Modifier les données souhaitées:
   - Masse à vide
   - Positions CG
   - Performances
   - Carburant
   - etc.

## ⚠️ Points Importants

1. **Immatriculation Unique**: L'immatriculation doit être unique. Si elle existe déjà, la duplication échouera.

2. **Connexion Supabase**: Vous devez être connecté à Supabase. Vérifier que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont configurés.

3. **Rechargement**: Après duplication, rechargez la page ou actualisez la liste des avions pour voir le nouvel avion.

## 🆘 Aide et Dépannage

### Commande d'Aide

```javascript
aide()  // Affiche l'aide complète dans la console
```

### Erreurs Communes

**Erreur: "Avion source non trouvé"**
- Solution: Vérifier l'index avec `listerAvions()`

**Erreur: "L'immatriculation doit être unique"**
- Solution: Choisir une immatriculation différente

**Erreur: "ERREUR CONNEXION SUPABASE"**
- Solution: Vérifier les variables d'environnement Supabase

### Debug

```javascript
// Voir les avions disponibles
await listerAvions()

// Voir les détails d'un avion
console.log(window.__aircrafts[0])
```

## 📂 Fichiers Créés

Pour cette fonctionnalité, les fichiers suivants ont été créés:

1. **Utilitaire Principal**
   - `src/utils/duplicateAircraft.js`
   - Contient les fonctions de duplication

2. **Composant UI**
   - `src/features/aircraft/components/AircraftDuplicator.jsx`
   - Interface graphique pour duplication

3. **Script Console**
   - `scripts/quick-duplicate.js`
   - Script rapide pour console navigateur

4. **Documentation**
   - `DUPLICATION_GUIDE.md` - Guide complet
   - `README_DUPLICATION.md` - Ce fichier (guide rapide)

## 📞 Support

Pour plus de détails, consulter `DUPLICATION_GUIDE.md`.

## 🚀 Démarrage Rapide (Résumé)

```javascript
// 1. Charger le script (une seule fois)
const script = document.createElement('script');
script.type = 'module';
script.src = '/scripts/quick-duplicate.js';
document.head.appendChild(script);

// 2. Lister les avions
await listerAvions()

// 3. Dupliquer (remplacer 0 par l'index voulu)
await dupliquerAvion(0, 'F-XXXX')

// 4. C'est tout! 🎉
```

---

**Version:** 1.0.0
**Date:** 2025-10-28
**Auteur:** Claude Code
