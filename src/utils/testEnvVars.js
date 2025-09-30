// Test pour vérifier les variables d'environnement
console.log('🔍 === TEST VARIABLES ENVIRONNEMENT ===');
console.log('import.meta.env:', import.meta.env);
console.log('VITE_OPENAI_API_KEY:', import.meta.env.VITE_OPENAI_API_KEY);
console.log('VITE_AI_API_ENDPOINT:', import.meta.env.VITE_AI_API_ENDPOINT);

export default function testEnvVars() {
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  const endpoint = import.meta.env.VITE_AI_API_ENDPOINT;

  console.log('🧪 Test direct des variables:');
  console.log('  - Clé API:', envKey ? `${envKey.substring(0, 20)}...` : 'NON TROUVÉE');
  console.log('  - Endpoint:', endpoint || 'NON TROUVÉ');

  return {
    hasKey: !!envKey,
    hasEndpoint: !!endpoint,
    keyPreview: envKey ? `${envKey.substring(0, 20)}...` : null
  };
}