/**
 * Log toutes les modifications de ce matin dans Google Sheets
 */

const updates = [
  {
    action: 'MIGRATION_SUPABASE',
    component: 'Database',
    summary: 'Configuration Supabase + Migration F-HSTR',
    details: 'F-HSTR inséré dans Supabase avec données complètes (manufacturer: Diamond Aircraft, type: Airplane, category: SEP, fuel: JET-A1 148L, photo, surfaces ASPH/CONC)',
    files: '.env, src/services/communityService.js',
    status: 'completed'
  },
  {
    action: 'FIX_IMPORT',
    component: 'Step0CommunityCheck.jsx',
    summary: 'Correction import données depuis Supabase',
    details: 'Fix ordre spread operators: ...fullAircraftData en premier pour ne pas écraser les données. Changement de presets_with_stats vers community_presets.',
    files: 'src/features/aircraft/components/wizard-steps/Step0CommunityCheck.jsx (lignes 81-113, 142-164, 262-290)',
    status: 'completed'
  },
  {
    action: 'FIX_SERVICE',
    component: 'communityService.js',
    summary: 'Correction getPresetById et getAllPresets',
    details: 'getPresetById: retourne aircraft_data intact sans écraser. getAllPresets: query directe sur community_presets avec logs détaillés.',
    files: 'src/services/communityService.js (lignes 21-94, 104-150)',
    status: 'completed'
  },
  {
    action: 'ENRICH_DATA',
    component: 'Scripts',
    summary: 'Enrichissement données F-HSTR',
    details: 'Ajout manufacturer, aircraftType, category, performances complètes. Fichier enrichi: aircraft_F-HSTR_ENRICHED.json (306KB)',
    files: 'scripts/enrich-fhstr.cjs, scripts/update-supabase-fhstr.js',
    status: 'completed'
  },
  {
    action: 'CREATE_ADMIN',
    component: 'AdminPanel',
    summary: 'Création panel admin pour localStorage',
    details: 'Interface admin pour nettoyer localStorage, restaurer backup, vérifier Supabase. Ajouté comme premier onglet.',
    files: 'src/features/admin/AdminPanel.jsx, src/App.jsx (lignes 29, 32)',
    status: 'completed'
  },
  {
    action: 'UPDATE_SESSION',
    component: 'START_SESSION.bat',
    summary: 'Activation tracking automatique par défaut',
    details: 'Changement de npm run dev vers npm run dev:tracked. AutoTracker surveille maintenant tous les fichiers .js/.jsx/.css.',
    files: 'START_SESSION.bat (ligne 36)',
    status: 'completed'
  },
  {
    action: 'CREATE_SCRIPTS',
    component: 'Scripts',
    summary: 'Création scripts migration et test',
    details: 'Scripts: migrate-to-supabase.js, clear-local-aircraft.js, check-fhstr-data.cjs, test-supabase-query.js, test-google-sheets-log.js',
    files: 'scripts/ (5 nouveaux fichiers)',
    status: 'completed'
  },
  {
    action: 'CREATE_DOCS',
    component: 'Documentation',
    summary: 'Documentation migration Supabase',
    details: 'MIGRATION_SUPABASE.md (guide complet), README_AIRCRAFT_CLEAN.md (quick start), IMPORT_FHSTR_GUIDE.md (procédure import)',
    files: '3 fichiers .md créés',
    status: 'completed'
  }
];

async function logUpdates() {
  console.log('📊 Envoi des mises à jour de ce matin vers Google Sheets...\n');

  for (const update of updates) {
    try {
      const response = await fetch('http://localhost:3001/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...update,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${update.action} → ${result.range}`);
      } else {
        console.error(`❌ ${update.action}: Erreur ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${update.action}: ${error.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n✅ Toutes les mises à jour envoyées!');
  console.log('🔗 https://docs.google.com/spreadsheets/d/1Y26_Zf7-jHPgpjWasubXpzQE-k0eMl0pHIMpg8OHw_k');
}

logUpdates();
