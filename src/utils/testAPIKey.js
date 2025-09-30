// Script de test pour vérifier la configuration de la clé API

export function testAPIKeyConfiguration() {
  console.log('🔍 Test de configuration de la clé API...');
  
  // Test 1: Variables d'environnement
  const envKey = import.meta?.env?.VITE_OPENAI_API_KEY;
  console.log('1. Variable d\'environnement VITE_OPENAI_API_KEY:', envKey ? `✅ Trouvée (${envKey.substring(0, 10)}...)` : '❌ Non trouvée');
  
  // Test 2: LocalStorage
  const localKey = localStorage.getItem('alflight_ai_api_key');
  const localKeyAlt = localStorage.getItem('openai_api_key');
  console.log('2. LocalStorage alflight_ai_api_key:', localKey ? `✅ Trouvée (${localKey.substring(0, 10)}...)` : '❌ Non trouvée');
  console.log('3. LocalStorage openai_api_key:', localKeyAlt ? `✅ Trouvée (${localKeyAlt.substring(0, 10)}...)` : '❌ Non trouvée');
  
  // Test 3: apiKeyManager
  import('../utils/apiKeyManager').then(module => {
    const apiKeyManager = module.default;
    const managerKey = apiKeyManager.getAPIKey();
    console.log('4. apiKeyManager.getAPIKey():', managerKey ? `✅ Trouvée (${managerKey.substring(0, 10)}...)` : '❌ Non trouvée');
    console.log('5. apiKeyManager.hasAPIKey():', apiKeyManager.hasAPIKey() ? '✅ Oui' : '❌ Non');
  });
  
  // Test 4: unifiedPerformanceService
  import('../features/performance/services/unifiedPerformanceService').then(module => {
    const service = module.default;
    service.initialize();
    const serviceKey = service.apiKey;
    console.log('6. unifiedPerformanceService.apiKey:', serviceKey ? `✅ Trouvée (${serviceKey.substring(0, 10)}...)` : '❌ Non trouvée');
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
    console.log('==========================================');
    const result = testAPIKeyConfiguration();
    console.log('==========================================');
    console.log('Résumé:', result.total ? '✅ Clé API disponible' : '❌ Aucune clé API trouvée');
    console.log('==========================================');
  }, 1000);
}