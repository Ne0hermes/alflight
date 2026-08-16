-- =============================================================================
--  DEMANDES D'AJOUT D'AVION (formulaire utilisateur avec PIÈCE JOINTE)
--  2026-08-16 — à exécuter dans Supabase → SQL Editor → Run. Idempotent.
-- =============================================================================
--  Un utilisateur standard téléverse le manuel de vol (PDF) directement dans
--  un bucket privé + enregistre une demande. L'ADMIN voit les demandes
--  (dashboard, puis boîte de réception in-app en phase serveur) et crée la
--  fiche avion. Remplace la limite du mailto (pas de pièce jointe possible).
-- =============================================================================

-- 1. Table des demandes
create table if not exists public.aircraft_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid(),
  user_email text,
  registration text not null,
  manufacturer_model text,
  message text,
  file_path text not null,       -- chemin dans le bucket aircraft-requests
  file_name text not null,
  file_size integer,
  status text not null default 'pending',  -- pending | processed | rejected
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_aircraft_requests_user on public.aircraft_requests(user_id);
create index if not exists idx_aircraft_requests_status on public.aircraft_requests(status);

-- 2. RLS
alter table public.aircraft_requests enable row level security;
drop policy if exists "req: insert en son nom" on public.aircraft_requests;
drop policy if exists "req: lecture propriétaire ou admin" on public.aircraft_requests;
drop policy if exists "req: update admin" on public.aircraft_requests;
drop policy if exists "req: delete admin" on public.aircraft_requests;

create policy "req: insert en son nom" on public.aircraft_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy "req: lecture propriétaire ou admin" on public.aircraft_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "req: update admin" on public.aircraft_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "req: delete admin" on public.aircraft_requests
  for delete to authenticated using (public.is_admin());

-- 3. Bucket privé pour les manuels joints (50 Mo max par fichier, PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aircraft-requests', 'aircraft-requests', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4. Policies storage du bucket
drop policy if exists "storage req: upload en son dossier" on storage.objects;
drop policy if exists "storage req: lecture propriétaire ou admin" on storage.objects;
drop policy if exists "storage req: delete admin" on storage.objects;

-- Chaque utilisateur ne peut téléverser QUE dans son propre dossier <uid>/…
create policy "storage req: upload en son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'aircraft-requests'
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage req: lecture propriétaire ou admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'aircraft-requests'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "storage req: delete admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'aircraft-requests' and public.is_admin());

-- 5. ANTI-DOUBLON (2026-08-16) : un utilisateur doit savoir AVANT d'envoyer si
--    une demande est déjà en cours pour la même immatriculation — sans pouvoir
--    lire les demandes des autres. Fonction SECURITY DEFINER qui ne renvoie
--    qu'un BOOLÉEN (aucune donnée exposée).
create or replace function public.aircraft_request_pending(reg text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.aircraft_requests
    where upper(trim(registration)) = upper(trim(reg))
      and status = 'pending'
  );
$$;
revoke all on function public.aircraft_request_pending(text) from public;
-- Supabase accorde par défaut l'exécution des fonctions au rôle anon (default
-- privileges) : révocation EXPLICITE nécessaire — vérifié le 2026-08-16.
revoke execute on function public.aircraft_request_pending(text) from anon;
grant execute on function public.aircraft_request_pending(text) to authenticated;

-- 6. BASE D'ATTACHE (2026-08-16) : remplace « constructeur / modèle » dans le
--    formulaire — le demandeur indique son aéroclub/aérodrome, la fiche du
--    wizard récupère directement l'OACI. Idempotent.
alter table public.aircraft_requests add column if not exists home_base text;

-- 6bis. NETTOYAGE CLIENT (revue 2026-08-16) : si l'enregistrement de la
--    demande échoue APRÈS le téléversement, le client retire son propre PDF
--    (sinon fichier orphelin non supprimable — la policy delete était
--    admin-only). Chacun ne peut supprimer QUE dans son dossier <uid>/.
drop policy if exists "storage req: delete son propre fichier" on storage.objects;
create policy "storage req: delete son propre fichier" on storage.objects
  for delete to authenticated
  using (bucket_id = 'aircraft-requests'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- 7. Vérification
select 'aircraft_requests' as verif, count(*) as policies
  from pg_policies where tablename = 'aircraft_requests';
select id, public, file_size_limit from storage.buckets where id = 'aircraft-requests';
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'aircraft_requests'
  order by ordinal_position;
