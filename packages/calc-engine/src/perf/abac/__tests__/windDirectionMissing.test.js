// packages/calc-engine/src/perf/abac/__tests__/windDirectionMissing.test.js
//
// FAIL-CLOSED sur une planche qui ne couvre pas la direction de vent demandée
// (24/08/2026 — signalement pilote sur F-GUVV : « le graphique que j'ai sur les
// distances de roulage n'indique rien par rapport au vent arrière, il n'y a que
// le vent de face sur les courbes »).
//
// Les 2 abaques d'atterrissage du F-GUVV ne portent que des guides « headwind » :
// le manuel ne publie pas de correction de vent arrière. Avant ce correctif, le
// moteur filtrait les guides par direction, obtenait une liste VIDE, puis
// retombait sur `graph.curves[0]` et lisait sa valeur absolue — un vent arrière
// de 5 kt donnait 403,1 m au passage des 15 m et 156,6 m au roulage, soit une
// distance PLUS COURTE que par vent nul. Un vent arrière qui raccourcit
// l'atterrissage est une valeur inventée, et dangereuse.
//
// Règle du projet : un refus vaut mieux qu'une valeur inventée.

import { describe, it, expect } from 'vitest';
import { performCascadeCalculationWithParameters } from '../cascade';

const mkCurve = (id, familyValue, pts, windDirection) => {
  const points = pts.map(([x, y], i) => ({ x, y, id: `${id}-p${i}` }));
  return { id, name: id, color: '#000000', points, familyValue, windDirection, fitted: { points } };
};

// Graphe d'entrée : y = 10 × OAT, famille d'altitude 2000 ft.
const primaire = () => ({
  id: 'g1',
  name: 'Primaire OAT',
  role: 'primary',
  isWindRelated: false,
  axes: {
    xAxis: { min: 0, max: 40, step: 10, title: 'oat', unit: '°C' },
    yAxis: { min: 0, max: 400, step: 100, title: 'distance', unit: 'm' },
  },
  curves: [mkCurve('c2000', 2000, [[0, 0], [40, 400]])],
});

// Panneau de vent à guides numérotés, UNIQUEMENT vent de face — la forme des
// planches d'atterrissage du F-GUVV. Ligne de référence : vent nul = min d'axe.
const panneauVentDeFaceSeul = () => ({
  id: 'g2',
  name: 'Correction vent',
  role: 'intermediate',
  isWindRelated: true,
  axes: {
    xAxis: { min: 0, max: 15, step: 5, title: 'wind_component', unit: 'kt' },
    yAxis: { min: 0, max: 400, step: 100, title: 'distance', unit: 'm' },
  },
  curves: [
    mkCurve('HEADWIND 1', 1, [[0, 100], [15, 60]], 'headwind'),
    mkCurve('HEADWIND 2', 2, [[0, 200], [15, 130]], 'headwind'),
  ],
});

const lance = (vent, direction) =>
  performCascadeCalculationWithParameters([primaire(), panneauVentDeFaceSeul()], 15, [
    { graphId: 'g1', parameter: 2000, parameterName: 'Altitude pression' },
    { graphId: 'g2', parameter: vent, parameterName: 'wind_component', windDirection: direction },
  ]);

describe('planche sans guide dans la direction de vent demandée', () => {
  it('REFUSE un vent arrière quand la planche ne porte que du vent de face', () => {
    const res = lance(5, 'tailwind');
    expect(res.success).toBe(false);
    // Le motif doit être compréhensible par le pilote, pas seulement technique :
    // c'est SON manuel qui ne couvre pas le cas, ce n'est pas une panne du modèle.
    expect(res.error).toMatch(/vent arrière/i);
    expect(res.error).toMatch(/ne porte AUCUN guide/i);
    // Et surtout PAS le message « choisis la direction », qui viserait à tort
    // une planche à familles mixtes.
    expect(res.error).not.toMatch(/choisis la direction/i);
  });

  it('CALCULE normalement un vent de face sur la même planche', () => {
    // Le refus est CIBLÉ : il ne condamne pas le modèle entier. Sans cette
    // vérification, un fail-closed trop large passerait pour un correctif.
    const res = lance(5, 'headwind');
    expect(res.success).toBe(true);
    expect(Number.isFinite(res.finalValue)).toBe(true);
  });

  it('ne rend JAMAIS une distance de vent arrière plus courte que par vent nul', () => {
    const sansVent = lance(0, 'headwind');
    expect(sansVent.success).toBe(true);

    const ventArriere = lance(5, 'tailwind');
    // Le cœur du bug : avant, ce calcul RENDAIT une valeur, et elle était
    // inférieure à la distance par vent nul.
    expect(ventArriere.success).toBe(false);
  });
});
