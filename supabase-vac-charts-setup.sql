-- =====================================================
-- Configuration Supabase pour Cartes VAC
-- Stockage automatisé des cartes VAC dans Supabase
-- =====================================================

-- Table: vac_charts
-- Stocke les métadonnées et références des cartes VAC
CREATE TABLE IF NOT EXISTS vac_charts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identification aérodrome
  icao VARCHAR(4) NOT NULL UNIQUE,
  aerodrome_name VARCHAR(255),

  -- Fichier
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Checksums pour vérifier l'intégrité
  checksum_md5 VARCHAR(32),

  -- Métadonnées VAC
  chart_type VARCHAR(50) DEFAULT 'VAC', -- VAC, SID, STAR, etc.
  effective_date DATE,
  expiration_date DATE,
  airac_cycle VARCHAR(10),

  -- Source
  source VARCHAR(50) DEFAULT 'manual', -- manual, sia, jeppesen, etc.
  download_url TEXT,

  -- Upload info
  uploaded_by VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),

  -- Statistiques
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMP,

  -- Version et statut
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active', -- active, archived, expired

  -- Validation
  verified BOOLEAN DEFAULT false,
  admin_verified BOOLEAN DEFAULT false,
  admin_verified_by VARCHAR(100),
  admin_verified_at TIMESTAMP,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: vac_download_history
-- Historique des téléchargements
CREATE TABLE IF NOT EXISTS vac_download_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chart_id UUID NOT NULL REFERENCES vac_charts(id) ON DELETE CASCADE,
  user_id VARCHAR(100),
  user_ip VARCHAR(45),
  downloaded_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Index
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_vac_icao ON vac_charts(icao);
CREATE INDEX IF NOT EXISTS idx_vac_status ON vac_charts(status);
CREATE INDEX IF NOT EXISTS idx_vac_effective_date ON vac_charts(effective_date);
CREATE INDEX IF NOT EXISTS idx_vac_expiration_date ON vac_charts(expiration_date);
CREATE INDEX IF NOT EXISTS idx_vac_airac_cycle ON vac_charts(airac_cycle);
CREATE INDEX IF NOT EXISTS idx_vac_source ON vac_charts(source);
CREATE INDEX IF NOT EXISTS idx_download_history_chart_id ON vac_download_history(chart_id);

-- =====================================================
-- Fonctions
-- =====================================================

-- Fonction: Mettre à jour le compteur de téléchargements
CREATE OR REPLACE FUNCTION update_vac_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vac_charts
  SET
    download_count = download_count + 1,
    last_downloaded_at = NOW()
  WHERE id = NEW.chart_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Incrémenter téléchargements VAC
DROP TRIGGER IF EXISTS trigger_update_vac_downloads ON vac_download_history;
CREATE TRIGGER trigger_update_vac_downloads
AFTER INSERT ON vac_download_history
FOR EACH ROW
EXECUTE FUNCTION update_vac_download_count();

-- Fonction: Mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Updated_at sur vac_charts
DROP TRIGGER IF EXISTS trigger_update_vac_charts_timestamp ON vac_charts;
CREATE TRIGGER trigger_update_vac_charts_timestamp
BEFORE UPDATE ON vac_charts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Fonction: Archiver automatiquement les cartes expirées
CREATE OR REPLACE FUNCTION archive_expired_vac_charts()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE vac_charts
  SET status = 'expired'
  WHERE expiration_date < CURRENT_DATE
    AND status = 'active';

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Politiques RLS (Row Level Security)
-- =====================================================

ALTER TABLE vac_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vac_download_history ENABLE ROW LEVEL SECURITY;

-- Politiques publiques (lecture)
DROP POLICY IF EXISTS "Public read vac_charts" ON vac_charts;
CREATE POLICY "Public read vac_charts"
ON vac_charts FOR SELECT
USING (status = 'active' OR status = 'expired');

DROP POLICY IF EXISTS "Public read download history" ON vac_download_history;
CREATE POLICY "Public read download history"
ON vac_download_history FOR SELECT
USING (true);

-- Politiques d'écriture (tout le monde peut uploader pour l'instant)
DROP POLICY IF EXISTS "Anyone can upload vac" ON vac_charts;
CREATE POLICY "Anyone can upload vac"
ON vac_charts FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update own vac" ON vac_charts;
CREATE POLICY "Anyone can update own vac"
ON vac_charts FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Anyone can log download" ON vac_download_history;
CREATE POLICY "Anyone can log download"
ON vac_download_history FOR INSERT
WITH CHECK (true);

-- =====================================================
-- Vue: Cartes VAC actives avec statistiques
-- =====================================================

CREATE OR REPLACE VIEW vac_charts_active AS
SELECT
  id,
  icao,
  aerodrome_name,
  file_name,
  file_path,
  file_size,
  mime_type,
  chart_type,
  effective_date,
  expiration_date,
  airac_cycle,
  source,
  download_url,
  uploaded_by,
  uploaded_at,
  download_count,
  last_downloaded_at,
  version,
  verified,
  admin_verified,
  notes,
  CASE
    WHEN expiration_date < CURRENT_DATE THEN 'expired'
    WHEN expiration_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'expiring_soon'
    ELSE 'valid'
  END as validity_status,
  CASE
    WHEN admin_verified THEN 'admin_verified'
    WHEN verified THEN 'community_verified'
    ELSE 'not_verified'
  END as verification_status
FROM vac_charts
WHERE status = 'active'
ORDER BY icao ASC;

-- =====================================================
-- Bucket de stockage Supabase
-- =====================================================

-- NOTE: Cette commande doit être exécutée via l'interface Supabase
-- ou via l'API JavaScript, pas directement en SQL

-- Instructions pour créer le bucket via l'interface Supabase:
-- 1. Aller dans Storage > Create bucket
-- 2. Nom: "vac-charts"
-- 3. Public: true (pour permettre l'accès direct aux fichiers)
-- 4. File size limit: 50 MB (suffisant pour les PDF VAC)
-- 5. Allowed MIME types: application/pdf, image/png, image/jpeg

-- =====================================================
-- Données de démonstration (optionnel)
-- =====================================================

-- Insérer quelques cartes VAC de test
INSERT INTO vac_charts (
  icao,
  aerodrome_name,
  file_name,
  file_path,
  file_size,
  mime_type,
  chart_type,
  effective_date,
  expiration_date,
  airac_cycle,
  source,
  uploaded_by,
  verified,
  admin_verified
) VALUES
(
  'LFST',
  'Strasbourg-Entzheim',
  'VAC_LFST_2025_01.pdf',
  'vac-charts/LFST/VAC_LFST_2025_01.pdf',
  2048576,
  'application/pdf',
  'VAC',
  '2025-01-25',
  '2025-02-22',
  '2025-01',
  'sia',
  'system@alflight.com',
  true,
  true
),
(
  'LFQG',
  'Nevers-Fourchambault',
  'VAC_LFQG_2025_01.pdf',
  'vac-charts/LFQG/VAC_LFQG_2025_01.pdf',
  1536000,
  'application/pdf',
  'VAC',
  '2025-01-25',
  '2025-02-22',
  '2025-01',
  'sia',
  'system@alflight.com',
  true,
  true
)
ON CONFLICT (icao) DO NOTHING;

-- =====================================================
-- Succès!
-- =====================================================

SELECT
  'Configuration VAC terminée !' as message,
  (SELECT COUNT(*) FROM vac_charts) as charts_count,
  (SELECT COUNT(*) FROM vac_download_history) as downloads_count;
