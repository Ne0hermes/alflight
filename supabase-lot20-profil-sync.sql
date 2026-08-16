-- =============================================================================
--  LOT 2.0 — SYNCHRONISATION DU COMPTE PILOTE
--  2026-08-16 — à exécuter dans Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
--  Constat : profil pilote, carnet de vol, flotte et cartes VAC n'existaient
--  QUE dans le navigateur. Un vidage de cache = tout perdu (dont le carnet de
--  vol, non reconstituable). Ce script crée leur copie serveur, rattachée au
--  compte, restaurée automatiquement à la reconnexion — y compris sur un
--  appareil neuf.
--
--  Règle d'accès unique et stricte : CHAQUE PILOTE NE VOIT QUE SES DONNÉES.
--  Contrairement au référentiel (community_presets, lisible par tous), il n'y
--  a ICI aucune lecture croisée — même pour l'administrateur : ce sont des
--  données personnelles, dont des données de santé (RGPD art. 9).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PROFIL PILOTE (1 ligne par compte)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pilot_profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  -- Identité
  first_name text, last_name text, date_of_birth date, nationality text,
  email text, phone text, address text, city text, postal_code text, country text,
  -- Licence
  license_number text, license_type text, license_country text,
  license_issue_date date, license_expiry_date date,
  -- Expérience (compteurs de synthèse ; le détail vit dans logbook_entries)
  total_flight_hours numeric, total_landings integer,
  hours_as_p1 numeric, hours_as_p2 numeric,
  day_hours numeric, night_hours numeric, ifr_hours numeric,
  cross_country_hours numeric, instructor_hours numeric,
  -- Rattachement & préférences
  home_base text,                 -- aérodrome d'attache (OACI) : alimente l'import auto
  club_school text,
  default_aircraft text,
  preferred_units text,
  units_preferences jsonb,        -- préférences détaillées (mm/kg/L…)
  photo_path text,                -- fichier dans le bucket privé pilot-photos
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. QUALIFICATIONS & APTITUDE MÉDICALE (données sensibles)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pilot_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,             -- 'qualification' | 'medical'
  label text,                     -- SEP, FI, classe 2…
  authority text,
  issue_date date,
  expiry_date date,
  restrictions text,
  document_path text,             -- justificatif éventuel (bucket privé)
  details jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_pilot_certifications_user on public.pilot_certifications(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CARNET DE VOL (document opposable — correction TRACÉE, jamais silencieuse)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.logbook_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Identifiant STABLE du vol côté application : permet de re-synchroniser
  -- sans jamais dupliquer un vol ni en perdre un (mise à jour par clé, pas
  -- de « tout effacer puis réécrire » sur un document opposable).
  client_id text not null,
  flight_date date not null,
  departure text, arrival text, route text,
  aircraft_registration text, aircraft_type text, aircraft_group text,
  pilot_in_command text, copilot text,
  block_off text, take_off text, landing text, block_on text,
  total_time text,                -- HH:MM (format saisi par le pilote)
  night_time numeric, ifr_time numeric,
  flight_type text, pilot_function text,
  landings_day integer, landings_night integer,
  remarks text,
  details jsonb,                  -- segments et champs additionnels
  -- Traçabilité : un vol corrigé garde la trace de sa correction
  revision integer not null default 1,
  corrected_at timestamptz,
  deleted_at timestamptz,         -- suppression LOGIQUE (jamais d'effacement sec)
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_logbook_user_date on public.logbook_entries(user_id, flight_date desc);
create unique index if not exists uq_logbook_user_client on public.logbook_entries(user_id, client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MA FLOTTE — rattachement seul (la fiche technique reste dans le référentiel)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_aircraft (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  registration text not null,
  community_preset_id uuid,       -- fiche à re-télécharger à la reconnexion
  tank_variant_id text,           -- variante de réservoirs choisie par le pilote
  is_default boolean not null default false,
  added_at timestamptz not null default now(),
  unique (user_id, registration)
);
create index if not exists idx_user_aircraft_user on public.user_aircraft(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CARTES VAC DU PILOTE — sa copie personnelle, figée, sous SA responsabilité
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_vac_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  icao text not null,
  airport_name text,
  airac_cycle text,               -- cycle AIRAC de la carte téléchargée
  published_at date,              -- date de publication portée par la carte
  downloaded_at timestamptz not null default now(),
  file_path text not null,        -- bucket privé pilot-vac : <user_id>/<ICAO>-<cycle>.pdf
  file_size integer,
  checksum text,
  source_url text,                -- provenance officielle (traçabilité)
  unique (user_id, icao, airac_cycle)
);
create index if not exists idx_user_vac_user on public.user_vac_charts(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS — « chacun chez soi », sans exception (pas de lecture admin)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['pilot_profiles','pilot_certifications','logbook_entries',
                           'user_aircraft','user_vac_charts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "perso: lecture" on public.%I', t);
    execute format('drop policy if exists "perso: insert" on public.%I', t);
    execute format('drop policy if exists "perso: update" on public.%I', t);
    execute format('drop policy if exists "perso: delete" on public.%I', t);
    execute format($p$create policy "perso: lecture" on public.%I
      for select to authenticated using (user_id = auth.uid())$p$, t);
    execute format($p$create policy "perso: insert" on public.%I
      for insert to authenticated with check (user_id = auth.uid())$p$, t);
    execute format($p$create policy "perso: update" on public.%I
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())$p$, t);
    execute format($p$create policy "perso: delete" on public.%I
      for delete to authenticated using (user_id = auth.uid())$p$, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BUCKETS PRIVÉS (photo du pilote, justificatifs, cartes VAC personnelles)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pilot-photos', 'pilot-photos', false, 5242880,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pilot-vac', 'pilot-vac', false, 52428800, array['application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pilot-documents', 'pilot-documents', false, 20971520,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

-- Chaque pilote n'accède QU'À son dossier <user_id>/… dans ces trois espaces.
do $$
declare b text;
begin
  foreach b in array array['pilot-photos','pilot-vac','pilot-documents']
  loop
    execute format('drop policy if exists "perso storage %s: lecture" on storage.objects', b);
    execute format('drop policy if exists "perso storage %s: upload" on storage.objects', b);
    execute format('drop policy if exists "perso storage %s: update" on storage.objects', b);
    execute format('drop policy if exists "perso storage %s: delete" on storage.objects', b);
    execute format($p$create policy "perso storage %s: lecture" on storage.objects
      for select to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b, b);
    execute format($p$create policy "perso storage %s: upload" on storage.objects
      for insert to authenticated
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b, b);
    execute format($p$create policy "perso storage %s: update" on storage.objects
      for update to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b, b);
    execute format($p$create policy "perso storage %s: delete" on storage.objects
      for delete to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b, b);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Vérification
-- ─────────────────────────────────────────────────────────────────────────────
select tablename, count(*) as policies
  from pg_policies
 where schemaname = 'public'
   and tablename in ('pilot_profiles','pilot_certifications','logbook_entries',
                     'user_aircraft','user_vac_charts')
 group by tablename order by tablename;

select id, public, file_size_limit from storage.buckets
 where id in ('pilot-photos','pilot-vac','pilot-documents');
