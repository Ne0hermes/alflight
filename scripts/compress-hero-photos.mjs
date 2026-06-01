// ============================================================================
//  Script de compression des photos hero ALFlight
//  ----------------------------------------------------------------------------
//  Compresse tous les fichiers .jpg/.png > 500 Ko dans public/assets/photos/
//  en JPG qualité 80, max 1600x1000 px (en conservant le ratio).
//
//  Sauvegarde les originaux dans public/assets/photos/_originals/ avant
//  écrasement, pour pouvoir les restaurer si besoin.
//
//  Usage : npm run compress-photos
//          ou : node scripts/compress-hero-photos.mjs
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = path.resolve(__dirname, '..', 'public', 'assets', 'photos');
const BACKUP_DIR = path.join(PHOTOS_DIR, '_originals');

// Seuil de déclenchement : tout fichier > 500 Ko est compressé
const THRESHOLD_BYTES = 500 * 1024;

// Paramètres de sortie
const TARGET_QUALITY = 80; // qualité MozJPEG (78-82 = idéal qualité/poids)
const TARGET_MAX_WIDTH = 1600;
const TARGET_MAX_HEIGHT = 1000;

const formatSize = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${bytes} B`;
};

async function main() {
  console.log('🎨 ALFlight — Compression des photos hero');
  console.log('───────────────────────────────────────');
  console.log(`📁 Dossier : ${PHOTOS_DIR}`);
  console.log(`📦 Seuil   : ${formatSize(THRESHOLD_BYTES)}`);
  console.log(`🎯 Cible   : JPG qualité ${TARGET_QUALITY}, max ${TARGET_MAX_WIDTH}×${TARGET_MAX_HEIGHT} px`);
  console.log('');

  // Créer le dossier de backup s'il n'existe pas
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Dossier backup créé : ${BACKUP_DIR}\n`);
  }

  const entries = fs.readdirSync(PHOTOS_DIR, { withFileTypes: true });
  const photos = entries
    .filter((e) => e.isFile())
    .filter((e) => /\.(jpe?g|png)$/i.test(e.name))
    .map((e) => ({
      name: e.name,
      path: path.join(PHOTOS_DIR, e.name),
      size: fs.statSync(path.join(PHOTOS_DIR, e.name)).size,
    }))
    .sort((a, b) => b.size - a.size); // les plus gros en premier

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const photo of photos) {
    totalBefore += photo.size;

    if (photo.size <= THRESHOLD_BYTES) {
      console.log(`⏭️  ${photo.name.padEnd(28)} ${formatSize(photo.size).padStart(10)}   (sous le seuil, ignoré)`);
      totalAfter += photo.size;
      skipped++;
      continue;
    }

    try {
      const base = photo.name.replace(/\.(jpe?g|png)$/i, '');
      // Sortie TOUJOURS en .jpg (les PNG sont convertis)
      const outputName = `${base}.jpg`;
      const outputPath = path.join(PHOTOS_DIR, outputName);
      const backupPath = path.join(BACKUP_DIR, photo.name);

      // 1. Backup de l'original (skip si déjà sauvegardé)
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(photo.path, backupPath);
      }

      // 2. Lire l'image et compresser
      const buffer = await sharp(photo.path)
        .resize({
          width: TARGET_MAX_WIDTH,
          height: TARGET_MAX_HEIGHT,
          fit: 'inside', // ne dépasse pas, conserve le ratio
          withoutEnlargement: true, // ne grossit pas si plus petit
        })
        .jpeg({
          quality: TARGET_QUALITY,
          mozjpeg: true, // encodeur optimisé (meilleure compression que jpeg standard)
          chromaSubsampling: '4:2:0', // standard web
        })
        .toBuffer();

      // 3. Écrire le nouveau fichier .jpg
      fs.writeFileSync(outputPath, buffer);

      // 4. Si l'original était un .png, supprimer le .png
      if (photo.path.toLowerCase().endsWith('.png') && outputPath !== photo.path) {
        fs.unlinkSync(photo.path);
      }

      const newSize = buffer.length;
      totalAfter += newSize;
      const reduction = ((photo.size - newSize) / photo.size) * 100;

      console.log(
        `✅ ${photo.name.padEnd(28)} ${formatSize(photo.size).padStart(10)} → ${formatSize(newSize).padStart(8)}  ${reduction.toFixed(0).padStart(3)}%`
      );
      processed++;
    } catch (err) {
      console.error(`❌ ${photo.name.padEnd(28)} ERREUR : ${err.message}`);
      totalAfter += photo.size;
      errors++;
    }
  }

  console.log('');
  console.log('───────────────────────────────────────');
  console.log(`📊 Compressées : ${processed}`);
  console.log(`📊 Ignorées    : ${skipped} (sous le seuil)`);
  if (errors > 0) console.log(`❌ Erreurs    : ${errors}`);
  console.log(`📦 Avant       : ${formatSize(totalBefore)}`);
  console.log(`📦 Après       : ${formatSize(totalAfter)}`);
  if (totalBefore > 0) {
    const totalReduction = ((totalBefore - totalAfter) / totalBefore) * 100;
    console.log(`💾 Gain        : ${formatSize(totalBefore - totalAfter)} (-${totalReduction.toFixed(0)}%)`);
  }
  console.log('');
  console.log(`💡 Originaux sauvegardés dans : ${BACKUP_DIR}`);
}

main().catch((err) => {
  console.error('💥 Erreur fatale :', err);
  process.exit(1);
});
