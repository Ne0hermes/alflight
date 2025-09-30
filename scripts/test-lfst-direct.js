// Test direct du parsing LFST depuis les fichiers XML
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

async function testLFSTDirectly() {
  console.log('\n=== TEST DIRECT DU PARSING LFST ===\n');
  
  try {
    // Lire le fichier AIXM
    const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
    const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
    const doc = dom.window.document;
    
    // Trouver LFST
    const ahps = doc.querySelectorAll('Ahp');
    let lfstData = null;
    
    for (const ahp of ahps) {
      const ahpUid = ahp.querySelector('AhpUid');
      const icao = getTextContent(ahpUid, 'codeId');
      
      if (icao === 'LFST') {
        lfstData = {
          icao,
          name: getTextContent(ahp, 'txtName'),
          city: getTextContent(ahp, 'txtNameCitySer'),
          elevation: getTextContent(ahp, 'valElev'),
          runways: []
        };
        console.log('✅ LFST trouvé!');
        console.log(`   Nom: ${lfstData.name}`);
        console.log(`   Ville: ${lfstData.city}`);
        console.log(`   Altitude: ${lfstData.elevation} ft`);
        break;
      }
    }
    
    if (!lfstData) {
      console.error('❌ LFST non trouvé!');
      return;
    }
    
    // Chercher les pistes
    console.log('\n📐 PISTES:');
    const rwys = doc.querySelectorAll('Rwy');
    const runwayMap = new Map();
    
    for (const rwy of rwys) {
      const rwyUid = rwy.querySelector('RwyUid');
      const ahpUid = rwyUid?.querySelector('AhpUid');
      const icao = getTextContent(ahpUid, 'codeId');
      
      if (icao === 'LFST') {
        const designation = getTextContent(rwyUid, 'txtDesig');
        const runway = {
          designation,
          length: parseFloat(getTextContent(rwy, 'valLen') || 0),
          width: parseFloat(getTextContent(rwy, 'valWid') || 0),
          surface: getTextContent(rwy, 'codeComposition'),
          directions: []
        };
        runwayMap.set(designation, runway);
        console.log(`\n   Piste ${designation}:`);
        console.log(`      Dimensions: ${runway.length} × ${runway.width} m`);
        console.log(`      Surface: ${runway.surface}`);
      }
    }
    
    // Chercher les directions
    console.log('\n🧭 DIRECTIONS:');
    const rdns = doc.querySelectorAll('Rdn');
    
    for (const rdn of rdns) {
      const rdnUid = rdn.querySelector('RdnUid');
      const rwyUid = rdnUid?.querySelector('RwyUid');
      const ahpUid = rwyUid?.querySelector('AhpUid');
      const icao = getTextContent(ahpUid, 'codeId');
      
      if (icao === 'LFST') {
        const rwyDesignation = getTextContent(rwyUid, 'txtDesig');
        const direction = getTextContent(rdnUid, 'txtDesig');
        const trueBrg = getTextContent(rdn, 'valTrueBrg');
        const magBrg = getTextContent(rdn, 'valMagBrg');
        
        console.log(`   Piste ${rwyDesignation} - Direction ${direction}:`);
        console.log(`      QFU Vrai: ${trueBrg}°`);
        console.log(`      QFU Magnétique: ${magBrg}°`);
        
        const runway = runwayMap.get(rwyDesignation);
        if (runway) {
          runway.directions.push({
            designation: direction,
            trueBearing: parseFloat(trueBrg),
            magneticBearing: parseFloat(magBrg),
            distances: {}
          });
        }
      }
    }
    
    // Chercher les distances déclarées
    console.log('\n📏 DISTANCES DÉCLARÉES:');
    const rdds = doc.querySelectorAll('Rdd');
    let distanceCount = 0;
    
    for (const rdd of rdds) {
      const rdnUid = rdd.querySelector('RdnUid');
      const rwyUid = rdnUid?.querySelector('RwyUid');
      const ahpUid = rwyUid?.querySelector('AhpUid');
      const icao = getTextContent(ahpUid, 'codeId');
      
      if (icao === 'LFST') {
        distanceCount++;
        const rwyDesignation = getTextContent(rwyUid, 'txtDesig');
        const direction = getTextContent(rdnUid, 'txtDesig');
        // Le codeType est dans RddUid, pas dans Rdd
        const rddUid = rdd.querySelector('RddUid');
        const distType = getTextContent(rddUid, 'codeType');
        const distance = getTextContent(rdd, 'valDist');
        
        console.log(`   Piste ${rwyDesignation} - Dir ${direction} - ${distType}: ${distance} m`);
        
        const runway = runwayMap.get(rwyDesignation);
        if (runway) {
          // Si direction = rwyDesignation et contient '/', appliquer à toutes les directions
          if (direction === rwyDesignation && direction.includes('/')) {
            for (const dir of runway.directions) {
              if (!dir.distances) dir.distances = {};
              dir.distances[distType] = parseFloat(distance);
              console.log(`      → Appliqué à direction ${dir.designation}`);
            }
          } else {
            // Chercher la direction spécifique
            const dir = runway.directions.find(d => d.designation === direction);
            if (dir) {
              if (!dir.distances) dir.distances = {};
              dir.distances[distType] = parseFloat(distance);
            }
          }
        }
      }
    }
    
    console.log(`\n   Total: ${distanceCount} distances déclarées trouvées pour LFST`);
    
    // Chercher les ILS
    console.log('\n📡 ILS:');
    const ilss = doc.querySelectorAll('Ils');
    
    for (const ils of ilss) {
      const rdnUid = ils.querySelector('RdnUid');
      const rwyUid = rdnUid?.querySelector('RwyUid');
      const ahpUid = rwyUid?.querySelector('AhpUid');
      const icao = getTextContent(ahpUid, 'codeId');
      
      if (icao === 'LFST') {
        const rwyDesignation = getTextContent(rwyUid, 'txtDesig');
        const direction = getTextContent(rdnUid, 'txtDesig');
        const category = getTextContent(ils, 'codeCat');
        const ilz = ils.querySelector('Ilz');
        const freq = getTextContent(ilz, 'valFreq');
        const ident = getTextContent(ilz, 'codeId');
        
        console.log(`   Piste ${rwyDesignation} - Direction ${direction}:`);
        console.log(`      Catégorie: CAT ${category}`);
        console.log(`      Fréquence: ${freq} MHz`);
        console.log(`      Indicatif: ${ident}`);
        
        const runway = runwayMap.get(rwyDesignation);
        if (runway) {
          const dir = runway.directions.find(d => d.designation === direction);
          if (dir) {
            dir.ils = {
              category,
              frequency: parseFloat(freq),
              identifier: ident
            };
          }
        }
      }
    }
    
    // Résumé final structuré
    console.log('\n\n=== RÉSUMÉ FINAL STRUCTURÉ ===\n');
    
    for (const [desig, runway] of runwayMap) {
      console.log(`PISTE ${desig}:`);
      console.log(`   Dimensions: ${runway.length} × ${runway.width} m`);
      console.log(`   Surface: ${runway.surface}`);
      
      for (const dir of runway.directions) {
        console.log(`\n   Direction ${dir.designation}:`);
        console.log(`      QFU Magnétique: ${dir.magneticBearing}°`);
        console.log(`      QFU Vrai: ${dir.trueBearing}°`);
        console.log(`      TORA: ${dir.distances?.TORA || 'NON DÉFINI'} m`);
        console.log(`      TODA: ${dir.distances?.TODA || 'NON DÉFINI'} m`);
        console.log(`      ASDA: ${dir.distances?.ASDA || 'NON DÉFINI'} m`);
        console.log(`      LDA: ${dir.distances?.LDA || 'NON DÉFINI'} m`);
        
        if (dir.ils) {
          console.log(`      ILS: CAT ${dir.ils.category} - ${dir.ils.frequency} MHz - ${dir.ils.identifier}`);
        }
      }
    }
    
    // Vérifier les fréquences dans le fichier SIA
    console.log('\n\n📻 FRÉQUENCES (depuis SIA):');
    const siaContent = fs.readFileSync('src/data/XML_SIA_2025-09-04.xml', 'utf8');
    const siaDom = new JSDOM(siaContent, { contentType: 'text/xml' });
    const siaDoc = siaDom.window.document;
    
    const frequences = siaDoc.querySelectorAll('Frequence');
    let lfstFreqs = [];
    
    for (const freq of frequences) {
      const service = freq.querySelector('Service');
      const serviceName = service?.getAttribute('lk');
      
      if (serviceName && serviceName.includes('[LF][ST]')) {
        const frequency = getTextContent(freq, 'Frequence');
        const horaire = getTextContent(freq, 'HorCode');
        
        // Extraire le type de service
        const serviceMatch = serviceName.match(/\[(TWR|APP|GND|ATIS|FIS|VDF|INFO|AFIS|DEL|DELIVERY)\s+[^\]]*\]/);
        if (serviceMatch) {
          const serviceType = serviceMatch[1];
          console.log(`   ${serviceType}: ${frequency} MHz ${horaire ? `(${horaire})` : ''}`);
          lfstFreqs.push({ service: serviceType, frequency, schedule: horaire });
        }
      }
    }
    
    if (lfstFreqs.length === 0) {
      console.log('   ❌ Aucune fréquence trouvée pour LFST');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Lancer le test
testLFSTDirectly();