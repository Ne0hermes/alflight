-- =============================================================================
--  PHASE 1 — RBAC ADMIN/UTILISATEUR + RLS STRICTES        (2026-08-14)
-- =============================================================================
--  Modèle (décision César, 2026-08-12) :
--    • ADMIN (vous) : seul à pouvoir ÉCRIRE le référentiel — avions
--      communautaires, MANEX, cartes VAC, données. « Configurer un avion »
--      est réservé à l'admin.
--    • UTILISATEUR : référentiel en LECTURE SEULE ; garde ses PROPRES données
--      (plans de vol, PDF validés, points VFR créés par lui, votes).
--
--  PRÉREQUIS (à faire AVANT d'exécuter ce script) — poser le rôle admin.
--    Méthode SQL (recommandée — le dashboard n'expose pas toujours
--    app_metadata) ; exécuter dans le SQL Editor :
--
--      update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                              || '{"role":"admin"}'::jsonb
--      where email = 'VOTRE_EMAIL_ADMIN';
--
--      -- vérification :
--      select email, raw_app_meta_data->>'role' as role from auth.users;
--
--    (raw_app_meta_data est côté serveur — un utilisateur ne peut PAS
--     s'auto-promouvoir depuis l'app.)
--    Puis DÉCONNEXION/RECONNEXION dans l'app (le rôle vit dans le JWT).
--
--  À exécuter dans : Supabase → SQL Editor → Run. Idempotent (ré-exécutable).
--  Remplace DÉFINITIVEMENT supabase-prototype-open-write.sql (2026-06-09).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. FONCTION DE RÔLE — lit le rôle depuis le JWT (app_metadata)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

comment on function public.is_admin() is
  'Rôle admin lu depuis app_metadata du JWT (non modifiable par le client). Phase 1 RBAC.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1-pré. VUES DÉPENDANTES : Postgres refuse de changer le type d'une colonne
--        référencée par une vue (« cannot alter type of a column used by a
--        view or rule »). On démonte les 2 vues concernées, elles sont
--        recréées À L'IDENTIQUE en 1-post.
-- ─────────────────────────────────────────────────────────────────────────────
drop view if exists presets_with_stats;   -- dépend de community_presets.* (submitted_by)
drop view if exists vac_charts_active;    -- dépend de vac_charts.uploaded_by

-- ─────────────────────────────────────────────────────────────────────────────
-- 1-pré-b. DÉMONTAGE de TOUTES les policies AVANT la conversion des colonnes :
--          Postgres refuse aussi « alter type of a column used in a policy
--          definition » (ex. « Users can update their own VFR points »).
--          Les policies strictes sont recréées plus bas (sections 5-8).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname = 'public'
           and tablename in ('community_presets','manex_files','preset_votes',
                             'preset_downloads','vfr_points','vac_charts',
                             'vac_download_history','flight_plans',
                             'validated_flight_pdfs'))
       or (schemaname = 'storage' and tablename = 'objects')
  loop
    execute format('drop policy if exists %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  end loop;
  raise notice 'Toutes les policies existantes démontées (avant conversion).';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COLONNES DE PROPRIÉTÉ : VARCHAR → uuid  (sinon « = auth.uid() » ne matche
--    jamais). Les valeurs non-UUID héritées (ex. 'anonymous') sont mises à NULL.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  for r in
    select * from (values
      ('community_presets', 'submitted_by'),
      ('manex_files',       'uploaded_by'),
      ('preset_votes',      'user_id'),
      ('preset_downloads',  'user_id'),
      ('vfr_points',        'uploaded_by'),
      ('vac_charts',        'uploaded_by')
    ) as t(tbl, col)
  loop
    -- ignorer si la table/colonne n'existe pas ou est déjà en uuid
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = r.col
        and data_type <> 'uuid'
    ) then
      execute format('alter table public.%I alter column %I drop not null', r.tbl, r.col);
      execute format('update public.%I set %I = null where %I is not null and %I !~ %L',
                     r.tbl, r.col, r.col, r.col, uuid_re);
      execute format('alter table public.%I alter column %I type uuid using %I::uuid',
                     r.tbl, r.col, r.col);
      raise notice 'Converti % . % en uuid', r.tbl, r.col;
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1-post. RECRÉATION des vues démontées en 1-pré (définitions d'origine,
--         reprises de supabase-setup-fixed.sql et supabase-vac-charts-setup.sql)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view presets_with_stats as
select
  p.*,
  m.filename as manex_filename,
  m.file_size as manex_filesize,
  (p.votes_up - p.votes_down) as net_votes,
  case
    when p.admin_verified then 'admin_verified'
    when p.verified then 'community_verified'
    else 'not_verified'
  end as verification_status
from community_presets p
left join manex_files m on p.manex_file_id = m.id
where p.status = 'active'
order by p.downloads_count desc, net_votes desc;

create or replace view vac_charts_active as
select
  id, icao, aerodrome_name, file_name, file_path, file_size, mime_type,
  chart_type, effective_date, expiration_date, airac_cycle, source,
  download_url, uploaded_by, uploaded_at, download_count, last_downloaded_at,
  version, verified, admin_verified, notes,
  case
    when expiration_date < current_date then 'expired'
    when expiration_date <= current_date + interval '7 days' then 'expiring_soon'
    else 'valid'
  end as validity_status,
  case
    when admin_verified then 'admin_verified'
    when verified then 'community_verified'
    else 'not_verified'
  end as verification_status
from vac_charts
where status = 'active'
order by icao asc;

-- 🔒 Les vues doivent respecter la RLS de l'UTILISATEUR qui interroge (sinon
-- elles s'exécutent avec les droits du propriétaire et contournent la RLS).
alter view presets_with_stats set (security_invoker = on);
alter view vac_charts_active  set (security_invoker = on);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PLANS DE VOL & PDF VALIDÉS : ajout de la colonne propriétaire (absente !)
--    Les enregistrements existants restent NULL (visibles par l'admin seul).
-- ─────────────────────────────────────────────────────────────────────────────
alter table if exists public.flight_plans
  add column if not exists user_id uuid default auth.uid();
alter table if exists public.validated_flight_pdfs
  add column if not exists user_id uuid default auth.uid();

create index if not exists idx_flight_plans_user on public.flight_plans(user_id);
create index if not exists idx_validated_pdfs_user on public.validated_flight_pdfs(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. (démontage des policies : déplacé en 1-pré-b, AVANT la conversion des
--    colonnes — Postgres refuse de changer le type d'une colonne référencée
--    par une policy.)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS ACTIVÉE PARTOUT
-- ─────────────────────────────────────────────────────────────────────────────
alter table if exists public.community_presets      enable row level security;
alter table if exists public.manex_files            enable row level security;
alter table if exists public.preset_votes           enable row level security;
alter table if exists public.preset_downloads       enable row level security;
alter table if exists public.vfr_points             enable row level security;
alter table if exists public.vac_charts             enable row level security;
alter table if exists public.vac_download_history   enable row level security;
alter table if exists public.flight_plans           enable row level security;
alter table if exists public.validated_flight_pdfs  enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RÉFÉRENTIEL (avions, MANEX, VAC) — lecture authentifiée, ÉCRITURE ADMIN
-- ─────────────────────────────────────────────────────────────────────────────
-- community_presets
create policy "ref: lecture authentifiée" on public.community_presets
  for select to authenticated using (status = 'active' or public.is_admin());
create policy "ref: insert admin" on public.community_presets
  for insert to authenticated with check (public.is_admin());
create policy "ref: update admin" on public.community_presets
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ref: delete admin" on public.community_presets
  for delete to authenticated using (public.is_admin());

-- manex_files
create policy "manex: lecture authentifiée" on public.manex_files
  for select to authenticated using (true);
create policy "manex: insert admin" on public.manex_files
  for insert to authenticated with check (public.is_admin());
create policy "manex: update admin" on public.manex_files
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "manex: delete admin" on public.manex_files
  for delete to authenticated using (public.is_admin());

-- vac_charts
create policy "vac: lecture authentifiée" on public.vac_charts
  for select to authenticated using (true);
create policy "vac: insert admin" on public.vac_charts
  for insert to authenticated with check (public.is_admin());
create policy "vac: update admin" on public.vac_charts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "vac: delete admin" on public.vac_charts
  for delete to authenticated using (public.is_admin());

-- vac_download_history (journal de téléchargement : chacun écrit sa ligne)
create policy "vac-hist: insert authentifié" on public.vac_download_history
  for insert to authenticated with check (true);
create policy "vac-hist: lecture admin" on public.vac_download_history
  for select to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. COMMUNAUTÉ (votes, stats) — chacun en son nom
-- ─────────────────────────────────────────────────────────────────────────────
create policy "votes: lecture authentifiée" on public.preset_votes
  for select to authenticated using (true);
create policy "votes: insert en son nom" on public.preset_votes
  for insert to authenticated with check (user_id = auth.uid());
create policy "votes: update son vote" on public.preset_votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes: delete son vote" on public.preset_votes
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

create policy "downloads: insert authentifié" on public.preset_downloads
  for insert to authenticated with check (user_id = auth.uid() or user_id is null);
create policy "downloads: lecture admin" on public.preset_downloads
  for select to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. DONNÉES UTILISATEUR — propriétaire (+ admin en secours)
-- ─────────────────────────────────────────────────────────────────────────────
-- vfr_points (partagés en lecture, gérés par leur créateur)
create policy "vfr: lecture authentifiée" on public.vfr_points
  for select to authenticated using (status = 'active' or uploaded_by = auth.uid() or public.is_admin());
create policy "vfr: insert en son nom" on public.vfr_points
  for insert to authenticated with check (uploaded_by = auth.uid());
create policy "vfr: update propriétaire" on public.vfr_points
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_admin())
  with check (uploaded_by = auth.uid() or public.is_admin());
create policy "vfr: delete propriétaire" on public.vfr_points
  for delete to authenticated using (uploaded_by = auth.uid() or public.is_admin());

-- flight_plans (strictement personnels ; legacy user_id NULL → admin seul)
create policy "fpl: lecture propriétaire" on public.flight_plans
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "fpl: insert en son nom" on public.flight_plans
  for insert to authenticated with check (user_id = auth.uid());
create policy "fpl: update propriétaire" on public.flight_plans
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fpl: delete propriétaire" on public.flight_plans
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- validated_flight_pdfs (idem)
create policy "pdf: lecture propriétaire" on public.validated_flight_pdfs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "pdf: insert en son nom" on public.validated_flight_pdfs
  for insert to authenticated with check (user_id = auth.uid());
create policy "pdf: delete propriétaire" on public.validated_flight_pdfs
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. STORAGE — référentiel en écriture ADMIN, fichiers utilisateur au propriétaire
--    (storage.objects.owner est rempli automatiquement par Supabase à l'upload)
-- ─────────────────────────────────────────────────────────────────────────────
-- Buckets RÉFÉRENTIEL : manex-files, vac-charts, abaque-images, weighing-reports
create policy "storage ref: lecture authentifiée" on storage.objects
  for select to authenticated
  using (bucket_id in ('manex-files','vac-charts','abaque-images','weighing-reports'));
create policy "storage ref: écriture admin" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('manex-files','vac-charts','abaque-images','weighing-reports')
              and public.is_admin());
create policy "storage ref: update admin" on storage.objects
  for update to authenticated
  using (bucket_id in ('manex-files','vac-charts','abaque-images','weighing-reports')
         and public.is_admin());
create policy "storage ref: delete admin" on storage.objects
  for delete to authenticated
  using (bucket_id in ('manex-files','vac-charts','abaque-images','weighing-reports')
         and public.is_admin());

-- Bucket flight-plan-pdfs : chacun ses fichiers
create policy "storage fpl: lecture propriétaire" on storage.objects
  for select to authenticated
  using (bucket_id = 'flight-plan-pdfs' and (owner = auth.uid() or public.is_admin()));
create policy "storage fpl: upload en son nom" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'flight-plan-pdfs');
create policy "storage fpl: delete propriétaire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'flight-plan-pdfs' and (owner = auth.uid() or public.is_admin()));

-- Bucket vfr-points-photos : lecture pour tous les authentifiés, gestion propriétaire
create policy "storage vfrp: lecture authentifiée" on storage.objects
  for select to authenticated using (bucket_id = 'vfr-points-photos');
create policy "storage vfrp: upload authentifié" on storage.objects
  for insert to authenticated with check (bucket_id = 'vfr-points-photos');
create policy "storage vfrp: delete propriétaire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vfr-points-photos' and (owner = auth.uid() or public.is_admin()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. VÉRIFICATIONS (à lire après Run)
-- ─────────────────────────────────────────────────────────────────────────────
select 'RLS activée' as verif, tablename, rowsecurity
  from pg_tables where schemaname = 'public'
  and tablename in ('community_presets','manex_files','preset_votes','preset_downloads',
                    'vfr_points','vac_charts','vac_download_history','flight_plans',
                    'validated_flight_pdfs');
select 'policies' as verif, tablename, count(*)
  from pg_policies where schemaname in ('public','storage')
  group by tablename order by tablename;
-- Votre rôle vu par la base (exécuter CONNECTÉ depuis l'app pour tester) :
-- select public.is_admin();
