// Guides NUMÉROTÉS (retour pilote 23/08) — prédicat et numérotation.
// Règle : sur un panneau de CORRECTION (ni le premier cadre, ni une zone en
// lecture descendante), les courbes sont des guides de pente — le moteur ne lit
// pas leur valeur, seulement un numéro distinct.
import { describe, it, expect } from 'vitest';
import {
  usesNumberedGuides, orderedGraphIds, isFirstFramedGraph,
  guideNumber, nextGuideNumber, guideAutoName
} from '../guideMode';

const mkWorkshop = (frames) => ({ image: null, sharedY: { min: 0, max: 100, unit: '', title: '' }, frames });

describe('usesNumberedGuides', () => {
  it('panneau de correction standard (non premier, lecture Y) : guides numérotés', () => {
    expect(usesNumberedGuides({ readoutAxis: undefined }, false)).toBe(true);
    expect(usesNumberedGuides({ readoutAxis: 'y' }, false)).toBe(true);
  });

  it('premier cadre : valeurs réelles (bracket par famille)', () => {
    expect(usesNumberedGuides({ readoutAxis: undefined }, true)).toBe(false);
  });

  it('zone en lecture descendante : valeurs réelles (vent signé)', () => {
    expect(usesNumberedGuides({ readoutAxis: 'x' }, false)).toBe(false);
  });

  it('graphe absent : faux', () => {
    expect(usesNumberedGuides(null, false)).toBe(false);
  });
});

describe('ordre des cadres', () => {
  const w = mkWorkshop([
    { graphId: 'b', xLeftPx: 300, xRightPx: 500 },
    { graphId: 'a', xLeftPx: 10, xRightPx: 200 },
    { graphId: 'c', xLeftPx: 600, xRightPx: 800 }
  ]);

  it('trie par xLeftPx (la géométrie EST la chaîne)', () => {
    expect(orderedGraphIds(w)).toEqual(['a', 'b', 'c']);
  });

  it('isFirstFramedGraph ne reconnaît que le cadre le plus à gauche', () => {
    expect(isFirstFramedGraph(w, 'a')).toBe(true);
    expect(isFirstFramedGraph(w, 'b')).toBe(false);
    expect(isFirstFramedGraph(w, null)).toBe(false);
    expect(isFirstFramedGraph({ frames: [] }, 'a')).toBe(false);
  });
});

describe('numérotation', () => {
  it('guideNumber lit familyValue, sinon le nombre du nom', () => {
    expect(guideNumber({ familyValue: 3, name: 'peu importe' })).toBe(3);
    expect(guideNumber({ name: 'Guide 7' })).toBe(7);
    expect(guideNumber({ name: 'sans numéro' })).toBeNull();
    expect(guideNumber(null)).toBeNull();
  });

  it('nextGuideNumber : max + 1, 1 si aucun guide', () => {
    expect(nextGuideNumber([])).toBe(1);
    expect(nextGuideNumber(null)).toBe(1);
    expect(nextGuideNumber([{ familyValue: 1 }, { familyValue: 4 }, { name: 'Guide 2' }])).toBe(5);
    // Modèle legacy dont les guides portent des masses : la numérotation
    // repart au-dessus (les numéros doivent seulement être distincts).
    expect(nextGuideNumber([{ familyValue: 950 }, { familyValue: 1050 }])).toBe(1051);
  });

  it('guideAutoName : sens du vent porté par le nom', () => {
    expect(guideAutoName(2)).toBe('Guide 2');
    expect(guideAutoName(2, 'headwind')).toBe('Face 2');
    expect(guideAutoName(2, 'tailwind')).toBe('Arrière 2');
    expect(guideAutoName(2, 'none')).toBe('Guide 2');
  });
});
