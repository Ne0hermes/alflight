# Guide d'utilisation : PDFs de plans de vol validés

## Vue d'ensemble

Ce système permet de sauvegarder et archiver les PDFs de plans de vol validés dans Supabase, avec toutes les métadonnées associées (pilote, date, aéronefs, route, etc.).

## Architecture

### 1. Base de données

**Table : `validated_flight_pdfs`**
- Stocke les métadonnées de chaque PDF validé
- Référence optionnelle au plan de vol complet (`flight_plans`)
- Informations du vol : pilote, date, callsign, immatriculation, route
- Tags pour recherche et catégorisation

**Storage bucket : `flight-plan-pdfs`**
- Stockage des fichiers PDF
- Organisation par année/mois : `YYYY/MM/filename.pdf`
- Format du nom : `REGISTRATION-DEPARTURE-ARRIVAL-YYYYMMDD-TIMESTAMP.pdf`

**Vue : `validated_pdfs_stats`**
- Statistiques mensuelles par pilote
- Nombre de vols, aérodromes, taille stockage

### 2. Service JavaScript

**Fichier : `src/services/validatedPdfService.js`**

Fonctions principales :
- `uploadValidatedPdf(pdfBlob, metadata)` : Upload PDF + métadonnées
- `getAllValidatedPdfs(limit)` : Liste tous les PDFs
- `searchValidatedPdfs(filters)` : Recherche avec filtres
- `getValidatedPdfById(id)` : Récupère un PDF par ID
- `deleteValidatedPdf(id)` : Supprime PDF + métadonnées
- `getPdfSignedUrl(path, expiresIn)` : URL sécurisée temporaire

## Installation

### 1. Créer la table et le bucket dans Supabase

Exécuter le script SQL dans l'éditeur SQL de Supabase :

```bash
# Fichier à exécuter dans Supabase SQL Editor
supabase-validated-pdfs-setup.sql
```

Ce script va :
- ✅ Créer le bucket `flight-plan-pdfs`
- ✅ Créer la table `validated_flight_pdfs`
- ✅ Créer les index pour recherche rapide
- ✅ Configurer les politiques RLS
- ✅ Créer la vue de statistiques
- ✅ Créer la fonction helper `generate_flight_pdf_path()`

### 2. Vérifier les permissions

Les politiques RLS sont configurées en mode public pour l'instant :
- ✅ Lecture publique
- ✅ Insertion publique
- ✅ Mise à jour publique

⚠️ **Important** : À restreindre avec authentification utilisateur plus tard.

## Utilisation

### Exemple 1 : Sauvegarder un PDF après validation

```javascript
import { validatedPdfService } from '@services/validatedPdfService';

// 1. Générer le PDF (avec html2pdf ou autre)
const pdfBlob = await generateFlightPlanPdf();

// 2. Préparer les métadonnées
const metadata = {
  pilotName: 'Jean Dupont',
  flightDate: '2024-01-15',
  callsign: 'F-HSTR',
  aircraftRegistration: 'F-HSTR',
  aircraftType: 'DA40',
  departureIcao: 'LFST',
  departureName: 'Strasbourg Entzheim',
  arrivalIcao: 'LFGA',
  arrivalName: 'Colmar Houssen',
  flightPlanId: 'uuid-du-plan-de-vol', // Optionnel
  tags: ['navigation', 'cross-country'],
  notes: 'Vol de navigation avec 2 déroutements'
};

// 3. Upload
const result = await validatedPdfService.uploadValidatedPdf(pdfBlob, metadata);

if (result.success) {
  console.log('✅ PDF sauvegardé:', result.data.id);
  console.log('📄 URL PDF:', result.data.pdfUrl);
} else {
  console.error('❌ Erreur:', result.error);
}
```

### Exemple 2 : Rechercher des PDFs

```javascript
// Recherche par pilote
const pdfsByPilot = await validatedPdfService.getPdfsByPilot('Jean Dupont');

// Recherche par date
const pdfsByDate = await validatedPdfService.getPdfsByDate('2024-01-15');

// Recherche avancée
const results = await validatedPdfService.searchValidatedPdfs({
  pilotName: 'Jean',
  registration: 'F-HSTR',
  departureIcao: 'LFST',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
  tags: ['navigation']
});

console.log(`${results.length} PDFs trouvés`);
```

### Exemple 3 : Récupérer et afficher un PDF

```javascript
// Récupérer les métadonnées
const pdfData = await validatedPdfService.getValidatedPdfById('uuid-du-pdf');

// Option A : URL publique (si bucket public)
const publicUrl = validatedPdfService.getPdfPublicUrl(pdfData.pdf_storage_path);
window.open(publicUrl, '_blank');

// Option B : URL signée temporaire (plus sécurisée)
const signedUrl = await validatedPdfService.getPdfSignedUrl(
  pdfData.pdf_storage_path,
  3600 // Expire dans 1h
);
window.open(signedUrl, '_blank');
```

### Exemple 4 : Supprimer un PDF

```javascript
const result = await validatedPdfService.deleteValidatedPdf('uuid-du-pdf');

if (result.success) {
  console.log('✅ PDF supprimé');
} else {
  console.error('❌ Erreur:', result.error);
}
```

### Exemple 5 : Mettre à jour les notes ou tags

```javascript
// Mettre à jour les notes
await validatedPdfService.updatePdfNotes(
  'uuid-du-pdf',
  'Vol effectué avec vent fort du 270° à 25kt'
);

// Mettre à jour les tags
await validatedPdfService.updatePdfTags(
  'uuid-du-pdf',
  ['navigation', 'cross-country', 'météo-difficile']
);
```

### Exemple 6 : Afficher les statistiques

```javascript
const stats = await validatedPdfService.getStatistics();

stats.forEach(stat => {
  console.log(`${stat.pilot_name} - ${stat.month}:`);
  console.log(`  Vols: ${stat.total_flights}`);
  console.log(`  Avions: ${stat.aircraft_count}`);
  console.log(`  Stockage: ${(stat.total_storage_bytes / 1024 / 1024).toFixed(2)} MB`);
});
```

## Structure des métadonnées

```javascript
{
  id: 'uuid',
  created_at: '2024-01-15T10:30:00Z',
  flight_plan_id: 'uuid', // Optionnel
  pdf_filename: 'F-HSTR-LFST-LFGA-20240115-123456789.pdf',
  pdf_storage_path: '2024/01/F-HSTR-LFST-LFGA-20240115-123456789.pdf',
  pdf_size_bytes: 1234567,
  pilot_name: 'Jean Dupont',
  flight_date: '2024-01-15',
  callsign: 'F-HSTR',
  aircraft_registration: 'F-HSTR',
  aircraft_type: 'DA40',
  departure_icao: 'LFST',
  departure_name: 'Strasbourg Entzheim',
  arrival_icao: 'LFGA',
  arrival_name: 'Colmar Houssen',
  validation_timestamp: '2024-01-15T10:30:00Z',
  version: '1.0',
  notes: 'Notes du vol',
  tags: ['navigation', 'cross-country']
}
```

## Intégration dans Step7Summary

Pour intégrer la sauvegarde automatique du PDF après validation :

```javascript
import { validatedPdfService } from '@services/validatedPdfService';
import html2pdf from 'html2pdf.js';

const handleSaveValidatedPdf = async () => {
  try {
    // 1. Générer le PDF
    const element = document.getElementById('flight-plan-summary');
    const pdfBlob = await html2pdf()
      .from(element)
      .set({
        margin: 10,
        filename: 'plan-de-vol.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { format: 'a4', orientation: 'portrait' }
      })
      .outputPdf('blob');

    // 2. Extraire les métadonnées du flight plan
    const metadata = {
      pilotName: flightPlan.pilotName || 'Pilote inconnu',
      flightDate: flightPlan.generalInfo.date || new Date().toISOString().split('T')[0],
      callsign: flightPlan.generalInfo.callsign,
      aircraftRegistration: flightPlan.aircraft.registration,
      aircraftType: flightPlan.aircraft.type,
      departureIcao: flightPlan.route.departure.icao,
      departureName: flightPlan.route.departure.name,
      arrivalIcao: flightPlan.route.arrival.icao,
      arrivalName: flightPlan.route.arrival.name,
      notes: flightPlan.notes
    };

    // 3. Upload vers Supabase
    const result = await validatedPdfService.uploadValidatedPdf(pdfBlob, metadata);

    if (result.success) {
      alert('✅ PDF sauvegardé avec succès !');
      console.log('PDF ID:', result.data.id);
    } else {
      alert('❌ Erreur lors de la sauvegarde du PDF');
      console.error(result.error);
    }

  } catch (error) {
    console.error('❌ Erreur génération/sauvegarde PDF:', error);
    alert('❌ Erreur lors de la génération du PDF');
  }
};
```

## Recherche et filtrage

### Filtres disponibles

- `pilotName` : Recherche partielle (ILIKE)
- `callsign` : Recherche partielle (ILIKE)
- `registration` : Égalité exacte
- `departureIcao` : Égalité exacte
- `arrivalIcao` : Égalité exacte
- `fromDate` : Date minimale (>=)
- `toDate` : Date maximale (<=)
- `tags` : Contient tous les tags spécifiés

### Index optimisés

La table possède des index sur :
- `pilot_name`
- `flight_date`
- `callsign`
- `aircraft_registration`
- `departure_icao`
- `arrival_icao`
- `created_at`
- `validation_timestamp`
- `tags` (GIN index pour recherche dans array)

## Sécurité

### Actuel (mode développement)

- ✅ Lecture/écriture publique
- ⚠️ Pas d'authentification requise

### À implémenter (production)

```sql
-- Exemple de politique RLS avec authentification
CREATE POLICY "Users can read their own PDFs" ON validated_flight_pdfs
  FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own PDFs" ON validated_flight_pdfs
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);
```

## Maintenance

### Nettoyage des vieux PDFs

```javascript
// Supprimer les PDFs de plus de 2 ans
const oldPdfs = await validatedPdfService.searchValidatedPdfs({
  toDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
});

for (const pdf of oldPdfs) {
  await validatedPdfService.deleteValidatedPdf(pdf.id);
}
```

### Vérifier l'espace de stockage

```javascript
const stats = await validatedPdfService.getStatistics();
const totalStorage = stats.reduce((sum, s) => sum + s.total_storage_bytes, 0);
console.log(`Stockage total: ${(totalStorage / 1024 / 1024 / 1024).toFixed(2)} GB`);
```

## Support

Pour toute question ou problème :
1. Vérifier les logs dans la console JavaScript
2. Vérifier les logs Supabase (onglet Logs dans le dashboard)
3. Vérifier les politiques RLS dans Supabase

## Changelog

- **v1.0** (2024-01-15) : Version initiale
  - Table `validated_flight_pdfs`
  - Bucket `flight-plan-pdfs`
  - Service JavaScript complet
  - Vue de statistiques
