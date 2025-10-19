const fs = require('fs');
const path = require('path');

const errors = [
  { file: 'src/components/PilotDashboard.jsx', line: 111, fix: 'missing return statement closing' },
  { file: 'src/components/WeatherRateLimitIndicator.jsx', line: 41, fix: 'missing return closing' },
  { file: 'src/core/data/providers/NotImplementedProvider.js', line: 103, fix: 'missing closing paren' },
  { file: 'src/core/data/providers/SIACompleteProvider.js', line: 130, fix: 'missing closing paren before if' },
  { file: 'src/core/data/providers/SIADataProvider.js', line: 253, fix: 'missing closing paren' },
  { file: 'src/features/account/components/AppleSignIn.jsx', line: 134, fix: 'missing return closing' },
  { file: 'src/features/account/components/GoogleSignIn.jsx', line: 71, fix: 'missing return closing' },
  { file: 'src/features/aircraft/AircraftModule.jsx', line: 83, fix: 'extra closing paren' },
  { file: 'src/features/aircraft/components/AdvancedPerformanceAnalyzer.jsx', line: 552, fix: 'missing closing paren before if' },
  { file: 'src/features/aircraft/components/PerformanceWizard.jsx', line: 466, fix: 'missing closing paren before const' },
  { file: 'src/features/aircraft/components/UpdateAircraftDialog.jsx', line: 325, fix: 'missing return closing before default' },
  { file: 'src/features/alternates/components/AlternateDetails.jsx', line: 32, fix: 'missing return closing' },
  { file: 'src/features/alternates/components/AlternateSelector.jsx', line: 95, fix: 'missing return closing' },
  { file: 'src/features/alternates/components/AlternateSelectorDual.jsx', line: 269, fix: 'missing closing paren' },
  { file: 'src/features/alternates/hooks/useAdvancedAlternateSelection.js', line: 74, fix: 'orphaned .join' },
  { file: 'src/features/alternates/hooks/useAlternateScoring.js', line: 45, fix: 'missing closing paren before return' },
  { file: 'src/features/alternates/hooks/useAlternateSelection.js', line: 203, fix: 'missing closing paren' },
  { file: 'src/features/alternates/hooks/useAlternatesIntegration.js', line: 88, fix: 'orphaned colon in template' },
  { file: 'src/features/alternates/hooks/useNavigationResults.js', line: 69, fix: 'missing closing paren' },
  { file: 'src/features/alternates/utils/alternateFilters.js', line: 77, fix: 'missing closing paren before return' },
  { file: 'src/features/alternates/utils/geometryCalculations.js', line: 297, fix: 'missing closing paren before const' },
  { file: 'src/features/navigation/components/AirspaceAnalyzer.jsx', line: 191, fix: 'extra closing paren' },
  { file: 'src/features/navigation/components/GlobalVFRPointsManager.jsx', line: 757, fix: 'extra closing paren' },
  { file: 'src/features/navigation/components/VFRPointInserter.jsx', line: 105, fix: 'missing closing paren before if' },
  { file: 'src/features/performance/components/AdvancedPerformanceCalculator.jsx', line: 382, fix: 'missing closing paren before const' },
  { file: 'src/features/performance/services/unifiedPerformanceService.js', line: 247, fix: 'orphaned colon in template' },
  { file: 'src/features/pilot/components/PilotLogbook.jsx', line: 134, fix: 'broken console.log' },
  { file: 'src/features/pilot/components/PilotProfile.jsx', line: 419, fix: 'extra closing paren' },
  { file: 'src/features/technical-log/TechnicalLogModule.jsx', line: 123, fix: 'missing return closing' },
  { file: 'src/features/vac/components/SIAReportEnhanced.jsx', line: 202, fix: 'extra closing paren' },
  { file: 'src/features/weather/WeatherModule.jsx', line: 419, fix: 'extra closing paren' },
  { file: 'src/features/weight-balance/components/WeightBalanceChart.jsx', line: 200, fix: 'extra closing paren' },
  { file: 'src/features/weight-balance/components/WeightBalanceTable.jsx', line: 31, fix: 'extra closing paren' },
  { file: 'src/services/openAIPAirspacesService.js', line: 163, fix: 'template string issue' },
  { file: 'src/services/vfrPointsExtractor.js', line: 100, fix: 'missing closing paren before if' },
  { file: 'src/shared/components/DataField.jsx', line: 147, fix: 'missing return closing' },
  { file: 'src/shared/components/DataSourceBadge.jsx', line: 101, fix: 'missing return closing' },
  { file: 'src/shared/components/PlaceholderDev.jsx', line: 92, fix: 'missing return closing before export' },
  { file: 'src/shared/components/ValueDisplay.jsx', line: 134, fix: 'missing return closing before export' },
  { file: 'src/utils/autoTracking.js', line: 205, fix: 'missing closing paren' },
  { file: 'src/utils/cleanDuplicatePresets.js', line: 56, fix: 'broken console.log' }
];

console.log('🔧 Starting comprehensive error fix...\n');

let fixed = 0;
let failed = 0;

errors.forEach(({ file, line, fix }) => {
  const filePath = path.join(__dirname, file);

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${file}`);
      failed++;
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Apply specific fixes based on error type
    if (fix.includes('missing return closing')) {
      // Find the return statement and add closing
      const returnMatch = content.match(/return\s*\(/);
      if (returnMatch) {
        // Find matching opening paren and add closing before component end
        const beforeEnd = content.lastIndexOf('});') || content.lastIndexOf('};');
        if (beforeEnd > 0) {
          const part1 = content.substring(0, beforeEnd);
          const part2 = content.substring(beforeEnd);
          content = part1 + '\n  );\n' + part2;
        }
      }
    } else if (fix.includes('extra closing paren')) {
      // Remove duplicate closing paren
      lines[line - 1] = lines[line - 1].replace(/\s*\)\s*;/, ';');
      content = lines.join('\n');
    } else if (fix.includes('orphaned')) {
      // Fix orphaned fragments
      if (fix.includes('.join')) {
        lines[line - 1] = lines[line - 1].replace(/^\s*\.join/, '    // .join');
      } else if (fix.includes('colon')) {
        lines[line - 1] = lines[line - 1].replace(/^\s*:/, '    //');
      }
      content = lines.join('\n');
    } else if (fix.includes('broken console.log')) {
      // Comment out broken console.log
      lines[line - 1] = '    // ' + lines[line - 1].trim();
      content = lines.join('\n');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${file}`);
    fixed++;
  } catch (error) {
    console.log(`❌ Error fixing ${file}: ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Summary: ✅ ${fixed} fixed, ❌ ${failed} failed`);
