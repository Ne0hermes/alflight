// src/shared/debugModules.js

export const debugModuleLoading = async () => {
  console.log('🔍 Starting module debug...');
  
  const modules = [
    { name: 'Navigation', path: '@features/navigation' },
    { name: 'Aircraft', path: '@features/aircraft' },
    { name: 'Fuel', path: '@features/fuel' },
    { name: 'Weight Balance', path: '@features/weight-balance' },
    { name: 'Weather', path: '@features/weather' },
    { name: 'Performance', path: '@features/performance' },
    { name: 'VAC', path: '@features/vac' },
    { name: 'Alternates', path: '@features/alternates' }
  ];
  
  const results = [];
  
  for (const module of modules) {
    try {
      console.log(`📦 Testing ${module.name}...`);
      const imported = await import(module.path);
      
      results.push({
        name: module.name,
        path: module.path,
        status: '✅ Success',
        hasDefault: !!imported.default,
        exports: Object.keys(imported)
      });
      
      console.log(`✅ ${module.name} loaded successfully`);
      console.log(`   - Has default export: ${!!imported.default}`);
      console.log(`   - Exports: ${Object.keys(imported).join(', ')}`);
      
    } catch (error) {
      results.push({
        name: module.name,
        path: module.path,
        status: '❌ Failed',
        error: error.message
      });
      
      console.error(`❌ ${module.name} failed to load:`, error.message);
    }
  }
  
  console.table(results);
  return results;
};