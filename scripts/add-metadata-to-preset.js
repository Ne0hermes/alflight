// Script pour ajouter les métadonnées d'unités au preset F-HSTR
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const presetPath = path.join(__dirname, '..', 'public', 'aircraft-presets', 'da40ng-f-hstr-example.json');

console.log('📝 Adding metadata to F-HSTR preset...');

try {
  // Lire le fichier JSON
  const rawData = fs.readFileSync(presetPath, 'utf8');
  const preset = JSON.parse(rawData);

  // Ajouter les métadonnées
  preset._metadata = {
    version: '1.0',
    units: {
      fuelConsumption: 'lph',
      fuelCapacity: 'ltr',
      cruiseSpeedKt: 'kt',
      weight: 'kg',
      emptyWeight: 'kg',
      maxTakeoffWeight: 'kg'
    },
    note: 'Storage units - all values stored in L/h, L, kt, kg',
    updatedAt: new Date().toISOString()
  };

  // Écrire le fichier avec les métadonnées
  fs.writeFileSync(presetPath, JSON.stringify(preset, null, 2), 'utf8');

  console.log('✅ Metadata added successfully!');
  console.log('   Metadata:', JSON.stringify(preset._metadata, null, 2));

} catch (error) {
  console.error('❌ Error adding metadata:', error.message);
  process.exit(1);
}
