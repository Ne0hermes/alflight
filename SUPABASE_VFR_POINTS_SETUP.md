# Configuration de la Table VFR Points dans Supabase

## 🎯 Objectif

Ce guide vous explique comment créer la table `vfr_points` dans votre base de données Supabase pour permettre le partage de points VFR communautaires.

## 📋 Prérequis

- Un compte Supabase actif
- Un projet Supabase créé
- Les variables d'environnement configurées dans `.env` :
  ```
  VITE_SUPABASE_URL=votre_url_supabase
  VITE_SUPABASE_ANON_KEY=votre_clé_anon
  ```

## 🚀 Installation Rapide

### Étape 1 : Accéder au SQL Editor

1. Connectez-vous à [Supabase](https://app.supabase.com)
2. Sélectionnez votre projet
3. Dans le menu latéral, cliquez sur **"SQL Editor"**

### Étape 2 : Exécuter le Script SQL

1. Cliquez sur **"New query"**
2. Ouvrez le fichier `supabase-vfr-points-setup.sql`
3. **Copiez TOUT le contenu** du fichier
4. **Collez-le** dans l'éditeur SQL de Supabase
5. Cliquez sur **"Run"** (en bas à droite)

### Étape 3 : Vérification

Vérifiez que la table a été créée :

1. Allez dans **"Table Editor"** dans le menu latéral
2. Vous devriez voir la table **`vfr_points`**
3. Cliquez dessus pour voir les colonnes et les données de test (5 points)

## 📊 Structure de la Table

La table `vfr_points` contient les colonnes suivantes :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique (auto-généré) |
| `name` | VARCHAR(255) | Nom du point VFR |
| `type` | VARCHAR(50) | Type : VRP, Landmark, Turning Point, Reporting Point |
| `lat` | DOUBLE PRECISION | Latitude (obligatoire) |
| `lon` | DOUBLE PRECISION | Longitude (obligatoire) |
| `altitude` | INTEGER | Altitude en pieds (optionnel) |
| `description` | TEXT | Description du point |
| `aerodrome` | VARCHAR(10) | Code OACI de l'aérodrome associé |
| `is_public` | BOOLEAN | Visibilité publique (true par défaut) |
| `status` | VARCHAR(20) | Statut : active, pending, rejected |
| `uploaded_by` | VARCHAR(100) | ID de l'utilisateur créateur |
| `downloads_count` | INTEGER | Nombre de téléchargements |
| `verified` | BOOLEAN | Point vérifié par modération |
| `created_at` | TIMESTAMP | Date de création |
| `updated_at` | TIMESTAMP | Date de dernière modification |

## 🔒 Sécurité (Row Level Security)

Le script active automatiquement les politiques de sécurité :

- ✅ **Lecture** : Tout le monde peut lire les points publics actifs
- ✅ **Création** : Les utilisateurs authentifiés peuvent créer des points
- ✅ **Modification** : Les utilisateurs peuvent modifier leurs propres points
- ✅ **Suppression** : Les utilisateurs peuvent supprimer leurs propres points

## 🧪 Données de Test

Le script insère 5 points de test pour la France :

1. **Tour Eiffel** (Landmark)
2. **Château de Versailles** (Landmark)
3. **Mont Saint-Michel** (Landmark)
4. **VRP GOLF** (VRP)
5. **Lac d'Annecy** (Landmark)

### Supprimer les données de test

Si vous ne voulez pas garder ces points de test, exécutez dans le SQL Editor :

```sql
DELETE FROM vfr_points WHERE uploaded_by = 'system';
```

## 🎨 Fonctionnalités Incluses

Le script SQL configure automatiquement :

- ✅ **Index** pour optimiser les performances des recherches
- ✅ **Recherche full-text** en français (nom, description, type)
- ✅ **Fonction `increment_vfr_download()`** pour tracker les téléchargements
- ✅ **Vue `vfr_points_stats`** pour voir les statistiques par type
- ✅ **Row Level Security (RLS)** pour la sécurité des données

## 🔧 Utilisation dans l'Application

Une fois la table créée, l'application ALFlight peut :

1. **Créer** des nouveaux points VFR via l'interface
2. **Parcourir** tous les points partagés par la communauté
3. **Rechercher** des points par nom ou description
4. **Sélectionner** des points pour les ajouter aux routes
5. **Tracker** automatiquement les téléchargements

## ⚙️ Configuration Avancée

### Modifier les permissions

Pour ajuster les permissions, allez dans :
`Authentication > Policies > vfr_points`

### Ajouter des colonnes personnalisées

Exemple pour ajouter une colonne de photo :

```sql
ALTER TABLE vfr_points ADD COLUMN photo_url TEXT;
```

### Créer des filtres géographiques

Pour rechercher des points dans une zone géographique :

```sql
SELECT * FROM vfr_points
WHERE lat BETWEEN 48.0 AND 49.0
  AND lon BETWEEN 2.0 AND 3.0
  AND is_public = true
  AND status = 'active';
```

## 🐛 Dépannage

### Erreur : "Could not find the table 'public.vfr_points'"

**Solution** : Assurez-vous que le script SQL a bien été exécuté dans Supabase.

### Erreur : "Permission denied"

**Solution** : Vérifiez les politiques RLS dans `Authentication > Policies`

### Les points ne s'affichent pas

**Solution** : Vérifiez que :
- La table existe dans "Table Editor"
- Il y a des données avec `is_public = true` et `status = 'active'`
- Vos variables d'environnement sont correctes

## 📞 Support

Pour toute question ou problème :
1. Vérifiez les logs dans la console du navigateur (F12)
2. Vérifiez les logs Supabase dans "Logs" > "Postgres Logs"
3. Consultez la documentation Supabase : https://supabase.com/docs

## ✅ Checklist

Avant de continuer, assurez-vous que :

- [ ] Le script SQL a été exécuté sans erreur
- [ ] La table `vfr_points` existe dans "Table Editor"
- [ ] Les 5 points de test sont visibles (ou supprimés si vous ne les voulez pas)
- [ ] Les index et politiques RLS sont créés
- [ ] Les variables d'environnement sont configurées
- [ ] L'application peut se connecter à Supabase (pas d'erreur 404)

🎉 Vous êtes prêt ! L'onglet "Points Communauté" devrait maintenant fonctionner dans l'application ALFlight.
