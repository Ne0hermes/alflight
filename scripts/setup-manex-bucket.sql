-- ============================================================================
--  Setup du bucket Supabase Storage "manex-files" (ALFlight)
--  ----------------------------------------------------------------------------
--  CONTEXTE : les téléchargements de MANEX échouaient (HTTP 400/404 "Object not
--  found"). Diagnostic : le bucket "manex-files" n'était PAS public (l'URL
--  publique renvoie 400) et l'app ne peut pas le configurer depuis le navigateur
--  (la clé anon ne peut pas créer/rendre public un bucket → createBucket() échoue
--  en silence).
--
--  À EXÉCUTER : Supabase Dashboard → SQL Editor (rôle propriétaire/service).
--  Alternative no-code : Dashboard → Storage → bucket manex-files → "Make public".
-- ============================================================================

-- 1) Créer le bucket s'il n'existe pas, et le rendre PUBLIC en lecture.
--    (PDF uniquement, 50 Mo max — cohérent avec supabaseStorageSetup.js)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manex-files', 'manex-files', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public            = true,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) Policies RLS sur storage.objects pour ce bucket.

--    Lecture réservée aux utilisateurs AUTHENTIFIÉS.
--    ⚠️ NE PAS mettre une policy SELECT "publique" (pour tous) : sur un bucket
--    déjà public, le téléchargement des objets passe par l'URL publique et n'a
--    PAS besoin de policy SELECT. Une policy SELECT ouverte permettrait à
--    n'importe qui (clé anon) de LISTER tout le bucket = fuite de l'inventaire
--    (immatriculations, noms de fichiers). C'est l'avertissement signalé par
--    Supabase ("Clients can list all files in this bucket").
--    👉 Exposition minimale : tu peux même SUPPRIMER cette policy entièrement,
--       les téléchargements via URL publique continueront de fonctionner.
drop policy if exists "manex_public_read" on storage.objects;        -- ancienne policy trop large
drop policy if exists "manex_authenticated_read" on storage.objects;
create policy "manex_authenticated_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'manex-files');

--    Upload / mise à jour / suppression réservés aux utilisateurs authentifiés.
drop policy if exists "manex_auth_insert" on storage.objects;
create policy "manex_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'manex-files');

drop policy if exists "manex_auth_update" on storage.objects;
create policy "manex_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'manex-files')
  with check (bucket_id = 'manex-files');

drop policy if exists "manex_auth_delete" on storage.objects;
create policy "manex_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'manex-files');

-- 3) Vérification : lister les objets présents (doit montrer les MANEX uploadés).
--    Si VIDE alors que des avions ont un manex_files.file_path en base, c'est que
--    les fichiers n'ont jamais été uploadés ici → il faut RÉ-IMPORTER le MANEX.
select name, bucket_id, created_at
from storage.objects
where bucket_id = 'manex-files'
order by created_at desc
limit 50;
