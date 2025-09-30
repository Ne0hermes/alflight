// Debug du problème de direction ILS
import fs from 'fs';
import { JSDOM } from 'jsdom';

const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
const doc = dom.window.document;

console.log('=== DEBUG DIRECTION ILS ===\n');

// Chercher les ILS LFST
const ilss = doc.querySelectorAll('Ils');

for (const ils of ilss) {
  const rdnUid = ils.querySelector('RdnUid');
  const rwyUid = rdnUid?.querySelector('RwyUid');
  const ahpUid = rwyUid?.querySelector('AhpUid');
  const icao = ahpUid?.querySelector('codeId')?.textContent;
  
  if (icao === 'LFST') {
    console.log('ILS trouvé pour LFST:');
    console.log('  Structure RdnUid:');
    
    // Afficher la structure complète
    const rdnUidChildren = rdnUid.children;
    for (let i = 0; i < rdnUidChildren.length; i++) {
      const child = rdnUidChildren[i];
      console.log(`    - ${child.tagName}: ${child.textContent.substring(0, 50)}`);
    }
    
    // Chercher txtDesig directement dans RdnUid (pas dans RwyUid)
    let directionDesig = null;
    for (let i = 0; i < rdnUidChildren.length; i++) {
      if (rdnUidChildren[i].tagName === 'txtDesig') {
        directionDesig = rdnUidChildren[i].textContent;
        break;
      }
    }
    
    const rwyDesig = rwyUid?.querySelector('txtDesig')?.textContent;
    
    console.log(`  Piste: ${rwyDesig}`);
    console.log(`  Direction: ${directionDesig}`);
    
    const category = ils.querySelector('codeCat')?.textContent;
    console.log(`  Catégorie: ${category}`);
    console.log('');
  }
}