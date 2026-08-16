-- =============================================================================
--  LOT 2.0 — COMPLÉMENT 2 (2026-08-16, retour de test César)
--  À exécuter dans Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
--  Constat : la carte VAC de Strasbourg était bien restaurée dans l'espace du
--  pilote, mais elle n'apparaissait pas dans « mes cartes VAC ». Cause : le
--  module s'ouvre sur l'onglet FAVORIS, et la liste des favoris — purement
--  locale — avait disparu avec le cache. La carte existait, l'aérodrome
--  n'était simplement plus affiché.
--
--  On synchronise donc aussi les petites préférences d'interface qui
--  conditionnent l'affichage (favoris VAC, données d'aérodrome éditées).
-- =============================================================================

alter table public.pilot_profiles add column if not exists app_preferences jsonb;

-- Vérification
select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'pilot_profiles'
   and column_name = 'app_preferences';
