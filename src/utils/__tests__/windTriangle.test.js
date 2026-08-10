import { describe, it, expect } from 'vitest';
import { solveWindTriangle } from '../windTriangle';

describe('solveWindTriangle', () => {
  it('vent plein face : GS = TAS − vent, dérive nulle', () => {
    const r = solveWindTriangle(360, 100, 360, 20);
    expect(r.windCorrectionAngle).toBeCloseTo(0, 5);
    expect(r.groundSpeed).toBeCloseTo(80, 5);
    expect(r.headwind).toBeCloseTo(20, 5);
  });

  it('vent plein arrière : GS = TAS + vent', () => {
    const r = solveWindTriangle(360, 100, 180, 20);
    expect(r.windCorrectionAngle).toBeCloseTo(0, 5);
    expect(r.groundSpeed).toBeCloseTo(120, 5);
  });

  it('vent plein travers droite : WCA positif, GS = √(TAS²−W²) (formule exacte)', () => {
    const r = solveWindTriangle(360, 100, 90, 30);
    expect(r.windCorrectionAngle).toBeCloseTo(17.46, 1);
    expect(r.groundSpeed).toBeCloseTo(Math.sqrt(100 * 100 - 30 * 30), 1);
    expect(r.headingTrue).toBeCloseTo(17.46, 1);
    expect(r.crosswind).toBeCloseTo(30, 5);
  });

  it('sans vent : GS = TAS, cap = route', () => {
    const r = solveWindTriangle(45, 100, null, 0);
    expect(r.groundSpeed).toBe(100);
    expect(r.headingTrue).toBe(45);
  });

  it('fail-closed : vent intenable ou entrées invalides → null', () => {
    expect(solveWindTriangle(360, 40, 90, 50)).toBeNull();  // travers > TAS
    expect(solveWindTriangle(360, 20, 360, 25)).toBeNull(); // face ≥ TAS
    expect(solveWindTriangle('x', 100, 90, 10)).toBeNull();
    expect(solveWindTriangle(360, 0, 90, 10)).toBeNull();
    // vitesse valide + direction invalide = donnée mal formée, PAS un vent calme
    expect(solveWindTriangle(90, 100, undefined, 25)).toBeNull();
  });

  it('normalisation du cap autour du nord', () => {
    const r = solveWindTriangle(350, 100, 260, 30); // vent de gauche → WCA négatif
    expect(r.headingTrue).toBeGreaterThan(330);
    expect(r.headingTrue).toBeLessThan(350);
  });
});
