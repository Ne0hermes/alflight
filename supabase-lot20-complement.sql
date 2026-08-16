-- =============================================================================
--  LOT 2.0 — COMPLÉMENT (2026-08-16, retour de test César)
--  À exécuter dans Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
--  Après vidage du cache, revenaient : identité et carnet de vol. Manquaient :
--  la PHOTO du profil, les PRÉFÉRENCES D'UNITÉS, le SUIVI MÉDICAL et les
--  LICENCES / QUALIFICATIONS.
--
--  Ces trois derniers ensembles ont des formes libres côté application
--  (« pilotCertifications » est un objet, « pilotMedicalRecords » un tableau,
--  les unités un dictionnaire). Plutôt que de les aplatir en colonnes — au
--  risque de perdre un champ au passage — on les conserve TELS QUELS en JSON :
--  la restauration est alors fidèle au bit près. La table pilot_certifications
--  reste disponible pour une exploitation fine ultérieure (alertes d'expiration).
-- =============================================================================

alter table public.pilot_profiles add column if not exists certifications jsonb;
alter table public.pilot_profiles add column if not exists medical_records jsonb;
alter table public.pilot_profiles add column if not exists units_preferences jsonb;
alter table public.pilot_profiles add column if not exists photo_path text;

-- Vérification
select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'pilot_profiles'
   and column_name in ('certifications','medical_records','units_preferences','photo_path')
 order by column_name;
