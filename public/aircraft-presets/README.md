# Avions Pré-enregistrés

Ce dossier contient les avions pré-configurés disponibles au téléchargement pour les utilisateurs.

## Structure

### 1. Fichiers JSON
Chaque avion doit avoir un fichier JSON avec toutes les données de configuration.

### 2. Fichiers MANEX (PDFs)
Les fichiers PDF des MANEX doivent être hébergés et accessibles via URL.

## Format du JSON avec MANEX distant

```json
{
  "aircraftData": {
    "id": "aircraft_f-hstr_preset",
    "registration": "F-HSTR",
    "model": "DA40 NG",
    "manufacturer": "Diamond",
    "manex": {
      "fileName": "MANEX DA40NG V2.0 - VERSION FINALE.pdf",
      "fileSize": "11.82 MB",
      "uploadDate": "2025-10-05T10:00:00.000Z",
      "remoteUrl": "https://votre-serveur.com/manex/da40ng-v2.0.pdf"
    },
    "hasManex": true,
    "performanceModels": [...]
  }
}
```

## Hébergement des MANEX

### Option 1: GitHub (Recommandé pour démarrage)
- Créer un repository public ou utiliser GitHub Releases
- URL: `https://raw.githubusercontent.com/username/repo/main/manex/da40ng.pdf`

### Option 2: Serveur dédié
- Héberger sur votre propre serveur
- URL: `https://votre-domaine.com/manex/da40ng.pdf`
- **Important**: Configurer les en-têtes CORS:
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET
  ```

### Option 3: Service cloud (S3, Google Cloud Storage, Azure)
- Créer un bucket public
- Générer des URLs publiques pour chaque PDF

## Workflow

1. **Création d'un avion pré-enregistré**:
   - Configurer l'avion dans l'application
   - Exporter le JSON via "Exporter la configuration"
   - Uploader le PDF du MANEX sur votre hébergement
   - Ajouter `remoteUrl` dans le champ `manex` du JSON
   - Placer le JSON dans ce dossier

2. **Import par l'utilisateur**:
   - L'utilisateur importe le JSON
   - Le MANEX s'affiche avec un message "⚠️ Fichier PDF non chargé"
   - Un clic sur "Récupérer le PDF" télécharge automatiquement depuis `remoteUrl`
   - Le PDF est sauvegardé localement dans IndexedDB

## Exemple complet

Voir `da40ng-example.json` pour un exemple complet d'avion pré-configuré.
