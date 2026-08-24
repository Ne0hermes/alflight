// src/features/aircraft/components/wizard-steps/__tests__/Step2Speeds.render.test.jsx
//
// Rendu SERVEUR (sans DOM) de l'étape Vitesses — garde-fou contre un plantage au
// montage après la refonte du 21/08/2026 : tableau des vitesses de décrochage
// (lisse / décollage / atterrissage × 0° et 6 inclinaisons), VS T/O obligatoire,
// VFE T/O facultative déplacée dans « Vitesses d'utilisation ». On vérifie la
// STRUCTURE rendue, pas le style.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Step2Speeds from '../Step2Speeds';

const render = (data, errors = {}) => renderToStaticMarkup(
  <Step2Speeds data={data} updateData={() => {}} errors={errors} />
);

const fiche = { speeds: { vso: 45, vsTO: 48, vs1: 50, vne: 160, vno: 125, vfeLdg: 85 } };
const count = (html, needle) => html.split(needle).length - 1;

describe('Step2Speeds — rendu de l\'étape Vitesses', () => {
  it('une fiche SANS stallByBank s\'ouvre telle quelle : 18 cellules inclinées vides', () => {
    const html = render(fiche);
    expect(html).toContain('Vitesses de décrochage selon l');
    for (const h of ['0° *', '20°', '30°', '35°', '40°', '45°', '60°']) expect(html).toContain(h);
    // 3 configurations × 6 inclinaisons facultatives (grille générale, 24/08/2026)
    expect(count(html, 'aria-label="Décrochage ')).toBe(18);
    // colonne 0° = VS1 / VS T/O / VSO (mêmes champs que les arcs)
    expect(html).toContain('aria-label="VS1 — décrochage lisse');
    expect(html).toContain('aria-label="VS T/O — décrochage décollage');
    expect(html).toContain('aria-label="VSO — décrochage atterrissage');
  });

  it('les colonnes inclinées affichent les valeurs de speeds.stallByBank', () => {
    const html = render({ speeds: { ...fiche.speeds, stallByBank: { clean: { b20: 52 }, landing: { b60: 64 } } } });
    expect(html).toContain('value="52"');
    expect(html).toContain('value="64"');
  });

  it('VFE T/O n\'est plus obligatoire : absente du panneau des arcs, présente en « Vitesses d\'utilisation »', () => {
    const html = render(fiche);
    expect(html).not.toContain('VFE T/O (max volets décollage) *');
    expect(html).not.toContain('Repères additionnels');
    expect(html).toContain('VFE T/O - Vitesse max volets décollage');
  });

  it('une erreur de présence sur VS T/O est affichée sous le tableau', () => {
    const html = render({ speeds: { ...fiche.speeds, vsTO: '' } }, { 'speeds.vsTO': 'VS T/O est requise' });
    expect(html).toContain('VS T/O est requise');
  });

  it('les incohérences du tableau remontent dans l\'alerte (non bloquante)', () => {
    const html = render({ speeds: { ...fiche.speeds, stallByBank: { clean: { b20: 49 }, takeoff: { b20: 55 } } } });
    expect(html).toContain('Cohérence des vitesses (non bloquant)');
    expect(html).toContain('le décrochage croît avec l');
    expect(html).toContain('lisse ≥ décollage ≥ atterrissage');
  });
});
