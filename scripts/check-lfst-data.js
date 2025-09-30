// Script pour vérifier les données LFST dans les fichiers AIXM/SIA
const fs = require('fs');
const { JSDOM } = require('jsdom');

async function checkLFSTData() {
  try {
    // Lire le fichier AIXM
    const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
    const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
    const doc = dom.window.document;
    
    console.log('\n=== DONNÉES LFST DANS AIXM ===\n');
    
    // 1. Chercher l'aérodrome
    const ahps = doc.querySelectorAll('Ahp');
    let lfstFound = false;
    
    for (const ahp of ahps) {
      const ahpUid = ahp.querySelector('AhpUid');
      const icao = ahpUid?.querySelector('codeId')?.textContent;
      
      if (icao === 'LFST') {
        lfstFound = true;
        console.log('✅ LFST trouvé');
        const name = ahp.querySelector('txtName')?.textContent;
        const elev = ahp.querySelector('valElev')?.textContent;
        console.log(`   Nom: ${name}`);
        console.log(`   Altitude: ${elev} ft`);
        break;
      }
    }
    
    if (!lfstFound) {
      console.log('❌ LFST non trouvé dans les aérodromes');
      return;
    }
    
    // 2. Chercher les pistes
    console.log('\n📐 PISTES (Rwy):');
    const rwys = doc.querySelectorAll('Rwy');
    const lfstRunways = new Map();
    
    for (const rwy of rwys) {
      const rwyUid = rwy.querySelector('RwyUid');
      const ahpUid = rwyUid?.querySelector('AhpUid');
      const icao = ahpUid?.querySelector('codeId')?.textContent;
      
      if (icao === 'LFST') {
        const desig = rwyUid?.querySelector('txtDesig')?.textContent;
        const length = rwy.querySelector('valLen')?.textContent;
        const width = rwy.querySelector('valWid')?.textContent;
        const surface = rwy.querySelector('codeComposition')?.textContent;
        
        console.log(`\nPiste ${desig}:`);
        console.log(`   Dimensions: ${length} × ${width} m`);
        console.log(`   Surface: ${surface}`);
        
        lfstRunways.set(desig, {
          length: parseFloat(length),
          width: parseFloat(width),
          surface,
          directions: []
        });
      }
    }
    
    // 3. Chercher les directions
    console.log('\n🧭 DIRECTIONS (Rdn):');
    const rdns = doc.querySelectorAll('Rdn');
    
    for (const rdn of rdns) {
      const rdnUid = rdn.querySelector('RdnUid');
      const rwyUid = rdnUid?.querySelector('RwyUid');
      const ahpUid = rwyUid?.querySelector('AhpUid');
      const icao = ahpUid?.querySelector('codeId')?.textContent;
      
      if (icao === 'LFST') {
        const rwyDesig = rwyUid?.querySelector('txtDesig')?.textContent;
        const direction = rdnUid?.querySelector('txtDesig')?.textContent;
        const trueBrg = rdn.querySelector('valTrueBrg')?.textContent;
        const magBrg = rdn.querySelector('valMagBrg')?.textContent;
        
        console.log(`\nPiste ${rwyDesig} - Direction ${direction}:`);
        console.log(`   QFU Vrai: ${trueBrg}°`);
        console.log(`   QFU Magnétique: ${magBrg}°`);
        
        if (lfstRunways.has(rwyDesig)) {
          lfstRunways.get(rwyDesig).directions.push({
            designation: direction,
            trueBearing: parseFloat(trueBrg),
            magneticBearing: parseFloat(magBrg),
            distances: {}
          });
        }
      }
    }
    
    // 4. Chercher les distances déclarées
    console.log('\n📏 DISTANCES DÉCLARÉES (Rdd):');
    const rdds = doc.querySelectorAll('Rdd');
    let distancesFound = false;
    
    for (const rdd of rdds) {
      const rdnUid = rdd.querySelector('RdnUid');
      const rwyUid = rdnUid?.querySelector('RwyUid');
      const ahpUid = rwyUid?.querySelector('AhpUid');
      const icao = ahpUid?.querySelector('codeId')?.textContent;
      
      if (icao === 'LFST') {
        distancesFound = true;
        const rwyDesig = rwyUid?.querySelector('txtDesig')?.textContent;
        const direction = rdnUid?.querySelector('txtDesig')?.textContent;
        const distType = rdd.querySelector('codeType')?.textContent;
        const distance = rdd.querySelector('valDist')?.textContent;
        const uom = rdd.querySelector('uomDist')?.textContent;
        
        console.log(`   Piste ${rwyDesig} - Dir ${direction} - ${distType}: ${distance} ${uom}`);
        
        // Stocker dans la structure
        const runway = lfstRunways.get(rwyDesig);
        if (runway) {
          const dir = runway.directions.find(d => d.designation === direction);
          if (dir) {
            dir.distances[distType] = parseFloat(distance);
          }
        }
      }
    }
    
    if (!distancesFound) {
      console.log('   ⚠️ Aucune distance déclarée trouvée pour LFST');
    }
    
    // 5. Chercher les ILS
    console.log('\n📡 ILS:');
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
        const ilz = ils.querySelector('Ilz');
        const freq = ilz?.querySelector('valFreq')?.textContent;
        const ident = ilz?.querySelector('codeId')?.textContent;
        
        console.log(`\nPiste ${rwyDesig} - Direction ${direction}:`);
        console.log(`   Catégorie: ${category}`);
        console.log(`   Fréquence: ${freq} MHz`);
        console.log(`   Indicatif: ${ident}`);
      }
    }
    
    // 6. Résumé final
    console.log('\n\n=== RÉSUMÉ STRUCTURÉ POUR LFST ===\n');
    
    for (const [desig, runway] of lfstRunways) {
      console.log(`\nPISTE ${desig}:`);
      console.log(`   Dimensions: ${runway.length} × ${runway.width} m`);
      console.log(`   Surface: ${runway.surface}`);
      
      for (const dir of runway.directions) {
        console.log(`\n   Direction ${dir.designation}:`);
        console.log(`      QFU Mag: ${dir.magneticBearing}°`);
        console.log(`      QFU Vrai: ${dir.trueBearing}°`);
        
        // Si pas de distances déclarées, utiliser la longueur de piste
        const tora = dir.distances.TORA || runway.length;
        const toda = dir.distances.TODA || runway.length;
        const asda = dir.distances.ASDA || runway.length;
        const lda = dir.distances.LDA || runway.length;
        
        console.log(`      TORA: ${tora} m`);
        console.log(`      TODA: ${toda} m`);
        console.log(`      ASDA: ${asda} m`);
        console.log(`      LDA: ${lda} m`);
      }
    }
    
  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

// Exécuter le script
checkLFSTData();