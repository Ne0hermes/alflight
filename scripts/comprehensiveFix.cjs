// Comprehensive fix for all remaining syntax errors
const fs = require('fs');
const path = require('path');

const filesToFix = [
  // JSX files with specific patterns
  {
    path: 'src/features/fuel/FuelModule.jsx',
    fixes: [
      {
        find: "      // Remettre à zéro si aucun alternate sélectionné\n      ');\n      setFuelData",
        replace: "      // Remettre à zéro si aucun alternate sélectionné\n      setFuelData"
      }
    ]
  },
  {
    path: 'src/components/IndexedDBChecker.jsx',
    fixes: [
      {
        find: "      </p>\n      </div>\n  }\n\n  // Affichage en cas d'erreur",
        replace: "      </p>\n      </div>\n    );\n  }\n\n  // Affichage en cas d'erreur"
      }
    ]
  },
  {
    path: 'src/features/flight-wizard/FlightPlanWizard.jsx',
    fixes: [
      {
        find: "        flightPlan.generalInfo.callsign &&\n        flightPlan.generalInfo.date\n    },\n    {",
        replace: "        flightPlan.generalInfo.callsign &&\n        flightPlan.generalInfo.date\n    }),\n    {",
      }
    ]
  },
  {
    path: 'src/features/navigation/components/AirportSelector.jsx',
    fixes: [
      {
        find: "     (airport.city && airport.city.toLowerCase().includes(search.toLowerCase())));\n   \n  const handleSelect",
        replace: "     (airport.city && airport.city.toLowerCase().includes(search.toLowerCase())));\n\n  const handleSelect"
      }
    ]
  },
  {
    path: 'src/features/navigation/components/RunwayAnalyzer.jsx',
    fixes: [
      {
        find: "  )\n);\n\nexport default RunwayAnalyzer;",
        replace: "    )\n  );\n};\n\nexport default RunwayAnalyzer;"
      }
    ]
  },
  {
    path: 'src/features/navigation/components/AirspaceAnalyzer.jsx',
    fixes: [
      {
        find: "        airspaces\n      \n            segmentAirspaces.forEach",
        replace: "        airspaces\n      });\n\n      segmentAirspaces.forEach"
      }
    ]
  },
  {
    path: 'src/features/weather/WeatherModule.jsx',
    fixes: [
      {
        find: "              elevation: apt.elevation,\n              runways: apt.runways || []\n            }));\n          \n          setSuggestions",
        replace: "              elevation: apt.elevation,\n              runways: apt.runways || []\n            })\n          );\n          \n          setSuggestions"
      }
    ]
  },
  {
    path: 'src/features/weight-balance/components/WeightBalanceModule.jsx',
    fixes: [
      {
        find: "    </div>\n// Styles statiques\nconst styles = {",
        replace: "    </div>\n  );\n};\n\n// Styles statiques\nconst styles = {"
      }
    ]
  },
  {
    path: 'src/features/weight-balance/components/WeightBalanceTable.jsx',
    fixes: [
      {
        find: "  </div>\n\n// Info formule mémorisée\nconst FormulaInfo",
        replace: "  </div>\n    );\n};\n\n// Info formule mémorisée\nconst FormulaInfo"
      }
    ]
  },
  {
    path: 'src/features/weight-balance/components/WeightBalanceChart.jsx',
    fixes: [
      {
        find: "      </p>\n      </div>\n  }\n\n  // Utiliser UNIQUEMENT",
        replace: "      </p>\n      </div>\n    );\n  }\n\n  // Utiliser UNIQUEMENT"
      }
    ]
  },
  {
    path: 'src/features/weight-balance/components/LoadInput.jsx',
    fixes: [
      {
        find: "    }\n\n  const handleChange = (e) => {",
        replace: "    }\n  }\n\n  const handleChange = (e) => {"
      }
    ]
  },
  {
    path: 'src/features/vac/VACModule.jsx',
    fixes: [
      {
        find: "            extractionConfidence = pdfResult.confidence || 0;\n            \n                        }%`);\n                        \n                      } else {",
        replace: "            extractionConfidence = pdfResult.confidence || 0;\n            \n                      } else {"
      }
    ]
  },
  {
    path: 'src/features/vac/components/SIAReport.jsx',
    fixes: [
      {
        find: "  </div>\n\n  // Styles\n  const styles = {",
        replace: "  </div>\n    );\n};\n\n  // Styles\n  const styles = {"
      }
    ]
  },
  {
    path: 'src/features/checklist/ChecklistModule.jsx',
    fixes: [
      {
        find: "      section.items.some(item => item.text.trim())\n    \n    if (validSections.length === 0) {",
        replace: "      section.items.some(item => item.text.trim())\n    );\n    \n    if (validSections.length === 0) {"
      }
    ]
  },
  {
    path: 'src/components/ALFlightSplashScreen.jsx',
    fixes: [
      {
        find: "  `;\n  document.head.appendChild(style);\n}",
        replace: "  `;\n  document.head.appendChild(style);\n}\n"
      }
    ]
  }
];

let totalFixed = 0;
let totalFiles = 0;

for (const fileInfo of filesToFix) {
  const filePath = path.join('D:\\Applicator\\alflight', fileInfo.path);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${fileInfo.path}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let fileModified = false;

  for (const fix of fileInfo.fixes) {
    if (content.includes(fix.find)) {
      content = content.replace(fix.find, fix.replace);
      fileModified = true;
      totalFixed++;
    }
  }

  if (fileModified) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFiles++;
    console.log(`✅ Fixed: ${fileInfo.path}`);
  }
}

console.log(`\n✨ Complete! Fixed ${totalFixed} patterns in ${totalFiles} files`);
