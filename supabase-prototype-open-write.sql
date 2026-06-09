-- =============================================================================
--  PROTOTYPE — « FICHE UNIQUE PARTAGÉE, MISE À JOUR EN PLACE »
-- =============================================================================
--  But : pouvoir ÉCRASER en place n'importe quelle fiche de community_presets
--  (même celles que tu n'as pas créées), pour que chaque enregistrement mette
--  la base Supabase à jour et que la donnée la plus récente soit toujours là
--  au re-téléchargement.
--
--  ⚠️ FAILLE DE SÉCURITÉ ASSUMÉE : ceci ouvre l'écriture/suppression de la table
--     à TOUT LE MONDE (toute personne ayant la clé anon de l'app). Acceptable en
--     PROTOTYPE mono-utilisateur uniquement. NE PAS garder en production.
--     Pour re-sécuriser plus tard : ré-exécuter supabase-rls-strict.sql.
--
--  À exécuter dans : Supabase → SQL Editor → Run.
-- =============================================================================

-- RLS doit rester ACTIVÉE (les policies ci-dessous décident des droits)
alter table community_presets enable row level security;

-- ── LECTURE (inchangé) : tout le monde lit les fiches actives ────────────────
drop policy if exists "Public read presets" on community_presets;
create policy "Public read presets"
  on community_presets for select
  using (status = 'active');

-- ── MISE À JOUR EN PLACE : autorisée pour tous (c'est LE point clé) ──────────
drop policy if exists "Owner update presets"     on community_presets;
drop policy if exists "Prototype update presets" on community_presets;
create policy "Prototype update presets"
  on community_presets for update
  using (true) with check (true);

-- ── CRÉATION : autorisée pour tous (nouvel avion) ───────────────────────────
drop policy if exists "Anyone can insert presets"     on community_presets;
drop policy if exists "Authenticated insert presets"  on community_presets;
drop policy if exists "Prototype insert presets"      on community_presets;
create policy "Prototype insert presets"
  on community_presets for insert
  with check (true);

-- ── SUPPRESSION : autorisée pour tous (bouton supprimer) ────────────────────
drop policy if exists "Owner delete presets"     on community_presets;
drop policy if exists "Prototype delete presets" on community_presets;
create policy "Prototype delete presets"
  on community_presets for delete
  using (true);

-- ── MANEX : autoriser upload/maj/suppression des métadonnées (table) ────────
alter table manex_files enable row level security;
drop policy if exists "Public read manex"        on manex_files;
drop policy if exists "Authenticated upload manex" on manex_files;
drop policy if exists "Authenticated delete manex" on manex_files;
drop policy if exists "Prototype manex all"      on manex_files;
create policy "Public read manex"   on manex_files for select using (true);
create policy "Prototype manex all" on manex_files for all using (true) with check (true);

-- =============================================================================
--  NOTE STORAGE (bucket "manex-files") : si l'upload de PDF échoue encore après
--  ce script, ouvre aussi le bucket dans Supabase → Storage → Policies
--  (INSERT/UPDATE/SELECT for all), ou rends le bucket public.
-- =============================================================================

-- =============================================================================
--  ALTERNATIVE PLUS SÛRE (au lieu d'ouvrir à tous) — « t'approprier la base »
--  -------------------------------------------------------------------------
--  Tu es seul utilisateur : tu peux devenir propriétaire de TOUTES les fiches
--  et GARDER la RLS owner-only (supabase-rls-strict.sql). Aucun trou de sécu.
--
--    1) Récupère ton UID :   select auth.uid();   -- (connecté), ou copie-le
--       depuis Authentication → Users dans le dashboard.
--    2) Remplace <TON_UID> puis exécute :
--         update community_presets set submitted_by = '<TON_UID>';
--    3) NE PAS exécuter les policies "Prototype ..." ci-dessus ; garder Owner*.
--
--  Dans ce mode, tu dois rester CONNECTÉ dans l'app (l'UPDATE passe parce que
--  tu possèdes les fiches). C'est l'option recommandée si tu veux la sécurité.
-- =============================================================================
