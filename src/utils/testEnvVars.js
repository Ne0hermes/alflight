// Test pour vérifier les variables d'environnement





export default function testEnvVars() {
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  const endpoint = import.meta.env.VITE_AI_API_ENDPOINT;
  return {
    hasKey: !!envKey,
    hasEndpoint: !!endpoint,
    keyPreview: envKey ? `${envKey.substring(0, 20)}...` : null
  };
}