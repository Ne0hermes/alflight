// Intelligent batch fix for remaining broken files
// Based on patterns identified from manual fixes
const fs = require('fs');
const path = require('path');

const fixes = [
  // Pattern 1: Map functions missing closing paren before })}
  {
    files: [
      'src/components/LandingPage.jsx',
      'src/features/navigation/NavigationModule.jsx',
      'src/features/navigation/components/RunwayAnalyzer.jsx',
      'src/features/navigation/components/ReportingPointsSelector.jsx',
      'src/features/checklist/ChecklistModule.jsx'
    ],
    pattern: /(\s+)(<\/\w+>)\n(\s+)}}\)/gm,
    replacement: '$1$2\n$1  );\n$3})}'
  },

  // Pattern 2: Component return statements missing closing );
  {
    files: [
      'src/components/ALFlightSplashScreen.jsx',
      'src/features/weight-balance/components/WeightBalanceModule.jsx',
      'src/features/weight-balance/components/WeightBalanceTable.jsx',
      'src/features/weight-balance/components/ScenarioCards.jsx',
      'src/features/weight-balance/components/WeightBalanceInfo.jsx',
      'src/features/fuel/FuelModule.jsx'
    ],
    pattern: /(\s+)(<\/\w+>)\n\n(\s+)}\);/gm,
    replacement: '$1$2\n$1);\n$3};'
  },

  // Pattern 3: Filter/map with }); missing closing paren
  {
    files: ['src/features/flight-wizard/FlightPlanWizard.jsx'],
    pattern: /(\s+)flightPlan\.route\.arrival\.icao\n(\s+)},/gm,
    replacement: '$1flightPlan.route.arrival.icao\n$1  )\n$2},'
  },

  // Pattern 4: Missing closing paren in filter expressions
  {
    files: ['src/features/navigation/components/AirportSelector.jsx'],
    pattern: /\(airport\.city && airport\.city\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\)\)\);/gm,
    replacement: '(airport.city && airport.city.toLowerCase().includes(search.toLowerCase()))\n    );'
  },

  // Pattern 5: Weather module specific pattern
  {
    files: ['src/features/weather/WeatherModule.jsx'],
    pattern: /(\s+)runways: apt\.runways \|\| \[\]\n(\s+)}\)\n(\s+)\);/gm,
    replacement: '$1runways: apt.runways || []\n$1  }\n$2);\n          '
  },

  // Pattern 6: Airspace analyzer specific
  {
    files: ['src/features/navigation/components/AirspaceAnalyzer.jsx'],
    pattern: /(\s+)airspaces\n(\s+)}\);/gm,
    replacement: '$1airspaces\n$1  }\n$2);'
  },

  // Pattern 7: LoadInput component
  {
    files: ['src/features/weight-balance/components/LoadInput.jsx'],
    pattern: /(\s+)backgroundColor: sx\.theme\.colors\.primary\[50\]\n(\s+)}\n(\s+)}/gm,
    replacement: '$1backgroundColor: sx.theme.colors.primary[50]\n$1  }\n$2};\n  '
  }
];

console.log('🔧 Running intelligent batch fix...\n');

let filesFixed = 0;
let filesFailed = 0;
let filesSkipped = 0;

const basePath = 'D:\\Applicator\\alflight';

for (const fix of fixes) {
  for (const file of fix.files) {
    const filePath = path.join(basePath, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Not found: ${file}`);
      filesFailed++;
      continue;
    }

    try {
      let content = fs.readFileSync(filePath, 'utf8');

      if (fix.pattern.test(content)) {
        content = content.replace(fix.pattern, fix.replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${file}`);
        filesFixed++;
      } else {
        console.log(`⏭️  Pattern not found: ${file}`);
        filesSkipped++;
      }
    } catch (err) {
      console.error(`❌ Error fixing ${file}:`, err.message);
      filesFailed++;
    }
  }
}

console.log(`\n📊 Results:`);
console.log(`   Files fixed: ${filesFixed}`);
console.log(`   Files skipped: ${filesSkipped}`);
console.log(`   Files failed: ${filesFailed}`);
