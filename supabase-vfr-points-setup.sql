-- =====================================================
-- Configuration Supabase pour les Points VFR Communautaires
-- Table: vfr_points
-- =====================================================

-- Table principale des points VFR partagés par la communauté
CREATE TABLE IF NOT EXISTS vfr_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Informations du point
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'VRP',  -- VRP, Landmark, Turning Point, Reporting Point

  -- Coordonnées
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  altitude INTEGER,  -- Altitude en pieds (optionnel)

  -- Description
  description TEXT,
  aerodrome VARCHAR(10),  -- Code OACI de l'aérodrome associé (optionnel)

  -- Visibilité et statut
  is_public BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active',  -- active, pending, rejected

  -- Métadonnées
  uploaded_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Statistiques
  downloads_count INTEGER DEFAULT 0,

  -- Validation
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(100),
  verified_at TIMESTAMP
);

-- =====================================================
-- Index pour améliorer les performances
-- =====================================================

-- Index sur les coordonnées pour recherches géographiques
CREATE INDEX IF NOT EXISTS idx_vfr_points_lat_lon ON vfr_points(lat, lon);

-- Index sur le nom pour recherches textuelles
CREATE INDEX IF NOT EXISTS idx_vfr_points_name ON vfr_points(name);

-- Index sur le type
CREATE INDEX IF NOT EXISTS idx_vfr_points_type ON vfr_points(type);

-- Index sur is_public et status pour filtres fréquents
CREATE INDEX IF NOT EXISTS idx_vfr_points_public_status ON vfr_points(is_public, status);

-- Index sur l'auteur
CREATE INDEX IF NOT EXISTS idx_vfr_points_uploaded_by ON vfr_points(uploaded_by);

-- Index sur la date de création
CREATE INDEX IF NOT EXISTS idx_vfr_points_created_at ON vfr_points(created_at DESC);

-- =====================================================
-- Fonction pour recherche full-text (optionnel)
-- =====================================================

-- Ajouter une colonne pour la recherche full-text
ALTER TABLE vfr_points ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Fonction pour mettre à jour le vecteur de recherche
CREATE OR REPLACE FUNCTION vfr_points_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(NEW.type, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le vecteur de recherche
DROP TRIGGER IF EXISTS vfr_points_search_vector_trigger ON vfr_points;
CREATE TRIGGER vfr_points_search_vector_trigger
  BEFORE INSERT OR UPDATE ON vfr_points
  FOR EACH ROW
  EXECUTE FUNCTION vfr_points_search_vector_update();

-- Index GIN pour la recherche full-text
CREATE INDEX IF NOT EXISTS idx_vfr_points_search ON vfr_points USING GIN(search_vector);

-- =====================================================
-- Fonction pour incrémenter le compteur de téléchargements
-- =====================================================

CREATE OR REPLACE FUNCTION increment_vfr_download(point_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE vfr_points
  SET downloads_count = downloads_count + 1
  WHERE id = point_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Row Level Security (RLS) - Sécurité
-- =====================================================

-- Activer RLS sur la table
ALTER TABLE vfr_points ENABLE ROW LEVEL SECURITY;

-- Politique: Tout le monde peut lire les points publics actifs
CREATE POLICY "Public VFR points are viewable by everyone"
  ON vfr_points FOR SELECT
  USING (is_public = true AND status = 'active');

-- Politique: Les utilisateurs authentifiés peuvent créer des points
CREATE POLICY "Authenticated users can insert VFR points"
  ON vfr_points FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Politique: Les utilisateurs peuvent modifier leurs propres points
CREATE POLICY "Users can update their own VFR points"
  ON vfr_points FOR UPDATE
  USING (uploaded_by = auth.uid()::text OR auth.role() = 'service_role');

-- Politique: Les utilisateurs peuvent supprimer leurs propres points
CREATE POLICY "Users can delete their own VFR points"
  ON vfr_points FOR DELETE
  USING (uploaded_by = auth.uid()::text OR auth.role() = 'service_role');

-- =====================================================
-- Vue pour les statistiques (optionnel)
-- =====================================================

CREATE OR REPLACE VIEW vfr_points_stats AS
SELECT
  type,
  COUNT(*) as total_points,
  SUM(downloads_count) as total_downloads,
  AVG(downloads_count) as avg_downloads
FROM vfr_points
WHERE is_public = true AND status = 'active'
GROUP BY type;

-- =====================================================
-- Données de test (optionnel - à supprimer en production)
-- =====================================================

-- Quelques points VFR de test en France
INSERT INTO vfr_points (name, type, lat, lon, altitude, description, is_public, uploaded_by, downloads_count)
VALUES
  ('Tour Eiffel', 'Landmark', 48.8584, 2.2945, 1063, 'Monument emblématique de Paris, visible de loin', true, 'system', 42),
  ('Château de Versailles', 'Landmark', 48.8049, 2.1204, 560, 'Château royal, grand parc visible depuis les airs', true, 'system', 28),
  ('Mont Saint-Michel', 'Landmark', 48.6361, -1.5115, 266, 'Îlot rocheux surmonté d''une abbaye', true, 'system', 67),
  ('VRP GOLF', 'VRP', 48.9000, 2.5500, 1500, 'Point VFR au nord-est de Paris', true, 'system', 15),
  ('Lac d''Annecy', 'Landmark', 45.8992, 6.1294, 1476, 'Grand lac alpin, très reconnaissable', true, 'system', 34)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Instructions d'utilisation
-- =====================================================

/*
POUR CRÉER CETTE TABLE DANS SUPABASE :

1. Connectez-vous à votre projet Supabase : https://app.supabase.com
2. Allez dans "SQL Editor"
3. Créez une nouvelle query
4. Copiez-collez TOUT ce fichier SQL
5. Cliquez sur "Run"

VÉRIFICATION :

Après exécution, vérifiez que :
- La table "vfr_points" existe (Table Editor)
- Les index sont créés
- Les politiques RLS sont activées
- Les 5 points de test sont présents (optionnel)

SUPPRESSION DES DONNÉES DE TEST :

Si vous ne voulez pas les points de test, exécutez :
DELETE FROM vfr_points WHERE uploaded_by = 'system';

PERMISSIONS API :

N'oubliez pas de vérifier que votre clé API (VITE_SUPABASE_ANON_KEY)
a les permissions nécessaires dans Supabase > Settings > API
*/
