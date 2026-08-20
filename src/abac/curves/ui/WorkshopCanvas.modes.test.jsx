/**
 * Lot 1-E — UN SEUL MODE À LA FOIS sur le canevas de l'atelier.
 *
 * Même contrainte que kit.test.jsx : pas de @testing-library/react → rendu
 * statique via react-dom/server. On vérifie ici ce qui est PILOTÉ PAR LES
 * PROPS (les modes parent : tracé, Bézier) et les garde-fous statiques
 * (verrou d'image après calibration, sens du vent sans défaut, poignées de
 * cadre élargies). Les transitions locales (imageAdjust, calib) relèvent de
 * gestes souris non simulables sans DOM — couvertes par les gardes croisées
 * revues en revue de code.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkshopCanvas } from './WorkshopCanvas';

const noop = () => {};

const axes = {
  xAxis: { min: 0, max: 20, step: 5, unit: 'kt', title: 'wind_component' },
  yAxis: { min: 0, max: 100, step: 50, unit: 'ft', title: 'pressure_altitude' }
};

const mkWorkshop = (over = {}) => ({
  image: null,
  sharedY: { min: 0, max: 100, step: 50, unit: 'ft', title: 'pressure_altitude' },
  frames: [],
  ...over
});

const baseProps = {
  graphs: [],
  selectedGraphId: null,
  onWorkshopChange: noop,
  onFocusGraph: noop,
  onRequestGraphForFrame: () => null,
  onUpdateGraphXAxis: noop,
  onCreateCurve: noop,
  onFinishCurve: noop,
  onFinishBezier: noop
};

const frame = { graphId: 'g1', xLeftPx: 10, xRightPx: 240 };

describe('WorkshopCanvas — bandeau de mode permanent (ModeBanner du kit)', () => {
  it('mode TRACÉ : nomme la courbe, donne l’instruction Échap et le compteur de points', () => {
    const curve = { id: 'c1', name: '0 ft', color: '#f00', points: [{ id: 'p1', x: 1, y: 2 }] };
    const g = { id: 'g1', name: 'Altitude', isWindRelated: false, axes, curves: [curve] };
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({ frames: [frame] })}
        graphs={[g]}
        selectedGraphId="g1"
        selectedCurveId="c1"
        tracingMode
      />
    );
    expect(html).toContain('Tracé de « 0 ft »');
    expect(html).toContain('Cliquez dans le cadre actif — Échap pour terminer');
    expect(html).toContain('1 pt');
    // le bandeau vient bien du kit (sortie Échap annoncée)
    expect(html).toContain('Échap pour annuler');
  });

  it('mode BÉZIER : bandeau « Façonnage Bézier » dès que des segments existent', () => {
    const curve = { id: 'c1', name: '0 ft', color: '#f00', points: [] };
    const g = { id: 'g1', name: 'Altitude', isWindRelated: false, axes, curves: [curve] };
    const segments = [{ p0: { x: 0, y: 0 }, cp1: { x: 1, y: 10 }, cp2: { x: 2, y: 20 }, p1: { x: 3, y: 30 } }];
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({ frames: [frame] })}
        graphs={[g]}
        selectedGraphId="g1"
        selectedCurveId="c1"
        bezierSegments={segments}
      />
    );
    expect(html).toContain('Façonnage Bézier');
    expect(html).toContain('Tirez les poignées — Échap pour terminer');
  });

  it('aucun mode actif : aucun bandeau (l’écouteur Échap n’est pas monté)', () => {
    const g = { id: 'g1', name: 'Altitude', isWindRelated: false, axes, curves: [] };
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({ frames: [frame] })}
        graphs={[g]}
        selectedGraphId="g1"
      />
    );
    expect(html).not.toContain('Échap pour annuler');
  });
});

describe('WorkshopCanvas — piège « mode image qui traîne » : verrou calibrations', () => {
  it('dès qu’une calibration existe, « Ajuster l’image » est désactivé avec la raison affichée', () => {
    const g = { id: 'g1', name: 'Altitude', isWindRelated: false, axes, curves: [] };
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({
          image: { url: 'data:image/png;base64,x', x: 0, y: 0, width: 100, height: 100 },
          frames: [frame],
          yTicks: [{ value: 0, pixel: 400 }, { value: 100, pixel: 20 }]
        })}
        graphs={[g]}
        selectedGraphId="g1"
      />
    );
    expect(html).toContain('Ajuster l&#x27;image');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Image verrouillée : des calibrations existent');
    expect(html).toContain('Réinitialisez les calibrations pour ajuster');
  });

  it('sans calibration, le bouton est actif (pas de raison rendue)', () => {
    const g = { id: 'g1', name: 'Altitude', isWindRelated: false, axes, curves: [] };
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({
          image: { url: 'data:image/png;base64,x', x: 0, y: 0, width: 100, height: 100 },
          frames: [frame]
        })}
        graphs={[g]}
        selectedGraphId="g1"
      />
    );
    expect(html).toContain('Ajuster l&#x27;image');
    expect(html).not.toContain('Image verrouillée');
  });
});

describe('WorkshopCanvas — piège « sens du vent par défaut » (capsule Nouvelle courbe)', () => {
  const windGraph = {
    id: 'g1',
    name: 'Vent',
    isWindRelated: true,
    familyAxisVariable: 'wind_component',
    axes,
    curves: []
  };

  it('le sélecteur démarre sur l’option vide et la raison est affichée', () => {
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({ frames: [frame] })}
        graphs={[windGraph]}
        selectedGraphId="g1"
      />
    );
    expect(html).toContain('— sens du vent ? —');
    expect(html).toContain('Choisissez le sens du vent du guide');
  });

  it('« Créer & tracer » est désactivé tant que le sens n’est pas choisi', () => {
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({ frames: [frame] })}
        graphs={[windGraph]}
        selectedGraphId="g1"
      />
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Créer &amp; tracer<\/button>/);
  });

  it('un graphe non-vent ne montre ni sélecteur de sens ni raison vent', () => {
    const altGraph = {
      id: 'g1',
      name: 'Altitude',
      isWindRelated: false,
      familyAxisVariable: 'pressure_altitude',
      axes,
      curves: []
    };
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({ frames: [frame] })}
        graphs={[altGraph]}
        selectedGraphId="g1"
      />
    );
    expect(html).not.toContain('— sens du vent ? —');
    expect(html).not.toContain('Choisissez le sens du vent du guide');
  });
});

describe('WorkshopCanvas — affordance des poignées de cadre', () => {
  it('les barres-poignées portent une zone interactive élargie de 12 px (curseur ew-resize)', () => {
    const g = { id: 'g1', name: 'Altitude', isWindRelated: false, axes, curves: [] };
    const html = renderToStaticMarkup(
      <WorkshopCanvas
        {...baseProps}
        workshop={mkWorkshop({ frames: [frame] })}
        graphs={[g]}
        selectedGraphId="g1"
      />
    );
    // zone interactive : 12 px de large, 48 px de haut, centrée sur la barre
    expect(html).toContain('width="12"');
    expect(html).toContain('height="48"');
    expect(html).toContain('cursor:ew-resize');
    // l'ancienne bande invisible pleine hauteur (7 px) a disparu
    expect(html).not.toContain('width="7" height="484"');
  });
});
