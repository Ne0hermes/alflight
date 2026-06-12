// src/abac/curves/core/__tests__/cascade.referenceLine.test.js
//
// R20 — LIGNE DE RÉFÉRENCE DES PANNEAUX DE CORRECTION (régression).
//
// Bug d'origine (cas réel PA-28-181 F-GNAM, abaque Flaps TAKEOFF) : l'entrée
// d'un panneau se faisait au bord de la plage X COMMUNE (intersection) des
// guides. Un guide tronqué (sortie par le plafond du graphe — normal sur un
// abaque réel) repliait l'entrée au bout de CE guide : le suivi de pente ne
// parcourait presque rien et la correction de masse passait de −9 % à −0,2 %
// (distance finale +10 % : 626 m au lieu de ~567 m attendus).
//
// Comportement verrouillé ici :
//   1. l'entrée se fait au bord de l'AXE du panneau (min/max selon reversed),
//   2. les guides tronqués sont prolongés par leur pente de bord,
//   3. INVARIANT DE NEUTRALITÉ : paramètre = ligne de référence ⇒ sortie =
//      entrée (un panneau « à zéro correction » ne corrige rien — c'était
//      faux avant : le panneau vent ajoutait un décalage fantôme à 0 kt).

import { describe, it, expect } from 'vitest';
import { performCascadeCalculationWithParameters } from '../cascade';

const mkCurve = (id, familyValue, pts) => {
  const points = pts.map(([x, y], i) => ({ x, y, id: `${id}-p${i}` }));
  return {
    id,
    name: id,
    color: '#000000',
    points,
    familyValue,
    // findYForX consomme fitted.points (tracé interpolé) — droite ici.
    fitted: { points }
  };
};

const mkPrimary = (id) => ({
  id,
  name: 'Primaire OAT',
  role: 'primary',
  isWindRelated: false,
  axes: {
    xAxis: { min: 0, max: 40, step: 10, title: 'oat', unit: '°C' },
    yAxis: { min: 0, max: 400, step: 100, title: 'distance', unit: 'm' }
  },
  // Une seule courbe d'altitude (famille 2000 ft) : y = 10 × oat
  curves: [mkCurve(`${id}-c2000`, 2000, [[0, 0], [40, 400]])]
});

describe('R20 — ligne de référence = bord d’axe du panneau (guides tronqués prolongés)', () => {
  it('panneau masse à axe INVERSÉ avec guide haut tronqué : entrée au bord d’axe, pas au bout du guide', () => {
    const g1 = mkPrimary('g1');
    const panel = {
      id: 'g2',
      name: 'Panneau masse',
      role: 'intermediate',
      isWindRelated: false,
      axes: {
        // Axe masse du POH : décroissant vers la droite ⇒ ligne de référence
        // (bord visuel gauche) = max d'axe = 1150.
        xAxis: { min: 950, max: 1150, step: 50, title: 'mass', unit: 'kg', reversed: true },
        yAxis: { min: 0, max: 400, step: 100, title: 'distance', unit: 'm' }
      },
      curves: [
        // Guide bas : couvre tout l'axe. y(1150) = 200, y(1000) = 125.
        mkCurve('low', 1, [[950, 100], [1150, 200]]),
        // Guide haut TRONQUÉ à x = 1089,9 (sort par le plafond, cas réel) :
        // pente 90/139,9 ; prolongé jusqu'à 1150 ⇒ y ≈ 328,66.
        mkCurve('high', 2, [[950, 200], [1089.9, 290]])
      ]
    };

    const run = (massTarget) =>
      performCascadeCalculationWithParameters([g1, panel], 21, [
        { graphId: 'g1', parameter: 2000, parameterName: 'Altitude pression' },
        { graphId: 'g2', parameter: massTarget, parameterName: 'mass' }
      ]);

    // Entrée : OAT 21 → 210. À la ligne de référence (1150) : low = 200,
    // high prolongé ≈ 328,66 ⇒ ratio ≈ 0,0777.
    // Cible 1000 kg : low = 125, high = 232,17 ⇒ 125 + 0,0777 × 107,17 ≈ 133,3.
    // (L'ancien code entrait à 1089,9 — bout du guide tronqué — et donnait ≈ 160,8.)
    const corrected = run(1000);
    expect(corrected.success).toBe(true);
    expect(corrected.finalValue).toBeCloseTo(133.3, 0);

    // INVARIANT DE NEUTRALITÉ : cible = ligne de référence ⇒ sortie = entrée.
    const neutral = run(1150);
    expect(neutral.success).toBe(true);
    expect(neutral.finalValue).toBeCloseTo(210, 1);
  });

  it('panneau vent à axe normal dont les guides commencent après 0 : vent calme strictement neutre', () => {
    const g1 = mkPrimary('g1');
    const windPanel = {
      id: 'g2',
      name: 'Panneau vent',
      role: 'intermediate',
      isWindRelated: false, // guides sans windDirection : panneau simple
      axes: {
        // Ligne de référence « vent nul » = min d'axe = 0 kt.
        xAxis: { min: 0, max: 15, step: 5, title: 'wind_component', unit: 'kt' },
        yAxis: { min: 0, max: 400, step: 100, title: 'distance', unit: 'm' }
      },
      curves: [
        // Guides numérisés à partir de 0,5 kt (jamais exactement 0 sur un
        // tracé réel) — l'ancien code entrait à 0,5 et fabriquait un
        // décalage fantôme à 0 kt (+5 m observés sur le cas réel).
        mkCurve('w1', 1, [[0.5, 100], [15, 60]]),
        mkCurve('w2', 2, [[0.5, 200], [15, 130]])
      ]
    };

    const run = (wind) =>
      performCascadeCalculationWithParameters([g1, windPanel], 15, [
        { graphId: 'g1', parameter: 2000, parameterName: 'Altitude pression' },
        { graphId: 'g2', parameter: wind, parameterName: 'wind_component' }
      ]);

    // Entrée : OAT 15 → 150. Vent 0 kt = ligne de référence ⇒ sortie = 150.
    const calm = run(0);
    expect(calm.success).toBe(true);
    expect(calm.finalValue).toBeCloseTo(150, 1);

    // Et un vent non nul corrige bien (sanité) : 8 kt ⇒ valeur < 150.
    const windy = run(8);
    expect(windy.success).toBe(true);
    expect(windy.finalValue).toBeLessThan(150);
  });
});
