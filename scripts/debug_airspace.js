// Debug script pour comprendre le problème des espaces aériens
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DOMParser } from '@xmldom/xmldom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const xmlContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'AIXM4.5_all_FR_OM_2025-09-04.xml'), 'utf-8');
const parser = new DOMParser();
const doc = parser.parseFromString(xmlContent, 'text/xml');

// Chercher les espaces aériens
const aseElements = doc.getElementsByTagName('Ase');
console.log(`Nombre d'éléments Ase trouvés: ${aseElements.length}`);

if (aseElements.length > 0) {
  // Analyser le premier espace aérien
  const firstAse = aseElements[0];
  console.log('\n=== Premier espace aérien ===');
  
  // UID
  const uid = firstAse.getElementsByTagName('AseUid')[0];
  if (uid) {
    const codeId = uid.getElementsByTagName('codeId')[0]?.textContent;
    const codeType = uid.getElementsByTagName('codeType')[0]?.textContent;
    console.log(`Code ID: ${codeId}`);
    console.log(`Type: ${codeType}`);
  }
  
  // Géométrie
  const abdElements = firstAse.getElementsByTagName('Abd');
  console.log(`\nNombre d'éléments Abd (boundary): ${abdElements.length}`);
  
  if (abdElements.length > 0) {
    const firstAbd = abdElements[0];
    const avxElements = firstAbd.getElementsByTagName('Avx');
    console.log(`Nombre de points Avx dans le premier Abd: ${avxElements.length}`);
    
    if (avxElements.length > 0) {
      console.log('\nPremiers points:');
      for (let i = 0; i < Math.min(3, avxElements.length); i++) {
        const avx = avxElements[i];
        const lat = avx.getElementsByTagName('geoLat')[0]?.textContent;
        const lon = avx.getElementsByTagName('geoLong')[0]?.textContent;
        const codeType = avx.getElementsByTagName('codeType')[0]?.textContent;
        console.log(`  Point ${i + 1}: lat=${lat}, lon=${lon}, type=${codeType}`);
      }
    }
  }
  
  // Afficher la structure XML du premier espace
  console.log('\n=== Structure XML (100 premiers caractères) ===');
  const xmlString = firstAse.toString();
  console.log(xmlString ? xmlString.substring(0, 500) : 'Impossible de convertir en string');
}

// Compter les espaces avec géométrie
let countWithGeometry = 0;
let countWithoutGeometry = 0;

for (let i = 0; i < Math.min(100, aseElements.length); i++) {
  const ase = aseElements[i];
  const abdElements = ase.getElementsByTagName('Abd');
  
  if (abdElements.length > 0) {
    const avxElements = abdElements[0].getElementsByTagName('Avx');
    if (avxElements.length > 0) {
      countWithGeometry++;
    } else {
      countWithoutGeometry++;
    }
  } else {
    countWithoutGeometry++;
  }
}

console.log(`\n=== Statistiques sur 100 premiers espaces ===`);
console.log(`Avec géométrie: ${countWithGeometry}`);
console.log(`Sans géométrie: ${countWithoutGeometry}`);