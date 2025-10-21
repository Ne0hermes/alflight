-- =====================================================
-- FIX RLS POLICIES - Permettre UPDATE et DELETE
-- =====================================================

-- Supprimer les anciennes policies UPDATE et DELETE
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON vfr_points;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON vfr_points;
DROP POLICY IF EXISTS "Users can update own points" ON vfr_points;
DROP POLICY IF EXISTS "Users can delete own points" ON vfr_points;

-- POLICY UPDATE : Permettre la modification de TOUS les points (mode dev)
CREATE POLICY "Allow all updates in dev mode" ON vfr_points
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- POLICY DELETE : Permettre la suppression de TOUS les points (mode dev)
CREATE POLICY "Allow all deletes in dev mode" ON vfr_points
  FOR DELETE
  USING (true);

-- Vérifier les policies actuelles
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'vfr_points'
ORDER BY policyname;

-- =====================================================
-- Instructions
-- =====================================================

/*
POUR APPLIQUER CES CORRECTIONS :

1. Connectez-vous à Supabase : https://app.supabase.com
2. SQL Editor → New query
3. Copiez-collez TOUT ce fichier
4. Cliquez sur RUN

RÉSULTAT ATTENDU :
Vous devriez voir une table listant toutes les policies de vfr_points,
incluant :
- "Allow all updates in dev mode" (UPDATE)
- "Allow all deletes in dev mode" (DELETE)
- Les policies INSERT et SELECT existantes

APRÈS CETTE CORRECTION :
- Vous pourrez modifier N'IMPORTE QUEL point VFR
- Vous pourrez supprimer N'IMPORTE QUEL point VFR
- Les créations et lectures fonctionneront toujours

⚠️ NOTE PRODUCTION :
En production, vous devrez remplacer ces policies par des versions
qui vérifient uploaded_by = auth.uid() pour limiter les modifications
aux propriétaires des points.

EXEMPLE DE POLICY PRODUCTION (À UTILISER PLUS TARD) :

-- Modifier uniquement ses propres points
CREATE POLICY "Users can update own points" ON vfr_points
  FOR UPDATE
  USING (uploaded_by = auth.uid()::text)
  WITH CHECK (uploaded_by = auth.uid()::text);

-- Supprimer uniquement ses propres points
CREATE POLICY "Users can delete own points" ON vfr_points
  FOR DELETE
  USING (uploaded_by = auth.uid()::text);
*/
