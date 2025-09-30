// Recherche complète des consignes LFST
import fs from 'fs';
import { JSDOM } from 'jsdom';

console.log('=== RECHERCHE COMPLÈTE CONSIGNES LFST ===\n');

// 1. Chercher dans SIA
console.log('1️⃣ RECHERCHE DANS SIA (XML_SIA_2025-09-04.xml)');
const siaContent = fs.readFileSync('../src/data/XML_SIA_2025-09-04.xml', 'utf8');
const siaDom = new JSDOM(siaContent, { contentType: 'text/xml' });
const siaDoc = siaDom.window.document;

// Chercher LFST dans SIA
const aerodromes = siaDoc.querySelectorAll('Aerodrome');
let lfstFound = false;

for (const ad of aerodromes) {
  const code = ad.querySelector('AdCode');
  if (code && code.textContent === 'LFST') {
    console.log('✅ LFST trouvé dans SIA');
    
    // Chercher AdRem
    const adRem = ad.querySelector('AdRem');
    if (adRem) {
      console.log('  AdRem:', adRem.textContent);
    } else {
      console.log('  Pas de AdRem pour LFST');
    }
    
    // Chercher Remarques
    const remarques = ad.querySelectorAll('Remarque');
    if (remarques.length > 0) {
      console.log('  Remarques:');
      remarques.forEach(r => console.log('    -', r.textContent));
    }
    
    lfstFound = true;
    break;
  }
}

if (!lfstFound) {
  console.log('❌ LFST non trouvé dans SIA');
}

console.log('\n2️⃣ RECHERCHE DANS AIXM (AIXM4.5_all_FR_OM_2025-09-04.xml)');
const aixmContent = fs.readFileSync('../src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
const aixmDom = new JSDOM(aixmContent, { contentType: 'text/xml' });
const aixmDoc = aixmDom.window.document;

const ahps = aixmDoc.querySelectorAll('Ahp');
for (const ahp of ahps) {
  const ahpUid = ahp.querySelector('AhpUid');
  const icao = ahpUid?.querySelector('codeId')?.textContent;
  if (icao === 'LFST') {
    console.log('✅ LFST trouvé dans AIXM');
    
    // Chercher txtRmk
    const txtRmk = ahp.querySelector('txtRmk');
    if (txtRmk) {
      console.log('  txtRmk:', txtRmk.textContent);
    } else {
      console.log('  Pas de txtRmk pour LFST');
    }
    break;
  }
}

console.log('\n3️⃣ RECHERCHE DE REMARQUES MENTIONNANT LFST');
// Chercher toutes les remarques qui mentionnent LFST
const allRmks = aixmDoc.querySelectorAll('txtRmk');
let count = 0;
for (const rmk of allRmks) {
  if (rmk.textContent.includes('LFST')) {
    count++;
    console.log('  Remarque trouvée:', rmk.textContent.substring(0, 100) + '...');
  }
}
console.log('Total remarques mentionnant LFST:', count);

// Rechercher aussi dans les espaces aériens
console.log('\n4️⃣ RECHERCHE DANS LES ESPACES AÉRIENS');
const spaces = aixmDoc.querySelectorAll('Spa');
count = 0;
for (const spa of spaces) {
  const txtRmk = spa.querySelector('txtRmk');
  if (txtRmk && txtRmk.textContent.includes('LFST')) {
    count++;
    const type = spa.querySelector('codeType')?.textContent;
    console.log(`  Espace ${type}:`, txtRmk.textContent.substring(0, 80) + '...');
  }
}
console.log('Total espaces aériens mentionnant LFST:', count);