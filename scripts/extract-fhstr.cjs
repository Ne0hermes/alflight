const fs = require('fs');

const data = JSON.parse(fs.readFileSync('D:\\log app\\aircraft_F-HSTR_with_performance_FIXED.json', 'utf8'));

console.log('=== F-HSTR Aircraft Data ===');
console.log(JSON.stringify({
  registration: data.registration,
  model: data.model,
  manufacturer: data.manufacturer,
  id: data.id,
  fuelType: data.fuelType,
  cruiseSpeed: data.cruiseSpeed,
  hasPerformances: !!data.performances,
  hasConfig: !!data.config,
  hasWeightBalance: !!data.weightBalance,
  totalKeys: Object.keys(data).length,
  keys: Object.keys(data)
}, null, 2));

// Write to a smaller file for inspection
const smallData = {
  ...data,
  // Limiter les tableaux volumineux si présents
  performances: data.performances ? 'EXISTS' : null,
  config: data.config ? 'EXISTS' : null
};

fs.writeFileSync('D:\\Applicator\\alflight\\scripts\\fhstr-summary.json', JSON.stringify(data, null, 2));
console.log('\n✅ Full data written to: scripts/fhstr-summary.json');
