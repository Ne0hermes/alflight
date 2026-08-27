/**
 * Cas de référence M&C SUR LE GRAPHIQUE (27/08/2026) — rendu statique.
 *
 * Demande pilote : chaque cas de référence doit être VISIBLE sur le graphique
 * de centrage — UN POINT PAR BRAS DE LEVIER utilisé (losange), le point
 * résultant (CG total) et le verdict d'écart chiffré. Même approche que
 * abacBuilderAssembly.test.jsx : renderToStaticMarkup, pas de @testing-library.
 *
 * NB : renderToStaticMarkup échappe le HTML — « M&C » sort « M&amp;C ».
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeightBalanceChart } from '../WeightBalanceChart';

// Même fiche que le banc moteur (referenceCases.test.js) + enveloppe complète.
const AVION = {
  registration: 'F-TEST',
  model: 'DR400',
  fuelType: 'AVGAS 100LL',
  weights: { emptyWeight: 600, mtow: 1100 },
  weightBalance: {
    emptyWeightArm: 0.30,
    frontLeftSeatArm: 0.41,
    frontRightSeatArm: 0.41,
    rearLeftSeatArm: 1.19,
    rearRightSeatArm: 1.19,
    fuelArm: 1.12,
    baggageArm: 1.90,
  },
  cgEnvelope: {
    forwardPoints: [{ weight: 550, cg: 0.205 }, { weight: 1100, cg: 0.28 }],
    aftCG: 0.564,
    aftMinWeight: 550,
    aftMaxWeight: 1100,
  },
  // cgFromReport / emptyWeightFromReport : les DEUX chiffres lus sur le rapport
  // de pesée. Depuis le 27/08 le cas AUTO se confronte au document et non plus
  // à la fiche elle-même ; sans eux il est listé « non vérifiable » et n'est
  // pas tracé (comportement couvert par son propre test plus bas).
  weighingReport: { certificationDate: '2024-03-12', cgFromReport: 0.30, emptyWeightFromReport: 600 },
  wbReferenceCases: [{
    id: 'poh-1',
    label: 'Exemple de chargement POH',
    source: 'Manuel de vol §6.5',
    postes: [
      { poste: 'frontLeft', masse: 77 },
      { poste: 'frontRight', masse: 77 },
      { poste: 'rearLeft', masse: 50 },
      { poste: 'baggage', masse: 20 },
      { poste: 'fuel', masse: 72 },
    ],
    cgAttendu: 0.470,
    toleranceCgMm: 5,
  }],
};

const SCENARIOS = {
  fulltank: { w: 900, cg: 0.45 },
  toCrm: { w: 890, cg: 0.45 },
  landing: { w: 850, cg: 0.44 },
  zfw: { w: 800, cg: 0.43 },
};

// showReferenceCases : la couche est ÉTEINTE par défaut depuis le 27/08 (elle
// se superposait au chargement du jour, jusque dans le récapitulatif imprimé).
// Les tests de tracé l'allument explicitement, comme le fait la case à cocher.
const render = (aircraft, showReferenceCases = true) => renderToStaticMarkup(
  <WeightBalanceChart aircraft={aircraft} scenarios={SCENARIOS} calculations={{}} showReferenceCases={showReferenceCases} />
);

describe('WeightBalanceChart — cas de référence M&C', () => {
  it('liste le banc (cas AUTO de la pesée + cas POH) avec verdict chiffré', () => {
    const html = render(AVION);
    expect(html).toContain('Cas de référence M&amp;C (2)');
    expect(html).toContain('Fiche de pesée — avion à vide');
    expect(html).toContain('Exemple de chargement POH');
    expect(html).toContain('✓ PASS');
    expect(html).toMatch(/écart/);
    expect(html).toMatch(/tolérance/);
  });

  it('trace UN LOSANGE PAR BRAS DE LEVIER sur les DEUX graphes (CG + Moment)', () => {
    const html = render(AVION);
    // Cas AUTO : 1 point (masse à vide). Cas POH : 6 points (masse à vide,
    // 2 sièges avant, siège arrière G, bagages, carburant). ×2 graphes = 14.
    const diamonds = (html.match(/rotate\(45 /g) || []).length;
    expect(diamonds).toBe(14);
    // Étiquette d'un poste à son bras (masse affichée en kg entiers).
    expect(html).toContain('Bagages · 20 kg');
    expect(html).toContain('Masse à vide · 600 kg');
  });

  it('pesée incomplète → cas listés « NON ÉVALUABLE » explicites, AUCUN losange', () => {
    const { weights, ...sansMasse } = AVION;
    const html = render(sansMasse);
    expect(html).toContain('NON ÉVALUABLE');
    expect(html).toMatch(/non évaluable/);
    expect((html.match(/rotate\(45 /g) || []).length).toBe(0);
  });

  // 27/08 — un cas que le moteur refuse de juger n'est plus tracé comme un cas
  // validé : sans les chiffres du rapport de pesée, le cas AUTO reste listé
  // mais ne trace rien (seuls les 6 points du cas POH subsistent, ×2 graphes).
  it('cas non vérifiable → listé mais NON tracé (fail-closed)', () => {
    const { weighingReport, ...sansRapport } = AVION;
    const html = render({ ...sansRapport, weighingReport: { certificationDate: '2024-03-12' } });
    expect(html).toMatch(/rapport de pesée/i);
    expect((html.match(/rotate\(45 /g) || []).length).toBe(12);
  });

  // 27/08 — la couche ne s'impose plus au graphique de préparation de vol.
  it('éteinte par défaut : aucun losange tant que le pilote ne l\'allume pas', () => {
    const html = render(AVION, false);
    expect((html.match(/rotate\(45 /g) || []).length).toBe(0);
    // La case à cocher reste offerte pour l'allumer.
    expect(html).toMatch(/bras de levier/);
  });

  // 27/08 — les postes ne dilatent plus les axes : l'enveloppe garde son cadre.
  it('les postes ne pilotent plus l\'échelle : l\'enveloppe garde exactement son tracé', () => {
    const allume = render(AVION, true);
    const eteint = render(AVION, false);
    // Le bras des bagages (1,90 m) est très au-delà de la limite arrière
    // (0,564 m) : s'il pilotait l'axe, le polygone de l'enveloppe serait
    // écrasé. On compare les coordonnées mêmes du tracé, pas son voisinage.
    const enveloppe = (h) => (h.match(/<polygon[^>]*points="[^"]+"/g) || []).join('|');
    expect(enveloppe(eteint)).not.toBe('');
    expect(enveloppe(allume)).toBe(enveloppe(eteint));
  });
});
