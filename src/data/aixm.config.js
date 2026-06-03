/**
 * Configuration du fichier AIXM actuel
 *
 * INSTRUCTIONS POUR METTRE À JOUR :
 * 1. Téléchargez le dernier fichier AIXM depuis : https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition.html
 * 2. Placez le fichier dans le dossier : public/data/  (et le XML_SIA correspondant)
 * 3. Ajoutez son nom EN TÊTE de AIXM_FILE_CANDIDATES ci-dessous (le plus récent en premier)
 * 4. L'application détectera automatiquement la date et vérifiera la validité
 *
 * Format du nom de fichier : AIXM4.5_all_FR_OM_YYYY-MM-DD.xml
 * Exemple : AIXM4.5_all_FR_OM_2026-03-19.xml
 *
 * ⚠️ RÈGLE ANTI-RÉGRESSION (404)
 * --------------------------------
 * Le nom de fichier NE DOIT JAMAIS être daté « en avance » sur les fichiers
 * réellement présents dans public/data/. C'est ce qui causait l'erreur
 * « Le serveur a renvoyé du HTML au lieu de XML » (404) : la constante pointait
 * sur 2026-05-14 alors que seul 2026-03-19 existait sur le disque.
 *
 * Pour rendre l'app robuste à cette dérive, le parser (aixmParser.js) essaie
 * désormais les candidats de AIXM_FILE_CANDIDATES dans l'ordre et garde le
 * PREMIER qui répond avec du XML valide. Il suffit donc de lister ici les
 * fichiers réellement disponibles, du plus récent au plus ancien.
 */

/**
 * Liste ordonnée (plus récent → plus ancien) des fichiers AIXM disponibles
 * dans public/data/. Le parser prend le premier qui se charge correctement.
 * Garder synchronisé avec le contenu réel de public/data/.
 */
export const AIXM_FILE_CANDIDATES = [
  // ⚠️ Doit correspondre EXACTEMENT aux fichiers présents dans public/data/.
  // Le plus récent en tête. Anciens cycles retirés (fichiers supprimés du disque).
  'AIXM4.5_all_FR_OM_2026-05-14.xml',
];

// Fichier « courant » par défaut (= premier candidat disponible).
// Conservé pour compatibilité avec les imports existants.
export const CURRENT_AIXM_FILE = AIXM_FILE_CANDIDATES[0];

/**
 * Informations supplémentaires
 */
export const AIXM_CONFIG = {
  filename: CURRENT_AIXM_FILE,
  candidates: AIXM_FILE_CANDIDATES,
  source: 'SIA France (DGAC)',
  format: 'AIXM 4.5',
  cycleDays: 28, // Cycle AIRAC
  downloadUrl: 'https://www.sia.aviation-civile.gouv.fr/produits-numeriques-en-libre-disposition.html'
};
