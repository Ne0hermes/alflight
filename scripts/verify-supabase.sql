-- =============================================================================
--  VÉRIFICATION DE LA CONNEXION / DU CONTENU SUPABASE — ALFlight
--  À coller dans : Supabase Dashboard → SQL Editor → Run.
--  But : voir la VÉRITÉ TERRAIN de ce qui existe en base, vs ce que l'app affiche.
-- =============================================================================

-- 1) Quelles tables existent réellement dans le schéma public ?
--    (ne devine pas les noms : on liste tout)
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) Combien d'avions as-tu DANS LE CLOUD ? (référence absolue)
select count(*) as total_avions_cloud from community_presets;

-- 3) La liste complète de TES avions en base (compare avec ce que l'app montre)
select registration, model, manufacturer, submitted_by, submitted_at,
       (aircraft_data is not null) as a_des_donnees_completes,
       has_manex, verified, admin_verified
from community_presets
order by submitted_at desc;

-- 4) Détection des doublons d'immatriculation (un avion en double = ambiguïté)
select registration, count(*) as occurrences
from community_presets
group by registration
having count(*) > 1
order by occurrences desc;

-- 5) Avions aux données de M&C/perf potentiellement incomplètes
--    (adapte les clés JSON à ton schéma réel si besoin)
select registration,
       aircraft_data ->> 'fuelType'       as fuel_type,
       aircraft_data -> 'weights'         as masses,
       aircraft_data -> 'armLengths'      as bras,
       aircraft_data -> 'cgEnvelope'      as enveloppe_cg
from community_presets
order by registration;

-- 6) PRÉDICTION DE L'AUDIT : ces tables NE DEVRAIENT PAS encore exister
--    (données aujourd'hui hardcodées dans le code → à créer en base).
--    Si la requête renvoie 0 ligne pour un nom, la table est ABSENTE = à créer.
select 'aeroclubs'            as table_attendue,
       to_regclass('public.aeroclubs')            is not null as existe
union all
select 'regulations',          to_regclass('public.regulations')          is not null
union all
select 'regulation_profiles',  to_regclass('public.regulation_profiles')  is not null;

-- 7) Cas F-HSTR (le correctif hardcodé de l'audit) : quelle est la VRAIE
--    masse à vide en base ? (le code force '900' — vérifie la source de vérité)
select registration,
       aircraft_data -> 'weights' ->> 'emptyWeight' as masse_vide_cloud
from community_presets
where registration = 'F-HSTR';

-- =============================================================================
--  LECTURE :
--  • Req. 1 : confronte aux tables citées dans l'audit (community_presets,
--    vfr_points, vac_charts, validated_pdfs, flight plans...).
--  • Req. 6 : si 'existe' = false → confirme qu'aeroclubs/regulations/
--    regulation_profiles sont à CRÉER (cf. AUDIT_HARDCODING_GLOBAL.md §3.2).
--  • Req. 2/3 vs cache local (DevTools → Application → IndexedDB) : un écart
--    = l'app ne reflète pas le cloud (cache obsolète ou fallback silencieux).
-- =============================================================================
