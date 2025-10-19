// Final comprehensive fix for ALL remaining broken files
const fs = require('fs');
const path = require('path');

const basePath = 'D:\\Applicator\\alflight';

const filesToFix = [
  // All remaining files from the error log
  { file: 'src/features/navigation/NavigationModule.jsx', line: 689, find: '            })}', replace: '            })' },
  { file: 'src/features/navigation/components/AirportSelector.jsx', line: 59, find: '    );', replace: '  );' },
  { file: 'src/features/navigation/components/ReportingPointsSelector.jsx', line: 265, find: '            })}', replace: '            })' },
  { file: 'src/features/navigation/components/AirspaceAnalyzer.jsx', line: 370, find: '          }', replace: '        }' },
  { file: 'src/features/navigation/components/RunwayAnalyzer.jsx', line: 374, find: '          })}', replace: '          })' },
  { file: 'src/features/navigation/hooks/useNavigationResults.js', line: 83, find: '  };', replace: '};' },

  // Weight balance components
  { file: 'src/features/weight-balance/components/WeightBalanceModule.jsx', line: 81, find: '});', replace: ');' },
  { file: 'src/features/weight-balance/components/WeightBalanceTable.jsx', line: 220, find: '});', replace: ');' },
  { file: 'src/features/weight-balance/components/ScenarioCards.jsx', line: 60, find: '});', replace: ');' },
  { file: 'src/features/weight-balance/components/WeightBalanceInfo.jsx', line: 69, find: '});', replace: ');' },
  { file: 'src/features/weight-balance/components/LoadInput.jsx', line: 43, find: '    };', replace: '  };' },

  // Other modules
  { file: 'src/features/fuel/FuelModule.jsx', line: 108, find: '});', replace: ');' },
  { file: 'src/features/weather/WeatherModule.jsx', line: 82, find: '            );', replace: '          );' },
  { file: 'src/features/performance/PerformanceModule.jsx', line: 231, find: '};', replace: ');' },
  { file: 'src/features/aircraft/AircraftModule.jsx', line: 67, find: '});', replace: ');' },
  { file: 'src/features/checklist/ChecklistModule.jsx', line: 185, find: '                })}', replace: '                })' },
  { file: 'src/features/pilot/PilotModule.jsx', line: 71, find: '        })}', replace: '        })' },
];

console.log('🔧 Running final comprehensive fix for all remaining files...\\n');

let filesFixed = 0;
let filesFailed = 0;
let filesNotFound = 0;

for (const { file, line, find, replace } of filesToFix) {
  const filePath = path.join(basePath, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    filesNotFound++;
    continue;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\\n');

    // Check if the line exists and contains the pattern
    if (lines[line - 1] && lines[line - 1].includes(find.trim())) {
      lines[line - 1] = lines[line - 1].replace(find, replace + ')\\n' + find);
      content = lines.join('\\n');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${file}:${line}`);
      filesFixed++;
    } else {
      console.log(`⏭️  Pattern not found or already fixed: ${file}:${line}`);
    }
  } catch (err) {
    console.error(`❌ Error fixing ${file}:`, err.message);
    filesFailed++;
  }
}

console.log(`\\n📊 Summary:`);
console.log(`   Files fixed: ${filesFixed}`);
console.log(`   Files not found: ${filesNotFound}`);
console.log(`   Files failed: ${filesFailed}`);
console.log(`   Total attempted: ${filesToFix.length}`);
