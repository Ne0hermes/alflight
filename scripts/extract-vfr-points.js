// Extraction des points VFR pour tous les aérodromes
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
  
  // Format: DDMMSS.ssN ou DDDMMSS.ssE ou DDMMSSN
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

function extractVFRPoints() {
  console.log('=== EXTRACTION DES POINTS VFR ===\n');
  
  const aixmContent = fs.readFileSync('src/data/AIXM4.5_all_FR_OM_2025-09-04.xml', 'utf8');
  const dom = new JSDOM(aixmContent, { contentType: 'text/xml' });
  const doc = dom.window.document;
  
  // Map pour stocker les points VFR par aérodrome
  const vfrPointsByAirport = new Map();
  
  // Parcourir tous les points
  const dpns = doc.querySelectorAll('Dpn');
  let totalVFRPoints = 0;
  
  for (const dpn of dpns) {
    const dpnUid = dpn.querySelector('DpnUid');
    const codeId = getTextContent(dpnUid, 'codeId');
    const lat = getTextContent(dpnUid, 'geoLat');
    const lon = getTextContent(dpnUid, 'geoLong');
    
    // Chercher l'aérodrome associé
    const ahpUidAssoc = dpn.querySelector('AhpUidAssoc');
    const airportId = getTextContent(ahpUidAssoc, 'codeId');
    
    // Récupérer les détails du point
    const codeType = getTextContent(dpn, 'codeType');
    const txtName = getTextContent(dpn, 'txtName');
    const txtRmk = getTextContent(dpn, 'txtRmk');
    
    // Filtrer les points VFR (VRP = Visual Reporting Point)
    if (txtRmk && txtRmk.includes('VRP') && airportId && airportId.startsWith('LF')) {
      const vfrPoint = {
        id: codeId,
        name: txtName,
        description: txtRmk.replace('VRP-', '').trim(),
        coordinates: {
          lat: convertDMSToDecimal(lat),
          lon: convertDMSToDecimal(lon),
          latDMS: lat,
          lonDMS: lon
        },
        type: 'VRP'
      };
      
      if (!vfrPointsByAirport.has(airportId)) {
        vfrPointsByAirport.set(airportId, []);
      }
      
      vfrPointsByAirport.get(airportId).push(vfrPoint);
      totalVFRPoints++;
    }
  }
  
  console.log(`Total: ${totalVFRPoints} points VFR trouvés pour ${vfrPointsByAirport.size} aérodromes\n`);
  
  // Afficher les résultats triés par aérodrome
  const sortedAirports = Array.from(vfrPointsByAirport.keys()).sort();
  
  for (const airportId of sortedAirports.slice(0, 10)) { // Afficher les 10 premiers
    const points = vfrPointsByAirport.get(airportId);
    console.log(`\n${airportId}: ${points.length} points VFR`);
    
    for (const point of points) {
      console.log(`   ${point.name} (${point.id})`);
      console.log(`      Description: ${point.description}`);
      console.log(`      Coordonnées: ${point.coordinates.lat.toFixed(6)}°, ${point.coordinates.lon.toFixed(6)}°`);
    }
  }
  
  // Focus sur LFST
  const lfstPoints = vfrPointsByAirport.get('LFST');
  if (lfstPoints) {
    console.log('\n\n=== POINTS VFR DE LFST (STRASBOURG) ===\n');
    console.log(`${lfstPoints.length} points trouvés:`);
    
    // Trier par nom
    lfstPoints.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const point of lfstPoints) {
      console.log(`\n${point.name} (${point.id})`);
      console.log(`   Description: ${point.description}`);
      console.log(`   Position: ${point.coordinates.latDMS} / ${point.coordinates.lonDMS}`);
      console.log(`   Décimal: ${point.coordinates.lat.toFixed(6)}°N, ${point.coordinates.lon.toFixed(6)}°E`);
    }
  }
  
  // Sauvegarder les résultats dans un fichier JSON
  const output = {
    totalPoints: totalVFRPoints,
    totalAirports: vfrPointsByAirport.size,
    airports: {}
  };
  
  for (const [airportId, points] of vfrPointsByAirport) {
    output.airports[airportId] = points;
  }
  
  fs.writeFileSync('src/data/vfr-points.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Points VFR sauvegardés dans src/data/vfr-points.json');
}

// Lancer l'extraction
extractVFRPoints();