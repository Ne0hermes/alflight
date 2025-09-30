// Recherche des procédures LFST
import fs from 'fs';
import { JSDOM } from 'jsdom';

console.log('=== RECHERCHE PROCÉDURES LFST ===\n');

// Charger le fichier SIA
const siaContent = fs.readFileSync('../src/data/XML_SIA_2025-09-04.xml', 'utf8');
const siaDom = new JSDOM(siaContent, { contentType: 'text/xml' });
const siaDoc = siaDom.window.document;

// Chercher l'aérodrome LFST
const aerodromes = siaDoc.querySelectorAll('Aerodrome');
let lfstFound = false;

for (const ad of aerodromes) {
  const code = ad.querySelector('AdCode');
  if (code && code.textContent === 'LFST') {
    console.log('✅ LFST trouvé dans SIA');
    lfstFound = true;
    
    // Chercher les procédures de déneigement
    const neigePriorite = ad.querySelector('NeigePriorite');
    if (neigePriorite) {
      console.log('\n❄️ PROCÉDURE DE DÉNEIGEMENT:');
      console.log(neigePriorite.textContent);
    }
    
    const neigeEqpt = ad.querySelector('NeigeEqpt');
    if (neigeEqpt) {
      console.log('\n🚜 ÉQUIPEMENT DE DÉNEIGEMENT:');
      console.log(neigeEqpt.textContent);
    }
    
    // Chercher les procédures SSLIA
    const ssliaAcft = ad.querySelector('SsliaAcft');
    if (ssliaAcft) {
      console.log('\n🚒 PROCÉDURE INCENDIE:');
      console.log(ssliaAcft.textContent);
    }
    
    const ssliaRem = ad.querySelector('SsliaRem');
    if (ssliaRem) {
      console.log('\n📝 REMARQUES SSLIA:');
      console.log(ssliaRem.textContent);
    }
    
    // Chercher services passagers
    const svcPaxRem = ad.querySelector('SvcPaxRem');
    if (svcPaxRem) {
      console.log('\n👥 REMARQUES SERVICES PASSAGERS:');
      console.log(svcPaxRem.textContent);
    }
    
    // Chercher restrictions opérationnelles
    const adOpr = ad.querySelector('AdOpr');
    if (adOpr) {
      console.log('\n⚠️ RESTRICTIONS OPÉRATIONNELLES:');
      console.log(adOpr.textContent);
    }
    
    break;
  }
}

if (!lfstFound) {
  console.log('❌ LFST non trouvé dans le fichier SIA');
  
  // Vérifier si LFST est mentionné ailleurs
  if (siaContent.includes('LFST')) {
    console.log('Mais LFST est mentionné dans le fichier (peut-être dans les fréquences ou remarques)');
  }
}

// Chercher dans AIXM aussi
console.log('\n=== RECHERCHE DANS AIXM ===');
const aixmContent = fs.readFileSync('../src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
const aixmDom = new JSDOM(aixmContent, { contentType: 'text/xml' });
const aixmDoc = aixmDom.window.document;

// Chercher les restrictions opérationnelles (Aor)
const aors = aixmDoc.querySelectorAll('Aor');
for (const aor of aors) {
  const ahpUid = aor.querySelector('AhpUid');
  const icao = ahpUid?.querySelector('codeId')?.textContent;
  
  if (icao === 'LFST') {
    const codeOpr = aor.querySelector('codeOpr')?.textContent;
    const txtRmk = aor.querySelector('txtRmk')?.textContent;
    
    console.log('\n⚠️ RESTRICTION OPÉRATIONNELLE LFST:');
    console.log('  Type:', codeOpr);
    console.log('  Remarques:', txtRmk);
  }
}