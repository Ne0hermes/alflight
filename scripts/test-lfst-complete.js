// Test complet des données LFST incluant les points VFR
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

function convertDMSToDecimal(dms) {
  if (!dms) return 0;
  
  const matches = dms.match(/(\d{2,3})(\d{2})(\d{2}\.?\d*)([NSEW])/);
  if (!matches) return 0;
  
  const degrees = parseInt(matches[1]);
  const minutes = parseInt(matches[2]);
  const seconds = parseFloat(matches[3]);
  const direction = matches[4];
  
  let decimal = degrees + minutes / 60 + seconds / 3600;
  
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  
  return decimal;
}

async function testLFSTComplete() {
  console.log('=== TEST COMPLET LFST ===\n');
  
  const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
  const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
  const doc = dom.window.document;
  
  // 1. Informations générales
  console.log('📍 INFORMATIONS GÉNÉRALES:');
  const ahps = doc.querySelectorAll('Ahp');
  
  for (const ahp of ahps) {
    const ahpUid = ahp.querySelector('AhpUid');
    const icao = getTextContent(ahpUid, 'codeId');
    
    if (icao === 'LFST') {
      console.log(`   ICAO: ${icao}`);
      console.log(`   Nom: ${getTextContent(ahp, 'txtName')}`);
      console.log(`   Ville: ${getTextContent(ahp, 'txtNameCitySer')}`);
      console.log(`   Altitude: ${getTextContent(ahp, 'valElev')} ft`);
      break;
    }
  }
  
  // 2. Pistes avec distances
  console.log('\n🛬 PISTES:');
  const rwys = doc.querySelectorAll('Rwy');
  const runwayData = new Map();
  
  for (const rwy of rwys) {
    const rwyUid = rwy.querySelector('RwyUid');
    const ahpUid = rwyUid?.querySelector('AhpUid');
    const icao = getTextContent(ahpUid, 'codeId');
    
    if (icao === 'LFST') {
      const designation = getTextContent(rwyUid, 'txtDesig');
      runwayData.set(designation, {
        length: getTextContent(rwy, 'valLen'),
        width: getTextContent(rwy, 'valWid'),
        surface: getTextContent(rwy, 'codeComposition'),
        directions: []
      });
    }
  }
  
  // Directions
  const rdns = doc.querySelectorAll('Rdn');
  for (const rdn of rdns) {
    const rdnUid = rdn.querySelector('RdnUid');
    const rwyUid = rdnUid?.querySelector('RwyUid');
    const ahpUid = rwyUid?.querySelector('AhpUid');
    const icao = getTextContent(ahpUid, 'codeId');
    
    if (icao === 'LFST') {
      const rwyDesig = getTextContent(rwyUid, 'txtDesig');
      const direction = getTextContent(rdnUid, 'txtDesig');
      
      if (runwayData.has(rwyDesig)) {
        runwayData.get(rwyDesig).directions.push({
          designation: direction,
          qfuMag: getTextContent(rdn, 'valMagBrg'),
          distances: {}
        });
      }
    }
  }
  
  // Distances
  const rdds = doc.querySelectorAll('Rdd');
  for (const rdd of rdds) {
    const rdnUid = rdd.querySelector('RdnUid');
    const rwyUid = rdnUid?.querySelector('RwyUid');
    const ahpUid = rwyUid?.querySelector('AhpUid');
    const icao = getTextContent(ahpUid, 'codeId');
    
    if (icao === 'LFST') {
      const rwyDesig = getTextContent(rwyUid, 'txtDesig');
      const direction = getTextContent(rdnUid, 'txtDesig');
      const rddUid = rdd.querySelector('RddUid');
      const distType = getTextContent(rddUid, 'codeType');
      const distance = getTextContent(rdd, 'valDist');
      
      const runway = runwayData.get(rwyDesig);
      if (runway) {
        const dir = runway.directions.find(d => d.designation === direction);
        if (dir) {
          dir.distances[distType] = distance;
        }
      }
    }
  }
  
  // ILS
  const ilss = doc.querySelectorAll('Ils');
  for (const ils of ilss) {
    const rdnUid = ils.querySelector('RdnUid');
    const rwyUid = rdnUid?.querySelector('RwyUid');
    const ahpUid = rwyUid?.querySelector('AhpUid');
    const icao = getTextContent(ahpUid, 'codeId');
    
    if (icao === 'LFST') {
      const rwyDesig = getTextContent(rwyUid, 'txtDesig');
      const direction = getTextContent(rdnUid, 'txtDesig');
      const category = getTextContent(ils, 'codeCat');
      
      const runway = runwayData.get(rwyDesig);
      if (runway) {
        const dir = runway.directions.find(d => d.designation === direction);
        if (dir) {
          dir.ils = `CAT ${category}`;
        }
      }
    }
  }
  
  // Afficher les pistes
  for (const [desig, runway] of runwayData) {
    console.log(`\n   Piste ${desig}: ${runway.length} × ${runway.width} m - ${runway.surface}`);
    
    for (const dir of runway.directions) {
      console.log(`      ${dir.designation}: QFU ${dir.qfuMag}°`);
      console.log(`         TORA: ${dir.distances.TORA || '?'} m`);
      console.log(`         TODA: ${dir.distances.TODA || '?'} m`);
      console.log(`         ASDA: ${dir.distances.ASDA || '?'} m`);
      console.log(`         LDA: ${dir.distances.LDA || '?'} m`);
      if (dir.ils) {
        console.log(`         ILS: ${dir.ils}`);
      }
    }
  }
  
  // 3. Points VFR
  console.log('\n📍 POINTS VFR:');
  const dpns = doc.querySelectorAll('Dpn');
  const vfrPoints = [];
  
  for (const dpn of dpns) {
    const ahpUidAssoc = dpn.querySelector('AhpUidAssoc');
    const aerodromeId = getTextContent(ahpUidAssoc, 'codeId');
    
    if (aerodromeId === 'LFST') {
      const txtRmk = getTextContent(dpn, 'txtRmk');
      
      if (txtRmk && txtRmk.includes('VRP')) {
        const dpnUid = dpn.querySelector('DpnUid');
        vfrPoints.push({
          id: getTextContent(dpnUid, 'codeId'),
          name: getTextContent(dpn, 'txtName'),
          description: txtRmk.replace('VRP-', '').trim(),
          lat: convertDMSToDecimal(getTextContent(dpnUid, 'geoLat')),
          lon: convertDMSToDecimal(getTextContent(dpnUid, 'geoLong'))
        });
      }
    }
  }
  
  console.log(`   ${vfrPoints.length} points trouvés:`);
  vfrPoints.sort((a, b) => a.name.localeCompare(b.name));
  
  for (const point of vfrPoints) {
    console.log(`\n   ${point.name} (${point.id})`);
    console.log(`      ${point.description}`);
    console.log(`      ${point.lat.toFixed(4)}°N, ${point.lon.toFixed(4)}°E`);
  }
  
  // 4. Fréquences
  console.log('\n📻 FRÉQUENCES:');
  const siaContent = fs.readFileSync('src/data/XML_SIA_2025-09-04.xml', 'utf8');
  const siaDom = new JSDOM(siaContent, { contentType: 'text/xml' });
  const siaDoc = siaDom.window.document;
  
  const frequences = siaDoc.querySelectorAll('Frequence');
  const lfstFreqs = new Map();
  
  for (const freq of frequences) {
    const service = freq.querySelector('Service');
    const serviceName = service?.getAttribute('lk');
    
    if (serviceName && serviceName.includes('[LF][ST]')) {
      const frequency = getTextContent(freq, 'Frequence');
      const serviceMatch = serviceName.match(/\[(TWR|APP|GND|ATIS|FIS|VDF|INFO|AFIS|DEL|DELIVERY)\s+[^\]]*\]/);
      
      if (serviceMatch) {
        const serviceType = serviceMatch[1];
        if (!lfstFreqs.has(serviceType)) {
          lfstFreqs.set(serviceType, []);
        }
        lfstFreqs.get(serviceType).push(frequency);
      }
    }
  }
  
  for (const [service, freqs] of lfstFreqs) {
    console.log(`   ${service}: ${freqs.join(', ')} MHz`);
  }
  
  console.log('\n✅ Test complet terminé');
}

// Lancer le test
testLFSTComplete();