// Configuration pour gérer les cycles AIRAC
// Les cycles AIRAC changent tous les 28 jours

/**
 * Cycles AIRAC 2025 et 2026
 * Chaque cycle dure 28 jours
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

export const AIRAC_CYCLES_2026 = [
  { date: '2026-01-01', folder: '01_JAN_2026' },
  { date: '2026-01-29', folder: '29_JAN_2026' },
  { date: '2026-02-26', folder: '26_FEB_2026' },
  { date: '2026-03-26', folder: '26_MAR_2026' },
  { date: '2026-04-23', folder: '23_APR_2026' },
  { date: '2026-05-21', folder: '21_MAY_2026' },
  { date: '2026-06-18', folder: '18_JUN_2026' },
  { date: '2026-07-16', folder: '16_JUL_2026' },
  { date: '2026-08-13', folder: '13_AUG_2026' },
  { date: '2026-09-10', folder: '10_SEP_2026' },
  { date: '2026-10-08', folder: '08_OCT_2026' },
  { date: '2026-11-05', folder: '05_NOV_2026' },
  { date: '2026-12-03', folder: '03_DEC_2026' }
];

// Tous les cycles combinés
const ALL_CYCLES = [...AIRAC_CYCLES_2025, ...AIRAC_CYCLES_2026];

/**
 * Obtenir le cycle AIRAC actuel
 */
export function getCurrentAiracCycle() {
  const today = new Date();

  // Trouver le cycle actif (le plus récent dont la date est passée)
  for (let i = ALL_CYCLES.length - 1; i >= 0; i--) {
    const cycleDate = new Date(ALL_CYCLES[i].date);
    if (today >= cycleDate) {
      return ALL_CYCLES[i];
    }
  }

  // Si aucun cycle trouvé, retourner le dernier connu
  return ALL_CYCLES[ALL_CYCLES.length - 1];
}

/**
 * Construire l'URL pour une carte VAC via le visualisateur AIP
 */
export function buildVacUrl(icao) {
  const upperIcao = icao.toUpperCase();
  // Le SIA utilise maintenant le visualisateur AIP (VAIP)
  return `https://www.sia.aviation-civile.gouv.fr/vaip`;
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
  const nextCycleIndex = ALL_CYCLES.findIndex(c => c.date === cycle.date) + 1;

  if (nextCycleIndex < ALL_CYCLES.length) {
    const nextCycle = ALL_CYCLES[nextCycleIndex];
    const nextDate = new Date(nextCycle.date);
    const today = new Date();
    const daysUntilNext = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilNext <= 3) {
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
