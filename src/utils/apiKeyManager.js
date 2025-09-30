// Gestionnaire centralisé des clés API
// Synchronise les variables d'environnement avec localStorage

class APIKeyManager {
  constructor() {
    this.initialized = false;
  }

  // Initialiser et synchroniser les clés API
  initialize() {
    if (this.initialized) return;

    console.log('🔑 Initialisation du gestionnaire de clés API...');

    // Récupérer la clé depuis les variables d'environnement de manière sûre
    try {
      const envKey = import.meta.env.VITE_OPENAI_API_KEY;

      console.log('🔍 Vérification de la clé dans l\'environnement:', envKey ? `Trouvée (${envKey.substring(0, 20)}...)` : 'Non trouvée');
      console.log('🔍 Variables d\'environnement disponibles:', Object.keys(import.meta.env || {}));

      if (envKey) {
        console.log('✅ Clé API trouvée dans les variables d\'environnement');

        // Stocker dans localStorage pour un accès unifié
        localStorage.setItem('alflight_ai_api_key', envKey);
        localStorage.setItem('openai_api_key', envKey); // Compatibilité

        // Stocker aussi l'endpoint si disponible
        const endpoint = import.meta.env.VITE_AI_API_ENDPOINT;
        if (endpoint) {
          localStorage.setItem('alflight_ai_endpoint', endpoint);
        }

        this.initialized = true;
        return true;
      }
    } catch (e) {
      console.log('⚠️ Erreur lors de l\'accès aux variables d\'environnement:', e.message);
    }
    
    // Vérifier si une clé existe déjà dans localStorage
    const storedKey = localStorage.getItem('alflight_ai_api_key') || 
                     localStorage.getItem('openai_api_key');
    
    if (storedKey) {
      console.log('✅ Clé API trouvée dans localStorage');
      this.initialized = true;
      return true;
    }
    
    console.warn('⚠️ Aucune clé API configurée');
    this.initialized = true;
    return false;
  }

  // Obtenir la clé API
  getAPIKey() {
    this.initialize();
    
    // D'abord essayer localStorage
    const storedKey = localStorage.getItem('alflight_ai_api_key') || 
                     localStorage.getItem('openai_api_key');
    
    if (storedKey) return storedKey;
    
    // Ensuite essayer les variables d'environnement si disponibles
    try {
      return import.meta.env.VITE_OPENAI_API_KEY || null;
    } catch (e) {
      console.warn('Variables d\'environnement non disponibles');
      return null;
    }
  }

  // Obtenir l'endpoint
  getEndpoint() {
    const storedEndpoint = localStorage.getItem('alflight_ai_endpoint');
    if (storedEndpoint) return storedEndpoint;
    
    try {
      return import.meta.env.VITE_AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    } catch (e) {
      return 'https://api.openai.com/v1/chat/completions';
    }
  }

  // Définir une nouvelle clé API
  setAPIKey(key) {
    if (key) {
      localStorage.setItem('alflight_ai_api_key', key);
      localStorage.setItem('openai_api_key', key); // Compatibilité
      console.log('✅ Clé API mise à jour');
      return true;
    }
    return false;
  }

  // Vérifier si une clé est configurée
  hasAPIKey() {
    this.initialize();
    return !!this.getAPIKey();
  }

  // Effacer les clés
  clearAPIKeys() {
    localStorage.removeItem('alflight_ai_api_key');
    localStorage.removeItem('openai_api_key');
    localStorage.removeItem('alflight_ai_endpoint');
    console.log('🗑️ Clés API effacées');
  }
}

// Export singleton
const apiKeyManager = new APIKeyManager();

// Initialiser immédiatement au chargement du module
try {
  console.log('🚀 Initialisation automatique du gestionnaire de clés API...');
  apiKeyManager.initialize();

  // Forcer la synchronisation de la clé si elle existe dans l'environnement
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey) {
    console.log('✅ Synchronisation forcée de la clé depuis l\'environnement');
    localStorage.setItem('alflight_ai_api_key', envKey);
    localStorage.setItem('openai_api_key', envKey);

    const endpoint = import.meta.env.VITE_AI_API_ENDPOINT;
    if (endpoint) {
      localStorage.setItem('alflight_ai_endpoint', endpoint);
    }
  }
} catch (e) {
  console.error('❌ Erreur lors de l\'initialisation automatique:', e);
}

export default apiKeyManager;