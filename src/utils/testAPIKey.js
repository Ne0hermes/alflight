// Script de test pour vérifier la configuration de la clé API

export function testAPIKeyConfiguration() {
  
  
  // Test 1: Variables d'environnement
  const envKey = import.meta?.env?.VITE_OPENAI_API_KEY;
  // Test 2: LocalStorage
  const localKey = localStorage.getItem('alflight_ai_api_key');
  const localKeyAlt = localStorage.getItem('openai_api_key');
  // Test 3: apiKeyManager
  import('../utils/apiKeyManager').then(module => {
    const apiKeyManager = module.default;
    const managerKey = apiKeyManager.getAPIKey();

    console.log('Has API Key:', apiKeyManager.hasAPIKey() ? '✅ Oui' : '❌ Non');
  });
  
  // Test 4: unifiedPerformanceService
  import('../features/performance/services/unifiedPerformanceService').then(module => {
    const service = module.default;
    service.initialize();
    const serviceKey = service.apiKey;
  });
  
  return {
    envKey: !!envKey,
    localKey: !!localKey || !!localKeyAlt,
    total: envKey || localKey || localKeyAlt
  };
}

// Exécuter automatiquement au chargement si on est en développement
if (import.meta.env.DEV) {
  setTimeout(() => {
    
    const result = testAPIKeyConfiguration();
    
    
    
  }, 1000);
}