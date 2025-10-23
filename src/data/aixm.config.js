/**
 * Configuration du fichier AIXM actuel
 *
 * INSTRUCTIONS POUR METTRE À JOUR :
 * 1. Téléchargez le dernier fichier AIXM depuis : https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition.html
 * 2. Placez le fichier dans le dossier : src/data/
 * 3. Mettez à jour la variable CURRENT_AIXM_FILE ci-dessous avec le nom du nouveau fichier
 * 4. L'application détectera automatiquement la date et vérifiera la validité
 *
 * Format du nom de fichier : AIXM4.5_all_FR_OM_YYYY-MM-DD.xml
 * Exemple : AIXM4.5_all_FR_OM_2025-11-27.xml
 */

export const CURRENT_AIXM_FILE = 'AIXM4.5_all_FR_OM_2025-11-27.xml';

// Vous pouvez également utiliser le format XML_SIA :
// export const CURRENT_AIXM_FILE = 'XML_SIA_2025-11-27.xml';

/**
 * Informations supplémentaires
 */
export const AIXM_CONFIG = {
  filename: CURRENT_AIXM_FILE,
  source: 'SIA France (DGAC)',
  format: 'AIXM 4.5',
  cycleDays: 28, // Cycle AIRAC
  downloadUrl: 'https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition.html'
};
