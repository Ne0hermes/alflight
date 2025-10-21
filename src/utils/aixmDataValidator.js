/**
 * Utilitaire pour vérifier la validité des données AIXM
 * Cycle AIRAC : 28 jours
 */

/**
 * Extrait la date depuis le nom de fichier AIXM
 * Format attendu : AIXM4.5_all_FR_OM_YYYY-MM-DD.xml
 * @param {string} filename - Nom du fichier AIXM
 * @returns {Date|null} Date extraite ou null si format invalide
 */
export function extractDateFromAIXMFilename(filename) {
  // Pattern : AIXM4.5_all_FR_OM_2025-09-04.xml
  const pattern = /AIXM.*_(\d{4})-(\d{2})-(\d{2})\.xml/;
  const match = filename.match(pattern);

  if (!match) {
    console.warn(`Format de fichier AIXM invalide: ${filename}`);
    return null;
  }

  const [, year, month, day] = match;
  return new Date(year, parseInt(month) - 1, day);
}

/**
 * Calcule le statut de validité des données AIXM
 * @param {Date} effectiveDate - Date d'entrée en vigueur des données
 * @returns {Object} Statut de validité
 */
export function checkAIXMDataValidity(effectiveDate) {
  if (!effectiveDate) {
    return {
      isValid: false,
      status: 'unknown',
      message: 'Date de validité inconnue',
      daysRemaining: null,
      expiryDate: null
    };
  }

  const today = new Date();
  const AIRAC_CYCLE_DAYS = 28;

  // Calculer la date d'expiration (effective date + 28 jours)
  const expiryDate = new Date(effectiveDate);
  expiryDate.setDate(expiryDate.getDate() + AIRAC_CYCLE_DAYS);

  // Calculer les jours restants
  const daysRemaining = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

  let status, message, isValid;

  if (daysRemaining < 0) {
    status = 'expired';
    message = `Données périmées depuis ${Math.abs(daysRemaining)} jour(s)`;
    isValid = false;
  } else if (daysRemaining === 0) {
    status = 'expiring-today';
    message = 'Données expirent aujourd\'hui';
    isValid = true;
  } else if (daysRemaining <= 7) {
    status = 'warning';
    message = `Données expirent dans ${daysRemaining} jour(s)`;
    isValid = true;
  } else if (daysRemaining <= 14) {
    status = 'notice';
    message = `Données valides encore ${daysRemaining} jours`;
    isValid = true;
  } else {
    status = 'valid';
    message = `Données valides encore ${daysRemaining} jours`;
    isValid = true;
  }

  return {
    isValid,
    status,
    message,
    daysRemaining,
    effectiveDate: effectiveDate.toISOString().split('T')[0],
    expiryDate: expiryDate.toISOString().split('T')[0],
    nextAIRACDate: calculateNextAIRACDate(effectiveDate)
  };
}

/**
 * Calcule la prochaine date de cycle AIRAC
 * @param {Date} currentEffectiveDate - Date actuelle d'entrée en vigueur
 * @returns {string} Prochaine date AIRAC au format YYYY-MM-DD
 */
function calculateNextAIRACDate(currentEffectiveDate) {
  const nextDate = new Date(currentEffectiveDate);
  nextDate.setDate(nextDate.getDate() + 28);
  return nextDate.toISOString().split('T')[0];
}

/**
 * Récupère le statut des données AIXM depuis la configuration
 * @returns {Promise<Object>} Statut de validité
 */
export async function getAIXMDataStatus() {
  try {
    // Charger la configuration
    const { CURRENT_AIXM_FILE, AIXM_CONFIG } = await import('../data/aixm.config.js');

    const effectiveDate = extractDateFromAIXMFilename(CURRENT_AIXM_FILE);
    const validity = checkAIXMDataValidity(effectiveDate);

    return {
      ...validity,
      filename: CURRENT_AIXM_FILE,
      source: AIXM_CONFIG.source,
      format: AIXM_CONFIG.format,
      downloadUrl: AIXM_CONFIG.downloadUrl
    };
  } catch (error) {
    console.error('Erreur lors de la vérification du statut AIXM:', error);
    return {
      isValid: false,
      status: 'error',
      message: 'Impossible de vérifier le statut des données',
      daysRemaining: null,
      filename: null,
      source: 'SIA France (DGAC)'
    };
  }
}

/**
 * Formate le message d'alerte selon le statut
 * @param {Object} status - Statut retourné par checkAIXMDataValidity
 * @returns {Object} Objet avec message, couleur et icône
 */
export function formatAIXMAlert(status) {
  const alerts = {
    expired: {
      color: '#ef4444', // Rouge
      bgColor: '#fee2e2',
      icon: '⚠️',
      title: '🚨 DONNÉES PÉRIMÉES',
      priority: 'critical'
    },
    'expiring-today': {
      color: '#f59e0b', // Orange
      bgColor: '#fef3c7',
      icon: '⏰',
      title: '⚠️ EXPIRATION AUJOURD\'HUI',
      priority: 'high'
    },
    warning: {
      color: '#f59e0b', // Orange
      bgColor: '#fef3c7',
      icon: '⚠️',
      title: 'Attention : Mise à jour requise',
      priority: 'medium'
    },
    notice: {
      color: '#3b82f6', // Bleu
      bgColor: '#dbeafe',
      icon: 'ℹ️',
      title: 'Information',
      priority: 'low'
    },
    valid: {
      color: '#10b981', // Vert
      bgColor: '#d1fae5',
      icon: '✅',
      title: 'Données à jour',
      priority: 'info'
    },
    unknown: {
      color: '#6b7280', // Gris
      bgColor: '#f3f4f6',
      icon: '❓',
      title: 'Statut inconnu',
      priority: 'info'
    }
  };

  return alerts[status] || alerts.unknown;
}
