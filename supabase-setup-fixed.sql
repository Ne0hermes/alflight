-- =====================================================
-- Configuration Supabase pour ALFlight Community
-- VERSION CORRIGÉE (ordre des tables)
-- =====================================================

-- Table: manex_files (CRÉÉE EN PREMIER)
-- Stocke les métadonnées des fichiers MANEX
CREATE TABLE IF NOT EXISTS manex_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Informations du fichier
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) DEFAULT 'application/pdf',

  -- Checksums
  checksum_md5 VARCHAR(32),
  checksum_sha256 VARCHAR(64),

  -- Upload info
  uploaded_by VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),

  -- Métadonnées du MANEX
  manual_version VARCHAR(50),
  aircraft_model VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: community_presets (CRÉÉE EN SECOND)
CREATE TABLE IF NOT EXISTS community_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identification de l'avion
  registration VARCHAR(20) NOT NULL,
  model VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(100) NOT NULL,
  aircraft_type VARCHAR(50),
  category VARCHAR(10),

  -- Données complètes de l'avion (JSON)
  aircraft_data JSONB NOT NULL,

  -- MANEX
  manex_file_id UUID REFERENCES manex_files(id),
  has_manex BOOLEAN DEFAULT false,

  -- Métadonnées
  submitted_by VARCHAR(100) NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  description TEXT,

  -- Statistiques
  downloads_count INTEGER DEFAULT 0,
  votes_up INTEGER DEFAULT 0,
  votes_down INTEGER DEFAULT 0,

  -- Validation
  verified BOOLEAN DEFAULT false,
  admin_verified BOOLEAN DEFAULT false,
  admin_verified_by VARCHAR(100),
  admin_verified_at TIMESTAMP,

  -- Status
  status VARCHAR(20) DEFAULT 'active',

  -- Indexation
  tags TEXT[],
  search_vector tsvector,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: preset_votes
CREATE TABLE IF NOT EXISTS preset_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id UUID NOT NULL REFERENCES community_presets(id) ON DELETE CASCADE,
  user_id VARCHAR(100) NOT NULL,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  voted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(preset_id, user_id)
);

-- Table: preset_downloads
CREATE TABLE IF NOT EXISTS preset_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id UUID NOT NULL REFERENCES community_presets(id) ON DELETE CASCADE,
  user_id VARCHAR(100),
  downloaded_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Index
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_presets_registration ON community_presets(registration);
CREATE INDEX IF NOT EXISTS idx_presets_model ON community_presets(model);
CREATE INDEX IF NOT EXISTS idx_presets_manufacturer ON community_presets(manufacturer);
CREATE INDEX IF NOT EXISTS idx_presets_status ON community_presets(status);
CREATE INDEX IF NOT EXISTS idx_presets_verified ON community_presets(verified);
CREATE INDEX IF NOT EXISTS idx_votes_preset_id ON preset_votes(preset_id);

-- =====================================================
-- Fonctions
-- =====================================================

-- Fonction: Mettre à jour le compteur de votes
CREATE OR REPLACE FUNCTION update_preset_votes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_presets
  SET
    votes_up = (SELECT COUNT(*) FROM preset_votes WHERE preset_id = COALESCE(NEW.preset_id, OLD.preset_id) AND vote_type = 'up'),
    votes_down = (SELECT COUNT(*) FROM preset_votes WHERE preset_id = COALESCE(NEW.preset_id, OLD.preset_id) AND vote_type = 'down'),
    verified = ((SELECT COUNT(*) FROM preset_votes WHERE preset_id = COALESCE(NEW.preset_id, OLD.preset_id) AND vote_type = 'up') -
                (SELECT COUNT(*) FROM preset_votes WHERE preset_id = COALESCE(NEW.preset_id, OLD.preset_id) AND vote_type = 'down')) >= 10
  WHERE id = COALESCE(NEW.preset_id, OLD.preset_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Mettre à jour les votes
DROP TRIGGER IF EXISTS trigger_update_votes ON preset_votes;
CREATE TRIGGER trigger_update_votes
AFTER INSERT OR UPDATE OR DELETE ON preset_votes
FOR EACH ROW
EXECUTE FUNCTION update_preset_votes();

-- Fonction: Mettre à jour le compteur de téléchargements
CREATE OR REPLACE FUNCTION update_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_presets
  SET downloads_count = downloads_count + 1
  WHERE id = NEW.preset_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Incrémenter téléchargements
DROP TRIGGER IF EXISTS trigger_update_downloads ON preset_downloads;
CREATE TRIGGER trigger_update_downloads
AFTER INSERT ON preset_downloads
FOR EACH ROW
EXECUTE FUNCTION update_download_count();

-- Fonction: Mettre à jour le vecteur de recherche
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.registration, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.model, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.manufacturer, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Recherche
DROP TRIGGER IF EXISTS trigger_update_search ON community_presets;
CREATE TRIGGER trigger_update_search
BEFORE INSERT OR UPDATE ON community_presets
FOR EACH ROW
EXECUTE FUNCTION update_search_vector();

-- =====================================================
-- Politiques RLS
-- =====================================================

ALTER TABLE community_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE manex_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_downloads ENABLE ROW LEVEL SECURITY;

-- Politiques publiques (lecture)
DROP POLICY IF EXISTS "Public read presets" ON community_presets;
CREATE POLICY "Public read presets"
ON community_presets FOR SELECT
USING (status = 'active');

DROP POLICY IF EXISTS "Public read manex" ON manex_files;
CREATE POLICY "Public read manex"
ON manex_files FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public read votes" ON preset_votes;
CREATE POLICY "Public read votes"
ON preset_votes FOR SELECT
USING (true);

-- Politiques d'écriture (tout le monde peut contribuer pour l'instant)
DROP POLICY IF EXISTS "Anyone can insert presets" ON community_presets;
CREATE POLICY "Anyone can insert presets"
ON community_presets FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can vote" ON preset_votes;
CREATE POLICY "Anyone can vote"
ON preset_votes FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can upload manex" ON manex_files;
CREATE POLICY "Anyone can upload manex"
ON manex_files FOR INSERT
WITH CHECK (true);

-- =====================================================
-- Vue
-- =====================================================

CREATE OR REPLACE VIEW presets_with_stats AS
SELECT
  p.*,
  m.filename as manex_filename,
  m.file_size as manex_filesize,
  (p.votes_up - p.votes_down) as net_votes,
  CASE
    WHEN p.admin_verified THEN 'admin_verified'
    WHEN p.verified THEN 'community_verified'
    ELSE 'not_verified'
  END as verification_status
FROM community_presets p
LEFT JOIN manex_files m ON p.manex_file_id = m.id
WHERE p.status = 'active'
ORDER BY p.downloads_count DESC, net_votes DESC;

-- =====================================================
-- Données de test
-- =====================================================

INSERT INTO community_presets (
  registration, model, manufacturer, aircraft_type, category,
  aircraft_data, submitted_by, description, votes_up, verified, admin_verified,
  has_manex
) VALUES (
  'F-HSTR',
  'DA40 NG',
  'Diamond',
  'Avion monomoteur',
  'SEP',
  '{"speeds": {"vne": 154, "vno": 127}, "weights": {"emptyWeight": 795}}'::jsonb,
  'ne0hermes@example.com',
  'Configuration complète du DA40 NG avec performances',
  12,
  true,
  true,
  true
) ON CONFLICT DO NOTHING;

-- Succès!
SELECT 'Configuration terminée !' as message,
       (SELECT COUNT(*) FROM community_presets) as presets_count,
       (SELECT COUNT(*) FROM manex_files) as manex_count;
