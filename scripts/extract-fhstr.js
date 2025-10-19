const fs = require('fs');

const data = JSON.parse(fs.readFileSync('D:\\log app\\aircraft_F-HSTR_with_performance_FIXED.json', 'utf8'));

console.log(JSON.stringify({
  registration: data.registration,
  model: data.model,
  manufacturer: data.manufacturer,
  id: data.id,
  hasPerformances: !!data.performances,
  hasConfig: !!data.config,
  hasWeightBalance: !!data.weightBalance,
  keys: Object.keys(data)
}, null, 2));
