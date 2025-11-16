-- =====================================================
-- Table pour stocker les PDFs de plans de vol validés
-- =====================================================

-- 1. Créer le bucket de stockage pour les PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('flight-plan-pdfs', 'flight-plan-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Table pour les métadonnées des PDFs validés
CREATE TABLE IF NOT EXISTS validated_flight_pdfs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Référence au plan de vol (optionnel si le plan n'a pas été sauvegardé)
  flight_plan_id UUID REFERENCES flight_plans(id) ON DELETE SET NULL,

  -- Informations du PDF
  pdf_filename TEXT NOT NULL,
  pdf_storage_path TEXT NOT NULL, -- Chemin dans le bucket storage
  pdf_size_bytes BIGINT,

  -- Informations du vol
  pilot_name TEXT NOT NULL,
  flight_date DATE NOT NULL,

  -- Informations additionnelles du vol
  callsign TEXT,
  aircraft_registration TEXT,
  aircraft_type TEXT,
  departure_icao TEXT,
  departure_name TEXT,
  arrival_icao TEXT,
  arrival_name TEXT,

  -- Métadonnées
  validation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  version TEXT DEFAULT '1.0',
  notes TEXT,

  -- Tags pour recherche
  tags TEXT[],

  CONSTRAINT valid_pdf_filename CHECK (pdf_filename ~ '\\.pdf$'),
  CONSTRAINT valid_flight_date CHECK (flight_date >= '2020-01-01' AND flight_date <= CURRENT_DATE + INTERVAL '1 year')
);

-- 3. Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_pilot ON validated_flight_pdfs(pilot_name);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_date ON validated_flight_pdfs(flight_date DESC);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_callsign ON validated_flight_pdfs(callsign);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_registration ON validated_flight_pdfs(aircraft_registration);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_departure ON validated_flight_pdfs(departure_icao);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_arrival ON validated_flight_pdfs(arrival_icao);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_created_at ON validated_flight_pdfs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_validation ON validated_flight_pdfs(validation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_flight_plan ON validated_flight_pdfs(flight_plan_id);

-- Index pour recherche par tags (GIN index pour arrays)
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_tags ON validated_flight_pdfs USING GIN(tags);

-- 4. Politique RLS (Row Level Security)
ALTER TABLE validated_flight_pdfs ENABLE ROW LEVEL SECURITY;

-- Lecture publique
CREATE POLICY "Allow public read access" ON validated_flight_pdfs
  FOR SELECT
  USING (true);

-- Insertion publique (pour l'instant - à restreindre avec authentification plus tard)
CREATE POLICY "Allow public insert access" ON validated_flight_pdfs
  FOR INSERT
  WITH CHECK (true);

-- Mise à jour publique (pour l'instant - à restreindre avec authentification plus tard)
CREATE POLICY "Allow public update access" ON validated_flight_pdfs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 5. Politiques de stockage pour le bucket
CREATE POLICY "Allow public upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'flight-plan-pdfs');

CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'flight-plan-pdfs');

CREATE POLICY "Allow public delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'flight-plan-pdfs');

-- 6. Commentaires pour documentation
COMMENT ON TABLE validated_flight_pdfs IS 'PDFs de plans de vol validés et archivés';
COMMENT ON COLUMN validated_flight_pdfs.pdf_storage_path IS 'Chemin complet du PDF dans le bucket storage (ex: 2024/01/F-HSTR-LFST-LFGA-20240115.pdf)';
COMMENT ON COLUMN validated_flight_pdfs.flight_plan_id IS 'Référence optionnelle au plan de vol complet (si sauvegardé dans flight_plans)';
COMMENT ON COLUMN validated_flight_pdfs.pilot_name IS 'Nom du pilote ayant validé le plan de vol';
COMMENT ON COLUMN validated_flight_pdfs.flight_date IS 'Date prévue du vol';
COMMENT ON COLUMN validated_flight_pdfs.tags IS 'Tags de recherche (ex: ["formation", "navigation", "cross-country"])';

-- 7. Fonction helper pour générer un nom de fichier unique
CREATE OR REPLACE FUNCTION generate_flight_pdf_path(
  p_registration TEXT,
  p_departure TEXT,
  p_arrival TEXT,
  p_flight_date DATE
) RETURNS TEXT AS $$
DECLARE
  year_month TEXT;
  base_filename TEXT;
  final_path TEXT;
BEGIN
  -- Format: YYYY/MM/REGISTRATION-DEPARTURE-ARRIVAL-YYYYMMDD-TIMESTAMP.pdf
  year_month := TO_CHAR(p_flight_date, 'YYYY/MM');
  base_filename := CONCAT(
    UPPER(COALESCE(p_registration, 'UNKNOWN')), '-',
    UPPER(COALESCE(p_departure, 'XXXX')), '-',
    UPPER(COALESCE(p_arrival, 'XXXX')), '-',
    TO_CHAR(p_flight_date, 'YYYYMMDD'), '-',
    EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT
  );
  final_path := CONCAT(year_month, '/', base_filename, '.pdf');

  RETURN final_path;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_flight_pdf_path IS 'Génère un chemin de stockage unique pour un PDF de plan de vol';

-- 8. Vue pour les statistiques
CREATE OR REPLACE VIEW validated_pdfs_stats AS
SELECT
  DATE_TRUNC('month', flight_date) AS month,
  pilot_name,
  COUNT(*) AS total_flights,
  COUNT(DISTINCT aircraft_registration) AS aircraft_count,
  COUNT(DISTINCT departure_icao) AS departure_airports,
  COUNT(DISTINCT arrival_icao) AS arrival_airports,
  SUM(pdf_size_bytes) AS total_storage_bytes,
  AVG(pdf_size_bytes) AS avg_pdf_size
FROM validated_flight_pdfs
GROUP BY DATE_TRUNC('month', flight_date), pilot_name
ORDER BY month DESC, pilot_name;

COMMENT ON VIEW validated_pdfs_stats IS 'Statistiques mensuelles des PDFs validés par pilote';
