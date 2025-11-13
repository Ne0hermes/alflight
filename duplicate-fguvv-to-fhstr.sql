-- =====================================================
-- Script de duplication : F-GUVV → F-HSTR
-- =====================================================

-- 1. Vérifier si F-HSTR existe déjà
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM community_presets WHERE registration = 'F-HSTR')
    THEN '⚠️ ATTENTION : F-HSTR existe déjà dans la base !'
    ELSE '✅ F-HSTR n''existe pas, duplication possible'
  END as status;

-- 2. Afficher les données de F-GUVV (source)
SELECT
  registration,
  model,
  manufacturer,
  aircraft_type,
  category,
  submitted_by,
  has_manex,
  manex_file_id,
  description,
  aircraft_data->>'registration' as registration_in_json,
  aircraft_data->>'fuelCapacity' as fuel_capacity,
  aircraft_data->>'fuelConsumption' as fuel_consumption,
  aircraft_data->>'emptyWeight' as empty_weight
FROM community_presets
WHERE registration = 'F-GUVV';

-- =====================================================
-- 3. DUPLICATION : F-GUVV → F-HSTR
-- =====================================================

-- OPTION A : Dupliquer avec le même MANEX (si applicable)
-- Cette option réutilise le même fichier MANEX pour les deux avions

INSERT INTO community_presets (
  registration,
  model,
  manufacturer,
  aircraft_type,
  category,
  aircraft_data,
  submitted_by,
  description,
  has_manex,
  manex_file_id,
  version,
  votes_up,
  votes_down,
  verified,
  admin_verified,
  admin_verified_by,
  status,
  tags
)
SELECT
  'F-HSTR' as registration,  -- ✅ Nouvelle immatriculation
  model,
  manufacturer,
  aircraft_type,
  category,

  -- ✅ Mettre à jour la registration dans le JSON aircraft_data
  jsonb_set(
    aircraft_data,
    '{registration}',
    '"F-HSTR"'
  ) as aircraft_data,

  submitted_by,
  'Copie de F-GUVV pour F-HSTR' as description,
  has_manex,
  manex_file_id,  -- Même MANEX que F-GUVV
  1 as version,   -- Reset version à 1
  0 as votes_up,  -- Reset votes
  0 as votes_down,
  false as verified,
  false as admin_verified,
  NULL as admin_verified_by,
  'active' as status,
  tags
FROM community_presets
WHERE registration = 'F-GUVV';

-- =====================================================
-- 4. Vérification post-duplication
-- =====================================================

-- Afficher les deux avions côte à côte
SELECT
  registration,
  model,
  manufacturer,
  aircraft_data->>'fuelCapacity' as fuel_capacity_L,
  aircraft_data->>'fuelConsumption' as fuel_consumption_Lph,
  aircraft_data->>'emptyWeight' as empty_weight_kg,
  has_manex,
  votes_up,
  votes_down,
  verified,
  created_at
FROM community_presets
WHERE registration IN ('F-GUVV', 'F-HSTR')
ORDER BY registration;

-- Compter les avions
SELECT
  '✅ Duplication terminée !' as message,
  (SELECT COUNT(*) FROM community_presets WHERE registration = 'F-GUVV') as fguvv_count,
  (SELECT COUNT(*) FROM community_presets WHERE registration = 'F-HSTR') as fhstr_count;

-- =====================================================
-- 5. (OPTIONNEL) Supprimer F-HSTR si erreur
-- =====================================================
-- Décommentez cette ligne si vous voulez supprimer F-HSTR et recommencer

-- DELETE FROM community_presets WHERE registration = 'F-HSTR';
