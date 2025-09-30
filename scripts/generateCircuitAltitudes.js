// Script pour générer les altitudes de circuit pour tous les aérodromes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lire le fichier GeoJSON des aérodromes
const aerodromeFile = path.join(__dirname, '../src/data/derived/geojson/aerodromes.geojson');
const aerodromeData = JSON.parse(fs.readFileSync(aerodromeFile, 'utf8'));

// Altitudes spéciales connues pour certains aérodromes
const specialAltitudes = {
  // Aérodromes majeurs avec restrictions
  'LFPG': { circuitAltitude: null, integrationAltitude: null, remarks: 'Tours de piste non autorisés' },
  'LFPO': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Circuit VFR restreint' },
  'LFPB': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit publié' },
  'LFLL': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit restreint' },
  'LFML': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit côtier' },
  'LFMN': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Circuit mer uniquement' },
  
  // Aérodromes en montagne avec altitudes adaptées
  'LFLS': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Altitude élevée due au relief' },
  'LFMT': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Circuit montagne' },
  'LFHM': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Circuit montagne' },
  'LFHU': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Circuit montagne' },
  'LFKE': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Circuit montagne' },
  
  // Aérodromes militaires avec accès restreint
  'LFOE': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Base militaire - PPR' },
  'LFOJ': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Base militaire - PPR' },
  'LFSI': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Base militaire - PPR' },
  'LFSO': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Base militaire - PPR' },
  
  // Aérodromes avec particularités locales
  'LFPT': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit main droite piste 25' },
  'LFLB': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit publié - attention relief' },
  'LFKJ': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit côtier Corse' },
  'LFKB': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit publié Corse' },
};

// Générer la base de données complète
const circuitAltitudes = {};

// Parcourir tous les aérodromes
aerodromeData.features.forEach(feature => {
  const icao = feature.properties.icao || feature.properties.id;
  
  if (icao && icao.startsWith('LF')) { // Seulement les aérodromes français
    if (specialAltitudes[icao]) {
      // Utiliser les altitudes spéciales si définies
      circuitAltitudes[icao] = specialAltitudes[icao];
    } else {
      // Valeurs standards pour les autres aérodromes
      circuitAltitudes[icao] = {
        circuitAltitude: 1000,
        integrationAltitude: 1500,
        remarks: 'Valeurs standard - vérifier VAC'
      };
    }
  }
});

// Ajouter les DOM-TOM
const domTom = {
  'TFFF': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Martinique' },
  'TFFR': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Guadeloupe' },
  'TFFA': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Antigua' },
  'TFFJ': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Saint-Barthélemy' },
  'TFFM': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Saint-Martin' },
  'FMEP': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Réunion' },
  'FMEE': { circuitAltitude: 1500, integrationAltitude: 2000, remarks: 'Circuit océanique Réunion' },
  'FMCZ': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Mayotte' },
  'NWWW': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Nouvelle-Calédonie' },
  'NWWK': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Koumac' },
  'NWWE': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Lifou' },
  'NWWL': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Ouvéa' },
  'NWWR': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Maré' },
  'NTAA': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Tahiti' },
  'NTTB': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Bora Bora' },
  'NTMD': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Nuku Hiva' },
  'SOCA': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Guyane' },
  'SOOG': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Grand-Santi' },
  'SOOM': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Maripasoula' },
  'SOOS': { circuitAltitude: 1000, integrationAltitude: 1500, remarks: 'Circuit standard Saül' },
};

Object.assign(circuitAltitudes, domTom);

// Ajouter la valeur par défaut
circuitAltitudes['DEFAULT'] = {
  circuitAltitude: 1000,
  integrationAltitude: 1500,
  remarks: 'Valeurs standard - vérifier VAC'
};

// Générer le fichier JavaScript
const output = `// Altitudes de circuit et d'intégration pour les aérodromes français
// Source: Valeurs standards et particularités connues
// Généré automatiquement le ${new Date().toISOString().split('T')[0]}
// Format: code OACI -> { circuitAltitude: altitude en ft AAL, integrationAltitude: altitude en ft AAL }
// AAL = Above Aerodrome Level (hauteur au-dessus de l'aérodrome)

export const circuitAltitudes = ${JSON.stringify(circuitAltitudes, null, 2)};

// Fonction pour obtenir les altitudes d'un aérodrome
export const getCircuitAltitudes = (icaoCode) => {
  const upperCode = icaoCode?.toUpperCase();
  return circuitAltitudes[upperCode] || circuitAltitudes['DEFAULT'];
};

// Fonction pour obtenir l'altitude en QNH (approximative)
export const getCircuitAltitudeQNH = (icaoCode, elevation) => {
  const altitudes = getCircuitAltitudes(icaoCode);
  if (!elevation) return altitudes;
  
  return {
    ...altitudes,
    circuitAltitudeQNH: altitudes.circuitAltitude ? altitudes.circuitAltitude + elevation : null,
    integrationAltitudeQNH: altitudes.integrationAltitude ? altitudes.integrationAltitude + elevation : null
  };
};

export default circuitAltitudes;
`;

// Écrire le fichier
const outputPath = path.join(__dirname, '../src/data/circuitAltitudesComplete.js');
fs.writeFileSync(outputPath, output, 'utf8');

console.log(`✅ Fichier généré avec ${Object.keys(circuitAltitudes).length} aérodromes`);
console.log(`📁 Sauvegardé dans: ${outputPath}`);

// Afficher quelques statistiques
const stats = {
  total: Object.keys(circuitAltitudes).length - 1, // -1 pour DEFAULT
  special: Object.keys(specialAltitudes).length,
  standard: Object.keys(circuitAltitudes).length - Object.keys(specialAltitudes).length - Object.keys(domTom).length - 1,
  domtom: Object.keys(domTom).length
};

console.log('\n📊 Statistiques:');
console.log(`  - Total: ${stats.total} aérodromes`);
console.log(`  - Altitudes spéciales: ${stats.special}`);
console.log(`  - Valeurs standards: ${stats.standard}`);
console.log(`  - DOM-TOM: ${stats.domtom}`);