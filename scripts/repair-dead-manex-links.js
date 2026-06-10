/**
 * Réparation des LIENS MANEX MORTS : presets actifs dont manex_file_id pointe
 * vers une ligne manex_files dont le fichier n'existe PLUS dans le bucket
 * "manex-files" (ex. anciens chemins "<modèle>/<timestamp>_<nom>.pdf" purgés
 * du Storage). Symptôme côté app : « MANEX introuvable » au téléchargement.
 *
 * Action : has_manex=false + manex_file_id=null sur les presets concernés,
 * puis suppression des lignes manex_files mortes ET non référencées.
 * Le pilote ré-importe ensuite le PDF via le wizard → le lien est recréé
 * proprement (chemin stable "<immat>/<immat> - manex.pdf").
 *
 * Usage:
 *   node scripts/repair-dead-manex-links.js                       (dry-run global)
 *   node scripts/repair-dead-manex-links.js --confirm             (réparation globale)
 *   node scripts/repair-dead-manex-links.js --confirm --only F-GUVV
 *       (réparation CIBLÉE : uniquement le preset de cette immatriculation,
 *        AUCUNE suppression de lignes manex_files)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bgmscwckawgybymbimga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbXNjd2NrYXdneWJ5bWJpbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTk0MDAsImV4cCI6MjA3NTMzNTQwMH0.2J6nlClW_4GCdKaHrtjbf4AgdbDMpd_6auSzcMQnCMc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const CONFIRM = process.argv.includes('--confirm');
const onlyIdx = process.argv.indexOf('--only');
const ONLY_REG = onlyIdx >= 0 ? (process.argv[onlyIdx + 1] || '').toUpperCase() : null;

// Liste récursive (1 niveau : dossiers à la racine) → Set des chemins existants.
async function listAllBucketPaths() {
  const paths = new Set();
  const { data: root, error } = await supabase.storage.from('manex-files').list('', { limit: 1000 });
  if (error) throw new Error(`list racine: ${error.message}`);
  for (const entry of root || []) {
    if (entry.id) { paths.add(entry.name); continue; } // fichier à la racine
    const folder = entry.name;
    const { data: files, error: fErr } = await supabase.storage.from('manex-files').list(folder, { limit: 1000 });
    if (fErr) { console.warn(`⚠️ list("${folder}") échec: ${fErr.message}`); continue; }
    for (const f of files || []) {
      if (f.id) paths.add(`${folder}/${f.name}`);
    }
  }
  return paths;
}

async function main() {
  console.log(`🔍 Analyse des liens MANEX (mode ${CONFIRM ? 'RÉPARATION' : 'DRY-RUN'})...\n`);

  // 1. Contenu réel du bucket
  const existingPaths = await listAllBucketPaths();
  console.log(`📦 Bucket "manex-files" : ${existingPaths.size} fichier(s)`);
  existingPaths.forEach(p => console.log(`   • ${p}`));

  // 2. Lignes manex_files
  const { data: manexRows, error: mErr } = await supabase
    .from('manex_files')
    .select('id, filename, file_path, created_at');
  if (mErr) throw mErr;
  const rowById = new Map(manexRows.map(r => [r.id, r]));

  // 3. Presets actifs avec lien MANEX
  const { data: presets, error: pErr } = await supabase
    .from('community_presets')
    .select('id, registration, model, has_manex, manex_file_id')
    .eq('status', 'active')
    .not('manex_file_id', 'is', null);
  if (pErr) throw pErr;

  console.log(`\n📊 ${presets.length} preset(s) actif(s) avec manex_file_id, ${manexRows.length} ligne(s) manex_files\n`);

  // 4. Détection des liens morts
  const deadLinks = [];
  for (const p of presets) {
    if (ONLY_REG && (p.registration || '').toUpperCase() !== ONLY_REG) continue; // ciblage --only
    const row = rowById.get(p.manex_file_id);
    if (!row) {
      deadLinks.push({ preset: p, reason: `ligne manex_files ${p.manex_file_id} inexistante` });
    } else if (!existingPaths.has(row.file_path)) {
      deadLinks.push({ preset: p, row, reason: `fichier absent du bucket: "${row.file_path}"` });
    }
  }
  if (ONLY_REG) console.log(`🎯 Ciblage --only ${ONLY_REG} : seuls les presets de cette immatriculation sont traités (aucune suppression manex_files).`);

  if (deadLinks.length === 0) {
    console.log('✅ Aucun lien MANEX mort — rien à réparer.');
    return;
  }

  console.log(`💀 ${deadLinks.length} lien(s) mort(s) détecté(s) :`);
  deadLinks.forEach(({ preset, reason }) =>
    console.log(`   • ${preset.registration} (${preset.model}) [preset ${preset.id}] → ${reason}`));

  // 5. Lignes manex_files mortes (fichier absent), qui seront orphelines après
  //    réparation. En mode --only : AUCUNE suppression (réparation minimale).
  const repairedPresetIds = new Set(deadLinks.map(d => d.preset.id));
  const stillReferenced = new Set(
    presets.filter(p => !repairedPresetIds.has(p.id)).map(p => p.manex_file_id)
  );
  const deadRows = ONLY_REG ? [] : manexRows.filter(r => !existingPaths.has(r.file_path) && !stillReferenced.has(r.id));
  console.log(`\n🗑️ ${deadRows.length} ligne(s) manex_files morte(s) (fichier absent, non référencées après réparation) :`);
  deadRows.forEach(r => console.log(`   • ${r.filename} → "${r.file_path}" (${r.id})`));

  if (!CONFIRM) {
    console.log('\n⚠️ DRY-RUN — aucune modification. Relancez avec --confirm pour réparer.');
    return;
  }

  // 6. Réparation des presets
  console.log('\n🔧 Réparation des presets...');
  for (const { preset } of deadLinks) {
    const { data, error } = await supabase
      .from('community_presets')
      .update({ has_manex: false, manex_file_id: null })
      .eq('id', preset.id)
      .select('id');
    if (error) {
      console.error(`   ❌ ${preset.registration}: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.error(`   ❌ ${preset.registration}: 0 ligne affectée (RLS ? exécutez supabase-prototype-open-write.sql)`);
    } else {
      console.log(`   ✅ ${preset.registration}: lien retiré (has_manex=false, manex_file_id=null)`);
    }
  }

  // 7. Suppression des lignes manex_files mortes
  console.log('\n🔧 Suppression des lignes manex_files mortes...');
  for (const r of deadRows) {
    const { data, error } = await supabase
      .from('manex_files')
      .delete()
      .eq('id', r.id)
      .select('id');
    if (error) {
      console.error(`   ❌ ${r.filename}: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.error(`   ❌ ${r.filename}: 0 ligne supprimée (RLS ?)`);
    } else {
      console.log(`   ✅ ${r.filename} supprimée`);
    }
  }

  console.log('\n✅ Réparation terminée. Ré-importez les MANEX manquants via le wizard (Étape 1).');
}

main().then(() => process.exit(0)).catch(e => { console.error('❌', e); process.exit(1); });
