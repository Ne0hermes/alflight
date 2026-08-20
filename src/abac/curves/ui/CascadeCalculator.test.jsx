/**
 * Tests légers du TESTEUR UNIFIÉ (Lot 1-F) — CascadeCalculator.
 *
 * Même approche que kit.test.jsx : @testing-library/react n'est pas dans les
 * devDependencies → rendu pur via react-dom/server (renderToStaticMarkup),
 * suffisant en environnement node pour vérifier les comportements de RENDU :
 *   - cascade PARTIELLE : le plus long préfixe complet est annoncé, les
 *     graphes incomplets sont grisés (pas bloquants) ;
 *   - libellé du paramètre du graphe 0 = label de familyAxisVariable
 *     (plus de « Altitude pression » codé en dur) ;
 *   - sélecteur « système d'abaques » masqué quand UNE seule chaîne existe,
 *     graphes isolés (non cadrés) exclus des « systèmes » fantômes ;
 *   - plus de bouton « Calculer » (calcul live, débouncé — l'effet ne tourne
 *     pas en rendu statique, on vérifie l'absence du bouton).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CascadeCalculator, makeEmptyCascadeTestDraft } from './CascadeCalculator';

// ─── Fixtures ────────────────────────────────────────────────────────────────

let seq = 0;
const pt = (x, y) => ({ x, y, id: `p${seq++}` });
const line = (x0, y0, x1, y1, n = 5) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return pt(x0 + t * (x1 - x0), y0 + t * (y1 - y0));
  });

const axes = {
  xAxis: { min: 0, max: 40, unit: '°C', title: 'oat' },
  yAxis: { min: 0, max: 1000, unit: 'm', title: 'takeoff_distance_50ft' }
};

/** Graphe COMPLET : axes + 2 courbes traçables (fitted régénéré au montage). */
const completeGraph = (id, over = {}) => ({
  id,
  name: `Graphe ${id}`,
  isWindRelated: false,
  familyAxisVariable: 'pressure_altitude',
  axes,
  curves: [
    { id: `${id}-c1`, name: '0 ft', color: '#000', familyValue: 0, points: line(0, 200, 40, 400) },
    { id: `${id}-c2`, name: '4000 ft', color: '#000', familyValue: 4000, points: line(0, 400, 40, 700) }
  ],
  ...over
});

/** Graphe INCOMPLET : axes posés mais aucune courbe (en cours de tracé). */
const emptyGraph = (id, over = {}) => ({
  id,
  name: `Graphe ${id}`,
  isWindRelated: false,
  axes,
  curves: [],
  ...over
});

const link = (a, b) => {
  a.linkedTo = [b.id];
  b.linkedFrom = [a.id];
};

const render = (graphs, draft) =>
  renderToStaticMarkup(
    <CascadeCalculator graphs={graphs} draft={draft ?? makeEmptyCascadeTestDraft()} onDraftChange={() => {}} />
  );

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CascadeCalculator — cascade partielle (Lot 1-F)', () => {
  it('chaîne G1 complet → G2 vide : préfixe calculable annoncé, pas de blocage', () => {
    const g1 = completeGraph('g1');
    const g2 = emptyGraph('g2');
    link(g1, g2);
    const html = render([g1, g2]);
    expect(html).toContain('Cascade partielle');
    // Le formulaire du préfixe est OUVERT (le paramètre du graphe 1 se saisit)
    expect(html).toContain('Altitude pression pour Graphe g1');
    // L'ancien verrou « chaîne entière » n'affiche plus sa liste d'erreurs
    expect(html).not.toContain('Problèmes détectés');
  });

  it('chaîne entièrement complète : pas de mention partielle', () => {
    const g1 = completeGraph('g1');
    const g2 = completeGraph('g2');
    link(g1, g2);
    const html = render([g1, g2]);
    expect(html).not.toContain('Cascade partielle');
  });

  it('rien de calculable (G1 vide) : les problèmes de chaîne restent affichés', () => {
    const html = render([emptyGraph('g1')]);
    expect(html).toContain('Problèmes détectés');
  });
});

describe('CascadeCalculator — libellés de famille (plus de codage en dur)', () => {
  it('familyAxisVariable "mass" : le paramètre du graphe 0 dit « Masse », pas « Altitude pression »', () => {
    const g1 = completeGraph('g1', { familyAxisVariable: 'mass' });
    const html = render([g1]);
    expect(html).toContain('Masse pour Graphe g1');
    expect(html).not.toContain('Altitude pression');
  });
});

describe('CascadeCalculator — sélecteur de système (Lot 1-F)', () => {
  it('UNE seule chaîne : sélecteur masqué, y compris en présence d\'un graphe isolé (fantôme)', () => {
    const g1 = completeGraph('g1');
    const g2 = completeGraph('g2');
    link(g1, g2);
    const isolated = emptyGraph('g3'); // non cadré : ni amont ni aval
    const html = render([g1, g2, isolated]);
    expect(html).not.toContain('Sélectionnez le système');
    // le graphe isolé n'impose pas non plus sa chaîne : G1 → G2 reste affichée
    expect(html).toContain('Chaîne de calcul');
  });

  it('plusieurs chaînes réelles : sélecteur affiché', () => {
    const g1 = completeGraph('g1');
    const g2 = completeGraph('g2');
    link(g1, g2);
    const g3 = completeGraph('g3');
    const g4 = completeGraph('g4');
    link(g3, g4);
    const html = render([g1, g2, g3, g4]);
    expect(html).toContain('Sélectionnez le système');
  });
});

describe('CascadeCalculator — calcul live (Lot 1-F)', () => {
  it('le bouton « Calculer » a disparu (recalcul débouncé à la frappe)', () => {
    const g1 = completeGraph('g1');
    const draft = { ...makeEmptyCascadeTestDraft(), inputValue: '20' };
    const html = render([g1], draft);
    expect(html).not.toContain('>Calculer<');
  });
});
