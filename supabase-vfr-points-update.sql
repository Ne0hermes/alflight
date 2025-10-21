-- =====================================================
-- MISE À JOUR de la table vfr_points
-- Ajout de nouvelles colonnes
-- =====================================================

-- Ajout des nouvelles colonnes à la table vfr_points
ALTER TABLE vfr_points
  ADD COLUMN IF NOT EXISTS frequency VARCHAR(20),  -- Fréquence radio (ex: "118.50", "122.50")
  ADD COLUMN IF NOT EXISTS airspace VARCHAR(50),   -- Type d'espace aérien (CTR, TMA, etc.)
  ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'France',  -- Pays
  ADD COLUMN IF NOT EXISTS aeronautical_remarks TEXT;  -- Remarques aéronautiques

-- Créer un index sur le pays pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_vfr_points_country ON vfr_points(country);

-- Créer un index sur l'espace aérien
CREATE INDEX IF NOT EXISTS idx_vfr_points_airspace ON vfr_points(airspace);

-- Mettre à jour la fonction de recherche full-text pour inclure les nouveaux champs
DROP FUNCTION IF EXISTS vfr_points_search_vector_update() CASCADE;

CREATE OR REPLACE FUNCTION vfr_points_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.type, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(NEW.country, '')), 'C') ||
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
UPDATE vfr_points SET updated_at = updated_at;  -- Force le trigger

-- Vérifier les nouvelles colonnes
COMMENT ON COLUMN vfr_points.frequency IS 'Fréquence radio de référence en MHz (ex: 118.50)';
COMMENT ON COLUMN vfr_points.airspace IS 'Type d''espace aérien (CTR, TMA, D, P, R, etc.)';
COMMENT ON COLUMN vfr_points.country IS 'Pays où se trouve le point';
COMMENT ON COLUMN vfr_points.aeronautical_remarks IS 'Remarques aéronautiques importantes pour les pilotes';

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

Après exécution, vérifiez dans Table Editor > vfr_points que les nouvelles colonnes sont présentes :
- frequency
- airspace
- country
- aeronautical_remarks

MIGRATION DES DONNÉES EXISTANTES :

Si vous voulez ajouter le pays "France" à tous les points existants qui n'en ont pas :
UPDATE vfr_points SET country = 'France' WHERE country IS NULL OR country = '';

RETOUR ARRIÈRE (si nécessaire) :

Pour supprimer les nouvelles colonnes :
ALTER TABLE vfr_points
  DROP COLUMN IF EXISTS frequency,
  DROP COLUMN IF EXISTS airspace,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS aeronautical_remarks;
*/
