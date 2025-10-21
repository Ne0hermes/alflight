-- =====================================================
-- FIX STORAGE POLICIES - Permettre lecture publique des photos
-- =====================================================

-- Supprimer les anciennes policies du bucket vfr-points-photos
DROP POLICY IF EXISTS "Public read access on vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public upload on vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete on vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;

-- POLICY 1: Lecture publique (TRÈS IMPORTANT)
CREATE POLICY "Public read vfr-points-photos" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'vfr-points-photos');

-- POLICY 2: Upload public
CREATE POLICY "Public upload vfr-points-photos" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'vfr-points-photos');

-- POLICY 3: Update public
CREATE POLICY "Public update vfr-points-photos" ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'vfr-points-photos')
  WITH CHECK (bucket_id = 'vfr-points-photos');

-- POLICY 4: Delete public (mode dev)
CREATE POLICY "Public delete vfr-points-photos" ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'vfr-points-photos');

-- Vérifier les policies du bucket
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%vfr-points-photos%'
ORDER BY policyname;

-- =====================================================
-- Instructions
-- =====================================================

/*
POUR APPLIQUER CETTE CORRECTION :

1. Connectez-vous à Supabase : https://app.supabase.com
2. SQL Editor → New query
3. Copiez-collez TOUT ce fichier
4. Cliquez sur RUN

RÉSULTAT ATTENDU :
Vous devriez voir 4 policies listées :
- Public read vfr-points-photos (SELECT)
- Public upload vfr-points-photos (INSERT)
- Public update vfr-points-photos (UPDATE)
- Public delete vfr-points-photos (DELETE)

APRÈS CETTE CORRECTION :
- Les images seront accessibles publiquement
- Vous pourrez les uploader sans authentification
- Les images s'afficheront dans les cartes de points

TESTER :
1. Allez dans Storage → vfr-points-photos
2. Cliquez sur une image
3. Cliquez sur "Copy URL"
4. Collez l'URL dans un nouvel onglet
5. L'image doit s'afficher ✅

Si l'image ne s'affiche toujours pas, vérifiez que le bucket
est bien configuré comme PUBLIC :
Storage → vfr-points-photos → Settings → "Public bucket" = OUI
*/
