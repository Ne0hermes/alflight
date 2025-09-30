// Test rapide du fix des distances
import fs from 'fs';
import { JSDOM } from 'jsdom';

function getTextContent(element, tagName) {
  if (!element) return '';
  if (!tagName) {
    return element.textContent ? element.textContent.trim() : '';
  }
  
  const children = element.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].tagName === tagName) {
      return children[i].textContent.trim();
    }
  }
  return '';
}

console.log('=== TEST FIX DISTANCES ===\n');

const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
const doc = dom.window.document;

// Tester le parsing des distances
const rdds = doc.querySelectorAll('Rdd');
let lfstDistances = [];

for (const rdd of rdds) {
  // D'abord récupérer RddUid qui contient le codeType et RdnUid
  const rddUidElement = rdd.querySelector('RddUid');
  if (!rddUidElement) continue;
  
  const rdnUid = rddUidElement.querySelector('RdnUid');
  if (!rdnUid) continue;
  
  const rwyUid = rdnUid.querySelector('RwyUid');
  if (!rwyUid) continue;
  
  const ahpUid = rwyUid.querySelector('AhpUid');
  const aerodromeId = getTextContent(ahpUid, 'codeId');
  
  if (aerodromeId === 'LFST') {
    const rwyDesignation = getTextContent(rwyUid, 'txtDesig');
    const direction = getTextContent(rdnUid, 'txtDesig');
    const distanceType = getTextContent(rddUidElement, 'codeType');
    const distance = getTextContent(rdd, 'valDist');
    
    console.log(`Trouvé: Piste ${rwyDesignation} - Dir ${direction} - ${distanceType}: ${distance} m`);
    
    lfstDistances.push({
      runway: rwyDesignation,
      direction: direction,
      type: distanceType,
      value: distance
    });
  }
}

console.log(`\n✅ Total: ${lfstDistances.length} distances trouvées pour LFST`);

// Organiser par direction
const directions = {};
for (const dist of lfstDistances) {
  const key = `${dist.runway}-${dist.direction}`;
  if (!directions[key]) {
    directions[key] = {};
  }
  directions[key][dist.type] = dist.value;
}

console.log('\nRésumé par direction:');
for (const [key, distances] of Object.entries(directions)) {
  console.log(`\n${key}:`);
  console.log(`   TORA: ${distances.TORA || 'NON DÉFINI'} m`);
  console.log(`   TODA: ${distances.TODA || 'NON DÉFINI'} m`);
  console.log(`   ASDA: ${distances.ASDA || 'NON DÉFINI'} m`);
  console.log(`   LDA: ${distances.LDA || 'NON DÉFINI'} m`);
}