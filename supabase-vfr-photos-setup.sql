-- =====================================================
-- CONFIGURATION du stockage de photos pour les points VFR
-- Ajout de la colonne photo_url et configuration Storage
-- =====================================================

-- Ajouter la colonne photo_url
ALTER TABLE vfr_points
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Créer un index pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_vfr_points_photo_url ON vfr_points(photo_url);

-- Ajouter un commentaire descriptif
COMMENT ON COLUMN vfr_points.photo_url IS 'URL publique de la photo du point VFR (stockée dans Supabase Storage)';

-- Mettre à jour le vecteur de recherche pour tous les points existants
UPDATE vfr_points SET updated_at = updated_at;  -- Force le trigger

-- =====================================================
-- Instructions de configuration Supabase Storage
-- =====================================================

/*
ÉTAPE 1 : EXÉCUTER CE SCRIPT SQL

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Allez dans "SQL Editor"
3. Créez une nouvelle query
4. Copiez-collez TOUT ce fichier SQL
5. Cliquez sur "Run"


ÉTAPE 2 : CRÉER LE BUCKET STORAGE

1. Allez dans "Storage" dans le menu latéral
2. Cliquez sur "Create a new bucket"
3. Nom du bucket : vfr-points-photos
4. Public bucket : OUI (cochez la case)
5. Cliquez sur "Create bucket"


ÉTAPE 3 : CONFIGURER LES POLICIES DU BUCKET

1. Cliquez sur le bucket "vfr-points-photos"
2. Allez dans l'onglet "Policies"
3. Cliquez sur "New Policy"

Policy 1 - Lecture publique :
- Policy name : Public Access
- Allowed operation : SELECT
- Target roles : public
- USING expression : true

Policy 2 - Upload par tous (ou authentifiés seulement) :
- Policy name : Public Upload
- Allowed operation : INSERT
- Target roles : public (ou authenticated si vous voulez restreindre)
- USING expression : true

Policy 3 - Suppression par propriétaire :
- Policy name : Owner Delete
- Allowed operation : DELETE
- Target roles : authenticated
- USING expression : (bucket_id = 'vfr-points-photos'::text)


ALTERNATIVE : POLICIES SQL

Si vous préférez créer les policies via SQL, allez dans SQL Editor et exécutez :

-- Politique de lecture publique
CREATE POLICY "Public read access on vfr-points-photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vfr-points-photos');

-- Politique d'upload public (ou authenticated seulement)
CREATE POLICY "Public upload on vfr-points-photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'vfr-points-photos');

-- Politique de suppression par propriétaire
CREATE POLICY "Authenticated delete on vfr-points-photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vfr-points-photos');


ÉTAPE 4 : TESTER

Une fois configuré, l'application pourra :
- Uploader des photos lors de la création/modification d'un point VFR
- Afficher les photos dans les cartes de points
- Supprimer les photos lors de la suppression d'un point

FORMAT D'IMAGES SUPPORTÉS :
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- Taille max recommandée : 5 MB

STRUCTURE DES URLS :
https://[votre-projet].supabase.co/storage/v1/object/public/vfr-points-photos/[nom-fichier]


RETOUR ARRIÈRE (si nécessaire) :

Pour supprimer la colonne photo_url :
ALTER TABLE vfr_points DROP COLUMN IF EXISTS photo_url;
DROP INDEX IF EXISTS idx_vfr_points_photo_url;

Pour supprimer le bucket (via l'interface Supabase Storage) :
1. Allez dans Storage
2. Sélectionnez "vfr-points-photos"
3. Cliquez sur les 3 points > Delete bucket
*/
