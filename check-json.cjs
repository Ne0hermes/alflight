const fs = require('fs');
const data = JSON.parse(fs.readFileSync('D:/log app/aircraft_F-HSTR_with_performance.json', 'utf8'));

console.log('Top level keys:', Object.keys(data).slice(0, 15));
console.log('Has performanceModels at root:', !!data.performanceModels);
console.log('performanceModels length:', data.performanceModels?.length);
