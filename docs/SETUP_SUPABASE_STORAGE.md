# Configuration Supabase Storage pour MANEX

## Création du bucket `manex-files`

Le bucket Supabase Storage doit être créé **manuellement** depuis le dashboard Supabase car la clé `anon` ne dispose pas des permissions pour créer des buckets.

### Étapes:

1. **Aller sur le dashboard Supabase**
   - URL: https://app.supabase.com/project/bgmscwckawgybymbimga/storage/buckets

2. **Créer un nouveau bucket**
   - Cliquer sur "New Bucket"
   - Nom: `manex-files`
   - Public: ✅ **Coché** (les fichiers doivent être accessibles publiquement)

3. **Configuration du bucket** (optionnel)
   - Taille maximale de fichier: `50 MB` (52428800 octets)
   - Types MIME autorisés: `application/pdf`

4. **Politiques RLS (Row Level Security)**

   Le bucket nécessite les politiques suivantes pour permettre l'upload et la lecture:

   ### Politique 1: Permettre l'upload de fichiers
   ```sql
   CREATE POLICY "Allow authenticated uploads"
   ON storage.objects FOR INSERT
   TO authenticated, anon
   WITH CHECK (bucket_id = 'manex-files');
   ```

   ### Politique 2: Permettre la lecture publique
   ```sql
   CREATE POLICY "Allow public access"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'manex-files');
   ```

   ### Politique 3: Permettre la mise à jour (upsert)
   ```sql
   CREATE POLICY "Allow upsert"
   ON storage.objects FOR UPDATE
   TO authenticated, anon
   USING (bucket_id = 'manex-files')
   WITH CHECK (bucket_id = 'manex-files');
   ```

5. **Vérification**

   Une fois le bucket créé, vous pouvez vérifier qu'il existe avec:
   ```bash
   curl -s -X GET "https://bgmscwckawgybymbimga.supabase.co/storage/v1/bucket" \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_ANON_KEY"
   ```

   Vous devriez voir `manex-files` dans la liste des buckets.

## Structure des fichiers

Les fichiers MANEX sont stockés avec la structure suivante:
```
manex-files/
  └── [IMMATRICULATION]/
      └── [IMMATRICULATION] - manex.pdf
```

Exemple:
```
manex-files/
  └── F-HSTR/
      └── F-HSTR - manex.pdf
```

## Upload depuis l'application

Une fois le bucket créé, l'application peut uploader des fichiers MANEX:

1. **Depuis le wizard de création d'avion** (Step 1 - Informations générales)
   - Importer un fichier MANEX
   - Cliquer sur "Uploader sur Supabase"

2. **Depuis la fiche avion** (Module Aircraft)
   - Cliquer sur le bouton MANEX
   - Importer un fichier MANEX
   - Cliquer sur "Uploader sur Supabase"

## Dépannage

### Erreur: "new row violates row-level security policy"
- Vérifiez que les politiques RLS sont bien créées
- Vérifiez que le bucket est public

### Erreur: "Bucket not found"
- Vérifiez que le bucket `manex-files` existe bien dans le dashboard
- Vérifiez l'URL du projet Supabase dans `.env`

### Erreur: "File size limit exceeded"
- Les fichiers PDF doivent faire moins de 50 MB
- Réduisez la taille du PDF si nécessaire
