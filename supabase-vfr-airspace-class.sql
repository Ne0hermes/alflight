-- =====================================================
-- AJOUT de la colonne airspace_class à la table vfr_points
-- Classe d'espace aérien OACI (A, B, C, D, E, F, G)
-- =====================================================

-- Ajouter la colonne airspace_class
ALTER TABLE vfr_points
  ADD COLUMN IF NOT EXISTS airspace_class VARCHAR(1);

-- Créer un index pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_vfr_points_airspace_class ON vfr_points(airspace_class);

-- Ajouter un commentaire descriptif
COMMENT ON COLUMN vfr_points.airspace_class IS 'Classe d''espace aérien OACI (A, B, C, D, E, F, G)';

-- Mettre à jour la fonction de recherche full-text pour inclure la classe d'espace aérien
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
UPDATE vfr_points SET updated_at = updated_at;  -- Force le trigger

-- =====================================================
-- Instructions d'utilisation
-- =====================================================

/*
POUR AJOUTER LA COLONNE DANS SUPABASE :

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Allez dans "SQL Editor"
3. Créez une nouvelle query
4. Copiez-collez TOUT ce fichier SQL
5. Cliquez sur "Run"

VÉRIFICATION :

Après exécution, vérifiez dans Table Editor > vfr_points que la nouvelle colonne est présente :
- airspace_class (varchar(1))

EXEMPLES DE VALEURS :
- A : Classe A (IFR uniquement, séparation assurée)
- B : Classe B (IFR/VFR, séparation assurée)
- C : Classe C (IFR/VFR, séparation IFR/IFR)
- D : Classe D (IFR/VFR, information de trafic)
- E : Classe E (IFR contrôlé, VFR libre)
- F : Classe F (service consultatif)
- G : Classe G (espace non contrôlé)

RETOUR ARRIÈRE (si nécessaire) :

Pour supprimer la colonne :
ALTER TABLE vfr_points DROP COLUMN IF EXISTS airspace_class;
DROP INDEX IF EXISTS idx_vfr_points_airspace_class;
*/
