// Couverture des performances par GROUPE (précision pilote 23/08, rapport
// F-BXNG) : « les deux seules configurations sont décollage en lisse,
// atterrissage en LDG ». La configuration normale dépend de l'avion — la
// couverture attendue est donc phase × métrique, satisfaite par N'IMPORTE
// QUELLE configuration de volets renseignée.
import { describe, it, expect } from 'vitest';
import {
  computeMissingPerformanceTables,
  computeCertifiedAbsentPerformanceTables,
  PERF_BYPASS_PREFIX
} from '../performanceCoverage';

const mkTables = (ids) => ({ advancedPerformance: { tables: ids.map(id => ({ operationId: id, data: [] })) } });

describe('couverture : 4 groupes phase × métrique', () => {
  it('Cessna 150 (décollage volets rentrés, atterrissage LDG) : couverture COMPLÈTE', () => {
    const c150 = mkTables([
      'takeoff_ground_roll_flaps_up',
      'takeoff_50ft_flaps_up',
      'landing_ground_roll_flaps_landing',
      'landing_50ft_flaps_landing'
    ]);
    expect(computeMissingPerformanceTables(c150)).toEqual([]);
  });

  it('PA-28 (décollage volets décollage) : couverture COMPLÈTE aussi', () => {
    const pa28 = mkTables([
      'takeoff_ground_roll_flaps_to',
      'takeoff_50ft_flaps_to',
      'landing_ground_roll_flaps_landing',
      'landing_50ft_flaps_landing'
    ]);
    expect(computeMissingPerformanceTables(pa28)).toEqual([]);
  });

  it('atterrissage absent : deux groupes manquants, nommés par phase et métrique', () => {
    const sansAtterrissage = mkTables(['takeoff_ground_roll_flaps_to', 'takeoff_50ft_flaps_to']);
    const missing = computeMissingPerformanceTables(sansAtterrissage);
    expect(missing).toHaveLength(2);
    expect(missing.map(m => m.groupKey).sort()).toEqual(['landing_50ft', 'landing_ground_roll']);
    expect(missing.every(m => m.phase === 'landing')).toBe(true);
  });

  it('fiche vide : les 4 groupes manquent', () => {
    expect(computeMissingPerformanceTables({})).toHaveLength(4);
  });

  it('certification par clé de GROUPE : le groupe sort des manquants', () => {
    const bypass = new Set([PERF_BYPASS_PREFIX + 'landing_50ft']);
    const missing = computeMissingPerformanceTables(mkTables(['takeoff_ground_roll_flaps_to', 'takeoff_50ft_flaps_to', 'landing_ground_roll_flaps_landing']), bypass);
    expect(missing).toEqual([]);
    const certifies = computeCertifiedAbsentPerformanceTables(mkTables(['takeoff_ground_roll_flaps_to', 'takeoff_50ft_flaps_to', 'landing_ground_roll_flaps_landing']), bypass);
    expect(certifies.map(c => c.groupKey)).toEqual(['landing_50ft']);
  });

  it('certification LEGACY par operationId : toujours acceptée (fiches déjà certifiées)', () => {
    const bypass = new Set([PERF_BYPASS_PREFIX + 'landing_50ft_flaps_landing']);
    expect(computeMissingPerformanceTables(mkTables(['takeoff_ground_roll_flaps_to', 'takeoff_50ft_flaps_to', 'landing_ground_roll_flaps_landing']), bypass)).toEqual([]);
  });

  it('une couverture PRÉSENTE n\'est jamais listée comme certifiée absente', () => {
    const bypass = new Set([PERF_BYPASS_PREFIX + 'landing_50ft_flaps_landing']);
    const complet = mkTables([
      'takeoff_ground_roll_flaps_up', 'takeoff_50ft_flaps_up',
      'landing_ground_roll_flaps_landing', 'landing_50ft_flaps_landing'
    ]);
    expect(computeCertifiedAbsentPerformanceTables(complet, bypass)).toEqual([]);
  });

  it('les abaques comptent comme les tableaux (operationId du graphe primaire)', () => {
    const parAbaques = {
      performanceModels: [
        { data: { metadata: { systemType: 'takeoff_ground_roll_flaps_up' }, graphs: [] } },
        { data: { graphs: [{ role: 'primary', operationId: 'takeoff_50ft_flaps_up' }] } },
        { data: { graphs: [{ role: 'primary', operationId: 'landing_ground_roll_flaps_landing' }] } },
        { data: { graphs: [{ role: 'primary', operationId: 'landing_50ft_flaps_landing' }] } }
      ]
    };
    expect(computeMissingPerformanceTables(parAbaques)).toEqual([]);
  });
});
