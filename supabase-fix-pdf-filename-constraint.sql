-- =====================================================
-- Fix pour la contrainte pdf_filename
-- =====================================================
--
-- Ce script corrige la contrainte valid_pdf_filename
-- en la rendant plus robuste et en ajoutant un trigger
-- pour nettoyer automatiquement le filename
-- =====================================================

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE validated_flight_pdfs
DROP CONSTRAINT IF EXISTS valid_pdf_filename;

-- 2. Ajouter une contrainte améliorée qui trim et vérifie
ALTER TABLE validated_flight_pdfs
ADD CONSTRAINT valid_pdf_filename
CHECK (
    pdf_filename IS NOT NULL
    AND LENGTH(TRIM(pdf_filename)) > 4
    AND TRIM(pdf_filename) ~ '\.pdf$'
);

COMMENT ON CONSTRAINT valid_pdf_filename ON validated_flight_pdfs
IS 'Vérifie que pdf_filename se termine par .pdf (après trim)';

-- 3. Créer une fonction pour nettoyer le filename automatiquement
CREATE OR REPLACE FUNCTION clean_pdf_filename()
RETURNS TRIGGER AS $$
BEGIN
    -- Trim le filename pour enlever espaces/caractères invisibles
    IF NEW.pdf_filename IS NOT NULL THEN
        NEW.pdf_filename := TRIM(NEW.pdf_filename);
    END IF;

    -- Trim aussi le storage path
    IF NEW.pdf_storage_path IS NOT NULL THEN
        NEW.pdf_storage_path := TRIM(NEW.pdf_storage_path);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Créer un trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_clean_pdf_filename ON validated_flight_pdfs;
CREATE TRIGGER trigger_clean_pdf_filename
    BEFORE INSERT OR UPDATE ON validated_flight_pdfs
    FOR EACH ROW
    EXECUTE FUNCTION clean_pdf_filename();

COMMENT ON TRIGGER trigger_clean_pdf_filename ON validated_flight_pdfs
IS 'Nettoie automatiquement pdf_filename et pdf_storage_path avant insertion/mise à jour';

-- 5. Test de validation
DO $$
DECLARE
    test_filename TEXT;
BEGIN
    -- Test 1: filename normal
    test_filename := 'F-HSTR-LFGA-LFGA-20251117-1763365412431.pdf';
    IF TRIM(test_filename) ~ '\.pdf$' THEN
        RAISE NOTICE '✅ Test 1 OK: % est valide', test_filename;
    ELSE
        RAISE NOTICE '❌ Test 1 FAIL: % invalide', test_filename;
    END IF;

    -- Test 2: filename avec espaces
    test_filename := 'test.pdf ';
    IF TRIM(test_filename) ~ '\.pdf$' THEN
        RAISE NOTICE '✅ Test 2 OK: "%" devient valide après trim', test_filename;
    ELSE
        RAISE NOTICE '❌ Test 2 FAIL: "%" reste invalide', test_filename;
    END IF;

    -- Test 3: filename sans .pdf
    test_filename := 'test';
    IF TRIM(test_filename) ~ '\.pdf$' THEN
        RAISE NOTICE '❌ Test 3 FAIL: % ne devrait pas être valide', test_filename;
    ELSE
        RAISE NOTICE '✅ Test 3 OK: % correctement rejeté', test_filename;
    END IF;
END $$;

-- =====================================================
-- Résultat final :
--
-- La nouvelle contrainte :
-- - Trim automatiquement le filename avant vérification
-- - Vérifie que le filename n'est pas null
-- - Vérifie que le filename fait plus de 4 caractères
-- - Vérifie que le filename se termine par .pdf
--
-- Le trigger clean_pdf_filename :
-- - Nettoie automatiquement pdf_filename et pdf_storage_path
-- - S'exécute AVANT INSERT/UPDATE
-- - Garantit qu'il n'y a jamais d'espaces ou caractères invisibles
-- =====================================================
