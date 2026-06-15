-- ============================================================================
--  R20/B — Buckets Storage pour les GROS blobs sortis de aircraft_data
--  ----------------------------------------------------------------------------
--  CONTEXTE : aircraft_data (JSONB) atteignait 9 Mo (PDF de pesée 4,6 Mo +
--  images d'abaque 2,7 Mo en base64 inline) → l'UPDATE dépassait le
--  statement_timeout Postgres (code 57014). On externalise ces blobs vers
--  Storage (motif MANEX) ; aircraft_data ne garde qu'une URL publique courte.
--
--  À EXÉCUTER UNE FOIS : Supabase Dashboard → SQL Editor (rôle propriétaire).
--  Idempotent (on conflict / drop policy if exists).
-- ============================================================================

-- ─── 1) Bucket des fiches de pesée (PDF, 20 Mo max) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('weighing-reports', 'weighing-reports', true, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── 2) Bucket des images d'abaque (PNG/JPEG/WebP, 15 Mo max) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('abaque-images', 'abaque-images', true, 15728640,
        array['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── 3) Policies RLS (mêmes principes que manex-files) ───
--  Lecture via URL publique (bucket public) → pas besoin de policy SELECT large
--  (éviter de laisser lister tout le bucket). Upload/MAJ/suppression : authentifié.
do $$
declare b text;
begin
  foreach b in array array['weighing-reports', 'abaque-images'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_auth_read');
    execute format($p$create policy %I on storage.objects for select to authenticated using (bucket_id = %L)$p$, b || '_auth_read', b);
    execute format('drop policy if exists %I on storage.objects', b || '_auth_insert');
    execute format($p$create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L)$p$, b || '_auth_insert', b);
    execute format('drop policy if exists %I on storage.objects', b || '_auth_update');
    execute format($p$create policy %I on storage.objects for update to authenticated using (bucket_id = %L) with check (bucket_id = %L)$p$, b || '_auth_update', b, b);
    execute format('drop policy if exists %I on storage.objects', b || '_auth_delete');
    execute format($p$create policy %I on storage.objects for delete to authenticated using (bucket_id = %L)$p$, b || '_auth_delete', b);
  end loop;
end $$;

-- ─── 4) (optionnel) Remonter le statement_timeout — déblocage immédiat (R20/A) ───
--  À décommenter si tu veux le pansement en plus de l'externalisation :
-- alter role authenticated set statement_timeout = '30s';
-- alter role anon          set statement_timeout = '30s';
-- notify pgrst, 'reload config';

select id, public, file_size_limit from storage.buckets
where id in ('weighing-reports', 'abaque-images');
