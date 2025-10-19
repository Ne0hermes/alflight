#!/usr/bin/env node
/**
 * Automated repair script for console.log cleanup damage
 * Fixes missing closing parentheses before closing braces
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting automated syntax repair...\n');

// List of all files needing repair based on build errors
const filesToFix = [
  // JSX Component files - need ); before closing
  'src/features/aircraft/components/AircraftCreationWizard.jsx',
  'src/features/navigation/components/AirportSelector.jsx',
  'src/features/navigation/components/ReportingPointsSelector.jsx',
  'src/features/navigation/components/AirspaceAnalyzer.jsx',
  'src/features/weight-balance/components/WeightBalanceModule.jsx',
  'src/features/weight-balance/components/WeightBalanceTable.jsx',
  'src/features/weight-balance/components/WeightBalanceChart.jsx',
  'src/features/weight-balance/components/ScenarioCards.jsx',
  'src/features/weight-balance/components/LoadInput.jsx',
  'src/features/weight-balance/components/WeightBalanceInfo.jsx',
  'src/features/fuel/FuelModule.jsx',
  'src/features/weather/WeatherModule.jsx',
  'src/features/checklist/ChecklistModule.jsx',
  'src/features/vac/VACModule.jsx',
  'src/features/vac/components/SIAReport.jsx',
  'src/features/vac/components/SIAReportEnhanced.jsx',
  'src/features/aircraft/AircraftModule.jsx',
  'src/features/regulations/components/RegulationsModule.jsx',
  'src/features/pilot/components/PilotProfile.jsx',
  'src/features/account/components/AccountPanel.jsx',
  'src/components/PilotDashboard.jsx',
  'src/components/ALFlightSplashScreen.jsx',
  'src/components/LandingPage.jsx',
  'src/components/IndexedDBChecker.jsx',
  'src/shared/components/AccordionButton.jsx',
  'src/shared/components/MobileNavigation.jsx',
  'src/shared/components/TabNavigation.jsx',
  'src/shared/components/ErrorBoundary.jsx',
  'src/shared/components/Notification.jsx',
  'src/core/contexts/index.jsx',
];

let fixedCount = 0;
let errorCount = 0;
let skippedCount = 0;

/**
 * Fix a React component file with missing closing parenthesis
 */
function fixComponentFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    skippedCount++;
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Pattern 1: }); at end of memo/export with missing ) before it
    // Look for patterns like:  </div>\n});  and add ); before });
    const pattern1 = /(\s*<\/[^>]+>\s*\n)(\s*}\);)/g;
    if (content.match(pattern1)) {
      content = content.replace(pattern1, (match, p1, p2) => {
        // Check if there's already a ); before });
        const before = content.substring(Math.max(0, content.indexOf(match) - 10), content.indexOf(match));
        if (!before.includes(');')) {
          modified = true;
          return p1 + '  );\n' + p2;
        }
        return match;
      });
    }

    // Pattern 2: } at end of regular function with missing );
    // Look for: </Container>\n} right before export default
    const pattern2 = /(\s*<\/[^>]+>\s*\n)(}\s*\nexport\s+default)/g;
    if (content.match(pattern2)) {
      content = content.replace(pattern2, '$1  );\n$2');
      modified = true;
    }

    // Pattern 3: Missing ); before const at same level
    // Look for: }\n  const where it should be );\n  const
    const pattern3 = /(\s*})\s*\n(\s{2,4}const\s+)/g;
    if (content.match(pattern3)) {
      const matches = [...content.matchAll(pattern3)];
      for (const match of matches) {
        // Check context to ensure this is a legitimate case
        const idx = match.index;
        const before = content.substring(Math.max(0, idx - 100), idx);
        // Only fix if we see signs of a component return (JSX ending)
        if (before.includes('</') || before.includes('/>')) {
          content = content.substring(0, idx) + match[1] + ');\n' + match[2] + content.substring(idx + match[0].length);
          modified = true;
          break; // Only fix first occurrence to avoid cascading errors
        }
      }
    }

    // Pattern 4: Missing ); before if statement
    const pattern4 = /(\s*})\s*\n(\s{2,4}if\s*\()/g;
    if (content.match(pattern4)) {
      content = content.replace(pattern4, (match, p1, p2) => {
        return p1 + ');\n' + p2;
      });
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      fixedCount++;
      return true;
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
      skippedCount++;
      return false;
    }
  } catch (error) {
    console.log(`❌ Error fixing ${filePath}: ${error.message}`);
    errorCount++;
    return false;
  }
}

// Process all files
console.log(`Processing ${filesToFix.length} files...\n`);

for (const file of filesToFix) {
  const fullPath = path.join(__dirname, file);
  fixComponentFile(fullPath);
}

console.log('\n📊 Repair Summary:');
console.log(`   ✅ Fixed: ${fixedCount} files`);
console.log(`   ℹ️  Skipped (no changes): ${skippedCount} files`);
console.log(`   ❌ Errors: ${errorCount} files`);
console.log(`\n✨ Automated repair complete!`);

if (fixedCount > 0) {
  console.log('\n🔍 Next steps:');
  console.log('   1. Clear Vite cache: rm -rf node_modules/.vite');
  console.log('   2. Restart dev server');
  console.log('   3. Check for any remaining errors\n');
}

process.exit(errorCount > 0 ? 1 : 0);
