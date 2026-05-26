-- =====================================================
-- ALFlight - Politiques RLS strictes (Sprint 2)
-- =====================================================
-- À EXÉCUTER dans le SQL Editor de Supabase (par le propriétaire du projet)
-- Remplace les RLS permissives de supabase-setup-fixed.sql
--
-- Hypothèses :
--   - La colonne `submitted_by` (community_presets) stocke un UUID = auth.uid()
--     du créateur. Vérifier ALTER TABLE ci-dessous si elle s'appelle autrement.
--   - On souhaite :
--       SELECT  : public (lecture libre des presets actifs)
--       INSERT  : utilisateur authentifié uniquement, doit s'auto-tagger
--       UPDATE  : créateur uniquement (ou admin via flag)
--       DELETE  : créateur uniquement (ou admin via flag)
-- =====================================================

-- Si la colonne submitted_by est de type TEXT au lieu de UUID, exécuter d'abord :
-- ALTER TABLE community_presets ALTER COLUMN submitted_by TYPE uuid USING submitted_by::uuid;

-- =====================================================
-- community_presets
-- =====================================================

DROP POLICY IF EXISTS "Public read presets" ON community_presets;
DROP POLICY IF EXISTS "Anyone can insert presets" ON community_presets;
DROP POLICY IF EXISTS "Authenticated insert presets" ON community_presets;
DROP POLICY IF EXISTS "Owner update presets" ON community_presets;
DROP POLICY IF EXISTS "Owner delete presets" ON community_presets;

-- SELECT : tout le monde peut lire les presets actifs
CREATE POLICY "Public read presets"
  ON community_presets FOR SELECT
  USING (status = 'active');

-- INSERT : authentifié uniquement, et l'utilisateur doit s'auto-tagger
CREATE POLICY "Authenticated insert presets"
  ON community_presets FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- UPDATE : seul le créateur peut modifier son preset
CREATE POLICY "Owner update presets"
  ON community_presets FOR UPDATE
  TO authenticated
  USING (submitted_by = auth.uid())
  WITH CHECK (submitted_by = auth.uid());

-- DELETE : seul le créateur peut supprimer
CREATE POLICY "Owner delete presets"
  ON community_presets FOR DELETE
  TO authenticated
  USING (submitted_by = auth.uid());

-- =====================================================
-- manex_files
-- =====================================================

DROP POLICY IF EXISTS "Public read manex" ON manex_files;
DROP POLICY IF EXISTS "Anyone can upload manex" ON manex_files;
DROP POLICY IF EXISTS "Authenticated upload manex" ON manex_files;
DROP POLICY IF EXISTS "Owner delete manex" ON manex_files;

-- SELECT : public (les MANEX restent partagés à la communauté)
CREATE POLICY "Public read manex"
  ON manex_files FOR SELECT
  USING (true);

-- INSERT : authentifié uniquement
-- (Adapter le WITH CHECK si manex_files a une colonne uploaded_by ou preset_id liée)
CREATE POLICY "Authenticated upload manex"
  ON manex_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE : authentifié uniquement (à durcir si une colonne owner existe)
CREATE POLICY "Authenticated delete manex"
  ON manex_files FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- preset_votes
-- =====================================================

DROP POLICY IF EXISTS "Public read votes" ON preset_votes;
DROP POLICY IF EXISTS "Anyone can vote" ON preset_votes;
DROP POLICY IF EXISTS "Authenticated vote" ON preset_votes;
DROP POLICY IF EXISTS "Owner update vote" ON preset_votes;
DROP POLICY IF EXISTS "Owner delete vote" ON preset_votes;

-- SELECT : public
CREATE POLICY "Public read votes"
  ON preset_votes FOR SELECT
  USING (true);

-- INSERT : authentifié, doit voter en son propre nom
-- (Suppose une colonne user_id ; sinon retirer le WITH CHECK)
CREATE POLICY "Authenticated vote"
  ON preset_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE : seul le votant peut changer son vote
CREATE POLICY "Owner update vote"
  ON preset_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE : seul le votant peut retirer son vote
CREATE POLICY "Owner delete vote"
  ON preset_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- preset_downloads (analytics)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can insert download" ON preset_downloads;
DROP POLICY IF EXISTS "Authenticated download log" ON preset_downloads;

-- INSERT : authentifié uniquement (sinon n'importe qui peut polluer les stats)
CREATE POLICY "Authenticated download log"
  ON preset_downloads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Pas de SELECT public pour les analytics : seul un rôle admin devrait lire.
-- (Si vous voulez des stats côté front, créez une vue agrégée publique.)

-- =====================================================
-- Vérification finale
-- =====================================================
-- À exécuter pour confirmer que toutes les tables ont bien RLS activé :
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
