const fs = require('fs');

const data = JSON.parse(fs.readFileSync('D:\\log app\\aircraft_F-HSTR_with_performance_FIXED.json', 'utf8'));

console.log('=== Structure du fichier F-HSTR ===');
console.log('Top-level keys:', Object.keys(data));
console.log('\naircraftData keys:', data.aircraftData ? Object.keys(data.aircraftData).slice(0, 30) : 'N/A');
console.log('\nRegistration:', data.aircraftData?.registration);
console.log('Model:', data.aircraftData?.model);
console.log('ID:', data.aircraftData?.id);

// Extraire les données complètes de l'avion
if (data.aircraftData) {
  fs.writeFileSync(
    'D:\\Applicator\\alflight\\scripts\\fhstr-aircraft-only.json',
    JSON.stringify(data.aircraftData, null, 2)
  );
  console.log('\n✅ Aircraft data extracted to: scripts/fhstr-aircraft-only.json');
  console.log('Size:', JSON.stringify(data.aircraftData).length, 'bytes');
}
