// Debug du problème de parsing
import { aixmParser } from '../src/services/aixmParser.js';

async function debugParser() {
  console.log('=== DEBUG PARSER ===\n');
  
  try {
    // Charger les données
    console.log('Chargement...');
    const data = await aixmParser.loadAndParse();
    
    // Trouver LFST
    const lfst = data.find(ad => ad.icao === 'LFST');
    
    if (!lfst) {
      console.error('❌ LFST non trouvé!');
      return;
    }
    
    console.log('✅ LFST trouvé\n');
    console.log('Nombre de pistes:', lfst.runways?.length || 0);
    
    // Afficher les pistes
    if (lfst.runways) {
      for (const runway of lfst.runways) {
        console.log(`\nPiste ${runway.designation || runway.identifier}:`);
        console.log(`   Length: ${runway.length}`);
        console.log(`   Width: ${runway.width}`);
        console.log(`   Surface: ${runway.surface}`);
        console.log(`   QFU: ${runway.qfu}`);
        console.log(`   TORA: ${runway.tora} (${runway.tora === null ? 'NULL' : typeof runway.tora})`);
        console.log(`   TODA: ${runway.toda} (${runway.toda === null ? 'NULL' : typeof runway.toda})`);
        console.log(`   ASDA: ${runway.asda} (${runway.asda === null ? 'NULL' : typeof runway.asda})`);
        console.log(`   LDA: ${runway.lda} (${runway.lda === null ? 'NULL' : typeof runway.lda})`);
      }
    }
    
    // Afficher les points VFR
    console.log(`\nPoints VFR: ${lfst.vfrPoints?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

debugParser();