// Test du parsing LFST avec le module aixmParser
import { aixmParser } from '../src/services/aixmParser.js';

async function testLFSTData() {
  console.log('\n=== TEST DU PARSING LFST ===\n');
  
  try {
    // Charger et parser les données
    console.log('Chargement des données AIXM/SIA...');
    const allData = await aixmParser.loadAndParse();
    
    // Trouver LFST
    const lfst = allData.find(ad => ad.icao === 'LFST');
    
    if (!lfst) {
      console.error('❌ LFST non trouvé dans les données parsées!');
      return;
    }
    
    console.log('✅ LFST trouvé!');
    console.log(`   Nom: ${lfst.name}`);
    console.log(`   Ville: ${lfst.city}`);
    console.log(`   Altitude: ${lfst.elevation?.value} ${lfst.elevation?.unit}`);
    
    // Afficher les pistes
    console.log('\n📐 PISTES:');
    if (lfst.runways && lfst.runways.length > 0) {
      for (const runway of lfst.runways) {
        console.log(`\n   Piste ${runway.designation || runway.identifier}:`);
        console.log(`      Dimensions: ${runway.length} × ${runway.width} m`);
        console.log(`      Surface: ${runway.surface}`);
        console.log(`      QFU: ${runway.qfu || runway.magneticBearing}°`);
        console.log(`      TORA: ${runway.tora || 'NON DÉFINI'} m`);
        console.log(`      TODA: ${runway.toda || 'NON DÉFINI'} m`);
        console.log(`      ASDA: ${runway.asda || 'NON DÉFINI'} m`);
        console.log(`      LDA: ${runway.lda || 'NON DÉFINI'} m`);
        
        if (runway.ils) {
          console.log(`      ILS: CAT ${runway.ils.category} - ${runway.ils.frequency} MHz - ${runway.ils.identifier}`);
        }
      }
    } else {
      console.log('   ❌ Aucune piste trouvée');
    }
    
    // Afficher les fréquences
    console.log('\n📻 FRÉQUENCES:');
    if (lfst.frequencies && Object.keys(lfst.frequencies).length > 0) {
      for (const [service, freqs] of Object.entries(lfst.frequencies)) {
        if (Array.isArray(freqs)) {
          console.log(`   ${service.toUpperCase()}: ${freqs.map(f => f.frequency).join(', ')} MHz`);
        } else {
          console.log(`   ${service.toUpperCase()}: ${freqs}`);
        }
      }
    } else {
      console.log('   ❌ Aucune fréquence trouvée');
    }
    
    // Afficher les données brutes pour debug
    console.log('\n\n=== DONNÉES BRUTES (JSON) ===\n');
    console.log(JSON.stringify(lfst, null, 2));
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Lancer le test
testLFSTData();