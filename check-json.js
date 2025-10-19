const fs = require('fs');
const data = JSON.parse(fs.readFileSync('D:/log app/aircraft_F-HSTR_with_performance.json', 'utf8'));

console.log('Top level keys:', Object.keys(data));
console.log('Has aircraftData:', !!data.aircraftData);
console.log('Has performanceModels at root:', !!data.performanceModels);

if (data.aircraftData) {
  console.log('aircraftData has performanceModels:', !!data.aircraftData.performanceModels);
}
