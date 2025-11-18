-- =====================================================
-- Script de diagnostic pour tester la contrainte pdf_filename
-- =====================================================

-- Test 1: Vérifier que la contrainte existe
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'validated_flight_pdfs'::regclass
  AND conname = 'valid_pdf_filename';

-- Test 2: Tester le regex directement
SELECT
    'F-HSTR-LFGA-LFGA-20251117-1763365412431.pdf' ~ '\\.pdf$' AS test_direct,
    'test.pdf' ~ '\\.pdf$' AS test_simple,
    'test.pdf ' ~ '\\.pdf$' AS test_avec_espace,
    '2025/11/F-HSTR-LFGA-LFGA-20251117-1763365412431.pdf' ~ '\\.pdf$' AS test_chemin_complet;

-- Test 3: Vérifier si des données existent déjà dans la table
SELECT COUNT(*) AS nb_lignes FROM validated_flight_pdfs;

-- Test 4: Essayer d'insérer une ligne de test
DO $$
BEGIN
    -- Essayer une insertion simple
    INSERT INTO validated_flight_pdfs (
        pdf_filename,
        pdf_storage_path,
        pdf_size_bytes,
        pilot_name,
        flight_date,
        aircraft_registration,
        departure_icao,
        arrival_icao,
        validation_timestamp,
        version
    ) VALUES (
        'test-valid.pdf',
        '2025/11/test-valid.pdf',
        1024,
        'TEST_PILOT',
        '2025-11-17',
        'F-TEST',
        'LFST',
        'LFGA',
        NOW(),
        '1.0'
    );

    RAISE NOTICE '✅ Insertion de test réussie';

    -- Supprimer la ligne de test
    DELETE FROM validated_flight_pdfs WHERE pdf_filename = 'test-valid.pdf';
    RAISE NOTICE '✅ Ligne de test supprimée';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Erreur lors de l''insertion de test: %', SQLERRM;
END $$;
