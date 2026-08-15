-- =============================================================================
--  PHASE 1 — RBAC ADMIN/UTILISATEUR + RLS STRICTES        (v3, 2026-08-15)
-- =============================================================================
--  Modèle (décision César, 2026-08-12) :
--    • ADMIN : seul à ÉCRIRE le référentiel (avions, MANEX, VAC, données).
--    • UTILISATEUR : référentiel en LECTURE SEULE ; garde ses PROPRES données
--      (plans de vol, PDF validés, points VFR créés par lui, votes).
--
--  v3 : script ENTIÈREMENT DÉFENSIF — chaque section ne s'applique qu'aux
--  tables réellement présentes dans la base (la v2 échouait sur vac_charts,
--  table des scripts du dépôt jamais créée dans ce projet). Le premier bloc
--  liste ce qui existe. Idempotent : ré-exécutable tel quel.
--
--  PRÉREQUIS — rôle admin déjà posé (fait le 2026-08-15) :
--      update auth.users
--      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--                              || '{"role":"admin"}'::jsonb
--      where email = 'VOTRE_EMAIL_ADMIN';
--  Puis DÉCONNEXION/RECONNEXION dans l'app (le rôle vit dans le JWT).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0-a. INVENTAIRE — quelles tables existent réellement ? (lire les NOTICES)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['community_presets','manex_files','preset_votes',
                           'preset_downloads','vfr_points','vac_charts',
                           'vac_download_history','flight_plans',
                           'validated_flight_pdfs']
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'TABLE % : ABSENTE — sections correspondantes sautées', t;
    else
      raise notice 'table % : présente', t;
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0-b. FONCTION DE RÔLE — lit le rôle depuis le JWT (app_metadata)
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
-- 1-a. VUES DÉPENDANTES démontées (bloquent l'alter column type)
-- ─────────────────────────────────────────────────────────────────────────────
drop view if exists presets_with_stats;
drop view if exists vac_charts_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1-b. TOUTES les policies démontées AVANT conversion (bloquent aussi l'alter)
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
  raise notice 'Policies existantes démontées.';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. COLONNES DE PROPRIÉTÉ : VARCHAR → uuid (tables présentes uniquement ;
--    valeurs héritées non-UUID mises à NULL)
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
-- 3. RECRÉATION des vues (uniquement si leurs tables existent) +
--    security_invoker=on (une vue ne doit pas contourner la RLS du lecteur)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.community_presets') is not null
     and to_regclass('public.manex_files') is not null then
    execute $v$
      create view presets_with_stats as
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
      order by p.downloads_count desc, net_votes desc
    $v$;
    execute 'alter view presets_with_stats set (security_invoker = on)';
    raise notice 'Vue presets_with_stats recréée (security_invoker=on)';
  end if;

  if to_regclass('public.vac_charts') is not null then
    execute $v$
      create view vac_charts_active as
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
      order by icao asc
    $v$;
    execute 'alter view vac_charts_active set (security_invoker = on)';
    raise notice 'Vue vac_charts_active recréée (security_invoker=on)';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. flight_plans / validated_flight_pdfs : colonne propriétaire (absente !)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.flight_plans') is not null then
    execute 'alter table public.flight_plans add column if not exists user_id uuid default auth.uid()';
    execute 'create index if not exists idx_flight_plans_user on public.flight_plans(user_id)';
  end if;
  if to_regclass('public.validated_flight_pdfs') is not null then
    execute 'alter table public.validated_flight_pdfs add column if not exists user_id uuid default auth.uid()';
    execute 'create index if not exists idx_validated_pdfs_user on public.validated_flight_pdfs(user_id)';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS + POLICIES STRICTES — appliquées PAR TABLE PRÉSENTE
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- ── RÉFÉRENTIEL : community_presets ────────────────────────────────────────
  if to_regclass('public.community_presets') is not null then
    execute 'alter table public.community_presets enable row level security';
    execute $p$create policy "ref: lecture authentifiée" on public.community_presets
      for select to authenticated using (status = 'active' or public.is_admin())$p$;
    execute $p$create policy "ref: insert admin" on public.community_presets
      for insert to authenticated with check (public.is_admin())$p$;
    execute $p$create policy "ref: update admin" on public.community_presets
      for update to authenticated using (public.is_admin()) with check (public.is_admin())$p$;
    execute $p$create policy "ref: delete admin" on public.community_presets
      for delete to authenticated using (public.is_admin())$p$;
  end if;

  -- ── RÉFÉRENTIEL : manex_files ──────────────────────────────────────────────
  if to_regclass('public.manex_files') is not null then
    execute 'alter table public.manex_files enable row level security';
    execute $p$create policy "manex: lecture authentifiée" on public.manex_files
      for select to authenticated using (true)$p$;
    execute $p$create policy "manex: insert admin" on public.manex_files
      for insert to authenticated with check (public.is_admin())$p$;
    execute $p$create policy "manex: update admin" on public.manex_files
      for update to authenticated using (public.is_admin()) with check (public.is_admin())$p$;
    execute $p$create policy "manex: delete admin" on public.manex_files
      for delete to authenticated using (public.is_admin())$p$;
  end if;

  -- ── RÉFÉRENTIEL : vac_charts (si présente) ─────────────────────────────────
  if to_regclass('public.vac_charts') is not null then
    execute 'alter table public.vac_charts enable row level security';
    execute $p$create policy "vac: lecture authentifiée" on public.vac_charts
      for select to authenticated using (true)$p$;
    execute $p$create policy "vac: insert admin" on public.vac_charts
      for insert to authenticated with check (public.is_admin())$p$;
    execute $p$create policy "vac: update admin" on public.vac_charts
      for update to authenticated using (public.is_admin()) with check (public.is_admin())$p$;
    execute $p$create policy "vac: delete admin" on public.vac_charts
      for delete to authenticated using (public.is_admin())$p$;
  end if;

  if to_regclass('public.vac_download_history') is not null then
    execute 'alter table public.vac_download_history enable row level security';
    execute $p$create policy "vac-hist: insert authentifié" on public.vac_download_history
      for insert to authenticated with check (true)$p$;
    execute $p$create policy "vac-hist: lecture admin" on public.vac_download_history
      for select to authenticated using (public.is_admin())$p$;
  end if;

  -- ── COMMUNAUTÉ : votes / stats ─────────────────────────────────────────────
  if to_regclass('public.preset_votes') is not null then
    execute 'alter table public.preset_votes enable row level security';
    execute $p$create policy "votes: lecture authentifiée" on public.preset_votes
      for select to authenticated using (true)$p$;
    execute $p$create policy "votes: insert en son nom" on public.preset_votes
      for insert to authenticated with check (user_id = auth.uid())$p$;
    execute $p$create policy "votes: update son vote" on public.preset_votes
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())$p$;
    execute $p$create policy "votes: delete son vote" on public.preset_votes
      for delete to authenticated using (user_id = auth.uid() or public.is_admin())$p$;
  end if;

  if to_regclass('public.preset_downloads') is not null then
    execute 'alter table public.preset_downloads enable row level security';
    execute $p$create policy "downloads: insert authentifié" on public.preset_downloads
      for insert to authenticated with check (user_id = auth.uid() or user_id is null)$p$;
    execute $p$create policy "downloads: lecture admin" on public.preset_downloads
      for select to authenticated using (public.is_admin())$p$;
  end if;

  -- ── DONNÉES UTILISATEUR : vfr_points ───────────────────────────────────────
  if to_regclass('public.vfr_points') is not null then
    execute 'alter table public.vfr_points enable row level security';
    execute $p$create policy "vfr: lecture authentifiée" on public.vfr_points
      for select to authenticated using (status = 'active' or uploaded_by = auth.uid() or public.is_admin())$p$;
    execute $p$create policy "vfr: insert en son nom" on public.vfr_points
      for insert to authenticated with check (uploaded_by = auth.uid())$p$;
    execute $p$create policy "vfr: update propriétaire" on public.vfr_points
      for update to authenticated
      using (uploaded_by = auth.uid() or public.is_admin())
      with check (uploaded_by = auth.uid() or public.is_admin())$p$;
    execute $p$create policy "vfr: delete propriétaire" on public.vfr_points
      for delete to authenticated using (uploaded_by = auth.uid() or public.is_admin())$p$;
  end if;

  -- ── DONNÉES UTILISATEUR : flight_plans ─────────────────────────────────────
  if to_regclass('public.flight_plans') is not null then
    execute 'alter table public.flight_plans enable row level security';
    execute $p$create policy "fpl: lecture propriétaire" on public.flight_plans
      for select to authenticated using (user_id = auth.uid() or public.is_admin())$p$;
    execute $p$create policy "fpl: insert en son nom" on public.flight_plans
      for insert to authenticated with check (user_id = auth.uid())$p$;
    execute $p$create policy "fpl: update propriétaire" on public.flight_plans
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())$p$;
    execute $p$create policy "fpl: delete propriétaire" on public.flight_plans
      for delete to authenticated using (user_id = auth.uid() or public.is_admin())$p$;
  end if;

  -- ── DONNÉES UTILISATEUR : validated_flight_pdfs ────────────────────────────
  if to_regclass('public.validated_flight_pdfs') is not null then
    execute 'alter table public.validated_flight_pdfs enable row level security';
    execute $p$create policy "pdf: lecture propriétaire" on public.validated_flight_pdfs
      for select to authenticated using (user_id = auth.uid() or public.is_admin())$p$;
    execute $p$create policy "pdf: insert en son nom" on public.validated_flight_pdfs
      for insert to authenticated with check (user_id = auth.uid())$p$;
    execute $p$create policy "pdf: delete propriétaire" on public.validated_flight_pdfs
      for delete to authenticated using (user_id = auth.uid() or public.is_admin())$p$;
  end if;

  raise notice 'Policies strictes appliquées sur les tables présentes.';
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. STORAGE (storage.objects existe toujours) — référentiel admin,
--    fichiers utilisateur au propriétaire (owner rempli par Supabase à l'upload)
-- ─────────────────────────────────────────────────────────────────────────────
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

create policy "storage fpl: lecture propriétaire" on storage.objects
  for select to authenticated
  using (bucket_id = 'flight-plan-pdfs' and (owner = auth.uid() or public.is_admin()));
create policy "storage fpl: upload en son nom" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'flight-plan-pdfs');
create policy "storage fpl: delete propriétaire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'flight-plan-pdfs' and (owner = auth.uid() or public.is_admin()));

create policy "storage vfrp: lecture authentifiée" on storage.objects
  for select to authenticated using (bucket_id = 'vfr-points-photos');
create policy "storage vfrp: upload authentifié" on storage.objects
  for insert to authenticated with check (bucket_id = 'vfr-points-photos');
create policy "storage vfrp: delete propriétaire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vfr-points-photos' and (owner = auth.uid() or public.is_admin()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. VÉRIFICATIONS (les 2 tableaux à me communiquer)
-- ─────────────────────────────────────────────────────────────────────────────
select 'RLS activée' as verif, tablename, rowsecurity
  from pg_tables where schemaname = 'public'
  and tablename in ('community_presets','manex_files','preset_votes','preset_downloads',
                    'vfr_points','vac_charts','vac_download_history','flight_plans',
                    'validated_flight_pdfs');
select 'policies' as verif, tablename, count(*)
  from pg_policies where schemaname in ('public','storage')
  group by tablename order by tablename;
