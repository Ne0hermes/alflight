// Système de vérification et réparation automatique de la connexion Supabase
import { supabase } from '@services/communityService';
import { createModuleLogger } from '@utils/logger';

const logger = createModuleLogger('SupabaseHealthCheck');

class SupabaseHealthCheck {
  constructor() {
    this.isHealthy = false;
    this.lastCheck = null;
    this.errorCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 secondes
  }

  /**
   * Vérifie la santé de la connexion Supabase
   * @returns {Promise<{healthy: boolean, error?: string, details?: object}>}
   */
  async checkHealth() {
    logger.info('🔍 Vérification de la connexion Supabase...');

    try {
      // 1. Vérifier que les variables d'environnement sont définies
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
        throw new Error('VITE_SUPABASE_URL non configurée dans .env');
      }

      if (!supabaseKey || supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
        throw new Error('VITE_SUPABASE_ANON_KEY non configurée dans .env');
      }

      // 2. Tester la connexion en récupérant un preset
      const { data, error } = await supabase
        .from('community_presets')
        .select('id, registration')
        .eq('status', 'active')
        .limit(1);

      if (error) {
        throw new Error(`Erreur Supabase: ${error.message}`);
      }

      // 3. Vérifier que la base de données retourne des données
      if (!data) {
        throw new Error('Aucune donnée retournée par Supabase');
      }

      this.isHealthy = true;
      this.lastCheck = new Date();
      this.errorCount = 0;

      logger.success('✅ Connexion Supabase OK');

      return {
        healthy: true,
        details: {
          url: supabaseUrl,
          presetsCount: data.length,
          timestamp: this.lastCheck.toISOString()
        }
      };

    } catch (error) {
      this.isHealthy = false;
      this.lastCheck = new Date();
      this.errorCount++;

      logger.error('❌ Erreur de connexion Supabase:', error.message);

      return {
        healthy: false,
        error: error.message,
        details: {
          errorCount: this.errorCount,
          timestamp: this.lastCheck.toISOString()
        }
      };
    }
  }

  /**
   * Tente de réparer la connexion automatiquement
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async autoRepair() {
    logger.info('🔧 Tentative de réparation automatique...');

    for (let i = 0; i < this.maxRetries; i++) {
      logger.info(`🔄 Tentative ${i + 1}/${this.maxRetries}...`);

      const result = await this.checkHealth();

      if (result.healthy) {
        logger.success('✅ Réparation réussie!');
        return { success: true };
      }

      if (i < this.maxRetries - 1) {
        logger.info(`⏳ Attente de ${this.retryDelay}ms avant nouvelle tentative...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }

    logger.error('❌ Échec de la réparation après toutes les tentatives');

    return {
      success: false,
      error: 'Impossible de rétablir la connexion Supabase après plusieurs tentatives'
    };
  }

  /**
   * Vérifie la santé au démarrage de l'application
   * Lance une réparation automatique si nécessaire
   * @returns {Promise<{healthy: boolean, repaired?: boolean, error?: string}>}
   */
  async initCheck() {
    logger.info('🚀 Vérification initiale de Supabase au démarrage...');

    const healthCheck = await this.checkHealth();

    if (healthCheck.healthy) {
      return { healthy: true };
    }

    // Si la connexion échoue, tenter une réparation automatique
    logger.warn('⚠️ Connexion Supabase défaillante, tentative de réparation...');

    const repairResult = await this.autoRepair();

    if (repairResult.success) {
      return {
        healthy: true,
        repaired: true
      };
    }

    return {
      healthy: false,
      error: repairResult.error || healthCheck.error
    };
  }

  /**
   * Retourne le statut actuel
   */
  getStatus() {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastCheck,
      errorCount: this.errorCount
    };
  }
}

// Instance singleton
const supabaseHealthCheck = new SupabaseHealthCheck();

export default supabaseHealthCheck;
export { SupabaseHealthCheck };
