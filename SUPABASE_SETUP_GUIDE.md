# Guide d'installation Supabase - ALFlight

## Vue d'ensemble

Ce guide explique comment configurer toutes les tables et fonctionnalités Supabase pour ALFlight dans le bon ordre.

## Ordre d'exécution des scripts

### ✅ Étape 1 : Configuration de base (OBLIGATOIRE)

Exécuter dans cet ordre :

1. **`supabase-setup.sql`** ou **`supabase-setup-fixed.sql`**
   - Configuration de base de Supabase
   - Tables et fonctions essentielles

2. **`supabase-validated-pdfs-setup.sql`** ⭐ NOUVEAU
   - Table `validated_flight_pdfs` pour stocker les PDFs validés
   - Bucket storage `flight-plan-pdfs`
   - Vue de statistiques
   - Fonction `generate_flight_pdf_path()`

### ✅ Étape 2 : Plans de vol complets (OPTIONNEL)

3. **`supabase-flight-plans-setup.sql`**
   - Table `flight_plans` pour stocker les plans de vol complets
   - Données détaillées : waypoints, météo, carburant, performances
   - ⚠️ Optionnel : uniquement si vous voulez sauvegarder les plans complets

4. **`supabase-add-flight-plan-fk.sql`** ⭐ NOUVEAU
   - Ajoute la foreign key entre `validated_flight_pdfs` et `flight_plans`
   - ⚠️ À exécuter SEULEMENT si vous avez créé `flight_plans` à l'étape 3

### ✅ Étape 3 : Numéros de vol lisibles (RECOMMANDÉ)

5. **`supabase-add-flight-numbers.sql`** ⭐ NOUVEAU
   - Ajoute des numéros de vol lisibles (FP-2024-0001, VP-2024-0001)
   - Génération automatique via triggers
   - Séquences par année
   - ⚠️ Nécessite que les tables `flight_plans` et `validated_flight_pdfs` existent

### ✅ Étape 4 : Points VFR communautaires (OPTIONNEL)

6. **`supabase-vfr-points-COMPLET.sql`**
   - Table `community_vfr_points` pour points VFR partagés
   - Bucket storage pour photos
   - ⚠️ Optionnel : uniquement si vous utilisez les points VFR communautaires

7. **`supabase-vfr-photos-setup.sql`**
   - Configuration du stockage de photos pour points VFR
   - ⚠️ Exécuter après `supabase-vfr-points-COMPLET.sql`

### ✅ Étape 5 : Cartes VAC (OPTIONNEL)

8. **`supabase-vac-charts-setup.sql`**
   - Table pour stocker les cartes VAC uploadées
   - ⚠️ Optionnel : si vous voulez stocker les VAC dans Supabase
   - ⚠️ Note : ALFlight utilise déjà IndexedDB pour les VAC localement

### ✅ Étape 6 : Corrections de politiques (SI NÉCESSAIRE)

9. **`supabase-fix-policies.sql`**
   - Correction des politiques RLS
   - ⚠️ Exécuter seulement en cas de problème de permissions

10. **`supabase-fix-storage-policies.sql`**
    - Correction des politiques de stockage
    - ⚠️ Exécuter seulement en cas de problème d'upload

## Configuration minimale recommandée

Pour démarrer rapidement avec les fonctionnalités essentielles :

```sql
-- 1. Base de données
supabase-setup-fixed.sql

-- 2. PDFs validés (NOUVEAU système)
supabase-validated-pdfs-setup.sql

-- 3. Numéros de vol lisibles (RECOMMANDÉ)
supabase-add-flight-numbers.sql
```

**Résultat** : Vous pourrez sauvegarder les PDFs validés avec des numéros de vol lisibles (VP-2024-0001, VP-2024-0002, etc.)

## Configuration complète

Pour toutes les fonctionnalités :

```sql
-- 1. Base
supabase-setup-fixed.sql

-- 2. PDFs validés
supabase-validated-pdfs-setup.sql

-- 3. Plans de vol complets
supabase-flight-plans-setup.sql

-- 4. Foreign key entre PDFs et plans
supabase-add-flight-plan-fk.sql

-- 5. Numéros de vol
supabase-add-flight-numbers.sql

-- 6. Points VFR communautaires
supabase-vfr-points-COMPLET.sql
supabase-vfr-photos-setup.sql

-- 7. Cartes VAC (optionnel)
supabase-vac-charts-setup.sql
```

## Comment exécuter les scripts

### Dans Supabase Dashboard

1. Ouvrir votre projet Supabase
2. Aller dans **SQL Editor** (panneau de gauche)
3. Cliquer sur **New Query**
4. Copier/coller le contenu du script SQL
5. Cliquer sur **Run**
6. Vérifier les messages de succès/erreur

### Vérifier que tout fonctionne

```sql
-- Vérifier les tables créées
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Vérifier les buckets storage
SELECT * FROM storage.buckets;

-- Tester la génération de numéro de vol
SELECT generate_flight_plan_number();
SELECT generate_validated_pdf_number();
```

## Structure finale

Après installation complète, vous aurez :

### Tables principales

1. **`validated_flight_pdfs`** ⭐ NOUVEAU
   - Stocke les métadonnées des PDFs validés
   - Colonnes : id (UUID), flight_number (lisible), pilote, date, route, etc.
   - Trigger : génère automatiquement flight_number (VP-2024-NNNN)

2. **`flight_plans`** (optionnel)
   - Stocke les plans de vol complets avec toutes les données
   - Colonnes : id (UUID), flight_number (lisible), waypoints, météo, carburant, etc.
   - Trigger : génère automatiquement flight_number (FP-2024-NNNN)

3. **`community_vfr_points`** (optionnel)
   - Points VFR partagés par les utilisateurs

### Storage buckets

1. **`flight-plan-pdfs`** ⭐ NOUVEAU
   - Stockage des PDFs validés
   - Organisation : `YYYY/MM/filename.pdf`

2. **`vfr-point-photos`** (optionnel)
   - Photos des points VFR

### Vues et fonctions

1. **`validated_pdfs_stats`** ⭐ NOUVEAU
   - Statistiques mensuelles par pilote

2. **`generate_flight_pdf_path()`** ⭐ NOUVEAU
   - Génère un chemin de stockage unique pour PDF

3. **`generate_flight_plan_number()`** ⭐ NOUVEAU
   - Génère un numéro de plan de vol (FP-2024-NNNN)

4. **`generate_validated_pdf_number()`** ⭐ NOUVEAU
   - Génère un numéro de PDF validé (VP-2024-NNNN)

## Exemples d'utilisation

### Sauvegarder un PDF validé

```javascript
import { validatedPdfService } from '@services/validatedPdfService';

const result = await validatedPdfService.uploadValidatedPdf(pdfBlob, {
  pilotName: 'Jean Dupont',
  flightDate: '2024-01-15',
  aircraftRegistration: 'F-HSTR',
  departureIcao: 'LFST',
  arrivalIcao: 'LFGA'
});

// result.data.flight_number sera automatiquement généré : VP-2024-0001
console.log('Numéro de vol:', result.data.flight_number);
```

### Rechercher un PDF par numéro

```javascript
const pdfs = await validatedPdfService.searchValidatedPdfs({
  flightNumber: 'VP-2024-0001'
});
```

## Dépannage

### Erreur : "relation flight_plans does not exist"

Solution : Ne pas exécuter `supabase-add-flight-plan-fk.sql` si vous n'avez pas créé `flight_plans`

### Erreur : "column flight_number does not exist"

Solution : Exécuter `supabase-add-flight-numbers.sql`

### Erreur : "bucket already exists"

Solution : Normal, le script utilise `ON CONFLICT DO NOTHING`. Continuer.

### Erreur de permissions RLS

Solution : Exécuter `supabase-fix-policies.sql` et `supabase-fix-storage-policies.sql`

## Sécurité

⚠️ **Mode développement actuel** : Politiques RLS en mode public (lecture/écriture ouverte)

🔒 **Pour la production** : Implémenter l'authentification et restreindre les politiques RLS

```sql
-- Exemple de politique sécurisée (à implémenter plus tard)
CREATE POLICY "Users see only their PDFs" ON validated_flight_pdfs
  FOR SELECT
  USING (auth.uid()::text = user_id);
```

## Support

- Documentation complète : `VALIDATED_PDFS_GUIDE.md`
- Service JavaScript : `src/services/validatedPdfService.js`
- Dashboard Supabase : Logs et monitoring en temps réel
