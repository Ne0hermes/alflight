// Recherche des points VFR dans les fichiers AIXM/SIA
import fs from 'fs';
import { JSDOM } from 'jsdom';

function analyzeAIXMStructure() {
  console.log('\n=== ANALYSE AIXM POUR POINTS VFR ===\n');
  
  const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
  const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
  const doc = dom.window.document;
  
  // Analyser les types de points (Dpn)
  const dpns = doc.querySelectorAll('Dpn');
  const pointTypes = new Map();
  const vfrPoints = [];
  
  console.log(`Nombre total de points désignés (Dpn): ${dpns.length}`);
  
  for (const dpn of dpns) {
    const dpnUid = dpn.querySelector('DpnUid');
    const codeId = dpnUid?.querySelector('codeId')?.textContent;
    const codeType = dpn.querySelector('codeType')?.textContent;
    const txtName = dpn.querySelector('txtName')?.textContent;
    const lat = dpnUid?.querySelector('geoLat')?.textContent;
    const lon = dpnUid?.querySelector('geoLong')?.textContent;
    
    // Compter les types
    pointTypes.set(codeType, (pointTypes.get(codeType) || 0) + 1);
    
    // Identifier les points VFR potentiels
    // Les points VFR ont souvent des noms courts (1-3 lettres) ou contiennent des indications de position
    if (codeId && (
      codeId.length <= 3 || 
      codeId.match(/^[NEWS]/i) ||
      codeType === 'VFR' ||
      codeType === 'OTHER' ||
      txtName?.includes('VFR')
    )) {
      vfrPoints.push({
        id: codeId,
        type: codeType,
        name: txtName,
        lat: lat,
        lon: lon
      });
    }
  }
  
  console.log('\nTypes de points trouvés:');
  for (const [type, count] of pointTypes) {
    console.log(`   ${type}: ${count} points`);
  }
  
  if (vfrPoints.length > 0) {
    console.log(`\n${vfrPoints.length} points VFR potentiels trouvés:`);
    vfrPoints.slice(0, 10).forEach(pt => {
      console.log(`   ${pt.id} (${pt.type}) - ${pt.name} - ${pt.lat}, ${pt.lon}`);
    });
  }
  
  // Chercher les procédures VFR (Procedure)
  const procedures = doc.querySelectorAll('Prc');
  let vfrProcedures = 0;
  
  for (const prc of procedures) {
    const codeType = prc.querySelector('codeType')?.textContent;
    const txtDescrUsage = prc.querySelector('txtDescrUsage')?.textContent;
    
    if (codeType?.includes('VFR') || txtDescrUsage?.includes('VFR')) {
      vfrProcedures++;
    }
  }
  
  console.log(`\nProcédures VFR trouvées: ${vfrProcedures}`);
  
  // Chercher les routes (Route)
  const routes = doc.querySelectorAll('Rte');
  let vfrRoutes = 0;
  
  for (const rte of routes) {
    const txtDescrFlightRule = rte.querySelector('txtDescrFlightRule')?.textContent;
    const txtDescrUsage = rte.querySelector('txtDescrUsage')?.textContent;
    
    if (txtDescrFlightRule?.includes('VFR') || txtDescrUsage?.includes('VFR')) {
      vfrRoutes++;
    }
  }
  
  console.log(`Routes VFR trouvées: ${vfrRoutes}`);
}

function analyzeSIAStructure() {
  console.log('\n\n=== ANALYSE SIA POUR POINTS VFR ===\n');
  
  const siaContent = fs.readFileSync('src/data/XML_SIA_2025-09-04.xml', 'utf8');
  const dom = new JSDOM(siaContent, { contentType: 'text/xml' });
  const doc = dom.window.document;
  
  // Analyser la structure générale
  const rootChildren = doc.documentElement.children;
  console.log('Structure racine du fichier SIA:');
  const elementCounts = new Map();
  
  for (const child of rootChildren) {
    const tagName = child.tagName;
    elementCounts.set(tagName, (elementCounts.get(tagName) || 0) + 1);
  }
  
  for (const [tag, count] of elementCounts) {
    console.log(`   ${tag}: ${count}`);
  }
  
  // Chercher des éléments spécifiques aux points VFR
  const possibleVFRTags = ['Point', 'Waypoint', 'VfrPoint', 'ReportingPoint', 'VisualPoint'];
  
  for (const tag of possibleVFRTags) {
    const elements = doc.querySelectorAll(tag);
    if (elements.length > 0) {
      console.log(`\n${tag} trouvés: ${elements.length}`);
      // Afficher un exemple
      if (elements[0]) {
        console.log('   Exemple:', elements[0].innerHTML?.substring(0, 200));
      }
    }
  }
  
  // Chercher dans les remarques ou descriptions
  const allTextElements = doc.querySelectorAll('*');
  let vfrMentions = 0;
  const vfrExamples = [];
  
  for (const elem of allTextElements) {
    const text = elem.textContent;
    if (text && text.match(/point[s]?\s+(de\s+)?report|VFR\s+point|visual\s+reporting/i)) {
      vfrMentions++;
      if (vfrExamples.length < 3) {
        vfrExamples.push({
          tag: elem.tagName,
          text: text.substring(0, 100)
        });
      }
    }
  }
  
  console.log(`\nMentions de points VFR dans le texte: ${vfrMentions}`);
  if (vfrExamples.length > 0) {
    console.log('Exemples:');
    vfrExamples.forEach(ex => {
      console.log(`   ${ex.tag}: ${ex.text}...`);
    });
  }
}

// Lancer les analyses
analyzeAIXMStructure();
analyzeSIAStructure();