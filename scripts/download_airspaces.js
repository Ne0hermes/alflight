/**
 * Script pour télécharger les espaces aériens français au format OpenAir
 * Sources publiques disponibles
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URLs des sources publiques d'espaces aériens français
const AIRSPACE_SOURCES = [
  {
    name: 'France Airspaces OpenAir',
    url: 'https://raw.githubusercontent.com/openflightmaps/airspace/master/france/france_airspace.txt',
    filename: 'france_airspace.txt'
  },
  {
    name: 'France Class D CTR',
    url: 'https://raw.githubusercontent.com/openflightmaps/airspace/master/france/france_class_d.txt', 
    filename: 'france_class_d.txt'
  }
];

/**
 * Télécharge un fichier depuis une URL
 */
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destination, () => {}); // Delete incomplete file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Télécharge tous les fichiers d'espaces aériens
 */
async function downloadAllAirspaces() {
  const outputDir = path.join(__dirname, '..', 'src', 'data', 'airspaces');
  
  // Créer le dossier si nécessaire
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('📥 Téléchargement des espaces aériens français...\n');
  
  for (const source of AIRSPACE_SOURCES) {
    const destination = path.join(outputDir, source.filename);
    
    try {
      console.log(`Téléchargement de ${source.name}...`);
      await downloadFile(source.url, destination);
      console.log(`✅ ${source.name} téléchargé avec succès`);
      
      // Vérifier la taille du fichier
      const stats = fs.statSync(destination);
      console.log(`   Taille: ${(stats.size / 1024).toFixed(2)} KB\n`);
      
    } catch (error) {
      console.error(`❌ Erreur téléchargement ${source.name}:`, error.message);
    }
  }
  
  console.log('✅ Téléchargement terminé');
}

// Alternative : données OpenAir intégrées pour la France (extrait)
const SAMPLE_OPENAIR_DATA = `
* French Airspaces Sample - OpenAir Format
* Source: Public domain data

* CTR PARIS CHARLES DE GAULLE
AC D
AN CTR PARIS CDG
AH 2000 ft AMSL
AL SFC
DP 49:01:18 N 002:36:55 E
DP 49:00:17 N 002:42:37 E
DP 48:58:42 N 002:44:31 E
DP 48:56:08 N 002:41:37 E
DP 48:55:00 N 002:36:00 E
DP 48:55:35 N 002:29:48 E
DP 48:57:54 N 002:25:59 E
DP 49:00:00 N 002:25:10 E
DP 49:02:06 N 002:27:07 E
DP 49:02:52 N 002:32:31 E
DP 49:01:18 N 002:36:55 E

* TMA PARIS SECTOR 1
AC A
AN TMA PARIS 1
AH FL195
AL 1500 ft AMSL
DP 49:30:00 N 003:22:00 E
DP 49:30:00 N 001:47:00 E
DP 48:22:00 N 001:47:00 E
DP 48:22:00 N 003:22:00 E
DP 49:30:00 N 003:22:00 E

* ZONE P 23 BELLEVILLE
AC P
AN P23 BELLEVILLE
AH 3300 ft AMSL
AL SFC
V X=47:30:00 N 002:52:00 E
DC 2.5

* Zone R 45 ABC ORLEANS
AC R
AN R45ABC ORLEANS
AH 9500 ft AMSL
AL SFC
DP 48:00:00 N 001:57:00 E
DP 48:00:00 N 002:06:00 E
DP 47:51:00 N 002:06:00 E
DP 47:51:00 N 001:57:00 E
DP 48:00:00 N 001:57:00 E
`;

// Sauvegarder les données d'exemple si le téléchargement échoue
function saveSampleData() {
  const outputDir = path.join(__dirname, '..', 'src', 'data', 'airspaces');
  const sampleFile = path.join(outputDir, 'france_sample.txt');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(sampleFile, SAMPLE_OPENAIR_DATA);
  console.log('💾 Données d\'exemple sauvegardées dans france_sample.txt');
}

// Exécuter le téléchargement
downloadAllAirspaces().catch(error => {
  console.error('Erreur fatale:', error);
  console.log('\n⚠️ Utilisation des données d\'exemple à la place...');
  saveSampleData();
});