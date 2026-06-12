// src/utils/__tests__/weighingReportAge.test.js
//
// Âge du rapport de pesée : années révolues (anniversaire), seuil 10 ans,
// libellés < 1 an, entrées invalides. Horloge injectée → déterministe.

import { describe, it, expect } from 'vitest';
import { getWeighingReportAge, WEIGHING_REPORT_WARN_YEARS } from '../weighingReportAge';

const NOW = new Date('2026-06-12T12:00:00Z');

describe('getWeighingReportAge', () => {
  it('retourne null sans date ou avec une date invalide', () => {
    expect(getWeighingReportAge(null, NOW)).toBeNull();
    expect(getWeighingReportAge(undefined, NOW)).toBeNull();
    expect(getWeighingReportAge('', NOW)).toBeNull();
    expect(getWeighingReportAge('pas-une-date', NOW)).toBeNull();
  });

  it('compte les années révolues (anniversaire passé vs à venir)', () => {
    // Anniversaire déjà passé cette année → 11 ans
    expect(getWeighingReportAge('2015-01-10', NOW)).toMatchObject({ years: 11, isOld: true });
    // Anniversaire pas encore atteint → 10 ans révolus
    expect(getWeighingReportAge('2015-11-20', NOW)).toMatchObject({ years: 10, isOld: true });
    // Pesée récente
    expect(getWeighingReportAge('2024-06-01', NOW)).toMatchObject({ years: 2, isOld: false });
  });

  it('applique le seuil exactement à 10 ans révolus', () => {
    // 10 ans pile hier → isOld
    expect(getWeighingReportAge('2016-06-11', NOW)).toMatchObject({ years: 10, isOld: true });
    // 10 ans demain seulement → 9 ans révolus, pas encore vieux
    expect(getWeighingReportAge('2016-06-13', NOW)).toMatchObject({ years: 9, isOld: false });
    expect(WEIGHING_REPORT_WARN_YEARS).toBe(10);
  });

  it('libelle les âges de moins d’un an en mois', () => {
    expect(getWeighingReportAge('2026-02-10', NOW).ageLabel).toBe('4 mois');
    expect(getWeighingReportAge('2026-06-01', NOW).ageLabel).toBe('ce mois-ci');
    expect(getWeighingReportAge('2025-07-01', NOW).ageLabel).toBe('11 mois');
  });

  it('libelle le singulier/pluriel des années', () => {
    expect(getWeighingReportAge('2025-01-01', NOW).ageLabel).toBe('1 an');
    expect(getWeighingReportAge('2015-01-01', NOW).ageLabel).toBe('11 ans');
  });

  it('ne produit pas d’âge négatif pour une date future', () => {
    const r = getWeighingReportAge('2027-01-01', NOW);
    expect(r.years).toBe(0);
    expect(r.isOld).toBe(false);
  });
});
