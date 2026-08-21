/**
 * Lot 1-G — tests d'ASSEMBLAGE de l'atelier abaques (rendu statique).
 *
 * Même approche que kit.test.jsx (pas de @testing-library) : l'AbacBuilder est
 * rendu via renderToStaticMarkup en lui fournissant une SESSION d'atelier
 * (sessionRef.atelier, marker 'nouveau') — le chemin de restauration existant
 * — pour obtenir directement l'écran Tracé ou Validation sans effets.
 *
 * Ce qu'on fige :
 *  - le RAIL de checklist permanent (items du set + groupes par cadre) ;
 *  - la disparition du <details> « Identité du graphique N » au profit du
 *    KitPanel « Cadre N » toujours visible ;
 *  - les libellés STABLES de la barre d'outils / du panneau Axes ;
 *  - le bouton « Valider et enregistrer » désactivé AVEC raison quand la
 *    checklist a des items bloquants (fin du window.confirm).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AbacBuilder } from './AbacBuilder';
import { makeEmptyCascadeTestDraft } from './CascadeCalculator';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const axis = (over = {}) => ({ min: 0, max: 100, step: 25, unit: '', title: '', ...over });

const mkCurve = (id, name, familyValue, pts) => ({
  id, name, color: '#F26921',
  ...(familyValue !== undefined ? { familyValue } : {}),
  points: pts.map(([x, y], i) => ({ x, y, id: `${id}-p${i}` }))
});

const mkGraph = (id, name, over = {}) => ({
  id,
  name,
  isWindRelated: false,
  axes: { xAxis: axis({ title: 'oat', unit: '°C' }), yAxis: axis() },
  curves: [],
  ...over
});

/** Session d'atelier complète (mêmes champs que sessionRef.atelier) — set
 *  SAUVEGARDABLE : chaîne valide (courbes avec points, fitted régénéré par
 *  ensureFittedGraphs dans computeSetReadiness). */
function mkSession(over = {}) {
  const g1 = mkGraph('g1', "Panneau d'entrée", {
    role: 'primary',
    operationId: 'takeoff_50ft_flaps_to',
    familyAxisVariable: 'pressure_altitude',
    curves: [
      mkCurve('c1', '0 ft', 0, [[0, 40], [50, 50], [100, 60]]),
      mkCurve('c2', '4000 ft', 4000, [[0, 60], [50, 70], [100, 80]])
    ]
  });
  const g2 = mkGraph('g2', 'Correction 2', {
    role: 'intermediate',
    axes: { xAxis: axis({ title: 'mass', unit: 'kg', min: 900, max: 1100, step: 50 }), yAxis: axis() },
    curves: [mkCurve('c3', 'guide', undefined, [[900, 40], [1000, 50], [1100, 60]])]
  });
  return {
    marker: 'nouveau',
    workshop: {
      image: null,
      sharedY: axis({ title: 'custom' }),
      frames: [
        { graphId: 'g1', xLeftPx: 10, xRightPx: 200 },
        { graphId: 'g2', xLeftPx: 220, xRightPx: 400 }
      ]
    },
    graphs: [g1, g2],
    referenceCases: [],
    bezierSession: null,
    systemType: 'takeoff_50ft_flaps_to',
    plancheType: 'standard',
    modelNameInput: 'Distance de décollage (50 ft)',
    aircraftModelDisplay: 'F-TEST',
    currentStep: 'points',
    subStepGraphIndex: 0,
    testDraft: makeEmptyCascadeTestDraft(),
    ...over
  };
}

const render = (session) =>
  renderToStaticMarkup(
    <AbacBuilder sessionRef={{ current: { atelier: session } }} />
  );

// ─── Écran Tracé ───────────────────────────────────────────────────────────

describe('AbacBuilder — assemblage écran Tracé (Lot 1-G)', () => {
  const html = render(mkSession());

  it('PAS de rail latéral au Tracé (retour pilote 20/08 : lisibilité) — la check-list vit à la Validation', () => {
    expect(html).not.toContain('Check-list du modèle');
    // Les badges « x/y ✓ » des panneaux de cadre restent le repère d'avancement.
    expect(html).toMatch(/\d+\/\d+ ✓/);
  });

  it('remplace le <details> « Identité du graphique N » par le KitPanel toujours visible', () => {
    expect(html).not.toContain('Identité du graphique');
    expect(html).toContain('Cadre 1');
    expect(html).toContain('Variable de famille des courbes');
    // L'opération ne se règle plus ici : rappel + « Modifier » seulement.
    expect(html).not.toContain('Phase / Métrique');
    expect(html).toContain('Modifier');
    // Set conforme (issu du setup) : pas de radios de rôle.
    expect(html).not.toContain('Réglages avancés');
  });

  it('barre d’outils et panneau Axes : libellés STABLES, état dans des badges', () => {
    expect(html).toContain('Atelier — image unique');
    expect(html).toContain('Importer l&#x27;image');
    expect(html).not.toContain('Changer l&#x27;image');
    expect(html).toContain('Ajouter un cadre');
    expect(html).toContain('>Axes<');
    expect(html).toContain('Calibrer Y');
    // Le compteur de points n'est plus DANS le libellé du bouton
    expect(html).not.toMatch(/Calibrer Y \(/);
  });

  it('UNE seule KitButton primaire sur l’écran Tracé : « Interpoler & Valider »', () => {
    expect(html).toContain('Interpoler &amp; Valider');
    // Signature du KitButton primary (fond accent + texte blanc pur) — les
    // boutons internes des composants non refondus (CurveManager…) ne la
    // partagent pas.
    const primaries = html.split('background-color:var(--accent-primary);color:var(--color-white-pure)').length - 1;
    expect(primaries).toBe(1);
  });

  it('grands blocs du Tracé : courbes seulement — SANS testeur NI banc (décision pilote 20/08 : tests et banc vivent après interpolation, sur l\'écran Validation)', () => {
    expect(html).not.toContain('Testeur — cascade sur les graphes en l&#x27;état');
    expect(html).not.toContain('Banc de test — cas de référence du manuel');
    expect(html).toContain('Courbes du cadre actif');
  });
});

// ─── Écran Validation ──────────────────────────────────────────────────────

describe('AbacBuilder — assemblage écran Validation (Lot 1-G)', () => {
  it('checklist OK : bouton primaire « Valider et enregistrer » actif, champ nom présent', () => {
    const html = render(mkSession({ currentStep: 'final' }));
    // Retour pilote 20/08 : plus de check-list affichée nulle part — seule la
    // raison du bouton « Valider » survit de modelReadiness.
    expect(html).not.toContain('Check-list du modèle');
    expect(html).toContain('Nom du modèle');
    expect(html).toContain('Valider et enregistrer le modèle');
    // Rien ne bloque : pas d'aria-disabled sur la primaire
    expect(html).not.toContain('aria-disabled="true"');
  });

  it('items bloquants (2 primaires) : bouton désactivé AVEC raison — plus de popup', () => {
    const session = mkSession({ currentStep: 'final' });
    session.graphs[1].role = 'primary'; // deux primaires → item set:primary bloqué
    const html = render(session);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('À corriger avant l&#x27;enregistrement');
    expect(html).toContain('Graphique primaire et opération du set');
  });

  it('nom de modèle vide : champ marqué + bouton désactivé avec raison', () => {
    const html = render(mkSession({ currentStep: 'final', modelNameInput: '' }));
    expect(html).toContain('requis pour enregistrer');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Saisis le nom du modèle');
  });
});
