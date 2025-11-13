/**
 * Script de nettoyage des fichiers MANEX orphelins
 *
 * Supprime les fichiers MANEX qui ne sont plus référencés par aucun preset actif
 *
 * Usage:
 *   node scripts/cleanup-orphan-manex.js              (dry-run)
 *   node scripts/cleanup-orphan-manex.js --confirm    (suppression effective)
 */

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = 'https://bgmscwckawgybymbimga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanupOrphanManex() {
  try {
    console.log('🔍 Recherche des fichiers MANEX orphelins...\n');

    // 1. Récupérer tous les fichiers MANEX
    const { data: allManexFiles, error: manexError } = await supabase
      .from('manex_files')
      .select('id, filename, file_path, file_size, created_at');

    if (manexError) throw manexError;

    console.log(`📊 Total fichiers MANEX: ${allManexFiles.length}`);

    // 2. Récupérer tous les IDs de MANEX référencés par les presets actifs
    const { data: activePresets, error: presetsError } = await supabase
      .from('community_presets')
      .select('manex_file_id, registration')
      .eq('status', 'active')
      .not('manex_file_id', 'is', null);

    if (presetsError) throw presetsError;

    console.log(`📊 Total presets actifs: ${activePresets.length}`);

    // 3. Créer un Set des IDs référencés
    const referencedIds = new Set(activePresets.map(p => p.manex_file_id));
    console.log(`📊 Fichiers MANEX référencés: ${referencedIds.size}\n`);

    // 4. Identifier les orphelins
    const orphanFiles = allManexFiles.filter(file => !referencedIds.has(file.id));

    console.log(`🗑️  Fichiers MANEX orphelins: ${orphanFiles.length}\n`);

    if (orphanFiles.length === 0) {
      console.log('✅ Aucun fichier orphelin trouvé !');
      return;
    }

    // 5. Calculer l'espace total à libérer
    const totalSize = orphanFiles.reduce((sum, file) => sum + (file.file_size || 0), 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    console.log('📋 Fichiers orphelins à supprimer:\n');
    orphanFiles.forEach((file, index) => {
      const sizeMB = ((file.file_size || 0) / (1024 * 1024)).toFixed(2);
      const date = new Date(file.created_at).toLocaleDateString();
      console.log(`   ${index + 1}. ${file.filename} (${sizeMB} MB) - ${date}`);
    });

    console.log(`\n💾 Espace total à libérer: ${totalSizeMB} MB`);

    // 6. Mode dry-run ou suppression effective
    const shouldDelete = process.argv.includes('--confirm');

    if (!shouldDelete) {
      console.log('\n⚠️  MODE DRY-RUN - Aucune suppression effectuée');
      console.log('ℹ️  Exécutez avec --confirm pour supprimer effectivement\n');

      console.log('📋 Commande pour suppression effective:');
      console.log('   node scripts/cleanup-orphan-manex.js --confirm\n');
      return;
    }

    // 7. Suppression effective
    console.log('\n🗑️  SUPPRESSION EN COURS...\n');

    let deletedCount = 0;
    let deletedSize = 0;
    let errors = 0;

    for (const file of orphanFiles) {
      try {
        // Supprimer du Storage
        const { error: storageError } = await supabase.storage
          .from('manex-files')
          .remove([file.file_path]);

        if (storageError) {
          console.error(`   ❌ Erreur Storage ${file.filename}:`, storageError.message);
          errors++;
          continue;
        }

        // Supprimer de la table manex_files
        const { error: dbError } = await supabase
          .from('manex_files')
          .delete()
          .eq('id', file.id);

        if (dbError) {
          console.error(`   ❌ Erreur DB ${file.filename}:`, dbError.message);
          errors++;
          continue;
        }

        deletedCount++;
        deletedSize += file.file_size || 0;

        const sizeMB = ((file.file_size || 0) / (1024 * 1024)).toFixed(2);
        console.log(`   ✅ Supprimé: ${file.filename} (${sizeMB} MB)`);

      } catch (err) {
        console.error(`   ❌ Erreur ${file.filename}:`, err.message);
        errors++;
      }
    }

    const freedSpaceMB = (deletedSize / (1024 * 1024)).toFixed(2);

    console.log(`\n✅ Nettoyage terminé !`);
    console.log(`   Fichiers supprimés: ${deletedCount}/${orphanFiles.length}`);
    console.log(`   Espace libéré: ${freedSpaceMB} MB`);
    if (errors > 0) {
      console.log(`   ⚠️  Erreurs: ${errors}`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécution
cleanupOrphanManex();
