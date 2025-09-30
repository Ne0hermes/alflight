// Vérification des ILS LFST dans le fichier AIXM
import fs from 'fs';
import { JSDOM } from 'jsdom';

const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
const doc = dom.window.document;

console.log('=== VÉRIFICATION ILS LFST ===\n');

// Chercher les ILS
const ilss = doc.querySelectorAll('Ils');
let lfstIls = [];

for (const ils of ilss) {
  const rdnUid = ils.querySelector('RdnUid');
  const rwyUid = rdnUid?.querySelector('RwyUid');
  const ahpUid = rwyUid?.querySelector('AhpUid');
  const icao = ahpUid?.querySelector('codeId')?.textContent;
  
  if (icao === 'LFST') {
    const rwyDesig = rwyUid?.querySelector('txtDesig')?.textContent;
    const direction = rdnUid?.querySelector('txtDesig')?.textContent;
    const category = ils.querySelector('codeCat')?.textContent;
    const ilz = ils.querySelector('Ilz');
    const freq = ilz?.querySelector('valFreq')?.textContent;
    const ident = ilz?.querySelector('codeId')?.textContent;
    
    console.log(`ILS trouvé:`);
    console.log(`  Piste: ${rwyDesig}`);
    console.log(`  Direction: ${direction}`);
    console.log(`  Catégorie: ${category}`);
    console.log(`  Fréquence: ${freq} MHz`);
    console.log(`  Indicatif: ${ident}`);
    console.log('');
    
    lfstIls.push({
      runway: rwyDesig,
      direction: direction,
      category: category,
      frequency: freq,
      identifier: ident
    });
  }
}

if (lfstIls.length === 0) {
  console.log('❌ Aucun ILS trouvé pour LFST');
} else {
  console.log(`✅ ${lfstIls.length} ILS trouvés pour LFST`);
}