-- =====================================================
-- Ajout d'identifiants de vol lisibles pour les tables
-- =====================================================
--
-- Ce script ajoute des numéros de vol séquentiels et lisibles
-- en complément des UUIDs existants
--
-- Format: FP-YYYY-NNNN (ex: FP-2024-0001)
-- =====================================================

-- 1. Ajouter colonne flight_number à flight_plans si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'flight_plans'
        AND column_name = 'flight_number'
    ) THEN
        ALTER TABLE flight_plans
        ADD COLUMN flight_number TEXT UNIQUE;

        COMMENT ON COLUMN flight_plans.flight_number
        IS 'Numéro de vol lisible au format FP-YYYY-NNNN (ex: FP-2024-0001)';

        RAISE NOTICE '✅ Colonne flight_number ajoutée à flight_plans';
    ELSE
        RAISE NOTICE '⚠️ La colonne flight_number existe déjà dans flight_plans';
    END IF;
END $$;

-- 2. Ajouter colonne flight_number à validated_flight_pdfs si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'validated_flight_pdfs'
        AND column_name = 'flight_number'
    ) THEN
        ALTER TABLE validated_flight_pdfs
        ADD COLUMN flight_number TEXT UNIQUE;

        COMMENT ON COLUMN validated_flight_pdfs.flight_number
        IS 'Numéro de vol lisible au format VP-YYYY-NNNN (ex: VP-2024-0001)';

        RAISE NOTICE '✅ Colonne flight_number ajoutée à validated_flight_pdfs';
    ELSE
        RAISE NOTICE '⚠️ La colonne flight_number existe déjà dans validated_flight_pdfs';
    END IF;
END $$;

-- 3. Créer une séquence pour flight_plans par année
CREATE SEQUENCE IF NOT EXISTS flight_plans_seq;
COMMENT ON SEQUENCE flight_plans_seq IS 'Séquence pour numéros de plans de vol';

-- 4. Créer une séquence pour validated_flight_pdfs par année
CREATE SEQUENCE IF NOT EXISTS validated_pdfs_seq;
COMMENT ON SEQUENCE validated_pdfs_seq IS 'Séquence pour numéros de PDFs validés';

-- 5. Fonction pour générer le numéro de vol pour flight_plans
CREATE OR REPLACE FUNCTION generate_flight_plan_number()
RETURNS TEXT AS $$
DECLARE
    current_year TEXT;
    next_number INT;
    flight_num TEXT;
BEGIN
    current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Récupérer le prochain numéro pour cette année
    SELECT COALESCE(MAX(
        CASE
            WHEN flight_number ~ '^FP-[0-9]{4}-[0-9]+$'
            THEN CAST(SPLIT_PART(flight_number, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM flight_plans
    WHERE flight_number LIKE 'FP-' || current_year || '-%';

    -- Formater avec 4 chiffres (ex: FP-2024-0001)
    flight_num := 'FP-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');

    RETURN flight_num;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_flight_plan_number
IS 'Génère un numéro de plan de vol unique au format FP-YYYY-NNNN';

-- 6. Fonction pour générer le numéro de vol pour validated_flight_pdfs
CREATE OR REPLACE FUNCTION generate_validated_pdf_number()
RETURNS TEXT AS $$
DECLARE
    current_year TEXT;
    next_number INT;
    flight_num TEXT;
BEGIN
    current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Récupérer le prochain numéro pour cette année
    SELECT COALESCE(MAX(
        CASE
            WHEN flight_number ~ '^VP-[0-9]{4}-[0-9]+$'
            THEN CAST(SPLIT_PART(flight_number, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM validated_flight_pdfs
    WHERE flight_number LIKE 'VP-' || current_year || '-%';

    -- Formater avec 4 chiffres (ex: VP-2024-0001)
    flight_num := 'VP-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');

    RETURN flight_num;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_validated_pdf_number
IS 'Génère un numéro de PDF validé unique au format VP-YYYY-NNNN';

-- 7. Trigger pour auto-remplir flight_number dans flight_plans
CREATE OR REPLACE FUNCTION auto_set_flight_plan_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.flight_number IS NULL THEN
        NEW.flight_number := generate_flight_plan_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_flight_plan_number ON flight_plans;
CREATE TRIGGER trigger_auto_flight_plan_number
    BEFORE INSERT ON flight_plans
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_flight_plan_number();

COMMENT ON TRIGGER trigger_auto_flight_plan_number ON flight_plans
IS 'Génère automatiquement le flight_number si non fourni';

-- 8. Trigger pour auto-remplir flight_number dans validated_flight_pdfs
CREATE OR REPLACE FUNCTION auto_set_validated_pdf_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.flight_number IS NULL THEN
        NEW.flight_number := generate_validated_pdf_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_validated_pdf_number ON validated_flight_pdfs;
CREATE TRIGGER trigger_auto_validated_pdf_number
    BEFORE INSERT ON validated_flight_pdfs
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_validated_pdf_number();

COMMENT ON TRIGGER trigger_auto_validated_pdf_number ON validated_flight_pdfs
IS 'Génère automatiquement le flight_number si non fourni';

-- 9. Index sur flight_number pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_flight_plans_flight_number
    ON flight_plans(flight_number);

CREATE INDEX IF NOT EXISTS idx_validated_pdfs_flight_number
    ON validated_flight_pdfs(flight_number);

-- =====================================================
-- Résultat final :
--
-- Chaque plan de vol aura maintenant :
-- - id (UUID) : Identifiant technique unique
-- - flight_number (TEXT) : Numéro lisible (FP-2024-0001)
--
-- Chaque PDF validé aura :
-- - id (UUID) : Identifiant technique unique
-- - flight_number (TEXT) : Numéro lisible (VP-2024-0001)
--
-- Les numéros sont générés automatiquement à l'insertion
-- et redémarrent à 0001 chaque année.
-- =====================================================
