// Configuration pour gérer les cycles AIRAC
// Les cycles AIRAC changent tous les 28 jours

/**
 * Calcule l'URL du cycle AIRAC actuel
 * Les cycles AIRAC 2025 connus :
 * - 2025-01-02
 * - 2025-01-30
 * - 2025-02-27
 * - 2025-03-27
 * - 2025-04-24
 * - 2025-05-22
 * - 2025-06-19
 * - 2025-07-17
 * - 2025-08-14
 * - 2025-09-11
 * - 2025-10-09
 * - 2025-11-06
 * - 2025-12-04
 */
export const AIRAC_CYCLES_2025 = [
  { date: '2025-01-02', folder: '02_JAN_2025' },
  { date: '2025-01-30', folder: '30_JAN_2025' },
  { date: '2025-02-27', folder: '27_FEB_2025' },
  { date: '2025-03-27', folder: '27_MAR_2025' },
  { date: '2025-04-24', folder: '24_APR_2025' },
  { date: '2025-05-22', folder: '22_MAY_2025' },
  { date: '2025-06-19', folder: '19_JUN_2025' },
  { date: '2025-07-17', folder: '17_JUL_2025' },
  { date: '2025-08-14', folder: '14_AUG_2025' },
  { date: '2025-09-11', folder: '11_SEP_2025' },
  { date: '2025-10-09', folder: '09_OCT_2025' },
  { date: '2025-11-06', folder: '06_NOV_2025' },
  { date: '2025-12-04', folder: '04_DEC_2025' }
];

/**
 * Obtenir le cycle AIRAC actuel
 */
export function getCurrentAiracCycle() {
  const today = new Date();
  
  // Trouver le cycle actif
  for (let i = AIRAC_CYCLES_2025.length - 1; i >= 0; i--) {
    const cycleDate = new Date(AIRAC_CYCLES_2025[i].date);
    if (today >= cycleDate) {
      return AIRAC_CYCLES_2025[i];
    }
  }
  
  // Si aucun cycle trouvé (ne devrait pas arriver), retourner le dernier connu
  return AIRAC_CYCLES_2025[AIRAC_CYCLES_2025.length - 1];
}

/**
 * Construire l'URL pour une carte VAC
 */
export function buildVacUrl(icao) {
  const cycle = getCurrentAiracCycle();
  const upperIcao = icao.toUpperCase();
  
  // Format de l'URL SIA
  return `https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_${cycle.folder}/FRANCE/AIRAC-${cycle.date}/pdf/FR-AD-2/AD-2.${upperIcao}-fr-FR.pdf`;
}

/**
 * Obtenir l'URL de base pour le cycle actuel
 */
export function getCurrentAiracBaseUrl() {
  const cycle = getCurrentAiracCycle();
  return `https://www.sia.aviation-civile.gouv.fr/dvd/eAIP_${cycle.folder}/FRANCE/AIRAC-${cycle.date}/pdf/FR-AD-2`;
}

/**
 * Vérifier si le cycle AIRAC doit être mis à jour
 */
export function checkAiracUpdate() {
  const cycle = getCurrentAiracCycle();
  const nextCycleIndex = AIRAC_CYCLES_2025.findIndex(c => c.date === cycle.date) + 1;
  
  if (nextCycleIndex < AIRAC_CYCLES_2025.length) {
    const nextCycle = AIRAC_CYCLES_2025[nextCycleIndex];
    const nextDate = new Date(nextCycle.date);
    const today = new Date();
    const daysUntilNext = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilNext <= 3) {
       : ${nextCycle.date}`);
      return {
        needsUpdate: true,
        daysUntilNext,
        nextCycle
      };
    }
  }
  
  return { needsUpdate: false };
}

// Log du cycle actuel au chargement
const currentCycle = getCurrentAiracCycle();

checkAiracUpdate();