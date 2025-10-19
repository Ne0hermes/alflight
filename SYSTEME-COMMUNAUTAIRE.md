# 🌍 Système Communautaire de Presets d'Avions

## 🎯 Objectif

Permettre aux utilisateurs de :
1. **Soumettre** leurs configurations d'avions avec MANEX
2. **Parcourir** les presets créés par la communauté
3. **Télécharger** des avions complets (données + MANEX)
4. **Modifier localement** selon leurs besoins

---

## 🏗️ Architecture complète (À développer)

### Backend nécessaire

#### 1. Serveur API
```javascript
// Node.js + Express + MongoDB/PostgreSQL

// Routes principales
POST   /api/presets/submit          // Soumettre un preset
GET    /api/presets/search          // Rechercher des presets
GET    /api/presets/:id             // Détails d'un preset
GET    /api/presets/:id/download    // Télécharger le JSON
GET    /api/manex/:id               // Télécharger le MANEX
POST   /api/presets/:id/vote        // Voter pour un preset
POST   /api/presets/:id/report      // Signaler un problème
```

#### 2. Stockage
- **Base de données** : Métadonnées des presets
- **Object Storage** (S3/Azure/GCS) : Fichiers MANEX
- **CDN** : Distribution rapide des fichiers

#### 3. Modération
- Validation des presets soumis
- Vérification des MANEX
- Système de votes/ratings
- Signalement de problèmes

---

## 🚀 Solution temporaire (Sans backend)

En attendant le développement du backend, utiliser **GitHub comme plateforme communautaire**.

### Repository structure
```
alflight-presets-community/
├── presets/
│   ├── da40ng/
│   │   ├── preset-ne0hermes-v1.json
│   │   └── preset-johndoe-v2.json
│   ├── c172/
│   │   └── preset-janedoe-v1.json
│   └── pa28/
│       └── preset-pilot123-v1.json
├── manex/
│   ├── da40ng/
│   │   ├── MANEX_DA40NG_V2.0.pdf
│   │   └── MANEX_DA40NG_V1.5.pdf
│   ├── c172/
│   │   └── MANEX_C172_V3.1.pdf
│   └── pa28/
│       └── MANEX_PA28_V2.0.pdf
└── README.md
```

### Workflow utilisateur (temporaire)

#### Pour soumettre un preset :
1. Configurer l'avion dans ALFlight
2. Exporter le JSON
3. Créer une Pull Request sur GitHub avec :
   - Le fichier JSON dans `presets/MODELE/`
   - Le fichier MANEX dans `manex/MODELE/`
4. Attendre validation et merge

#### Pour télécharger un preset :
1. Aller sur GitHub
2. Parcourir les dossiers
3. Télécharger le JSON
4. Importer dans ALFlight
5. Le MANEX se télécharge automatiquement

---

## 💡 Solution recommandée : Backend simple

### Stack technique suggérée

#### Option 1 : Supabase (Recommandé - Gratuit jusqu'à 500 MB)
```javascript
// Avantages :
- ✅ Backend prêt à l'emploi
- ✅ Base de données PostgreSQL
- ✅ Stockage de fichiers
- ✅ API REST automatique
- ✅ Authentification intégrée
- ✅ Gratuit jusqu'à 500 MB

// Configuration :
1. Créer compte sur supabase.com
2. Créer projet "alflight-presets"
3. Créer table "presets"
4. Créer bucket "manex-files"
5. Intégrer dans ALFlight
```

#### Option 2 : Firebase (Google - Gratuit jusqu'à 1 GB)
```javascript
// Avantages :
- ✅ Backend complet
- ✅ Firestore (NoSQL)
- ✅ Storage pour fichiers
- ✅ Hosting gratuit
- ✅ CDN mondial

// Configuration similaire à Supabase
```

#### Option 3 : Backend custom (Node.js)
```javascript
// Plus de contrôle mais plus de travail
// Stack : Node.js + Express + PostgreSQL + S3
```

---

## 📋 Schéma de base de données

### Table: presets
```sql
CREATE TABLE presets (
  id UUID PRIMARY KEY,
  aircraft_model VARCHAR(100),
  registration VARCHAR(20),
  manufacturer VARCHAR(100),
  submitted_by VARCHAR(100),
  submitted_at TIMESTAMP,
  version VARCHAR(20),
  description TEXT,
  json_data JSONB,
  manex_file_id UUID,
  manex_remote_url TEXT,
  downloads_count INTEGER DEFAULT 0,
  votes_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  tags TEXT[]
);

CREATE INDEX idx_aircraft_model ON presets(aircraft_model);
CREATE INDEX idx_submitted_by ON presets(submitted_by);
CREATE INDEX idx_status ON presets(status);
```

### Table: manex_files
```sql
CREATE TABLE manex_files (
  id UUID PRIMARY KEY,
  filename VARCHAR(255),
  file_size BIGINT,
  file_path TEXT,
  uploaded_by VARCHAR(100),
  uploaded_at TIMESTAMP,
  checksum VARCHAR(64)
);
```

---

## 🎨 Interface dans ALFlight

### Nouveau composant : PresetBrowser

```jsx
// src/features/aircraft/components/PresetBrowser.jsx

const PresetBrowser = () => {
  return (
    <div>
      <h2>📚 Presets Communautaires</h2>

      {/* Recherche */}
      <SearchBar
        placeholder="Rechercher un modèle d'avion..."
        onSearch={handleSearch}
      />

      {/* Filtres */}
      <Filters>
        <Select label="Constructeur">
          <option>Diamond</option>
          <option>Cessna</option>
          <option>Piper</option>
        </Select>
        <Select label="Trier par">
          <option>Plus récents</option>
          <option>Plus téléchargés</option>
          <option>Mieux notés</option>
        </Select>
      </Filters>

      {/* Liste des presets */}
      <PresetList>
        {presets.map(preset => (
          <PresetCard
            key={preset.id}
            model={preset.aircraft_model}
            registration={preset.registration}
            author={preset.submitted_by}
            downloads={preset.downloads_count}
            hasManex={!!preset.manex_file_id}
            onDownload={() => handleDownload(preset.id)}
          />
        ))}
      </PresetList>
    </div>
  );
};
```

### Intégration dans le wizard

```jsx
// Étape 0 du wizard : Choix
<div>
  <h2>Créer ou importer un avion</h2>

  <button onClick={() => setMode('browse-presets')}>
    📚 Parcourir les presets communautaires
  </button>

  <button onClick={() => setMode('create-new')}>
    ✏️ Créer un nouvel avion
  </button>

  <button onClick={() => setMode('import-file')}>
    📥 Importer depuis un fichier
  </button>
</div>
```

---

## 🔐 Sécurité et modération

### Validation des presets
```javascript
// Vérifications automatiques
- Taille du MANEX < 50 MB
- Format PDF valide
- JSON bien formé
- Champs obligatoires présents
- Pas de scripts malveillants

// Modération manuelle
- Queue de validation
- Approbation par admin
- Possibilité de rejeter avec raison
```

### Protection contre abus
```javascript
- Rate limiting (max 5 soumissions/jour/utilisateur)
- Authentification requise
- Validation email
- Système de réputation
- Signalement par la communauté
```

---

## 📊 Prochaines étapes

### Phase 1 : MVP avec Supabase (1-2 semaines)
1. Créer compte Supabase
2. Configurer la base de données
3. Créer le composant PresetBrowser
4. API pour lister/télécharger presets
5. Upload basique de presets

### Phase 2 : Fonctionnalités avancées (2-4 semaines)
1. Système de votes
2. Commentaires
3. Versions multiples
4. Recherche avancée
5. Tags et catégories

### Phase 3 : Modération (1-2 semaines)
1. Interface admin
2. Queue de validation
3. Système de signalement
4. Statistiques

---

## 💰 Coûts estimés

### Option gratuite (Supabase/Firebase)
- 0€ jusqu'à 500 MB de stockage
- 0€ jusqu'à 50 GB de bande passante/mois
- Suffisant pour ~40 avions avec MANEX

### Option payante (si croissance)
- ~5-10€/mois pour 5 GB de stockage
- ~10-20€/mois pour serveur dédié
- Scaling automatique

---

## 🚀 Voulez-vous que je commence l'implémentation ?

Je peux créer :
1. Le compte Supabase et la configuration
2. Le composant PresetBrowser
3. L'API pour upload/download
4. L'intégration dans le wizard

Dites-moi si vous voulez commencer !
