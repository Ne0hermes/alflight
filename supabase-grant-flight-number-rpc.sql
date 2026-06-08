-- =====================================================================
-- Migration : EXPOSER la RPC de numérotation des plans de vol validés
-- ---------------------------------------------------------------------
-- Objectif (audit QA — Item 1) : permettre à l'application de RÉSERVER
-- le numéro de vol (format VP-AAAA-NNNN) AVANT de générer le PDF, afin
-- de l'IMPRIMER sur le document (en-tête page 1 + pied de chaque page).
--
-- Le code client appelle :  supabase.rpc('generate_validated_pdf_number')
-- (voir src/services/validatedPdfService.js -> getNextFlightNumber()).
--
-- Idempotent : ré-exécutable sans risque.
-- À exécuter dans Supabase -> SQL Editor (rôle propriétaire / service).
-- =====================================================================

-- 0. Garantir la colonne flight_number (si la migration de base n'a pas
--    encore été appliquée). Sans elle, la fonction échoue à l'exécution.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validated_flight_pdfs'
      AND column_name = 'flight_number'
  ) THEN
    ALTER TABLE public.validated_flight_pdfs ADD COLUMN flight_number TEXT UNIQUE;
    RAISE NOTICE 'Colonne flight_number ajoutée à validated_flight_pdfs';
  END IF;
END $$;

-- 1. (Re)créer la fonction en SECURITY DEFINER + search_path figé.
--    POURQUOI SECURITY DEFINER : la séquence doit être calculée sur
--    TOUTES les lignes (MAX global). La politique RLS actuelle est
--    « USING (true) » (lecture publique), donc une fonction normale
--    verrait déjà tout — MAIS les commentaires du schéma annoncent
--    « à restreindre avec authentification plus tard ». Le jour où la
--    lecture sera limitée par utilisateur, une fonction NON definer
--    ne verrait que les PDF de l'appelant -> la numérotation repartirait
--    et violerait la contrainte UNIQUE (doublons). SECURITY DEFINER rend
--    la migration durable. La fonction ne prend aucun argument et ne fait
--    qu'un SELECT en lecture : aucune surface d'injection.
CREATE OR REPLACE FUNCTION public.generate_validated_pdf_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_year TEXT;
    next_number INT;
    flight_num TEXT;
BEGIN
    current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Prochain numéro de l'année (séquence globale, redémarre à 0001/an)
    SELECT COALESCE(MAX(
        CASE
            WHEN flight_number ~ '^VP-[0-9]{4}-[0-9]+$'
            THEN CAST(SPLIT_PART(flight_number, '-', 3) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM public.validated_flight_pdfs
    WHERE flight_number LIKE 'VP-' || current_year || '-%';

    flight_num := 'VP-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
    RETURN flight_num;
END;
$$;

-- 2. AUTORISER l'appel RPC (PostgREST) par les rôles client.
--    Sans EXECUTE explicite, l'appel renvoie un 404 / permission denied.
GRANT EXECUTE ON FUNCTION public.generate_validated_pdf_number() TO anon, authenticated;

-- 3. Rafraîchir le cache de schéma PostgREST (sinon la nouvelle RPC peut
--    ne pas apparaître immédiatement dans l'API REST).
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- VÉRIFICATION (exécuter séparément, après la migration)
-- ---------------------------------------------------------------------
-- a) La fonction renvoie bien un numéro :
--      SELECT public.generate_validated_pdf_number();        -- -> VP-AAAA-NNNN
--
-- b) Les droits EXECUTE sont présents (anon / authenticated) :
--      SELECT p.proname, p.prosecdef AS security_definer, p.proacl
--      FROM pg_proc p
--      JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public'
--        AND p.proname = 'generate_validated_pdf_number';
--
-- c) Test bout-en-bout côté app (console navigateur) :
--      const { data, error } = await supabase
--        .rpc('generate_validated_pdf_number');
--      // attendu : data = 'VP-AAAA-NNNN', error = null
--
-- NB : appeler cette fonction n'a AUCUN effet de bord (lecture seule).
--      Le numéro n'est réellement consommé qu'à l'INSERT du PDF, où le
--      trigger auto_set_validated_pdf_number respecte la valeur fournie
--      (il ne génère que si flight_number IS NULL).
-- =====================================================================
