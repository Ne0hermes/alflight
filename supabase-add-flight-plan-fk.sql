-- =====================================================
-- Script optionnel : Ajouter la foreign key vers flight_plans
-- =====================================================
--
-- Ce script doit être exécuté SEULEMENT si la table flight_plans existe
-- et que vous souhaitez créer une contrainte de foreign key
--
-- Prérequis : La table flight_plans doit exister
-- Exécuter : supabase-flight-plans-setup.sql en premier
-- =====================================================

-- Vérifier que la table flight_plans existe avant d'ajouter la contrainte
DO $$
BEGIN
    -- Vérifier si la table flight_plans existe
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'flight_plans'
    ) THEN
        -- Vérifier si la contrainte n'existe pas déjà
        IF NOT EXISTS (
            SELECT FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_validated_pdfs_flight_plan'
            AND table_name = 'validated_flight_pdfs'
        ) THEN
            -- Ajouter la contrainte de foreign key
            ALTER TABLE validated_flight_pdfs
            ADD CONSTRAINT fk_validated_pdfs_flight_plan
            FOREIGN KEY (flight_plan_id)
            REFERENCES flight_plans(id)
            ON DELETE SET NULL;

            RAISE NOTICE '✅ Foreign key ajoutée avec succès';
        ELSE
            RAISE NOTICE '⚠️ La contrainte existe déjà';
        END IF;
    ELSE
        RAISE NOTICE '❌ La table flight_plans n''existe pas. Exécutez supabase-flight-plans-setup.sql en premier.';
    END IF;
END $$;

COMMENT ON CONSTRAINT fk_validated_pdfs_flight_plan ON validated_flight_pdfs
IS 'Référence optionnelle vers le plan de vol complet';
