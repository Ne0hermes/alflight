// Final comprehensive fix for all remaining broken files
const fs = require('fs');
const path = require('path');

const filesToFix = [
  { file: 'src/shared/components/MobileNavigation.jsx', fixes: [
    { line: 114, pattern: /^(\s*)}}\)$/m, replacement: '$1  })\n$1})}' }
  ]},
  { file: 'src/shared/components/TabNavigation.jsx', fixes: [
    { line: 36, pattern: /^(\s*)}}\)$/m, replacement: '$1  })\n$1})}' }
  ]},
  { file: 'src/shared/components/Notification.jsx', fixes: [
    { line: 147, pattern: /^(\s*)};$/m, replacement: '$1  );\n$1};', context: '</div>\n\n};' }
  ]},
  { file: 'src/components/ALFlightSplashScreen.jsx', fixes: [
    { line: 117, pattern: /^(\s*)<\/div>\n\n(\s*)const styles/m, replacement: '$1</div>\n$1  );\n$1};\n\n$2const styles' }
  ]},
  { file: 'src/components/LandingPage.jsx', fixes: [
    { line: 211, pattern: /^(\s*)}}\)$/m, replacement: '$1  })\n$1})}' }
  ]},
  { file: 'src/features/flight-wizard/FlightPlanWizard.jsx', fixes: [
    { line: 114, pattern: /^(\s*)}\,$/m, replacement: '$1  )\n$1},' }
  ]},
  { file: 'src/features/aircraft/components/AircraftCreationWizard.jsx', fixes: [
    { line: 690, pattern: /^(\s*)const isUpdate/m, replacement: '        )\n          .then(result => {\n          // Message de succès pour soumission communautaire\n          // Déterminer si c\'est une création ou une mise à jour basé sur la version\n$1const isUpdate' }
  ]},
  { file: 'src/features/navigation/components/AirportSelector.jsx', fixes: [
    { line: 58, pattern: /\(airport\.city && airport\.city\.toLowerCase\(\)\.includes\(search\.toLowerCase\(\)\)\)\);$/m, replacement: '(airport.city && airport.city.toLowerCase().includes(search.toLowerCase()))\n    );' }
  ]},
  { file: 'src/features/navigation/NavigationModule.jsx', fixes: [
    { line: 689, pattern: /^(\s*)}}\.filter\(Boolean\)$/m, replacement: '$1    })\n$1  }).filter(Boolean)}' }
  ]},
  { file: 'src/features/navigation/components/RunwayAnalyzer.jsx', fixes: [
    { line: 374, pattern: /^(\s*)}}\)$/m, replacement: '$1  })\n$1})}' }
  ]},
  { file: 'src/features/navigation/components/ReportingPointsSelector.jsx', fixes: [
    { line: 265, pattern: /^(\s*)}}\)$/m, replacement: '$1  })\n$1})}' }
  ]},
  { file: 'src/features/navigation/components/AirspaceAnalyzer.jsx', fixes: [
    { line: 369, pattern: /^(\s*)}\);$/m, replacement: '$1  }\n$1);' }
  ]},
  { file: 'src/features/weight-balance/components/WeightBalanceModule.jsx', fixes: [
    { line: 81, pattern: /^(\s*)}\);$/m, replacement: '$1  )\n$1};' }
  ]},
  { file: 'src/features/weight-balance/components/WeightBalanceTable.jsx', fixes: [
    { line: 220, pattern: /^(\s*)}\);$/m, replacement: '$1  )\n$1};' }
  ]},
  { file: 'src/features/weight-balance/components/WeightBalanceChart.jsx', fixes: [
    { line: 85, pattern: /^(\s*)\.toFixed/m, replacement: '    const cgDisplay = `CG: ${(cgInMM\n$1.toFixed' }
  ]},
  { file: 'src/features/weight-balance/components/ScenarioCards.jsx', fixes: [
    { line: 60, pattern: /^(\s*)}\);$/m, replacement: '$1  )\n$1};' }
  ]},
  { file: 'src/features/weight-balance/components/WeightBalanceInfo.jsx', fixes: [
    { line: 69, pattern: /^(\s*)}\);$/m, replacement: '$1  )\n$1};' }
  ]},
  { file: 'src/features/weight-balance/components/LoadInput.jsx', fixes: [
    { line: 42, pattern: /^(\s*)}$/m, replacement: '$1  }\n$1};' }
  ]},
  { file: 'src/features/fuel/FuelModule.jsx', fixes: [
    { line: 108, pattern: /^(\s*)}\);$/m, replacement: '$1  )\n$1};' }
  ]},
  { file: 'src/features/weather/WeatherModule.jsx', fixes: [
    { line: 81, pattern: /^(\s*)\);$/m, replacement: '$1    }\n$1  );' }
  ]},
  { file: 'src/features/checklist/ChecklistModule.jsx', fixes: [
    { line: 185, pattern: /^(\s*)}}\)$/m, replacement: '$1  })\n$1})}' }
  ]}
];

console.log('🔧 Starting final massive fix...\n');

let filesFixed = 0;
let filesFailed = 0;

for (const { file, fixes } of filesToFix) {
  const filePath = path.join('D:\\Applicator\\alflight', file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    filesFailed++;
    continue;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const fix of fixes) {
      if (fix.pattern.test(content)) {
        content = content.replace(fix.pattern, fix.replacement);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${file}`);
      filesFixed++;
    } else {
      console.log(`⏭️  Skipped (pattern not found): ${file}`);
    }
  } catch (err) {
    console.error(`❌ Error fixing ${file}:`, err.message);
    filesFailed++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files fixed: ${filesFixed}`);
console.log(`   Files failed: ${filesFailed}`);
console.log(`   Total attempted: ${filesToFix.length}`);
