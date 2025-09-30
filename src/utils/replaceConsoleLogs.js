/**
 * Script pour remplacer console.log par le système de logging conditionnel
 * Ce fichier peut être supprimé après utilisation
 */

// Mapping des remplacements à effectuer
export const consoleReplacements = {
  // Stores
  'src/core/stores/aircraftStore.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('AircraftStore');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/core/stores/weatherStore.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('WeatherStore');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' },
      { from: /console\.error/g, to: 'logger.error' }
    ]
  },
  
  'src/core/stores/navigationStore.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('NavigationStore');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/core/stores/openAIPStore.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('OpenAIPStore');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' },
      { from: /console\.error/g, to: 'logger.error' }
    ]
  },
  
  'src/core/stores/vacStore.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('VACStore');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/core/stores/weightBalanceStore.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('WeightBalanceStore');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  // Services
  'src/services/weatherAPI.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('WeatherAPI');",
    replacements: [
      { from: /console\.log/g, to: 'logger.info' },
      { from: /console\.error/g, to: 'logger.error' },
      { from: /console\.warn/g, to: 'logger.warn' }
    ]
  },
  
  'src/services/openAIPService.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('OpenAIPService');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' },
      { from: /console\.error/g, to: 'logger.error' }
    ]
  },
  
  // Components avec beaucoup de logs
  'src/features/navigation/components/RunwayAnalyzer.jsx': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('RunwayAnalyzer');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' },
      { from: /console\.error/g, to: 'logger.error' }
    ]
  },
  
  'src/features/navigation/components/NavigationMap.jsx': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('NavigationMap');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/features/alternates/AlternatesModule.jsx': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('AlternatesModule');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/features/alternates/utils/geometryCalculations.js': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('GeometryCalc');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/features/fuel/FuelModule.jsx': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('FuelModule');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/features/aircraft/AircraftModule.jsx': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('AircraftModule');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/features/weight-balance/components/WeightBalanceModule.jsx': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('WeightBalance');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  },
  
  'src/core/contexts/index.jsx': {
    imports: "import { createModuleLogger } from '@utils/logger';",
    loggerInit: "const logger = createModuleLogger('Contexts');",
    replacements: [
      { from: /console\.log/g, to: 'logger.debug' }
    ]
  }
};

// Fonction pour obtenir les stats des console.log
export const getConsoleLogStats = () => {
  const stats = {
    totalFiles: Object.keys(consoleReplacements).length,
    totalReplacements: 0,
    byType: {
      'console.log': 0,
      'console.error': 0,
      'console.warn': 0
    }
  };
  
  // Cette fonction serait utilisée avec un script de remplacement réel
  return stats;
};