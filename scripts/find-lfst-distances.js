import fs from 'fs';
import { JSDOM } from 'jsdom';

const xmlContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
const dom = new JSDOM(xmlContent, { contentType: 'text/xml' });
const doc = dom.window.document;

console.log('\n=== Recherche des distances déclarées pour LFST ===\n');

// Chercher toutes les Rdd
const rdds = doc.querySelectorAll('Rdd');
let lfstDistances = [];

for (const rdd of rdds) {
  const rdnUid = rdd.querySelector('RdnUid');
  if (!rdnUid) continue;
  
  const rwyUid = rdnUid?.querySelector('RwyUid');
  if (!rwyUid) continue;
  
  const ahpUid = rwyUid?.querySelector('AhpUid');
  const icao = ahpUid?.querySelector('codeId')?.textContent;
  
  if (icao === 'LFST') {
    const rwyDesig = rwyUid?.querySelector('txtDesig')?.textContent;
    const direction = rdnUid?.querySelector('txtDesig')?.textContent;
    const distType = rdd.querySelector('codeType')?.textContent;
    const distance = rdd.querySelector('valDist')?.textContent;
    const uom = rdd.querySelector('uomDist')?.textContent;
    
    lfstDistances.push({
      runway: rwyDesig,
      direction: direction,
      type: distType,
      value: distance,
      unit: uom
    });
    
    console.log(`Trouvé: Piste ${rwyDesig} - Dir ${direction} - ${distType}: ${distance} ${uom}`);
  }
}

if (lfstDistances.length === 0) {
  console.log('❌ Aucune distance déclarée trouvée pour LFST dans le fichier AIXM');
  
  // Chercher les pistes LFST pour vérifier
  console.log('\n=== Vérification des pistes LFST ===\n');
  
  const rwys = doc.querySelectorAll('Rwy');
  let lfstRunways = 0;
  
  for (const rwy of rwys) {
    const rwyUid = rwy.querySelector('RwyUid');
    const ahpUid = rwyUid?.querySelector('AhpUid');
    const icao = ahpUid?.querySelector('codeId')?.textContent;
    
    if (icao === 'LFST') {
      const desig = rwyUid?.querySelector('txtDesig')?.textContent;
      const length = rwy.querySelector('valLen')?.textContent;
      const width = rwy.querySelector('valWid')?.textContent;
      
      console.log(`Piste LFST trouvée: ${desig} - ${length}×${width}m`);
      lfstRunways++;
    }
  }
  
  if (lfstRunways === 0) {
    console.log('❌ Aucune piste LFST trouvée');
  }
} else {
  console.log(`\n✅ ${lfstDistances.length} distances trouvées pour LFST`);
}

// Vérifier aussi les ILS
console.log('\n=== Vérification des ILS pour LFST ===\n');

const ilss = doc.querySelectorAll('Ils');
for (const ils of ilss) {
  const rdnUid = ils.querySelector('RdnUid');
  const rwyUid = rdnUid?.querySelector('RwyUid');
  const ahpUid = rwyUid?.querySelector('AhpUid');
  const icao = ahpUid?.querySelector('codeId')?.textContent;
  
  if (icao === 'LFST') {
    const rwyDesig = rwyUid?.querySelector('txtDesig')?.textContent;
    const direction = rdnUid?.querySelector('txtDesig')?.textContent;
    const category = ils.querySelector('codeCat')?.textContent;
    
    console.log(`ILS LFST: Piste ${rwyDesig} - Dir ${direction} - CAT ${category}`);
  }
}