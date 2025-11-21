const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-apple-180.png', size: 180 },
  { name: 'icon-apple-167.png', size: 167 },
  { name: 'icon-apple-152.png', size: 152 },
  { name: 'icon-apple-120.png', size: 120 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 }
];

async function generateIcons() {
  console.log('🎨 Génération des icônes ALFlight...\n');

  // Charger l'image source
  const sourcePath = path.join(__dirname, 'iconeAlflight.jpg');

  if (!fs.existsSync(sourcePath)) {
    console.error('❌ Fichier source iconeAlflight.jpg introuvable!');
    process.exit(1);
  }

  const sourceImage = await loadImage(sourcePath);
  console.log(`📦 Image source chargée: ${sourceImage.width}x${sourceImage.height}`);

  // Créer le dossier public s'il n'existe pas
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Générer chaque taille
  for (const { name, size } of sizes) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Dessiner l'image redimensionnée
    ctx.drawImage(sourceImage, 0, 0, size, size);

    // Sauvegarder
    const outputPath = path.join(publicDir, name);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ ${name.padEnd(25)} (${size}x${size})`);
  }

  console.log('\n🎉 Toutes les icônes ont été générées avec succès!');
  console.log('📁 Emplacement: /public/');
}

generateIcons().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
