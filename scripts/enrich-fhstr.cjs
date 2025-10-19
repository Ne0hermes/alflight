const fs = require('fs');

const data = JSON.parse(fs.readFileSync('D:\\log app\\aircraft_F-HSTR_with_performance_FIXED.json', 'utf8'));
const aircraft = data.aircraftData;

console.log('🔧 Enrichissement des données F-HSTR...\n');

// Données à ajouter pour la Section 1
const enrichedAircraft = {
  ...aircraft,

  // Section 1 - Basic Info
  manufacturer: 'Diamond Aircraft',
  aircraftType: 'Airplane',
  category: 'SEP',  // Single Engine Piston / Single Engine Turboprop pour JET-A1

  // Performances manquantes (si pas déjà présentes)
  performances: aircraft.performances || {
    takeoffDistance: 385,
    landingDistance: 630,
    climbRate: 1100,
    serviceceiling: 16400,
    range: 750,
    endurance: 6.2
  }
};

console.log('✅ Données enrichies:');
console.log('  - manufacturer:', enrichedAircraft.manufacturer);
console.log('  - aircraftType:', enrichedAircraft.aircraftType);
console.log('  - category:', enrichedAircraft.category);
console.log('  - fuelType:', enrichedAircraft.fuelType);
console.log('  - fuelCapacity:', enrichedAircraft.fuelCapacity);
console.log('  - fuelConsumption:', enrichedAircraft.fuelConsumption);
console.log('  - photo:', enrichedAircraft.photo ? 'EXISTS' : 'MISSING');
console.log('  - surfaces:', enrichedAircraft.compatibleRunwaySurfaces);
console.log('  - performances:', enrichedAircraft.performances ? 'EXISTS' : 'MISSING');

// Sauvegarder
const enrichedData = {
  ...data,
  aircraftData: enrichedAircraft
};

fs.writeFileSync(
  'D:\\log app\\aircraft_F-HSTR_ENRICHED.json',
  JSON.stringify(enrichedData, null, 2)
);

console.log('\n📄 Fichier enrichi sauvegardé: D:\\log app\\aircraft_F-HSTR_ENRICHED.json');
console.log('📦 Taille:', JSON.stringify(enrichedAircraft).length, 'bytes');

// Résumé pour vérification
const summary = {
  registration: enrichedAircraft.registration,
  model: enrichedAircraft.model,
  manufacturer: enrichedAircraft.manufacturer,
  type: enrichedAircraft.aircraftType,
  category: enrichedAircraft.category,
  fuel: {
    type: enrichedAircraft.fuelType,
    capacity: enrichedAircraft.fuelCapacity,
    consumption: enrichedAircraft.fuelConsumption
  },
  hasPhoto: !!enrichedAircraft.photo,
  surfaces: enrichedAircraft.compatibleRunwaySurfaces,
  hasPerformances: !!enrichedAircraft.performances,
  hasWeights: !!enrichedAircraft.weights,
  hasCG: !!enrichedAircraft.cgLimits
};

console.log('\n✅ RÉSUMÉ FINAL:');
console.log(JSON.stringify(summary, null, 2));
