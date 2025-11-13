# Configuration Supabase pour Cartes VAC

Guide complet pour configurer le système de stockage automatisé des cartes VAC avec Supabase.

## 📋 Prérequis

- Compte Supabase (gratuit sur https://supabase.com)
- Node.js et npm installés
- Variables d'environnement configurées dans `.env`

## 🚀 Étape 1 : Configuration Supabase

### 1.1 Créer un projet Supabase

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Noter l'URL du projet et la clé API (anon/public)

### 1.2 Configurer les variables d'environnement

Éditer le fichier `.env` :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 1.3 Exécuter le script SQL

1. Aller dans l'interface Supabase > **SQL Editor**
2. Copier le contenu de `supabase-vac-charts-setup.sql`
3. Coller et **Run** le script
4. Vérifier que les tables sont créées :
   - `vac_charts`
   - `vac_download_history`

### 1.4 Créer le bucket de stockage

1. Aller dans **Storage**
2. Cliquer **New bucket**
3. Paramètres :
   - **Name**: `vac-charts`
   - **Public**: ✅ Oui (pour permettre l'accès direct aux fichiers)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `application/pdf`, `image/png`, `image/jpeg`

4. Cliquer **Create bucket**

### 1.5 Configurer les politiques de stockage

Aller dans **Storage** > `vac-charts` > **Policies** :

#### Politique 1 : Lecture publique

```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'vac-charts' );
```

#### Politique 2 : Upload par tous

```sql
CREATE POLICY "Anyone can upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'vac-charts' );
```

#### Politique 3 : Update par propriétaire

```sql
CREATE POLICY "Anyone can update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'vac-charts' );
```

## 📦 Étape 2 : Installation des dépendances

Si pas déjà installé :

```bash
npm install @supabase/supabase-js
```

## 🧪 Étape 3 : Tester la connexion

Ouvrir la console développeur dans l'application et vérifier :

```javascript
import { checkSupabaseConnection } from './lib/supabaseClient';
await checkSupabaseConnection();
// Doit afficher : ✅ Connexion Supabase OK
```

## 📖 Utilisation du service VAC

### Importer une carte VAC

```javascript
import { vacSupabaseService } from './services/vacSupabaseService';

// File provient d'un input type="file"
const file = event.target.files[0];
const icao = 'LFST';

const result = await vacSupabaseService.uploadVACChart(icao, file, {
  aerodromeName: 'Strasbourg-Entzheim',
  effectiveDate: '2025-01-25',
  expirationDate: '2025-02-22',
  airacCycle: '2025-01',
  source: 'sia',
  uploadedBy: 'user@example.com'
});

if (result.success) {
  console.log('✅ Carte VAC uploadée:', result.publicUrl);
} else {
  console.error('❌ Erreur:', result.error);
}
```

### Télécharger une carte VAC

```javascript
const result = await vacSupabaseService.downloadVACChart('LFST');

if (result.success) {
  console.log('Carte VAC:', result.chart);
  console.log('URL:', result.publicUrl);
  // Ouvrir dans nouvel onglet
  window.open(result.publicUrl, '_blank');
}
```

### Lister toutes les cartes

```javascript
const result = await vacSupabaseService.getAllVACCharts({
  validOnly: true,    // Seulement les cartes valides
  verifiedOnly: true  // Seulement les cartes vérifiées
});

console.log('Cartes disponibles:', result.charts);
```

### Vérifier si une carte existe

```javascript
const exists = await vacSupabaseService.hasVACChart('LFST');
console.log('Carte VAC existe:', exists);
```

## 🔄 Maintenance automatique

### Archiver les cartes expirées

Exécuter périodiquement (par exemple, tous les jours) :

```javascript
const result = await vacSupabaseService.archiveExpiredCharts();
console.log(`${result.archivedCount} cartes archivées`);
```

Ou configurerun cron job Supabase (Edge Functions) pour automatiser.

## 📊 Structure de la base de données

### Table `vac_charts`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `icao` | VARCHAR(4) | Code ICAO (unique) |
| `aerodrome_name` | VARCHAR(255) | Nom de l'aérodrome |
| `file_name` | VARCHAR(255) | Nom du fichier |
| `file_path` | TEXT | Chemin dans le bucket |
| `file_size` | BIGINT | Taille en octets |
| `mime_type` | VARCHAR(100) | Type MIME |
| `checksum_md5` | VARCHAR(32) | Checksum pour intégrité |
| `chart_type` | VARCHAR(50) | Type de carte (VAC, SID, STAR, etc.) |
| `effective_date` | DATE | Date d'entrée en vigueur |
| `expiration_date` | DATE | Date d'expiration |
| `airac_cycle` | VARCHAR(10) | Cycle AIRAC |
| `source` | VARCHAR(50) | Source (manual, sia, jeppesen) |
| `download_url` | TEXT | URL publique du fichier |
| `uploaded_by` | VARCHAR(100) | Uploadé par |
| `download_count` | INTEGER | Nombre de téléchargements |
| `status` | VARCHAR(20) | active, expired, archived |
| `verified` | BOOLEAN | Vérifié par la communauté |
| `admin_verified` | BOOLEAN | Vérifié par un admin |

### Vue `vac_charts_active`

Vue automatique avec statuts de validité :
- `valid` : Carte valide
- `expiring_soon` : Expire dans moins de 7 jours
- `expired` : Carte expirée

## 🔐 Sécurité

- Les fichiers sont stockés dans un bucket **public** pour faciliter l'accès
- Les métadonnées sont protégées par RLS (Row Level Security)
- Les checksums MD5 permettent de vérifier l'intégrité des fichiers
- Historique complet des téléchargements

## 🐛 Dépannage

### Erreur "bucket not found"

Vérifier que le bucket `vac-charts` existe dans **Storage**.

### Erreur "Policy does not allow"

Vérifier les politiques RLS dans **Storage** > `vac-charts` > **Policies**.

### Erreur "Variables d'environnement manquantes"

Vérifier que `.env` contient :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Connexion échoue

Tester avec :
```javascript
import { checkSupabaseConnection } from './lib/supabaseClient';
await checkSupabaseConnection();
```

## 📚 Ressources

- Documentation Supabase : https://supabase.com/docs
- Supabase Storage : https://supabase.com/docs/guides/storage
- API JavaScript : https://supabase.com/docs/reference/javascript

## 🎯 Prochaines étapes

1. Implémenter un système de synchronisation automatique depuis SIA
2. Ajouter un système de notifications pour les cartes expirées
3. Créer une interface d'administration pour gérer les cartes
4. Ajouter un système de versioning des cartes VAC
5. Implémenter un cache local avec Service Workers
