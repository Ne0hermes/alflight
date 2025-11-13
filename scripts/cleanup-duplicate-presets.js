/**
 * Script de nettoyage des presets en double dans Supabase
 *
 * Ce script supprime les presets dupliqués pour une même registration,
 * en gardant seulement la version la plus récente.
 *
 * Usage: node scripts/cleanup-duplicate-presets.js
 */

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = 'https://bgmscwckawgybymbimga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanupDuplicatePresets() {
  try {
    console.log('🔍 Recherche des presets dupliqués...\n');

    // Récupérer tous les presets actifs
    const { data: allPresets, error } = await supabase
      .from('community_presets')
      .select('id, registration, created_at, updated_at, version, has_manex, manex_file_id')
      .eq('status', 'active')
      .order('registration', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    console.log(`📊 Total presets trouvés: ${allPresets.length}\n`);

    // Grouper par registration
    const grouped = {};
    allPresets.forEach(preset => {
      if (!grouped[preset.registration]) {
        grouped[preset.registration] = [];
      }
      grouped[preset.registration].push(preset);
    });

    // Identifier les doublons
    let totalDuplicates = 0;
    const duplicateGroups = {};

    Object.entries(grouped).forEach(([registration, presets]) => {
      if (presets.length > 1) {
        duplicateGroups[registration] = presets;
        totalDuplicates += presets.length - 1;
        console.log(`⚠️  ${registration}: ${presets.length} versions`);
        presets.forEach((preset, index) => {
          console.log(`   ${index === 0 ? '✓' : '✗'} ID: ${preset.id} | Créé: ${new Date(preset.created_at).toLocaleString()} | MANEX: ${preset.has_manex ? 'Oui' : 'Non'}`);
        });
        console.log();
      }
    });

    if (totalDuplicates === 0) {
      console.log('✅ Aucun doublon trouvé !');
      return;
    }

    console.log(`\n🗑️  Total doublons à supprimer: ${totalDuplicates}`);
    console.log('\n❓ Voulez-vous procéder à la suppression ? (y/n)\n');

    // Pour exécution automatique sans confirmation (mode script)
    const shouldDelete = process.argv.includes('--auto-confirm');

    if (!shouldDelete) {
      console.log('ℹ️  Exécutez avec --auto-confirm pour supprimer automatiquement');
      console.log('ℹ️  Mode dry-run - Aucune suppression effectuée\n');

      // Afficher le résumé
      console.log('📋 Résumé des suppressions qui seraient effectuées:\n');
      let manexFilesToDelete = [];

      Object.entries(duplicateGroups).forEach(([registration, presets]) => {
        const toKeep = presets[0];
        const toDelete = presets.slice(1);

        console.log(`   ${registration}:`);
        console.log(`      Garder: ${toKeep.id}`);
        console.log(`      Supprimer: ${toDelete.map(p => p.id).join(', ')}`);

        // Collecter les MANEX à supprimer
        toDelete.forEach(preset => {
          if (preset.manex_file_id) {
            manexFilesToDelete.push(preset.manex_file_id);
          }
        });
      });

      console.log(`\n🗂️  Fichiers MANEX à supprimer: ${manexFilesToDelete.length}`);
      return;
    }

    // Suppression effective
    console.log('\n🗑️  Suppression en cours...\n');

    let deletedCount = 0;
    let deletedManexCount = 0;

    for (const [registration, presets] of Object.entries(duplicateGroups)) {
      const toKeep = presets[0]; // Le plus récent (déjà trié)
      const toDelete = presets.slice(1);

      console.log(`\n📝 ${registration}:`);
      console.log(`   ✓ Garder: ${toKeep.id} (${new Date(toKeep.created_at).toLocaleString()})`);

      for (const preset of toDelete) {
        // Supprimer les fichiers MANEX associés
        if (preset.manex_file_id) {
          console.log(`   🗑️  Suppression MANEX: ${preset.manex_file_id}`);

          // Récupérer le chemin du fichier
          const { data: manexFile } = await supabase
            .from('manex_files')
            .select('file_path')
            .eq('id', preset.manex_file_id)
            .single();

          if (manexFile?.file_path) {
            // Supprimer du Storage
            await supabase.storage
              .from('manex-files')
              .remove([manexFile.file_path]);
            deletedManexCount++;
          }

          // Supprimer l'entrée manex_files
          await supabase
            .from('manex_files')
            .delete()
            .eq('id', preset.manex_file_id);
        }

        // Supprimer le preset
        console.log(`   ✗ Supprimer: ${preset.id} (${new Date(preset.created_at).toLocaleString()})`);

        const { error: deleteError } = await supabase
          .from('community_presets')
          .delete()
          .eq('id', preset.id);

        if (deleteError) {
          console.error(`   ❌ Erreur suppression ${preset.id}:`, deleteError.message);
        } else {
          deletedCount++;
          console.log(`   ✅ Supprimé`);
        }
      }
    }

    console.log(`\n✅ Nettoyage terminé !`);
    console.log(`   Presets supprimés: ${deletedCount}`);
    console.log(`   Fichiers MANEX supprimés: ${deletedManexCount}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécution
cleanupDuplicatePresets();
