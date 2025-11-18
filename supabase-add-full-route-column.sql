-- =====================================================
-- Ajout de la colonne full_route à validated_flight_pdfs
-- =====================================================
--
-- Cette colonne stockera le trajet complet du vol avec les waypoints
-- Format: LFGA→Sucrerie Erstein→Neuf-Brisach→LFGA
-- =====================================================

-- Ajouter la colonne full_route
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'validated_flight_pdfs'
        AND column_name = 'full_route'
    ) THEN
        ALTER TABLE validated_flight_pdfs
        ADD COLUMN full_route TEXT;

        COMMENT ON COLUMN validated_flight_pdfs.full_route
        IS 'Trajet complet du vol avec tous les waypoints (format: ICAO→WP1→WP2→ICAO)';

        RAISE NOTICE '✅ Colonne full_route ajoutée à validated_flight_pdfs';
    ELSE
        RAISE NOTICE '⚠️ La colonne full_route existe déjà dans validated_flight_pdfs';
    END IF;
END $$;

-- Index pour recherche rapide sur le trajet
CREATE INDEX IF NOT EXISTS idx_validated_pdfs_full_route
    ON validated_flight_pdfs(full_route);

COMMENT ON INDEX idx_validated_pdfs_full_route
IS 'Index pour recherche rapide de vols par trajet';
