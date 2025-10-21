-- =====================================================
-- SCRIPT COMPLET - Toutes les mises à jour de vfr_points
-- Exécutez CE SCRIPT UNIQUE pour ajouter TOUTES les colonnes
-- =====================================================

-- 1. Ajouter les colonnes de base (si pas déjà faites)
ALTER TABLE vfr_points
  ADD COLUMN IF NOT EXISTS frequency VARCHAR(20),
  ADD COLUMN IF NOT EXISTS airspace VARCHAR(50),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS aeronautical_remarks TEXT;

-- 2. Ajouter la colonne classe d'espace aérien
ALTER TABLE vfr_points
  ADD COLUMN IF NOT EXISTS airspace_class VARCHAR(1);

-- 3. Ajouter la colonne photo
ALTER TABLE vfr_points
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Créer les index pour performance
CREATE INDEX IF NOT EXISTS idx_vfr_points_country ON vfr_points(country);
CREATE INDEX IF NOT EXISTS idx_vfr_points_airspace ON vfr_points(airspace);
CREATE INDEX IF NOT EXISTS idx_vfr_points_airspace_class ON vfr_points(airspace_class);
CREATE INDEX IF NOT EXISTS idx_vfr_points_photo_url ON vfr_points(photo_url);

-- Ajouter des commentaires descriptifs
COMMENT ON COLUMN vfr_points.frequency IS 'Fréquence radio de référence en MHz (ex: 118.50)';
COMMENT ON COLUMN vfr_points.airspace IS 'Type d''espace aérien (CTR, TMA, D, P, R, etc.)';
COMMENT ON COLUMN vfr_points.country IS 'Pays où se trouve le point';
COMMENT ON COLUMN vfr_points.aeronautical_remarks IS 'Remarques aéronautiques importantes pour les pilotes';
COMMENT ON COLUMN vfr_points.airspace_class IS 'Classe d''espace aérien OACI (A, B, C, D, E, F, G)';
COMMENT ON COLUMN vfr_points.photo_url IS 'URL publique de la photo du point VFR (stockée dans Supabase Storage)';

-- Mettre à jour la fonction de recherche full-text pour inclure tous les nouveaux champs
DROP FUNCTION IF EXISTS vfr_points_search_vector_update() CASCADE;

CREATE OR REPLACE FUNCTION vfr_points_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.type, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.country, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.airspace_class, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.aeronautical_remarks, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger
DROP TRIGGER IF EXISTS vfr_points_search_vector_trigger ON vfr_points;
CREATE TRIGGER vfr_points_search_vector_trigger
  BEFORE INSERT OR UPDATE ON vfr_points
  FOR EACH ROW
  EXECUTE FUNCTION vfr_points_search_vector_update();

-- Mettre à jour le vecteur de recherche pour tous les points existants
UPDATE vfr_points SET updated_at = updated_at;

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Afficher toutes les colonnes de la table vfr_points
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'vfr_points'
ORDER BY ordinal_position;

-- =====================================================
-- Instructions d'utilisation
-- =====================================================

/*
POUR METTRE À JOUR LA TABLE DANS SUPABASE :

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Allez dans "SQL Editor"
3. Créez une nouvelle query
4. Copiez-collez TOUT ce fichier SQL
5. Cliquez sur "Run"

VÉRIFICATION :

Après exécution, vous devriez voir la liste de TOUTES les colonnes de vfr_points incluant :
- frequency (VARCHAR 20)
- airspace (VARCHAR 50)
- country (VARCHAR 100)
- aeronautical_remarks (TEXT)
- airspace_class (VARCHAR 1)
- photo_url (TEXT)

Si vous voyez ces colonnes dans le résultat, tout est OK !

ENSUITE : Créer le bucket Storage

1. Allez dans Storage (menu latéral)
2. Create a new bucket
3. Nom : vfr-points-photos
4. Public bucket : OUI (cochez)
5. Create

Puis ajoutez les policies (SQL Editor → New query) :

CREATE POLICY "Public read access on vfr-points-photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vfr-points-photos');

CREATE POLICY "Public upload on vfr-points-photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'vfr-points-photos');

*/
