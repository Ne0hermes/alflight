// Script to verify which files still have syntax errors
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'src/shared/components/Notification.jsx',
  'src/components/IndexedDBChecker.jsx',
  'src/features/aircraft/components/AircraftCreationWizard.jsx',
  'src/features/fuel/FuelModule.jsx',
  'src/features/flight-wizard/FlightPlanWizard.jsx',
  'src/features/navigation/NavigationModule.jsx',
  'src/features/navigation/components/AirportSelector.jsx',
  'src/features/navigation/components/RunwayAnalyzer.jsx',
  'src/features/navigation/components/AirspaceAnalyzer.jsx',
  'src/features/weather/WeatherModule.jsx',
  'src/features/weight-balance/components/WeightBalanceModule.jsx',
  'src/features/weight-balance/components/WeightBalanceTable.jsx',
  'src/features/weight-balance/components/WeightBalanceChart.jsx',
  'src/features/weight-balance/components/LoadInput.jsx',
  'src/features/vac/VACModule.jsx',
  'src/features/vac/components/SIAReport.jsx',
  'src/features/checklist/ChecklistModule.jsx',
  'src/components/ALFlightSplashScreen.jsx',
  'src/features/account/stores/authStore.js',
  'src/core/stores/weatherStore.js',
  'src/core/stores/aircraftStore.js',
  'src/core/stores/manexStore.js',
  'src/utils/dataBackupManager.js'
];

// Common error patterns to check for
const errorPatterns = [
  { name: 'Orphaned closing', pattern: /^\s*['"`]?\);?\s*$/m },
  { name: 'Export inside function', pattern: /^  export (const|function|default)/m },
  { name: 'Orphaned console fragment', pattern: /^\s*['"]?:['"]?\s*,\s*\w+\s*\);?\s*$/m },
  { name: 'Missing return closing', pattern: /<\/[A-Za-z][A-Za-z0-9-]*>\s*\n\s*\}[;\s]*\n\s*(const|\/\/|export)/m },
  { name: 'Incomplete closing paren', pattern: /\}\s*\n\s*\n(export|const [A-Z])/m }
];

let filesWithIssues = [];
let totalIssues = 0;

console.log('🔍 Checking files for remaining syntax issues...\n');

for (const file of filesToCheck) {
  const filePath = path.join('D:\\Applicator\\alflight', file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fileIssues = [];

  for (const { name, pattern } of errorPatterns) {
    if (pattern.test(content)) {
      fileIssues.push(name);
    }
  }

  if (fileIssues.length > 0) {
    filesWithIssues.push({ file, issues: fileIssues });
    totalIssues += fileIssues.length;
    console.log(`❌ ${file}`);
    fileIssues.forEach(issue => console.log(`   - ${issue}`));
  } else {
    console.log(`✅ ${file}`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Total files checked: ${filesToCheck.length}`);
console.log(`   Files with issues: ${filesWithIssues.length}`);
console.log(`   Files clean: ${filesToCheck.length - filesWithIssues.length}`);
console.log(`   Total issues found: ${totalIssues}`);

if (filesWithIssues.length > 0) {
  console.log(`\n🔧 Files that still need manual fixing:`);
  filesWithIssues.forEach(({ file }) => console.log(`   - ${file}`));
}
