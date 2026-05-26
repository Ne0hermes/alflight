-- =====================================================
-- STORAGE RLS STRICT — supprime les listings publics
-- =====================================================
--
-- Corrige l'alerte Supabase Security Advisor :
--   « Clients can list all files in this bucket »
--
-- Stratégie :
--   - Les buckets publics restent accessibles en téléchargement via leurs
--     URL publiques (le CDN ne consulte pas RLS pour les GET directs).
--   - On supprime les policies SELECT permissives sur `storage.objects`
--     qui permettaient à n'importe qui de faire `.list()` et énumérer les
--     fichiers du bucket.
--   - Les uploads (INSERT) restent autorisés selon la nature du bucket.
--   - Update/Delete sont restreints au propriétaire (owner = auth.uid()).
--   - Pour les actions admin de listing, ajouter une policy scopée à un
--     rôle/JWT custom (voir section optionnelle en bas).
--
-- ⚠ Avant d'exécuter : assure-toi qu'AUCUN code de l'app ne fait `.list()`
--    sur ces buckets. Si oui, il faudra ajouter une policy scopée.
--
-- =====================================================

-- ============================================
-- BUCKET : manex-files
-- ============================================

-- 1) Supprimer les anciennes policies (best-effort, noms variables)
DROP POLICY IF EXISTS "Public read manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access on manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Public list manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Public upload manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Public upload on manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Public update manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Public delete manex-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete on manex-files" ON storage.objects;

-- 2) Pas de SELECT policy publique → bloque .list() pour anonymes.
--    Le téléchargement via URL publique fonctionne sans cela (CDN direct).

-- 3) Upload : authentifiés uniquement, dans ce bucket.
CREATE POLICY "manex-files: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'manex-files');

-- 4) Update / Delete : uniquement le propriétaire du fichier.
CREATE POLICY "manex-files: owner update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'manex-files' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'manex-files' AND owner = auth.uid());

CREATE POLICY "manex-files: owner delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'manex-files' AND owner = auth.uid());


-- ============================================
-- BUCKET : vfr-points-photos
-- ============================================

DROP POLICY IF EXISTS "Public read vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public upload vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public update vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access on vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public upload on vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete on vfr-points-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;

CREATE POLICY "vfr-points-photos: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vfr-points-photos');

CREATE POLICY "vfr-points-photos: owner update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vfr-points-photos' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'vfr-points-photos' AND owner = auth.uid());

CREATE POLICY "vfr-points-photos: owner delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'vfr-points-photos' AND owner = auth.uid());


-- ============================================
-- BUCKET : flight-plan-pdfs
-- ============================================

DROP POLICY IF EXISTS "Public read flight-plan-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public upload flight-plan-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public update flight-plan-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public delete flight-plan-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public read access on flight-plan-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public upload on flight-plan-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete on flight-plan-pdfs" ON storage.objects;

CREATE POLICY "flight-plan-pdfs: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'flight-plan-pdfs');

CREATE POLICY "flight-plan-pdfs: owner update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'flight-plan-pdfs' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'flight-plan-pdfs' AND owner = auth.uid());

CREATE POLICY "flight-plan-pdfs: owner delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'flight-plan-pdfs' AND owner = auth.uid());


-- ============================================
-- BUCKET : vac-charts  (si présent)
--   Adapte le nom exact selon ton instance Supabase.
-- ============================================

DROP POLICY IF EXISTS "Public read vac-charts" ON storage.objects;
DROP POLICY IF EXISTS "Public upload vac-charts" ON storage.objects;
DROP POLICY IF EXISTS "Public update vac-charts" ON storage.objects;
DROP POLICY IF EXISTS "Public delete vac-charts" ON storage.objects;
DROP POLICY IF EXISTS "Public read access on vac-charts" ON storage.objects;

CREATE POLICY "vac-charts: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vac-charts');

CREATE POLICY "vac-charts: owner update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vac-charts' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'vac-charts' AND owner = auth.uid());

CREATE POLICY "vac-charts: owner delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'vac-charts' AND owner = auth.uid());


-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Liste toutes les policies restantes sur storage.objects
-- Tu ne dois plus voir AUCUNE policy SELECT.
SELECT
  policyname,
  cmd       AS operation,
  roles,
  qual      AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd, policyname;


-- =====================================================
-- OPTION : si tu as besoin de .list() côté admin uniquement
-- =====================================================
--
-- Décommente le bloc ci-dessous si tu veux qu'un compte admin (rôle custom
-- dans le JWT, ex. claim "role": "admin") puisse lister les fichiers.
-- Sinon, garde ce qui est au-dessus et personne ne peut énumérer.
--
-- CREATE POLICY "all buckets: admin list"
--   ON storage.objects
--   FOR SELECT
--   TO authenticated
--   USING (auth.jwt() ->> 'role' = 'admin');


-- =====================================================
-- INSTRUCTIONS D'APPLICATION
-- =====================================================
--
-- 1. Va dans Supabase Dashboard → SQL Editor → New query
-- 2. Colle TOUT ce fichier
-- 3. Clique sur RUN
-- 4. Vérifie la sortie de la dernière requête (la liste des policies) :
--    - Aucune ligne avec cmd = 'SELECT' ne doit apparaître
--    - Doivent rester : INSERT (4), UPDATE (4), DELETE (4) par bucket
-- 5. Reteste l'app : upload d'une photo VFR, MANEX, plan de vol → doit marcher
-- 6. L'alerte « Clients can list all files in this bucket » disparaît du
--    Security Advisor après quelques minutes (refresh).
--
-- ROLLBACK : si l'app casse parce qu'un code appelle `.list()`, soit :
--   - Réinclure les anciennes policies SELECT (à éviter)
--   - Ajouter une SELECT scopée au propriétaire ou à l'admin (préférable)
