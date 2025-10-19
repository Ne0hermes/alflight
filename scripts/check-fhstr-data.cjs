const fs = require('fs');

const data = JSON.parse(fs.readFileSync('D:\\log app\\aircraft_F-HSTR_with_performance_FIXED.json', 'utf8'));
const aircraft = data.aircraftData;

console.log('=== Vérification des données F-HSTR ===\n');

// 1. Carburant
console.log('📊 CARBURANT:');
console.log('  - fuelType:', aircraft.fuelType);
console.log('  - fuelCapacity:', aircraft.fuelCapacity);
console.log('  - fuelConsumption:', aircraft.fuelConsumption);
console.log('  - cruiseSpeedKt:', aircraft.cruiseSpeedKt);

// 2. Performances
console.log('\n⚡ PERFORMANCES:');
console.log('  - performances:', aircraft.performances ? 'EXISTS' : 'MISSING');
console.log('  - performanceModels:', aircraft.performanceModels ? 'EXISTS' : 'MISSING');
console.log('  - performanceTables:', aircraft.performanceTables ? 'EXISTS' : 'MISSING');
console.log('  - advancedPerformance:', aircraft.advancedPerformance ? 'EXISTS' : 'MISSING');

if (aircraft.performances) {
  console.log('  - Détails performances:', Object.keys(aircraft.performances));
}

// 3. Photo
console.log('\n📸 PHOTO:');
console.log('  - photo:', aircraft.photo ? `EXISTS (${aircraft.photo.length} chars)` : 'MISSING');

// 4. Surfaces compatibles
console.log('\n🛬 SURFACES COMPATIBLES:');
console.log('  - compatibleRunwaySurfaces:', aircraft.compatibleRunwaySurfaces);

// 5. Section 1 (Basic Info)
console.log('\n📋 SECTION 1 - BASIC INFO:');
console.log('  - registration:', aircraft.registration);
console.log('  - model:', aircraft.model);
console.log('  - manufacturer:', aircraft.manufacturer || 'MISSING');
console.log('  - aircraftType:', aircraft.aircraftType || 'MISSING');
console.log('  - category:', aircraft.category || 'MISSING');

// Résumé complet
console.log('\n✅ RÉSUMÉ:');
const summary = {
  carburant: {
    fuelType: aircraft.fuelType,
    fuelCapacity: aircraft.fuelCapacity,
    fuelConsumption: aircraft.fuelConsumption
  },
  performances: {
    hasPerformances: !!aircraft.performances,
    hasModels: !!aircraft.performanceModels,
    hasTables: !!aircraft.performanceTables
  },
  photo: !!aircraft.photo,
  surfaces: aircraft.compatibleRunwaySurfaces,
  basicInfo: {
    manufacturer: aircraft.manufacturer,
    type: aircraft.aircraftType,
    category: aircraft.category
  }
};

console.log(JSON.stringify(summary, null, 2));

// Écrire un résumé
fs.writeFileSync(
  'D:\\Applicator\\alflight\\scripts\\fhstr-check-result.json',
  JSON.stringify(summary, null, 2)
);
console.log('\n📄 Résumé sauvegardé: scripts/fhstr-check-result.json');
