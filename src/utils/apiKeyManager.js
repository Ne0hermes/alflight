// Gestionnaire centralisé des clés API
// Synchronise les variables d'environnement avec localStorage
//
// Supporte 2 providers :
//   - OpenAI (legacy) : VITE_OPENAI_API_KEY → alflight_ai_api_key / openai_api_key
//   - Anthropic (Claude) : VITE_ANTHROPIC_API_KEY → alflight_anthropic_api_key
//
// Le provider par défaut pour l'analyse de tableaux est ANTHROPIC (Claude
// est globalement meilleur sur les tableaux numériques structurés). Le
// pilote peut basculer via APIConfiguration.

class APIKeyManager {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    // ── OpenAI ──
    try {
      const envKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (envKey) {
        localStorage.setItem('alflight_ai_api_key', envKey);
        localStorage.setItem('openai_api_key', envKey); // compat
        const endpoint = import.meta.env.VITE_AI_API_ENDPOINT;
        if (endpoint) localStorage.setItem('alflight_ai_endpoint', endpoint);
      }
    } catch (e) { /* env not available */ }

    // ── Anthropic (Claude) ──
    try {
      const anthropicEnvKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (anthropicEnvKey) {
        localStorage.setItem('alflight_anthropic_api_key', anthropicEnvKey);
      }
    } catch (e) { /* env not available */ }

    this.initialized = true;
  }

  // ── OpenAI ──

  getAPIKey() {
    this.initialize();
    const storedKey = localStorage.getItem('alflight_ai_api_key') ||
                     localStorage.getItem('openai_api_key');
    if (storedKey) return storedKey;
    try { return import.meta.env.VITE_OPENAI_API_KEY || null; }
    catch (e) { return null; }
  }

  getEndpoint() {
    const storedEndpoint = localStorage.getItem('alflight_ai_endpoint');
    if (storedEndpoint) return storedEndpoint;
    try { return import.meta.env.VITE_AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions'; }
    catch (e) { return 'https://api.openai.com/v1/chat/completions'; }
  }

  setAPIKey(key) {
    if (key) {
      localStorage.setItem('alflight_ai_api_key', key);
      localStorage.setItem('openai_api_key', key);
      return true;
    }
    return false;
  }

  hasAPIKey() {
    this.initialize();
    return !!this.getAPIKey();
  }

  // ── Anthropic (Claude) ──

  getAnthropicAPIKey() {
    this.initialize();
    const storedKey = localStorage.getItem('alflight_anthropic_api_key');
    if (storedKey) return storedKey;
    try { return import.meta.env.VITE_ANTHROPIC_API_KEY || null; }
    catch (e) { return null; }
  }

  setAnthropicAPIKey(key) {
    if (key) {
      localStorage.setItem('alflight_anthropic_api_key', key);
      return true;
    }
    return false;
  }

  hasAnthropicAPIKey() {
    this.initialize();
    return !!this.getAnthropicAPIKey();
  }

  // ── Provider courant (pour l'analyse de tableaux) ──
  // 'anthropic' (défaut, Claude) | 'openai' (legacy GPT-4o)

  getActiveProvider() {
    this.initialize();
    const stored = localStorage.getItem('alflight_ai_provider');
    // Défaut : anthropic SI une clé Anthropic est disponible, sinon openai
    if (stored === 'anthropic' || stored === 'openai') return stored;
    return this.hasAnthropicAPIKey() ? 'anthropic' : 'openai';
  }

  setActiveProvider(provider) {
    if (provider === 'anthropic' || provider === 'openai') {
      localStorage.setItem('alflight_ai_provider', provider);
      return true;
    }
    return false;
  }

  // ── Cleanup ──

  clearAPIKeys() {
    localStorage.removeItem('alflight_ai_api_key');
    localStorage.removeItem('openai_api_key');
    localStorage.removeItem('alflight_ai_endpoint');
    localStorage.removeItem('alflight_anthropic_api_key');
    localStorage.removeItem('alflight_ai_provider');
  }
}

const apiKeyManager = new APIKeyManager();

try {
  apiKeyManager.initialize();
} catch (e) {
  console.error('❌ Erreur lors de l\'initialisation automatique:', e);
}

export default apiKeyManager;
